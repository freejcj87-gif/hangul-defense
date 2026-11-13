/* 꼬꼬마을 세계 시뮬레이션(0.8, 0.9에서 타워 20자리·층, 닭 20, 울타리 3겹, 나이별 늑대 세기, 0.12에서 읽기 박자 무리 간격·늑대 왕·도둑 여우·물러남): 늑대·몬스터 무리 · 화살 타워(터지는 화살) · 닭 · 건물 · 울타리.
   화면과 무관한 순수 규칙이다. 같은 시드와 같은 입력이면 언제나 같은 결과가 나오고(시드 난수), 상태는 그대로 JSON 저장된다.
   시간 단위는 틱(0.1초). 좌표는 3D 장면과 같은 단위이고 마을 중심이 (0,0)이다. 설계: docs/village-defense-design.md, docs/game-plan.md §4 */
(function(root){
  'use strict';
  const TICK=.1;
  const RADIUS=[7,10,13,16];      /* 마을 반지름(마을회관 단계별) */
  const EDGE=7;                    /* 출현 지점 = 마을 반지름 + 7(숲 가장자리). 나오자마자 화면에 보인다 */
  const SPAWNS=8;                  /* 둘레의 출현 지점 수(방향 (p+0.5)×45°: 22.5° · 67.5° …) */
  const WOLF={speed:1,hp:12,hpPerBuilt:1.25,hpMax:90,bite:10,carry:.65,smash:.3,bored:250,reach:.55};
  /* 나이별 늑대 세기(game-plan §4.2): 출현할 때 속도·체력에 곱하고, 무리 크기에 곱한다. step(w,s)가 s.age로 읽는다(모르는 나이는 1·1·1) */
  const AGE={7:{speed:.925,hp:.85,pack:.85},8:{speed:.975,hp:.95,pack:.95},9:{speed:1.025,hp:1.05,pack:1.05},10:{speed:1.075,hp:1.15,pack:1.15}};
  const AGE_NONE={speed:1,hp:1,pack:1};
  const ageOf=s=>AGE[s&&s.age]||AGE_NONE;
  /* 다회차 늑대 세기(0.12): 경제 상태의 s.run.wolfMul(%, 95~120, Combat.WOLF_MUL)을 체력·무리에 곱하고 속도에는 절반만(1 + (m−1)/2) */
  const mulOf=s=>{const m=s&&s.run&&s.run.wolfMul;return Number.isFinite(m)&&m>0?m/100:1};
  /* 늑대를 부르는 정도(threat)의 계수와 무리 크기. 상한 20(타워·닭)에 맞춰 0.8보다 낮췄다: 보통 아이 20분 무리가 0.8과 비슷하고 40분 무렵 상한 */
  const THREAT={tower:.98,power:1.13,other:.38,hall:.75};
  /* 무리 크기 = 1 + min(waveMax, 무리 번호/waveEvery) + 위협 × perThreat + 회관 × perHall (최대 max) */
  const PACK={max:53,perThreat:.84,perHall:3,waveMax:2,waveEvery:4};
  /* 낙오 늑대 간격(틱) = (base + 난수 × spread) × max(floor, 1 − 위협/threat). 두 마리일 확률 = min(.5, 위협/pair) */
  const TRICKLE={base:40,spread:24,floor:.36,threat:38,pair:16};
  /* 천천히 읽는 아이 완충: s.pace(Combat, 100 = 보통 속도)가 100보다 크면 무리 크기 ×, 낙오 늑대 간격 ÷ (100/pace)^pow (최소 min). pow 0이면 끔 */
  const SLOW={pow:2,min:.3}; /* 0.12: 완충 강화(1.35·.42 → 2·.3, 설계 v2 §5.2) */
  const slowEase=s=>{const p=s&&s.pace;return SLOW.pow>0&&p>100?Math.max(SLOW.min,Math.pow(100/p,SLOW.pow)):1};
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
  /* 타워 강화(s.power): 0 화살 · 1 펑 화살(맞은 자리 둘레에 60% 피해) · 2 큰 펑 화살(더 넓게, 75%, 피해 +3) · 3 세 갈래 화살(한 번에 3마리)
     4~10단계: 화살 피해 +POWER_STEP씩(세 갈래 화살 그대로) */
  const POWER=[{splash:0,share:0,plus:0,multi:1},{splash:1.3,share:.6,plus:0,multi:1},{splash:1.9,share:.75,plus:3,multi:1},{splash:1.9,share:.75,plus:3,multi:3}];
  const POWER_STEP=1;
  /* 타워 층: 자리가 다 찬 뒤 산 타워는 가장 낮은 타워를 한 층 올린다. 층마다 피해 +2, 사거리 +0.3 */
  const FLOOR={damage:2,range:.3};
  const ROAR={every:80,reach:6,stun:25}; /* 불씨 왕: 타워 가까이 오면 8초마다 울부짖어 둘레 타워를 2.5초 멈춘다 */
  const HP={coop:110,market:100,nursery:80,barn:100,tower:90,fence:70};
  /* 울타리 겹(layer 1~3)별 체력: 나무 · 두 줄 나무 · 돌담 */
  const FENCE_HP=[70,140,220];
  const MEND=.05;                  /* 공격받지 않는 건물은 틱마다 0.05(초당 0.5)씩 저절로 회복한다(부서진 건물은 고치기 카드로) */
  /* 부서진 울타리는 둘레에 늑대가 없으면 15초 뒤 농부가 다시 세운다. 산 겹은 잃지 않고 그 겹 그대로, 체력은 그 겹 최대의 절반으로(35/70/110).
     고치기 카드는 건물에만(고치기는 울타리도 최대 체력으로 채운다) */
  const REBUILD=150;
  const SIZE={coop:1.4,market:1.6,nursery:1,barn:1.6,tower:.9};
  /* alert: 늑대가 이 거리 안에 오면 그 닭만 닭장으로 숨는다(0.10: 마을 둘레에 늑대가 하나만 있어도 닭 전부가 숨어 큰 마을에서 닭이 보이지 않았다).
     시뮬레이터 비교(5.5·4·3): 작을수록 닭이 오래 보이고 '구한 닭' 장면이 늘며 느린 아이의 잃은 닭은 오히려 줄어 3.5 */
  const HEN={speed:1.6,calm:30,alert:3.5};
  /* 새 판 보호(index.html이 새 판을 만들 때 guard로 켠다. 0.10 플레이 점검: 느린 7·10세가 첫 몇 분에 닭을 다 잃고 무너짐)
     calm = 처음 몇 문제가 남았는지(맞히든 틀리든 첫 고르기마다 한 칸, 그동안 늑대는 쫓기만 하고 물지도 부수지도 않는다. 맞힌 수로 세면 찍는 아이가 오래 보호받았다),
     keep = 물리지 않은 닭이 1마리면 노리지 않는다(물고 있는·물려 가는 닭은 세지 않으므로, 두 마리가 한꺼번에 물려 0마리가 되는 일이 없다. 0.12에서 검사로 고정) */
  const GUARD={calm:3};
  const RUSH={frac:.3};             /* 틀리면 무리 간격의 frac만큼 세계를 빨리 감는다(늑대가 성큼). 마구 찍기를 손해로 만든다 */
  const DASH=RUSH.frac;
  const MERCY={per:.1,max:.5,decay:300}; /* 닭을 잃거나 건물이 부서질 때마다 다음 무리 10% 작게·낙오 늑대 뜸하게(최대 50%), 마지막으로 잃은 뒤 30초마다 한 단계 풀림 */
  const MERCY_CAP=Math.round(MERCY.max/MERCY.per); /* 완충 단계 상한(5). 넘게 쌓이면 최대 효과가 몇 분씩 이어졌다 */
  const INNER=1.5;                 /* 마을이 커져 울타리 줄보다 이만큼 안쪽에 있는 늑대는 울타리를 부수지 않고 바로 사냥 */
  const SIDE_REACH=2.2;            /* 울타리 한 면(그 방향 부채꼴)의 울타리 줄 안팎 이 거리 안에 늑대가 있으면 농부가 다시 세우지 않는다 */
  /* 무리 간격(틱), 13~45초. 0.12: 실제로 나올 문제들의 평균 기본 시간 × TEMPO(1.3). 긴 글을 읽는 나이는 그만큼 늑대도 느긋하게 온다(0.11까지는 중앙값, 13~20초).
     낙오 늑대 간격도 같은 비율(τ = 간격 ÷ 13초)로 늘인다(trickleGap) */
  const INTERVAL={min:130,max:450},TEMPO=1.3;
  const intervalFor=baseSec=>Math.max(INTERVAL.min,Math.min(INTERVAL.max,Math.round((Number(baseSec)||13)/TICK)));
  const tempoInterval=meanSec=>intervalFor((Number(meanSec)||10)*TEMPO);
  /* 늑대 왕(0.12): 늑대 목록(상한 90)과 별개 자리(w.king). 화살에 맞지 않고 포효하지 않으며 공격하지 않는다(지는 경우 없음).
     마을 정면 쪽 출현 지점(point)의 숲 가장자리에서 기다리다(wait), 종이 울리면 울타리 밖 멈춤 지점(반지름 + stop)까지 걸어오고(come → stand),
     8세부터 두 번 틀릴 때마다 step만큼 다가선다(최대 3걸음, 그래도 울타리 밖). 방패가 다 깨지면 숲으로 달아난다(flee) */
  const KING={point:2,far:3,wait:-1,stop:2.4,step:.6,speed:1.2,flee:4,size:3.6};
  /* 도둑 여우(0.12): 한 번에 한 마리, 늑대 목록과 별개(w.fox)라 타워가 저절로 쏘지 않는다. 정해진 틱(total)에 맞춰 닭까지 온다 */
  const FOX={flee:3.2,arrow:1.6,size:.7};
  const MAX_WOLVES=90;
  const TRAVEL=Math.ceil(EDGE/WOLF.speed/TICK); /* 출현에서 마을 경계까지 걸리는 틱(약 7초) */
  /* 고정 배치. 0단계 타워 자리 6(0.8과 같음, 중심에서 가까운 순서). */
  const TOWER_SLOTS=[[1.2,1.4],[-3.6,1.4],[-5.6,-2],[5.8,-.4],[-.8,-6.2],[-4.4,4.6]];
  /* 회관 단계마다 열리는 바깥 고리. 늑대 출현 방향(22.5° + 45°k, 퍼짐 ±14.3°) 밖이고, 3D의 대각선 흙길(45°·135°·225°·315°, 회관 3단계면 r 14까지)을
     비키려고 기수 방향(0°·90°·180°·270°)에 둔다. 그 단계 마을 반지름(10·13·16)보다 1.4 이상 안쪽. 고리 안 순서는 맞은편끼리 번갈아.
     1단계 동쪽 자리는 3단계 시장 상자를 비켜 z +0.6. 3단계 마지막 둘은 대각선 띠 가장자리(37.5°·217.5°, 길 끝에서 1.3 이상). */
  const deg=(d,r)=>{const a=d*Math.PI/180;return [Math.round(Math.cos(a)*r*100)/100,Math.round(Math.sin(a)*r*100)/100]};
  const RINGS=[{hall:1,slots:[[8.5,.6],deg(180,8.5),deg(90,8.5),deg(270,8.5)]},{hall:2,slots:[deg(0,11.5),deg(180,11.5),deg(90,11.5),deg(270,11.5)]},
    {hall:3,slots:[deg(0,14.5),deg(180,14.5),deg(90,14.5),deg(270,14.5),deg(37.5,14.5),deg(217.5,14.5)]}];
  const ALL_SLOTS=Object.freeze(TOWER_SLOTS.map(p=>Object.freeze(p.slice())).concat(...RINGS.map(g=>g.slots.map(p=>Object.freeze(p)))));
  const SLOT_COUNT=[6,10,14,20];
  const SLOTS_AT=SLOT_COUNT.map(n=>Object.freeze(ALL_SLOTS.slice(0,n)));
  /* 회관 단계(0~3)의 타워 자리 [[x,z],…]: 6 / 10 / 14 / 20 */
  const towerSlots=hall=>SLOTS_AT[Math.max(0,Math.min(3,hall|0))];
  const PLACE={coop:[-2.8,-2.8],market:[4.2,-1.8],nursery:[.6,-3.6],barn:[-6.2,-4.4]};
  /* 닭 마당 20자리: 0~7은 0.8 그대로(앞마당 4 × 2). 8~19는 마당 뒤쪽(+z, 두 대각선 흙길 사이)과 회관 옆 뜰(-x)로 넓어진 자리,
     가까운 순서. 타워 자리 20과 1.2 이상, 건물 외곽과 0.9 이상, 3D 소품(깃발·등불·상자·바위)과 1.2 이상, 흙길 가장자리와 0.5 이상, 0단계 마을 안 */
  const HOMES=Object.freeze([[-1.8,-.4],[-.6,-.4],[.6,-.4],[1.8,-.4],[-1.8,.7],[-.6,.7],[.6,.7],[1.8,.7],
    [-.1,1.6],[-.7,2.4],[.4,2.5],[-.2,3.3],[-2.7,.2],[-1.3,3.2],[.8,3.5],[-3.5,-.4],[0,4.3],[1,4.5],[-4.3,.4],[-4.3,-1]].map(p=>Object.freeze(p)));
  const HENS_MAX=HOMES.length;
  const HOME=i=>HOMES[i]||HOMES[0];

  /* ---------- 난수(mulberry32, 상태는 w.rng 한 칸) ---------- */
  function rand(w){let t=(w.rng=(w.rng+0x6D2B79F5)>>>0);t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296}
  const dist=(ax,az,bx,bz)=>Math.hypot(ax-bx,az-bz);
  const radius=w=>RADIUS[Math.max(0,Math.min(3,w.hall|0))];
  const sectorOf=(x,z)=>{let a=Math.atan2(z,x);if(a<0)a+=Math.PI*2;return Math.floor(a/(Math.PI/3))%6};
  const kindOf=v=>KINDS[v&&v.kind]||KINDS.wolf;
  const alive=v=>v.state!=='dead'&&v.state!=='gone';

  /* 무리 간격(틱): index.html이 나이별로 정해 넘긴다(13~18초). 첫 낙오 늑대는 시작하자마자 나온다. */
  function create(opt){
    const o=opt||{},iv=Math.max(80,Math.round(o.interval||150));
    const w={v:2,t:0,rng:(o.seed>>>0)||1,hall:0,interval:iv,
      wave:{n:0,arrive:iv,spawned:false},trickle:5,seen:{},mercy:0,mercyT:0,
      wolves:[],hens:[],buildings:[],arrows:[],nextId:1,stats:{kills:0,henLost:0,henSaved:0,broken:0,fenceBroken:0,waves:0,bosses:0,bossKills:0,splash:0,foxSaved:0,foxLost:0,foxScared:0},events:[]};
    if(o.guard){w.calm=GUARD.calm;w.keep=true}
    return w;
  }
  /* 한 문제의 첫 고르기(맞힘·틀림, index.html이 부른다): 새 판 보호를 한 칸 줄인다 */
  function answered(w){if(w&&w.calm>0)w.calm--}
  const id=w=>w.nextId++;

  /* ---------- 경제 상태(Combat)와 맞추기 ----------
     타워 = 1 + s.level(첫 타워는 처음부터): 빈 자리부터 세우고, 그 단계 자리가 다 차면 가장 낮은 타워(같으면 서 있는 것, 그다음 앞 자리)를 한 층 올린다.
       층은 내려가지 않는다(회관이 커져 자리가 늘어도 이미 올린 층은 그대로, 새 자리는 다음 타워부터 채움). 언제나 층의 합 = 1 + s.level.
     울타리 = s.fence(0~18): 6면을 앞에서부터 한 겹씩, 다 막으면 다시 앞에서부터 두 겹·세 겹(가장 얇은 면부터). fenceLayers 참고.
     닭 = s.chickens(최대 20), 회관 단계 = s.hall. 잡혀간 닭은 index.html이 s.chickens를 줄여서 반영한다. */
  /* 울타리 산 수 n(0~18) → 6면의 겹 수 [0~3, …] */
  const fenceLayers=n=>{const f=Math.max(0,Math.min(18,n|0)),out=[];for(let k=0;k<6;k++)out.push(f>k?Math.min(3,1+Math.floor((f-1-k)/6)):0);return out};
  function sync(w,s){
    w.hall=Math.max(0,Math.min(3,s.hall|0));
    const R=radius(w);
    const want={coop:1,market:1,nursery:w.hall>=1?1:0,barn:w.hall>=3?1:0};
    for(const kind of Object.keys(want))if(want[kind]&&!w.buildings.some(b=>b.kind===kind)){const [x,z]=PLACE[kind];w.buildings.push({id:id(w),kind,x,z,hp:HP[kind],max:HP[kind],broken:false})}
    syncTowers(w,Math.max(1,Math.min(TOWER_UNITS,1+(s.level|0))));
    const layers=fenceLayers(s.fence);
    for(let k=0;k<6;k++){
      let f=w.buildings.find(b=>b.kind==='fence'&&b.side===k);const L=layers[k];
      if(L>0&&!f){f={id:id(w),kind:'fence',side:k,layer:L,x:0,z:0,hp:FENCE_HP[L-1],max:FENCE_HP[L-1],broken:false};w.buildings.push(f)}
      else if(f&&L>0&&L!==f.layer){
        /* 덧대면 그 겹 최대 체력이 되고 늘어난 만큼 체력도 는다. 부서져 있던 면은 새로 쌓아 바로 선다(산 순간 보이게). 줄어드는 것은 망가진 저장뿐 */
        const mx=FENCE_HP[L-1];
        if(L>f.layer){if(f.broken){f.broken=false;f.hp=mx;f.rebuild=REBUILD}else f.hp=Math.min(mx,f.hp+mx-f.max)}else f.hp=Math.min(mx,f.hp);
        f.layer=L;f.max=mx;
      }
      if(f){const a=(k+.5)*Math.PI/3;f.x=Math.cos(a)*R;f.z=Math.sin(a)*R}
    }
    const hens=Math.max(0,Math.min(HENS_MAX,s.chickens|0));
    w.hens=w.hens.filter(h=>h.state!=='gone');
    /* 경제보다 닭이 많으면(망가진 저장 등) 잡히지 않은 닭부터 뒤에서 뺀다: 세계 닭 수 = s.chickens */
    for(let i=w.hens.length-1;i>=0&&w.hens.length>hens;i--)if(w.hens[i].state!=='caught'&&w.hens[i].state!=='carried')w.hens.splice(i,1);
    for(let i=w.hens.length;i<hens;i++){const slot=freeHome(w);const [x,z]=HOME(slot);w.hens.push({id:id(w),slot,x,z,state:'yard',calm:0})}
    return w;
  }
  const TOWER_UNITS=20; /* 타워 수(층 포함) 상한 = 경제의 1 + 19 */
  function syncTowers(w,units){
    const slots=towerSlots(w.hall).length;
    /* 그 단계에 없는 자리의 타워(망가진 저장)는 버린다 */
    if(w.buildings.some(b=>b.kind==='tower'&&!(b.slot<slots)))w.buildings=w.buildings.filter(b=>b.kind!=='tower'||b.slot<slots);
    let sum=0;for(const b of w.buildings)if(b.kind==='tower'){if(!int(b.floor,1,TOWER_UNITS))b.floor=1;sum+=b.floor}
    /* 빈 자리부터 채운다(망가진 저장에서 타워 하나가 빠져도 자리가 겹치지 않게) */
    for(let i=0;i<slots&&sum<units;i++)if(!w.buildings.some(b=>b.kind==='tower'&&b.slot===i)){const [x,z]=ALL_SLOTS[i];w.buildings.push({id:id(w),kind:'tower',slot:i,floor:1,x,z,hp:HP.tower,max:HP.tower,broken:false,cd:0,stun:0});sum++}
    /* 자리가 다 찼으면 가장 낮은 타워부터 한 층씩(같은 높이면 서 있는 타워, 그다음 앞 자리) */
    while(sum<units){let low=null;for(const b of w.buildings)if(b.kind==='tower'&&(!low||b.floor<low.floor||b.floor===low.floor&&(b.broken!==low.broken?low.broken:b.slot<low.slot)))low=b;if(!low)break;low.floor++;sum++}
    /* 경제보다 많으면(망가진 저장·상한 보정) 가장 높은 타워(같으면 뒤 자리)부터 낮추고, 1층이면 없앤다 */
    while(sum>units){let hi=null;for(const b of w.buildings)if(b.kind==='tower'&&(!hi||b.floor>hi.floor||b.floor===hi.floor&&b.slot>hi.slot))hi=b;if(!hi)break;if(hi.floor>1)hi.floor--;else w.buildings.splice(w.buildings.indexOf(hi),1);sum--}
  }
  function freeHome(w){for(let i=0;i<HENS_MAX;i++)if(!w.hens.some(h=>h.state!=='gone'&&h.slot===i))return i;return 0}

  /* ---------- 늑대·몬스터 출현 ---------- */
  const built=s=>(s.level|0)+(s.fence|0)+Math.max(0,(s.chickens|0)-1)+(s.farmers|0)+(s.pond|0)+(s.hall|0)+(s.power|0);
  /* 늑대를 부르는 정도: 방어 시설(타워·강화)은 크게, 울타리·닭·농부·연못은 적게. 닭을 샀다고 무리만 커져 손해 보는 일이 없게 한다. */
  const threat=s=>THREAT.tower*(s.level|0)+THREAT.power*(s.power|0)+THREAT.other*((s.fence|0)+Math.max(0,(s.chickens|0)-1)+(s.farmers|0)+(s.pond|0))+THREAT.hall*(s.hall|0);
  /* 무리 크기: 주로 마을 크기를 따른다(마을이 커져야 늑대도 많아진다). 무리 번호는 조금만(최대 +4). 나이 손잡이(pack)를 곱한다 */
  const ease=w=>1-Math.min(MERCY.max,(w.mercy|0)*MERCY.per);
  function mercyUp(w){w.mercy=Math.min(MERCY_CAP,(w.mercy|0)+1);w.mercyT=MERCY.decay}
  function packSize(w,s){return Math.max(1,Math.round(Math.min(PACK.max,1+Math.min(PACK.waveMax,Math.floor(w.wave.n/PACK.waveEvery))+Math.floor(threat(s)*PACK.perThreat)+(s.hall|0)*PACK.perHall)*ease(w)*ageOf(s).pack*mulOf(s)*slowEase(s)))}
  /* 낙오 늑대: 무리 사이에도 한두 마리씩 계속 나온다(마을이 커질수록 자주). 다음 낙오까지의 틱. 무리 간격이 13초보다 길면 같은 비율로 뜸하게(τ) */
  const tau=w=>Math.max(1,(w.interval||INTERVAL.min)/INTERVAL.min);
  const trickleGap=(w,s)=>Math.round((TRICKLE.base+rand(w)*TRICKLE.spread)*tau(w)*Math.max(TRICKLE.floor,1-threat(s)/TRICKLE.threat)/ease(w)/slowEase(s));
  const dashTicks=w=>Math.round(RUSH.frac*w.interval);
  function pickKind(w,s,boss){
    if(boss)return 'ember';
    const mix=MIX[Math.min(3,s.hall|0)];let total=0;for(const k in mix)total+=mix[k];
    let r=rand(w)*total;for(const k in mix){r-=mix[k];if(r<0)return k}return 'wolf';
  }
  function addWolf(w,s,kind,x,z){
    const K=KINDS[kind],A=ageOf(s),M=mulOf(s),hp=Math.max(1,Math.round(Math.min(WOLF.hpMax,WOLF.hp+WOLF.hpPerBuilt*threat(s))*K.hp*A.hp*M));
    const v={id:id(w),kind,x,z,sx:x,sz:z,hp,max:hp,speed:WOLF.speed*K.speed*A.speed*(1+(M-1)/2)*(.92+rand(w)*.16),state:'walk',target:0,timer:0,inside:0,hen:0};
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
    const n=1+(rand(w)<Math.min(.5,threat(s)/TRICKLE.pair)?1:0),p=Math.floor(rand(w)*SPAWNS),R=radius(w)+EDGE;
    for(let i=0;i<n;i++){const a=(p+.5)*Math.PI*2/SPAWNS+(rand(w)-.5)*.5;addWolf(w,s,pickKind(w,s,false),Math.cos(a)*(R+i*.8),Math.sin(a)*(R+i*.8))}
    w.events.push({type:'straggler',n,point:p});
  }

  /* ---------- 한 틱 ---------- */
  function step(w,s){
    w.events=[];w.t++;
    const R=radius(w);
    /* 무리 일정: 도착 TRAVEL틱 전에 숲 가장자리에 나타나 걸어온다. 무리 사이에는 낙오 늑대가 계속 나온다. */
    /* 물러남(w.peace, 0.12): 0이 아니면 새 늑대가 나오지 않는다(양수 = 남은 틱, −1 = 계속. 늑대 왕을 물리친 뒤) */
    const quiet=(w.peace|0)!==0;if(w.peace>0)w.peace--;
    if(!w.wave.spawned&&w.t>=w.wave.arrive-TRAVEL){if(!quiet)spawnPack(w,s);w.wave.spawned=true}
    if(w.t>=w.wave.arrive){w.wave.n++;w.stats.waves++;w.wave.arrive+=w.interval;w.wave.spawned=false;if(!quiet)w.events.push({type:'arrive',n:w.wave.n})}
    if(w.t>=w.trickle){if(!quiet)spawnStraggler(w,s);w.trickle=w.t+trickleGap(w,s)}
    /* 완충은 마지막으로 잃은 뒤 30초마다 한 단계 풀린다(전에는 t%300이라 잃자마자 풀리기도 했다) */
    if(w.mercy>0&&--w.mercyT<=0){w.mercy--;w.mercyT=MERCY.decay}
    /* 어림 상자(|x|,|z|) 먼저: hypot은 언제나 |x|,|z| 이상이라 결과는 같고 hypot 계산만 줄어든다 */
    const zone=R+1.5,threats=[];
    for(const v of w.wolves)if(v.state!=='leave'&&v.state!=='carry'&&alive(v)&&Math.abs(v.x)<zone&&Math.abs(v.z)<zone&&Math.hypot(v.x,v.z)<zone)threats.push(v);
    /* 그 닭 둘레(HEN.alert) 안에 늑대가 있나. 숨은 닭은 닭장 자리에 있으므로 닭장 둘레를 본다 */
    const A=HEN.alert,scared=h=>{for(const v of threats){const dx=v.x-h.x,dz=v.z-h.z;if(dx<A&&dx>-A&&dz<A&&dz>-A&&dx*dx+dz*dz<A*A)return true}return false};
    const coop=w.buildings.find(b=>b.kind==='coop');
    /* 잡힌 닭인데 무는/물고 가는 늑대가 없으면(망가진 저장 등) 놓여나 도망친다 */
    let held=null;
    for(const h of w.hens)if(h.state==='caught'||h.state==='carried'){
      if(!held){held=new Map();for(const v of w.wolves)if(v.state==='bite')held.set(v.hen,'caught');else if(v.state==='carry')held.set(v.hen,'carried')}
      if(held.get(h.id)!==h.state){h.state='flee';h.calm=0}}
    /* 닭: 늑대가 그 닭 가까이 오면 닭장으로 숨고, 둘레가 조용해지면 3초 뒤 돌아온다. */
    let free=0;
    for(const h of w.hens){
      if(h.state==='caught'||h.state==='carried'||h.state==='gone')continue;
      free++;
      const safe=coop&&!coop.broken;
      if(safe&&threats.length&&scared(h)){h.calm=0;if(h.state!=='hidden'){h.state='flee';if(move(h,coop.x,coop.z,HEN.speed,.8)){h.state='hidden';h.x=coop.x;h.z=coop.z}}}
      else if(h.state==='hidden'&&!safe){h.state='yard'}
      else if(h.state==='hidden'||h.state==='flee'||h.state==='home'){if(++h.calm>=HEN.calm){h.state='home'}if(h.state==='home'){const [x,z]=HOME(h.slot);if(move(h,x,z,HEN.speed,.1))h.state='yard'}}
    }
    /* 늑대 왕: 목표 거리까지 걷는다(기다림·멈춤 지점·달아남). 닭도 건물도 건드리지 않는다 */
    if(w.king){const k=w.king,g=kingGoal(w,k),sp=(k.state==='flee'?KING.flee:KING.speed)*TICK;
      if(Math.abs(g-k.r)<=sp){k.r=g;if(k.state==='come'){k.state='stand';w.events.push({type:'kingStand',id:k.id})}else if(k.state==='flee'){w.king=null;w.events.push({type:'kingGone',id:k.id})}}
      else k.r+=Math.sign(g-k.r)*sp;
      if(w.king)kingPut(k)}
    /* 도둑 여우: 남은 틱에 맞춰 닭(없으면 회관)까지 온다. 닿으면 닭 한 마리를 데려가거나(물리지 않은 닭이 2마리 이상이고 놀래키기 전용이 아닐 때) 놀래키기만 하고 달아난다 */
    if(w.fox){const f=w.fox;
      if(f.state==='come'){
        const hen=nearest(w.hens,f,foxPrey),tx=hen?hen.x:coop?coop.x:0,tz=hen?hen.z:coop?coop.z:0,n=Math.max(1,f.left|0);
        f.hen=hen?hen.id:0;f.x+=(tx-f.x)/n;f.z+=(tz-f.z)/n;
        if(--f.left<=0){
          if(f.scare||!hen||free<=1){for(const h of w.hens)if(huntable(h)){h.state='flee';h.calm=0}w.stats.foxScared++;w.events.push({type:'foxScare',hen:f.hen,fox:f.id})}
          else{hen.state='gone';free--;f.took=true;w.stats.henLost++;w.stats.foxLost++;mercyUp(w);w.events.push({type:'foxLost',hen:hen.id,fox:f.id},{type:'henLost',hen:hen.id,wolf:0,fox:true})}
          f.state='flee'}
      }else if(move(f,f.sx,f.sz,FOX.flee,.3)){w.fox=null;w.events.push({type:'foxGone',fox:f.id})}}
    /* 늑대·몬스터 */
    for(const v of w.wolves){
      if(!alive(v))continue;
      const K=kindOf(v);
      if(K.boss&&(v.roar=(v.roar|0)-1)<=0){const near=w.buildings.filter(b=>b.kind==='tower'&&!b.broken&&dist(b.x,b.z,v.x,v.z)<=ROAR.reach);
        if(near.length&&v.state!=='leave'){for(const b of near)b.stun=ROAR.stun;v.roar=ROAR.every;w.events.push({type:'roar',wolf:v.id,towers:near.map(b=>b.id)})}else v.roar=10}
      if(v.state==='walk'){
        const r=Math.hypot(v.x,v.z);
        /* 울타리 줄에 닿으면 그 면 울타리를 부순다. 마을이 커져 이미 울타리 안쪽이면 바로 사냥 */
        if(r<=R+.3){const k=sectorOf(v.x,v.z),f=r>=R-INNER&&w.buildings.find(b=>b.kind==='fence'&&b.side===k&&!b.broken);if(f){v.state='smash';v.target=f.id}else v.state='hunt'}
        else move(v,0,0,v.speed);
      }else if(v.state==='hunt'){
        if(++v.inside>WOLF.bored){v.state='leave';continue}
        /* 새 판 보호: 쫓기만 한다(물지도 부수지도 않고, 닭 앞에서 멈춰 겁만 준다) */
        if(w.calm>0){const h=K.prey==='building'?null:nearest(w.hens,v,huntable);if(h)move(v,h.x,h.z,v.speed*.6,WOLF.reach*K.size+1.2);else move(v,0,0,v.speed*.5,R*.3);continue}
        /* 물리지 않은 닭이 1마리면 노리지 않는다(keep). free는 물 때마다 줄어, 같은 틱에 두 늑대가 마지막 두 마리를 다 무는 일이 없다 */
        const hen=K.prey==='building'||w.keep&&free<=1?null:nearest(w.hens,v,huntable);
        if(hen){if(move(v,hen.x,hen.z,v.speed,WOLF.reach*K.size)){v.state='bite';v.timer=WOLF.bite;v.hen=hen.id;hen.state='caught';free--;w.events.push({type:'bite',wolf:v.id,hen:hen.id})}}
        else if(K.prey==='hen'&&w.hens.some(h=>h.state==='hidden'||h.state==='flee')){move(v,0,0,v.speed*.5,R*.3)} /* 숨은 닭 둘레를 어슬렁 */
        else{const b=nearest(w.buildings,v,standing);
          if(!b){v.state='leave'}else if(move(v,b.x,b.z,v.speed,(SIZE[b.kind]||1)+.2*K.size)){v.state='smash';v.target=b.id}}
      }else if(v.state==='bite'){
        const hen=w.hens.find(h=>h.id===v.hen);
        if(!hen||hen.state!=='caught'){v.state='hunt';v.hen=0}
        else if(--v.timer<=0){hen.state='carried';v.state='carry';w.events.push({type:'carry',wolf:v.id,hen:hen.id})}
      }else if(v.state==='carry'){
        const hen=w.hens.find(h=>h.id===v.hen&&h.state==='carried'); /* 물고 가는 닭만(놓친 닭을 끌고 가거나 없애지 않게) */
        if(move(v,v.sx,v.sz,v.speed*WOLF.carry,.3)){v.state='gone';if(hen){hen.state='gone';w.stats.henLost++;mercyUp(w);w.events.push({type:'henLost',hen:hen.id,wolf:v.id})}}
        else if(hen){hen.x=v.x;hen.z=v.z}
      }else if(v.state==='smash'){
        const b=w.buildings.find(x=>x.id===v.target);
        if(!b||b.broken){v.state=b&&b.kind==='fence'?'walk':'hunt';if(b&&b.kind==='fence'){move(v,0,0,v.speed);}continue}
        if(b.kind==='fence'&&Math.hypot(v.x,v.z)<R-INNER){v.state='hunt';continue} /* 마을이 커져 울타리가 바깥으로 물러났다 */
        b.hp=Math.max(0,b.hp-WOLF.smash*K.smash);
        if(b.kind!=='fence'&&++v.inside>WOLF.bored){v.state='leave';continue}
        if(b.hp<=0){b.broken=true;b.rebuild=REBUILD;if(b.kind==='fence')w.stats.fenceBroken++;else{w.stats.broken++;mercyUp(w)}w.events.push({type:'broken',building:b.id,kind:b.kind,wolf:v.id})}
      }else if(v.state==='leave'){
        if(move(v,v.sx,v.sz,v.speed,.3))v.state='gone';
      }
    }
    /* 타워: 사거리(층마다 +0.3) 안의 가까운 늑대에게 화살(세 갈래 화살이면 3마리). 포효에 멈춘 타워는 쉰다. */
    const P=power(s);let live=null,reach=0;
    for(const b of w.buildings){
      if(b.kind!=='tower')continue;
      if(b.stun>0){b.stun--;continue} /* 멈춤은 부서져 있어도 줄어든다(고친 뒤 묵은 멈춤이 남지 않게) */
      if(b.broken)continue;
      if(b.cd>0){b.cd--;continue}
      if(!live){live=liveWolves(w);reach=range(s)} /* 쏠 타워가 있을 때 한 번만(쏘는 동안 늑대는 그대로) */
      const near=targets(live,b,reach+FLOOR.range*floors(b),P.multi);
      if(near.length){for(const v of near)shoot(w,b,v,s);b.cd=cooldown(s)}
    }
    /* 화살: 날아가는 동안 과녁을 따라가고, 닿으면 맞힌다(펑 화살은 둘레도). 과녁이 먼저 쓰러졌으면 그 자리에서 터진다. */
    const byId=new Map();if(w.arrows.length)for(const v of w.wolves)if(!byId.has(v.id))byId.set(v.id,v); /* find(같은 id면 앞의 것)와 같다 */
    for(const a of w.arrows){
      if(a.gold){const o=w.fox&&w.fox.id===a.wolf?w.fox:w.king&&w.king.id===a.wolf?w.king:null;if(o){a.tx=o.x;a.tz=o.z}} /* 황금 화살(여우·늑대 왕): 과녁을 따라가기만 한다 */
      const v=byId.get(a.wolf),live=v&&alive(v);
      if(live||v&&v.state==='dead'){a.tx=v.x;a.tz=v.z} /* 쓰러진 자리(같은 틱에 먼저 쓰러져도 그 자리)로 */
      if(--a.t>0)continue;
      if(live)hit(w,v,a.damage);
      if(a.splash>0&&(live||a.tx!==undefined))burst(w,a,live?v:null);
    }
    w.arrows=w.arrows.filter(a=>a.t>0);
    /* 건물 회복: 지금 부수는 늑대가 없는 건물만 */
    const busy=new Set();for(const v of w.wolves)if(v.state==='smash')busy.add(v.target);
    let guarded=null;
    for(const b of w.buildings){
      if(!b.broken){if(b.hp<b.max&&!busy.has(b.id))b.hp=Math.min(b.max,b.hp+MEND);continue}
      if(b.kind!=='fence')continue;
      if(!Number.isFinite(b.rebuild))b.rebuild=REBUILD;
      /* 그 면 어디든(가운데만이 아니라) 울타리 줄 가까이에 늑대가 있으면 기다린다. 전에는 가운데 2.2만 봐서 모서리에 늑대가 선 채로 다시 섰다.
         늑대가 있는 면은 틱마다 한 번만 센다(이 동안 늑대는 움직이지 않는다) */
      if(!guarded){guarded=new Set();for(const v of w.wolves)if(alive(v)&&Math.abs(Math.hypot(v.x,v.z)-R)<SIDE_REACH)guarded.add(sectorOf(v.x,v.z))}
      if(guarded.has(b.side))continue;
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
  /* 1층 타워의 화살 피해: 기본 + 타워 수(5까지) + 강화(큰 펑부터 +3, 4~10단계 +1씩) */
  const damage=s=>TOWER.damage+2*Math.min(5,s&&s.level|0)+power(s).plus+POWER_STEP*Math.max(0,Math.min(10,s&&s.power|0)-3);
  const floors=b=>Math.max(0,((b&&b.floor)|0)-1); /* 1층 위로 올린 층 수 */
  const towerDamage=(s,b)=>damage(s)+FLOOR.damage*floors(b);
  const towerRange=(s,b)=>range(s)+FLOOR.range*floors(b);
  function shoot(w,b,v,s){
    const d=dist(b.x,b.z,v.x,v.z),t=Math.max(2,Math.ceil(d/(TOWER.arrowSpeed*TICK))),P=power(s);
    w.arrows.push({id:id(w),tower:b.id,wolf:v.id,fx:b.x,fz:b.z,tx:v.x,tz:v.z,t,total:t,damage:towerDamage(s,b),splash:P.splash,share:P.share});
    w.events.push({type:'shoot',tower:b.id,wolf:v.id,splash:P.splash>0});
  }
  /* 사거리 안에서 위험한 순(같으면 가까운 순, 그것도 같으면 목록 순)으로 k마리. 거리는 한 번만 재고 정렬 없이 고른다(안정 정렬의 앞 k마리와 같다) */
  function targets(list,b,reach,k){
    const out=[],key=[];
    for(const v of list){const dx=v.x-b.x,dz=v.z-b.z;if(dx>reach||dx<-reach||dz>reach||dz<-reach)continue;
      const d=Math.hypot(dx,dz);if(!(d<=reach))continue;
      const g=danger(v);let i=out.length;while(i>0&&(g>key[2*i-2]||g===key[2*i-2]&&d<key[2*i-1]))i--;
      if(i<k){out.splice(i,0,v);key.splice(2*i,0,g,d);if(out.length>k){out.pop();key.length-=2}}}
    return out;
  }
  /* 펑: 맞은 자리 둘레 splash 안의 다른 늑대에게 share만큼 피해 */
  function burst(w,a,center){
    const x=center?center.x:a.tx,z=center?center.z:a.tz,dmg=Math.max(1,Math.round(a.damage*a.share));let n=0;
    for(const o of w.wolves){if(o===center||!alive(o))continue;const r=a.splash+.25*(kindOf(o).size-1),dx=o.x-x,dz=o.z-z;
      if(dx>r||dx<-r||dz>r||dz<-r)continue;
      if(Math.hypot(dx,dz)<=r){hit(w,o,dmg);n++}}
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
  /* ok를 만족하는 것 가운데 가장 가까운 것(같으면 목록 앞). 걸러 낸 새 배열을 만들지 않는다 */
  function nearest(list,p,ok){let best=null,bd=Infinity;for(const o of list){if(!ok(o))continue;const d=dist(o.x,o.z,p.x,p.z);if(d<bd){bd=d;best=o}}return best}
  const huntable=h=>h.state==='yard'||h.state==='flee'||h.state==='home';
  const foxPrey=h=>h.state!=='caught'&&h.state!=='carried'&&h.state!=='gone'; /* 여우는 닭장에 숨은 닭도 노린다 */
  const standing=b=>!b.broken&&b.kind!=='fence';
  /* 목표 쪽으로 speed(초당)만큼 움직이고, stop 거리 안이면 true */
  function move(o,tx,tz,speed,stop){const dx=tx-o.x,dz=tz-o.z,d=Math.hypot(dx,dz),s=speed*TICK,lim=stop||0;if(d<=lim+s){if(d>lim){const k=(d-lim)/d;o.x+=dx*k;o.z+=dz*k}return true}o.x+=dx/d*s;o.z+=dz/d*s;return false}

  /* ---------- 경제·문제 흐름에서 부르는 동작 ---------- */
  /* 한 번에 맞히면 모든 타워가 일제 사격. 타워당 화살 수 = 2 × 글 길이 배수(긴 글일수록 한 번에 많이, 최대 8), 번개 정답이면 1.5배,
     세 갈래 화살이면 +2. 사거리 2배 안의 가까운 늑대부터 차례로 노린다. */
  function volleyArrows(s,o){const opt=o||{},m=Math.max(1,opt.scale||1);let n=Math.min(8,Math.round(2*m));if(opt.fast)n=Math.round(n*1.5);if(power(s).multi>1)n+=2;return n}
  function volley(w,s,opt){
    const per=volleyArrows(s,opt),live=liveWolves(w),base=range(s);let n=0;
    for(const b of w.buildings){if(b.kind!=='tower'||b.broken)continue;
      const reach=(base+FLOOR.range*floors(b))*TOWER.volleyRange,near=[];for(const v of live){const d=dist(v.x,v.z,b.x,b.z);if(d<=reach)near.push({v,d})} /* 거리는 한 번만 재서 정렬 */
      if(!near.length)continue;
      near.sort((p,q)=>p.d-q.d);
      for(let i=0;i<per;i++){shoot(w,b,near[i%near.length].v,s);n++}}
    return n;
  }
  /* ---------- 늑대 왕 · 도둑 여우 · 물러남 (0.12. 화면·시뮬이 부른다) ---------- */
  const kingGoal=(w,k)=>{const R=radius(w);return k.state==='wait'?R+EDGE+KING.wait:k.state==='flee'?R+EDGE+KING.far:R+KING.stop-KING.step*Math.max(0,Math.min(3,k.steps|0))};
  const kingPut=k=>{k.x=Math.round(Math.cos(k.a)*k.r*1000)/1000;k.z=Math.round(Math.sin(k.a)*k.r*1000)/1000};
  /* king(w, mode, steps, snap): mode 'wait'(숲 가장자리에서 기다림) · 'fight'(결전: 멈춤 지점으로, steps = 다가온 걸음) · 'flee'(달아남) · 'none'(없앰).
     snap이면 걷지 않고 바로 그 자리에 둔다(이어하기: 결전 중이던 왕은 멈춤 지점 처음 자리). 없던 왕은 숲 속(far)에서 걸어 나온다. → 왕 또는 null */
  function king(w,mode,steps,snap){
    if(mode==='none'){w.king=null;return null}
    let k=w.king;
    if(!k){if(mode==='flee')return null;k=w.king={id:id(w),a:(KING.point+.5)*Math.PI*2/SPAWNS,r:radius(w)+EDGE+KING.far,x:0,z:0,state:'wait',steps:0}}
    if(mode==='wait'){k.state='wait';k.steps=0}
    else if(mode==='fight'){if(k.state!=='stand')k.state='come';k.steps=Math.max(0,Math.min(3,steps|0))}
    else if(mode==='flee')k.state='flee';
    if(snap&&k.state!=='flee'){if(k.state==='come')k.state='stand';k.r=kingGoal(w,k)}
    kingPut(k);return k;
  }
  /* 황금 화살: 회관(종탑)에서 한 발. 타워가 다 부서져 있어도 나간다. 피해는 없고 과녁(여우·늑대 왕)을 따라가 닿으면 사라진다 */
  function goldArrow(w,o){
    const from=w.buildings.find(b=>b.kind==='coop')||{id:0,x:0,z:0},d=dist(from.x,from.z,o.x,o.z),t=Math.max(2,Math.ceil(d/(TOWER.arrowSpeed*FOX.arrow*TICK)));
    const a={id:id(w),tower:from.id,wolf:o.id,fx:from.x,fz:from.z,tx:o.x,tz:o.z,t,total:t,damage:0,splash:0,share:0,gold:true};w.arrows.push(a);return a;
  }
  /* 방패를 깬 황금 화살(연출용, 규칙은 Combat.finaleSettle) */
  function kingHit(w){return w.king?goldArrow(w,w.king):null}
  /* 여우 등장: ticks틱 뒤 닭에 닿는다(Combat.foxTicks). opt.scare = 놀래키기만(7세). 이미 여우가 있으면 null */
  function fox(w,s,ticks,opt){
    if(w.fox)return null;
    const o=opt||{},R=radius(w)+EDGE,p=Math.floor(rand(w)*SPAWNS),a=(p+.5)*Math.PI*2/SPAWNS,x=Math.round(Math.cos(a)*R*1000)/1000,z=Math.round(Math.sin(a)*R*1000)/1000,T=Math.max(10,Math.round(ticks)||10);
    w.fox={id:id(w),x,z,sx:x,sz:z,left:T,total:T,state:'come',scare:!!o.scare,hen:0,point:p};return w.fox;
  }
  /* 정답 사격이 여우를 맞힘(일제 사격 1순위. 화면이 한 번에 맞혔을 때, 그리고 FOX.second면 두 번째 정답에도 부른다):
     아직 닭에 닿기 전이면 황금 화살이 나가고 여우는 그 순간 달아난다(구출). 이미 닿았으면 false */
  function foxShoo(w){const f=w.fox;if(!f||f.state!=='come')return false;f.state='flee';f.saved=true;w.stats.foxSaved++;goldArrow(w,f);return true}
  /* 늑대가 모두 물러난다(늑대 왕을 물리침): 물던 닭은 놓고 달아나며, ticks틱 동안(−1 = 계속) 새 늑대가 나오지 않는다. → 물러난 수 */
  function retreat(w,ticks){
    let n=0;
    for(const v of w.wolves){if(!alive(v))continue;
      if(v.state==='bite'||v.state==='carry'){const hen=w.hens.find(h=>h.id===v.hen);if(hen&&(hen.state==='caught'||hen.state==='carried')){hen.state='flee';hen.calm=0;w.stats.henSaved++}}
      v.state='leave';v.hen=0;n++}
    w.peace=ticks<0||w.peace<0?-1:Math.max(w.peace|0,Math.round(ticks)||0);return n;
  }
  /* 물러남 끝(새 마을·늑대가 오는 자유 놀이) */
  function peaceOff(w){w.peace=0}
  /* 고치기 카드가 고칠 건물 수(울타리는 저절로 다시 세워지므로 빼고 센다) */
  const brokenCount=w=>w.buildings.filter(b=>b.broken&&b.kind!=='fence').length;
  /* 부서진 진짜 건물 종류(겹치지 않게, 건물 순서). Combat.recommend의 ctx.brokenKinds */
  const brokenKinds=w=>{const out=[];for(const b of w.buildings)if(b.broken&&b.kind!=='fence'&&!out.includes(b.kind))out.push(b.kind);return out};
  /* 매대(가게)가 부서졌으면 1: 알을 반값에 판다. 화면이 Combat 상태 s.marketDown에 넣는다 */
  const marketDown=w=>w.buildings.some(b=>b.kind==='market'&&b.broken)?1:0;
  /* 마을 안 늑대 수(사냥·물기, 또는 마을 경계 안에서 부수기). Combat.recommend의 ctx.wolvesInside, 화면 상태 문구 */
  const wolvesInside=w=>{const R=radius(w)+.5;let n=0;for(const v of w.wolves)if(v.state==='hunt'||v.state==='bite'||v.state==='smash'&&Math.hypot(v.x,v.z)<R)n++;return n};
  /* 세계의 타워 수(층 포함 = 1 + level) */
  const towerUnits=w=>{let n=0;for(const b of w.buildings)if(b.kind==='tower')n+=Math.max(1,b.floor|0);return n};
  function repairAll(w){let n=0;for(const b of w.buildings)if(b.broken||b.hp<b.max){if(b.broken)n++;b.broken=false;b.hp=b.max}return n}
  /* 다음 무리가 마을에 닿기까지 남은 비율(시간 바): 1 = 막 지나감, 0 = 도착 */
  const barLeft=w=>Math.max(0,Math.min(1,(w.wave.arrive-w.t)/w.interval));
  const secondsLeft=w=>Math.max(0,Math.ceil((w.wave.arrive-w.t)*TICK));
  /* 지금 단계에서 나오는 몬스터 종류(처음 나오는 순서) */
  const kindsAt=hall=>Object.keys(KINDS).filter(k=>KINDS[k].unlock<=Math.min(3,hall|0));

  /* 저장 복원: 모양이 맞지 않으면 버리고 새로 만든다. 0.7 저장(v1)은 늑대에 종류를 붙여 이어 쓴다.
     0.8 저장(v2, 층·겹 없음)은 형식 그대로 받아 타워에 floor 1, 울타리에 layer 1을 붙인다(체력은 그대로 70).
     opt.interval이 있으면 무리 간격을 지금 규칙으로 바꾸고, 다음 무리가 그보다 늦지 않게 당긴다. */
  function restore(raw,opt){
    if(!raw||typeof raw!=='object'||(raw.v!==1&&raw.v!==2)||!Array.isArray(raw.wolves)||!Array.isArray(raw.hens)||!Array.isArray(raw.buildings)||!isObj(raw.wave))return create(opt);
    try{
      const w=JSON.parse(JSON.stringify(raw));w.events=[];w.arrows=Array.isArray(w.arrows)?w.arrows:[];
      if(!Number.isSafeInteger(w.t)||w.t<0||!Number.isSafeInteger(w.rng)||!Number.isSafeInteger(w.interval))return create(opt);
      if(w.v===1){w.v=2;w.trickle=w.t+5;w.seen={wolf:true};w.arrows=[];for(const v of w.wolves)if(isObj(v))v.kind='wolf';for(const b of w.buildings)if(isObj(b)&&b.kind==='tower')b.stun=0}
      tidy(w);
      if(opt&&opt.interval){w.interval=Math.max(80,Math.round(opt.interval));w.wave.arrive=Math.min(w.wave.arrive,w.t+w.interval)}
      return w;
    }catch(e){return create(opt)}
  }
  /* 망가진 저장 다듬기: 틀린 값만 고치고 고칠 수 없는 항목은 버린다. 멀쩡한 저장은 한 글자도 바꾸지 않는다(저장·복원 뒤에도 같은 세계). */
  const isObj=o=>!!o&&typeof o==='object'&&!Array.isArray(o);
  const fin=Number.isFinite,int=(x,lo,hi)=>Number.isSafeInteger(x)&&x>=lo&&x<=hi;
  const WOLF_STATES=['walk','smash','hunt','bite','carry','leave','dead','gone'],HEN_STATES=['yard','flee','hidden','home','caught','carried','gone'];
  const KING_STATES=['wait','come','stand','flee'],FOX_STATES=['come','flee'];
  function tidy(w){
    w.hall=Math.max(0,Math.min(3,w.hall|0));w.interval=Math.max(80,w.interval);
    const wv=w.wave;if(!int(wv.n,0,Number.MAX_SAFE_INTEGER))wv.n=0;if(!Number.isSafeInteger(wv.arrive)||wv.arrive<=w.t)wv.arrive=w.t+w.interval;if(typeof wv.spawned!=='boolean')wv.spawned=false;
    if(!isObj(w.seen))w.seen={};if(!Number.isSafeInteger(w.trickle)||w.trickle>w.t+200)w.trickle=w.t+5;
    if(!int(w.mercy,0,MERCY_CAP))w.mercy=Number.isSafeInteger(w.mercy)&&w.mercy>0?MERCY_CAP:0;
    if(!int(w.mercyT,0,MERCY.decay))w.mercyT=MERCY.decay-w.t%MERCY.decay; /* 0.8 첫 저장: 예전 풀림 시각을 이어 쓴다 */
    if('calm' in w&&!int(w.calm,0,GUARD.calm))w.calm=0;if('keep' in w&&typeof w.keep!=='boolean')w.keep=!!w.keep;
    const st=w.stats||{};w.stats={kills:0,henLost:0,henSaved:0,broken:0,fenceBroken:0,waves:0,bosses:0,bossKills:0,splash:0,foxSaved:0,foxLost:0,foxScared:0};for(const k in w.stats)if(Number.isSafeInteger(st[k]))w.stats[k]=st[k];
    /* 0.12: 물러남·늑대 왕·여우. 모양이 틀리면 없는 것으로(화면이 run.bell을 보고 왕을 다시 세운다) */
    if('peace' in w&&!(Number.isSafeInteger(w.peace)&&w.peace>=-1&&w.peace<=1e6))w.peace=0;
    if(w.king!=null){const k=w.king;if(!isObj(k)||!Number.isSafeInteger(k.id)||!fin(k.a)||!fin(k.r)||!KING_STATES.includes(k.state))w.king=null;else{if(!int(k.steps,0,3))k.steps=0;kingPut(k)}}
    if(w.fox!=null){const f=w.fox;if(!isObj(f)||!Number.isSafeInteger(f.id)||!['x','z','sx','sz'].every(k=>fin(f[k]))||!FOX_STATES.includes(f.state)||!int(f.left,-1,1e6)||!int(f.total,1,1e6))w.fox=null}
    w.wolves=w.wolves.filter(v=>isObj(v)&&Number.isSafeInteger(v.id)&&fin(v.x)&&fin(v.z)&&fin(v.hp)).slice(0,MAX_WOLVES);
    for(const v of w.wolves){
      if(!KINDS[v.kind])v.kind='wolf';const K=KINDS[v.kind];
      if(!WOLF_STATES.includes(v.state))v.state='walk';
      if(!(fin(v.max)&&v.max>0))v.max=Math.max(1,v.hp);
      if(!(fin(v.speed)&&v.speed>0))v.speed=WOLF.speed*K.speed; /* 0이면 영영 못 움직인다 */
      if(!fin(v.sx)||!fin(v.sz)){v.sx=v.x;v.sz=v.z}
      for(const k of ['target','timer','inside','hen'])if(!fin(v[k]))v[k]=0;
      if(K.boss&&!fin(v.roar))v.roar=ROAR.every>>1;
    }
    w.hens=w.hens.filter(h=>isObj(h)&&Number.isSafeInteger(h.id)&&fin(h.x)&&fin(h.z)).slice(0,HENS_MAX);
    for(const h of w.hens){if(!HEN_STATES.includes(h.state))h.state='yard';if(!int(h.slot,0,HENS_MAX-1))h.slot=0;if(!fin(h.calm))h.calm=0}
    const one=new Set();
    w.buildings=w.buildings.filter(b=>{
      if(!isObj(b)||!HP[b.kind]||!Number.isSafeInteger(b.id)||!fin(b.x)||!fin(b.z))return false;
      if(b.kind==='tower'&&!int(b.slot,0,ALL_SLOTS.length-1)||b.kind==='fence'&&!int(b.side,0,5))return false;
      const key=b.kind+(b.kind==='tower'?b.slot:b.kind==='fence'?b.side:'');if(one.has(key))return false;one.add(key);return true}); /* 같은 자리 겹침은 처음 것만 */
    for(const b of w.buildings){
      if(b.kind==='fence'&&!int(b.layer,1,3))b.layer=1;
      if(!(fin(b.max)&&b.max>0))b.max=b.kind==='fence'?FENCE_HP[b.layer-1]:HP[b.kind];
      if(!fin(b.hp))b.hp=b.max;else if(b.hp<0||b.hp>b.max)b.hp=Math.max(0,Math.min(b.max,b.hp));
      if(typeof b.broken!=='boolean')b.broken=b.hp<=0;
      if(b.kind==='tower'){if(!int(b.floor,1,TOWER_UNITS))b.floor=1;if(!int(b.cd,0,1e6))b.cd=0;if(!int(b.stun,0,ROAR.stun))b.stun=0}
    }
    w.arrows=w.arrows.filter(a=>isObj(a)&&Number.isSafeInteger(a.id)&&['fx','fz','tx','tz','t','total','damage','splash','share'].every(k=>fin(a[k])));
    let top=0;for(const list of [w.wolves,w.hens,w.buildings,w.arrows])for(const o of list)top=Math.max(top,o.id);
    if(w.king)top=Math.max(top,w.king.id);if(w.fox)top=Math.max(top,w.fox.id);
    if(!(Number.isSafeInteger(w.nextId)&&w.nextId>top))w.nextId=top+1;
  }

  const api={V:2,TEMPO,tempoInterval,mulOf,KING,FOX,king,kingHit,fox,foxShoo,retreat,peaceOff,TICK,RADIUS,EDGE,SPAWNS,WOLF,AGE,THREAT,PACK,TRICKLE,SLOW,slowEase,KINDS,MIX,BOSS_EVERY,TOWER,POWER,POWER_STEP,FLOOR,ROAR,HP,FENCE_HP,MEND,REBUILD,HEN,DASH,RUSH,MERCY,MERCY_CAP,INNER,SIDE_REACH,INTERVAL,MAX_WOLVES,TRAVEL,GUARD,answered,
    TOWER_SLOTS,RINGS,ALL_SLOTS,SLOT_COUNT,TOWER_UNITS,PLACE,HOMES,HENS_MAX,HOME,towerSlots,fenceLayers,
    intervalFor,create,sync,step,volley,volleyArrows,dashTicks,built,threat,repairAll,brokenCount,brokenKinds,marketDown,wolvesInside,towerUnits,barLeft,secondsLeft,packSize,trickleGap,kindsAt,restore,radius,sectorOf,rand,range,cooldown,damage,towerDamage,towerRange,power,ageOf};
  if(typeof module!=='undefined')module.exports=api;
  else root.World=api;
})(typeof window!=='undefined'?window:globalThis);
