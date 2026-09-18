/* ==========================================================================
   BLACKVIBES STUDIO — index.html Instagram section
   The owner pastes a real Instagram post/reel URL; it's rendered using
   Instagram's own official embed widget (embed.js), the same technique
   any website uses to show a real Instagram post — no fake placeholder
   cards, no backend needed. Instagram's widget fetches the real
   thumbnail, caption and like count directly from Instagram itself.
   ========================================================================== */
(function(){'use strict';

let REELS=(window.BVAdmin && BVAdmin.getReels()) || [];

function isInstagramUrl(url){
  return /^https?:\/\/(www\.)?instagram\.com\/(p|reel|reels|tv)\/[A-Za-z0-9_-]+\/?/.test(String(url||'').trim());
}

/* ---------- Instagram's embed.js loader (loaded once, reused) ---------- */
let embedScriptPromise=null;
function loadInstagramEmbed(){
  if(window.instgrm) return Promise.resolve();
  if(embedScriptPromise) return embedScriptPromise;
  embedScriptPromise=new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src='https://www.instagram.com/embed.js';
    s.async=true;
    s.onload=()=>resolve();
    s.onerror=()=>reject(new Error('Instagram embed script failed to load'));
    document.head.appendChild(s);
  });
  return embedScriptPromise;
}

function render(){
  const host=document.getElementById('reelScroll');
  if(!host) return;
  const unlocked=window.BVAdmin && BVAdmin.unlocked;
  host.innerHTML='';

  if(!REELS.length){
    const empty=document.createElement('div');
    empty.className='reel-empty';
    empty.innerHTML=unlocked
      ? '<i class="fa-brands fa-instagram"></i><p>No posts yet — paste an Instagram post or reel URL below to add the first one.</p>'
      : '<i class="fa-brands fa-instagram"></i><p>New posts coming soon — follow <a href="https://www.instagram.com/" target="_blank" rel="noopener">@blackvibes.studio</a> on Instagram.</p>';
    host.appendChild(empty);
    renderAddCard(host,unlocked);
    return;
  }

  REELS.forEach(r=>{
    const wrap=document.createElement('div');
    wrap.className='reel-embed-wrap';
    wrap.dataset.id=r.id;
    wrap.innerHTML=`
      <div class="reel-admin">
        <button class="icon-3d" data-act="edit" title="Replace URL"><i class="fa-solid fa-pen"></i></button>
        <button class="icon-3d danger" data-act="remove" title="Remove"><i class="fa-solid fa-trash"></i></button>
      </div>
      <div class="reel-embed-loading"><i class="fa-brands fa-instagram fa-beat"></i><span>Loading post…</span></div>
      <blockquote class="instagram-media" data-instgrm-permalink="${r.url}" data-instgrm-version="14" style="width:100%;"></blockquote>
    `;
    const editBtn=wrap.querySelector('[data-act="edit"]');
    if(editBtn) editBtn.addEventListener('click',()=>openReelEditor(r.id));
    const rmBtn=wrap.querySelector('[data-act="remove"]');
    if(rmBtn) rmBtn.addEventListener('click',async ()=>{
      const ok=await BVAdmin.confirm('Remove this post from the Instagram section?','Remove');
      if(ok){ REELS=REELS.filter(x=>x.id!==r.id); persist(); }
    });
    host.appendChild(wrap);
  });

  renderAddCard(host,unlocked);

  loadInstagramEmbed().then(()=>{
    if(window.instgrm && window.instgrm.Embeds) window.instgrm.Embeds.process();
  }).catch(err=>{
    console.warn('reels.js:',err);
    host.querySelectorAll('.reel-embed-loading span').forEach(el=>{
      el.textContent='Could not load — view it directly on Instagram.';
    });
  });
}

function renderAddCard(host,unlocked){
  if(!unlocked) return;
  const card=document.createElement('div');
  card.className='add-reel-card';
  card.innerHTML='<i class="fa-brands fa-instagram"></i><span>Paste Instagram URL</span>';
  card.addEventListener('click',()=>openReelEditor(null));
  host.appendChild(card);
}

function persist(){
  if(window.BVAdmin) BVAdmin.setReels(REELS);
  render();
}

function openReelEditor(id){
  const editing=id?REELS.find(r=>r.id===id):null;

  BVAdmin.openModal(`
    <div class="bv-modal-icon"><i class="fa-brands fa-instagram"></i></div>
    <h3>${editing?'Replace Post URL':'Add Instagram Post'}</h3>
    <p>Paste the full link to a public Instagram post or reel — copy it from the Share menu on Instagram.</p>
    <div class="field" style="margin-top:18px;text-align:left">
      <label>Instagram URL</label>
      <input type="url" id="fUrl" value="${editing?escapeAttr(editing.url):''}" placeholder="https://www.instagram.com/reel/…">
    </div>
    <p id="urlErr" style="color:#ff5d7a;font-size:12px;display:none;text-align:left;margin-top:-6px">That doesn't look like a public Instagram post or reel link.</p>
    <div class="bv-modal-actions">
      <button class="btn" data-modal-close>Cancel</button>
      <button class="btn btn-violet btn-3d violet" id="saveReelBtn"><i class="fa-solid fa-check"></i> ${editing?'Save':'Add Post'}</button>
    </div>
  `,(root,close)=>{
    const input=root.querySelector('#fUrl'), err=root.querySelector('#urlErr');
    input.focus();
    root.querySelector('#saveReelBtn').addEventListener('click',()=>{
      const url=input.value.trim();
      if(!isInstagramUrl(url)){ err.style.display='block'; return; }
      if(editing){ editing.url=url; }
      else{ REELS.push({id:BVAdmin.uid('r'),url}); }
      persist(); close();
    });
  });
}

function escapeAttr(s){ return String(s==null?'':s).replace(/"/g,'&quot;'); }

try{ render(); }catch(e){ console.warn('reels.js boot:',e); }
document.addEventListener('bv:reels-changed',e=>{ REELS=e.detail.reels||[]; render(); });
document.addEventListener('bv:admin-changed',()=>{ render(); });
})();
