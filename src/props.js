// 0.9 village props, all procedural (no new art files): tower storeys, the farmers' egg basket, fence layers (double rails,
// stone wall), the market (stall -> roofed shop -> market street with tents -> longer street with a gate), the egg nests, and
// what each hall stage adds (dirt roads, lanterns, hay, feast flags). Positions live in layout.js. Everything is vertex-coloured.
import * as THREE from 'three';
import { prep, solid, flat, merge } from './geo.js';
import { MARKET_NEAR, TENTS, STREET_FLAGS, STREET_CRATES, GATE, PATHS, lanterns, LANTERN_BOX, FLAGS3, HAY3, NESTS, COTTAGES, WELL, MILL0, MILL, KEEP, ROAD_MARK, ROAD,
 RIVER, riverFrame, BRIDGE, bridgeSpot, deckY, millRace } from './layout.js';

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

/* ---------- market (positions in layout.js): the market actor carries tier 0 stall / tier 1+ roofed shop with a crate and a barrel;
   from hall 2 the market street (tents along a road out of the market's back) is part of the stage props ---------- */
// One striped tent pavilion: open cone roof in alternating wedges, a valance ring, four poles and a table of goods facing the street.
function tent(x,z,r,colors,goods,face){
 const list=[],m=new THREE.Matrix4(),q=new THREE.Quaternion(),c=new THREE.Color(),H=2.15,roof=.95,fx=Math.cos(face),fz=Math.sin(face);
 for(let i=0;i<8;i++){const g=new THREE.ConeGeometry(1,1,2,1,true,i*Math.PI/4,Math.PI/4);
  list.push(prep(g,m.compose(new V3(x,H+roof/2,z),q.identity(),new V3(r,roof,r)),c.set(colors[i%2])));g.dispose()}
 const parts=[['cyl',colors[1],[x,H-.04,z],[r*1.01,.14,r*1.01]],['sphere',0xffd24a,[x,H+roof+.08,z],.09],['cyl6',0xf4efe4,[x,H+roof+.02,z],[.03,.2,.03]]];
 for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4;parts.push(['cyl6',0x8a5a2e,[x+Math.cos(a)*r*.86,H/2,z+Math.sin(a)*r*.86],[.05,H,.05]])}
 const tx=x+fx*r*.35,tz=z+fz*r*.35,ry=-face+Math.PI/2;   // the counter stands on the street side
 parts.push(['box',0xa8743a,[tx,.42,tz],[r*1.3,.84,r*.6],rot(0,ry,0)],['box',0xc8964f,[tx,.86,tz],[r*1.36,.06,r*.66],rot(0,ry,0)]);
 GOODS[goods](parts,tx,.9,tz,r,ry);
 list.push(solid(parts));return merge(list);
}
const onCounter=(x,z,ry,u,v=0)=>[x+Math.cos(ry)*u+Math.sin(ry)*v,z-Math.sin(ry)*u+Math.cos(ry)*v];   // a point on a counter turned by ry
const GOODS={
 apples:(parts,x,y,z,r,ry)=>{for(let i=0;i<5;i++){const [px,pz]=onCounter(x,z,ry,-r*.45+i*r*.22,i%2?.06:-.06);parts.push(['ball',i%2?0xe2453a:0xf06a3c,[px,y+.07,pz],.09])}},
 loaves:(parts,x,y,z,r,ry)=>{for(let i=0;i<4;i++){const [px,pz]=onCounter(x,z,ry,-r*.36+i*r*.24);parts.push(['sphere',0xd99a4e,[px,y+.06,pz],[.13,.08,.09],rot(0,ry,0)])}},
 cabbages:(parts,x,y,z,r,ry)=>{for(let i=0;i<4;i++){const [px,pz]=onCounter(x,z,ry,-r*.36+i*r*.24,i%2?.05:-.05);parts.push(['ball',i%2?0x8fd060:0x6fb04a,[px,y+.08,pz],.1])}}};
function crate(x,z,ry){return [['box',0xb98a52,[x,.2,z],[.42,.4,.42],rot(0,ry,0)],['box',0x8a5a2e,[x,.41,z],[.44,.03,.44],rot(0,ry,0)]]}
function flagPole(x,z,h,color){return [['cyl6',0xf4efe4,[x,h/2,z],[.04,h,.04]],['sphere',0xffd24a,[x,h+.05,z],.07],['box',color,[x+.24,h-.2,z],[.44,.3,.02]],['cone',color,[x+.5,h-.2,z],[.12,.16,.02],rot(0,0,-Math.PI/2)]]}
// market-local decor by the counter (tier 1+): a crate and a barrel
export function marketExtras(tier){
 if(tier<1)return null;const [c,b]=MARKET_NEAR;
 return solid([...crate(c.x,c.z,0),['cyl',0x9c6a34,[b.x,.3,b.z],[.24,.6,.24]],['cyl',0x7c5028,[b.x,.6,b.z],[.25,.04,.25]]]);
}
// GLB market children dropped for the bare stall (tier 0)
export const STALL_OMIT=['Curved canvas stripe','Scalloped awning valance','Rounded stall pillar'];

/* ---------- egg nests: left-over eggs stay here until the next sale ---------- */
export { NESTS };
export const NEST_MAX=20;
// egg places: ten per nest (a ring of six, three on top, one crowning)
export function nestSpots(){const out=[];for(const [x,z] of NESTS){for(let i=0;i<6;i++){const a=i*Math.PI/3+.3;out.push([x+Math.cos(a)*.19,.2,z+Math.sin(a)*.16])}
  for(let i=0;i<3;i++){const a=i*2.09+.9;out.push([x+Math.cos(a)*.09,.31,z+Math.sin(a)*.08])}out.push([x,.41,z])}
 return out;
}
function nest(x,z){const parts=[['cyl',0xd9b65a,[x,.07,z],[.36,.14,.32]],['ring',0xc89c42,[x,.14,z],[.34,.3,.9],rot(Math.PI/2,0,0)],['cyl',0x8a6a32,[x,.142,z],[.27,.01,.23]]];
 for(let i=0;i<8;i++){const a=i*.79;parts.push(['box',i%2?0xe8c86a:0xc8a048,[x+Math.cos(a)*.37,.15,z+Math.sin(a)*.33],[.22,.025,.03],rot(.3,-a+.5,.2)])}
 return parts}

/* ---------- what each hall stage adds to the village (world coordinates from layout.js) ---------- */
export { lanterns };
export const LANTERN_TOP=1.55;
export function villageProps(stage){
 const parts=[...NESTS.flatMap(([x,z])=>nest(x,z))],list=[];
 for(const [x0,z0,x1,z1,w] of PATHS[stage]||[]){   // dirt roads with a trodden edge and a few pebbles
  const dx=x1-x0,dz=z1-z0,len=Math.hypot(dx,dz),a=Math.atan2(dz,dx),x=(x0+x1)/2,z=(z0+z1)/2;
  parts.push(flat('plane',0xc9a868,x,z,len,w,.019,-a),flat('plane',0xdcc08a,x,z,len,w*.7,.021,-a));
  for(let i=0;i<Math.floor(len/1.3);i++){const u=(.6+i*1.3)/len,s=i%2?.3:-.3;parts.push(['sphere',0xb7aa8c,[x0+dx*u-Math.sin(a)*s*w,.03,z0+dz*u+Math.cos(a)*s*w],[.12,.05,.09]])}
 }
 for(const [x,z] of lanterns(stage))parts.push(['cyl6',0x6b4a2e,[x,.7,z],[.05,1.4,.05]],['box',0x6b4a2e,[x+.12,1.36,z],[.28,.04,.04]],
  ['box',0x3a2c22,[x+LANTERN_BOX,1.46,z],[.17,.2,.17]],['box',0xffd66a,[x+LANTERN_BOX,1.46,z],[.13,.16,.19]],['cone',0x3a2c22,[x+LANTERN_BOX,1.62,z],[.14,.12,.14]],['cyl6',0x8a6a42,[x,.04,z],[.14,.08,.14]]);
 // the market street: tents facing the road, flag poles at its entrance (stage 3: a sign board between them), crates
 const sa=-Math.PI/4,road=(px,pz)=>{const u=px*Math.cos(sa)+pz*Math.sin(sa);return [Math.cos(sa)*u,Math.sin(sa)*u]};
 for(const t of TENTS)if(stage>=t.stage){const [rx,rz]=road(...t.at);list.push(tent(t.at[0],t.at[1],t.r,t.colors,t.goods,Math.atan2(rz-t.at[1],rx-t.at[0])))}
 for(const f of STREET_FLAGS)if(stage>=f.stage)parts.push(...flagPole(f.at[0],f.at[1],f.h,f.color));
 if(stage>=GATE.stage){const [ax,az]=GATE.a,[bx,bz]=GATE.b,len=Math.hypot(bx-ax,bz-az),ry=-Math.atan2(bz-az,bx-ax),mx=(ax+bx)/2,mz=(az+bz)/2;
  parts.push(['box',0x8a5a2e,[mx,1.95,mz],[len+.12,.42,.1],rot(0,ry,0)],['box',0xffd24a,[mx,1.95,mz],[len*.78,.26,.13],rot(0,ry,0)],['box',0xe2453a,[mx,1.95,mz],[len*.5,.08,.15],rot(0,ry,0)])}
 for(const c of STREET_CRATES)if(stage>=c.stage)for(let i=0;i<c.n;i++)parts.push(...crate(c.at[0]+Math.cos(sa)*i*.5,c.at[1]+Math.sin(sa)*i*.5,i*.3-sa));
 if(stage>=3){   // feast flags around the village and hay stacked by the barn
  const F=[0xff5a4a,0xffd24a,0x6fd3ff,0x9be05c];FLAGS3.forEach(([x,z],i)=>parts.push(...flagPole(x,z,2.6,F[i%F.length])));
  for(const [x,z,s] of HAY3)parts.push(['cyl',0xe9c75a,[x,.3*s,z],[.3*s,.62*s,.3*s],rot(Math.PI/2,0,.3)],['cyl',0xc79a3a,[x,.3*s,z],[.31*s,.09*s,.31*s],rot(Math.PI/2,0,.3)]);
 }
 list.push(solid(parts));return merge(list);
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

/* ---------- 0.14 visible stages: wolf roads, cottages, the well, the mill hut, road-entrance markers, the castle keep ----------
   All code shapes, no art files. world.js STAGE gives the radius and the open roads; layout.js the places. */
const SPAWN_STEP=Math.PI/4,spawnAngle=p=>(p+.5)*SPAWN_STEP;
// Wolf trails. routes = null: the eight faint tracks of 0.13 (stage 0, or stages switched off). Otherwise only the open roads, as proper dirt roads.
export function trailGeometry(routes){
 const parts=[];
 if(!routes){const trail=0xb9b07a,edge=0xa9a670;
  for(let p=0;p<8;p++){const a=spawnAngle(p),r0=7.6,r1=46,mid=(r0+r1)/2;
   parts.push(flat('plane',edge,Math.cos(a)*mid,Math.sin(a)*mid,r1-r0,1.5,.009,-a),flat('plane',trail,Math.cos(a)*mid,Math.sin(a)*mid,r1-r0,1.05,.011,-a));
   for(let i=0;i<14;i++){const r=r0+1+i*2.7+Math.sin(i*5.1+p)*.4,side=i%2?.85:-.85,x=Math.cos(a)*r-Math.sin(a)*side,z=Math.sin(a)*r+Math.cos(a)*side;parts.push(['sphere',i%3?0xbfb59c:0xa9a28e,[x,.03,z],[.18+.05*Math.sin(i*2.2),.07,.13]])}}
  return solid(parts)}
 const {r0,r1,edge,width}=ROAD,mid=(r0+r1)/2;
 for(const p of routes){const a=spawnAngle(p),c=Math.cos(a),s=Math.sin(a);
  parts.push(flat('plane',0xb89a5e,c*mid,s*mid,r1-r0,edge,.009,-a),flat('plane',0xd9bd84,c*mid,s*mid,r1-r0,width,.011,-a),flat('disc',0xd9bd84,c*r0,s*r0,width*.5,width*.5,.011));
  // wheel ruts and stones along the edge
  for(const side of [-.32,.32])parts.push(flat('plane',0xc4a66e,c*mid-s*side,s*mid+c*side,r1-r0,.11,.013,-a));
  for(let i=0;i<16;i++){const r=r0+.8+i*2.6+Math.sin(i*5.1+p)*.4,side=(i%2?1:-1)*(edge/2+.12),x=c*r-s*side,z=s*r+c*side;parts.push(['sphere',i%3?0xbfb59c:0xa9a28e,[x,.04,z],[.2+.05*Math.sin(i*2.2),.08,.15]])}}
 return solid(parts);
}
const toCentre=(x,z)=>Math.atan2(-x,-z);                      // yaw that turns a prop's front (+z) to the village centre
const fwd=(x,z,ry,f,side=0)=>[x+Math.sin(ry)*f+Math.cos(ry)*side,z+Math.cos(ry)*f-Math.sin(ry)*side];
function cottage(x,z,roof,k=0){
 const ry=toCentre(x,z)+(k%2?.25:-.2),W_=.98,H=.78,D_=.84,wall=k%3===1?0xf7ecd2:0xf1e2c0,parts=[
  ['box',0xb7a98a,[x,.05,z],[W_+.1,.1,D_+.1],rot(0,ry,0)],['box',wall,[x,.1+H/2,z],[W_,H,D_],rot(0,ry,0)],
  ['cone',roof,[x,.1+H+.3,z],[W_*.86,.62,D_*.86],rot(0,ry+Math.PI/6,0)],['box',0x8a5a2e,[x,.1+H+.02,z],[W_+.12,.06,D_+.12],rot(0,ry,0)]];
 const [dx,dz]=fwd(x,z,ry,D_/2,-.12),[wx,wz]=fwd(x,z,ry,D_/2,.27),[cx,cz]=fwd(x,z,ry,-.12,.26);
 parts.push(['box',0x7a4a24,[dx,.36,dz],[.24,.5,.05],rot(0,ry,0)],['box',0xffe9a8,[wx,.52,wz],[.2,.2,.05],rot(0,ry,0)],['box',0x8a5a2e,[wx,.52,wz],[.24,.03,.06],rot(0,ry,0)],
  ['box',0xb3ab98,[cx,.1+H+.42,cz],[.15,.36,.15],rot(0,ry,0)]);
 return parts;
}
function well(x,z){
 const parts=[['cyl',0xb3ab98,[x,.22,z],[.4,.44,.4]],['cyl',0xd8d1c0,[x,.44,z],[.43,.07,.43]],['cyl',0x4fa3d6,[x,.46,z],[.3,.05,.3]],
  ['box',0x8a5a2e,[x-.36,.78,z],[.07,.9,.07]],['box',0x8a5a2e,[x+.36,.78,z],[.07,.9,.07]],['box',0x6b4a2e,[x,1.14,z],[.8,.06,.08]],['cone',0xc8553a,[x,1.4,z],[.6,.42,.6]],
  ['cyl6',0x9c6a34,[x+.08,.86,z],[.09,.13,.09]],['box',0x6b4a2e,[x+.08,1.0,z],[.02,.24,.02]]];
 return parts;
}
// The mill hut: plank walls, a steep roof and a (still) water wheel standing in a little trough on the side that faces the village.
function mill(x,z){
 const ry=toCentre(x,z),parts=[['box',0xb7a98a,[x,.06,z],[1.5,.12,1.25],rot(0,ry,0)],['box',0xe7d3a6,[x,.72,z],[1.36,1.2,1.1],rot(0,ry,0)],
  ['box',0x9a6634,[x,1.34,z],[1.5,.07,1.24],rot(0,ry,0)],['cone',0x8a4f33,[x,1.78,z],[1.12,.86,.94],rot(0,ry+Math.PI/6,0)]];
 const [dx,dz]=fwd(x,z,ry,.55,.38);parts.push(['box',0x7a4a24,[dx,.42,dz],[.3,.6,.05],rot(0,ry,0)]);
 const [wx,wz]=fwd(x,z,ry,.2,-.84),R=.62;   // wheel on the hut's left side, its axle along the hut's width
 parts.push(['ring',0x7c5028,[wx,R+.06,wz],[R,R,.5],rot(0,ry+Math.PI/2,0)],['cyl6',0x5c3a1c,[wx,R+.06,wz],[.09,.3,.09],rot(0,ry,Math.PI/2)]);
 for(let i=0;i<4;i++)parts.push(['box',0x9a6634,[wx,R+.06,wz],[.05,R*1.9,.05],rot(i*Math.PI/4,ry,0)]);
 for(let i=0;i<8;i++){const a=i*Math.PI/4,py=R+.06+Math.cos(a)*R,off=Math.sin(a)*R,[px,pz]=[wx+Math.sin(ry)*off,wz+Math.cos(ry)*off];parts.push(['box',0xc79a5c,[px,py,pz],[.3,.05,.2],rot(a,ry,0)])}
 const [tx,tz]=fwd(x,z,ry,.2,-.84);parts.push(flat('disc',0xcdb681,tx,tz,.95,.62,.017,-ry),flat('disc',0x7fc6e6,tx,tz,.8,.48,.027,-ry),flat('disc',0xd2f1fa,tx+.15,tz-.1,.22,.08,.035,-ry));
 return parts;
}
// A marker beside an open road at the village edge. tier 1: a stake with a lamp · 2: a blue flag pole · 3: a stone gate post with a flag · 4: a taller post with a red banner.
function roadMark(x,z,tier,k){
 if(tier<=1)return [['cyl6',0x6b4a2e,[x,.45,z],[.07,.9,.07]],['box',0x3a2c22,[x,.98,z],[.2,.22,.2]],['box',0xffd66a,[x,.98,z],[.15,.17,.22]],['cone',0x3a2c22,[x,1.16,z],[.17,.14,.17]]];
 if(tier===2)return flagPole(x,z,2.3,k%2?0x6fd3ff:0x3a8fd6);
 const h=tier>=4?2.3:1.6,r=tier>=4?.44:.38,stone=0xd9cfb6,dark=0xb7ab8f,parts=[['cyl8',dark,[x,.08,z],[r*1.25,.16,r*1.25]],['taper',stone,[x,h/2,z],[r,h,r],rot(Math.PI,0,0)],['cyl8',dark,[x,h+.06,z],[r*1.2,.12,r*1.2]]];
 for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4;parts.push(['box',stone,[x+Math.cos(a)*r*.8,h+.22,z+Math.sin(a)*r*.8],[.2,.22,.2],rot(0,-a,0)])}
 for(let i=0;i<4;i++){const a=i*1.57+.5;parts.push(['box',i%2?0xe6dcc3:0xc9bea2,[x+Math.sin(a)*r*.93,h*(.3+.18*(i%3)),z+Math.cos(a)*r*.93],[r*.5,h*.1,.05],rot(0,a,0)])}
 const top=h+(tier>=4?1.5:1.1),col=tier>=4?0xe2332a:0x3a8fd6;
 parts.push(['cyl6',0xf4efe4,[x,(h+top)/2,z],[.035,top-h,.035]],['sphere',0xffd24a,[x,top+.05,z],.07],['box',col,[x+.22,top-.2,z],[.4,.3,.02]],['cone',col,[x+.46,top-.2,z],[.12,.16,.02],rot(0,0,-Math.PI/2)]);
 if(tier>=4)parts.push(['box',0xffd24a,[x+.22,top-.2,z+.002],[.4,.05,.024]]);
 return parts;
}
// The castle keep: a tall round stone tower with battlements, arrow slits, a pointed roof and a long banner.
function keep(x,z){
 const H=5.3,r=.92,stone=0xd9cfb6,dark=0xb7ab8f,parts=[['cyl8',dark,[x,.12,z],[r*1.22,.24,r*1.22]],['taper',stone,[x,H/2,z],[r,H,r],rot(Math.PI,0,0)],
  ['cyl8',dark,[x,H+.08,z],[r*1.28,.18,r*1.28]],['cyl8',0xefe6d2,[x,H+.18,z],[r*1.05,.03,r*1.05]]];
 for(let i=0;i<8;i++){const a=i*Math.PI/4;parts.push(['box',stone,[x+Math.cos(a)*r*1.05,H+.36,z+Math.sin(a)*r*1.05],[.26,.36,.22],rot(0,-a,0)])}
 for(let i=0;i<9;i++){const a=i*.7+.2,y=H*(.16+.09*(i%8));parts.push(['box',i%2?0xe6dcc3:0xc9bea2,[x+Math.sin(a)*r*.93,y,z+Math.cos(a)*r*.93],[r*.42,.2,.06],rot(0,a,0)])}
 for(const a of [.6,2.4,4.3])parts.push(['box',0x3a2c22,[x+Math.sin(a)*r*.9,H*.68,z+Math.cos(a)*r*.9],[.13,.5,.08],rot(0,a,0)]);
 parts.push(['cone8',0xb5372c,[x,H+.95,z],[r*.8,1.2,r*.8]],['cyl6',0xf4efe4,[x,H+2.0,z],[.04,1.1,.04]],['sphere',0xffd24a,[x,H+2.58,z],.09],
  ['box',0xe2332a,[x+.4,H+2.25,z],[.76,.44,.03]],['cone',0xe2332a,[x+.86,H+2.25,z],[.18,.2,.03],rot(0,0,-Math.PI/2)],['box',0xffd24a,[x+.4,H+2.25,z+.003],[.76,.07,.034]]);
 return parts;
}
/* ---------- 0.15 river, bridge and mill (positions in layout.js; the GLB art is baked in village.js and handed in, these are the code-drawn stand-ins) ---------- */
// The river for village radius R, in its own frame: x along the river, z out of the village (+z = n), origin = the centre line's point nearest the village.
// Flat decals just above the flower decals (0.035-0.04): sandy banks, water, a deeper channel, a few glints, and the mill race running from the mill wheel.
// village.js places it at frame.c turned by atan2(n.x, n.z) and can grow it along x (scale.x) when it first appears.
export function riverGeometry(R){
 const L=RIVER.length,w=RIVER.water,b=RIVER.bank,f=riverFrame(R),parts=[flat('plane',0xcdb681,0,0,L,w+2*b,.042),flat('plane',0x7fc6e6,0,0,L,w,.045),flat('plane',0x5fb2de,0,.08,L,w*.42,.047)];
 for(let i=0;i<26;i++){const x=-L/2+4+i*(L-8)/25+Math.sin(i*3.7)*1.2;parts.push(flat('plane',0xd2f1fa,x,(i%3-1)*w*.24,.9+.4*Math.sin(i*2.1),.07,.049))}
 // the mill race, in river coordinates (from the wheel to the centre line), with a sandy rim and a little splash pool under the wheel
 const [x0,z0,x1,z1,rw]=millRace(R),loc=(x,z)=>{const dx=x-f.c[0],dz=z-f.c[1];return [dx*f.t[0]+dz*f.t[1],dx*f.n[0]+dz*f.n[1]]},[ax,az]=loc(x0,z0),[bx,bz]=loc(x1,z1),len=Math.hypot(bx-ax,bz-az),ang=Math.atan2(bz-az,bx-ax);
 parts.push(flat('plane',0xcdb681,(ax+bx)/2,(az+bz)/2,len,rw+.24,.041,-ang),flat('plane',0x7fc6e6,(ax+bx)/2,(az+bz)/2,len,rw,.044,-ang),flat('disc',0xcdb681,ax,az,.62,.5,.041,-ang),flat('disc',0x7fc6e6,ax,az,.5,.38,.044,-ang));
 return solid(parts);
}
// Code-drawn bridge (when bridge.glb is missing), local: travel along +z, the same arch as the GLB deck (layout deckY) so wolves cross it at the same height.
export function codeBridgeGeometry(){
 const parts=[],n=11,L=BRIDGE.len,W=1.4;
 for(let i=0;i<n;i++){const z=-L/2+(i+.5)*L/n,y=deckY(z),slope=Math.atan2(deckY(z-.05)-deckY(z+.05),.1);parts.push(['box',i%2?0xb07a42:0xc08a4e,[0,y-.04,z],[W,.08,L/n*.94],rot(slope,0,0)])}
 for(const s of [-1,1]){for(const z of [-1.35,-.45,.45,1.35])parts.push(['box',0x7c5028,[s*W/2,deckY(z)+.22,z],[.09,.5,.09]]);
  for(const [z0,z1] of [[-1.35,-.45],[-.45,.45],[.45,1.35]]){const y0=deckY(z0)+.42,y1=deckY(z1)+.42,len=Math.hypot(z1-z0,y1-y0);parts.push(['box',0x9a6634,[s*W/2,(y0+y1)/2,(z0+z1)/2],[.07,.07,len],rot(-Math.atan2(y1-y0,z1-z0),0,0)])}}
 return solid(parts);
}
// Code-drawn water wheel (when watermill.glb is missing), local: axle along x through the origin, radius MILL.wheel.r · 0.8.
export function codeWheelGeometry(){
 const R=MILL.wheel.r*.8,parts=[['ring',0x7c5028,[-.08,0,0],[R,R,.5],rot(0,Math.PI/2,0)],['ring',0x7c5028,[.08,0,0],[R,R,.5],rot(0,Math.PI/2,0)],['cyl6',0x5c3a1c,[0,0,0],[.09,.42,.09],rot(0,0,Math.PI/2)]];
 for(let i=0;i<4;i++)parts.push(['box',0x9a6634,[0,0,0],[.05,R*1.9,.05],rot(i*Math.PI/4,0,0)]);
 for(let i=0;i<8;i++){const a=i*Math.PI/4;parts.push(['box',0xc79a5c,[0,Math.cos(a)*R,Math.sin(a)*R],[.3,.05,.2],rot(a,0,0)])}
 return solid(parts);
}
// Code-drawn mill house for the 0.15 spot (the wheel is its own turning piece), local: door on +z, wheel side −x.
function millHouseParts(){
 return [['box',0xb7a98a,[0,.06,0],[1.5,.12,1.25]],['box',0xe7d3a6,[0,.72,0],[1.36,1.2,1.1]],['box',0x9a6634,[0,1.34,0],[1.5,.07,1.24]],['cone',0x8a4f33,[0,1.78,0],[1.12,.86,.94],rot(0,Math.PI/6,0)],
  ['box',0x7a4a24,[.38,.42,.56],[.3,.6,.05]],['box',0x5c3a1c,[-.78,MILL.wheel.y,0],[.3,.14,.14]]];
}
const WHITE=new THREE.Color(1,1,1),placed=(g,x,z,ry)=>prep(g,new THREE.Matrix4().compose(new V3(x,0,z),new THREE.Quaternion().setFromAxisAngle(new V3(0,1,0),ry),new V3(1,1,1)),WHITE);
// What stands at 'stage' (0-5) for a village of 'radius' with the open 'routes' (array of spawn points, or null).
// → {all, old, fresh}: geometries (null when empty) of everything, of what was already there at the stage before, and of what this stage adds
//   (the road-entrance markers move out with the edge, so they are always fresh), plus spots [[x,z,height],…] of the fresh things for the effects.
// 0.15 opt.river: from stage 3 the mill stands at MILL (opt.house = the baked mill house, else the code house; the wheel is drawn apart by village.js)
// and the bridge on road 6 (opt.bridge = the baked bridge, else the code bridge) instead of road 6's two markers. Without opt.river: exactly the 0.14 props.
export function stageProps(stage,radius,routes,opt={}){
 const old=[],fresh=[],oldG=[],freshG=[],spots=[],put=(at,parts,h,st)=>{if(st===stage){fresh.push(...parts);spots.push([at[0],at[1],h])}else old.push(...parts)};
 const river=!!opt.river&&stage>=RIVER.stage;
 COTTAGES.forEach((c,k)=>{if(stage>=c.stage)put(c.at,cottage(c.at[0],c.at[1],c.roof,k),1.5,c.stage)});
 if(stage>=WELL.stage)put(WELL.at,well(...WELL.at),1.5,WELL.stage);
 if(river){const [x,z]=MILL.at,g=placed(opt.house||solid(millHouseParts()),x,z,MILL.ry);(stage===MILL.stage?freshG:oldG).push(g);if(stage===MILL.stage)spots.push([x,z,2.2]);
  const b=bridgeSpot(radius);freshG.push(placed(opt.bridge||codeBridgeGeometry(),b.at[0],b.at[1],b.ry));spots.push([b.at[0],b.at[1],1])}   // the bridge steps out with the river: always fresh
 else if(stage>=MILL0.stage)put(MILL0.at,mill(...MILL0.at),2.2,MILL0.stage);
 if(stage>=KEEP.stage)put(KEEP.at,keep(...KEEP.at),5,KEEP.stage);
 let marks=0;
 if(stage>=1&&routes)for(const p of routes){if(river&&p===RIVER.road)continue;const a=spawnAngle(p),r=radius+ROAD_MARK.out,tier=stage<=2?1:stage-1;
  [-1,1].forEach((sd,i)=>{const x=Math.cos(a)*r-Math.sin(a)*sd*ROAD_MARK.side,z=Math.sin(a)*r+Math.cos(a)*sd*ROAD_MARK.side;fresh.push(...roadMark(x,z,tier,i));marks++;if(tier>=3)spots.push([x,z,tier>=4?2.6:1.9])})}
 const geo=(list,extra)=>{const all=[...(list.length?[solid(list)]:[]),...extra];return all.length?(all.length===1?all[0]:merge(all)):null};
 return {all:geo([...old,...fresh],[...oldG,...freshG]),old:geo(old,oldG),fresh:geo(fresh,freshG),spots,houses:COTTAGES.filter(c=>stage>=c.stage).length,marks,river};
}
