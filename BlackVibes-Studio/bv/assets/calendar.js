/* ==========================================================================
   BLACKVIBES STUDIO — index.html Release Calendar
   Reads the exact same track data music.js uses (BVAdmin.getTracks(), or
   window.BV_DEFAULT_TRACKS if the owner hasn't saved edits yet) so the
   calendar always matches whatever's set on the Music page — no separate
   copy to keep in sync. Toggling Released/Coming Soon or changing a
   release date on the Music page updates this automatically next time
   the calendar renders (including right now, if edited in another tab).
   ========================================================================== */
(function(){'use strict';
function todayISO(){ return new Date().toISOString().slice(0,10); }
function normalize(tr){ return Object.assign({releaseDate:todayISO(),likes:0,status:'released'},tr); }

function getTracks(){
  const saved=window.BVAdmin && BVAdmin.getTracks();
  const list=(saved || window.BV_DEFAULT_TRACKS || []).map(normalize);
  return list;
}

function fmtDate(iso){
  const d=new Date((iso||todayISO())+'T00:00:00');
  if(isNaN(d)) return {day:'--',mon:'---'};
  return { day:String(d.getDate()).padStart(2,'0'), mon:d.toLocaleDateString('en-US',{month:'short'}).toUpperCase() };
}

function render(){
  const host=document.getElementById('calList');
  if(!host) return;
  const unlocked=window.BVAdmin && BVAdmin.unlocked;
  const tracks=getTracks().slice().sort((a,b)=>(a.releaseDate||'').localeCompare(b.releaseDate||''));

  if(!tracks.length){
    host.innerHTML='<div class="cal-empty"><i class="fa-solid fa-calendar-xmark"></i><p>No tracks yet — add one on the Music page and it will show up here.</p></div>';
    return;
  }

  host.innerHTML='';
  tracks.forEach(tr=>{
    const d=fmtDate(tr.releaseDate);
    const row=document.createElement('div');
    row.className='cal-row';
    row.innerHTML=`
      <div class="cal-date">${d.day}<span>${d.mon}</span></div>
      <div><div class="cal-name">${tr.title}</div><div class="cal-genre">${tr.genre}${tr.type==='synth'?' · '+tr.bpm+' BPM':''}</div></div>
      <div class="cal-status ${tr.status==='released'?'out':'soon'}">${tr.status==='released'?'Released':'Upcoming'}</div>
      ${unlocked?`<a class="icon-3d cal-edit" href="music.html#track-${tr.id}" title="Edit on the Music page"><i class="fa-solid fa-pen"></i></a>`:''}
    `;
    host.appendChild(row);
  });
}

try{ render(); }catch(e){ console.warn('calendar.js:',e); }
document.addEventListener('bv:tracks-changed',render);
document.addEventListener('bv:admin-changed',render);
})();
