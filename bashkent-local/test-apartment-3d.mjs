import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import * as Three from './site/assets/vendor/three.module.js';import * as data from './site/apartment-data.js';
let scene,camera;const canvas={setAttribute(){}};
class Renderer{constructor(){this.domElement=canvas;this.shadowMap={}}setPixelRatio(){}setSize(){}render(s,c){scene=s;camera=c;s.updateMatrixWorld(true)}dispose(){}}
class Controls{constructor(c){this.target=new Three.Vector3()}update(){}dispose(){}}
globalThis.__testThree={...Three,WebGLRenderer:Renderer};globalThis.__testControls=Controls;globalThis.devicePixelRatio=1;globalThis.ResizeObserver=class{observe(){}disconnect(){}};globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
let code=await fs.readFile(new URL('./site/apartment-3d.js',import.meta.url),'utf8');code=code.replace("import * as THREE from 'three';",'const THREE=globalThis.__testThree;').replace("import {OrbitControls} from './assets/vendor/OrbitControls.js';",'const OrbitControls=globalThis.__testControls;');
const {createModel}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));const m=createModel({clientWidth:650,clientHeight:690,append(){}},data);
let meshes=0;scene.traverse(o=>{if(o.isMesh){meshes++;assert.ok(o.position.toArray().every(Number.isFinite));const positions=o.geometry.getAttribute('position');assert.ok([...positions.array].every(Number.isFinite));o.geometry.computeBoundingBox();assert.ok(!o.geometry.boundingBox.isEmpty())}});
assert.ok(meshes>100);const furnitureGroup=scene.children.find(o=>o.isGroup);m.furniture(false);assert.equal(furnitureGroup.visible,false);m.furniture(true);assert.equal(furnitureGroup.visible,true);m.zoom(1.25);m.zoom(1.25);assert.equal(camera.zoom,1.5625);m.reset();assert.equal(camera.zoom,1);const before=camera.position.clone();m.rotate();assert.ok(camera.position.distanceTo(before)>1);m.dispose();
console.log(`PASS: ${meshes} valid Three.js meshes, furniture visibility, incremental zoom, reset, rotation, disposal. WebGL renderer and controls mocked; visual browser check still required.`);
