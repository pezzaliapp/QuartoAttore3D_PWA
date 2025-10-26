// Quarto Attore 3D — app.js v1.1.3 (no module, UMD Three + fallback Canvas2D)

const canvas = document.getElementById('scene');
const btnInstall = document.getElementById('btnInstall');
const btnMute = document.getElementById('btnMute');
const QS = new URLSearchParams(location.search);
const FORCE = (QS.get('force') || '').toLowerCase(); // 'webgl' | '2d' | ''

function note(msg, ms=4000){
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:8px;bottom:8px;background:#1a2039cc;color:#fff;border:1px solid #2b356e;padding:8px 10px;border-radius:8px;font:12px system-ui;z-index:99999';
  el.textContent = msg; document.body.appendChild(el);
  setTimeout(()=>{ try{ el.remove(); }catch{} }, ms);
}

// Install prompt
let deferredPrompt;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); deferredPrompt=e; if(btnInstall) btnInstall.style.display='inline-flex';
});
btnInstall?.addEventListener('click', async ()=>{
  if(!deferredPrompt) return;
  deferredPrompt.prompt(); await deferredPrompt.userChoice;
  deferredPrompt=null; btnInstall.style.display='none';
});

// Audio vento (anche in 2D)
let audioCtx, windSource, muted = true;
btnMute?.addEventListener('click', ()=>{
  muted=!muted; btnMute.textContent = muted ? 'Mute' : 'Sound ON';
  if (windSource) windSource.gain.gain.value = muted ? 0.0 : 0.25;
});
function initAudio(){
  try{
    if (audioCtx) return;
    audioCtx = new (window.AudioContext||window.webkitAudioContext)();
    const node = audioCtx.createScriptProcessor(2048,1,1);
    node.onaudioprocess = e => {
      const out = e.outputBuffer.getChannelData(0);
      for (let i=0;i<out.length;i++) out[i] = (Math.random()*2-1)*0.12;
    };
    const biquad = audioCtx.createBiquadFilter(); biquad.type='bandpass'; biquad.frequency.value=600; biquad.Q.value=0.6;
    const gain = audioCtx.createGain(); gain.gain.value = muted ? 0.0 : 0.25;
    node.connect(biquad).connect(gain).connect(audioCtx.destination);
    windSource = { node, gain };
  }catch(err){ console.warn('Audio error', err); }
}
document.addEventListener('touchstart', ()=>initAudio(), {passive:true});

// ───────────────────────────────
// Fallback Canvas2D (sempre OK)
// ───────────────────────────────
function startCanvas2D(){
  const ctx = canvas.getContext('2d', { alpha:false });
  const DPR = Math.min(2, window.devicePixelRatio||1);
  function resize(){ canvas.width=Math.floor(innerWidth*DPR); canvas.height=Math.floor(innerHeight*DPR); }
  resize(); addEventListener('resize', resize);

  let t=0, glide=0, lastTap=0;
  const P = 900, parts = new Float32Array(P*3);
  for(let i=0;i<P;i++){ parts[3*i]=(Math.random()-0.5)*80; parts[3*i+1]=Math.random()*2.5+0.2; parts[3*i+2]=(Math.random()-0.5)*80; }
  addEventListener('pointerdown', ()=>{ const now=performance.now(); glide=Math.min(1,glide+((now-lastTap<300)?0.3:0.15)); lastTap=now; }, {passive:true});
  function n2(x,y){ return Math.sin(x*0.17+y*0.123+t*0.2)*0.5 + Math.sin(x*0.05+y*0.07+t*0.12)*0.5; }

  (function frame(){
    requestAnimationFrame(frame); t+=0.016;
    const w=canvas.width,h=canvas.height;

    const g = ctx.createLinearGradient(0,0,0,h); g.addColorStop(0,'#172042'); g.addColorStop(1,'#0b1022');
    ctx.fillStyle=g; ctx.fillRect(0,0,w,h);

    function dune(scale, amp, yBase, a='#EBC88C', b='#AE8C55'){
      ctx.beginPath();
      for(let x=0;x<w;x+=2){
        const xx=(x/w-0.5)*120*scale;
        const n=n2(xx,0)*amp + n2(xx*2.3,1.7)*amp*0.5;
        const yy=yBase - n*20*DPR;
        if(x===0) ctx.moveTo(x,yy); else ctx.lineTo(x,yy);
      }
      ctx.lineTo(w,h); ctx.lineTo(0,h); ctx.closePath();
      const gg = ctx.createLinearGradient(0,yBase-60*DPR,0,h);
      gg.addColorStop(0,a); gg.addColorStop(1,b);
      ctx.fillStyle=gg; ctx.globalAlpha=0.95; ctx.fill(); ctx.globalAlpha=1.0;
    }
    dune(0.6,0.8,h*0.55); dune(0.9,1.0,h*0.68); dune(1.3,1.2,h*0.82);

    const cx=w*0.5, cy=h*0.6 + Math.sin(t*1.8)*6*DPR;
    ctx.beginPath(); ctx.arc(cx,cy,14*DPR,0,Math.PI*2); ctx.fillStyle='#f6edd7'; ctx.fill();
    const glow=ctx.createRadialGradient(cx,cy,0,cx,cy,26*DPR);
    glow.addColorStop(0,'rgba(255,233,196,0.25)'); glow.addColorStop(1,'rgba(255,233,196,0)'); 
    ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(cx,cy,26*DPR,0,Math.PI*2); ctx.fill();

    ctx.fillStyle='rgba(255,255,255,0.35)';
    for(let i=0;i<P;i++){
      let x=parts[3*i], z=parts[3*i+2];
      x += 0.12; z += 0.09; if(x>40) x=-40; if(z>40) z=-40;
      parts[3*i]=x; parts[3*i+2]=z;
      const sx=(x/80+0.5)*w, sy=(0.58+Math.sin((z+x)*0.08+t*0.4)*0.02)*h;
      ctx.fillRect(sx,sy,2*DPR,2*DPR);
    }
    if(glide>0.0005) glide*=0.985;
  })();
  note('Modalità compatibilità (Canvas2D)');
}

// ───────────────────────────────
// WebGL Three UMD (globale THREE)
// ───────────────────────────────
function startWebGL(){
  if (!window.THREE || !canvas) throw new Error('THREE non disponibile');

  const DPR = Math.min(2, window.devicePixelRatio||1);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:false, powerPreference:'high-performance' });
  renderer.setClearColor(0x0b1022,1); renderer.setPixelRatio(DPR);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.addEventListener('webglcontextlost', e=>{ e.preventDefault(); note('WebGL context lost'); startCanvas2D(); }, false);

  const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0x0b1022, 40, 180);

  const camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 400);
  camera.position.set(0,2.4,7);

  // Controllo camera minimale (drag)
  const pivot = new THREE.Object3D(); scene.add(pivot);
  pivot.add(camera);
  let dragging=false, lx=0, ly=0, yaw=0, pitch=-0.2;
  function onDown(e){ dragging=true; lx=e.clientX||e.touches?.[0]?.clientX||0; ly=e.clientY||e.touches?.[0]?.clientY||0; }
  function onMove(e){
    if(!dragging) return;
    const x=e.clientX||e.touches?.[0]?.clientX||0, y=e.clientY||e.touches?.[0]?.clientY||0;
    yaw -= (x-lx)*0.003; pitch -= (y-ly)*0.002; pitch = Math.max(-1.0, Math.min(0.6, pitch));
    lx=x; ly=y;
  }
  function onUp(){ dragging=false; }
  window.addEventListener('pointerdown', onDown, {passive:true});
  window.addEventListener('pointermove', onMove, {passive:true});
  window.addEventListener('pointerup', onUp, {passive:true});
  window.addEventListener('pointercancel', onUp, {passive:true});

  scene.add(new THREE.HemisphereLight(0xffe9c4, 0x0b1022, 0.6));
  const dir = new THREE.DirectionalLight(0xfff3d2, 0.9); dir.position.set(4,6,2); scene.add(dir);

  // cielo
  const skyGeo = new THREE.SphereGeometry(200,32,16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms:{ top:{value:new THREE.Color('#172042')}, bottom:{value:new THREE.Color('#0b1022')} },
    vertexShader:`varying vec3 vPos; void main(){ vPos=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader:`varying vec3 vPos; uniform vec3 top; uniform vec3 bottom;
      void main(){ float h=normalize(vPos).y*0.5+0.5; gl_FragColor=vec4(mix(bottom,top, pow(h,1.2)),1.0); }`
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  // dune (shader semplice, niente chunk)
  const duneRes = 200;
  const duneGeo = new THREE.PlaneGeometry(200,200,duneRes,duneRes); duneGeo.rotateX(-Math.PI/2);
  let duneMat;
  try{
    duneMat = new THREE.ShaderMaterial({
      fog:true,
      uniforms:{
        uTime:{value:0}, uAmp:{value:0.7}, uWind:{value:new THREE.Vector2(0.35,0.18)},
        uColorA:{value:new THREE.Color(0xEBC88C)}, uColorB:{value:new THREE.Color(0xAE8C55)},
        uDir:{value:new THREE.Vector3(0.5,0.8,0.2).normalize()},
        uFogColor:{value:new THREE.Color(0x0b1022)}, uFogNear:{value:40.0}, uFogFar:{value:180.0}
      },
      vertexShader:`
        precision mediump float;
        uniform float uTime; uniform float uAmp; uniform vec2 uWind;
        varying vec3 vNormalW; varying vec3 vPosW;
        vec3 mod289(vec3 x){ return x - floor(x*(1.0/289.0))*289.0; }
        vec2 mod289(vec2 x){ return x - floor(x*(1.0/289.0))*289.0; }
        vec3 permute(vec3 x){ return mod289(((x*34.0)+1.0)*x); }
        float snoise(vec2 v){
          const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
          vec2 i=floor(v+dot(v,C.yy)); vec2 x0=v-i+dot(i,C.xx);
          vec2 i1=(x0.x>x0.y)?vec2(1.,0.):vec2(0.,1.);
          vec4 x12=x0.xyxy+C.xxzz; x12.xy-=i1; i=mod289(i);
          vec3 p=permute(permute(i.y+vec3(0.,i1.y,1.))+i.x+vec3(0.,i1.x,1.));
          vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.); m=m*m; m=m*m;
          vec3 x=2.*fract(p*0.0243902439)-1.; vec3 h=abs(x)-0.5; vec3 ox=floor(x+0.5); vec3 a0=x-ox;
          m *= 1.79284291400159 - 0.85373472095314*(a0*a0+h*h);
          vec3 g; g.x=a0.x*x0.x+h.x*x0.y; g.yz=a0.yz*x12.xz+h.yz*x12.yw;
          return 130.*dot(m,g);
        }
        void main(){
          vec3 pos=position;
          float f1=snoise(pos.xz*0.08 + uWind*0.03*uTime);
          float f2=snoise(pos.xz*0.20 + uWind*0.06*uTime)*0.5;
          float n=f1+f2; pos.y += n*uAmp;
          float e=0.6;
          float nx=(snoise((pos.xz+vec2(e,0.))*0.08 + uWind*0.03*uTime)+0.5*snoise((pos.xz+vec2(e,0.))*0.20 + uWind*0.06*uTime)
                   -snoise((pos.xz-vec2(e,0.))*0.08 + uWind*0.03*uTime)-0.5*snoise((pos.xz-vec2(e,0.))*0.20 + uWind*0.06*uTime))*uAmp/e;
          float nz=(snoise((pos.xz+vec2(0.,e))*0.08 + uWind*0.03*uTime)+0.5*snoise((pos.xz+vec2(0.,e))*0.20 + uWind*0.06*uTime)
                   -snoise((pos.xz-vec2(0.,e))*0.08 + uWind*0.03*uTime)-0.5*snoise((pos.xz-vec2(0.,e))*0.20 + uWind*0.06*uTime))*uAmp/e;
          vec3 nrm=normalize(vec3(-nx,1.,-nz));
          vec4 wp=modelMatrix*vec4(pos,1.); vPosW=wp.xyz; 
          // normalMatrix è fornita da Three
          vNormalW=normalize(normalMatrix*nrm);
          gl_Position=projectionMatrix*viewMatrix*wp;
        }`,
      fragmentShader:`
        precision mediump float;
        uniform vec3 uColorA,uColorB,uDir,uFogColor; uniform float uFogNear,uFogFar;
        varying vec3 vNormalW,vPosW;
        void main(){
          vec3 base=mix(uColorB,uColorA,0.6);
          float lambert=max(dot(normalize(vNormalW),normalize(uDir)),0.0);
          vec3 col=base*(0.35+0.75*lambert);
          float d=length(vPosW - cameraPosition);
          float f=smoothstep(uFogNear,uFogFar,d);
          gl_FragColor=vec4(mix(col,uFogColor,f),1.0);
        }`
    });
  }catch(e){
    console.warn('ShaderMaterial error, fallback standard:', e);
    duneGeo.computeVertexNormals();
    duneMat = new THREE.MeshStandardMaterial({ color:0xC9A873, roughness:0.95, metalness:0.0 });
    note('Shader non disponibile — materiale standard');
  }
  const dunes = new THREE.Mesh(duneGeo, duneMat);
  scene.add(dunes);

  // viaggiatore
  const traveler = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.18,0.5,8,16),
    new THREE.MeshStandardMaterial({ color:0xf6edd7, emissive:0x111111, roughness:0.4 })
  ); traveler.position.set(0,0.8,0); scene.add(traveler);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ color:0xffe9c4, opacity:0.25, transparent:true }));
  glow.scale.set(1.6,1.6,1.6); traveler.add(glow);

  // vento particelle
  const P=1200, pGeo=new THREE.BufferGeometry();
  const pos=new Float32Array(P*3), vel=new Float32Array(P);
  for(let i=0;i<P;i++){ pos[3*i]=(Math.random()-0.5)*80; pos[3*i+1]=Math.random()*2.5+0.2; pos[3*i+2]=(Math.random()-0.5)*80; vel[i]=0.2+Math.random()*0.6; }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos,3));
  pGeo.setAttribute('vel', new THREE.BufferAttribute(vel,1));
  const wind = new THREE.Points(pGeo, new THREE.PointsMaterial({ size:0.06, sizeAttenuation:true, transparent:true, opacity:0.35 }));
  scene.add(wind);

  // input: tap per avanzare
  let glide=0, lastTap=0;
  window.addEventListener('pointerdown', ()=>{
    const now=performance.now(); glide=Math.min(1, glide + (now-lastTap<300?0.3:0.15)); lastTap=now;
  }, {passive:true});

  function resize(){
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);

  let t=0;
  (function loop(){
    requestAnimationFrame(loop);
    t+=0.016;
    if (duneMat.uniforms && duneMat.uniforms.uTime){ duneMat.uniforms.uTime.value = t; }

    // applica yaw/pitch al pivot (camera child)
    pivot.rotation.y = yaw;
    pivot.rotation.x = pitch;

    traveler.position.y = 0.8 + Math.sin(t*1.8)*0.06;
    const dirV = new THREE.Vector3(0,0,-1).applyEuler(pivot.rotation);
    if (glide>0.0005){
      const step=0.035*glide;
      traveler.position.addScaledVector(dirV,step);
      pivot.position.addScaledVector(dirV,step);
      glide*=0.985;
    }

    // vento
    const positions=wind.geometry.attributes.position.array, vels=wind.geometry.attributes.vel.array;
    for(let i=0;i<P;i++){
      positions[3*i]+=0.02+0.04*vels[i];
      positions[3*i+2]+=0.03*vels[i];
      if (positions[3*i]>40) positions[3*i]=-40;
      if (positions[3*i+2]>40) positions[3*i+2]=-40;
    }
    wind.geometry.attributes.position.needsUpdate=true;

    renderer.render(scene,camera);
  })();

  note('Modalità WebGL (Three.js UMD)');
}

// BOOT: forza 2D/WebGL via query, altrimenti tenta WebGL e ripiega in 2D
(function boot(){
  if (FORCE==='2d'){ startCanvas2D(); return; }
  if (FORCE==='webgl'){ try{ startWebGL(); }catch(e){ console.warn(e); startCanvas2D(); } return; }
  try{ startWebGL(); }catch(e){ console.warn('WebGL → Canvas2D', e); startCanvas2D(); }
})();
