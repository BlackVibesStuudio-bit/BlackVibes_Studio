/* ==========================================================================
   BLACKVIBES STUDIO — api/tracks.js
   Serverless function (Vercel Edge Runtime).
   Public, read-only. No PIN required — anyone visiting the site needs to
   be able to load the current track list. Only writes (api/upload.js)
   require the PIN.
   ========================================================================== */

import { list } from '@vercel/blob';

export const config = { runtime: 'edge' };

const MANIFEST_PATH = 'data/tracks.json';

export default async function handler(req) {
  try {
    const { blobs } = await list({ prefix: MANIFEST_PATH });
    const entry = blobs.find(b => b.pathname === MANIFEST_PATH);

    if (!entry) {
      return new Response(JSON.stringify({ tracks: [] }), {
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      });
    }

    const res = await fetch(entry.url, { cache: 'no-store' });
    const data = res.ok ? await res.json() : { tracks: [] };

    return new Response(JSON.stringify({ tracks: Array.isArray(data.tracks) ? data.tracks : [] }), {
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  } catch (e) {
    console.warn('/api/tracks failed:', e);
    return new Response(JSON.stringify({ tracks: [], error: 'Could not load tracks' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
