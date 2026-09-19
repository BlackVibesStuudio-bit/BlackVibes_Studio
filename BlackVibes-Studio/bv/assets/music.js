/* ==========================================================================
   BLACKVIBES STUDIO — music.html
   Public: vinyl player + tracklist + Like button (localStorage per browser).
   Admin (only when BVAdmin.unlocked): add / edit / remove / reorder
   tracks, toggle Released↔Coming Soon, set release date, drag-drop cover
   + audio uploads.
   ========================================================================== */
(function(){'use strict';
const fmtT=s=>{s=Math.max(0,Math.floor(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
const parseDur=d=>{const[m,s]=d.split(':').map(Number);return m*60+s};
const initials=t=>t.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
const ARTS=['art1','art2','art3','art4','art5','art6'];
const todayISO=()=>new Date().toISOString().slice(0,10);

/* migrate/normalize a track object — fills in any fields missing from an
   older saved copy so past localStorage data never breaks on an update */
function normalize(tr){
  return Object.assign({
    releaseDate:todayISO(), likes:0, status:'released', type:'synth', cover:null, audioUrl:null
  },tr);
}

const DEFAULT_TRACKS=(window.BV_DEFAULT_TRACKS||[]).map(normalize);
let TRACKS=((window.BVAdmin && BVAdmin.getTracks()) || DEFAULT_TRACKS.slice()).map(normalize);

/* ---------- likes (public, per-browser) ---------- */
const LS_LIKES='bv_liked_tracks';
function getLikedSet(){
  try{ return new Set(JSON.parse(localStorage.getItem(LS_LIKES)||'[]')); }
  catch(e){ return new Set(); }
}
function saveLikedSet(set){
  try{ localStorage.setItem(LS_LIKES, JSON.stringify([...set])); }catch(e){}
}
let liked=getLikedSet();
function isLiked(id){ return liked.has(id); }
function displayLikes(tr){ return (tr.likes||0) + (isLiked(tr.id)?1:0); }
function toggleLike(tr,btnEl){
  const now=isLiked(tr.id);
  if(now) liked.delete(tr.id); else liked.add(tr.id);
  saveLikedSet(liked);
  if(btnEl){
    btnEl.classList.toggle('liked',!now);
    btnEl.querySelector('span').textContent=displayLikes(tr);
    btnEl.classList.remove('pop'); void btnEl.offsetWidth; btnEl.classList.add('pop');
  }
  if(!now && typeof AE!=='undefined'){ AE.resume(); AE.blip(AE.t(),880,.12,.08); AE.blip(AE.t()+.05,1320,.1,.08); }
}

/* ---------- shared HTML5 audio backend, for admin-uploaded tracks ---------- */
let htmlAudio=null;
function getHtmlAudio(){
  if(!htmlAudio){ htmlAudio=new Audio(); htmlAudio.preload='none'; }
  return htmlAudio;
}

function trackStep(s,t){ const tr=TRACKS[Player.cur]; if(!tr||tr.type!=='synth')return;
  if(tr.kick[s]==='1')AE.kick(t,.95); if(tr.clap[s]==='1')AE.clap(t,.9);
  if(tr.hat[s]==='1')AE.hat(t,.8); if(tr.ohat[s]==='1')AE.hat(t,.55,true);
  const b=tr.bass[s]; if(b!=null)AE.bass(t,tr.root*Math.pow(2,b/12),.24,.5);
  const l=tr.lead[s]; if(l!=null)AE.pluck(t,tr.root*Math.pow(2,l/12),.24); }

const Player={cur:-1,seq:new Sequencer(trackStep),startT:0,dur:1,progTimer:null,
  play(i){
    const tr=TRACKS[i];
    if(!tr) return;
    if(tr.status==='soon' && !(window.BVAdmin&&BVAdmin.unlocked)){
      toast("This one's coming soon — check back for the full release!",'fa-clock'); return;
    }
    if(i===this.cur && this.isPlaying()){ this.stop(); return; }
    this.stopAll();
    this.cur=i;
    if(tr.type==='upload'){
      const url=tr.audioUrl;
      if(!url){
        toast("This track's audio file is missing — re-upload it in the editor.",'fa-triangle-exclamation');
        refreshPlayerUI(); return;
      }
      const a=getHtmlAudio();
      a.src=url; a.currentTime=0; a.play().catch(()=>{});
      this.dur=isFinite(a.duration)?a.duration:parseDur(tr.dur);
      a.onloadedmetadata=()=>{ this.dur=a.duration; $('#progDur').textContent=fmtT(this.dur); };
      a.ontimeupdate=()=>{ $('#progFill').style.width=(a.currentTime/(this.dur||1)*100).toFixed(2)+'%'; $('#progCur').textContent=fmtT(a.currentTime); };
      a.onended=()=>{ refreshPlayerUI(); };
    }else{
      this.dur=parseDur(tr.dur);
      AE.resume(); this.seq.start(tr.bpm); this.startT=AE.t(); this.startProgress();
    }
    refreshPlayerUI();
  },
  isPlaying(){ const tr=TRACKS[this.cur]; if(!tr)return false;
    return tr.type==='upload' ? !!(htmlAudio && !htmlAudio.paused) : this.seq.playing; },
  stop(){ this.stopAll(); refreshPlayerUI(); },
  stopAll(){
    this.seq.stop(); clearInterval(this.progTimer); this.progTimer=null;
    if(htmlAudio){ htmlAudio.pause(); htmlAudio.onended=null; }
  },
  startProgress(){ const dur=this.dur; $('#progDur').textContent=fmtT(dur); $('#progCur').textContent='0:00';
    clearInterval(this.progTimer);
    const upd=()=>{ let el=AE.t()-this.startT; if(el<0)el=0; if(el>dur)el%=dur;
      $('#progFill').style.width=(el/dur*100).toFixed(2)+'%'; $('#progCur').textContent=fmtT(el); };
    upd(); this.progTimer=setInterval(upd,250); }
};

function refreshPlayerUI(){
  const playing=Player.isPlaying(), tr=TRACKS[Player.cur];
  $$('.track').forEach((row,i)=>{ const on=(i===Player.cur&&playing);
    row.classList.toggle('current',on);
    const pi=row.querySelector('.t-play i'); if(pi) pi.className=on?'fa-solid fa-pause':'fa-solid fa-play';
    const eqEl=row.querySelector('.t-eq'); if(eqEl) eqEl.classList.toggle('on',on); });
  $('#featPlayIcon').className=playing?'fa-solid fa-pause':'fa-solid fa-play';
  $('#featVinyl').classList.toggle('playing',playing);
  $('#featEq').classList.toggle('on',playing);
  if(tr){ $('#featTitle').textContent=tr.title;
    $('#featGenre').textContent=tr.genre+(tr.type==='synth'?' · '+tr.bpm+' BPM':'');
    renderCoverInto($('#featArt'),tr);
    const fl=$('#featLike'); if(fl){ fl.classList.toggle('liked',isLiked(tr.id)); fl.querySelector('span').textContent=displayLikes(tr); }
  }
}

function renderCoverInto(el,tr){
  el.className='t-cover feat-art editable '+(tr.cover?'':(tr.art||'art1'));
  el.style.backgroundImage=tr.cover?`url(${tr.cover})`:'';
  el.style.backgroundSize='cover'; el.style.backgroundPosition='center';
  el.innerHTML=`<span>${initials(tr.title)}</span>`;
}

function fmtDate(iso){
  if(!iso) return '';
  const d=new Date(iso+'T00:00:00');
  if(isNaN(d)) return iso;
  return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}

/* ---------- render tracklist (public + admin controls) ---------- */
function renderTracklist(){
  const list=$('#tracklist'); if(!list) return;
  list.innerHTML='';
  const unlocked=window.BVAdmin && BVAdmin.unlocked;
  TRACKS.forEach((tr,i)=>{
    const row=document.createElement('div'); row.className='track'; row.draggable=unlocked;
    row.dataset.id=tr.id; row.id='track-'+tr.id;
    row.innerHTML=`
      ${unlocked?'<span class="track-drag" title="Drag to reorder"><i class="fa-solid fa-grip-lines-vertical"></i></span>':''}
      <span class="idx">${String(i+1).padStart(2,'0')}</span>
      <div class="t-cover tilt editable ${tr.cover?'':tr.art}" style="${tr.cover?`background-image:url(${tr.cover});background-size:cover;background-position:center`:''}"><span>${initials(tr.title)}</span></div>
      <div class="t-info">
        <div class="t-title">${tr.title}${tr.status==='soon'?'<span class="status-chip soon">Coming Soon</span>':(i===0&&tr.status==='released'?'<span class="chip">New</span>':'')}</div>
        <div class="t-genre">${tr.genre}${tr.type==='synth'?' · '+tr.bpm+' BPM':' · uploaded'} · ${fmtDate(tr.releaseDate)}</div>
      </div>
      <button class="like-btn ${isLiked(tr.id)?'liked':''}" data-act="like" aria-label="Like ${tr.title}" title="Like this track">
        <i class="fa-solid fa-heart"></i><span>${displayLikes(tr)}</span>
      </button>
      <div class="t-eq eq"><i></i><i></i><i></i><i></i></div>
      <span class="t-time">${tr.dur}</span>
      <button class="t-play" aria-label="Play ${tr.title}"><i class="fa-solid fa-${tr.status==='soon'&&!unlocked?'lock':'play'}"></i></button>
      <div class="track-admin">
        <button class="icon-3d" data-act="edit" title="Edit"><i class="fa-solid fa-pen"></i></button>
        <button class="icon-3d danger" data-act="remove" title="Remove"><i class="fa-solid fa-trash"></i></button>
      </div>`;
    row.querySelector('.t-play').addEventListener('click',e=>{ e.stopPropagation(); Player.play(i); });
    row.querySelector('.t-cover').addEventListener('click',e=>{ if(unlocked){ e.stopPropagation(); openTrackEditor(tr.id); } else Player.play(i); });
    row.querySelector('[data-act="like"]').addEventListener('click',e=>{ e.stopPropagation(); toggleLike(tr,e.currentTarget); if(tr.id===TRACKS[Player.cur]?.id) refreshPlayerUI(); });
    const editBtn=row.querySelector('[data-act="edit"]'); if(editBtn) editBtn.addEventListener('click',e=>{ e.stopPropagation(); openTrackEditor(tr.id); });
    const rmBtn=row.querySelector('[data-act="remove"]'); if(rmBtn) rmBtn.addEventListener('click',async e=>{
      e.stopPropagation();
      const ok=await BVAdmin.confirm(`Remove "${tr.title}" from the tracklist?`,'Remove');
      if(ok){ TRACKS=TRACKS.filter(x=>x.id!==tr.id); persistAndRerender(); }
    });
    wireDragReorder(row,tr.id);
    list.appendChild(row);
  });

  if(Player.cur<0 && TRACKS.length){ Player.cur=0; refreshPlayerUI(); }
  else refreshPlayerUI();

  renderAddTrackCard();
  highlightFromHash();
}

function highlightFromHash(){
  if(!location.hash) return;
  const el=document.getElementById(location.hash.slice(1));
  if(el){
    el.scrollIntoView({behavior:'smooth',block:'center'});
    el.classList.add('track-highlight');
    setTimeout(()=>el.classList.remove('track-highlight'),2200);
  }
}

function wireDragReorder(row,id){
  row.addEventListener('dragstart',e=>{ row.classList.add('dragging'); e.dataTransfer.setData('text/plain',id); });
  row.addEventListener('dragend',()=>row.classList.remove('dragging'));
  row.addEventListener('dragover',e=>{
    if(!(window.BVAdmin&&BVAdmin.unlocked)) return;
    e.preventDefault();
    const r=row.getBoundingClientRect(); const before=(e.clientY-r.top)<r.height/2;
    row.classList.toggle('drag-over-top',before); row.classList.toggle('drag-over-bottom',!before);
  });
  row.addEventListener('dragleave',()=>{ row.classList.remove('drag-over-top','drag-over-bottom'); });
  row.addEventListener('drop',e=>{
    e.preventDefault();
    row.classList.remove('drag-over-top','drag-over-bottom');
    const draggedId=e.dataTransfer.getData('text/plain');
    if(!draggedId||draggedId===id) return;
    const from=TRACKS.findIndex(t=>t.id===draggedId), to=TRACKS.findIndex(t=>t.id===id);
    if(from<0||to<0) return;
    const [moved]=TRACKS.splice(from,1);
    const r=row.getBoundingClientRect(); const before=(e.clientY-r.top)<r.height/2;
    let insertAt=TRACKS.findIndex(t=>t.id===id); if(!before) insertAt++;
    TRACKS.splice(insertAt,0,moved);
    persistAndRerender();
  });
}

function persistAndRerender(){
  if(window.BVAdmin) BVAdmin.setTracks(TRACKS);
  renderTracklist();
}

function renderAddTrackCard(){
  let card=document.getElementById('addTrackCard');
  if(!card){
    card=document.createElement('div'); card.id='addTrackCard'; card.className='add-track-card';
    card.innerHTML='<i class="fa-solid fa-circle-plus"></i><span>Add A New Track</span>';
    card.addEventListener('click',()=>openTrackEditor(null));
    $('#tracklist').insertAdjacentElement('afterend',card);
  }
}

/* ---------- admin: add/edit track modal ---------- */
function openTrackEditor(id){
  const editing=id?TRACKS.find(t=>t.id===id):null;
  const draft=editing?Object.assign({},editing):{
    id:BVAdmin.uid('t'),title:'',genre:'',dur:'3:00',bpm:110,root:55,art:ARTS[Math.floor(Math.random()*ARTS.length)],
    status:'released',type:'synth',cover:null,releaseDate:todayISO(),likes:0,
    kick:'1000100010001000',clap:'0000100000001000',hat:'1010101010101010',ohat:'0000000000000000',
    bass:[0,null,null,null,null,null,null,null,0,null,null,null,null,null,null,null],
    lead:[12,null,null,null,15,null,null,10,null,null,12,null,7,null,null,null]
  };
  let uploadedAudioFile=null;

  BVAdmin.openModal(`
    <div class="bv-modal-icon"><i class="fa-solid fa-music"></i></div>
    <h3>${editing?'Edit Track':'Add Track'}</h3>
    <div class="field" style="margin-top:18px">
      <label>Cover Art</label>
      <div class="dropzone" id="coverDrop">
        ${draft.cover?`<img class="dropzone-thumb" src="${draft.cover}" id="coverThumb">`:'<i class="fa-solid fa-image"></i>'}
        <p>Drag &amp; drop a cover image, or click to browse</p>
        <input type="file" id="coverFile" accept="image/*">
      </div>
    </div>
    <div class="field"><label>Title</label><input type="text" id="fTitle" value="${escapeAttr(draft.title)}" placeholder="Track title"></div>
    <div class="field"><label>Genre</label><input type="text" id="fGenre" value="${escapeAttr(draft.genre)}" placeholder="e.g. Deep House"></div>
    <div class="field"><label>Release Date</label><input type="date" id="fDate" value="${escapeAttr(draft.releaseDate)}"></div>
    <div class="field">
      <label>Song File (optional — uploaded and saved for every visitor)</label>
      <div class="dropzone" id="audioDrop">
        <i class="fa-solid fa-file-audio"></i>
        <p id="audioDropLabel">${draft.type==='upload'?'Audio attached — drop a new file to replace it':'Drag & drop an MP3/WAV, or click to browse'}</p>
        <input type="file" id="audioFile" accept="audio/*">
      </div>
    </div>
    <div class="field" style="display:flex;align-items:center;justify-content:space-between">
      <label style="margin:0">Status — flip to put it straight on the Home page Release Calendar</label>
      <span id="statusToggleHost"></span>
    </div>
    <div class="bv-modal-actions">
      <button class="btn" data-modal-close>Cancel</button>
      <button class="btn btn-violet btn-3d violet" id="saveTrackBtn"><i class="fa-solid fa-check"></i> Save Track</button>
    </div>
  `,(root,close)=>{
    const toggle=BVAdmin.statusToggle(draft.status,s=>{ draft.status=s; });
    root.querySelector('#statusToggleHost').appendChild(toggle.el);

    const coverDrop=root.querySelector('#coverDrop'), coverInput=root.querySelector('#coverFile');
    setupDropzone(coverDrop,coverInput,async file=>{
      try{
        const dataUrl=await BVAdmin.compressImage(file,600,.82);
        draft.cover=dataUrl;
        coverDrop.querySelector('p').textContent='Cover updated — drop again to replace';
        let thumb=coverDrop.querySelector('#coverThumb');
        if(!thumb){ thumb=document.createElement('img'); thumb.className='dropzone-thumb'; thumb.id='coverThumb'; coverDrop.insertBefore(thumb,coverDrop.firstChild); }
        thumb.src=dataUrl;
        const icon=coverDrop.querySelector('i'); if(icon) icon.remove();
      }catch(e){ toast('Could not read that image.','fa-triangle-exclamation'); }
    },'image/');

    const audioDrop=root.querySelector('#audioDrop'), audioInput=root.querySelector('#audioFile');
    setupDropzone(audioDrop,audioInput,file=>{
      uploadedAudioFile=file;
      root.querySelector('#audioDropLabel').textContent='Ready: '+file.name;
      if(!draft.title){ draft.title=file.name.replace(/\.[^.]+$/,''); root.querySelector('#fTitle').value=draft.title; }
    },'audio/');

    root.querySelector('#saveTrackBtn').addEventListener('click',async ()=>{
      draft.title=root.querySelector('#fTitle').value.trim()||'Untitled';
      draft.genre=root.querySelector('#fGenre').value.trim()||'Unlabeled';
      draft.releaseDate=root.querySelector('#fDate').value||todayISO();
      const finish=()=>{ if(editing) Object.assign(editing,draft); else TRACKS.push(draft); persistAndRerender(); close(); };

      if(uploadedAudioFile){
        const saveBtn=root.querySelector('#saveTrackBtn');
        saveBtn.disabled=true; saveBtn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Uploading…';
        try{
          // measure duration locally (fast, no network) while the real upload happens
          const probeDur=await new Promise(resolve=>{
            const probeUrl=URL.createObjectURL(uploadedAudioFile);
            const probe=new Audio(probeUrl);
            probe.addEventListener('loadedmetadata',()=>{ URL.revokeObjectURL(probeUrl); resolve(probe.duration||0); });
            probe.addEventListener('error',()=>{ URL.revokeObjectURL(probeUrl); resolve(0); });
          });
          const audioUrl=await BVAdmin.uploadAudioFile(uploadedAudioFile); // real, persistent upload
          draft.type='upload';
          draft.audioUrl=audioUrl;
          draft.dur=fmtT(probeDur);
          finish();
        }catch(e){
          toast(e.message||'Audio upload failed — try again.','fa-triangle-exclamation');
          saveBtn.disabled=false; saveBtn.innerHTML='<i class="fa-solid fa-check"></i> Save Track';
        }
      }else{
        finish();
      }
    });
  });
}

function setupDropzone(zone,input,onFile,acceptPrefix){
  zone.addEventListener('click',()=>input.click());
  input.addEventListener('change',()=>{ if(input.files[0]) onFile(input.files[0]); });
  ['dragenter','dragover'].forEach(ev=>zone.addEventListener(ev,e=>{ e.preventDefault(); zone.classList.add('drag-over'); }));
  ['dragleave','drop'].forEach(ev=>zone.addEventListener(ev,e=>{ e.preventDefault(); zone.classList.remove('drag-over'); }));
  zone.addEventListener('drop',e=>{
    const f=e.dataTransfer.files && e.dataTransfer.files[0];
    if(f && (!acceptPrefix || f.type.startsWith(acceptPrefix))) onFile(f);
    else if(f) toast('That file type isn\'t supported here.','fa-triangle-exclamation');
  });
}

function escapeAttr(s){ return String(s==null?'':s).replace(/"/g,'&quot;'); }

/* ---------- boot ---------- */
function boot(){
  renderTracklist();
  $('#featPlay').addEventListener('click',()=>Player.play(Player.cur<0?0:Player.cur));
  $('#nextBtn').addEventListener('click',()=>Player.play(((Player.cur<0?0:Player.cur)+1)%TRACKS.length));
  $('#prevBtn').addEventListener('click',()=>Player.play(((Player.cur<0?1:Player.cur)-1+TRACKS.length)%TRACKS.length));
  $('#progBar').addEventListener('click',e=>{
    if(!Player.isPlaying())return;
    const r=e.currentTarget.getBoundingClientRect(); const p=clamp((e.clientX-r.left)/r.width,0,1);
    const tr=TRACKS[Player.cur];
    if(tr.type==='upload' && htmlAudio) htmlAudio.currentTime=p*Player.dur;
    else Player.startT=AE.t()-p*Player.dur;
  });
  const featLike=$('#featLike');
  if(featLike) featLike.addEventListener('click',()=>{ const tr=TRACKS[Player.cur]; if(tr) toggleLike(tr,featLike); });
}
try{ boot(); }catch(e){ console.warn('music.js boot:',e); }

document.addEventListener('bv:tracks-changed',e=>{ TRACKS=(e.detail.tracks||[]).map(normalize); renderTracklist(); });
document.addEventListener('bv:admin-changed',()=>{ renderTracklist(); });
})();
