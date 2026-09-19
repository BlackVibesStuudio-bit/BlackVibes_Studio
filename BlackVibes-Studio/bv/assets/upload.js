/* ==========================================================================
   BLACKVIBES STUDIO — api/upload.js
   Serverless function (Vercel Edge Runtime).

   PLACEMENT MATTERS: this file must live at  <project-root>/api/upload.js
   — i.e. right next to index.html's api/ folder, NOT inside assets/.
   Vercel only turns files under a top-level /api directory into real
   serverless functions; anywhere else they're just static files, which is
   why the previous version 404'd.

   Two actions, both POST here:
   - action "uploadAudio" (multipart/form-data): stores an audio file in
     Vercel Blob storage and returns its permanent public URL. Used once
     per song, right before saving the track's metadata.
   - action "set" (application/json): overwrites the shared tracks.json
     manifest with the full track list sent from the browser. Used for
     add / edit / delete / drag-reorder — the client already keeps the
     full, correct TRACKS array in memory (same as before), so this just
     persists it for every visitor instead of only localStorage.

   Both actions re-check the PIN on the server via ADMIN_PIN_HASH — the
   client-side PIN in admin.js only hides/shows UI, it is not the real
   gate; this is.

   SETUP REQUIRED (one-time, in your Vercel project):
   1. Vercel dashboard → your project → Storage → Create Database → Blob.
      This auto-adds a BLOB_READ_WRITE_TOKEN env var for you.
   2. Add env var ADMIN_PIN_HASH = sha256 hex of your chosen PIN:
        node -e "console.log(require('crypto').createHash('sha256').update('YOUR_PIN').digest('hex'))"
      Paste the printed value into Vercel → Settings → Environment
      Variables, then redeploy. It must match the PIN_HASH your
      assets/admin.js uses for the same PIN (see the comment there).
   3. npm install @vercel/blob — commit the updated package.json /
      package-lock.json.
   ========================================================================== */

import { put } from '@vercel/blob';

export const config = { runtime: 'edge' };

const MANIFEST_PATH = 'data/tracks.json';

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function bad(status, error) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function writeManifest(tracks) {
  await put(MANIFEST_PATH, JSON.stringify({ tracks, updatedAt: Date.now() }), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  });
}

export default async function handler(req) {
  if (req.method !== 'POST') return bad(405, 'Method not allowed');
  if (!process.env.ADMIN_PIN_HASH) {
    return bad(500, 'Server is missing ADMIN_PIN_HASH — see setup notes at the top of api/upload.js');
  }

  const contentType = req.headers.get('content-type') || '';

  /* ---------------- action: set (JSON body, no file) ---------------- */
  if (contentType.includes('application/json')) {
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return bad(400, 'Invalid JSON body');
    }

    const pin = String(body.pin || '').trim();
    const pinHash = await sha256Hex(pin);
    if (!pin || pinHash !== process.env.ADMIN_PIN_HASH) return bad(401, 'Invalid PIN');

    if (body.action !== 'set') return bad(400, 'Unknown action');

    const tracks = Array.isArray(body.tracks) ? body.tracks : [];
    await writeManifest(tracks);
    return new Response(JSON.stringify({ tracks }), {
      headers: { 'content-type': 'application/json' },
    });
  }

  /* ---------------- action: uploadAudio (multipart file) ---------------- */
  let form;
  try {
    form = await req.formData();
  } catch (e) {
    return bad(400, 'Could not parse upload (expected multipart/form-data)');
  }

  const pin = String(form.get('pin') || '').trim();
  const pinHash = await sha256Hex(pin);
  if (!pin || pinHash !== process.env.ADMIN_PIN_HASH) return bad(401, 'Invalid PIN');

  if (String(form.get('action') || '') !== 'uploadAudio') return bad(400, 'Unknown action');

  const audioFile = form.get('audio');
  if (!audioFile || typeof audioFile !== 'object' || !audioFile.size) {
    return bad(400, 'No audio file provided');
  }
  if (audioFile.size > 25 * 1024 * 1024) return bad(400, 'Audio file too large (25MB max)');

  const safeName = String(audioFile.name || 'track').replace(/[^a-zA-Z0-9._-]/g, '_');
  const up = await put(`tracks/${Date.now()}-${safeName}`, audioFile, {
    access: 'public',
    addRandomSuffix: true,
    contentType: audioFile.type || 'audio/mpeg',
  });

  return new Response(JSON.stringify({ audioUrl: up.url }), {
    headers: { 'content-type': 'application/json' },
  });
}
