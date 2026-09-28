const scenes = [
  {name:'Корпус A',short:'A',eyebrow:'01 — РЕЗИДЕНЦИИ',title:'Ближе<br><em>к спокойствию.</em>',body:'Камерный корпус у зелёного бульвара. Вид на тихий внутренний двор и ритм города.',description:'Уютный жилой корпус у прогулочного бульвара. Внизу — зелёный двор, выше — широкие виды на город.',floors:12,format:'Резиденции',apartments:6,
    left:{top:[[250,350],[505,345]],bottom:[[250,575],[505,578]],path:'M250 358 L318 355 L322 344 L336 340 L495 338 L500 345 L503 500 L486 510 L484 578 L252 575 Z',x:375,y:460},
    right:{top:[[256,350],[506,345]],bottom:[[258,572],[506,575]],path:'M256 358 L318 355 L322 343 L340 338 L498 338 L505 345 L506 495 L484 505 L482 575 L258 572 Z',x:380,y:460}},
  {name:'Корпус B',short:'B',eyebrow:'02 — РЕЗИДЕНЦИИ',title:'Пространство<br><em>для своего ритма.</em>',body:'Светлые резиденции в сердце ансамбля. Приватность, воздух и выразительная архитектура.',description:'Резиденции в центре архитектурного ансамбля, где городские маршруты встречаются с приватным пространством.',floors:14,format:'Резиденции',apartments:5,
    left:{top:[[571,361],[700,366],[720,376],[928,388]],bottom:[[571,527],[700,580],[712,590],[928,652]],path:'M571 361 L700 366 L704 372 L720 376 L820 382 L870 384 L924 388 L928 400 L928 652 L905 650 L820 628 L760 606 L712 590 L700 580 L640 556 L571 527 Z',x:750,y:490},
    right:{top:[[213,395],[310,383],[400,378]],bottom:[[213,576],[310,565],[400,548]],path:'M213 457 L222 455 L222 407 L228 391 L280 386 L330 381 L372 376 L398 378 L400 548 L360 555 L310 565 L255 580 L214 578 Z',x:305,y:480}},
  {name:'Башня C',short:'C',eyebrow:'03 — БАШНЯ',title:'Горизонты<br><em>вашего дома.</em>',body:'Панорамная башня — знаковый силуэт HAVEN и самая выразительная точка обзора.',description:'Знаковая башня с панорамным остеклением, открытыми горизонтами и особенным чувством высоты.',floors:28,format:'Панорама',apartments:4,
    left:{top:[[553,112],[667,112]],bottom:[[553,487],[667,487]],path:'M553 488 L553 162 L546 156 L541 146 L540 136 L543 125 L550 116 L560 110 L570 108 L580 110 L588 114 L600 106 L620 90 L640 82 L655 80 L664 83 L667 92 L667 398 L670 402 L673 410 L670 418 L662 420 L662 485 L655 488 Z',x:610,y:270},
    right:{top:[[545,120],[659,120]],bottom:[[545,481],[659,481]],path:'M545 482 L545 178 L538 172 L532 163 L530 152 L533 141 L540 133 L550 129 L560 129 L570 132 L578 138 L590 128 L600 120 L612 111 L630 104 L648 101 L656 103 L659 110 L659 400 L662 405 L663 418 L658 424 L651 426 L651 478 L645 482 Z',x:602,y:280}}
];
// extra buildings selectable at a stop (stop index → list)
const altBuildings={0:[{name:'Корпус D',short:'D',eyebrow:'01 — РЕЗИДЕНЦИИ D',title:'Тихий двор<br><em>в сердце квартала.</em>',body:'Корпус D смотрит на парковую аллею — спокойные резиденции в шаге от бульвара.',description:'Резиденции у парковой аллеи: тихие дворы, светлые лобби и виды на зелёный бульвар.',floors:16,format:'Резиденции',apartments:6,
    left:{top:[[520,345],[682,345]],bottom:[[520,550],[682,533]],path:'M520 552 L520 368 L533 364 L535 348 L548 346 L549 337 L682 337 L682 530 L660 535 L580 540 L560 553 Z',x:600,y:440},
    right:{top:[[515,345],[678,345]],bottom:[[515,550],[678,530]],path:'M515 552 L515 400 L522 395 L522 366 L535 362 L537 348 L548 346 L549 337 L680 337 L678 500 L665 525 L640 537 L560 540 L545 552 Z',x:597,y:440}}]};
let pick=null;
const cur=()=>pick||scenes[active];

const experience=document.querySelector('.experience');
const video=document.getElementById('orbit-video');
const outline=document.getElementById('building-outline');
const paths=[...outline.querySelectorAll('path')];
const target=document.getElementById('outline-target');
const targetLabel=document.getElementById('target-label');
const outlineHit=document.getElementById('outline-hit');
const floorBands=document.getElementById('floor-bands');
const floorHoverLabel=document.getElementById('floor-hover-label');
const routeButtons=[...document.querySelectorAll('.route-dot')];
const orbitButtons=[...document.querySelectorAll('.orbit-choice')];
const sceneCopy=document.getElementById('scene-copy');
const selector=document.getElementById('selector');
const planModal=document.getElementById('plan-modal');
const videoFiles={left:'assets/video/orbit-left.mp4',right:'assets/video/orbit-right.mp4'};
const videoBlobs={};
let route='left',active=0,selectedFloor=6,scrollTimer=0,seekTarget=0,seekPending=false;
let wheelLocked=false,wheelQuietTimer=0,hoveredFloor=null,floorBounds=null;
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;

function positionFor(i){return experience.offsetTop+i*window.innerHeight}
function progress(){return Math.min(2,Math.max(0,(window.scrollY-experience.offsetTop)/window.innerHeight))}
const sceneIndex=document.getElementById('scene-index');
function copyMarkup(s){const lines=s.title.split('<br>').map((l,k)=>`<span class="rv" style="--d:${.08+k*.08}s"><span>${l}</span></span>`).join('');return `<span class="rv scene-kicker-wrap" style="--d:0s"><span class="scene-kicker">${s.eyebrow}</span></span><h2>${lines}</h2><span class="rv" style="--d:.3s"><span><p>${s.body}</p></span></span>`}
function setCopy(i,instant=false,b=null){const s=b||scenes[i];if(instant){sceneCopy.innerHTML=copyMarkup(s);requestAnimationFrame(()=>sceneCopy.classList.add('in'));return}sceneCopy.classList.remove('in');sceneCopy.classList.add('out');sceneIndex.classList.add('swap');setTimeout(()=>{sceneCopy.innerHTML=copyMarkup(s);sceneCopy.classList.remove('out');sceneIndex.textContent=`0${i+1}`;sceneIndex.classList.remove('swap');requestAnimationFrame(()=>requestAnimationFrame(()=>sceneCopy.classList.add('in')))},420)}
function updateSelection(i,showOutline=true){if(typeof syncArrows==='function')syncArrows(i);if(active!==i){active=i;pick=null;setCopy(i)}document.getElementById('view-counter').textContent=`0${i+1} / 03`;routeButtons.forEach((b,n)=>{b.classList.toggle('active',n===i);b.setAttribute('aria-current',n===i?'step':'false')});document.getElementById('route-progress').style.height=`${i*50}%`;const shape=cur()[route];renderAlts();paths.forEach(p=>p.setAttribute('d',shape.path));outlineHit.setAttribute('d',shape.path);document.getElementById('floor-clip-path').setAttribute('d',shape.path);renderFloorBands();const mobile=window.innerWidth<=620;const visibleWidth=mobile?720*window.innerWidth/Math.max(560,window.innerHeight):1280;const fractions=route==='left'?[.21,.63,.5]:[.21,.19,.5];const fraction=mobile?fractions[i]:.5;const cropX=mobile?(1280-visibleWidth)*fraction:0;outline.setAttribute('viewBox',`${cropX} 0 ${visibleWidth} 720`);video.style.objectPosition=`${fraction*100}% center`;document.querySelector('.video-poster').style.backgroundPosition=`${fraction*100}% center`;lastCrop={cropX,visibleWidth};renderAltPills();target.style.left=`${(shape.x-cropX)/visibleWidth*100}%`;target.style.top=`${shape.y/7.2}%`;targetLabel.textContent=cur().name.toUpperCase();if(showOutline){outline.classList.remove('is-visible');target.classList.remove('is-visible');requestAnimationFrame(()=>requestAnimationFrame(()=>{outline.classList.add('is-visible');target.classList.add('is-visible')}))}}
function lineY(line,x){let a=line[0],b=line[1];for(let k=1;k<line.length;k++){a=line[k-1];b=line[k];if(x<=b[0])break}return a[1]+(b[1]-a[1])*(x-a[0])/((b[0]-a[0])||1)}
function levelY(shape,x,t){const top=lineY(shape.top,x);return top+(lineY(shape.bottom,x)-top)*t}
function renderFloorBands(){const shape=cur()[route],box=outlineHit.getBBox(),count=cur().floors-1;const xs=[...new Set([box.x-30,...shape.top.map(p=>p[0]),...shape.bottom.map(p=>p[0]),box.x+box.width+30])].sort((a,b)=>a-b);const row=t=>xs.map(x=>[x,levelY(shape,x,t)]);const pts=a=>a.map(p=>`${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');floorBounds={count};let markup='';for(let n=0;n<count;n++){const a=row(n/count),b=row((n+1)/count).reverse();markup+=`<polygon data-floor="${cur().floors-n}" points="${pts(a.concat(b))}" class="floor-band"/>`;if(n)markup+=`<polyline points="${pts(a)}"/>`}floorBands.innerHTML=markup;hoveredFloor=null;floorHoverLabel.classList.remove('visible');floorBands.classList.remove('visible')}
function showFloorHover(event){if(!outline.classList.contains('is-visible')||!floorBounds)return;floorBands.classList.add('visible');const point=outline.createSVGPoint();point.x=event.clientX;point.y=event.clientY;const local=point.matrixTransform(outline.getScreenCTM().inverse());const shape=cur()[route],top=lineY(shape.top,local.x),t=(local.y-top)/(lineY(shape.bottom,local.x)-top);const index=Math.max(0,Math.min(floorBounds.count-1,Math.floor(t*floorBounds.count)));hoveredFloor=cur().floors-index;floorBands.querySelectorAll('.floor-band').forEach(b=>b.classList.toggle('active',Number(b.dataset.floor)===hoveredFloor));floorHoverLabel.textContent=`${String(hoveredFloor).padStart(2,'0')} ЭТАЖ  ↗`;floorHoverLabel.style.left=`${Math.min(window.innerWidth-145,event.clientX+18)}px`;floorHoverLabel.style.top=`${Math.max(20,event.clientY-17)}px`;floorHoverLabel.classList.add('visible')}
const altHits=document.getElementById('alt-hits');
function renderAlts(){const list=[scenes[active],...(altBuildings[active]||[])].filter(b=>b!==cur());altHits.innerHTML=list.map((b,k)=>`<path class="alt-hit" data-k="${k}" d="${b[route].path}"></path>`).join('');[...altHits.children].forEach((p,k)=>{const b=list[k];p.addEventListener('pointerenter',e=>{p.classList.add('hover');floorHoverLabel.textContent=`${b.name.toUpperCase()}  ↗`;floorHoverLabel.classList.add('visible','alt')});p.addEventListener('pointermove',e=>{floorHoverLabel.style.left=`${Math.min(window.innerWidth-160,e.clientX+18)}px`;floorHoverLabel.style.top=`${Math.max(20,e.clientY-17)}px`});p.addEventListener('pointerleave',()=>{p.classList.remove('hover');floorHoverLabel.classList.remove('visible','alt')});p.addEventListener('click',e=>{e.stopPropagation();selectBuilding(b)})})}
let lastCrop={cropX:0,visibleWidth:1280};const altTargets=document.getElementById('alt-targets');
function renderAltPills(){const list=[scenes[active],...(altBuildings[active]||[])].filter(b=>b!==cur());altTargets.innerHTML='';list.forEach(b=>{const p=b[route],el=document.createElement('button');el.type='button';el.className='outline-target alt-target';el.innerHTML=`<span class="target-ring">+</span><span>${b.name.toUpperCase()}</span>`;el.setAttribute('aria-label',`Выбрать ${b.name}`);el.style.left=`${(p.x-lastCrop.cropX)/lastCrop.visibleWidth*100}%`;el.style.top=`${p.y/7.2}%`;el.addEventListener('click',()=>selectBuilding(b));el.addEventListener('pointerenter',()=>altHits.querySelectorAll('.alt-hit').forEach((h,k)=>h.classList.toggle('hover',h.getAttribute('d')===p.path)));el.addEventListener('pointerleave',()=>altHits.querySelectorAll('.alt-hit').forEach(h=>h.classList.remove('hover')));altTargets.appendChild(el)})}
function selectBuilding(b){floorHoverLabel.classList.remove('visible','alt');pick=b===scenes[active]?null:b;setCopy(active,false,cur());updateSelection(active,true)}
function hideFloorHover(){floorBands.classList.remove('visible');floorHoverLabel.classList.remove('visible');hoveredFloor=null}
outlineHit.addEventListener('pointerenter',showFloorHover);outlineHit.addEventListener('pointermove',showFloorHover);outlineHit.addEventListener('pointerleave',hideFloorHover);outlineHit.addEventListener('click',event=>{if(matchMedia('(hover: none)').matches){openSelector();return}showFloorHover(event);if(hoveredFloor){selectedFloor=hoveredFloor;renderPlan();planModal.classList.add('open');planModal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';floorHoverLabel.classList.remove('visible');planModal.querySelector('.icon-close').focus()}else openSelector()});
target.addEventListener('pointerenter',()=>floorBands.classList.add('visible'));target.addEventListener('pointerleave',()=>{if(!hoveredFloor)floorBands.classList.remove('visible')});
function seek(t){if(!video.duration||!Number.isFinite(video.duration))return;seekTarget=Math.min(video.duration-.08,Math.max(.08,t));if(video.seeking){seekPending=true;return}try{video.currentTime=seekTarget}catch{}}
video.addEventListener('seeked',()=>{if(seekPending){seekPending=false;if(Math.abs(video.currentTime-seekTarget)>.05)seek(seekTarget)}});
function syncVideo(){const p=progress();if(video.duration)seek((p/2)*(video.duration-.1));if(Math.abs(p-Math.round(p))>.04){outline.classList.remove('is-visible');target.classList.remove('is-visible')}const near=Math.round(p);if(!moving&&near!==active&&Math.abs(p-near)<.35)updateSelection(near,false)}
function onScroll(){scrollFx();if(window.scrollY<experience.offsetTop-window.innerHeight*.35||window.scrollY>experience.offsetTop+window.innerHeight*2.3)return;syncVideo();clearTimeout(scrollTimer);scrollTimer=setTimeout(settle,180)}
function settle(){if(moving)return;if(selector.classList.contains('open')||planModal.classList.contains('open'))return;const p=progress(),i=Math.round(p);if(Math.abs(p-i)>.05)return;updateSelection(i,true);if(video.duration)seek((i/2)*(video.duration-.1))}
window.addEventListener('scroll',onScroll,{passive:true});window.addEventListener('resize',()=>{updateSelection(active,outline.classList.contains('is-visible'));if(Math.abs(window.scrollY-positionFor(active))<window.innerHeight*.3)syncVideo()});
let moving=false,scrollAnim=0;
const easeInOut=t=>t<.5?8*t*t*t*t:1-Math.pow(-2*t+2,4)/2;
function animateScroll(to,dur,done){cancelAnimationFrame(scrollAnim);const from=window.scrollY,start=performance.now();if(reduce||Math.abs(to-from)<2){window.scrollTo({top:to,behavior:'instant'});done&&done();return}const step=now=>{const t=Math.min(1,(now-start)/dur);window.scrollTo({top:from+(to-from)*easeInOut(t),behavior:'instant'});if(t<1)scrollAnim=requestAnimationFrame(step);else done&&done()};scrollAnim=requestAnimationFrame(step)}
function goToStop(i){hideFloorHover();if(i!==active)pick=null;outline.classList.remove('is-visible');target.classList.remove('is-visible');const dist=Math.abs(window.scrollY-positionFor(i))/window.innerHeight;const dur=Math.min(2600,1100+dist*900);moving=true;experience.classList.add('is-moving');routeButtons.forEach((b,n)=>{b.classList.toggle('active',n===i);b.setAttribute('aria-current',n===i?'step':'false')});document.getElementById('view-counter').textContent=`0${i+1} / 03`;document.getElementById('route-progress').style.height=`${i*50}%`;experience.classList.remove('flash');void experience.offsetWidth;experience.classList.add('flash');if(i!==active)setCopy(i);active=i;clearTimeout(scrollTimer);animateScroll(positionFor(i),dur,()=>{moving=false;experience.classList.remove('is-moving');settle()})}
routeButtons.forEach((b,i)=>b.addEventListener('click',()=>goToStop(i)));
window.addEventListener('wheel',event=>{const top=experience.offsetTop,y=window.scrollY;if(y<top-2||y>top+window.innerHeight*2+2||selector.classList.contains('open')||planModal.classList.contains('open'))return;event.preventDefault();clearTimeout(wheelQuietTimer);wheelQuietTimer=setTimeout(()=>{wheelLocked=false},420);if(moving||wheelLocked||Math.abs(event.deltaY)<4)return;const direction=Math.sign(event.deltaY),next=Math.round(progress())+direction;if(next<0){wheelLocked=true;animateScroll(top-window.innerHeight,1200);return}if(next>2){wheelLocked=true;animateScroll(top+window.innerHeight*3,1200);return}goToStop(next)},{passive:false});
async function loadVideo(which){route=which;orbitButtons.forEach(b=>{const on=b.dataset.route===which;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on))});experience.classList.remove('video-ready');video.pause();video.poster=`assets/frames/${which}-${active}.jpg`;document.querySelector('.video-poster').style.backgroundImage=`url('assets/frames/${which}-${active}.jpg')`;updateSelection(active,true);try{if(!videoBlobs[which]){const response=await fetch(videoFiles[which]);if(!response.ok)throw Error('Video unavailable');videoBlobs[which]=URL.createObjectURL(await readWithProgress(response,p=>loaderProgress('video',p)))}if(route!==which)return;video.src=videoBlobs[which];video.load();}catch(err){console.warn('Video load failed:',err);loaderProgress('video',1)}}
video.addEventListener('loadedmetadata',()=>{seek((progress()/2)*(video.duration-.1));experience.classList.add('video-ready')});
orbitButtons.forEach(b=>b.addEventListener('click',()=>{if(b.dataset.route!==route){const stop=active;loadVideo(b.dataset.route);window.scrollTo({top:positionFor(stop),behavior:'instant'});requestAnimationFrame(()=>window.scrollTo({top:positionFor(stop),behavior:'instant'}))}}));

function openSelector(){const s=cur();selectedFloor=Math.min(6,s.floors);document.getElementById('panel-count').textContent=`0${active+1}`;document.getElementById('selector-title').textContent=s.name;document.getElementById('building-description').textContent=s.description;document.getElementById('building-floors').textContent=s.floors;document.getElementById('building-format').textContent=s.format;renderFloors();selector.classList.add('open');selector.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';selector.querySelector('.icon-close').focus()}
function closeSelector(){selector.classList.remove('open');selector.setAttribute('aria-hidden','true');if(!planModal.classList.contains('open'))document.body.style.overflow=''}
function renderFloors(){const list=document.getElementById('floor-list');list.innerHTML='';for(let floor=2;floor<=cur().floors;floor++){const b=document.createElement('button');b.type='button';b.textContent=String(floor).padStart(2,'0');b.className=floor===selectedFloor?'selected':'';b.setAttribute('aria-pressed',String(floor===selectedFloor));b.addEventListener('click',()=>{selectedFloor=floor;renderFloors()});list.appendChild(b)}document.getElementById('selected-floor-caption').textContent=`Этаж ${String(selectedFloor).padStart(2,'0')}`}
document.getElementById('select-building').addEventListener('click',openSelector);target.addEventListener('click',openSelector);document.querySelectorAll('[data-close]').forEach(x=>x.addEventListener('click',closeSelector));
document.getElementById('open-plan').addEventListener('click',()=>{renderPlan();planModal.classList.add('open');planModal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';planModal.querySelector('.icon-close').focus()});
function closePlan(){planModal.classList.remove('open');planModal.setAttribute('aria-hidden','true');if(!selector.classList.contains('open'))document.body.style.overflow=''}
document.querySelectorAll('[data-close-plan]').forEach(x=>x.addEventListener('click',closePlan));document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(arModal.classList.contains('open'))closeAR();else if(pano.isOpen())pano.close();else if(planModal.classList.contains('open'))closePlan();else if(selector.classList.contains('open'))closeSelector()}});

async function renderPlan(){await ensurePlan(cur(),selectedFloor);const s=cur(),f=String(selectedFloor).padStart(2,'0');document.getElementById('plan-title').textContent=`${s.name} · Этаж ${f}`;fillAptCard(s,selectedFloor);fillLocation(s,selectedFloor);document.getElementById('detail-building').textContent=s.short;document.getElementById('detail-floor').textContent=f;document.getElementById('detail-apartments').textContent=s.apartments;document.getElementById('pano-title').textContent=`${s.name} · Этаж ${f} — вид из окна`;planRender.classList.remove('webgl');if(view3d)view3d.ready=false;document.getElementById('floorplan-render').innerHTML=floorPlan3d(active,selectedFloor);planView={rot:-32,tilt:56};applyPlanView(false);setPlanMode('3d');spinPlan();if(sunOn)updateSun();mountThree()}

// ---- 3D floor plan (CSS 3D, no dependencies) ----
const WALL=58,THICK=9;let lastFloorSvg='';
let planView={rot:-32,tilt:56};
function wallBox(x1,y1,x2,y2,h,t,cls='',z=0){const len=Math.hypot(x2-x1,y2-y1),ang=Math.atan2(y2-y1,x2-x1)*180/Math.PI;return `<div class="w3 ${cls}" style="left:${x1}px;top:${y1}px;width:${len.toFixed(1)}px;transform:rotate(${ang.toFixed(2)}deg) translateZ(${z}px)"><i class="w3-top" style="height:${t}px;transform:translateY(${-t/2}px) translateZ(${h}px)"></i><i class="w3-side" style="height:${h}px;transform:translateY(${-t/2}px) rotateX(90deg)"></i><i class="w3-side w3-b" style="height:${h}px;transform:translateY(${t/2}px) rotateX(90deg)"></i></div>`}
function cube(x,y,w,d,h,cls,z=0){return `<div class="c3 ${cls}" style="left:${x}px;top:${y}px;width:${w}px;height:${d}px;transform:translateZ(${z}px)"><i class="c3-top" style="width:${w}px;height:${d}px;transform:translateZ(${h}px)"></i><i class="c3-s" style="width:${w}px;height:${h}px;transform:rotateX(90deg)"></i><i class="c3-s c3-f" style="width:${w}px;height:${h}px;transform:translateY(${d}px) rotateX(90deg)"></i><i class="c3-s c3-e" style="width:${h}px;height:${d}px;transform:rotateY(-90deg)"></i><i class="c3-s c3-e" style="width:${h}px;height:${d}px;transform:translateX(${w}px) rotateY(-90deg)"></i></div>`}
// exterior walls: [x1,y1,x2,y2,[window ranges along the wall as [from,to] fractions]]
// ================= Apartment plan model =================
// Plans come from assets/plans/*.json (made by tools/dxf2plan.py from DXF). Internally we work in "plan units"
// (1 unit = PLAN_UNIT metres, y pointing down / south on the drawing) so the CSS/SVG fallback keeps readable numbers.
const PLAN_UNIT=.021;
const rectPoly=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const DEMO_PLAN={id:'demo',title:'Демо-планировка',north:0,
 outline:[[0,30],[280,30],[280,0],[650,0],[650,405],[580,405],[580,440],[0,440]],
 exterior:[[0,30,280,30,[[.12,.85]]],[280,30,280,0,[]],[280,0,650,0,[[.1,.45],[.57,.95]]],[650,0,650,405,[[.07,.33],[.36,.55],[.86,.96]]],[650,405,580,405,[]],[580,405,580,440,[]],[580,440,0,440,[[.54,.95],[.03,.5]]],[0,440,0,30,[[.07,.3],[.62,.9]]]],
 interior:[[280,30,280,110],[280,150,280,160],[0,160,180,160],[225,160,290,160],[0,305,200,305],[245,305,290,305],[290,160,290,180],[290,220,290,440],[290,245,400,245],[440,245,650,245],[465,0,465,150],[465,200,465,245],[465,245,465,265],[465,305,465,405],[465,337,650,337],[375,245,375,265],[375,305,375,440]],
 rooms:[{name:'Спальня',poly:rectPoly(0,30,280,130),label:[140,95]},{name:'Спальня',poly:rectPoly(0,305,290,135),label:[150,372]},{name:'Холл',poly:rectPoly(280,0,185,245),label:[372,60]},{name:'Коридор',poly:[[0,160],[280,160],[280,245],[290,245],[290,305],[0,305]],label:[140,232]},{name:'$living',poly:rectPoly(465,0,185,245),label:[557,70]},{name:'Гостевая',poly:rectPoly(465,245,185,92),label:[557,291]},{name:'Ванная',poly:rectPoly(290,245,85,195),label:[332,330]},{name:'Гардероб',poly:rectPoly(375,245,90,195),label:[420,345]},{name:'Кладовая',poly:rectPoly(465,337,185,68),label:[522,371]}],
 views:[],furniture:'demo',
 cssFurniture:[[58,58,120,62,12,'f-bed'],[58,62,24,54,18,'f-pillow'],[200,45,60,26,40,'f-ward'],[58,318,120,62,12,'f-bed'],[58,322,24,54,18,'f-pillow'],[210,400,62,26,40,'f-ward'],[512,165,100,34,14,'f-sofa'],[512,160,100,10,26,'f-sofa'],[530,95,54,40,17,'f-table'],[620,20,22,200,34,'f-kitchen'],[492,262,70,56,11,'f-bed'],[300,395,60,34,14,'f-bath'],[385,258,70,22,44,'f-ward'],[385,410,70,22,44,'f-ward'],[360,95,40,40,14,'f-table']]};
function polyArea(p){let a=0;for(let k=0;k<p.length;k++){const [x1,y1]=p[k],[x2,y2]=p[(k+1)%p.length];a+=x1*y2-x2*y1}return Math.abs(a)/2}
function polyCentroid(p){let a=0,cx=0,cy=0;for(let k=0;k<p.length;k++){const [x1,y1]=p[k],[x2,y2]=p[(k+1)%p.length],f=x1*y2-x2*y1;a+=f;cx+=(x1+x2)*f;cy+=(y1+y2)*f}if(Math.abs(a)<1e-9)return p[0];return [cx/(3*a),cy/(3*a)]}
function inPoly([x,y],p){let c=false;for(let k=0,j=p.length-1;k<p.length;j=k++){const [xi,yi]=p[k],[xj,yj]=p[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)c=!c}return c}
const polyPath=p=>'M'+p.map(([x,y])=>`${+x.toFixed(2)} ${+y.toFixed(2)}`).join(' L')+' Z';
function roomType(n){n=String(n).toLowerCase();if(/кухн/.test(n)&&/гост/.test(n))return 'kitchen-living';if(/спальн|детск|кабинет/.test(n))return 'bed';if(/гостев/.test(n))return 'guest';if(/гостин|зал/.test(n))return 'living';if(/кухн|столов/.test(n))return 'kitchen';if(/ванн|с\/у|сану|душ|туал/.test(n))return 'bath';if(/гардероб/.test(n))return 'wardrobe';if(/кладов|тех|постир/.test(n))return 'storage';if(/лодж|балкон|террас/.test(n))return 'balcony';return 'hall'}
function normalizePlan(p){const xs=p.outline.map(q=>q[0]),ys=p.outline.map(q=>q[1]),minX=Math.min(...xs),minY=Math.min(...ys),maxX=Math.max(...xs),maxY=Math.max(...ys);
 return {...p,rooms:p.rooms.map(r=>({...r,type:r.name==='$living'?'kitchen-living':roomType(r.name),label:r.label||polyCentroid(r.poly)})),w:maxX,h:maxY,minX,minY,cx:(minX+maxX)/2,cy:(minY+maxY)/2,north:p.north||0,views:p.views||[]}}
// JSON from the converter is in metres; convert to plan units
function planFromJson(j){const u=v=>v/PLAN_UNIT,pt=q=>[u(q[0]),u(q[1])];
 return normalizePlan({id:j.id,title:j.title||j.id,north:j.north||0,outline:j.outline.map(pt),
  exterior:j.exterior.map(e=>[...pt(e.a),...pt(e.b),e.windows||[]]),interior:j.interior.map(e=>[...pt(e.a),...pt(e.b)]),
  rooms:j.rooms.map(r=>({name:r.name,area:r.area,poly:r.poly.map(pt),label:r.label?pt(r.label):null})),
  views:(j.views||[]).map(v=>({text:v.text,x:u(v.at[0]),y:u(v.at[1])})),
  furniture:(j.furniture||[]).map(f=>({type:f.type,x:u(f.at[0]),y:u(f.at[1]),rot:(f.rot||0)*Math.PI/180,size:f.size||null})),cssFurniture:[]})}
let PLAN=normalizePlan(DEMO_PLAN);
let planExterior=PLAN.exterior,planInterior=PLAN.interior;
function setPlan(p){PLAN=p;planExterior=p.exterior;planInterior=p.interior}
// plan index: which plan file serves which building / floors
let planIndex=null;const planCache={};
async function ensurePlan(s,floor){try{if(!planIndex){const r=await fetch('assets/plans/index.json',{cache:'no-cache'});planIndex=r.ok?await r.json():{plans:[]}}
  const e=(planIndex.plans||[]).find(p=>(!p.buildings||p.buildings.includes(s.short))&&(!p.floors||(floor>=p.floors[0]&&floor<=p.floors[1])))||(planIndex.plans||[]).find(p=>p.id===planIndex.default);
  if(!e||e.id==='demo'||!e.file){setPlan(normalizePlan(DEMO_PLAN));return}
  if(!planCache[e.file]){const r=await fetch('assets/plans/'+e.file,{cache:'no-cache'});if(!r.ok)throw Error('plan '+e.file);planCache[e.file]=planFromJson(await r.json())}setPlan(planCache[e.file])}catch(err){console.warn('Plan load failed, using demo:',err);setPlan(normalizePlan(DEMO_PLAN))}}
function exteriorWall([x1,y1,x2,y2,wins]){const at=t=>[x1+(x2-x1)*t,y1+(y2-y1)*t];let out='',from=0;[...wins].sort((a,b)=>a[0]-b[0]).forEach(([a,b])=>{const p=at(from),q=at(a),r=at(b);if(a>from)out+=wallBox(...p,...q,WALL,THICK,'ext');out+=wallBox(...q,...r,12,THICK,'ext sill')+wallBox(...q,...r,5,THICK,'ext lintel',WALL-5)+`<div class="glass3" style="left:${q[0]}px;top:${q[1]}px;width:${Math.hypot(r[0]-q[0],r[1]-q[1]).toFixed(1)}px;height:${WALL-17}px;transform:rotate(${(Math.atan2(y2-y1,x2-x1)*180/Math.PI).toFixed(2)}deg) translateZ(12px) rotateX(90deg)"></div>`;from=b});if(from<1)out+=wallBox(...at(from),x2,y2,WALL,THICK,'ext');return out}
// floor drawing (rooms coloured by type) — used by the CSS fallback, the WebGL floor texture, AR and print
const ROOM_FILL={bed:'#dcc7a4',guest:'#d8c4a3',living:'#e9dcc3','kitchen-living':'#e9dcc3',kitchen:'#e4dccb',bath:'#d6e0de',wardrobe:'#e6ddcb',storage:'#e4e2da',balcony:'#dcdcd4',hall:'#efeadf'};
function floorSvgMarkup({labels=true,pxW=null,pxH=null,cls='',living='КУХНЯ-ГОСТИНАЯ'}={}){const P=PLAN,W=P.w,H=P.h,rooms=aptRooms(0,living);let clips='',fills='';
 rooms.forEach((r,k)=>{const d=polyPath(r.poly);clips+=`<clipPath id="rc${k}"><path d="${d}"/></clipPath>`;fills+=`<path d="${d}" fill="${ROOM_FILL[r.type]||'#efeadf'}"/>`;
  if(r.type==='bath'||r.type==='balcony'){let g='';for(let y=0;y<H;y+=20)g+=`M0 ${y}H${W}`;for(let x=0;x<W;x+=20)g+=`M${x} 0V${H}`;fills+=`<path clip-path="url(#rc${k})" d="${g}" stroke="rgba(90,110,110,.18)" fill="none"/>`}
  else if(r.type!=='hall'&&r.type!=='storage'){let g='';for(let y=10;y<H;y+=18)g+=`M0 ${y}H${W}`;fills+=`<path clip-path="url(#rc${k})" d="${g}" stroke="rgba(120,95,60,.13)" fill="none"/>`}});
 const lbl=labels?`<g fill="#5e6e6a" font-family="Manrope,Arial" font-size="15" font-weight="700" letter-spacing="1.6" text-anchor="middle">${rooms.map(r=>`<text x="${r.t[0].toFixed(1)}" y="${(r.t[1]+6).toFixed(1)}"${['bath','wardrobe','storage'].includes(r.type)?' font-size="12"':''}>${r.n.toUpperCase()}</text>`).join('')}</g>`:'';
 return `<svg${cls?` class="${cls}"`:''} viewBox="0 0 ${W} ${H}" width="${pxW||W}" height="${pxH||H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs>${clips}</defs><path d="${polyPath(P.outline)}" fill="#efeadf"/>${fills}${lbl}</svg>`}
function floorPlan3d(block,floor){const names=['A','B','C'];const living=floor%3===0?'ГОСТИНАЯ':'КУХНЯ-ГОСТИНАЯ';const P=PLAN,W=P.w,H=P.h;
lastFloorSvg=floorSvgMarkup({labels:true,cls:'floor3-svg',living});const floorSvg=floorSvgMarkup({labels:false,cls:'floor3-svg',living});
const tags=aptRooms(block===undefined?0:block,living).map((r,k)=>`<div class="room-tag" style="left:${r.t[0]}px;top:${r.t[1]}px;--i:${k}"><i class="room-stem"></i><span>${r.n.toUpperCase()}<small>${fmtArea(r.area)} м²</small></span></div>`).join('');
let walls=planExterior.map(exteriorWall).join('')+planInterior.map(w=>wallBox(...w,WALL,6,'int')).join('');
const o=P.outline,slab=o.map((q,k)=>{const n=o[(k+1)%o.length];return wallBox(q[0],q[1],n[0],n[1],16,2,'slab',-16)}).join('');
const furniture=(P.cssFurniture||[]).map(f=>cube(...f)).join('');
return `<div class="plan3d" id="plan3d" aria-label="3D-планировка корпуса ${names[block]}, этаж ${floor}" role="img"><div class="plan3d-scale"><div class="plan3d-stage" style="width:${W}px;height:${H}px"><div class="plan3d-shadow"></div>${slab}<div class="floor3" style="width:${W}px;height:${H}px">${floorSvg}</div>${walls}${furniture}<svg class="sun3" id="sun3" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="width:${W}px;height:${H}px" aria-hidden="true"></svg><div class="north3" style="left:${W+18}px">С<i></i></div>${tags}</div></div></div>`}
function fitPlan(){const host=document.getElementById('plan3d');if(!host)return;const r=host.getBoundingClientRect();const k=Math.max(PLAN.w/650,PLAN.h/440),s=Math.max(.2,Math.min(r.width/(860*k),r.height/(640*k)));host.querySelector('.plan3d-scale').style.transform=`scale(${s})`}
function applyPlanView(animate=true,fit=true){const st=document.querySelector('.plan3d-stage');if(!st)return;st.classList.toggle('anim',animate);st.style.transition=animate?'transform .6s cubic-bezier(.2,.7,.2,1)':'none';st.style.transform=`rotateX(${planView.tilt}deg) rotateZ(${planView.rot}deg) translate(${-PLAN.cx}px,${-PLAN.cy}px)`;st.style.setProperty('--rot',`${planView.rot}deg`);st.style.setProperty('--tilt',`${planView.tilt}deg`);if(fit)fitPlan()}
// slow auto-rotation while the plan is open; pauses on interaction
let planSpin=0,planIdle=0,planDragging=false;
function spinPlan(){cancelAnimationFrame(planSpin);const loop=()=>{if(!planModal.classList.contains('open'))return;if(!planRender.classList.contains('webgl')&&!reduce&&!planDragging&&planView.tilt>3&&performance.now()-planIdle>2500){planView.rot=(planView.rot+.07)%360;applyPlanView(false,false)}planSpin=requestAnimationFrame(loop)};planIdle=performance.now()-1800;planSpin=requestAnimationFrame(loop)}
let planInfo=false;const planInfoBtn=document.getElementById('plan-info'),planRender=document.getElementById('floorplan-render');
function setPlanInfo(on){planInfo=on;planRender.classList.toggle('show-tags',on);planInfoBtn.classList.toggle('active',on);planInfoBtn.setAttribute('aria-pressed',String(on));planInfoBtn.setAttribute('aria-label',on?'Скрыть подписи комнат':'Показать подписи комнат')}
planInfoBtn.addEventListener('click',()=>{planIdle=performance.now();setPlanInfo(!planInfo)});
function setPlanMode(mode){document.querySelectorAll('.plan-view-switch [data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===mode))}
document.querySelectorAll('.plan-view-switch [data-view]').forEach(b=>b.addEventListener('click',()=>{const v=b.dataset.view;planIdle=performance.now();if(view3d&&view3d.ready&&planRender.classList.contains('webgl')){view3d.setView(v==='top'?'top':'3d');setPlanMode(v==='top'?'top':'3d');return}if(v==='top'){planView={rot:0,tilt:0};setPlanMode('top')}else{planView={rot:-32,tilt:56};setPlanMode('3d')}applyPlanView(true)}));
(()=>{const host=document.getElementById('floorplan-render');let drag=null;host.addEventListener('pointerdown',e=>{if(!e.target.closest('.plan3d'))return;drag={x:e.clientX,y:e.clientY,rot:planView.rot,tilt:planView.tilt};planDragging=true;planIdle=performance.now();host.setPointerCapture(e.pointerId);host.classList.add('dragging')});host.addEventListener('pointermove',e=>{if(!drag)return;planView.rot=drag.rot+(e.clientX-drag.x)*.35;planView.tilt=Math.max(0,Math.min(72,drag.tilt-(e.clientY-drag.y)*.25));setPlanMode(planView.tilt<3?'top':'3d');applyPlanView(false)});const end=()=>{drag=null;planDragging=false;planIdle=performance.now();host.classList.remove('dragging')};host.addEventListener('pointerup',end);host.addEventListener('pointercancel',end);window.addEventListener('resize',fitPlan)})();

// ---- 360° panorama viewer (WebGL, equirectangular) ----
const pano=(()=>{const modal=document.getElementById('pano-modal'),canvas=document.getElementById('pano-canvas');let gl,prog,tex,loc={},ready=false,raf=0,yaw=0,pitch=0,fov=75,drag=null,lastInteract=0;
function init(){gl=canvas.getContext('webgl',{antialias:true});if(!gl){modal.querySelector('.pano-loading').textContent='WebGL недоступен в этом браузере';return false}
const vs='attribute vec2 p;varying vec2 v;void main(){v=p;gl_Position=vec4(p,0.,1.);}';
const fs='precision highp float;varying vec2 v;uniform sampler2D t;uniform float yaw,pitch,tf,asp;const float PI=3.14159265;void main(){vec3 d=normalize(vec3(v.x*tf*asp,v.y*tf,-1.));float cp=cos(pitch),sp=sin(pitch);d=vec3(d.x,d.y*cp+d.z*sp,-d.y*sp+d.z*cp);float cy=cos(yaw),sy=sin(yaw);d=vec3(d.x*cy-d.z*sy,d.y,d.x*sy+d.z*cy);float lon=atan(d.x,-d.z);float lat=asin(clamp(d.y,-1.,1.));gl_FragColor=texture2D(t,vec2(fract(lon/(2.*PI)+.5),.5-lat/PI));}';
const sh=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);return s};prog=gl.createProgram();gl.attachShader(prog,sh(gl.VERTEX_SHADER,vs));gl.attachShader(prog,sh(gl.FRAGMENT_SHADER,fs));gl.linkProgram(prog);gl.useProgram(prog);
const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);const pl=gl.getAttribLocation(prog,'p');gl.enableVertexAttribArray(pl);gl.vertexAttribPointer(pl,2,gl.FLOAT,false,0,0);['yaw','pitch','tf','asp'].forEach(n=>loc[n]=gl.getUniformLocation(prog,n));
tex=gl.createTexture();const img=new Image();img.onload=()=>{gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,img);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);ready=true;modal.classList.add('loaded')};img.src='assets/pano/pano.jpg';return true}
function frame(){raf=requestAnimationFrame(frame);if(!ready)return;if(!drag&&performance.now()-lastInteract>2500&&!reduce)yaw+=.0006;const dpr=Math.min(2,devicePixelRatio||1),w=canvas.clientWidth*dpr|0,h=canvas.clientHeight*dpr|0;if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}gl.viewport(0,0,w,h);gl.uniform1f(loc.yaw,yaw);gl.uniform1f(loc.pitch,pitch);gl.uniform1f(loc.tf,Math.tan(fov*Math.PI/360));gl.uniform1f(loc.asp,w/h);gl.drawArrays(gl.TRIANGLE_STRIP,0,4)}
canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,yaw,pitch};canvas.setPointerCapture(e.pointerId);modal.classList.add('dragging')});
canvas.addEventListener('pointermove',e=>{if(!drag)return;const k=fov/canvas.clientHeight*Math.PI/180;yaw=drag.yaw-(e.clientX-drag.x)*k;pitch=Math.max(-1.3,Math.min(1.3,drag.pitch+(e.clientY-drag.y)*k));lastInteract=performance.now()});
const end=()=>{drag=null;lastInteract=performance.now();modal.classList.remove('dragging')};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
canvas.addEventListener('wheel',e=>{e.preventDefault();fov=Math.max(35,Math.min(100,fov+e.deltaY*.05));lastInteract=performance.now()},{passive:false});
return{open(){if(!gl&&!init())return;modal.classList.add('open');modal.setAttribute('aria-hidden','false');yaw=0;pitch=0;fov=75;lastInteract=performance.now();cancelAnimationFrame(raf);frame();modal.querySelector('.pano-close').focus()},close(){modal.classList.remove('open');modal.setAttribute('aria-hidden','true');cancelAnimationFrame(raf)},isOpen:()=>modal.classList.contains('open')}})();
document.getElementById('open-pano').addEventListener('click',()=>pano.open());document.querySelectorAll('[data-close-pano]').forEach(x=>x.addEventListener('click',()=>pano.close()));

// ---- Loader + intro reveal ----
const loaderState={hero:0,fonts:0,video:0},loaderStart=performance.now();let loaderShown=0,loaderDone=false;
function loaderProgress(key,v){loaderState[key]=Math.max(loaderState[key],Math.min(1,v))}
async function readWithProgress(response,cb){const total=+response.headers.get('content-length')||0;if(!response.body||!total){const b=await response.blob();cb(1);return b}const reader=response.body.getReader(),chunks=[];let got=0;for(;;){const {done,value}=await reader.read();if(done)break;chunks.push(value);got+=value.length;cb(got/total)}cb(1);return new Blob(chunks,{type:response.headers.get('content-type')||'video/mp4'})}
(()=>{const img=new Image();img.onload=img.onerror=()=>loaderProgress('hero',1);img.src='assets/hero.jpg';(document.fonts?document.fonts.ready:Promise.resolve()).then(()=>loaderProgress('fonts',1));
const bar=document.getElementById('loader-bar'),pct=document.getElementById('loader-pct');
const tick=()=>{if(loaderDone)return;const elapsed=performance.now()-loaderStart;const videoPart=elapsed>6000?1:loaderState.video;const target=(loaderState.hero*.35+loaderState.fonts*.1+videoPart*.55)*100;loaderShown+=(target-loaderShown)*.08;if(target-loaderShown<.4)loaderShown=target;const shown=Math.min(loaderShown,elapsed<1600?elapsed/16:100);bar.style.transform=`scaleX(${shown/100})`;pct.textContent=Math.round(shown);if(shown>=99.5&&elapsed>1700){loaderDone=true;finishLoading()}else requestAnimationFrame(tick)};requestAnimationFrame(tick)})();
function finishLoading(){const b=document.body;b.classList.add('loader-out');setTimeout(()=>{b.classList.remove('is-loading');b.classList.add('is-loaded')},reduce?0:650);setTimeout(()=>document.getElementById('loader').remove(),reduce?100:2200)}

// ---- Scroll effects ----
const introEl=document.querySelector('.intro'),introImg=document.querySelector('.intro-image'),introContent=document.querySelector('.intro-content');
const manifesto=document.getElementById('manifesto-text');manifesto.innerHTML=manifesto.textContent.split(' ').map(w=>`<span class="mw">${w}</span>`).join(' ');const words=[...manifesto.querySelectorAll('.mw')];
const hscroll=document.getElementById('hscroll'),htrack=document.getElementById('hscroll-track'),hbar=document.getElementById('hscroll-bar'),hcards=[...htrack.querySelectorAll('.h-card')];
function sizeHscroll(){if(innerWidth<=620){hscroll.style.height='';htrack.style.transform='';return}const extra=htrack.scrollWidth-innerWidth+innerWidth*.09;hscroll.style.height=`${innerHeight+Math.max(0,extra)}px`}
function scrollFx(){const y=window.scrollY,vh=innerHeight;
 if(y<vh*1.2&&!reduce){const p=Math.min(1,y/vh);introImg.style.transform=`translate3d(0,${p*vh*.28}px,0) scale(${1.05+p*.12})`;introContent.style.opacity=String(1-p*1.4);introContent.style.translate=`0 ${p*-80}px`}
 const mr=manifesto.getBoundingClientRect(),mp=Math.min(1,Math.max(0,(vh*.85-mr.top)/(mr.height+vh*.35)));const lit=Math.round(mp*words.length);words.forEach((w,k)=>w.classList.toggle('lit',k<lit));
 if(innerWidth>620){const hr=hscroll.getBoundingClientRect(),total=hscroll.offsetHeight-vh,hp=Math.min(1,Math.max(0,-hr.top/Math.max(1,total)));const max=htrack.scrollWidth-innerWidth+innerWidth*.09;htrack.style.transform=`translate3d(${-hp*max}px,0,0)`;hbar.style.transform=`scaleX(${hp})`;if(!reduce)hcards.forEach(c=>{const r=c.getBoundingClientRect(),off=(r.left+r.width/2-innerWidth/2)/innerWidth;c.style.setProperty('--px',`${off*-14}%`);c.style.setProperty('--rot',`${off*-4}deg`)})}}
window.addEventListener('resize',()=>{sizeHscroll();scrollFx()});window.addEventListener('load',()=>{sizeHscroll();scrollFx()});sizeHscroll();
const io=new IntersectionObserver(es=>es.forEach(e=>{if(!e.isIntersecting)return;e.target.classList.add('shown');const n=e.target.querySelector('[data-count]');if(n&&!n.dataset.done){n.dataset.done=1;const end=+n.dataset.count,suf=n.dataset.suffix||'',t0=performance.now(),d=reduce?0:1800;const f=now=>{const t=d?Math.min(1,(now-t0)/d):1;n.textContent=Math.round(end*(1-Math.pow(1-t,4))).toLocaleString('ru-RU')+suf;if(t<1)requestAnimationFrame(f)};requestAnimationFrame(f)}io.unobserve(e.target)}),{threshold:.25});
document.querySelectorAll('.reveal,.h-card,.after h2').forEach(el=>io.observe(el));

// ---- AR floor plan (mobile): three.js → GLB → <model-viewer> (WebXR / Quick Look / Scene Viewer) ----
const arModal=document.getElementById('ar-modal'),arStatus=document.getElementById('ar-status'),arLaunch=document.getElementById('ar-launch');let arUrl=null;
async function buildPlanGLB(){const L=await loadThree();const {GLTFExporter}=await import('three/addons/exporters/GLTFExporter.js');const scene=new L.T.Scene();scene.add(buildApartment(L,{scale:PLAN_UNIT,floorTex:await floorTextureFor(L.T,true),forExport:true}));const glb=await new GLTFExporter().parseAsync(scene,{binary:true});return URL.createObjectURL(new Blob([glb],{type:'model/gltf-binary'}))}
async function openAR(){arModal.classList.add('open');arModal.setAttribute('aria-hidden','false');document.getElementById('ar-title').textContent=document.getElementById('plan-title').textContent;arStatus.textContent='Готовим 3D-модель…';arLaunch.disabled=true;const stage=document.getElementById('ar-stage');stage.innerHTML='';
 try{if(!customElements.get('model-viewer'))await import('https://cdn.jsdelivr.net/npm/@google/model-viewer@3.5.0/dist/model-viewer.min.js');if(arUrl)URL.revokeObjectURL(arUrl);arUrl=await buildPlanGLB();
  const mv=document.createElement('model-viewer');Object.entries({src:arUrl,alt:'3D-планировка','camera-controls':'','auto-rotate':'',ar:'','ar-modes':'webxr quick-look scene-viewer','ar-scale':'auto','ar-placement':'floor','shadow-intensity':'1','camera-orbit':'-30deg 55deg auto','touch-action':'pan-y','interaction-prompt':'none'}).forEach(([k,v])=>mv.setAttribute(k,v));stage.appendChild(mv);
  mv.addEventListener('load',()=>{if(mv.canActivateAR){arStatus.textContent='Наведите камеру на пол — планировка встанет в натуральную величину. Её можно двигать и масштабировать.';arLaunch.disabled=false}else arStatus.textContent='AR недоступен в этом браузере. Откройте сайт по HTTPS в Safari (iPhone) или Chrome (Android). 3D-модель можно вращать пальцем.'});
  mv.addEventListener('ar-status',e=>{if(e.detail.status==='failed')arStatus.textContent='Не удалось запустить AR на этом устройстве.'});
  arLaunch.onclick=()=>mv.activateAR()}catch(err){console.warn(err);arStatus.textContent='Не удалось загрузить AR-модуль. Проверьте подключение к интернету.'}}
function closeAR(){arModal.classList.remove('open');arModal.setAttribute('aria-hidden','true');document.getElementById('ar-stage').innerHTML=''}
document.getElementById('open-ar').addEventListener('click',openAR);document.querySelectorAll('[data-close-ar]').forEach(x=>x.addEventListener('click',closeAR));

// ================= Apartment data (like the sales sheet) =================
// ПРИМЕР: замените цены, сроки и контакты реальными данными отдела продаж.
const SALES={currency:'сум',pricePerM2:{A:14500000,B:15200000,C:18900000,D:14000000},floorStep:.01,discount:.05,installment:{down:.3,months:24},handover:'IV квартал 2027',bookingDays:3,entrance:1,manager:'Отдел продаж HAVEN',phone:'',isSample:true};
function aptRooms(block,living){const U2=PLAN_UNIT*PLAN_UNIT;return PLAN.rooms.map(r=>({n:r.name==='$living'?(living==='ГОСТИНАЯ'?'Гостиная':'Кухня-гостиная'):r.name,t:r.label,area:r.area??polyArea(r.poly)*U2,type:r.type,poly:r.poly}))}
const fmtArea=v=>v.toFixed(2);
const fmtMoney=v=>Math.round(v).toLocaleString('ru-RU')+' '+SALES.currency;
const fmtDate=d=>d.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'});
let aptCard=null;
function fillAptCard(s,floor){const living=floor%3===0?'ГОСТИНАЯ':'КУХНЯ-ГОСТИНАЯ',rooms=aptRooms(0,living),area=rooms.reduce((t,r)=>t+r.area,0);
 const ppm=(SALES.pricePerM2[s.short]||14500000)*(1+SALES.floorStep*Math.max(0,floor-2)),total=ppm*area,disc=total*(1-SALES.discount),down=total*SALES.installment.down,monthly=(total-down)/SALES.installment.months;
 const aptNo=(floor-2)*s.apartments+1,today=new Date(),booking=new Date(today.getTime()+SALES.bookingDays*864e5),f=String(floor).padStart(2,'0');
 const set=(id,v)=>{document.getElementById(id).textContent=v};
 set('apt-kicker',`${s.name.toUpperCase()} · ПОДЪЕЗД ${SALES.entrance} · ЭТАЖ ${f}`);set('plan-subtitle',`Кв. № ${String(aptNo).padStart(2,'0')}`);set('apt-area',fmtArea(area));set('apt-rooms',String(Math.max(1,rooms.filter(r=>['bed','guest','living','kitchen-living'].includes(r.type)).length)));
 set('apt-total',fmtMoney(total));set('apt-ppm',`${fmtMoney(ppm)} за м²`);set('apt-disc-pct',`−${Math.round(SALES.discount*100)}%`);set('apt-discount',fmtMoney(disc));set('apt-down-pct',`${Math.round(SALES.installment.down*100)}%`);set('apt-down',fmtMoney(down));set('apt-months',SALES.installment.months);set('apt-monthly',fmtMoney(monthly));
 set('apt-handover',SALES.handover);set('apt-printed',fmtDate(today));set('apt-booking',fmtDate(booking));document.getElementById('apt-sample-note').hidden=!SALES.isSample;
 document.getElementById('apt-room-list').innerHTML=rooms.map((r,k)=>`<li><span><b>${k+1}</b>${r.n}</span><strong>${fmtArea(r.area)} м²</strong></li>`).join('')+`<li class="total"><span>Общая площадь</span><strong>${fmtArea(area)} м²</strong></li>`;
 aptCard={s,floor:f,aptNo,area,rooms,ppm,total,disc,down,monthly,today,booking}}

// ================= Where the windows look =================
// Facade views per building by TRUE compass side. Replace with real data; BH-VIEW texts from the DXF override this.
const FACADE_VIEWS={default:{N:'Улица',S:'Двор',W:'Бульвар',E:'Соседний блок'}};
const VIEW_PHRASE={'Улица':['на улицу','Вид на улицу'],'Двор':['во двор','Вид во двор'],'Бульвар':['на бульвар','Вид на бульвар'],'Парк':['на парк','Вид на парк'],'Соседний блок':['на соседний блок','Вид на соседний блок']};
const viewPhrase=v=>VIEW_PHRASE[v]||['на '+String(v).toLowerCase(),'Вид на '+String(v).toLowerCase()];
const SIDES=['N','E','S','W'],SIDE_DEG={N:0,E:90,S:180,W:270};
const sideOf=b=>SIDES[Math.round((((b%360)+360)%360)/90)%4];
const trueBearing=b=>(((b+PLAN.north)%360)+360)%360;
function facadeView(side,outPt){if(PLAN.views&&PLAN.views.length){let best=null,bd=1e9;PLAN.views.forEach(v=>{const d=Math.hypot(v.x-outPt[0],v.y-outPt[1]);if(d<bd){bd=d;best=v}});if(best&&bd*PLAN_UNIT<12)return best.text}return (FACADE_VIEWS[cur().short]||FACADE_VIEWS.default)[side]}
function windowViews(){const out=[];planExterior.forEach(([x1,y1,x2,y2,wins],w)=>{if(!wins||!wins.length)return;const len=Math.hypot(x2-x1,y2-y1),n=[-(y2-y1)/len,(x2-x1)/len],o=[-n[0],-n[1]];
 const planB=(Math.atan2(o[0],-o[1])*180/Math.PI+360)%360,side=sideOf(trueBearing(planB)),planSide=sideOf(planB);
 wins.forEach(([a,b])=>{const q=[x1+(x2-x1)*a,y1+(y2-y1)*a],r=[x1+(x2-x1)*b,y1+(y2-y1)*b],mid=[(q[0]+r[0])/2,(q[1]+r[1])/2],inside=[mid[0]+n[0]*15,mid[1]+n[1]*15],outside=[mid[0]+o[0]*40,mid[1]+o[1]*40];
  out.push({side,planSide,view:facadeView(side,outside),room:PLAN.rooms.find(rr=>inPoly(inside,rr.poly))||null,mid,out:o,len:len*(b-a)})})});return out}
function viewsSummary(living){const names=new Map(aptRooms(0,living).map(r=>[r.poly,r.n])),groups=new Map();windowViews().forEach(v=>{if(!groups.has(v.view))groups.set(v.view,new Set());if(v.room)groups.get(v.view).add(names.get(v.room.poly))});
 return [...groups].map(([view,rooms])=>`${viewPhrase(view)[0]} — ${[...rooms].map(n=>n.toLowerCase()).join(', ')||'окна холла'}`).join('; ')}
// labels around a plan drawn in plan units (print sheet / previews)
function viewLabelsSvg(pad){const by={};windowViews().forEach(v=>{by[v.planSide]=by[v.planSide]||v.view});return Object.entries(by).map(([ps,view])=>{const t=viewPhrase(view)[1].toUpperCase(),W=PLAN.w,H=PLAN.h;
 const pos={N:[W/2,-pad/2,0],S:[W/2,H+pad/2+6,0],W:[-pad/2,H/2,-90],E:[W+pad/2,H/2,90]}[ps];return `<text x="${pos[0]}" y="${pos[1]}" transform="rotate(${pos[2]} ${pos[0]} ${pos[1]})" text-anchor="middle" dominant-baseline="middle" font-family="Manrope,Arial" font-size="17" font-weight="800" letter-spacing="3" fill="#8a6a36">⟵ ${t} ⟶</text>`}).join('')}

// ================= Printable sales sheet (PDF via the print dialog) =================
function buildSheet(){if(!aptCard)return null;const c=aptCard,s=c.s;const walls=planExterior.map(([x1,y1,x2,y2])=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#193438" stroke-width="9" stroke-linecap="square"/>`).join('')+planInterior.map(([x1,y1,x2,y2])=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#193438" stroke-width="5"/>`).join('');
 const labels=c.rooms.map(r=>`<text x="${r.t[0]}" y="${r.t[1]}" text-anchor="middle" font-family="Manrope,Arial" font-size="12" font-weight="700" fill="#193438">${r.n}</text><text x="${r.t[0]}" y="${r.t[1]+15}" text-anchor="middle" font-family="Manrope,Arial" font-size="11" fill="#5b6966">${fmtArea(r.area)} м²</text>`).join('');
 const pad=70,svg=floorSvgMarkup({labels:false,living:c.rooms.some(r=>r.n==='Гостиная')?'ГОСТИНАЯ':'КУХНЯ-ГОСТИНАЯ'}).replace(/<svg[^>]*>/,`<svg viewBox="${-pad} ${-pad} ${PLAN.w+pad*2} ${PLAN.h+pad*2}" width="100%" xmlns="http://www.w3.org/2000/svg">`).replace('</svg>',walls+labels+viewLabelsSvg(pad)+'</svg>');
 const row=(k,v)=>`<tr><td>${k}</td><td>${v}</td></tr>`;
 let el=document.getElementById('print-sheet');if(!el){el=document.createElement('div');el.id='print-sheet';document.body.appendChild(el)}
 el.innerHTML=`<div class="ps-grid"><aside><div class="ps-brand"><img src="assets/brand/haven-logo.svg" alt="HAVEN — Halovat makoni" style="width:150px;height:100px"><span>${s.name}</span></div><table>${row('Квартира №',String(c.aptNo).padStart(2,'0'))}${row('Блок',s.short)}${row('Этаж',c.floor)}${row('Подъезд',SALES.entrance)}${row('Комнат',document.getElementById('apt-rooms').textContent)}${row('Площадь',fmtArea(c.area)+' м²')}</table>
 <h4>Стоимость</h4><table>${row('Цена за м²',fmtMoney(c.ppm))}${row('Стоимость квартиры',`<b>${fmtMoney(c.total)}</b>`)}${row(`При 100% оплате (−${Math.round(SALES.discount*100)}%)`,fmtMoney(c.disc))}${row(`Первоначальный взнос ${Math.round(SALES.installment.down*100)}%`,fmtMoney(c.down))}${row(`Ежемесячно, ${SALES.installment.months} мес.`,fmtMoney(c.monthly))}</table>
 <h4>Сроки</h4><table>${row('Сдача дома',SALES.handover)}${row('Дата печати',fmtDate(c.today))}${row('Бронь до',fmtDate(c.booking))}${row('Менеджер',SALES.manager)}${SALES.phone?row('Телефон',SALES.phone):''}</table><p class="ps-note">*Цена фиксируется на момент заключения договора.${SALES.isSample?' Цены и сроки указаны как пример.':''}</p></aside>
 <main><h2>План квартиры: ${s.name}, подъезд ${SALES.entrance}, этаж ${c.floor}</h2>${svg}<div class="ps-north">С ↑</div><h4>Расположение на этаже</h4><div class="ps-plate">${plateSvg(s,+c.floor)}</div><h4>Экспликация помещений</h4><table class="ps-rooms">${c.rooms.map((r,k)=>row(`${k+1}. ${r.n}`,fmtArea(r.area)+' м²')).join('')}${row('<b>Общая площадь</b>',`<b>${fmtArea(c.area)} м²</b>`)}</table></main></div><p class="ps-foot">Желаем вам удачной покупки!</p>`;
 return el}
function printSheet(){if(buildSheet())window.print()}

// Download the card as a real PDF (A4 landscape): html2canvas renders the sheet, jsPDF wraps it.
function loadScript(src){return new Promise((ok,fail)=>{if(document.querySelector(`script[src="${src}"]`))return ok();const t=document.createElement('script');t.src=src;t.onload=ok;t.onerror=fail;document.head.appendChild(t)})}
async function downloadCardPdf(btn){const label=btn.querySelector('span');const old=label.textContent;btn.disabled=true;label.textContent='Готовим PDF…';
 try{await Promise.all([loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'),loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')]);
  const el=buildSheet();if(!el)return;el.classList.add('ps-render');if(document.fonts)await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  const canvas=await html2canvas(el,{scale:2,backgroundColor:'#ffffff',useCORS:true,logging:false});el.classList.remove('ps-render');
  const {jsPDF}=window.jspdf,doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'}),pw=297,ph=210,ratio=canvas.height/canvas.width;let w=pw,h=pw*ratio;if(h>ph){h=ph;w=ph/ratio}
  doc.addImage(canvas.toDataURL('image/jpeg',.92),'JPEG',(pw-w)/2,(ph-h)/2,w,h);const c=aptCard;doc.setProperties({title:`HAVEN — ${c.s.name}, кв. ${c.aptNo}`});
  doc.save(`HAVEN_${c.s.name.replace(/\s+/g,'-')}_кв-${c.aptNo}_этаж-${c.floor}.pdf`)}
 catch(err){console.warn('PDF export failed, falling back to print',err);printSheet()}
 finally{btn.disabled=false;label.textContent=old;const el=document.getElementById('print-sheet');if(el)el.classList.remove('ps-render')}}
document.getElementById('print-card').addEventListener('click',e=>downloadCardPdf(e.currentTarget));

// ================= Sunlight: how light falls through the windows =================
let sunOn=false,sunPlay=0;const sunBtn=document.getElementById('plan-sun'),sunPanel=document.getElementById('sun-panel'),sunTime=document.getElementById('sun-time');
function updateSun(){const svg=document.getElementById('sun3'),host=document.getElementById('plan3d');if(!svg)return;const t=+sunTime.value,hh=Math.floor(t)%24,mm=Math.floor((t-Math.floor(t))*60);
 document.getElementById('sun-label').textContent=`${hh}:${String(mm).padStart(2,'0')}`;
 const {el,az}=sunState(),azr=(az-PLAN.north)*Math.PI/180; // az: true bearing; rotated into the plan frame
 const dirs=['С','СВ','В','ЮВ','Ю','ЮЗ','З','СЗ'];document.getElementById('sun-dir').textContent=el>1?`Солнце на ${dirs[Math.round(az/45)%8]} · ${Math.round(el)}° над горизонтом`:'Солнце за горизонтом';
 const warm=Math.max(0,Math.min(1,1-el/35));host.style.setProperty('--sun-warm',warm.toFixed(2));host.style.setProperty('--sun-dim',(el>1?0:.35).toFixed(2));
 if(el<=1){svg.innerHTML='';return}
 const d=[-Math.sin(azr),Math.cos(azr)],tanE=Math.tan(el*Math.PI/180),near=12/tanE,far=Math.min(520,(WALL-5)/tanE);
 const col=el<18?'255,150,60':el<35?'255,190,95':'255,221,140';let defs='',out='';
 planExterior.forEach(([x1,y1,x2,y2,wins],w)=>{const len=Math.hypot(x2-x1,y2-y1),n=[-(y2-y1)/len,(x2-x1)/len],dot=d[0]*n[0]+d[1]*n[1];if(dot<=.05)return;
  wins.forEach(([a,b],k)=>{const q=[x1+(x2-x1)*a,y1+(y2-y1)*a],r=[x1+(x2-x1)*b,y1+(y2-y1)*b],m=[(q[0]+r[0])/2+n[0]*15,(q[1]+r[1])/2+n[1]*15];
   const room=PLAN.rooms.find(r=>inPoly(m,r.poly));if(!room)return;const id=`sc${w}_${k}`;
   defs+=`<clipPath id="${id}"><path d="${polyPath(room.poly)}"/></clipPath>`;
   const P=(p,l)=>`${(p[0]+d[0]*l).toFixed(1)},${(p[1]+d[1]*l).toFixed(1)}`,alpha=Math.min(.9,.5+.45*dot);
   out+=`<polygon clip-path="url(#${id})" points="${P(q,near)} ${P(r,near)} ${P(r,far)} ${P(q,far)}" fill="rgba(${col},${alpha.toFixed(2)})"/>`})});
 const shade=(.1+.18*warm).toFixed(2);svg.innerHTML=`<defs>${defs}<filter id="sunblur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.5"/></filter><clipPath id="sunfloor"><path d="${polyPath(PLAN.outline)}"/></clipPath></defs><path d="${polyPath(PLAN.outline)}" fill="rgba(18,32,45,${shade})"/><g filter="url(#sunblur)" clip-path="url(#sunfloor)">${out}</g>`}
function setSun(on){sunOn=on;if(view3d)view3d.lastSun=null;sunBtn.classList.toggle('active',on);sunBtn.setAttribute('aria-pressed',String(on));sunPanel.hidden=!on;planRender.classList.toggle('sun-mode',on);if(!on){cancelAnimationFrame(sunPlay);sunPlay=0;document.getElementById('sun-play').textContent='▶'}updateSun();if(!on){const svg=document.getElementById('sun3');if(svg)svg.innerHTML=''}}
sunBtn.addEventListener('click',()=>{planIdle=performance.now();setSun(!sunOn)});
sunTime.addEventListener('input',()=>{planIdle=performance.now();updateSun()});
document.getElementById('sun-play').addEventListener('click',e=>{const btn=e.currentTarget;if(sunPlay){cancelAnimationFrame(sunPlay);sunPlay=0;btn.textContent='▶';return}btn.textContent='❚❚';let last=performance.now();if(+sunTime.value>=23.95)sunTime.value=0;const loop=now=>{const dt=(now-last)/1000;last=now;let v=+sunTime.value+dt*1.7;if(v>24){v=0}sunTime.value=v;updateSun();sunPlay=requestAnimationFrame(loop)};sunPlay=requestAnimationFrame(loop)});

// ================= three.js apartment: full-height walls, real sun + soft shadows =================
let view3d=null;
function loadThree(){if(!loadThree.p)loadThree.p=Promise.all([import('three'),import('three/addons/controls/OrbitControls.js'),import('three/addons/environments/RoomEnvironment.js'),import('three/addons/geometries/RoundedBoxGeometry.js')]).then(([T,a,b,c])=>({T,OrbitControls:a.OrbitControls,RoomEnvironment:b.RoomEnvironment,RoundedBoxGeometry:c.RoundedBoxGeometry}));return loadThree.p}
const FURN_H={'f-bed':.5,'f-pillow':.62,'f-ward':2.2,'f-sofa':.45,'f-table':.75,'f-kitchen':.9,'f-bath':.55};
const FURN_C={'f-bed':['#f7f5ef','#d9cfbd'],'f-pillow':['#e7dac0','#e7dac0'],'f-ward':['#8c7a5f','#8c7a5f'],'f-sofa':['#7f958f','#6d837d'],'f-table':['#a8845a','#8f6f48'],'f-kitchen':['#f1efe8','#3f5955'],'f-bath':['#ffffff','#e4ecea']};
// Builds the apartment in metres; plan x → +X (east), plan y → +Z (south), up = +Y.
function buildApartment(L,{scale,floorTex,forExport=false}){const {T,RoundedBoxGeometry}=L,S=scale,H=2.8,SILL=.35,HEAD=2.45,TE=.26,TI=.12;const g=new T.Group(),fg2=new T.Group();g.add(fg2);g.userData.furn=fg2;
 const mat=(c,o={})=>new T.MeshStandardMaterial({color:c,roughness:.88,metalness:0,envMapIntensity:.35,...o});
 const M={wall:mat('#f4f0e7'),cap:mat('#243b3c',{roughness:.7}),int:mat('#f7f4ee'),slab:mat('#bdbcb2'),frame:mat('#2a3a3a',{roughness:.45,metalness:.4}),glass:new T.MeshPhysicalMaterial({color:'#cfe9f1',roughness:.04,metalness:0,transparent:true,opacity:forExport?.35:.16,side:T.DoubleSide,depthWrite:false})};
 const P=(x,y)=>[(x-PLAN.cx)*S,(y-PLAN.cy)*S];
 const seg=(x1,y1,x2,y2,y0,h,t,m,{cast=true,ext=0,top=M.cap}={})=>{const [ax,az]=P(x1,y1),[bx,bz]=P(x2,y2),len=Math.hypot(bx-ax,bz-az)+ext;if(len<.01||h<=0)return;const mesh=new T.Mesh(new T.BoxGeometry(len,h,t),[m,m,top,m,m,m]);mesh.position.set((ax+bx)/2,y0+h/2,(az+bz)/2);mesh.rotation.y=-Math.atan2(bz-az,bx-ax);mesh.castShadow=cast;mesh.receiveShadow=true;g.add(mesh);return mesh};
 // floor slab + textured floor
 const shape=new T.Shape();PLAN.outline.forEach(([x,y],k)=>k?shape.lineTo(x,y):shape.moveTo(x,y));
 const slab=new T.Mesh(new T.ExtrudeGeometry(shape,{depth:.3/S,bevelEnabled:false}),M.slab);slab.rotation.x=Math.PI/2;slab.scale.set(S,S,S);slab.position.set(-PLAN.cx*S,-.001,-PLAN.cy*S);slab.receiveShadow=true;g.add(slab);
 const fg=new T.ShapeGeometry(shape),uv=fg.attributes.uv,pos=fg.attributes.position;for(let k=0;k<uv.count;k++)uv.setXY(k,pos.getX(k)/PLAN.w,1-pos.getY(k)/PLAN.h);
 const floor=new T.Mesh(fg,new T.MeshStandardMaterial({map:floorTex,roughness:.7,envMapIntensity:.3,side:T.DoubleSide}));floor.rotation.x=Math.PI/2;floor.scale.set(S,S,1);floor.position.set(-PLAN.cx*S,.003,-PLAN.cy*S);floor.receiveShadow=true;g.add(floor);
 // exterior walls with window openings (sill, lintel, glass, mullions)
 planExterior.forEach(([x1,y1,x2,y2,wins])=>{const at=t=>[x1+(x2-x1)*t,y1+(y2-y1)*t];let from=0;const wallLen=Math.hypot(x2-x1,y2-y1)*S;
  [...wins].sort((a,b)=>a[0]-b[0]).forEach(([a,b])=>{const p=at(from),q=at(a),r=at(b);if(a>from)seg(...p,...q,0,H,TE,M.wall,{ext:from===0?TE:0});seg(...q,...r,0,SILL,TE,M.wall);seg(...q,...r,HEAD,H-HEAD,TE,M.wall);seg(...q,...r,SILL,HEAD-SILL,.02,M.glass,{cast:false,top:M.glass});
   seg(...q,...r,SILL,.05,TE*.6,M.frame);seg(...q,...r,HEAD-.05,.05,TE*.6,M.frame);const n=Math.max(1,Math.round((b-a)*wallLen/1.4));for(let k=0;k<=n;k++){const u=a+(b-a)*k/n,c=at(u),d=[c[0]+(x2-x1)/wallLen*S*.05,c[1]+(y2-y1)/wallLen*S*.05];seg(...c,...d,SILL,HEAD-SILL,TE*.6,M.frame)}from=b});
  if(from<1)seg(...at(from),x2,y2,0,H,TE,M.wall,{ext:TE})});
 // interior partitions, full height
 planInterior.forEach(w=>seg(...w,0,H,TI,M.int));
 // detailed furniture (separate group so it can be toggled)
 g.userData.glow=buildFurniture(L,S,fg2);
 return g}
async function floorTextureFor(T,withLabels){const living=selectedFloor%3===0?'ГОСТИНАЯ':'КУХНЯ-ГОСТИНАЯ',pw=2048,ph=Math.round(2048*PLAN.h/PLAN.w);const svg=floorSvgMarkup({labels:withLabels,pxW:pw,pxH:ph,living});const img=new Image();img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);await img.decode();const c=document.createElement('canvas');c.width=pw;c.height=ph;c.getContext('2d').drawImage(img,0,0,pw,ph);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;return t}
// Solar position for Tashkent (41.30°N, 69.24°E, UTC+5) on today's date; t = local clock hours 0..24
let sunDoy=null; // null = today
const todayDoy=()=>{const n=new Date();return Math.floor((n-new Date(n.getFullYear(),0,0))/864e5)};
function sunState(tOverride){const t=tOverride??+sunTime.value,doy=sunDoy??todayDoy(),lat=41.3*Math.PI/180;
 const g=2*Math.PI/365*(doy-1+(t-12)/24),decl=.006918-.399912*Math.cos(g)+.070257*Math.sin(g)-.006758*Math.cos(2*g)+.000907*Math.sin(2*g)-.002697*Math.cos(3*g)+.00148*Math.sin(3*g);
 const eqt=229.18*(.000075+.001868*Math.cos(g)-.032077*Math.sin(g)-.014615*Math.cos(2*g)-.040849*Math.sin(2*g)),solarMin=t*60+eqt+4*69.24-60*5,ha=(solarMin/4-180)*Math.PI/180;
 const sinEl=Math.sin(lat)*Math.sin(decl)+Math.cos(lat)*Math.cos(decl)*Math.cos(ha),el=Math.asin(sinEl)*180/Math.PI;
 let az=Math.atan2(Math.sin(ha),Math.cos(ha)*Math.sin(lat)-Math.tan(decl)*Math.cos(lat))*180/Math.PI+180;return {t,el,az:(az+360)%360}}
// ---- Furniture / compass toggles ----
let showFurniture=true,showCompass3d=true;
function syncToggle(id,on){const b=document.getElementById(id);b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on))}
document.getElementById('plan-furn').addEventListener('click',()=>{showFurniture=!showFurniture;syncToggle('plan-furn',showFurniture);planRender.classList.toggle('no-furn',!showFurniture);if(view3d&&view3d.group)view3d.group.userData.furn.visible=showFurniture});
document.getElementById('plan-compass').addEventListener('click',()=>{showCompass3d=!showCompass3d;syncToggle('plan-compass',showCompass3d);if(view3d&&view3d.compass){view3d.compass.visible=showCompass3d;view3d.controls.maxDistance=view3d.fitDist(false)*1.7;view3d.setView(view3d.mode)}});

const compassDial=document.getElementById('compass-dial');
// ================= Detailed procedural furniture (metres; local front = +Z, back = −Z) =================
function buildFurniture(L,S,root){const {T,RoundedBoxGeometry:RB}=L;
 const std=(c,o={})=>new T.MeshStandardMaterial({color:c,roughness:.8,metalness:0,envMapIntensity:.4,...o});const glow=[];
 const M={oak:std('#b68e61',{roughness:.55}),walnut:std('#6b4a33',{roughness:.5}),white:std('#f7f5f0',{roughness:.92}),linen:std('#e8e0d0',{roughness:.95}),duvet:std('#cbb89a',{roughness:.95}),duvet2:std('#9eb0ba',{roughness:.95}),sage:std('#8e9e90',{roughness:.97}),sageD:std('#76877a',{roughness:.97}),cushion:std('#d8c49f',{roughness:.95}),rust:std('#b0694a',{roughness:.95}),metal:std('#c9c9c4',{metalness:.85,roughness:.28}),black:std('#1e2225',{roughness:.45}),glassB:std('#0c0f11',{roughness:.1,metalness:.4}),marble:std('#ece9e2',{roughness:.22}),cab:std('#304543',{roughness:.55}),cabL:std('#efece6',{roughness:.65}),rug:std('#cdbfa6',{roughness:1}),rug2:std('#8f9c97',{roughness:1}),ceramic:std('#fcfcfb',{roughness:.18}),water:std('#a9d6e2',{roughness:.03,metalness:.1,transparent:true,opacity:.85}),steel:std('#d8dada',{metalness:.75,roughness:.22}),leaf:std('#557a4a',{roughness:.8,flatShading:true}),leaf2:std('#6d9160',{roughness:.8,flatShading:true}),pot:std('#c9b699',{roughness:.9}),mirror:std('#e3ecee',{metalness:.95,roughness:.04})};
 const lampMat=()=>{const m=std('#f4e7cd',{emissive:'#ffcf8a',emissiveIntensity:0,roughness:.9});glow.push(m);return m};
 const add=(p,mesh,x,y,z,cast=true)=>{mesh.position.set(x,y,z);mesh.castShadow=cast;mesh.receiveShadow=true;p.add(mesh);return mesh};
 const box=(p,w,h,d,x,y,z,m,r=.02)=>{const rr=Math.min(r,w/2-.001,h/2-.001,d/2-.001);return add(p,new T.Mesh(rr>.003?new RB(w,h,d,2,rr):new T.BoxGeometry(w,h,d),m),x,y,z)};
 const cyl=(p,rt,rb,h,x,y,z,m,seg=24)=>add(p,new T.Mesh(new T.CylinderGeometry(rt,rb,h,seg),m),x,y,z);
 const FACE={S:0,N:Math.PI,E:Math.PI/2,W:-Math.PI/2};
 const item=(fn,x,y,face='S')=>{const g=new T.Group();fn(g);g.position.set((x-PLAN.cx)*S,0,(y-PLAN.cy)*S);g.rotation.y=typeof face==='number'?face:FACE[face];root.add(g);return g};
 // --- pieces ---
 const bed=(g,w,l,duv)=>{[[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([a,b])=>cyl(g,.03,.025,.1,a*(w/2-.08),.05,b*(l/2-.08),M.black,12));box(g,w,.26,l,0,.23,0,M.walnut,.03);box(g,w-.06,.22,l-.1,0,.46,.03,M.white,.07);
  box(g,w+.02,.08,l*.62,0,.6,l*.19,duv,.04);box(g,w+.03,.1,.22,0,.61,-l*.12,M.linen,.05);box(g,w+.14,1.05,.12,0,.6,-l/2+.02,M.cushion,.05);
  [-1,1].forEach(k=>{const p=box(g,w/2-.12,.15,.42,k*w/4,.64,-l/2+.36,M.white,.07);p.rotation.x=-.25});box(g,.42,.3,.12,w*.18,.72,-l/2+.52,M.rust,.05).rotation.x=-.3;box(g,w*.8,.02,.35,0,.645,l/2-.3,M.linen,.01)};
 const nightstand=g=>{box(g,.46,.48,.4,0,.26,0,M.oak,.02);box(g,.4,.004,.005,0,.34,.201,M.black,0);cyl(g,.015,.015,.02,0,.34,.21,M.metal,8);cyl(g,.06,.08,.04,0,.52,0,M.metal);cyl(g,.01,.01,.26,0,.67,0,M.metal,8);cyl(g,.1,.15,.2,0,.88,0,lampMat())};
 const wardrobe=(g,w,h=2.3,d=.6)=>{box(g,w,h,d,0,h/2+.04,0,M.cabL,.01);box(g,w-.04,.04,d-.04,0,.02,0,M.black,0);const n=Math.max(2,Math.round(w/.5));for(let k=1;k<n;k++){const x=-w/2+w*k/n;box(g,.01,h-.08,.012,x,h/2+.04,d/2,M.black,0)}for(let k=0;k<n;k++){const x=-w/2+w*(k+.5)/n+(k%2?-1:1)*(w/n/2-.07);box(g,.02,.4,.03,x,1.1,d/2+.02,M.metal,.008)}};
 const sofa=(g,w,d=.95)=>{[[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([a,b])=>cyl(g,.02,.015,.12,a*(w/2-.1),.06,b*(d/2-.1),M.black,10));box(g,w,.22,d,0,.23,0,M.sageD,.05);[-1,1].forEach(k=>box(g,.2,.62,d,k*(w/2-.1),.43,0,M.sageD,.08));box(g,w,.52,.22,0,.62,-d/2+.11,M.sageD,.08);
  const n=3,cw=(w-.4)/n;for(let k=0;k<n;k++){const x=-w/2+.2+cw*(k+.5);box(g,cw-.02,.16,d-.3,x,.42,.08,M.sage,.07);const b=box(g,cw-.03,.44,.2,x,.72,-d/2+.3,M.sage,.09);b.rotation.x=-.14}
  box(g,.44,.4,.13,-w/2+.5,.72,-d/2+.46,M.cushion,.06).rotation.set(-.2,.25,0);box(g,.42,.38,.13,w/2-.5,.72,-d/2+.46,M.rust,.06).rotation.set(-.2,-.25,0);box(g,.9,.03,.6,w/2-.7,.51,.05,M.linen,.01)};
 const armchair=g=>{sofa(g,1,.9)};
 const coffee=g=>{cyl(g,.46,.46,.04,0,.4,0,M.oak,40);cyl(g,.07,.14,.38,0,.19,0,M.black,20);box(g,.26,.04,.2,.1,.44,.05,M.rust,.005);box(g,.22,.03,.18,.1,.475,.05,M.linen,.005);cyl(g,.05,.04,.1,-.18,.47,-.1,M.ceramic,16)};
 const rug=(g,w,l,m)=>{const r=box(g,w,.012,l,0,.007,0,m,0);r.castShadow=false};
 const chair=(g,x,z,rot)=>{const c=new T.Group();[[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([a,b])=>cyl(c,.015,.012,.44,a*.18,.22,b*.18,M.black,8));box(c,.46,.05,.46,0,.46,0,M.cushion,.02);box(c,.44,.42,.04,0,.72,-.21,M.walnut,.02);c.position.set(x,0,z);c.rotation.y=rot;g.add(c)};
 const dining=g=>{box(g,1.8,.05,.95,0,.75,0,M.oak,.015);[[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([a,b])=>box(g,.06,.72,.06,a*.8,.37,b*.38,M.black,.01));[-.6,0,.6].forEach(x=>{chair(g,x,-.68,0);chair(g,x,.68,Math.PI)});cyl(g,.004,.004,.9,0,2.35,0,M.black,6);cyl(g,.12,.3,.22,0,1.82,0,lampMat(),32);cyl(g,.05,.05,.12,.3,.83,.1,M.ceramic,16);cyl(g,.16,.16,.02,-.3,.785,-.05,M.ceramic,24)};
 const kitchen=(g,L)=>{box(g,L-.04,.1,.55,0,.05,-.02,M.black,0);box(g,L,.78,.6,0,.49,0,M.cab,.01);const n=Math.round(L/.6);for(let k=1;k<n;k++)box(g,.008,.72,.01,-L/2+L*k/n,.5,.3,M.black,0);for(let k=0;k<n;k++)box(g,.3,.018,.025,-L/2+L*(k+.5)/n,.82,.315,M.metal,.006);
  box(g,L+.02,.04,.64,0,.9,.01,M.marble,.006);const sx=-L/4;box(g,.52,.02,.42,sx,.915,.02,M.steel,.02);box(g,.46,.012,.36,sx,.922,.02,M.black,.01);cyl(g,.014,.014,.32,sx,1.08,-.22,M.steel,10);box(g,.024,.024,.2,sx,1.23,-.13,M.steel,.01);
  const cx=L/4;box(g,.6,.012,.52,cx,.925,.02,M.glassB,.01);[[-.14,-.12],[.14,-.12],[-.14,.14],[.14,.14]].forEach(([a,b])=>add(g,new T.Mesh(new T.TorusGeometry(.07,.006,6,28),std('#3a3f42')),cx+a,.933,.02+b).rotation.x=-Math.PI/2);
  box(g,L,.72,.36,0,1.9,-.12,M.cabL,.01);for(let k=1;k<n;k++)box(g,.008,.68,.01,-L/2+L*k/n,1.9,.061,M.black,0);box(g,.66,.05,.5,cx,1.52,-.05,M.steel,.01);
  box(g,.72,2.02,.68,L/2+.37,1.01,.02,M.steel,.03);box(g,.02,.5,.03,L/2+.1,1.35,.38,M.black,.008);box(g,.02,.3,.03,L/2+.1,.62,.38,M.black,.008);box(g,.7,.006,.01,L/2+.37,.9,.36,M.black,0)};
 const bath=g=>{box(g,1.7,.56,.76,0,.28,0,M.ceramic,.09);box(g,1.54,.02,.6,0,.5,0,M.water,.05);cyl(g,.02,.02,.2,.74,.62,-.25,M.steel,10);box(g,.03,.03,.14,.74,.72,-.19,M.steel,.01)};
 const vanity=g=>{box(g,.8,.46,.46,0,.62,0,M.oak,.02);box(g,.56,.12,.4,0,.9,.02,M.ceramic,.05);cyl(g,.013,.013,.2,0,1.03,-.14,M.steel,10);box(g,.72,.85,.02,0,1.5,-.22,M.mirror,.01)};
 const toilet=g=>{const b=cyl(g,.19,.15,.4,0,.2,.1,M.ceramic,24);b.scale.z=1.3;box(g,.4,.36,.17,0,.58,-.16,M.ceramic,.04);cyl(g,.2,.2,.03,0,.415,.1,M.white,24).scale.z=1.3};
 const shelving=(g,w,h,d,filler)=>{[-1,1].forEach(k=>box(g,.03,h,d,k*(w/2-.015),h/2,0,M.oak,.005));box(g,w,.03,d,0,h,0,M.oak,.005);const rows=Math.round(h/.4);for(let r=0;r<rows;r++){const y=.05+r*h/rows;box(g,w-.04,.025,d,0,y,0,M.oak,.004);filler(g,w,y,d,r)}};
 const colors=['#b0694a','#8e9e90','#d8c49f','#2f4442','#e8e0d0','#6b4a33','#9eb0ba'];let ci=0;const col=()=>std(colors[(ci++)%colors.length],{roughness:.9});
 const books=(g,w,y,d)=>{let x=-w/2+.06;while(x<w/2-.12){const bw=.03+Math.random()*.03,bh=.2+Math.random()*.1;box(g,bw,bh,d*.75,x+bw/2,y+.013+bh/2,0,col(),.003);x+=bw+.004;if(Math.random()<.1)x+=.12}};
 const clothes=(g,w,y,d,r)=>{if(r===0)return;for(let x=-w/2+.15;x<w/2-.15;x+=.3)box(g,.26,.08+Math.random()*.08,d*.8,x,y+.07,0,col(),.03)};
 const washer=g=>{box(g,.6,.85,.6,0,.425,0,M.white,.03);add(g,new T.Mesh(new T.TorusGeometry(.17,.03,10,32),M.steel),0,.45,.3).rotation.y=0;cyl(g,.15,.15,.01,0,.45,.3,M.glassB,24).rotation.x=Math.PI/2};
 const floorLamp=g=>{cyl(g,.15,.15,.02,0,.01,0,M.black);cyl(g,.012,.012,1.45,0,.74,0,M.black,8);cyl(g,.16,.22,.3,0,1.55,0,lampMat())};
 const plant=(g,s=1)=>{cyl(g,.17*s,.13*s,.38*s,0,.19*s,0,M.pot);for(let k=0;k<7;k++){const a=k*2.4,r=(.08+.1*(k%3))*s;const lf=add(g,new T.Mesh(new T.IcosahedronGeometry((.16+.06*(k%2))*s,1),k%2?M.leaf:M.leaf2),Math.cos(a)*r,(.55+.12*k)*s,Math.sin(a)*r);lf.scale.set(1,1.2,1)}};
 const ottoman=g=>{cyl(g,.3,.3,.42,0,.21,0,M.cushion,28)};
 if(PLAN.furniture!=='demo'){placeFurniture({item,bed,nightstand,wardrobe,sofa,armchair,coffee,rug,dining,kitchen,bath,vanity,toilet,shelving,books,clothes,washer,floorLamp,plant,ottoman,M,S});return glow}
 // --- demo layout per room (plan units) ---
 // Bedroom 1
 item(g=>rug(g,2.6,1.7,M.rug),95,92,'N');item(g=>bed(g,1.8,2.1,M.duvet),95,108,'N');item(nightstand,37,148,'N');item(nightstand,153,148,'N');item(g=>wardrobe(g,.9),259,46,'S');item(g=>plant(g,1.1),18,48);
 // Bedroom 2
 item(g=>rug(g,2.2,1.4,M.rug2),105,398,'S');item(g=>bed(g,1.6,2.0,M.duvet2),105,355,'S');item(nightstand,50,318,'S');item(nightstand,160,318,'S');item(g=>wardrobe(g,1.3),275,372,'W');item(g=>plant(g,.9),22,424);
 // Hall: dining
 item(g=>rug(g,2.7,2),372,112,'S');item(dining,372,112,'S');item(g=>plant(g,1.2),300,22);
 // Corridor lounge
 item(g=>rug(g,2.8,1.6,M.rug2),130,232,'S');item(g=>shelving(g,2.4,2.1,.38,books),110,293,'N');item(armchair,215,225,'W');item(floorLamp,248,190);item(g=>plant(g,1),22,292);
 // Kitchen-living
 item(g=>kitchen(g,2.4),481,94,'E');item(g=>rug(g,2.6,1.8,M.rug),560,168,'N');item(g=>sofa(g,2.4),560,208,'N');item(coffee,560,152);item(floorLamp,630,228);item(g=>plant(g,1.3),632,22);
 // Guest
 item(g=>bed(g,1.4,2.0,M.duvet),603,291,'W');item(nightstand,631,256,'W');item(g=>plant(g,.9),482,322);
 // Bathroom
 item(bath,332,420,'N');item(vanity,302,330,'E');item(toilet,305,378,'E');
 // Walk-in wardrobe
 item(g=>shelving(g,2.1,2.1,.45,clothes),388,372,'E');item(g=>shelving(g,2.1,2.1,.45,clothes),452,372,'W');item(ottoman,420,300);
 // Storage / laundry
 item(washer,490,389,'N');item(washer,521,389,'N');item(g=>shelving(g,1.4,1.8,.34,clothes),600,393,'N');
 return glow}

// ================= Apartment location on the floor plate (block scheme) =================
// Plate in plan units: our apartment at the west end, lift/stair core, corridor, neighbours in two rows.
function floorPlate(n){const W0=PLAN.w,H=PLAN.h,k=H/440,AW=270*k,CW=230*k,others=Math.max(0,n-1),top=Math.ceil(others/2),bot=others-top,x0=W0+CW,W=x0+Math.max(top,bot,1)*AW,rowH=180*k,corY=rowH,corH=H-2*rowH;const apts=[{x:0,y:0,w:W0,h:H,slot:0,ours:true}];
 for(let q=0;q<top;q++)apts.push({x:x0+q*AW,y:0,w:AW,h:rowH,slot:1+q});for(let q=0;q<bot;q++)apts.push({x:x0+q*AW,y:H-rowH,w:AW,h:rowH,slot:1+top+q});
 return {W,H,k,apts,core:[W0,0,CW,H],corridor:[W0,corY,W-W0,corH],stairs:[W0+20*k,20*k,120*k,140*k],lifts:[W0+20*k,H-160*k,120*k,140*k]}}
function plateSvg(s,floor,{compact=false}={}){const n=s.apartments,p=floorPlate(n),base=(floor-2)*n+1,k=p.k,pad=70*k;
 const aps=p.apts.map(a=>{const num=base+a.slot;const cx=a.x+a.w/2,cy=a.y+a.h/2;return a.ours?`<path d="${polyPath(PLAN.outline)}" fill="#e8c894" stroke="#8a6a36" stroke-width="${6*k}"/><text x="${cx}" y="${cy-8*k}" text-anchor="middle" font-size="${46*k}" font-weight="800" fill="#10201f">${num}</text><text x="${cx}" y="${cy+36*k}" text-anchor="middle" font-size="${24*k}" font-weight="800" fill="#6b4f24" letter-spacing="2">ВАША КВАРТИРА</text>`:`<rect x="${a.x+6*k}" y="${a.y+6*k}" width="${a.w-12*k}" height="${a.h-12*k}" fill="#f4f1ea" stroke="#9aa39f" stroke-width="${3*k}"/><text x="${cx}" y="${cy+12*k}" text-anchor="middle" font-size="${34*k}" font-weight="700" fill="#7b8683">${num}</text>`}).join('');
 const [sx,sy,sw,sh]=p.stairs,[lx,ly,lw,lh]=p.lifts,[cx0,cy0,cw,ch]=p.corridor;
 const stairs=Array.from({length:8},(_,k)=>`<line x1="${sx+10}" y1="${sy+12+k*16}" x2="${sx+sw-10}" y2="${sy+12+k*16}" stroke="#7b8683" stroke-width="2"/>`).join('');
 return `<svg viewBox="${-pad} ${-pad-30*k} ${p.W+pad*2} ${p.H+pad*2+30*k}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Расположение квартиры на этаже" font-family="Manrope,Arial,sans-serif">
 <rect x="-10" y="-10" width="${p.W+20}" height="${p.H+20}" fill="#fff" stroke="#10201f" stroke-width="8"/>
 <rect x="${cx0}" y="${cy0}" width="${cw}" height="${ch}" fill="#e6e3da"/><line x1="${cx0+20}" y1="${cy0+ch/2}" x2="${cx0+cw-20}" y2="${cy0+ch/2}" stroke="#b9bdb6" stroke-width="3" stroke-dasharray="14 10"/><text x="${cx0+cw-24}" y="${cy0+ch/2+10}" text-anchor="end" font-size="24" font-weight="700" fill="#8a948f" letter-spacing="3">КОРИДОР</text>
 <rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" fill="#d7d4ca" stroke="#9aa39f" stroke-width="3"/>${stairs}<rect x="${lx}" y="${ly}" width="${lw/2-4}" height="${lh}" fill="#d7d4ca" stroke="#9aa39f" stroke-width="3"/><rect x="${lx+lw/2+4}" y="${ly}" width="${lw/2-4}" height="${lh}" fill="#d7d4ca" stroke="#9aa39f" stroke-width="3"/><text x="${lx+lw/4-2}" y="${ly+lh/2+10}" text-anchor="middle" font-size="26" font-weight="800" fill="#6f7a76">Л</text><text x="${lx+lw*3/4+2}" y="${ly+lh/2+10}" text-anchor="middle" font-size="26" font-weight="800" fill="#6f7a76">Л</text>
 ${aps}
 ${['N','E','S','W'].map(ps=>{const view=(FACADE_VIEWS[s.short]||FACADE_VIEWS.default)[sideOf(trueBearing(SIDE_DEG[ps]))];if(!view)return '';const t=viewPhrase(view)[1].toUpperCase(),o=pad*.55,pos={N:[p.W/2,-o,0],S:[p.W/2,p.H+o,0],W:[-o,p.H/2,-90],E:[p.W+o,p.H/2,90]}[ps];return `<text x="${pos[0]}" y="${pos[1]}" transform="rotate(${pos[2]} ${pos[0]} ${pos[1]})" text-anchor="middle" dominant-baseline="middle" font-size="${22*k}" font-weight="800" letter-spacing="3" fill="#8a6a36">${t}</text>`}).join('')}
 <g transform="translate(${p.W-10} ${-pad-4})" transform-origin="0 0"><g transform="rotate(${-PLAN.north})"><path d="M0 -22 L9 6 L0 0 L-9 6 Z" fill="#b3362b"/><text x="-18" y="4" text-anchor="end" font-size="24" font-weight="800" fill="#b3362b">С</text></g></g>
 <text x="0" y="${-pad+2}" font-size="24" font-weight="800" fill="#8a6a36" letter-spacing="3">${compact?'':'БЛОК '+s.short+' · ЭТАЖ '+String(floor).padStart(2,'0')}</text></svg>`}
function elevationHtml(s,floor){const n=s.floors;return `<div class="elev-bar" aria-hidden="true">${Array.from({length:n},(_,k)=>{const f=n-k;return `<i class="${f===floor?'on':''}"></i>`}).join('')}</div><div class="elev-text"><b>Этаж ${String(floor).padStart(2,'0')}</b><span>из ${n}</span></div>`}
function fillLocation(s,floor){{const living=floor%3===0?'ГОСТИНАЯ':'КУХНЯ-ГОСТИНАЯ',txt=viewsSummary(living);document.getElementById('apt-views').innerHTML=txt?`<b>Окна выходят:</b> ${txt}`:''}document.getElementById('apt-location-svg').innerHTML=plateSvg(s,floor,{compact:true});document.getElementById('apt-elev').innerHTML=elevationHtml(s,floor);const n=s.apartments;document.getElementById('apt-location-note').textContent=`${n} квартир на этаже · ваша — №${(floor-2)*n+1}, торцевая, с окнами на три стороны`}

// 3D context: neighbours as translucent volumes, core and corridor, gold outline around ours
let showContext=false;
function buildContext(T,S,s,floor){const g=new T.Group(),p=floorPlate(s.apartments),base=(floor-2)*s.apartments+1,P=(x,y)=>[(x-PLAN.cx)*S,(y-PLAN.cy)*S];
 const ghost=new T.MeshStandardMaterial({color:'#ffffff',transparent:true,opacity:.28,roughness:.9,depthWrite:false}),edge=new T.LineBasicMaterial({color:'#6f7a76',transparent:true,opacity:.7});
 const vol=(x,y,w,h,ht,m,edges=true)=>{const [cx,cz]=P(x+w/2,y+h/2),geo=new T.BoxGeometry(w*S,ht,h*S),mesh=new T.Mesh(geo,m);mesh.position.set(cx,ht/2,cz);g.add(mesh);if(edges){const e=new T.LineSegments(new T.EdgesGeometry(geo),edge);e.position.copy(mesh.position);g.add(e)}return mesh};
 // floor slab of the whole plate
 const [px,pz]=P(p.W/2,p.H/2),slab=new T.Mesh(new T.BoxGeometry((p.W+20)*S,.3,(p.H+20)*S),new T.MeshStandardMaterial({color:'#cfcdc3',roughness:.95}));slab.position.set(px,-.152,pz);slab.receiveShadow=true;g.add(slab);
 p.apts.filter(a=>!a.ours).forEach(a=>{vol(a.x+6,a.y+6,a.w-12,a.h-12,2.8,ghost);const lbl=textPlane(T,String(base+a.slot),{w:1.6,h:.9,color:'#56625f',size:260});const [cx,cz]=P(a.x+a.w/2,a.y+a.h/2);lbl.position.set(cx,2.82,cz);g.add(lbl)});
 vol(...p.core,2.95,new T.MeshStandardMaterial({color:'#c9c6bb',roughness:.9,transparent:true,opacity:.85}));{const lbl=textPlane(T,'ЛИФТЫ · ЛЕСТНИЦА',{w:3.2,h:.5,color:'#10201f',size:64});const [cx,cz]=P(p.core[0]+p.core[2]/2,p.core[1]+p.core[3]/2);lbl.position.set(cx,2.97,cz);lbl.rotation.z=Math.PI/2;g.add(lbl)}
 const [cx0,cy0,cw,ch]=p.corridor,cor=new T.Mesh(new T.BoxGeometry(cw*S,.02,ch*S),new T.MeshStandardMaterial({color:'#e3e0d6',roughness:.9}));{const [cx,cz]=P(cx0+cw/2,cy0+ch/2);cor.position.set(cx,.012,cz);cor.receiveShadow=true;g.add(cor)}
 // gold outline around our apartment
 const pts=[...PLAN.outline,PLAN.outline[0]].map(([x,y])=>{const [a,b]=P(x,y);return new T.Vector3(a,.05,b)});
 const tube=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts,false,'catmullrom',0),200,.07,6,false),new T.MeshBasicMaterial({color:'#e2b760'}));g.add(tube);
 const tag=textPlane(T,`ВАША КВАРТИРА · №${base}`,{w:5,h:.8,color:'#10201f',bg:'#e8c894',size:74});const [ax,az]=P(PLAN.cx,PLAN.minY-70);tag.position.set(ax,2.95,az);tag.renderOrder=5;tag.material.depthTest=false;g.add(tag);
 g.userData.center=new T.Vector3(px,.8,pz);g.userData.radius=Math.hypot(p.W*S,p.H*S)/2+1.5;return g}
function applyContext(){const v=view3d;if(!v||!v.context)return;v.context.visible=showContext;const c=showContext?v.context.userData.center:new v.T.Vector3(0,.8,0);v.controls.target.copy(c);v.controls.maxDistance=v.fitDist(false)*1.7;v.setView(v.mode==='top'?'top':'3d')}
document.getElementById('plan-block').addEventListener('click',()=>{showContext=!showContext;syncToggle('plan-block',showContext);applyContext()});

// ================= Furniture for imported plans =================
// 1) DXF blocks on layer BH-FURN (converted to PLAN.furniture): BED-180, SOFA-240, KITCHEN-300, DINING-6, WARDROBE-120, BATH, …
// 2) otherwise a simple auto layout by room type (main piece against a wall without windows).
function placeFurniture(F){const {item,M,S}=F,u=m=>m/S;
 const byType={BED:(g,w,l)=>F.bed(g,w||1.8,l||2.1,M.duvet),NIGHTSTAND:F.nightstand,WARDROBE:(g,w)=>F.wardrobe(g,w||1.2),SOFA:(g,w)=>F.sofa(g,w||2.4),ARMCHAIR:F.armchair,COFFEE:F.coffee,RUG:(g,w,l)=>F.rug(g,w||2.4,l||1.6,M.rug),
  DINING:F.dining,KITCHEN:(g,w)=>F.kitchen(g,Math.max(1.2,(w||3)-.72)),BATH:F.bath,VANITY:F.vanity,TOILET:F.toilet,SHELF:(g,w)=>F.shelving(g,w||1.6,2.1,.4,F.books),CLOSET:(g,w)=>F.shelving(g,w||2,2.1,.45,F.clothes),WASHER:F.washer,LAMP:F.floorLamp,PLANT:g=>F.plant(g,1.1),OTTOMAN:F.ottoman};
 if(PLAN.furniture&&PLAN.furniture.length){PLAN.furniture.forEach(f=>{const [kind,...dims]=String(f.type).toUpperCase().split('-');const fn=byType[kind];if(!fn)return;const nums=(dims.join('x').match(/\d+/g)||[]).map(v=>+v/100);item(g=>fn(g,nums[0],nums[1]),f.x,f.y,f.rot||0)});return}
 const views=windowViews(),FACEOF={N:'S',S:'N',W:'E',E:'W'},OPP={N:'S',S:'N',E:'W',W:'E'};
 const at=(bb,side,depthU)=>{const off=depthU/2+u(.1);return side==='N'?[(bb.x0+bb.x1)/2,bb.y0+off]:side==='S'?[(bb.x0+bb.x1)/2,bb.y1-off]:side==='W'?[bb.x0+off,(bb.y0+bb.y1)/2]:[bb.x1-off,(bb.y0+bb.y1)/2]};
 const along=(bb,side)=>(side==='N'||side==='S')?(bb.x1-bb.x0)*S:(bb.y1-bb.y0)*S,across=(bb,side)=>(side==='N'||side==='S')?(bb.y1-bb.y0)*S:(bb.x1-bb.x0)*S;
 PLAN.rooms.forEach(r=>{const xs=r.poly.map(p=>p[0]),ys=r.poly.map(p=>p[1]),bb={x0:Math.min(...xs),y0:Math.min(...ys),x1:Math.max(...xs),y1:Math.max(...ys)};
  const win=new Set(views.filter(v=>v.room===r).map(v=>v.planSide)),blind=['N','E','S','W'].filter(sd=>!win.has(sd)).sort((a,b)=>(win.has(OPP[b])?1:0)-(win.has(OPP[a])?1:0)||along(bb,b)-along(bb,a));
  const pick=(len,dep)=>blind.find(sd=>along(bb,sd)>=len+.2&&across(bb,sd)>=dep+.6);
  const put=(fn,side,dep)=>{const [x,y]=at(bb,side,u(dep));item(fn,x,y,FACEOF[side])};
  const t=r.type;
  if(t==='bed'||t==='guest'){const w=t==='bed'?1.8:1.4,l=2.05,sd=pick(w+(t==='bed'?1:0),l)||pick(w,l);if(!sd)return;put(g=>F.bed(g,w,l,t==='bed'?M.duvet:M.duvet2),sd,l);
   const sd2=blind.find(x=>x!==sd&&x!==OPP[sd]);if(sd2&&along(bb,sd2)>=1.4)put(g=>F.wardrobe(g,Math.min(1.8,along(bb,sd2)-.8)),sd2,.6)}
  else if(t==='living'||t==='kitchen-living'){const sd=pick(2.4,1.8)||pick(2,1.6);if(sd){put(g=>F.sofa(g,2.2),sd,.95);const [x,y]=at(bb,sd,u(.95+1.1));item(F.coffee,x,y,FACEOF[sd])}
   if(t==='kitchen-living'){const k=blind.find(x=>x!==sd&&along(bb,x)>=2.2);if(k)put(g=>F.kitchen(g,Math.min(3,along(bb,k)-1)),k,.62)}}
  else if(t==='kitchen'){const k=pick(2.2,1.5);if(k)put(g=>F.kitchen(g,Math.min(3.2,along(bb,k)-.9)),k,.62)}
  else if(t==='bath'){const sd=['N','E','S','W'].filter(x=>along(bb,x)>=1.7).sort((a,b)=>along(bb,b)-along(bb,a))[0];if(sd)put(F.bath,sd,.76);const v=blind.find(x=>x!==sd&&x!==OPP[sd])||OPP[sd];if(v&&across(bb,v)>=1.2)put(F.vanity,v,.46)}
  else if(t==='wardrobe'||t==='storage'){const sd=pick(1,1)||'N';put(g=>F.shelving(g,Math.min(2.4,along(bb,sd)-.3),2.1,.45,F.clothes),sd,.45)}
  else if(t==='hall'&&(bb.x1-bb.x0)*S>2&&(bb.y1-bb.y0)*S>2){item(g=>F.plant(g,1),bb.x0+u(.4),bb.y0+u(.4))}})}

// ================= "Ваш блок": whole complex as simple massing; your block red, your flat glowing; cut on demand =================
const blockMini=(()=>{const el=document.getElementById('block-mini'),sub=document.getElementById('bm-sub'),cutBtn=document.getElementById('bm-cut');
 let L=null,r=null,scene,camera,controls,root,upper,shell,plate,glow,halo,raf=0,expanded=false,cut=false,anim=null,key='',focus=null;
 const FLOOR_H=3.1;
 // schematic site: blocks along the street, tower C behind (metres, x → east, z → south)
 const SITE_ORDER=['A','D','B'];
 function init(lib){if(r)return;L=lib;const {T,OrbitControls}=L;r=new T.WebGLRenderer({antialias:true,alpha:true});r.setPixelRatio(Math.min(2,devicePixelRatio||1));r.shadowMap.enabled=true;r.toneMapping=T.ACESFilmicToneMapping;r.outputColorSpace=T.SRGBColorSpace;el.querySelector('.bm-canvas').appendChild(r.domElement);
  scene=new T.Scene();camera=new T.PerspectiveCamera(30,1,.5,1500);controls=new OrbitControls(camera,r.domElement);controls.enableDamping=true;controls.enablePan=false;controls.autoRotate=false;controls.enabled=false;
  scene.add(new T.HemisphereLight('#eef3f7','#b8ab92',1));const d=new T.DirectionalLight('#fff3e2',2.1);d.position.set(-60,110,80);d.castShadow=true;d.shadow.mapSize.set(2048,2048);Object.assign(d.shadow.camera,{left:-120,right:120,top:120,bottom:-120,far:400});scene.add(d);
  new ResizeObserver(size).observe(el)}
 function size(){if(!r)return;const b=el.querySelector('.bm-canvas').getBoundingClientRect();if(!b.width)return;r.setSize(b.width,b.height,false);camera.aspect=b.width/b.height;camera.updateProjectionMatrix();if(root)frame(true)}
 function allBuildings(){return [...scenes,...Object.values(altBuildings).flat()]}
 function haloTexture(T){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d'),g=x.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,214,110,1)');g.addColorStop(.35,'rgba(255,180,60,.55)');g.addColorStop(1,'rgba(255,160,40,0)');x.fillStyle=g;x.fillRect(0,0,128,128);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t}
 function build(s,floor){const {T}=L,S=PLAN_UNIT;key=s.short+floor+PLAN.id;if(root)scene.remove(root);root=new T.Group();scene.add(root);
  const white=new T.MeshStandardMaterial({color:'#f3efe8',roughness:.9}),whiteTop=new T.MeshStandardMaterial({color:'#e2ddd3',roughness:.9}),red=new T.MeshStandardMaterial({color:'#e2573f',roughness:.8}),redTop=new T.MeshStandardMaterial({color:'#c9442f',roughness:.8});
  const edgeW=new T.LineBasicMaterial({color:'#b9b2a6',transparent:true,opacity:.6}),edgeR=new T.LineBasicMaterial({color:'#ffd9cf',transparent:true,opacity:.6});
  // footprints for every block (same plate generator, per block apartment count)
  const blocks=allBuildings().map(b=>{const p=floorPlate(b.apartments);return {b,p,W:p.W*S,H:p.H*S}});
  let x=0;const pos={};SITE_ORDER.forEach(k=>{const bl=blocks.find(q=>q.b.short===k);if(!bl)return;pos[k]=[x+bl.W/2,0];x+=bl.W+16});const rowW=x-16;root.userData.rowW=rowW;
  blocks.forEach(bl=>{if(!pos[bl.b.short])pos[bl.b.short]=[rowW/2,-(bl.H/2+30)]});Object.values(pos).forEach(p=>p[0]-=rowW/2);
  // ground, street along the north side, courtyard in the middle
  const g=new T.Mesh(new T.PlaneGeometry(rowW+140,160),new T.ShadowMaterial({opacity:.18}));g.rotation.x=-Math.PI/2;g.receiveShadow=true;g.position.z=-10;root.add(g);
  const views=FACADE_VIEWS[s.short]||FACADE_VIEWS.default;const strip=(v,z,w,h,col,txtCol)=>{const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshStandardMaterial({color:col,roughness:1}));m.rotation.x=-Math.PI/2;m.position.set(0,.02,z);m.receiveShadow=true;root.add(m);const t=textPlane(T,v.toUpperCase(),{w:16,h:3,color:txtCol,size:150});t.position.set(-rowW/2+14,.06,z);root.add(t)};
  const streetSide=['N','S'].find(ps=>/улиц/i.test(views[sideOf(trueBearing(SIDE_DEG[ps]))]||''))||'S',yardSide=streetSide==='S'?'N':'S';
  const maxH=Math.max(...blocks.filter(q=>SITE_ORDER.includes(q.b.short)).map(q=>q.H));
  strip(views[sideOf(trueBearing(SIDE_DEG[streetSide]))]||'Улица',(streetSide==='S'?1:-1)*(maxH/2+9),rowW+120,11,'#5b6266','#ffffff');
  strip(views[sideOf(trueBearing(SIDE_DEG[yardSide]))]||'Двор',(yardSide==='S'?1:-1)*(maxH/2+10),rowW+20,12,'#a9bf97','#2d4a2a');
  upper=new T.Group();shell=new T.Group();plate=new T.Group();
  blocks.forEach(bl=>{const ours=bl.b.short===s.short,[px,pz]=pos[bl.b.short],grp=new T.Group();grp.position.set(px,0,pz);root.add(grp);const n=bl.b.floors;
   for(let f=1;f<=n;f++){const geo=new T.BoxGeometry(bl.W,FLOOR_H-.08,bl.H),top=f===n?(ours?redTop:whiteTop):(ours?red:white),side=ours?red:white,m=new T.Mesh(geo,[side,side,top,side,side,side]);m.position.y=(f-1)*FLOOR_H+FLOOR_H/2;m.castShadow=m.receiveShadow=true;
    const e=new T.LineSegments(new T.EdgesGeometry(geo),ours?edgeR:edgeW);e.position.copy(m.position);
    if(ours&&f>floor){const mm=m.clone();mm.material=m.material.map(q=>q.clone());const ee=e.clone();ee.material=e.material.clone();upper.add(mm,ee)}else if(ours&&f===floor){shell.add(m,e)}else grp.add(m,e)}
   if(ours){grp.add(upper,shell,plate);focus={x:px,z:pz,W:bl.W,H:bl.H,top:n*FLOOR_H,cut:floor*FLOOR_H}}
   const lbl=textPlane(T,(ours?'ВАШ БЛОК · ':'')+bl.b.name.toUpperCase(),{w:ours?12:9,h:ours?1.6:1.3,color:ours?'#ffffff':'#56625f',bg:ours?'#c9442f':null,size:ours?92:110});lbl.position.set(px,n*FLOOR_H+.08,pz);lbl.renderOrder=3;root.add(lbl)});
  // current floor plate (shown when cut): neighbours, core, corridor
  const p=floorPlate(s.apartments),S2=S,W=p.W*S2,H=p.H*S2,X=v=>v*S2-W/2,Z=v=>v*S2-H/2,y0=(floor-1)*FLOOR_H,base=(floor-2)*s.apartments+1;
  const slab=new T.Mesh(new T.BoxGeometry(W,.25,H),new T.MeshStandardMaterial({color:'#d8d4ca'}));slab.position.y=y0+.12;plate.add(slab);
  const vol=(x,y,w,h,ht,col)=>{const m=new T.Mesh(new T.BoxGeometry(w*S2,ht,h*S2),new T.MeshStandardMaterial({color:col,roughness:.8}));m.position.set(X(x+w/2),y0+.25+ht/2,Z(y+h/2));m.castShadow=m.receiveShadow=true;plate.add(m);const e=new T.LineSegments(new T.EdgesGeometry(m.geometry),new T.LineBasicMaterial({color:'#6f6a60'}));e.position.copy(m.position);plate.add(e)};
  p.apts.filter(a=>!a.ours).forEach(a=>{vol(a.x+4,a.y+4,a.w-8,a.h-8,FLOOR_H-.35,'#f5efe6');const t=textPlane(T,String(base+a.slot),{w:3,h:1.5,color:'#7b6f62',size:200});t.position.set(X(a.x+a.w/2),y0+FLOOR_H-.05,Z(a.y+a.h/2));plate.add(t)});
  vol(...p.core,FLOOR_H-.1,'#b9b4a8');plate.visible=false;
  // your apartment: glowing, pulsing volume, slightly proud of the facade so it reads from outside
  const sh=new T.Shape();PLAN.outline.forEach(([x,y],k)=>k?sh.lineTo(X(x),-Z(y)):sh.moveTo(X(x),-Z(y)));
  glow=new T.Mesh(new T.ExtrudeGeometry(sh,{depth:FLOOR_H-.2,bevelEnabled:false}),new T.MeshStandardMaterial({color:'#ffc94d',emissive:'#ffae1a',emissiveIntensity:1,roughness:.4}));glow.rotation.x=-Math.PI/2;glow.position.y=y0+.1;glow.scale.set(1.02,1.02,1);glow.castShadow=true;shell.parent.add(glow);
  halo=new T.Sprite(new T.SpriteMaterial({map:haloTexture(T),blending:T.AdditiveBlending,depthWrite:false,transparent:true}));const [ox,oz]=[X(PLAN.cx),Z(PLAN.cy)];halo.position.set(ox,y0+FLOOR_H/2,oz);halo.userData.base=Math.max(PLAN.w,PLAN.h)*S2*1.6;shell.parent.add(halo);
  const tag=textPlane(T,`№${base}`,{w:4,h:2,color:'#10201f',size:200});tag.position.set(ox,y0+FLOOR_H+.05,oz);tag.visible=false;plate.add(tag);
  setCut(false,true);frame(true)}
 function frame(jump){if(!focus)return;const T=L.T;let t,hw,hd;
  if(expanded&&cut){t=new T.Vector3(focus.x,focus.cut,focus.z);hw=focus.W/2+6;hd=focus.H/2+6}
  else if(expanded){t=new T.Vector3(focus.x,0,focus.z);hw=focus.W/2+12;hd=focus.H/2+12}
  else{const bb=new T.Box3();root.traverse(o=>{if(o.isMesh&&o.geometry&&o.geometry.type==='BoxGeometry'){o.updateWorldMatrix(true,false);bb.expandByObject(o)}});t=bb.getCenter(new T.Vector3());t.y=0;hw=(bb.max.x-bb.min.x)/2+3;hd=(bb.max.z-bb.min.z)/2+8}
  const vf=camera.fov*Math.PI/180,hf=2*Math.atan(Math.tan(vf/2)*camera.aspect),top=(expanded&&cut)?0:(focus.top||0),D=Math.max(hw/Math.tan(hf/2),hd/Math.tan(vf/2))+top;
  controls.target.copy(t);controls.maxDistance=D*2;controls.minDistance=D*.3;controls.maxPolarAngle=Math.PI*.42;if(jump){camera.up.set(0,1,0);camera.position.set(t.x,t.y+D,t.z+D*.08)}camera.lookAt(t)}
 function setCut(on,instant=false){cut=on;cutBtn.classList.toggle('active',on);cutBtn.setAttribute('aria-pressed',String(on));cutBtn.textContent=on?'↺ Собрать блок':'✂ Разрез по этажу';
  shell.visible=!on;plate.visible=on;plate.children.forEach(o=>{if(o.isMesh&&o.geometry.type==='PlaneGeometry')o.visible=on});if(instant){upper.visible=!on;upper.position.y=on?10:0;return}upper.visible=true;anim={t0:performance.now(),from:upper.position.y,to:on?10:0};frame(true)}
 function loop(now){if(!planModal.classList.contains('open')){raf=0;return}raf=requestAnimationFrame(loop);
  const k=.5+.5*Math.sin((now||0)/260);if(glow){glow.material.emissiveIntensity=.55+1.25*k}if(halo){const b=halo.userData.base*(1+.35*k);halo.scale.set(b,b,1);halo.material.opacity=.45+.5*k}
  if(anim){const q=Math.min(1,(performance.now()-anim.t0)/700),e=easeInOut(q);upper.position.y=anim.from+(anim.to-anim.from)*e;const op=anim.to>0?1-e:e;upper.traverse(o=>{const ms=o.material?(Array.isArray(o.material)?o.material:[o.material]):[];ms.forEach(m=>{m.transparent=true;m.opacity=(o.isLineSegments?.6:1)*op})});if(q>=1){if(anim.to>0)upper.visible=false;anim=null}}
  controls.update();r.render(scene,camera)}
 function setExpanded(on){expanded=on;el.classList.toggle('expanded',on);controls.enabled=on;if(!on&&cut)setCut(false);setTimeout(()=>{size();frame(true)},340)}
 cutBtn.addEventListener('click',e=>{e.stopPropagation();setCut(!cut)});
 el.addEventListener('click',e=>{if(e.target.closest('.bm-close')){e.stopPropagation();setExpanded(false);return}if(!expanded&&r)setExpanded(true)});
 el.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!expanded&&r&&e.target===el){e.preventDefault();setExpanded(true)}});
 return{async mount(lib,s,floor){init(lib);el.hidden=false;sub.textContent=`${s.name} · этаж ${String(floor).padStart(2,'0')} из ${s.floors}`;if(key!==s.short+floor+PLAN.id)build(s,floor);size();if(!raf)raf=requestAnimationFrame(loop)},
  collapse(){if(expanded&&r)setExpanded(false)}}})();

// ---- Compass + Qibla (Tashkent 41.30°N 69.24°E → Kaaba 21.42°N 39.83°E, great-circle bearing) ----
const QIBLA_BEARING=240.3;
function textPlane(T,text,{w=1.2,h=.6,color='#10201f',bg=null,font=800,size=150}={}){const c=document.createElement('canvas');c.width=512;c.height=Math.round(512*h/w);const x=c.getContext('2d');if(bg){x.fillStyle=bg;x.beginPath();x.roundRect(0,0,c.width,c.height,40);x.fill()}x.fillStyle=color;x.font=`${font} ${size}px Manrope, Arial, sans-serif`;{const tw=x.measureText(text).width,mx=c.width*.9;if(tw>mx){size=Math.floor(size*mx/tw);x.font=`${font} ${size}px Manrope, Arial, sans-serif`}}x.textAlign='center';x.textBaseline='middle';x.fillText(text,c.width/2,c.height/2+6);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:t,transparent:true,depthWrite:false}));m.rotation.x=-Math.PI/2;return m}
function buildCompass(T){const g=new T.Group(),R=10.2,Y=-.28,gold='#b88a45',ink='#243b3c';g.position.y=Y;
 const ring=new T.Mesh(new T.RingGeometry(R-.05,R,160),new T.MeshBasicMaterial({color:ink,transparent:true,opacity:.55,side:T.DoubleSide}));ring.rotation.x=-Math.PI/2;g.add(ring);
 const ring2=new T.Mesh(new T.RingGeometry(R+.55,R+.58,160),new T.MeshBasicMaterial({color:ink,transparent:true,opacity:.25,side:T.DoubleSide}));ring2.rotation.x=-Math.PI/2;g.add(ring2);
 for(let d=0;d<360;d+=5){const major=d%45===0,len=major?.5:d%15===0?.3:.15,t=new T.Mesh(new T.PlaneGeometry(major?.06:.03,len),new T.MeshBasicMaterial({color:ink,transparent:true,opacity:major?.8:.45,side:T.DoubleSide}));const a=d*Math.PI/180;t.rotation.x=-Math.PI/2;t.rotation.z=-a;t.position.set(Math.sin(a)*(R+len/2),0,-Math.cos(a)*(R+len/2));g.add(t)}
 [['С',0,'#b3362b'],['В',90,ink],['Ю',180,ink],['З',270,ink]].forEach(([l,d,c])=>{const a=d*Math.PI/180,p=textPlane(T,l,{w:1.1,h:1.1,color:c,size:300});p.position.set(Math.sin(a)*(R+1.3),.01,-Math.cos(a)*(R+1.3));g.add(p)});
 // north needle
 const nShape=new T.Shape();nShape.moveTo(0,R-.15);nShape.lineTo(-.28,R-1.1);nShape.lineTo(.28,R-1.1);nShape.closePath();const nn=new T.Mesh(new T.ShapeGeometry(nShape),new T.MeshBasicMaterial({color:'#b3362b',side:T.DoubleSide}));nn.rotation.x=-Math.PI/2;g.add(nn);
 // Qibla: dashed gold line from the centre, arrowhead, Kaaba marker and label
 const qa=QIBLA_BEARING*Math.PI/180,dir=new T.Vector3(Math.sin(qa),0,-Math.cos(qa));
 const qg=new T.Group();g.add(qg);
 const line=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(0,.02,0),dir.clone().multiplyScalar(R-.2).setY(.02)]),new T.LineDashedMaterial({color:gold,dashSize:.35,gapSize:.2}));line.computeLineDistances();qg.add(line);
 const head=new T.Shape();head.moveTo(0,.55);head.lineTo(-.35,-.25);head.lineTo(0,-.05);head.lineTo(.35,-.25);head.closePath();const hm=new T.Mesh(new T.ShapeGeometry(head),new T.MeshBasicMaterial({color:gold,side:T.DoubleSide}));hm.rotation.x=-Math.PI/2;hm.rotation.z=-qa;hm.position.copy(dir.clone().multiplyScalar(R-.7)).setY(.03);qg.add(hm);
 const kaaba=new T.Mesh(new T.BoxGeometry(.9,.9,.9),[0,0,0,0,0,0].map((_,k)=>new T.MeshStandardMaterial({color:k===2?'#1b1b1b':'#111',roughness:.6})));kaaba.position.copy(dir.clone().multiplyScalar(R+1.35)).setY(.45);kaaba.rotation.y=-qa;kaaba.castShadow=true;qg.add(kaaba);
 const band=new T.Mesh(new T.BoxGeometry(.92,.1,.92),new T.MeshStandardMaterial({color:'#c9a24a',metalness:.6,roughness:.35}));band.position.copy(kaaba.position).setY(.7);band.rotation.y=-qa;qg.add(band);
 const lbl=textPlane(T,`КИБЛА ${Math.round(QIBLA_BEARING)}°`,{w:3.2,h:.7,color:'#fff',bg:gold,size:120});lbl.rotation.z=-qa+Math.PI/2;lbl.position.copy(dir.clone().multiplyScalar(R+3.3)).setY(.02);qg.add(lbl);
 return g}

async function mountThree(){const host=planRender,token=(mountThree.token=(mountThree.token||0)+1);let L;try{L=await loadThree()}catch(e){console.warn('three.js unavailable, using CSS 3D',e);return}if(token!==mountThree.token||!planModal.classList.contains('open'))return;
 const {T,OrbitControls,RoomEnvironment}=L,S=PLAN_UNIT;
 if(!view3d){const renderer=new T.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(2,devicePixelRatio||1));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.9;renderer.outputColorSpace=T.SRGBColorSpace;
  const scene=new T.Scene(),pm=new T.PMREMGenerator(renderer);scene.environment=pm.fromScene(new RoomEnvironment(),.04).texture;
  const camera=new T.PerspectiveCamera(32,1,.1,200);const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;controls.maxPolarAngle=Math.PI*.46;controls.minDistance=7;controls.maxDistance=40;controls.target.set(0,.8,0);controls.autoRotate=!reduce;controls.autoRotateSpeed=.55;controls.enablePan=false;
  let idleTimer=0;controls.addEventListener('start',()=>{controls.autoRotate=false;clearTimeout(idleTimer);planIdle=performance.now()});controls.addEventListener('end',()=>{clearTimeout(idleTimer);idleTimer=setTimeout(()=>{if(!reduce&&view3d.mode!=='top')controls.autoRotate=true},2500)});
  const hemi=new T.HemisphereLight('#e4eef6','#b9a98c',.55);scene.add(hemi);const sun=new T.DirectionalLight('#fff2dc',3);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-11,right:11,top:11,bottom:-11,near:1,far:60});sun.shadow.bias=-.0004;sun.shadow.normalBias=.03;sun.shadow.radius=4;scene.add(sun,sun.target);
  const ground=new T.Mesh(new T.PlaneGeometry(80,80),new T.ShadowMaterial({opacity:.18}));ground.rotation.x=-Math.PI/2;ground.position.y=-.3;ground.receiveShadow=true;scene.add(ground);
  view3d={T,renderer,scene,camera,controls,sun,hemi,group:null,tags:[],lines:null,lastSun:null,mode:'3d',anim:null,ready:false,
   fitDist(top){const vf=this.camera.fov*Math.PI/180,hf=2*Math.atan(Math.tan(vf/2)*this.camera.aspect),R=showContext&&this.context?this.context.userData.radius*(top?1:1.05):top?(showCompass3d?13.6:7.4):(showCompass3d?12.6:8.2);return R/Math.sin(Math.min(vf,hf)/2)},
   setView(v){const c=this.controls,to=v==='top'?{pol:.001,az:0,dist:this.fitDist(true)}:{pol:.8,az:-.55,dist:this.fitDist(false)};c.maxDistance=this.fitDist(false)*1.7;this.mode=v==='top'?'top':'3d';c.autoRotate=v!=='top'&&!reduce;const sph=new T.Spherical().setFromVector3(this.camera.position.clone().sub(c.target));const from={pol:sph.phi,az:sph.theta,dist:sph.radius};let dAz=to.az-from.az;dAz=Math.atan2(Math.sin(dAz),Math.cos(dAz));this.anim={t0:performance.now(),from,to:{...to,az:from.az+dAz}}},
   placeCamera(pol,az,dist){const c=this.controls,v=new T.Vector3().setFromSphericalCoords(dist,pol,az);this.camera.position.copy(c.target).add(v);this.camera.lookAt(c.target)}};
  const ro=new ResizeObserver(()=>{const r=planRender.getBoundingClientRect();if(!r.width||!r.height)return;view3d.renderer.setSize(r.width,r.height,false);view3d.camera.aspect=r.width/r.height;view3d.camera.updateProjectionMatrix()});ro.observe(planRender)}
 const v=view3d;if(v.group){v.scene.remove(v.group);v.group.traverse(o=>{o.geometry&&o.geometry.dispose()})}
 const floorTex=await floorTextureFor(T,false);if(token!==mountThree.token)return;
 v.group=buildApartment(L,{scale:S,floorTex});v.lamps=aptRooms(0,'ГОСТИНАЯ').map(r=>{const l=new T.PointLight('#ffc98a',0,6,1.6);l.position.set((r.t[0]-PLAN.cx)*S,2.3,(r.t[1]-PLAN.cy)*S+.4);return l});v.lamps.forEach(l=>v.group.add(l));v.compass=buildCompass(T);v.compass.rotation.y=PLAN.north*Math.PI/180;v.group.add(v.compass);v.context=buildContext(T,S,cur(),selectedFloor);v.group.add(v.context);v.context.visible=showContext;v.scene.add(v.group);v.group.userData.furn.visible=showFurniture;v.compass.visible=showCompass3d;
 // room tags: 3D leader lines + HTML labels projected every frame
 const living=selectedFloor%3===0?'ГОСТИНАЯ':'КУХНЯ-ГОСТИНАЯ',rooms=aptRooms(0,living);const lineMat=new T.LineBasicMaterial({color:'#8a6a36'});v.lines=new T.Group();v.tags=rooms.map(r=>{const x=(r.t[0]-PLAN.cx)*S,z=(r.t[1]-PLAN.cy)*S;const geo=new T.BufferGeometry().setFromPoints([new T.Vector3(x,.01,z),new T.Vector3(x,3.3,z)]);const ln=new T.Line(geo,lineMat);v.lines.add(ln);const dot=new T.Mesh(new T.CircleGeometry(.09,20),new T.MeshBasicMaterial({color:'#8a6a36'}));dot.rotation.x=-Math.PI/2;dot.position.set(x,.012,z);v.lines.add(dot);return {p:new T.Vector3(x,3.3,z),name:r.n,area:r.area}});v.group.add(v.lines);v.lines.visible=planInfo;
 // window views: one label per facade/view, placed outside the windows, with ground arrows
 const groups=new Map();windowViews().forEach(w=>{const key=w.view+'|'+w.planSide;if(!groups.has(key))groups.set(key,{view:w.view,pts:[],out:w.out,len:0});const gq=groups.get(key);gq.pts.push(w.mid);gq.len+=w.len});
 const arrowMat=new T.MeshBasicMaterial({color:'#b88a45',side:T.DoubleSide});
 v.viewTags=[...groups.values()].map((gq,k)=>{const mx=gq.pts.reduce((a,p)=>a+p[0],0)/gq.pts.length,my=gq.pts.reduce((a,p)=>a+p[1],0)/gq.pts.length,ox=gq.out[0],oy=gq.out[1];
  gq.pts.forEach(p=>{const sh=new T.Shape();sh.moveTo(0,.9);sh.lineTo(-.28,.35);sh.lineTo(-.1,.35);sh.lineTo(-.1,0);sh.lineTo(.1,0);sh.lineTo(.1,.35);sh.lineTo(.28,.35);sh.closePath();const a=new T.Mesh(new T.ShapeGeometry(sh),arrowMat);a.rotation.x=-Math.PI/2;a.rotation.z=Math.atan2(-ox,-oy);a.position.set((p[0]-PLAN.cx)*S+ox*.45,.02-.3,(p[1]-PLAN.cy)*S+oy*.45);v.lines.add(a)});
  return {p:new T.Vector3((mx-PLAN.cx)*S+ox*2.2,1.2,(my-PLAN.cy)*S+oy*2.2),view:gq.view,k}});
 let overlay=planRender.querySelector('.tags3');if(!overlay){overlay=document.createElement('div');overlay.className='tags3'}overlay.innerHTML=v.tags.map((t,k)=>`<div class="tag3" style="--i:${k}"><span>${t.name.toUpperCase()}<small>${fmtArea(t.area)} м²</small></span></div>`).join('')+v.viewTags.map(t=>`<div class="tag3 view3" style="--i:${v.tags.length+t.k}"><span>${viewPhrase(t.view)[1].toUpperCase()}</span></div>`).join('');v.tags.forEach((t,k)=>t.el=overlay.children[k]);v.viewTags.forEach((t,k)=>t.el=overlay.children[v.tags.length+k]);
 const cvs=v.renderer.domElement;cvs.className='plan-webgl';planRender.appendChild(cvs);planRender.appendChild(overlay);planRender.classList.add('webgl');
 const r=planRender.getBoundingClientRect();v.renderer.setSize(r.width,r.height,false);v.camera.aspect=r.width/r.height;v.camera.updateProjectionMatrix();
 v.mode='3d';v.anim=null;v.controls.autoRotate=!reduce;v.controls.target.copy(showContext?v.context.userData.center:new T.Vector3(0,.8,0));v.controls.maxDistance=v.fitDist(false)*1.7;v.placeCamera(.8,-.55,v.fitDist(false));v.lastSun=null;v.ready=true;
 if(!v.loop){const tmp=new T.Vector3();v.loop=()=>{if(!planModal.classList.contains('open')){v.loop.running=false;return}requestAnimationFrame(v.loop);
   if(v.anim){const k=Math.min(1,(performance.now()-v.anim.t0)/800),e=easeInOut(k),f=v.anim.from,to=v.anim.to;v.placeCamera(f.pol+(to.pol-f.pol)*e,f.az+(to.az-f.az)*e,f.dist+(to.dist-f.dist)*e);if(k>=1)v.anim=null}else v.controls.update();
   const st=sunState();const sk=st.t+'|'+(sunDoy??'t')+'|'+sunOn;if(v.lastSun!==sk){v.lastSun=sk;const el=st.el*Math.PI/180,az=(st.az-PLAN.north)*Math.PI/180;v.sun.castShadow=sunOn;if(!sunOn){v.sun.position.set(4,25,8);v.sun.intensity=1.5;v.sun.color.setRGB(1,.98,.95);v.hemi.intensity=.75;v.hemi.color.setRGB(.9,.93,.96);v.renderer.toneMappingExposure=.95;v.lamps.forEach(l=>l.intensity=0);(v.group.userData.glow||[]).forEach(m=>m.emissiveIntensity=0);const pg=planRender.parentElement;pg.style.background='';pg.classList.remove('is-night')}else if(st.el>0){const dir=new T.Vector3(Math.sin(az)*Math.cos(el),Math.sin(el),-Math.cos(az)*Math.cos(el));v.sun.position.copy(dir.multiplyScalar(25));v.sun.intensity=3.6*Math.pow(Math.sin(el),.5);const warm=Math.max(0,Math.min(1,1-st.el/40));v.sun.color.setRGB(1,.93-.25*warm,.82-.45*warm);v.hemi.intensity=.2+.25*Math.sin(el);v.renderer.toneMappingExposure=.9}else{v.sun.intensity=0;v.hemi.intensity=.12;v.renderer.toneMappingExposure=.8}const night=sunOn?Math.max(0,Math.min(1,(4-st.el)/10)):0;v.lamps.forEach(l=>l.intensity=night*6);if(sunOn){(v.group.userData.glow||[]).forEach(m=>m.emissiveIntensity=night*2.2);{const pg=planRender.parentElement,mix=(a,b)=>Math.round(a+(b-a)*night);pg.style.background=`radial-gradient(ellipse at 50% 40%,rgb(${mix(246,40)},${mix(244,52)},${mix(238,62)}) 0%,rgb(${mix(226,20)},${mix(225,29)},${mix(215,36)}) 75%,rgb(${mix(214,14)},${mix(213,21)},${mix(202,27)}) 100%)`;pg.classList.toggle('is-night',night>.5)}v.hemi.color.setRGB(.89-.45*night,.93-.4*night,.96-.2*night)}}
   v.lines.visible=planInfo;if(planInfo){const w=v.renderer.domElement.clientWidth,h=v.renderer.domElement.clientHeight;[...v.tags,...(v.viewTags||[])].forEach(t=>{tmp.copy(t.p).project(v.camera);t.el.style.transform=`translate(${((tmp.x+1)/2*w).toFixed(1)}px,${((1-tmp.y)/2*h).toFixed(1)}px)`;t.el.style.zIndex=String(Math.round((1-tmp.z)*1e5))})}
   {const cp=v.camera.position,tg=v.controls.target,az=Math.atan2(cp.x-tg.x,cp.z-tg.z)*180/Math.PI;compassDial.style.transform=`rotate(${(az-PLAN.north).toFixed(1)}deg)`}
   v.renderer.render(v.scene,v.camera)};}
 if(!v.loop.running){v.loop.running=true;requestAnimationFrame(v.loop)}blockMini.mount(L,cur(),selectedFloor)}

// ---- Seasons + sunrise/sunset ----
function fmtHM(h){const hh=Math.floor(h),mm=Math.round((h-hh)*60);return `${hh}:${String(mm%60).padStart(2,'0')}`}
function updateSunTimes(){let rise=null,set=null,prev=sunState(0).el;for(let t=.05;t<=24;t+=.05){const e=sunState(t).el;if(prev<0&&e>=0&&rise===null)rise=t;if(prev>=0&&e<0)set=t;prev=e}let max=-90;for(let t=0;t<24;t+=.1)max=Math.max(max,sunState(t).el);document.getElementById('sun-times').textContent=rise?`Восход ${fmtHM(rise)} · Закат ${fmtHM(set)} · max ${Math.round(max)}°`:'—'}
document.querySelectorAll('.sun-seasons [data-doy]').forEach(b=>b.addEventListener('click',()=>{const v=b.dataset.doy;sunDoy=v==='today'?null:+v;document.querySelectorAll('.sun-seasons [data-doy]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b))});planRender.parentElement.dataset.season=b.dataset.season;if(view3d)view3d.lastSun=null;updateSunTimes();updateSun()}));
updateSunTimes();

// ---- Center arrows: fly the camera to prev/next building ----
const orbitPrev=document.getElementById('orbit-prev'),orbitNext=document.getElementById('orbit-next'),orbitNow=document.getElementById('orbit-now');
function syncArrows(i=active){orbitNow.textContent=`0${i+1}`;orbitPrev.disabled=i<=0;orbitNext.disabled=i>=scenes.length-1}
function stepOrbit(d){const i=Math.max(0,Math.min(scenes.length-1,active+d));if(i===active||moving)return;if(window.scrollY<experience.offsetTop-5||window.scrollY>positionFor(2)+5)window.scrollTo({top:positionFor(active),behavior:'instant'});syncArrows(i);goToStop(i)}
orbitPrev.addEventListener('click',()=>stepOrbit(-1));orbitNext.addEventListener('click',()=>stepOrbit(1));
document.addEventListener('keydown',e=>{if(selector.classList.contains('open')||planModal.classList.contains('open')||pano.isOpen()||arModal.classList.contains('open'))return;const r=experience.getBoundingClientRect();if(r.top>innerHeight*.5||r.bottom<innerHeight*.5)return;if(e.key==='ArrowRight'){e.preventDefault();stepOrbit(1)}else if(e.key==='ArrowLeft'){e.preventDefault();stepOrbit(-1)}});

updateSelection(0,true);setCopy(0,true);loadVideo('left');scrollFx();
