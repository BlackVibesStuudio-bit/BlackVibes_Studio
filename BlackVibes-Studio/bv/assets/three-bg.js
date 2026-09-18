/* ==========================================================================
   BLACKVIBES STUDIO — Three.js hero backgrounds
   - #bg3d               → home hero: ring of reactive equalizer bars
   - [data-bv3d]          → inner-page / contact hero: floating wireframe crystals
   Sets window.__bvThreeReady = true once at least one scene is live, so
   app.js's no3d fallback timeout backs off. Exposes window.bvPulse(v) so
   other scripts (arcade combos, the contact rocket launch) can nudge
   whichever scene is on screen for a little extra energy.
   ========================================================================== */
(function(){
  const pulses=[];
  window.bvPulse=function(v){ pulses.forEach(p=>{ p.v=Math.min(1,p.v+(v||.4)); }); };

  function loadThree(cb){
    if(window.THREE){ cb(); return; }
    const s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    s.async=true;
    s.onload=cb;
    s.onerror=function(){ console.warn('three.js failed to load'); document.body.classList.add('no3d'); };
    document.head.appendChild(s);
  }

  function buildRing(canvas){
    let renderer;
    try{ renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true}); }catch(e){ return false; }
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
    const scene=new THREE.Scene(); scene.fog=new THREE.FogExp2(0x060608,.05);
    const camera=new THREE.PerspectiveCamera(55,1,.1,120); camera.position.set(0,1.6,10.5);
    scene.add(new THREE.AmbientLight(0xffffff,.35));
    const l1=new THREE.PointLight(0xffffff,.9); l1.position.set(6,8,6); scene.add(l1);
    const l2=new THREE.PointLight(0x9b6bff,1.1,40); l2.position.set(-8,4,-4); scene.add(l2);
    const grid=new THREE.GridHelper(80,80,0x232329,0x131318); grid.position.y=-.02; scene.add(grid);
    const N=innerWidth<768?40:66,R=6.4;
    const barGeo=new THREE.BoxGeometry(.3,1,.3); barGeo.translate(0,.5,0);
    const barMat=new THREE.MeshStandardMaterial({color:0x18181d,metalness:.9,roughness:.35});
    const bars=new THREE.Group(),arr=[];
    for(let i=0;i<N;i++){ const m=new THREE.Mesh(barGeo,barMat); const a=i/N*Math.PI*2;
      m.position.set(Math.cos(a)*R,0,Math.sin(a)*R); m.rotation.y=-a; bars.add(m); arr.push(m); }
    scene.add(bars);
    function dotTexture(){ const c=document.createElement('canvas'); c.width=c.height=64; const g=c.getContext('2d');
      const rg=g.createRadialGradient(32,32,0,32,32,32);
      rg.addColorStop(0,'rgba(255,255,255,1)'); rg.addColorStop(1,'rgba(255,255,255,0)');
      g.fillStyle=rg; g.fillRect(0,0,64,64); return new THREE.CanvasTexture(c); }
    const cnt=innerWidth<768?220:440,pos=new Float32Array(cnt*3);
    for(let i=0;i<cnt;i++){ const r=8+Math.random()*16,a=Math.random()*Math.PI*2;
      pos[i*3]=Math.cos(a)*r; pos[i*3+1]=Math.random()*10-2; pos[i*3+2]=Math.sin(a)*r; }
    const pGeo=new THREE.BufferGeometry(); pGeo.setAttribute('position',new THREE.BufferAttribute(pos,3));
    const particles=new THREE.Points(pGeo,new THREE.PointsMaterial({color:0xffffff,size:.055,transparent:true,
      opacity:.55,map:dotTexture(),depthWrite:false,blending:THREE.AdditiveBlending}));
    scene.add(particles);
    let mx=0,my=0,visible=true;
    addEventListener('mousemove',e=>{ mx=(e.clientX/innerWidth-.5)*2; my=(e.clientY/innerHeight-.5)*2; });
    function resize(){ const w=canvas.parentElement.clientWidth,h=canvas.parentElement.clientHeight;
      if(!w||!h)return; camera.aspect=w/h; camera.updateProjectionMatrix(); renderer.setSize(w,h,false); }
    addEventListener('resize',resize); resize();
    new IntersectionObserver(es=>es.forEach(e=>visible=e.isIntersecting)).observe(canvas);
    const pulse={v:0}; pulses.push(pulse);
    const clock=new THREE.Clock(); let t=0,beatT=0,beat=0; const beatDur=60/122;
    (function tick(){ requestAnimationFrame(tick);
      const dt=Math.min(clock.getDelta(),.05); t+=dt;
      if(!visible)return;
      beatT+=dt; if(beatT>=beatDur){beatT-=beatDur;beat=1}
      beat=Math.max(0,beat-dt*2.2); pulse.v=Math.max(0,pulse.v-dt*1.6);
      const amp=REDUCED?.3:1,pl=beat+pulse.v;
      for(let i=0;i<arr.length;i++){ const m=arr[i];
        const v=(.5+Math.abs(Math.sin(t*2.1+i*.4))*1.4*amp+Math.abs(Math.sin(t*.53+i*1.7))*.9*amp+pl*2.1*(i%2?1:.6));
        m.scale.y+=(v-m.scale.y)*.25; }
      if(!REDUCED){ bars.rotation.y+=dt*.05; particles.rotation.y-=dt*.008; }
      camera.position.x+=(mx*1.1-camera.position.x)*.04;
      camera.position.y+=((1.6-my*.7)-camera.position.y)*.05;
      camera.lookAt(0,.8,0);
      l2.intensity=1.1+pl*2;
      renderer.render(scene,camera); })();
    return true;
  }

  function buildCrystal(canvas){
    let renderer;
    try{ renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true}); }catch(e){ return false; }
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
    const scene=new THREE.Scene(); scene.fog=new THREE.FogExp2(0x060608,.045);
    const camera=new THREE.PerspectiveCamera(50,1,.1,100); camera.position.set(0,0,8);
    scene.add(new THREE.AmbientLight(0xffffff,.4));
    const l1=new THREE.PointLight(0x9b6bff,1.4,30); l1.position.set(-4,3,4); scene.add(l1);
    const l2=new THREE.PointLight(0xffffff,.6,30); l2.position.set(5,-2,3); scene.add(l2);

    const group=new THREE.Group(); scene.add(group);
    const crystals=[];
    const N=innerWidth<768?5:8;
    for(let i=0;i<N;i++){
      const size=.55+Math.random()*.95;
      const geo=new THREE.IcosahedronGeometry(size,0);
      const solid=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({
        color:0x9b6bff,metalness:.3,roughness:.15,transparent:true,opacity:.12,emissive:0x3d2a63,emissiveIntensity:.4}));
      const wire=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0xc9b0ff,wireframe:true,transparent:true,opacity:.55}));
      const holder=new THREE.Group(); holder.add(solid); holder.add(wire);
      const r=3+Math.random()*3, a=Math.random()*Math.PI*2, h=(Math.random()-.5)*4.5;
      holder.position.set(Math.cos(a)*r,h,Math.sin(a)*r-2);
      holder.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,0);
      group.add(holder);
      crystals.push({holder,spin:(Math.random()-.5)*.4,bob:Math.random()*Math.PI*2,speed:.6+Math.random()*.6,baseY:h});
    }

    function dotTexture(){ const c=document.createElement('canvas'); c.width=c.height=64; const g=c.getContext('2d');
      const rg=g.createRadialGradient(32,32,0,32,32,32);
      rg.addColorStop(0,'rgba(255,255,255,1)'); rg.addColorStop(1,'rgba(255,255,255,0)');
      g.fillStyle=rg; g.fillRect(0,0,64,64); return new THREE.CanvasTexture(c); }
    const cnt=innerWidth<768?110:200,pos=new Float32Array(cnt*3);
    for(let i=0;i<cnt;i++){ pos[i*3]=(Math.random()-.5)*22; pos[i*3+1]=(Math.random()-.5)*12; pos[i*3+2]=(Math.random()-.5)*10-2; }
    const pGeo=new THREE.BufferGeometry(); pGeo.setAttribute('position',new THREE.BufferAttribute(pos,3));
    const particles=new THREE.Points(pGeo,new THREE.PointsMaterial({color:0xffffff,size:.045,transparent:true,
      opacity:.45,map:dotTexture(),depthWrite:false,blending:THREE.AdditiveBlending}));
    scene.add(particles);

    let mx=0,my=0,visible=true;
    addEventListener('mousemove',e=>{ mx=(e.clientX/innerWidth-.5)*2; my=(e.clientY/innerHeight-.5)*2; });
    function resize(){ const w=canvas.parentElement.clientWidth,h=canvas.parentElement.clientHeight;
      if(!w||!h)return; camera.aspect=w/h; camera.updateProjectionMatrix(); renderer.setSize(w,h,false); }
    addEventListener('resize',resize); resize();
    new IntersectionObserver(es=>es.forEach(e=>visible=e.isIntersecting)).observe(canvas);
    const pulse={v:0}; pulses.push(pulse);
    const clock=new THREE.Clock(); let t=0;
    (function tick(){ requestAnimationFrame(tick);
      const dt=Math.min(clock.getDelta(),.05); t+=dt;
      if(!visible)return;
      pulse.v=Math.max(0,pulse.v-dt*1.4);
      const amp=REDUCED?.25:1;
      crystals.forEach(c=>{
        c.holder.rotation.x+=c.spin*dt*amp; c.holder.rotation.y+=c.spin*.7*dt*amp;
        c.holder.position.y=c.baseY+Math.sin(t*c.speed+c.bob)*.3;
        const s=1+pulse.v*.25; c.holder.scale.setScalar(s);
      });
      if(!REDUCED) group.rotation.y+=dt*.04;
      particles.rotation.y-=dt*.01;
      camera.position.x+=(mx*.8-camera.position.x)*.04;
      camera.position.y+=((-my*.5)-camera.position.y)*.05;
      camera.lookAt(0,0,0);
      l1.intensity=1.4+pulse.v*2;
      renderer.render(scene,camera); })();
    return true;
  }

  function init(){
    const ring=document.getElementById('bg3d');
    const crystalCanvases=$$('[data-bv3d]');
    if(!ring && !crystalCanvases.length) return;
    let any=false;
    if(ring){ try{ if(buildRing(ring)) any=true; }catch(e){ console.warn('3D ring:',e); } }
    crystalCanvases.forEach(c=>{ try{ if(buildCrystal(c)) any=true; }catch(e){ console.warn('3D crystal:',e); } });
    if(any){ window.__bvThreeReady=true; document.body.classList.remove('no3d'); }
    else document.body.classList.add('no3d');

    /* click-for-a-boom: bind on the hero section, since the canvas itself
       is pointer-events:none in the CSS so clicks pass through to it */
    const heroSections=new Set();
    if(ring && ring.closest('section')) heroSections.add(ring.closest('section'));
    crystalCanvases.forEach(c=>{ const s=c.closest('section'); if(s) heroSections.add(s); });
    heroSections.forEach(sec=>{
      sec.addEventListener('pointerdown',e=>{
        if(e.target.closest('a,button,input,textarea,select')) return;
        if(window.bvPulse) bvPulse(1);
        if(typeof AE!=='undefined'){ AE.resume(); const t=AE.t(); AE.kick(t,1); AE.hat(t,.6); }
      });
    });
  }

  loadThree(()=>{ try{ init(); }catch(e){ console.warn('three-bg init:',e); document.body.classList.add('no3d'); } });
})();
