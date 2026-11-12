/* 꼬꼬마을 0.8 세계 시뮬레이션: 늑대·몬스터 무리 · 화살 타워(터지는 화살) · 닭 · 건물 · 울타리.
   화면과 무관한 순수 규칙이다. 같은 시드와 같은 입력이면 언제나 같은 결과가 나오고(시드 난수), 상태는 그대로 JSON 저장된다.
   시간 단위는 틱(0.1초). 좌표는 3D 장면과 같은 단위이고 마을 중심이 (0,0)이다. 설계: docs/village-defense-design.md */
(function(root){
  'use strict';
  const TICK=.1;
  const RADIUS=[7,10,13,16];      /* 마을 반지름(마을회관 단계별) */
  const EDGE=7;                    /* 출현 지점 = 마을 반지름 + 7(숲 가장자리). 나오자마자 화면에 보인다 */
  const SPAWNS=8;                  /* 둘레의 출현 지점 수 */
  const WOLF={speed:1,hp:12,hpPerBuilt:1.2,hpMax:60,bite:10,carry:.65,smash:.3,bored:250,reach:.55};
  /* 몬스터 종류. 마을회관 단계(unlock)에 이르면 무리에 섞여 나온다. hp·speed·smash는 늑대 대비 배수, size는 몸 크기(3D·맞는 거리).
     prey: any = 닭 먼저 그다음 건물, building = 건물만, hen = 닭만(닭이 없으면 건물). 참고: 꼬꼬마을 보스 4종(덤불·바위·서리·불씨)과 멧돼지. */
  const KINDS={
    wolf:   {name:'늑대',     unlock:0,hp:1,  speed:1,   smash:1,  size:1,   prey:'any',     tip:'닭을 노려요'},
    bramble:{name:'덤불 늑대', unlock:1,hp:.6, speed:1.3, smash:.8, size:.85, prey:'any',     tip:'빠르고 약해요. 떼로 와요'},
    boar:   {name:'멧돼지',    unlock:2,hp:2.2,speed:.85, smash:3,  size:1.1, prey:'building',tip:'건물에 돌진해요'},
    granite:{name:'바위 늑대', unlock:2,hp:4,  speed:.6,  smash:2,  size:1.25,prey:'any',     tip:'느리지만 아주 단단해요'},
    frost:  {name:'서리 늑대', unlock:3,hp:.9, speed:1.7, smash:.8, size:.95, prey:'hen',     tip:'아주 빨라요. 닭만 노려요'},
    ember:  {name:'불씨 왕',   unlock:3,hp:14, speed:.7,  smash:4,  size:1.8, prey:'any',     tip:'우두머리! 울부짖으면 타워가 잠깐 멈춰요',boss:true}
  };
  /* 단계별 무리 구성(가중치). 우두머리(불씨 왕)는 3단계부터 네 번째 무리마다 한 마리. */
  const MIX=[{wolf:1},{wolf:3,bramble:2},{wolf:3,bramble:2,boar:1,granite:1},{wolf:3,bramble:2,boar:1,granite:1,frost:2}];
  const BOSS_EVERY=4;
  const TOWER={range:6.5,damage:10,cooldown:12,arrowSpeed:9,volleyRange:2};
  /* 타워 강화(s.power): 0 화살 · 1 펑 화살(맞은 자리 둘레에 60% 피해) · 2 큰 펑 화살(더 넓게, 75%, 피해 +3) · 3 세 갈래 화살(한 번에 3마리) */
  const POWER=[{splash:0,share:0,plus:0,multi:1},{splash:1.3,share:.6,plus:0,multi:1},{splash:1.9,share:.75,plus:3,multi:1},{splash:1.9,share:.75,plus:3,multi:3}];
  const ROAR={every:80,reach:6,stun:25}; /* 불씨 왕: 타워 가까이 오면 8초마다 울부짖어 둘레 타워를 2.5초 멈춘다 */
  const HP={coop:110,market:100,nursery:80,barn:100,tower:90,fence:70};
  const MEND=.05;                  /* 공격받지 않는 건물은 틱마다 0.05(초당 0.5)씩 저절로 회복한다(부서진 건물은 고치기 카드로) */
  const REBUILD=150;               /* 부서진 울타리는 둘레에 늑대가 없으면 15초 뒤 농부가 다시 세운다(반쯤 튼튼하게). 고치기 카드는 건물에만 */
  const SIZE={coop:1.4,market:1.6,nursery:1,barn:1.6,tower:.9};
  const HEN={speed:1.6,calm:30};
  const DASH=.3;                   /* 틀리면 무리 간격의 30%만큼 세계를 빨리 감는다(늑대가 성큼). 마구 찍기를 손해로 만든다 */
  const MERCY={per:.1,max:.5,decay:300}; /* 닭을 잃거나 건물이 부서질 때마다 다음 무리 10% 작게·낙오 늑대 뜸하게(최대 50%), 30초마다 한 단계 풀림 */
  /* 무리 간격(틱) = 문제 하나 기준 시간(중앙값, 초)과 같게, 13~20초 사이. 0.7은 3배라 9~10세 읽기는 2분이 넘었다. */
  const INTERVAL={min:130,max:200};
  const intervalFor=baseSec=>Math.max(INTERVAL.min,Math.min(INTERVAL.max,Math.round((Number(baseSec)||13)/TICK)));
  const MAX_WOLVES=90;
  const TRAVEL=Math.ceil(EDGE/WOLF.speed/TICK); /* 출현에서 마을 경계까지 걸리는 틱(약 7초) */
  /* 고정 배치. 타워 자리는 중심에서 가까운 순서. */
  const TOWER_SLOTS=[[1.2,1.4],[-3.6,1.4],[-5.6,-2],[5.8,-.4],[-.8,-6.2],[-4.4,4.6]];
  const PLACE={coop:[-2.8,-2.8],market:[4.2,-1.8],nursery:[.6,-3.6],barn:[-6.2,-4.4]};
  const HOME=i=>[-1.8+(i%4)*1.2,-.4+Math.floor(i/4)*1.1];

  /* ---------- 난수(mulberry32, 상태는 w.rng 한 칸) ---------- */
  function rand(w){let t=(w.rng=(w.rng+0x6D2B79F5)>>>0);t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296}
  const dist=(ax,az,bx,bz)=>Math.hypot(ax-bx,az-bz);
  const radius=w=>RADIUS[Math.min(3,w.hall)];
  const sectorOf=(x,z)=>{let a=Math.atan2(z,x);if(a<0)a+=Math.PI*2;return Math.floor(a/(Math.PI/3))%6};
  const kindOf=v=>KINDS[v&&v.kind]||KINDS.wolf;
  const alive=v=>v.state!=='dead'&&v.state!=='gone';

  /* 무리 간격(틱): index.html이 나이별로 정해 넘긴다(13~18초). 첫 낙오 늑대는 시작하자마자 나온다. */
  function create(opt){
    const o=opt||{},iv=Math.max(80,Math.round(o.interval||150));
    return {v:2,t:0,rng:(o.seed>>>0)||1,hall:0,interval:iv,
      wave:{n:0,arrive:iv,spawned:false},trickle:5,seen:{},mercy:0,
      wolves:[],hens:[],buildings:[],arrows:[],nextId:1,stats:{kills:0,henLost:0,henSaved:0,broken:0,fenceBroken:0,waves:0,bosses:0,bossKills:0,splash:0},events:[]};
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
    for(let i=w.buildings.filter(b=>b.kind==='tower').length;i<towers;i++){const [x,z]=TOWER_SLOTS[i];w.buildings.push({id:id(w),kind:'tower',slot:i,x,z,hp:HP.tower,max:HP.tower,broken:false,cd:0,stun:0})}
    const fences=Math.min(6,s.fence|0);
    for(let k=0;k<6;k++){
      let f=w.buildings.find(b=>b.kind==='fence'&&b.side===k);
      if(k<fences&&!f){f={id:id(w),kind:'fence',side:k,x:0,z:0,hp:HP.fence,max:HP.fence,broken:false};w.buildings.push(f)}
      if(f){const a=(k+.5)*Math.PI/3;f.x=Math.cos(a)*R;f.z=Math.sin(a)*R}
    }
    const hens=Math.max(0,Math.min(8,s.chickens|0)),live=w.hens.filter(h=>h.state!=='gone');
    for(let i=live.length;i<hens;i++){const slot=freeHome(w);const [x,z]=HOME(slot);w.hens.push({id:id(w),slot,x,z,state:'yard',calm:0})}
    w.hens=w.hens.filter(h=>h.state!=='gone');
    return w;
  }
  function freeHome(w){for(let i=0;i<8;i++)if(!w.hens.some(h=>h.state!=='gone'&&h.slot===i))return i;return 0}

  /* ---------- 늑대·몬스터 출현 ---------- */
  const built=s=>(s.level|0)+(s.fence|0)+Math.max(0,(s.chickens|0)-1)+(s.farmers|0)+(s.pond|0)+(s.hall|0)+(s.power|0);
  /* 늑대를 부르는 정도: 방어 시설(타워·강화)은 크게, 울타리·닭·농부·연못은 절반만. 닭을 샀다고 무리만 커져 손해 보는 일이 없게 한다. */
  const threat=s=>1.3*(s.level|0)+1.5*(s.power|0)+.5*((s.fence|0)+Math.max(0,(s.chickens|0)-1)+(s.farmers|0)+(s.pond|0))+(s.hall|0);
  /* 무리 크기: 주로 마을 크기를 따른다(마을이 커져야 늑대도 많아진다). 무리 번호는 조금만(최대 +4). */
  const ease=w=>1-Math.min(MERCY.max,(w.mercy|0)*MERCY.per);
  function packSize(w,s){return Math.max(1,Math.round(Math.min(45,1+Math.min(4,Math.floor(w.wave.n/3))+Math.floor(threat(s)*.9)+(s.hall|0)*3)*ease(w)))}
  /* 낙오 늑대: 무리 사이에도 한두 마리씩 계속 나온다(마을이 커질수록 자주). 다음 낙오까지의 틱. */
  const trickleGap=(w,s)=>Math.round((40+rand(w)*30)*Math.max(.45,1-threat(s)/25)/ease(w));
  const dashTicks=w=>Math.round(DASH*w.interval);
  function pickKind(w,s,boss){
    if(boss)return 'ember';
    const mix=MIX[Math.min(3,s.hall|0)];let total=0;for(const k in mix)total+=mix[k];
    let r=rand(w)*total;for(const k in mix){r-=mix[k];if(r<0)return k}return 'wolf';
  }
  function addWolf(w,s,kind,x,z){
    const K=KINDS[kind],hp=Math.round(Math.min(WOLF.hpMax,WOLF.hp+WOLF.hpPerBuilt*threat(s))*K.hp);
    const v={id:id(w),kind,x,z,sx:x,sz:z,hp,max:hp,speed:WOLF.speed*K.speed*(.92+rand(w)*.16),state:'walk',target:0,timer:0,inside:0,hen:0};
    if(K.boss)v.roar=ROAR.every>>1;
    w.wolves.push(v);
    if(!w.seen[kind]){w.seen[kind]=true;w.events.push({type:'newKind',kind,wolf:v.id})}
    if(K.boss){w.stats.bosses++;w.events.push({type:'boss',kind,wolf:v.id})}
    return v;
  }
  function spawnPack(w,s){
    const boss=(s.hall|0)>=3&&w.wave.n%BOSS_EVERY===BOSS_EVERY-1;
    const n=Math.min(packSize(w,s),MAX_WOLVES-w.wolves.length);if(n<=0)return;
    const R=radius(w)+EDGE,groups=Math.min(3,1+Math.floor(n/5)),points=[];
    for(let g=0;g<groups;g++)points.push(Math.floor(rand(w)*SPAWNS));
    for(let i=0;i<n;i++){
      const p=points[i%groups],a=(p+.5)*Math.PI*2/SPAWNS+(rand(w)-.5)*.4,back=Math.floor(i/groups)*.75;
      addWolf(w,s,pickKind(w,s,boss&&i===0),Math.cos(a)*(R+back),Math.sin(a)*(R+back));
    }
    w.events.push({type:'pack',n,points:points.slice(),boss});
  }
  function spawnStraggler(w,s){
    const cap=Math.round(MAX_WOLVES*.8);if(w.wolves.length>=cap)return;
    const n=1+(rand(w)<Math.min(.5,threat(s)/16)?1:0),p=Math.floor(rand(w)*SPAWNS),R=radius(w)+EDGE;
    for(let i=0;i<n;i++){const a=(p+.5)*Math.PI*2/SPAWNS+(rand(w)-.5)*.5;addWolf(w,s,pickKind(w,s,false),Math.cos(a)*(R+i*.8),Math.sin(a)*(R+i*.8))}
    w.events.push({type:'straggler',n,point:p});
  }

  /* ---------- 한 틱 ---------- */
  function step(w,s){
    w.events=[];w.t++;
    const R=radius(w);
    /* 무리 일정: 도착 TRAVEL틱 전에 숲 가장자리에 나타나 걸어온다. 무리 사이에는 낙오 늑대가 계속 나온다. */
    if(!w.wave.spawned&&w.t>=w.wave.arrive-TRAVEL){spawnPack(w,s);w.wave.spawned=true}
    if(w.t>=w.wave.arrive){w.wave.n++;w.stats.waves++;w.wave.arrive+=w.interval;w.wave.spawned=false;w.events.push({type:'arrive',n:w.wave.n})}
    if(w.t>=w.trickle){spawnStraggler(w,s);w.trickle=w.t+trickleGap(w,s)}
    if(w.mercy>0&&w.t%MERCY.decay===0)w.mercy--;
    const alert=w.wolves.some(v=>v.state!=='leave'&&v.state!=='carry'&&alive(v)&&Math.hypot(v.x,v.z)<R+1.5);
    const coop=w.buildings.find(b=>b.kind==='coop');
    /* 닭: 늑대가 마을 가까이 오면 닭장으로 숨고, 조용해지면 3초 뒤 돌아온다. */
    for(const h of w.hens){
      if(h.state==='caught'||h.state==='carried'||h.state==='gone')continue;
      const safe=coop&&!coop.broken;
      if(alert&&safe){h.calm=0;if(h.state!=='hidden'){h.state='flee';if(move(h,coop.x,coop.z,HEN.speed,.8)){h.state='hidden';h.x=coop.x;h.z=coop.z}}}
      else if(h.state==='hidden'&&!safe){h.state='yard'}
      else if(h.state==='hidden'||h.state==='flee'||h.state==='home'){if(++h.calm>=HEN.calm){h.state='home'}if(h.state==='home'){const [x,z]=HOME(h.slot);if(move(h,x,z,HEN.speed,.1))h.state='yard'}}
    }
    /* 늑대·몬스터 */
    for(const v of w.wolves){
      if(!alive(v))continue;
      const K=kindOf(v),r=Math.hypot(v.x,v.z);
      if(K.boss&&--v.roar<=0){const near=w.buildings.filter(b=>b.kind==='tower'&&!b.broken&&dist(b.x,b.z,v.x,v.z)<=ROAR.reach);
        if(near.length&&v.state!=='leave'){for(const b of near)b.stun=ROAR.stun;v.roar=ROAR.every;w.events.push({type:'roar',wolf:v.id,towers:near.map(b=>b.id)})}else v.roar=10}
      if(v.state==='walk'){
        if(r<=R+.3){const k=sectorOf(v.x,v.z),f=w.buildings.find(b=>b.kind==='fence'&&b.side===k&&!b.broken);if(f){v.state='smash';v.target=f.id}else v.state='hunt'}
        else move(v,0,0,v.speed);
      }else if(v.state==='hunt'){
        if(++v.inside>WOLF.bored){v.state='leave';continue}
        const hen=K.prey==='building'?null:nearest(w.hens.filter(h=>h.state==='yard'||h.state==='flee'||h.state==='home'),v);
        if(hen){if(move(v,hen.x,hen.z,v.speed,WOLF.reach*K.size)){v.state='bite';v.timer=WOLF.bite;v.hen=hen.id;hen.state='caught';w.events.push({type:'bite',wolf:v.id,hen:hen.id})}}
        else if(K.prey==='hen'&&w.hens.some(h=>h.state==='hidden'||h.state==='flee')){move(v,0,0,v.speed*.5,R*.3)} /* 숨은 닭 둘레를 어슬렁 */
        else{const b=nearest(w.buildings.filter(b=>!b.broken&&b.kind!=='fence'),v);
          if(!b){v.state='leave'}else if(move(v,b.x,b.z,v.speed,(SIZE[b.kind]||1)+.2*K.size)){v.state='smash';v.target=b.id}}
      }else if(v.state==='bite'){
        const hen=w.hens.find(h=>h.id===v.hen);
        if(!hen||hen.state!=='caught'){v.state='hunt';v.hen=0}
        else if(--v.timer<=0){hen.state='carried';v.state='carry';w.events.push({type:'carry',wolf:v.id,hen:hen.id})}
      }else if(v.state==='carry'){
        const hen=w.hens.find(h=>h.id===v.hen);
        if(move(v,v.sx,v.sz,v.speed*WOLF.carry,.3)){v.state='gone';if(hen){hen.state='gone';w.stats.henLost++;w.mercy=(w.mercy|0)+1;w.events.push({type:'henLost',hen:hen.id,wolf:v.id})}}
        else if(hen){hen.x=v.x;hen.z=v.z}
      }else if(v.state==='smash'){
        const b=w.buildings.find(x=>x.id===v.target);
        if(!b||b.broken){v.state=b&&b.kind==='fence'?'walk':'hunt';if(b&&b.kind==='fence'){move(v,0,0,v.speed);}continue}
        b.hp=Math.max(0,b.hp-WOLF.smash*K.smash);
        if(b.kind!=='fence'&&++v.inside>WOLF.bored){v.state='leave';continue}
        if(b.hp<=0){b.broken=true;b.rebuild=REBUILD;if(b.kind==='fence')w.stats.fenceBroken++;else{w.stats.broken++;w.mercy=(w.mercy|0)+1}w.events.push({type:'broken',building:b.id,kind:b.kind,wolf:v.id})}
      }else if(v.state==='leave'){
        if(move(v,v.sx,v.sz,v.speed,.3))v.state='gone';
      }
    }
    /* 타워: 사거리 안의 가까운 늑대에게 화살(세 갈래 화살이면 3마리). 포효에 멈춘 타워는 쉰다. */
    const P=power(s);
    for(const b of w.buildings){
      if(b.kind!=='tower'||b.broken)continue;
      if(b.stun>0){b.stun--;continue}
      if(b.cd>0){b.cd--;continue}
      const near=liveWolves(w).filter(v=>dist(v.x,v.z,b.x,b.z)<=range(s)).sort((p,q)=>danger(q)-danger(p)||dist(p.x,p.z,b.x,b.z)-dist(q.x,q.z,b.x,b.z));
      if(near.length){for(let i=0;i<Math.min(P.multi,near.length);i++)shoot(w,b,near[i],s);b.cd=cooldown(s)}
    }
    /* 화살: 날아가는 동안 과녁을 따라가고, 닿으면 맞힌다(펑 화살은 둘레도). 과녁이 먼저 쓰러졌으면 그 자리에서 터진다. */
    for(const a of w.arrows){
      const v=w.wolves.find(x=>x.id===a.wolf),live=v&&alive(v);
      if(live){a.tx=v.x;a.tz=v.z}
      if(--a.t>0)continue;
      if(live)hit(w,v,a.damage);
      if(a.splash>0&&(live||a.tx!==undefined))burst(w,a,live?v:null);
    }
    w.arrows=w.arrows.filter(a=>a.t>0);
    /* 건물 회복: 지금 부수는 늑대가 없는 건물만 */
    const busy=new Set();for(const v of w.wolves)if(v.state==='smash')busy.add(v.target);
    for(const b of w.buildings){
      if(!b.broken){if(b.hp<b.max&&!busy.has(b.id))b.hp=Math.min(b.max,b.hp+MEND);continue}
      if(b.kind!=='fence')continue;
      if(!Number.isFinite(b.rebuild))b.rebuild=REBUILD;
      if(w.wolves.some(v=>alive(v)&&dist(v.x,v.z,b.x,b.z)<2.2))continue;
      if(--b.rebuild<=0){b.broken=false;b.hp=Math.round(b.max/2);b.rebuild=REBUILD;w.events.push({type:'rebuilt',building:b.id,kind:'fence'})}
    }
    w.wolves=w.wolves.filter(v=>v.state!=='gone'&&!(v.state==='dead'&&++v.timer>15));
    w.hens=w.hens.filter(h=>h.state!=='gone');
    return w.events;
  }
  const liveWolves=w=>w.wolves.filter(alive);
  /* 타워가 먼저 노리는 순서: 닭을 물고 가는 늑대 > 무는 늑대 > 건물을 부수는 늑대 > 나머지(가까운 순) */
  const danger=v=>v.state==='carry'?3:v.state==='bite'?2:v.state==='smash'?1:0;
  const power=s=>POWER[Math.max(0,Math.min(3,s&&s.power|0))];
  const range=s=>TOWER.range+.4*Math.min(5,s&&s.level|0);
  const cooldown=s=>Math.max(6,TOWER.cooldown-Math.min(5,s&&s.level|0));
  const damage=s=>TOWER.damage+2*Math.min(5,s&&s.level|0)+power(s).plus;
  function shoot(w,b,v,s){
    const d=dist(b.x,b.z,v.x,v.z),t=Math.max(2,Math.ceil(d/(TOWER.arrowSpeed*TICK))),P=power(s);
    w.arrows.push({id:id(w),tower:b.id,wolf:v.id,fx:b.x,fz:b.z,tx:v.x,tz:v.z,t,total:t,damage:damage(s),splash:P.splash,share:P.share});
    w.events.push({type:'shoot',tower:b.id,wolf:v.id,splash:P.splash>0});
  }
  /* 펑: 맞은 자리 둘레 splash 안의 다른 늑대에게 share만큼 피해 */
  function burst(w,a,center){
    const x=center?center.x:a.tx,z=center?center.z:a.tz,dmg=Math.max(1,Math.round(a.damage*a.share));let n=0;
    for(const o of w.wolves){if(o===center||!alive(o))continue;if(dist(o.x,o.z,x,z)<=a.splash+.25*(kindOf(o).size-1)){hit(w,o,dmg);n++}}
    w.stats.splash+=n;w.events.push({type:'splash',x,z,r:a.splash,n,arrow:a.id});
  }
  function hit(w,v,dmg){
    v.hp-=dmg;w.events.push({type:'hit',wolf:v.id});
    if(v.hp<=0){
      if(v.state==='bite'||v.state==='carry'){const hen=w.hens.find(h=>h.id===v.hen);if(hen&&(hen.state==='carried'||hen.state==='caught')){hen.state='flee';hen.calm=0;w.stats.henSaved++;w.events.push({type:'henSaved',hen:hen.id})}}
      const boss=!!kindOf(v).boss;
      v.state='dead';v.timer=0;w.stats.kills++;if(boss)w.stats.bossKills++;w.events.push({type:'kill',wolf:v.id,kind:v.kind||'wolf',boss});
    }
  }
  function nearest(list,p){let best=null,bd=Infinity;for(const o of list){const d=dist(o.x,o.z,p.x,p.z);if(d<bd){bd=d;best=o}}return best}
  /* 목표 쪽으로 speed(초당)만큼 움직이고, stop 거리 안이면 true */
  function move(o,tx,tz,speed,stop){const dx=tx-o.x,dz=tz-o.z,d=Math.hypot(dx,dz),s=speed*TICK,lim=stop||0;if(d<=lim+s){if(d>lim){const k=(d-lim)/d;o.x+=dx*k;o.z+=dz*k}return true}o.x+=dx/d*s;o.z+=dz/d*s;return false}

  /* ---------- 경제·문제 흐름에서 부르는 동작 ---------- */
  /* 한 번에 맞히면 모든 타워가 일제 사격. 타워당 화살 수 = 2 × 글 길이 배수(긴 글일수록 한 번에 많이, 최대 8), 번개 정답이면 1.5배,
     세 갈래 화살이면 +2. 사거리 2배 안의 가까운 늑대부터 차례로 노린다. */
  function volleyArrows(s,o){const opt=o||{},m=Math.max(1,opt.scale||1);let n=Math.min(8,Math.round(2*m));if(opt.fast)n=Math.round(n*1.5);if(power(s).multi>1)n+=2;return n}
  function volley(w,s,opt){
    const per=volleyArrows(s,opt);let n=0;
    for(const b of w.buildings){if(b.kind!=='tower'||b.broken)continue;
      const near=liveWolves(w).filter(v=>dist(v.x,v.z,b.x,b.z)<=range(s)*TOWER.volleyRange).sort((p,q)=>dist(p.x,p.z,b.x,b.z)-dist(q.x,q.z,b.x,b.z));
      if(!near.length)continue;
      for(let i=0;i<per;i++){shoot(w,b,near[i%near.length],s);n++}}
    return n;
  }
  /* 고치기 카드가 고칠 건물 수(울타리는 저절로 다시 세워지므로 빼고 센다) */
  const brokenCount=w=>w.buildings.filter(b=>b.broken&&b.kind!=='fence').length;
  function repairAll(w){let n=0;for(const b of w.buildings)if(b.broken||b.hp<b.max){if(b.broken)n++;b.broken=false;b.hp=b.max}return n}
  /* 다음 무리가 마을에 닿기까지 남은 비율(시간 바): 1 = 막 지나감, 0 = 도착 */
  const barLeft=w=>Math.max(0,Math.min(1,(w.wave.arrive-w.t)/w.interval));
  const secondsLeft=w=>Math.max(0,Math.ceil((w.wave.arrive-w.t)*TICK));
  /* 지금 단계에서 나오는 몬스터 종류(처음 나오는 순서) */
  const kindsAt=hall=>Object.keys(KINDS).filter(k=>KINDS[k].unlock<=Math.min(3,hall|0));

  /* 저장 복원: 모양이 맞지 않으면 버리고 새로 만든다. 0.7 저장(v1)은 늑대에 종류를 붙여 이어 쓴다.
     opt.interval이 있으면 무리 간격을 지금 규칙으로 바꾸고, 다음 무리가 그보다 늦지 않게 당긴다. */
  function restore(raw,opt){
    if(!raw||typeof raw!=='object'||(raw.v!==1&&raw.v!==2)||!Array.isArray(raw.wolves)||!Array.isArray(raw.hens)||!Array.isArray(raw.buildings)||!raw.wave)return create(opt);
    const w=JSON.parse(JSON.stringify(raw));w.events=[];w.arrows=Array.isArray(w.arrows)?w.arrows:[];
    if(!Number.isSafeInteger(w.t)||!Number.isSafeInteger(w.rng)||!Number.isSafeInteger(w.interval))return create(opt);
    if(w.v===1){w.v=2;w.trickle=w.t+5;w.seen={wolf:true};w.arrows=[];for(const v of w.wolves)v.kind='wolf';for(const b of w.buildings)if(b.kind==='tower')b.stun=0}
    for(const v of w.wolves)if(!KINDS[v.kind])v.kind='wolf';
    if(!w.seen||typeof w.seen!=='object')w.seen={};if(!Number.isSafeInteger(w.trickle))w.trickle=w.t+5;if(!Number.isSafeInteger(w.mercy)||w.mercy<0)w.mercy=0;
    const st=w.stats||{};w.stats={kills:0,henLost:0,henSaved:0,broken:0,fenceBroken:0,waves:0,bosses:0,bossKills:0,splash:0};for(const k in w.stats)if(Number.isSafeInteger(st[k]))w.stats[k]=st[k];
    if(opt&&opt.interval){w.interval=Math.max(80,Math.round(opt.interval));w.wave.arrive=Math.min(w.wave.arrive,w.t+w.interval)}
    return w;
  }

  const api={V:2,TICK,RADIUS,EDGE,SPAWNS,WOLF,KINDS,MIX,BOSS_EVERY,TOWER,POWER,ROAR,HP,MEND,REBUILD,HEN,DASH,MERCY,INTERVAL,MAX_WOLVES,TRAVEL,TOWER_SLOTS,PLACE,HOME,
    intervalFor,create,sync,step,volley,volleyArrows,dashTicks,built,threat,repairAll,brokenCount,barLeft,secondsLeft,packSize,trickleGap,kindsAt,restore,radius,sectorOf,rand,range,cooldown,damage,power};
  if(typeof module!=='undefined')module.exports=api;
  else root.World=api;
})(typeof window!=='undefined'?window:globalThis);
