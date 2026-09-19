/* ==========================================================================
   BLACKVIBES STUDIO — admin.js  (rewritten)

   WHAT CHANGED FROM YOUR ORIGINAL FILE:
   - Track uploads (audio + cover) now POST to /api/upload, which stores the
     files in Vercel Blob storage and updates a shared tracks.json manifest.
     That means an upload now shows up for EVERY visitor, on every device —
     not just in the tab you uploaded from.
   - The PIN is still checked client-side for showing/hiding the admin UI
     (same deterrent-only caveat as before — devtools can bypass this).
     BUT the actual write (/api/upload) re-checks the PIN on the server,
     which is the real gate now. You must set ADMIN_PIN_HASH as an env var
     on Vercel — see the comment block at the top of api/upload.js.
   - Reels are untouched — still localStorage-only, exactly as before,
     since that wasn't part of what needed fixing.
   - The old in-memory "sessionAudio" object-URL trick is removed; it's no
     longer needed now that audio is really persisted server-side.

   Data persistence notes that still apply:
   - Nothing about the admin UI itself is a real security boundary. It hides
     controls from casual visitors; it does not stop a determined, technical
     person from calling fetch('/api/upload', ...) directly. The server-side
     PIN check in api/upload.js is what actually protects writes.
   ========================================================================== */
(function(){
  'use strict';

  const LS_UNLOCKED = 'bv_admin_unlocked';
  const LS_REELS    = 'bv_reels_v1'; // reels still local-only, unchanged

  /* SHA-256 hash of the default PIN "veera2026" — CHANGE THIS, and set the
     matching ADMIN_PIN_HASH env var on Vercel to the hash of your real PIN.
     This client-side copy only gates whether admin controls are shown; the
     server independently checks its own ADMIN_PIN_HASH on every upload. */
  let PIN_HASH='ed8f85db297e992529b1c4df5dda0fe9d16e66ba65115581f76432682cf090e4';

  async function sha256Hex(str){
    const buf=await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  /* ---------- auth ---------- */
  const Admin={
    unlocked: sessionStorage.getItem(LS_UNLOCKED)==='1',
    _pin: null, // kept in memory only for this tab, so uploads can re-send it to the server

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

    /* ---------- tracks: now backed by the server, not localStorage ---------- */
    async fetchTracks(){
      try{
        const res=await fetch('/api/tracks',{cache:'no-store'});
        const data=await res.json();
        return Array.isArray(data.tracks)?data.tracks:[];
      }catch(e){ console.warn('fetchTracks failed:',e); return []; }
    },

    /* opts: {id?, title, genre, bpm, status, artInitials, audioFile?, coverFile?} */
    async uploadTrack(opts){
      if(!this._pin){
        if(window.toast) toast('You need to unlock admin mode again before uploading.','fa-lock');
        return {ok:false, error:'not unlocked'};
      }
      const fd=new FormData();
      fd.append('pin', this._pin);
      fd.append('action','add');
      if(opts.id) fd.append('id', opts.id);
      fd.append('title', opts.title||'Untitled');
      fd.append('genre', opts.genre||'');
      fd.append('bpm', opts.bpm||'');
      fd.append('status', opts.status==='released'?'released':'soon');
      fd.append('artInitials', opts.artInitials||(opts.title||'??').slice(0,2).toUpperCase());
      if(opts.audioFile) fd.append('audio', opts.audioFile);
      if(opts.coverFile) fd.append('cover', opts.coverFile);

      try{
        const res=await fetch('/api/upload',{method:'POST', body:fd});
        const data=await res.json();
        if(!res.ok){
          if(window.toast) toast(data.error||'Upload failed.','fa-triangle-exclamation');
          return {ok:false, error:data.error};
        }
        document.dispatchEvent(new CustomEvent('bv:tracks-changed',{detail:{tracks:data.tracks}}));
        if(window.toast) toast('Track saved — live for everyone now.','fa-check');
        return {ok:true, track:data.track, tracks:data.tracks};
      }catch(e){
        console.warn('uploadTrack failed:',e);
        if(window.toast) toast('Upload failed — check your connection and try again.','fa-triangle-exclamation');
        return {ok:false, error:String(e)};
      }
    },

    async deleteTrack(id){
      if(!this._pin){
        if(window.toast) toast('You need to unlock admin mode again first.','fa-lock');
        return {ok:false};
      }
      const fd=new FormData();
      fd.append('pin', this._pin);
      fd.append('action','delete');
      fd.append('id', id);
      try{
        const res=await fetch('/api/upload',{method:'POST', body:fd});
        const data=await res.json();
        if(!res.ok){
          if(window.toast) toast(data.error||'Delete failed.','fa-triangle-exclamation');
          return {ok:false};
        }
        document.dispatchEvent(new CustomEvent('bv:tracks-changed',{detail:{tracks:data.tracks}}));
        if(window.toast) toast('Track removed.','fa-check');
        return {ok:true, tracks:data.tracks};
      }catch(e){
        console.warn('deleteTrack failed:',e);
        return {ok:false};
      }
    },

    /* ---------- reels store (unchanged — local-only, not part of this fix) ---------- */
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

  /* ---------- image compression (cover uploads, still used client-side before sending) ---------- */
  Admin.compressImage=function(file,maxDim,quality){
    maxDim=maxDim||900; quality=quality||.85;
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
          c.toBlob(blob=>{
            if(!blob){ reject(new Error('toBlob failed')); return; }
            resolve(new File([blob], (file.name||'cover').replace(/\.[^.]+$/,'')+'.jpg', {type:'image/jpeg'}));
          },'image/jpeg',quality);
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

  /* ---------- NEW: upload-track modal ---------- */
  Admin.openUploadModal=function(existingTrack){
    const t=existingTrack||{};
    const statusToggle=Admin.statusToggle(t.status||'soon');
    Admin.openModal(`
      <div class="bv-modal-icon"><i class="fa-solid fa-cloud-arrow-up"></i></div>
      <h3>${existingTrack?'Edit Track':'Upload New Track'}</h3>
      <div class="field" style="text-align:left;margin-top:14px;display:grid;gap:10px">
        <input type="text" id="bvT_title" placeholder="Title" value="${t.title?String(t.title).replace(/"/g,'&quot;'):''}" style="background:#0d0d11;border:1px solid var(--line2);border-radius:12px;padding:12px 14px;color:#fff;font:inherit">
        <input type="text" id="bvT_genre" placeholder="Genre · BPM label (e.g. Deep House · 122 BPM)" value="${t.genre?String(t.genre).replace(/"/g,'&quot;'):''}" style="background:#0d0d11;border:1px solid var(--line2);border-radius:12px;padding:12px 14px;color:#fff;font:inherit">
        <input type="text" id="bvT_bpm" placeholder="BPM (number, optional)" value="${t.bpm||''}" style="background:#0d0d11;border:1px solid var(--line2);border-radius:12px;padding:12px 14px;color:#fff;font:inherit">
        <input type="text" id="bvT_art" placeholder="Art initials (e.g. MC)" maxlength="3" value="${t.artInitials||''}" style="background:#0d0d11;border:1px solid var(--line2);border-radius:12px;padding:12px 14px;color:#fff;font:inherit">
        <label style="text-align:left;font-size:12.5px;opacity:.75">Audio file (mp3/wav, 25MB max)${existingTrack?' — leave empty to keep current':''}</label>
        <input type="file" id="bvT_audio" accept="audio/*" style="color:#fff">
        <label style="text-align:left;font-size:12.5px;opacity:.75">Cover image (optional)${existingTrack?' — leave empty to keep current':''}</label>
        <input type="file" id="bvT_cover" accept="image/*" style="color:#fff">
        <div id="bvT_statusHost" style="display:flex;justify-content:center;margin-top:4px"></div>
      </div>
      <p id="bvT_err" style="color:#ff5d7a;font-size:12.5px;margin-top:10px;display:none"></p>
      <div class="bv-modal-actions">
        <button class="btn" data-modal-close>Cancel</button>
        <button class="btn btn-violet" id="bvT_go">${existingTrack?'Save Changes':'Upload'}</button>
      </div>
    `,(root,close)=>{
      root.querySelector('#bvT_statusHost').appendChild(statusToggle.el);
      const err=root.querySelector('#bvT_err');
      const goBtn=root.querySelector('#bvT_go');

      goBtn.addEventListener('click', async ()=>{
        const title=root.querySelector('#bvT_title').value.trim();
        if(!title){ err.textContent='Title is required.'; err.style.display='block'; return; }

        const audioInput=root.querySelector('#bvT_audio');
        const coverInput=root.querySelector('#bvT_cover');
        if(!existingTrack && !(audioInput.files&&audioInput.files[0])){
          err.textContent='Please choose an audio file.'; err.style.display='block'; return;
        }

        goBtn.disabled=true; goBtn.textContent='Uploading…';

        let coverFile=coverInput.files&&coverInput.files[0]?coverInput.files[0]:null;
        if(coverFile){
          try{ coverFile=await Admin.compressImage(coverFile); }catch(e){ /* fall back to original file */ }
        }

        const result=await Admin.uploadTrack({
          id: existingTrack?existingTrack.id:undefined,
          title,
          genre: root.querySelector('#bvT_genre').value.trim(),
          bpm: root.querySelector('#bvT_bpm').value.trim(),
          status: statusToggle.get(),
          artInitials: root.querySelector('#bvT_art').value.trim(),
          audioFile: audioInput.files&&audioInput.files[0]?audioInput.files[0]:null,
          coverFile,
        });

        if(result.ok){ close(); }
        else{
          goBtn.disabled=false; goBtn.textContent=existingTrack?'Save Changes':'Upload';
          err.textContent=result.error||'Something went wrong.'; err.style.display='block';
        }
      });
    });
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
    b.innerHTML='<i class="fa-solid fa-user-shield"></i> Admin Mode <button id="adminFloatUpload" aria-label="Upload track" style="margin-left:8px">Upload Track</button><button id="adminFloatLogout" aria-label="Log out">Log out</button>';
    document.body.appendChild(b);
    b.querySelector('#adminFloatUpload').addEventListener('click',()=>Admin.openUploadModal());
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
      <p>Editing controls are visible on the Music and Home pages for this browser tab. Uploads are saved for every visitor.</p>
      <div class="bv-modal-actions">
        <button class="btn" data-modal-close>Close</button>
        <button class="btn btn-violet" id="bvUploadBtn">Upload Track</button>
        <button class="btn btn-danger" id="bvLogoutBtn">Log Out</button>
      </div>`;
  }
  function mountAdminBadgeModal(root,close){
    root.querySelector('#bvUploadBtn').addEventListener('click',()=>{ close(); Admin.openUploadModal(); });
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
})();
