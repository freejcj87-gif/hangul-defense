// Procedural monsters for the 3D village (꼬꼬마을 0.8): six kinds, one instanced mesh per kind.
// Every monster is a single vertex-coloured mesh whose parts carry a bone id (body, head, jaw, tail, four legs).
// A small vertex-shader rig moves those parts from per-instance pose attributes, so a whole pack of one kind
// is one draw call while heads, jaws, tails and legs still animate on their own.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const V3=THREE.Vector3;
export const KIND_ORDER=['wolf','bramble','boar','granite','frost','ember'];

/* ---------- rig layout (unit monster, faces +z, feet on y=0) ---------- */
// H head pivot (neck), J jaw hinge, T tail root, L leg pivots (front-left, front-right, back-left, back-right),
// M mouth (where a carried hen hangs), top (above the head, for markers), rear (hind hips z, pivot for rearing up).
const WOLF_RIG={H:[0,.9,.28],J:[0,.9,.52],T:[0,.76,-.5],L:[[.15,.52,.3],[-.15,.52,.3],[.15,.52,-.34],[-.15,.52,-.34]],M:[0,.86,.84],top:[0,1.62,.34],hip:.52,rear:-.34,center:.62};
const BOAR_RIG={H:[0,.62,.32],J:[0,.5,.62],T:[0,.6,-.52],L:[[.17,.38,.26],[-.17,.38,.26],[.17,.38,-.3],[-.17,.38,-.3]],M:[0,.5,.92],top:[0,1.12,.42],hip:.38,rear:-.3,center:.5};
export const RIG={wolf:WOLF_RIG,bramble:WOLF_RIG,granite:WOLF_RIG,frost:WOLF_RIG,ember:WOLF_RIG,boar:BOAR_RIG};

// Gaits: walk / run gait per kind and the stride frequency (Hz) at the kind's normal speed.
export const GAIT={
 wolf:{walk:'trot',run:'gallop',hz:{trot:1.8,gallop:2.6}},
 bramble:{walk:'gallop',run:'gallop',hz:{gallop:3.0}},
 boar:{walk:'hop',run:'hop',hz:{hop:3.2}},
 granite:{walk:'plod',run:'plod',hz:{plod:1.15}},
 frost:{walk:'gallop',run:'gallop',hz:{gallop:3.2}},
 ember:{walk:'prowl',run:'prowl',hz:{prowl:1.05}}};

/* ---------- primitives (kept low-poly: a pack of 90 has to run on phones) ---------- */
const PRIM={ball:new THREE.SphereGeometry(1,8,6),low:new THREE.SphereGeometry(1,6,4),cone:new THREE.ConeGeometry(1,1,6),spike:new THREE.ConeGeometry(1,1,4),
 box:new THREE.BoxGeometry(1,1,1),gem:new THREE.OctahedronGeometry(1,0),rock:new THREE.IcosahedronGeometry(1,0),cyl:new THREE.CylinderGeometry(1,1,1,6),leg:new THREE.CylinderGeometry(1,.8,1,6)};
// Rotation that turns local +y (cones) or +z (leaves, ellipsoids) toward direction d.
const nrm=(x,y,z)=>{const l=Math.hypot(x,y,z)||1;return [x/l,y/l,z/l]};
const dirY=(x,y,z)=>{const [a,b,c]=nrm(x,y,z);return [Math.PI/2-Math.asin(b),Math.atan2(a,c),0,'YXZ']};
const dirZ=(x,y,z,roll=0)=>{const [a,b,c]=nrm(x,y,z);return [-Math.asin(b),Math.atan2(a,c),roll,'YXZ']};
const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2];
const len=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
// A stick from a to b (cylinder or cone).
const stick=(prim,color,a,b,r,bone=0,fx=0)=>[prim,color,mid(a,b),[r,len(a,b),r],dirY(b[0]-a[0],b[1]-a[1],b[2]-a[2]),bone,fx];

function prep(source,matrix,color,rig){
 const pos=source.attributes.position,nor=source.attributes.normal,index=source.index,n=index?index.count:pos.count;
 const P=new Float32Array(n*3),N=new Float32Array(n*3),C=new Float32Array(n*3),R=new Float32Array(n*4);
 const v=new V3(),normalMatrix=new THREE.Matrix3().getNormalMatrix(matrix),flip=matrix.determinant()<0;
 for(let i=0;i<n;i++){
  const corner=i%3,k=flip&&corner?i-corner+(3-corner):i,src=index?index.getX(k):k;
  v.fromBufferAttribute(pos,src).applyMatrix4(matrix);P[i*3]=v.x;P[i*3+1]=v.y;P[i*3+2]=v.z;
  v.fromBufferAttribute(nor,src).applyMatrix3(normalMatrix).normalize();N[i*3]=v.x;N[i*3+1]=v.y;N[i*3+2]=v.z;
  C[i*3]=color.r;C[i*3+1]=color.g;C[i*3+2]=color.b;R[i*4]=rig[0];R[i*4+1]=rig[1];R[i*4+2]=rig[2];R[i*4+3]=rig[3];
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setAttribute('normal',new THREE.BufferAttribute(N,3));
 g.setAttribute('color',new THREE.BufferAttribute(C,3));g.setAttribute('aRig',new THREE.BufferAttribute(R,4));return g;
}
// parts: [prim, colour, [x,y,z], scale|[sx,sy,sz], [rx,ry,rz,order?], bone, fx]  bone 0 body · 1 head · 2 jaw · 3 tail · 4-7 legs; fx 1 flame (glow + flicker) · 2 glow
function bakeRig(parts,rig){
 const m=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler(),list=[];
 for(const [prim,color,p,s,r=[0,0,0],bone=0,fx=0] of parts){
  m.compose(new V3(...p),q.setFromEuler(e.set(r[0],r[1],r[2],r[3]||'XYZ')),typeof s==='number'?new V3(s,s,s):new V3(...s));
  const piv=bone===1?rig.H:bone===2?rig.J:bone===3?rig.T:bone>=4?rig.L[bone-4]:[0,0,0];
  list.push(prep(PRIM[prim],m,new THREE.Color(color),[piv[0],piv[1],piv[2],bone+16*fx]));
 }
 const g=mergeGeometries(list,false);for(const x of list)x.dispose();if(!g)throw new Error('Monster merge failed');
 g.computeBoundingSphere();return g;
}

/* ---------- the shared wolf body; kinds add their own colours, proportions and decorations ---------- */
function wolfBody(c){
 const P=[],add=(...p)=>P.push(p),{fur,cream,dark=fur,belly=cream,eye=0xffb43a,ear=0xe8988f,nose=0x1d2228,paw=cream,leg=fur}=c;
 const bs=c.bodyScale||[1,1,1],legR=c.legR||.088;
 // body
 add('ball',fur,[0,.64,-.04],[.3*bs[0],.29*bs[1],.56*bs[2]]);
 add('low',belly,[0,.49,0],[.22*bs[0],.15,.42*bs[2]]);
 add('low',cream,[0,.76,.3],[.21,.24,.17]);
 if(!c.noRuff)for(const s of [-1,1])add('spike',dark,[s*.19,.9,.2],[.09,.26,.08],dirY(s*.5,.6,-.7));
 if(!c.noRuff)add('spike',dark,[0,.98,.12],[.09,.27,.08],dirY(0,.55,-.85));
 // head (bone 1)
 add('ball',fur,[0,1.02,.42],[.3,.27,.28],[0,0,0],1);
 add('ball',c.muzzle||cream,[0,.93,.64],[.15,.1,.17],[0,0,0],1);
 for(const s of [-1,1]){
  add('low',c.cheek||cream,[s*.15,.92,.55],[.12,.09,.1],[0,0,0],1);
  add('low',eye,[s*.12,1.07,.66],[.06,.07,.03],[0,0,0],1,c.eyeGlow?2:0);
  add('gem',0x14181c,[s*.12,1.065,.685],[.035,.045,.02],[0,0,0],1);
  add('gem',0xffffff,[s*.105,1.09,.697],[.018,.018,.012],[0,0,0],1);
  add('box',c.brow||cream,[s*.12,1.15,.63],[.11,.03,.03],[0,0,-s*.3],1);
  add('cone',c.earFur||fur,[s*.17,1.32,.36],[.12,.3,.11],[-.15,0,-s*.2],1);
  add('cone',ear,[s*.17,1.3,.41],[.065,.19,.03],[-.15,0,-s*.2],1,c.earGlow?2:0);
 }
 add('low',nose,[0,.97,.8],[.07,.05,.05],[0,0,0],1);
 // jaw (bone 2): chin, tongue and two little fangs
 add('low',c.jaw||cream,[0,.85,.67],[.11,.05,.14],[0,0,0],2);
 add('low',0xe0706a,[0,.875,.67],[.05,.018,.07],[0,0,0],2);
 for(const s of [-1,1])add('spike',0xffffff,[s*.055,.89,.77],[.022,.055,.022],[0,0,0],2);
 // tail (bone 3)
 if(c.tail!=='none'){
  add('ball',c.tailFur||fur,[0,.93,-.78],[.155,.165,.33],[.62,0,0],3);
  add('low',c.tailTip||cream,[0,1.1,-1.0],[.13,.14,.15],[0,0,0],3);
 }
 // legs (bones 4-7): leg, paw, and a haunch on the hind legs
 WOLF_RIG.L.forEach(([x,y,z],j)=>{
  add('leg',leg,[x,y-.22,z],[legR,.44,legR*1.13],[0,0,0],4+j);
  add('low',paw,[x,.055,z+.03],[legR*1.15,.055,.11],[0,0,0],4+j);
  if(j>=2)add('low',fur,[x,y-.02,z],[.11*bs[0],.16,.15],[0,0,0],4+j);
 });
 return P;
}
// A leaf lying along `d` (flat octahedron).
const leaf=(color,p,d,s=1,bone=0)=>['gem',color,p,[.08*s,.028*s,.17*s],dirZ(...d),bone];

function bramble(){
 const fur=0x4d525b,G=[0x55893a,0x74aa44,0x96c955],P=wolfBody({fur,cream:0xeee0c2,dark:0x3a3d44,eye:0xffaa30,tailFur:0x4f7d33});
 // leafy collar over the shoulders, leaves shingled down the whole back (it reads green from above), a leafy cap and a twig antler, a leafy tail
 for(let i=0;i<9;i++){const a=-1.75+i*3.5/8,x=Math.sin(a)*.27,y=.8+Math.cos(a)*.2;P.push(leaf(G[i%3],[x,y,.2],[Math.sin(a)*.55,Math.cos(a)*.55+.25,-1],1.3))}
 for(let i=0;i<5;i++)for(const s of [-1,0,1])P.push(leaf(G[(i+s+3)%3],[s*.15,.93-i*.025-Math.abs(s)*.05,.1-i*.15],[s*.6,.28,-1],(s?1.1:1.25)-i*.06));
 for(const s of [-1,1])P.push(leaf(G[1],[s*.3,.62,-.05],[s*1,-.2,-.6],1.1),leaf(G[2],[s*.28,.66,-.32],[s*1,-.1,-.7],1));
 for(const [x,z,d] of [[0,.42,[0,.9,-.4]],[-.1,.36,[-.5,.7,-.5]],[.1,.36,[.5,.7,-.5]]])P.push(leaf(G[(x>0?2:0)],[x,1.27,z],d,.8,1));
 const base=[.02,1.24,.36],tip=[-.03,1.62,.24],fork=[-.005,1.46,.3];
 P.push(stick('cyl',0x7a5532,base,tip,.032,1),stick('cyl',0x7a5532,fork,[.11,1.58,.36],.024,1),stick('cyl',0x7a5532,[-.02,1.54,.27],[-.13,1.64,.3],.02,1));
 P.push(leaf(G[2],[.12,1.6,.37],[.6,.6,.3],.6,1),leaf(G[0],[-.03,1.66,.22],[0,.9,-.3],.55,1));
 for(let i=0;i<6;i++){const t=i/5,y=.82+t*.28,z=-.6-t*.38;P.push(leaf(G[i%3],[(i%2?.07:-.07),y,z],[(i%2?.7:-.7),.6,-1],1.15,3))}
 return P;
}
function granite(){
 const fur=0x474c55,P=wolfBody({fur,cream:0xe6dcc6,dark:0x34383f,eye:0xff9a3a,bodyScale:[1.18,1.08,1.04],legR:.105});
 const R=[0xb3b6bb,0x9a9ea5,0xc6c8cc];
 const rock=(c,p,s,bone=0,r=0)=>P.push(['rock',c,p,s,[r,r*1.7,r*.6],bone]);
 // boulder plates over the shoulders, down the back and on the tail: from above it is mostly stone
 for(const s of [-1,1])rock(R[0],[s*.28,.88,.18],[.21,.19,.21],0,s*.4);
 rock(R[1],[0,1.02,-.02],[.23,.17,.24],0,.3);rock(R[2],[0,.97,-.32],[.2,.15,.2],0,.9);
 for(const s of [-1,1])rock(R[1],[s*.22,.86,-.4],[.15,.13,.15],0,s);
 rock(R[0],[0,1.03,-.86],[.16,.14,.17],3,.5);
 rock(R[2],[0,1.25,.36],[.08,.06,.08],1,.2);   // a little stone on the brow
 return P;
}
function frost(){
 const fur=0xa8c7ee,white=0xf6f8fd,P=wolfBody({fur,cream:white,dark:0x8fb3e0,eye:0x4a9cff,ear:0xf6f8fd,paw:white,tail:'none',noRuff:true,legR:.07});
 const ICE=[0x8fd8ff,0xc4ecff];
 // fluffy white ruff and chest
 for(const s of [-1,1])P.push(['low',white,[s*.16,.84,.28],[.13,.16,.12]],['spike',fur,[s*.2,.9,.16],[.09,.26,.08],dirY(s*.5,.6,-.75)]);
 P.push(['low',white,[0,.66,.42],[.15,.17,.12]],['spike',fur,[0,.98,.1],[.09,.27,.08],dirY(0,.55,-.85)]);
 // ice-crystal crest behind the ears (glows a little)
 P.push(['gem',ICE[0],[0,1.44,.17],[.075,.3,.075],dirY(0,1,-.45),1,2]);
 for(const s of [-1,1])P.push(['gem',ICE[1],[s*.15,1.37,.19],[.065,.25,.065],dirY(s*.45,1,-.4),1,2],['gem',ICE[0],[s*.26,1.23,.23],[.05,.18,.05],dirY(s*1,.8,-.3),1,2]);
 // long plume tail, pale blue over white
 P.push(['ball',fur,[0,.88,-.9],[.14,.15,.42],[.35,0,0],3],['low',white,[0,.82,-.96],[.12,.1,.32],[.35,0,0],3],['low',white,[0,1.01,-1.27],[.11,.11,.15],[0,0,0],3]);
 return P;
}
function ember(){
 const fur=0x3c3248,F=[0xff4a26,0xff7a2e,0xffb43c],P=wolfBody({fur,cream:0xead8c0,dark:0x2a2232,eye:0xffa62b,eyeGlow:true,ear:0xff7a3a,earGlow:true,tail:'none',noRuff:true,legR:.082});
 // flame mane around the neck, a flame crest on the head, a flame tail and flame marks on the legs
 for(let i=0;i<9;i++){const a=-1.8+i*3.6/8,x=Math.sin(a)*.26,y=.82+Math.cos(a)*.2,d=[Math.sin(a)*.6,Math.cos(a)*.7+.55,-.75];
  P.push(['cone',F[i%2],[x,y+.1,.14],[.14,.48,.13],dirY(...d),0,1]);if(i%2===0)P.push(['cone',F[2],[x*.9,y+.08,.17],[.08,.3,.07],dirY(...d),0,1])}
 for(const [x,s,d] of [[0,1.3,[0,1,-.35]],[-.11,1,[-.35,1,-.4]],[.11,1,[.35,1,-.4]]])P.push(['cone',F[x?1:0],[x,1.34,.32],[.1*s,.38*s,.09*s],dirY(...d),1,1]);
 P.push(['cone',F[2],[0,1.3,.34],[.06,.26,.05],dirY(0,1,-.35),1,1]);
 P.push(['ball',fur,[0,.82,-.6],[.1,.11,.18],[.6,0,0],3]);
 for(const [d,s,c] of [[[0,.85,-.55],1.2,0],[[.35,.7,-.6],1,1],[[-.35,.7,-.6],1,1],[[0,.45,-.9],1,2],[[0,.9,-.4],.7,2]]){const o=[0,.86,-.66],r=.26*s;P.push(['cone',F[c],[o[0]+d[0]*r,o[1]+d[1]*r,o[2]+d[2]*r],[.13*s,.5*s,.12*s],dirY(...d),3,1])}
 WOLF_RIG.L.forEach(([x,y,z],j)=>P.push(['spike',F[1],[x+Math.sign(x)*.07,.26,z],[.045,.14,.02],[0,0,Math.sign(x)*.15],4+j,2]));
 for(const s of [-1,1])P.push(['spike',F[0],[s*.3,.66,-.12],[.06,.18,.02],[.4,0,s*.2],0,2]);
 return P;
}
function boar(){
 const hide=0x7b5034,hump=0x86593a,belly=0xa6774e,bristle=0x3a2416,snout=0xdcb08a,R=BOAR_RIG,P=[],add=(...p)=>P.push(p);
 add('ball',hide,[0,.56,-.04],[.35,.31,.52]);add('ball',hump,[0,.64,.2],[.31,.27,.28]);add('low',belly,[0,.42,0],[.26,.15,.4]);
 for(let i=0;i<7;i++){const z=.34-i*.13,y=.92-Math.abs(z-.15)*.18;add('spike',bristle,[0,y,z],[.06,.22-(i%2)*.04,.05],dirY(0,.8,-.6))}
 add('ball',hide,[0,.6,.52],[.25,.24,.26],[0,0,0],1);
 add('cyl',snout,[0,.53,.76],[.13,.16,.12],[Math.PI/2,0,0],1);add('cyl',0xf2a0a0,[0,.53,.85],[.135,.035,.125],[Math.PI/2,0,0],1);
 for(const s of [-1,1]){
  add('gem',0x5a2a2a,[s*.05,.54,.872],[.025,.03,.015],[0,0,0],1);
  add('gem',0x14181c,[s*.13,.69,.7],[.04,.05,.03],[0,0,0],1);add('gem',0xffffff,[s*.12,.71,.72],[.015,.015,.01],[0,0,0],1);
  add('box',bristle,[s*.12,.77,.69],[.11,.03,.03],[0,0,s*.38],1);
  add('cone',0x6b4228,[s*.17,.8,.43],[.08,.17,.05],dirY(s*.7,.8,-.3),1);add('cone',0xe89a90,[s*.165,.795,.455],[.045,.11,.02],dirY(s*.7,.8,-.3),1);
 }
 add('spike',bristle,[0,.86,.44],[.05,.18,.05],dirY(0,.8,-.5),1);add('spike',bristle,[0,.86,.33],[.05,.16,.05],dirY(0,.7,-.7),1);
 add('low',0xc08a66,[0,.45,.74],[.11,.045,.12],[0,0,0],2);
 for(const s of [-1,1])add('spike',0xfffaf0,[s*.11,.54,.84],[.04,.2,.04],dirY(s*.35,1,.3),2);
 P.push(stick('cyl',0x6b4228,[0,.6,-.52],[0,.66,-.7],.024,3));add('low',bristle,[0,.68,-.72],[.045,.05,.045],[0,0,0],3);
 R.L.forEach(([x,y,z],j)=>{add('leg',0x6b4429,[x,y-.16,z],[.09,.3,.1],[0,0,0],4+j);add('cyl',0x2e2018,[x,.035,z+.01],[.088,.07,.095],[0,0,0],4+j)});
 return P;
}
function wolf(){return wolfBody({fur:0x66717f,cream:0xf1e4c8,dark:0x4a5360})}
const BUILD={wolf,bramble,boar,granite,frost,ember};
export function monsterGeometry(kind){return bakeRig(BUILD[kind](),RIG[kind])}
// Shadow stand-in: a handful of low parts on the wolf rig (every kind uses it, scaled per kind).
export function shadowGeometry(){const R=WOLF_RIG,P=[['low',0,[0,.64,-.04],[.27,.26,.5]],['low',0,[0,1.0,.45],[.23,.22,.25],[0,0,0],1],['spike',0,[0,.9,-.8],[.1,.4,.1],dirY(0,.6,-.8),3]];
 R.L.forEach(([x,y,z],j)=>P.push(['box',0,[x,y-.24,z],[.1,.46,.1],[0,0,0],4+j]));return bakeRig(P,R)}

/* ---------- the rig shader (patched into MeshStandardMaterial and the shadow depth material) ---------- */
// Per instance: aPoseA (head yaw, head pitch, jaw, tail yaw), aPoseB (tail pitch, leg FL, FR, BL),
// aPoseC (leg BR, head roll, flame phase, -), aPoseD (lift FL, FR, BL, BR). Leg angle > 0 swings the paw back.
const RIG_GLSL=`
attribute vec4 aRig;attribute vec4 aPoseA;attribute vec4 aPoseB;attribute vec4 aPoseC;attribute vec4 aPoseD;
uniform vec3 uHead;uniform float uTime;varying float vGlow;
mat3 rigR;vec3 rigT;float rigFx;
mat3 rigX(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0.,0.,c,s,0.,-s,c);}
mat3 rigY(float a){float c=cos(a),s=sin(a);return mat3(c,0.,-s,0.,1.,0.,s,0.,c);}
mat3 rigZ(float a){float c=cos(a),s=sin(a);return mat3(c,s,0.,-s,c,0.,0.,0.,1.);}
void rig(){
 rigFx=floor(aRig.w/16.+.01);float bone=aRig.w-rigFx*16.;vec3 P=aRig.xyz;
 rigR=mat3(1.);rigT=vec3(0.);vGlow=rigFx>1.5?.55:rigFx>.5?.9:0.;
 if(bone>.5&&bone<2.5){mat3 Rh=rigY(aPoseA.x)*rigX(aPoseA.y)*rigZ(aPoseC.y);
  if(bone<1.5){rigR=Rh;rigT=uHead-Rh*uHead;}
  else{mat3 Rj=rigX(aPoseA.z);rigR=Rh*Rj;rigT=Rh*(P-Rj*P-uHead)+uHead;}}
 else if(bone>2.5&&bone<3.5){mat3 Rt=rigY(aPoseA.w)*rigX(aPoseB.x);rigR=Rt;rigT=P-Rt*P;}
 else if(bone>3.5){float a=bone<4.5?aPoseB.y:bone<5.5?aPoseB.z:bone<6.5?aPoseB.w:aPoseC.x;
  float l=bone<4.5?aPoseD.x:bone<5.5?aPoseD.y:bone<6.5?aPoseD.z:aPoseD.w;mat3 Rl=rigX(a);rigR=Rl;rigT=P-Rl*P+vec3(0.,l,0.);}
}
vec3 rigFlick(vec3 p){if(rigFx>.5&&rigFx<1.5){float ph=aPoseC.z;p.x+=sin(uTime*9.+p.y*9.+ph)*.022;p.z+=sin(uTime*7.+p.y*7.+ph*1.3)*.018;p.y+=(.5+.5*sin(uTime*13.+p.x*11.+p.z*7.+ph))*.035;}return p;}
`;
export const RIG_TIME={value:0};
function patch(shader,uHead,color){
 shader.uniforms.uHead=uHead;shader.uniforms.uTime=RIG_TIME;
 let v=RIG_GLSL+shader.vertexShader.replace('#include <begin_vertex>','rig();vec3 transformed=rigFlick(rigR*position+rigT);');
 if(color)v=v.replace('#include <beginnormal_vertex>','rig();vec3 objectNormal=rigR*normal;');
 shader.vertexShader=v;
 if(color)shader.fragmentShader='varying float vGlow;\n'+shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n totalEmissiveRadiance+=vColor.rgb*vGlow;');
}
function rigColorCompile(shader){patch(shader,this.userData.uHead,true)}
function rigDepthCompile(shader){patch(shader,this.userData.uHead,false)}
const headUniform=kind=>({value:new V3(...RIG[kind].H)});
export function rigMaterial(kind){const m=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.86,metalness:0});m.userData.uHead=headUniform(kind);m.onBeforeCompile=rigColorCompile;return m}
export function rigDepthMaterial(kind){const m=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});m.userData.uHead=headUniform(kind);m.onBeforeCompile=rigDepthCompile;return m}
// The same rig for any baked figure (0.9 farmers: arms and legs on bones 4-7, head on bone 1 turning about `head`).
export function rigMaterialAt(head,roughness=.86){const m=new THREE.MeshStandardMaterial({vertexColors:true,roughness,metalness:0,side:THREE.DoubleSide});m.userData.uHead={value:new V3(head[0],head[1],head[2])};m.onBeforeCompile=rigColorCompile;return m}

/* ---------- gaits: writes leg angles/lifts and body motion for stride phase `ph` (m = how much it is moving, 0..1) ---------- */
export function gaitPose(type,ph,m,o){
 const s=Math.sin,c=Math.cos,P=Math.PI;if(m<=0)return;
 if(type==='trot'||type==='hop'){
  const hop=type==='hop',A=hop?.5:.6,L=hop?.08:.11,off=[0,P,P,0];
  for(let j=0;j<4;j++){const p=ph+off[j];o.legs[j]=-A*s(p)*m;o.lift[j]=L*Math.max(0,c(p))*m}
  if(hop){o.y+=.08*Math.abs(s(ph))*m;o.roll+=.06*s(ph)*m;o.hp+=.12*c(2*ph)*m;o.pitch+=.05*s(2*ph)*m}
  else{o.y+=.055*(.5-.5*c(2*ph))*m;o.hp+=.08*c(2*ph)*m;o.roll+=.03*s(ph)*m}
 }else if(type==='gallop'){
  const off=[0,.5,P+.25,P+.7],A=[1,1,.85,.85];
  for(let j=0;j<4;j++){const p=ph+off[j];o.legs[j]=-A[j]*s(p)*m;o.lift[j]=.14*Math.max(0,c(p))*m}
  const q=ph+.35;o.pitch+=-.16*s(q)*m;o.y+=(.05+.1*Math.max(0,s(q)))*m;o.sz*=1+.09*s(ph)*m;o.sy*=1-.06*s(ph)*m;o.hp+=.12*s(q)*m;
 }else{   // plod (granite) and prowl (ember): four-beat walk with a heavy side sway
  const prowl=type==='prowl',off=[P/2,P*1.5,0,P],A=prowl?.55:.45;
  for(let j=0;j<4;j++){const p=ph+off[j];o.legs[j]=-A*s(p)*m;o.lift[j]=(prowl?.13:.1)*Math.max(0,c(p))*m}
  o.roll+=(prowl?.05:.08)*s(ph)*m;o.y-=.035*Math.abs(c(2*ph))*m;o.hy+=.1*s(ph)*m;o.hp+=(prowl?.2:.1)*m;o.sx*=1+.03*Math.abs(c(2*ph))*m;
 }
}
