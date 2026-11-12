/* 꼬꼬마을 0.7 세계 시뮬레이션: 늑대 무리 · 화살 타워 · 닭 · 건물 · 울타리.
   화면과 무관한 순수 규칙이다. 같은 시드와 같은 입력이면 언제나 같은 결과가 나오고(시드 난수), 상태는 그대로 JSON 저장된다.
   시간 단위는 틱(0.1초). 좌표는 3D 장면과 같은 단위이고 마을 중심이 (0,0)이다. 설계: docs/village-defense-design.md */
(function(root){
  'use strict';
  const TICK=.1;
  const RADIUS=[7,10,13,16];      /* 마을 반지름(마을회관 단계별) */
  const EDGE=10;                   /* 늑대 출현 지점 = 마을 반지름 + 10 */
  const SPAWNS=8;                  /* 둘레의 출현 지점 수 */
  const WOLF={speed:.8,hp:20,hpPerBuilt:1.5,hpMax:80,bite:10,carry:.65,smash:.5,bored:250,reach:.55};
  const TOWER={range:6.5,damage:10,cooldown:12,arrowSpeed:9,volley:2,volleyRange:2};
  const HP={coop:110,market:100,nursery:80,barn:100,tower:90,fence:70};
  const SIZE={coop:1.4,market:1.6,nursery:1,barn:1.6,tower:.9};
  const HEN={speed:1.6,calm:30};
  const DASH=.12;                  /* 틀리면 무리 간격의 12%만큼 세계를 빨리 감는다(늑대가 성큼) */
  const MAX_WOLVES=60;
  const TRAVEL=Math.ceil(EDGE/WOLF.speed/TICK); /* 출현에서 마을 경계까지 걸리는 틱(약 12.5초) */
  /* 고정 배치. 타워 자리는 중심에서 가까운 순서. */
  const TOWER_SLOTS=[[1.2,1.4],[-3.6,1.4],[-5.6,-2],[5.8,-.4],[-.8,-6.2],[-4.4,4.6]];
  const PLACE={coop:[-2.8,-2.8],market:[4.2,-1.8],nursery:[.6,-3.6],barn:[-6.2,-4.4]};
  const HOME=i=>[-1.8+(i%4)*1.2,-.4+Math.floor(i/4)*1.1];

  /* ---------- 난수(mulberry32, 상태는 w.rng 한 칸) ---------- */
  function rand(w){let t=(w.rng=(w.rng+0x6D2B79F5)>>>0);t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296}
  const dist=(ax,az,bx,bz)=>Math.hypot(ax-bx,az-bz);
  const radius=w=>RADIUS[Math.min(3,w.hall)];
  const sectorOf=(x,z)=>{let a=Math.atan2(z,x);if(a<0)a+=Math.PI*2;return Math.floor(a/(Math.PI/3))%6};

  /* 무리 간격(틱): 나이·모드별 문제 하나 기준 시간의 약 3배. index.html이 Combat.baseSeconds 중앙값으로 정해 넘긴다. */
  function create(opt){
    const o=opt||{};
    const w={v:1,t:0,rng:(o.seed>>>0)||1,hall:0,interval:Math.max(200,Math.round(o.interval||300)),
      wave:{n:0,arrive:Math.max(200,Math.round(o.interval||300)),spawned:false},
      wolves:[],hens:[],buildings:[],arrows:[],nextId:1,stats:{kills:0,henLost:0,henSaved:0,broken:0,waves:0},events:[]};
    return w;
  }
  const id=w=>w.nextId++;

  /* ---------- 경제 상태(Combat)와 맞추기 ----------
     towers = 1 + s.level(첫 타워는 처음부터), fences = s.fence(6면 중 앞에서부터), hens = s.chickens, 회관 단계 = s.hall.
     잡혀간 닭은 index.html이 s.chickens를 줄여서 반영한다. */
  function sync(w,s){
    w.hall=Math.min(3,s.hall|0);
    const R=radius(w);
    const want={coop:1,market:1,nursery:w.hall>=1?1:0,barn:w.hall>=3?1:0};
    for(const kind of Object.keys(want))if(want[kind]&&!w.buildings.some(b=>b.kind===kind)){const [x,z]=PLACE[kind];w.buildings.push({id:id(w),kind,x,z,hp:HP[kind],max:HP[kind],broken:false})}
    const towers=Math.min(TOWER_SLOTS.length,1+(s.level|0));
    for(let i=w.buildings.filter(b=>b.kind==='tower').length;i<towers;i++){const [x,z]=TOWER_SLOTS[i];w.buildings.push({id:id(w),kind:'tower',slot:i,x,z,hp:HP.tower,max:HP.tower,broken:false,cd:0})}
    const fences=Math.min(6,s.fence|0);
    for(let k=0;k<6;k++){
      let f=w.buildings.find(b=>b.kind==='fence'&&b.side===k);
      if(k<fences&&!f){f={id:id(w),kind:'fence',side:k,x:0,z:0,hp:HP.fence,max:HP.fence,broken:false};w.buildings.push(f)}
      if(f){const a=(k+.5)*Math.PI/3;f.x=Math.cos(a)*R;f.z=Math.sin(a)*R}
    }
    const hens=Math.max(0,Math.min(8,s.chickens|0)),alive=w.hens.filter(h=>h.state!=='gone');
    for(let i=alive.length;i<hens;i++){const slot=freeHome(w);const [x,z]=HOME(slot);w.hens.push({id:id(w),slot,x,z,state:'yard',calm:0})}
    w.hens=w.hens.filter(h=>h.state!=='gone');
    return w;
  }
  function freeHome(w){for(let i=0;i<8;i++)if(!w.hens.some(h=>h.state!=='gone'&&h.slot===i))return i;return 0}

  /* ---------- 늑대 무리 ---------- */
  const built=s=>(s.level|0)+(s.fence|0)+Math.max(0,(s.chickens|0)-1)+(s.farmers|0)+(s.pond|0)+(s.hall|0);
  /* 무리 크기: 주로 마을 크기를 따른다(마을이 커져야 늑대도 많아진다). 무리 번호는 조금만(최대 +3). */
  function packSize(w,s){return Math.max(1,Math.min(40,1+Math.min(3,Math.floor(w.wave.n/4))+Math.floor(built(s)*.7)+(s.hall|0)*2))}
  const dashTicks=w=>Math.round(DASH*w.interval);
  function spawnPack(w,s){
    const n=Math.min(packSize(w,s),MAX_WOLVES-w.wolves.length);if(n<=0)return;
    const R=radius(w)+EDGE,groups=Math.min(3,1+Math.floor(n/4)),points=[];
    for(let g=0;g<groups;g++)points.push(Math.floor(rand(w)*SPAWNS));
    const hp=Math.min(WOLF.hpMax,Math.round(WOLF.hp+WOLF.hpPerBuilt*built(s)));
    for(let i=0;i<n;i++){
      const p=points[i%groups],a=(p+.5)*Math.PI*2/SPAWNS+(rand(w)-.5)*.35,back=Math.floor(i/groups)*.7;
      const x=Math.cos(a)*(R+back),z=Math.sin(a)*(R+back);
      w.wolves.push({id:id(w),x,z,sx:x,sz:z,hp,max:hp,speed:WOLF.speed*(.92+rand(w)*.16),state:'walk',target:0,timer:0,inside:0,hen:0});
    }
    w.events.push({type:'pack',n,points:points.slice()});
  }

  /* ---------- 한 틱 ---------- */
  function step(w,s){
    w.events=[];w.t++;
    const R=radius(w);
    /* 무리 일정: 도착 TRAVEL틱 전에 가장자리에 나타나 걸어온다. */
    if(!w.wave.spawned&&w.t>=w.wave.arrive-TRAVEL){spawnPack(w,s);w.wave.spawned=true}
    if(w.t>=w.wave.arrive){w.wave.n++;w.stats.waves++;w.wave.arrive+=w.interval;w.wave.spawned=false;w.events.push({type:'arrive',n:w.wave.n})}
    const alert=w.wolves.some(v=>v.state!=='leave'&&v.state!=='carry'&&Math.hypot(v.x,v.z)<R+1.5);
    const coop=w.buildings.find(b=>b.kind==='coop');
    /* 닭: 늑대가 마을 가까이 오면 닭장으로 숨고, 조용해지면 3초 뒤 돌아온다. */
    for(const h of w.hens){
      if(h.state==='caught'||h.state==='carried'||h.state==='gone')continue;
      const safe=coop&&!coop.broken;
      if(alert&&safe){h.calm=0;if(h.state!=='hidden'){h.state='flee';if(move(h,coop.x,coop.z,HEN.speed,.8)){h.state='hidden';h.x=coop.x;h.z=coop.z}}}
      else if(h.state==='hidden'&&!safe){h.state='yard'}
      else if(h.state==='hidden'||h.state==='flee'||h.state==='home'){if(++h.calm>=HEN.calm){h.state='home'}if(h.state==='home'){const [x,z]=HOME(h.slot);if(move(h,x,z,HEN.speed,.1))h.state='yard'}}
    }
    /* 늑대 */
    for(const v of w.wolves){
      if(v.state==='dead'||v.state==='gone')continue;
      const r=Math.hypot(v.x,v.z);
      if(v.state==='walk'){
        if(r<=R+.3){const k=sectorOf(v.x,v.z),f=w.buildings.find(b=>b.kind==='fence'&&b.side===k&&!b.broken);if(f){v.state='smash';v.target=f.id}else v.state='hunt'}
        else move(v,0,0,v.speed);
      }else if(v.state==='hunt'){
        if(++v.inside>WOLF.bored){v.state='leave';continue}
        const hen=nearest(w.hens.filter(h=>h.state==='yard'||h.state==='flee'||h.state==='home'),v);
        if(hen){if(move(v,hen.x,hen.z,v.speed,WOLF.reach)){v.state='bite';v.timer=WOLF.bite;v.hen=hen.id;hen.state='caught';w.events.push({type:'bite',wolf:v.id,hen:hen.id})}}
        else{const b=nearest(w.buildings.filter(b=>!b.broken&&b.kind!=='fence'),v);
          if(!b){v.state='leave'}else if(move(v,b.x,b.z,v.speed,(SIZE[b.kind]||1)+.2)){v.state='smash';v.target=b.id}}
      }else if(v.state==='bite'){
        const hen=w.hens.find(h=>h.id===v.hen);
        if(!hen||hen.state!=='caught'){v.state='hunt';v.hen=0}
        else if(--v.timer<=0){hen.state='carried';v.state='carry';w.events.push({type:'carry',wolf:v.id,hen:hen.id})}
      }else if(v.state==='carry'){
        const hen=w.hens.find(h=>h.id===v.hen);
        if(move(v,v.sx,v.sz,v.speed*WOLF.carry,.3)){v.state='gone';if(hen){hen.state='gone';w.stats.henLost++;w.events.push({type:'henLost',hen:hen.id,wolf:v.id})}}
        else if(hen){hen.x=v.x;hen.z=v.z}
      }else if(v.state==='smash'){
        const b=w.buildings.find(x=>x.id===v.target);
        if(!b||b.broken){v.state=b&&b.kind==='fence'?'walk':'hunt';if(b&&b.kind==='fence'){move(v,0,0,v.speed);}continue}
        b.hp=Math.max(0,b.hp-WOLF.smash);
        if(b.kind!=='fence'&&++v.inside>WOLF.bored){v.state='leave';continue}
        if(b.hp<=0){b.broken=true;w.stats.broken++;w.events.push({type:'broken',building:b.id,kind:b.kind})}
      }else if(v.state==='leave'){
        if(move(v,v.sx,v.sz,v.speed,.3))v.state='gone';
      }
    }
    /* 타워: 사거리 안의 가장 가까운 늑대에게 화살 */
    for(const b of w.buildings){
      if(b.kind!=='tower'||b.broken)continue;
      if(b.cd>0){b.cd--;continue}
      const target=nearest(liveWolves(w).filter(v=>dist(v.x,v.z,b.x,b.z)<=range(s)),b);
      if(target){shoot(w,b,target,s);b.cd=cooldown(s)}
    }
    /* 화살 */
    for(const a of w.arrows){if(--a.t>0)continue;const v=w.wolves.find(x=>x.id===a.wolf);if(v&&v.state!=='dead'&&v.state!=='gone')hit(w,v,a.damage)}
    w.arrows=w.arrows.filter(a=>a.t>0);
    w.wolves=w.wolves.filter(v=>v.state!=='gone'&&!(v.state==='dead'&&++v.timer>15));
    w.hens=w.hens.filter(h=>h.state!=='gone');
    return w.events;
  }
  const liveWolves=w=>w.wolves.filter(v=>v.state!=='dead'&&v.state!=='gone');
  const range=s=>TOWER.range+.4*Math.min(5,s&&s.level|0);
  const cooldown=s=>Math.max(6,TOWER.cooldown-Math.min(5,s&&s.level|0));
  const damage=s=>TOWER.damage+2*Math.min(5,s&&s.level|0);
  function shoot(w,b,v,s){
    const d=dist(b.x,b.z,v.x,v.z),t=Math.max(2,Math.ceil(d/(TOWER.arrowSpeed*TICK)));
    w.arrows.push({id:id(w),tower:b.id,wolf:v.id,fx:b.x,fz:b.z,t,total:t,damage:damage(s)});
    w.events.push({type:'shoot',tower:b.id,wolf:v.id});
  }
  function hit(w,v,dmg){
    v.hp-=dmg;w.events.push({type:'hit',wolf:v.id});
    if(v.hp<=0){
      if(v.state==='bite'||v.state==='carry'){const hen=w.hens.find(h=>h.id===v.hen);if(hen&&(hen.state==='carried'||hen.state==='caught')){hen.state='flee';hen.calm=0;w.stats.henSaved++;w.events.push({type:'henSaved',hen:hen.id})}}
      v.state='dead';v.timer=0;w.stats.kills++;w.events.push({type:'kill',wolf:v.id});
    }
  }
  function nearest(list,p){let best=null,bd=Infinity;for(const o of list){const d=dist(o.x,o.z,p.x,p.z);if(d<bd){bd=d;best=o}}return best}
  /* 목표 쪽으로 speed(초당)만큼 움직이고, stop 거리 안이면 true */
  function move(o,tx,tz,speed,stop){const dx=tx-o.x,dz=tz-o.z,d=Math.hypot(dx,dz),s=speed*TICK,lim=stop||0;if(d<=lim+s){if(d>lim){const k=(d-lim)/d;o.x+=dx*k;o.z+=dz*k}return true}o.x+=dx/d*s;o.z+=dz/d*s;return false}

  /* ---------- 경제·문제 흐름에서 부르는 동작 ---------- */
  /* 한 번에 맞히면 모든 타워가 일제 사격(사거리 2배 안의 가까운 늑대에게 타워당 2발) */
  function volley(w,s){
    let n=0;
    for(const b of w.buildings){if(b.kind!=='tower'||b.broken)continue;
      const near=liveWolves(w).filter(v=>dist(v.x,v.z,b.x,b.z)<=range(s)*TOWER.volleyRange).sort((p,q)=>dist(p.x,p.z,b.x,b.z)-dist(q.x,q.z,b.x,b.z));
      for(let i=0;i<Math.min(TOWER.volley,near.length);i++){shoot(w,b,near[i],s);n++}}
    return n;
  }
  const brokenCount=w=>w.buildings.filter(b=>b.broken).length;
  function repairAll(w){let n=0;for(const b of w.buildings)if(b.broken||b.hp<b.max){if(b.broken)n++;b.broken=false;b.hp=b.max}return n}
  /* 다음 무리가 마을에 닿기까지 남은 비율(시간 바): 1 = 막 지나감, 0 = 도착 */
  const barLeft=w=>Math.max(0,Math.min(1,(w.wave.arrive-w.t)/w.interval));
  const secondsLeft=w=>Math.max(0,Math.ceil((w.wave.arrive-w.t)*TICK));

  /* 저장 복원: 모양이 맞지 않으면 버리고 새로 만든다. */
  function restore(raw,opt){
    if(!raw||typeof raw!=='object'||raw.v!==1||!Array.isArray(raw.wolves)||!Array.isArray(raw.hens)||!Array.isArray(raw.buildings)||!raw.wave)return create(opt);
    const w=JSON.parse(JSON.stringify(raw));w.events=[];w.arrows=Array.isArray(w.arrows)?w.arrows:[];
    if(!Number.isSafeInteger(w.t)||!Number.isSafeInteger(w.rng)||!Number.isSafeInteger(w.interval))return create(opt);
    return w;
  }

  const api={V:1,TICK,RADIUS,EDGE,SPAWNS,WOLF,TOWER,HP,HEN,DASH,MAX_WOLVES,TRAVEL,TOWER_SLOTS,PLACE,HOME,
    create,sync,step,volley,dashTicks,built,repairAll,brokenCount,barLeft,secondsLeft,packSize,restore,radius,sectorOf,rand,range,cooldown,damage};
  if(typeof module!=='undefined')module.exports=api;
  else root.World=api;
})(typeof window!=='undefined'?window:globalThis);
