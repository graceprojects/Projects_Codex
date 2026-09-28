import * as THREE from 'three';
import {OrbitControls} from './assets/vendor/OrbitControls.js';

export function createModel(host,data){
 const scene=new THREE.Scene();scene.background=new THREE.Color('#fcfbf9');
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;host.append(renderer.domElement);
 renderer.domElement.setAttribute('aria-label','Интерактивная 3D-модель квартиры A3. Потяните для вращения.');renderer.domElement.setAttribute('role','img');
 const camera=new THREE.PerspectiveCamera(34,1,.1,150);const initial=new THREE.Vector3(10.5,15,13.5);camera.position.copy(initial);
 const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,0,0);controls.enableDamping=true;controls.dampingFactor=.12;controls.maxPolarAngle=Math.PI*.43;controls.minPolarAngle=.15;controls.minDistance=9;controls.maxDistance=35;controls.enablePan=false;
 scene.add(new THREE.HemisphereLight(0xffffff,0xd8cabb,1.5));
 const sun=new THREE.DirectionalLight(0xfff7eb,2);sun.position.set(-6,13,-8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-10;sun.shadow.camera.right=10;sun.shadow.camera.top=10;sun.shadow.camera.bottom=-10;sun.shadow.normalBias=.035;sun.shadow.bias=-.0001;sun.shadow.radius=4;scene.add(sun);
 const fill=new THREE.DirectionalLight(0xffffff,.7);fill.position.set(6,9,7);scene.add(fill);
 const mats={};function mat(color){return mats[color]||(mats[color]=new THREE.MeshStandardMaterial({color,roughness:.85,metalness:0}))}
 const furnitureGroup=new THREE.Group();scene.add(furnitureGroup);
 const wx=x=>x/100-3.8,wz=y=>y/100-4.85;
 function box(x,y,w,d,h,color,z=0,parent=scene){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w/100,h/100,d/100),mat(color));mesh.position.set(wx(x+w/2),z/100+h/200,wz(y+d/2));mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh}
 function cyl(x,y,r,h,color,z=0,parent=furnitureGroup){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r/100,r/100,h/100,40),mat(color));mesh.position.set(wx(x),z/100+h/200,wz(y));mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh}
 function floor(poly,color,height=0){const shape=new THREE.Shape();poly.forEach(([x,y],i)=>i?shape.lineTo(wx(x),-wz(y)):shape.moveTo(wx(x),-wz(y)));shape.closePath();const m=new THREE.Mesh(new THREE.ShapeGeometry(shape),mat(color));m.rotation.x=-Math.PI/2;m.position.y=height;m.receiveShadow=true;scene.add(m)}
 box(0,0,760,970,15,'#d7c9bb',-16);
 data.rooms.forEach(r=>floor(r.poly,r.fill,.002));
 // Quiet floorboard joints, confined to each room polygon.
 for(const r of data.rooms.filter(r=>['living','bedroom','hall'].includes(r.id))){const xs=r.poly.map(p=>p[0]),ys=r.poly.map(p=>p[1]);const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);for(let x=x0+18;x<x1;x+=18)box(x,y0,.5,y1-y0,.15,'#ded5c8',.2)}
 for(let y=690;y<910;y+=40){box(345,y,163,.4,.15,'#dce0dc',.2)}
 // Cutaway wall height makes every room visible; it is not a construction model.
 data.walls.forEach(([x1,y1,x2,y2,t,h])=>{const len=Math.hypot(x2-x1,y2-y1),height=h<100?60:145;const m=new THREE.Mesh(new THREE.BoxGeometry(len/100,height/100,t/100),mat('#f7f4ed'));m.position.set(wx((x1+x2)/2),height/200,wz((y1+y2)/2));m.rotation.y=-Math.atan2(y2-y1,x2-x1);m.castShadow=true;m.receiveShadow=true;scene.add(m);const top=new THREE.Mesh(new THREE.BoxGeometry(len/100,.014,t/100),mat('#c7b7a6'));top.position.copy(m.position);top.position.y=height/100+.01;top.rotation.copy(m.rotation);scene.add(top)});
 for(const c of data.columns||[])box(c.x,c.y,c.w,c.d,145,'#eee9df');
 const glass=new THREE.MeshPhysicalMaterial({color:'#d5e7e6',transparent:true,opacity:.32,roughness:.08,metalness:0,side:THREE.DoubleSide,depthWrite:false});
 data.windows.forEach(w=>{if(w.h)box(w.x,w.y-6,w.w,12,55,'#f7f4ed');const g=new THREE.Mesh(new THREE.BoxGeometry(w.w/100,1.3,.025),glass);g.position.set(wx(w.x+w.w/2),.75,wz(w.y));scene.add(g);for(const x of [w.x,w.x+w.w/2,w.x+w.w])box(x,w.y-3,2,6,145,'#8a8d80');box(w.x,w.y-3,w.w,6,2,'#8a8d80',143)});
 for(const f of data.furniture){const{x,y,w,d,h,type}=f;const b=(xx,yy,ww,dd,hh,c,zz=0)=>box(xx,yy,ww,dd,hh,c,zz,furnitureGroup);
  if(type==='sofa'){b(x,y,w,d,25,'#b4aa98',13);b(x,y,18,d,68,'#dbd0bf');b(x,y,w,16,55,'#dbd0bf');b(x,y+d-16,w,16,55,'#dbd0bf');for(let i=0;i<3;i++){b(x+20,y+20+i*(d-40)/3,w-26,(d-45)/3,15,'#eee5d5',38);b(x+18,y+24+i*(d-40)/3,12,(d-50)/3,25,'#e8ddcc',52)}}
  else if(type==='bed'){b(x-3,y-3,w+6,d+6,27,'#b49a80',6);b(x,y,w,d,21,'#f8f5ed',33);b(x-5,y-4,8,d+8,95,'#bda991');b(x+9,y+7,32,d/2-12,13,'#fffdf7',54);b(x+9,y+d/2+5,32,d/2-12,13,'#fffdf7',54);b(x+75,y,w-75,d,8,'#cbbca4',54);b(x+w-47,y,30,d,4,'#9d8569',62)}
  else if(type==='dining'){cyl(x+w/2,y+d/2,44,5,'#cdb799',70);cyl(x+w/2,y+d/2,15,70,'#bba185');for(const [dx,dy]of [[34,-17],[34,83],[-17,34],[83,34]]){b(x+dx,y+dy,31,31,6,'#e4d9c8',43);b(x+dx,y+dy+25,31,6,35,'#c7b69d',43);b(x+dx+5,y+dy+5,3,20,43,'#bca588');b(x+dx+23,y+dy+5,3,20,43,'#bca588')}}
  else if(type==='coffee'){const m=cyl(x+w/2,y+d/2,w/2,5,'#bb9f7d',h-5);m.scale.z=d/w;cyl(x+w/2,y+d/2,14,h-5,'#b49a79');cyl(x+w/2,y+d/2,10,8,'#f6f2e8',h)}
  else if(type==='counter'){b(x,y,w,d,h,'#cfc6b8');b(x-1,y-1,w+2,d+2,4,'#f4f0e7',h);if(w<d){b(x+5,y+25,w-10,62,2,'#6c665b',h+4);for(let i=0;i<2;i++)for(let j=0;j<2;j++)cyl(x+17+i*22,y+40+j*28,8,1,'#b9b8ad',h+6)}else{b(x+w*.5,y+6,55,34,2,'#c1c9c7',h+4);b(x+w*.5+7,y+11,41,24,1,'#e9eeeb',h+6);b(x+w*.5+26,y+5,3,3,24,'#93968d',h+6)}}
  else if(type==='bath'){b(x,y,w,d,46,'#fffdf7');b(x+9,y+9,w-18,d-18,2,'#dbe4df',46)}
  else if(type==='shower'){b(x,y,w,d,7,'#f9faf7');b(x+w-4,y,3,d,100,'#dce5df',7)}
  else if(type==='wc'){b(x,y,w,15,74,'#fffdf9');cyl(x+w/2,y+d/2,18,40,'#fffdf9');cyl(x+w/2,y+d/2,12,1,'#dce4df',40)}
  else if(type==='sink'){b(x,y,w,d,h,'#bca78e');cyl(x+w/2,y+d/2,20,12,'#fffdf8',h)}
  else if(type==='wardrobe'||type==='closet'){b(x,y,w,d,140,'#c4b29a');b(x-1,y,w+2,2,140,'#d1c1a9')}
  else{b(x,y,w,d,h,type==='console'?'#bca88c':'#d0bea5')}
 }
 // Balcony uses the exact source footprint; no invented outdoor furniture.
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({opacity:.1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.18;ground.receiveShadow=true;scene.add(ground);
 let enabled=true,raf;function draw(){raf=requestAnimationFrame(draw);if(!enabled)return;controls.update();renderer.render(scene,camera)}
 function resize(){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.render(scene,camera)}
 const observer=new ResizeObserver(resize);observer.observe(host);resize();draw();
 return {resize,active:v=>enabled=v,furniture:v=>furnitureGroup.visible=v,zoom:v=>{camera.zoom=Math.max(.5,Math.min(2.8,camera.zoom*v));camera.updateProjectionMatrix()},reset:()=>{camera.position.copy(initial);controls.target.set(0,0,0);camera.zoom=1;camera.updateProjectionMatrix();controls.update()},rotate:()=>{const delta=camera.position.clone().sub(controls.target);delta.applyAxisAngle(new THREE.Vector3(0,1,0),Math.PI/4);camera.position.copy(controls.target).add(delta);controls.update()},dispose:()=>{cancelAnimationFrame(raf);observer.disconnect();controls.dispose();scene.traverse(o=>o.geometry?.dispose());Object.values(mats).forEach(m=>m.dispose());glass.dispose();renderer.dispose()}};
}
