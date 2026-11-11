import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const host=document.querySelector('.scene');
const status=document.getElementById('villageStatus');
const motion=matchMedia('(prefers-reduced-motion: reduce)');
const read=()=>window.getVillageState?.() || {level:0,wins:0,phase:'question',paused:false,combat:null};
const reduced=()=>motion.matches || document.body.classList.contains('reduced');
const mats=new Map();
const material=(color)=>{if(!mats.has(color))mats.set(color,new THREE.MeshStandardMaterial({color,roughness:.9}));return mats.get(color)};
const sphere=new THREE.SphereGeometry(1,10,8);
const cube=new THREE.BoxGeometry(1,1,1);
function piece(group,geo,color,pos,scale){
 const obj=new THREE.Mesh(geo,material(color));obj.position.set(...pos);obj.scale.set(...scale);obj.castShadow=true;obj.receiveShadow=true;group.add(obj);return obj;
}
function normalized(source,height,merge=false){
 if(!source)throw new Error('Required model is missing');
 const model=source.clone(true);model.position.set(0,0,0);model.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(model),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
 model.position.x-=center.x;model.position.y-=box.min.y;model.position.z-=center.z;model.updateMatrixWorld(true);
 const group=new THREE.Group();
 if(merge){
  const buckets=new Map();
  model.traverse(obj=>{if(!obj.isMesh)return;const m=obj.material;const g=(obj.geometry.index?obj.geometry.toNonIndexed():obj.geometry.clone());g.applyMatrix4(obj.matrixWorld);
   const key=m.uuid+Object.keys(g.attributes).sort().join();if(!buckets.has(key))buckets.set(key,{m,gs:[]});buckets.get(key).gs.push(g);
  });
  for(const {m,gs} of buckets.values()){const g=mergeGeometries(gs,false);if(g){const mesh=new THREE.Mesh(g,m);group.add(mesh)}for(const old of gs)old.dispose()}
 }else group.add(model);
 group.scale.setScalar(height/size.y);group.traverse(obj=>{if(obj.isMesh){obj.castShadow=true;obj.receiveShadow=true}});
 return group;
}
function makeWolf(){
 const wolf=new THREE.Group();
 piece(wolf,sphere,0x74818b,[0,.65,0],[.28,.3,.58]);
 piece(wolf,sphere,0x89949c,[0,.98,.34],[.31,.32,.33]);
 piece(wolf,sphere,0xe9dfca,[0,.84,.59],[.21,.17,.24]);
 piece(wolf,sphere,0x293536,[0,.87,.79],[.1,.075,.065]);
 for(const side of [-1,1]){
  piece(wolf,new THREE.ConeGeometry(.15,.35,4),0x74818b,[side*.22,1.3,.32],[1,1,1]);
  piece(wolf,sphere,0x243537,[side*.19,1.03,.6],[.045,.055,.035]);
 }
 const legs=[];for(const x of [-.2,.2])for(const z of [-.35,.3]){
  const pivot=new THREE.Group();pivot.position.set(x,.51,z);wolf.add(pivot);
  piece(pivot,cube,0x586872,[0,-.23,0],[.12,.46,.15]);legs.push(pivot);
 }
 const tail=piece(wolf,new THREE.ConeGeometry(.18,.65,6),0x74818b,[0,.8,-.66],[1,1,1]);tail.rotation.x=-.7;
 const hp=new THREE.Group();hp.position.y=1.6;wolf.add(hp);
 piece(hp,cube,0x35473a,[0,0,0],[.78,.075,.06]);
 const fill=piece(hp,cube,0x95c75c,[0,.01,.04],[.72,.06,.04]);
 wolf.userData={legs,fill,tail};wolf.scale.setScalar(.8);return wolf;
}
async function start(){
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0xb3cc91);renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const canvas=renderer.domElement;canvas.id='villageCanvas';canvas.setAttribute('role','img');canvas.setAttribute('aria-label','닭과 일꾼이 움직이는 꼬꼬마을');host.prepend(canvas);
 const world=new THREE.Scene();world.add(new THREE.HemisphereLight(0xfff5de,0x6d8c57,2.2));
 const sun=new THREE.DirectionalLight(0xffe5bb,2.8);sun.position.set(-6,12,9);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-12;sun.shadow.camera.right=12;sun.shadow.camera.top=12;sun.shadow.camera.bottom=-12;sun.shadow.normalBias=.05;world.add(sun);
 const camera=new THREE.OrthographicCamera(-9,9,9,-9,.1,80);camera.position.set(9,14,16);camera.lookAt(0,0,0);
 const resize=()=>{const w=host.clientWidth,h=host.clientHeight,aspect=w/h;const span=aspect<1?7.2/aspect:7.2;camera.left=-span*aspect;camera.right=span*aspect;camera.top=span;camera.bottom=-span;camera.updateProjectionMatrix();renderer.setSize(w,h,false)};
 new ResizeObserver(resize).observe(host);resize();
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(45,45),material(0xa4c875));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;world.add(ground);
 const path=new THREE.Mesh(new THREE.PlaneGeometry(16,1.35),material(0xd7c28c));path.rotation.x=-Math.PI/2;path.position.set(0,.015,4.5);path.receiveShadow=true;world.add(path);
 const farmPath=new THREE.Mesh(new THREE.PlaneGeometry(8,1),material(0xcdb888));farmPath.rotation.x=-Math.PI/2;farmPath.position.set(0,.02,-.2);farmPath.receiveShadow=true;world.add(farmPath);
 // Ground speckles stay deterministic and require no textures or network calls.
 const dots=new THREE.InstancedMesh(new THREE.CircleGeometry(.06,5),material(0x86ae63),95);
 const dummy=new THREE.Object3D();for(let i=0;i<95;i++){dummy.position.set(Math.sin(i*17.31)*9,.025,Math.cos(i*8.17)*8);dummy.rotation.x=-Math.PI/2;dummy.updateMatrix();dots.setMatrixAt(i,dummy.matrix)}world.add(dots);
 const loader=new GLTFLoader();
 const pack=await loader.loadAsync('art-handoff/coopnight/source-3d/models/environment-pack.glb');
 const model=(name,height,merge=true)=>normalized(pack.scene.getObjectByName(name),height,merge);
 function put(name,height,x,z,angle=0){const g=model(name,height);g.position.set(x,0,z);g.rotation.y=angle;g.userData.baseScale=g.scale.x;world.add(g);return g}
 const home=put('EnvCoop',2.6,-3.7,-1.6);
 const market=put('EnvMarket',2.5,2.8,-2.4);
 const nursery=put('EnvCoop',1.9,-2.7,1.4);
 const tower=put('EnvTower',1.9,1,2.4);
 const cornTower=put('EnvCornTower',2.1,3.8,1.8);
 const gate=put('EnvGate',1.05,-5.8,3.5,Math.PI/2);
 for(let i=0;i<6;i++)put('EnvFence',.65,-5.6+i*1.6,-4.4);
 for(let i=0;i<4;i++)put('EnvFence',.65,-5.6,-3.2+i*1.6,Math.PI/2);
 for(let i=0;i<5;i++)put('EnvFence',.65,-4.2+i*1.75,3.1);
 const trees=[];for(const [x,z,h] of [[-7,-5,3.5],[-6,-6.8,4],[1,-6,3.1],[5,-5.5,3.7],[7,-3,3.3],[8,2,3],[-8,1,3.2],[-7,6.8,2.9],[5,7,3]]){
  const tree=put('EnvTree',h,x,z);trees.push({obj:tree,phase:x+z});
 }
 for(const [x,z] of [[-5,-5],[.3,-4.4],[5,-3.7],[6,1],[-6.9,2],[3,6.5],[-3,6.8]])put('EnvBush',.65,x,z);
 for(const [x,z] of [[6.6,-1.8],[-6.9,5.8],[4.8,6.8]])put('EnvRock',.5,x,z);
 const chickens=[];
 for(let i=0;i<7;i++){
  const g=model(i<2?'EnvChick':'EnvChicken',i<2?.38:.57,false);world.add(g);
  chickens.push({obj:g,seed:i,head:g.getObjectByName(i<2?'Round_inquisitive_head003':'Round_inquisitive_head002')});
 }
 const farmer=normalized(pack.scene.getObjectByName('FarmerPolished'),1.45,false);world.add(farmer);
 const limbs=['ArmL','ArmR','LegL','LegR'].map(name=>farmer.getObjectByName(name));
 const egg=piece(farmer,sphere,0xfff3d3,[0,2.1,0],[.2,.28,.2]);egg.castShadow=false;
 // Daily-life loops are cosmetic: only reading answers award spendable gold.
 const smoke=[];for(let i=0;i<3;i++){const p=piece(world,sphere,0xfff4d6,[-3.3,2.7,-1.6],[.15,.15,.15]);p.castShadow=false;p.material=p.material.clone();p.material.transparent=true;smoke.push(p)}
 const enemies=new Map(),particles=[];
 let time=0,last=0,lastPhase='',lastLevel=-1,lastWins=-1,kick=0,celebrate=0;
 const shotOrigin=new THREE.Vector3(1,1.55,2.4);
 const enemyPosition=e=>new THREE.Vector3(-6+(e.x-15)/85*14,0,4.5+Math.sin(e.id*2.1)*.2);
 function particle(kind,from,to){
  if(particles.length>45)return;
  const g=kind==='coin'?new THREE.CylinderGeometry(.15,.15,.05,10):sphere;
  const obj=new THREE.Mesh(g,material(kind==='coin'?0xf4c346:kind==='dust'?0xe7d5a1:0xffd969));
  obj.position.copy(from);if(kind!=='coin')obj.scale.setScalar(kind==='dust'?.1:.12);world.add(obj);
  particles.push({obj,kind,from:from.clone(),to:to.clone(),age:0,life:kind==='shot'?.22:kind==='dust'?.65:1.05});
 }
 function confetti(at){for(let i=0;i<10;i++)particle('dust',at,new THREE.Vector3(at.x+Math.sin(i*2.3)*1.1,.3+Math.abs(Math.sin(i))*1.6,at.z+Math.cos(i)*.8))}
 window.VillageView={
  events(events){const s=read();if(s.paused||reduced())return;for(const e of events){if(e.type==='hit'){const pos=enemyPosition(e);pos.y=.7;particle('shot',shotOrigin,pos);kick=.2}
   if(e.type==='kill')confetti(enemyPosition(e));if(e.type==='leak'){gate.userData.hit=.35;confetti(new THREE.Vector3(-6,.4,4.5))}}},
  reward(){if(reduced())return;celebrate=1.1;for(let i=0;i<6;i++)particle('coin',new THREE.Vector3(-2+i*.4,1.4,.3),new THREE.Vector3(2.8,2,-2.4))},
  upgrade(){if(!reduced()){kick=.65;confetti(shotOrigin)}},
  inspect(){return {ready:true,time,residents:chickens.map(c=>c.obj.position.toArray()),farmer:farmer.position.toArray(),enemies:enemies.size,drawCalls:renderer.info.render.calls}}
 };
 const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
 canvas.addEventListener('pointerup',e=>{
  const s=read();if(s.paused)return;const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);
  const hits=raycaster.intersectObject(tower,true);if(hits.length){document.getElementById('build').click();return}
  if(raycaster.intersectObjects(chickens.map(c=>c.obj),true).length&&!reduced())celebrate=.8;
 });
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();host.classList.remove('is3d');host.dataset.renderer='fallback';status.textContent='화면을 다시 불러오면 입체 마을로 돌아와요';renderer.setAnimationLoop(null)});
 host.classList.add('is3d');host.dataset.renderer='three';status.textContent='닭과 일꾼이 마을을 돌보고 있어요';
 function frame(now){
  const dt=Math.min(.05,last?(now-last)/1000:0);last=now;
  const s=read(),still=s.paused||document.hidden,less=reduced();
  if(!still)time+=dt;
  host.classList.toggle('village-paused',still);host.dataset.phase=s.phase;
  if(lastPhase!==s.phase){lastPhase=s.phase;status.textContent=s.phase==='battle'?'마을을 지켜요! 타워를 눌러 강화할 수 있어요':'닭과 일꾼이 마을을 돌보고 있어요'}
  if(s.level!==lastLevel||s.wins!==lastWins){lastLevel=s.level;lastWins=s.wins;
   tower.visible=s.level>0;cornTower.visible=s.level>=3;nursery.visible=s.wins>=2;
   home.scale.setScalar(home.userData.baseScale*(1+Math.min(s.wins,12)*.018));market.scale.setScalar(market.userData.baseScale*(1+Math.min(s.wins,12)*.012));
  }
  // Pausing freezes resident travel, effects and battle presentation together.
  const t=less?0:time;
  if(!still){
   for(let i=0;i<chickens.length;i++){const c=chickens[i],a=t*(.16+i*.018)+i*2.4;
    const x=-2.5+Math.cos(a)*(i%2?1.5:.8),z=.4+Math.sin(a)*1.35;
    c.obj.position.set(x,less?0:Math.abs(Math.sin(t*6+i))*.045,z);c.obj.rotation.y=-a;
    if(celebrate>0)c.obj.position.y+=Math.abs(Math.sin(celebrate*13+i))*.2;
   }
   const a=t*.24,fx=Math.sin(a)*2.4,fz=-.5+Math.cos(a)*.9;
   farmer.position.set(fx,less?0:Math.abs(Math.sin(t*7))*.035,fz);
   farmer.rotation.y=Math.atan2(Math.cos(a)*2.4,-Math.sin(a)*.9);
   limbs.forEach((limb,i)=>{if(limb)limb.rotation.x=less?0:Math.sin(t*7+(i===1||i===2?Math.PI:0))*.25});
   egg.visible=Math.cos(a)>0;egg.position.y=2.1+(less?0:Math.sin(t*3)*.04);
   for(const item of trees)item.obj.rotation.z=less?0:Math.sin(t*.8+item.phase)*.012;
   smoke.forEach((p,i)=>{const cycle=(t*.22+i/3)%1;p.position.set(-3.3+Math.sin(t+i)*.13,2.5+cycle*1.1,-1.6);p.scale.setScalar(.1+cycle*.22);p.material.opacity=less?0:(1-cycle)*.35});
   kick=Math.max(0,kick-dt);celebrate=Math.max(0,celebrate-dt);
   tower.rotation.z=less?0:Math.sin(kick*40)*kick*.13;
   const dark=s.phase==='battle';sun.intensity=THREE.MathUtils.lerp(sun.intensity,dark?1.6:2.8,dt*2);
   for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.age+=dt;const u=Math.min(1,p.age/p.life);p.obj.position.lerpVectors(p.from,p.to,u);p.obj.position.y+=Math.sin(u*Math.PI)*(p.kind==='shot'?.5:1);p.obj.rotation.y+=dt*8;
    if(u>=1||less){world.remove(p.obj);if(p.kind==='coin')p.obj.geometry.dispose();particles.splice(i,1)}
   }
  }
  const visible=new Set();
  for(const e of (s.phase==='battle'?s.combat?.enemies:[])||[]){
   if(e.hp<=0||e.escaped||e.x>100)continue;visible.add(e.id);
   let wolf=enemies.get(e.id);if(!wolf){wolf=makeWolf();enemies.set(e.id,wolf);world.add(wolf);wolf.position.copy(enemyPosition(e))}
   const dest=enemyPosition(e);
   if(!still){wolf.position.lerp(dest,less?1:1-Math.exp(-dt*18));wolf.rotation.y=-Math.PI/2;wolf.position.y=less?0:Math.abs(Math.sin(t*10+e.id))*.045;wolf.userData.legs.forEach((leg,i)=>leg.rotation.x=less?0:Math.sin(t*10+i*Math.PI)*.35)}
   wolf.userData.fill.scale.x=.72*e.hp/e.maxHp;
  }
  for(const [id,wolf] of enemies)if(!visible.has(id)){world.remove(wolf);wolf.traverse(o=>{if(o.isMesh&&o.geometry!==sphere&&o.geometry!==cube)o.geometry.dispose()});enemies.delete(id)}
  if(!document.hidden)renderer.render(world,camera);
 }
 renderer.setAnimationLoop(frame);
}
start().catch(error=>{host.dataset.renderer='fallback';status.textContent='기본 마을 화면으로 플레이할 수 있어요';console.warn('Village renderer unavailable:',error.message)});
