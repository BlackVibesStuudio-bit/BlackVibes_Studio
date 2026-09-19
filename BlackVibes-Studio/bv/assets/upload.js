/* ==========================================================================
   BLACKVIBES STUDIO — /api/upload.js
   Serverless function (Vercel Edge Runtime).

   This is the piece that makes uploads REAL instead of per-tab/in-memory:
   - Verifies the admin PIN on the SERVER (client-side PIN checks can always
     be bypassed via devtools — this is the actual gate).
   - Saves the audio file + cover image to Vercel Blob storage (persistent,
     public URLs, survives redeploys).
   - Rewrites a JSON "manifest" (tracks.json) that lists every track, so any
     visitor's browser can fetch the current list via /api/tracks.

   SETUP REQUIRED (one-time, in your Vercel project):
   1. Vercel dashboard → your project → Storage → Create → Blob.
      This automatically adds a BLOB_READ_WRITE_TOKEN env var — you don't
      need to copy/paste anything for that one.
   2. Add an env var ADMIN_PIN_HASH = sha256 hex of your chosen PIN.
      Generate it locally with:
        node -e "console.log(require('crypto').createHash('sha256').update('YOUR_PIN_HERE').digest('hex'))"
      Paste the printed hash as the ADMIN_PIN_HASH value in Vercel →
      Settings → Environment Variables. Redeploy after adding it.
   3. `npm install @vercel/blob` (add it to package.json) and redeploy.
   ========================================================================== */

import { put, list } from '@vercel/blob';

export const config = { runtime: 'edge' };

const MANIFEST_PATH = 'data/tracks.json';

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function readManifest() {
  try {
    const { blobs } = await list({ prefix: MANIFEST_PATH });
    const entry = blobs.find(b => b.pathname === MANIFEST_PATH);
    if (!entry) return [];
    const res = await fetch(entry.url, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.tracks) ? data.tracks : [];
  } catch (e) {
    console.warn('readManifest failed:', e);
    return [];
  }
}

async function writeManifest(tracks) {
  await put(MANIFEST_PATH, JSON.stringify({ tracks, updatedAt: Date.now() }), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  });
}

function bad(status, error) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export default async function handler(req) {
  if (req.method !== 'POST') return bad(405, 'Method not allowed');
  if (!process.env.ADMIN_PIN_HASH) {
    return bad(500, 'Server is missing ADMIN_PIN_HASH — see setup notes in api/upload.js');
  }

  let form;
  try {
    form = await req.formData();
  } catch (e) {
    return bad(400, 'Could not parse upload (expected multipart/form-data)');
  }

  // ---- server-side auth (the real gate) ----
  const pin = String(form.get('pin') || '').trim();
  const pinHash = await sha256Hex(pin);
  if (!pin || pinHash !== process.env.ADMIN_PIN_HASH) {
    return bad(401, 'Invalid PIN');
  }

  const action = String(form.get('action') || 'add');

  // ---- delete ----
  if (action === 'delete') {
    const id = String(form.get('id') || '');
    if (!id) return bad(400, 'Missing track id');
    const tracks = await readManifest();
    const next = tracks.filter(t => t.id !== id);
    await writeManifest(next);
    return new Response(JSON.stringify({ tracks: next }), {
      headers: { 'content-type': 'application/json' },
    });
  }

  // ---- add / update ----
  const title = String(form.get('title') || 'Untitled').trim();
  const genre = String(form.get('genre') || '').trim();
  const bpm = String(form.get('bpm') || '').trim();
  const status = form.get('status') === 'released' ? 'released' : 'soon';
  const artInitials = String(form.get('artInitials') || title.slice(0, 2).toUpperCase()).trim();
  const id = String(form.get('id') || '') || ('trk_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7));

  const audioFile = form.get('audio');
  const coverFile = form.get('cover');

  let audioUrl = null;
  let coverUrl = null;

  if (audioFile && typeof audioFile === 'object' && audioFile.size > 0) {
    if (audioFile.size > 25 * 1024 * 1024) return bad(400, 'Audio file too large (25MB max)');
    const up = await put(`tracks/audio-${id}-${audioFile.name}`, audioFile, {
      access: 'public',
      addRandomSuffix: true,
      contentType: audioFile.type || 'audio/mpeg',
    });
    audioUrl = up.url;
  }

  if (coverFile && typeof coverFile === 'object' && coverFile.size > 0) {
    if (coverFile.size > 8 * 1024 * 1024) return bad(400, 'Cover image too large (8MB max)');
    const up = await put(`tracks/cover-${id}-${coverFile.name}`, coverFile, {
      access: 'public',
      addRandomSuffix: true,
      contentType: coverFile.type || 'image/jpeg',
    });
    coverUrl = up.url;
  }

  const tracks = await readManifest();
  const existingIdx = tracks.findIndex(t => t.id === id);
  const newTrack = {
    id,
    title,
    genre,
    bpm,
    status,
    artInitials,
    audioUrl: audioUrl || (existingIdx >= 0 ? tracks[existingIdx].audioUrl : null),
    coverUrl: coverUrl || (existingIdx >= 0 ? tracks[existingIdx].coverUrl : null),
    likes: existingIdx >= 0 ? (tracks[existingIdx].likes || 0) : 0,
    createdAt: existingIdx >= 0 ? tracks[existingIdx].createdAt : Date.now(),
  };

  if (existingIdx >= 0) tracks[existingIdx] = newTrack;
  else tracks.unshift(newTrack);

  await writeManifest(tracks);

  return new Response(JSON.stringify({ track: newTrack, tracks }), {
    headers: { 'content-type': 'application/json' },
  });
}
