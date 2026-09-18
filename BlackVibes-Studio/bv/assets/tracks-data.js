/* ==========================================================================
   BLACKVIBES STUDIO — shared default track catalogue
   Single source of truth for the built-in songs, used by both music.js
   (the player/tracklist) and calendar.js (the Home page release calendar)
   so the two never drift out of sync. Once the owner edits anything in
   admin mode, the saved copy in this browser's localStorage (via
   BVAdmin.getTracks()) takes over as the real source of truth instead.
   ========================================================================== */
window.BV_DEFAULT_TRACKS=[
 {id:'t1',title:'Midnight Circuit',genre:'Deep House',dur:'3:42',bpm:122,root:55,art:'art1',status:'released',type:'synth',cover:null,
  releaseDate:'2026-08-14',likes:214,
  kick:'1000100010001000',clap:'0000100000001000',hat:'0010001000100010',ohat:'0000000000000010',
  bass:[null,null,0,null,null,null,0,null,null,null,0,null,null,null,0,null],
  lead:[12,null,null,null,15,null,null,10,null,null,12,null,7,null,null,null]},
 {id:'t2',title:'Velvet Static',genre:'Neo Soul',dur:'4:05',bpm:92,root:65.41,art:'art2',status:'released',type:'synth',cover:null,
  releaseDate:'2026-07-02',likes:156,
  kick:'1000000100100000',clap:'0000100000001000',hat:'1010101010101011',ohat:'0000000000000000',
  bass:[0,null,null,null,null,null,10,null,null,null,0,null,null,7,null,null],
  lead:[24,null,null,27,null,null,22,null,null,24,null,null,19,null,null,null]},
 {id:'t3',title:'Ghost Frequency',genre:'Techno',dur:'5:18',bpm:128,root:49,art:'art3',status:'released',type:'synth',cover:null,
  releaseDate:'2026-05-19',likes:301,
  kick:'1000100010001000',clap:'0000100000001000',hat:'0010001000100010',ohat:'0000000000100000',
  bass:[0,null,0,null,0,null,0,null,0,null,0,null,0,null,3,null],
  lead:[24,null,24,null,36,null,24,null,31,null,24,null,22,null,24,null]},
 {id:'t4',title:'Silver Lining',genre:'Synth Pop',dur:'3:28',bpm:100,root:82.41,art:'art4',status:'released',type:'synth',cover:null,
  releaseDate:'2026-04-03',likes:98,
  kick:'1000000010010010',clap:'0000100000001000',hat:'1010101010101010',ohat:'0000000000000000',
  bass:[0,null,null,null,null,null,null,7,null,null,null,5,null,null,10,null],
  lead:[24,null,27,null,31,null,27,null,24,null,27,null,34,null,31,null]},
 {id:'t5',title:'Afterglow',genre:'Lo-Fi',dur:'2:58',bpm:84,root:87.31,art:'art5',status:'released',type:'synth',cover:null,
  releaseDate:'2026-02-11',likes:177,
  kick:'1000000000100000',clap:'0000100000001000',hat:'1010101010101010',ohat:'0000000000000000',
  bass:[0,null,null,null,null,null,null,null,5,null,null,null,null,null,3,null],
  lead:[24,null,null,22,null,null,19,null,null,22,null,null,24,null,null,null]},
 {id:'t6',title:'Blackout Anthem',genre:'Drum & Bass',dur:'4:44',bpm:172,root:55,art:'art6',status:'released',type:'synth',cover:null,
  releaseDate:'2026-01-08',likes:243,
  kick:'1000000000100000',clap:'0000100000001000',hat:'1010101010101010',ohat:'0010000000000000',
  bass:[0,null,0,null,null,0,null,null,0,null,0,null,null,0,null,12],
  lead:[24,null,null,null,31,null,null,29,null,null,27,null,24,null,null,null]},
 {id:'t7',title:'Paper Skies',genre:'Ambient',dur:'3:10',bpm:78,root:73.42,art:'art3',status:'soon',type:'synth',cover:null,
  releaseDate:'2026-10-28',likes:12,
  kick:'1000000000000000',clap:'0000000000000000',hat:'0010001000100010',ohat:'0000000000000000',
  bass:[0,null,null,null,null,null,null,null,7,null,null,null,null,null,null,null],
  lead:[19,null,null,24,null,null,22,null,null,19,null,null,17,null,null,null]},
 {id:'t8',title:'Neon Prayer',genre:'Synth Pop',dur:'3:52',bpm:104,root:69.30,art:'art4',status:'soon',type:'synth',cover:null,
  releaseDate:'2026-11-15',likes:6,
  kick:'1000100010001000',clap:'0000100000001000',hat:'1010101010101010',ohat:'0000000000000000',
  bass:[0,null,null,7,null,null,0,null,null,7,null,null,10,null,null,null],
  lead:[26,null,29,null,31,null,29,null,26,null,29,null,33,null,31,null]}
];
