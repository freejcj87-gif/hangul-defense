import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { SimplifyModifier } from 'three/addons/modifiers/SimplifyModifier.js';
import { KIND_ORDER, RIG, GAIT, RIG_TIME, monsterGeometry, shadowGeometry, rigMaterial, rigDepthMaterial, rigMaterialAt, gaitPose, setRig } from './monsters.js';
import { prep, fuse, solid, flat, merge } from './geo.js';
import { POND, POND_R, HAY, GARDEN, ZONE, FARM_ZONE, FARM_HOME, PICK, DROP, MARKET_FRONT, MARKET_GATE, TENTS, MILL, RIVER, riverFrame, riverOffset, millRace, bridgeSpot, deckY, BRIDGE as BRIDGE_ART } from './layout.js';
import { STOREY_H, storeyGeometry, basketGeometry, basketEggs, railGeometry, wallGeometry, marketExtras, STALL_OMIT, NESTS, NEST_MAX, nestSpots, villageProps, lanterns, LANTERN_TOP, drawHammer, trailGeometry, stageProps, riverGeometry, codeWheelGeometry } from './props.js';

const host=document.querySelector('.scene');
const motion=matchMedia('(prefers-reduced-motion: reduce)');
// The page owns the game and the world simulation (world.js). This file only reads them every frame (pull) and plays one-shot effects (push).
const IDLE={phase:'start',paused:false,level:0,chickens:1,fence:0,farmers:0,pond:0,hall:0,feast:0,wins:0,world:null,radius:0};
const read=()=>{try{return window.getVillageState?.()||IDLE}catch{return IDLE}};
const reduced=()=>motion.matches || document.body.classList.contains('reduced');
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const count=(v,max)=>clamp(Math.floor(Number(v)||0),0,max);
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const ART='art-handoff/coopnight/browser/';
const V3=THREE.Vector3;
// 0.15 art (art-handoff/v015-v016, 계획서 §2): each model is loaded on its own and may fail on its own; the 3D village stays and only that model
// keeps its 0.14 code-drawn look. ?art15=0 skips them all. Paths stay whole strings: scripts/build-pages.cjs checks they are in the Pages package.
const ART15={watermill:'art-handoff/v015-v016/glb/watermill.glb',bridge:'art-handoff/v015-v016/glb/bridge.glb',king:'art-handoff/v015-v016/glb/wolf-king.glb',fox:'art-handoff/v015-v016/glb/thief-fox.glb'};
const ART15_V='?v=0.15';   // cache buster (the files may change in a later version under the same name)
const BEAST_PARTS=['Head','Tail','FrontFoot_L','FrontFoot_R','RearFoot_L','RearFoot_R'];
const ART15_NODES={watermill:['WaterWheel'],bridge:['Timber_Bridge'],king:BEAST_PARTS,fox:BEAST_PARTS};   // a file without these nodes counts as failed
const ART15_GRACE=8000;   // ms to wait for them once the core assets are in (a stalled request must not hold the whole 3D village back)
const art15Off=(()=>{try{return /[?&]art15=0\b/.test(location.search)}catch{return false}})();
// Until the 3D village is ready (or when it falls back) the page still gets a safe API.
const stubView=()=>({events(){},reward(){},build(){return null},upgrade(){return null},marketScreen(){return null},focus(){return null},inspect(){return {ready:false}}});
window.VillageView=stubView();
// Hands the scene back to the DOM picture village (index.html draws it when .is3d is gone).
function useFallback(){host.classList.remove('is3d');host.dataset.renderer='fallback';window.VillageView=stubView()}

/* ---------- world constants: window.World when it is loaded, otherwise the same numbers as world.js ---------- */
const WORLD={RADIUS:[7,10,13,16],EDGE:10,SPAWNS:8,MAX_WOLVES:60,TOWER_SLOTS:[[1.2,1.4],[-3.6,1.4],[-5.6,-2],[5.8,-.4],[-.8,-6.2],[-7.6,4.2]],
 PLACE:{coop:[-2.8,-2.8],market:[4.2,-1.8],nursery:[.6,-3.6],barn:[-6.2,-4.4]},HOME:i=>[-1.8+(i%4)*1.2,-.4+Math.floor(i/4)*1.1]};
const W=key=>{const api=window.World;return api&&api[key]!==undefined?api[key]:WORLD[key]};
// 0.9: up to 20 towers, 20 hens, 10 farmers; tower places per hall stage come from World.towerSlots(hall) (0.8: the six TOWER_SLOTS).
const MAXT=20,MAXH=20,MAXF=10,MAX_FLOORS=6;
function towerSlotsAt(hall){const api=window.World;if(api&&typeof api.towerSlots==='function'){try{const s=api.towerSlots(hall);if(Array.isArray(s)&&s.length)return s.slice(0,MAXT)}catch{}}return W('TOWER_SLOTS').slice(0,MAXT)}
const RUNNING=new Set(['listen','ask','learn','reward']);   // fallback when getVillageState().running is absent: phases where the world clock runs (never while paused)
function radiusOf(s,w){
 const r=Number(s.radius);if(r>0&&r<80)return r;
 const R=W('RADIUS'),hall=w&&w.hall!==undefined?w.hall:s.hall;return R[clamp(Math.floor(Number(hall)||0),0,R.length-1)];
}
// Without a world object (old page, or before a game exists) the village is drawn from the economy numbers alone.
// One stable object with stable ids, so a bought tower still gets its build effect.
const fake={fake:true,t:0,hall:0,wolves:[],hens:[],buildings:[],arrows:[]};let fakeKey='';
function fakeWorld(s){
 const hall=count(s.hall,3),level=count(s.level,MAXT-1),fence=count(s.fence,18),hens=count(s.chickens,MAXH),key=hall+','+level+','+fence+','+hens;
 if(key===fakeKey)return fake;fakeKey=key;
 const R=W('RADIUS')[hall],P=W('PLACE'),b=[],add=(id,o)=>{const x={id,hp:1,max:1,broken:false,...o};b.push(x);return x};
 add(-1,{kind:'coop',x:P.coop[0],z:P.coop[1]});add(-2,{kind:'market',x:P.market[0],z:P.market[1]});
 if(hall>=1)add(-3,{kind:'nursery',x:P.nursery[0],z:P.nursery[1]});
 if(hall>=3)add(-4,{kind:'barn',x:P.barn[0],z:P.barn[1]});
 // world.js's rule: as many towers as there are places, the rest raise the lowest tower one storey at a time (floor = storeys, 1 = plain)
 const slots=towerSlotsAt(hall),n=1+level,built=Math.min(n,slots.length),tw=slots.slice(0,built).map(([x,z],slot)=>add(-10-slot,{kind:'tower',slot,x,z,floor:1}));
 for(let k=built;k<n&&tw.length;k++){let low=tw[0];for(const t of tw)if(t.floor<low.floor)low=t;low.floor++}
 // fences: empty sides first (layer 1), then the weakest side gets the next layer
 for(let k=0;k<Math.min(6,fence);k++){const a=(k+.5)*Math.PI/3;add(-40-k,{kind:'fence',side:k,layer:Math.min(3,Math.floor(fence/6)+(k<fence%6?1:0)),x:Math.cos(a)*R,z:Math.sin(a)*R})}
 const list=[];for(let i=0;i<hens;i++){const [x,z]=W('HOME')(i);list.push({id:-100-i,slot:i,x,z,state:'yard'})}
 fake.hall=hall;fake.buildings=b;fake.hens=list;return fake;
}

// Deterministic variety keeps screenshots and tests repeatable.
let seed=20261111;
const rnd=()=>{seed=(seed+0x6d2b79f5)|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296};
const span=(a,b)=>a+(b-a)*rnd();
const hash=i=>{const x=Math.sin(i*127.1+311.7)*43758.5453;return x-Math.floor(x)};

/* ---------- geometry baking: every object becomes one vertex-coloured mesh (prep/solid/flat live in geo.js) ---------- */
const lit=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.82,metalness:0,side:THREE.DoubleSide});
const hot=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.82,metalness:0,side:THREE.DoubleSide,emissive:0xfff0c0,emissiveIntensity:.8});
// GLB names are sanitised by the loader ("Seed cannon barrel.001" -> "Seed_cannon_barrel001"), so names are compared loosely.
const norm=name=>String(name||'').replace(/[\s_.\d]/g,'').toLowerCase();
const named=(obj,root,want)=>{for(let p=obj;p&&p!==root.parent;p=p.parent)if(norm(p.name).startsWith(want))return true;return false};
// 0.9 crowds (20 towers, 20 hens, 10 farmers) draw a lighter copy of the GLB figures: each child mesh is decimated on load
// (edge collapse keeps the silhouette; UVs are dropped first since everything is vertex-coloured). `keep` = share of vertices kept.
const simplifier=new SimplifyModifier(),simpleCache=new Map();
function simpler(geometry,keep){
 const key=geometry.uuid+':'+keep;if(simpleCache.has(key))return simpleCache.get(key);
 let g=geometry.clone();for(const k of Object.keys(g.attributes))if(k!=='position'&&k!=='normal')g.deleteAttribute(k);
 g=mergeVertices(g);const n=g.attributes.position.count,cut=Math.floor(n*(1-keep));
 let out=g;if(n>=40&&cut>0){try{out=simplifier.modify(g,cut);if(!out.attributes.position.count)out=g}catch{out=g}}
 simpleCache.set(key,out);return out;
}
// Bakes a GLB node to `height`, feet on y=0, centred on x/z. Children named in `split` come back as separate limbs with their pivots.
// opt.omit drops children by name; opt.anchors returns the baked bounding box of named children (where to mount extra parts); opt.keep decimates.
// opt.origin keeps the model's own x/z origin instead of centring its bounding box (0.15 animals: the origin is the body centre, the tail makes the box lopsided).
function bake(node,height,split=[],opt={}){
 if(!node)throw new Error('Required model is missing');
 node.updateWorldMatrix(true,true);
 const box=new THREE.Box3().setFromObject(node),size=box.getSize(new V3()),c=box.getCenter(new V3()),k=height/size.y;
 if(opt.origin)c.x=c.z=0;
 const frame=new THREE.Matrix4().makeScale(k,k,k).multiply(new THREE.Matrix4().makeTranslation(-c.x,-box.min.y,-c.z));
 const omit=(opt.omit||[]).map(norm);
 const groups=new Map([['main',{list:[],pivot:new V3()}]]);
 for(const name of split){const child=node.getObjectByName(name);if(child)groups.set(name,{list:[],pivot:new V3().setFromMatrixPosition(child.matrixWorld).applyMatrix4(frame)})}
 const m=new THREE.Matrix4();
 node.traverse(obj=>{
  if(!obj.isMesh||omit.some(o=>named(obj,node,o)))return;
  let key='main';for(let p=obj;p&&p!==node.parent;p=p.parent)if(p!==node&&groups.has(p.name)){key=p.name;break}
  const group=groups.get(key);m.makeTranslation(-group.pivot.x,-group.pivot.y,-group.pivot.z).multiply(frame).multiply(obj.matrixWorld);
  group.list.push(prep(opt.keep?simpler(obj.geometry,opt.keep):obj.geometry,m,obj.material.color));
 });
 const out={anchors:{}};for(const [name,group] of groups)if(group.list.length)out[name]={geometry:fuse(group.list),pivot:group.pivot};
 for(const name of opt.anchors||[]){const want=norm(name),b=new THREE.Box3();node.traverse(o=>{if(o.isMesh&&named(o,node,want))b.expandByObject(o)});if(!b.isEmpty())out.anchors[name]=b.applyMatrix4(frame)}
 return out;
}
// A cheap stand-in for a GLB node: every child mesh becomes one low-poly primitive filling its bounding box (same colours, same proportions).
function lowPoly(node,height,shape,extra=[]){
 node.updateWorldMatrix(true,true);
 const box=new THREE.Box3().setFromObject(node),size=box.getSize(new V3()),c=box.getCenter(new V3()),k=height/size.y,parts=[...extra];
 node.traverse(o=>{
  if(!o.isMesh)return;const prim=shape(norm(o.name)+'|'+norm(o.parent&&o.parent.name));if(!prim)return;
  const b=new THREE.Box3().setFromObject(o),s=b.getSize(new V3()).multiplyScalar(k),p=b.getCenter(new V3()).sub(new V3(c.x,box.min.y,c.z)).multiplyScalar(k);
  // getHex() hands back sRGB, which solid() turns into the same linear colour the GLB material has.
  parts.push([prim,o.material.color.getHex(),[p.x,p.y,p.z],prim==='ball'?[s.x/2,s.y/2,s.z/2]:[s.x/2,s.y,s.z/2]]);
 });
 return solid(parts);
}

/* ---------- effect atlas: every sprite effect shares one texture and two draw calls ---------- */
const CELL={dust:0,ring:1,impact:2,star:3,feather:4,coin:8,sparkle:12,glow:13,solid:14,halo:15,egg:16,dot:17,bang:18,flame:19,scorch:20,swirl:21,hammer:22};
const GRID=5;
async function makeAtlas(){
 const S=204,pad=6,inner=S-pad*2,canvas=document.createElement('canvas');canvas.width=canvas.height=GRID*S;
 const ctx=canvas.getContext('2d');
 const load=name=>new Promise(done=>{const img=new Image();img.onload=()=>done(img);img.onerror=()=>done(null);img.src=ART+'animation/'+name});
 const [dust,ring,impact,feathers,front,quarter,edge,reverse]=await Promise.all(['fx-dust.png','fx-ring.png','fx-impact.png','fx-feathers.png','front.png','quarter.png','edge.png','reverse-quarter.png'].map(load));
 const cell=(i,draw)=>{ctx.save();ctx.translate((i%GRID)*S,Math.floor(i/GRID)*S);ctx.beginPath();ctx.rect(0,0,S,S);ctx.clip();draw(S/2);ctx.restore()};
 const radial=(stops,r=inner/2)=>h=>{const g=ctx.createRadialGradient(h,h,0,h,h,r);for(const [at,color] of stops)g.addColorStop(at,color);ctx.fillStyle=g;ctx.beginPath();ctx.arc(h,h,r,0,7);ctx.fill()};
 const image=(i,img,fallback,sx=0,sy=0,sw=img?.width,sh=img?.height)=>cell(i,h=>{if(img)ctx.drawImage(img,sx,sy,sw,sh,pad,pad,inner,inner);else fallback(h)});
 const spikes=(points,innerRatio)=>h=>{const R=inner/2;ctx.fillStyle='#fff';ctx.beginPath();for(let i=0;i<points*2;i++){const a=i*Math.PI/points-Math.PI/2,r=i%2?R*innerRatio:R;ctx.lineTo(h+Math.cos(a)*r,h+Math.sin(a)*r)}ctx.closePath();ctx.fill()};
 const coin=radial([[0,'#ffe680'],[.8,'#f4bf3a'],[.82,'#c98a1c'],[1,'#c98a1c']],inner*.42);
 image(CELL.dust,dust,radial([[0,'rgba(240,214,160,1)'],[.6,'rgba(232,200,140,.8)'],[1,'rgba(232,200,140,0)']]));
 image(CELL.ring,ring,h=>{ctx.strokeStyle='#ffc93c';ctx.lineWidth=12;ctx.beginPath();ctx.arc(h,h,inner*.42,0,7);ctx.stroke()});
 image(CELL.impact,impact,spikes(8,.36));
 cell(CELL.star,spikes(5,.46));
 for(let i=0;i<4;i++)image(CELL.feather+i,feathers,h=>{ctx.fillStyle='#fff6e6';ctx.beginPath();ctx.ellipse(h,h,inner*.18,inner*.42,.6,0,7);ctx.fill()},(i%2)*512,Math.floor(i/2)*512,512,512);
 [front,quarter,edge,reverse].forEach((img,i)=>image(CELL.coin+i,img,coin));
 cell(CELL.sparkle,spikes(4,.16));
 cell(CELL.glow,radial([[0,'rgba(255,255,255,1)'],[.35,'rgba(255,255,255,.55)'],[1,'rgba(255,255,255,0)']]));
 cell(CELL.solid,h=>{ctx.fillStyle='#fff';ctx.beginPath();ctx.roundRect(pad,pad,inner,inner,18);ctx.fill()});
 cell(CELL.halo,h=>{ctx.strokeStyle='#fff';ctx.lineWidth=15;ctx.shadowColor='#fff';ctx.shadowBlur=10;ctx.beginPath();ctx.arc(h,h,inner*.4,0,7);ctx.stroke()});
 cell(CELL.egg,h=>{const g=ctx.createRadialGradient(h-18,h-26,6,h,h,inner*.5);g.addColorStop(0,'#ffffff');g.addColorStop(.7,'#fff1d2');g.addColorStop(1,'#e8cf9f');ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(h,h+4,inner*.34,inner*.44,0,0,7);ctx.fill()});
 cell(CELL.dot,h=>{ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(h,h,inner*.47,0,7);ctx.fill()});
 // "!" bubble over a monster seen for the first time (drawn in colour: tint it white)
 cell(CELL.bang,h=>{ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(h,h-6,inner*.4,0,7);ctx.moveTo(h-20,h+60);ctx.lineTo(h,h+90);ctx.lineTo(h+20,h+60);ctx.fill();
  ctx.fillStyle='#ffcf3a';ctx.beginPath();ctx.arc(h,h-6,inner*.4-9,0,7);ctx.fill();ctx.fillStyle='#5a2a10';ctx.beginPath();ctx.roundRect(h-11,h-62,22,66,10);ctx.fill();ctx.beginPath();ctx.arc(h,h+26,12,0,7);ctx.fill()});
 // flame tongue: white core, yellow, orange, red edge (drawn in colour)
 cell(CELL.flame,h=>{const g=ctx.createRadialGradient(h,h+34,4,h,h+16,inner*.46);g.addColorStop(0,'rgba(255,255,236,1)');g.addColorStop(.3,'rgba(255,226,92,1)');g.addColorStop(.62,'rgba(255,128,40,.95)');g.addColorStop(1,'rgba(224,48,24,0)');
  ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(h,pad+4);ctx.bezierCurveTo(h+30,h-40,h+inner*.34,h,h+inner*.28,h+30);ctx.arc(h,h+30,inner*.28,0,Math.PI);ctx.bezierCurveTo(h-inner*.34,h,h-30,h-40,h,pad+4);ctx.fill()});
 // scorch mark left by a fire-arrow blast (ragged dark blotch)
 cell(CELL.scorch,h=>{const g=ctx.createRadialGradient(h,h,6,h,h,inner*.48);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.55,'rgba(255,255,255,.8)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;
  ctx.beginPath();for(let i=0;i<18;i++){const a=i/18*6.283,r=inner*(i%2?.36:.48)*(.85+.15*Math.sin(i*2.7));ctx.lineTo(h+Math.cos(a)*r,h+Math.sin(a)*r)}ctx.closePath();ctx.fill()});
 // dizzy swirl over a stunned tower
 cell(CELL.swirl,h=>{ctx.strokeStyle='#fff';ctx.lineWidth=13;ctx.lineCap='round';ctx.beginPath();for(let i=0;i<=60;i++){const a=i/60*6.283*2.2,r=8+i*1.35;ctx.lineTo(h+Math.cos(a)*r,h+Math.sin(a)*r*.8)}ctx.stroke()});
 // 🔨 repair hint over a broken building (drawn in colour: tint it white)
 cell(CELL.hammer,h=>drawHammer(ctx,h,inner));
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.generateMipmaps=false;texture.minFilter=texture.magFilter=THREE.LinearFilter;
 return texture;
}
function spriteMaterial(map,depthTest){
 return new THREE.ShaderMaterial({uniforms:{map:{value:map}},transparent:true,depthTest,depthWrite:false,side:THREE.DoubleSide,
  blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneMinusSrcAlphaFactor,blendSrcAlpha:THREE.OneFactor,blendDstAlpha:THREE.OneMinusSrcAlphaFactor,
  vertexShader:`attribute vec4 aColor;attribute vec2 aFx;varying vec2 vUv;varying vec4 vColor;varying float vAdd;
   void main(){float cell=floor(aFx.x+.5);vec2 at=vec2(mod(cell,${GRID}.0),floor(cell/${GRID}.0));
    vUv=vec2((at.x+uv.x)/${GRID}.0,1.0-(at.y+1.0-uv.y)/${GRID}.0);vColor=aColor;vAdd=aFx.y;
    gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0);}`,
  fragmentShader:`uniform sampler2D map;varying vec2 vUv;varying vec4 vColor;varying float vAdd;
   void main(){vec4 t=texture2D(map,vUv);float a=t.a*vColor.a;if(a<.004)discard;
    vec3 rgb=linearToOutputTexel(vec4(t.rgb*vColor.rgb,1.0)).rgb;gl_FragColor=vec4(rgb*a,a*(1.0-vAdd));}`});
}
// A pool is rebuilt every frame from the live effect list, so nothing is allocated or disposed while playing.
function makePool(map,max,flat){
 const geometry=new THREE.PlaneGeometry(1,1);
 const color=new THREE.InstancedBufferAttribute(new Float32Array(max*4),4),fx=new THREE.InstancedBufferAttribute(new Float32Array(max*2),2);
 color.setUsage(THREE.DynamicDrawUsage);fx.setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('aColor',color);geometry.setAttribute('aFx',fx);
 const mesh=new THREE.InstancedMesh(geometry,spriteMaterial(map,flat),max);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
 mesh.count=0;mesh.frustumCulled=false;mesh.renderOrder=flat?2:20;mesh.castShadow=mesh.receiveShadow=false;
 const m=new THREE.Matrix4(),q=new THREE.Quaternion(),qz=new THREE.Quaternion(),p=new V3(),s=new V3(),Z=new V3(0,0,1);
 let n=0;
 return {mesh,begin(){n=0},
  // base: orientation quaternion (camera for billboards, ground for decals)
  push(base,x,y,z,sx,sy,rot,cell,r,g,b,a,add){
   if(n>=max||a<=.004)return;
   q.copy(base);if(rot)q.multiply(qz.setFromAxisAngle(Z,rot));
   m.compose(p.set(x,y,z),q,s.set(sx,sy,1)).toArray(mesh.instanceMatrix.array,n*16);
   color.array[n*4]=r;color.array[n*4+1]=g;color.array[n*4+2]=b;color.array[n*4+3]=a;fx.array[n*2]=cell;fx.array[n*2+1]=add;n++;
  },
  end(){mesh.count=n;mesh.instanceMatrix.needsUpdate=color.needsUpdate=fx.needsUpdate=true}};
}
const tint=hex=>{const c=new THREE.Color(hex);return [c.r,c.g,c.b]};
const WHITE=tint(0xffffff),GOLD=tint(0xffd24a),CREAM=tint(0xfff3d6),DUST=tint(0xf2dfb4),WOOD=tint(0xb97a3c),RED=tint(0xff5a4a),PINK=tint(0xff8fb3),SKY=tint(0x6fd3ff),LEAF=tint(0x9be05c),
 SOOT=tint(0x4a4440),INK=tint(0x2b2420),CRACK=tint(0x4a3020),STONE=tint(0xd8d2bd),HPBG=tint(0x2a2a30),PADRIM=tint(0xb9b3a0),SAND=tint(0xdcc793),
 ORANGE=tint(0xff8a2a),FIRE=tint(0xff5a1e),EMBER=tint(0xffc04a),ASH=tint(0x6a6058),ROCK=tint(0xb8b2a6),ICE=tint(0xbfe9ff),FLAME_TINT=tint(0xffa060);

/* ---------- easing ---------- */
const springy=t=>1-Math.exp(-7.7*t)*Math.cos(17.5*t);            // 0 -> 1.25 -> 0.94 -> 1
const settle=(t,freq=19,damp=8)=>Math.exp(-damp*t)*Math.cos(freq*t); // 1 -> 0 with a wobble
const easeIn=u=>u*u,easeOut=u=>1-(1-u)*(1-u),easeInOut=u=>u<.5?2*u*u:1-2*(1-u)*(1-u);

/* ---------- layout: prop positions, farmer zones and spots live in layout.js (checked against world.js's fixed places) ---------- */
const SALE_END=1.95,BASKET=4;   // a farmer carries four eggs
const TOWER_H=2.3,WS=1.05,FOREST=4.5,FENCE_IN=.4;                                  // tower height, wolf scale, forest edge (radius + 6), fence ring inset
const EYE_DIR=new V3(-9,14,16).normalize(),EYE_DIST=48;
const CANNON=['Seed cannon barrel','Cannon brass hoop','Dark muzzle inset'];      // the egg cannon gives way to a crossbow: the towers shoot arrows
const spawnAngle=p=>(p+.5)*Math.PI*2/W('SPAWNS');
// lateral distance from the nearest wolf trail (the eight spawn directions)
function laneOf(x,z){const n=W('SPAWNS'),a=Math.atan2(z,x),r=Math.hypot(x,z);let best=9;for(let p=0;p<n;p++){let d=Math.abs(a-spawnAngle(p))%(Math.PI*2);if(d>Math.PI)d=Math.PI*2-d;if(d<Math.PI/2)best=Math.min(best,r*Math.sin(d))}return best*1}
function groundDecor(){
 const pad=0xdcc793,parts=[
  flat('disc',pad,-2.8,-2.3,2.6,2.3,.016),flat('disc',pad,4.2,-1.4,3.1,2.5,.016),flat('disc',pad,.6,-3.3,1.9,1.7,.016),
  flat('plane',pad,.6,-.6,7.6,1.0,.018,-.17),flat('plane',pad,-.9,-2.9,3.4,.8,.017,.25)];
 // 0.14: the wolf trails are their own mesh now (props.js trailGeometry): all eight at stage 0, only the open roads later.
 const petals=[0xffffff,0xffe27a,0xff9fb6,0xfff6d8];
 for(let i=0;i<420;i++){
  const x=Math.sin(i*12.9898)*44,z=Math.cos(i*7.233)*40;
  if(Math.hypot(x,z)<7.5||laneOf(x,z)<1.5)continue;
  if(i%3===0){parts.push(flat('dot',petals[i%4],x,z,.13,.13,.035));parts.push(flat('dot',0xf2b632,x,z,.05,.05,.04))}
  else parts.push(flat('dot',0x86b060,x,z,.16,.11,.03,i));
 }
 return solid(parts);
}
// The village yard: a warm tint over the meadow with a trampled rim at the village radius (unit radius, scaled every frame).
function yardGeometry(){
 const seg=96,bands=[[0,0xf6dc94,.5],[.88,0xf6dc94,.5],[.93,0xc29a5a,.62],[1.0,0xc29a5a,.62],[1.07,0xc29a5a,0]],pos=[],col=[],c=new THREE.Color();
 const push=(r,a,band)=>{const [,hex,alpha]=band;pos.push(Math.cos(a)*r,0,Math.sin(a)*r);c.set(hex);col.push(c.r,c.g,c.b,alpha)};
 for(let b=0;b+1<bands.length;b++)for(let i=0;i<seg;i++){
  const a0=i/seg*Math.PI*2,a1=(i+1)/seg*Math.PI*2,A=bands[b],B=bands[b+1];
  push(A[0],a0,A);push(B[0],a0,B);push(B[0],a1,B);push(A[0],a0,A);push(B[0],a1,B);push(A[0],a1,A);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,4));return g;
}
// A crossbow on the lookout deck (faces +z, swivels toward its target). Tower power tiers dress it up:
// 1 펑 화살 = a small brazier, 2 큰 펑 화살 = a bigger brazier and a red pennant, 3 세 갈래 화살 = a triple crossbow with three bolts.
const BRAZIER=[null,new V3(.24,.27,-.2),new V3(.24,.3,-.2),new V3(.24,.3,-.2)],PENNANT=new V3(-.22,.86,-.3);
function crossbowGeometry(tier=0){
 const wood=0x8a5a2e,dark=0x5c3a1c,limb=0xc08848,iron=0x45464e,tip=tier?0xff7a2a:0xc9d2da;
 const parts=[['cyl6',dark,[0,.05,0],[.07,.12,.07]],['box',wood,[0,.16,0],[.13,.09,.8]],
  ['box',limb,[-.25,.17,.3],[.52,.07,.08],[0,-.3,0]],['box',limb,[.25,.17,.3],[.52,.07,.08],[0,.3,0]],['box',0xfff4dc,[0,.17,.22],[.94,.025,.025]],
  ['box',0xefe6d2,[0,.23,.1],[.04,.04,.62]],['cone',tip,[0,.23,.46],[.07,.16,.07],[Math.PI/2,0,0]],['box',0xe2503f,[0,.25,-.18],[.03,.08,.12]]];
 if(tier>=1){const b=BRAZIER[tier],w=tier>=2?.13:.1;   // iron fire basket on a short post beside the stock, glowing coals
  parts.push(['box',iron,[b.x,.11,b.z],[.035,.16,.035]],['cyl6',iron,[b.x,b.y-.06,b.z],[w,.09,w]],['cyl6',0x2a2a2e,[b.x,b.y-.1,b.z],[w*.7,.03,w*.7]],['sphere',0xff7a22,[b.x,b.y-.02,b.z],[w*.8,.04,w*.8]])}
 if(tier>=2){const p=PENNANT;parts.push(['cyl6',0xf4efe4,[p.x,.55,p.z],[.03,.84,.03]],['sphere',0xffd24a,[p.x,.99,p.z],.055],   // mast with a red swallow-tail flag
  ['box',0xe2332a,[p.x+.19,p.y,p.z],[.34,.22,.03]],['cone',0xe2332a,[p.x+.4,p.y,p.z],[.11,.12,.03],[0,0,-Math.PI/2]],['box',0xffd24a,[p.x+.19,p.y,p.z+.002],[.34,.04,.032]])}
 if(tier>=3)for(const s of [-1,1]){const a=s*.42,cx=Math.sin(a)*.22,cz=Math.cos(a)*.22;   // two more rails fanned out, each with its own bolt and little bow
  parts.push(['box',wood,[cx,.2,cz],[.09,.06,.56],[0,a,0]],['box',0xefe6d2,[cx+Math.sin(a)*.04,.25,cz+Math.cos(a)*.04],[.035,.035,.5],[0,a,0]],
   ['cone',0xff7a2a,[Math.sin(a)*.52,.25,Math.cos(a)*.52],[.06,.14,.06],[Math.PI/2,0,-a]],['box',limb,[Math.sin(a)*.4,.21,Math.cos(a)*.4],[.4,.05,.06],[0,a,0]])}
 return solid(parts);
}
// Arrow in flight (faces +z). Chunky on purpose: it has to read at phone size from far away.
const arrowParts=()=>solid([['box',0xfff1cf,[0,0,0],[.07,.07,1.0]],['cone',0xb8c2cc,[0,0,.6],[.12,.24,.12],[Math.PI/2,0,0]],['box',0xe2503f,[0,.07,-.42],[.025,.14,.22]],['box',0xe2503f,[.07,0,-.42],[.14,.025,.22]]]);
// Unit-radius pond (scaled per level): sandy rim, water, deep spot, glint, lily pads and a few reeds. One draw call.
function pondGeometry(){
 const reed=0x5c8f3a;
 return solid([flat('disc',0xcdb681,0,0,1.14,1.0,.016),flat('disc',0x7fc6e6,0,0,1.0,.86,.028),flat('disc',0x4fa3d6,.1,-.05,.66,.54,.034),
  flat('disc',0xd2f1fa,-.4,-.28,.24,.09,.04,.35),flat('disc',0xd2f1fa,.38,.3,.12,.05,.04,.35),
  flat('dot',0x6fb04a,.5,.28,.17,.14,.044),flat('dot',0x6fb04a,-.32,.44,.13,.11,.044,1),flat('dot',0xff9fb6,.52,.25,.06,.06,.05),
  ['cyl',reed,[.92,.22,-.3],[.025,.44,.025]],['cyl',reed,[1.0,.18,-.1],[.02,.36,.02]],['cyl',0x6b9f45,[-.98,.2,.22],[.022,.4,.022]],['sphere',0x8a5a2e,[.92,.46,-.3],[.035,.08,.035]]]);
}
// A string of pennants through `points` (sagging between them), plus optional masts [x,z,y0,y1]. Built around its own centre so it can pop in place.
function bunting(points,sag,masts=[]){
 const c=new V3();for(const p of points)c.add(new V3(...p));c.divideScalar(points.length);
 const colors=[0xff5a4a,0xffd24a,0x6fd3ff,0x9be05c,0xff8fb3,0xffffff],parts=[],rel=p=>[p.x-c.x,p.y-c.y,p.z-c.z];let flag=0;
 for(let s=0;s+1<points.length;s++){
  const a=new V3(...points[s]),b=new V3(...points[s+1]),n=Math.max(2,Math.ceil(a.distanceTo(b)/.34)),yaw=-Math.atan2(b.z-a.z,b.x-a.x);let prev=null;
  for(let k=0;k<=n;k++){const u=k/n,p=a.clone().lerp(b,u);p.y-=sag*4*u*(1-u);
   if(prev){const d=p.clone().sub(prev),mid=prev.clone().add(p).multiplyScalar(.5);parts.push(['box',0x8a5a2e,rel(mid),[d.length()+.01,.022,.022],[0,-Math.atan2(d.z,d.x),Math.atan2(d.y,Math.hypot(d.x,d.z))]])}
   if(k>0&&k<n)parts.push(['cone',colors[flag++%colors.length],rel(p.clone().setY(p.y-.13)),[.13,.26,.02],[0,yaw,Math.PI]]);
   prev=p}
 }
 for(const [x,z,y0,y1] of masts)parts.push(['cyl',0xf4efe4,rel(new V3(x,(y0+y1)/2,z)),[.035,y1-y0,.035]],['sphere',0xffd24a,rel(new V3(x,y1+.04,z)),.06],['box',0xff5a4a,rel(new V3(x+.17,y1-.12,z)),[.3,.18,.015]]);
 return {geometry:solid(parts),center:c};
}

/* ---------- 0.17 wolf herald (까마귀 · 깃발): built from primitives only. The flag reads World.HERALD.look, the same table the picture village draws as SVG ----------
   look box: 24 × 32 (y down), pole at x 3 from y 2 (top) to y 31 (ground) → world units: X = (x − 3)·HERALD_K, Y = (31 − y)·HERALD_K; the cloth faces +Z (turned to the camera per instance). */
const HERALD_K=2.2/29;
function flatTris(tris,z,color){   // [x0,y0,x1,y1,x2,y2, …] in the look box → one flat, vertex-coloured piece facing +Z
 const n=tris.length/2,P=new Float32Array(n*3),N=new Float32Array(n*3);
 for(let i=0;i<n;i++){P[i*3]=(tris[i*2]-3)*HERALD_K;P[i*3+1]=(31-tris[i*2+1])*HERALD_K;P[i*3+2]=z;N[i*3+2]=1}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setAttribute('normal',new THREE.BufferAttribute(N,3));return prep(g,new THREE.Matrix4(),new THREE.Color(color));
}
function heraldFlagGeometry(look,fm){
 const k=HERALD_K,X=x=>(x-3)*k,Y=y=>(31-y)*k,cloth=look.cloth[fm],sh=new THREE.Shape(),w=look.stroke/2,tris=[],caps=[];
 sh.moveTo(X(cloth[0]),Y(cloth[1]));for(let i=2;i+1<cloth.length;i+=2)sh.lineTo(X(cloth[i]),Y(cloth[i+1]));sh.closePath();
 // white picture: each polyline as quads (round joints = small discs), arrow heads as triangles
 for(const line of look.line[fm])for(let i=0;i+3<line.length;i+=2){const [ax,ay,bx,by]=line.slice(i,i+4),d=Math.hypot(bx-ax,by-ay)||1,nx=-(by-ay)/d*w,ny=(bx-ax)/d*w;
  tris.push(ax+nx,ay+ny,bx+nx,by+ny,bx-nx,by-ny, ax+nx,ay+ny,bx-nx,by-ny,ax-nx,ay-ny);caps.push(['dot',0xffffff,[X(ax),Y(ay),.014],[w*k,w*k,1]],['dot',0xffffff,[X(bx),Y(by),.014],[w*k,w*k,1]])}
 for(const h of look.head[fm])tris.push(...h);
 return merge([solid([['cyl8',look.pole,[0,Y(31)/2+Y(2)/2,0],[.05,29*k,.05]],['ball',look.knob,[0,Y(2.4),0],.11]]),prep(new THREE.ShapeGeometry(sh),new THREE.Matrix4(),new THREE.Color(look.color[fm])),
  flatTris(tris,.012,0xffffff),solid(caps)]);
}
// A crow facing +Z (head), body ~0.9 long; the wings are a separate flat piece (right wing, root at the body axis) drawn mirrored for the left one.
function crowGeometry(look){const c=look.crow;return solid([['sphere',c,[0,0,0],[.2,.16,.4]],['ball',c,[0,.07,.36],.14],['cone',0xe9a23b,[0,.05,.55],[.055,.2,.055],[Math.PI/2,0,0]],['box',0x232129,[0,.01,-.44],[.26,.04,.3]],['ball',0xffffff,[.075,.12,.44],.035],['ball',0xffffff,[-.075,.12,.44],.035]])}
function crowWingGeometry(){const s=new THREE.Shape(),pts=[[0,.16],[.42,.14],[.8,.03],[.74,-.06],[.62,-.04],[.63,-.13],[.49,-.1],[.48,-.19],[0,-.2]];s.moveTo(pts[0][0],-pts[0][1]);for(const [x,z] of pts.slice(1))s.lineTo(x,-z);s.closePath();
 return prep(new THREE.ShapeGeometry(s),new THREE.Matrix4().makeRotationX(-Math.PI/2),new THREE.Color(0x34313d))}

// The 0.15 models, each its own request: a failed (or stalled, or malformed) file resolves to null instead of failing start(). Everything is settled
// before the scene first shows (renderer='three'), so a model never swaps in later. `core` = the assets start() cannot do without.
function loadArt15(loader,core){
 const keys=Object.keys(ART15);if(art15Off)return Promise.resolve(Object.fromEntries(keys.map(k=>[k,null])));
 const late=core.then(()=>new Promise(done=>setTimeout(done,ART15_GRACE)),()=>{}).then(()=>null);
 const one=k=>loader.loadAsync(ART15[k]+ART15_V).then(g=>ART15_NODES[k].every(n=>g.scene.getObjectByName(n))?g:null);
 return Promise.all(keys.map(k=>Promise.race([one(k),late]).catch(()=>null))).then(list=>Object.fromEntries(keys.map((k,i)=>[k,list[i]])));
}
async function start(){
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0x9fbf7c);renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const canvas=renderer.domElement;canvas.id='villageCanvas';canvas.setAttribute('role','img');canvas.setAttribute('aria-label','늑대 무리가 숲에서 나와 닭과 건물을 노리고, 화살 타워가 마을을 지키는 꼬꼬마을');
 const world=new THREE.Scene();world.add(new THREE.HemisphereLight(0xfff5de,0x6d8c57,2.2));
 const SUN_DIR=new V3(6,12,8).normalize(),sun=new THREE.DirectionalLight(0xffe5bb,2.8);sun.position.copy(SUN_DIR).multiplyScalar(40);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
 Object.assign(sun.shadow.camera,{left:-14,right:14,top:14,bottom:-14,near:1,far:100});sun.shadow.normalBias=.05;world.add(sun);
 // Mirrored isometric view from the front-left; the orthographic half-height follows the village radius.
 const camera=new THREE.OrthographicCamera(-9,9,9,-9,1,170);camera.position.copy(EYE_DIR).multiplyScalar(EYE_DIST);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const camRight=new V3().setFromMatrixColumn(camera.matrixWorld,0),camUp=new V3().setFromMatrixColumn(camera.matrixWorld,1);
 const facing=camera.quaternion.clone(),lying=new THREE.Quaternion().setFromAxisAngle(new V3(1,0,0),-Math.PI/2);
 const fwdXZ=new V3(-EYE_DIR.x,0,-EYE_DIR.z).normalize(),upXZ=Math.hypot(camUp.x,camUp.z),upY=camUp.y;   // ground direction toward the top of the screen
 const toCam=Math.atan2(-fwdXZ.x,-fwdXZ.z);                                                                  // yaw that faces the camera
 let aspect=1,viewW=1,camHalf=-1,fxScale=1,Rd=7,Rgoal=7;
 // Half-height that fits the village plus the last few metres of the approach (wolves become visible before they reach the fence).
 const fitHalf=R=>{const rho=R+4.2;return Math.max(rho*upXZ+.5,R*upXZ+3.2*upY+.4,rho/aspect*1.02,5.6)};
 // 0.10: the camera pulls back only VIEW_PULL of the way as the village grows, so growth reads on screen (it used to cancel out: the ring went
 // 2.3x wider but only +27% on a 390px phone). The ring itself plus a thin margin always stays in view; the forest approach may start off-screen.
 const VIEW_PULL=.7,ringHalf=R=>{const rho=R+1.4;return Math.max(rho*upXZ+.5,R*upXZ+3.2*upY+.4,rho/aspect*1.02,5.6)};
 const viewHalf=R=>{const base=fitHalf(7);return Math.max(ringHalf(R),base+(fitHalf(R)-base)*VIEW_PULL)};
 const resize=()=>{viewW=host.clientWidth||1;const h=host.clientHeight||1;aspect=viewW/h;camHalf=-1;renderer.setSize(viewW,h,false);applyView()};
 const gltf=new GLTFLoader(),core=Promise.all([new THREE.TextureLoader().loadAsync(ART+'backgrounds/grass.png'),gltf.loadAsync('art-handoff/coopnight/source-3d/models/environment-pack.glb'),makeAtlas()]);
 const [[grass,pack,atlas],art15]=await Promise.all([core,loadArt15(gltf,core)]);

 /* ----- ground: big tiled meadow, the village yard tint, one merged decal mesh (paths, wolf trails, flowers) ----- */
 const MAP=150,SEG=100;
 grass.colorSpace=THREE.SRGBColorSpace;grass.wrapS=grass.wrapT=THREE.RepeatWrapping;grass.repeat.set(MAP/3,MAP/3);grass.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
 const meadow=new THREE.PlaneGeometry(MAP,MAP,SEG,SEG).toNonIndexed();
 {const n=meadow.attributes.position.count,c=new Float32Array(n*3);for(let i=0;i<n;i++){const tile=Math.floor(i/6),dark=(tile%SEG+Math.floor(tile/SEG))%2;c[i*3]=dark?.86:1;c[i*3+1]=dark?.93:1;c[i*3+2]=dark?.8:1}meadow.setAttribute('color',new THREE.BufferAttribute(c,3))}
 const land=new THREE.Mesh(meadow,new THREE.MeshStandardMaterial({map:grass,vertexColors:true,color:0xe9f0cf,roughness:1}));land.rotation.x=-Math.PI/2;land.receiveShadow=true;world.add(land);
 const yard=new THREE.Mesh(yardGeometry(),new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,side:THREE.DoubleSide}));yard.position.y=.006;yard.renderOrder=1;world.add(yard);
 const decor=new THREE.Mesh(groundDecor(),lit);decor.receiveShadow=true;world.add(decor);
 /* ----- 0.14 wolf roads: at stage 0 (or with stages off) the eight faint trails of 0.13; from stage 1 only the open roads, drawn as dirt roads.
    The forest closes over the directions that are not open (layoutDecor reads curRoutes). ----- */
 const trailCache=new Map();let trailKey='',curRoutes=null;
 const trails=new THREE.Mesh(new THREE.BufferGeometry(),lit);trails.receiveShadow=true;trails.name='trails';world.add(trails);
 function setTrails(routes){
  const key=routes?routes.join(','):'all';if(key===trailKey)return false;trailKey=key;curRoutes=routes;
  if(!trailCache.has(key))trailCache.set(key,trailGeometry(routes));trails.geometry=trailCache.get(key);decorR=-1;return true;
 }

 /* ----- models ----- */
 const bakeStart=performance.now();   // model baking time (incl. decimation) is reported by debug().bakeMs
 const node=name=>pack.scene.getObjectByName(name),one=(name,height)=>bake(node(name),height).main.geometry;
 const coopArt=bake(node('EnvCoop'),2.7,[],{anchors:['Door dark opening']});
 // crowd figures are decimated (KEEP = share of vertices kept): 20 towers, 20 hens and 10 farmers stay inside the phone budget
 const KEEP={tower:.32,hen:.34,farmer:.3,panel:.5};
 const towerArt=[bake(node('EnvTower'),TOWER_H,[],{omit:CANNON,anchors:['Seed cannon barrel'],keep:KEEP.tower}),bake(node('EnvCornTower'),TOWER_H,[],{omit:CANNON,anchors:['Seed cannon barrel'],keep:KEEP.tower})];
 const G={coop:coopArt.main.geometry,hen:bake(node('EnvChicken'),.95,[],{keep:KEEP.hen}).main.geometry,tree:one('EnvTree',1),bush:one('EnvBush',.7),rock:one('EnvRock',.5),panel:bake(node('EnvFence'),.85,[],{keep:KEEP.panel}).main.geometry,
  crossbow:[0,1,2,3].map(crossbowGeometry),arrow:arrowParts()};
 G.lowTree=lowPoly(node('EnvTree'),1,n=>n.includes('crown')?'cone8':n.includes('trunk')?'cyl6':null,[flat('disc',0x5f7f3a,-.1,-.14,.4,.32,.012)]);
 G.lowBush=lowPoly(node('EnvBush'),.7,n=>n.includes('foliage')?'ball':null);
 G.panel.computeBoundingBox();const FENCE_W=Math.max(.5,G.panel.boundingBox.max.x-G.panel.boundingBox.min.x);
 G.rail=railGeometry(FENCE_W);G.wall=wallGeometry(FENCE_W);
 // market tiers by hall stage: 0 stall (no awning) · 1 roofed shop (the GLB market) · 2 tent market · 3 big market
 {const full=one('EnvMarket',2.6),stall=bake(node('EnvMarket'),2.6,[],{omit:STALL_OMIT}).main.geometry;
  G.market=[0,1,2,3].map(t=>{const base=t?full:stall,extra=marketExtras(t);return extra?merge([base,extra]):base})}
 // tower storey: a stone drum as wide as the tower's legs
 const towerFoot=Math.max(...towerArt.map(a=>{a.main.geometry.computeBoundingBox();const b=a.main.geometry.boundingBox;return Math.max(b.max.x-b.min.x,b.max.z-b.min.z)}));
 G.storey=storeyGeometry(towerFoot*.5);
 G.props=[0,1,2,3].map(villageProps);
 // 0.15 mill and bridge (계획서 §2-§3): the mill house goes into the stage props, its wheel turns on its own (MILL.wheel = its axle in the mill's frame);
 // the bridge goes into the stage props at full size. A file that failed to load or bake leaves the code-drawn stand-ins (props.js).
 const millArt=(()=>{if(!art15.watermill)return null;try{const b=bake(art15.watermill.scene,MILL.h,['WaterWheel']);if(!b.main||!b.WaterWheel)throw new Error('mill parts missing');return {house:b.main.geometry,wheel:b.WaterWheel.geometry,pivot:b.WaterWheel.pivot}}catch(error){art15.watermill=null;console.warn('0.15 mill model unavailable:',error.message);return null}})();
 const bridgeArt=(()=>{if(!art15.bridge)return null;try{return bake(art15.bridge.scene,BRIDGE_ART.h).main.geometry}catch(error){art15.bridge=null;console.warn('0.15 bridge model unavailable:',error.message);return null}})();
 G.wheel=millArt?millArt.wheel:codeWheelGeometry();
 const bakeMs=Math.round(performance.now()-bakeStart);
 const door=coopArt.anchors['Door dark opening']||new THREE.Box3(new V3(-.3,0,1),new V3(.3,1,1.3));
 const actors=[];
 function wrap(obj,x,z,ry=0,s=1,skin=[obj]){obj.rotation.order='YXZ';world.add(obj);const a={obj,skin,x,y:0,z,ry,s,lift:0,sx:1,sy:1,tilt:0,pitch:0,spin:0,flash:0,base:lit,mat:lit,hide:false};actors.push(a);return a}
 function actor(geometry,x,z,ry=0,s=1){const mesh=new THREE.Mesh(geometry,lit);mesh.castShadow=mesh.receiveShadow=true;return wrap(mesh,x,z,ry,s)}
 // A proxy is an actor without its own mesh: its pose is copied into an instanced mesh (hens), so eight hens cost one draw call.
 function proxy(s=1){const obj=new THREE.Object3D();obj.rotation.order='YXZ';const a={obj,skin:null,x:0,y:0,z:0,ry:0,s,lift:0,sx:1,sy:1,tilt:0,pitch:0,spin:0,flash:0,shy:false,hide:true};actors.push(a);return a}
 function pose(a,dt){
  a.obj.position.set(a.x,a.y+a.lift,a.z);a.obj.rotation.set(a.pitch,a.ry+a.spin,a.tilt);a.obj.scale.set(a.s*a.sx,a.s*a.sy,a.s*a.sx);
  a.lift=a.tilt=a.pitch=a.spin=0;a.sx=a.sy=1;
  if(a.flash>0)a.flash-=dt;
  if(a.skin){const m=a.flash>0?hot:a.base;if(m!==a.mat){a.mat=m;for(const mesh of a.skin)mesh.material=m}}
 }
 const dummy=new THREE.Object3D();
 const instanced=(geometry,max,shadow)=>{const m=new THREE.InstancedMesh(geometry,lit,Math.max(1,max));m.count=0;m.frustumCulled=false;m.castShadow=shadow;m.receiveShadow=true;m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);world.add(m);return m};
 // Shadow stand-in: a low-poly instanced copy that only draws into the shadow map (in the main pass it has zero instances, so no draw call).
 // Detailed models (fence panels, farmers, hens, towers, garden bushes) cast their shadow through one of these: same shapes, a fraction of the triangles.
 function shadowOnly(geometry,max){const m=instanced(geometry,max,true);m.receiveShadow=false;m.onBeforeRender=function(){this.userData.n=this.count;this.count=0};m.onAfterRender=function(){this.count=this.userData.n};return m}
 const copyShade=(shade,i,obj)=>{obj.updateMatrix();shade.setMatrixAt(i,obj.matrix)};

 /* ----- decor field: meadow, a sparse approach zone and a forest ring that recedes as the village grows ----- */
 const DEC={tree:[],bush:[],rock:[]};
 {const keep=seed;seed=4242;
  for(let gx=-64;gx<=64;gx+=2.3)for(let gz=-64;gz<=64;gz+=2.3){
   const x=gx+span(-1,1),z=gz+span(-1,1),r=Math.hypot(x,z),sx=x*camRight.x+z*camRight.z,sy=x*fwdXZ.x+z*fwdXZ.z;
   const kind=rnd(),item={x,z,r,a:Math.atan2(z,x),u:rnd(),lane:laneOf(x,z),ry:span(0,6.283),s:1};
   if(r<8.2||Math.abs(sx)>58||sy>42||sy<-38)continue;   // beyond the widest view at full zoom-out (0.14: castle radius 22)
   if(kind<.1){item.s=span(.7,1.4);DEC.rock.push(item)}else if(kind<.22){item.s=span(.8,1.3);DEC.bush.push(item)}else{item.s=span(3.1,4.3);DEC.tree.push(item)}
  }
  seed=keep}
 const forest=instanced(G.lowTree,DEC.tree.length,false),groveMax=40,grove=instanced(G.tree,groveMax,true),shrubs=instanced(G.lowBush,DEC.bush.length,false),stones=instanced(G.rock,DEC.rock.length,false);
 // Fixed little garden inside the village (clear of buildings, tower slots, hen homes, pond and paths).
 const garden=[instanced(G.lowBush,GARDEN.bush.length,false),instanced(G.rock,GARDEN.rock.length,false),shadowOnly(G.lowBush,GARDEN.bush.length)];   // low-poly bushes (5k -> 0.4k triangles each), like the meadow shrubs
 [GARDEN.bush,GARDEN.rock,GARDEN.bush].forEach((list,k)=>{list.forEach(([x,z,s],i)=>{dummy.position.set(x,0,z);dummy.rotation.set(0,i*1.7,0);dummy.scale.setScalar(s);dummy.updateMatrix();garden[k].setMatrixAt(i,dummy.matrix)});garden[k].count=list.length;garden[k].instanceMatrix.needsUpdate=true});
 let decorR=-1;
 // lateral distance from the nearest wolf road that is open now (all eight trails when curRoutes is null)
 const laneNow=t=>{if(!curRoutes)return t.lane;let best=9;for(const p of curRoutes){let d=Math.abs(t.a-spawnAngle(p))%(Math.PI*2);if(d>Math.PI)d=Math.PI*2-d;if(d<Math.PI/2)best=Math.min(best,t.r*Math.sin(d))}return best};
 function layoutDecor(R){
  if(Math.abs(R-decorR)<.01)return;decorR=R;const wide=curRoutes?.4:0;
  let nf=0,ng=0,nb=0,nr=0;
  const put=(mesh,i,t,scale)=>{dummy.position.set(t.x,0,t.z);dummy.rotation.set(0,t.ry,0);dummy.scale.setScalar(scale);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix)};
  // 0.15: nothing grows in the river or the mill race (measured from the river built for riverR, not the animating radius, so nothing flickers)
  for(const t of DEC.tree){const d=t.r-R,lane=laneNow(t);if(riverR&&riverGap(t.x,t.z)<.3+.22*t.s)continue;
   if(d>=FOREST){const dens=lane<1.7+wide?.12:lane<3.2+wide?.5:.9;if(t.u<dens)put(forest,nf++,t,t.s*easeOut(clamp((d-FOREST)/.9,.02,1)))}
   else if(d>1.4&&t.u<.09&&lane>1.5+wide&&ng<groveMax)put(grove,ng++,t,t.s*.95*easeOut(clamp((d-1.4)/.8,.02,1)))}
  for(const t of DEC.bush){const d=t.r-R;if(d>.9&&t.u<.6&&laneNow(t)>1.2+wide&&(!riverR||riverGap(t.x,t.z)>.3+.35*t.s))put(shrubs,nb++,t,t.s*easeOut(clamp((d-.9)/.6,.02,1)))}
  for(const t of DEC.rock){const d=t.r-R;if(d>.5&&t.u<.65&&(!riverR||riverGap(t.x,t.z)>.3+.3*t.s))put(stones,nr++,t,t.s*easeOut(clamp((d-.5)/.5,.02,1)))}
  forest.count=nf;grove.count=ng;shrubs.count=nb;stones.count=nr;
  for(const m of [forest,grove,shrubs,stones])m.instanceMatrix.needsUpdate=true;
 }

 /* ----- buildings: one slot per world building kind (coop, market, nursery, barn, six tower slots, six fence sides) ----- */
 const P=W('PLACE');
 const matCache=new Map();
 // Damage darkens the building in three steps; a broken one is sooty.
 const DAMAGE=[0xffffff,0xe9dccb,0xc9b297,0x6f625a];
 function damageMat(tintHex,tier){const key=tintHex+':'+tier;if(!matCache.has(key)){const c=new THREE.Color(tintHex).multiply(new THREE.Color(DAMAGE[tier]));matCache.set(key,tier===0&&tintHex===0xffffff?lit:new THREE.MeshStandardMaterial({vertexColors:true,roughness:tier===3?1:.85,metalness:0,side:THREE.DoubleSide,color:c}))}return matCache.get(key)}
 const slot=(kind,a,o={})=>{a.obj.visible=false;return Object.assign({kind,a,id:null,on:false,b:null,born:-9,fxDone:true,wasBroken:false,brokeAt:-9,lean:1,smash:0,chipT:0,tint:0xffffff,height:2.6,size:1.4,hp:1},o)};
 const home=slot('coop',actor(G.coop,P.coop[0],P.coop[1]),{height:2.7,size:1.4,lean:-1});
 const market=slot('market',actor(G.market[0],P.market[0],P.market[1]),{height:2.6,size:1.6,mtier:-1,down:false});
 const nursery=slot('nursery',actor(G.coop,P.nursery[0],P.nursery[1],0,.74),{height:2.0,size:1,lean:-1});
 const barn=slot('barn',actor(G.coop,P.barn[0],P.barn[1],.35,.95),{height:2.6,size:1.6,tint:0xffcdb4});
 const bowAt=towerArt.map(art=>{const b=art.anchors['Seed cannon barrel'];return b?b.getCenter(new V3()).setY(b.min.y-.02):new V3(0,TOWER_H*.62,0)});
 // Towers (up to 20) are proxies drawn through instanced meshes: two tower models, the stone storeys under raised towers, the crossbows.
 // Draw calls stay at four however many towers stand. A tower's `floors` extra storeys lift the wooden tower (and its crossbow) up.
 const towerBody=towerArt.map(art=>instanced(art.main.geometry,MAXT,false)),storeys=instanced(G.storey,MAXT*MAX_FLOORS,true),bows=instanced(G.crossbow[0],MAXT,false);
 const towers=Array.from({length:MAXT},(_,i)=>{
  const art=i%2,a=proxy(1),bow=new THREE.Object3D();bow.position.copy(bowAt[art]);bow.scale.setScalar(1.25);
  return slot('tower',a,{height:TOWER_H,size:.9,lean:i%2?1:-1,slot:i,bow,art,aim:0,aimId:0,aimAt:-9,kick:0,shotAt:-9,tier:0,stunAt:-9,smokeT:0,floors:0,floorAt:-9,floorFx:true,dmg:0});
 });
 const BUILDINGS=[home,market,nursery,barn,...towers];
 const towerShade=['EnvTower','EnvCornTower'].map(n=>shadowOnly(lowPoly(node(n),TOWER_H,s=>/seedcannon|cannonbrass|darkmuzzle/.test(s)?null:'cyl6'),MAXT));
 // Fence sides carry a layer: 1 wooden panels · 2 panels with a second pair of rails · 3 a dry-stone wall.
 const sides=[0,1,2,3,4,5].map(k=>({kind:'fence',side:k,id:null,on:false,b:null,born:-9,fxDone:true,wasBroken:false,brokeAt:-9,pop:-9,smash:0,layer:1,layerAt:-9,layerFx:true}));
 const FCAP=6*24,fences=instanced(G.panel,FCAP,false),rails=instanced(G.rail,FCAP,false),walls=instanced(G.wall,FCAP,true),FP=FENCE_W/2-.06;
 const fenceShade=shadowOnly(solid([['box',0,[-FP,.42,0],[.1,.84,.1]],['box',0,[FP,.42,0],[.1,.84,.1]],['box',0,[0,.34,0],[FENCE_W,.08,.06]],['box',0,[0,.62,0],[FENCE_W,.08,.06]]]),FCAP);
 const FENCE_TINT=DAMAGE.map(h=>new THREE.Color(h)),FENCE_TINT2=DAMAGE.map(h=>new THREE.Color(h).multiply(new THREE.Color(.84,.7,.56))),LAYER_H=[1,1.2,1.14];   // 0.13: a second layer is taller and darker wood, the stone wall a little taller
 for(let i=0;i<FCAP;i++)for(const m of [fences,rails,walls])m.setColorAt(i,FENCE_TINT[0]);
 for(const m of [...towerBody,bows])for(let i=0;i<MAXT;i++)m.setColorAt(i,FENCE_TINT[0]);for(let i=0;i<MAXT*MAX_FLOORS;i++)storeys.setColorAt(i,FENCE_TINT[0]);
 // What each hall stage adds (egg nests from the start; dirt paths, lanterns, hay and feast flags later): one mesh, swapped per stage.
 const props=new THREE.Mesh(G.props[0],lit);props.castShadow=props.receiveShadow=true;world.add(props);let propsStage=0;
 const NEST_SPOTS=nestSpots();
 /* ----- 0.14 stage props (cottages, well, mill hut, road-entrance markers, castle keep): one merged mesh per stage;
    while a new stage rises, what was there stays in stageMesh and the new things grow out of the ground in stageNew (then they are merged) ----- */
 const EMPTY=new THREE.BufferGeometry(),stageCache=new Map();
 const stageMesh=new THREE.Mesh(EMPTY,lit);stageMesh.castShadow=stageMesh.receiveShadow=true;stageMesh.visible=false;stageMesh.name='stage';world.add(stageMesh);
 const stageNew=actor(EMPTY,0,0);stageNew.obj.visible=false;stageNew.obj.name='stage-new';
 let stageShown=-1,stageKey='',stageInfo={houses:0,marks:0,spots:[]},stageRising=false;
 /* ----- 0.15 river (계획서 §3): one decal mesh per village radius, in its own frame (riverGeometry), shown from stage 3 while the page says river (stages,
    roads and FLAGS.RIVER on). The mill wheel is its own actor at the mill's axle; the mill house and the bridge are in the stage props. ----- */
 const riverCache=new Map(),riverMesh=new THREE.Mesh(EMPTY,lit);riverMesh.receiveShadow=true;riverMesh.visible=false;riverMesh.name='river';world.add(riverMesh);
 let riverR=0,raceSeg=null;   // the radius the shown river was built for (0 = none) and its mill race: the forest steps aside from both (layoutDecor)
 const wheel=actor(G.wheel,0,0,MILL.ry);wheel.obj.visible=false;wheel.obj.name='mill-wheel';
 {const p=millArt?millArt.pivot:new V3(MILL.wheel.x,MILL.wheel.y,0),c=Math.cos(MILL.ry),s=Math.sin(MILL.ry);wheel.x=MILL.at[0]+p.x*c+p.z*s;wheel.z=MILL.at[1]-p.x*s+p.z*c;wheel.y=p.y}
 let bridgeNow=null;   // bridgeSpot(riverR): where wolves step up onto the deck
 function setRiver(R){
  if(R===riverR)return false;riverR=R;decorR=-1;
  if(!R){riverMesh.visible=false;wheel.obj.visible=false;raceSeg=bridgeNow=null;return true}
  if(!riverCache.has(R))riverCache.set(R,riverGeometry(R));const f=riverFrame(R);
  riverMesh.geometry=riverCache.get(R);riverMesh.position.set(f.c[0],0,f.c[1]);riverMesh.rotation.y=Math.atan2(f.n[0],f.n[1]);riverMesh.scale.x=1;riverMesh.visible=true;
  wheel.obj.visible=true;raceSeg=millRace(R);bridgeNow=bridgeSpot(R);return true;
 }
 /* 0.15 mill wheel (계획서 §5, 프로듀서 결정: 금화 없음, 한 번에 맞힌 정답에만 힘차게 돈다): the page's cheer (flowing farm) / produce events come only for
    a first-try right answer. Each gives the wheel a push (more with the 신바람 boost), it spins down on the effect clock (τ 0.7 s: about 90% of the turn
    within the 1.6 s reward beat). No push for second tries, idling or reduced motion. The GLB clip (WheelTurn) is not used. */
 const MILL_TAU=.7,MILL_MAX=2.5*Math.PI*2/MILL_TAU,millSpin={angle:0,vel:0,kicks:0};
 function millKick(lv){
  if(!riverR||reduced())return;millSpin.vel=Math.min(MILL_MAX,millSpin.vel+Math.PI*2/MILL_TAU*(1+.5*clamp(num(lv)|0,0,2)));millSpin.kicks++;
  const [x0,z0]=raceSeg,b=bridgeNow;ringWave(x0,z0,2.2,WHITE,.6,.05,CELL.ring,.35,.06);ringWave(x0,z0,3.2,SKY,.7,.25,CELL.halo,.3,.06);   // ripples under the wheel and by the bridge
  for(let i=0;i<2;i++)ringWave(b.at[0]+b.u[1]*(i?1.6:-1.6),b.at[1]-b.u[0]*(i?1.6:-1.6),2.4,WHITE,.7,.15+i*.2,CELL.ring,.3,.06);
 }
 function millStep(fdt){if(millSpin.vel<=0)return;millSpin.angle+=millSpin.vel*fdt;millSpin.vel*=Math.exp(-fdt/MILL_TAU);if(millSpin.vel<.02)millSpin.vel=0}
 /* 0.15 wolves at the river (looks only, the rule never reads it): up on the bridge deck (deckY along the bridge), a little lower in the water with a splash
    now and then. Counts distinct wolves seen over the water on the bridge (bridged) and off it (waded; wadedIn = coming in), from the blended world position. */
 const crossed={bridged:new Set(),waded:new Set(),wadedIn:new Set(),splashes:0};let splashBudget=0;   // splashes per frame (own budget: a crowd's dust and footfalls use up fxBudget first)
 function wadeSplash(x,z,s){crossed.splashes++;for(let i=0;i<4;i++)emit({cell:CELL.dot,x:x+span(-.2,.2),y:.15,z:z+span(-.2,.2),vx:span(-.9,.9),vy:span(1.3,2.2),vz:span(-.9,.9),gravity:8,life:span(.35,.5),size:.11*s,end:.04,color:SKY,alpha:.95,fade:.5,pop:0,abs:true});
  ringWave(x,z,1.3*s,WHITE,.5,0,CELL.ring,.3,.06)}
 function riverStep(o,st,wdt,less){
  if(!riverR)return 0;const off=riverOffset(riverR,o.x,o.z);if(Math.abs(off)>RIVER.water/2+RIVER.bank+1)return 0;
  const b=bridgeNow,dx=o.x-b.at[0],dz=o.z-b.at[1],along=dx*b.u[0]+dz*b.u[1],side=Math.abs(dx*b.u[1]-dz*b.u[0]),wet=Math.abs(off)<=RIVER.water/2,live=st!=='dead'&&!o.ghost;
  if(side<=BRIDGE_ART.width/2&&Math.abs(along)<=BRIDGE_ART.deck.half+.3){if(wet&&live)crossed.bridged.add(o.id);return deckY(along)}
  if(!wet)return 0;if(live){crossed.waded.add(o.id);if(st==='walk'||st==='hunt')crossed.wadedIn.add(o.id)}
  if(live&&!less&&wdt>0&&(o.splashT=(o.splashT||0)-wdt)<=0&&splashBudget>0&&onView(o.x,.2,o.z)){o.splashT=.45;splashBudget--;wadeSplash(o.x,o.z,Math.min(1.6,o.size))}
  return -.15;
 }
 // ground distance from the river band / the race (0 inside): decor (trees, bushes, rocks) keeps out of both
 const riverGap=(x,z)=>{if(!riverR)return 9;let d=Math.abs(riverOffset(riverR,x,z))-(RIVER.water/2+RIVER.bank);
  const [x0,z0,x1,z1,w]=raceSeg,dx=x1-x0,dz=z1-z0,u=clamp(((x-x0)*dx+(z-z0)*dz)/(dx*dx+dz*dz),0,1);return Math.min(d,Math.hypot(x-x0-dx*u,z-z0-dz*u)-w/2-.12)};
 function setStage(st,R,routes,fx,river){
  const key=st+':'+R+':'+(routes?routes.join(','):'')+(river?':river':'');if(key===stageKey)return false;
  const up=fx&&st>stageShown,on=!!river&&st>=RIVER.stage;stageKey=key;stageShown=st;
  const riverNew=on&&!riverR;setRiver(on?R:0);
  if(riverNew&&up&&!reduced()){popIn(wheel,.18,.87);riverMesh.scale.x=.001;tween(.05,.9,u=>{riverMesh.scale.x=Math.max(.001,easeInOut(u))},()=>{riverMesh.scale.x=1})}   // the river flows in along its length (0.9 s, inside the 1.6 s beat)
  if(st<1){stageMesh.visible=stageNew.obj.visible=false;stageInfo={houses:0,marks:0,spots:[]};stageRising=false;return true}
  if(!stageCache.has(key))stageCache.set(key,stageProps(st,R,routes,river?{river:true,house:millArt&&millArt.house,bridge:bridgeArt}:{}));
  const g=stageCache.get(key);stageInfo=g;
  const settle=()=>{if(stageKey!==key)return;stageMesh.geometry=g.all||EMPTY;stageMesh.visible=!!g.all;stageNew.obj.visible=false;stageRising=false;dirty=true};
  if(up&&g.fresh&&!reduced()){
   stageMesh.geometry=g.old||EMPTY;stageMesh.visible=!!g.old;stageNew.obj.geometry=g.fresh;stageNew.obj.visible=true;stageRising=true;
   tween(0,1.05,(u,t)=>{const T=.18;stageNew.sy*=t<T?.001:Math.max(.001,springy(t-T))},settle);
  }else settle();
  return true;
 }
 const hay=actor(solid([['cyl',0xe9c75a,[-.33,.3,0],[.3,.62,.3],[Math.PI/2,0,0]],['cyl',0xe9c75a,[.33,.3,0],[.3,.62,.3],[Math.PI/2,0,0]],['cyl',0xf4d877,[0,.82,0],[.3,.62,.3],[Math.PI/2,0,0]],
  ['cyl',0xc79a3a,[-.33,.3,0],[.31,.09,.31],[Math.PI/2,0,0]],['cyl',0xc79a3a,[.33,.3,0],[.31,.09,.31],[Math.PI/2,0,0]],['cyl',0xc79a3a,[0,.82,0],[.31,.09,.31],[Math.PI/2,0,0]]]),HAY.x,HAY.z,-.35);
 hay.obj.visible=false;
 const pond=actor(pondGeometry(),POND.x,POND.z);pond.obj.castShadow=false;pond.obj.visible=false;
 const fish=actor(solid([['sphere',0xff9a3c,[0,0,0],[.11,.13,.26]],['cone',0xff7a2a,[0,0,-.3],[.03,.16,.13],[Math.PI/2,0,0]],['sphere',0x222a2c,[.08,.04,.15],.026],['sphere',0x222a2c,[-.08,.04,.15],.026]]),POND.x,POND.z,Math.PI/2);
 fish.obj.visible=false;fish.obj.castShadow=false;
 // Feast bunting: a mast on the coop roof strung over the nursery to a pole beside the market; the second string runs to the barn.
 const garlands=[bunting([[-2.8,3.68,-2.8],[.6,1.95,-3.6],[2.6,2.1,-3.1]],.42,[[-2.8,-2.8,3.0,3.8],[2.6,-3.1,0,2.2]]),bunting([[-2.8,3.5,-2.8],[-6.2,2.35,-4.4]],.34)].map(({geometry,center})=>{
  const mesh=new THREE.Mesh(geometry,lit),a=wrap(mesh,center.x,center.z);a.y=center.y;mesh.visible=false;return a});

 /* ----- hens: up to twenty world hens + three peeking from the coop door, one instanced mesh ----- */
 const HCAP=MAXH+3,henMesh=instanced(G.hen,HCAP,false),henShade=shadowOnly(solid([['sphere',0,[0,.36,-.03],[.3,.28,.36]],['sphere',0,[0,.68,.16],[.16,.19,.16]]]),HCAP);
 const henSlots=[];for(let i=0;i<MAXH;i++)henSlots.push({i,a:proxy(.9+(i*37%10)*.012),id:null,on:false,h:null,fx:0,fz:0,tx:0,tz:0,born:-9,fxDone:true,phase:i*1.7,face:i*2.1,featherT:0,lastX:0,lastZ:0});
 const peeks=[0,1,2].map(()=>proxy(.76));
 const PLAIN=new THREE.Color(1,1,1),SHINY_TINT=new THREE.Color(1.45,1.3,.75),FLASH=new THREE.Color(2.1,1.9,1.5),SHY=new THREE.Color(.72,.78,.9),DEAD=new THREE.Color(.62,.62,.68);
 for(let i=0;i<HCAP;i++)henMesh.setColorAt(i,PLAIN);

 /* ----- monsters: one rigged instanced mesh per kind (head, jaw, tail and legs move in the vertex shader) and one shared,
    low-poly shadow stand-in. Draw calls = kinds on screen + 1, whatever the pack size. ----- */
 const WCAP=Math.max(96,num(W('MAX_WOLVES')))+16;   // every world wolf plus a few falling ones the world has already dropped
 function rigMesh(geometry,material,cap,colors){
  const mesh=new THREE.InstancedMesh(geometry,material,cap);mesh.count=0;mesh.visible=false;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const pose=[];for(const k of ['aPoseA','aPoseB','aPoseC','aPoseD']){const a=new THREE.InstancedBufferAttribute(new Float32Array(cap*4),4);a.setUsage(THREE.DynamicDrawUsage);geometry.setAttribute(k,a);pose.push(a)}
  if(colors){for(let i=0;i<cap;i++)mesh.setColorAt(i,PLAIN);mesh.instanceColor.setUsage(THREE.DynamicDrawUsage)}
  world.add(mesh);return {mesh,pose,n:0,tris:(geometry.index?geometry.index.count:geometry.attributes.position.count)/3};
 }
 /* 0.15 늑대 왕 · 도둑 여우 (계획서 §6): the GLB's seven parts are baked into one rigged mesh like the farmers (body 0, head 1, tail 3, legs 4-7 by
    position: front/back × +x/−x, so the GLB's _L legs at −x are rig legs 5 and 7; no jaw). The GLB clip (Trot) is never played: the rig's gaits, attacks,
    flinches and falls drive it. The model keeps its origin (body centre) with feet on y=0. A file that failed to load or bake keeps the 0.14 model. */
 // h = the GLB's own height (scale 1: the pack was modelled at the 0.14 village scale). Side-by-side shots with the 0.14 models (v015-shots\lineup-*):
 // at 1.57/1.47 (the code models' heights) the bigger-headed, longer GLB animals read about 1.3x larger; at scale 1 the king is as bulky as the
 // grey ember king and the fox as tall as the orange wolf. Screen size multipliers (KIND_FALLBACK king 3.6 · fox 1.15) are unchanged.
 // Gaits: the king trots at the art's Trot pace (0.96 s ≈ 1.04 Hz, diagonal pairs) instead of the ember prowl; the fox trots, gallops when running.
 const BEAST={king:{h:1.405,gait:{walk:'trot',run:'trot',hz:{trot:1.04}}},fox:{h:1.424,gait:{walk:'trot',run:'gallop',hz:{trot:2.4,gallop:3.2}}}};
 function beastRig(gl,h){
  const art=bake(gl.scene,h,BEAST_PARTS,{origin:true}),P=n=>art[n].pivot;
  if(!art.main||!BEAST_PARTS.every(n=>art[n]))throw new Error('animal parts missing');
  const bone=n=>n==='main'?0:n==='Head'?1:n==='Tail'?3:4+(P(n).z<0?2:0)+(P(n).x<0?1:0),box=n=>{const g=art[n].geometry;g.computeBoundingBox();return g.boundingBox.clone().translate(P(n))};
  const parts=Object.keys(art).filter(n=>n!=='anchors'),list=parts.map(n=>{const g=art[n].geometry.clone(),p=P(n),b=bone(n),c=g.attributes.position.count,R=new Float32Array(c*4);
   g.translate(p.x,p.y,p.z);for(let i=0;i<c;i++){R[i*4]=p.x;R[i*4+1]=p.y;R[i*4+2]=p.z;R[i*4+3]=b}g.setAttribute('aRig',new THREE.BufferAttribute(R,4));return g});
  const geometry=merge(list);for(const g of list)g.dispose();for(const n of parts)art[n].geometry.dispose();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const legs=[4,5,6,7].map(b=>{const n=BEAST_PARTS.slice(2).find(n=>bone(n)===b);if(!n)throw new Error('animal legs');return P(n).toArray()});
  const head=box('Head'),body=box('main'),H=P('Head').toArray();
  // crown: the gold of the head part above the eyes (vertex colours), for the king's twinkles in place of the ember king's flames
  const crown=[];{const g=geometry,c=g.attributes.color,q=g.attributes.position,r=g.attributes.aRig,b=new THREE.Box3(),v=new V3();
   for(let i=0;i<q.count;i++)if(r.getW(i)===1&&q.getY(i)>H[1]+.2*h/1.4&&c.getX(i)>.6&&c.getY(i)>.3&&c.getY(i)<.6&&c.getZ(i)<.2)b.expandByPoint(v.fromBufferAttribute(q,i));
   if(!b.isEmpty()){const m=b.getCenter(new V3());crown.push([b.min.x,b.max.y,m.z],[b.max.x,b.max.y,m.z],[m.x,b.max.y,b.min.z],[m.x,(b.min.y+b.max.y)/2,b.max.z])}}
  // tp0: the GLB tail is modelled already raised, so the rig's tail lift (0.35 at rest, more when hunting) starts 0.35 lower (else it stands straight up)
  const rig={H,J:H.slice(),T:P('Tail').toArray(),L:legs,M:[0,(head.min.y+H[1])/2,head.max.z-.04],top:[0,head.max.y+.15,H[2]],hip:legs[0][1],rear:legs[2][2],center:(body.min.y+body.max.y)/2,crown,tp0:-.35};
  return {geometry,rig,size:geometry.boundingBox.getSize(new V3())};
 }
 const beast={};
 for(const k of ['king','fox'])if(art15[k]){try{beast[k]=beastRig(art15[k],BEAST[k].h)}catch(error){art15[k]=null;console.warn('0.15 '+k+' model unavailable:',error.message)}}
 const herd={};for(const k of KIND_ORDER){const b=beast[k];if(b)setRig(k,b.rig,BEAST[k].gait);
  const r=rigMesh(b?b.geometry:monsterGeometry(k),b?rigMaterialAt(b.rig.H,.86):rigMaterial(k),WCAP,true);r.mesh.castShadow=false;r.mesh.receiveShadow=true;herd[k]=r}
 const shade=rigMesh(shadowGeometry(),herd.wolf.mesh.material,WCAP,false);shade.mesh.castShadow=true;shade.mesh.receiveShadow=false;shade.mesh.customDepthMaterial=rigDepthMaterial('wolf');
 // The stand-in only draws into the shadow map: in the main pass it has zero instances (no draw call).
 shade.mesh.onBeforeRender=function(){this.userData.n=this.count;this.count=0};shade.mesh.onAfterRender=function(){this.count=this.userData.n};

 /* ----- farmers: up to ten, one rigged instanced mesh like the monsters (arms and legs on bones 4-7, head on bone 1).
    Each has a basket (one more instanced mesh): in the left hand while strolling, carried on the head with both arms up when it
    holds eggs, so the eggs read from any side. Basket eggs and the left-over eggs in the nests are one instanced egg mesh. ----- */
 const farmerArt=bake(node('FarmerPolished'),1.9,['ArmL','ArmR','LegL','LegR','Head'],{keep:KEEP.farmer,anchors:['Mitten hand']});
 const ARM_UP=-2.75,FBONE={main:0,Head:1,ArmL:4,ArmR:5,LegL:6,LegR:7};   // arms raised to steady the basket on the head
 const shoulder=farmerArt.ArmL?farmerArt.ArmL.pivot.clone():new V3(.3,1.2,0),hands=farmerArt.anchors['Mitten hand'];
 const handL=(hands?hands.getCenter(new V3()):new V3(0,.75,.1)).setX(shoulder.x*1.12);   // the left hand at rest
 farmerArt.main.geometry.computeBoundingBox();const HEAD_TOP=Math.max(1.6,farmerArt.Head?(()=>{const g=farmerArt.Head.geometry;g.computeBoundingBox();return g.boundingBox.max.y+farmerArt.Head.pivot.y})():1.86);
 const BASKET_EGGS=basketEggs(new V3());
 const headAt=farmerArt.Head?farmerArt.Head.pivot:new V3(0,1.3,0);
 const crew=(()=>{const list=[];
  for(const [name,part] of Object.entries(farmerArt)){if(name==='anchors')continue;const g=part.geometry.clone();g.translate(part.pivot.x,part.pivot.y,part.pivot.z);list.push([g,part.pivot,FBONE[name]??0])}
  const geo=merge(list.map(([g,p,bone])=>{const n=g.attributes.position.count,R=new Float32Array(n*4);for(let i=0;i<n;i++){R[i*4]=p.x;R[i*4+1]=p.y;R[i*4+2]=p.z;R[i*4+3]=bone}g.setAttribute('aRig',new THREE.BufferAttribute(R,4));return g}));
  const r=rigMesh(geo,rigMaterialAt([headAt.x,headAt.y,headAt.z],.82),MAXF,true);r.mesh.castShadow=false;r.mesh.receiveShadow=true;return r})();
 const baskets=instanced(basketGeometry(new V3()),MAXF,false);
 const RANGE=[[0,1],[.5,1],[0,1],[0,1],[0,.5],[0,1],[0,1],[0,1],[.25,.75],[0,1]],OFF=[0,.6,-.5,-.6,-.6,0,.6,.6,-.2,0];   // where in its zone each farmer strolls
 const farmers=Array.from({length:MAXF},(_,k)=>{const a=proxy(1);a.hide=false;a.x=FARM_HOME[k][0];a.z=FARM_HOME[k][1];
  return {k,a,on:k===0,limb:[0,0,0,0],nod:0,eggs:0,up:0,tx:a.x,tz:a.z,wait:.5+k*.55,job:null,off:OFF[k],range:RANGE[k]}});
 const farmerShade=shadowOnly(solid([['cyl',0,[0,.55,0],[.27,1.0,.22]],['sphere',0,[0,1.32,.02],[.36,.34,.33]],['cyl',0,[0,1.62,0],[.5,.07,.5]]]),MAXF);
 const ECAP=MAXF*BASKET+NEST_MAX+72,eggMesh=instanced(solid([['egg',0xfff6e2,[0,0,0],[1,1.3,1]]]),ECAP,false),EGG_TINT=[new THREE.Color(1,1,1),new THREE.Color(.98,.88,.74),new THREE.Color(1,.95,.86)];
 for(let i=0;i<ECAP;i++)eggMesh.setColorAt(i,EGG_TINT[i%3]);
 let nestShown=0,lastLeft=0;const nestPop=new Array(NEST_MAX).fill(-9);
 /* ----- 0.13 flowing farm (world.flow, only while the page runs it): golden eggs lie beside the hens (two each) and in the nests, each farmer
    carries one egg at a time to the market along his work slot, runs while the 신바람 boost lasts, and an idle farmer walks to a fallen fence
    side and hammers it up while the world's 15 s rebuild counts down (looks only: the rule is unchanged). No new art. ----- */
 let flowS=null,yardDrawn=0,repairers=0,runners=0;
 const GOLD_EGG=new THREE.Color(1.0,.82,.36),EGG_OFF=[[.36,.14],[-.34,.2],[.04,.4]],eggSeen=new Map(),eggLive=new Set(),hammerMarks=[];
 const eggSpot=(slot,i,out)=>{if(slot<0){const s=NEST_SPOTS[i%NEST_SPOTS.length];return out.set(s[0],s[1]-.03,s[2])}const h=W('HOME')(slot),o=EGG_OFF[Math.min(2,i)];return out.set(h[0]+o[0],.02,h[1]+o[1])};
 const eggBig=()=>clamp(fxScale,1,1.45);   // eggs grow with the zoomed-out view so they still read on a phone
 const flowLv=()=>flowS&&flowS.boost&&num(flowS.boost.left)>0?clamp(flowS.boost.lv|0,0,2):0;
 const flowSlot=f=>flowS&&flowS.slots[f.k]&&typeof flowS.slots[f.k]==='object'?flowS.slots[f.k]:null;
 const SHADE_FIT={boar:new V3(1.12,.74,1.02)};   // the stand-in has wolf proportions; the boar is lower and wider
 // 0.15 GLB animals: stretch the stand-in to the model's own bounding box (they are longer, with a bigger head, than the wolf it was made for)
 {const g=shade.mesh.geometry;g.computeBoundingBox();const s=g.boundingBox.getSize(new V3());for(const k in beast)SHADE_FIT[k]=beast[k].size.clone().divide(s)}
 const arrowMesh=instanced(G.arrow,240,false);
 const malletGeo=solid([['cyl',0x9a6a3a,[0,.45,0],[.06,.9,.06]],['cyl',0xc98f52,[0,.95,0],[.2,.5,.2],[0,0,Math.PI/2]],['cyl',0x8a5a2e,[.26,.95,0],[.21,.04,.21],[0,0,Math.PI/2]],['cyl',0x8a5a2e,[-.26,.95,0],[.21,.04,.21],[0,0,Math.PI/2]]]);
 const mallets=[];

 /* ----- effect engine: dt-driven tweens + pooled sprites + camera shake ----- */
 const flatPool=makePool(atlas,520,true),airPool=makePool(atlas,1500,false);world.add(flatPool.mesh,airPool.mesh);
 const particles=[],anims=[],MAX_PARTICLES=620;
 let shakeAmp=0,shakeAge=9,shakeNow=0,time=0,wclock=0;
 const DEFAULTS={cell:CELL.dust,flat:false,x:0,y:0,z:0,vx:0,vy:0,vz:0,gravity:0,drag:0,age:0,life:.6,delay:0,size:.5,end:-1,aspect:1,rot:0,spin:0,color:WHITE,alpha:1,add:0,fade:.5,pop:.1,fps:0,floor:false,abs:false};
 function emit(o){if(reduced()||particles.length>=MAX_PARTICLES)return;particles.push({...DEFAULTS,...o})}
 // `update(u,t)` only writes transient pose channels; `done()` finalises state, so skipping straight to done is always safe.
 function tween(delay,dur,update,done){if(reduced()){done?.();return}anims.push({t:-delay,dur,update,done})}
 const after=(delay,fn)=>tween(delay,0,null,fn);
 function shake(amp){if(reduced())return;if(amp>=shakeNow){shakeAmp=amp;shakeAge=0;shakeNow=amp}}
 const EYE=new V3().copy(EYE_DIR).multiplyScalar(EYE_DIST),FOCUS=new V3();let focusHalf=0;   // FOCUS/focusHalf: close-up (VillageView.focus / debug); focusHalf 0 = normal view
 const KING_WAIT_PULL=.2;   // waiting king (bell open, 0.13.1): a gentler lean so he is not cut off at the edge of the view
 const KING_PULL=.28;   // finale: how far the view centre moves toward the wolf king (fraction of his distance)
 function stepEffects(dt){
  for(let i=0;i<anims.length;){const a=anims[i];a.t+=dt;if(a.t<0){i++;continue}
   if(a.update&&a.dur>0)a.update(Math.min(1,a.t/a.dur),Math.min(a.t,a.dur));
   if(a.t>=a.dur){anims.splice(i,1);a.done?.()}else i++}
  for(let i=particles.length-1;i>=0;i--){const p=particles[i];if(p.delay>0){p.delay-=dt;continue}
   p.age+=dt;if(p.age>=p.life){particles[i]=particles[particles.length-1];particles.pop();continue}
   p.vy-=p.gravity*dt;if(p.drag){const k=Math.exp(-p.drag*dt);p.vx*=k;p.vy*=k;p.vz*=k}
   p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.rot+=p.spin*dt;
   if(p.floor&&p.y<.08&&p.vy<0){p.y=.08;p.vy*=-.42;p.vx*=.6;p.vz*=.6;p.spin*=.5}
  }
  shakeAge+=dt;shakeNow=shakeAge<.28?shakeAmp*(1-shakeAge/.28)**2:0;
  const k=Math.max(1,camHalf/7);   // the shake grows with the view so it still reads when zoomed out
  camera.position.copy(EYE).add(FOCUS).addScaledVector(camRight,Math.sin(shakeAge*78)*shakeNow*k).addScaledVector(camUp,Math.cos(shakeAge*61)*shakeNow*.8*k);
 }
 let sale=null,popUntil=-9;         // sale: the produce sequence currently playing (effects clock); popUntil: reduced-motion still frame
 function clearEffects(){for(const a of anims.splice(0))a.done?.();particles.length=0;shakeNow=0;shakeAge=9;camera.position.copy(EYE).add(FOCUS);sale=null}
 function drawParticles(){
  for(const p of particles){if(p.delay>0)continue;
   const u=p.age/p.life,size=(p.end<0?p.size:p.size+(p.end-p.size)*easeOut(u))*(p.pop>0?Math.min(1,u/p.pop):1)*(p.abs?1:fxScale),alpha=p.alpha*(u<p.fade?1:1-(u-p.fade)/(1-p.fade));
   const cell=p.fps?p.cell+Math.floor(p.age*p.fps)%4:p.cell;
   (p.flat?flatPool:airPool).push(p.flat?lying:facing,p.x,p.y,p.z,size,size*p.aspect,p.rot,cell,p.color[0],p.color[1],p.color[2],alpha,p.add);
  }
 }
 const sprite=(cell,x,y,z,sx,sy,color,alpha=1,add=0,rot=0)=>airPool.push(facing,x,y,z,sx,sy,rot,cell,color[0],color[1],color[2],alpha,add);
 const decal=(cell,x,z,size,color,alpha=1,add=0,y=.07)=>flatPool.push(lying,x,y,z,size,size,0,cell,color[0],color[1],color[2],alpha,add);
 // A ground point clamped into the visible frame (for cues about things happening off screen).
 const ndc=new V3(),camFwd=new V3();
 function onScreen(x,z,m=.84){ndc.set(x,0,z).project(camera);if(Math.abs(ndc.x)<=m&&Math.abs(ndc.y)<=m)return {x,z,inside:true};
  ndc.set(clamp(ndc.x,-m,m),clamp(ndc.y,-m,m),-1).unproject(camera);camera.getWorldDirection(camFwd);const t=-ndc.y/camFwd.y;return {x:ndc.x+camFwd.x*t,z:ndc.z+camFwd.z*t,inside:false}}

 /* ----- reusable effect pieces ----- */
 function dustBurst(x,z,n=10,power=1,delay=0){for(let i=0;i<n;i++){const a=i/n*6.283+span(-.25,.25),v=span(1.7,2.9)*power;
  emit({cell:CELL.dust,x:x+Math.cos(a)*.25,y:.2,z:z+Math.sin(a)*.25,vx:Math.cos(a)*v,vy:span(.5,1.3)*power,vz:Math.sin(a)*v,drag:3.4,life:span(.5,.8),size:.3*power,end:span(.75,1.05)*power,rot:span(0,6),spin:span(-1.5,1.5),color:DUST,alpha:.92,fade:.25,delay})}}
 function ringWave(x,z,size,color=WHITE,life=.45,delay=0,cell=CELL.ring,add=.35,y=.07,abs=false){emit({cell,flat:true,x,y,z,size:size*.15,end:size,life,delay,color,add,fade:.3,pop:0,rot:span(0,6),abs})}
 function telegraph(x,z,size,color=GOLD){emit({cell:CELL.halo,flat:true,x,y:.08,z,size:size*1.5,end:size*.55,life:.16,color,add:.6,fade:.75,pop:.25});emit({cell:CELL.glow,flat:true,x,y:.075,z,size:size*.4,end:size*1.2,life:.2,color,add:.8,fade:.4,pop:.2})}
 function sparkles(x,y,z,n,spread,color=GOLD,delay=0,window=.5){for(let i=0;i<n;i++)emit({cell:i%3?CELL.sparkle:CELL.star,x:x+span(-spread,spread),y:y+span(-.2,.5),z:z+span(-spread,spread)*.6,vy:span(.5,1.3),life:span(.6,1),delay:delay+span(0,window),size:span(.22,.4),end:.04,spin:span(-3,3),rot:span(0,3),color:i%4?color:WHITE,add:.55,fade:.4,pop:.2})}
 function starBurst(x,y,z,n,power=1,colors=[GOLD,WHITE],delay=0){for(let i=0;i<n;i++){const a=i/n*6.283+span(-.2,.2),v=span(2.6,4.4)*power,cx=Math.cos(a)*v,cy=Math.sin(a)*v;
  emit({cell:CELL.star,x,y,z,vx:camRight.x*cx+camUp.x*cy,vy:camRight.y*cx+camUp.y*cy+1.2,vz:camRight.z*cx+camUp.z*cy,gravity:4.5,drag:1.6,life:span(.7,1.05),delay,size:span(.34,.52),end:.12,spin:span(-7,7),rot:span(0,6),color:colors[i%colors.length],add:.3,fade:.55})}}
 function featherBurst(x,y,z,n=9,power=1){for(let i=0;i<n;i++){const a=i/n*6.283+span(-.3,.3),v=span(1.4,2.6)*power,cx=Math.cos(a)*v,cy=Math.sin(a)*v*.8;
  emit({cell:CELL.feather+i%4,x,y,z,vx:camRight.x*cx+camUp.x*cy,vy:camRight.y*cx+camUp.y*cy+1.6,vz:camRight.z*cx+camUp.z*cy,gravity:2.2,drag:2.6,life:span(.9,1.35),size:span(.5,.74)*Math.min(1,power+.25),spin:span(-5,5),rot:span(0,6),color:WHITE,add:.28,fade:.6})}}
 function chipBurst(x,y,z,n=8,colors=[WOOD,CREAM]){for(let i=0;i<n;i++){const a=span(0,6.283),v=span(1,2.4);
  emit({cell:CELL.solid,x,y,z,vx:Math.cos(a)*v,vy:span(3,5.2),vz:Math.sin(a)*v+.6,gravity:13,life:span(.55,.8),size:span(.16,.26),aspect:.38,spin:span(-14,14),rot:span(0,6),color:colors[i%colors.length],fade:.7,floor:true,pop:0})}}
 function flashAt(x,y,z,size,color=WHITE,delay=0){emit({cell:CELL.impact,x,y,z,size:size*.45,end:size,life:.17,delay,color,add:.45,fade:.45,pop:0,rot:span(0,6)});emit({cell:CELL.glow,x,y,z,size:size*.8,end:size*1.7,life:.22,delay,color,add:1,fade:.2,pop:0})}
 function pillar(x,z,height,width,color=GOLD,life=.6,delay=0){for(const [w,a] of [[width,.7],[width*.4,.62]])emit({cell:CELL.glow,x,y:height/2,z,size:w*.6,end:w,aspect:height*.795/w*1.6,life,delay,color:a<.7?WHITE:color,alpha:a,add:1,fade:.3,pop:.18})}
 function risingRings(x,z,height,size,color=GOLD,n=3,delay=0){for(let i=0;i<n;i++)emit({cell:CELL.ring,flat:true,x,y:.15,z,vy:height/.5,life:.5,delay:delay+i*.09,size:size*.7,end:size*(1.15-i*.12),color,add:.5,fade:.5,pop:.15,rot:i*2})}
 function coinPop(x,y,z,vx,vy,vz,delay=0,life=.95){emit({cell:CELL.coin,fps:14,x,y,z,vx,vy,vz,gravity:7,life,delay,size:.2,end:.5,color:WHITE,fade:.72,pop:.12})}
 function confetti(x,y,z,n,spread){const colors=[GOLD,RED,SKY,LEAF,PINK,WHITE];for(let i=0;i<n;i++)emit({cell:CELL.solid,x:x+span(-spread,spread),y:y+span(0,1.5),z:z+span(-spread,spread)*.7,vx:span(-.6,.6),vy:span(-.4,.8),vz:span(-.4,.4),gravity:1.8,drag:1.2,life:span(1.1,1.7),delay:span(0,.5),size:span(.14,.22),aspect:.55,spin:span(-9,9),rot:span(0,6),color:colors[i%colors.length],fade:.7})}
 function splash(x,z,n=10,power=1){for(let i=0;i<n;i++){const a=i/n*6.283+span(-.3,.3);
  emit({cell:CELL.dot,x:x+Math.cos(a)*.25,y:.15,z:z+Math.sin(a)*.25,vx:Math.cos(a)*span(.7,1.7)*power,vy:span(2.4,3.8)*power,vz:Math.sin(a)*span(.5,1.1)*power,gravity:11,life:span(.45,.7),size:span(.1,.16),color:i%3?SKY:WHITE,fade:.6,pop:0})}}
 function smokeBurst(x,y,z,n=8){for(let i=0;i<n;i++)emit({cell:CELL.glow,x:x+span(-.5,.5),y:y+span(0,.6),z:z+span(-.4,.4),vx:span(-.3,.3),vy:span(.8,1.6),vz:span(-.3,.3),drag:1.2,life:span(1,1.6),size:span(.5,.8),end:span(1.4,2),color:SOOT,alpha:.7,fade:.3,pop:.15})}
 // Fire-arrow blast ("펑"): flash, fireball, a ring as wide as the blast, sparks, embers, dust and a scorch mark that fades.
 // When many go off at once only the flash, ring and scorch play, so a phone does not choke on a big volley.
 const booms=[],scorches=[];let boomTotal=0;
 function boom(x,z,r,hits){
  boomTotal++;const lite=booms.filter(b=>time-b.t0<.15).length>=3||booms.filter(b=>time-b.t0<.6).length>=10;
  booms.push({x,z,r,t0:time,lite});if(booms.length>32)booms.shift();
  // No scorch on the fence line: towers shoot fence-smashing wolves first, so blasts land on the fence and the burn mark read as
  // "the fire arrow hurt my fence" (it never does, world.js burst only hits wolves). 0.10.1
  if(Math.abs(Math.hypot(x,z)-Rd)>Math.max(.9,r)+.6){if(scorches.length>=28)scorches.shift();scorches.push({x,z,r:Math.max(.9,r),t0:time,rot:span(0,6.283)})}
  const s=Math.max(.8,r);
  flashAt(x,.55,z,1.2+s*.8,EMBER);ringWave(x,z,r*2.5,ORANGE,.42,0,CELL.ring,.65,.08,true);
  if(lite)return;
  emit({cell:CELL.glow,x,y:.5,z,size:s*1.1,end:s*2.3,life:.16,color:WHITE,add:1,fade:.1,pop:0,abs:true});
  for(let i=0;i<5;i++){const a=i/5*6.283+span(-.3,.3),d=span(.1,.35)*s;emit({cell:CELL.glow,x:x+Math.cos(a)*d,y:span(.3,.6),z:z+Math.sin(a)*d,vx:Math.cos(a)*.7,vy:span(1,1.8),vz:Math.sin(a)*.7,drag:2.4,life:span(.38,.55),size:.5*s,end:span(1.1,1.5)*s,color:i%2?FIRE:ORANGE,add:.9,fade:.25,pop:.12,abs:true})}
  for(let i=0;i<3;i++)emit({cell:CELL.glow,x:x+span(-.3,.3)*s,y:.7,z:z+span(-.3,.3)*s,vy:span(.7,1.1),drag:1.2,life:span(.9,1.3),delay:.16,size:.6*s,end:1.5*s,color:ASH,alpha:.5,fade:.35,pop:.2,abs:true});
  for(let i=0;i<8;i++){const a=i/8*6.283+span(-.3,.3),v=span(2.6,4.2);emit({cell:i%2?CELL.sparkle:CELL.star,x,y:.45,z,vx:Math.cos(a)*v,vy:span(2.2,3.6),vz:Math.sin(a)*v,gravity:9,drag:.8,life:span(.45,.7),size:span(.18,.3),end:.05,spin:span(-8,8),color:i%3?EMBER:WHITE,add:.7,fade:.45,pop:0})}
  for(let i=0;i<5;i++)emit({cell:CELL.dot,x:x+span(-.4,.4)*s,y:span(.3,.9),z:z+span(-.4,.4)*s,vx:span(-.6,.6),vy:span(.6,1.6),vz:span(-.6,.6),gravity:-.4,drag:1.5,life:span(.8,1.3),delay:span(0,.2),size:span(.06,.1),end:.02,color:EMBER,add:.9,fade:.5,pop:0});
  dustBurst(x,z,5,.6*s);if(hits>2)shake(.04);
 }
 // A heavy foot or a charging boar hitting the ground: a dust ring and a puff.
 function stomp(x,z,size,big){ringWave(x,z,(big?2.8:1.9)*size,DUST,.4,0,CELL.halo,.25);dustBurst(x,z,big?7:4,.7*size)}
 // A monster falls: dust and stars where it lands (the king goes out with a bang).
 function poof(x,z,size,boss){dustBurst(x,z,boss?16:7,(boss?1.3:.8)*Math.min(1.4,size));starBurst(x,.7*size,z,boss?14:6,boss?1.1:.7,boss?[GOLD,ORANGE,WHITE]:[GOLD,WHITE]);
  if(boss){flashAt(x,1,z,4.2,ORANGE);ringWave(x,z,8,GOLD,.6);ringWave(x,z,5.5,WHITE,.42,.08,CELL.halo,.6);sparkles(x,1.3,z,12,1.4,GOLD,.1,.6);for(let i=0;i<10;i++)emit({cell:CELL.dot,x:x+span(-.8,.8),y:span(.4,1.4),z:z+span(-.8,.8),vx:span(-.8,.8),vy:span(1,2.4),vz:span(-.8,.8),gravity:-.3,drag:1.2,life:span(1,1.6),size:span(.08,.13),end:.02,color:EMBER,add:.9,fade:.5,pop:0});shake(.15)}}
 // Pose helpers: all additive, so overlapping builds simply stack.
 function wobble(a,amp=.1,delay=0,dur=.55){tween(delay,dur,(u,t)=>{const w=settle(t,23,6.5)*amp;a.tilt+=Math.sin(t*23)*amp*Math.exp(-6.5*t);a.sy*=1-w*.6;a.sx*=1+w*.4})}
 function hop(a,height=.5,delay=0,dur=.36,turn=0){tween(delay,dur,u=>{a.lift+=4*height*u*(1-u);a.spin+=turn*easeOut(u);const land=u>.8?(u-.8)/.2:0,rise=u<.15?1-u/.15:0;a.sy*=1-.18*Math.sin(land*Math.PI)-.12*rise;a.sx*=1+.14*Math.sin(land*Math.PI)+.08*rise},()=>{a.ry+=turn})}
 function leap(a,u,h){a.lift+=4*h*u*(1-u);const land=u>.82?Math.sin((u-.82)/.18*Math.PI):0;a.sy*=1-.2*land;a.sx*=1+.15*land}
 function popIn(a,T,dur=.75){tween(0,T+dur,(u,t)=>{if(t<T){a.sx*=.001;a.sy*=.001;return}const k=Math.max(.001,springy(t-T));a.sx*=k;a.sy*=k})}
 const yardHens=()=>henSlots.filter(c=>c.on&&c.h&&(c.h.state==='yard'||c.h.state==='home'));
 function startle(x,z,radius,power=1,skip=null){
  for(const c of yardHens()){const a=c.a;if(a===skip)continue;const d=Math.hypot(a.x-x,a.z-z);if(d<radius)hop(a,(.25+.3*(1-d/radius))*power,d*.03,.34)}
  for(const f of farmers)if(f.on&&!f.job&&Math.hypot(f.a.x-x,f.a.z-z)<radius)hop(f.a,.22*power,.05,.3);
 }
 function rattle(x,z,radius,amp=.1,skip=null){
  for(const s of BUILDINGS){const a=s.a;if(a===skip||!s.on)continue;const d=Math.hypot(a.x-x,a.z-z);if(d<radius)wobble(a,amp*(1-d/radius*.7),d*.035)}
 }

 host.prepend(canvas);new ResizeObserver(resize).observe(host);

 /* ----- what the village shows (persistent) ----- */
 let frames=0,dirty=true,lastRepair=null,sunDim=0;
 // Economy-only parts (not in the world simulation): hired farmers, pond, hall decor, feast bunting.
 const KEYS={farmer:'farmers',pond:'pond',hall:'hall',feast:'feast'},ECON={farmers:MAXF-1,pond:3,hall:3,feast:99};
 const shown={farmers:0,pond:0,hall:0,feast:0},silent={},builds={tower:0,fence:0,chicken:0,farmer:0,pond:0,hall:0,feast:0,repair:0,power:0,stage:0};
 let powerShown=-1,powerAt=-9;   // tower power tier on the crossbows (0-3) and when it last went up
 const pending={tower:-9,fence:-9,chicken:-9,hall:-9};
 // Market by hall stage: 0 stall · 1 roofed shop · 2 tent market · 3 big market (heights/sizes for effects and the repair hint)
 const MARKET_TIER=[{height:1.7,size:1.4},{height:2.6,size:1.6},{height:2.6,size:1.6},{height:2.6,size:1.6}];   // the street (hall 2+) is in the stage props
 function setMarketTier(t){t=clamp(t|0,0,3);if(market.mtier===t)return false;market.mtier=t;market.a.obj.geometry=G.market[t];Object.assign(market,MARKET_TIER[t]);return true}
 function setProps(n){n=clamp(n|0,0,3);if(propsStage===n)return false;propsStage=n;props.geometry=G.props[n];return true}
 const APPLY={
  farmers:n=>farmers.forEach((f,k)=>{const on=k<=n;if(on&&!f.on){f.a.x=f.tx=FARM_HOME[k][0];f.a.z=f.tz=FARM_HOME[k][1]}f.on=on}),
  pond:n=>{pond.obj.visible=n>0;pond.s=POND_R[n]||.001},
  hall:n=>{hay.obj.visible=n>=2;home.a.s=1+n*.07;setMarketTier(n);setProps(n)},
  feast:n=>garlands.forEach((g,i)=>{g.obj.visible=n>i})};
 // 0.9 hands over farmersTotal (1 + hired); 0.8 only the hired count
 const econ=(s,key)=>key==='farmers'&&Number.isFinite(Number(s.farmersTotal))?count(Number(s.farmersTotal)-1,ECON.farmers):count(s[key],ECON[key]);
 // Numbers that change without a build() call (saved game, reset) are simply shown: no effects.
 function syncEconomy(s,first=false){
  let changed=false,drop=false;const next={};
  for(const key in APPLY){next[key]=econ(s,key);if(next[key]!==shown[key]){changed=true;if(next[key]<shown[key])drop=true}}
  if(!first&&!changed)return false;
  if(drop)clearEffects();
  for(const key in APPLY){const v=next[key];if(first||v!==shown[key]){silent[key]=!first&&v===shown[key]+1?time:-9;shown[key]=v;APPLY[key](v)}}
  return true;
 }
 // 0.14 stage and open roads (pulled like the economy numbers; the page calls build('stage') right after a stage went up to play the rise).
 // Without a stage in the state (stages switched off, or an old page) nothing is shown and the eight 0.13 trails stay.
 const stageOf=s=>Number.isInteger(s.stage)?clamp(s.stage,-1,5):-1,routesOf=s=>Array.isArray(s.routes)&&s.routes.length?s.routes.slice(0,8):null;
 function syncStage(s,fx=false){
  const routes=routesOf(s);let changed=setTrails(routes);
  if(setStage(stageOf(s),radiusOf(s,s.world),routes,fx,!!s.river))changed=true;
  return changed;
 }
 function buildStage(){             // a new stage: the new houses and gate posts rise with dust and stars, the new village edge lights up
  const R=radiusOf(curS,curS.world);
  stageInfo.spots.forEach(([x,z,h],i)=>{const d=.18+Math.min(.5,i*.05);after(d,()=>{dustBurst(x,z,8,1);starBurst(x,h,z,8,.8,[GOLD,WHITE,SKY])});after(d+.25,()=>sparkles(x,h*.7,z,5,.6,GOLD,0,.4))});
  after(.15,()=>{shake(.08);ringWave(0,0,R*2.5,GOLD,.9,0,CELL.halo,.45,.08,true);ringWave(0,0,R*2.45,WHITE,.7,.1,CELL.ring,.3,.08,true)});
  yardHens().forEach((c,i)=>hop(c.a,.3,.2+i*.03,.34));
 }
 // Tower power tier: swaps the crossbow model (brazier, pennant, triple bow). The flare plays only for a bought upgrade.
 function syncPower(s,fx){
  const p=count(s.power,3);if(p===powerShown&&!fx)return false;powerShown=p;
  for(const t of towers)t.tier=p;bows.geometry=G.crossbow[p];
  if(fx)powerUp();return true;
 }

 /* ----- pulling the world: records for buildings, hens, wolves and arrows; positions blend between simulation ticks ----- */
 let wRef=null,lastT=0,blendT=1,blendDur=.1,blendTicks=0,blendEase=false,sinceTick=1,stamp=0,initial=true;
 const bById=new Map(),towerById=new Map(),smashOn=new Map(),henById=new Map(),henCarrier=new Map(),wolfVis=new Map(),arrowVis=new Map(),gone=new Map();
 const sideOf=b=>Number.isInteger(b.side)&&b.side>=0&&b.side<6?sides[b.side]:null;
 const slotOf=b=>b.kind==='coop'?home:b.kind==='market'?market:b.kind==='nursery'?nursery:b.kind==='barn'?barn:b.kind==='tower'?(Number.isInteger(b.slot)&&b.slot>=0?towers[b.slot]:null)||null:b.kind==='fence'?sideOf(b):null;
 const pendKey=k=>k==='tower'?'tower':k==='fence'?'fence':k==='nursery'||k==='barn'?'hall':null;
 // Tower floors: world.js gives `floor` = storeys (1 = the plain tower); every storey above the first is a stone drum under it.
 const extraFloors=b=>{const f=Number(b.floor);return Number.isFinite(f)&&f>=1?clamp(Math.floor(f)-1,0,MAX_FLOORS):0};
 const layerOf=b=>clamp(Number.isFinite(Number(b.layer))?Math.floor(Number(b.layer)):1,1,3);
 function syncRecords(s,volley=false){
  const real=s&&s.world&&typeof s.world==='object'&&Array.isArray(s.world.buildings)?s.world:null,w=real||fakeWorld(s);
  const init=w!==wRef;
  if(init){wRef=w;lastT=num(w.t);wolfVis.clear();arrowVis.clear();hl.clear();for(const sl of [...BUILDINGS,...sides])sl.id=null;for(const c of henSlots)c.id=null}
  const t=num(w.t);let ticked=false;
  // Ticks that arrive before a frame has drawn (a wrong-answer fast-forward forwarded step by step) add up into one longer bound.
  if(!init&&t!==lastT){let n=t-lastT;lastT=t;sinceTick=0;if(n>0){if(blendT<=1e-4)n+=blendTicks;blendTicks=n;blendDur=n<=2?.1*n:clamp(.12+n*.012,.3,.5);blendEase=n>2;blendT=0;ticked=true}else{blendDur=.1;blendT=1;blendEase=false;ticked=true}}   // rewound (restored save): snap
  market.down=!!(s&&Number(s.marketDown)>0);
  syncBuildings(w,init||initial);syncWolves(w,ticked);syncHens(w,init||initial,ticked);syncArrows(w,volley);
  Rgoal=radiusOf(s||IDLE,w);initial=false;
  flowS=real&&s.flow&&w.flow&&typeof w.flow==='object'&&Array.isArray(w.flow.slots)?w.flow:null;
  return w;
 }
 function syncBuildings(w,init){
  bById.clear();towerById.clear();const seen=new Set(),list=Array.isArray(w.buildings)?w.buildings:[];
  // One record per fence side: if the world keeps a building per layer, the strongest standing one speaks for the side.
  const rep=new Map();for(const b of list){if(!b||b.kind!=='fence')continue;const sd=sideOf(b);if(!sd)continue;const o=rep.get(sd);
   if(!o||(!!o.broken)>(!!b.broken)||(!!o.broken)===(!!b.broken)&&layerOf(b)>layerOf(o))rep.set(sd,b)}
  const spare=towers.filter(t=>!list.some(b=>b&&b.kind==='tower'&&slotOf(b)===t));   // places for towers without a usable slot number
  for(const b of list){
   if(!b||typeof b!=='object')continue;let sl=slotOf(b);
   if(b.kind==='tower'&&(!sl||seen.has(sl)))sl=spare.shift()||null;
   if(b.kind==='fence'&&sl&&rep.get(sl)!==b)continue;
   if(!sl||seen.has(sl))continue;seen.add(sl);
   bById.set(b.id,b);if(b.kind==='tower')towerById.set(b.id,sl);
   const fresh=sl.id!==b.id;sl.b=b;
   if(fresh){
    if(sl.a){sl.a.x=num(b.x);sl.a.z=num(b.z)}
    sl.id=b.id;sl.on=true;sl.born=time;sl.fxDone=init;sl.wasBroken=isBroken(sl);sl.brokeAt=sl.wasBroken?-9:sl.brokeAt;if(sl.a)sl.a.obj.visible=true;
    if(sl.kind==='tower'){sl.floors=extraFloors(b);sl.floorFx=true}
    if(sl.kind==='fence'){sl.layer=layerOf(b);sl.layerFx=true}
    const key=pendKey(b.kind);if(!init&&key&&time-pending[key]<2.5){pending[key]=-9;sl.fxDone=true;playBuilt(sl)}
   }
   sl.b=b;if(sl.a){sl.a.x=num(b.x);sl.a.z=num(b.z)}
   if(!fresh&&sl.kind==='tower'){const f=extraFloors(b);if(f!==sl.floors){const up=f>sl.floors;sl.floors=f;   // a bought tower raised this one a storey
     if(up&&!init){sl.floorAt=time;sl.floorFx=false;if(time-pending.tower<2.5){pending.tower=-9;sl.floorFx=true;raiseStorey(sl)}}}}
   if(!fresh&&sl.kind==='fence'){const L=layerOf(b);if(L!==sl.layer){const up=L>sl.layer;sl.layer=L;   // a bought fence thickened this side
     if(up&&!init){sl.layerAt=time;sl.layerFx=false;if(time-pending.fence<2.5){pending.fence=-9;sl.layerFx=true;hammerFence(sl)}}}}
   if(sl.kind==='tower')sl.height=TOWER_H+sl.floors*STOREY_H;
   const br=isBroken(sl);if(!init){if(br&&!sl.wasBroken)brokenFx(sl);else if(!br&&sl.wasBroken)repairFx(sl)}
   sl.wasBroken=br;
  }
  for(const sl of [...BUILDINGS,...sides])if(!seen.has(sl)&&sl.on){sl.on=false;sl.id=null;sl.b=null;if(sl.a)sl.a.obj.visible=false}
 }
 // a real building counts as broken when the world says so; the market also when the page reports it down (half-price eggs)
 const isBroken=sl=>!!(sl.b&&sl.b.broken)||sl===market&&market.down&&sl.on;
 let insideWolves=0;
 const hl=new Map();   // wolf id -> time its "new monster!" highlight ends
 // king · fox (0.12) are not in World.KINDS: they live in world.king / world.fox, one seat each, and are drawn through the same herd as pseudo-wolves.
 const KIND_FALLBACK={wolf:{size:1,speed:1},bramble:{size:.85,speed:1.3},boar:{size:1.1,speed:.85},granite:{size:1.25,speed:.6},frost:{size:.95,speed:1.7},ember:{size:1.8,speed:.7,boss:true},
  king:{size:3.6,speed:.7,boss:true},fox:{size:1.15,speed:1.6}};
 const kingV={},foxV={},guestV={},extraWolves=[];let guestSparkAt=-9;   // 수첩 MVP: the shiny guest (world.guest) is one more pseudo-wolf, with a slow trail of gold sparkles
 const pseudo=(o,src,kind)=>{o.id=src.id;o.kind=kind;o.x=num(src.x);o.z=num(src.z);o.state=src.state==='flee'||src.state==='leave'?'leave':'walk';o.hp=1;o.max=1;o.target=0;o.hen=0;return o};
 const kindInfo=k=>{const K=W('KINDS');return (K&&K[k])||KIND_FALLBACK[k]||KIND_FALLBACK.wolf};
 const deathEnd=o=>o.K.boss?1.75:1.45;   // seconds of world time the fall + poof + sink takes
 function newWolf(v){
  const x=num(v.x),z=num(v.z),kind=RIG[v.kind]?v.kind:'wolf',K=kindInfo(kind),seed=hash(num(v.id)*.37+1.3);
  const fresh=v.state==='walk'&&Number.isFinite(Number(v.sx))&&Math.hypot(x-num(v.sx),z-num(v.sz))<.35;   // just came out of the forest
  return {id:v.id,kind,K,x,z,fx:x,fz:z,tx:x,tz:z,ry:Math.atan2(-x,-z),state:v.state,deadAge:v.state==='dead'?9:0,hit:0,v,stamp:0,hp:1,
   seed,side:seed>.5?1:-1,size:WS*(K.size||1)*(.95+.1*hash(seed*91.7)),ph:seed*6.283,spd:0,age:fresh?0:9,emerged:!fresh,
   hy:0,phy:0,php:0,phr:0,legs:[0,0,0,0],lift:[0,0,0,0],kx:0,kz:0,kvx:0,kvz:0,ky:0,kvy:0,hitT:-9,tuck:0,roarT:-9,bossAt:-9,atk:-1,landed:false,ghost:false,mat:new THREE.Matrix4()};
 }
 function syncWolves(w,ticked){
  stamp++;henCarrier.clear();smashOn.clear();insideWolves=0;const R=Rgoal,less=reduced();
  extraWolves.length=0;
  if(w.king&&typeof w.king==='object')extraWolves.push(pseudo(kingV,w.king,'king'));
  if(w.fox&&typeof w.fox==='object')extraWolves.push(pseudo(foxV,w.fox,'fox'));
  if(w.guest&&typeof w.guest==='object'){extraWolves.push(pseudo(guestV,w.guest,RIG[w.guest.kind]?w.guest.kind:'wolf'));if(!less&&time-guestSparkAt>.45){guestSparkAt=time;sparkles(num(w.guest.x),1.1,num(w.guest.z),2,.5,GOLD,0,.5)}}
  const pack=Array.isArray(w.wolves)?w.wolves:[];
  for(const v of extraWolves.length?pack.concat(extraWolves):pack){
   if(!v||typeof v!=='object'||v.state==='gone')continue;
   let o=wolfVis.get(v.id);
   if(!o){if(wolfVis.size>=WCAP){let old=null;for(const g of wolfVis.values())if(g.ghost&&(!old||g.deadAge>old.deadAge))old=g;if(!old)continue;wolfVis.delete(old.id)}
    o=newWolf(v);wolfVis.set(v.id,o)}
   else if(ticked){o.fx=o.x;o.fz=o.z;o.tx=num(v.x);o.tz=num(v.z)}
   if(v.state==='dead'&&o.state!=='dead'){o.deadAge=0;o.landed=false}
   o.state=v.state;o.v=v;o.stamp=stamp;o.ghost=false;o.hp=num(v.max)>0?clamp(num(v.hp)/num(v.max),0,1):1;
   if(v.hen&&(v.state==='carry'||v.state==='bite'))henCarrier.set(v.hen,o);
   if(v.state==='smash')smashOn.set(v.target,(smashOn.get(v.target)||0)+1);
   if(v.state!=='dead'&&v.state!=='leave'&&Math.hypot(num(v.x),num(v.z))<R+.5)insideWolves++;
  }
  for(const [id,end] of hl)if(end<time)hl.delete(id);   // highlights that ran out (or whose wolf never showed up)
  let ghosts=0;
  for(const [id,o] of wolfVis)if(o.stamp!==stamp){
   if(o.state==='dead'&&!less&&o.deadAge<deathEnd(o)&&ghosts<10){o.ghost=true;ghosts++;continue}   // the world dropped it mid-fall: finish the fall first (a few at most)
   if(o.state!=='dead')dustBurst(o.x,o.z,4,.5);wolfVis.delete(id);hl.delete(id);
   gone.set(id,{x:o.x,z:o.z});if(gone.size>80)gone.delete(gone.keys().next().value)}   // where it was last seen (for the hen-lost cue)
 }
 function syncHens(w,init,ticked){
  henById.clear();const seen=new Set();
  for(const h of Array.isArray(w.hens)?w.hens:[]){
   if(!h||typeof h!=='object'||h.state==='gone')continue;const c=henSlots[h.slot];if(!c||seen.has(c))continue;seen.add(c);henById.set(h.id,c);
   if(c.id!==h.id){c.id=h.id;c.on=true;c.born=time;c.fxDone=init;const x=num(h.x),z=num(h.z);c.a.x=c.fx=c.tx=x;c.a.z=c.fz=c.tz=z;c.a.ry=c.face;
    if(!init&&time-pending.chicken<2.5){pending.chicken=-9;c.fxDone=true;buildChicken(c)}}
   else if(ticked){c.fx=c.a.x;c.fz=c.a.z;c.tx=num(h.x);c.tz=num(h.z)}
   c.h=h;
  }
  for(const c of henSlots)if(!seen.has(c)&&c.on){c.on=false;c.prevId=c.id;c.id=null;c.h=null;c.a.hide=true}
 }
 function syncArrows(w,volley){
  const live=new Set();
  for(const a of Array.isArray(w.arrows)?w.arrows:[]){
   if(!a||typeof a!=='object')continue;live.add(a.id);let o=arrowVis.get(a.id);
   if(!o){const t=towerById.get(a.tower),from=t?bowWorld(t):{x:num(a.fx),y:TOWER_H*.75,z:num(a.fz)};
    o={id:a.id,a,sx:from.x,sy:from.y,sz:from.z,ex:num(a.fx),ey:.8,ez:num(a.fz),u:0,u0:0,fin:-1,born:time,volley:volley&&num(a.t)>=num(a.total)};arrowVis.set(a.id,o);
    const target=wolfVis.get(a.wolf);if(target){o.ex=target.x;o.ez=target.z}
    if(t){t.aimId=a.wolf;t.aimAt=time}}
   o.a=a;
  }
  for(const o of arrowVis.values())if(!live.has(o.id)&&o.fin<0){o.fin=time;o.u0=o.u}
 }
 const bowWorld=t=>{const a=t.a,off=bowAt[t.art],s=a.s;return {x:a.x+off.x*s,y:(off.y+.32+t.floors*STOREY_H)*s,z:a.z+off.z*s}};
 const towerTop=t=>t.height*t.a.s;

 /* ----- build effects: telegraph -> impact -> afterglow. Final state is set first, so reduced motion is simply "done". ----- */
 function mallet(){let m=mallets.find(m=>!m.busy);if(!m&&mallets.length<3){m=actor(malletGeo,0,0,0,1.8);m.obj.receiveShadow=false;m.obj.visible=false;mallets.push(m)}if(m)m.busy=true;return m}
 const sideMid=(k,R=Rd-FENCE_IN)=>{const a=(k+.5)*Math.PI/3;return {x:Math.cos(a)*R,z:Math.sin(a)*R,a}};
 function hammerFence(side){        // the side springs up panel by panel under a mallet blow
  const {x,z,a}=sideMid(side.side),HIT=.36,R=1.71;
  side.pop=time+.08;
  const swing=t=>t<.24?-.6*easeOut(clamp((t-.12)/.12,0,1)):-.6+(Math.PI/2+.6)*easeIn(clamp((t-.24)/(HIT-.24),0,1));
  telegraph(x,z,3.2);
  const m=reduced()?null:mallet();
  if(m){const ry=Math.PI-a;m.ry=ry;m.x=x+Math.cos(ry)*R;m.y=1.21;m.z=z-Math.sin(ry)*R;m.obj.visible=true;   // stands inside the ring and swings outward onto the side
   tween(0,.62,(u,t)=>{if(t<.12){m.sx*=.001;m.sy*=.001;return}const k=Math.min(1,(t-.12)/.07)*(t>.5?Math.max(.001,1-(t-.5)/.12):1);m.sx*=k;m.sy*=k;
    m.tilt+=t<HIT?swing(t):Math.PI/2-.6*Math.sin(Math.min(1,(t-HIT)/.14)*Math.PI/2)},()=>{m.obj.visible=false;m.busy=false})}
  after(HIT,()=>{flashAt(x,.95,z,2);for(const k of [-.32,0,.32]){const b=a+k*Math.PI/3,R2=Rd-FENCE_IN;dustBurst(Math.cos(b)*R2,Math.sin(b)*R2,6,.9)}chipBurst(x,.75,z,8,side.layer>=3?[STONE,ROCK]:side.layer===2?[WOOD,WOOD,CREAM]:undefined);ringWave(x,z,4.4,WHITE,.4,0,CELL.halo,.55);shake(.12);startle(x,z,3.5,.9)});
  after(HIT+.2,()=>sparkles(x,.8,z,8,1.6,GOLD,0,.6));
 }
 function buildChicken(c){          // pops out in a puff of feathers, hops, spins once, then joins the flock
  const a=c.a,x=a.x,z=a.z,T=.1;a.ry=-.5;
  telegraph(x,z,2,CREAM);
  tween(0,T+1.12,(u,t)=>{
   if(t<T){a.sx*=.001;a.sy*=.001;return}
   const q=t-T,k=Math.max(.001,springy(q))*(1+.55*Math.exp(-3.2*q));a.sx*=k;a.sy*=k;
   if(q<.38)leap(a,q/.38,.95);else if(q<.76){const v=(q-.38)/.38;leap(a,v,.62);a.spin+=6.283*v*v*(3-2*v)}else if(q<1.1)leap(a,(q-.76)/.34,.32);
  });
  after(T,()=>{a.flash=.08;featherBurst(x,.6,z,10);flashAt(x,.5,z,1.5,CREAM);ringWave(x,z,2.6,WHITE,.36,0,CELL.halo,.55)});
  after(T+.38,()=>{dustBurst(x,z,7,.7);ringWave(x,z,2.4,GOLD,.35);shake(.06);startle(x,z,2.6,.8,a);featherBurst(x,.4,z,4,.6)});
  after(T+.76,()=>{dustBurst(x,z,5,.5);sparkles(x,.7,z,7,.6,GOLD,0,.6)});
 }
 function raiseStorey(t){           // every tower place is taken: the bought tower lifts an existing one a storey (stone drum pushes up from below)
  const a=t.a,x=a.x,z=a.z,H=t.height,from=Math.max(.3,(H-STOREY_H)/H),T=.12;
  telegraph(x,z,3,GOLD);
  tween(0,T+.8,(u,tt)=>{if(tt<T){const k=Math.sin(tt/T*Math.PI/2);a.sy*=from*(1-.06*k);a.sx*=1+.06*k;return}const q=tt-T,k=from+(1-from)*Math.max(.001,springy(q));a.sy*=k;a.sx*=1+.08*Math.exp(-8*q)});
  after(T,()=>{a.flash=.1;dustBurst(x,z,12,1.2);ringWave(x,z,4.6,GOLD,.5);ringWave(x,z,3.2,WHITE,.36,0,CELL.halo,.6);chipBurst(x,.5,z,8,[STONE,ROCK,WOOD]);shake(.12);rattle(x,z,5,.08,a);startle(x,z,4)});
  after(T+.22,()=>{starBurst(x,H*1.05,z,12,1,[GOLD,WHITE,SKY]);risingRings(x,z,H*1.05,2.2,GOLD,3)});
  after(T+.35,()=>sparkles(x,H*.75,z,10,1,GOLD,0,.7));
 }
 function raiseTower(t){            // a new arrow tower erupts out of the ground
  const a=t.a,x=a.x,z=a.z,H=t.height,T=.14;
  telegraph(x,z,3.4);emit({cell:CELL.ring,flat:true,x,y:.09,z,size:4.4,end:1.2,life:T+.03,color:GOLD,add:.5,fade:.8,pop:.3});
  tween(0,T+.75,(u,tt)=>{if(tt<T){a.sx*=.001;a.sy*=.001;return}const q=tt-T,k=Math.max(.001,springy(q)),e=Math.exp(-9*q);a.sy*=k*(1+.32*e);a.sx*=k*(1-.2*e)});
  after(T,()=>{a.flash=.1;pillar(x,z,5.2,1.7);risingRings(x,z,H*1.15,2.3);dustBurst(x,z,12,1.2);ringWave(x,z,5,GOLD,.5);ringWave(x,z,3.6,WHITE,.36,0,CELL.halo,.6);shake(.14);rattle(x,z,5.5,.1,a);startle(x,z,4.6)});
  after(T+.17,()=>starBurst(x,H*1.2,z,12,1,[GOLD,WHITE,SKY]));
  after(T+.3,()=>sparkles(x,H*.7,z,10,1,GOLD,0,.7));
 }
 function popBuilding(sl){          // a new village building (nursery, barn) springs up
  const a=sl.a,x=a.x,z=a.z,T=.12;
  telegraph(x,z,3.4);popIn(a,T,.85);
  after(T,()=>{a.flash=.1;dustBurst(x,z,12,1.1);ringWave(x,z,4.6,GOLD,.45);ringWave(x,z,3.4,WHITE,.36,0,CELL.halo,.55);shake(.08);startle(x,z,3.5)});
  after(T+.2,()=>{starBurst(x,sl.height*a.s,z,10,.9,[GOLD,WHITE,SKY]);sparkles(x,1.2,z,8,1)});
 }
 function playBuilt(sl){if(sl.kind==='tower')raiseTower(sl);else if(sl.kind==='fence')hammerFence(sl);else popBuilding(sl)}
 function repairFx(sl){             // a repaired building (or fence side) pops back up, good as new
  if(sl.kind==='fence'&&sl.b&&num(sl.b.hp)<num(sl.b.max)){rebuildFence(sl);return}   // the world put it back up by itself (half strength)
  lastRepair={sl,t:time};
  if(sl.kind==='fence'){const {x,z}=sideMid(sl.side);sl.pop=time+.04;telegraph(x,z,3,LEAF);
   after(.2,()=>{flashAt(x,.9,z,1.8);dustBurst(x,z,8,.9);ringWave(x,z,4,GOLD,.45);sparkles(x,.9,z,10,1.6,GOLD,0,.6)});return}
  const a=sl.a,x=a.x,z=a.z,H=sl.height*a.s,T=.12;
  telegraph(x,z,3,LEAF);popIn(a,T,.85);
  after(T,()=>{a.flash=.1;pillar(x,z,H*1.8,1.6,LEAF);dustBurst(x,z,10,1);ringWave(x,z,4.4,GOLD,.45);ringWave(x,z,3.4,WHITE,.36,0,CELL.halo,.55);shake(.08);startle(x,z,3.5)});
  after(T+.2,()=>sparkles(x,H*.7,z,10,1.1,GOLD,0,.7));
 }
 function rebuildFence(sl){         // the farmers stand a fallen fence side back up after 15 s: a mallet knocks it in, panels spring up
  const {x,z,a}=sideMid(sl.side),HIT=.3,R=1.71;sl.rebuiltAt=time;
  if(sl.fixer&&sl.fixing){sl.fixer.fix=null;sl.fixer=null;sl.fixing=false;dustBurst(x,z,5,.6);ringWave(x,z,3.4,LEAF,.4,0,CELL.halo,.5);sparkles(x,.8,z,8,1.4,LEAF,.05,.5);return}   // 0.13: a farmer hammered it up panel by panel
  sl.pop=time+(reduced()?0:HIT);
  const m=reduced()?null:mallet();
  if(m){const ry=Math.PI-a;m.ry=ry;m.x=x+Math.cos(ry)*R;m.y=1.21;m.z=z-Math.sin(ry)*R;m.obj.visible=true;
   tween(0,.55,(u,t)=>{const k=Math.min(1,t/.08)*(t>.44?Math.max(.001,1-(t-.44)/.11):1);m.sx*=Math.max(.001,k);m.sy*=Math.max(.001,k);
    m.tilt+=t<HIT?-.5+(Math.PI/2+.5)*easeIn(clamp(t/HIT,0,1)):Math.PI/2-.5*Math.sin(Math.min(1,(t-HIT)/.14)*Math.PI/2)},()=>{m.obj.visible=false;m.busy=false})}
  after(reduced()?0:HIT,()=>{dustBurst(x,z,7,.8);chipBurst(x,.7,z,5);ringWave(x,z,3.4,LEAF,.4,0,CELL.halo,.5);sparkles(x,.8,z,6,1.4,LEAF,.05,.5)});
 }
 function powerUp(){                // tower power: every crossbow flares, the brazier lights, rings rise
  powerAt=time;let k=0;
  for(const t of towers){if(!t.on||t.b&&t.b.broken)continue;const p=bowWorld(t),d=k++*.08;
   wobble(t.a,.08,d);after(d,()=>{t.a.flash=.1;flashAt(p.x,p.y,p.z,2,ORANGE);pillar(t.a.x,t.a.z,4.6,1.4,ORANGE,.55);risingRings(t.a.x,t.a.z,towerTop(t)*1.1,2,ORANGE,3);
    for(let i=0;i<8;i++)emit({cell:CELL.flame,x:p.x+span(-.2,.2),y:p.y,z:p.z+span(-.2,.2),vx:span(-.5,.5),vy:span(1.5,2.6),vz:span(-.5,.5),drag:2,life:span(.5,.75),size:.5,end:.15,color:WHITE,add:.8,fade:.4,pop:.1})});
   after(d+.18,()=>starBurst(p.x,p.y+.3,p.z,8,.8,[ORANGE,GOLD,WHITE]))}
  shake(.08);
 }
 function brokenFx(sl){             // smashed: a crunch of planks, dust and smoke
  sl.brokeAt=time;
  const p=sl.kind==='fence'?sideMid(sl.side):{x:sl.a.x,z:sl.a.z},h=sl.kind==='fence'?.6:sl.height*.5;
  flashAt(p.x,h,p.z,2.2,RED);chipBurst(p.x,h,p.z,12);dustBurst(p.x,p.z,14,1.3);smokeBurst(p.x,h,p.z,sl.kind==='fence'?4:9);shake(.1);startle(p.x,p.z,4,1);
 }
 function buildFarmer(k){           // a hired farmer jumps out of a puff, spins once and waves
  const f=farmers[k];if(!f)return;const a=f.a,[x,z]=FARM_HOME[k],T=.1;
  f.on=true;a.x=f.tx=x;a.z=f.tz=z;a.ry=.4;f.wait=1.4;f.job=null;f.eggs=0;
  telegraph(x,z,2.2,CREAM);popIn(a,T,.9);
  tween(T,.5,u=>{leap(a,u,.75);a.spin+=6.283*easeInOut(u)});
  after(T,()=>{a.flash=.08;flashAt(x,1,z,1.6,CREAM);ringWave(x,z,2.8,WHITE,.36,0,CELL.halo,.55);dustBurst(x,z,8,.8)});
  after(T+.5,()=>{dustBurst(x,z,6,.6);shake(.05);sparkles(x,1.7,z,8,.6,GOLD,0,.6);startle(x,z,2.6,.8)});
 }
 function fishJump(delay){          // a fish leaps across the pond
  const r=POND_R[shown.pond]||.62;if(!pond.obj.visible)return;
  tween(delay,.8,u=>{fish.obj.visible=true;fish.x=POND.x+(u-.5)*r*1.1;fish.z=POND.z+.05;fish.lift+=.05+4*1.25*u*(1-u);fish.pitch+=(u-.5)*2.6},()=>{fish.obj.visible=false});
  after(delay,()=>splash(POND.x-r*.55,POND.z,7,.8));
  after(delay+.8,()=>{splash(POND.x+r*.55,POND.z,9,.9);ringWave(POND.x+r*.55,POND.z,1.8,WHITE,.4,0,CELL.halo,.5,.06)});
 }
 function buildPond(n){             // the pond widens with a splash; a fish celebrates
  const x=POND.x,z=POND.z,r0=(POND_R[n-1]||0)/POND_R[n];APPLY.pond(n);
  telegraph(x,z,2.8,SKY);
  tween(0,.85,(u,t)=>{pond.sx*=Math.max(.001,r0+(1-r0)*springy(t))});
  after(.04,()=>{pond.flash=.08;ringWave(x,z,4.6*POND_R[n],SKY,.5,0,CELL.halo,.6,.06);ringWave(x,z,3.2*POND_R[n],WHITE,.42,.12,CELL.halo,.5,.06);splash(x,z,14,1.1);shake(.05)});
  fishJump(.3);after(.4,()=>sparkles(x,.6,z,8,.9,SKY,0,.6));
 }
 function buildHall(n){             // the coop swells, a new building pops in, the market grows a tier, and the village (and the view) grows outward
  const tier0=market.mtier,stage0=propsStage;APPLY.hall(n);const a=home.a,T=.12;
  if(market.mtier!==tier0&&market.on){const m=market.a;popIn(m,.3,.85);after(.3,()=>{m.flash=.1;dustBurst(m.x,m.z,14,1.3);ringWave(m.x,m.z,5.5,GOLD,.5);starBurst(m.x,market.height,m.z,12,1,[GOLD,WHITE,PINK]);confetti(m.x,market.height*.8,m.z,22,2.2)})}
  if(propsStage>stage0){lanterns(propsStage).forEach(([x,z],i)=>after(.45+i*.06,()=>{flashAt(x+.24,LANTERN_TOP,z,1.2,GOLD);sparkles(x,1.2,z,4,.4,GOLD,0,.3)}));
   TENTS.filter(t=>t.stage===propsStage).forEach((t,i)=>after(.35+i*.12,()=>{const [x,z]=t.at;dustBurst(x,z,10,1);ringWave(x,z,4,GOLD,.45);starBurst(x,2.6,z,10,.9,[GOLD,WHITE,PINK]);confetti(x,2.4,z,14,1.6)}))}   // the market street grows
  telegraph(a.x,a.z,3.8);
  tween(0,T+.75,(u,t)=>{if(t<T){const k=Math.sin(t/T*Math.PI/2);a.sy*=1-.18*k;a.sx*=1+.1*k;return}const w=settle(t-T,15,5.5);a.sy*=1+.28*w;a.sx*=1-.13*w});
  after(T,()=>{a.flash=.1;pillar(a.x,a.z,5.4,2.4);risingRings(a.x,a.z,3.2,2.8);dustBurst(a.x,a.z+1.2,10,1.1);shake(.1);rattle(a.x,a.z,5,.08,a);startle(a.x,a.z,5)});
  after(T+.2,()=>starBurst(a.x,3.6,a.z,12,1,[GOLD,WHITE,SKY]));
  if(n===2){popIn(hay,.34);after(.34,()=>{hay.flash=.1;dustBurst(hay.x,hay.z,10,1);ringWave(hay.x,hay.z,4,GOLD,.45);sparkles(hay.x,1.2,hay.z,8,.9)})}
  const fresh=[nursery,barn].find(sl=>sl.on&&!sl.fxDone&&time-sl.born<2.5);
  if(fresh){fresh.fxDone=true;popBuilding(fresh)}else if(n===1||n===3)pending.hall=time;
  after(.3,()=>{ringWave(0,0,Rgoal*2.5,GOLD,.9,0,CELL.halo,.45,.08,true);ringWave(0,0,Rgoal*2.45,WHITE,.7,.1,CELL.ring,.3,.08,true)});   // the new village edge lights up as the forest steps back
 }
 function buildFeast(n){            // bunting snaps up, confetti rains and everybody hops
  APPLY.feast(n);const g=garlands[n===2?1:0],x=g.x,y=g.y,z=g.z;
  if(n<=2)popIn(g,.08,.7);else{wobble(garlands[0],.08);wobble(garlands[1],.08,.06)}
  after(.08,()=>{g.flash=.1;flashAt(x,y,z,2.4,PINK);starBurst(x,y+.3,z,14,1,[GOLD,PINK,SKY,LEAF]);confetti(x,y+.4,z,40,2.6);shake(.07)});
  after(.3,()=>{yardHens().forEach((c,i)=>hop(c.a,.35,i*.05,.34));farmers.forEach((f,k)=>{if(f.on&&!f.job)hop(f.a,.4,k*.07,.36)})});
  after(.45,()=>sparkles(x,y,z,10,1.6,GOLD,0,.7));
 }
 function playEconomy(kind,n){
  if(kind==='farmer')return buildFarmer(n);
  if(kind==='pond')return buildPond(n);
  if(kind==='hall')return buildHall(n);
  if(kind==='feast')return buildFeast(n);
 }
 function nudgeEconomy(kind,n){     // build() for something already shown: a small acknowledgement only
  if(kind==='farmer'&&farmers[n])hop(farmers[n].a,.25);
  else if(kind==='pond'&&n>0)ringWave(POND.x,POND.z,3,SKY,.4,0,CELL.halo,.5,.06);
  else if(kind==='hall')wobble(home.a,.05);
  else if(kind==='feast'&&n>0)confetti(garlands[0].x,garlands[0].y,garlands[0].z,14,2);
 }
 const newest=list=>{let best=null;for(const sl of list)if(sl.on&&(!best||sl.born>best.born||(sl.born===best.born&&(sl.slot??sl.side??sl.i)>(best.slot??best.side??best.i))))best=sl;return best};
 // A world part bought just now: play its effect if the frame loop already showed it, or wait (2.5 s) for the page to add it to the world.
 function buildWorld(kind){
  const list=kind==='tower'?towers:kind==='fence'?sides:henSlots,sl=newest(list);
  if(sl&&!sl.fxDone&&time-sl.born<2.5){sl.fxDone=true;if(kind==='chicken')buildChicken(sl);else playBuilt(sl);return sl}
  // all tower places taken: the purchase raised a tower one storey · all sides fenced: the purchase added a layer to one side
  const grown=kind==='tower'?towers.filter(t=>t.on&&!t.floorFx&&time-t.floorAt<2.5).sort((a,b)=>b.floorAt-a.floorAt)[0]:kind==='fence'?sides.filter(f=>f.on&&!f.layerFx&&time-f.layerAt<2.5).sort((a,b)=>b.layerAt-a.layerAt)[0]:null;
  if(grown){if(kind==='tower'){grown.floorFx=true;raiseStorey(grown)}else{grown.layerFx=true;hammerFence(grown)}return grown}
  pending[kind]=time;if(sl){if(kind==='tower')wobble(sl.a,.06);else if(kind==='chicken')hop(sl.a,.25);else sl.pop=time}
  return sl;
 }
 function spotOf(kind,sl){
  if(kind==='tower'&&sl)return new V3(sl.a.x,sl.height*.55,sl.a.z);
  if(kind==='fence'){const sd=sl||sides.find(f=>!f.on)||sides[0],p=sideMid(sd.side);return new V3(p.x,.45,p.z)}   // no side yet: where the first one goes
  if(kind==='chicken'&&sl)return new V3(sl.a.x,.45,sl.a.z);
  if(kind==='farmer'){const a=farmers[clamp(shown.farmers,0,MAXF-1)].a;return new V3(a.x,1,a.z)}
  if(kind==='pond')return new V3(POND.x,.2,POND.z);
  if(kind==='hall'){const ex=shown.hall>=3&&barn.on?barn:shown.hall===2?{a:hay,height:1}:shown.hall>=1&&nursery.on?nursery:null;return ex?new V3(ex.a.x,1,ex.a.z):new V3(home.a.x,1.5,home.a.z)}
  if(kind==='repair'){const r=lastRepair&&time-lastRepair.t<3?lastRepair.sl:null;if(r&&r.kind==='fence'){const p=sideMid(r.side);return new V3(p.x,.5,p.z)}return r?new V3(r.a.x,r.height*.5,r.a.z):new V3(home.a.x,1.5,home.a.z)}
  if(kind==='feast'){const g=garlands[shown.feast===2?1:0];return new V3(g.x,g.y,g.z)}
  if(kind==='power'){const t=towers.find(t=>t.on);return t?new V3(t.a.x,towerTop(t)*.8,t.a.z):null}
  return null;
 }
 function build(kind){
  if(!(kind in builds))return null;
  builds[kind]++;
  const s=read();syncRecords(s);
  let sl=null;
  if(kind==='tower'||kind==='fence'||kind==='chicken')sl=buildWorld(kind);
  else if(kind==='stage'){curS=s;if(syncStage(s,true))buildStage();dirty=true;const v=new V3(0,2.2,0).project(camera);return {x:clamp((v.x+1)/2,0,1),y:clamp((1-v.y)/2,0,1)}}
  else if(kind==='repair'){if(!(lastRepair&&time-lastRepair.t<2.5))wobble(home.a,.05)}
  else if(kind==='power'){syncPower(s,true)}
  else{
   const key=KEYS[kind],target=econ(s,key),from=shown[key];
   if(target<from)syncEconomy(s);
   else if(target>from){shown[key]=target;for(let n=from+1;n<=target;n++)playEconomy(kind,n)}
   else if(target>0&&time-(silent[key]??-9)<2){silent[key]=-9;playEconomy(kind,target)}   // the frame loop showed it a moment before build() arrived
   else nudgeEconomy(kind,target);
  }
  dirty=true;
  const v=spotOf(kind,sl);if(!v)return null;v.project(camera);
  return {x:clamp((v.x+1)/2,0,1),y:clamp((1-v.y)/2,0,1)};
 }

 /* ----- one-shot effects pushed by the page (persistent state always comes from the pull) ----- */
 const warns=[];
 // The market (and so the counter spots and the coin burst) follows the world's market building.
 const marketShift=()=>({x:market.a.x-WORLD.PLACE.market[0],z:market.a.z-WORLD.PLACE.market[1]});
 const marketFront=()=>{const m=marketShift();return {x:MARKET_FRONT.x+m.x,z:MARKET_FRONT.z+m.z}};
 const coopDoor=()=>{const s=home.a.s;return {x:home.a.x+(door.min.x+door.max.x)/2*s,z:home.a.z+door.max.z*s+.25}};
 // 0.9 produce: hens lay `laid` eggs; the farmers carry the `sold` eggs to the market in baskets of four (as many farmers as needed);
 // `left` eggs stay in the nests by the hall until the next sale. 0.8 sends only `eggs` (= sold, nothing left over).
 function produceFx(e){             // hens lay -> eggs fly into baskets (and the nests) -> farmers run to the market -> coins
  const crewOn=farmers.filter(f=>f.on);
  const laid=count(e.laid??e.eggs,99),sold=count(e.sold??e.eggs,99),left=count(e.left??0,NEST_MAX);
  const nest0=nestShown,fresh=Math.min(laid,sold),fromNest=Math.min(nest0,sold-fresh),kept=nest0-fromNest,toNest=Math.max(0,Math.min(laid-fresh,left-kept));
  sale={t:0,nest0,kept,left};lastLeft=left;
  const carriers=Math.min(crewOn.length,Math.ceil(sold/BASKET)),mk=marketShift(),jobs=[];
  for(const f of crewOn)f.job=null;
  for(let k=0;k<carriers;k++){const f=crewOn[k];
   f.job={fx:f.a.x,fz:f.a.z,px:PICK[k][0],pz:PICK[k][1],gx:MARKET_GATE.x+mk.x,gz:MARKET_GATE.z+mk.z,mx:DROP[k][0]+mk.x,mz:DROP[k][1]+mk.z,lag:k*.03,eggs:clamp(sold-k*BASKET,1,BASKET)};f.wait=0;jobs.push(f.job)}
  const layers=yardHens().map(c=>c.a),pops=Math.min(laid,MAXH),gap=Math.min(.045,.5/Math.max(1,pops)),dr=coopDoor(),toBasket=jobs.length?Math.min(fresh,jobs.length*BASKET):0;
  const fly=(x,y,z,d,tx,ty,tz,arrive)=>{const T=Math.max(.18,arrive-d),g=9;emit({cell:CELL.egg,x,y,z,vx:(tx-x)/T,vy:(ty-y)/T+.5*g*T,vz:(tz-z)/T,gravity:g,life:T,size:.26,end:.3,aspect:1.15,spin:5,color:WHITE,fade:.97,pop:.15})};
  for(let i=0;i<pops;i++){
   const c=layers.length?layers[i%layers.length]:null,d=.04+i*gap+(layers.length&&i>=layers.length?.12:0);
   if(c)tween(d,.42,(u,t)=>{const s=Math.sin(Math.min(1,t/.16)*Math.PI);c.sy*=1-.3*s;c.sx*=1+.2*s;if(t>.16)c.lift+=.28*Math.sin((t-.16)/.26*Math.PI)});
   const j=i<toBasket?jobs[Math.floor(i/BASKET)%jobs.length]:null,ns=!j&&i>=fresh&&i-fresh<toNest?NEST_SPOTS[Math.min(NEST_MAX-1,kept+i-fresh)]:null;
   after(d+.14,()=>{const x=c?c.x:dr.x,z=c?c.z:dr.z;flashAt(x,.6,z,.7,CREAM);
    if(j)fly(x,.5,z,d+.14,j.px,BASKET_UP+.12,j.pz,.64);else if(ns)fly(x,.5,z,d+.14,ns[0],ns[1]+.12,ns[2],.56)});
  }
  for(let k=0;k<fromNest&&jobs.length;k++){   // yesterday's eggs leave the nests first
   const s=NEST_SPOTS[Math.max(0,Math.min(NEST_MAX-1,nest0-1-k))],j=jobs[Math.floor((fresh+k)/BASKET)%jobs.length],d=.12+k*.025;
   after(d,()=>fly(s[0],s[1]+.1,s[2],d,j.px,BASKET_UP+.12,j.pz,.64));
  }
  if((Number(e.fish)||0)>0)fishJump(.12);
  after(.66,()=>{for(const f of crewOn)if(f.job)sparkles(f.a.x,BASKET_UP+.35,f.a.z,3,.3,CREAM,0,.15)});
  after(1.55,()=>{const {x,z}=marketFront(),H=Math.min(2,market.height*.75);wobble(market.a,.1);market.a.flash=.1;flashAt(x,H,z,2.2,GOLD);ringWave(x,z,3.4,GOLD,.45);
   const n=clamp(Math.round(3+(Number(e.gold)||0)/12),4,12);for(let i=0;i<n;i++){const a=i/n*6.283;coinPop(x,H+.2,z,Math.cos(a)*1.3,span(4,5.2),Math.sin(a)*.8,i*.03,1)}
   sparkles(x,H+.6,z,6,1,GOLD,.15,.5);shake(.05)});
  after(1.6,()=>crewOn.forEach((f,k)=>hop(f.a,.38,(k%5)*.05,.34)));
 }
 function fishToMarket(delay){     // 0.13: the pond's fish leaps all the way to the market counter and turns into coins
  if(!pond.obj.visible)return;const {x,z}=marketFront(),H=Math.min(2,market.height*.75);
  tween(delay,.75,u=>{fish.obj.visible=true;fish.x=POND.x+(x-POND.x)*u;fish.z=POND.z+(z-POND.z)*u;fish.lift+=.1+4*2.1*u*(1-u)+H*.6*u;fish.pitch+=(u-.5)*2.4;fish.ry=Math.atan2(x-POND.x,z-POND.z)},()=>{fish.obj.visible=false;fish.ry=Math.PI/2});
  after(delay,()=>splash(POND.x,POND.z,8,.9));
  after(delay+.75,()=>{flashAt(x,H,z,1.2,GOLD);for(let i=0;i<3;i++)coinPop(x,H+.1,z,span(-.8,.8),span(3.4,4.4),span(-.5,.5),i*.04,.8)});
 }
 function cheerFx(e){
  if(reduced())return;
  yardHens().forEach((c,i)=>hop(c.a,.42,(i%6)*.03,.34));
  for(const f of farmers)if(f.on&&!f.trip&&!f.fix)hop(f.a,.3,.05+(f.k%4)*.04,.3);
  if((Number(e.fish)||0)>0)fishToMarket(.1);
  if((e.boost|0)>0)for(const c of yardHens())sparkles(c.a.x,1,c.a.z,(e.boost|0)>=2?3:2,.25,GOLD,.1,.3);
 }
 function towerFire(t,big,fast=false,hot=false){   // recoil + a twang of light at the crossbow (orange once the towers shoot fire arrows)
  if(!t||!t.on||t.b&&t.b.broken)return;t.kick=1;
  if(time-t.shotAt<.12&&!big)return;t.shotAt=time;const p=bowWorld(t),k=fast?1.4:1,fire=hot||t.tier>0;
  emit({cell:CELL.glow,x:p.x,y:p.y,z:p.z,size:(big?.9:.5)*k,end:(big?1.8:.9)*k,life:big?.3:.16,color:fire?ORANGE:big?GOLD:CREAM,add:1,fade:.3,pop:0});
  if(big){flashAt(p.x,p.y,p.z,1.4*k,fire?ORANGE:GOLD);ringWave(t.a.x,t.a.z,2.6*k,fire?ORANGE:GOLD,.4);if(fast){sparkles(p.x,p.y,p.z,5,.5,GOLD,0,.2);ringWave(t.a.x,t.a.z,3.6,WHITE,.36,.06,CELL.halo,.5)}
   tween(0,.3,(u,tt)=>{const s=settle(tt,26,8);t.a.sy*=1-.08*k*s;t.a.sx*=1+.05*k*s})}
 }
 // Visual knock-back: pushes the drawn monster away (the world position stays authoritative; a spring pulls it back).
 function knock(o,dx,dz,power,up=0){if(reduced()||!o)return;const d=Math.hypot(dx,dz)||1,m=power/Math.sqrt(o.K.size||1);o.kvx+=dx/d*m;o.kvz+=dz/d*m;if(up)o.kvy=Math.max(o.kvy,up/Math.sqrt(o.K.size||1))}
 function hitFrom(o){let src=null;for(const a of arrowVis.values())if(a.a.wolf===o.id&&(!src||a.fin>src.fin))src=a;return src?[o.x-src.sx,o.z-src.sz]:[-Math.sin(o.ry),-Math.cos(o.ry)]}
 let redPulse=0;     // a red tint on the sunlight (boss entrance, roar)
 function roarFx(o,ids){
  o.roarT=time;const reach=num((W('ROAR')||{}).reach)||6,m=mouthOf(o,new V3());
  flashAt(m.x,m.y,m.z,2.6,ORANGE);ringWave(o.x,o.z,reach*2.5,FIRE,.75,.1,CELL.ring,.7,.08,true);ringWave(o.x,o.z,reach*2.3,ORANGE,.85,.32,CELL.halo,.55,.08,true);ringWave(o.x,o.z,reach*1.2,EMBER,.5,0,CELL.halo,.7,.08,true);
  for(let i=0;i<10;i++){const a=o.ry+span(-.6,.6),v=span(3,5);emit({cell:i%2?CELL.flame:CELL.dot,x:m.x,y:m.y,z:m.z,vx:Math.sin(a)*v,vy:span(.6,1.6),vz:Math.cos(a)*v,drag:2.2,life:span(.45,.7),size:i%2?.5:.12,end:.1,color:i%2?WHITE:EMBER,add:.9,fade:.4,pop:0})}
  shake(.13);redPulse=Math.max(redPulse,.85);
  ids.forEach((id,i)=>{const t=towerById.get(id);if(!t)return;t.stunAt=time;const d=.22+i*.05;wobble(t.a,.12,d);
   after(d,()=>{const H=TOWER_H*t.a.s;flashAt(t.a.x,H,t.a.z,1.8,ORANGE);smokeBurst(t.a.x,H*.8,t.a.z,4);starBurst(t.a.x,H*1.05,t.a.z,5,.6,[GOLD,WHITE])})});
 }
 function events(list){
  if(!Array.isArray(list))return;const s=read();if(s.paused)return;
  let volley=false;for(const e of list)if(e&&e.type==='volley')volley=true;
  syncRecords(s,volley);
  for(const e of list){if(!e||typeof e!=='object')continue;
   const wolf=wolfVis.get(e.wolf);
   switch(e.type){
    // 0.13 flowing farm: a right answer makes every hen hop (the first egg drops at once), a fish leaps to the market; eggs then come one by one
    case 'cheer':cheerFx(e);millKick(e.boost);break;
    case 'laid':{const c=Number.isInteger(e.slot)&&e.slot>=0?henSlots[e.slot]:null;if(c&&c.on&&!reduced()){const a=c.a;tween(0,.4,(u,tt)=>{const q=Math.sin(Math.min(1,tt/.16)*Math.PI);a.sy*=1-.28*q;a.sx*=1+.18*q;if(tt>.16)a.lift+=.2*Math.sin((tt-.16)/.24*Math.PI)});flashAt(a.x,.35,a.z,.55,CREAM,.14)}break}
    case 'sold':{const f=farmers[e.slot|0];if(f&&f.on&&!reduced()){const mk=marketShift(),x=DROP[f.k][0]+mk.x,z=DROP[f.k][1]+mk.z;coinPop(x,1.5,z,span(-.4,.4),span(3,3.8),span(-.3,.3),0,.7);sparkles(x,1.4,z,2,.25,GOLD,0,.2);if(time-(market.soldAt||-9)>.5){market.soldAt=time;wobble(market.a,.035)}}break}
    case 'produce':if(reduced()){popUntil=time+1.4;lastLeft=count(e.left??0,NEST_MAX)}else produceFx(e);millKick(0);break;
    case 'shoot':towerFire(towerById.get(e.tower),false,false,!!e.splash);break;
    case 'volley':for(const t of towers)towerFire(t,true,!!e.fast);shake(e.fast?.07:.05);break;   // the arrows themselves come from the pull (marked as a volley above)
    case 'hit':if(wolf){wolf.hit=.14;wolf.hitT=time;const [dx,dz]=hitFrom(wolf);knock(wolf,dx,dz,2.4);flashAt(wolf.x,.85*wolf.size,wolf.z,.8);
     for(let i=0;i<2;i++)emit({cell:CELL.star,x:wolf.x,y:.9*wolf.size,z:wolf.z,vx:span(-1.5,1.5),vy:span(1.4,2.6),vz:span(-1,1),gravity:8,life:.38,size:.24,end:.08,spin:9,color:GOLD,add:.3})}break;
    case 'kill':if(wolf){const [dx,dz]=hitFrom(wolf);knock(wolf,dx,dz,3,3.2);flashAt(wolf.x,.8*wolf.size,wolf.z,e.boss?3:1.5,GOLD);if(e.boss){redPulse=Math.max(redPulse,.4);shake(.1)}}break;
    case 'splash':{const x=num(e.x),z=num(e.z),r=Math.max(.5,num(e.r));boom(x,z,r,num(e.n));
     for(const o of wolfVis.values()){if(o.state==='dead'||o.ghost)continue;const d=Math.hypot(o.x-x,o.z-z),reach=r+.6;if(d<reach){const f=1-d/reach;knock(o,o.x-x||span(-1,1),o.z-z||span(-1,1),3.6*f+.4,2.6*f);o.hitT=time}}break}
    case 'newKind':{hl.set(e.wolf,time+3.2);if(wolf){ringWave(wolf.x,wolf.z,3.2*wolf.size,GOLD,.5,0,CELL.halo,.6);sparkles(wolf.x,1.2*wolf.size,wolf.z,6,.6,GOLD,0,.4)}break}
    case 'boss':if(wolf){wolf.bossAt=time;redPulse=1;shake(.1);ringWave(wolf.x,wolf.z,9,FIRE,.8,0,CELL.halo,.6);ringWave(wolf.x,wolf.z,6,ORANGE,.6,.15,CELL.ring,.6);flashAt(wolf.x,1.4,wolf.z,3.4,ORANGE);
     for(let i=0;i<12;i++)emit({cell:CELL.flame,x:wolf.x+span(-1,1),y:.3,z:wolf.z+span(-1,1),vy:span(1.6,2.8),drag:1.4,life:span(.6,1),delay:span(0,.4),size:.6,end:.2,color:WHITE,add:.85,fade:.45,pop:.1})}break;
    case 'roar':if(wolf)roarFx(wolf,Array.isArray(e.towers)?e.towers:[]);break;
    case 'straggler':{const R=Rgoal+num(W('EDGE')),a=spawnAngle(num(e.point)),x=Math.cos(a)*R,z=Math.sin(a)*R;for(let i=0;i<4;i++)emit({cell:CELL.dust,x:x+span(-.8,.8),y:span(.6,1.6),z:z+span(-.8,.8),vx:span(-.6,.6),vy:span(.4,1),vz:span(-.6,.6),drag:2,life:span(.6,.9),size:.32,end:.6,color:LEAF,alpha:.7,fade:.4});break}
    case 'bite':{const c=henById.get(e.hen);if(c){featherBurst(c.a.x,.5,c.a.z,6,.7);flashAt(c.a.x,.5,c.a.z,1,RED)}break}
    case 'henSaved':{const c=henById.get(e.hen);if(c){hop(c.a,.5,.05,.4);sparkles(c.a.x,.8,c.a.z,8,.5,PINK,0,.4);starBurst(c.a.x,.8,c.a.z,6,.6,[PINK,WHITE])}break}
    case 'henLost':{const c=henSlots.find(h=>h.id===e.hen||h.prevId===e.hen),last=wolf||gone.get(e.wolf)||(c?{x:c.lastX,z:c.lastZ}:{x:0,z:0}),x=last.x,z=last.z,p=onScreen(x,z);
     featherBurst(p.x,.8,p.z,12,1);warns.push({x,z,t0:time,color:PINK,life:1.6});
     if(c){const [hx,hz]=W('HOME')(c.i);ringWave(hx,hz,2.2,PINK,.6,0,CELL.halo,.5);dustBurst(hx,hz,5,.5)}shake(.05);break}
    case 'pack':{const R=Rgoal+num(W('EDGE'));for(const p of Array.isArray(e.points)?e.points:[]){const a=spawnAngle(num(p)),x=Math.cos(a)*R,z=Math.sin(a)*R;
     warns.push({x,z,t0:time,color:RED,life:2.4});for(let i=0;i<8;i++)emit({cell:CELL.dust,x:x+span(-1.5,1.5),y:span(1,2.6),z:z+span(-1.5,1.5),vx:span(-1,1),vy:span(.5,1.4),vz:span(-1,1),drag:2,life:span(.7,1.1),size:.4,end:.8,color:LEAF,alpha:.8,fade:.4})}break}
    case 'arrive':ringWave(0,0,(Rgoal+.3)*2.5,RED,.8,0,CELL.halo,.4,.08,true);shake(.04);break;
    // 0.12 finale and fox cues (the king and the fox themselves are drawn from world.king / world.fox)
    case 'king':{const kg=s.world&&s.world.king;if(kg){const x=num(kg.x),z=num(kg.z);redPulse=Math.max(redPulse,.7);shake(.1);ringWave(x,z,9,WHITE,.8,0,CELL.halo,.6);ringWave(x,z,6,ICE,.6,.15,CELL.ring,.6);warns.push({x,z,t0:time,color:WHITE,life:2.6})}break}
    case 'bell':ringWave(0,0,(Rgoal+.3)*2.5,GOLD,.9,0,CELL.halo,.5,.08,true);ringWave(0,0,(Rgoal+.3)*1.6,GOLD,.7,.18,CELL.ring,.5,.08,true);sparkles(0,3,0,14,2,GOLD,0,.6);shake(.08);break;
    case 'shield':{const kg=s.world&&s.world.king,o=kg&&wolfVis.get(kg.id);if(kg){const x=num(kg.x),z=num(kg.z);flashAt(x,3.2,z,5,GOLD,.18);starBurst(x,3.4,z,16,1.3,[GOLD,WHITE],.18);ringWave(x,z,7,GOLD,.5,.18,CELL.halo,.6);shake(.12);if(o){o.hit=.3;o.hitT=time}}break}
    case 'kingStep':{const kg=s.world&&s.world.king;if(kg){stomp(num(kg.x),num(kg.z),3,true);redPulse=Math.max(redPulse,.5);shake(.09)}break}
    case 'kingFlee':{const kg=s.world&&s.world.king;if(kg)dustBurst(num(kg.x),num(kg.z),18,1.4);confetti(0,4.5,0,60,Math.max(4,Rgoal*.7));sparkles(0,2.5,0,18,Rgoal*.5,GOLD,0,.9);redPulse=0;break}
    case 'fox':{const R=Rgoal+num(W('EDGE')),a=spawnAngle(num(e.point)),x=Math.cos(a)*R,z=Math.sin(a)*R;warns.push({x,z,t0:time,color:ORANGE,life:2.4});dustBurst(x,z,6,.7);break}
    case 'foxSaved':{const fx=s.world&&s.world.fox;if(fx){const x=num(fx.x),z=num(fx.z);flashAt(x,.7,z,2.2,GOLD,.1);starBurst(x,.8,z,10,.9,[GOLD,WHITE],.1)}break}
    case 'foxScare':featherBurst(0,.6,0,8,.8);break;
    // 수첩 MVP cues: the shiny guest bows when the answer arrow reaches it, a friend card and a dropped name note get a small sparkle (no banner, no sound here)
    case 'shinyMet':{const g=s.world&&s.world.guest;if(g){const x=num(g.x),z=num(g.z);flashAt(x,.9,z,2.2,GOLD,.1);starBurst(x,1,z,12,1,[GOLD,WHITE],.1)}break}
    case 'guest':{const g=s.world&&s.world.guest;if(g)sparkles(num(g.x),1.2,num(g.z),8,.8,GOLD,0,.6);break}
    case 'friend':sparkles(0,2.5,0,12,Math.max(2,Rgoal*.4),GOLD,0,.9);break;
    case 'noteDrop':sparkles(0,2.2,0,6,Math.max(2,Rgoal*.3),WHITE,0,.8);break;
    case 'dash':{let k=0;for(const o of wolfVis.values()){if(o.state==='dead'||o.ghost)continue;knock(o,0,0,0,2.2);if(k<24){dustBurst(o.x,o.z,4,.6,k*.02);k++}}shake(.06);break}
    default:break;   // 'broken', 'carry' and the rest are drawn from the pulled state
   }
  }
  dirty=true;
 }
 // Test-only hook (inert unless called): {focus:[x,z,half]|null} close-up camera · {hold:true|false} freeze the view clock (still renders)
 // · {advance:seconds} step a held view by fixed 1/30 s frames · {tris:true} triangle/draw breakdown of the last frame.
 let hold=false,advance=0,traceNext=false,tracing=false,traced=null;
 {const direct=renderer.renderBufferDirect.bind(renderer);renderer.renderBufferDirect=(cam,scene,geometry,material,object,group)=>{
  if(tracing){const per=(geometry.index?geometry.index.count:geometry.attributes.position.count)/3,n=object.isInstancedMesh?object.count:1;if(n>0)traced.push([scene?'main':'shadow',object.name||geometry.type,Math.round(per*n)])}
  return direct(cam,scene,geometry,material,object,group)}}
 function debug(opt={}){
  if(opt&&'focus' in opt){const f=opt.focus;if(Array.isArray(f)&&f.length>=3){FOCUS.set(num(f[0]),0,num(f[1]));focusHalf=Math.max(.8,num(f[2]))}else{FOCUS.set(0,0,0);focusHalf=0}camHalf=-1;applyView();camera.position.copy(EYE).add(FOCUS);dirty=true}
  if(opt&&'hold' in opt)hold=!!opt.hold;
  if(opt&&num(opt.advance)>0)advance+=Math.min(10,num(opt.advance));
  if(opt&&Number.isFinite(opt.face))for(const o of wolfVis.values())o.ry=opt.face;   // turn every drawn monster (lineup shots)
  if(opt&&opt.trace){traceNext=true}   // record every draw of the next rendered frame (read it back with debug({})).trace
  const out={focus:focusHalf?[FOCUS.x,FOCUS.z,focusHalf]:null,hold,advance,trace:traced,monsterTris:Object.fromEntries(KIND_ORDER.map(k=>[k,herd[k].tris])),shadowStandInTris:shade.tris,bakeMs,
   crowdTris:{tower:towerBody.map(m=>Math.round((m.geometry.index?m.geometry.index.count:m.geometry.attributes.position.count)/3)),hen:Math.round(G.hen.attributes.position.count/3),farmer:Math.round(crew.tris),storey:Math.round(G.storey.attributes.position.count/3),wall:Math.round(G.wall.attributes.position.count/3)}};
  if(opt&&opt.tris){const list=[];world.traverse(o=>{if(!o.isMesh||!o.visible)return;let p=o;while(p){if(!p.visible)return;p=p.parent}
    const g=o.geometry,per=(g.index?g.index.count:g.attributes.position.count)/3,n=o.isInstancedMesh?(o===shade.mesh?0:o.count):1;if(!n&&!o.castShadow)return;
    const sh=o.castShadow?(o.isInstancedMesh?(o===shade.mesh?o.count:o.count):1):0;list.push({name:o.name||g.type||'mesh',main:Math.round(per*n),shadow:Math.round(per*sh)})});
   const merged={};for(const r of list){const m=merged[r.name]||(merged[r.name]={name:r.name,main:0,shadow:0,meshes:0});m.main+=r.main;m.shadow+=r.shadow;m.meshes++}
   out.tris=Object.values(merged).sort((a,b)=>b.main+b.shadow-a.main-a.shadow)}
  return out;
 }
 // Where the market's coins burst, as fractions of the scene canvas (0..1 from the top left): the page starts its coin flight here.
 const mv2=new V3();
 function marketScreen(){
  if(!market.on||!(viewW>1))return null;const {x,z}=marketFront();mv2.set(x,Math.min(2,market.height*.75)+.2,z).project(camera);
  if(!Number.isFinite(mv2.x)||!Number.isFinite(mv2.y))return null;return {x:clamp((mv2.x+1)/2,0,1),y:clamp((1-mv2.y)/2,0,1)};
 }
 // Public close-up (0.12, the old test-only debug focus made official): focus([x,z,half]) holds the camera on a ground point, focus(null) hands it back.
 // During the wolf-king finale the view also leans toward the king by itself (KING_PULL, see updateView) unless a manual focus is held.
 function focus(f){return debug({focus:Array.isArray(f)?f:null}).focus}
 window.VillageView={events,reward(){},build,upgrade:()=>build('tower'),debug,marketScreen,focus,
  inspect(){
   const states={},kinds={};let onScreenW=0,shownW=0,ghosts=0;
   for(const o of wolfVis.values()){if(o.ghost){ghosts++;continue}shownW++;states[o.state]=(states[o.state]||0)+1;kinds[o.kind]=(kinds[o.kind]||0)+1;ndc.set(o.x,.6,o.z).project(camera);if(Math.abs(ndc.x)<=1&&Math.abs(ndc.y)<=1)onScreenW++}
   const sw=read().world,stunned=sw&&Array.isArray(sw.buildings)?towers.filter(t=>t.on&&t.b&&num(t.b.stun)>0&&!t.b.broken).length:0;
   return {ready:true,time,frames,phase:read().phase,radius:Rgoal,radiusShown:Rd,cameraHalf:camHalf,aspect,cameraFocus:[+FOCUS.x.toFixed(2),+FOCUS.z.toFixed(2)],
    king:(()=>{const kg=sw&&sw.king,o=kg&&wolfVis.get(kg.id);return o?{state:kg.state,size:+o.size.toFixed(2),x:+o.x.toFixed(2),z:+o.z.toFixed(2)}:null})(),fox:(()=>{const fx=sw&&sw.fox,o=fx&&wolfVis.get(fx.id);return o?{state:fx.state,size:+o.size.toFixed(2)}:null})(),
    wolvesVisible:shownW,wolvesOnScreen:onScreenW,wolfStates:states,wolfKinds:kinds,wolfGhosts:ghosts,maxWolvesDrawn,wolfCap:WCAP,highlighted:[...hl.values()].filter(t=>t>time).length,
    power:powerShown,stunnedTowers:stunned,splashFx:{active:booms.filter(b=>time-b.t0<.8).length,total:boomTotal,scorches:scorches.length},
    arrowsVisible:arrowsDrawn,fireArrows:fireDrawn,wolfPos:[...wolfVis.values()].filter(o=>!o.ghost).slice(0,8).map(o=>[Math.round(o.x*100)/100,Math.round(o.z*100)/100]),
    wolfFace:[...wolfVis.values()].filter(o=>!o.ghost).map(o=>[o.id,+o.ry.toFixed(4),o.state]),   // 0.15.2: every drawn monster's heading (ry) and state, to add up how much a formation turns
    herald:heraldInfo(),   // 0.17: drawn herald spots (flag and crow places per road, screen positions −1…1), crows and flags drawn, spots still flying off
    chickens:(()=>{const st=read();return st.world&&Array.isArray(st.world.hens)?st.world.hens.length:st.chickens|0})(),
    hensVisible:hensDrawn,hensHidden,hensPeeking:peeking,hensCarried:carriedDrawn,
    buildingsBroken:[...BUILDINGS,...sides].filter(sl=>sl.on&&sl.b&&sl.b.broken).length,
    towers:towers.filter(t=>t.on).length,fences:sides.filter(f=>f.on).length,fencePanels:fences.count,
    hall:shown.hall,farmers:shown.farmers,pond:shown.pond,feast:shown.feast,farmerActors:farmers.filter(f=>f.on).length,
    towerFloors:towers.reduce((n,t)=>n+(t.on?t.floors:0),0),farmersVisible:farmersDrawn,farmersCarrying:farmers.filter(f=>f.on&&f.eggs>0).length,basketEggs:basketDrawn,nestEggs:nestShown,flow:!!flowS,yardEggs:yardDrawn,farmersRunning:runners,repairers,boost:flowLv(),
    fenceLayers:(()=>{const o={1:0,2:0,3:0};for(const sd of sides)if(sd.on)o[sd.layer]++;return o})(),wallSegments:walls.count,railSegments:rails.count,
    stage:stageShown,roads:trailKey,stageHouses:stageInfo.houses|0,roadMarks:stageInfo.marks|0,stageRising,marketTier:market.mtier,marketDown:market.on&&isBroken(market),hammers:hammersDrawn,propsStage,lanterns:lanterns(propsStage).length,
    pondVisible:pond.obj.visible,garlands:garlands.filter(g=>g.obj.visible).length,sale:!!sale||time<popUntil,
    decor:{forest:forest.count,grove:grove.count,bushes:shrubs.count,rocks:stones.count},
    art15:Object.fromEntries(Object.keys(ART15).map(k=>[k,!!art15[k]])),   // 0.15 model loaded (and baked where it is used); false = that model keeps its 0.14 look
    monsterArt:{king:!!beast.king,fox:!!beast.fox},   // true = drawn from the 0.15 GLB, false = the 0.14 code model
    river:(()=>{const o={on:riverR>0,radius:riverR,bridge:bridgeArt?'glb':'code',bridged:crossed.bridged.size,waded:crossed.waded.size,wadedIn:crossed.wadedIn.size,splashes:crossed.splashes,flow:+riverMesh.scale.x.toFixed(3)};if(!riverR)return o;const b=bridgeSpot(riverR),at=(f,y)=>{ndc.set(b.at[0]+b.u[0]*f,y,b.at[1]+b.u[1]*f).project(camera);return [+ndc.x.toFixed(3),+ndc.y.toFixed(3)]};
     o.bridgeNdc=at(0,.5);o.bridgeFarNdc=at(BRIDGE_ART.len/2,.3);return o})(),   // where the bridge's middle and its far (forest) end are on screen (−1…1)
    mill:{art:millArt?'glb':'code',shown:wheel.obj.visible,turns:Math.round(millSpin.angle/(Math.PI*2)*100)/100,spinning:millSpin.vel>0,kicks:millSpin.kicks},
    drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,builds:{...builds},effects:particles.length+anims.length,warnings:warns.length,blend:{t:+blendT.toFixed(3),dur:+blendDur.toFixed(3),ticks:blendTicks},shake:shakeNow,
    memory:{geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures}}}};

 /* ----- input: tapping is only ever cosmetic ----- */
 const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),probe=new V3();
 canvas.addEventListener('pointerup',e=>{try{
  const s=read();if(s.paused)return;const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);
  {let best=null,near=40;   // towers are instanced: pick by screen distance to the tower's middle
   for(const t of towers){if(!t.on)continue;probe.set(t.a.x,towerTop(t)*.55,t.a.z).project(camera);const d=Math.hypot((probe.x-pointer.x)*r.width/2,(probe.y-pointer.y)*r.height/2);if(d<near){near=d;best=t}}
   if(best){wobble(best.a,.08);sparkles(best.a.x,towerTop(best),best.a.z,4,.5);dirty=true;return}}
  if(reduced())return;
  let best=null,near=36;
  for(const c of yardHens()){probe.set(c.a.x,.4,c.a.z).project(camera);const d=Math.hypot((probe.x-pointer.x)*r.width/2,(probe.y-pointer.y)*r.height/2);if(d<near){near=d;best=c}}
  if(best){hop(best.a,.55,0,.4);featherBurst(best.a.x,.5,best.a.z,3,.6)}
 }catch{}});
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();renderer.setAnimationLoop(null);useFallback()});

 /* ----- per-frame animation of the pulled state ----- */
 function turnTo(a,target,rate){let d=(target-a.ry)%6.283;if(d>Math.PI)d-=6.283;if(d<-Math.PI)d+=6.283;a.ry+=d*Math.min(1,rate)}
 const tickBlend=less=>{const u=less?1:clamp(blendT/blendDur,0,1);return blendEase?easeOut(u):u};
 let shadowR=-1;
 function applyView(){
  const half=focusHalf||viewHalf(Rd);
  if(Math.abs(half-camHalf)>1e-4){camHalf=half;camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix()}
  fxScale=clamp(half/6.4,1,2.2)*clamp(560/viewW,1,1.25);
  yard.scale.set(Rd,1,Rd);layoutDecor(Rd);
  if(Math.abs(Rd-shadowR)>.05){shadowR=Rd;const S=Rd+6;Object.assign(sun.shadow.camera,{left:-S,right:S,top:S,bottom:-S});sun.shadow.camera.updateProjectionMatrix()}
 }
 // 0.15 (계획서 §12): with the river on, the view leans toward the top of the screen so the bridge's far end stays below RIVER_TOP (screen height, −1…1),
 // but only as far as the room under the village ring allows (portrait pads have room to spare and do not move). Follows the drawn radius, so it only
 // changes while the village grows between questions. Returns the ground shift along the screen's up direction.
 const RIVER_TOP=.86;
 function riverLift(R,half){
  if(!riverR)return 0;const b=bridgeSpot(riverR),fx=b.at[0]+b.u[0]*BRIDGE_ART.len/2,fz=b.at[1]+b.u[1]*BRIDGE_ART.len/2;
  const top=(fx*fwdXZ.x+fz*fwdXZ.z)*upXZ+.3*upY,need=top-RIVER_TOP*half,room=.97*half-(R+.6)*upXZ;return Math.max(0,Math.min(need,room))/upXZ;
 }
 const viewAim=()=>{const kg=curS&&(curS.bell===1||curS.bell===2)&&curS.world&&curS.world.king,pull=kg?(curS.bell===2?KING_PULL:KING_WAIT_PULL):0;
  if(kg)return [num(kg.x)*pull,num(kg.z)*pull];const lift=riverLift(Rd,viewHalf(Rd));return [fwdXZ.x*lift,fwdXZ.z*lift]};
 function updateView(dt,less){       // the camera pulls back (and the forest steps back) over about a second when the village grows
  const k=less?1:1-Math.exp(-dt*3.6);Rd+=(Rgoal-Rd)*k;if(Math.abs(Rgoal-Rd)<.004)Rd=Rgoal;
  // finale camera: while the child is fighting the wolf king (bell 2) the view leans a little toward him; it eases back when he flees (0.15: otherwise toward the river)
  if(!focusHalf){const [gx,gz]=viewAim(),d=Math.abs(gx-FOCUS.x)+Math.abs(gz-FOCUS.z);
   if(d>1e-4){const kk=less?1:1-Math.exp(-dt*2.2);FOCUS.x+=(gx-FOCUS.x)*kk;FOCUS.z+=(gz-FOCUS.z)*kk;if(Math.abs(gx-FOCUS.x)+Math.abs(gz-FOCUS.z)<.01){FOCUS.x=gx;FOCUS.z=gz}camera.position.copy(EYE).add(FOCUS);dirty=true}}
  applyView();
 }
 const bw=new V3();
 function brazierWorld(t){   // the fire basket on a tower's crossbow, in world space (bow scale 1.25, swivels with the aim)
  const b=BRAZIER[Math.max(1,t.tier)],s=t.a.s,c=Math.cos(t.aim),sn=Math.sin(t.aim),off=bowAt[t.art],lx=b.x*1.25,lz=b.z*1.25;
  return bw.set(t.a.x+(off.x+lx*c+lz*sn)*s,(off.y+b.y*1.25+t.floors*STOREY_H)*s,t.a.z+(off.z-lx*sn+lz*c)*s);
 }
 function animateBuildings(dt,wdt,less){const fdt=dt;
  for(const sl of BUILDINGS){if(!sl.on||!sl.b)continue;const a=sl.a,b=sl.b,br=isBroken(sl);
   a.x=num(b.x);a.z=num(b.z);
   const f=br?0:num(b.max)>0?clamp(num(b.hp)/num(b.max),0,1):1,tier=br?3:f<=.34?2:f<=.67?1:0;sl.hp=f;sl.dmg=tier;
   a.base=damageMat(sl.tint,tier);
   if(br){const k=less?1:easeIn(clamp((time-sl.brokeAt)/.4,0,1));a.tilt+=sl.lean*.26*k;a.pitch+=.1*k;a.sy*=1-.38*k;a.lift-=.05*k}
   else a.tilt+=sl.lean*.06*(1-f);
   const n=smashOn.get(b.id)||0;sl.smash=n;
   if(n&&!less){const q=Math.min(3,n);a.tilt+=Math.sin(wclock*31+sl.lean)*.016*q;a.sx*=1+.012*q*Math.abs(Math.sin(wclock*31));
    if(wdt>0&&(sl.chipT-=wdt)<=0){sl.chipT=.5;const ang=span(0,6.283),r=sl.size*.9;chipBurst(a.x+Math.cos(ang)*r,.5,a.z+Math.sin(ang)*r,3);dustBurst(a.x+Math.cos(ang)*r,a.z+Math.sin(ang)*r,3,.5)}}
   if(sl.kind==='tower'){   // the crossbow swivels toward its latest target (or the nearest wolf) and kicks back on each shot
    const stun=!b.broken&&num(b.stun)>0;sl.stunned=stun;   // the ember king's roar: the crossbow droops and spins dizzily until the stun runs out
    let target=time-sl.aimAt<1.5?wolfVis.get(sl.aimId):null;
    if(!target||target.state==='dead'){let bd=64;target=null;for(const o of wolfVis.values()){if(o.state==='dead')continue;const d=(o.x-a.x)**2+(o.z-a.z)**2;if(d<bd){bd=d;target=o}}}
    if(target&&!b.broken&&!stun){const want=Math.atan2(target.x-a.x,target.z-a.z);let d=(want-sl.aim)%6.283;if(d>Math.PI)d-=6.283;if(d<-Math.PI)d+=6.283;sl.aim+=d*(less?1:Math.min(1,wdt*8))}
    if(sl.kick>0)sl.kick=Math.max(0,sl.kick-dt*6);
    const off=bowAt[sl.art],back=less?0:.12*sl.kick,dizzy=stun&&!less;
    sl.bow.rotation.set(b.broken?.5:stun?.42+(dizzy?Math.sin(time*7)*.08:0):0,sl.aim+(dizzy?Math.sin(time*3.1)*.45:0),b.broken?.4:dizzy?Math.sin(time*5)*.12:0);sl.bow.position.set(off.x-Math.sin(sl.aim)*back,off.y,off.z-Math.cos(sl.aim)*back);
    if(dizzy){a.tilt+=Math.sin(time*6+sl.slot)*.02;if(fdt>0&&(sl.smokeT-=fdt)<=0){sl.smokeT=.32;const H=towerTop(sl);emit({cell:CELL.glow,x:a.x+span(-.3,.3),y:H*.9,z:a.z+span(-.3,.3),vy:span(.6,1),drag:1,life:span(.8,1.1),size:.45,end:1.1,color:ASH,alpha:.55,fade:.3,pop:.2})}}
    if(sl.tier>0&&!b.broken&&!less&&fdt>0&&(sl.emberT=(sl.emberT||0)-fdt)<=0){sl.emberT=sl.tier>=2?.22:.4;const p=brazierWorld(sl);
     emit({cell:CELL.dot,x:p.x+span(-.06,.06),y:p.y+.15,z:p.z+span(-.06,.06),vx:span(-.25,.25),vy:span(.8,1.4),vz:span(-.25,.25),gravity:-.2,drag:1,life:span(.5,.9),size:.07,end:.02,color:EMBER,add:.9,fade:.5,pop:0})}
   }
  }
 }
 const pm=new THREE.Matrix4(),pq=new THREE.Quaternion(),pe=new THREE.Euler(0,0,0,'YXZ'),pp=new V3(),ps=new V3();
 // Each side is a row of segments along the ring: layer 1 panels, layer 2 panels + outer rails, layer 3 stone wall (same layout).
 const REBUILD_T=num(W('REBUILD'))||150;
 function updateFences(less){
  let n=0,nr=0,nw=0;const Rf=Rd-FENCE_IN,max=FCAP;
  for(const side of sides){if(!side.on||!side.b)continue;
   const b=side.b,k=side.side,L=side.layer,a0=k*Math.PI/3,arc=Rf*Math.PI/3,cnt=Math.max(3,Math.round(arc/FENCE_W)),step=Math.PI/3/cnt,sx=arc/cnt/FENCE_W*1.03;
   const f=num(b.max)>0?clamp(num(b.hp)/num(b.max),0,1):1,tier=b.broken?3:f<=.34?2:f<=.67?1:0,fallAll=b.broken?(less?1:easeIn(clamp((time-side.brokeAt)/.4,0,1))):0;
   const smash=!less&&smashOn.get(b.id)?Math.min(3,smashOn.get(b.id)):0,heavy=L>=3?.45:1;   // a stone wall barely shakes and tips over less
   const up=b.broken&&side.fixer&&side.fixing?Math.floor(clamp(1-num(b.rebuild)/REBUILD_T,0,1)*cnt+.001):0,tintOf=L===2?FENCE_TINT2:FENCE_TINT;   // panels a farmer has already hammered up
   for(let i=0;i<cnt;i++){
    const a=a0+(i+.5)*step,j=hash(k*31+i),fall=i<up?0:fallAll;let r=Rf,y=0,rx=0,ry=-a-Math.PI/2,rz=0,sy=LAYER_H[L-1];
    if(!less&&time-side.pop<1.5){const t=time-side.pop-.035*i;sy*=t<0?.001:Math.max(.001,springy(t))}
    if(fall>0){rx=(j>.5?1:-1)*1.42*fall*heavy;r+=(j-.5)*.9*fall;ry+=(j-.5)*.7*fall;y=.03*fall;if(L>=3)sy*=1-.45*fall}
    else if(i<up){rx=(j-.5)*.16;rz=(hash(k*17+i)-.5)*.1}
    else{rx=(1-f)*(j-.5)*.5*heavy;rz=(1-f)*(hash(k*17+i)-.5)*.25*heavy;if(smash)rz+=Math.sin(wclock*33+i*1.7)*.035*smash*heavy}
    pe.set(rx,ry,rz);pq.setFromEuler(pe);pm.compose(pp.set(Math.cos(a)*r,y,Math.sin(a)*r),pq,ps.set(sx,sy,1));
    const tc=tintOf[i<up?2:tier];
    if(L>=3){if(nw<max){walls.setMatrixAt(nw,pm);walls.setColorAt(nw,tc);nw++}continue}
    if(n<max){fences.setMatrixAt(n,pm);fences.setColorAt(n,tc);n++}
    if(L===2&&nr<max){rails.setMatrixAt(nr,pm);rails.setColorAt(nr,tc);nr++}
   }
  }
  for(const [m,c] of [[fences,n],[rails,nr],[walls,nw]]){m.count=c;m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true}
  fenceShade.instanceMatrix.array.set(fences.instanceMatrix.array.subarray(0,n*16));fenceShade.count=n;fenceShade.instanceMatrix.needsUpdate=true;
 }
 /* ----- monsters: gaits, attacks, reactions and falls, written straight into the per-kind instanced meshes.
    The world position is authoritative; everything here (knock-back, hops, rearing) is a visual offset on top. ----- */
 const PZ={y:0,pitch:0,roll:0,sx:1,sy:1,sz:1,hy:0,hp:0,hr:0,jaw:0,ty:0,tp:.35,legs:[0,0,0,0],lift:[0,0,0,0]};
 const rq=new THREE.Quaternion(),re=new THREE.Euler(0,0,0,'YXZ'),rp=new V3(),rs=new V3(),rv=new V3(),rv2=new V3(),YAX=new V3(0,1,0),rm=new THREE.Matrix4();
 const mq=new THREE.Quaternion(),me=new THREE.Euler(0,0,0,'YXZ'),mv=new V3(),tv=new V3(),hv=new V3();
 const HL=new THREE.Color(1.4,1.32,1.08);
 const wolfKinds={},henSpots=[];let maxWolvesDrawn=0,wolvesDrawn=0,fxBudget=0;
 // Where the mouth (a carried hen) and the top of the head (markers) are on screen, from the same rig the shader uses.
 function mouthOf(o,out){const R=RIG[o.kind];me.set(o.php,o.phy,o.phr,'YXZ');mq.setFromEuler(me);return out.set(R.M[0]-R.H[0],R.M[1]-R.H[1],R.M[2]-R.H[2]).applyQuaternion(mq).add(mv.set(R.H[0],R.H[1],R.H[2])).applyMatrix4(o.mat)}
 function topOf(o,out){const R=RIG[o.kind];return out.set(R.top[0],R.top[1],R.top[2]).applyMatrix4(o.mat)}
 function onView(x,y,z){ndc.set(x,y,z).project(camera);return Math.abs(ndc.x)<1.05&&Math.abs(ndc.y)<1.05}
 const angleTo=(a,b)=>{let d=(a-b)%6.283;if(d>Math.PI)d-=6.283;if(d<-Math.PI)d+=6.283;return d};
 // A paw (or snout) hitting the ground: dust ring, at most a few per frame and only on screen.
 function impact(o,j,big){if(fxBudget<=0)return;const L=RIG[o.kind].L[j];tv.set(L[0],.05,L[2]+.12).applyMatrix4(o.mat);if(!onView(tv.x,.3,tv.z))return;fxBudget--;stomp(tv.x,tv.z,o.size*.8,big)}
 // a heavy footfall (granite, ember king): a small puff only
 function footfall(o,j){if(fxBudget<=0)return;const L=RIG[o.kind].L[j];tv.set(L[0],.05,L[2]).applyMatrix4(o.mat);if(!onView(tv.x,.3,tv.z))return;fxBudget--;
  for(let i=0;i<2;i++)emit({cell:CELL.dust,x:tv.x+span(-.12,.12),y:.08,z:tv.z+span(-.12,.12),vx:span(-.5,.5),vy:span(.2,.5),vz:span(-.5,.5),drag:3,life:span(.4,.55),size:.14*o.size,end:.36*o.size,color:DUST,alpha:.75,fade:.3,abs:true})}
 // small oscillators shared by every monster (no per-frame closures): wag = tail/head sway, sc = scratching paws
 let wagSeed=0,wagLess=false;
 const wag=(f,a)=>wagLess?0:Math.sin(wclock*f+wagSeed*9)*a,sc=f=>wagLess?0:Math.sin(wclock*f+wagSeed*5);
 function writePose(pose,i,P,o){const a=pose[0].array,b=pose[1].array,c=pose[2].array,d=pose[3].array,k=i*4;
  a[k]=P.hy;a[k+1]=P.hp;a[k+2]=P.jaw;a[k+3]=P.ty;b[k]=P.tp;b[k+1]=o.legs[0];b[k+2]=o.legs[1];b[k+3]=o.legs[2];
  c[k]=o.legs[3];c[k+1]=P.hr;c[k+2]=o.seed*20;c[k+3]=0;d[k]=o.lift[0];d[k+1]=o.lift[1];d[k+2]=o.lift[2];d[k+3]=o.lift[3]}
 function animateWolves(dt,wdt,less){
  const e=tickBlend(less);
  for(const k of KIND_ORDER){herd[k].n=0;wolfKinds[k]=0}shade.n=0;fxBudget=less?0:5;splashBudget=less?0:2;
  henSpots.length=0;for(const c of henSlots)if(c.on&&c.h&&(c.h.state==='yard'||c.h.state==='home'||c.h.state==='flee'))henSpots.push(c.a);
  for(const o of wolfVis.values()){
   const px=o.x,pz=o.z;if(!o.ghost){o.x=o.fx+(o.tx-o.fx)*e;o.z=o.fz+(o.tz-o.fz)*e}
   const dx=o.x-px,dz=o.z-pz,moved=Math.hypot(dx,dz),st=o.state,v=o.v,K=o.K,G=GAIT[o.kind]||GAIT.wolf,R=RIG[o.kind],boss=!!K.boss;
   if(wdt>0){o.spd+=(Math.min(4,moved/wdt)-o.spd)*Math.min(1,wdt*7);o.age+=wdt}else if(dt>0)o.spd*=Math.max(0,1-dt*6);
   if(o.hit>0)o.hit-=dt;
   if(st==='dead')o.deadAge+=wdt;
   let face=null;
   if(st==='smash'){const b=bById.get(v.target);face=b&&b.kind!=='fence'?Math.atan2(num(b.x)-o.x,num(b.z)-o.z):Math.atan2(-o.x,-o.z)}
   else if(st==='bite'){const c=henById.get(v.hen);if(c)face=Math.atan2(c.a.x-o.x,c.a.z-o.z)}
   else if(st!=='dead'&&moved>.0015)face=Math.atan2(dx,dz);
   if(face!==null)turnTo(o,face,less?1:dt*(o.kind==='granite'||boss?6:10));
   const P=PZ;P.y=P.pitch=P.roll=P.hy=P.hp=P.hr=P.jaw=P.ty=0;P.tp=.35;P.sx=P.sy=P.sz=1;for(let j=0;j<4;j++){P.legs[j]=0;P.lift[j]=0}
   let fwd=0,pivZ=0,pivY=0,grow=1,ay=0;wagSeed=o.seed;wagLess=less;
   // gait: trot / gallop / bouncy boar trot / granite plod / ember prowl, stride by distance travelled
   if((st==='walk'||st==='hunt'||st==='carry'||st==='leave')&&!less){
    const running=st==='hunt'||st==='carry',type=running?G.run:G.walk,base=(K.speed||1)*(st==='carry'?.65:1);
    const mov=clamp((o.spd-.05)/(.25*base),0,1),hz=G.hz[type]*(running&&type!=='gallop'?1.25:1)*(st==='carry'?.85:1)*clamp(o.spd/base,.6,1.5);
    o.ph+=wdt*6.283*hz;gaitPose(type,o.ph,mov,P);
    if((o.kind==='granite'||boss)&&mov>.5&&wdt>0&&(o.stepT=(o.stepT||0)-wdt)<=0)for(let j=0;j<4;j++)if(o.lift[j]>.02&&P.lift[j]<=.004){footfall(o,j);o.stepT=.3;break}   // heavy feet leave puffs
   }
   // tail and head by state
   if(st==='walk'){P.tp=.42;P.ty=(less?0:Math.sin(o.ph)*.28)+wag(3,.1)}
   else if(st==='hunt'){P.tp=.8;P.ty=wag(15,.5)}
   else if(st==='carry'){P.tp=.2+(less?0:.15*Math.sin(o.ph+1.2));P.ty=wag(10,.25);P.hp-=.14;P.jaw+=.34}
   else if(st==='leave'){P.tp=-.7;P.ty=wag(4,.08);P.hp+=.2}
   else if(st==='bite'){P.tp=.6;P.ty=wag(18,.5)}
   else if(st==='smash'){P.tp=.7;P.ty=wag(12,.35)}
   if(o.kind==='frost'&&(st==='walk'||st==='hunt'))P.tp=.12+(less?0:.12*Math.sin(o.ph+1));   // the plume streams out behind
   if(o.kind==='boar'&&st!=='dead'){P.ty=wag(26,.7);P.tp=.25}
   if(boss)P.tp+=.12;
   if(st==='walk'||st==='hunt'){   // the head turns to a hen close by, otherwise it looks around
    let want=0,bd=st==='hunt'?16:9,tgt=null;
    if(o.kind!=='boar')for(const h of henSpots){const d=(h.x-o.x)**2+(h.z-o.z)**2;if(d<bd){bd=d;tgt=h}}
    if(tgt)want=clamp(angleTo(Math.atan2(tgt.x-o.x,tgt.z-o.z),o.ry),-.8,.8);else if(!less)want=.32*Math.sin(wclock*.7+o.seed*20)*(st==='walk'?1:.4);
    o.hy+=(want-o.hy)*(less?1:Math.min(1,dt*6));P.hy+=o.hy;
   }else o.hy*=less?0:Math.max(0,1-dt*6);
   // coming out of the forest: pop, hop, land in a puff, then a few sniffs
   if(!less&&st==='walk'&&o.age<1.5){const a=o.age;
    if(a<.42){const u=a/.42;P.y+=2*u*(1-u);P.pitch-=.25*Math.sin(u*Math.PI);grow=.4+.6*easeOut(Math.min(1,u*1.7))}
    else if(!o.emerged){o.emerged=true;if(fxBudget>0&&onView(o.x,.3,o.z)){fxBudget--;dustBurst(o.x,o.z,3,.55)}}
    if(a>.4){const k=Math.sin(clamp((a-.4)/1.1,0,1)*Math.PI);P.hp+=.42*k+.08*Math.sin(a*36)*k;P.hy+=.4*Math.sin(a*4.4)*k;P.jaw+=.05*k}
   }
   // attacks on a building or fence, one per kind
   if(st==='smash'){
    const rate=o.kind==='boar'?1/1.1:o.kind==='granite'?1/1.3:boss?1/1.5:1/.9,cyc=wclock*rate+o.seed,u=less?.62:cyc%1,idx=Math.floor(cyc),hitU=o.kind==='boar'||o.kind==='granite'?.55:.42;
    if(o.kind==='boar'){   // backs up pawing the ground, charges, rams, shakes its head
     if(u<.42){const k=easeInOut(u/.42),s1=less?0:Math.sin(u*46);fwd=.3-.75*k;P.hp+=.32*k;P.pitch+=.06*k;P.legs[0]+=.35*s1+(less?0:.45*Math.max(0,Math.sin(u*Math.PI*3)));P.legs[1]-=.35*s1;P.legs[2]-=.3*s1;P.legs[3]+=.3*s1}
     else if(u<.55){const k=easeIn((u-.42)/.13),s2=less?0:Math.sin(u*90);fwd=-.45+.9*k;P.hp+=.38;P.pitch+=.12;P.legs[0]-=.7*s2;P.legs[1]+=.7*s2;P.legs[2]+=.6*s2;P.legs[3]-=.6*s2}
     else{const k=easeOut((u-.55)/.45);fwd=.45-.15*k;P.hp+=.38*(1-k);P.hy+=(less?0:.4*Math.sin((u-.55)*55))*(1-k);P.sy*=1-.1*(1-k);P.sx*=1+.08*(1-k)}
    }else if(o.kind==='granite'){   // lifts a front paw high and slams it down (alternating paws)
     const j=idx%2;
     if(u<.45){const k=easeOut(u/.45);P.legs[j]-=1.35*k;P.lift[j]+=.22*k;P.pitch-=.2*k;P.roll+=(j?1:-1)*.08*k;P.hp-=.15*k;pivZ=R.rear}
     else if(u<.55){const k=easeIn((u-.45)/.1);P.legs[j]+=-1.35+1.45*k;P.lift[j]+=.22*(1-k);P.pitch+=-.2+.35*k;P.roll+=(j?1:-1)*.08*(1-k);P.hp+=-.15+.3*k;fwd=.1*k;pivZ=R.rear}
     else{const k=easeOut((u-.55)/.45);P.pitch+=.15*(1-k);P.hp+=.15*(1-k);fwd=.1*(1-k);P.sy*=1-.07*(1-k);P.sx*=1+.05*(1-k)}
    }else{   // wolf, bramble, frost, ember king: rears up, pounces, scratches with both front paws
     const big=boss?.85:1,lunge=boss?.12:.32;   // the king is huge: a lower rear and a short lunge keep its head out of the roofs
     if(u<.3){const k=easeOut(u/.3);P.pitch-=.6*k*big;P.y+=.06*k;P.legs[0]-=1.1*k;P.legs[1]-=k;P.lift[0]+=.15*k;P.lift[1]+=.15*k;P.legs[2]+=.15*k;P.legs[3]+=.15*k;P.hp-=.3*k;P.jaw+=.45*k;pivZ=R.rear}
     else if(u<.42){const k=easeIn((u-.3)/.12);P.pitch+=-.6*big+(.6*big+.15)*k;fwd=lunge*k;P.legs[0]+=-1.1+.6*k;P.legs[1]+=-1+.5*k;P.hp+=-.3+.55*k;P.jaw+=.45;pivZ=R.rear}
     else if(u<.85){const s=sc(boss?24:36);P.pitch+=.15;fwd=lunge;P.legs[0]+=-.5+.45*s;P.legs[1]+=-.5-.45*s;P.lift[0]+=.06*Math.max(0,s);P.lift[1]+=.06*Math.max(0,-s);P.hp+=.25+.06*sc(22);P.jaw+=.3+.15*sc(20);pivZ=R.rear}
     else{const k=(u-.85)/.15;P.pitch+=.15*(1-k);fwd=lunge*(1-k);P.legs[0]-=.5*(1-k);P.legs[1]-=.5*(1-k);P.hp+=.25*(1-k)}
    }
    if(!less&&u>=hitU&&o.atk!==idx){o.atk=idx;   // the blow lands
     if(o.kind==='boar'){impact(o,0,true);const b=bById.get(v.target),sl=b&&slotOf(b);if(sl&&sl.a&&fxBudget>0)wobble(sl.a,.05)}
     else if(o.kind==='granite')impact(o,idx%2,true);
     else if(boss){impact(o,0,true);if(onView(o.x,.5,o.z))for(let i=0;i<4;i++)emit({cell:CELL.dot,x:o.x+Math.sin(o.ry)*.8*o.size,y:.3,z:o.z+Math.cos(o.ry)*.8*o.size,vx:span(-1,1),vy:span(1.5,2.6),vz:span(-1,1),gravity:5,life:span(.4,.6),size:.09,end:.02,color:EMBER,add:.9,fade:.5,pop:0})}
     else impact(o,0,false);
    }
   }
   if(st==='bite'){const sh=less?0:Math.sin(wclock*26+o.seed*7);P.hp+=.48;P.hy+=.42*sh;P.hr+=.25*sh;P.jaw+=.08;P.pitch+=.1;fwd=.06;P.legs[0]-=.25;P.legs[1]-=.25;P.legs[2]+=.25;P.legs[3]+=.25;P.y-=.03}
   // the ember king's roar: rears back, head up, mouth wide (layered over whatever it was doing)
   const rt=time-o.roarT;
   if(st!=='dead'&&rt>=0&&rt<1.5){const k=rt<.25?easeOut(rt/.25):rt>1.15?1-easeIn((rt-1.15)/.35):1,tr=less?0:Math.sin(rt*55)*.05;
    P.pitch-=.34*k;pivZ=R.rear;P.hp=P.hp*(1-k)+(-.85+tr)*k;P.hy*=1-k;P.jaw=P.jaw*(1-k)+.9*k;P.legs[0]-=.45*k;P.legs[1]-=.45*k;P.lift[0]+=.1*k;P.lift[1]+=.1*k;P.tp+=.45*k;P.y+=.05*k;fwd*=1-k}
   // hit: flinch, squash and tuck the tail
   const ht=time-o.hitT;
   if(!less&&ht>=0&&ht<.4&&st!=='dead'){const f=(1-ht/.4)**2;P.pitch-=.2*f;P.hp-=.3*f;P.sx*=1+.1*f;P.sy*=1-.12*f;o.tuck=Math.max(o.tuck,f)}
   if(o.tuck>0){P.tp=P.tp*(1-o.tuck)-.85*o.tuck;if(dt>0)o.tuck=Math.max(0,o.tuck-dt*1.5)}
   // first of its kind: bounces for a few seconds under a "!" (see ambient)
   const hlEnd=hl.get(o.id),lit=hlEnd!==undefined&&time<hlEnd;
   if(lit&&!less&&st!=='dead')P.y+=.3*Math.abs(Math.sin((hlEnd-time)*5.6));
   // leaping back over an intact fence on the way out
   if((st==='carry'||st==='leave')&&!less){const r=Math.hypot(o.x,o.z),Rf=Rd-FENCE_IN,d=Math.abs(r-Rf);if(d<.75){const side=sides[Math.floor(((Math.atan2(o.z,o.x)+Math.PI*2)%(Math.PI*2))/(Math.PI/3))%6];if(side&&side.on&&side.b&&!side.b.broken){const q=d/.75;ay+=.85*(1-q*q);P.pitch-=.25*(1-q)}}}
   ay+=riverStep(o,st,wdt,less);   // 0.15: on the bridge deck / a little lower in the water
   // falling: knocked up and over, lands in a poof, lies a moment, sinks away
   if(st==='dead'){
    const D=boss?.8:.55,H=boss?1.1:.65,t=less?9:o.deadAge,c=R.center,u=Math.min(1,t/D),k2=Math.min(1,u*2);pivY=c;
    P.roll=o.side*4.712*(less?1:easeOut(u));P.y=(less?0:H*4*u*(1-u))-(c-.3)*(less?1:easeIn(u));P.pitch=0;P.sx=P.sy=P.sz=1;fwd=0;
    P.legs[0]=P.legs[1]=-.7*k2;P.legs[2]=P.legs[3]=.7*k2;for(let j=0;j<4;j++)P.lift[j]=0;P.hp=-.35;P.hy=0;P.hr=0;P.jaw=.45;P.tp=-.2;P.ty=0;
    if(!less&&t>=D){if(!o.landed){o.landed=true;if(boss||onView(o.x,.4,o.z))poof(o.x,o.z,o.size,boss)}
     P.y+=.08*Math.exp(-7*(t-D))*Math.abs(Math.sin((t-D)*14));const sk=easeIn(clamp((t-D-.45)/.45,0,1));P.y-=.7*sk;grow*=Math.max(.001,1-sk)}
   }else if(!less)P.sy*=1+.018*Math.sin(time*2.6+o.seed*6);   // breathing
   // knock-back spring (visual only)
   if(less){o.kx=o.kz=o.ky=o.kvx=o.kvz=o.kvy=0}
   else if(dt>0){const h=Math.min(dt,.05);o.kvx+=(-75*o.kx-10*o.kvx)*h;o.kvz+=(-75*o.kz-10*o.kvz)*h;o.kx+=o.kvx*h;o.kz+=o.kvz*h;
    if(o.ky>0||o.kvy>0){o.kvy-=22*h;o.ky+=o.kvy*h;if(o.ky<=0){o.ky=0;o.kvy=0}}}
   const ls=less?1:Math.min(1,dt*24);for(let j=0;j<4;j++){o.legs[j]+=(P.legs[j]-o.legs[j])*ls;o.lift[j]+=(P.lift[j]-o.lift[j])*ls}
   // root transform: pitch/roll about a pivot (hind hips for rearing, body centre for tumbling)
   const S=o.size*grow;
   re.set(P.pitch,o.ry,P.roll,'YXZ');rq.setFromEuler(re);
   rv.set(0,pivY*S,pivZ*S);rv2.copy(rv).applyAxisAngle(YAX,o.ry);rv.applyQuaternion(rq);
   rp.set(o.x+o.kx+Math.sin(o.ry)*fwd*S,P.y*S+o.ky+ay,o.z+o.kz+Math.cos(o.ry)*fwd*S).add(rv2).sub(rv);
   o.mat.compose(rp,rq,rs.set(S*P.sx,S*P.sy,S*P.sz));o.phy=P.hy;o.php=P.hp;o.phr=P.hr;
   const Hd=herd[o.kind],i=Hd.n++;o.mat.toArray(Hd.mesh.instanceMatrix.array,i*16);if(R.tp0){P.tp+=R.tp0;writePose(Hd.pose,i,P,o);P.tp-=R.tp0}else writePose(Hd.pose,i,P,o);
   Hd.mesh.setColorAt(i,o.hit>0?FLASH:st==='dead'?DEAD:lit&&!less&&Math.sin(time*9)>0?HL:curS&&curS.world&&curS.world.guest&&o.id===curS.world.guest.id?SHINY_TINT:PLAIN);   // 수첩 MVP: 반짝 손님은 밝은 금빛
   if(!o.ghost)wolfKinds[o.kind]++;
   if(st!=='dead'||o.deadAge<.9){const j=shade.n++,fit=SHADE_FIT[o.kind];if(fit){rm.copy(o.mat).scale(fit);rm.toArray(shade.mesh.instanceMatrix.array,j*16)}else o.mat.toArray(shade.mesh.instanceMatrix.array,j*16);writePose(shade.pose,j,P,o)}
  }
  let drawn=0;
  for(const k of KIND_ORDER){const Hd=herd[k];Hd.mesh.count=Hd.n;Hd.mesh.visible=Hd.n>0;drawn+=Hd.n;Hd.mesh.instanceMatrix.needsUpdate=true;for(const p of Hd.pose)p.needsUpdate=true;if(Hd.mesh.instanceColor)Hd.mesh.instanceColor.needsUpdate=true}
  shade.mesh.count=shade.n;shade.mesh.visible=shade.n>0;shade.mesh.instanceMatrix.needsUpdate=true;for(const p of shade.pose)p.needsUpdate=true;
  wolvesDrawn=drawn;maxWolvesDrawn=Math.max(maxWolvesDrawn,drawn);
 }
 let hensDrawn=0,hensHidden=0,carriedDrawn=0,peeking=0;
 function animateHens(dt,wdt,less){
  const e=tickBlend(less);hensDrawn=hensHidden=carriedDrawn=0;
  for(const c of henSlots){const a=c.a;
   if(!c.on||!c.h){a.hide=true;continue}
   const st=c.h.state;a.shy=false;a.y=0;
   if(st==='hidden'){a.hide=true;hensHidden++;continue}
   a.hide=false;hensDrawn++;
   if(st==='carried'){const o=henCarrier.get(c.h.id);
    if(o){mouthOf(o,hv);const k=clamp(o.size/1.3,.62,1);a.x=hv.x;a.z=hv.z;a.y=Math.max(0,hv.y-.55*a.s*k);a.ry=o.ry+Math.PI/2;a.sx*=k;a.sy*=k}else{a.x=num(c.h.x);a.z=num(c.h.z)}   // hangs from the mouth, a bit smaller than the wolf's head
    a.tilt+=.55+(less?0:Math.sin(wclock*30+c.phase)*.25);if(!less)a.lift+=Math.abs(Math.sin(wclock*15))*.06;
    c.fx=c.tx=a.x;c.fz=c.tz=a.z;c.lastX=a.x;c.lastZ=a.z;carriedDrawn++;continue}
   const px=a.x,pz=a.z;a.x=c.fx+(c.tx-c.fx)*e;a.z=c.fz+(c.tz-c.fz)*e;c.lastX=a.x;c.lastZ=a.z;
   const dx=a.x-px,dz=a.z-pz,moved=Math.hypot(dx,dz);
   if(moved>1e-3)turnTo(a,Math.atan2(dx,dz),less?1:dt*12);
   if(less)continue;
   if(st==='yard'){const peck=(wclock*.9+c.phase)%2.4;if(peck<.5)a.pitch+=Math.sin(peck/.5*Math.PI)*.55;a.lift+=Math.abs(Math.sin(wclock*3+c.phase))*.03;
    if(wdt>0&&moved<1e-3)turnTo(a,c.face+Math.sin(wclock*.35+c.phase)*1.4,wdt*1.5)}
   else if(st==='flee'||st==='home'){a.lift+=Math.abs(Math.sin(wclock*16+c.phase))*.12;a.tilt+=Math.sin(wclock*16+c.phase)*.12;a.pitch-=.12}
   else if(st==='caught'){a.tilt+=Math.sin(wclock*38+c.phase)*.35;a.lift+=.08+Math.abs(Math.sin(wclock*19))*.14;
    if(wdt>0&&(c.featherT-=wdt)<=0){c.featherT=.3;featherBurst(a.x,.5,a.z,2,.5)}}
  }
  // Hidden hens peek out of the coop door, pale and trembling, until the wolves have gone.
  peeking=home.on&&home.b&&!home.b.broken?Math.min(3,hensHidden):0;
  const s=home.a.s,dx=(door.min.x+door.max.x)/2*s,dz=door.max.z*s+.25;
  peeks.forEach((a,i)=>{a.hide=i>=peeking;if(a.hide)return;const off=(i-(peeking-1)/2)*.5;
   a.x=home.a.x+dx+camRight.x*off;a.z=home.a.z+dz+camRight.z*off;a.y=0;a.ry=toCam+(i-1)*.35;a.shy=true;
   if(!less){a.lift+=-.06+.08*Math.abs(Math.sin(wclock*2.4+i*1.9));a.tilt+=Math.sin(wclock*30+i)*.04}});
 }
 function writeHens(){
  let m=0;
  for(const a of [...henSlots.map(c=>c.a),...peeks]){if(a.hide)continue;a.obj.updateMatrix();henMesh.setMatrixAt(m,a.obj.matrix);henShade.setMatrixAt(m,a.obj.matrix);henMesh.setColorAt(m,a.flash>0?FLASH:a.shy?SHY:PLAIN);m++}
  henMesh.count=henShade.count=m;henMesh.instanceMatrix.needsUpdate=henShade.instanceMatrix.needsUpdate=true;if(henMesh.instanceColor)henMesh.instanceColor.needsUpdate=true;
  writeTowers();writeFarmers();
 }
 // Towers: stone storeys stacked from the ground, the wooden tower on top, its crossbow on the deck (all follow the proxy's pose).
 const upM=new THREE.Matrix4(),tm=new THREE.Matrix4(),TOWER_TINT=DAMAGE.map(h=>new THREE.Color(h));
 function writeTowers(){
  const tn=[0,0];let ns=0,nb=0;
  for(const t of towers){if(!t.on)continue;const a=t.a,k=t.art,c=a.flash>0?FLASH:TOWER_TINT[t.dmg|0];a.obj.updateMatrix();
   for(let f=0;f<t.floors&&ns<MAXT*MAX_FLOORS;f++){tm.copy(a.obj.matrix).multiply(upM.makeTranslation(0,f*STOREY_H,0));storeys.setMatrixAt(ns,tm);storeys.setColorAt(ns,c);ns++}
   tm.copy(a.obj.matrix).multiply(upM.makeTranslation(0,t.floors*STOREY_H,0));
   towerBody[k].setMatrixAt(tn[k],tm);towerBody[k].setColorAt(tn[k],c);towerShade[k].setMatrixAt(tn[k],tm);tn[k]++;
   t.bow.updateMatrix();tm.multiply(t.bow.matrix);bows.setMatrixAt(nb,tm);bows.setColorAt(nb,c);nb++;
  }
  towerBody.forEach((m,k)=>{m.count=towerShade[k].count=tn[k];m.instanceMatrix.needsUpdate=towerShade[k].instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true});
  storeys.count=ns;bows.count=nb;for(const m of [storeys,bows]){m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true}
 }
 // Farmers: one rigged instance each (arms, legs, head nod from the pose attributes), basket eggs and nest eggs as egg instances.
 let farmersDrawn=0,basketDrawn=0;const em=new THREE.Matrix4(),bm=new THREE.Matrix4(),eq=new THREE.Quaternion(),ev=new V3(),es=new V3(),hv2=new V3(),XAX=new V3(1,0,0);
 const BASKET_UP=HEAD_TOP+.07;   // basket centre when carried on the head
 function writeFarmers(){
  let n=0,e=0;const [A,B,C,D]=crew.pose;
  for(const f of farmers){if(!f.on)continue;const a=f.a;a.obj.updateMatrix();a.obj.matrix.toArray(crew.mesh.instanceMatrix.array,n*16);
   const k=n*4;A.array[k]=0;A.array[k+1]=f.nod;A.array[k+2]=0;A.array[k+3]=0;B.array[k]=0;B.array[k+1]=f.limb[0];B.array[k+2]=f.limb[1];B.array[k+3]=f.limb[2];
   C.array[k]=f.limb[3];C.array[k+1]=0;C.array[k+2]=0;C.array[k+3]=0;D.array[k]=D.array[k+1]=D.array[k+2]=D.array[k+3]=0;
   crew.mesh.setColorAt(n,a.flash>0?FLASH:PLAIN);copyShade(farmerShade,n,a.obj);
   // basket: hangs from the left hand (follows the arm swing) or rides on the head while it holds eggs
   hv2.copy(handL).sub(shoulder).applyAxisAngle(XAX,f.limb[0]).add(shoulder);hv2.y-=.25;
   ev.set(hv2.x*(1-f.up),hv2.y+(BASKET_UP-hv2.y)*f.up,hv2.z*(1-f.up)+.02*f.up);
   bm.copy(a.obj.matrix).multiply(tm.compose(ev,eq.setFromAxisAngle(XAX,(1-f.up)*f.limb[0]*.5),es.setScalar(1+.25*f.up)));baskets.setMatrixAt(n,bm);
   if(f.big&&f.eggs>0&&e<ECAP){em.copy(bm).multiply(tm.compose(ev.set(0,.2,0),eq.identity(),es.setScalar(.2*eggBig())));eggMesh.setColorAt(e,GOLD_EGG);eggMesh.setMatrixAt(e++,em)}   // 0.13: one big golden egg per trip
   else for(let i=0;i<f.eggs&&i<BASKET&&e<ECAP;i++){em.copy(bm).multiply(tm.compose(BASKET_EGGS[i],eq.identity(),es.set(.08,.08,.08)));eggMesh.setColorAt(e,EGG_TINT[e%3]);eggMesh.setMatrixAt(e++,em)}
   n++;
  }
  farmersDrawn=n;basketDrawn=e;crew.mesh.count=farmerShade.count=baskets.count=n;crew.mesh.visible=n>0;crew.mesh.instanceMatrix.needsUpdate=farmerShade.instanceMatrix.needsUpdate=baskets.instanceMatrix.needsUpdate=true;
  for(const p of crew.pose)p.needsUpdate=true;if(crew.mesh.instanceColor)crew.mesh.instanceColor.needsUpdate=true;
  // left-over eggs wait in the nests by the hall (each new one pops in)
  const less=reduced();
  // 0.13 yard eggs: up to two beside each hen (plus one a farmer is walking to), the shared ones in the nests; each pops in where it is laid
  yardDrawn=0;
  if(flowS&&wRef&&Array.isArray(wRef.hens)){
   const wait=new Map();for(const f of farmers)if(f.on&&f.trip&&!f.trip.picked)wait.set(f.trip.from,(wait.get(f.trip.from)||0)+1);
   eggLive.clear();
   const put=(slot,i,key)=>{if(e>=ECAP)return;let t0=eggSeen.get(key);if(t0===undefined){t0=time;eggSeen.set(key,t0)}eggLive.add(key);
    const p=less?1:Math.max(.001,springy(clamp(time-t0,0,2))),sc=(slot<0?.15:.23)*p*eggBig();eggSpot(slot,i,ev);ev.y+=sc*.62;
    eggMesh.setColorAt(e,GOLD_EGG);eggMesh.setMatrixAt(e++,em.compose(ev,eq.setFromAxisAngle(es.set(0,0,1),(i%3-1)*.22),es.set(sc,sc,sc)));yardDrawn++};
   for(const h of wRef.hens){if(!h||typeof h!=='object'||!Number.isInteger(h.slot))continue;const n=Math.min(3,clamp(h.egg|0,0,2)+(wait.get(h.slot)||0));for(let i=0;i<n;i++)put(h.slot,i,h.slot*4+i)}
   const nn=Math.min(NEST_SPOTS.length,clamp(flowS.nest|0,0,99)+(wait.get(-1)||0));for(let i=0;i<nn;i++)put(-1,i,1000+i);
   for(const k of [...eggSeen.keys()])if(!eggLive.has(k))eggSeen.delete(k);
  }
  for(let i=0;i<nestShown&&e<ECAP;i++){const s=NEST_SPOTS[i],p=less?1:Math.max(.001,springy(clamp(time-nestPop[i],0,2)));eggMesh.setColorAt(e,EGG_TINT[e%3]);eggMesh.setMatrixAt(e++,em.compose(ev.set(s[0],s[1],s[2]),eq.setFromAxisAngle(es.set(0,0,1),(i%3-1)*.25),es.set(.095*p,.095*p,.095*p)))}
  eggMesh.count=e;eggMesh.instanceMatrix.needsUpdate=true;if(eggMesh.instanceColor)eggMesh.instanceColor.needsUpdate=true;
 }
 // How many eggs the nests show: scripted during a sale, otherwise the page's `nest` (0.9) or the last sale's left-over.
 function updateNest(s){
  if(flowS){nestShown=0;return}   // 0.13: the nests hold the flow's shared eggs (drawn golden with the yard eggs)
  const st=Number(s&&s.nest),want=sale?(sale.t<.12?sale.nest0:sale.t<.58?sale.kept:sale.left):Number.isFinite(st)?st:lastLeft,n=clamp(Math.floor(want)||0,0,NEST_MAX);
  if(n>nestShown)for(let i=nestShown;i<n;i++)nestPop[i]=time+(i-nestShown)*.04;
  nestShown=n;
 }
 let arrowsDrawn=0,fireDrawn=0;
 const aq=new THREE.Quaternion(),Zf=new V3(0,0,1),tan=new V3(),ap=new V3(),as=new V3(),WARM=new THREE.Color(1.25,.82,.55);
 for(let i=0;i<arrowMesh.instanceMatrix.count;i++)arrowMesh.setColorAt(i,PLAIN);
 function animateArrows(less){
  const frac=less?1:clamp(sinceTick/.1,0,1),sc=clamp(camHalf/7,1.1,2.2);let n=0,hot=0,embers=less?0:8;const max=arrowMesh.instanceMatrix.count;
  for(const [id,o] of arrowVis){
   const target=wolfVis.get(o.a.wolf);if(target&&target.state!=='dead'){o.ex=target.x;o.ez=target.z}
   if(o.fin>=0){const k=less?1:clamp((time-o.fin)/.08,0,1);o.u=o.u0+(1-o.u0)*k;if(k>=1){arrowVis.delete(id);continue}}
   else{const a=o.a,total=Math.max(1,num(a.total)),uw=clamp(1-(num(a.t)+1-frac)/total,0,1);
    o.u=o.volley&&!less?Math.max(uw,Math.min(.95,easeOut(clamp((time-o.born)/.42,0,1)))):uw}
   if(n>=max)continue;
   const u=o.u,dx=o.ex-o.sx,dy=o.ey-o.sy,dz=o.ez-o.sz,dist=Math.hypot(dx,dz),arc=.3+.12*dist;
   ap.set(o.sx+dx*u,o.sy+dy*u+arc*4*u*(1-u),o.sz+dz*u);tan.set(dx,dy+arc*4*(1-2*u),dz).normalize();aq.setFromUnitVectors(Zf,tan);
   const fire=num(o.a.splash)>0;
   pm.compose(ap,aq,as.set(sc,sc,sc));arrowMesh.setColorAt(n,fire?WARM:PLAIN);arrowMesh.setMatrixAt(n++,pm);
   if(fire){   // 펑 화살: a burning head with a flame tongue trailing back, a red-orange streak and falling embers
    hot++;const hx=ap.x+tan.x*.55*sc,hy=ap.y+tan.y*.55*sc,hz=ap.z+tan.z*.55*sc;
    sprite(CELL.glow,hx,hy,hz,1.0*sc,1.0*sc,ORANGE,.8,1);
    if(!less&&u<.999){const ang=Math.atan2(tan.dot(camUp),tan.dot(camRight))+Math.PI/2,fl=.9+.15*Math.sin(time*31+o.id);
     sprite(CELL.flame,hx-tan.x*.3*sc,hy-tan.y*.3*sc,hz-tan.z*.3*sc,.55*sc,.8*sc*fl,WHITE,.95,.85,ang);
     for(let k=1;k<5;k++){const b=k*.34*sc,f=1-k*.2;sprite(CELL.glow,ap.x-tan.x*b,ap.y-tan.y*b,ap.z-tan.z*b,.58*sc*f,.58*sc*f,k<2?EMBER:FIRE,.55*f,.95)}
     if(embers>0&&rnd()<.3){embers--;emit({cell:CELL.dot,x:ap.x,y:ap.y,z:ap.z,vx:span(-.4,.4),vy:span(-.2,.6),vz:span(-.4,.4),gravity:3,drag:1,life:span(.3,.5),size:.08,end:.02,color:EMBER,add:.9,fade:.5,pop:0})}}
   }
   // a short bright streak behind the head keeps the arrow readable at phone size
   else if(!less&&u<.999)for(let k=0;k<4;k++){const b=k*.32*sc,f=1-k*.22;sprite(CELL.glow,ap.x-tan.x*b,ap.y-tan.y*b,ap.z-tan.z*b,.62*sc*f,.62*sc*f,k?CREAM:WHITE,(k?.4:.6)*f,.95)}
  }
  arrowsDrawn=n;fireDrawn=hot;arrowMesh.count=n;arrowMesh.instanceMatrix.needsUpdate=true;if(arrowMesh.instanceColor)arrowMesh.instanceColor.needsUpdate=true;
 }

 /* ----- daily life (farmers keep their own clock: they are decor, not part of the world simulation) ----- */
 function farmerIdle(f,dt){        // strolls the coop-market path with an empty basket (eggs only ever come from a right answer)
  const a=f.a;if(f.wait>0){f.wait-=dt;return false}
  const dx=f.tx-a.x,dz=f.tz-a.z,d=Math.hypot(dx,dz);
  if(d<.05){const [ax,az,bx,bz,w]=ZONE[FARM_ZONE[f.k]]||ZONE.road,[u0,u1]=f.range,u=span(u0,u1),side=clamp(f.off+span(-.3,.3),-1,1)*w,L=Math.hypot(bx-ax,bz-az)||1;
   f.wait=span(.8,2.4);f.tx=ax+(bx-ax)*u-(bz-az)/L*side;f.tz=az+(bz-az)*u+(bx-ax)/L*side;return false}
  const step=Math.min(d,.95*dt);a.x+=dx/d*step;a.z+=dz/d*step;turnTo(a,Math.atan2(dx,dz),dt*7);return true;
 }
 // 0.13: which idle farmer mends which fallen fence side (only while the world's rebuild countdown is running, i.e. no wolf stands by that side)
 function assignRepairs(s){
  const act=!!(flowS&&s&&s.repairAct);
  for(const sd of sides){const b=sd.b,need=act&&sd.on&&b&&b.broken;
   if(need){const rb=num(b.rebuild);if(sd.rbLast===undefined||rb<sd.rbLast-1e-9||rb>sd.rbLast+1)sd.rbT=wclock;sd.rbLast=rb}else sd.rbLast=undefined;
   const live=need&&wclock-(sd.rbT??-9)<.6;
   if(sd.fixer&&!(live&&sd.fixer.on&&!sd.fixer.trip&&(flowSlot(sd.fixer)||{}).job===0)){sd.fixer.fix=null;sd.fixer=null;sd.fixing=false}
   if(live&&!sd.fixer){const p=sideMid(sd.side);let best=null,bd=1e9;for(const f of farmers){if(!f.on||f.fix||f.trip||(flowSlot(f)||{}).job!==0)continue;const d=Math.hypot(f.a.x-p.x,f.a.z-p.z);if(d<bd){bd=d;best=f}}
    if(best){sd.fixer=best;best.fix=sd;sd.fixing=false}}
  }
 }
 function flowFarmer(f,dt,less){     // → [moving, run, up] or null when this farmer just strolls
  const a=f.a,sl=flowSlot(f),lv=flowLv();
  if(sl&&sl.job===1&&num(sl.total)>0){
   const left=num(sl.left),total=num(sl.total);
   if(!f.trip||left>f.trip.last+1e-6||f.trip.from!==(sl.from|0)){   // a new trip: from where he stands to the egg, past the market's corner, to his counter spot
    const from=sl.from|0,mk=marketShift();eggSpot(from,0,tv);
    const t={from,sx:a.x,sz:a.z,ex:tv.x-.18,ez:tv.z+.22,gx:MARKET_GATE.x+mk.x,gz:MARKET_GATE.z+mk.z,mx:DROP[f.k][0]+mk.x,mz:DROP[f.k][1]+mk.z,last:left,picked:false,p0:clamp(1-left/total,0,.5)};
    t.d1=Math.hypot(t.ex-t.sx,t.ez-t.sz);t.d2=Math.hypot(t.gx-t.ex,t.gz-t.ez);t.d3=Math.hypot(t.mx-t.gx,t.mz-t.gz);f.trip=t;if(f.fix){if(f.fix.fixer===f){f.fix.fixer=null;f.fix.fixing=false}f.fix=null}}
   const t=f.trip;t.last=left;
   const sp=(W('FLOW')&&W('FLOW').boost&&W('FLOW').boost[lv])||1,est=less?left:Math.max(0,left-sp*clamp(sinceTick/.1,0,1)),p=clamp((1-est/total-t.p0)/(1-t.p0),0,1),D=t.d1+t.d2+t.d3,d=p*D;
   let x,z;if(d<t.d1){const v=t.d1?d/t.d1:1;x=t.sx+(t.ex-t.sx)*v;z=t.sz+(t.ez-t.sz)*v}else if(d<t.d1+t.d2){const v=t.d2?(d-t.d1)/t.d2:1;x=t.ex+(t.gx-t.ex)*v;z=t.ez+(t.gz-t.ez)*v}else{const v=t.d3?(d-t.d1-t.d2)/t.d3:1;x=t.gx+(t.mx-t.gx)*v;z=t.gz+(t.mz-t.gz)*v}
   if(d>=t.d1&&!t.picked){t.picked=true;if(!less)flashAt(t.ex+.18,.3,t.ez-.22,.5,CREAM)}
   const dx=x-a.x,dz=z-a.z,mv=Math.hypot(dx,dz);if(mv>.003)turnTo(a,Math.atan2(dx,dz),less?1:dt*14);a.x=x;a.z=z;
   const speed=D/Math.max(.2,total*.1/sp),run=lv>0||speed>2.4;f.eggs=t.picked?1:0;f.big=true;
   if(lv>=2&&!less&&dt>0&&(f.dustT=(f.dustT||0)-dt)<=0){f.dustT=.2;dustBurst(a.x,a.z,2,.32)}
   return [mv>.0005,run,t.picked?1:0];
  }
  if(f.trip){f.trip=null;f.tx=a.x;f.tz=a.z;f.wait=span(.15,.5)}
  f.big=false;
  const sd=f.fix;
  if(sd&&sd.fixer===f){const k=sd.side,p=sideMid(k,Rd-FENCE_IN-.8),dx=p.x-a.x,dz=p.z-a.z,d=Math.hypot(dx,dz);
   if(d>.12){const step=less?d:Math.min(d,2.6*dt);a.x+=dx/d*step;a.z+=dz/d*step;turnTo(a,Math.atan2(dx,dz),less?1:dt*10);sd.fixing=false;f.tx=a.x;f.tz=a.z;return [true,true,0]}
   sd.fixing=true;turnTo(a,Math.atan2(p.x,p.z),less?1:dt*10);f.tx=a.x;f.tz=a.z;
   if(!less){const ph=(time/.6)%1,sw=ph<.7?-2.5*easeOut(ph/.7):-2.5+2.1*easeIn((ph-.7)/.3);f.hammer=sw;a.pitch+=ph>.7?.18*(ph-.7)/.3:0;
    if(ph<(f.lastPh??0)){const o=sideMid(k);chipBurst(o.x+span(-.6,.6),.55,o.z+span(-.6,.6),3,sd.layer>=3?[STONE,ROCK]:undefined);dustBurst(o.x,o.z,2,.4)}f.lastPh=ph}
   else f.hammer=-1.6;
   hammerMarks.push(a.x,a.z);
   return [false,false,0];
  }
  return null;
 }
 function farmersLife(dt,less){
  if(sale&&!less){sale.t+=dt;if(sale.t>=SALE_END)sale=null}
  hammerMarks.length=0;repairers=runners=0;assignRepairs(curS);
  for(const f of farmers){const a=f.a;if(!f.on)continue;let moving=false,run=false,up=0;f.eggs=0;f.nod=0;f.hammer=undefined;
   const fw=flowS?flowFarmer(f,dt,less):(f.trip=null,f.fix=null,f.big=false,null);
   if(fw){moving=fw[0];run=fw[1];up=fw[2];if(run)runners++;if(f.hammer!==undefined)repairers++;f.job=null}
   else if(f.job&&sale&&!less){
    const j=f.job,t=Math.max(0,sale.t-j.lag);let x,z,face=null;
    if(t<.5){const u=easeInOut(t/.5);x=j.fx+(j.px-j.fx)*u;z=j.fz+(j.pz-j.fz)*u;run=moving=Math.hypot(j.px-j.fx,j.pz-j.fz)>.05}
    else if(t<.66){x=j.px;z=j.pz;const k=Math.sin((t-.5)/.16*Math.PI);a.pitch+=.35*k;f.nod=.4*k}   // scoops the eggs into the basket
    else if(t<1.5){const u=easeInOut((t-.66)/.84),l1=Math.hypot(j.gx-j.px,j.gz-j.pz),l2=Math.hypot(j.mx-j.gx,j.mz-j.gz),d=u*(l1+l2);run=moving=true;   // pick-up -> past the market's corner -> counter
     if(d<l1){const v=l1?d/l1:1;x=j.px+(j.gx-j.px)*v;z=j.pz+(j.gz-j.pz)*v}else{const v=l2?(d-l1)/l2:1;x=j.gx+(j.mx-j.gx)*v;z=j.gz+(j.mz-j.gz)*v}}
    else{x=j.mx;z=j.mz;face=Math.atan2(market.a.x-x,market.a.z-z)}
    if(t>=.6&&sale.t<1.55){f.eggs=j.eggs;up=1}   // a full basket on the head until the coins burst at the market
    const dx=x-a.x,dz=z-a.z;if(Math.hypot(dx,dz)>.004)turnTo(a,Math.atan2(dx,dz),dt*14);else if(face!==null)turnTo(a,face,dt*8);
    a.x=x;a.z=z;
   }else{
    if(f.job){f.job=null;f.tx=a.x;f.tz=a.z;f.wait=span(.4,1)}
    if(!less&&dt>0)moving=farmerIdle(f,dt);
   }
   f.up=less?up:f.up+(up-f.up)*Math.min(1,dt*12);   // the basket swings up onto the head and back down to the hand
   const pace=run?14:7,sw=i=>moving&&!less?Math.sin(time*pace+f.k+(i===1||i===2?Math.PI:0))*(run?.7:.42):0,hold=ARM_UP+(less?0:Math.sin(time*pace+f.k)*.06);
   f.limb[0]=sw(0)*.55+(hold-sw(0)*.55)*f.up;f.limb[1]=sw(1)+(hold-sw(1))*f.up;f.limb[2]=sw(2);f.limb[3]=sw(3);   // the basket arm swings less; both arms up under a full basket
   if(f.hammer!==undefined)f.limb[1]=f.hammer;   // 0.13: the right arm swings the hammer at the fence
   if(moving&&!less)a.lift+=Math.abs(Math.sin(time*pace+f.k))*(run?.08:.045);
  }
 }

 /* ----- always-on sprites: pads, wolf glow, health bars, cracks, smoke, warnings, ripples (not counted as effects) ----- */
 function bar(x,y,z,f,width,color){const w=width*fxScale*.8,h=.13*fxScale*.8;sprite(CELL.solid,x,y,z,w+.08*fxScale,h+.07*fxScale,HPBG,.72);const off=-(1-f)*w/2;sprite(CELL.solid,x+camRight.x*off,y,z+camRight.z*off,Math.max(.02,w*f),h,color)}
 const hpColor=f=>f>.6?LEAF:f>.3?GOLD:RED;
 const KING_FLAMES=[[0,1.2,.06,.6],[-.24,1.06,.12,.45],[.24,1.06,.12,.45],[0,1.55,.3,.42],[0,1.28,-.92,.62],[-.12,1.12,-.86,.42],[.12,1.12,-.86,.42]];   // ember king flame points (unit model)
 function ambient(less){
  const t=less?0:time;
  if(home.on&&home.b&&!home.b.broken&&!less)for(let i=0;i<3;i++){const cycle=(t*.22+i/3)%1;sprite(CELL.glow,home.a.x-.55+Math.sin(t+i)*.13,2.75*home.a.s+cycle*1.3,home.a.z-.3,.45+cycle*.7,.45+cycle*.7,WHITE,(1-cycle)*.5)}
  for(const tw of towers)if(tw.on){decal(CELL.dot,tw.a.x,tw.a.z,1.9,STONE,.92,0,.03);decal(CELL.halo,tw.a.x,tw.a.z,1.9,PADRIM,.6,0,.032)}
  if(barn.on)decal(CELL.dot,barn.a.x,barn.a.z+.2,3.6,SAND,.85,0,.02);
  hammersDrawn=0;
  for(const sl of BUILDINGS){if(!sl.on||!sl.b)continue;const a=sl.a,H=sl.height*a.s;
   if(isBroken(sl)){decal(CELL.glow,a.x,a.z,sl.size*3.2,INK,.38,0,.05);
    if(!less)for(let i=0;i<3;i++){const cyc=(t*.35+i/3+sl.lean*.17)%1;sprite(CELL.glow,a.x+Math.sin(t*.7+i*2)*.3,H*.45+cyc*2.4,a.z,.7+cyc*1.3,.7+cyc*1.3,SOOT,(1-cyc)*.55)}
    // 🔨 repair hint: a hammer bubble blinks over every broken real building (fences mend themselves)
    const blink=less?1:.5+.5*Math.max(0,Math.sin(time*5.5+sl.lean)),b=(sl.kind==='tower'?1.5:1.8)*Math.max(1,fxScale*.8),bob=less?0:.12*Math.abs(Math.sin(time*3+a.x)),y=H*.55+.45+b*.45+bob;
    sprite(CELL.glow,a.x,y,a.z,b*1.6,b*1.6,GOLD,.4*blink,1);sprite(CELL.hammer,a.x,y,a.z,b,b,WHITE,.35+.65*blink);hammersDrawn++}
   else if(sl.hp<.999){bar(a.x,H+.45,a.z,sl.hp,1.1,hpColor(sl.hp));
    const cracks=sl.hp<=.34?3:sl.hp<=.67?2:sl.hp<.9?1:0,r=sl.size*.85;
    for(let i=0;i<cracks;i++){const off=(i-(cracks-1)/2)*r*.7,y=H*(.28+.17*((i*7)%3));sprite(CELL.impact,a.x-fwdXZ.x*r+camRight.x*off,y,a.z-fwdXZ.z*r+camRight.z*off,.55,.55,CRACK,.8,0,i*1.3)}}
  }
  for(let i=0;i<hammerMarks.length;i+=2){const b=.8*Math.max(1,fxScale*.8),ph=less?0:(time/.6)%1;sprite(CELL.hammer,hammerMarks[i],2.25+(less?0:.12*Math.abs(Math.sin(time*5))),hammerMarks[i+1],b,b,WHITE,1,0,less?0:(ph>.7?.5:-.3))}
  if(flowS&&wRef&&Array.isArray(wRef.hens)){
   for(const h of wRef.hens)if(h&&(h.egg|0)>0&&Number.isInteger(h.slot)){const hm=W('HOME')(h.slot);decal(CELL.glow,hm[0],hm[1]+.18,1.5,GOLD,.3,.6,.035)}
   const lv=flowLv();if(lv>0&&!less)for(const c of yardHens()){const bob=Math.abs(Math.sin(time*6+c.phase));sprite(lv>=2?CELL.star:CELL.sparkle,c.a.x,1.05+.18*bob,c.a.z,.3,.3,GOLD,.9,.4,Math.sin(time*3+c.phase)*.4)}
  }
  for(const sd of sides)if(sd.on&&sd.b&&!sd.b.broken&&num(sd.b.hp)<num(sd.b.max)){const {x,z}=sideMid(sd.side),f=clamp(num(sd.b.hp)/num(sd.b.max),0,1);bar(x,1.35,z,f,1,hpColor(f))}
  for(let i=scorches.length-1;i>=0;i--){const sc=scorches[i],age=time-sc.t0;if(age>4.5){scorches.splice(i,1);continue}   // fire-arrow scorch marks fade out
   const k=age<.12?age/.12:age>2.5?1-(age-2.5)/2:1;flatPool.push(lying,sc.x,.045,sc.z,sc.r*1.35,sc.r*1.35,sc.rot,CELL.scorch,CRACK[0],CRACK[1],CRACK[2],.34*k,0)}
  if(less)for(const b of booms)if(time-b.t0<.6)decal(CELL.ring,b.x,b.z,b.r*2.5,ORANGE,.85,.5,.08);   // reduced motion: a still ring instead of the fireball
  for(const o of wolfVis.values()){
   if(o.state==='dead')continue;const s=o.size;
   /* 수첩 MVP 반짝 손님: 색은 평소와 같아(인스턴스 색 바꾸기는 카드 그림 작업과 함께) 발밑에 숨 쉬는 금빛 고리와 머리 위 반짝이로 알아보게 한다 */
   if(curS&&curS.world&&curS.world.guest&&o.id===curS.world.guest.id&&o.state!=='leave'){const p=less?1:.5+.5*Math.sin(time*4);decal(CELL.halo,o.x,o.z,2.4*s*(1+.2*p),GOLD,.9,.6);decal(CELL.glow,o.x,o.z,3*s,GOLD,.45,.8);
    topOf(o,tv);const b=.6*Math.max(1,fxScale*.85);sprite(CELL.sparkle,tv.x,tv.y+.45+(less?0:.1*Math.sin(time*5)),tv.z,b,b,WHITE,.95,.6,less?0:time*2)}
   const crown=beast[o.kind]&&RIG[o.kind].crown;
   if(o.K.boss&&crown){const p=less?1:.85+.15*Math.sin(time*4);decal(CELL.glow,o.x,o.z,2.7*s*p,GOLD,.42,.7);   // 0.15 GLB wolf king: a golden floor glow and a twinkling crown instead of flames
    for(let i=0;i<crown.length;i++){const [x,y,z]=crown[i],tw=less?.8:Math.max(0,Math.sin(time*4.2+i*1.9));if(tw<.05)continue;tv.set(x,y,z).applyMatrix4(o.mat);
     sprite(CELL.glow,tv.x,tv.y,tv.z,.34*s*tw,.34*s*tw,GOLD,.45*tw,1);sprite(CELL.sparkle,tv.x,tv.y,tv.z,.26*s*tw,.26*s*tw,WHITE,.95*tw,.6,less?0:time*1.5+i)}}
   else if(o.K.boss){const p=less?1:.85+.15*Math.sin(time*4);decal(CELL.glow,o.x,o.z,2.7*s*p,ORANGE,.45,.7);
    for(let i=0;i<KING_FLAMES.length;i++){const [x,y,z,f]=KING_FLAMES[i],fl=less?1:.82+.18*Math.sin(time*(13+i*2.3)+i*1.7);tv.set(x,y,z).applyMatrix4(o.mat);   // living fire on the mane, crest and tail
     sprite(CELL.flame,tv.x,tv.y+.2*f*s*fl,tv.z,.48*f*s,.9*f*s*fl,FLAME_TINT,.95,.8,less?0:Math.sin(time*7+i)*.15)}
    const age=time-o.bossAt;if(age<3.2){const k=Math.min(1,age/.3)*(age>2.4?1-(age-2.4)/.8:1),q=less?1:.7+.3*Math.sin(age*9);decal(CELL.glow,o.x,o.z,6*s*q,FIRE,.55*k,.9);decal(CELL.halo,o.x,o.z,(3.4+(less?0:age%1*2))*s,ORANGE,.7*k*(less?1:1-age%1),.7)}}
   else decal(CELL.glow,o.x,o.z,1.45*s,RED,.3);
   if(o.hp<.999)bar(o.x,RIG[o.kind].top[1]*.95*s+.18,o.z,o.hp,.9*Math.min(1.4,s),hpColor(o.hp));
   const end=hl.get(o.id);
   if(end!==undefined&&time<end){const k=Math.min(1,(end-time)/.4),p=less?1:.5+.5*Math.sin(time*9);   // new monster: gold ring + "!" bubble
    decal(CELL.halo,o.x,o.z,2.3*s*(1+.15*p),GOLD,.95*k,.6);decal(CELL.glow,o.x,o.z,2.6*s,GOLD,.35*k,.8);
    topOf(o,tv);const b=.75*Math.max(1,fxScale*.85);sprite(CELL.bang,tv.x,tv.y+.35+(less?0:.12*Math.abs(Math.sin(time*6))),tv.z,b,b,WHITE,k)}
  }
  for(const tw of towers)if(tw.on&&tw.stunned){const H=towerTop(tw)+.5,f=Math.max(1,fxScale*.8);   // stunned by the roar: stars and a swirl circle the top
   sprite(CELL.swirl,tw.a.x,H+.1,tw.a.z,.95*f,.75*f,WHITE,.75,.2,less?0:-time*5);
   for(let i=0;i<3;i++){const a=(less?0:time*4.2)+i*2.094;sprite(CELL.star,tw.a.x+Math.cos(a)*.55,H+.12+Math.sin(a)*.18,tw.a.z+Math.sin(a)*.35,.42*f,.42*f,GOLD,.95,.3,a)}}
  if(powerShown>=1)for(const tw of towers)if(tw.on&&tw.b&&!tw.b.broken){const p=brazierWorld(tw),big=powerShown>=2?1.35:1,fl=less?1:.85+.12*Math.sin(time*17+tw.slot)+.08*Math.sin(time*31+tw.slot*2),f=Math.max(1,fxScale*.7);   // brazier fire on the crossbow
   sprite(CELL.glow,p.x,p.y+.12,p.z,.95*big*f,.95*big*f,ORANGE,.5,1);sprite(CELL.flame,p.x,p.y+.2*big*f*fl,p.z,.42*big*f,.58*big*f*fl,WHITE,.95,.85,less?0:Math.sin(time*9+tw.slot)*.12)}
  for(let i=warns.length-1;i>=0;i--){const wn=warns[i],age=time-wn.t0;if(age>wn.life){warns.splice(i,1);continue}
   const p=onScreen(wn.x,wn.z,.86),k=1-age/wn.life,pulse=less?.8:.55+.45*Math.sin(age*11),s=1.5*fxScale;
   sprite(CELL.halo,p.x,.6,p.z,s*(1+.25*pulse),s*(1+.25*pulse),wn.color,k*pulse,.6);sprite(CELL.glow,p.x,.6,p.z,s*1.3,s*1.3,wn.color,k*.5,.9)}
  if(pond.obj.visible&&!less)for(let j=0;j<2;j++){const cyc=(t*.3+j*.5)%1;decal(CELL.halo,POND.x+.12-j*.3,POND.z-.08+j*.2,pond.s*(.7+cyc*1.3),WHITE,(1-cyc)*.22,.2,.06)}
  for(const a of peeks)if(!a.hide){const cyc=(wclock*.8+a.x)%1;sprite(CELL.dot,a.x+camRight.x*.22,.78-cyc*.2,a.z+camRight.z*.22,.08,.12,SKY,less?.9:1-cyc*.8)}
  if(time<popUntil){const {x,z}=marketFront();sprite(CELL.glow,x,2.1,z,1.7,1.7,GOLD,.5,1);for(let i=0;i<3;i++)sprite(CELL.coin,x+camRight.x*(i-1)*.5,2.1+(i%2)*.28,z+camRight.z*(i-1)*.5,.5,.5,WHITE)}
  for(const [x,z] of lanterns(propsStage)){const fl=less?1:.85+.15*Math.sin(time*6+x*3);sprite(CELL.glow,x+.24,1.46,z,1.1*fl,1.1*fl,EMBER,.55,1);decal(CELL.glow,x+.2,z,1.6,EMBER,.22*fl,.8,.04)}   // lanterns glow warm
  heraldGround();
 }
 let hammersDrawn=0;

 /* ----- 0.17 늑대 예고(까마귀 · 깃발): getVillageState().herald = World.herald가 세계를 바꾸지 않고 미리 읽은 다음 무리의 길 · 대형(index.html이 틱마다 다시 읽음).
    길마다 한 자리: 길 입구(울타리 바깥, 화면 안에 드는 가장 먼 곳)에 대형 깃발, 그 길 끝 숲 위(화면 안에 드는 가장 먼 곳) 하늘에 까마귀 2 + 그 길 묶음 수 마리가 맴돈다.
    글자 · 소리 · 깜빡임 · 카메라 움직임 없음. 날아들기 · 날아가기는 World.HERALD.arrive · leave초, 움직임 줄이기면 연출 없이 바로 서고 사라지며 까마귀는 멈춰 있다.
    그리기: 까마귀 몸 · 날개 · 대형별 깃발이 인스턴스 메시 하나씩(보일 때만, 그림자 없음), 땅 그늘은 기존 효과 풀(그리기 호출 늘지 않음) ----- */
 // A herald that cannot be built or drawn turns itself off (warn once); it never takes the 3D village down with it (the frame loop falls back on any throw).
 let HLOOK=(()=>{const H=W('HERALD');return H&&H.look&&Array.isArray(H.look.cloth)&&H.look.cloth.length===4?H.look:null})();
 const HCROWS=15,hspots=new Map();let hclock=0,crowBody=null,crowWing=null,heraldFlags=[];
 function heraldOff(error){console.warn('0.17 herald unavailable:',error&&error.message);HLOOK=null;hspots.clear();for(const m of [crowBody,crowWing,...heraldFlags])if(m){m.count=0;m.visible=false}}
 if(HLOOK)try{
  const made=[];const add=m=>{made.push(m);return m};
  try{crowBody=add(instanced(crowGeometry(HLOOK),HCROWS,false));crowWing=add(instanced(crowWingGeometry(),HCROWS*2,false));heraldFlags=[0,1,2,3].map(fm=>add(instanced(heraldFlagGeometry(HLOOK,fm),3,false)))}
  catch(error){for(const m of made)world.remove(m);crowBody=crowWing=null;heraldFlags=[];throw error}
  crowBody.name='herald-crow';crowWing.name='herald-wing';heraldFlags.forEach((m,fm)=>{m.name='herald-flag-'+fm});for(const m of made){m.receiveShadow=false;m.visible=false}
 }catch(error){heraldOff(error)}
 const heraldScale=()=>Math.max(1,fxScale*.65);   // 0.8 made the flag 3.7 tall at the mill village on a laptop: no room above the fence on the top road (CI 44652792998)
 const inView=(x,y,z,m)=>{ndc.set(x,y,z).project(camera);return Math.abs(ndc.x)<=m&&ndc.y<=m&&ndc.y>=-m};
 const ndcOf=(x,y,z)=>{ndc.set(x,y,z).project(camera);return [+ndc.x.toFixed(3),+ndc.y.toFixed(3)]};
 // where a road's herald stands: the flag on the road outside the fence (the furthest point whose foot and top are on screen between radius + 6 and + 3.2: clear of
 // the bridge and the road markers; if none is, the furthest on-screen point down to radius + 1.2, just outside the fence: on a pad the side roads of the castle
 // show only about 2 beyond the fence, wolf-paths-plan §1.2), the crows over the forest end of the same road (the furthest point on screen beyond the flag; on a road
 // running off the top or the side of the screen they fly lower, then come in over the flag, then over the road inside it)
 // A road running to the top of the screen has little room above the fence (the river view, 0.15): there the flag is shrunk to fit (down to half; the camera is
 // orthographic, so screen y is linear in height) and the crows fly low over the road just inside the gate. fk = the flag's size factor.
 function heraldPlace(p,sc){
  const a=spawnAngle(p),c=Math.cos(a),s=Math.sin(a),R=Rd,E=num(W('EDGE'))||7,H0=2.3*sc,flagOk=r=>inView(c*r,0,s*r,.86)&&inView(c*r,H0,s*r,.86);let rf=0,fk=1,rc=0,yC=0;
  for(let r=R+E-1;r>=R+3.2-1e-9&&!rf;r-=.5)if(flagOk(r))rf=r;
  for(let r=R+2.8;r>=R+1.2-1e-9&&!rf;r-=.4)if(flagOk(r))rf=r;
  if(!rf){rf=R+1.2;for(let r=R+E-1;r>=R+1.2-1e-9;r-=.4)if(inView(c*r,0,s*r,.74)){rf=r;break}
   const y0=ndcOf(c*rf,0,s*rf)[1],y1=ndcOf(c*rf,H0,s*rf)[1];if(y1>.86&&y1>y0+1e-6)fk=clamp((.86-y0)/(y1-y0),.5,1)}
  find:{for(const yk of [3.1,2.4,1.8]){yC=yk*sc;for(let r=R+E+1.5;r>=rf+.8-1e-9;r-=.5)if(inView(c*r,yC,s*r,.72)){rc=r;break find}}
   for(const yk of [1.8,1.2]){yC=yk*sc;for(let r=rf;r>=R-1.5-1e-9;r-=.5)if(inView(c*r,yC,s*r,.78)){rc=r;break find}}
   rc=rf;const g0=ndcOf(c*rf,0,s*rf)[1],g1=ndcOf(c*rf,1,s*rf)[1];yC=g1>g0+1e-6?clamp((.78-g0)/(g1-g0),.6*sc,1.8*sc):1.2*sc}
  return {fx:c*rf,fz:s*rf,cx:c*rc,cz:s*rc,yC,H:H0*fk,fk};
 }
 function heraldStep(fdt,less){if(!HLOOK)return;try{heraldMove(fdt,less)}catch(error){heraldOff(error)}}
 function heraldMove(fdt,less){
  hclock+=fdt;
  const h=curS&&curS.herald,live=new Set();
  if(h&&Array.isArray(h.points)&&Array.isArray(h.forms))h.points.forEach((p,i)=>{const pt=count(p,7),key=num(h.n)+':'+pt;live.add(key);let sp=hspots.get(key);
   if(!sp){sp={key,point:pt,age:less?9:0,out:-1,phase:pt*1.37+i*.6,dir:pt%2?-1:1,place:null,sc:1,fade:0};hspots.set(key,sp)}
   sp.form=count(h.forms[i],3);sp.k=clamp(2+(Array.isArray(h.groups)?h.groups.filter(q=>q===p).length:1),3,5);if(sp.out>=0)sp.out=-1});
  const OUT=num(W('HERALD')?.leave)||.9;
  for(const sp of [...hspots.values()]){if(!live.has(sp.key)&&sp.out<0)sp.out=0;
   if(sp.out>=0){sp.out+=fdt;if(less||sp.out>=OUT)hspots.delete(sp.key)}else sp.age+=fdt}
  writeHerald(less);
 }
 const hm=new THREE.Matrix4(),hw=new THREE.Matrix4(),hq=new THREE.Quaternion(),he=new THREE.Euler(0,0,0,'YXZ'),hp=new V3(),hsv=new V3(),MIRROR_X=new THREE.Matrix4().makeScale(-1,1,1);
 function writeHerald(less){
  let nb=0,nw=0;const nf=[0,0,0,0],sc=heraldScale(),IN=num(W('HERALD')?.arrive)||.8,OUT=num(W('HERALD')?.leave)||.9;
  for(const sp of hspots.values()){
   const P=heraldPlace(sp.point,sc),uIn=less?1:easeOut(clamp(sp.age/IN,0,1)),uOut=sp.out<0?0:less?1:easeIn(clamp(sp.out/OUT,0,1));sp.place=P;sp.sc=sc;sp.fade=1-uOut;
   // flag: springs up on arrival, lies down when the pack comes out; turned to face the camera with a slight sway
   const fy=less?1:sp.out>=0?Math.max(.001,1-uOut):Math.max(.001,springy(sp.age)),sway=less?0:.12*Math.sin(hclock*2.1+sp.phase);
   if(nf[sp.form]<3){const k=sc*P.fk;hq.setFromEuler(he.set(0,toCam+sway,0));hm.compose(hp.set(P.fx,0,P.fz),hq,hsv.set(k,k*fy,k));heraldFlags[sp.form].setMatrixAt(nf[sp.form]++,hm)}
   // crows: circle the spot (alternate directions per road), lean into the turn, flap; fly in from high and wide, fly off higher and wider
   for(let j=0;j<sp.k&&nb<HCROWS;j++){
    const ang=sp.phase+j*Math.PI*2/sp.k+(less?0:sp.dir*hclock*1.25),rad=1.1*sc*(1+2*(1-uIn)+2.5*uOut),y=P.yC+(less?0:.18*sc*Math.sin(hclock*2.6+j*1.7))+4*sc*(1-uIn)+5*sc*uOut;
    const yaw=Math.atan2(-Math.sin(ang)*sp.dir,Math.cos(ang)*sp.dir),s=.85*sc*(1-.5*uOut),flap=less?.12:.18+.55*Math.sin(hclock*9+j*2.1);
    hq.setFromEuler(he.set(less?0:-.08,yaw,less?0:.35*sp.dir));hm.compose(hp.set(P.cx+Math.cos(ang)*rad,y,P.cz+Math.sin(ang)*rad),hq,hsv.set(s,s,s));crowBody.setMatrixAt(nb++,hm);
    hw.makeRotationZ(flap).premultiply(hm);crowWing.setMatrixAt(nw++,hw);hw.makeRotationZ(flap).premultiply(MIRROR_X).premultiply(hm);crowWing.setMatrixAt(nw++,hw)}
  }
  crowBody.count=nb;crowWing.count=nw;heraldFlags.forEach((m,fm)=>{m.count=nf[fm]});
  for(const m of [crowBody,crowWing,...heraldFlags]){m.visible=m.count>0;if(m.count)m.instanceMatrix.needsUpdate=true}
 }
 // soft ground shade under the circling crows and at the flag foot (drawn in the existing decal pool: no extra draw call)
 function heraldGround(){if(HLOOK)for(const sp of hspots.values()){const P=sp.place;if(!P)continue;decal(CELL.glow,P.cx,P.cz,2.6*sp.sc,INK,.16*sp.fade,0,.05);decal(CELL.glow,P.fx,P.fz,.9*sp.sc,INK,.28*sp.fade,0,.05)}}
 function heraldInfo(){
  const all=[...hspots.values()],on=all.filter(sp=>sp.out<0&&sp.place);
  return {on:!!HLOOK,spots:on.length,leaving:all.length-on.length,crows:crowBody?crowBody.count:0,flags:heraldFlags.reduce((n,m)=>n+m.count,0),
   list:on.map(sp=>{const P=sp.place;return {point:sp.point,form:sp.form,crows:sp.k,size:+(sp.sc*P.fk).toFixed(3),crowY:+P.yC.toFixed(2),flag:[+P.fx.toFixed(2),+P.fz.toFixed(2)],crow:[+P.cx.toFixed(2),+P.cz.toFixed(2)],flagNdc:ndcOf(P.fx,0,P.fz),flagTopNdc:ndcOf(P.fx,P.H,P.fz),crowNdc:ndcOf(P.cx,P.yC,P.cz)}})};
 }

 /* ----- frame loop: 30fps cap, dt-driven, frozen while paused or hidden; the world clock only runs in listen/ask/learn ----- */
 // names only label the debug({tris}) breakdown
 Object.entries({meadow:land,yard,decor,forest,grove,shrubs,stones,fences,hens:henMesh,arrows:arrowMesh,fxFlat:flatPool.mesh,fxAir:airPool.mesh,shadowStandIn:shade.mesh,'garden-bush':garden[0],'garden-rock':garden[1],hay:hay.obj,pond:pond.obj,
  'shade-fence':fenceShade,'shade-hen':henShade,'shade-farmer':farmerShade,'shade-tower-a':towerShade[0],'shade-tower-b':towerShade[1],'shade-bush':garden[2],
  'tower-a':towerBody[0],'tower-b':towerBody[1],'tower-storey':storeys,crossbow:bows,'fence-rails':rails,'fence-wall':walls,props,farmer:crew.mesh,baskets,eggs:eggMesh})
  .forEach(([n,m])=>{m.name=n});
 for(const k of KIND_ORDER)herd[k].mesh.name='monster-'+k;for(const sl of BUILDINGS)sl.a.obj.name=sl.kind;
 garlands.forEach(g=>{g.obj.name='garland'});
 let last=0,wasLess=reduced(),curS=IDLE;
 const SUN_COLOR=sun.color.clone(),RED_LIGHT=new THREE.Color(0xff4a2a);
 {const s=read();curS=s;syncEconomy(s,true);syncPower(s,false);syncRecords(s);syncStage(s);updateNest(s);Rd=Rgoal;resize();const less=reduced();
  {const kg=curS.world&&curS.world.king&&(curS.bell===1||curS.bell===2);if(!kg){const [gx,gz]=viewAim();FOCUS.set(gx,0,gz);camera.position.copy(EYE).add(FOCUS)}}   // a village loaded at stage 3+ starts with the river view (no pan on load); the king's lean eases in as in 0.14
  animateBuildings(0,0,less);updateFences(less);animateWolves(0,0,less);animateHens(0,0,less);animateArrows(less);for(const a of actors)pose(a,0);writeHens()}
 host.classList.add('is3d');host.dataset.renderer='three';
 // One step of the view: dt-driven; `still` freezes everything (paused, hidden tab), the world clock only runs in listen/ask/learn.
 function step(dt,still,less,running){
  const fdt=still?0:dt,wdt=running&&!still?dt:0;
  if(!still){time+=dt;wclock+=wdt;blendT+=dt;sinceTick+=dt}
  if(!still||dirty){
   updateView(fdt,less);
   animateBuildings(fdt,wdt,less);updateFences(less);animateWolves(fdt,wdt,less);animateHens(fdt,wdt,less);
   farmersLife(fdt,less);heraldStep(fdt,less);
   if(!less&&!still)stepEffects(fdt);
   // the light dims while wolves are inside the village, and flushes red when the ember king arrives or roars
   sunDim+=((insideWolves>0?1:0)-sunDim)*(less?1:Math.min(1,fdt*2));sun.intensity=2.8-.7*sunDim;
   redPulse=Math.max(0,redPulse-fdt*.8);sun.color.copy(SUN_COLOR).lerp(RED_LIGHT,redPulse*.6);
   RIG_TIME.value=time;updateNest(curS);
   millStep(fdt);wheel.pitch=-millSpin.angle;   // 0.15 mill wheel (its axle is the model's x axis: pitch turns it)
   for(const a of actors)pose(a,fdt);writeHens();dirty=false;
  }
 }
 function frame(now){
  if(last&&now-last<1000/30)return;
  const dt=Math.min(.05,last?(now-last)/1000:0);last=now;frames++;
  const s=read(),still=!!s.paused||document.hidden,less=reduced(),running=!still&&(typeof s.running==='boolean'?s.running:RUNNING.has(s.phase));   // 0.9: index.html tells whether the world clock runs (it keeps running during the reward/sale beat)
  host.classList.toggle('village-paused',still);host.dataset.phase=s.phase||'';
  if(less&&!wasLess){clearEffects();dirty=true}wasLess=less;
  if(syncEconomy(s))dirty=true;
  if(syncPower(s,false))dirty=true;
  syncRecords(s);curS=s;if(syncStage(s))dirty=true;{const nb=nestShown;updateNest(s);if(nestShown!==nb)dirty=true}
  if(hold){let n=0;while(advance>1e-6&&n<300){const h=Math.min(1/30,advance);advance-=h;n++;step(h,still,less,running)}if(!n&&dirty)step(0,true,less,false)}   // test-only frozen view
  else step(dt,still,less,running);
  flatPool.begin();airPool.begin();animateArrows(less);ambient(less);drawParticles();flatPool.end();airPool.end();
  if(traceNext){traceNext=false;tracing=true;traced=[]}
  if(!document.hidden)renderer.render(world,camera);
  tracing=false;
 }
 let broken=false;
 renderer.setAnimationLoop(now=>{if(broken)return;try{frame(now)}catch(error){broken=true;renderer.setAnimationLoop(null);useFallback();console.warn('Village renderer stopped:',error.message)}});
}
start().catch(error=>{useFallback();console.warn('Village renderer unavailable:',error.message)});
