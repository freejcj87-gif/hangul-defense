/* 친구 카드 그림 렌더(개발용, 배포 묶음에 넣지 않음). scripts/card-shots.cjs가 esbuild로 묶어 headless Chromium(SwiftShader)에서 돌린다.
   - 몬스터 6종(늑대·덤불 늑대·멧돼지·바위 늑대·서리 늑대·불씨 왕)은 게임과 같은 절차 모형(src/monsters.js, 리그 셰이더 그대로),
     늑대 왕·도둑 여우는 0.15 GLB(art-handoff/v015-v016/glb)를 그대로 그린다. 새 모형·외부 그림 없음.
   - 반짝 모습은 꼭짓점 색만 바꾼다(명세 02-MVP §5.1 색 초안: 달빛·단풍·흙빛 금·이끼·눈꽃·푸른 불씨·은여우·금빛 왕).
   - 배경은 투명. 게임이 CSS로 따뜻한 카드 바탕을 깔고, 발자국 단계 그림자(CSS brightness(0))도 그림 모양대로 나온다.
   - 두 번 그린다: 1차로 알파 경계를 재고, 2차에 setViewOffset으로 카드(3:4) 안에 같은 여백으로 맞춘다. 2배로 그려 줄여 계단을 없앤다. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { monsterGeometry, rigMaterial, RIG_TIME } from '../src/monsters.js';
import CARDS from '../cards.js';

const W=300,H=400,SS=2,CW=W*SS,CH=H*SS;
const GLB={king:'art-handoff/v015-v016/glb/wolf-king.glb',fox:'art-handoff/v015-v016/glb/thief-fox.glb'};
const KINDS=CARDS.KINDS;

/* 반짝 색 표는 cards.js(CARDS.SHINY) 한곳에 있다. 3D 마을의 반짝 손님(src/village.js)도 같은 표를 쓴다 */
const SHINY=CARDS.SHINY;
function recolor(attr,map){
 const c=new THREE.Color(),miss=new Set();
 for(let i=0;i<attr.count;i++){
  c.setRGB(attr.getX(i),attr.getY(i),attr.getZ(i),THREE.LinearSRGBColorSpace);const hex=c.getHex(THREE.SRGBColorSpace),to=map[hex];
  if(to===undefined){miss.add(hex.toString(16).padStart(6,'0'));continue}
  c.setHex(to,THREE.SRGBColorSpace);attr.setXYZ(i,c.r,c.g,c.b);
 }
 attr.needsUpdate=true;return miss;
}

/* 자세: 몸을 보는 사람 오른쪽으로 돌리고(정면 3/4) 머리는 카메라 쪽으로, 입은 살짝 벌리고 꼬리는 조금 든다(게임의 대기 자세 tp .35보다 조금 위) */
const POSE={hy:-.34,hp:-.05,jaw:.1,ty:.25,tp:.5,hr:.1};
const YAW=.62,ELEV=.26,FOV=26;
const TUNE={boar:{hy:-.3},granite:{tp:.42},ember:{jaw:.14},king:{hy:-.3},fox:{hy:-.34}};   // 종마다 조금씩

function codeMonster(kind,shiny,miss){
 const g=monsterGeometry(kind),n=g.attributes.position.count,P={...POSE,...TUNE[kind]};
 const fill=(name,v)=>{const a=new Float32Array(n*4);for(let i=0;i<n;i++)a.set(v,i*4);g.setAttribute(name,new THREE.BufferAttribute(a,4))};
 fill('aPoseA',[P.hy,P.hp,P.jaw,P.ty]);fill('aPoseB',[P.tp,0,0,0]);fill('aPoseC',[0,P.hr,1.3,0]);fill('aPoseD',[0,0,0,0]);
 if(shiny)for(const h of recolor(g.attributes.color,SHINY[kind]))miss.add(h);
 const mesh=new THREE.Mesh(g,rigMaterial(kind));mesh.frustumCulled=false;
 return mesh;
}
const loader=new GLTFLoader();
async function glbMonster(kind,shiny,miss){
 const gl=await loader.loadAsync(GLB[kind]),root=gl.scene,P={...POSE,...TUNE[kind]};
 root.traverse(o=>{if(!o.isMesh)return;o.frustumCulled=false;if(shiny){o.geometry=o.geometry.clone();for(const h of recolor(o.geometry.attributes.color,SHINY[kind]))miss.add(h)}});
 const head=root.getObjectByName('Head'),tail=root.getObjectByName('Tail');
 if(head){head.rotation.y+=P.hy;head.rotation.x+=P.hp;head.rotation.z-=P.hr}
 if(tail)tail.rotation.y+=P.ty;
 return root;
}

/* 렌더러·조명: 게임(ACES, 따뜻한 반구광 + 햇빛)과 같은 느낌에 앞쪽 보조광과 뒤쪽 테두리 빛을 더함.
   그림자 맵은 쓰지 않는다(확대하면 몬스터 뒤 바닥에 계단진 띠가 생겨 발자국 그림자 카드까지 지저분해짐, 1차 렌더 2026-11-20). 발밑은 부드러운 원형 그림자만 */
const canvas=document.createElement('canvas');canvas.width=CW;canvas.height=CH;
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,preserveDrawingBuffer:true,premultipliedAlpha:true});
renderer.setPixelRatio(1);renderer.setSize(CW,CH,false);renderer.setClearColor(0x000000,0);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
RIG_TIME.value=.7;   // 불꽃 흔들림을 한 순간에 고정

function blob(){
 const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d'),g=x.createRadialGradient(64,64,0,64,64,64);
 g.addColorStop(0,'rgba(60,40,20,.42)');g.addColorStop(.5,'rgba(60,40,20,.2)');g.addColorStop(1,'rgba(60,40,20,0)');x.fillStyle=g;x.fillRect(0,0,128,128);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
const BLOB=blob();

function stage(obj){
 const scene=new THREE.Scene(),group=new THREE.Group();group.add(obj);group.rotation.y=YAW;scene.add(group);
 scene.add(new THREE.HemisphereLight(0xfff4dc,0xa08a62,2.0));
 const key=new THREE.DirectionalLight(0xffe6c2,2.6);key.position.set(-2.5,4.2,4.5);scene.add(key);
 const fill=new THREE.DirectionalLight(0xd8e6ff,.7);fill.position.set(4,1.5,2.5);scene.add(fill);
 const rim=new THREE.DirectionalLight(0xfff0d0,1.6);rim.position.set(1,3,-4.5);scene.add(rim);
 group.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(group),size=box.getSize(new THREE.Vector3()),mid=box.getCenter(new THREE.Vector3());
 const b=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:BLOB,transparent:true,depthWrite:false,toneMapped:false}));
 b.rotation.x=-Math.PI/2;b.position.set(mid.x,.003,mid.z);b.scale.set(size.x*1.15,size.z*1.0,1);scene.add(b);
 return {scene,box,size,mid};
}
function camera(st){
 const cam=new THREE.PerspectiveCamera(FOV,W/H,.05,60),r=st.size.length()/2,half=Math.min(FOV/2,THREE.MathUtils.radToDeg(Math.atan(Math.tan(THREE.MathUtils.degToRad(FOV/2))*W/H)));
 const d=r*1.2/Math.sin(THREE.MathUtils.degToRad(half));cam.position.set(st.mid.x,st.mid.y+Math.sin(ELEV)*d,st.mid.z+Math.cos(ELEV)*d);cam.lookAt(st.mid);cam.updateProjectionMatrix();return cam;
}
/* 알파 경계(불투명 픽셀만, 바닥 그림자 제외) */
const probe=document.createElement('canvas');probe.width=CW;probe.height=CH;const px=probe.getContext('2d',{willReadFrequently:true});
function alphaBox(){
 px.clearRect(0,0,CW,CH);px.drawImage(canvas,0,0);const d=px.getImageData(0,0,CW,CH).data;let x0=CW,y0=CH,x1=-1,y1=-1;
 for(let y=0;y<CH;y++)for(let x=0;x<CW;x++)if(d[(y*CW+x)*4+3]>150){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
 return x1<0?null:{x0,y0,x1,y1};
}
/* 반짝 카드: 둘레에 작은 별 반짝임(2D로 덧그림) */
function sparkle(x,cx,cy,r){
 x.save();x.translate(cx,cy);x.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,q=i%2?r*.28:r;x.lineTo(Math.sin(a)*q,-Math.cos(a)*q)}x.closePath();
 const g=x.createRadialGradient(0,0,0,0,0,r);g.addColorStop(0,'#ffffff');g.addColorStop(.45,'#fff3a8');g.addColorStop(1,'#f2b931');x.fillStyle=g;x.shadowColor='rgba(255,214,90,.9)';x.shadowBlur=r*.8;x.fill();x.restore();
}
const SPARKS=[[.13,.15,17],[.87,.22,13],[.9,.6,9],[.1,.5,10],[.72,.08,8],[.24,.86,7]];
const out=document.createElement('canvas');out.width=W;out.height=H;const ox=out.getContext('2d');

window.__cards={};
window.renderCard=async function(kind,shiny){
 if(!KINDS.includes(kind))throw new Error('unknown kind '+kind);
 const miss=new Set(),obj=GLB[kind]?await glbMonster(kind,shiny,miss):codeMonster(kind,shiny,miss),st=stage(obj),cam=camera(st);
 renderer.render(st.scene,cam);const a=alphaBox();if(!a)throw new Error(kind+': nothing drawn');
 // 2차: 몬스터(불투명 경계)가 가로 86%·세로 76% 안에, 발끝이 아래 89% 자리에 오게 잘라 확대
 const bw=a.x1-a.x0+1,bh=a.y1-a.y0+1,s=Math.min(.86*CW/bw,.76*CH/bh),fw=CW*s,fh=CH*s;
 const ox0=(a.x0+a.x1+1)/2*s-CW/2,oy0=(a.y1+1)*s-.89*CH;
 cam.setViewOffset(fw,fh,ox0,oy0,CW,CH);renderer.render(st.scene,cam);const b=alphaBox();
 ox.clearRect(0,0,W,H);ox.imageSmoothingEnabled=true;ox.imageSmoothingQuality='high';ox.drawImage(canvas,0,0,W,H);
 if(shiny)for(const [x,y,r] of SPARKS)sparkle(ox,x*W,y*H,r);
 let data=out.toDataURL('image/webp',.9);if(!data.startsWith('data:image/webp'))data=out.toDataURL('image/png');
 const name=kind+(shiny?'-shiny':'');window.__cards[name]=data;
 st.scene.traverse(o=>{if(o.isMesh){o.geometry.dispose()}});
 return {data,info:{name,zoom:+s.toFixed(3),box:b&&[b.x0,b.y0,b.x1,b.y1].map(v=>Math.round(v/SS)),unmapped:[...miss]}};
};
/* 확인용 한 장: 종마다 [보통 · 발자국 그림자 · 반짝], 게임과 같은 카드 바탕 */
window.showSheet=function(names){
 const sheet=document.getElementById('sheet');sheet.innerHTML='';
 for(const kind of KINDS){for(const [label,name,cls] of [['보통',kind,''],['발자국',kind,'sil'],['반짝',kind+'-shiny','shiny']]){
  const cell=document.createElement('div');cell.className='cell';const f=document.createElement('div');f.className='frame '+cls;const img=document.createElement('img');img.src=window.__cards[name]||'';f.append(img);
  const t=document.createElement('span');t.textContent=kind+' · '+label;cell.append(f,t);sheet.append(cell)}}
 return Promise.all([...sheet.querySelectorAll('img')].map(i=>i.decode().catch(()=>{})));
};
try{const gl=renderer.getContext();window.cardReady=!!gl}catch(e){window.cardError=String(e&&e.message||e)}
