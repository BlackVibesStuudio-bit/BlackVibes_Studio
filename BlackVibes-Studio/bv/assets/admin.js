/* ==========================================================================
   BLACKVIBES STUDIO — admin.js
   Private content-management layer for the site owner.

   IMPORTANT — READ THIS:
   The PIN check in this file is a DETERRENT, not a lock — anyone who opens
   devtools can read this file or call BVAdmin functions from the console.
   It hides editing controls from casual visitors and keeps normal browsing
   frustration-free, but it will not stop a determined, technical person.
   The REAL gate is on the server: every write (api/upload.js) independently
   re-checks the PIN against the ADMIN_PIN_HASH environment variable before
   saving anything. Losing/leaking this client-side PIN_HASH does not by
   itself let someone write — but treat it as sensitive anyway and set your
   own PIN (see below) rather than shipping the default.

   Data persistence (this is what changed):
   - Track metadata (title, genre, status, cover, etc.) is saved to a
     shared tracks.json manifest on the server (via api/upload.js), so
     every visitor on every device sees the same list — not just this
     browser's localStorage.
   - Uploaded audio files are stored in Vercel Blob storage and referenced
     by a real, permanent audioUrl — they play back for everyone, not just
     the tab that uploaded them.
   - Reels are unchanged and still localStorage-only (per-browser), since
     that wasn't part of what needed fixing.
   ========================================================================== */
(function(){
  'use strict';

  const LS_UNLOCKED = 'bv_admin_unlocked';
  const LS_REELS    = 'bv_reels_v1';

  /* SHA-256 hash of your admin PIN. CHANGE THIS, and set an ADMIN_PIN_HASH
     env var on Vercel to the SAME hash of the SAME pin (see api/upload.js
     for how to generate it) — the server independently checks it on every
     write. Default PIN below is "veera2026" — change it before going live. */
  let PIN_HASH='ed8f85db297e992529b1c4df5dda0fe9d16e66ba65115581f76432682cf090e4';

  async function sha256Hex(str){
    const buf=await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  /* Turns a fetch Response into JSON, but fails with a readable message
     instead of a raw "Unexpected token" crash when the server sends back
     an HTML error page (e.g. a 404 because an /api file isn't deployed
     where Vercel expects it). */
  async function parseJsonSafe(res){
    const ct=(res.headers.get('content-type')||'');
    if(!ct.includes('application/json')){
      if(res.status===404) throw new Error('Server endpoint not found (404) — check that the api/ folder is at your project root and deployed.');
      throw new Error('Server returned an unexpected response (status '+res.status+'). Check your Vercel deploy logs.');
    }
    return res.json();
  }

  /* ---------- auth ---------- */
  const Admin={
    unlocked: sessionStorage.getItem(LS_UNLOCKED)==='1',
    _pin: null, // kept in memory only, for this tab, so writes can re-send it to the server
    async tryUnlock(pin){
      try{
        const hash=await sha256Hex(String(pin||'').trim());
        if(hash===PIN_HASH){
          this.unlocked=true;
          this._pin=String(pin||'').trim();
          sessionStorage.setItem(LS_UNLOCKED,'1'); // tab-session only, not persisted forever
          document.dispatchEvent(new CustomEvent('bv:admin-changed',{detail:{unlocked:true}}));
          return true;
        }
      }catch(e){ console.warn('admin unlock failed:',e); }
      return false;
    },
    lock(){
      this.unlocked=false;
      this._pin=null;
      sessionStorage.removeItem(LS_UNLOCKED);
      document.dispatchEvent(new CustomEvent('bv:admin-changed',{detail:{unlocked:false}}));
    },

    /* ---------- tracks store — now backed by the server, shared by everyone ---------- */

    /* Kept for compatibility with music.js's initial synchronous read
       (`BVAdmin.getTracks() || DEFAULT_TRACKS`). Real data can't be fetched
       synchronously, so this returns null (→ music.js shows the defaults
       briefly) while fetchInitialTracks() below loads the real list and
       swaps it in via the same 'bv:tracks-changed' event music.js already
       listens for. */
    getTracks(){ return null; },

    /* Overwrites the whole shared track list on the server — used for
       add / edit / delete / drag-reorder, exactly like the old setTracks,
       just persisted for real instead of to localStorage. */
    async setTracks(arr){
      if(!this._pin){
        if(window.toast) toast('Admin session expired — unlock again to save changes.','fa-lock');
        return false;
      }
      try{
        const res=await fetch('/api/upload',{
          method:'POST',
          headers:{'content-type':'application/json'},
          body: JSON.stringify({ action:'set', pin:this._pin, tracks:arr }),
        });
        const data=await parseJsonSafe(res);
        if(!res.ok){
          if(window.toast) toast(data.error||'Could not save changes.','fa-triangle-exclamation');
          return false;
        }
        document.dispatchEvent(new CustomEvent('bv:tracks-changed',{detail:{tracks:data.tracks}}));
        return true;
      }catch(e){
        console.warn('setTracks failed:',e);
        if(window.toast) toast(e.message||'Could not save changes — check your connection.','fa-triangle-exclamation');
        return false;
      }
    },

    /* Uploads one real audio file to persistent storage and returns its
       permanent URL. Called from music.js's track editor right before
       saving, then the returned URL goes into the track object that
       setTracks() persists. */
    async uploadAudioFile(file){
      if(!this._pin) throw new Error('Admin session expired — unlock again before uploading.');
      if(file.size > 25*1024*1024) throw new Error('Audio file too large (25MB max).');
      const fd=new FormData();
      fd.append('pin', this._pin);
      fd.append('action','uploadAudio');
      fd.append('audio', file);
      const res=await fetch('/api/upload',{method:'POST', body:fd});
      const data=await parseJsonSafe(res);
      if(!res.ok) throw new Error(data.error||'Upload failed.');
      return data.audioUrl;
    },

    /* ---------- reels store (unchanged, local-only — not part of this fix) ---------- */
    getReels(){
      try{
        const raw=localStorage.getItem(LS_REELS);
        if(raw) return JSON.parse(raw);
      }catch(e){ console.warn('getReels:',e); }
      return null;
    },
    setReels(arr){
      try{
        localStorage.setItem(LS_REELS, JSON.stringify(arr));
        document.dispatchEvent(new CustomEvent('bv:reels-changed',{detail:{reels:arr}}));
        return true;
      }catch(e){
        console.warn('setReels failed:',e);
        if(window.toast) toast('Could not save — your browser storage is full. Try smaller images.','fa-triangle-exclamation');
        return false;
      }
    },

    uid(prefix){ return prefix+'_'+Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
  };
  window.BVAdmin=Admin;
  if(Admin.unlocked && document.body) document.body.classList.add('admin-on');

  /* ---------- image compression (cover uploads) ---------- */
  Admin.compressImage=function(file,maxDim,quality){
    maxDim=maxDim||600; quality=quality||.82;
    return new Promise((resolve,reject)=>{
      if(!file||!file.type.startsWith('image/')){ reject(new Error('not an image')); return; }
      const img=new Image();
      const reader=new FileReader();
      reader.onerror=()=>reject(new Error('read failed'));
      reader.onload=()=>{
        img.onerror=()=>reject(new Error('decode failed'));
        img.onload=()=>{
          let w=img.width,h=img.height;
          const scale=Math.min(1,maxDim/Math.max(w,h));
          w=Math.round(w*scale); h=Math.round(h*scale);
          const c=document.createElement('canvas'); c.width=w; c.height=h;
          const ctx=c.getContext('2d');
          ctx.drawImage(img,0,0,w,h);
          resolve(c.toDataURL('image/jpeg',quality));
        };
        img.src=reader.result;
      };
      reader.readAsDataURL(file);
    });
  };

  /* ---------- shared UI: modal shell ---------- */
  function ensureModalRoot(){
    let root=document.getElementById('bvAdminModalRoot');
    if(!root){
      root=document.createElement('div');
      root.id='bvAdminModalRoot';
      document.body.appendChild(root);
    }
    return root;
  }

  Admin.openModal=function(innerHTML,onMount){
    const root=ensureModalRoot();
    root.innerHTML=`<div class="bv-modal-backdrop" id="bvModalBackdrop"><div class="bv-modal-card">${innerHTML}</div></div>`;
    const backdrop=root.querySelector('#bvModalBackdrop');
    requestAnimationFrame(()=>backdrop.classList.add('show'));
    function close(){
      backdrop.classList.remove('show');
      setTimeout(()=>{ root.innerHTML=''; },300);
    }
    backdrop.addEventListener('click',e=>{ if(e.target===backdrop) close(); });
    root.querySelectorAll('[data-modal-close]').forEach(b=>b.addEventListener('click',close));
    if(onMount) onMount(root,close);
    return close;
  };

  Admin.confirm=function(message,confirmLabel){
    return new Promise(resolve=>{
      Admin.openModal(`
        <div class="bv-modal-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
        <h3>Are you sure?</h3>
        <p>${message}</p>
        <div class="bv-modal-actions">
          <button class="btn" data-modal-close>Cancel</button>
          <button class="btn btn-danger" id="bvConfirmYes">${confirmLabel||'Delete'}</button>
        </div>
      `,(root,close)=>{
        root.querySelector('#bvConfirmYes').addEventListener('click',()=>{ close(); resolve(true); });
        root.querySelector('[data-modal-close]').addEventListener('click',()=>resolve(false));
      });
    });
  };

  /* animated Released / Coming Soon pill switch — returns {el, get, set} */
  Admin.statusToggle=function(initial,onChange){
    const wrap=document.createElement('button');
    wrap.type='button';
    wrap.className='bv-toggle'+(initial==='released'?' on':'');
    wrap.innerHTML=`<span class="bv-toggle-knob"></span><span class="bv-toggle-lbl bv-toggle-lbl-off">Soon</span><span class="bv-toggle-lbl bv-toggle-lbl-on">Live</span>`;
    let state=initial;
    wrap.addEventListener('click',()=>{
      state=state==='released'?'soon':'released';
      wrap.classList.toggle('on',state==='released');
      if(onChange) onChange(state);
    });
    return {el:wrap, get:()=>state, set:s=>{ state=s; wrap.classList.toggle('on',s==='released'); }};
  };

  /* ---------- admin shell: lock icon + PIN modal + floating badge ---------- */
  function buildLockIcon(){
    const actions=document.querySelector('.nav-actions');
    if(!actions || document.getElementById('admin-lock-btn')) return;
    const btn=document.createElement('button');
    btn.className='icon-btn admin-lock-btn';
    btn.id='admin-lock-btn';
    btn.setAttribute('aria-label','Owner / admin access');
    btn.innerHTML='<i class="fa-solid fa-lock"></i>';
    actions.insertBefore(btn, actions.firstChild);
    btn.addEventListener('click',()=>{
      if(Admin.unlocked) Admin.openModal(adminBadgeHTML(),mountAdminBadgeModal);
      else openPinModal();
    });
  }

  function openPinModal(){
    Admin.openModal(`
      <div class="bv-modal-icon"><i class="fa-solid fa-lock"></i></div>
      <h3>Owner Access</h3>
      <p>Enter the admin PIN to manage tracks and reels.</p>
      <div class="field" style="text-align:left;margin-top:18px">
        <input type="password" id="bvPinInput" placeholder="PIN" autocomplete="off" style="width:100%;background:#0d0d11;border:1px solid var(--line2);border-radius:14px;padding:14px 16px;color:#fff;font:inherit;font-size:16px;letter-spacing:3px;text-align:center">
      </div>
      <p id="bvPinErr" style="color:#ff5d7a;font-size:12.5px;margin-top:10px;display:none">Wrong PIN — try again.</p>
      <div class="bv-modal-actions">
        <button class="btn" data-modal-close>Cancel</button>
        <button class="btn btn-violet" id="bvPinGo">Unlock</button>
      </div>
    `,(root,close)=>{
      const input=root.querySelector('#bvPinInput'), err=root.querySelector('#bvPinErr');
      input.focus();
      async function tryGo(){
        const ok=await Admin.tryUnlock(input.value);
        if(ok){ close(); onUnlocked(); }
        else{ err.style.display='block'; input.value=''; input.focus();
          root.querySelector('.bv-modal-card').classList.remove('shake'); void root.offsetWidth;
          root.querySelector('.bv-modal-card').classList.add('shake'); }
      }
      root.querySelector('#bvPinGo').addEventListener('click',tryGo);
      input.addEventListener('keydown',e=>{ if(e.key==='Enter') tryGo(); });
    });
  }

  function onUnlocked(){
    if(window.toast) toast('Admin mode on — edit controls unlocked for this tab.','fa-unlock');
    document.body.classList.add('admin-on');
    showFloatingBadge();
  }

  function showFloatingBadge(){
    if(document.getElementById('adminFloatBadge')) return;
    const b=document.createElement('div');
    b.id='adminFloatBadge';
    b.className='admin-float-badge';
    b.innerHTML='<i class="fa-solid fa-user-shield"></i> Admin Mode <button id="adminFloatLogout" aria-label="Log out">Log out</button>';
    document.body.appendChild(b);
    b.querySelector('#adminFloatLogout').addEventListener('click',()=>{
      Admin.lock();
      b.remove();
      document.body.classList.remove('admin-on');
      if(window.toast) toast('Admin mode off.','fa-lock');
    });
  }

  function adminBadgeHTML(){
    return `
      <div class="bv-modal-icon"><i class="fa-solid fa-user-shield"></i></div>
      <h3>Admin Mode Is On</h3>
      <p>Editing controls are visible on the Music and Home pages for this browser tab only.</p>
      <div class="bv-modal-actions">
        <button class="btn" data-modal-close>Close</button>
        <button class="btn btn-danger" id="bvLogoutBtn">Log Out</button>
      </div>`;
  }
  function mountAdminBadgeModal(root,close){
    root.querySelector('#bvLogoutBtn').addEventListener('click',()=>{
      Admin.lock(); close();
      const b=document.getElementById('adminFloatBadge'); if(b)b.remove();
      document.body.classList.remove('admin-on');
      if(window.toast) toast('Admin mode off.','fa-lock');
    });
  }

  document.addEventListener('DOMContentLoaded',()=>{
    buildLockIcon();
    if(Admin.unlocked){ document.body.classList.add('admin-on'); showFloatingBadge(); }
  });

  /* keyboard shortcut backup: Ctrl+Alt+A opens the PIN modal from anywhere */
  document.addEventListener('keydown',e=>{
    if(e.ctrlKey&&e.altKey&&e.code==='KeyA'){ e.preventDefault(); if(!Admin.unlocked) openPinModal(); }
  });

  /* ---------- load the real, shared track list on every page load ----------
     music.js starts with window.BV_DEFAULT_TRACKS (see tracks-data.js) so
     the page never looks broken while this loads. As soon as the real list
     comes back, it's swapped in via the same 'bv:tracks-changed' event
     music.js (and calendar.js on the home page) already listen for. */
  (async function fetchInitialTracks(){
    try{
      const res=await fetch('/api/tracks',{cache:'no-store'});
      const data=await parseJsonSafe(res);
      if(Array.isArray(data.tracks) && data.tracks.length){
        document.dispatchEvent(new CustomEvent('bv:tracks-changed',{detail:{tracks:data.tracks}}));
      }
    }catch(e){
      console.warn('Could not load tracks from the server yet (falling back to defaults):',e);
    }
  })();
})();
