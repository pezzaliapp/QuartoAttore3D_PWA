import * as THREE from 'https://unpkg.com/three@0.162.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.162.0/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.162.0/examples/jsm/loaders/GLTFLoader.js';

const canvas = document.getElementById('scene');
const btnInstall = document.getElementById('btnInstall');
const btnMute = document.getElementById('btnMute');

let audioCtx, windSource, muted = true, deferredPrompt;

window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault(); deferredPrompt = e; btnInstall.style.display='inline-flex';
});
btnInstall.addEventListener('click', async ()=>{
  if(!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  btnInstall.style.display='none';
});

btnMute.addEventListener('click', ()=>{
  muted = !muted;
  btnMute.textContent = muted ? 'Mute' : 'Sound ON';
  if (windSource) windSource.gain.gain.value = muted ? 0.0 : 0.25;
});

// Renderer
const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio||1));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = false;

// Scene & Camera
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0b1022, 30, 150);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 400);
camera.position.set(0, 2.2, 6);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.minDistance = 2;
controls.maxDistance = 12;
controls.maxPolarAngle = Math.PI*0.55;

// Lights
const hemi = new THREE.HemisphereLight(0xffe9c4, 0x0b1022, 0.7);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xfff3d2, 1.0);
dir.position.set(4,6,2);
scene.add(dir);

// Sky gradient
const skyGeo = new THREE.SphereGeometry(200,32,16);
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  uniforms:{ top:{value:new THREE.Color('#172042')}, bottom:{value:new THREE.Color('#0b1022')} },
  vertexShader:`varying vec3 vPos; void main(){ vPos=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader:`varying vec3 vPos; uniform vec3 top; uniform vec3 bottom;
    void main(){ float h=normalize(vPos).y*0.5+0.5; gl_FragColor=vec4(mix(bottom,top, pow(h,1.2)),1.0); }`
});
const sky = new THREE.Mesh(skyGeo, skyMat);
scene.add(sky);

// Dunes (vertex-displaced plane + standard shading)
const duneRes = 256;
const duneGeo = new THREE.PlaneGeometry(200, 200, duneRes, duneRes);
duneGeo.rotateX(-Math.PI/2);
const duneMat = new THREE.ShaderMaterial({
  lights: true,
  fog: true,
  uniforms: THREE.UniformsUtils.merge([THREE.ShaderLib.standard.uniforms, {
    uTime:{value:0},
    uAmp:{value:0.6},
    uWind:{value:new THREE.Vector2(0.4, 0.2)},
    uColorA:{value:new THREE.Color(0xEBC88C)},
    uColorB:{value:new THREE.Color(0xAE8C55)}
  }]),
  vertexShader:`
    #define STANDARD
    varying vec3 vViewPosition;
    #include <common>
    #include <uv_pars_vertex>
    #include <displacementmap_pars_vertex>
    #include <color_pars_vertex>
    #include <fog_pars_vertex>
    #include <morphtarget_pars_vertex>
    #include <skinning_pars_vertex>
    #include <logdepthbuf_pars_vertex>
    #include <clipping_planes_pars_vertex>

    uniform float uTime;
    uniform float uAmp;
    uniform vec2 uWind;

    // Simplex noise 2D (fast, compact)
    vec3 mod289(vec3 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec2 mod289(vec2 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec3 permute(vec3 x){ return mod289(((x*34.0)+1.0)*x); }
    float snoise(vec2 v){
      const vec4 C = vec4(0.211324865405187,0.366025403784439,
                          -0.577350269189626,0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy) );
      vec2 x0 = v -   i + dot(i, C.xx);
      vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod289(i);
      vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
          + i.x + vec3(0.0, i1.x, 1.0 ));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m ; m = m*m ;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
      vec3 g;
      g.x  = a0.x  * x0.x  + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    #include <lights_pars_begin>

    void main(){
      #include <uv_vertex>
      #include <color_vertex>
      #include <morphcolor_vertex>
      #include <beginnormal_vertex>
        // approximate normal via gradient of noise
        vec3 pos = position;
        float n = snoise(pos.xz*0.08 + uWind*0.03*uTime) + 0.5*snoise(pos.xz*0.2 + uWind*0.06*uTime);
        pos.y += n*uAmp;
      #include <defaultnormal_vertex>
      #include <begin_vertex>
        transformed = pos;
      #include <displacementmap_vertex>
      #include <morphtarget_vertex>
      #include <skinning_vertex>
      #include <project_vertex>
      #include <logdepthbuf_vertex>
      #include <clipping_planes_vertex>
      vViewPosition = - mvPosition.xyz;
      #include <worldpos_vertex>
      #include <fog_vertex>
    }
  `,
  fragmentShader:`
    #define STANDARD
    uniform vec3 diffuse;
    uniform float opacity;
    varying vec3 vViewPosition;
    #include <common>
    #include <packing>
    #include <dithering_pars_fragment>
    #include <color_pars_fragment>
    #include <uv_pars_fragment>
    #include <map_pars_fragment>
    #include <alphamap_pars_fragment>
    #include <aomap_pars_fragment>
    #include <lightmap_pars_fragment>
    #include <emissivemap_pars_fragment>
    #include <bsdfs>
    #include <cube_uv_reflection_fragment>
    #include <envmap_common_pars_fragment>
    #include <envmap_physical_pars_fragment>
    #include <fog_pars_fragment>
    #include <lights_pars_begin>
    #include <lights_physical_pars_fragment>
    #include <shadowmap_pars_fragment>
    #include <bumpmap_pars_fragment>
    #include <normalmap_pars_fragment>
    #include <clearcoat_pars_fragment>
    #include <roughnessmap_pars_fragment>
    #include <metalnessmap_pars_fragment>
    #include <logdepthbuf_pars_fragment>
    #include <clipping_planes_pars_fragment>

    uniform vec3 uColorA;
    uniform vec3 uColorB;

    void main(){
      #include <clipping_planes_fragment>
      vec4 diffuseColor = vec4(mix(uColorB, uColorA, 0.6), 1.0);
      ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
      vec3 totalEmissiveRadiance = vec3(0.0);
      #include <logdepthbuf_fragment>
      #include <lights_physical_fragment>
      #include <lights_fragment_begin>
      #include <lights_fragment_end>
      vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
      gl_FragColor = vec4( outgoingLight * diffuseColor.rgb, 1.0 );
      #include <tonemapping_fragment>
      #include <encodings_fragment>
      #include <fog_fragment>
      #include <premultiplied_alpha_fragment>
      #include <dithering_fragment>
    }
  `
});
const dunes = new THREE.Mesh(duneGeo, duneMat);
dunes.receiveShadow = false;
scene.add(dunes);

// Traveler (capsule)
const travelerGeo = new THREE.CapsuleGeometry(0.18, 0.5, 8, 16);
const travelerMat = new THREE.MeshStandardMaterial({ color:0xf6edd7, emissive:0x111111, roughness:0.4, metalness:0.0 });
const traveler = new THREE.Mesh(travelerGeo, travelerMat);
traveler.position.set(0, 0.8, 0);
scene.add(traveler);

// Subtle glow (billboard)
const glowMat = new THREE.SpriteMaterial({ color:0xffe9c4, opacity:0.25, transparent:true });
const glow = new THREE.Sprite(glowMat);
glow.scale.set(1.6,1.6,1.6);
traveler.add(glow);

// Wind particles
const P = 1500;
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
const pMat = new THREE.PointsMaterial({ size:0.06, sizeAttenuation:true, color:0xffffff, transparent:true, opacity:0.35 });
const wind = new THREE.Points(pGeo, pMat);
scene.add(wind);

// Optional: load external GLB (put your file path below or drop via input later)
const loader = new GLTFLoader();
// Example usage (commented):
// loader.load('./assets/your_model.glb', (g)=>{ g.scene.position.set(0,0.1,-1.2); g.scene.scale.set(0.5,0.5,0.5); scene.add(g.scene); });

// Touch to float forward
let glide = 0.0;
let lastTap = 0;
function onTap(){
  const now = performance.now();
  if(now - lastTap < 300) { glide = Math.min(1.0, glide+0.3); } else { glide = Math.min(1.0, glide+0.15); }
  lastTap = now;
}
window.addEventListener('pointerdown', onTap, {passive:true});

// Basic ambient wind noise (WebAudio)
function initAudio(){
  if (audioCtx) return;
  audioCtx = new (window.AudioContext||window.webkitAudioContext)();
  const bufferSize = 2**12;
  const noise = audioCtx.createScriptProcessor(bufferSize, 1, 1);
  noise.onaudioprocess = (e)=>{
    const out = e.outputBuffer.getChannelData(0);
    for(let i=0;i<out.length;i++){
      out[i] = (Math.random()*2-1)*0.12; // white noise
    }
  };
  const biquad = audioCtx.createBiquadFilter(); // shape
  biquad.type = 'bandpass'; biquad.frequency.value = 600; biquad.Q.value = 0.6;
  const gain = audioCtx.createGain(); gain.gain.value = muted ? 0.0 : 0.25;
  noise.connect(biquad).connect(gain).connect(audioCtx.destination);
  windSource = { noise, gain };
}
document.addEventListener('touchstart', ()=>{ initAudio(); }, {passive:true});

// Resize
function onResize(){
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);

// Animate
let t = 0;
function tick(){
  requestAnimationFrame(tick);
  t += 0.016;
  dunes.material.uniforms.uTime.value = t;

  // traveler gentle bob + glide
  traveler.position.y = 0.8 + Math.sin(t*1.8)*0.06;
  const dir = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  if (glide > 0.0005){
    const step = 0.035 * glide;
    traveler.position.addScaledVector(dir, step);
    camera.position.addScaledVector(dir, step);
    controls.target.lerp(traveler.position, 0.04);
    glide *= 0.985;
  } else {
    controls.target.lerp(traveler.position, 0.06);
  }

  // wind drift
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
}
tick();
