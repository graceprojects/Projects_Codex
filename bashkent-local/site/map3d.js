// HAVEN — 3D location map.
// Loads the scene exported from Blender (assets/map): city.glb + complex.glb (Draco), trees.bin,
// scene.json (points of interest, street labels, materials) and the project textures (tex/*.webp).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const host = document.getElementById('map3d');
const BASE = host ? host.dataset.base || 'assets/map/' : '';
const DRACO = 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/';
const VER = '55';                                                   // bump after re-exporting assets/map
const TOUCH = matchMedia('(pointer: coarse)').matches;                       // touch: map is activated by a button
const MOBILE = TOUCH || Math.min(innerWidth, screen.width) < 640;           // lighter quality
const FULL = !!(host && host.dataset.full === '1');                           // dedicated page: the map owns the whole screen
const NORTH = 7.2 * Math.PI / 180;                       // true north is 7.2° left of the model +Y axis

// fog also fades the edge of the 2 km model into the haze (distance from the site centre)
THREE.ShaderChunk.fog_pars_vertex = '#ifdef USE_FOG\n varying float vFogDepth; varying vec2 vFogXZ;\n#endif';
THREE.ShaderChunk.fog_vertex = `#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  vec4 fogW = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    fogW = instanceMatrix * fogW;
  #endif
  vFogXZ = (modelMatrix * fogW).xz;
#endif`;
THREE.ShaderChunk.fog_pars_fragment = `#ifdef USE_FOG
  uniform vec3 fogColor; varying float vFogDepth; varying vec2 vFogXZ;
  uniform vec3 uFogAway; uniform vec2 uFogSunXZ; uniform float uFogDirK;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear; uniform float fogFar;
  #endif
#endif`;
const FOG_LINEAR = `#ifdef USE_FOG
  float fogH = length(vFogXZ - cameraPosition.xz);
  #ifdef FOG_EXP2
    float fogFactor = 1.0 - exp(- fogDensity * fogDensity * fogH * fogH);
  #else
    float fogFactor = smoothstep(fogNear, fogFar, fogH);
  #endif
  fogFactor = max(fogFactor, smoothstep(1600.0, 2150.0, length(vFogXZ)));
  vec3 fogC = fogColor;
  if (uFogDirK > 0.0) { vec2 fvd = normalize(vFogXZ - cameraPosition.xz + 1e-4); fogC = mix(uFogAway, fogColor, pow(max(dot(fvd, uFogSunXZ), 0.0), 1.5)); }
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogC, fogFactor);
#endif`;
THREE.ShaderChunk.tonemapping_fragment = FOG_LINEAR + '\n' + THREE.ShaderChunk.tonemapping_fragment;
THREE.ShaderChunk.fog_fragment = '';

// clouds: one density field used for the sky and for the moving cloud shadows on the city
const CLOUD_FN = `
float cn_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float cn_n(vec2 p) { vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(cn_h(i), cn_h(i + vec2(1.0, 0.0)), u.x), mix(cn_h(i + vec2(0.0, 1.0)), cn_h(i + vec2(1.0, 1.0)), u.x), u.y); }
const float CLOUD_H = 1300.0;
float cloudDensity(vec2 xz, float t, float cover) {
  vec2 p = xz * 0.0019 + vec2(t * 0.015, t * 0.006);
  float f = 0.5 * cn_n(p) + 0.25 * cn_n(p * 2.03 + 7.1) + 0.125 * cn_n(p * 4.01 + 3.3) + 0.0625 * cn_n(p * 8.05 + 1.7);
  return smoothstep(cover, cover + 0.085, f);
}`;
THREE.ShaderChunk.lights_pars_begin = 'uniform float uCloudT, uCloudK, uCloudCover, uSnow, uSnowK, uWet, uWetK; uniform vec2 uCloudSun;\n' + CLOUD_FN + '\n' + THREE.ShaderChunk.lights_pars_begin;
THREE.ShaderChunk.lights_physical_fragment = `#ifdef USE_FOG
  if (uSnow * uSnowK > 0.0) {
    vec3 snN = inverseTransformDirection(normal, viewMatrix);
    float snUp = smoothstep(0.5, 0.85, snN.y);
    float snP = 0.62 * cn_n(vFogXZ * 0.07) + 0.38 * cn_n(vFogXZ * 0.9 + 3.1);
    float sn = uSnow * uSnowK * snUp * mix(0.5, 1.0, smoothstep(0.3, 0.62, snP));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.92, 0.96), sn);
    roughnessFactor = mix(roughnessFactor, 0.82, sn); metalnessFactor = mix(metalnessFactor, 0.0, sn);
  }
#endif
` + THREE.ShaderChunk.lights_physical_fragment + `
#ifdef USE_FOG
  if (uWet * uWetK > 0.0) {
    vec3 wtN = inverseTransformDirection(normal, viewMatrix);
    float wet = uWet * uWetK * smoothstep(0.35, 0.85, wtN.y);
    float pud = wet * smoothstep(0.54, 0.7, 0.7 * cn_n(vFogXZ * 0.11) + 0.3 * cn_n(vFogXZ * 0.63 + 5.3));
    material.diffuseColor *= mix(1.0, 0.5, wet);
    material.roughness = mix(material.roughness, 0.2, wet * 0.8);
    material.roughness = mix(material.roughness, 0.04, pud);
    material.specularColor = mix(material.specularColor, vec3(0.3), wet * 0.35 + pud * 0.5);
  }
#endif
`;
THREE.ShaderChunk.lights_fragment_begin = THREE.ShaderChunk.lights_fragment_begin.replace('getDirectionalLightInfo( directionalLight, directLight );',
  `getDirectionalLightInfo( directionalLight, directLight );
  #ifdef USE_FOG
    if (uCloudK > 0.0) directLight.color *= 1.0 - uCloudK * cloudDensity(vFogXZ + uCloudSun * CLOUD_H, uCloudT, uCloudCover);
  #endif`);

// Blender scene coords (x, y, z-up) -> three.js (x, z, -y)
const V = (x, y, z = 0) => new THREE.Vector3(x, z, -y);

if (host && new URLSearchParams(location.search).has('m3now')) init().catch(fail);   // testing: start immediately
else if (host) {
  const io = new IntersectionObserver(es => {
    if (es.some(e => e.isIntersecting)) { io.disconnect(); init().catch(fail); }
  }, { rootMargin: '700px 0px' });
  io.observe(host);
}

function fail(err) {
  console.error(err);
  const l = host.querySelector('.m3-loading');
  if (l) l.innerHTML = '<p>Не удалось загрузить 3D-карту. Обновите страницу.</p>';
}

// ------------------------------------------------------------------ shader helpers
const shared = { uFlash: { value: 0 }, uFlashDir: { value: new THREE.Vector3(0, 1, 0) }, uWet: { value: 0 }, uRainW: { value: 0 }, uSnow: { value: 0 }, uSeason: { value: 0 }, uLeafAmt: { value: 1 }, uGrassTint: { value: new THREE.Vector3(1, 1, 1) }, uFogAway: { value: new THREE.Color() }, uFogSunXZ: { value: new THREE.Vector2(1, 0) }, uFogDirK: { value: 0 }, uCloudK: { value: 0 }, uCloudCover: { value: .5 }, uCloudSun: { value: new THREE.Vector2() }, uCloudCol: { value: new THREE.Color(1, 1, 1) },
  uNight: { value: 0 }, uTime: { value: 0 }, uSkyZ: { value: new THREE.Color() }, uSkyH: { value: new THREE.Color() },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(1, 1, 1) } };
const WORLD_V = ['#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWN;'];
const WORLD_V2 = ['#include <project_vertex>', `#include <project_vertex>
  vec4 wp4 = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    wp4 = instanceMatrix * wp4;
  #endif
  vWPos = (modelMatrix * wp4).xyz;
  vec3 wn3 = mat3(modelMatrix) * objectNormal;
  vWN = dot(wn3, wn3) > 1e-8 ? normalize(wn3) : vec3(0.0);`];

function patch(material, key, uniforms, fragHead, fragMap, extra = {}) {
  material.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader.replace(...WORLD_V).replace(...WORLD_V2);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWN;\n' + fragHead)
      .replace('#include <map_fragment>', fragMap);
    for (const [from, to] of Object.entries(extra)) sh.fragmentShader = sh.fragmentShader.replace(from, to);
  };
  material.customProgramCacheKey = () => key;
  return material;
}

function withClouds(m) {
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    Object.assign(sh.uniforms, { uCloudT: shared.uTime, uCloudK: shared.uCloudK, uCloudCover: shared.uCloudCover, uCloudSun: shared.uCloudSun,
      uFogAway: shared.uFogAway, uFogSunXZ: shared.uFogSunXZ, uFogDirK: shared.uFogDirK, uSnow: shared.uSnow, uSnowK: { value: m.userData.snowK ?? 0 },
      uWet: shared.uWet, uWetK: { value: m.userData.wetK ?? 0 } });
    if (prev) prev.call(m, sh, r);
  };
  return m;
}

function pools_glow_tex() {
  if (pools_glow_tex.t) return pools_glow_tex.t;
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.3, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return (pools_glow_tex.t = t);
}

// world-space texture (box projection, one sample): horizontal faces use xz, walls the dominant axis
const BOX_UV = `
  vec3 fN = normalize(cross(dFdx(vWPos), dFdy(vWPos)));
  vec3 aN = length(vWN) > 0.5 ? abs(vWN) : abs(fN);
  vec2 boxUV = aN.y > 0.7 ? vWPos.xz : (aN.x > aN.z ? vWPos.zy : vWPos.xy);`;

async function init() {
  host.classList.add('m3-booting');
  const ui = buildUI();
  const setP = (p, txt) => ui.progress(p, txt);
  setP(.03, 'Загрузка сцены');

  const renderer = new THREE.WebGLRenderer({ antialias: !MOBILE, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, MOBILE ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = !MOBILE;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.querySelector('.m3-stage').appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 5, 9000);
  const pmrem = new THREE.PMREMGenerator(renderer);

  // ---------------------------------------------------------------- load everything in parallel
  const draco = new DRACOLoader().setDecoderPath(DRACO);
  const gltf = new GLTFLoader().setDRACOLoader(draco);
  let done = 0; const total = 9 + 19;
  const tick = () => setP(.05 + .85 * (++done / total), 'Загрузка сцены');
  const texLoader = new THREE.TextureLoader();
  const TEXN = ['asphalt', 'bark', 'brick', 'bronze', 'ganch', 'granite', 'grass', 'ground_dirt', 'leaves', 'mosaic', 'panel_concrete', 'paving', 'plaster', 'roof_bitumen', 'roof_metal', 'led_ad', 'appliance_ad', 'shoe_ad', 'mountains'];
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const loadTex = n => texLoader.loadAsync(BASE + 'tex/' + n + '.webp?v=' + VER).then(t => {
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, maxAniso);
    if (!/_ad$|mountains/.test(n)) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    tick(); return [n, t];
  });
  const [meta, city, complex, treesBuf, texList, landmarks, lightsBuf, trafficBuf, pedsBuf] = await Promise.all([
    fetch(BASE + 'scene.json?v=' + VER).then(r => r.json()).then(j => (tick(), j)),
    gltf.loadAsync(BASE + 'city.glb?v=' + VER).then(g => (tick(), g)),
    gltf.loadAsync(BASE + 'complex.glb?v=' + VER).then(g => (tick(), g)),
    fetch(BASE + 'trees.bin?v=' + VER).then(r => r.arrayBuffer()).then(b => (tick(), b)),
    Promise.all(TEXN.map(loadTex)),
    gltf.loadAsync(BASE + 'landmarks.glb?v=' + VER).then(g => (tick(), g)),
    fetch(BASE + 'lights.bin?v=' + VER).then(r => r.arrayBuffer()).then(b => (tick(), b)),
    fetch(BASE + 'traffic.bin?v=' + VER).then(r => r.arrayBuffer()).then(b => (tick(), b)),
    fetch(BASE + 'peds.bin?v=' + VER).then(r => r.arrayBuffer()).then(b => (tick(), b)),
  ]);
  const TEX = Object.fromEntries(texList);
  const MEAN = meta.texMean;
  const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); white.needsUpdate = true;
  const inv = n => { const m = MEAN[n] || [1, 1, 1]; return new THREE.Vector3(1 / m[0], 1 / m[1], 1 / m[2]); };
  setP(.92, 'Сборка города');

  // ---------------------------------------------------------------- materials
  const cache = {}, glassMats = [];
  const col = c => new THREE.Color().setRGB(c[0], c[1], c[2], THREE.LinearSRGBColorSpace);

  function worldTexMat(d, name, flat) {
    const tn = d.tex[0], tile = (d.tile || [3])[0];
    const m = new THREE.MeshStandardMaterial({ roughness: d.r ?? .85, metalness: d.m ?? 0, flatShading: flat });
    const leaves = tn === 'leaves', iv = inv(tn), tint = d.c;
    if (leaves) m.color = col(tint);
    else if (name === 'Env_Dome') m.color.setScalar(1);
    else m.color = col([tint[0] * iv.x, tint[1] * iv.y, tint[2] * iv.z]);
    offset(m, name, flat);
    return patch(m, leaves ? 'wtex-leaf' : tn === 'grass' ? 'wtex-grass' : 'wtex', { tTex: { value: TEX[tn] }, uTile: { value: tile }, uInv: { value: iv }, uGrassTint: shared.uGrassTint },
      'uniform sampler2D tTex; uniform float uTile; uniform vec3 uInv, uGrassTint;',
      BOX_UV + (leaves
        ? `vec4 tx = texture2D(tTex, boxUV / uTile); diffuseColor.rgb *= mix(vec3(.62), tx.rgb * uInv, tx.a);`
        : tn === 'grass' ? `diffuseColor.rgb *= texture2D(tTex, boxUV / uTile).rgb * uGrassTint;`
        : `diffuseColor.rgb *= texture2D(tTex, boxUV / uTile).rgb;`));
  }

  function buildingMat() {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .86, metalness: 0, flatShading: true });
    const U = { tPl: { value: TEX.plaster }, tPa: { value: TEX.panel_concrete }, tBr: { value: TEX.brick }, tMe: { value: TEX.roof_metal },
      tBi: { value: TEX.roof_bitumen }, tGa: { value: TEX.ganch }, mPl: { value: inv('plaster') }, mPa: { value: inv('panel_concrete') },
      mBr: { value: inv('brick') }, mMe: { value: inv('roof_metal') }, mBi: { value: inv('roof_bitumen') }, mGa: { value: inv('ganch') }, uNight: shared.uNight };
    return patch(m, 'bld', U,
      `uniform sampler2D tPl, tPa, tBr, tMe, tBi, tGa; uniform vec3 mPl, mPa, mBr, mMe, mBi, mGa; uniform float uNight;
       float gWin = 0.0, gLit = 0.0;
       vec3 tg(sampler2D t, vec2 uv, float s, vec2 dx, vec2 dy) { return textureGrad(t, uv / s, dx / s, dy / s).rgb; }`,
      BOX_UV + `
      float code = floor(vColor.a * 63.0 + 0.5); float tm = floor(code / 8.0 + 0.01); float win = mod(code, 8.0) / 10.0;
      bool roof = abs(fN.y) > 0.5;
      vec2 uv = roof ? vWPos.xz : boxUV; vec2 ddx = dFdx(uv), ddy = dFdy(uv);
      vec3 t;
      if (roof) t = abs(fN.y) < 0.985 ? tg(tMe, uv, 1.2, ddx, ddy) * mMe : tg(tBi, uv, 4.0, ddx, ddy) * mBi;
      else if (tm < 0.5) t = tg(tPl, uv, 4.0, ddx, ddy) * mPl;
      else if (tm < 1.5 || (tm > 2.5 && tm < 3.5)) t = tg(tPa, uv, 9.6, ddx, ddy) * mPa;
      else if (tm < 2.5) t = tg(tBr, uv, 1.8, ddx, ddy) * mBr;
      else if (tm < 4.5) t = tg(tMe, uv, 1.2, ddx, ddy) * mMe;
      else t = tg(tGa, uv, 2.5, ddx, ddy) * mGa;
      vec3 base = t * vColor.rgb * 1.25;
      vec2 tan2 = normalize(vec2(-fN.z, fN.x) + 1e-5);
      float u = dot(vWPos.xz, tan2) / 3.3, v = vWPos.y / 3.1;
      gWin = (!roof && win > 0.02) ? step(abs(fract(u) - 0.5), win * 0.5) * step(abs(fract(v) - 0.55), 0.18 + 0.2 * win) : 0.0;
      float rnd = fract(sin(dot(floor(vec2(u, v)), vec2(12.9898, 78.233))) * 43758.5453);
      gLit = gWin * step(mix(0.9, 0.52, uNight), rnd);
      diffuseColor.rgb = mix(base, mix(vec3(0.03, 0.045, 0.06), vec3(0.07, 0.085, 0.1), rnd), gWin);`,
      { '#include <color_fragment>': '', '#include <roughnessmap_fragment>': 'float roughnessFactor = mix(roughness, 0.1, gWin);',
        '#include <normal_fragment_maps>': `#include <normal_fragment_maps>
          if (gWin > 0.5) { vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz); normal = normalize(normal + upV * (rnd - 0.5) * 0.1); }`,
        '#include <emissivemap_fragment>': 'totalEmissiveRadiance += vec3(1.0, 0.62, 0.32) * gLit * (0.15 + 2.2 * uNight);' });
  }

  function facadeMat(d) {
    const f = d.fac, ta = d.tex ? d.tex[0] : null, tb = d.tex ? (d.tex[1] || d.tex[0]) : null;
    const m = new THREE.MeshStandardMaterial({ roughness: .8, metalness: 0 });
    const U = { cA: { value: col(f.A) }, cB: { value: col(f.B) }, cG: { value: col(f.G) }, tA: { value: ta ? TEX[ta] : white }, tB: { value: tb ? TEX[tb] : white },
      mA: { value: ta ? inv(ta) : new THREE.Vector3(1, 1, 1) }, mB: { value: tb ? inv(tb) : new THREE.Vector3(1, 1, 1) },
      sA: { value: d.tile ? d.tile[0] : 3 }, sB: { value: d.tile ? (d.tile[1] || d.tile[0]) : 3 }, ud: { value: f.ud }, vd: { value: f.vd },
      wr: { value: new THREE.Vector4(f.wu[0], f.wu[1], f.wv[0], f.wv[1]) }, fr: { value: new THREE.Vector4(f.fu[0], f.fu[1], f.fv[0], f.fv[1]) },
      litT: { value: f.lit }, uNight: shared.uNight, gm: { value: f.glassFam ? 1 : 0 } };
    return patch(m, 'fac', U,
      `uniform vec3 cA, cB, cG, mA, mB; uniform sampler2D tA, tB; uniform float sA, sB, ud, vd, litT, uNight, gm; uniform vec4 wr, fr;
       float gWin = 0.0, gLit = 0.0;`,
      BOX_UV + `
      float along = abs(vWN.x) > 0.5 ? vWPos.z : vWPos.x;
      float u = along / ud, v = vWPos.y / vd; vec2 f = fract(vec2(u, v));
      float win = step(wr.x, f.x) * step(f.x, wr.y) * step(wr.z, f.y) * step(f.y, wr.w);
      float frm = step(fr.x, f.x) * step(f.x, fr.y) * step(fr.z, f.y) * step(f.y, fr.w);
      if (abs(vWN.y) > 0.7) { win = 0.0; frm = 0.0; }
      vec3 a = texture2D(tA, boxUV / sA).rgb * mA * cA, b = texture2D(tB, boxUV / sB).rgb * mB * cB;
      float rnd = fract(sin(floor(u) * 12.9898 + floor(v) * 7.31 * 78.233) * 43758.5453);
      gWin = win; gLit = win * step(mix(litT, min(litT, 0.55), uNight), rnd);
      diffuseColor.rgb = mix(mix(a, b, frm), cG, win);`,
      { '#include <normal_fragment_maps>': `#include <normal_fragment_maps>
          if (gWin > 0.5) { vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz); vec3 sdV = normalize(cross(upV, normal) + 1e-5);
            normal = normalize(normal + upV * (rnd - 0.5) * 0.09 + sdV * (fract(rnd * 7.31) - 0.5) * 0.06); }`,
        '#include <roughnessmap_fragment>': 'float roughnessFactor = mix(0.8, 0.05 + 0.05 * fract(rnd * 3.7), gWin);',
        '#include <metalnessmap_fragment>': 'float metalnessFactor = mix(0.0, 0.35 + 0.4 * gm, gWin);',
        '#include <emissivemap_fragment>': 'totalEmissiveRadiance += vec3(1.0, 0.53, 0.173) * gLit * (0.12 + 1.6 * uNight);' });
  }

  // each flat ground layer gets its own depth offset (water above lawns, paths above water, roads above paths)
  const LAYERS = [[/Env_Ground/, 3], [/Hard|Gravel|Sand|Campus|Parking/, -1], [/^Grass$|Env_Grass|Park/, -2], [/Wood|Flower|Pitch|Track/, -3],
    [/Water|Pool/, -4], [/Sidewalk|Paving|Dirt|Granite/, -5], [/Asphalt|Rail/, -6], [/Marking/, -7]];
  function offset(m, name, flat) {
    if (!flat) return;
    const hit = LAYERS.find(([re]) => re.test(name));
    if (hit) { const k = hit[1]; m.polygonOffset = true; m.polygonOffsetFactor = k; m.polygonOffsetUnits = k * 6; }
  }

  // blue/white diagonal lattice of the TV tower shaft and pods (angle around the tower axis)
  function latticeMat() {
    const ax = meta.tvAxis;
    const m = new THREE.MeshStandardMaterial({ roughness: .3, metalness: .3 });
    return patch(m, 'lattice', { uAxis: { value: new THREE.Vector2(ax[0], -ax[1]) }, uNight: shared.uNight },
      'uniform vec2 uAxis; uniform float uNight; float gW = 0.0;',
      `vec2 rel = vWPos.xz - uAxis; float ang = atan(rel.y, rel.x);
       float u = ang * 30.0 / 6.2831853, v = vWPos.y / 2.6;
       float bar = max(step(fract(u + v), 0.16), step(fract(u - v), 0.16));
       gW = max(bar, step(fract(vWPos.y / 13.0), 0.05));
       diffuseColor.rgb = mix(vec3(0.05, 0.16, 0.34), vec3(0.82, 0.84, 0.86), gW);`,
      { '#include <roughnessmap_fragment>': 'float roughnessFactor = mix(0.2, 0.55, gW);',
        '#include <emissivemap_fragment>': 'totalEmissiveRadiance += vec3(0.05, 0.28, 0.95) * (1.0 - gW) * uNight * 1.4 + vec3(0.9, 0.95, 1.0) * gW * uNight * 0.25;' });
  }

  // openwork bands of the TV tower capsules: white frame with dark-blue diamond windows
  function bandMat() {
    const ax = meta.tvAxis;
    const m = new THREE.MeshStandardMaterial({ roughness: .4, metalness: .1 });
    return patch(m, 'tvband', { uAxis: { value: new THREE.Vector2(ax[0], -ax[1]) }, uNight: shared.uNight },
      'uniform vec2 uAxis; uniform float uNight; float gW = 0.0;',
      `vec2 rel = vWPos.xz - uAxis; float ang = atan(rel.y, rel.x);
       float u = ang * 36.0 / 6.2831853, v = vWPos.y / 3.4;
       gW = step(abs(fract(u) - 0.5) + abs(fract(v) - 0.5), 0.6);
       diffuseColor.rgb = mix(vec3(0.78, 0.8, 0.83), vec3(0.05, 0.08, 0.15), gW);`,
      { '#include <roughnessmap_fragment>': 'float roughnessFactor = mix(0.4, 0.1, gW);',
        '#include <metalnessmap_fragment>': 'float metalnessFactor = mix(0.0, 0.4, gW);',
        '#include <emissivemap_fragment>': 'totalEmissiveRadiance += vec3(1.0, 0.72, 0.42) * gW * uNight * 1.6;' });
  }

  // realistic water: animated multi-directional ripples, Fresnel sky reflection, sun glints, lit + shadowed body colour
  function waterMat(name, flat) {
    const pool = /Pool/.test(name), flowing = name === 'Env_WaterFlow';
    const m = new THREE.MeshStandardMaterial({ roughness: .9, metalness: 0, flatShading: flat, vertexColors: flowing });
    m.envMapIntensity = 0;
    if (flowing) m.defines = { WATER_FLOW: '' };
    offset(m, name, flat);
    const U = { uTime: shared.uTime, uSkyZ: shared.uSkyZ, uSkyH: shared.uSkyH, uSunDir: shared.uSunDir, uSunCol: shared.uSunCol, uNight: shared.uNight,
      uRain: shared.uRainW, uAmp: { value: pool ? .45 : 1.0 }, uScale: { value: pool ? 2.6 : 1.0 },
      uDeep: { value: pool ? new THREE.Color().setRGB(.02, .26, .36, THREE.LinearSRGBColorSpace) : new THREE.Color().setRGB(.015, .058, .07, THREE.LinearSRGBColorSpace) } };
    return patch(m, pool ? 'water-pool' : flowing ? 'water-flow' : 'water', U, `
      uniform float uTime, uAmp, uScale, uNight, uRain; uniform vec3 uSkyZ, uSkyH, uSunDir, uSunCol, uDeep;
      vec2 rainRings(vec2 p, float t) {
        vec2 g = vec2(0.0);
        for (int k = 0; k < 3; k++) {
          vec2 q = p * (0.5 + 0.23 * float(k)) + float(k) * 17.3;
          vec2 id = floor(q); vec2 f = fract(q) - 0.5;
          float h = fract(sin(dot(id, vec2(12.9898, 78.233))) * 43758.5453);
          float ph = fract(t * 0.8 + h);
          vec2 c = f - (vec2(fract(h * 7.1), fract(h * 3.7)) - 0.5) * 0.5;
          float r = length(c), rr = ph * 0.5;
          float ring = sin((r - rr) * 70.0) * (1.0 - smoothstep(0.0, 0.05, abs(r - rr))) * (1.0 - ph);
          g += c / max(r, 1e-3) * ring;
        }
        return g * 0.5;
      }
      float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
        return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), u.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), u.x), u.y); }
      // sum of 11 gravity waves (golden-angle directions, deep-water dispersion), anti-aliased by the pixel footprint pw
      vec2 wgrad(vec2 p, float t, float pw) {
        vec2 g = vec2(0.0); float a = 0.085, k = 0.42;
        for (int i = 0; i < 11; i++) {
          float an = float(i) * 2.39996 + 0.7; vec2 d = vec2(cos(an), sin(an));
          float ph = dot(p, d) * k + t * sqrt(9.81 * k) * 0.9 + float(i) * 1.7;
          g += a * k * cos(ph) * d * (1.0 - smoothstep(0.3, 1.0, k * pw));
          a *= 0.66; k *= 1.52;
        }
        return g;
      }
      float wnoise(vec2 p) { return fract(sin(dot(floor(p), vec2(127.1, 311.7))) * 43758.5453); }`,
      `diffuseColor.rgb = uDeep * (0.85 + 0.3 * wnoise(vWPos.xz * 0.004)) * (0.9 + 0.24 * vnoise(vWPos.xz * 0.03 + uTime * vec2(0.12, 0.07)));`,
      { '#include <color_fragment>': '',
        '#include <normal_fragment_maps>': `#include <normal_fragment_maps>
          float wDist = length(cameraPosition - vWPos);
          float wFade = uAmp * (1.0 - smoothstep(220.0, 1700.0, wDist));
          vec2 wp0 = vWPos.xz * uScale;
          vec2 wp = wp0 + 6.0 * (vec2(vnoise(wp0 * .015 + uTime * .05), vnoise(wp0 * .015 + 31.7 - uTime * .04)) - 0.5);
          float wind = 0.35 + 1.3 * vnoise(wp0 * .008 + vec2(uTime * .045, uTime * .02));
          float pw = length(fwidth(wp0)) + 1e-4;
          #ifdef WATER_FLOW
            vec2 fdir = vColor.rg * 2.0 - 1.0; fdir = vec2(fdir.x, -fdir.y) * vColor.b;   // blender xy -> three xz
            float cyc = uTime * 0.09, p0 = fract(cyc), p1 = fract(cyc + 0.5), wb = abs(1.0 - 2.0 * p0);
            vec2 gA = wgrad(wp - fdir * p0 * 14.0, uTime * 0.6, pw), gB = wgrad(wp - fdir * p1 * 14.0, uTime * 0.6, pw);
            vec2 wg = mix(gA, gB, wb) * wFade * (0.8 + 0.4 * wind);
          #else
            vec2 wg = wgrad(wp, uTime, pw) * wFade * wind;
          #endif
          if (uRain > 0.0) wg += uRain * rainRings(vWPos.xz, uTime) * (1.0 - smoothstep(60.0, 650.0, wDist));
          vec3 Nw = normalize(vec3(-wg.x, 1.0, -wg.y));
          normal = normalize((viewMatrix * vec4(Nw, 0.0)).xyz);`,
        '#include <opaque_fragment>': `
          vec3 Vw = normalize(cameraPosition - vWPos);
          float cosT = clamp(dot(Nw, Vw), 0.0, 1.0);
          float F = 0.06 + 0.94 * pow(1.0 - cosT, 5.0);
          vec3 Rw = reflect(-Vw, Nw); Rw.y = abs(Rw.y);
          vec3 sky = mix(uSkyH, uSkyZ, smoothstep(0.0, 0.4, Rw.y));
          float sd = max(dot(Rw, uSunDir), 0.0);
          vec3 glint = uSunCol * (pow(sd, 480.0) * 7.0 + pow(sd, 42.0) * 0.16);
          vec3 body = mix(outgoingLight, dot(outgoingLight, vec3(.3, .59, .11)) * vec3(.5, .72, 1.05), .7 * uNight);
          outgoingLight = body * (1.0 - F) + sky * F * 0.95 + glint;
          #include <opaque_fragment>` });
  }

  function uvTexMat(t, emissive = 1.3) {
    return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: new THREE.Color(1, 1, 1).multiplyScalar(emissive), roughness: .35 });
  }

  function material(name, flat) {
    const key = name + (flat ? ':f' : '');
    if (cache[key]) return cache[key];
    const d = meta.materials[name] || { c: [.7, .7, .7], r: .8, m: 0 };
    let m;
    if (name === 'Env_Building') m = buildingMat();
    else if (/Water|Pool/.test(name)) m = waterMat(name, flat);
    else if (name === 'LM_TV_Lattice') m = latticeMat();
    else if (name === 'LM_TV_Band') m = bandMat();
    else if (d.fac) m = facadeMat(d);
    else if (name.startsWith('Env_Ad_')) m = uvTexMat(TEX[name.slice(7)], 1.1);
    else if (name === 'Media_Screen') m = uvTexMat(TEX.led_ad, 1.4);
    else if (d.tex && TEX[d.tex[0]]) m = worldTexMat(d, name, flat);
    else {
      m = new THREE.MeshStandardMaterial({ color: col(d.c), roughness: d.r ?? .8, metalness: d.m ?? 0, flatShading: flat });
      if (d.e) m.emissive = col(d.e);
      if (/Glass/.test(name)) m.envMapIntensity = .9;
      offset(m, name, flat);
    }
    m.name = name;
    m.userData.wetK = /Water|Pool|Glass|Screen|Ad_|Sphere|Crystal|Railing/.test(name) ? 0 : /Asphalt|Marking|Parking|Rail|Paving|Sidewalk|Granite|Track|Hard|Campus/.test(name) ? 1
      : /Grass|Lawn|Park|Wood|Flower|Pitch/.test(name) ? .3 : /Dirt|Sand|Gravel|Ground/.test(name) ? .55 : .7;
    m.userData.snowK = /Water|Pool|Glass|Screen|Ad_|Sphere|Crystal|Railing|Dome_Glass/.test(name) ? 0 : /Asphalt|Marking|Parking|Rail/.test(name) ? .1
      : /Paving|Sidewalk|Granite|Dirt|Track|Umbrella/.test(name) ? .55 : 1;
    if (!/Water|Pool|Glass|Sphere|Crystal/.test(name) && !(d.fac && d.fac.glassFam)) m.envMapIntensity = .35;   // deeper shadows: less sky fill
    if (/Glass|Crystal/.test(name) || (d.fac && d.fac.glassFam)) { glassMats.push(m); m.envMapIntensity = 1.3; }
    return (cache[key] = withClouds(m));
  }

  // ---------------------------------------------------------------- city: merge meshes per material
  city.scene.updateMatrixWorld(true);
  const groups = new Map();
  city.scene.traverse(o => {
    if (!o.isMesh) return;
    const name = o.material.name;
    const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
    for (const k of Object.keys(g.attributes)) if (!['position', 'color', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);
    const key = name + '|' + Object.keys(g.attributes).sort().join(',');
    if (!groups.has(key)) groups.set(key, { name, list: [] });
    groups.get(key).list.push(g);
  });
  const cityGroup = new THREE.Group(); scene.add(cityGroup);
  for (const { name, list } of groups.values()) {
    const geo = list.length > 1 ? mergeGeometries(list, false) : list[0];
    const mesh = new THREE.Mesh(geo, material(name, true));
    mesh.receiveShadow = true;
    mesh.castShadow = /Building|Tower|Ad_|Dome/.test(name);
    if (/Marking/.test(name)) mesh.renderOrder = 1;
    cityGroup.add(mesh);
  }

  // ---------------------------------------------------------------- complex
  complex.scene.traverse(o => {
    if (!o.isMesh) return;
    o.material = material(o.material.name, false);
    o.castShadow = o.receiveShadow = true;
  });
  scene.add(complex.scene);

  // ---------------------------------------------------------------- detailed landmarks (TV tower, Minor mosque, NBU)
  landmarks.scene.traverse(o => {
    if (!o.isMesh) return;
    o.material = material(o.material.name, false);
    o.material.side = THREE.DoubleSide;                      // thin ornamental slabs / facets
    o.castShadow = o.receiveShadow = true;
  });
  scene.add(landmarks.scene);

  // ---------------------------------------------------------------- trees (instanced, same prototypes as in Blender)

  // crown made of leaf cards (the project leaf texture, alpha-cut), with volumetric crown normals
  function cardCanopy(blobs, perBlob, seed, far) {
    const P = [], N = [], UV = [], R = [];
    let sd = seed; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (const [cx, cy, cz, rx, ry, rz] of blobs) {
      const C = new THREE.Vector3(cx, cz, -cy);
      const cnt = Math.max(3, Math.round(perBlob * (rx + rz) / 7));
      for (let k = 0; k < cnt; k++) {
        const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, rr = .35 + .55 * Math.sqrt(rnd());
        const d = new THREE.Vector3(Math.sqrt(1 - u * u) * Math.cos(th), u * .9, Math.sqrt(1 - u * u) * Math.sin(th));
        const c = new THREE.Vector3(C.x + d.x * rx * rr, C.y + d.y * rz * rr, C.z + d.z * ry * rr);
        const nc = d.clone().add(new THREE.Vector3(rnd() - .5, rnd() - .5, rnd() - .5).multiplyScalar(1.4)).normalize();
        const tu = new THREE.Vector3(0, 1, 0).cross(nc); if (tu.lengthSq() < 1e-4) tu.set(1, 0, 0); tu.normalize();
        const tv = nc.clone().cross(tu).normalize();
        const hs = Math.min(rx, rz) * (far ? 1.25 : 1.05) * (.8 + .4 * rnd());
        const rot = rnd() * Math.PI * 2, cr = Math.cos(rot), sr = Math.sin(rot);
        const cs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
        const q = cs.map(([a, b]) => c.clone().addScaledVector(tu, a * hs).addScaledVector(tv, b * hs));
        const uv = cs.map(([a, b]) => [.5 + .5 * (a * cr - b * sr), .5 + .5 * (a * sr + b * cr)]);
        const cardR = rnd();
        for (const i of [0, 1, 2, 0, 2, 3]) {
          R.push(cardR);
          P.push(q[i].x, q[i].y, q[i].z);
          const nn = q[i].clone().sub(C).normalize().lerp(nc, .25).normalize(); N.push(nn.x, nn.y, nn.z);
          UV.push(uv[i][0], uv[i][1]);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
    g.setAttribute('aRnd', new THREE.Float32BufferAttribute(R, 1));
    return g;
  }
  const TREE_SPEC = [
    { th: 4.2, tr: .28, b: [[0, 0, 7.4, 4.3, 4.3, 3.4], [1.6, .8, 9.2, 2.8, 2.8, 2.4], [-1.4, -1, 8.6, 2.6, 2.6, 2.2]], bf: [[0, 0, 7.8, 4.6, 4.6, 3.8]] },
    { th: 2.2, tr: .2, b: [[0, 0, 4.1, 2.9, 2.9, 2.2], [.8, -.5, 5.2, 1.9, 1.9, 1.6]], bf: [[0, 0, 4.3, 3, 3, 2.4]] },
    { th: 2.0, tr: .22, b: [[0, 0, 5.6, 1.6, 1.6, 3.0], [0, 0, 9.2, 1.7, 1.7, 3.4], [0, 0, 13.4, 1.3, 1.3, 2.8]], bf: [[0, 0, 9.5, 1.8, 1.8, 7.0]] },
  ];
  function trunkGeo(kind, far) {
    const sp = TREE_SPEC[kind], g = new THREE.CylinderGeometry(sp.tr * .6, sp.tr, sp.th + 1.5, far ? 4 : 6, 1, true);
    g.translate(0, (sp.th + 1.5) / 2, 0); g.deleteAttribute('uv'); return g;
  }
  function canopyGeo(kind, far) { const sp = TREE_SPEC[kind]; return cardCanopy(far ? sp.bf : sp.b, far ? 3.2 : 7, 4321 + kind * 97, far); }
  const leafMat = new THREE.MeshStandardMaterial({ map: TEX.leaves, side: THREE.DoubleSide, roughness: .78, metalness: 0 });
  leafMat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { uTime: shared.uTime, uSeason: shared.uSeason, uLeafAmt: shared.uLeafAmt });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; attribute float aRnd; varying float vRnd, vTree;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = instanceMatrix[3].xyz;
        #else
          vec3 ip = vec3(0.0);
        #endif
        vTree = fract(sin(dot(ip.xz, vec2(12.9898, 78.233))) * 43758.5453);
        vRnd = fract(aRnd + vTree * 3.71);
        float sway = max(0.0, position.y - 2.5) * 0.04, ph = uTime * 1.35 + ip.x * 0.071 + ip.z * 0.053;
        transformed.x += sin(ph) * sway; transformed.z += cos(ph * 0.83) * sway * 0.8;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uSeason, uLeafAmt; varying float vRnd, vTree;')
      .replace('#include <map_fragment>', `
        if (vRnd > uLeafAmt) discard;
        vec2 cuv = vMapUv; vec2 cq = cuv - 0.5;
        vec4 tx = texture2D(map, cuv * 1.6 + 0.2);
        if (tx.a < 0.45 || length(cq) > 0.43 + 0.07 * sin(atan(cq.y, cq.x) * 7.0 + cuv.x * 3.0)) discard;
        float lumL = dot(tx.rgb, vec3(0.3, 0.59, 0.11)) / 0.12;
        vec3 lc = tx.rgb;
        if (uSeason > 0.5 && uSeason < 1.5) {                       // spring: fresh green + white / pink blossom
          lc = lumL * vec3(0.17, 0.31, 0.055);
          if (vTree < 0.13) lc = lumL * vec3(0.8, 0.77, 0.74);
          else if (vTree < 0.25) lc = lumL * vec3(0.82, 0.46, 0.58);
        } else if (uSeason > 1.5 && uSeason < 2.5) {                // autumn: yellow, orange, red, olive
          lc = vTree < 0.34 ? lumL * vec3(0.62, 0.44, 0.05) : vTree < 0.58 ? lumL * vec3(0.64, 0.27, 0.05)
             : vTree < 0.7 ? lumL * vec3(0.46, 0.11, 0.04) : lumL * vec3(0.3, 0.32, 0.07);
          lc *= 0.85 + 0.3 * fract(vRnd * 7.13);
        } else if (uSeason > 2.5) {                                 // winter: sparse bare twigs
          lc = lumL * vec3(0.13, 0.11, 0.095);
        }
        diffuseColor.rgb *= lc;`)
      .replace('normal *= faceDirection;', '');
  };
  leafMat.customProgramCacheKey = () => 'leafcard';
  leafMat.envMapIntensity = .35; leafMat.userData.snowK = .9;
  withClouds(leafMat);
  const leafDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: TEX.leaves, side: THREE.DoubleSide });
  leafDepth.onBeforeCompile = sh => {
    sh.uniforms.uLeafAmt = shared.uLeafAmt;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aRnd; varying float vRnd;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = instanceMatrix[3].xyz;
        #else
          vec3 ip = vec3(0.0);
        #endif
        vRnd = fract(aRnd + fract(sin(dot(ip.xz, vec2(12.9898, 78.233))) * 43758.5453) * 3.71);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uLeafAmt; varying float vRnd;')
      .replace('#include <map_fragment>', `
      if (vRnd > uLeafAmt) discard;
      vec2 cq = vMapUv - 0.5; vec4 tx = texture2D(map, vMapUv * 1.6 + 0.2);
      if (tx.a < 0.45 || length(cq) > 0.44) discard;`);
  };
  leafDepth.customProgramCacheKey = () => 'leafdepth';
  const bark = withClouds(new THREE.MeshStandardMaterial({ color: col([.13, .1, .075]), roughness: .9 }));  // no snow on trunks
  function buildTrees(buf, extra) {
    const dv = new DataView(buf); const n = dv.getUint32(4, true);
    const xs = new Int16Array(buf, 8, n), ys = new Int16Array(buf, 8 + 2 * n, n);
    const ks = new Uint8Array(buf, 8 + 4 * n, n), ss = new Uint8Array(buf, 8 + 5 * n, n), rs = new Uint8Array(buf, 8 + 6 * n, n);
    const NEAR = 650, MAXR = MOBILE ? 1250 : 2000;
    const all = [];
    for (let i = 0; i < n; i++) all.push([xs[i] / 10, ys[i] / 10, ks[i], ss[i] / 100, rs[i] / 255 * Math.PI * 2, i]);
    for (const t of extra) all.push(t);
    const buckets = Array.from({ length: 6 }, () => []);
    for (const t of all) {
      const r = Math.hypot(t[0], t[1]), i = t[5];
      if (r > MAXR || (r > 1300 && (i & 1)) || (MOBILE && r > NEAR && (i % 3 === 0))) continue;
      buckets[t[2] + (r > NEAR ? 3 : 0)].push(t);
    }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), c = new THREE.Color();
    buckets.forEach((list, k) => {
      if (!list.length) return;
      const far = k >= 3, kind = k % 3;
      const trunks = new THREE.InstancedMesh(trunkGeo(kind, far), bark, list.length);
      const crowns = new THREE.InstancedMesh(canopyGeo(kind, far), leafMat, list.length);
      list.forEach(([x, y, , s, rot, i], j) => {
        e.set(0, rot, 0); q.setFromEuler(e); sc.set(s, s, s); m4.compose(V(x, y, 0), q, sc);
        trunks.setMatrixAt(j, m4); crowns.setMatrixAt(j, m4);
        const t1 = ((i * 2654435761) >>> 0) / 4294967296, t2 = ((i * 40503) % 997) / 997;
        crowns.setColorAt(j, c.setRGB(.8 + .3 * t1, .9 + .18 * t2, .7 + .25 * t1 * t2, THREE.LinearSRGBColorSpace));
      });
      crowns.customDepthMaterial = leafDepth;
      trunks.castShadow = crowns.castShadow = !far; trunks.receiveShadow = crowns.receiveShadow = !far;
      trunks.frustumCulled = crowns.frustumCulled = false;
      scene.add(trunks, crowns);
    });
  }
  const extraTrees = [];
  complex.scene.traverse(o => { if (o.isMesh && /^Trees_(Crowns|Trunks)/.test(o.name)) o.visible = false; });
  (meta.ctrees || []).forEach(([x, y, h], k) => extraTrees.push([x, y, h > 9 ? 0 : 1, Math.max(.7, Math.min(1.4, h / (h > 9 ? 11 : 6.2))), (k * 2.39996) % 6.283, 900000 + k]));
  buildTrees(treesBuf, extraTrees);

  // ---------------------------------------------------------------- mountains on the NE horizon
  let mountainsMat = null, mountainsMesh = null;
  {
    const mt = meta.mountains, t = TEX.mountains; t.wrapS = THREE.MirroredRepeatWrapping; t.repeat.set(4, 1);
    const a0 = (mt.a0 * Math.PI / 180) - NORTH, a1 = (mt.a1 * Math.PI / 180) - NORTH, R = mt.r;
    const g = new THREE.CylinderGeometry(R, R, 1100, 48, 1, true, 0, a1 - a0);
    const mat = new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: .42, fog: false, depthWrite: false, side: THREE.BackSide, color: 0xf2f5f8 });
    mountainsMat = mat;
    const m = new THREE.Mesh(g, mat);
    m.position.y = 330; m.rotation.y = Math.PI - a1; m.renderOrder = -1; mountainsMesh = m;
    mat.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\n  diffuseColor.a *= smoothstep(0.255, 0.33, vMapUv.y);'); };
    mat.customProgramCacheKey = () => 'mountains';
    scene.add(m);
  }

  // ---------------------------------------------------------------- sky, sun, moon and time of day (real solar position, Tashkent)
  const hemi = new THREE.HemisphereLight(0xffffff, 0x8a7d6a, 1.0); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2.6); scene.add(sun, sun.target);
  sun.castShadow = !MOBILE;
  Object.assign(sun.shadow.camera, { left: -620, right: 620, top: 620, bottom: -620, near: 10, far: 4000 });
  sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -.0004; sun.shadow.normalBias = 1.2;
  sun.userData.dir = new THREE.Vector3(0, 1, 0);
  const skyU = { uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSunDir: shared.uSunDir, uSunCol: shared.uSunCol, uStars: { value: 0 },
    uTime: shared.uTime, uCloudCover: shared.uCloudCover, uCloudCol: shared.uCloudCol, uAway: shared.uFogAway, uSunXZ: shared.uFogSunXZ,
    uFlash: shared.uFlash, uFlashDir: shared.uFlashDir };
  const skyMat = new THREE.ShaderMaterial({ uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDir;
      void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w * 0.99999; }`,
    fragmentShader: `uniform vec3 uZen, uHor, uSunDir, uSunCol, uCloudCol, uAway, uFlashDir; uniform vec2 uSunXZ; uniform float uStars, uTime, uCloudCover, uFlash; varying vec3 vDir;
      ${CLOUD_FN}
      float h31(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      void main() {
        vec3 d = normalize(vDir); float up = max(d.y, 0.0);
        vec3 hor = mix(uAway, uHor, pow(max(dot(normalize(d.xz + 1e-5), uSunXZ), 0.0), 1.5));
        vec3 col = mix(hor, uZen, 1.0 - exp(-up * 8.0));
        float sd = max(dot(d, normalize(uSunDir)), 0.0), vis = smoothstep(-0.1, 0.02, uSunDir.y);
        col += uSunCol * vis * (pow(sd, 2400.0) * 30.0 + pow(sd, 48.0) * 0.4 + pow(sd, 5.0) * 0.14 * (1.0 - up));
        float den = 0.0;
        if (d.y > 0.004) {
          float tt = (CLOUD_H + 60.0 - cameraPosition.y) / d.y; vec2 cp = cameraPosition.xz + d.xz * tt;
          den = cameraPosition.y < CLOUD_H ? cloudDensity(cp, uTime, uCloudCover) * smoothstep(0.0, 0.03, d.y) * (1.0 - smoothstep(12000.0, 35000.0, tt)) * smoothstep(5200.0, 6800.0, length(d.xz * tt)) : 0.0;
          vec3 cc = uCloudCol * mix(1.18, 0.6, den) + uSunCol * pow(max(dot(d, normalize(uSunDir)), 0.0), 7.0) * 0.45 * (1.0 - den) * vis;
          cc = mix(cc, uHor, smoothstep(6000.0, 50000.0, tt) * 0.55);
          col = mix(col, cc, den * 0.95);
        }
        if (uFlash > 0.0 && d.y > -0.05) {
          col += uFlash * vec3(0.55, 0.62, 0.95) * (0.2 + 0.8 * pow(max(dot(d, uFlashDir), 0.0), 5.0)) * (0.5 + den);
        }
        if (uStars > 0.001 && d.y > 0.03) { float r = h31(floor(d * 300.0)); col += step(0.9962, r) * uStars * (1.0 - den) * (0.3 + 0.7 * fract(r * 91.7)) * vec3(0.85, 0.9, 1.0); }
        if (d.y < 0.0) col = hor;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });
  const cloudLayers = [];
  {
    const NL = MOBILE ? 1 : 3;
    for (let L = 0; L < NL; L++) {
      const mat = new THREE.ShaderMaterial({
        uniforms: { uFlash: shared.uFlash, uTime: shared.uTime, uCover: shared.uCloudCover, uCol: shared.uCloudCol, uSunDir: shared.uSunDir, uSunCol: shared.uSunCol, uHor: skyU.uHor,
          uLayer: { value: NL === 1 ? 1 : L } },
        transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
        vertexShader: `varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: `uniform float uTime, uCover, uLayer, uFlash; uniform vec3 uCol, uSunDir, uSunCol, uHor; varying vec3 vW;
          ${CLOUD_FN}
          void main() {
            float dist = length(cameraPosition - vW), hd = length(cameraPosition.xz - vW.xz);
            float fade = smoothstep(60.0, 420.0, dist) * (1.0 - smoothstep(5200.0, 6800.0, hd));
            if (fade < 0.01) discard;
            float den = cloudDensity(vW.xz, uTime, uCover);
            float core = smoothstep(uLayer * 0.22, uLayer * 0.22 + 0.3, den);
            if (core < 0.01) discard;
            vec2 sd = uSunDir.xz / max(length(uSunDir.xz), 0.001);
            float toward = cloudDensity(vW.xz + sd * 70.0, uTime, uCover);
            float lit = clamp(1.05 - (toward - den) * 1.8, 0.45, 1.2) * mix(0.72, 1.06, uLayer * 0.5);
            vec3 col = uCol * lit + uSunCol * 0.1 * lit;
            col = mix(col, uHor, smoothstep(1800.0, 7000.0, dist) * 0.55) + uFlash * vec3(0.6, 0.66, 1.0) * core;
            gl_FragColor = vec4(col, core * 0.7 * fade);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }` });
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(14000, 14000), mat);
      pl.rotation.x = -Math.PI / 2; pl.userData.h = 1300 + (NL === 1 ? 60 : L * 60); pl.position.y = pl.userData.h;
      pl.renderOrder = 3; pl.frustumCulled = false; scene.add(pl); cloudLayers.push(pl);
    }
  }
  const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(8000, 48, 24), skyMat);
  skyMesh.renderOrder = -2; skyMesh.frustumCulled = false; scene.add(skyMesh);
  const envScene = new THREE.Scene(); envScene.add(new THREE.Mesh(skyMesh.geometry, skyMat));
  let envRT = null;
  function rebuildEnv() {
    const rt = pmrem.fromScene(envScene, 0, 1, 20000);
    scene.environment = rt.texture; if (envRT) envRT.dispose(); envRT = rt;
  }
  // solar position (degrees) for a UTC date
  function solar(date, lat, lon) {
    const rad = Math.PI / 180, n = date.getTime() / 86400000 + 2440587.5 - 2451545.0;
    const L = (280.46 + .9856474 * n) % 360, g = ((357.528 + .9856003 * n) % 360) * rad;
    const lam = (L + 1.915 * Math.sin(g) + .02 * Math.sin(2 * g)) * rad, eps = (23.439 - 4e-7 * n) * rad;
    const ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)), dec = Math.asin(Math.sin(eps) * Math.sin(lam));
    const lst = (((18.697374558 + 24.06570982441908 * n) % 24) * 15 + lon) * rad, ha = lst - ra, la = lat * rad;
    const alt = Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(ha));
    const az = Math.atan2(-Math.sin(ha), Math.tan(dec) * Math.cos(la) - Math.sin(la) * Math.cos(ha));
    return { alt: alt / rad, az: ((az / rad) + 360) % 360 };
  }
  const LAT = meta.site.lat, LON = meta.site.lon;
  const tashkentNow = () => { const d = new Date(); return (d.getUTCHours() + 5 + d.getUTCMinutes() / 60) % 24; };
  let simDay = (() => { const d = new Date(); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); })();
  const dateAt = h => new Date(simDay + (h - 5) * 3600000);
  // seasons of Tashkent: representative day, clouds, snow, foliage, grass, sky saturation, haze
  const SEASONS = {
    winter: { md: [0, 20], cover: .43, snow: 1, mode: 3, leaf: .26, grass: [1.05, .98, .72], sat: .72, haze: .78 },
    spring: { md: [3, 10], cover: .49, snow: 0, mode: 1, leaf: .93, grass: [1.06, 1.16, .86], sat: .95, haze: .95 },
    summer: { md: [6, 15], cover: .58, snow: 0, mode: 0, leaf: 1, grass: [1, 1, 1], sat: 1, haze: 1 },
    autumn: { md: [9, 28], cover: .53, snow: 0, mode: 2, leaf: .86, grass: [1.3, 1.06, .56], sat: .92, haze: .9 },
  };
  const seasonOf = m => m <= 1 || m === 11 ? 'winter' : m <= 4 ? 'spring' : m <= 8 ? 'summer' : 'autumn';
  let season = 'summer', precipOn = true;
  const precipType = () => !precipOn ? 0 : season === 'winter' ? 1 : season === 'autumn' ? 2 : 0;
  // sky colour keys by sun elevation: [elev, zenith, horizon] (linear rgb)
  const SKYK = [[-18, [0.004, 0.006, 0.014], [0.0111, 0.0137, 0.0249]], [-9, [0.013, 0.0192, 0.0496], [0.0332, 0.0367, 0.0656]], [-3, [0.0351, 0.0603, 0.1495], [0.425, 0.1513, 0.1007]], [1, [0.0964, 0.1814, 0.466], [1.6259, 0.2645, 0.0935]], [8, [0.0883, 0.2367, 0.7361], [1.7636, 0.5402, 0.2286]], [22, [0.0563, 0.2291, 0.8904], [0.4062, 0.7446, 1.4867]], [60, [0.0452, 0.1952, 0.7675], [0.3274, 0.6459, 1.4786]]];   // solved through ACES for target display colours
  function ramp(e, idx) {
    if (e <= SKYK[0][0]) return SKYK[0][idx].slice();
    for (let i = 1; i < SKYK.length; i++) if (e <= SKYK[i][0]) {
      const a = SKYK[i - 1], b = SKYK[i], t = (e - a[0]) / (b[0] - a[0]); return a[idx].map((v, k) => v + (b[idx][k] - v) * t);
    }
    return SKYK[SKYK.length - 1][idx].slice();
  }
  const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const lin = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace);
  let hour = 13, lastEnvHour = -99, baseExposure = 1, needCapture = true;
  function dirFrom(azDeg, altDeg) {
    const az = azDeg * Math.PI / 180 - NORTH, el = altDeg * Math.PI / 180;
    return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
  }
  function setTime(h, force) {
    hour = ((h % 24) + 24) % 24;
    const { alt: e, az } = solar(dateAt(hour), LAT, LON);
    const PT = precipType(), P = PT ? 1 : 0, RAIN = PT === 2;
    const SS = SEASONS[season], SAT = SS.sat * (P ? .4 : 1), desat = c => { const l = c[0] * .3 + c[1] * .59 + c[2] * .11; return c.map(v => l + (v - l) * SAT); };
    const zen = desat(ramp(e, 1)), hor = desat(ramp(e, 2));
    skyU.uZen.value.setRGB(...zen, THREE.LinearSRGBColorSpace); skyU.uHor.value.setRGB(...hor, THREE.LinearSRGBColorSpace);
    shared.uSkyZ.value.copy(skyU.uZen.value); shared.uSkyH.value.copy(skyU.uHor.value);
    const day = sstep(-1, 12, e), night = 1 - sstep(-7, 3, e);
    const warm = sstep(28, 2, e);
    const sunC = lin(1, .97 - .5 * warm, .92 - .72 * warm);
    const sunDir = dirFrom(az, Math.max(e, -2));
    shared.uSunDir.value.copy(sunDir); shared.uSunCol.value.copy(sunC).multiplyScalar(day * 1.1);
    if (e > -1) { sun.userData.dir = sunDir; sun.color.copy(sunC); sun.intensity = 4.1 * day * (P ? (RAIN ? .2 : .34) : 1); }
    else { sun.userData.dir = dirFrom(205, 48); sun.color.copy(lin(.55, .65, 1)); sun.intensity = .42 * night; }   // moonlight
    hemi.color.copy(skyU.uHor.value).lerp(skyU.uZen.value, .55).multiplyScalar(1 / Math.max(.2, Math.max(...zen, ...hor)));
    hemi.groundColor.copy(lin(.32, .27, .21)).multiplyScalar(.25 + .75 * day);
    hemi.intensity = .1 + .33 * sstep(-8, 16, e);
    if (night > .5) { hemi.color.copy(lin(.32, .4, .7)); hemi.intensity = .22; }
    if (P) hemi.intensity *= 1.6;
    hemi.userData.base = hemi.intensity;
    skyU.uStars.value = sstep(-4, -12, e);
    const cc = lin(.03, .04, .07).lerp(lin(.34, .25, .32), sstep(-12, -2, e)).lerp(lin(1.5, .8, .55), sstep(-2, 5, e)).lerp(lin(1.35, 1.36, 1.4), sstep(6, 22, e));
    shared.uCloudCol.value.copy(cc).multiplyScalar(P ? (RAIN ? .55 : .82) : 1);
    shared.uCloudK.value = .62 * day * (P ? .3 : 1);
    shared.uCloudCover.value = P ? (RAIN ? .2 : .28) : SS.cover;
    shared.uWet.value = RAIN ? 1 : 0; shared.uRainW.value = RAIN ? 1 : 0;
    if (precip) precip.bright(.28 + .72 * day);
    const sy = Math.max(.15, sunDir.y); shared.uCloudSun.value.set(sunDir.x / sy, sunDir.z / sy);
    shared.uFogSunXZ.value.set(sunDir.x, sunDir.z).normalize();
    const wA = sstep(16, 3, e) * (1 - sstep(-6, -12, e));
    const awayT = e > 3 ? lin(.5295, .4893, .6959).lerp(lin(.4892, .265, .4237), sstep(12, 3, e)) : lin(.4892, .265, .4237).lerp(lin(.107, .0879, .1875), sstep(1, -4, e));
    shared.uFogAway.value.copy(skyU.uHor.value).lerp(awayT, wA); shared.uFogDirK.value = wA > .01 ? 1 : 0;
    const fogC = skyU.uHor.value;
    scene.fog = new THREE.Fog(fogC.clone(), (650 + 650 * day) * SS.haze * (P ? .5 : 1), (2500 + 1400 * day) * SS.haze * (P ? (RAIN ? .5 : .42) : 1));
    scene.background = null;
    shared.uNight.value = night;
    if (mountainsMat) { mountainsMat.color.copy(skyU.uHor.value).lerp(lin(1, 1, 1), .45 * day).multiplyScalar(.35 + .65 * day); mountainsMat.userData.op = .3 + .25 * day; }
    renderer.toneMappingExposure = 1.0 + .3 * night; baseExposure = renderer.toneMappingExposure;
    if (streetLights) streetLights.set(night);
    if (traffic) traffic.night(night);
    host.dataset.mode = night > .5 ? 'evening' : 'day';
    placeSun();
    if (force || Math.abs(hour - lastEnvHour) > .12) { rebuildEnv(); lastEnvHour = hour; needCapture = true; }
    ui.setClock && ui.setClock(hour, e);
  }
  function findSun(target, from, to) {           // first local hour in [from, to] when the sun crosses the target elevation
    let prev = solar(dateAt(from), LAT, LON).alt;
    for (let h = from + .05; h <= to; h += .05) { const a = solar(dateAt(h), LAT, LON).alt; if ((prev - target) * (a - target) <= 0) return h; prev = a; }
    return null;
  }
  function placeSun() {
    const t = controls.target;
    sun.target.position.set(t.x, 0, t.z);
    sun.position.copy(sun.target.position).addScaledVector(sun.userData.dir, 1800);
    sun.target.updateMatrixWorld();
  }

  // ---------------------------------------------------------------- street lights (night): light pools on the ground + lamp heads
  let streetLights = null;
  {
    const buf = lightsBuf, n = new DataView(buf).getUint32(4, true), xy = new Int16Array(buf, 8, n * 2);
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const glow = new THREE.CanvasTexture(cv); glow.colorSpace = THREE.SRGBColorSpace;
    const pool = new THREE.MeshBasicMaterial({ map: glow, color: lin(1, .62, .3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: true,
      polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -40 });
    const pg = new THREE.PlaneGeometry(22, 22); pg.rotateX(-Math.PI / 2);
    const pools = new THREE.InstancedMesh(pg, pool, n); const m4 = new THREE.Matrix4();
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const x = xy[2 * i] / 10, y = xy[2 * i + 1] / 10;
      m4.makeTranslation(x, .35, -y); pools.setMatrixAt(i, m4);
      pos[3 * i] = x; pos[3 * i + 1] = 9.0; pos[3 * i + 2] = -y;
    }
    pools.frustumCulled = false; pools.renderOrder = 2; pools.visible = false; scene.add(pools);
    const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const heads = new THREE.Points(hg, new THREE.PointsMaterial({ map: glow, color: lin(1, .82, .55), size: 7, sizeAttenuation: true, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    heads.frustumCulled = false; heads.visible = false; scene.add(heads);
    streetLights = { set(k) { pools.visible = heads.visible = k > .02; pool.opacity = .55 * k; heads.material.opacity = k; } };
  }

  // ---------------------------------------------------------------- precipitation: snowfall (winter) and rain (autumn), GPU-animated
  let precip = null;
  {
    function system(rain, n, box, wsz = 1) {
      const g = new THREE.BufferGeometry();
      const pos = new Float32Array(n * 3), ar = new Float32Array(n);
      for (let i = 0; i < n; i++) { pos[i * 3] = Math.random() * box.x; pos[i * 3 + 1] = Math.random() * box.y; pos[i * 3 + 2] = Math.random() * box.z; ar[i] = Math.random(); }
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aR', new THREE.BufferAttribute(ar, 1));
      const U = { uTime: shared.uTime, uK: { value: 0 }, uBox: { value: box.clone() }, uCenter: { value: new THREE.Vector3() }, uProj: { value: 2000 }, uBright: { value: 1 },
        uPx: { value: devicePixelRatio || 1 }, uWs: { value: wsz }, uWind: { value: rain ? new THREE.Vector2(2.6, 1.1) : new THREE.Vector2(.9, .4) } };
      const mat = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, fog: false,
        vertexShader: `uniform float uTime, uK, uProj, uPx, uWs; uniform vec3 uBox, uCenter; uniform vec2 uWind; attribute float aR; varying float vA, vSize;
          void main() {
            vec3 p = position;
            ${rain ? `float sp = 15.0 + 5.0 * aR; p.y -= uTime * sp; p.xz += uTime * uWind;`
                   : `float sp = 1.0 + 0.8 * aR; p.y -= uTime * sp; p.xz += uTime * uWind; p.x += sin(uTime * 0.8 + aR * 40.0) * 0.9; p.z += cos(uTime * 0.6 + aR * 25.0) * 0.9;`}
            vec3 base = uCenter - uBox * 0.5;
            p = base + mod(p - base, uBox);
            vec3 rel = abs(p - uCenter) / (uBox * 0.5);
            float edge = 1.0 - smoothstep(0.72, 1.0, max(rel.x, max(rel.y, rel.z)));
            vec4 mv = viewMatrix * vec4(p, 1.0);
            float d = max(-mv.z, 0.5);
            gl_Position = projectionMatrix * mv;
            ${rain ? `vSize = clamp(uProj * uWs * (2.4 + 2.2 * aR) / d, 7.0 * uPx, 80.0 * uPx);`
                   : `vSize = clamp(uProj * uWs * (0.3 + 0.3 * aR) / d, 2.2 * uPx, 16.0 * uPx);`}
            gl_PointSize = vSize;
            vA = uK * edge * step(0.0, p.y) * smoothstep(2.0, 7.0, d);
          }`,
        fragmentShader: rain
          ? `uniform float uBright, uPx; varying float vA, vSize;
             void main() { vec2 c = gl_PointCoord - 0.5; float hw = 0.62 * uPx / vSize;
               float a = (1.0 - smoothstep(hw * 0.5, hw * 1.5, abs(c.x + c.y * 0.12))) * (1.0 - smoothstep(0.3, 0.5, abs(c.y))) * vA;
               if (a < 0.01) discard; gl_FragColor = vec4(vec3(0.78, 0.83, 0.9) * uBright, 0.5 * a); }`
          : `uniform float uBright; varying float vA, vSize;
             void main() { vec2 c = gl_PointCoord - 0.5; float a = (1.0 - smoothstep(0.1, 0.5, length(c))) * vA; if (a < 0.01) discard; gl_FragColor = vec4(vec3(0.97, 0.98, 1.0) * uBright, a * 0.95); }` });
      const o = new THREE.Points(g, mat);
      o.frustumCulled = false; o.renderOrder = 4; o.visible = false; scene.add(o);
      return { o, U };
    }
    const q = MOBILE ? .4 : 1;
    const sys = [                                     // near curtain + mid layer around the camera + layer over the ground at the focus point
      { type: 1, cam: true, ...system(false, Math.round(9000 * q), new THREE.Vector3(70, 70, 70), .28) },
      { type: 1, cam: true, ...system(false, Math.round(14000 * q), new THREE.Vector3(360, 360, 360)) },
      { type: 1, cam: false, ...system(false, Math.round(14000 * q), new THREE.Vector3(900, 170, 900)) },
      { type: 2, cam: true, ...system(true, Math.round(7000 * q), new THREE.Vector3(60, 60, 60), .7) },
      { type: 2, cam: true, ...system(true, Math.round(14000 * q), new THREE.Vector3(320, 320, 320)) },
      { type: 2, cam: false, ...system(true, Math.round(14000 * q), new THREE.Vector3(760, 170, 760)) },
    ];
    let k1 = 0, k2 = 0, baseBright = 1;
    precip = {
      bright(b) { baseBright = b; sys.forEach(s => { s.U.uBright.value = b; }); },
      flash(f) { sys.forEach(s => { s.U.uBright.value = baseBright + f * 1.4; }); },
      update(dt) {
        const t = precipType(), a = Math.min(1, dt * 1.4);
        k1 += ((t === 1 ? 1 : 0) - k1) * a; k2 += ((t === 2 ? 1 : 0) - k2) * a;
        const proj = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360));
        for (const s of sys) {
          const k = s.type === 1 ? k1 : k2; s.o.visible = k > .01; if (!s.o.visible) continue;
          s.U.uK.value = k; s.U.uProj.value = proj;
          if (s.cam) s.U.uCenter.value.copy(camera.position);
          else s.U.uCenter.value.set(controls.target.x, 85, controls.target.z);
        }
      },
    };
  }

  // ---------------------------------------------------------------- thunderstorm: lightning bolts, flashes and synthesized thunder (autumn rain)
  let storm = null;
  {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const flashLight = new THREE.DirectionalLight(0xdfe8ff, 0); scene.add(flashLight, flashLight.target);
    const boltShader = (col, sharp) => new THREE.ShaderMaterial({
      uniforms: { uCol: { value: new THREE.Color(...col) }, uOpacity: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `attribute float aU; varying float vU; void main() { vU = aU; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 uCol; uniform float uOpacity; varying float vU;
        void main() { float x = abs(vU); float a = ${sharp ? '1.0 - smoothstep(0.35, 1.0, x)' : 'pow(1.0 - x, 2.2)'}; gl_FragColor = vec4(uCol * a * uOpacity, 1.0); }` });
    const boltMat = boltShader([1.6, 1.75, 2.3], true), glowMat = boltShader([.3, .36, .8], false);
    const boltMesh = new THREE.Mesh(new THREE.BufferGeometry(), boltMat), glowMesh = new THREE.Mesh(new THREE.BufferGeometry(), glowMat);
    [boltMesh, glowMesh].forEach(m => { m.frustumCulled = false; m.renderOrder = 6; m.visible = false; scene.add(m); });
    const Y = new THREE.Vector3(0, 1, 0);
    function jag(a, b, disp, depth, out) {                         // midpoint displacement
      if (depth === 0) { out.push(b.clone()); return; }
      const m = a.clone().lerp(b, .5);
      m.x += (Math.random() - .5) * disp; m.z += (Math.random() - .5) * disp; m.y += (Math.random() - .5) * disp * .25;
      jag(a, m, disp * .55, depth - 1, out); jag(m, b, disp * .55, depth - 1, out);
    }
    function ribbon(lines, width) {                                 // camera-facing strips with joined corners
      const P = [], U = [], cam = camera.position;
      for (const [pts, w0] of lines) {
        const n = pts.length, L = [], R = [];
        for (let i = 0; i < n; i++) {
          const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], t = b.clone().sub(a).normalize();
          const side = t.cross(cam.clone().sub(pts[i]).normalize()).normalize();
          const w = width * w0 * (1 - .55 * i / n);
          L.push(pts[i].clone().addScaledVector(side, w)); R.push(pts[i].clone().addScaledVector(side, -w));
        }
        for (let i = 0; i < n - 1; i++) {
          P.push(...L[i].toArray(), ...R[i].toArray(), ...L[i + 1].toArray(), ...R[i].toArray(), ...R[i + 1].toArray(), ...L[i + 1].toArray());
          U.push(1, -1, 1, -1, -1, 1);
        }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aU', new THREE.Float32BufferAttribute(U, 1)); return g;
    }
    let next = 1.5 + Math.random() * 1.5, age = 99, dist = 1000, wasActive = false;
    const ray = new THREE.Raycaster();
    function strike() {
      let ground = null;
      for (let tries = 0; tries < 6 && !ground; tries++) {                // a random point of the visible ground, upper part of the frame
        ray.setFromCamera(new THREE.Vector2((Math.random() - .5) * 1.5, -.1 + Math.random() * .6), camera);
        const d = ray.ray.direction;
        if (d.y < -.02) { const g = ray.ray.origin.clone().addScaledVector(d, -ray.ray.origin.y / d.y); const L = g.distanceTo(camera.position); if (L > 380 && L < 3200) ground = g; }
      }
      if (!ground) { const dir = controls.target.clone().sub(camera.position); dir.y = 0; dir.normalize(); ground = camera.position.clone().addScaledVector(dir, 900); ground.y = 0; }
      dist = ground.distanceTo(camera.position);
      const top = ground.clone().add(new THREE.Vector3((Math.random() - .5) * 260, 1280, (Math.random() - .5) * 260));
      const main = [top.clone()]; jag(top, ground, 220, 7, main);
      const lines = [[main, 1]];
      for (let k = 0; k < 3 + (Math.random() * 3 | 0); k++) {           // branches
        const i0 = 8 + (Math.random() * 70 | 0), from = main[i0], len = 120 + Math.random() * 260;
        const to = from.clone().add(new THREE.Vector3((Math.random() - .5) * len, -len * (.5 + Math.random() * .6), (Math.random() - .5) * len));
        const br = [from.clone()]; jag(from, to, 70, 4, br); lines.push([br, .45]);
      }
      boltMesh.geometry.dispose(); glowMesh.geometry.dispose();
      boltMesh.geometry = ribbon(lines, 1.1 + dist / 1400); glowMesh.geometry = ribbon(lines, 11 + dist / 120);
      shared.uFlashDir.value.copy(top).sub(camera.position).normalize();
      flashLight.position.copy(top); flashLight.target.position.copy(ground); flashLight.target.updateMatrixWorld();
      age = 0; next = 5 + Math.random() * 10;
      if (storm) storm.strikes++;
      thunder(dist);
    }
    const pulse = t => reduce ? Math.exp(-Math.max(0, t) / .5) * .5 * (t >= 0 ? 1 : 0)
      : [[0, 1], [.38, .75], [.74, .45]].reduce((acc, [t0, a]) => acc + (t >= t0 ? a * Math.exp(-(t - t0) / .09) : 0), 0) + (t >= 0 ? .18 * Math.exp(-t / .9) : 0);
    // ---- audio (Web Audio, synthesized; starts only after a user gesture)
    const A = { ctx: null, master: null, rain: null, brown: null, white: null, on: true, audible: true };
    function unlock() {
      if (A.ctx) { if (A.ctx.state === 'suspended' && A.audible) A.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const ctx = A.ctx = new AC(), sr = ctx.sampleRate, len = sr * 4;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.connect(ctx.destination);
      A.master = ctx.createGain(); A.master.gain.value = A.on ? .8 : 0; A.master.connect(comp);
      A.white = ctx.createBuffer(1, len, sr); A.brown = ctx.createBuffer(1, len, sr);
      const w = A.white.getChannelData(0), b = A.brown.getChannelData(0); let last = 0;
      for (let i = 0; i < len; i++) { w[i] = Math.random() * 2 - 1; last = (last + .02 * w[i]) / 1.02; b[i] = last * 3.4; }
      const src = ctx.createBufferSource(); src.buffer = A.white; src.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = .5;
      const hs = ctx.createBiquadFilter(); hs.type = 'lowpass'; hs.frequency.value = 7000;
      A.rain = ctx.createGain(); A.rain.gain.value = 0;
      src.connect(bp).connect(hs).connect(A.rain).connect(A.master); src.start();
    }
    function thunder(d) {
      const ctx = A.ctx; if (!ctx || !A.on || !A.audible || ctx.state !== 'running') return;
      const near = 1 - Math.min(1, Math.max(0, (d - 650) / 1800)), t = ctx.currentTime + .25 + (1 - near) * 2.6;
      const src = ctx.createBufferSource(); src.buffer = A.brown; src.loop = true; src.playbackRate.value = .65 + Math.random() * .3;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(260 + 1300 * near, t); lp.frequency.exponentialRampToValueAtTime(80, t + 5.5);
      const g = ctx.createGain(); const peak = .45 + .85 * near;
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + .05 + (1 - near) * .45);
      let tt = t + .45;
      for (let k = 0; k < 4; k++) { g.gain.exponentialRampToValueAtTime(Math.max(.002, peak * (.3 + .55 * Math.random()) * (1 - k * .17)), tt + .3); tt += .45 + Math.random() * .9; }
      g.gain.exponentialRampToValueAtTime(.0001, tt + 1.9);
      src.connect(lp).connect(g).connect(A.master); src.start(t, Math.random() * 2); src.stop(tt + 2.1);
      if (near > .5) {                                                // close strike: sharp crack
        const c = ctx.createBufferSource(); c.buffer = A.white;
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 700;
        const cg = ctx.createGain(); cg.gain.setValueAtTime(.0001, t - .12); cg.gain.exponentialRampToValueAtTime(.32 * near, t - .11); cg.gain.exponentialRampToValueAtTime(.0001, t + .28);
        c.connect(hp).connect(cg).connect(A.master); c.start(t - .12); c.stop(t + .35);
      }
    }
    let rainK = 0;
    storm = {
      unlock, get sound() { return A.on; }, get audioState() { return A.ctx ? A.ctx.state : 'none'; }, strikes: 0,
      setSound(on) { A.on = on; if (A.master) A.master.gain.setTargetAtTime(on ? .8 : 0, A.ctx.currentTime, .15); },
      audible(v) { A.audible = v; if (!A.ctx) return; if (v) A.ctx.resume(); else A.ctx.suspend(); },
      update(dt) {
        const active = precipType() === 2;
        rainK += ((active ? 1 : 0) - rainK) * Math.min(1, dt * 1.2);
        if (A.rain) A.rain.gain.setTargetAtTime(.075 * rainK, A.ctx.currentTime, .3);
        if (active && !wasActive) next = 1.5 + Math.random() * 1.5;       // first strike soon after the storm starts
        wasActive = active;
        if (active) { next -= dt; if (next <= 0) strike(); }
        age += dt;
        const f = active || age < 2 ? pulse(age) : 0;
        const vis = f > .02; boltMesh.visible = glowMesh.visible = vis && age < 1.1;
        boltMat.uniforms.uOpacity.value = Math.min(1.2, f * 1.3); glowMat.uniforms.uOpacity.value = Math.min(1, f * .7);
        if (precip) precip.flash(f);
        const nightBoost = 1 + 1.5 * shared.uNight.value;
        shared.uFlash.value = f * .9 * nightBoost;
        flashLight.intensity = f * 3.6 * nightBoost;
        hemi.intensity = (hemi.userData.base ?? hemi.intensity) + f * 1.2 * nightBoost;
        renderer.toneMappingExposure = baseExposure * (1 + f * .35);
      },
    };
  }

  // ---------------------------------------------------------------- life: walking people, bird flocks, a departing airliner
  let life = null;
  {
    const rnd = (a, b) => a + Math.random() * (b - a);
    // ---------- people ------------------------------------------------------------------
    const dvp = new DataView(pedsBuf); let o = 4; const nPL = dvp.getUint32(o, true); o += 4;
    const plines = [];
    for (let i = 0; i < nPL; i++) {
      const np = dvp.getUint16(o, true), kind = dvp.getUint8(o + 2), n0 = dvp.getUint8(o + 3), n1 = dvp.getUint8(o + 4); o += 5;
      const c0 = [], c1 = [];
      for (let k = 0; k < n0; k++) { c0.push([dvp.getUint16(o, true), dvp.getUint8(o + 2)]); o += 3; }
      for (let k = 0; k < n1; k++) { c1.push([dvp.getUint16(o, true), dvp.getUint8(o + 2)]); o += 3; }
      const P = new Float32Array(np * 2);
      for (let k = 0; k < np; k++) { P[2 * k] = dvp.getInt16(o, true) / 10; P[2 * k + 1] = -dvp.getInt16(o + 2, true) / 10; o += 4; }
      const cum = new Float32Array(np);
      for (let k = 1; k < np; k++) cum[k] = cum[k - 1] + Math.hypot(P[2 * k] - P[2 * k - 2], P[2 * k + 1] - P[2 * k - 1]);
      plines.push({ P, cum, len: cum[np - 1], kind, conn: [c0, c1] });
    }
    const pw = [], KW = [1, .7, 3.2]; let pacc = 0;
    plines.forEach(l => { const mx = l.P[0], mz = l.P[1]; pacc += l.len * KW[l.kind] * Math.exp(-Math.hypot(mx - 20, mz + 20) / 420); pw.push(pacc); });
    const pickLine = () => { const r = Math.random() * pacc; let lo = 0, hi = pw.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (pw[m] < r) lo = m + 1; else hi = m; } return lo; };
    // body parts: 0 torso, 1/2 legs, 3/4 arms, 5 head, 6 umbrella
    const part = (g, id) => { g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); g.setAttribute('aPart', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(id), 1)); return g; };
    const bx = (sx, sy, sz, x, y, z, id) => { const g = new THREE.BoxGeometry(sx, sy, sz); g.translate(x, y, z); return part(g, id); };
    const head = new THREE.IcosahedronGeometry(.115, 0); head.translate(0, 1.6, 0);
    const umb = new THREE.ConeGeometry(.62, .26, 8, 1, true); umb.translate(0, 2.02, 0);
    const stick = new THREE.CylinderGeometry(.012, .012, .5, 4); stick.translate(.05, 1.7, 0);
    const personGeo = mergeGeometries([
      bx(.2, .6, .36, 0, 1.15, 0, 0), bx(.14, .84, .14, 0, .43, .1, 1), bx(.14, .84, .14, 0, .43, -.1, 2),
      bx(.1, .6, .1, 0, 1.13, .235, 3), bx(.1, .6, .1, 0, 1.13, -.235, 4), part(head, 5), part(umb, 6), part(stick, 6)]);
    personGeo.computeVertexNormals();
    const NP = MOBILE ? 380 : 1100;
    const walkAttr = new THREE.InstancedBufferAttribute(new Float32Array(NP * 2), 2);
    personGeo.setAttribute('aWalk', walkAttr);
    const pMat = withClouds(new THREE.MeshStandardMaterial({ roughness: .85, side: THREE.DoubleSide }));
    pMat.userData.wetK = 0; pMat.userData.snowK = 0;
    pMat.onBeforeCompile = (sh => { const prev = pMat.onBeforeCompile; return (s2, r) => {
      prev && prev.call(pMat, s2, r);
      Object.assign(s2.uniforms, { uTime: shared.uTime, uRainP: shared.uRainW, uSeasonP: shared.uSeason });
      s2.vertexShader = s2.vertexShader.replace('#include <common>', `#include <common>
        attribute float aPart; attribute vec2 aWalk; uniform float uTime, uRainP; varying float vPart;
        vec3 rotZ(vec3 p, vec3 piv, float a) { vec3 q = p - piv; float c = cos(a), s = sin(a); return piv + vec3(c * q.x - s * q.y, s * q.x + c * q.y, q.z); }`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vPart = aPart;
          float sw = sin(uTime * 7.2 * (0.8 + 0.4 * fract(aWalk.x * 3.1)) + aWalk.x * 6.2831) * 0.5 * aWalk.y;
          if (aPart > 0.5 && aPart < 1.5) transformed = rotZ(transformed, vec3(0.0, 0.86, 0.0), sw);
          else if (aPart > 1.5 && aPart < 2.5) transformed = rotZ(transformed, vec3(0.0, 0.86, 0.0), -sw);
          else if (aPart > 2.5 && aPart < 3.5) transformed = rotZ(transformed, vec3(0.0, 1.42, 0.0), -sw * 0.8 * (1.0 - uRainP * 0.8));
          else if (aPart > 3.5 && aPart < 4.5) transformed = rotZ(transformed, vec3(0.0, 1.42, 0.0), sw * 0.8);
          if (aPart > 5.5 && uRainP < 0.5) transformed *= 0.0;
          transformed.y += abs(sw) * 0.05;`);
      s2.fragmentShader = s2.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vPart; uniform float uSeasonP;')
        .replace('#include <color_fragment>', `
          #ifdef USE_COLOR
            vec3 shirt = vColor.rgb;
          #else
            vec3 shirt = vec3(0.5);
          #endif
          if (uSeasonP > 2.5) shirt = shirt * 0.42 + vec3(0.02);
          vec3 pants = mix(vec3(0.04, 0.05, 0.08), vec3(0.28, 0.24, 0.2), step(0.6, fract(shirt.r * 13.7)));
          vec3 skin = mix(vec3(0.3, 0.19, 0.13), vec3(0.62, 0.45, 0.34), fract(shirt.g * 9.1));
          diffuseColor.rgb = vPart < 0.5 ? shirt : vPart < 2.5 ? pants : vPart < 4.5 ? shirt : vPart < 5.5 ? skin : shirt * 0.55 + vec3(0.02);`);
    }; })(pMat);
    pMat.customProgramCacheKey = () => 'person';
    const people = new THREE.InstancedMesh(personGeo, pMat, NP);
    people.frustumCulled = false; people.castShadow = !MOBILE; people.receiveShadow = true; scene.add(people);
    const CL = [[.75, .1, .08], [.08, .2, .55], [.9, .88, .84], [.12, .12, .13], [.85, .55, .12], [.15, .45, .3], [.55, .5, .45], [.6, .2, .45], [.25, .5, .75], [.9, .75, .2]];
    const col3 = new THREE.Color(), agentsP = [];
    for (let i = 0; i < NP; i++) {
      const li = pickLine(), l = plines[li];
      agentsP.push({ li, s: Math.random() * l.len, dir: Math.random() < .5 ? 1 : -1, v: rnd(1.05, 1.55), k: 0, pause: 0, bridge: null });
      const c = CL[(Math.random() * CL.length) | 0]; people.setColorAt(i, col3.setRGB(c[0], c[1], c[2], THREE.LinearSRGBColorSpace));
      walkAttr.setXY(i, Math.random(), 1);
    }
    // ---------- birds --------------------------------------------------------------------
    const bp = [0, .05, .2, .5, .03, 0, -.35, .06, 0, -.5, .02, 0,           // body (kite shape in xy, bird flies +x)
      .12, .05, 0, -.1, .05, 0, -.05, .04, .7,  .12, .05, 0, -.05, .04, .7, -.1, .05, 0,   // left wing (both faces)
      .12, .05, 0, -.05, .04, -.7, -.1, .05, 0,  .12, .05, 0, -.1, .05, 0, -.05, .04, -.7];
    const birdGeo = new THREE.BufferGeometry();
    const bpos = new Float32Array([0, .02, 0, .32, .05, 0, -.3, .06, 0, ...bp.slice(12)]);
    birdGeo.setAttribute('position', new THREE.BufferAttribute(bpos, 3));
    birdGeo.computeVertexNormals();
    const NB = MOBILE ? 60 : 150, birdPh = new THREE.InstancedBufferAttribute(new Float32Array(NB), 1);
    birdGeo.setAttribute('aPh', birdPh);
    const bMat = new THREE.MeshBasicMaterial({ color: col([.035, .035, .04]), side: THREE.DoubleSide, fog: true });
    bMat.onBeforeCompile = sh => {
      sh.uniforms.uTime = shared.uTime;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aPh; uniform float uTime;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float amp = mix(0.15, 1.0, smoothstep(0.35, 0.6, sin(uTime * 0.45 + aPh * 11.0) * 0.5 + 0.5));
          transformed.y += sin(uTime * 11.0 + aPh * 40.0) * abs(transformed.z) * 1.1 * amp;
          transformed *= 1.5;`);
    };
    bMat.customProgramCacheKey = () => 'bird';
    const birds = new THREE.InstancedMesh(birdGeo, bMat, NB); birds.frustumCulled = false; scene.add(birds);
    const FLOCKS = [[-40, 108, 75, 30, 34], [-640, 600, 150, 100, 46], [-711, 490, 90, 90, 30], [-1266, -42, 130, 110, 50], [-560, 1120, 160, 140, 72], [-560, 100, 120, 90, 40], [420, -300, 120, 90, 34]]
      .map(([x, y, rx, ry, h]) => ({ c: V(x, y, h), rx, ry, h, sp: rnd(.06, .1) * (Math.random() < .5 ? 1 : -1), ph: Math.random() * 6.28, drift: Math.random() * 6.28 }));
    const birdA = [];
    for (let i = 0; i < NB; i++) {
      birdA.push({ f: i % FLOCKS.length, off: new THREE.Vector3(rnd(-14, 14), rnd(-4, 4), rnd(-14, 14)), w: rnd(.3, 1.2), ph: Math.random() * 6.28 });
      birdPh.setX(i, Math.random());
    }
    // ---------- airliner (departure climbing out of Tashkent airport, turning north over the city) ----------
    const planeParts = [];
    const cyl = (r0, r1, len, seg, x) => { const g = new THREE.CylinderGeometry(r1, r0, len, seg); g.rotateZ(-Math.PI / 2); g.translate(x, 0, 0); return g; };
    const wing = (span, root, tip, sweep, y, x0, dz) => {         // flat tapered wing from the fuselage outward along z * dz
      const g = new THREE.BufferGeometry(), t = .25;
      const v = [[x0, y, 0], [x0 - root, y, 0], [x0 - sweep - tip, y, span * dz], [x0 - sweep, y, span * dz]];
      const pos = [];
      for (const [a, b, c] of [[0, 1, 2], [0, 2, 3]]) for (const k of [a, b, c]) pos.push(v[k][0], v[k][1], v[k][2]);
      for (const [a, b, c] of [[0, 2, 1], [0, 3, 2]]) for (const k of [a, b, c]) pos.push(v[k][0], v[k][1] - t, v[k][2]);
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); return g;
    };
    const paint = (g, c) => { g = g.index ? g.toNonIndexed() : g; g.deleteAttribute && g.getAttribute('uv') && g.deleteAttribute('uv'); const a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) a.set(c, i); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
    const W3 = [.86, .87, .88], B3 = [.05, .22, .55], G3 = [.4, .42, .45];
    const fin = new THREE.BufferGeometry(); fin.setAttribute('position', new THREE.Float32BufferAttribute([-12.5, 1.6, 0, -18.4, 1.6, 0, -18.8, 8.4, 0, -12.5, 1.6, 0, -18.8, 8.4, 0, -16.2, 8.4, 0], 3));
    const planeGeo = mergeGeometries([
      paint(cyl(1.95, 1.95, 27, 12, 0), W3), paint(cyl(1.95, .3, 5, 12, 16), W3), paint(cyl(1.95, .5, 7, 12, -17), W3),
      paint(wing(16.5, 7, 1.8, 7.5, -.6, 3, 1), W3), paint(wing(16.5, 7, 1.8, 7.5, -.6, 3, -1), W3),
      paint(wing(6, 3.6, 1.4, 3, 1.2, -14.5, 1), W3), paint(wing(6, 3.6, 1.4, 3, 1.2, -14.5, -1), W3),
      paint(fin, B3),
      paint(cyl(1.05, .9, 4.2, 10, 1.5).translate(0, -1.9, 5.8), G3), paint(cyl(1.05, .9, 4.2, 10, 1.5).translate(0, -1.9, -5.8), G3)]
      .map(g => { g.deleteAttribute('normal'); return g; }));
    planeGeo.computeVertexNormals();
    const plane = new THREE.Mesh(planeGeo, withClouds(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .35, metalness: .25, side: THREE.DoubleSide })));
    plane.frustumCulled = false; plane.visible = true; scene.add(plane);
    const lightsGeo = new THREE.BufferGeometry();
    lightsGeo.setAttribute('position', new THREE.Float32BufferAttribute([-4.5, -.6, 16.5, -4.5, -.6, -16.5, -19.2, 1.8, 0, -2, 2.1, 0, -2, -2.2, 0, 3, -1, 3.5, 3, -1, -3.5], 3));
    lightsGeo.setAttribute('color', new THREE.Float32BufferAttribute([.1, 1, .25, 1, .1, .08, 1, 1, 1, 1, .15, .1, 1, .15, .1, 1, .95, .85, 1, .95, .85], 3));   // green right (+z), red left, landing lights
    const navMat = new THREE.PointsMaterial({ size: 7, sizeAttenuation: false, map: pools_glow_tex(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const navPts = new THREE.Points(lightsGeo, navMat); navPts.frustumCulled = false; plane.add(navPts);
    const strobeGeo = new THREE.BufferGeometry(); strobeGeo.setAttribute('position', new THREE.Float32BufferAttribute([-5, -.6, 16.8, -5, -.6, -16.8, -19.4, 1.8, 0], 3));
    const strobeMat = new THREE.PointsMaterial({ size: 14, sizeAttenuation: false, map: pools_glow_tex(), color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const strobe = new THREE.Points(strobeGeo, strobeMat); strobe.frustumCulled = false; plane.add(strobe);
    // approach into Tashkent airport (8.6 km south): descending turn over the west of the district
    const route = new THREE.CatmullRomCurve3([V(3400, 4600, 760), V(2200, 2900, 610), V(1100, 1000, 450), V(300, -200, 310), V(-500, -1500, 240), V(-1200, -3800, 170), V(-1500, -6200, 110)], false, 'centripetal');
    const RLEN = route.getLength();
    let pu = .2, pWait = 0, lastYaw = 0;                                   // the first plane is already on its way when the map opens
    const fwd = new THREE.Vector3(), upv = new THREE.Vector3(), rgt = new THREE.Vector3(), basis = new THREE.Matrix4(), q = new THREE.Quaternion(), qr = new THREE.Quaternion();
    // ---------- per-frame update ---------------------------------------------------------
    const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), yA = new THREE.Vector3(0, 1, 0), p3 = new THREE.Vector3(), sc1 = new THREE.Vector3(1, 1, 1), tmpV = new THREE.Vector3();
    let walkDirty = 0;
    life = {
      update(dt) {
        const t = shared.uTime.value, night = shared.uNight.value, weather = precipType();
        // people
        const visibleP = Math.round(NP * (weather ? .45 : 1) * (1 - .6 * night));
        people.count = visibleP;
        for (let i = 0; i < visibleP; i++) {
          const a = agentsP[i]; let l = plines[a.li];
          if (a.pause > 0) { a.pause -= dt; if (a.pause <= 0) { walkAttr.setY(i, 1); walkDirty = 1; } }
          else {
            a.s += a.v * dt * a.dir;
            if (Math.random() < dt * .012) { a.pause = rnd(2, 7); walkAttr.setY(i, 0); walkDirty = 1; }
            if (a.s > l.len || a.s < 0) {
              const endi = a.s > l.len ? 1 : 0, cand = l.conn[endi];
              if (cand.length && Math.random() < .93) {
                const [j, e] = cand[(Math.random() * cand.length) | 0]; a.li = j; l = plines[j];
                a.dir = e === 0 ? 1 : -1; a.s = e === 0 ? 0 : l.len; a.k = e === 0 ? 0 : l.cum.length - 2;
              } else { a.dir = -a.dir; a.s = Math.min(l.len, Math.max(0, a.s)); }
            }
          }
          const cum = l.cum, P = l.P, n = cum.length;
          let k = Math.min(Math.max(a.k, 0), n - 2);
          while (k < n - 2 && cum[k + 1] < a.s) k++;
          while (k > 0 && cum[k] > a.s) k--;
          a.k = k;
          const seg = (cum[k + 1] - cum[k]) || 1, u = Math.min(1, Math.max(0, (a.s - cum[k]) / seg));
          const dx = P[2 * k + 2] - P[2 * k], dz = P[2 * k + 3] - P[2 * k + 1];
          const side = (i % 3 - 1) * .9;                                       // spread across the walkway
          const L = Math.hypot(dx, dz) || 1;
          p3.set(P[2 * k] + dx * u - dz / L * side * a.dir, .24, P[2 * k + 1] + dz * u + dx / L * side * a.dir);
          qq.setFromAxisAngle(yA, Math.atan2(-dz * a.dir, dx * a.dir)); m4.compose(p3, qq, sc1);
          people.setMatrixAt(i, m4);
        }
        people.instanceMatrix.needsUpdate = true;
        if (walkDirty) { walkAttr.needsUpdate = true; walkDirty = 0; }
        // birds (rest at night, fewer in bad weather)
        const nb = Math.round(NB * (1 - night) * (weather ? .35 : 1));
        birds.count = nb;
        for (const f of FLOCKS) {
          f.ph += f.sp * dt; f.drift += dt * .03;
          f.pos = (f.pos || new THREE.Vector3()).set(f.c.x + Math.cos(f.ph) * f.rx + Math.sin(f.drift) * 40, f.h + Math.sin(f.ph * 2.3) * 8, f.c.z + Math.sin(f.ph) * f.ry + Math.cos(f.drift * 1.3) * 40);
          f.vel = (f.vel || new THREE.Vector3()).set(-Math.sin(f.ph) * f.rx * f.sp, 0, Math.cos(f.ph) * f.ry * f.sp);
        }
        for (let i = 0; i < nb; i++) {
          const b = birdA[i], f = FLOCKS[b.f];
          const wob = t * b.w + b.ph;
          p3.set(f.pos.x + b.off.x + Math.sin(wob) * 5, f.pos.y + b.off.y + Math.sin(wob * 1.7) * 2, f.pos.z + b.off.z + Math.cos(wob * .8) * 5);
          const yaw = Math.atan2(-f.vel.z, f.vel.x) + Math.sin(wob * .6) * .25;
          qq.setFromAxisAngle(yA, yaw); m4.compose(p3, qq, sc1); birds.setMatrixAt(i, m4);
        }
        birds.instanceMatrix.needsUpdate = true;
        // airliner
        if (pu < 0) { pWait -= dt; if (pWait <= 0) { pu = 0; plane.visible = true; } }
        if (pu >= 0) {
          pu += dt * 78 / RLEN;
          if (pu >= 1) { pu = -1; pWait = rnd(20, 40); plane.visible = false; }
          else {
            route.getPointAt(pu, p3); route.getTangentAt(pu, fwd);
            const yaw = Math.atan2(-fwd.z, fwd.x), yawRate = Math.atan2(Math.sin(yaw - lastYaw), Math.cos(yaw - lastYaw)) / Math.max(dt, 1e-3); lastYaw = yaw;
            const roll = Math.max(-.45, Math.min(.45, Math.atan(78 * yawRate / 9.81)));
            rgt.crossVectors(fwd, yA).normalize(); upv.crossVectors(rgt, fwd).normalize();
            basis.makeBasis(fwd, upv, rgt); q.setFromRotationMatrix(basis);          // right-handed: local +z = right wing
            qr.setFromAxisAngle(tmpV.set(1, 0, 0), -roll); q.multiply(qr);
            plane.position.copy(p3); plane.quaternion.copy(q);
            navMat.opacity = .45 + .55 * night;
            const ph = (t % 1.1); strobeMat.opacity = (ph < .06 || (ph > .16 && ph < .22)) ? 1 : 0;
          }
        }
      },
    };
  }

  // ---------------------------------------------------------------- traffic: cars and buses on real lanes, traffic lights, queues
  let traffic = null;
  {
    const dv = new DataView(trafficBuf); let o = 4; const nL = dv.getUint32(o, true); o += 4;
    const lanes = [];
    for (let i = 0; i < nL; i++) {
      const np = dv.getUint16(o, true), cls = dv.getUint8(o + 2), nn = dv.getUint8(o + 3), ns = dv.getUint8(o + 4); o += 5;
      const next = []; for (let k = 0; k < nn; k++) { next.push(dv.getUint16(o, true)); o += 2; }
      const stops = []; for (let k = 0; k < ns; k++) { stops.push({ s: dv.getFloat32(o, true), ix: dv.getUint16(o + 4, true), g: dv.getUint8(o + 6) }); o += 7; }
      const P = new Float32Array(np * 2);
      for (let k = 0; k < np; k++) { P[2 * k] = dv.getInt16(o, true) / 10; P[2 * k + 1] = -dv.getInt16(o + 2, true) / 10; o += 4; }
      const cum = new Float32Array(np);
      for (let k = 1; k < np; k++) cum[k] = cum[k - 1] + Math.hypot(P[2 * k] - P[2 * k - 2], P[2 * k + 1] - P[2 * k - 1]);
      lanes.push({ P, cum, len: cum[np - 1], cls, next, stops, agents: [] });
    }
    const nI = dv.getUint32(o, true); o += 4; o += nI * 8;
    const nP = dv.getUint32(o, true); o += 4;
    const poles = [];
    for (let k = 0; k < nP; k++) { poles.push({ x: dv.getFloat32(o, true), y: dv.getFloat32(o + 4, true), h: dv.getFloat32(o + 8, true), g: dv.getUint8(o + 12), ix: dv.getUint16(o + 13, true) }); o += 15; }
    // signal plans: 2 phases, green 18 s, yellow 3 s, all-red 2 s, random offset per intersection
    const GREEN = 18, YEL = 3, RED2 = 2, CYC = 2 * (GREEN + YEL + RED2);
    const offs = Array.from({ length: nI }, (_, i) => ((i * 7.31) % 1) * CYC);
    let clock = 0;
    const sigState = (ix, g) => {                   // 0 green, 1 yellow, 2 red
      let t = (clock + offs[ix]) % CYC; if (g) t = (t + GREEN + YEL + RED2) % CYC;
      return t < GREEN ? 0 : t < GREEN + YEL ? 1 : 2;
    };
    // --- lamp posts: pole + head + 3 lamps (instanced), heads face the oncoming traffic
    const box = (lx, ly, lz, x, y, z) => { const g = new THREE.BoxGeometry(lx, ly, lz); g.translate(x, y, z); return g; };
    const poleM = withClouds(new THREE.MeshStandardMaterial({ color: col([.32, .33, .34]), roughness: .6, metalness: .5 }));
    const headM = withClouds(new THREE.MeshStandardMaterial({ color: col([.05, .05, .05]), roughness: .5 }));
    const poleI = new THREE.InstancedMesh(mergeGeometries([box(.22, 5.2, .22, 0, 2.6, 0), box(.2, .2, 2.6, 0, 5.1, -1.3)]), poleM, poles.length);
    const headI = new THREE.InstancedMesh(box(.62, 1.8, .5, 0, 4.4, -2.5), headM, poles.length);
    const lampG = [4.98, 4.4, 3.82].map(y => { const g = new THREE.SphereGeometry(.22, 12, 8); g.translate(.32, y, -2.5); return g; });
    const glowPos = new Float32Array(poles.length * 3), glowCol = new Float32Array(poles.length * 3);
    const glowGeo = new THREE.BufferGeometry(); glowGeo.setAttribute('position', new THREE.BufferAttribute(glowPos, 3)); glowGeo.setAttribute('color', new THREE.BufferAttribute(glowCol, 3));
    const glow = new THREE.Points(glowGeo, new THREE.PointsMaterial({ size: 5.5, map: pools_glow_tex(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false }));
    glow.frustumCulled = false; scene.add(glow);
    const lampM = new THREE.MeshBasicMaterial({ toneMapped: false });
    const lampI = lampG.map(g => new THREE.InstancedMesh(g, lampM, poles.length));
    const qq = new THREE.Quaternion(), yAx = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), m4 = new THREE.Matrix4(), pos = new THREE.Vector3();
    poles.forEach((pl, k) => {
      qq.setFromAxisAngle(yAx, pl.h + Math.PI); m4.compose(pos.set(pl.x, .2, -pl.y), qq, one);
      poleI.setMatrixAt(k, m4); headI.setMatrixAt(k, m4); lampI.forEach(l => l.setMatrixAt(k, m4));
      const hp = new THREE.Vector3(.7, 4.4, -2.5).applyMatrix4(m4); glowPos.set([hp.x, hp.y, hp.z], k * 3);
    });
    [poleI, headI, ...lampI].forEach(m => { m.frustumCulled = false; m.castShadow = m !== lampI[0] && m !== lampI[1] && m !== lampI[2]; scene.add(m); });
    const LAMP_ON = [lin(1, .08, .05).multiplyScalar(3), lin(1, .62, .05).multiplyScalar(3), lin(.1, 1, .35).multiplyScalar(3)], LAMP_OFF = lin(.06, .05, .05);
    let lastPaint = -1;
    function paintLamps() {
      poles.forEach((pl, k) => {
        const st = sigState(pl.ix, pl.g);             // lamp order in the head: red (top), yellow, green (bottom)
        lampI[0].setColorAt(k, st === 2 ? LAMP_ON[0] : LAMP_OFF);
        lampI[1].setColorAt(k, st === 1 ? LAMP_ON[1] : LAMP_OFF);
        lampI[2].setColorAt(k, st === 0 ? LAMP_ON[2] : LAMP_OFF);
        const gc = st === 0 ? [.1, 1, .35] : st === 1 ? [1, .62, .05] : [1, .08, .05]; glowCol.set(gc, k * 3);
      });
      lampI.forEach(l => { l.instanceColor.needsUpdate = true; }); glowGeo.attributes.color.needsUpdate = true;
    }
    // --- vehicles
    const W = [3, 2.2, 1.4, .55], wsum = [];
    let acc = 0; lanes.forEach(l => { const mx = l.P[Math.floor(l.P.length / 4) * 2], mz = l.P[Math.floor(l.P.length / 4) * 2 + 1];
      acc += l.len * W[l.cls] * (.35 + Math.exp(-Math.hypot(mx, mz) / 700)); wsum.push(acc); });
    const pickLane = () => { const r = Math.random() * acc; let lo = 0, hi = wsum.length - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (wsum[mid] < r) lo = mid + 1; else hi = mid; } return lo; };
    const carGeo = mergeGeometries([box(4.3, 1.0, 1.78, 0, .78, 0), box(2.2, .72, 1.58, -.25, 1.64, 0)]);
    const busGeo = mergeGeometries([box(11.5, 2.7, 2.5, 0, 1.75, 0)]);
    const lampGeo = (L) => {
      const parts = [box(.12, .22, .34, L / 2, .85, .58), box(.12, .22, .34, L / 2, .85, -.58), box(.12, .2, .34, -L / 2, .9, .58), box(.12, .2, .34, -L / 2, .9, -.58)];
      const g = mergeGeometries(parts.map(q => q.toNonIndexed()));
      const c = new Float32Array(g.attributes.position.count * 3);
      for (let i = 0; i < g.attributes.position.count; i++) { const front = g.attributes.position.getX(i) > 0; c.set(front ? [1, .92, .78] : [1, .08, .04], i * 3); }
      g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
    };
    const bodyMat = withClouds(new THREE.MeshStandardMaterial({ roughness: .35, metalness: .45 }));
    const vLampMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    const NC = MOBILE ? 700 : 1900, NB = Math.round(NC * .035);
    const cars = new THREE.InstancedMesh(carGeo, bodyMat, NC), buses = new THREE.InstancedMesh(busGeo, bodyMat, NB);
    const carLamps = new THREE.InstancedMesh(lampGeo(4.32), vLampMat, NC), busLamps = new THREE.InstancedMesh(lampGeo(11.52), vLampMat, NB);
    const PAL = [[.9, .9, .88], [.9, .9, .88], [.9, .9, .88], [.72, .74, .76], [.05, .05, .06], [.08, .12, .3], [.55, .06, .05], [.62, .55, .42]];
    const c = new THREE.Color(), agents = [];
    for (let i = 0; i < NC + NB; i++) {
      const bus = i >= NC, li = pickLane(), l = lanes[li];
      const a = { bus, idx: bus ? i - NC : i, li, s: Math.random() * l.len, k: 0, v: 0, vmax: (bus ? 10 : [16, 14, 11, 8][l.cls]) * (.85 + .3 * Math.random()), L: bus ? 11.5 : 4.3, nxt: -1 };
      agents.push(a); l.agents.push(a);
      if (bus) buses.setColorAt(i - NC, c.setRGB(.1, .45, .75, THREE.LinearSRGBColorSpace));
      else { const pc = PAL[(i * 7 + 3) % PAL.length]; cars.setColorAt(i, c.setRGB(pc[0], pc[1], pc[2], THREE.LinearSRGBColorSpace)); }
    }
    [cars, buses, carLamps, busLamps].forEach(m => { m.frustumCulled = false; m.receiveShadow = true; scene.add(m); });
    carLamps.visible = busLamps.visible = false;
    const chooseNext = l => l.next.length ? l.next[(Math.random() * l.next.length) | 0] : -1;
    const lastS = l => { let m = 1e9; for (const b of l.agents) if (b.s < m) m = b.s; return m; };
    const byS = (a, b) => b.s - a.s;
    traffic = {
      night(k) { carLamps.visible = busLamps.visible = k > .05; vLampMat.color.setScalar(.4 + 1.6 * k); },
      update(dt) {
        clock += dt;
        const paint = Math.floor(clock * 2);
        if (paint !== lastPaint) { lastPaint = paint; paintLamps(); }
        for (const l of lanes) {
          if (!l.agents.length) continue;
          l.agents.sort(byS);
          let leaderS = 1e9, leaderL = 0;
          for (const a of l.agents) {
            let limit = leaderS - leaderL / 2 - a.L / 2 - 2.2;                    // keep a gap to the car ahead
            for (const st of l.stops) {                                          // red / yellow light ahead?
              if (st.s < a.s - .3) continue;
              const sg = sigState(st.ix, st.g);
              if (sg === 2 || (sg === 1 && st.s - a.s > 4)) limit = Math.min(limit, st.s - a.L / 2);
              break;
            }
            if (a.nxt < 0) a.nxt = chooseNext(l);
            if (a.nxt >= 0 && lanes[a.nxt].agents.length) limit = Math.min(limit, l.len + lastS(lanes[a.nxt]) - a.L / 2 - 4.5);
            const gapToLimit = Math.max(0, limit - a.s);
            const vStop = Math.sqrt(2 * 4.5 * gapToLimit);
            const vT = Math.min(a.vmax, vStop);
            a.v = vT > a.v ? Math.min(vT, a.v + 2.6 * dt) : vT;
            a.s = Math.min(a.s + a.v * dt, Math.max(a.s, limit));
            leaderS = a.s; leaderL = a.L;
          }
        }
        for (const a of agents) {
          let l = lanes[a.li];
          if (a.s > l.len) {
            const from = l; from.agents.splice(from.agents.indexOf(a), 1);
            if (a.nxt < 0) { a.li = pickLane(); a.s = 0; } else { a.s -= from.len; a.li = a.nxt; }
            a.k = 0; a.nxt = -1; l = lanes[a.li]; if (a.s > l.len) a.s = 0; l.agents.push(a);
          }
          const cum = l.cum, P = l.P;
          if (a.k > 0 && cum[a.k] > a.s) a.k = 0;
          while (a.k < cum.length - 2 && cum[a.k + 1] < a.s) a.k++;
          const k = a.k, seg = (cum[k + 1] - cum[k]) || 1, t = Math.min(1, Math.max(0, (a.s - cum[k]) / seg));
          const dx = P[2 * k + 2] - P[2 * k], dz = P[2 * k + 3] - P[2 * k + 1];
          pos.set(P[2 * k] + dx * t, .27, P[2 * k + 1] + dz * t);
          qq.setFromAxisAngle(yAx, Math.atan2(-dz, dx)); m4.compose(pos, qq, one);
          if (a.bus) { buses.setMatrixAt(a.idx, m4); busLamps.setMatrixAt(a.idx, m4); }
          else { cars.setMatrixAt(a.idx, m4); carLamps.setMatrixAt(a.idx, m4); }
        }
        cars.instanceMatrix.needsUpdate = buses.instanceMatrix.needsUpdate = true;
        if (carLamps.visible) carLamps.instanceMatrix.needsUpdate = busLamps.instanceMatrix.needsUpdate = true;
      },
    };
    traffic.update(0);
  }

  // ---------------------------------------------------------------- camera + controls
  const controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, { enableDamping: true, dampingFactor: .075, minDistance: 45, maxDistance: 2600, maxPolarAngle: 1.44, minPolarAngle: .12,
    zoomSpeed: .9, rotateSpeed: .55, panSpeed: .9, screenSpacePanning: false });
  const HOME = { pos: new THREE.Vector3(640, 470, 610), target: new THREE.Vector3(-40, 40, -90) };
  camera.position.copy(HOME.pos); controls.target.copy(HOME.target); controls.update();
  controls.enabled = !TOUCH || FULL;
  controls.addEventListener('change', () => {
    const t = controls.target, r = Math.hypot(t.x, t.z);
    if (r > 1500) { const k = 1500 / r; const dx = t.x * (k - 1), dz = t.z * (k - 1); t.x += dx; t.z += dz; camera.position.x += dx; camera.position.z += dz; }
    if (t.y < 0) t.y = 0;
  });

  // ---------------------------------------------------------------- UI: pins, labels, panel, list, tools
  const pins = meta.pois.map(p => ({ ...p, pos: V(p.x, p.y, p.h) }));
  const home = { n: 0, key: 'home', cat: 'home', catName: 'Ваш адрес', title: meta.site.title, pos: V(106.6, 106.0, meta.site.h), h: meta.site.h, dist: 0, walk: 0, car: 0,
    lat: meta.site.lat, lon: meta.site.lon, desc: 'Башня C, резиденции и собственный парк на пересечении улиц Шивли и Чингиза Айтматова, у Малой кольцевой дороги. Метро «Бадамзар» — 9 минут пешком.' };
  ui.fill(pins, home, []);
  const streetSprites = await makeStreetLabels(meta.labels.map(l => ({ ...l, pos: V(l.x, l.y, 3) })));
  streetSprites.forEach(sp => scene.add(sp));

  let fly = null;
  function flyTo(target, dist, polar = .95, azimuth = null, dur = 1500) {
    const off = camera.position.clone().sub(controls.target);
    const sph = new THREE.Spherical().setFromVector3(off);
    const az = azimuth ?? sph.theta;
    const end = new THREE.Vector3().setFromSpherical(new THREE.Spherical(dist, polar, az)).add(target);
    fly = { t0: performance.now(), dur, p0: camera.position.clone(), t0v: controls.target.clone(), p1: end, t1: target.clone() };
  }
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  ui.onSelect = p => {
    if (!p) return;
    const d = p.key === 'tv' ? 620 : p.n === 0 ? 560 : 300;
    flyTo(p.pos.clone().setY(p.key === 'tv' ? 150 : p.n === 0 ? 70 : Math.max(8, p.h * .45)), d, p.key === 'tv' ? 1.1 : .98);
  };
  ui.onHome = () => { ui.select(null); flyTo(HOME.target, HOME.pos.distanceTo(HOME.target), 1.02); };
  ui.onNorth = () => {
    const off = camera.position.clone().sub(controls.target); const sph = new THREE.Spherical().setFromVector3(off);
    flyTo(controls.target.clone(), sph.radius, sph.phi, NORTH, 1100);
  };
  let playing = false;
  let sunrise = 6.5, sunset = 18.8;
  function setSeason(k, today) {
    season = k; const S = SEASONS[k];
    if (today) { const d = new Date(); simDay = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); }
    else { const y = new Date().getUTCFullYear(); simDay = Date.UTC(y, S.md[0], S.md[1]); }
    shared.uSnow.value = S.snow; shared.uSeason.value = S.mode; shared.uLeafAmt.value = S.leaf; shared.uGrassTint.value.set(...S.grass);
    shared.uCloudCover.value = S.cover;
    sunrise = findSun(0, 3, 10) ?? 6.5; sunset = findSun(0, 15, 21) ?? 18.8;
    ui.setSeason(k); ui.setPrecip(k, precipOn);
    setTime(hour, true);
  }
  ui.onSeason = k => { if (k === 'autumn' && storm) storm.unlock(); setSeason(k); };
  ui.onPrecip = () => { precipOn = !precipOn; ui.setPrecip(season, precipOn); if (storm) storm.unlock(); setTime(hour, true); };
  ui.onSound = () => { if (storm) { storm.unlock(); storm.setSound(!storm.sound); ui.setSound(storm.sound); } };
  ui.onMode = () => setTime(hour > sunrise + .5 && hour < sunset - .3 ? 22.5 : 13, true);
  ui.onTime = h => { playing = false; ui.setPlaying(false); setTime(h, true); };
  ui.onPreset = k => {
    playing = false; ui.setPlaying(false);
    if (k === 'now') { const t = new Date(Date.now() + 5 * 3600000); setSeason(seasonOf(t.getUTCMonth()), true); }
    setTime({ morning: sunrise + 1.2, day: 13, sunset: sunset - .15, night: 22.5, now: tashkentNow() }[k], true);
  };
  ui.onPlay = () => { playing = !playing; ui.setPlaying(playing); };
  setSeason('summer');
  setTime(13, true);
  ui.enable = on => { controls.enabled = on; };

  // ---------------------------------------------------------------- resize + render loop
  const stage = host.querySelector('.m3-stage');
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage); resize();

  setP(.96, 'Подготовка материалов');
  if (renderer.compileAsync) { try { await renderer.compileAsync(scene, camera); } catch (_) { /* optional */ } }

  // ---------------------------------------------------------------- real reflections for glass: cube map of the city captured at the complex
  const cubeRT = new THREE.WebGLCubeRenderTarget(MOBILE ? 128 : 256, { type: THREE.HalfFloatType });
  const cubeCam = new THREE.CubeCamera(3, 6000, cubeRT); cubeCam.position.set(70, 80, -70); scene.add(cubeCam);
  let reflRT = null;
  function captureReflections() {
    const hidden = [], hide = o => { if (o && o.visible) { o.visible = false; hidden.push(o); } };
    hide(complex.scene); streetSprites.forEach(hide); scene.traverse(o => { if (o.renderOrder === 4 || o.renderOrder === 6) hide(o); });
    const au = renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate = false;
    cubeCam.update(renderer, scene);
    renderer.shadowMap.autoUpdate = au; hidden.forEach(o => { o.visible = true; });
    const rt = pmrem.fromCubemap(cubeRT.texture);
    for (const m of glassMats) { m.envMap = rt.texture; m.needsUpdate = true; }
    if (reflRT) reflRT.dispose(); reflRT = rt;
  }
  function syncView() {
    skyMesh.position.copy(camera.position);
    if (mountainsMesh) {                              // far range: its base sits right behind the hazy edge of the city, fades out from high above
      const cy = camera.position.y;
      mountainsMesh.position.set(camera.position.x, cy + 266 - 6200 * cy / 2250, camera.position.z);
      mountainsMat.opacity = (mountainsMat.userData.op ?? .4) * (1 - sstep(520, 950, cy));
    }
    for (const pl of cloudLayers) pl.position.set(camera.position.x, pl.userData.h, camera.position.z);
    const k = 2 * Math.tan(camera.fov * Math.PI / 360) / Math.max(1, stage.clientHeight);
    for (const sp of streetSprites) {
      const d = camera.position.distanceTo(sp.position);
      sp.visible = d < 1750; sp.material.opacity = Math.min(1, (1750 - d) / 450);
      sp.scale.set(sp.userData.w, sp.userData.h, 1).multiplyScalar(k);
    }
  }
  let visible = true;
  new IntersectionObserver(es => { visible = es.some(e => e.isIntersecting); if (visible) loop(); if (storm) storm.audible(visible); }, { threshold: 0 }).observe(host);
  document.addEventListener('visibilitychange', () => { if (storm) storm.audible(!document.hidden && visible); });
  const tmp = new THREE.Vector3();
  let raf = 0, lastSun = new THREE.Vector3(1e9, 0, 0);
  function loop() {
    if (raf) return;
    const step = now => {
      raf = 0;
      if (!visible) return;
      shared.uTime.value = now / 1000;
      if (fly) {
        const k = Math.min(1, (now - fly.t0) / fly.dur), e = ease(k);
        camera.position.lerpVectors(fly.p0, fly.p1, e); controls.target.lerpVectors(fly.t0v, fly.t1, e);
        if (k >= 1) fly = null;
      }
      controls.update();
      syncView();
      if (playing) { const dt = Math.min(.1, (now - (step.last || now)) / 1000); setTime(hour + dt * .75); }
      step.last = now;
      const camD = camera.position.distanceTo(controls.target), sh = Math.min(1200, Math.max(260, camD * .8));
      if (Math.abs(sh - sun.shadow.camera.right) > 40) {
        Object.assign(sun.shadow.camera, { left: -sh, right: sh, top: sh, bottom: -sh }); sun.shadow.camera.updateProjectionMatrix();
      }
      if (traffic) traffic.update(Math.min(.1, (now - (step.lastT || now)) / 1000));
      if (precip) precip.update(Math.min(.1, (now - (step.lastT || now)) / 1000));
      if (storm) storm.update(Math.min(.1, (now - (step.lastT || now)) / 1000));
      if (life) life.update(Math.min(.1, (now - (step.lastT || now)) / 1000));
      if (needCapture && now - (step.lastCap || -1e9) > (playing ? 2500 : 250)) { captureReflections(); needCapture = false; step.lastCap = now; }
      step.lastT = now;
      if (controls.target.distanceTo(lastSun) > 60) { placeSun(); lastSun.copy(controls.target); }
      renderer.render(scene, camera);
      ui.update(camera, tmp, stage, northHeading());
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
  function northHeading() {
    const d = controls.target.clone().sub(camera.position);
    return Math.atan2(d.x, -d.z) + NORTH;                    // true azimuth of the view direction
  }
  // small debug handle (used for automated previews)
  window.__m3 = { renderer, scene, camera, controls, pins, traffic, setTime, setSeason, captureReflections, lifeStep: dt => life && life.update(dt), get storm() { return storm; }, get precipOn() { return precipOn; }, togglePrecip: () => ui.onPrecip(), cloudLayers, skyMesh, frame() { controls.update(); syncView(); if (precip) for (let i = 0; i < 8; i++) precip.update(.1); if (life) life.update(.05); placeSun(); renderer.render(scene, camera); ui.update(camera, tmp, stage, northHeading()); }, select: p => ui.select(p),
    jump(n) { const p = n ? pins.find(q => q.n === n) : home; ui.select(p); if (fly) { camera.position.copy(fly.p1); controls.target.copy(fly.t1); fly = null; } controls.update(); placeSun(); renderer.render(scene, camera); ui.update(camera, tmp, stage, northHeading()); } };
  setP(1, 'Готово');
  ui.ready();
  loop();
}

// ------------------------------------------------------------------ street names: canvas sprites (hidden by buildings)
async function makeStreetLabels(labels) {
  try { await document.fonts.load('700 26px Manrope'); } catch (_) { /* fallback font */ }
  return labels.map(l => {
    const px = 2, fs = 11 * px, pad = 9 * px, sp = 2.3 * px;
    const c = document.createElement('canvas'), g = c.getContext('2d');
    g.font = `700 ${fs}px Manrope, sans-serif`;
    const chars = [...l.text]; const w = chars.reduce((a, ch) => a + g.measureText(ch).width + sp, -sp);
    c.width = Math.ceil(w + pad * 2); c.height = Math.ceil(fs + pad * 1.2);
    g.font = `700 ${fs}px Manrope, sans-serif`; g.fillStyle = 'rgba(255,255,255,.86)'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#3d4b52'; g.textBaseline = 'middle'; let x = pad;
    for (const ch of chars) { g.fillText(ch, x, c.height / 2 + px); x += g.measureText(ch).width + sp; }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    const m = new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, sizeAttenuation: false, fog: false });
    const s = new THREE.Sprite(m); s.position.copy(l.pos); s.center.set(.5, 0); s.renderOrder = 5;
    s.userData = { w: c.width / px, h: c.height / px };
    return s;
  });
}

// ------------------------------------------------------------------ DOM user interface
function buildUI() {
  const $ = s => host.querySelector(s);
  const layer = $('.m3-layer'), panel = $('.m3-panel'), list = $('.m3-list ol'), bar = $('.m3-loading i'), pct = $('.m3-loading b'), txt = $('.m3-loading span');
  const needle = $('.m3-compass svg');
  const slider = $('.m3-slider'), clock = $('.m3-clock b'), sunIcon = $('.m3-clock i'), playBtn = $('.m3-play');
  const ICON = {
    sight: '<path d="M12 3l2.2 5.3 5.8.5-4.4 3.8 1.3 5.6L12 15.3 7.1 18.2l1.3-5.6L4 8.8l5.8-.5z"/>',
    park: '<path d="M12 3c-3 0-5 2.4-5 5.2 0 2.2 1.3 3.7 3 4.4V20h4v-7.4c1.7-.7 3-2.2 3-4.4C17 5.4 15 3 12 3z"/>',
    fun: '<circle cx="12" cy="10" r="6"/><path d="M12 4v12M6 10h12M8 20h8l-4-4z"/>',
    museum: '<path d="M3 9l9-5 9 5v2H3zM5 12h2v6H5zm4 0h2v6H9zm4 0h2v6h-2zm4 0h2v6h-2zM3 19h18v2H3z"/>',
    metro: '<path d="M4 18L8 6h1.5l2.5 7 2.5-7H16l4 12h-2.4l-2.3-7.2L12.8 18h-1.6L8.7 10.8 6.4 18z"/>',
    shop: '<path d="M6 7h12l-1 13H7zM9 7a3 3 0 016 0"/>',
    home: '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>',
  };
  const api = {
    pins: [], labels: [], sel: null,
    setClock(h, elev) {
      const hh = Math.floor(h), mm = Math.round((h - hh) * 60) % 60;
      clock.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      if (document.activeElement !== slider) slider.value = h.toFixed(2);
      sunIcon.textContent = elev > -1 ? '☀' : '☾';
    },
    setSound(on) { const b = $('.m3-sound'); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); b.querySelector('.ico-on').style.display = on ? '' : 'none'; b.querySelector('.ico-off').style.display = on ? 'none' : ''; },
    setPrecip(k, on) {
      $('.m3-sound').hidden = !(k === 'autumn' && on);
      const b = $('.m3-precip'); const has = k === 'winter' || k === 'autumn';
      b.hidden = !has; b.classList.toggle('on', on && has); b.setAttribute('aria-pressed', on && has);
      b.querySelector('span').textContent = k === 'winter' ? 'Снегопад' : 'Дождь';
      b.querySelector('.ico-snow').style.display = k === 'winter' ? '' : 'none'; b.querySelector('.ico-rain').style.display = k === 'winter' ? 'none' : '';
    },
    setSeason(k) { host.querySelectorAll('.m3-seasons button[data-s]').forEach(b => { const on = b.dataset.s === k; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }); host.dataset.season = k; },
    setPlaying(on) { playBtn.classList.toggle('on', on); playBtn.setAttribute('aria-pressed', on); playBtn.textContent = on ? '❚❚' : '▶'; },
    progress(p, t) { bar.style.transform = `scaleX(${p})`; pct.textContent = Math.round(p * 100); if (t) txt.textContent = t; },
    ready() { host.classList.remove('m3-booting'); host.classList.add('m3-ready'); },
    fill(pois, home, labels) {
      const mk = (p, cls) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'm3-pin ' + cls;
        b.innerHTML = p.n ? `<b>${p.n}</b><span>${p.title}</span>` : `<b><i>B</i>H</b><span>${p.title}</span>`;
        b.setAttribute('aria-label', p.title);
        b.addEventListener('click', ev => { ev.stopPropagation(); api.select(p); });
        layer.appendChild(b); return { p, el: b };
      };
      api.pins = [mk(home, 'm3-home'), ...pois.map(p => mk(p, 'cat-' + p.cat))];
      api.labels = labels.map(l => { const d = document.createElement('div'); d.className = 'm3-street'; d.textContent = l.text; layer.appendChild(d); return { p: l, el: d }; });
      $('.m3-list-toggle span').textContent = pois.length;
      list.innerHTML = pois.map(p => `<li><button type="button" data-n="${p.n}"><b>${p.n}</b><span>${p.title}</span><em>${p.walk <= 25 ? p.walk + ' мин' : p.car + ' мин · авто'}</em></button></li>`).join('');
      list.querySelectorAll('button').forEach(b => b.addEventListener('click', () => api.select(pois.find(p => p.n === +b.dataset.n))));
      $('.m3-close').addEventListener('click', () => api.select(null));
      $('.m3-home-btn').addEventListener('click', () => api.onHome && api.onHome());
      $('.m3-compass').addEventListener('click', () => api.onNorth && api.onNorth());
      $('.m3-mode').addEventListener('click', () => api.onMode && api.onMode());
      slider.addEventListener('input', () => api.onTime && api.onTime(parseFloat(slider.value)));
      host.querySelectorAll('.m3-presets button').forEach(b => b.addEventListener('click', () => api.onPreset && api.onPreset(b.dataset.k)));
      host.querySelectorAll('.m3-seasons button[data-s]').forEach(b => b.addEventListener('click', () => api.onSeason && api.onSeason(b.dataset.s)));
      $('.m3-precip').addEventListener('click', () => api.onPrecip && api.onPrecip());
      $('.m3-sound').addEventListener('click', () => api.onSound && api.onSound());
      playBtn.addEventListener('click', () => api.onPlay && api.onPlay());
      $('.m3-list-toggle').addEventListener('click', () => host.classList.toggle(matchMedia('(max-width: 820px)').matches ? 'm3-list-open' : 'm3-list-closed'));
      const act = $('.m3-activate'), exit = $('.m3-exit');
      if (TOUCH && !FULL) {
        host.classList.add('m3-touch');
        act.addEventListener('click', () => { host.classList.add('m3-active'); api.enable && api.enable(true); });
        exit.addEventListener('click', () => { host.classList.remove('m3-active'); api.enable && api.enable(false); });
      }
    },
    select(p) {
      api.sel = p;
      api.pins.forEach(x => x.el.classList.toggle('on', !!p && x.p === p));
      host.querySelectorAll('.m3-list button').forEach(b => b.classList.toggle('on', !!p && +b.dataset.n === p.n));
      if (!p) { panel.classList.remove('open'); host.classList.remove('m3-panel-open'); return; }
      const time = p.walk <= 25 ? `${p.walk} мин пешком` : `${p.car} мин на авто`;
      const dist = p.dist >= 1000 ? (p.dist / 1000).toFixed(1).replace('.', ',') + ' км' : Math.round(p.dist / 10) * 10 + ' м';
      panel.querySelector('.m3-p-kicker').textContent = p.n ? `${time} · ${dist}` : 'Вы здесь';
      panel.querySelector('.m3-p-route').hidden = !p.n;
      panel.querySelector('.m3-p-title').textContent = p.title;
      panel.querySelector('.m3-p-cat').innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[p.cat] || ICON.sight}</svg>${p.catName}`;
      panel.querySelector('.m3-p-desc').textContent = p.desc;
      panel.querySelector('.m3-p-num').textContent = p.n ? String(p.n).padStart(2, '0') : 'H';
      panel.querySelector('.m3-p-route').href = `https://www.google.com/maps/dir/?api=1&origin=41.335006,69.291791&destination=${p.lat},${p.lon}&travelmode=${p.walk <= 25 ? 'walking' : 'driving'}`;
      panel.classList.add('open'); host.classList.add('m3-panel-open');
      if (api.onSelect) api.onSelect(p);
    },
    update(camera, tmp, stage, heading) {
      const w = stage.clientWidth, h = stage.clientHeight, cam = camera.position;
      for (const x of api.pins) {
        tmp.copy(x.p.pos).project(camera);
        const vis = tmp.z < 1 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1;
        x.el.style.display = vis ? '' : 'none';
        if (vis) x.el.style.transform = `translate(${(tmp.x * .5 + .5) * w}px, ${(-tmp.y * .5 + .5) * h}px)`;
      }
      for (const x of api.labels) {
        const d = cam.distanceTo(x.p.pos);
        tmp.copy(x.p.pos).project(camera);
        const vis = tmp.z < 1 && d < 1700 && Math.abs(tmp.x) < 1 && Math.abs(tmp.y) < 1;
        x.el.style.display = vis ? '' : 'none';
        if (vis) { x.el.style.transform = `translate(${(tmp.x * .5 + .5) * w}px, ${(-tmp.y * .5 + .5) * h}px)`; x.el.style.opacity = d > 1200 ? (1700 - d) / 500 : 1; }
      }
      needle.style.transform = `rotate(${-heading}rad)`;
    },
  };
  return api;
}
