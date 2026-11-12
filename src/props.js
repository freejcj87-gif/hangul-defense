// 0.9 village props, all procedural (no new art files): tower storeys, the farmers' egg basket, fence layers (double rails,
// stone wall), market tiers (stall -> roofed shop -> tent market -> big market), the egg nests by the hall, and what each
// hall stage adds to the village (dirt paths, lanterns, hay, feast flags). Everything is vertex-coloured for the shared material.
import * as THREE from 'three';
import { prep, solid, flat, merge } from './geo.js';

const V3=THREE.Vector3;
const rot=(x,y,z)=>[x,y,z];

/* ---------- tower storey: a stone drum the wooden lookout tower stands on (one per extra floor) ---------- */
export const STOREY_H=.78;
export function storeyGeometry(r){
 const h=STOREY_H,stone=0xd9cfb6,dark=0xb7ab8f,wood=0x8a5a2e,parts=[
  ['taper',stone,[0,h*.46,0],[r,h*.92,r],rot(Math.PI,0,0)],
  ['cyl8',dark,[0,.05,0],[r*1.06,.1,r*1.06]],
  ['cyl8',wood,[0,h*.95,0],[r*1.02,h*.1,r*1.02]],
  ['cyl8',0xf2e6c4,[0,h+.005,0],[r*.92,.012,r*.92]]];
 // arrow slits front and back, a few raised stones
 for(const s of [1,-1])parts.push(['box',0x3a2c22,[0,h*.5,s*r*.83],[r*.16,h*.36,.08]],['box',wood,[0,h*.71,s*r*.86],[r*.28,.05,.06]]);
 for(let i=0;i<6;i++){const a=i*1.05+.4,y=h*(.22+.22*(i%3));parts.push(['box',i%2?0xe6dcc3:0xc9bea2,[Math.sin(a)*r*.86,y,Math.cos(a)*r*.86],[r*.34,h*.15,.06],rot(0,a,0)])}
 return solid(parts);
}

/* ---------- the farmer's egg basket (held in front, bone 0), with four egg places ---------- */
export function basketGeometry(c){
 const w=0xc8964f,band=0x9c6a34,rim=0xa8743a,parts=[
  ['taper',w,[c.x,c.y,c.z],[.2,.17,.16]],
  ['cyl',band,[c.x,c.y-.03,c.z],[.205,.035,.165]],
  ['ring',rim,[c.x,c.y+.085,c.z],[.2,.16,.6],rot(Math.PI/2,0,0)],
  ['box',rim,[c.x-.19,c.y+.17,c.z],[.03,.18,.03]],['box',rim,[c.x+.19,c.y+.17,c.z],[.03,.18,.03]],['box',rim,[c.x,c.y+.26,c.z],[.4,.03,.03]],
  ['cyl6',0xf1d68a,[c.x,c.y+.06,c.z],[.17,.02,.13]]];   // straw lining
 return solid(parts);
}
// where the eggs sit in a basket centred at c (local to the farmer)
export const basketEggs=c=>[[-.07,.1,-.035],[.07,.1,.035],[.07,.1,-.04],[-.06,.13,.045]].map(([x,y,z])=>new V3(c.x+x,c.y+y,c.z+z));

/* ---------- fence layers (unit segment along x, centred, the ring's outside is +z) ---------- */
// layer 2: a second pair of darker rails on outer posts, nailed onto the first fence
export function railGeometry(w){
 const wood=0x9a6634,post=0x7c5028,o=-.2;   // the segment's -z faces out of the village
 return solid([['box',wood,[0,.27,o],[w*1.02,.09,.07]],['box',wood,[0,.55,o],[w*1.02,.09,.07]],['box',wood,[0,.41,o+.01],[w*.98,.05,.05],rot(0,0,.42)],
  ['box',post,[-w/2+.06,.36,o+.04],[.1,.72,.1]],['box',0xc79a5c,[-w/2+.06,.74,o+.04],[.13,.05,.13]]]);
}
// layer 3: a dry-stone wall, two courses of rounded stones under flat capstones
export function wallGeometry(w){
 const G=[0xd8d1c0,0xb3ab98,0xe6e0d0,0xa39b88],parts=[['box',0x9d957f,[0,.34,0],[w*1.0,.62,.3]]],n=3;
 for(let i=0;i<n;i++){const x=(i-(n-1)/2)*w/n;
  parts.push(['rock',G[i%4],[x,.18,.03],[w/n*.66,.22,.31],rot(.2*i,.6*i,0)],['rock',G[(i+1)%4],[x+w/n*.48,.46,.01],[w/n*.62,.2,.3],rot(.4,.3*i+1,.1)],
   ['box',G[(i+2)%4],[x+.03,.76,0],[w/n*.96,.11,.44],rot(.04*(i-1),(i-1)*.08,0)])}
 return solid(parts);
}

/* ---------- market: what each tier adds around the GLB market stall (local: counter faces +z, x to the right) ---------- */
// One striped tent pavilion: open cone roof in alternating wedges, a valance ring, four poles and a table of goods.
function tent(x,z,r,colors,goods){
 const list=[],m=new THREE.Matrix4(),q=new THREE.Quaternion(),c=new THREE.Color(),H=2.15,roof=.95;
 for(let i=0;i<8;i++){const g=new THREE.ConeGeometry(1,1,2,1,true,i*Math.PI/4,Math.PI/4);
  list.push(prep(g,m.compose(new V3(x,H+roof/2,z),q.identity(),new V3(r,roof,r)),c.set(colors[i%2])));g.dispose()}
 const parts=[['cyl',colors[1],[x,H-.04,z],[r*1.01,.14,r*1.01]],['sphere',0xffd24a,[x,H+roof+.08,z],.09],['cyl6',0xf4efe4,[x,H+roof+.02,z],[.03,.2,.03]]];
 for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4;parts.push(['cyl6',0x8a5a2e,[x+Math.cos(a)*r*.86,H/2,z+Math.sin(a)*r*.86],[.05,H,.05]])}
 parts.push(['box',0xa8743a,[x,.42,z+r*.35],[r*1.3,.84,r*.6]],['box',0xc8964f,[x,.86,z+r*.35],[r*1.36,.06,r*.66]]);
 goods(parts,x,.9,z+r*.35,r);
 list.push(solid(parts));return merge(list);
}
const apples=(parts,x,y,z,r)=>{for(let i=0;i<5;i++)parts.push(['ball',i%2?0xe2453a:0xf06a3c,[x-r*.45+i*r*.22,y+.07,z+(i%2?.06:-.06)],.09])};
const loaves=(parts,x,y,z,r)=>{for(let i=0;i<4;i++)parts.push(['sphere',0xd99a4e,[x-r*.36+i*r*.24,y+.06,z],[.13,.08,.09]])};
const cabbages=(parts,x,y,z,r)=>{for(let i=0;i<4;i++)parts.push(['ball',i%2?0x8fd060:0x6fb04a,[x-r*.36+i*r*.24,y+.08,z+(i%2?.05:-.05)],.1])};
function crates(x,z,n=2){const p=[];for(let i=0;i<n;i++)p.push(['box',0xb98a52,[x+i*.48,.2,z],[.42,.4,.42],rot(0,i*.3,0)],['box',0x8a5a2e,[x+i*.48,.41,z],[.44,.03,.44],rot(0,i*.3,0)]);return p}
function flagPole(x,z,h,color){return [['cyl6',0xf4efe4,[x,h/2,z],[.04,h,.04]],['sphere',0xffd24a,[x,h+.05,z],.07],['box',color,[x+.24,h-.2,z],[.44,.3,.02]],['cone',color,[x+.5,h-.2,z],[.12,.16,.02],rot(0,0,-Math.PI/2)]]}
// tier 0 = stall only (the GLB market without its awning), 1 = full GLB market (roofed), 2 = + two tents and bunting, 3 = + a third tent, crates, flags and a sign arch
export function marketExtras(tier){
 const list=[];
 if(tier>=1)list.push(solid([...crates(-1.55,.35,1),['cyl',0x9c6a34,[1.5,.3,.45],[.24,.6,.24]],['cyl',0x7c5028,[1.5,.6,.45],[.25,.04,.25]]]));
 if(tier>=2){list.push(tent(-2.55,-.55,1.05,[0xe2453a,0xfff4e0],apples),tent(2.55,-.75,1.05,[0x3a8fd6,0xfff4e0],loaves));
  list.push(solid([...flagPole(-3.55,.4,2.3,0xffd24a),...flagPole(3.55,.25,2.3,0x6fd3ff)]))}
 if(tier>=3){list.push(tent(.2,-2.6,1.15,[0x5aa83a,0xfff4e0],cabbages));
  list.push(solid([...crates(-3.2,1.1,2),...crates(2.9,1.0,2),...flagPole(-1.6,-2.4,2.9,0xff5a4a),...flagPole(2.1,-2.5,2.9,0xff8fb3),
   ['box',0x8a5a2e,[-.9,1.45,1.55],[.1,2.9,.1]],['box',0x8a5a2e,[.9,1.45,1.55],[.1,2.9,.1]],['box',0xc8964f,[0,2.85,1.55],[2.1,.36,.1]],['box',0xffd24a,[0,2.85,1.6],[1.6,.22,.04]]]))}
 return list.length?merge(list):null;
}
// GLB market children dropped for the bare stall (tier 0)
export const STALL_OMIT=['Curved canvas stripe','Scalloped awning valance','Rounded stall pillar'];

/* ---------- egg nests beside the hall door: left-over eggs stay here until the next sale ---------- */
export const NESTS=[[-1.42,-1.95],[-.86,-2.42]];
export const NEST_MAX=20;
// egg places: ten per nest (a ring of six, three on top, one crowning)
export function nestSpots(){const out=[];for(const [x,z] of NESTS){for(let i=0;i<6;i++){const a=i*Math.PI/3+.3;out.push([x+Math.cos(a)*.19,.2,z+Math.sin(a)*.16])}
  for(let i=0;i<3;i++){const a=i*2.09+.9;out.push([x+Math.cos(a)*.09,.31,z+Math.sin(a)*.08])}out.push([x,.41,z])}
 return out;
}
function nest(x,z){const parts=[['cyl',0xd9b65a,[x,.07,z],[.36,.14,.32]],['ring',0xc89c42,[x,.14,z],[.34,.3,.9],rot(Math.PI/2,0,0)],['cyl',0x8a6a32,[x,.142,z],[.27,.01,.23]]];
 for(let i=0;i<8;i++){const a=i*.79;parts.push(['box',i%2?0xe8c86a:0xc8a048,[x+Math.cos(a)*.37,.15,z+Math.sin(a)*.33],[.22,.025,.03],rot(.3,-a+.5,.2)])}
 return parts}

/* ---------- what each hall stage adds to the village (world coordinates, village centre = origin) ---------- */
const SPOKES=[Math.PI/4,3*Math.PI/4,5*Math.PI/4,7*Math.PI/4];   // toward the first outer tower ring (between the wolf trails)
export function lanterns(stage){const out=[];if(stage>=2){for(const a of SPOKES)out.push([Math.cos(a)*5.4+Math.sin(a)*.75,Math.sin(a)*5.4-Math.cos(a)*.75]);out.push([2.3,.75],[-.9,-1.0])}
 if(stage>=3)for(const a of SPOKES)out.push([Math.cos(a)*9.6+Math.sin(a)*.75,Math.sin(a)*9.6-Math.cos(a)*.75]);return out}
export const LANTERN_TOP=1.55;
export function villageProps(stage){
 const parts=[...NESTS.flatMap(([x,z])=>nest(x,z))];
 if(stage>=1){   // dirt paths: spokes out to the first tower ring, with a trodden edge and a few pebbles
  const r0=2.6,r1=stage>=3?14:8.2;
  for(const a of SPOKES){const mid=(r0+r1)/2,len=r1-r0,x=Math.cos(a)*mid,z=Math.sin(a)*mid;
   parts.push(flat('plane',0xc9a868,x,z,len,1.15,.019,-a),flat('plane',0xdcc08a,x,z,len,.8,.021,-a));
   for(let i=0;i<Math.round(len/1.3);i++){const r=r0+.8+i*1.3,s=i%2?.5:-.5;parts.push(['sphere',0xb7aa8c,[Math.cos(a)*r-Math.sin(a)*s,.03,Math.sin(a)*r+Math.cos(a)*s],[.12,.05,.09]])}}
  parts.push(flat('disc',0xdcc08a,.6,-.6,2.2,1.9,.02));   // the trodden plaza where the paths meet
 }
 for(const [x,z] of lanterns(stage))parts.push(['cyl6',0x6b4a2e,[x,.7,z],[.05,1.4,.05]],['box',0x6b4a2e,[x+.12,1.36,z],[.28,.04,.04]],
  ['box',0x3a2c22,[x+.24,1.46,z],[.17,.2,.17]],['box',0xffd66a,[x+.24,1.46,z],[.13,.16,.19]],['cone',0x3a2c22,[x+.24,1.62,z],[.14,.12,.14]],['cyl6',0x8a6a42,[x,.04,z],[.14,.08,.14]]);
 if(stage>=3){   // feast flags around the plaza and hay stacked by the barn
  const F=[0xff5a4a,0xffd24a,0x6fd3ff,0x9be05c];[[1.9,3.0],[-3.4,3.2],[-1.6,-4.6],[7.2,-3.8]].forEach(([x,z],i)=>parts.push(...flagPole(x,z,2.6,F[i])));
  for(const [x,z,s] of [[-8.1,-2.6,1],[-7.4,-2.1,.85],[-7.8,-1.6,.9]])parts.push(['cyl',0xe9c75a,[x,.3*s,z],[.3*s,.62*s,.3*s],rot(Math.PI/2,0,.3)],['cyl',0xc79a3a,[x,.3*s,z],[.31*s,.09*s,.31*s],rot(Math.PI/2,0,.3)]);
 }
 return solid(parts);
}

/* ---------- atlas icon: a hammer in a white speech bubble (the repair hint over a broken building) ---------- */
export function drawHammer(ctx,h,inner){
 ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(h,h-8,inner*.4,0,7);ctx.moveTo(h-18,h+inner*.3);ctx.lineTo(h,h+inner*.46);ctx.lineTo(h+18,h+inner*.3);ctx.fill();
 ctx.fillStyle='#ffe9a8';ctx.beginPath();ctx.arc(h,h-8,inner*.4-9,0,7);ctx.fill();
 ctx.save();ctx.translate(h,h-8);ctx.rotate(-.65);
 ctx.fillStyle='#8a5a2e';ctx.beginPath();ctx.roundRect(-8,-6,16,58,6);ctx.fill();
 ctx.fillStyle='#5a3a1c';ctx.fillRect(-8,30,16,8);
 ctx.fillStyle='#5b6068';ctx.beginPath();ctx.roundRect(-34,-30,68,26,7);ctx.fill();
 ctx.fillStyle='#9aa2ad';ctx.beginPath();ctx.roundRect(-30,-27,60,8,4);ctx.fill();
 ctx.restore();
}
