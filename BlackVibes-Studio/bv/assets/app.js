/* ---------- helpers (global) ---------- */
const $=(s,c=document)=>c.querySelector(s);
const $$=(s,c=document)=>[...c.querySelectorAll(s)];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const fmtT=s=>{s=Math.max(0,Math.floor(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
const parseDur=d=>{const[m,s]=d.split(':').map(Number);return m*60+s};
const initials=t=>t.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
let REDUCED=false;
try{ REDUCED=matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){ console.warn('matchMedia unavailable:',e); }
let toastTimer;
function toast(msg,icon='fa-check'){const t=$('#toast');if(!t)return;$('#toast-msg').textContent=msg;$('#toast-icon').className='fa-solid '+icon;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),3200)}

(function(){'use strict';
/* preloader — finishes on its own timer, max ~2s, no matter what */
(function(){
  var done=false,pct=0,el=document.getElementById('plPct');
  function finish(){ if(done)return; done=true; if(el)el.textContent='100%';
    setTimeout(function(){
      var p=document.getElementById('preloader'); if(p)p.classList.add('done');
      document.body.classList.add('loaded'); },250); }
  var iv=setInterval(function(){ pct=Math.min(100,pct+Math.random()*20+10);
    if(el)el.textContent=Math.floor(pct)+'%';
    if(pct>=100){ clearInterval(iv); finish(); } },70);
  if(document.readyState==='complete')finish();
  else window.addEventListener('load',finish);
  setTimeout(finish,2000);
})();

/* nav / scroll chrome */
document.addEventListener('DOMContentLoaded',()=>{
  const nav=$('#nav');
  if(nav){
    window.addEventListener('scroll',()=>{
      nav.classList.toggle('scrolled',scrollY>30);
      const bar=$('#progress'); if(bar) bar.style.width=(scrollY/(document.documentElement.scrollHeight-innerHeight)*100)+'%';
      const tt=$('#toTop'); if(tt) tt.classList.toggle('show',scrollY>700);
    },{passive:true});
  }
  const toTop=$('#toTop'); if(toTop) toTop.addEventListener('click',()=>scrollTo({top:0,behavior:'smooth'}));

  const burger=$('#burger'),mnav=$('#mnav');
  function closeMenu(){ if(!mnav)return; mnav.classList.remove('open'); if(burger)burger.setAttribute('aria-label','Open menu');
    const bi=$('#burger-icon'); if(bi)bi.className='fa-solid fa-bars'; document.body.style.overflow=''; }
  if(burger&&mnav){
    burger.addEventListener('click',()=>{ const open=!mnav.classList.contains('open');
      mnav.classList.toggle('open',open); burger.setAttribute('aria-label',open?'Close menu':'Open menu');
      $('#burger-icon').className=open?'fa-solid fa-xmark':'fa-solid fa-bars';
      document.body.style.overflow=open?'hidden':''; });
    $$('#mnav a').forEach(a=>a.addEventListener('click',closeMenu));
  }
  document.addEventListener('keydown',e=>{ if(e.key==='Escape')closeMenu(); });

  /* highlight current page in nav */
  const path=location.pathname.split('/').pop()||'index.html';
  $$('.nav-links a,.mnav a').forEach(a=>{
    const href=(a.getAttribute('href')||'').split('/').pop();
    if(href===path || (path===''&&href==='index.html')) a.classList.add('active'); else a.classList.remove('active');
  });

  /* custom cursor */
  let pointerFine=false;
  try{ pointerFine=matchMedia('(pointer:fine)').matches; }catch(e){}
  if(pointerFine){
    const dot=$('#cDot'),ring=$('#cRing');
    if(dot&&ring){
      let x=innerWidth/2,y=innerHeight/2,rx=x,ry=y;
      addEventListener('mousemove',e=>{ x=e.clientX; y=e.clientY;
        dot.style.transform=`translate(${x}px,${y}px) translate(-50%,-50%)`;
        ring.classList.toggle('hover',!!e.target.closest('a,button,.track,.gcell,.mcard,input,textarea,.gtab,.faq-q')); });
      (function cl(){ rx+=(x-rx)*.16; ry+=(y-ry)*.16;
        ring.style.transform=`translate(${rx}px,${ry}px) translate(-50%,-50%)`; requestAnimationFrame(cl); })();
    }
  }

  /* mute */
  const muteBtn=$('#mute-btn');
  if(muteBtn){
    muteBtn.addEventListener('click',()=>{ AE.resume(); const m=!AE.muted; AE.setMuted(m);
      $('#mute-icon').className=m?'fa-solid fa-volume-xmark':'fa-solid fa-volume-high';
      toast(m?'Sound off — vibing in silence.':'Sound on — crank it.','fa-volume-high'); });
  }

  /* newsletter form lives only on contact.html, which wires its own
     submit handler (real email delivery + rocket animation) */

  /* section-based nav active state (only relevant on pages with id sections matching nav) */
  try{
    const ids=$$('main section[id]').map(s=>s.id);
    if(ids.length){
      const secIO=new IntersectionObserver(es=>es.forEach(e=>{ if(!e.isIntersecting)return;
        $$('.nav-links a').forEach(a=>a.classList.toggle('active',a.getAttribute('href')==='#'+e.target.id));
      }),{rootMargin:'-40% 0px -55% 0px'});
      ids.forEach(id=>{const s=document.getElementById(id); s&&secIO.observe(s)});
    }
  }catch(e){ console.warn('section nav:',e); }

  /* generic reveal-on-scroll for [data-reveal], without GSAP */
  try{
    const rio=new IntersectionObserver(es=>es.forEach(e=>{ if(!e.isIntersecting)return;
      e.target.style.transition='opacity .8s cubic-bezier(.22,.61,.36,1), transform .8s cubic-bezier(.22,.61,.36,1)';
      e.target.style.opacity=1; e.target.style.transform='none'; rio.unobserve(e.target);
    }),{threshold:.16});
    $$('[data-reveal]').forEach(el=>{ el.style.opacity=0; el.style.transform='translateY(46px)'; rio.observe(el); });
  }catch(e){}

  /* counters */
  try{
    const cio=new IntersectionObserver(es=>es.forEach(en=>{ if(!en.isIntersecting)return; cio.unobserve(en.target);
      const el=en.target,target=+el.dataset.count,t0=performance.now(),dur=1600,b=el.querySelector('b');
      (function step(n){ const p=Math.min(1,(n-t0)/dur),e=1-Math.pow(1-p,3);
        b.textContent=Math.round(target*e); if(p<1)requestAnimationFrame(step); })(t0);
    }),{threshold:.5});
    $$('.stat-num[data-count]').forEach(el=>cio.observe(el));
  }catch(e){ console.warn('counters:',e); }

  /* FAQ accordion (contact page) */
  $$('.faq-q').forEach(q=>q.addEventListener('click',()=>{
    const item=q.closest('.faq-item'); const open=item.classList.contains('open');
    $$('.faq-item').forEach(i=>i.classList.remove('open'));
    if(!open) item.classList.add('open');
  }));
});

/* mark no3d after timeout unless three.js hero explicitly clears it */
setTimeout(function(){ if(!window.__bvThreeReady) document.body.classList.add('no3d'); },3200);
})();
