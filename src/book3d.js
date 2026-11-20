// 0.17 수첩 3D: the name note on the ground, the memory wolf's sign and a visiting friend (꼬꼬마을, docs/v017-book3d.md).
// The page owns every rule (index.html b3Tick, scene-only: it reads the world and never writes to it). This file only draws
// window.getBook3dState() every frame and plays the one-shot cues the page sends (noteDrop · noteRead · signDown · visitHello).
// No text is drawn in 3D: the paper is a folded sheet, the sign a blank board with a white diamond, a friend is the monster model
// itself in a warm tint with a pink ring, wagging and hopping. village.js keeps only a handful of hooks (book3d(...), events, step, sprites, tap, inspect).
import * as THREE from 'three';
import { solid } from './geo.js';
import { RIG, GAIT, gaitPose, rigDepthMaterial } from './monsters.js';

const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const easeOut=u=>1-(1-u)*(1-u),easeIn=u=>u*u;
const read=()=>{try{const s=window.getBook3dState&&window.getBook3dState();return s&&typeof s==='object'?s:null}catch{return null}};
const POSE=['aPoseA','aPoseB','aPoseC','aPoseD'];
const FALL=1.4,READ=.7,GONE=.4,SIGN_FALL=.45,SIGN_LIE=1.1,SIGN_SHRINK=.35,FADE=.5;   // seconds (view clock)
// Model sizes: the first CI shots (run 44651957130, 1180×820) showed the paper at about 13 px and the sign at about 20 px, too small for a child to spot.
const PAPER_SIZE=2.2,SIGN_SIZE=1.5;

// v: {scene, camera, herd(kind) → the herd's InstancedMesh, peek(wolfId) → {x,y,z (top of the head), fx, fz (feet), size, state} | null,
//     fx:{sparkles, starBurst, ringWave, dustBurst, flashAt}, sprite, decal (always-on sprites, only inside the village's ambient pass),
//     CELL, C:{WHITE, GOLD, PINK, SKY, CREAM, INK}, reduced(), scale() → fxScale, kindSize(kind), WS (monster scale)}
export function book3d(v){
 const {scene,camera,herd,peek,fx,sprite,decal,CELL,C,reduced}=v;
 const V3=THREE.Vector3,dir=new V3();camera.getWorldDirection(dir);const toCam=Math.atan2(-dir.x,-dir.z);   // yaw that faces the camera
 const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.72,metalness:0,side:THREE.DoubleSide});
 let time=0,state=null;
 const stats={papers:0,reads:0,taps:0,signs:0,downs:0,friends:0,hellos:0};

 /* ----- the name note: a folded sheet with a red seal. Pool of two (an old one may still be flying up while a new one falls) ----- */
 const paperGeo=solid([['box',0xfff8e6,[0,.055,.1],[.44,.014,.21],[-.42,0,0]],['box',0xf3e6c4,[0,.055,-.1],[.44,.014,.21],[.42,0,0]],
  ['cyl',0xe2503f,[0,.03,0],[.055,.02,.055]],['box',0xd9c79a,[0,.012,0],[.44,.01,.03]]]);
 const papers=[0,1].map(()=>{const m=new THREE.Mesh(paperGeo,mat);m.visible=false;m.castShadow=true;m.name='book3d-paper';scene.add(m);return {m,id:0,kind:'',x:0,z:0,mode:'off',t0:0,tap:-9,y:0,landed:false}});
 const paperOf=id=>papers.find(p=>p.mode!=='off'&&p.id===id);
 function newPaper(id,kind,x,z,fall){
  const p=papers.find(q=>q.mode==='off')||papers.reduce((a,b)=>a.t0<b.t0?a:b);
  Object.assign(p,{id,kind,x,z,mode:fall&&!reduced()?'fall':'rest',t0:time,tap:-9,landed:!fall||reduced()});stats.papers++;return p;
 }
 function drawPaper(p){
  const t=time-p.t0,sc=clamp(v.scale(),1,1.9)*PAPER_SIZE,m=p.m;let y=.02,ry=p.id*1.7,rx=0,rz=0,s=sc,sx=0,sz=0;
  if(p.mode==='fall'){const u=Math.min(1,t/FALL);y=.02+1.6*(1-easeOut(u));const w=Math.sin(t*5.2)*.32*(1-u);sx=Math.cos(toCam)*w;sz=-Math.sin(toCam)*w;ry+=t*2.4;rz=Math.sin(t*6.3)*.7*(1-u);rx=Math.sin(t*4.1)*.4*(1-u);
   if(u>=1){p.mode='rest';p.t0=time;if(!p.landed){p.landed=true;fx.ringWave(p.x,p.z,.9*sc,C.CREAM,.45);fx.sparkles(p.x,.5,p.z,5,.5,C.WHITE,0,.3)}}}
  else if(p.mode==='rest'){if(!reduced()){y+=.025*(1+Math.sin(time*2.2+p.id));ry+=Math.sin(time*1.3+p.id)*.22;rx=Math.sin(time*3.1+p.id)*.07}
   const h=time-p.tap;if(h>=0&&h<.45&&!reduced())y+=.5*4*(h/.45)*(1-h/.45)}
  else if(p.mode==='read'){const u=Math.min(1,t/READ);y=.02+2.4*easeIn(u);ry+=t*9;s=sc*(1-.75*u);if(u>=1)p.mode='off'}
  else if(p.mode==='gone'){const u=Math.min(1,t/GONE);s=sc*(1-u);if(u>=1)p.mode='off'}
  m.visible=p.mode!=='off'&&s>.01;p.y=y;
  if(m.visible){m.position.set(p.x+sx,y,p.z+sz);m.rotation.set(rx,ry,rz,'YXZ');m.scale.setScalar(s)}
 }

 /* ----- the memory wolf's sign: a blank wooden board (pale blue face, white diamond) on a short post, over the wolf's head ----- */
 const signGeo=solid([['cyl',0x8a5a2e,[0,-.3,0],[.035,.36,.035]],['box',0xb07a40,[0,0,0],[.58,.38,.05]],['box',0xcfeeff,[0,0,.03],[.5,.3,.012]],['box',0xcfeeff,[0,0,-.03],[.5,.3,.012]],
  ['gem',0xffffff,[0,0,.045],[.075,.11,.02]],['gem',0xffffff,[0,0,-.045],[.075,.11,.02]]]);
 const signMesh=new THREE.Mesh(signGeo,mat);signMesh.visible=false;signMesh.castShadow=true;signMesh.name='book3d-sign';scene.add(signMesh);
 const sign={wolf:0,mode:'off',t0:0,x:0,y:0,z:0,fx:0,fz:0,size:1,done:0};   // done = the wolf whose sign already came down (never picked up again)
 const at=p=>{sign.x=p.x;sign.y=p.y;sign.z=p.z;sign.fx=p.fx;sign.fz=p.fz;sign.size=p.size};
 function drawSign(){
  const g=state&&state.sign,sc=clamp(v.scale()*.85,1,1.7)*SIGN_SIZE;
  if(g&&g.wolf&&!g.down&&g.wolf!==sign.done&&(sign.mode==='off'||sign.wolf!==g.wolf)){const p=peek(g.wolf);
   if(p&&p.state!=='dead'){sign.wolf=g.wolf;sign.mode='carry';sign.t0=time;at(p);stats.signs++}else sign.done=g.wolf}   // a wolf that is already down never gets one
  if(sign.mode==='carry'){
   const p=peek(sign.wolf);
   if(!g||g.wolf!==sign.wolf){sign.mode='gone';sign.t0=time;sign.done=sign.wolf}              // the question ended without a first-try answer
   else if(g.down||!p||p.state==='dead'){sign.mode='drop';sign.t0=time;sign.done=sign.wolf}   // put down (right answer) or the wolf fell
   else at(p);
  }
  let y=sign.y+.55*sc,rx=-.35,rz=0,s=sc,x=sign.x,z=sign.z;const t=time-sign.t0;   // the post (0.48 below the board's middle) ends just above the head: it floats
  if(sign.mode==='carry'){if(!reduced()){y+=.08*Math.sin(time*3.4);rz=Math.sin(time*4.2)*.08}}
  else if(sign.mode==='drop'){if(reduced()){sign.mode='off'}else{const u=Math.min(1,t/SIGN_FALL);x=sign.x+(sign.fx-sign.x)*u;z=sign.z+(sign.fz-sign.z)*u;y=(sign.y+.55*sc)*(1-easeIn(u))+.12*u;rx=-.35-1.2*easeIn(u);
   if(t>SIGN_FALL+SIGN_LIE)s=sc*Math.max(0,1-(t-SIGN_FALL-SIGN_LIE)/SIGN_SHRINK);if(t>SIGN_FALL+SIGN_LIE+SIGN_SHRINK)sign.mode='off'}}
  else if(sign.mode==='gone'){const u=Math.min(1,t/SIGN_SHRINK);s=sc*(1-u);if(u>=1||reduced())sign.mode='off'}
  signMesh.visible=sign.mode!=='off'&&s>.01;
  if(signMesh.visible){signMesh.position.set(x,y,z);signMesh.rotation.set(rx,toCam,rz,'YXZ');signMesh.scale.setScalar(s)}
  sign.shownY=y;
 }

 /* ----- a visiting friend: the monster's own rigged model (a small instanced copy per kind) in a warm tint, a ribbon bow if it has one ----- */
 const rigs={},CAP=2,FRIEND_TINT=new THREE.Color(1.16,1.06,1.04);   // warm and light (the shiny look stays off: the spec's "반짝 모습으로 놀러 오기" switch is not built)
 function rigFor(kind){
  if(rigs[kind]!==undefined)return rigs[kind];
  const src=herd(kind);if(!src||!src.geometry){rigs[kind]=null;return null}
  const g=src.geometry.clone();for(const k of POSE)if(g.getAttribute(k))g.deleteAttribute(k);
  const pose=POSE.map(k=>{const a=new THREE.InstancedBufferAttribute(new Float32Array(CAP*4),4);a.setUsage(THREE.DynamicDrawUsage);g.setAttribute(k,a);return a});
  const mesh=new THREE.InstancedMesh(g,src.material,CAP);mesh.count=0;mesh.visible=false;mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);for(let i=0;i<CAP;i++)mesh.setColorAt(i,FRIEND_TINT);
  try{mesh.customDepthMaterial=rigDepthMaterial(kind)}catch{mesh.castShadow=false}
  mesh.name='book3d-friend-'+kind;scene.add(mesh);return rigs[kind]={mesh,pose};
 }
 const bowGeo=solid([['sphere',0xff5a7a,[0,0,0],.07],['cone',0xff5a7a,[-.11,0,0],[.08,.15,.05],[0,0,Math.PI/2]],['cone',0xff5a7a,[.11,0,0],[.08,.15,.05],[0,0,-Math.PI/2]],
  ['box',0xe0405f,[-.04,-.1,0],[.03,.12,.02],[0,0,.3]],['box',0xe0405f,[.04,-.1,0],[.03,.12,.02],[0,0,-.3]]]);
 const bow=new THREE.Mesh(bowGeo,mat);bow.visible=false;bow.name='book3d-ribbon';scene.add(bow);
 const P={y:0,pitch:0,roll:0,hy:0,hp:0,hr:0,jaw:0,ty:0,tp:.35,sx:1,sy:1,sz:1,legs:[0,0,0,0],lift:[0,0,0,0]};
 const qa=new THREE.Quaternion(),ea=new THREE.Euler(0,0,0,'YXZ'),pa=new V3(),sa=new V3(),ma=new THREE.Matrix4(),na=new V3();
 let friend=null;
 function writePose(pose,i,seed){const a=pose[0].array,b=pose[1].array,c=pose[2].array,d=pose[3].array,k=i*4;
  a[k]=P.hy;a[k+1]=P.hp;a[k+2]=P.jaw;a[k+3]=P.ty;b[k]=P.tp;b[k+1]=P.legs[0];b[k+2]=P.legs[1];b[k+3]=P.legs[2];
  c[k]=P.legs[3];c[k+1]=P.hr;c[k+2]=seed*20;c[k+3]=0;d[k]=P.lift[0];d[k+1]=P.lift[1];d[k+2]=P.lift[2];d[k+3]=P.lift[3];
  for(const p of pose)p.needsUpdate=true}
 function stepFriend(dt){
  const s=state&&state.visit;
  if(s&&(!friend||friend.id!==s.id)){
   const x=num(s.x),z=num(s.z);friend={id:s.id,kind:RIG[s.kind]?s.kind:'wolf',ribbon:!!s.ribbon,shiny:!!s.shiny,x,z,tx:x,tz:z,ry:Math.atan2(-x,-z),ph:0,spd:0,act:s.act,helloAt:-9,fade:-1,seed:(s.id*.618)%1};
   stats.friends++}
  if(!friend)return;
  if(s&&s.id===friend.id){friend.tx=num(s.x);friend.tz=num(s.z);if(s.act==='hello'&&friend.act!=='hello')greet();friend.act=s.act}
  else if(friend.fade<0)friend.fade=time;   // walked back into the forest: fade away there
  const f=friend,px=f.x,pz=f.z,k=reduced()?1:Math.min(1,dt*8);f.x+=(f.tx-f.x)*k;f.z+=(f.tz-f.z)*k;
  const dx=f.x-px,dz=f.z-pz,moved=Math.hypot(dx,dz);
  if(dt>0)f.spd+=(Math.min(4,moved/dt)-f.spd)*Math.min(1,dt*7);
  const want=f.act==='hello'?toCam:moved>.002?Math.atan2(dx,dz):f.ry;let d=(want-f.ry)%6.283;if(d>Math.PI)d-=6.283;if(d<-Math.PI)d+=6.283;f.ry+=d*(reduced()?1:Math.min(1,dt*8));
 }
 function greet(){
  const f=friend;f.helloAt=time;stats.hellos++;
  const top=1.25*size(f);fx.sparkles(f.x,top,f.z,10,.6,C.PINK,0,.6);fx.starBurst(f.x,top,f.z,8,.7,[C.PINK,C.WHITE]);fx.ringWave(f.x,f.z,2.2*size(f),C.PINK,.55);
 }
 const size=f=>v.WS*clamp(num(v.kindSize(f.kind))||1,.85,1.3);
 function drawFriend(dt){
  for(const k in rigs)if(rigs[k]){rigs[k].mesh.count=0;rigs[k].mesh.visible=false}
  bow.visible=false;if(!friend)return;
  const f=friend,r=rigFor(f.kind);
  let grow=1;if(f.fade>=0){const u=(time-f.fade)/FADE;if(u>=1||reduced()){friend=null;return}grow=1-u}
  if(!r)return;
  const less=reduced(),G=GAIT[f.kind]||GAIT.wolf,R=RIG[f.kind]||RIG.wolf;
  P.y=P.pitch=P.roll=P.hy=P.hp=P.hr=P.jaw=P.ty=0;P.tp=.35;P.sx=P.sy=P.sz=1;for(let j=0;j<4;j++){P.legs[j]=0;P.lift[j]=0}
  const run=f.act==='back'&&f.spd>1.8,type=run?G.run:G.walk,mov=clamp((f.spd-.05)/.3,0,1);
  if(!less&&mov>0){f.ph+=dt*6.283*(G.hz[type]||2)*clamp(f.spd/1.4,.6,1.5);gaitPose(type,f.ph,mov,P)}
  // friendly: tail up and wagging, head tilted, mouth a little open (a smile); hello = two hops and a big wag, looking at the child
  const w=less?0:1;P.tp=.75;P.ty=w*Math.sin(time*11+f.seed*9)*.45;P.hr=w*.16*Math.sin(time*1.7+f.seed*4);P.jaw=.14;
  const h=time-f.helloAt;if(f.act==='hello'){P.hp-=.25;P.ty=w*Math.sin(time*16)*.7;if(!less&&h>=0&&h<1.2){const u=(h%.6)/.6;P.y+=.55*4*u*(1-u)}}
  if(f.kind==='boar'){P.ty=w*Math.sin(time*26)*.7;P.tp=.3}
  if(!less)P.sy*=1+.02*Math.sin(time*2.6+f.seed*6);
  if(R.tp0)P.tp+=R.tp0;
  const S=size(f)*grow;ea.set(P.pitch,f.ry,P.roll,'YXZ');qa.setFromEuler(ea);pa.set(f.x,P.y*S,f.z);sa.set(S*P.sx,S*P.sy,S*P.sz);ma.compose(pa,qa,sa);
  r.mesh.setMatrixAt(0,ma);r.mesh.setColorAt(0,FRIEND_TINT);r.mesh.count=1;r.mesh.visible=true;r.mesh.instanceMatrix.needsUpdate=true;if(r.mesh.instanceColor)r.mesh.instanceColor.needsUpdate=true;
  writePose(r.pose,0,f.seed);
  if(f.ribbon){na.set(0,R.H[1]-.1,R.H[2]+.1).applyMatrix4(ma);bow.position.copy(na);bow.rotation.set(0,f.ry,0,'YXZ');bow.scale.setScalar(S);bow.visible=true}
  f.top=(R.top?R.top[1]:1.6)*S;
 }

 /* ----- one-shot cues from the page ----- */
 function events(list){
  if(!Array.isArray(list))return;const s=read();
  for(const e of list){if(!e||typeof e!=='object')continue;
   if(e.type==='noteDrop'){
    if(!Number.isFinite(Number(e.x))||!s){fx.sparkles(0,2.2,0,6,3,C.WHITE,0,.8);continue}   // 0.16 cue when the page sends no spot (3D note off)
    if(!paperOf(e.id))newPaper(e.id,e.kind,num(e.x),num(e.z),true);fx.sparkles(num(e.x),1.4,num(e.z),5,.4,C.WHITE,0,.4)}
   else if(e.type==='noteRead'){const p=paperOf(e.id);if(p){p.mode=reduced()?'off':'read';p.t0=time;stats.reads++;fx.sparkles(p.x,.6,p.z,10,.45,C.GOLD,0,.5);fx.flashAt(p.x,.5,p.z,1.2,C.CREAM)}}
   else if(e.type==='signDown'){stats.downs++;const p=peek(num(e.wolf));if(p){fx.sparkles(p.x,p.y+.4,p.z,10,.5,C.SKY,0,.4);fx.ringWave(p.fx,p.fz,2*clamp(p.size,.8,1.6),C.SKY,.55)}}
   // visitHello is played from the pulled state (greet), so a cue that arrives before the friend is drawn is not lost
  }
 }

 /* ----- every frame (from the village step: dt = effect clock, 0 while paused) ----- */
 function step(dt){
  time+=dt;state=read();
  const n=state&&state.note;
  if(n&&!paperOf(n.id))newPaper(n.id,n.kind,num(n.x),num(n.z),false);   // a note the view did not see fall (opened late): just lying there
  for(const p of papers)if((p.mode==='rest'||p.mode==='fall')&&(!n||n.id!==p.id)){p.mode=reduced()?'off':'gone';p.t0=time}   // timed out (or the game moved on)
  for(const p of papers)drawPaper(p);
  drawSign();stepFriend(dt);drawFriend(dt);
 }
 /* ----- always-on sprites (inside the village's ambient pass): a soft glow under the note, a blue ring under the sign wolf, a pink ring under a friend ----- */
 function sprites(less){
  for(const p of papers)if(p.mode==='rest'||p.mode==='fall'){const k=less?1:.75+.25*Math.sin(time*3+p.id),sz=clamp(v.scale(),1,1.9);decal(CELL.glow,p.x,p.z,2.6*sz,C.CREAM,.6*k,.7,.03);decal(CELL.halo,p.x,p.z,1.9*sz*(less?1:1+.08*Math.sin(time*3+p.id)),C.GOLD,.55,.5,.032);
   if(!less&&p.mode==='rest'){const tw=Math.max(0,Math.sin(time*2.4+p.id*2));if(tw>.05)sprite(CELL.sparkle,p.x+.3,.7+p.y,p.z,.45*tw*sz,.45*tw*sz,C.WHITE,.9*tw,.6,time)}}
  if(sign.mode==='carry'){const s=clamp(sign.size,.8,1.6),pl=less?1:.6+.4*Math.sin(time*4);decal(CELL.halo,sign.fx,sign.fz,2.1*s*(1+.12*pl),C.SKY,.75,.5);decal(CELL.glow,sign.fx,sign.fz,2.4*s,C.SKY,.3,.7)}
  if(friend&&friend.fade<0){const s=size(friend),pl=less?1:.6+.4*Math.sin(time*3);decal(CELL.halo,friend.x,friend.z,1.9*s*(1+.1*pl),C.PINK,.7,.5);decal(CELL.glow,friend.x,friend.z,2.2*s,C.PINK,.3,.7);
   if(friend.act==='hello'&&!less){const tw=Math.max(0,Math.sin(time*5));sprite(CELL.sparkle,friend.x,(friend.top||1.6)+.35,friend.z,.45*tw+.1,.45*tw+.1,C.PINK,.95,.6,time*2)}}
 }
 /* ----- a tap on the note (screen distance, like the towers): a little hop and the page's one-line hint ----- */
 const probe=new V3();
 function tap(pointer,rect){
  let best=null,near=46;
  for(const p of papers){if(p.mode!=='rest'&&p.mode!=='fall')continue;probe.set(p.x,.1,p.z).project(camera);const d=Math.hypot((probe.x-pointer.x)*rect.width/2,(probe.y-pointer.y)*rect.height/2);if(d<near){near=d;best=p}}
  if(!best)return false;
  best.tap=time;stats.taps++;fx.sparkles(best.x,.6,best.z,6,.35,C.GOLD,0,.3);try{window.onBookPaper&&window.onBookPaper()}catch{}
  return true;
 }
 /* ----- test view (VillageView.inspect().book3d) ----- */
 const ndc=(x,y,z)=>{probe.set(x,y,z).project(camera);return [+probe.x.toFixed(3),+probe.y.toFixed(3)]};
 function inspect(){
  const p=papers.find(q=>q.mode==='rest'||q.mode==='fall')||null,f=friend,sp=sign.mode==='carry'?peek(sign.wolf):null;
  return {on:!!state,time:+time.toFixed(3),...stats,
   paper:p?{id:p.id,kind:p.kind,mode:p.mode,shown:p.m.visible,x:+p.x.toFixed(2),z:+p.z.toFixed(2),y:+p.y.toFixed(3),ndc:ndc(p.x,.1,p.z)}:null,
   papersShown:papers.filter(q=>q.m.visible).length,
   sign:sign.mode==='off'?null:{wolf:sign.wolf,mode:sign.mode,shown:signMesh.visible,x:+signMesh.position.x.toFixed(2),y:+signMesh.position.y.toFixed(2),z:+signMesh.position.z.toFixed(2),
    wolfTop:sp?[+sp.x.toFixed(2),+sp.y.toFixed(2),+sp.z.toFixed(2)]:null},
   friend:f?{id:f.id,kind:f.kind,act:f.act,shown:!!(rigs[f.kind]&&rigs[f.kind].mesh.visible),x:+f.x.toFixed(2),z:+f.z.toFixed(2),ribbon:bow.visible,fading:f.fade>=0,ndc:ndc(f.x,.6,f.z)}:null};
 }
 return {events,step,sprites,tap,inspect};
}
