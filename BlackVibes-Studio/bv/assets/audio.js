/* ==========================================================================
   BLACKVIBES STUDIO — shared audio engine (all sound synthesized locally)
   ========================================================================== */
const AE={ctx:null,master:null,noiseBuf:null,muted:(localStorage.getItem('bv_muted')==='1'),
  resume(){ if(!this.ctx){ const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
      this.ctx=new AC();
      const comp=this.ctx.createDynamicsCompressor(); comp.threshold.value=-16; comp.knee.value=22; comp.ratio.value=6;
      this.master=this.ctx.createGain(); this.master.gain.value=this.muted?0:.85;
      this.master.connect(comp); comp.connect(this.ctx.destination);
      const len=this.ctx.sampleRate,b=this.ctx.createBuffer(1,len,this.ctx.sampleRate),d=b.getChannelData(0);
      for(let i=0;i<len;i++)d[i]=Math.random()*2-1; this.noiseBuf=b; }
    if(this.ctx.state==='suspended') this.ctx.resume(); },
  t(){ return this.ctx?this.ctx.currentTime:0 },
  _noise(t,dur,type,freq,q,vol){ if(!this.ctx)return; const s=this.ctx.createBufferSource(); s.buffer=this.noiseBuf; s.loop=true;
    const f=this.ctx.createBiquadFilter(); f.type=type; f.frequency.value=freq; f.Q.value=q;
    const g=this.ctx.createGain(); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.001,t+dur);
    s.connect(f).connect(g).connect(this.master); s.start(t); s.stop(t+dur+.02); },
  kick(t,v=1){ if(!this.ctx)return; const o=this.ctx.createOscillator(),g=this.ctx.createGain();
    o.type='sine'; o.frequency.setValueAtTime(150,t); o.frequency.exponentialRampToValueAtTime(40,t+.12);
    g.gain.setValueAtTime(.9*v,t); g.gain.exponentialRampToValueAtTime(.001,t+.3);
    o.connect(g).connect(this.master); o.start(t); o.stop(t+.32); },
  snare(t,v=1){ if(!this.ctx)return; this._noise(t,.18,'bandpass',1800,.9,.45*v);
    const o=this.ctx.createOscillator(),g=this.ctx.createGain(); o.type='triangle';
    o.frequency.setValueAtTime(220,t); o.frequency.exponentialRampToValueAtTime(120,t+.08);
    g.gain.setValueAtTime(.3*v,t); g.gain.exponentialRampToValueAtTime(.001,t+.12);
    o.connect(g).connect(this.master); o.start(t); o.stop(t+.14); },
  hat(t,v=1,open=false){ if(!this.ctx)return; this._noise(t,open?.28:.05,'highpass',7600,.7,.22*v); },
  clap(t,v=1){ if(!this.ctx)return; [0,.012,.026].forEach((off,i)=>this._noise(t+off,i===2?.2:.05,'bandpass',1200,1.2,.3*v)); },
  bass(t,f,dur=.26,v=.5){ if(!this.ctx)return; const o=this.ctx.createOscillator(),g=this.ctx.createGain(),fl=this.ctx.createBiquadFilter();
    o.type='sawtooth'; o.frequency.value=f; fl.type='lowpass';
    fl.frequency.setValueAtTime(700,t); fl.frequency.exponentialRampToValueAtTime(180,t+dur);
    g.gain.setValueAtTime(.0001,t); g.gain.linearRampToValueAtTime(v,t+.015); g.gain.exponentialRampToValueAtTime(.001,t+dur);
    o.connect(fl).connect(g).connect(this.master); o.start(t); o.stop(t+dur+.05); },
  pluck(t,f,v=.28){ if(!this.ctx)return; const o=this.ctx.createOscillator(),o2=this.ctx.createOscillator(),g=this.ctx.createGain(),fl=this.ctx.createBiquadFilter();
    o.type='triangle'; o2.type='sawtooth'; o.frequency.value=f; o2.frequency.value=f*1.005;
    fl.type='lowpass'; fl.frequency.setValueAtTime(2600,t); fl.frequency.exponentialRampToValueAtTime(320,t+.28);
    g.gain.setValueAtTime(v,t); g.gain.exponentialRampToValueAtTime(.001,t+.34);
    o.connect(fl); o2.connect(fl); fl.connect(g).connect(this.master);
    o.start(t); o2.start(t); o.stop(t+.36); o2.stop(t+.36); },
  blip(t,f=880,v=.18,dur=.12){ if(!this.ctx)return; const o=this.ctx.createOscillator(),g=this.ctx.createGain();
    o.type='sine'; o.frequency.value=f; g.gain.setValueAtTime(v,t); g.gain.exponentialRampToValueAtTime(.001,t+dur);
    o.connect(g).connect(this.master); o.start(t); o.stop(t+dur+.02); },
  whoosh(t,v=.3){ if(!this.ctx)return; const s=this.ctx.createBufferSource(); s.buffer=this.noiseBuf;
    const f=this.ctx.createBiquadFilter(); f.type='bandpass'; f.Q.value=.8;
    f.frequency.setValueAtTime(300,t); f.frequency.exponentialRampToValueAtTime(4200,t+.5);
    const g=this.ctx.createGain(); g.gain.setValueAtTime(.0001,t); g.gain.linearRampToValueAtTime(v,t+.08); g.gain.exponentialRampToValueAtTime(.001,t+.55);
    s.connect(f).connect(g).connect(this.master); s.start(t); s.stop(t+.6); },
  chime(t,v=.22){ if(!this.ctx)return; [523.25,659.25,784,1046.5].forEach((f,i)=>this.pluck(t+i*.1,f,v)); },
  setMuted(m){ this.muted=m; localStorage.setItem('bv_muted',m?'1':'0'); if(this.master) this.master.gain.value=m?0:.85; }
};
/* lookahead step sequencer */
class Sequencer{
  constructor(stepFn){ this.stepFn=stepFn; this.bpm=120; this.playing=false; this.step=0; this._next=0; this._timer=null; }
  start(bpm){ AE.resume(); if(this._timer)clearInterval(this._timer);
    this.bpm=bpm; this.step=0; this.playing=true; this._next=AE.t()+.08;
    this._timer=setInterval(()=>this._tick(),25); this._tick(); }
  _tick(){ if(!this.playing)return; const s16=60/this.bpm/4;
    while(this._next<AE.t()+.14){ try{this.stepFn(this.step,this._next)}catch(e){}
      this.step=(this.step+1)%16; this._next+=s16; } }
  stop(){ this.playing=false; if(this._timer){clearInterval(this._timer);this._timer=null} }
}
