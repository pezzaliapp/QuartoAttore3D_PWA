// Quarto Attore 3D — Desert Journey (PWA) — app.js v1.0.3
// Robusto + fallback automatico + guard ovunque

// ─── Imports CDN (puoi rimuovere ?v=103 se non ti serve cache-busting) ───
import * as THREE from 'https://unpkg.com/three@0.162.0/build/three.module.js?v=103';
import { OrbitControls } from 'https://unpkg.com/three@0.162.0/examples/jsm/controls/OrbitControls.js?v=103';
import { GLTFLoader } from 'https://unpkg.com/three@0.162.0/examples/jsm/loaders/GLTFLoader.js?v=103';

// ─── UI refs ───
const canvas = document.getElementById('scene');
const btnInstall = document.getElementById('btnInstall');
const btnMute = document.getElementById('btnMute');

// ─── Helpers ───
function showError(msg){
  try{
    const el = document.createElement('div');
    el.style.position='fixed'; el.style.left='8px'; el.style.bottom='8px';
    el.style.padding='8px 10px'; el.style.borderRadius='8px';
    el.style.background='#330000cc'; el.style.color='#fff'; el.style.font='12px system-ui';
    el.style.zIndex='100000'; el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 6000);
  }catch(_){}
}

// ─── Install prompt ───
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault(); deferredPrompt = e; if (btnInstall) btnInstall.style.display='inline-flex';
});
if (btnInstall) btnInstall.addEventListener('click', async ()=>{
  try{
    if(!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    btnInstall.style.display='none';
  }catch(err){ console.warn(err); }
});

// ─── Audio (vento) ───
let audioCtx, windSource, muted = true;
if (btnMute) btnMute.addEventListener('click', ()=>{
  muted = !muted;
  btnMute.textContent = muted ? 'Mute' : 'Sound ON';
  if (windSource) windSource.gain.gain.value = muted ? 0.0 : 0.25;
});
function initAudio(){
  try{
    if (audioCtx) return;
    audioCtx = new (window.AudioContext||window.webkitAudioContext)();
    const bufferSize = 2**12;
    const noise = audioCtx.createScriptProcessor(bufferSize, 1, 1);
    noise.onaudioprocess = (e)=>{
      const out = e.outputBuffer.getChannelData(0);
      for(let i=0;i<out.length;i++){ out[i] = (Math.random()*2-1)*0.12; }
    };
    const biquad = audioCtx.createBiquadFilter(); biquad.type='bandpass'; biquad.frequency.value=600; biquad.Q.value=0.6;
    const gain = audioCtx.createGain(); gain.gain.value = muted ? 0.0 : 0.25;
    noise.connect(biquad).connect(gain).connect(audioCtx.destination);
    windSource = { noise, gain };
  }catch(err){ console.warn('Audio init error:', err); }
}
document.addEventListener('touchstart', ()=>{ initAudio(); }, {passive:true});

// ─── Renderer ───
const DPR = Math.min(2, window.devicePixelRatio||1);
const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:false, powerPreference:'high-performance'});
renderer.setClearColor(0x0b1022, 1);
renderer.setPixelRatio(DPR);
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.addEventListener('webglcontextlost', (e)=>{ e.preventDefault(); showError('WebGL context lost. Ricarico…'); location.reload(); }, false);

// ─── Scene & Camera ───
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0b1022, 40, 180);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 400);
camera.position.set(0, 2.4, 7);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.minDistance = 2;
controls.maxDistance = 14;
controls.maxPolarAngle = Math.PI*0.55;

// ─── Luci ───
scene.add(new THREE.HemisphereLight(0xffe9c4, 0x0b1022, 0.6));
const dir = new THREE.DirectionalLight(0xfff3d2, 0.9);
dir.position.set(4,6,2);
scene.add(dir);

// ─── Cielo ───
{
  const skyGeo = new THREE.SphereGeometry(200,32,16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms:{ top:{value:new THREE.Color('#172042')}, bottom:{value:new THREE.Color('#0b1022')} },
    vertexShader:`varying vec3 vPos; void main(){ vPos=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader:`varying vec3 vPos; uniform vec3 top; uniform vec3 bottom;
      void main(){ float h=normalize(vPos).y*0.5+0.5; gl_FragColor=vec4(mix(bottom,top, pow(h,1.2)),1.0); }`
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));
}

// ─── Dune ───
const duneRes = 200;
const duneGeo = new THREE.PlaneGeometry(200, 200, duneRes, duneRes);
duneGeo.rotateX(-Math.PI/2);
const QS = new URLSearchParams(location.search);
const USE_BASIC = QS.get('basic')==='1';

let dunes = null; 
let duneMat = null;
try {
  if (USE_BASIC) throw new Error('basic-mode');

  duneMat = new THREE.ShaderMaterial({
    fog:true,
    uniforms:{
      uTime:{value:0},
      uAmp:{value:0.7},
      uWind:{value:new THREE.Vector2(0.35, 0.18)},
      uColorA:{value:new THREE.Color(0xEBC88C)},
      uColorB:{value:new THREE.Color(0xAE8C55)},
      uDir:{value:new THREE.Vector3(0.5,0.8,0.2).normalize()},
      uFogColor:{value:new THREE.Color(0x0b1022)},
      uFogNear:{value:40.0},
      uFogFar:{value:180.0}
    },
    vertexShader:`
      precision mediump float;
      uniform float uTime; uniform float uAmp; uniform vec2 uWind;
      varying vec3 vNormalW; varying vec3 vPosW;
      // simplex 2D
      vec3 mod289(vec3 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec2 mod289(vec2 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec3 permute(vec3 x){ return mod289(((x*34.0)+1.0)*x); }
      float snoise(vec2 v){
        const vec4 C = vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
        vec2 i = floor(v + dot(v, C.yy)); vec2 x0 = v - i + dot(i, C.xx);
        vec2 i1 = (x0.x > x0.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);
        vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1; i = mod289(i);
        vec3 p = permute( permute( i.y + vec3(0.0,i1.y,1.0)) + i.x + vec3(0.0,i1.x,1.0) );
        vec3 m = max(0.5-vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m*m; m = m*m;
        vec3 x = 2.0*fract(p*0.0243902439)-1.0; vec3 h = abs(x)-0.5;
        vec3 ox = floor(x+0.5); vec3 a0 = x-ox;
        m *= 1.79284291400159 - 0.85373472095314*(a0*a0+h*h);
        vec3 g; g.x = a0.x*x0.x + h.x*x0.y; g.yz = a0.yz*x12.xz + h.yz*x12.yw;
        return 130.0*dot(m,g);
      }
      void main(){
        vec3 pos = position;
        float f1 = snoise(pos.xz*0.08 + uWind*0.03*uTime);
        float f2 = snoise(pos.xz*0.20 + uWind*0.06*uTime)*0.5;
        float n = f1 + f2;
        pos.y += n*uAmp;

        // normal via differenze centrali
        float e = 0.6;
        float nx = (snoise((pos.xz+vec2(e,0.0))*0.08 + uWind*0.03*uTime) + 0.5*snoise((pos.xz+vec2(e,0.0))*0.20 + uWind*0.06*uTime)
                  -snoise((pos.xz-vec2(e,0.0))*0.08 + uWind*0.03*uTime) - 0.5*snoise((pos.xz-vec2(e,0.0))*0.20 + uWind*0.06*uTime))*uAmp/e;
        float nz = (snoise((pos.xz+vec2(0.0,e))*0.08 + uWind*0.03*uTime) + 0.5*snoise((pos.xz+vec2(0.0,e))*0.20 + uWind*0.06*uTime)
                  -snoise((pos.xz-vec2(0.0,e))*0.08 + uWind*0.03*uTime) - 0.5*snoise((pos.xz-vec2(0.0,e))*0.20 + uWind*0.06*uTime))*uAmp/e;
        vec3 nrm = normalize(vec3(-nx, 1.0, -nz));

        vec4 wp = modelMatrix * vec4(pos,1.0);
        vPosW = wp.xyz;
        vNormalW = normalize(normalMatrix * nrm);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader:`
      precision mediump float;
      uniform vec3 uColorA; uniform vec3 uColorB;
      uniform vec3 uDir;
      uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar;
      varying vec3 vNormalW; varying vec3 vPosW;
      void main(){
        vec3 base = mix(uColorB, uColorA, 0.6);
        float lambert = max(dot(normalize(vNormalW), normalize(uDir)), 0.0);
        float light = 0.35 + 0.75*lambert;
        vec3 col = base * light;
        // fog semplice
        float d = length(vPosW - cameraPosition);
        float f = smoothstep(uFogNear, uFogFar, d);
        col = mix(col, uFogColor, f);
        gl_FragColor = vec4(col, 1.0);
      }
    `
  });

  dunes = new THREE.Mesh(duneGeo, duneMat);
  scene.add(dunes);

} catch(e){
  console.warn('Dune shader fallback:', e.message);
  showError('Shader dune non disponibile — fallback attivo');
  duneGeo.computeVertexNormals();
  const basicMat = new THREE.MeshStandardMaterial({ color:0xC9A873, roughness:0.95, metalness:0.0 });
  dunes = new THREE.Mesh(duneGeo, basicMat);
  scene.add(dunes);
}

// ─── Viaggiatore ───
const travelerGeo = new THREE.CapsuleGeometry(0.18, 0.5, 8, 16);
const travelerMat = new THREE.MeshStandardMaterial({ color:0xf6edd7, emissive:0x111111, roughness:0.4, metalness:0.0 });
const traveler = new THREE.Mesh(travelerGeo, travelerMat);
traveler.position.set(0, 0.8, 0);
scene.add(traveler);
const glow = new THREE.Sprite(new THREE.SpriteMaterial({ color:0xffe9c4, opacity:0.25, transparent:true }));
glow.scale.set(1.6,1.6,1.6);
traveler.add(glow);

// ─── Particelle vento ───
const P = 1200;
const pGeo = new THREE.BufferGeometry();
const pos = new Float32Array(P*3);
const vel = new Float32Array(P);
for (let i=0;i<P;i++){
  pos[3*i+0] = (Math.random()-0.5)*80;
  pos[3*i+1] = Math.random()*2.5 + 0.2;
  pos[3*i+2] = (Math.random()-0.5)*80;
  vel[i] = 0.2 + Math.random()*0.6;
}
pGeo.setAttribute('position', new THREE.BufferAttribute(pos,3));
pGeo.setAttribute('vel', new THREE.BufferAttribute(vel,1));
const wind = new THREE.Points(pGeo, new THREE.PointsMaterial({ size:0.06, sizeAttenuation:true, transparent:true, opacity:0.35 }));
scene.add(wind);

// ─── Loader GLB (opzionale) ───
const loader = new GLTFLoader();
// Esempio:
// loader.load('./assets/your_model.glb', (g)=>{ g.scene.position.set(0,0.1,-1.2); g.scene.scale.set(0.5,0.5,0.5); scene.add(g.scene); });

// ─── Input: tap per avanzare ───
let glide = 0.0, lastTap = 0;
function onTap(){
  const now = performance.now();
  glide = Math.min(1.0, glide + (now - lastTap < 300 ? 0.30 : 0.15));
  lastTap = now;
}
window.addEventListener('pointerdown', onTap, {passive:true});

// ─── Resize ───
function onResize(){
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);

// ─── Animazione con guard globali ───
let t = 0, reported = false;
function tick(){
  try{
    requestAnimationFrame(tick);
    t += 0.016;

    // aggiorna shader se presente
    if (dunes && dunes.material && dunes.material.uniforms && dunes.material.uniforms.uTime){
      dunes.material.uniforms.uTime.value = t;
    }

    // bob + glide
    traveler.position.y = 0.8 + Math.sin(t*1.8)*0.06;
    const dirV = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
    if (glide > 0.0005){
      const step = 0.035 * glide;
      traveler.position.addScaledVector(dirV, step);
      camera.position.addScaledVector(dirV, step);
      controls.target.lerp(traveler.position, 0.04);
      glide *= 0.985;
    } else {
      controls.target.lerp(traveler.position, 0.06);
    }

    // vento
    const positions = wind.geometry.attributes.position.array;
    const vels = wind.geometry.attributes.vel.array;
    for(let i=0;i<P;i++){
      positions[3*i+0] += 0.02 + 0.04*vels[i];
      positions[3*i+2] += 0.03*vels[i];
      if (positions[3*i+0] > 40) positions[3*i+0] = -40;
      if (positions[3*i+2] > 40) positions[3*i+2] = -40;
    }
    wind.geometry.attributes.position.needsUpdate = true;

    controls.update();
    renderer.render(scene, camera);

  }catch(err){
    if(!reported){ showError('Errore runtime: ' + err.message); reported = true; }
    console.error(err);
  }
}
tick();

// ─── Debug URL flags ───
// ?sw=off  → evita il SW per vedere subito i file aggiornati
// ?basic=1 → forza il fallback CPU (senza shader)
