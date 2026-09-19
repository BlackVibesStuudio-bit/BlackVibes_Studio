/* ==========================================================================
   BLACKVIBES STUDIO — tracks-data.js  (rewritten)

   BEFORE: this file held a hardcoded, static array of tracks — every
   visitor saw the same fixed list forever, and admin edits only ever
   lived in localStorage on the admin's own browser.

   NOW: this file fetches the real, shared track list from /api/tracks
   (backed by Vercel Blob storage via api/upload.js) and exposes it the
   same way — as window.BV_TRACKS — so admin uploads actually show up
   for every visitor, on every device.

   IMPORTANT: because the fetch is asynchronous, whatever renders the
   tracklist (music.js) needs to render once tracks are ready, not just
   read window.BV_TRACKS synchronously at load. This file dispatches:

     document.addEventListener('bv:tracks-ready', (e) => {
       const tracks = e.detail.tracks; // array, render it here
     });

   fired once on initial load, and again any time admin.js pushes a
   change (add/edit/delete), so the page updates live without a reload.

   Each track object looks like:
     {
       id: 'trk_...',
       title: 'Midnight Circuit',
       genre: 'Deep House · 122 BPM',
       bpm: '122',
       status: 'released' | 'soon',
       artInitials: 'MC',
       audioUrl: 'https://...blob.vercel-storage.com/tracks/audio-....mp3' | null,
       coverUrl: 'https://...blob.vercel-storage.com/tracks/cover-....jpg' | null,
       likes: 0,
       createdAt: 1737000000000
     }
   ========================================================================== */
(function () {
  'use strict';

  window.BV_TRACKS = window.BV_TRACKS || [];

  function announce(tracks) {
    window.BV_TRACKS = Array.isArray(tracks) ? tracks : [];
    document.dispatchEvent(new CustomEvent('bv:tracks-ready', { detail: { tracks: window.BV_TRACKS } }));
  }

  async function loadTracks() {
    try {
      const res = await fetch('/api/tracks', { cache: 'no-store' });
      if (!res.ok) throw new Error('bad status ' + res.status);
      const data = await res.json();
      announce(data.tracks || []);
    } catch (e) {
      console.warn('Could not load tracks from /api/tracks:', e);
      announce([]); // fail quiet — empty tracklist rather than a broken page
    }
  }

  // admin.js dispatches this after a successful upload/delete so the page
  // updates immediately, without waiting for a refetch.
  document.addEventListener('bv:tracks-changed', (e) => {
    announce(e.detail && e.detail.tracks);
  });

  loadTracks();
})();
