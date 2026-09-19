/* ==========================================================================
   BLACKVIBES STUDIO — tracks-data.js

   Defines window.BV_DEFAULT_TRACKS: the fallback demo tracks music.js shows
   before the real, server-saved track list has loaded (and if you haven't
   uploaded anything yet).

   ⚠️ HEADS UP: an earlier fix of mine replaced this file's content entirely
   with a fetch() script, which overwrote whatever demo tracks you originally
   had defined here (the site's "Midnight Circuit" placeholder, etc.). I don't
   have that original array anywhere in what you've sent me, so I can't
   restore it — this now ships as an empty list. If you still have it in
   your GitHub history (an earlier commit, before this file changed), you
   can pull the old array back out from there. Otherwise, just use the
   "Add A New Track" card on the Music page — every track you add now is
   saved for real, for every visitor.

   Fetching the real, server-saved tracks now happens in admin.js
   (fetchInitialTracks), which dispatches 'bv:tracks-changed' once they're
   in — music.js already listens for that event and swaps them in.
   ========================================================================== */
window.BV_DEFAULT_TRACKS = [];
