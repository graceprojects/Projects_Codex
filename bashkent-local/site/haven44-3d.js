import * as THREE from './assets/vendor/three.module.js';
import {OrbitControls} from './assets/vendor/OrbitControls.js';

// The approved A3 / 44 model shares the PDF coordinates used by the 2D plan.
export function createApartment3D(host, model, rooms, onRoom, onZoom) {
  const renderer = new THREE.WebGLRenderer({antialias:true, alpha:false});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-label','3D-модель квартиры A3 / 44. Потяните для вращения, колесо — масштаб.');
  canvas.setAttribute('role','img');
  canvas.tabIndex = 0;
  host.replaceChildren(canvas);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#ffffff');
  const camera = new THREE.OrthographicCamera(-8,8,8,-8,.1,120);
  const controls = new OrbitControls(camera,canvas);
  controls.enableDamping = true;
  controls.dampingFactor = .09;
  controls.minPolarAngle = .001;
  controls.maxPolarAngle = Math.PI / 2.08;
  controls.minZoom = .25;
  controls.maxZoom = 6;
  const apartment = new THREE.Group();
  scene.add(apartment);
  const materials = {};
  for (const [name,[color,roughness]] of Object.entries(model.materials)) {
    const material = new THREE.MeshStandardMaterial({color,roughness,metalness:name==='bronze'?.25:0,side:THREE.DoubleSide});
    if (name==='glass') Object.assign(material,{transparent:true,opacity:.17,depthWrite:false});
    materials[name] = material;
  }
  for (const chunk of model.meshes) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(chunk.positions,3));
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute(chunk.normals,3));
    const mesh = new THREE.Mesh(geometry,materials[chunk.material]);
    mesh.userData.group = chunk.group;
    mesh.castShadow = chunk.material!=='glass';
    mesh.receiveShadow = true;
    apartment.add(mesh);
  }
  const bounds = new THREE.Box3().setFromObject(apartment);
  scene.add(new THREE.HemisphereLight('#fff8ee','#e2dcd2',2.1));
  const sun = new THREE.DirectionalLight('#fff8ef',3.1);
  sun.position.set(-8,18,9);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-10,right:10,top:10,bottom:-10,near:1,far:45});
  sun.shadow.bias=-.00035;sun.shadow.normalBias=.02;sun.shadow.radius=4;scene.add(sun);
  const fill = new THREE.DirectionalLight('#ffffff',.7);
  fill.position.set(7,10,-7);scene.add(fill);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({opacity:.1}));
  ground.rotation.x=-Math.PI/2;ground.position.y=-.225;ground.receiveShadow=true;scene.add(ground);

  let active=false,raf=0,fitZoom=1,preset='iso',selection=null;
  const selectionGroup=new THREE.Group();scene.add(selectionGroup);
  const world=([x,z],y=.06)=>new THREE.Vector3((x-1065)/18.33,y,(z-641)/18.33);
  function clearSelection(){for(const mesh of [...selectionGroup.children]){mesh.geometry.dispose();mesh.material.dispose();selectionGroup.remove(mesh)}}
  function selectRoom(id){
    selection=id;clearSelection();const room=rooms.find(r=>r.id===id);if(!room)return;
    const points=room.pts.map(p=>world(p));points.push(points[0].clone());
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:'#84482e',depthTest:false,transparent:true,opacity:.85}));
    line.renderOrder=10;selectionGroup.add(line);
    const shape=new THREE.Shape(room.pts.map(([x,z])=>new THREE.Vector2((x-1065)/18.33,-(z-641)/18.33)));
    const surface=new THREE.Mesh(new THREE.ShapeGeometry(shape),new THREE.MeshBasicMaterial({color:'#b47d51',transparent:true,opacity:.2,depthWrite:false,side:THREE.DoubleSide}));
    surface.rotation.x=-Math.PI/2;surface.position.y=.055;selectionGroup.add(surface);
  }
  function notifyZoom(){onZoom(Math.round(camera.zoom/fitZoom*100))}
  function fit(resetZoom=false){
    const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;
    const ratio=resetZoom?1:camera.zoom/fitZoom;
    renderer.setSize(w,h,false);const aspect=w/h;
    camera.left=-7*aspect;camera.right=7*aspect;camera.top=7;camera.bottom=-7;
    camera.updateMatrixWorld();let x=0,y=0;
    for(const xx of [bounds.min.x,bounds.max.x])for(const yy of [bounds.min.y,bounds.max.y])for(const zz of [bounds.min.z,bounds.max.z]){
      const p=new THREE.Vector3(xx,yy,zz).applyMatrix4(camera.matrixWorldInverse);x=Math.max(x,Math.abs(p.x));y=Math.max(y,Math.abs(p.y));
    }
    fitZoom=Math.min(7*aspect/(x*1.12),7/(y*1.12));
    camera.zoom=THREE.MathUtils.clamp(fitZoom*ratio,.25,6);camera.updateProjectionMatrix();notifyZoom();
    if(active)renderer.render(scene,camera);
  }
  function reset(next='iso'){
    // Discard residual orbit inertia so reset always returns the same camera.
    const damping=controls.enableDamping;controls.enableDamping=false;controls.update();
    preset=next;controls.target.set(0,.3,0);camera.up.set(0,1,0);
    camera.position.set(...(next==='top'?[0,26,.001]:[11,19,19]));
    camera.lookAt(controls.target);controls.update();controls.enableDamping=damping;fit(true);
  }
  function frame(){if(!active)return;controls.update();renderer.render(scene,camera);raf=requestAnimationFrame(frame)}
  function setActive(value){
    if(active===value)return;active=value;controls.enabled=value;
    if(value){fit();frame()}else cancelAnimationFrame(raf);
  }
  function zoom(factor){camera.zoom=THREE.MathUtils.clamp(camera.zoom*factor,.25,6);camera.updateProjectionMatrix();notifyZoom()}
  controls.addEventListener('change',notifyZoom);
  const observer=new ResizeObserver(()=>fit());observer.observe(host);
  const ray=new THREE.Raycaster(),point=new THREE.Vector3(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  function contains(x,z,points){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const [xi,zi]=points[i],[xj,zj]=points[j];if(((zi>z)!==(zj>z))&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)inside=!inside}return inside}
  let down=null,moved=false;const pointers=new Set();
  canvas.addEventListener('pointerdown',e=>{pointers.add(e.pointerId);if(pointers.size===1){down=[e.clientX,e.clientY];moved=false}else moved=true});
  canvas.addEventListener('pointermove',e=>{if(down&&Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)moved=true});
  canvas.addEventListener('pointerup',e=>{
    pointers.delete(e.pointerId);
    if(down&&!moved&&e.button===0){const rect=canvas.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);if(ray.ray.intersectPlane(plane,point)){const room=rooms.find(r=>contains(point.x*18.33+1065,point.z*18.33+641,r.pts));if(room)onRoom(room.id)}}
    if(!pointers.size)down=null;
  });
  canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);down=null;moved=true});
  canvas.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();rotate(e.key==='ArrowLeft'?-Math.PI/8:Math.PI/8)}});
  function rotate(angle=Math.PI/4){if(preset==='top')reset('iso');const offset=camera.position.clone().sub(controls.target);offset.applyAxisAngle(new THREE.Vector3(0,1,0),angle);camera.position.copy(controls.target).add(offset);camera.lookAt(controls.target);controls.update()}
  function theme(name){
    const overrides=name==='sage'?{wallcap:'#a4b4a5',sand:'#b9c6b7',throw:'#6e8675',joinery:'#b9b9a1'}:name==='graphite'?{wallcap:'#686d68',sand:'#b9bcb7',throw:'#737b73',joinery:'#a9aa9e'}:{};
    for(const [key,[color]]of Object.entries(model.materials))materials[key].color.set(overrides[key]||color);
    if(selection)selectRoom(selection);
  }
  reset();
  return {
    active:setActive,zoom,reset:()=>reset(),top:()=>reset('top'),rotate,
    furniture:show=>apartment.children.forEach(m=>{if(m.userData.group==='furniture')m.visible=show}),
    room:selectRoom,theme,
    snapshot:()=>{renderer.render(scene,camera);return canvas.toDataURL('image/png')},
    dispose:()=>{setActive(false);observer.disconnect();controls.dispose();clearSelection();apartment.traverse(m=>m.geometry?.dispose());Object.values(materials).forEach(m=>m.dispose());ground.geometry.dispose();ground.material.dispose();renderer.dispose();canvas.remove()}
  };
}
