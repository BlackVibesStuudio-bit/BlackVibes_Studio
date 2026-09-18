/* ==========================================================================
   BLACKVIBES STUDIO — arcade.html games logic
   ========================================================================== */
(function(){'use strict';
/* uses global $, $$, clamp, REDUCED, AE, Sequencer from app.js / audio.js */
const fmtT=s=>{s=Math.max(0,Math.floor(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};

/* ---------- GAME TABS ---------- */
const GAMES={active:'bc'};
function switchGame(id){ GAMES.active=id;
  $$('.gtab').forEach(b=>b.classList.toggle('active',b.dataset.game===id));
  $$('.gpanel').forEach(p=>p.classList.toggle('active',p.dataset.panel===id));
  if(id!=='bc'&&BC.running)BC.pause(); if(id!=='gb'&&GB.playing)GB.stop(); if(id==='bc')BC.resize(); }
$$('.gtab').forEach(b=>b.addEventListener('click',()=>switchGame(b.dataset.game)));

/* ---------- GAME 1 · BEAT CATCHER ---------- */
function rr(c,x,y,w,h,r){ c.beginPath(); c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r); c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath(); }
const BC={ canvas:null,ctx:null,W:0,H:0,hitY:0,laneW:0,running:false,over:false,paused:false,
  notes:[],parts:[],flash:[],lastLane:-1,speed:330,spawned:0,nextSpawn:1,score:0,combo:0,maxCombo:0,lives:3,
  lastT:0,raf:0,seq:null,
  keys:['D','F','J','K'],KEYMAP:{KeyD:0,KeyF:1,KeyJ:2,KeyK:3},laneF:[392,523.25,659.25,784],
  gaps:[.52,.52,.26,.52,.78,.26,.52,.52,.26,.78],
  best:+(localStorage.getItem('bv_bc_best')||0),
  beatPat:{kick:'1000100010001000',clap:'0000100000001000',hat:'1010101010101010',bass:[0,null,null,0,null,null,0,null,0,null,null,0,null,3,null,null]},
  init(){ this.canvas=$('#bc-canvas'); if(!this.canvas)return; this.ctx=this.canvas.getContext('2d');
    window.addEventListener('resize',()=>this.resize()); this.resize();
    this.canvas.addEventListener('pointerdown',e=>{ if(!this.running)return;
      const r=this.canvas.getBoundingClientRect();
      this.judge(clamp(Math.floor((e.clientX-r.left)/r.width*4),0,3)); });
    document.addEventListener('keydown',e=>{ if(/INPUT|TEXTAREA/.test(e.target.tagName))return;
      const l=this.KEYMAP[e.code]; if(l==null)return;
      if(this.running){ if(!e.repeat){e.preventDefault();this.judge(l)} }
      else if(!this.over&&GAMES.active==='bc'&&!e.repeat){ e.preventDefault(); this.start(); } });
    $('#bc-start-btn').addEventListener('click',()=>this.start());
    $('#bc-retry-btn').addEventListener('click',()=>this.start());
    this.draw(); },
  resize(){ if(!this.canvas)return; const r=this.canvas.parentElement.getBoundingClientRect(); if(r.width<10)return;
    const dpr=Math.min(devicePixelRatio||1,2);
    this.W=r.width; this.H=r.height;
    this.canvas.width=r.width*dpr; this.canvas.height=r.height*dpr;
    this.ctx.setTransform(dpr,0,0,dpr,0,0); this.hitY=this.H-84; this.laneW=this.W/4;
    if(!this.running)this.draw(); },
  beat(s,t){ const p=this.beatPat;
    if(p.kick[s]==='1')AE.kick(t,.8); if(p.clap[s]==='1')AE.clap(t,.7); if(p.hat[s]==='1')AE.hat(t,.6);
    const b=p.bass[s]; if(b!=null)AE.bass(t,55*Math.pow(2,b/12),.22,.4); },
  start(){ AE.resume();
    this.notes=[]; this.parts=[]; this.flash=[]; this.score=0; this.combo=0; this.maxCombo=0;
    this.lives=3; this.spawned=0; this.nextSpawn=1; this.speed=330; this.over=false; this.paused=false;
    $('#bc-start').classList.add('hidden'); $('#bc-over').classList.add('hidden'); this.updateHUD();
    if(this.seq)this.seq.stop(); this.seq=new Sequencer((s,t)=>this.beat(s,t)); this.seq.start(112);
    this.running=true; this.lastT=performance.now(); cancelAnimationFrame(this.raf);
    this.raf=requestAnimationFrame(t=>this.loop(t)); },
  loop(now){ if(!this.running)return; this.raf=requestAnimationFrame(t=>this.loop(t));
    const dt=Math.min(.05,(now-this.lastT)/1000); this.lastT=now;
    this.nextSpawn-=dt;
    if(this.nextSpawn<=0){ this.spawn();
      this.nextSpawn=this.gaps[this.spawned%this.gaps.length]; this.spawned++; }
    for(const n of this.notes){ if(n.dead)continue; n.y+=this.speed*dt;
      if(n.y>this.hitY+44&&!n.judged){ n.judged=true; n.dead=true; this.miss(); } }
    this.notes=this.notes.filter(n=>!n.dead);
    for(const p of this.parts){ p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=420*dt; p.life-=dt*1.8; }
    this.parts=this.parts.filter(p=>p.life>0);
    for(const f of this.flash)f.a-=dt*3.2; this.flash=this.flash.filter(f=>f.a>0);
    this.speed=Math.min(520,330+this.spawned*.9);
    this.draw(); },
  spawn(){ let lane=Math.floor(Math.random()*4);
    if(lane===this.lastLane&&Math.random()<.6)lane=(lane+1+Math.floor(Math.random()*3))%4;
    this.lastLane=lane; this.notes.push({lane,y:-30,judged:false,dead:false}); },
  judge(lane){ if(!this.running)return; const win=70,perf=32; let cand=null,bd=1e9;
    for(const n of this.notes){ if(n.lane!==lane||n.judged)continue;
      const d=Math.abs(n.y-this.hitY); if(d<bd){bd=d;cand=n} }
    if(!cand||bd>win){ AE.blip(AE.t(),220,.06,.06); return; }
    cand.judged=true; cand.dead=true;
    let q,pts,col;
    if(bd<=perf){q='PERFECT';pts=120;col='#c9b0ff'}
    else if(bd<=52){q='GREAT';pts=80;col='#ffffff'}
    else{q='GOOD';pts=40;col='#9a9aa8'}
    this.combo++; this.maxCombo=Math.max(this.maxCombo,this.combo);
    this.score+=pts+Math.min(this.combo,25)*4;
    this.popup(q,col); AE.pluck(AE.t(),this.laneF[lane],.2);
    this.flash.push({lane,a:.5}); if(window.bvPulse) bvPulse(.35);
    const cx=lane*this.laneW+this.laneW/2;
    for(let i=0;i<10;i++)this.parts.push({x:cx+(Math.random()-.5)*30,y:this.hitY,
      vx:(Math.random()-.5)*260,vy:-Math.random()*260-60,life:1,col});
    this.updateHUD(); },
  miss(){ this.lives--; this.combo=0; this.popup('MISS','#ff5d7a');
    AE.blip(AE.t(),130,.2,.25); this.updateHUD(); if(this.lives<=0)this.gameOver(); },
  popup(txt,col){ const el=$('#bc-judge'); el.textContent=txt; el.style.color=col;
    el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); },
  updateHUD(){ $('#bc-score').textContent=this.score;
    const c=$('#bc-combo'); if(this.combo>1){c.textContent='×'+this.combo+' COMBO';c.classList.add('show')}else c.classList.remove('show');
    $$('#bc-lives i').forEach((h,i)=>h.classList.toggle('off',i>=this.lives)); },
  gameOver(){ this.running=false; this.over=true; if(this.seq)this.seq.stop();
    if(this.score>this.best){ this.best=this.score; localStorage.setItem('bv_bc_best',this.score);
      $('#bc-newbest').style.display='block'; } else $('#bc-newbest').style.display='none';
    $('#bc-final').textContent=this.score;
    $('#bc-fcombo').textContent='Max combo ×'+this.maxCombo;
    $('#bc-fbest').textContent='Best '+this.best;
    $('#bc-over').classList.remove('hidden'); },
  pause(){ if(!this.running)return; this.running=false; if(this.seq)this.seq.stop();
    $('#bc-start-title').textContent='Paused';
    $('#bc-start').querySelector('p').textContent='The beat waits for no one — but it will wait for you.';
    $('#bc-start-btn').textContent='Resume';
    $('#bc-start').classList.remove('hidden'); },
  draw(){ const c=this.ctx,W=this.W,H=this.H,lw=this.laneW,hy=this.hitY;
    if(!c||W<10)return; c.clearRect(0,0,W,H);
    for(let i=0;i<4;i++){ if(i%2===1){c.fillStyle='rgba(255,255,255,.015)';c.fillRect(i*lw,0,lw,H)} }
    for(const f of this.flash){ c.fillStyle=`rgba(155,107,255,${(f.a*.3).toFixed(3)})`; c.fillRect(f.lane*lw,0,lw,H); }
    c.strokeStyle='rgba(255,255,255,.07)'; c.lineWidth=1;
    for(let i=1;i<4;i++){ c.beginPath(); c.moveTo(i*lw,0); c.lineTo(i*lw,H); c.stroke(); }
    const g=c.createLinearGradient(0,hy-46,0,hy+26);
    g.addColorStop(0,'rgba(155,107,255,0)'); g.addColorStop(1,'rgba(155,107,255,.28)');
    c.fillStyle=g; c.fillRect(0,hy-46,W,72);
    c.strokeStyle='rgba(255,255,255,.9)'; c.lineWidth=2;
    c.shadowColor='rgba(155,107,255,.9)'; c.shadowBlur=16;
    c.beginPath(); c.moveTo(0,hy); c.lineTo(W,hy); c.stroke(); c.shadowBlur=0;
    c.font='700 12px Montserrat, sans-serif'; c.textAlign='center'; c.fillStyle='rgba(255,255,255,.35)';
    for(let i=0;i<4;i++){ const x=i*lw+lw/2;
      c.strokeStyle='rgba(255,255,255,.18)'; c.lineWidth=1; rr(c,x-20,H-56,40,40,9); c.stroke();
      c.fillText(this.keys[i],x,H-30); }
    for(const n of this.notes){ const x=n.lane*lw+lw/2,w=Math.min(64,lw*.56),h=16;
      c.shadowColor='rgba(155,107,255,.8)'; c.shadowBlur=14;
      const g2=c.createLinearGradient(x-w/2,0,x+w/2,0);
      g2.addColorStop(0,'#c9b0ff'); g2.addColorStop(.5,'#ffffff'); g2.addColorStop(1,'#c9b0ff');
      c.fillStyle=g2; rr(c,x-w/2,n.y-h/2,w,h,8); c.fill(); c.shadowBlur=0; }
    for(const p of this.parts){ c.globalAlpha=Math.max(0,p.life); c.fillStyle=p.col;
      c.beginPath(); c.arc(p.x,p.y,2.5,0,7); c.fill(); }
    c.globalAlpha=1; }
};
try{ BC.init(); }catch(e){ console.warn('BeatCatcher:',e); }

/* ---------- GAME 2 · SOUND MEMORY ---------- */
const MEM={icons:['fa-music','fa-drum','fa-guitar','fa-headphones','fa-microphone-lines','fa-compact-disc'],
  tones:[261.63,329.63,392,440,523.25,659.25],
  first:null,lock:false,moves:0,matched:0,timer:null,sec:0,started:false,t0:0,
  best:+(localStorage.getItem('bv_mem_best')||0),
  init(){ if(!$('#mem-grid'))return;
    $('#mem-reset').addEventListener('click',()=>this.build());
    $('#mem-again').addEventListener('click',()=>this.build()); this.build(); },
  build(){ this.first=null; this.lock=false; this.moves=0; this.matched=0; this.sec=0; this.started=false;
    clearInterval(this.timer); $('#mem-time').textContent='0:00'; $('#mem-moves').textContent='0';
    $('#mem-win').classList.add('hidden'); $('#mem-best').textContent=this.best?fmtT(this.best):'—';
    const ids=shuffle([0,1,2,3,4,5,0,1,2,3,4,5]);
    $('#mem-grid').innerHTML=ids.map(id=>`<button class="mcard" data-pair="${id}" aria-label="Memory card">
      <span class="mcard-inner"><span class="mface mfront"><i class="fa-solid fa-compact-disc"></i></span>
      <span class="mface mback"><i class="fa-solid ${this.icons[id]}"></i></span></span></button>`).join('');
    $$('.mcard').forEach(c=>c.addEventListener('click',()=>this.flip(c))); },
  flip(card){ if(this.lock||card.classList.contains('flipped')||card.classList.contains('matched'))return;
    AE.resume();
    if(!this.started){ this.started=true; this.t0=Date.now();
      this.timer=setInterval(()=>{ this.sec=Math.floor((Date.now()-this.t0)/1000);
        $('#mem-time').textContent=fmtT(this.sec); },500); }
    card.classList.add('flipped'); AE.pluck(AE.t(),this.tones[+card.dataset.pair],.22);
    if(!this.first){ this.first=card; return; }
    const a=this.first,b=card; this.first=null; this.lock=true;
    this.moves++; $('#mem-moves').textContent=this.moves;
    if(a.dataset.pair===b.dataset.pair){
      setTimeout(()=>{ a.classList.add('matched'); b.classList.add('matched');
        const t=AE.t(),f=this.tones[+a.dataset.pair];
        AE.pluck(t,f*1.5,.18); AE.pluck(t+.08,f*2,.16); AE.pluck(t+.16,f*3,.14);
        this.matched++; this.lock=false; if(this.matched===6)this.win(); },380);
    }else{
      setTimeout(()=>{ a.classList.remove('flipped'); b.classList.remove('flipped');
        this.lock=false; AE.blip(AE.t(),180,.08,.15); },820); } },
  win(){ clearInterval(this.timer); let nb=false;
    if(!this.best||this.sec<this.best){ this.best=this.sec; localStorage.setItem('bv_mem_best',this.sec); nb=true; }
    $('#mem-wtime').textContent=fmtT(this.sec); $('#mem-wmoves').textContent=this.moves;
    $('#mem-wbest').textContent='Best '+fmtT(this.best);
    $('#mem-newbest').style.display=nb?'block':'none';
    $('#mem-win').classList.remove('hidden');
    const t=AE.t(); [523.25,659.25,784,1046.5].forEach((f,i)=>AE.pluck(t+i*.12,f,.2)); }
};
try{ MEM.init(); }catch(e){ console.warn('Memory:',e); }

/* ---------- GAME 3 · GROOVE BOX ---------- */
const GB={sounds:[
   {id:'kick', label:'Kick',    icon:'fa-circle-dot',          fn:t=>AE.kick(t,.95)},
   {id:'snare',label:'Snare',   icon:'fa-circle',              fn:t=>AE.snare(t,.85)},
   {id:'hat',  label:'Hi-Hat',  icon:'fa-grip-lines',          fn:t=>AE.hat(t,.7)},
   {id:'ohat', label:'Open Hat',icon:'fa-grip-lines-vertical', fn:t=>AE.hat(t,.5,true)},
   {id:'bass', label:'Bass',    icon:'fa-wave-square',         fn:t=>AE.bass(t,55,.24,.5)},
   {id:'lead', label:'Lead',    icon:'fa-music',               fn:(t,c)=>AE.pluck(t,220*Math.pow(2,GB.scale[c]/12),.22)}],
 scale:[0,3,5,7,10,12,15,17,19,22,24,27,29,31,34,36],
 pat:{},seq:null,bpm:112,playing:false,lastCol:null,grid:null,
 init(){ this.grid=$('#gb-grid'); if(!this.grid)return;
   this.sounds.forEach(s=>this.pat[s.id]=Array(16).fill(0));
   this.grid.innerHTML=this.sounds.map(s=>`<div class="gb-rowlbl"><i class="fa-solid ${s.icon}"></i>${s.label}</div>`+
     Array.from({length:16},(_,c)=>`<button class="gcell" data-row="${s.id}" data-col="${c}" aria-label="${s.label} step ${c+1}"></button>`).join('')).join('');
   this.grid.addEventListener('click',e=>{ const cell=e.target.closest('.gcell'); if(!cell)return;
     const r=cell.dataset.row,c=+cell.dataset.col;
     this.pat[r][c]^=1; cell.classList.toggle('on',!!this.pat[r][c]);
     AE.resume(); if(this.pat[r][c]){ const snd=this.sounds.find(s=>s.id===r); snd.fn(AE.t(),c); } });
   $('#gb-play').addEventListener('click',()=>this.togglePlay());
   $('#gb-preset').addEventListener('click',()=>{ this.loadPreset(); toast('Demo groove loaded — hit play!','fa-wand-magic-sparkles'); });
   $('#gb-clear').addEventListener('click',()=>{ this.sounds.forEach(s=>this.pat[s.id]=Array(16).fill(0)); this.syncGrid(); });
   $('#gb-tempo').addEventListener('input',e=>{ this.bpm=+e.target.value; $('#gb-bpm').textContent=this.bpm;
     if(this.seq)this.seq.bpm=this.bpm; });
   this.loadPreset(); },
 loadPreset(){ const P={kick:[0,4,8,12],snare:[4,12],hat:[2,6,10,14],ohat:[14],bass:[0,7,8,15],lead:[3,6,11,14]};
   this.sounds.forEach(s=>this.pat[s.id]=Array.from({length:16},(_,c)=>P[s.id].includes(c)?1:0));
   this.syncGrid(); },
 syncGrid(){ $$('.gcell',this.grid).forEach(cell=>cell.classList.toggle('on',!!this.pat[cell.dataset.row][+cell.dataset.col])); },
 stepFn(s,t){ this.sounds.forEach(snd=>{ if(this.pat[snd.id][s])snd.fn(t,s); }); this.ph(s); },
 ph(s){ if(this.lastCol!=null&&this.lastCol>=0)
     $$(`.gcell[data-col="${this.lastCol}"]`,this.grid).forEach(c=>c.classList.remove('ph'));
   if(s>=0)$$(`.gcell[data-col="${s}"]`,this.grid).forEach(c=>c.classList.add('ph'));
   this.lastCol=s; },
 togglePlay(){ if(this.playing){ this.stop(); return; }
   AE.resume(); this.playing=true; $('#gb-play-icon').className='fa-solid fa-pause';
   if(!this.seq)this.seq=new Sequencer((s,t)=>this.stepFn(s,t));
   this.seq.bpm=this.bpm; this.seq.start(this.bpm); },
 stop(){ this.playing=false; $('#gb-play-icon').className='fa-solid fa-play';
   if(this.seq)this.seq.stop(); this.ph(-1); }
};
try{ GB.init(); }catch(e){ console.warn('GrooveBox:',e); }

document.addEventListener('visibilitychange',()=>{ if(document.hidden&&BC.running)BC.pause(); });
})();
