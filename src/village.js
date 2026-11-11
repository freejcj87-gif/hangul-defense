import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const host=document.querySelector('.scene');
const motion=matchMedia('(prefers-reduced-motion: reduce)');
// The page owns the game; this file only reads its state every frame (pull) and plays one-shot effects (push).
const IDLE={phase:'start',paused:false,level:0,chickens:1,hidden:0,fence:0,farmers:0,pond:0,hall:0,feast:0,wins:0,wolves:0,progress:0,tries:0,dash:false,result:null,raid:null};
const read=()=>{try{return window.getVillageState?.()||IDLE}catch{return IDLE}};
const reduced=()=>motion.matches || document.body.classList.contains('reduced');
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const count=(v,max)=>clamp(Math.floor(Number(v)||0),0,max);
const ART='art-handoff/coopnight/browser/';
const V3=THREE.Vector3;
// Until the 3D village is ready (or when it falls back) the page still gets a safe API.
const stubView=()=>({events(){},reward(){},build(){return null},upgrade(){return null},inspect(){return {ready:false}}});
window.VillageView=stubView();
// Hands the scene back to the DOM picture village (index.html draws it when .is3d is gone).
function useFallback(){host.classList.remove('is3d');host.dataset.renderer='fallback';window.VillageView=stubView()}

// Deterministic variety keeps screenshots and tests repeatable.
let seed=20261111;
const rnd=()=>{seed=(seed+0x6d2b79f5)|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296};
const span=(a,b)=>a+(b-a)*rnd();

/* ---------- geometry baking: every object becomes one vertex-coloured mesh ---------- */
const lit=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.82,metalness:0,side:THREE.DoubleSide});
const hot=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.82,metalness:0,side:THREE.DoubleSide,emissive:0xfff0c0,emissiveIntensity:.8});
const shy=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.9,metalness:0,side:THREE.DoubleSide,color:0xa3b0c6}); // hiding hens look pale and grey-blue
function prep(source,matrix,color){
 const pos=source.attributes.position,nor=source.attributes.normal,index=source.index,n=index?index.count:pos.count;
 const P=new Float32Array(n*3),N=new Float32Array(n*3),C=new Float32Array(n*3);
 const v=new V3(),normalMatrix=new THREE.Matrix3().getNormalMatrix(matrix),flip=matrix.determinant()<0;
 for(let i=0;i<n;i++){
  const corner=i%3,k=flip&&corner?i-corner+(3-corner):i,src=index?index.getX(k):k;
  v.fromBufferAttribute(pos,src).applyMatrix4(matrix);P[i*3]=v.x;P[i*3+1]=v.y;P[i*3+2]=v.z;
  if(nor){v.fromBufferAttribute(nor,src).applyMatrix3(normalMatrix).normalize();N[i*3]=v.x;N[i*3+1]=v.y;N[i*3+2]=v.z}
  C[i*3]=color.r;C[i*3+1]=color.g;C[i*3+2]=color.b;
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setAttribute('normal',new THREE.BufferAttribute(N,3));g.setAttribute('color',new THREE.BufferAttribute(C,3));
 if(!nor)g.computeVertexNormals();
 return g;
}
function fuse(list){const g=mergeGeometries(list,false);for(const item of list)item.dispose();if(!g)throw new Error('Model merge failed');return g}
const PRIM={sphere:new THREE.SphereGeometry(1,10,8),box:new THREE.BoxGeometry(1,1,1),cone:new THREE.ConeGeometry(1,1,6),cyl:new THREE.CylinderGeometry(1,1,1,12),disc:new THREE.CircleGeometry(1,20),gem:new THREE.OctahedronGeometry(1,0)};
// parts: [primitive, colour, [x,y,z], scale | [sx,sy,sz], [rx,ry,rz]?]
function solid(parts){
 const m=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler();
 return fuse(parts.map(([prim,color,p,s,r=[0,0,0]])=>prep(PRIM[prim],m.compose(new V3(...p),q.setFromEuler(e.set(...r)),typeof s==='number'?new V3(s,s,s):new V3(...s)),new THREE.Color(color))));
}
// Bakes a GLB node to `height`, feet on y=0, centred on x/z. Children named in `split` come back as separate limbs with their pivots.
function bake(node,height,split=[]){
 if(!node)throw new Error('Required model is missing');
 node.updateWorldMatrix(true,true);
 const box=new THREE.Box3().setFromObject(node),size=box.getSize(new V3()),c=box.getCenter(new V3()),k=height/size.y;
 const frame=new THREE.Matrix4().makeScale(k,k,k).multiply(new THREE.Matrix4().makeTranslation(-c.x,-box.min.y,-c.z));
 const groups=new Map([['main',{list:[],pivot:new V3()}]]);
 for(const name of split){const child=node.getObjectByName(name);if(child)groups.set(name,{list:[],pivot:new V3().setFromMatrixPosition(child.matrixWorld).applyMatrix4(frame)})}
 const m=new THREE.Matrix4();
 node.traverse(obj=>{
  if(!obj.isMesh)return;
  let key='main';for(let p=obj;p&&p!==node.parent;p=p.parent)if(p!==node&&groups.has(p.name)){key=p.name;break}
  const group=groups.get(key);m.makeTranslation(-group.pivot.x,-group.pivot.y,-group.pivot.z).multiply(frame).multiply(obj.matrixWorld);
  group.list.push(prep(obj.geometry,m,obj.material.color));
 });
 const out={};for(const [name,group] of groups)if(group.list.length)out[name]={geometry:fuse(group.list),pivot:group.pivot};
 return out;
}

/* ---------- effect atlas: every sprite effect shares one texture and two draw calls ---------- */
const CELL={dust:0,ring:1,impact:2,star:3,feather:4,coin:8,sparkle:12,glow:13,solid:14,halo:15,egg:16,dot:17};
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
const WHITE=tint(0xffffff),GOLD=tint(0xffd24a),CREAM=tint(0xfff3d6),DUST=tint(0xf2dfb4),WOOD=tint(0xb97a3c),RED=tint(0xff5a4a),PINK=tint(0xff8fb3),SKY=tint(0x6fd3ff),LEAF=tint(0x9be05c);

/* ---------- easing ---------- */
const springy=t=>1-Math.exp(-7.7*t)*Math.cos(17.5*t);            // 0 -> 1.25 -> 0.94 -> 1
const settle=(t,freq=19,damp=8)=>Math.exp(-damp*t)*Math.cos(freq*t); // 1 -> 0 with a wobble
const easeIn=u=>u*u,easeOut=u=>1-(1-u)*(1-u),easeInOut=u=>u<.5?2*u*u:1-2*(1-u)*(1-u);

/* ---------- layout (world units; the camera looks at the origin from the front-left) ---------- */
// Wolves walk right -> left along the front lane. SPAWN_X sits far enough inside the view that a pack of five fits on screen at progress 0.
const LANE_Z=4.1,GATE_X=-8.3,SPAWN_X=2.9,WOLF_END=GATE_X+.8,WOLF_MAX=5;
const TOWER={x:-2.5,z:2.0,h:2.3},CORN={x:.5,z:2.0,h:2.3};
const TOWER_SCALE=[1,1,1.09,1.17,1.26,1.38],CORN_SCALE=[1,1,1,1,1.1,1.24];
const FENCE_Z=3.15,FENCE_STEP=1.98,fenceX=i=>GATE_X+1.05+i*FENCE_STEP;
const YARD={x0:-4.1,x1:1.6,z0:-.7,z1:1.25};
const SLOTS=[[-1.2,.5],[-3.6,.9],[-.2,-.3],[-3.9,-.4],[-2.4,-.4],[.9,.7],[-.6,1.15],[-1.6,1.1]]; // up to 8 hens
const HIDE=[[-4.75,-1.5],[-.8,-1.75],[-4.85,-2.35],[-.75,-2.6],[-4.3,-.75],[-1.25,-.75],[-4.9,-3.2],[-.85,-3.25]]; // scared hens crouch along the coop walls
const IN=[[-4.3,1.75],[-3.3,.8],[-1.3,1.15],[-4.6,.1],[-2.3,.35]];          // where wolves that got in stand in the yard
const POND={x:3.0,z:1.95},POND_R=[0,.62,.82,1.0];                           // clear of the corn tower, fence row, thicket and market path
const FARM_HOME=[[-2.4,-1],[-3.7,-.55],[1.3,-1.6]];                          // base farmer + 2 hired farmers (spots not hidden behind the towers)
const PICK=[[-.1,-.3],[-.8,.45],[.6,.55]],DROP=[[3.45,.3],[2.55,.45],[4.3,.5]]; // egg pick-up spots and market counter spots per farmer
const MARKET_FRONT={x:3.9,z:-.1},SALE_END=1.95;
const PRIMS=Object.assign(PRIM,{plane:new THREE.PlaneGeometry(1,1),dot:new THREE.CircleGeometry(1,6)});
const flat=(prim,color,x,z,sx,sz,y=.02,rot=0)=>[prim,color,[x,y,z],[sx,sz,1],[-Math.PI/2,0,rot]];
function groundDecor(){
 const sand=0xe8d6a4,edge=0xcdb681,pad=0xdcc793,parts=[
  flat('plane',edge,(GATE_X+SPAWN_X)/2+1.6,LANE_Z,SPAWN_X-GATE_X+7.4,1.95,.012),
  flat('plane',sand,(GATE_X+SPAWN_X)/2+1.6,LANE_Z,SPAWN_X-GATE_X+7.4,1.55,.02),
  flat('disc',0x7f9a58,SPAWN_X+1.3,LANE_Z-.2,2.3,1.9,.026),                        // shady wolf thicket
  flat('disc',pad,-2.1,.35,4.4,1.75,.014),flat('disc',pad,-2.8,-2.5,2.5,2.2,.016),flat('disc',pad,4.2,-1.5,3,2.4,.016),flat('disc',pad,.6,-3.4,1.9,1.7,.016),
  flat('plane',pad,.9,-.35,6.6,.9,.018,-.17),
  flat('disc',0xb9b3a0,TOWER.x,TOWER.z,1.02,1.02,.03),flat('disc',0xd8d2bd,TOWER.x,TOWER.z,.82,.82,.036),
  flat('disc',0xb9b3a0,CORN.x,CORN.z,1.02,1.02,.03),flat('disc',0xd8d2bd,CORN.x,CORN.z,.82,.82,.036)];
 for(let i=0;i<16;i++)parts.push(['sphere',i%3?0xbfb59c:0xa9a28e,[GATE_X+1+i*1.02+Math.sin(i*5.1)*.3,.03,LANE_Z+(i%2?.92:-.9)+Math.sin(i*3.3)*.06],[.16+.05*Math.sin(i*2.2),.07,.12]]);
 const petals=[0xffffff,0xffe27a,0xff9fb6,0xfff6d8];
 for(let i=0;i<70;i++){
  const x=Math.sin(i*12.9898)*13,z=Math.cos(i*7.233)*12+1;
  if(Math.abs(z-LANE_Z)<1.3||(x>-6.5&&x<6.5&&z>-4.6&&z<3))continue;      // keep the lane and yard clean
  if(i%3===0){parts.push(flat('dot',petals[i%4],x,z,.11,.11,.035));parts.push(flat('dot',0xf2b632,x,z,.045,.045,.04))}
  else parts.push(flat('dot',0x86b060,x,z,.13,.09,.03,i));
 }
 return solid(parts);
}
function wolfParts(){
 const fur=0x4f5b68,dark=0x39434e,parts=[
  ['sphere',fur,[0,.65,0],[.3,.31,.6]],['sphere',0x5d6a78,[0,1,.36],[.33,.33,.34]],['sphere',0xf3e9d5,[0,.86,.62],[.21,.17,.24]],['sphere',0x1c2426,[0,.9,.83],[.1,.075,.065]],
  ['cone',fur,[0,.82,-.68],[.18,.65,.18],[-.7,0,0]],['sphere',0xe9dfca,[0,1.02,-.9],[.09,.12,.09]],['sphere',0xffffff,[0,.74,.8],[.13,.035,.04]]];
 for(const side of [-1,1])parts.push(['cone',fur,[side*.22,1.36,.32],[.15,.36,.15]],['cone',0xe59a9a,[side*.22,1.33,.37],[.08,.22,.06]],
  ['sphere',0xffd84a,[side*.17,1.07,.63],[.075,.085,.045]],['sphere',0x1c2426,[side*.165,1.06,.67],[.035,.045,.02]],['box',0x232c33,[side*.17,1.17,.65],[.17,.04,.04],[0,0,side*-.45]]);
 return {body:solid(parts),leg:solid([['box',dark,[0,-.23,0],[.13,.46,.16]],['sphere',dark,[0,-.45,.03],[.09,.05,.12]]])};
}
// Persistent decoration that makes every tower level look different (cached per level, never rebuilt).
function towerDeco(level,corn,H){
 const gold=0xf6c443,red=0xe2503f,teal=0x35b8ad,stone=0xcfc8b2,parts=[],pole=(x,z,top,color)=>{
  parts.push(['cyl',0x8a5a2e,[x,(.62+top)/2*H,z],[.022*H,(top-.62)*H,.022*H]],['sphere',gold,[x,top*H,z],.04*H],
   ['box',color,[x+.085*H,(top-.075)*H,z],[.15*H,.1*H,.012*H]],['cone',color,[x+.19*H,(top-.075)*H,z],[.058*H,.07*H,.008*H],[0,0,-Math.PI/2]]);
 };
 if(!corn){
  if(level>=2){pole(-.2*H,-.2*H,1.16,red);parts.push(['cyl',stone,[0,.035*H,0],[.4*H,.07*H,.4*H]])}
  if(level>=3)for(const [x,z,sx,sz] of [[0,.25,.52,.035],[0,-.27,.52,.035],[.25,0,.035,.52],[-.25,0,.035,.52]])parts.push(['box',gold,[x*H,.6*H,z*H],[sx*H,.05*H,sz*H]]);
  if(level>=4){pole(.2*H,-.2*H,1.1,teal);for(const side of [-1,1])parts.push(['cyl',red,[side*.19*H,.33*H,.235*H],[.075*H,.02*H,.075*H],[Math.PI/2,0,0]],['cyl',gold,[side*.19*H,.33*H,.25*H],[.04*H,.02*H,.04*H],[Math.PI/2,0,0]])}
  if(level>=5){parts.push(['cyl',gold,[0,.1*H,0],[.44*H,.05*H,.44*H]],['gem',gold,[-.2*H,1.26*H,-.2*H],[.075*H,.1*H,.075*H]],['gem',0xfff2a8,[.2*H,1.2*H,-.2*H],[.06*H,.085*H,.06*H]]);
   for(const [x,z] of [[-.24,.23],[.24,.23],[-.24,-.25],[.24,-.25]])parts.push(['sphere',gold,[x*H,.67*H,z*H],.045*H])}
 }else{
  if(level>=4){pole(-.2*H,-.2*H,1.12,gold);parts.push(['cyl',stone,[0,.035*H,0],[.4*H,.07*H,.4*H]])}
  if(level>=5){parts.push(['cyl',gold,[0,.1*H,0],[.44*H,.05*H,.44*H]],['gem',gold,[-.2*H,1.22*H,-.2*H],[.07*H,.095*H,.07*H]]);
   for(const [x,z,sx,sz] of [[0,.25,.52,.035],[0,-.27,.52,.035],[.25,0,.035,.52],[-.25,0,.035,.52]])parts.push(['box',gold,[x*H,.6*H,z*H],[sx*H,.05*H,sz*H]])}
 }
 return parts.length?solid(parts):null;
}
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

async function start(){
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0xb3cc91);renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const canvas=renderer.domElement;canvas.id='villageCanvas';canvas.setAttribute('role','img');canvas.setAttribute('aria-label','닭과 농부가 일하고 늑대가 다가오는 꼬꼬마을');
 const world=new THREE.Scene();world.add(new THREE.HemisphereLight(0xfff5de,0x6d8c57,2.2));
 const sun=new THREE.DirectionalLight(0xffe5bb,2.8);sun.position.set(6,12,8);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
 Object.assign(sun.shadow.camera,{left:-13,right:13,top:13,bottom:-13});sun.shadow.normalBias=.05;world.add(sun);
 // Mirrored isometric view: the lane climbs from the gate (bottom-left) to the wolf thicket (right), clear of both HUD corners.
 const EYE=new V3(-9,14,16),camera=new THREE.OrthographicCamera(-9,9,9,-9,.1,80);camera.position.copy(EYE);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const camRight=new V3().setFromMatrixColumn(camera.matrixWorld,0),camUp=new V3().setFromMatrixColumn(camera.matrixWorld,1);
 const facing=camera.quaternion.clone(),lying=new THREE.Quaternion().setFromAxisAngle(new V3(1,0,0),-Math.PI/2);
 let fxScale=1;                                          // effect sprites grow on small screens so a build still reads at phone size
 const resize=()=>{const w=host.clientWidth||1,h=host.clientHeight||1,aspect=w/h,half=Math.max(5.6,6.4/aspect);fxScale=clamp(44*2*half*aspect/w,1,1.4);camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();renderer.setSize(w,h,false)};
 const [grass,pack,atlas]=await Promise.all([new THREE.TextureLoader().loadAsync(ART+'backgrounds/grass.png'),new GLTFLoader().loadAsync('art-handoff/coopnight/source-3d/models/environment-pack.glb'),makeAtlas()]);

 /* ----- ground: tiled meadow + one merged decal mesh (lane, yard, pads, flowers) ----- */
 grass.colorSpace=THREE.SRGBColorSpace;grass.wrapS=grass.wrapT=THREE.RepeatWrapping;grass.repeat.set(20,20);grass.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
 const meadow=new THREE.PlaneGeometry(60,60,40,40).toNonIndexed();
 {const n=meadow.attributes.position.count,c=new Float32Array(n*3);for(let i=0;i<n;i++){const tile=Math.floor(i/6),dark=(tile%40+Math.floor(tile/40))%2;c[i*3]=dark?.86:1;c[i*3+1]=dark?.93:1;c[i*3+2]=dark?.8:1}meadow.setAttribute('color',new THREE.BufferAttribute(c,3))}
 const land=new THREE.Mesh(meadow,new THREE.MeshStandardMaterial({map:grass,vertexColors:true,color:0xe9f0cf,roughness:1}));land.rotation.x=-Math.PI/2;land.receiveShadow=true;world.add(land);
 const decor=new THREE.Mesh(groundDecor(),lit);decor.receiveShadow=true;world.add(decor);

 /* ----- models ----- */
 const node=name=>pack.scene.getObjectByName(name),one=(name,height)=>bake(node(name),height).main.geometry;
 const G={coop:one('EnvCoop',2.7),market:one('EnvMarket',2.6),tower:one('EnvTower',TOWER.h),corn:one('EnvCornTower',CORN.h),gate:one('EnvGate',1.25),
  hen:one('EnvChicken',.95),tree:one('EnvTree',1),bush:one('EnvBush',.7),rock:one('EnvRock',.5),panel:one('EnvFence',.85)};
 G.fence=fuse([G.panel.clone().translate(-.497,0,0),G.panel.clone().translate(.497,0,0)]);
 const actors=[];
 function wrap(obj,x,z,ry=0,s=1,skin=[obj]){obj.rotation.order='YXZ';world.add(obj);const a={obj,skin,x,y:0,z,ry,s,lift:0,sx:1,sy:1,tilt:0,pitch:0,spin:0,flash:0,shy:false,mat:lit};actors.push(a);return a}
 function actor(geometry,x,z,ry=0,s=1){const mesh=new THREE.Mesh(geometry,lit);mesh.castShadow=mesh.receiveShadow=true;return wrap(mesh,x,z,ry,s)}
 function pose(a,dt){
  a.obj.position.set(a.x,a.y+a.lift,a.z);a.obj.rotation.set(a.pitch,a.ry+a.spin,a.tilt);a.obj.scale.set(a.s*a.sx,a.s*a.sy,a.s*a.sx);
  a.lift=a.tilt=a.pitch=a.spin=0;a.sx=a.sy=1;
  if(a.flash>0)a.flash-=dt;
  const m=a.flash>0?hot:a.shy?shy:lit;if(m!==a.mat){a.mat=m;for(const mesh of a.skin)mesh.material=m}
 }
 const dummy=new THREE.Object3D();
 function scatter(geometry,list,shadow=true){
  const mesh=new THREE.InstancedMesh(geometry,lit,list.length);
  list.forEach(([x,z,s=1,ry=0],i)=>{dummy.position.set(x,0,z);dummy.rotation.set(0,ry,0);dummy.scale.setScalar(s);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix)});
  mesh.castShadow=shadow;mesh.receiveShadow=true;world.add(mesh);return mesh;
 }
 const home=actor(G.coop,-2.8,-2.8),market=actor(G.market,4.2,-1.8),nursery=actor(G.coop,.6,-3.6,0,.74),gate=actor(G.gate,GATE_X,LANE_Z,Math.PI/2);
 const tower=actor(G.tower,TOWER.x,TOWER.z),corn=actor(G.corn,CORN.x,CORN.z);
 const trim=owner=>{const mesh=new THREE.Mesh(PRIM.box,lit);mesh.castShadow=true;mesh.visible=false;owner.obj.add(mesh);owner.skin.push(mesh);return mesh};
 const towerTrim=trim(tower),cornTrim=trim(corn),trimCache=new Map();
 const fences=[];for(let i=0;i<6;i++){const f=actor(G.fence,fenceX(i),FENCE_Z);f.obj.visible=false;fences.push(f)}
 const rail=[];for(let i=0;i<14;i++)rail.push([-5.5+i*.993,-5.4]);for(let i=0;i<8;i++)rail.push([7.4,-4.9+i*.993,1,Math.PI/2]);for(let i=0;i<3;i++)rail.push([GATE_X,2.75-i*.993,1,Math.PI/2]);
 scatter(G.panel,rail);
 const TREES=[[-3,-7,3.6],[-.5,-8.6,4],[2,-7,3.4],[4.6,-7.5,3.9],[.5,-10.6,3.6],[7.2,-6.8,3.5],[3,-10.2,4],[8.9,-4.2,3.6],[5.5,2.7,3.3],[1.8,-11.6,3.7],[5.6,-10,3.5],[8.9,-7.8,3.8],[-5.8,-6.6,3.5],[6.9,4.3,3]];
 const trees=scatter(G.tree,TREES);
 scatter(G.bush,[[4.75,3.2,1.15],[4.9,5.05,1.1],[-4,6.5],[1.6,7.7],[-8.6,7.6],[-2,9.6],[2.6,10.6],[-6,10.8],[6.4,.7],[-6.6,-2.2],[2.6,-5.9],[-1.6,-5.9]]);
 scatter(G.rock,[[-1,6.3],[-6.7,6.4],[0,9],[6.3,-4.3],[-5,8.7],[3.4,6],[-7.6,1.2,.8]]);
 const flock=[];
 for(let i=0;i<SLOTS.length;i++){const c=actor(G.hen,SLOTS[i][0],SLOTS[i][1],i*2.1,.9+(i*37%10)*.012);
  Object.assign(c,{index:i,tx:SLOTS[i][0],tz:SLOTS[i][1],wait:.4+i*.3,busy:0,phase:i*1.7,hide:false});c.obj.visible=false;flock.push(c)}
 // Farmers: one rig, shared geometry; the base farmer is always there, two more can be hired.
 const farmerParts=bake(node('FarmerPolished'),1.9,['ArmL','ArmR','LegL','LegR']),eggGeo=solid([['sphere',0xfff3d3,[0,0,0],[.2,.27,.2]]]),farmers=[];
 for(let k=0;k<3;k++){
  const group=new THREE.Group(),skin=[],limbs=[];
  for(const [name,part] of Object.entries(farmerParts)){const mesh=new THREE.Mesh(part.geometry,lit);mesh.position.copy(part.pivot);mesh.castShadow=name==='main';group.add(mesh);skin.push(mesh);if(name!=='main')limbs.push(mesh)}
  const egg=new THREE.Mesh(eggGeo,lit);egg.position.set(0,2.28,0);egg.visible=false;group.add(egg);
  const a=wrap(group,FARM_HOME[k][0],FARM_HOME[k][1],0,1,skin);group.visible=k===0;
  farmers.push({k,a,limbs,egg,tx:a.x,tz:a.z,wait:.5+k*.8,carry:false,job:null,off:[0,.6,-.6][k],range:[[0,1],[0,.5],[.5,1]][k]});   // hired farmers keep to their own half of the path
 }
 // Wolves: two instanced meshes (bodies, legs) whatever the pack size; each wolf is a proxy object tree whose world matrices are copied in.
 const wolfGeo=wolfParts(),wolfBody=new THREE.InstancedMesh(wolfGeo.body,lit,WOLF_MAX),wolfLegs=new THREE.InstancedMesh(wolfGeo.leg,lit,WOLF_MAX*4);
 const PLAIN=new THREE.Color(1,1,1),FLASH=new THREE.Color(2.1,1.9,1.5);
 for(const m of [wolfBody,wolfLegs]){m.count=0;m.visible=false;m.frustumCulled=false;m.receiveShadow=true;m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);for(let i=0;i<m.instanceMatrix.count;i++)m.setColorAt(i,PLAIN);world.add(m)}
 wolfBody.castShadow=true;
 const wolves=[];
 for(let i=0;i<WOLF_MAX;i++){
  const group=new THREE.Object3D(),legs=[];group.rotation.order='YXZ';
  for(const x of [-.2,.2])for(const z of [-.35,.3]){const leg=new THREE.Object3D();leg.position.set(x,.51,z);group.add(leg);legs.push(leg)}
  wolves.push({i,group,legs,on:false,mode:'walk',x:0,z:0,fx:0,fz:0,ry:-Math.PI/2,age:9,amt:1,delay:0,run:1,hit:0,hop:0,stride:i*1.3,puff:0});
 }
 const malletGeo=solid([['cyl',0x9a6a3a,[0,.45,0],[.06,.9,.06]],['cyl',0xc98f52,[0,.95,0],[.2,.5,.2],[0,0,Math.PI/2]],['cyl',0x8a5a2e,[.26,.95,0],[.21,.04,.21],[0,0,Math.PI/2]],['cyl',0x8a5a2e,[-.26,.95,0],[.21,.04,.21],[0,0,Math.PI/2]]]);
 const mallets=[];

 /* ----- effect engine: dt-driven tweens + pooled sprites + camera shake ----- */
 const flatPool=makePool(atlas,96,true),airPool=makePool(atlas,440,false);world.add(flatPool.mesh,airPool.mesh);
 const particles=[],anims=[],MAX_PARTICLES=300;
 let shakeAmp=0,shakeAge=9,shakeNow=0;
 const DEFAULTS={cell:CELL.dust,flat:false,x:0,y:0,z:0,vx:0,vy:0,vz:0,gravity:0,drag:0,age:0,life:.6,delay:0,size:.5,end:-1,aspect:1,rot:0,spin:0,color:WHITE,alpha:1,add:0,fade:.5,pop:.1,fps:0,floor:false};
 function emit(o){if(reduced()||particles.length>=MAX_PARTICLES)return;particles.push({...DEFAULTS,...o})}
 // `update(u,t)` only writes transient pose channels; `done()` finalises state, so skipping straight to done is always safe.
 function tween(delay,dur,update,done){if(reduced()){done?.();return}anims.push({t:-delay,dur,update,done})}
 const after=(delay,fn)=>tween(delay,0,null,fn);
 function shake(amp){if(reduced())return;if(amp>=shakeNow){shakeAmp=amp;shakeAge=0;shakeNow=amp}}
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
  camera.position.copy(EYE).addScaledVector(camRight,Math.sin(shakeAge*78)*shakeNow).addScaledVector(camUp,Math.cos(shakeAge*61)*shakeNow*.8);
 }
 let sale=null,popUntil=-9;         // sale: the produce sequence currently playing (effects clock); popUntil: reduced-motion still frame
 function clearEffects(){for(const a of anims.splice(0))a.done?.();particles.length=0;shakeNow=0;shakeAge=9;camera.position.copy(EYE);sale=null}
 function drawParticles(){
  for(const p of particles){if(p.delay>0)continue;
   const u=p.age/p.life,size=(p.end<0?p.size:p.size+(p.end-p.size)*easeOut(u))*(p.pop>0?Math.min(1,u/p.pop):1)*fxScale,alpha=p.alpha*(u<p.fade?1:1-(u-p.fade)/(1-p.fade));
   const cell=p.fps?p.cell+Math.floor(p.age*p.fps)%4:p.cell;
   (p.flat?flatPool:airPool).push(p.flat?lying:facing,p.x,p.y,p.z,size,size*p.aspect,p.rot,cell,p.color[0],p.color[1],p.color[2],alpha,p.add);
  }
 }
 const sprite=(cell,x,y,z,sx,sy,color,alpha=1,add=0,rot=0)=>airPool.push(facing,x,y,z,sx,sy,rot,cell,color[0],color[1],color[2],alpha,add);
 const decal=(cell,x,z,size,color,alpha=1,add=0,y=.07)=>flatPool.push(lying,x,y,z,size,size,0,cell,color[0],color[1],color[2],alpha,add);

 /* ----- reusable effect pieces ----- */
 function dustBurst(x,z,n=10,power=1,delay=0){for(let i=0;i<n;i++){const a=i/n*6.283+span(-.25,.25),v=span(1.7,2.9)*power;
  emit({cell:CELL.dust,x:x+Math.cos(a)*.25,y:.2,z:z+Math.sin(a)*.25,vx:Math.cos(a)*v,vy:span(.5,1.3)*power,vz:Math.sin(a)*v,drag:3.4,life:span(.5,.8),size:.3*power,end:span(.75,1.05)*power,rot:span(0,6),spin:span(-1.5,1.5),color:DUST,alpha:.92,fade:.25,delay})}}
 function ringWave(x,z,size,color=WHITE,life=.45,delay=0,cell=CELL.ring,add=.35,y=.07){emit({cell,flat:true,x,y,z,size:size*.15,end:size,life,delay,color,add,fade:.3,pop:0,rot:span(0,6)})}
 function telegraph(x,z,size,color=GOLD){emit({cell:CELL.halo,flat:true,x,y:.08,z,size:size*1.5,end:size*.55,life:.16,color,add:.6,fade:.75,pop:.25});emit({cell:CELL.glow,flat:true,x,y:.075,z,size:size*.4,end:size*1.2,life:.2,color,add:.8,fade:.4,pop:.2})}
 function sparkles(x,y,z,n,spread,color=GOLD,delay=0,window=.5){for(let i=0;i<n;i++)emit({cell:i%3?CELL.sparkle:CELL.star,x:x+span(-spread,spread),y:y+span(-.2,.5),z:z+span(-spread,spread)*.6,vy:span(.5,1.3),life:span(.6,1),delay:delay+span(0,window),size:span(.22,.4),end:.04,spin:span(-3,3),rot:span(0,3),color:i%4?color:WHITE,add:.55,fade:.4,pop:.2})}
 function starBurst(x,y,z,n,power=1,colors=[GOLD,WHITE],delay=0){for(let i=0;i<n;i++){const a=i/n*6.283+span(-.2,.2),v=span(2.6,4.4)*power,cx=Math.cos(a)*v,cy=Math.sin(a)*v;
  emit({cell:CELL.star,x,y,z,vx:camRight.x*cx+camUp.x*cy,vy:camRight.y*cx+camUp.y*cy+1.2,vz:camRight.z*cx+camUp.z*cy,gravity:4.5,drag:1.6,life:span(.7,1.05),delay,size:span(.34,.52),end:.12,spin:span(-7,7),rot:span(0,6),color:colors[i%colors.length],add:.3,fade:.55})}}
 function featherBurst(x,y,z,n=9,power=1){for(let i=0;i<n;i++){const a=i/n*6.283+span(-.3,.3),v=span(1.4,2.6)*power,cx=Math.cos(a)*v,cy=Math.sin(a)*v*.8;
  emit({cell:CELL.feather+i%4,x,y,z,vx:camRight.x*cx+camUp.x*cy,vy:camRight.y*cx+camUp.y*cy+1.6,vz:camRight.z*cx+camUp.z*cy,gravity:2.2,drag:2.6,life:span(.9,1.35),size:span(.5,.74)*Math.min(1,power+.25),spin:span(-5,5),rot:span(0,6),color:WHITE,add:.28,fade:.6})}}
 function chipBurst(x,y,z,n=8){for(let i=0;i<n;i++){const a=span(0,6.283),v=span(1,2.4);
  emit({cell:CELL.solid,x,y,z,vx:Math.cos(a)*v,vy:span(3,5.2),vz:Math.sin(a)*v+.6,gravity:13,life:span(.55,.8),size:span(.16,.26),aspect:.38,spin:span(-14,14),rot:span(0,6),color:i%3?WOOD:CREAM,fade:.7,floor:true,pop:0})}}
 function flashAt(x,y,z,size,color=WHITE,delay=0){emit({cell:CELL.impact,x,y,z,size:size*.45,end:size,life:.17,delay,color,add:.45,fade:.45,pop:0,rot:span(0,6)});emit({cell:CELL.glow,x,y,z,size:size*.8,end:size*1.7,life:.22,delay,color,add:1,fade:.2,pop:0})}
 function pillar(x,z,height,width,color=GOLD,life=.6,delay=0){for(const [w,a] of [[width,.7],[width*.4,.62]])emit({cell:CELL.glow,x,y:height/2,z,size:w*.6,end:w,aspect:height*.795/w*1.6,life,delay,color:a<.7?WHITE:color,alpha:a,add:1,fade:.3,pop:.18})}
 function risingRings(x,z,height,size,color=GOLD,n=3,delay=0){for(let i=0;i<n;i++)emit({cell:CELL.ring,flat:true,x,y:.15,z,vy:height/.5,life:.5,delay:delay+i*.09,size:size*.7,end:size*(1.15-i*.12),color,add:.5,fade:.5,pop:.15,rot:i*2})}
 function coinPop(x,y,z,vx,vy,vz,delay=0,life=.95){emit({cell:CELL.coin,fps:14,x,y,z,vx,vy,vz,gravity:7,life,delay,size:.2,end:.5,color:WHITE,fade:.72,pop:.12})}
 function confetti(x,y,z,n,spread){const colors=[GOLD,RED,SKY,LEAF,PINK,WHITE];for(let i=0;i<n;i++)emit({cell:CELL.solid,x:x+span(-spread,spread),y:y+span(0,1.5),z:z+span(-spread,spread)*.7,vx:span(-.6,.6),vy:span(-.4,.8),vz:span(-.4,.4),gravity:1.8,drag:1.2,life:span(1.1,1.7),delay:span(0,.5),size:span(.14,.22),aspect:.55,spin:span(-9,9),rot:span(0,6),color:colors[i%colors.length],fade:.7})}
 function splash(x,z,n=10,power=1){for(let i=0;i<n;i++){const a=i/n*6.283+span(-.3,.3);
  emit({cell:CELL.dot,x:x+Math.cos(a)*.25,y:.15,z:z+Math.sin(a)*.25,vx:Math.cos(a)*span(.7,1.7)*power,vy:span(2.4,3.8)*power,vz:Math.sin(a)*span(.5,1.1)*power,gravity:11,life:span(.45,.7),size:span(.1,.16),color:i%3?SKY:WHITE,fade:.6,pop:0})}}
 // Pose helpers: all additive, so overlapping builds simply stack.
 function wobble(a,amp=.1,delay=0,dur=.55){tween(delay,dur,(u,t)=>{const w=settle(t,23,6.5)*amp;a.tilt+=Math.sin(t*23)*amp*Math.exp(-6.5*t);a.sy*=1-w*.6;a.sx*=1+w*.4})}
 function hop(a,height=.5,delay=0,dur=.36,turn=0){tween(delay,dur,u=>{a.lift+=4*height*u*(1-u);a.spin+=turn*easeOut(u);const land=u>.8?(u-.8)/.2:0,rise=u<.15?1-u/.15:0;a.sy*=1-.18*Math.sin(land*Math.PI)-.12*rise;a.sx*=1+.14*Math.sin(land*Math.PI)+.08*rise},()=>{a.ry+=turn})}
 function startle(x,z,radius,power=1,skip=null){
  for(const c of flock){if(c===skip||!c.obj.visible||c.busy>0||c.hide)continue;const d=Math.hypot(c.x-x,c.z-z);if(d<radius){c.wait=Math.max(c.wait,.5);hop(c,(.25+.3*(1-d/radius))*power,d*.03,.34)}}
  for(const f of farmers)if(f.a.obj.visible&&!f.job&&Math.hypot(f.a.x-x,f.a.z-z)<radius)hop(f.a,.22*power,.05,.3);
 }

 host.prepend(canvas);new ResizeObserver(resize).observe(host);resize();

 /* ----- facilities that only exist from the pulled state ----- */
 const hay=actor(solid([['cyl',0xe9c75a,[-.33,.3,0],[.3,.62,.3],[Math.PI/2,0,0]],['cyl',0xe9c75a,[.33,.3,0],[.3,.62,.3],[Math.PI/2,0,0]],['cyl',0xf4d877,[0,.82,0],[.3,.62,.3],[Math.PI/2,0,0]],
  ['cyl',0xc79a3a,[-.33,.3,0],[.31,.09,.31],[Math.PI/2,0,0]],['cyl',0xc79a3a,[.33,.3,0],[.31,.09,.31],[Math.PI/2,0,0]],['cyl',0xc79a3a,[0,.82,0],[.31,.09,.31],[Math.PI/2,0,0]]]),5.4,1.3,-.35);
 const barn=actor(G.coop,-5.7,.15,.35,.6),EXTRAS=[[nursery,1],[hay,2],[barn,3]];   // grow with the village hall level
 const pond=actor(pondGeometry(),POND.x,POND.z);pond.obj.castShadow=false;pond.obj.visible=false;
 const fish=actor(solid([['sphere',0xff9a3c,[0,0,0],[.11,.13,.26]],['cone',0xff7a2a,[0,0,-.3],[.03,.16,.13],[Math.PI/2,0,0]],['sphere',0x222a2c,[.08,.04,.15],.026],['sphere',0x222a2c,[-.08,.04,.15],.026]]),POND.x,POND.z,Math.PI/2);
 fish.obj.visible=false;fish.obj.castShadow=false;
 // Feast bunting: a mast on the coop roof strung to the nursery and a pole by the market; the second string runs to the barn.
 const garlands=[bunting([[-2.8,3.68,-2.8],[.6,1.95,-3.6],[2.0,2.1,-1.0]],.42,[[-2.8,-2.8,3.0,3.8],[2.0,-1.0,0,2.2]]),bunting([[-2.8,3.5,-2.8],[-5.7,1.55,.15]],.34)].map(({geometry,center})=>{
  const mesh=new THREE.Mesh(geometry,lit),a=wrap(mesh,center.x,center.z);a.y=center.y;mesh.visible=false;return a});

 /* ----- what the village shows (persistent), separate from the one-shot build effects ----- */
 let frames=0,time=0,pipPop=-9,applied=0,panicAt=-9,dirty=true,front=null;
 const KEYS={tower:'level',fence:'fence',chicken:'chickens',farmer:'farmers',pond:'pond',hall:'hall',feast:'feast'};
 const CAP={level:5,fence:6,chickens:8,farmers:2,pond:3,hall:3,feast:99,wins:1e6};
 const shown={level:0,chickens:0,fence:0,farmers:0,pond:0,hall:0,feast:0,wins:0,hidden:0},silent={},builds={tower:0,fence:0,chicken:0,farmer:0,pond:0,hall:0,feast:0};
 function setTrim(mesh,level,isCorn){const key=(isCorn?'c':'t')+level;if(!trimCache.has(key))trimCache.set(key,towerDeco(level,isCorn,isCorn?CORN.h:TOWER.h));const g=trimCache.get(key);mesh.visible=!!g;if(g)mesh.geometry=g}
 function applyLevel(level){applied=level;tower.obj.visible=level>=1;corn.obj.visible=level>=3;tower.s=TOWER_SCALE[level];corn.s=CORN_SCALE[level];setTrim(towerTrim,level,false);setTrim(cornTrim,level,true)}
 const raise=level=>{if(level>applied)applyLevel(level)};
 const APPLY={
  level:applyLevel,
  chickens:n=>flock.forEach((c,i)=>{const on=i<n;if(on&&!c.obj.visible){c.x=c.tx=SLOTS[i][0];c.z=c.tz=SLOTS[i][1]}c.obj.visible=on}),
  fence:n=>fences.forEach((f,i)=>{f.obj.visible=i<n}),
  farmers:n=>farmers.forEach((f,k)=>{const on=k<=n;if(on&&!f.a.obj.visible){f.a.x=f.tx=FARM_HOME[k][0];f.a.z=f.tz=FARM_HOME[k][1]}f.a.obj.visible=on}),
  pond:n=>{pond.obj.visible=n>0;pond.s=POND_R[n]||.001},
  hall:n=>{for(const [a,at] of EXTRAS)a.obj.visible=n>=at;home.s=1+n*.07},
  feast:n=>garlands.forEach((g,i)=>{g.obj.visible=n>i}),
  wins:()=>{}};
 // Which hens hide: the first `hidden` of them, so a newly bought hen (always the last one) never arrives in hiding.
 function applyHidden(n,cheer){flock.forEach((c,i)=>{const hide=c.obj.visible&&i<n;
  if(c.hide&&!hide){c.shy=false;c.wait=0;c.tx=span(YARD.x0,YARD.x1);c.tz=span(YARD.z0,YARD.z1);if(cheer){hop(c,.45,.1,.38);sparkles(c.x,.9,c.z,5,.4,PINK)}}
  c.hide=hide})}
 // Numbers that change without a build() call (saved game, reset) are simply shown: no effects.
 function sync(s,first=false){
  const next={};let changed=false,drop=false;
  for(const key in APPLY){next[key]=count(s[key],CAP[key]);if(next[key]!==shown[key]){changed=true;if(next[key]<shown[key])drop=true}}
  const hidden=Math.min(count(s.hidden,8),next.chickens);
  if(!first&&!changed&&hidden===shown.hidden)return false;
  if(drop)clearEffects();
  for(const key in APPLY){const v=next[key];if(first||v!==shown[key]){silent[key]=!first&&v===shown[key]+1?time:-9;shown[key]=v;APPLY[key](v)}}
  if(first||hidden!==shown.hidden){const before=shown.hidden;shown.hidden=hidden;applyHidden(hidden,!first&&hidden<before)}
  return true;
 }

 /* ----- build effects: telegraph -> impact -> afterglow. Final state is set first, so reduced motion is simply "done". ----- */
 function leap(a,u,h){a.lift+=4*h*u*(1-u);const land=u>.82?Math.sin((u-.82)/.18*Math.PI):0;a.sy*=1-.2*land;a.sx*=1+.15*land}
 function mallet(){let m=mallets.find(m=>!m.busy);if(!m&&mallets.length<3){m=actor(malletGeo,0,0,0,1.8);m.obj.receiveShadow=false;m.obj.visible=false;mallets.push(m)}if(m)m.busy=true;return m}
 function buildFence(i){           // hammered in: short and heavy
  const f=fences[i],x=f.x,z=f.z,T=.1,HIT=.36,R=1.71;f.obj.visible=true;
  const swing=t=>t<.24?-.6*easeOut(clamp((t-.12)/.12,0,1)):-.6+(Math.PI/2+.6)*easeIn(clamp((t-.24)/(HIT-.24),0,1));
  telegraph(x,z,2.6);
  tween(0,HIT+.6,(u,t)=>{
   if(t<T){f.sx*=.001;f.sy*=.001;return}
   if(t<HIT){const k=Math.max(.001,springy(t-T));f.sx*=k;f.sy*=k;f.lift+=clamp(R*Math.cos(swing(t)),0,.45);return}
   const w=settle(t-HIT,21,7);f.sy*=1-.4*w;f.sx*=1+.22*w;
  });
  const m=reduced()?null:mallet();
  if(m){m.x=x+R;m.y=1.21;m.z=z+.05;m.obj.visible=true;
   tween(0,.62,(u,t)=>{if(t<.12){m.sx*=.001;m.sy*=.001;return}const k=Math.min(1,(t-.12)/.07)*(t>.5?Math.max(.001,1-(t-.5)/.12):1);m.sx*=k;m.sy*=k;
    m.tilt+=t<HIT?swing(t):Math.PI/2-.6*Math.sin(Math.min(1,(t-HIT)/.14)*Math.PI/2)},()=>{m.obj.visible=false;m.busy=false})}
  after(HIT,()=>{f.flash=.09;flashAt(x,.95,z,1.7);dustBurst(x,z,10,.95);chipBurst(x,.75,z,8);ringWave(x,z,3.6,WHITE,.4,0,CELL.halo,.55);shake(.12);
   fences.forEach((o,j)=>{if(j!==i&&o.obj.visible)wobble(o,.16/Math.abs(j-i),Math.abs(j-i)*.07)});if(i===0)wobble(gate,.1,.05);startle(x,z,3.2,.9)});
  after(HIT+.2,()=>sparkles(x,.8,z,6,.9,GOLD,0,.6));
 }
 function buildChicken(c){         // pops out in a puff of feathers, hops, spins once, then joins the flock
  if(!c)return;
  const [x,z]=SLOTS[c.index],T=.1;c.x=c.tx=x;c.z=c.tz=z;c.ry=-.5;c.obj.visible=true;c.busy=1;
  telegraph(x,z,2,CREAM);
  tween(0,T+1.12,(u,t)=>{
   if(t<T){c.sx*=.001;c.sy*=.001;return}
   const q=t-T,k=Math.max(.001,springy(q))*(1+.55*Math.exp(-3.2*q));c.sx*=k;c.sy*=k;      // arrives oversized, then settles into the flock
   if(q<.38)leap(c,q/.38,.95);else if(q<.76){const v=(q-.38)/.38;leap(c,v,.62);c.spin+=6.283*v*v*(3-2*v)}else if(q<1.1)leap(c,(q-.76)/.34,.32);
  },()=>{c.busy=0;c.wait=.35});
  after(T,()=>{c.flash=.08;featherBurst(x,.6,z,10);flashAt(x,.5,z,1.5,CREAM);ringWave(x,z,2.6,WHITE,.36,0,CELL.halo,.55)});
  after(T+.38,()=>{dustBurst(x,z,7,.7);ringWave(x,z,2.4,GOLD,.35);shake(.06);startle(x,z,2.6,.8,c);featherBurst(x,.4,z,4,.6)});
  after(T+.76,()=>{dustBurst(x,z,5,.5);sparkles(x,.7,z,7,.6,GOLD,0,.6)});
  after(T+1.1,()=>dustBurst(x,z,3,.35));
 }
 function raiseTower(){            // level 1: the first tower erupts out of the ground
  const {x,z}=TOWER,H=TOWER.h,T=.14;raise(1);
  telegraph(x,z,3.4);emit({cell:CELL.ring,flat:true,x,y:.09,z,size:4.4,end:1.2,life:T+.03,color:GOLD,add:.5,fade:.8,pop:.3});
  tween(0,T+.75,(u,t)=>{if(t<T){tower.sx*=.001;tower.sy*=.001;return}const q=t-T,k=Math.max(.001,springy(q)),e=Math.exp(-9*q);tower.sy*=k*(1+.32*e);tower.sx*=k*(1-.2*e)});
  after(T,()=>{tower.flash=.1;pillar(x,z,5.2,1.7);risingRings(x,z,H*1.15,2.3);dustBurst(x,z,12,1.2);ringWave(x,z,5,GOLD,.5);ringWave(x,z,3.6,WHITE,.36,0,CELL.halo,.6);shake(.14);rattle(x,z,5.5,.1,tower);startle(x,z,4.6)});
  after(T+.17,()=>starBurst(x,H*1.2,z,12,1,[GOLD,WHITE,SKY]));
  after(T+.3,()=>{sparkles(x,H*.7,z,10,1,GOLD,0,.7);pipPop=time});
 }
 function rattle(x,z,radius,amp=.1,skip=null){
  for(const a of [home,market,nursery,hay,barn,gate,tower,corn,...fences]){if(a===skip||!a.obj.visible)continue;const d=Math.hypot(a.x-x,a.z-z);if(d<radius)wobble(a,amp*(1-d/radius*.7),d*.035)}
 }
 function boost(a,level,power=1){  // an existing tower squashes down, then shoots up into its new form
  const x=a.x,z=a.z,H=TOWER.h*a.s,T=.16;
  telegraph(x,z,3*power);
  tween(0,T+.7,(u,t)=>{if(t<T){const k=Math.sin(t/T*Math.PI/2);a.sy*=1-.24*k;a.sx*=1+.15*k;return}const w=settle(t-T,17,6);a.sy*=1+.36*power*w;a.sx*=1-.17*power*w});
  after(T,()=>{raise(level);pipPop=time;a.flash=.1;pillar(x,z,H*2.1,1.5*power);risingRings(x,z,H*1.2,2.2*power);dustBurst(x,z,8,power);ringWave(x,z,4.2*power,GOLD,.45);shake(.1*power);rattle(x,z,4.5,.07*power,a);startle(x,z,4*power,.8)});
  after(T+.12,()=>starBurst(x,H*1.25,z,Math.round(9*power),.9*power,[GOLD,WHITE]));
  after(T+.3,()=>sparkles(x,H*.7,z,8,1));
 }
 function dropCorn(){              // level 3: the second tower falls out of the sky
  const {x,z}=CORN,H=CORN.h,T=.16,HIT=.48;
  emit({cell:CELL.dot,flat:true,x,y:.08,z,size:.5,end:1.9,life:HIT,color:[0,0,0],alpha:.3,fade:.92,pop:0});
  emit({cell:CELL.halo,flat:true,x,y:.085,z,size:4.4,end:1.5,life:HIT,color:GOLD,add:.6,fade:.85,pop:.2});
  tween(0,HIT+.8,(u,t)=>{if(t<HIT){const k=clamp((t-T)/(HIT-T),0,1);corn.lift+=10*(1-k*k);corn.sy*=1.22;corn.sx*=.86;return}const w=settle(t-HIT,16,5.5);corn.sy*=1-.46*w;corn.sx*=1+.3*w});
  after(HIT,()=>{corn.flash=.12;flashAt(x,.5,z,2.6);dustBurst(x,z,14,1.5);ringWave(x,z,7,GOLD,.55);ringWave(x,z,5,WHITE,.4,0,CELL.halo,.6);chipBurst(x,.4,z,6);shake(.18);rattle(x,z,9,.15,corn);startle(x,z,10,1.25)});
  after(HIT+.1,()=>starBurst(x,H*1.15,z,12,1.05,[GOLD,WHITE,LEAF]));
  after(HIT+.3,()=>sparkles(x,H*.7,z,12,1.2,GOLD,0,.8));
 }
 function crown(){                 // level 5: both towers charge up and burst into their golden form
  const T=.24,mx=(TOWER.x+CORN.x)/2,mz=TOWER.z;
  for(const a of [tower,corn]){telegraph(a.x,a.z,3.6);emit({cell:CELL.ring,flat:true,x:a.x,y:.09,z:a.z,size:5,end:1.3,life:T,color:GOLD,add:.5,fade:.85,pop:.25});
   tween(0,T+.85,(u,t)=>{if(t<T){const k=Math.sin(t/T*Math.PI/2);a.sy*=1-.3*k;a.sx*=1+.2*k;a.tilt+=Math.sin(t*90)*.025*k;return}const w=settle(t-T,15,5);a.sy*=1+.46*w;a.sx*=1-.2*w})}
  after(T,()=>{raise(5);pipPop=time;for(const a of [tower,corn]){a.flash=.14;pillar(a.x,a.z,9,2.1,GOLD,.8);risingRings(a.x,a.z,TOWER.h*1.5,2.8,GOLD,4);dustBurst(a.x,a.z,9,1.3)}
   ringWave(mx,mz,17,GOLD,.75);ringWave(mx,mz,11,WHITE,.55,.05,CELL.halo,.6);shake(.18);rattle(mx,mz,14,.13);startle(mx,mz,20,1.3)});
  after(T+.14,()=>{starBurst(TOWER.x,TOWER.h*1.6,TOWER.z,12,1.15,[GOLD,WHITE]);starBurst(CORN.x,CORN.h*1.5,CORN.z,12,1.15,[GOLD,WHITE])});
  [[-4.6,4.6,-1.5,PINK],[2.6,5.2,-2.5,SKY],[-1,6,-3.5,LEAF]].forEach(([x,y,z,color],i)=>after(T+.34+i*.16,()=>{flashAt(x,y,z,1.6,color);starBurst(x,y,z,10,.9,[color,WHITE,GOLD])}));
  after(T+.2,()=>confetti(mx,5.5,0,34,5));
  after(T+.5,()=>{sparkles(TOWER.x,2,TOWER.z,8,1.1,GOLD,0,.9);sparkles(CORN.x,2,CORN.z,8,1.1,GOLD,0,.9)});
 }
 function popIn(a,T,dur=.75){tween(0,T+dur,(u,t)=>{if(t<T){a.sx*=.001;a.sy*=.001;return}const k=Math.max(.001,springy(t-T));a.sx*=k;a.sy*=k})}
 function buildFarmer(k){          // a hired farmer jumps out of a puff, spins once and waves
  const f=farmers[k];if(!f)return;const a=f.a,[x,z]=FARM_HOME[k],T=.1;
  a.obj.visible=true;a.x=f.tx=x;a.z=f.tz=z;a.ry=.4;f.wait=1.4;f.job=null;f.carry=false;
  telegraph(x,z,2.2,CREAM);popIn(a,T,.9);
  tween(T,.5,u=>{leap(a,u,.75);a.spin+=6.283*easeInOut(u)});
  after(T,()=>{a.flash=.08;flashAt(x,1,z,1.6,CREAM);ringWave(x,z,2.8,WHITE,.36,0,CELL.halo,.55);dustBurst(x,z,8,.8)});
  after(T+.5,()=>{dustBurst(x,z,6,.6);shake(.05);sparkles(x,1.7,z,8,.6,GOLD,0,.6);startle(x,z,2.6,.8)});
 }
 function fishJump(delay){         // a fish leaps across the pond
  const r=POND_R[shown.pond]||.62;if(!pond.obj.visible)return;
  tween(delay,.8,u=>{fish.obj.visible=true;fish.x=POND.x+(u-.5)*r*1.1;fish.z=POND.z+.05;fish.lift+=.05+4*1.25*u*(1-u);fish.pitch+=(u-.5)*2.6},()=>{fish.obj.visible=false});
  after(delay,()=>splash(POND.x-r*.55,POND.z,7,.8));
  after(delay+.8,()=>{splash(POND.x+r*.55,POND.z,9,.9);ringWave(POND.x+r*.55,POND.z,1.8,WHITE,.4,0,CELL.halo,.5,.06)});
 }
 function buildPond(n){            // the pond widens with a splash; a fish celebrates
  const x=POND.x,z=POND.z,r0=(POND_R[n-1]||0)/POND_R[n];APPLY.pond(n);
  telegraph(x,z,2.8,SKY);
  tween(0,.85,(u,t)=>{pond.sx*=Math.max(.001,r0+(1-r0)*springy(t))});
  after(.04,()=>{pond.flash=.08;ringWave(x,z,4.6*POND_R[n],SKY,.5,0,CELL.halo,.6,.06);ringWave(x,z,3.2*POND_R[n],WHITE,.42,.12,CELL.halo,.5,.06);splash(x,z,14,1.1);shake(.05)});
  fishJump(.3);after(.4,()=>sparkles(x,.6,z,8,.9,SKY,0,.6));
 }
 function buildHall(n){            // the village hall (home coop) swells up and a new building pops in beside the village
  APPLY.hall(n);const ex=(EXTRAS.find(([,at])=>at===n)||[])[0],T=.12;
  telegraph(home.x,home.z,3.8);
  tween(0,T+.75,(u,t)=>{if(t<T){const k=Math.sin(t/T*Math.PI/2);home.sy*=1-.18*k;home.sx*=1+.1*k;return}const w=settle(t-T,15,5.5);home.sy*=1+.28*w;home.sx*=1-.13*w});
  after(T,()=>{home.flash=.1;pillar(home.x,home.z,5.4,2.4);risingRings(home.x,home.z,3.2,2.8);dustBurst(home.x,home.z+1.2,10,1.1);shake(.1);rattle(home.x,home.z,5,.08,home);startle(home.x,home.z,5)});
  after(T+.2,()=>starBurst(home.x,3.6,home.z,12,1,[GOLD,WHITE,SKY]));
  if(ex){popIn(ex,.34);after(.34,()=>{ex.flash=.1;dustBurst(ex.x,ex.z,10,1);ringWave(ex.x,ex.z,4,GOLD,.45);sparkles(ex.x,1.2,ex.z,8,.9);startle(ex.x,ex.z,3.5)})}
 }
 function buildFeast(n){           // bunting snaps up, confetti rains and everybody hops
  APPLY.feast(n);const g=garlands[n===2?1:0],x=g.x,y=g.y,z=g.z;
  if(n<=2)popIn(g,.08,.7);else{wobble(garlands[0],.08);wobble(garlands[1],.08,.06)}
  after(.08,()=>{g.flash=.1;flashAt(x,y,z,2.4,PINK);starBurst(x,y+.3,z,14,1,[GOLD,PINK,SKY,LEAF]);confetti(x,y+.4,z,40,2.6);shake(.07)});
  after(.3,()=>{flock.forEach((c,i)=>{if(c.obj.visible&&!c.hide&&!c.busy)hop(c,.35,i*.05,.34)});farmers.forEach((f,k)=>{if(f.a.obj.visible&&!f.job)hop(f.a,.4,k*.07,.36)})});
  after(.45,()=>sparkles(x,y,z,10,1.6,GOLD,0,.7));
 }
 function play(kind,n){
  if(kind==='fence')return buildFence(n-1);
  if(kind==='chicken')return buildChicken(flock[n-1]);
  if(kind==='farmer')return buildFarmer(n);
  if(kind==='pond')return buildPond(n);
  if(kind==='hall')return buildHall(n);
  if(kind==='feast')return buildFeast(n);
  if(n<=1)return raiseTower();
  if(n===3){boost(tower,3,.75);return dropCorn()}
  if(n===5)return crown();
  boost(tower,n,1);if(n===4)boost(corn,n,.85);
 }
 function nudge(kind,n){           // build() for something already shown: a small acknowledgement only
  if(kind==='tower'&&n>0)wobble(tower,.06);
  else if(kind==='chicken'&&flock[n-1])hop(flock[n-1],.25);
  else if(kind==='fence'&&fences[n-1])hop(fences[n-1],.25);
  else if(kind==='farmer'&&farmers[n])hop(farmers[n].a,.25);
  else if(kind==='pond'&&n>0)ringWave(POND.x,POND.z,3,SKY,.4,0,CELL.halo,.5,.06);
  else if(kind==='hall')wobble(home,.05);
  else if(kind==='feast'&&n>0)confetti(garlands[0].x,garlands[0].y,garlands[0].z,14,2);
 }
 function spot(kind,n){
  if(kind==='tower')return n===3?new V3(CORN.x,CORN.h*.5,CORN.z):new V3(TOWER.x,TOWER.h*.55,TOWER.z);
  if(kind==='chicken'){const c=flock[clamp(n-1,0,7)];return new V3(c.x,.45,c.z)}
  if(kind==='fence'){const f=fences[clamp(n-1,0,5)];return new V3(f.x,.45,f.z)}
  if(kind==='farmer'){const a=farmers[clamp(n,0,2)].a;return new V3(a.x,1,a.z)}
  if(kind==='pond')return new V3(POND.x,.2,POND.z);
  if(kind==='hall'){const ex=EXTRAS[clamp(n-1,0,2)][0];return n>0?new V3(ex.x,1,ex.z):new V3(home.x,1.5,home.z)}
  const g=garlands[n===2?1:0];return new V3(g.x,g.y,g.z);
 }
 function build(kind){
  const key=KEYS[kind];if(!key)return null;
  const s=read(),target=count(s[key],CAP[key]),from=shown[key];
  if(target<from)sync(s);
  else if(target>from){shown[key]=target;for(let n=from+1;n<=target;n++){builds[kind]++;play(kind,n)}}
  else if(target>0&&time-(silent[key]??-9)<2){silent[key]=-9;builds[kind]++;play(kind,target)}   // the frame loop showed it a moment before build() arrived
  else nudge(kind,target);
  dirty=true;
  const v=spot(kind,Math.max(1,target)).project(camera);
  return {x:(v.x+1)/2,y:(1-v.y)/2};
 }

 /* ----- wolves: where they stand is a pure function of the pulled progress; effects only add pose ----- */
 const at={x:0,z:0};
 function laneSpot(i,p){const lead=SPAWN_X+(WOLF_END-SPAWN_X)*p;at.x=lead+i*(.55+.5*p);at.z=LANE_Z+(i?(i%2?-.4:.36):0);return at}
 // How a miss splits the pack: the leaders slip into the yard, the rest are shot down on the lane.
 function raidSplit(s,n){const r=s.raid;if(r&&(Number(r.shot)||0)+(Number(r.through)||0)>0){const through=count(r.through,n);return {through,shot:n-through}}const shot=Math.min(n,count(s.level,5));return {shot,through:n-shot}}
 let seenPhase='start',seenResult=null,seenProgress=0;
 function updateWolves(s,dt,still,less){
  const p=clamp(Number(s.progress)||0,0,1),n=!s.phase||s.phase==='start'?0:count(s.wolves,WOLF_MAX),result=s.result||null;
  const fresh=(seenPhase==='start'&&s.phase!=='start')||(seenResult&&!result)||p<seenProgress-.02;   // a new question: the pack starts over at the thicket
  seenPhase=s.phase;seenResult=result;seenProgress=p;
  const split=result==='miss'?raidSplit(s,n):null,puffs=!still&&!less;
  front=null;
  for(const w of wolves){
   const i=w.i;
   if(w.on&&(fresh||i>=n)){w.on=false;if(puffs)dustBurst(w.x,w.z,6,.6)}
   if(i>=n)continue;
   const lane=laneSpot(i,p),mode=result==='first'||result==='second'?'stun':split?(i<split.through?'in':'down'):'walk';
   if(!w.on){   // spawns at full size while paused or with reduced motion, otherwise springs in
    Object.assign(w,{on:true,mode,x:mode==='in'?IN[i][0]:lane.x,z:mode==='in'?IN[i][1]:lane.z,ry:mode==='in'?.6:-Math.PI/2,age:still||less?9:0,amt:1,run:1,delay:0,hit:0,hop:0});
    if(puffs)dustBurst(w.x,w.z,5,.55);
   }else if(w.mode!==mode){w.mode=mode;w.amt=less?1:0;if(mode==='in'){w.fx=w.x;w.fz=w.z;w.run=less?1:0}}
   const px=w.x,pz=w.z;
   if(dt>0){w.age+=dt;if(w.delay>0)w.delay=Math.max(0,w.delay-dt);else w.amt=Math.min(1,w.amt+dt/.22);if(w.hit>0)w.hit-=dt;if(w.hop>0)w.hop=Math.max(0,w.hop-dt)}
   if(less){w.amt=1;w.run=1;w.hop=0;w.delay=0}
   if(w.mode==='in'){
    const [ix,iz]=IN[i];
    if(w.run<1){if(dt>0&&w.delay<=0)w.run=Math.min(1,w.run+dt/.9);const u=easeInOut(w.run);w.x=w.fx+(ix-w.fx)*u;w.z=w.fz+(iz-w.fz)*u}
    else if(dt>0||less){w.x=ix;w.z=iz}
   }else if(w.mode==='walk'&&s.phase==='ask'&&!less){   // smooth the 10 Hz clock steps; converges onto the exact spot
    if(dt>0){const k=1-Math.exp(-dt*14);w.x+=(lane.x-w.x)*k;w.z+=(lane.z-w.z)*k;if(Math.abs(lane.x-w.x)<.003&&Math.abs(lane.z-w.z)<.003){w.x=lane.x;w.z=lane.z}}
   }else if(dt>0||less){w.x=lane.x;w.z=lane.z}
   const moved=Math.hypot(w.x-px,w.z-pz);w.stride+=moved*7;
   if(w.mode==='walk')w.ry=-Math.PI/2;
   else if(w.mode==='in'){if(w.run<1&&moved>1e-4)w.ry=Math.atan2(w.x-px,w.z-pz);else if(dt>0)turnTo(w,Math.atan2(-1.4-w.x,2.0-w.z),dt*6)}   // eyes on the hens, face turned toward the camera
   let y=0,roll=0,pitch=0,sy=1,legs=0;
   const walking=w.mode==='walk'||w.mode==='in';
   if(walking&&!less){y=Math.abs(Math.sin(w.stride))*.07;legs=Math.sin(w.stride)*.55;if(moved<1e-4)sy=1+.025*Math.sin(time*3+i)}
   if(w.mode==='in'&&w.run<1&&!less){const uc=clamp((w.fz-FENCE_Z)/Math.max(.01,w.fz-IN[i][1]),0,1),q=(easeInOut(w.run)-uc)/.2;y+=.9*Math.max(0,1-q*q)}   // leaps the fence line
   if(w.mode==='stun'){const a=easeOut(w.amt);roll=(i%2?.42:-.42)*a;pitch=-.15*a;sy*=1-.08*a;legs*=1-a}
   if(w.mode==='down'){const a=easeOut(w.amt);roll=(i%2?1.4:-1.4)*a;y+=.24*a;legs=.35*a}
   if(w.hop>0){const u=1-w.hop/.42;y+=4*.55*u*(1-u);pitch-=.3*Math.sin(u*Math.PI)}
   if(s.dash&&!less&&dt>0&&moved>.01&&(w.puff-=dt)<=0){w.puff=.12;emit({cell:CELL.dust,x:w.x+.5,y:.15,z:w.z,vx:span(.4,1),vy:span(.3,.8),vz:span(-.4,.4),drag:3,life:.45,size:.25,end:.7,color:DUST,alpha:.85,fade:.3})}
   const k=(w.age>.6||less?1:Math.max(.001,springy(w.age)))*(w.hit>0?1.1:1);
   w.group.position.set(w.x,y,w.z);w.group.rotation.set(pitch,w.ry,roll);w.group.scale.set(k,k*sy,k);
   for(let j=0;j<4;j++)w.legs[j].rotation.x=legs*(j===1||j===2?-1:1);
   w.group.updateMatrixWorld(true);
   if(w.mode==='walk'&&(!front||w.x<front.x))front=w;
  }
  let m=0;
  for(const w of wolves){if(!w.on)continue;const c=w.hit>0?FLASH:PLAIN;
   wolfBody.setMatrixAt(m,w.group.matrixWorld);wolfBody.setColorAt(m,c);
   for(let j=0;j<4;j++){wolfLegs.setMatrixAt(m*4+j,w.legs[j].matrixWorld);wolfLegs.setColorAt(m*4+j,c)}m++}
  wolfBody.count=m;wolfLegs.count=m*4;wolfBody.visible=wolfLegs.visible=m>0;
  for(const mesh of [wolfBody,wolfLegs]){mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true}
 }

 /* ----- one-shot effects pushed by the page ----- */
 // An egg lobbed from a tower (or, before there is a tower, from the coop roof) onto a wolf. Returns when it lands.
 function fire(k,to,delay,onHit){
  const a=applied>=1?(applied>=3&&k%2?corn:tower):home,H=a===home?2.6*home.s:TOWER.h*a.s;
  const from=a===home?{x:a.x+.9,y:H,z:a.z+.9}:{x:a.x,y:H*.74,z:a.z+H*.2},T=.42,g=12;
  after(delay,()=>{flashAt(from.x,from.y,from.z,.9,GOLD);if(a===home)wobble(home,.05);else tween(0,.22,(u,t)=>{const s=settle(t,30,9);a.sy*=1-.1*s;a.sx*=1+.07*s;a.pitch-=.08*s})});
  const fly={x:from.x,y:from.y,z:from.z,vx:(to.x-from.x)/T,vy:(to.y-from.y)/T+.5*g*T,vz:(to.z-from.z)/T,gravity:g,life:T,delay,pop:0,fade:.95};
  emit({...fly,cell:CELL.glow,size:.85,color:GOLD,add:1,alpha:.75});emit({...fly,cell:CELL.egg,size:.42,aspect:1.15,spin:18});
  after(delay+T,()=>{flashAt(to.x,to.y,to.z,1.5,GOLD);for(let i=0;i<5;i++)emit({cell:CELL.star,x:to.x,y:to.y,z:to.z,vx:span(-2,2),vy:span(1.5,3.2),vz:span(-1,1),gravity:8,life:.42,size:.3,end:.1,spin:9,color:GOLD,add:.3});onHit?.()});
  return delay+T;
 }
 function shootFx(){               // right answer: every wolf gets an egg and goes dizzy where it stands
  let k=0;for(const w of wolves){if(!w.on)continue;w.delay=fire(k,{x:w.x,y:.85,z:w.z},k*.12,()=>{w.hit=.14;dustBurst(w.x,w.z,5,.6)});k++}
 }
 function raidFx(e){               // wolves reached the village: the tower drops `shot` of them, the rest leap into the yard
  const n=wolves.filter(w=>w.on).length,through=count(e.through,n);let k=0;
  for(const w of wolves){if(!w.on)continue;
   if(w.i<through)w.delay=.15+w.i*.12;
   else{w.delay=fire(k,{x:w.x,y:.85,z:w.z},k*.14,()=>{w.hit=.14;dustBurst(w.x,w.z,7,.8);starBurst(w.x,.9,w.z,5,.6)});k++}}
  after(.2,()=>{gate.flash=.12;wobble(gate,.2);shake(.12);flashAt(GATE_X,.7,LANE_Z,2.2,RED);ringWave(GATE_X,LANE_Z,4,RED,.45,0,CELL.halo,.5)});
  if(through){panicAt=time+.75;after(.85,()=>{startle(-3,.8,6,1.1);featherBurst(-3.3,.6,.9,12,1);shake(.08)})}
 }
 function dashFx(){                // a wrong answer: the pack bounds forward (the distance itself comes from progress)
  for(const w of wolves){if(!w.on)continue;w.hop=.42;dustBurst(w.x,w.z,7,.75,w.i*.04)}shake(.06);
 }
 function produceFx(e){            // hens lay -> eggs fly into the farmers' baskets -> farmers run to the market -> coins
  const crew=farmers.filter(f=>f.a.obj.visible);if(!crew.length)return;
  sale={t:0};
  crew.forEach((f,k)=>{f.job={fx:f.a.x,fz:f.a.z,px:PICK[k][0],pz:PICK[k][1],mx:DROP[k][0],mz:DROP[k][1],lag:k*.07};f.carry=false;f.wait=0});
  const eggs=count(e.eggs,8),layers=flock.filter(c=>c.obj.visible&&!c.hide&&!c.busy);
  for(let i=0;layers.length&&i<eggs;i++){
   const c=layers[i%layers.length],j=crew[i%crew.length].job,d=.04+i*.045+(i>=layers.length?.18:0);
   c.wait=Math.max(c.wait,.9);
   tween(d,.42,(u,t)=>{const s=Math.sin(Math.min(1,t/.16)*Math.PI);c.sy*=1-.3*s;c.sx*=1+.2*s;if(t>.16)c.lift+=.28*Math.sin((t-.16)/.26*Math.PI)});
   after(d+.14,()=>{const x=c.x,y=.5,z=c.z,T=Math.max(.2,.64-(d+.14)),g=9;flashAt(x,.6,z,.7,CREAM);
    emit({cell:CELL.egg,x,y,z,vx:(j.px-x)/T,vy:(2.15-y)/T+.5*g*T,vz:(j.pz-z)/T,gravity:g,life:T,size:.3,end:.38,aspect:1.15,spin:5,color:WHITE,fade:.97,pop:.15})});
  }
  if((Number(e.fish)||0)>0)fishJump(.12);
  after(.66,()=>crew.forEach(f=>sparkles(f.a.x,2.3,f.a.z,3,.3,CREAM,0,.15)));
  after(1.55,()=>{const {x,z}=MARKET_FRONT;wobble(market,.1);market.flash=.1;flashAt(x,1.8,z,2.2,GOLD);ringWave(x,z,3.4,GOLD,.45);
   const n=clamp(Math.round(3+(Number(e.gold)||0)/12),4,12);for(let i=0;i<n;i++){const a=i/n*6.283;coinPop(x,2,z,Math.cos(a)*1.3,span(4,5.2),Math.sin(a)*.8,i*.03,1)}
   sparkles(x,2.4,z,6,1,GOLD,.15,.5);shake(.05)});
  after(1.6,()=>crew.forEach((f,k)=>hop(f.a,.38,k*.05,.34)));
 }
 function events(list){
  if(!Array.isArray(list))return;const s=read();if(s.paused)return;const less=reduced();
  for(const e of list){if(!e||typeof e!=='object')continue;
   if(e.type==='produce'){if(less)popUntil=time+1.4;else produceFx(e)}
   else if(less)continue;
   else if(e.type==='shoot')shootFx();
   else if(e.type==='raid')raidFx(e);
   else if(e.type==='dash')dashFx();
  }
  dirty=true;
 }
 window.VillageView={events,reward(){},build,upgrade:()=>build('tower'),
  inspect(){const on=wolves.filter(w=>w.on);return {ready:true,time,level:shown.level,wins:shown.wins,hall:shown.hall,farmers:shown.farmers,pond:shown.pond,feast:shown.feast,
   hidden:flock.filter(c=>c.obj.visible&&c.hide).length,hiding:flock.filter(c=>c.obj.visible&&c.shy).length,
   extraBuildings:EXTRAS.filter(([a])=>a.obj.visible).length,towers:Number(tower.obj.visible)+Number(corn.obj.visible),
   residents:flock.filter(c=>c.obj.visible).map(c=>c.obj.position.toArray()),farmer:farmers[0].a.obj.position.toArray(),farmerActors:farmers.filter(f=>f.a.obj.visible).length,
   enemies:on.length,wolvesVisible:on.length,wolfX:on.map(w=>w.x),wolfModes:on.map(w=>w.mode),wolfScale:on.map(w=>w.group.scale.x),sale:!!sale||time<popUntil,
   pondVisible:pond.obj.visible,garlands:garlands.filter(g=>g.obj.visible).length,drawCalls:renderer.info.render.calls,
   chickens:flock.filter(c=>c.obj.visible).length,fences:fences.filter(f=>f.obj.visible).length,towerLevel:applied,frames,builds:{...builds},effects:particles.length+anims.length,shake:shakeNow,
   memory:{geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures}}}};

 /* ----- input: tapping is only ever cosmetic ----- */
 const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),probe=new V3();
 canvas.addEventListener('pointerup',e=>{try{
  const s=read();if(s.paused)return;const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);
  for(const a of [tower,corn])if(a.obj.visible&&raycaster.intersectObject(a.obj,true).length){wobble(a,.08);sparkles(a.x,TOWER.h*a.s,a.z,4,.5);dirty=true;return}
  if(reduced())return;
  let best=null,near=36;
  for(const c of flock){if(!c.obj.visible||c.busy||c.hide)continue;probe.set(c.x,.4,c.z).project(camera);const d=Math.hypot((probe.x-pointer.x)*r.width/2,(probe.y-pointer.y)*r.height/2);if(d<near){near=d;best=c}}
  if(best){hop(best,.55,0,.4);best.wait=Math.max(best.wait,.6);featherBurst(best.x,.5,best.z,3,.6)}
 }catch{}});
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();renderer.setAnimationLoop(null);useFallback()});

 /* ----- daily life ----- */
 function turnTo(a,target,rate){let d=(target-a.ry)%6.283;if(d>Math.PI)d-=6.283;if(d<-Math.PI)d+=6.283;a.ry+=d*Math.min(1,rate)}
 function roam(c,dt){
  if(c.busy)return;
  if(c.wait>0){c.wait-=dt;c.lift+=Math.abs(Math.sin(time*3+c.phase))*.03;const peck=(time*.9+c.phase)%2.4;if(peck<.5)c.pitch+=Math.sin(peck/.5*Math.PI)*.55;return}
  const dx=c.tx-c.x,dz=c.tz-c.z,d=Math.hypot(dx,dz);
  if(d<.06){c.wait=span(.7,2.4);c.tx=span(YARD.x0,YARD.x1);c.tz=span(YARD.z0,YARD.z1);return}
  const step=Math.min(d,.8*dt);c.x+=dx/d*step;c.z+=dz/d*step;turnTo(c,Math.atan2(dx,dz),dt*9);
  c.lift+=Math.abs(Math.sin(time*10+c.phase))*.07;c.tilt+=Math.sin(time*10+c.phase)*.06;
 }
 // Hidden hens run (once the wolves are in) to their spot by the coop, then crouch, pale and trembling, facing the wall.
 function henLife(dt,less){
  for(const c of flock){if(!c.obj.visible)continue;
   const [hx,hz]=HIDE[c.index];
   if(c.hide){
    if(less){c.x=hx;c.z=hz;c.ry=Math.atan2(home.x-hx,home.z-hz);c.shy=true;c.sy*=.62;c.sx*=1.12;continue}
    if(c.busy)continue;
    if(time<panicAt&&!c.shy){roam(c,dt);continue}
    const dx=hx-c.x,dz=hz-c.z,d=Math.hypot(dx,dz);
    if(d>.05){const step=Math.min(d,2.6*dt);c.x+=dx/d*step;c.z+=dz/d*step;turnTo(c,Math.atan2(dx,dz),dt*12);c.lift+=Math.abs(Math.sin(time*16+c.phase))*.12;c.tilt+=Math.sin(time*16+c.phase)*.12;c.shy=false}
    else{c.shy=true;turnTo(c,Math.atan2(home.x-c.x,home.z-c.z),dt*6);c.sy*=.62;c.sx*=1.12;c.tilt+=Math.sin(time*30+c.phase)*.035}
   }else{
    c.shy=false;
    if(less){if(Math.hypot(c.x-hx,c.z-hz)<.3){c.x=c.tx=SLOTS[c.index][0];c.z=c.tz=SLOTS[c.index][1]}continue}
    roam(c,dt);
   }
  }
 }
 const WALK_A=new V3(-2.5,0,-.95),WALK_B=new V3(3.4,0,.25);
 function farmerIdle(f,dt){        // strolls the coop-market path, carrying an egg on the way to the market
  const a=f.a;if(f.wait>0){f.wait-=dt;return false}
  const dx=f.tx-a.x,dz=f.tz-a.z,d=Math.hypot(dx,dz);
  if(d<.05){const [u0,u1]=f.range,u=span(u0,u1),side=f.off+span(-.25,.25);f.wait=span(.8,2.2);f.tx=WALK_A.x+(WALK_B.x-WALK_A.x)*u-.2*side;f.tz=WALK_A.z+(WALK_B.z-WALK_A.z)*u+side;f.carry=f.tx>a.x+.5;return false}
  const step=Math.min(d,.95*dt);a.x+=dx/d*step;a.z+=dz/d*step;turnTo(a,Math.atan2(dx,dz),dt*7);return true;
 }
 function farmersLife(dt,less){
  if(sale&&!less){sale.t+=dt;if(sale.t>=SALE_END)sale=null}
  for(const f of farmers){const a=f.a;if(!a.obj.visible)continue;let moving=false,run=false;
   if(f.job&&sale&&!less){
    const j=f.job,t=Math.max(0,sale.t-j.lag);let x,z,face=null;
    if(t<.5){const u=easeInOut(t/.5);x=j.fx+(j.px-j.fx)*u;z=j.fz+(j.pz-j.fz)*u;run=moving=Math.hypot(j.px-j.fx,j.pz-j.fz)>.05}
    else if(t<.66){x=j.px;z=j.pz;a.pitch+=.35*Math.sin((t-.5)/.16*Math.PI)}                   // scoops the eggs into the basket
    else if(t<1.5){const u=easeInOut((t-.66)/.84);x=j.px+(j.mx-j.px)*u;z=j.pz+(j.mz-j.pz)*u;run=moving=true;f.carry=true}
    else{x=j.mx;z=j.mz;f.carry=t<1.58;face=Math.atan2(market.x-x,market.z-z)}
    const dx=x-a.x,dz=z-a.z;if(Math.hypot(dx,dz)>.004)turnTo(a,Math.atan2(dx,dz),dt*14);else if(face!==null)turnTo(a,face,dt*8);
    a.x=x;a.z=z;
   }else{
    if(f.job){f.job=null;f.carry=false;f.tx=a.x;f.tz=a.z;f.wait=span(.4,1)}
    if(!less)moving=farmerIdle(f,dt);
   }
   const pace=run?14:7;
   f.limbs.forEach((limb,i)=>{limb.rotation.x=moving&&!less?Math.sin(time*pace+f.k+(i===1||i===2?Math.PI:0))*(run?.7:.42):0});
   if(moving&&!less)a.lift+=Math.abs(Math.sin(time*pace+f.k))*(run?.08:.045);
   f.egg.visible=f.carry;f.egg.position.y=2.28+(less?0:Math.sin(time*3+f.k)*.04);
  }
 }
 function sway(){TREES.forEach(([x,z,h],i)=>{dummy.position.set(x,0,z);dummy.rotation.set(0,0,Math.sin(time*.8+x+z)*.022);dummy.scale.setScalar(h);dummy.updateMatrix();trees.setMatrixAt(i,dummy.matrix)});trees.instanceMatrix.needsUpdate=true}
 function aim(a,target,dt){a.aim=(a.aim||0)+((target?clamp(Math.atan2(target.x-a.x,target.z-a.z),-1.2,1.2):0)-(a.aim||0))*Math.min(1,dt*7);a.spin+=a.aim}

 /* ----- always-on sprites: level stars, wolf glow, dizzy stars, pond ripples, smoke (not counted as effects) ----- */
 const BROWN=tint(0x7a4a12);
 function ambient(less){
  const t=less?0:time;
  if(!less)for(let i=0;i<3;i++){const cycle=(t*.22+i/3)%1;sprite(CELL.glow,home.x-.55+Math.sin(t+i)*.13,2.75*home.s+cycle*1.3,home.z-.3,.45+cycle*.7,.45+cycle*.7,WHITE,(1-cycle)*.5)}
  if(applied>=1&&tower.obj.scale.y>.5*tower.s){
   const y=TOWER.h*tower.s*(applied>=2?1.24:1.06)+.42,q=time-pipPop,pulse=q>=0&&q<.8&&!less?1+1.1*Math.exp(-6*q)*Math.abs(Math.cos(14*q)):1;
   for(let i=0;i<applied;i++){const off=(i-(applied-1)/2)*.4,x=TOWER.x+camRight.x*off,z=TOWER.z+camRight.z*off,k=i===applied-1?pulse:1;
    sprite(CELL.star,x,y,z,.52*k,.52*k,BROWN);sprite(CELL.star,x,y,z,.36*k,.36*k,applied>=5?WHITE:GOLD)}
  }
  if(applied>=5)for(const a of [tower,corn]){decal(CELL.glow,a.x,a.z,3.4,GOLD,.3+.1*Math.sin(t*3),.9);
   for(let i=0;i<3;i++){const ang=t*1.4+i*2.09+a.x;sprite(CELL.sparkle,a.x+Math.cos(ang)*.95,1.1+i*.75+Math.sin(t*2+i)*.2,a.z+Math.sin(ang)*.5,.34,.34,GOLD,.55+.45*Math.sin(t*4+i*2),.6)}}
  for(const w of wolves){if(!w.on)continue;
   if(w.mode==='walk'||w.mode==='in')decal(CELL.glow,w.x,w.z,1.8,RED,.36);
   else if(w.amt>.3){const down=w.mode==='down',hx=w.x+Math.sin(w.ry)*(down?.3:.42),hz=w.z+Math.cos(w.ry)*(down?.3:.42),hy=down?.78:1.62;
    for(let j=0;j<3;j++){const ang=t*4.2+j*2.094+w.i,x=hx+Math.cos(ang)*.34,y=hy+Math.sin(ang*2)*.05,z=hz+Math.sin(ang)*.24;sprite(CELL.star,x,y,z,.3,.3,BROWN);sprite(CELL.star,x,y,z,.21,.21,GOLD)}}
  }
  if(pond.obj.visible&&!less)for(let j=0;j<2;j++){const cyc=(t*.3+j*.5)%1;decal(CELL.halo,POND.x+.12-j*.3,POND.z-.08+j*.2,pond.s*(.7+cyc*1.3),WHITE,(1-cyc)*.22,.2,.06)}
  for(const c of flock)if(c.obj.visible&&c.shy){const cyc=(t*.8+c.phase)%1;sprite(CELL.dot,c.x+camRight.x*.24,.92-cyc*.22,c.z+camRight.z*.24,.09,.13,SKY,less?.9:1-cyc*.8)}
  if(time<popUntil){const {x,z}=MARKET_FRONT;sprite(CELL.glow,x,2.1,z,1.7,1.7,GOLD,.5,1);for(let i=0;i<3;i++)sprite(CELL.coin,x+camRight.x*(i-1)*.5,2.1+(i%2)*.28,z+camRight.z*(i-1)*.5,.5,.5,WHITE)}
 }

 /* ----- frame loop: 30fps cap, dt-driven, frozen while paused ----- */
 let last=0,wasLess=reduced();   // frames: processed-frame counter for tests (inspect().frames)
 {const s=read();sync(s,true);updateWolves(s,0,true,reduced());henLife(0,reduced());for(const a of actors)pose(a,0)}
 host.classList.add('is3d');host.dataset.renderer='three';
 function frame(now){
  if(last&&now-last<1000/30)return;
  const dt=Math.min(.05,last?(now-last)/1000:0);last=now;frames++;
  const s=read(),still=!!s.paused||document.hidden,less=reduced();
  if(!still)time+=dt;
  host.classList.toggle('village-paused',still);host.dataset.phase=s.phase||'';
  if(less&&!wasLess){clearEffects();dirty=true}wasLess=less;
  if(sync(s))dirty=true;
  updateWolves(s,still?0:dt,still,less);
  if(!still){
   henLife(dt,less);farmersLife(dt,less);
   if(!less){sway();aim(tower,front,dt);aim(corn,front,dt);stepEffects(dt)}
   // the light dims as the wolves close in, and stays dim while they are in the yard
   const sunTarget=s.phase==='ask'?2.8-.8*clamp(Number(s.progress)||0,0,1):s.phase==='learn'&&s.result==='miss'?2.0:2.8;
   sun.intensity=THREE.MathUtils.lerp(sun.intensity,sunTarget,less?1:Math.min(1,dt*2));
  }else if(dirty)henLife(0,less);
  if(!still||dirty){for(const a of actors)pose(a,dt);dirty=false}
  flatPool.begin();airPool.begin();ambient(less);drawParticles();flatPool.end();airPool.end();
  if(!document.hidden)renderer.render(world,camera);
 }
 let broken=false;
 renderer.setAnimationLoop(now=>{if(broken)return;try{frame(now)}catch(error){broken=true;renderer.setAnimationLoop(null);useFallback();console.warn('Village renderer stopped:',error.message)}});
}
start().catch(error=>{useFallback();console.warn('Village renderer unavailable:',error.message)});
