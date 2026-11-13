/* 꼬꼬마을 규칙 모듈(0.6에서 만들고 0.8에서 타워 강화·상식/수학/영어 문제 시간, 0.9에서 항상 열린 상점·알 경제·추천 말풍선,
   0.12에서 경제 개편·회관 자동 승급·종과 늑대 왕 결전·도둑 여우·다회차·저장 v3): 정답 수입 · 상점 · 추천 · 판 진행.
   화면과 무관한 순수 함수만 둔다. 같은 상태를 넣으면 언제나 같은 결과가 나와야 한다(저장·복원·검사용).
   시간 단위는 틱(0.1초). 설계 정본: docs/game-plan.md §4, 화면·3D와의 약속: docs/v09-contract.md */
(function(root){
  'use strict';
  const TICK=.1;
  /* 보통 아이의 읽기 속도 가정(음절/초). 실제 아이 관찰 뒤 이 표만 바꾸면 된다. */
  const SPEED={7:1,8:2,9:3,10:3.8};
  const MIN_SEC={7:10,8:9,9:8,10:8},MAX_SEC=50;
  const SLACK=1.3;         /* 제한시간 = 보통 아이 필요 시간 × 1.3 */
  const FENCE=.05;         /* (0.6 유산, 화면은 쓰지 않음) 울타리 1칸 = 제한시간 +5%, 6칸까지만 센다 */
  const HELP=.2,MAX_HELP=3; /* 시간 초과가 2번 이어지면 도움 1단계(+20%, 최대 3단계). 번개로 맞히면 1단계씩 내려간다 */
  const FAST=.4;           /* 남은 시간이 40% 이상일 때 맞히면 번개 보너스 */
  const FAST_BONUS=.25;    /* 번개 보너스 = 그 정답 금화의 25% */
  const FAST_MIN=.4;       /* 번개는 보통 아이 필요 시간의 40%(글을 읽을 만한 최소 시간)가 지나야 받는다. 마구 누르기로는 못 받는다(0.10: 30%→40%, 찍기 막기와 같은 기준) */
  const BOUNTY=30;          /* 우두머리(불씨 왕)를 쓰러뜨리면 금화 +30 */
  const STREAK={step:.1,max:5}; /* 연속 정답: 한 번에 맞힌 것이 이어질 때마다 금화 +10%(2연속 ×1.1 … 6연속부터 ×1.5). 한 번이라도 틀리면 처음부터 */
  const DASH=.35;          /* 한 번 틀리면 늑대가 제한시간의 35%만큼 성큼 다가온다 */
  const DASH_TICKS=8;      /* 성큼 다가오는 동안(0.8초)은 보기를 누를 수 없다 */
  const MAX_WOLVES=5;      /* (0.6 유산) raid 계산의 늑대 수 상한 */
  /* 읽기 속도(s.pace, 100 = 보통 아이 필요 시간): 한 번에 맞힌 문제의 답한 시간 ÷ 보통 아이 필요 시간(%)을 lo~hi로 잘라 ema만큼 섞는다.
     settle(…,'first',{ticks})가 바꾸고, world.js가 천천히 읽는 아이(100 넘음)에게 늑대를 덜 보낸다(보이지 않는 완충). 찍는 아이는 빨라서 100 아래 → 완충 없음 */
  const PACE={lo:50,hi:300,ema:.25,first:3,firstEma:.5};
  /* 0.10: 틀린 문제도 첫 고르기까지 걸린 시간으로 읽기 속도를 갱신하고(전에는 한 번에 맞힌 문제만이라 첫 정답 전 완충 0), 처음 first번은 firstEma로 빨리 따라간다 */
  /* 찍기 막기(0.10, 8세 점검: 읽기 모드에서 보기가 열리자마자 찍어도 금화를 그대로 받음): 한 번에 맞힌 금화 × clamp(floor, 1, 답한 시간 ÷ (필요 시간 × FAST_MIN)).
     번개를 받을 수 있는 순간(필요 시간의 40%)부터는 언제나 1이라 보통·빠른 아이는 깎이지 않는다. 그보다 빨리 누르면 최소 floor(75%) */
  const GUARD={floor:.75};

  /* ---------- 0.12 손잡이(프로듀서 결정 A~F의 추천 기본값. 답이 바뀌면 여기만 고친다. 설계: ending-and-progression-v2.md §5, game-plan §11) ----------
     FLAGS는 Combat.FLAGS로 내보내고 함수들은 부를 때마다 읽는다(검사·시뮬이 값을 바꿔 볼 수 있다). */
  const FLAGS={
    GOLD_SCALE:'flat',        /* 정답 금화의 긴 글 배수: 'flat' = 모든 문제 같은 금액(긴 글은 동전·화살 수만 많게) · 'sqrt' · 'length'(0.11까지) */
    COIN_SCALE:true,          /* 동전 수 연출에는 긴 글 배수를 쓴다(금액과 무관) */
    HALL_MODE:'auto',         /* 결정 C: 'auto' = 회관을 뺀 지은 수가 HALL_AUTO에 이르면 저절로 승급 · 'buy' = 예전처럼 사기(ITEMS.hall.prices) */
    HALL_AUTO:[10,32,54],
    HALL_AUTO_BY_AGE:null,    /* 결정 B ②를 고르면 {9:[8,26,44],10:[8,26,44]} */
    START_TOWERS:2,           /* 새 판은 타워 2개로 시작(level 1, 지은 수에 1로 센다) */
    BELL_BUILT:66,            /* 결정 A·B: 이번 판에 지은 수(회관 포함, 시작 꾸러미 제외)가 이만큼이면 종이 열린다(래치) */
    BELL_BUILT_BY_AGE:null,   /* 결정 B ②를 고르면 {9:54,10:54} */
    BELL_WINS_CAP:null,       /* 켜면(예: 100) 지은 수 또는 이번 판 한 번에 맞힌 수 중 먼저 */
    BELL_PROMPTS:3,           /* 종 권유 말풍선 횟수. 그 뒤에는 반짝임만 */
    BELL_COUNTS_PACK:false,   /* true면 시작 꾸러미도 종 문턱에 센다(판이 약 10% 짧아짐) */
    FEAST_AFTER_END:true,     /* 잔치는 엔딩 뒤 자유 놀이에서만 */
    FEAST_MAX:20,             /* 잔치 숨은 상한 */
    STAR_NEW:5,               /* 별 3(새 글): 이번 판에 처음으로 한 번에 맞힌 문항 수. 문항 확충 뒤 10 */
    FREE_PLAY_WOLVES:false    /* 엔딩 뒤 '이 마을에서 더 놀기'에 늑대가 오는가(false = 늑대 없는 잔치 마을) */
  };
  /* 결전: 별 방패 shields개, 문제는 이번 판에 맞힌 것 ok + 틀린 것 review, 최근 recent문제는 뺀다.
     8세부터 두 번 틀리면 왕이 한 걸음(최대 steps), noStepAge 이하는 다가오지 않음(결정 E). 지는 경우는 없다 */
  const FINALE={shields:6,ok:4,review:2,steps:3,noStepAge:7,recent:10};
  /* 도둑 여우: 이번 판 지은 수 at에 한 마리씩(회관 needHall 뒤), 닭까지 오는 시간 = 문제 기본 시간 × max(1, pace/100) × f,
     second = 두 번째 정답도 구출 인정, scareOnlyAge 이하는 놀래키기만(결정 E). on:false면 여우가 나오지 않는다 */
  const FOX={on:true,at:[20,40,55],needHall:1,f:1.3,second:true,scareOnlyAge:7};
  /* 예전 저장(version 1) 이행(결정 F): 금화 × goldRate(5 단위, 최소 goldMin), 잔치는 feastMax까지 */
  const MIGRATE={goldRate:.25,goldMin:20,feastMax:10};
  /* 다회차(결정 D): 도장 1개마다 타워·닭 1씩 덤(최대 max개). 늑대 세기 %(정수): 지난 판 첫 정답률 raiseAcc 이상이고 잃은 닭 raiseLostMax 이하면 +step, 잃은 닭 lowerLost 이상이면 −step */
  const START_PACK={perStamp:{towers:1,hens:1},max:3};
  const WOLF_MUL={step:5,max:120,min:95,raiseAcc:80,raiseLostMax:3,lowerLost:5};
  const VILLAGES=['meadow','quarry','frost','ember'],VILLAGE_NAME={meadow:'초원',quarry:'채석장',frost:'서리 과수원',ember:'불씨 숲'};
  const villageOf=no=>VILLAGES[(Math.max(1,no|0)-1)%VILLAGES.length];
  const CAPS={ok:400,miss:200,stamps:50,villages:20,acc:5,seenOk:2000};
  const FEAST={first:150,step:40};

  /* ---------- 알 경제 (game-plan §4.4) ----------
     한 번에 맞힌 금화 = (기본 + 판 알 × 알값 + 물고기) × 금화 배수(0.12: 1, FLAGS.GOLD_SCALE) × 연속 배수 (+ 번개)
     낳은 알 = 닭 수(숨은 닭 제외), 판 알 = min(둥지 알 + 낳은 알, 바구니 × (1 + 농부)), 남은 알 = min(닭 수, 둥지 알 + 낳은 알 − 판 알)
     알값 = egg + hall × 회관 단계(매대 4 · 가게 5 · 천막 시장 6 · 큰 시장 7), 매대가 부서져 있으면 절반(내림, 최소 1) */
  /* 값은 scripts/sim-village.cjs로 맞춤(2026-11-12): 알값 2 · 3 · 4 · 5(매대 → 큰 시장), 기본 9. 알값을 올리면 복리가 커져 느린 아이가 뒤처지고, 기본금을 올리면 찍는 아이가 따라온다 */
  const PAY={base:9,egg:2,hall:1,basket:4,fish:6,feast:5};
  /* 고치기 값 = base + per × 부서진 건물 수(0.8과 같음) */
  const REPAIR={base:10,per:11};

  /* ---------- 상점 (game-plan §4.3) ----------
     가격 곡선: 첫 값 × 배율^(산 횟수), 5골드 단위로 반올림(아이가 읽기 쉬운 값), 언제나 앞보다 비싸게. 숨은 상한 = prices.length
     배율을 기획 초안(1.15~1.22)보다 가파르게 했다: 끝값이 비싸야 보통 아이 40분에 60~70개(81개 다가 아님)이고, 느린 아이와의 차이가 줄어든다(시뮬레이터) */
  const curve=(first,grow,n)=>{const out=[];for(let i=0;i<n;i++){let v=Math.round(first*Math.pow(grow,i)/5)*5;if(out.length&&v<=out[out.length-1])v=out[out.length-1]+5;out.push(v)}return out};
  /* 0.12 가격 납작하게(설계 v2 §5.1): 끝 가격 350 이하. 다 사는 값이 0.11의 약 4분의 1 */
  const CURVE={tower:[30,1.085],fence:[15,1.09],chicken:[25,1.09],farmer:[60,1.10],power4:[260,1.05]};
  /* 상품. slot은 0.8 카드 칸(0 지켜요 · 1 벌어요 · 2 마을, 화면 분류용), need = 필요한 회관 단계, base = 처음부터 있는 수(닭 1마리) */
  const ITEMS={
    tower:{slot:0,key:'level',name:'타워',note:'화살 타워 +1',prices:curve(CURVE.tower[0],CURVE.tower[1],19)},
    power:{slot:0,key:'power',name:'타워 강화',note:'펑! 터지는 화살',prices:[90,160,240].concat(curve(CURVE.power4[0],CURVE.power4[1],7)),need:1},
    fence:{slot:0,key:'fence',name:'울타리',note:'마을 한 면을 막아요',prices:curve(CURVE.fence[0],CURVE.fence[1],18)},
    chicken:{slot:1,key:'chickens',name:'닭',note:'정답마다 알 +1개',prices:curve(CURVE.chicken[0],CURVE.chicken[1],19),base:1},
    farmer:{slot:1,key:'farmers',name:'농부',note:'알을 4개 더 날라요',prices:curve(CURVE.farmer[0],CURVE.farmer[1],9)},
    pond:{slot:1,key:'pond',name:'연못',note:'정답마다 물고기 +6골드',prices:[120,200,300],need:2},
    hall:{slot:2,key:'hall',name:'회관 키우기',note:'마을이 커져요',prices:[120,320,650]},
    feast:{slot:2,key:'feast',name:'마을 잔치',note:'정답마다 +5골드',need:3},
    repair:{slot:0,key:'repairs',name:'고치기',note:'부서진 건물을 모두 고쳐요'}
  };
  /* 상점 띠 2줄 × 4칸(위치 고정). 8번째 칸: 회관(자동 승급이면 살 수 없는 그림 칸) → 종이 열리면 종(값 없음) → 엔딩 뒤 자유 놀이에서는 잔치 */
  const SHOP=['repair','tower','power','fence','chicken','farmer','pond','hall'];
  const ORDER=['tower','fence','power','chicken','farmer','pond','hall','feast'];/* (0.8 카드 순서, offers 전용) */
  const NUMS=['gold','level','fence','chickens','hidden','farmers','pond','hall','feast','wins','misses','index','help','late','repairs','broken','power','streak','nest','marketDown','pace','paced','seed'];
  /* 타워 강화 단계별 설명(지금 단계 → 다음 단계). 1~3단계 펑·큰 펑·세 갈래, 4~10단계 화살 피해 +1 */
  const POWER_NOTE=['펑! 터져서 둘레도 맞아요','더 크게 펑!','한 번에 세 마리!'].concat(Array(7).fill('화살이 더 세져요!'));
  /* 상식·수학·영어 문제: 생각하는 시간(초, 수학은 계산 시간 포함) */
  const THINK={common:{7:2,8:2,9:2.5,10:3},math:{7:3,8:4,9:4.5,10:5},english:{7:2,8:2,9:2.5,10:3}};

  const syl=s=>{let n=0;for(const ch of String(s||''))if(ch>='가'&&ch<='힣')n++;return n};
  const clamp=(lo,hi,v)=>Math.min(hi,Math.max(lo,v));

  /* 이번 판 진행(run)과 판을 넘어 남는 것(meta). 저장 v3 사양: 설계 v2 §6
     run.bell: 0 닫힘 · 1 열림(늑대 왕이 기다림, 래치) · 2 결전 중 · 3 물리침(엔딩 카드) · 4 엔딩 뒤 자유 놀이
     run.ok·miss·fpick은 문제 번호(index) 목록이다(문항은 Questions.at(나이, 모드, 번호, 씨앗)으로 다시 얻는다). fpick의 −1 = 평소 순서의 다음 문제 */
  const freshRun=()=>({no:1,village:VILLAGES[0],built0:0,pack:{towers:0,hens:0},wolfMul:100,bell:0,bellQ:-1,prompts:0,shields:0,fq:0,fpick:[],steps:0,
    fox:0,foxSaved:0,foxLost:0,ok:[],miss:[],asked:0,first:0,lost:0,newOk:0,t0:0});
  const freshMeta=()=>({stamps:[],villages:[],acc:[],seenOk:[],from:0});
  function fresh(age){return {gold:20,level:Math.max(0,(FLAGS.START_TOWERS|0)-1),fence:0,chickens:1,hidden:0,farmers:0,pond:0,hall:0,feast:0,wins:0,misses:0,index:0,help:0,late:0,repairs:0,broken:0,power:0,streak:0,nest:0,marketDown:0,pace:100,paced:0,seed:0,mode:'story',age:age||8,round:null,run:freshRun(),meta:freshMeta()}}
  const runOf=s=>s.run||(s.run=freshRun()),metaOf=s=>s.meta||(s.meta=freshMeta());
  /* 숨은 상한(산 횟수). 아이에게 보이지 않는다. 타워 1+19=20 · 닭 1+19=20 · 농부 1+9=10 · 잔치 FEAST_MAX */
  const max=key=>key==='feast'?FLAGS.FEAST_MAX:key==='repair'?Infinity:ITEMS[key]?ITEMS[key].prices.length:0;
  const HENS_MAX=1+ITEMS.chicken.prices.length,TOWERS_MAX=1+ITEMS.tower.prices.length,FARMERS_MAX=1+ITEMS.farmer.prices.length;
  /* 그 상품을 지금까지 산 횟수(닭은 처음 1마리를 빼고, 물려 가면 줄어든다) */
  const count=(s,key)=>{const it=ITEMS[key];if(!it)return 0;return Math.max(0,(s[it.key]|0)-(it.base||0))};

  /* 보통 아이가 읽고 고르는 데 드는 시간(초, 가정). 지문 + 질문(8세부터) + 보기를 읽고, 9세부터는 지문을 한 번 더 훑는 시간을 더한다.
     (0.11: 듣고 고르기 모드는 폐쇄. 문항은 읽기(story)와 상식·수학·영어(quiz)뿐이다) */
  /* 보기 읽는 양: 한글 음절 + 숫자·영문 글자 3개당 1 */
  const units=s=>syl(s)+(String(s||'').match(/[0-9A-Za-z]/g)||[]).length/3;
  function needSeconds(q){
    const age=SPEED[q.age]?q.age:8,r=SPEED[age],n=q.choices.length,choices=q.choices.reduce((a,c)=>a+syl(c),0);
    /* 상식·수학·영어: 질문과 그림·식을 읽고, 생각하고, 보기를 읽는다 */
    if(q.mode==='quiz'){const t=THINK[q.cat]||THINK.common;return 1.5+(syl(q.prompt)+units(q.passage))/r+q.choices.reduce((a,c)=>a+units(c),0)/r+.4*n+(t[age]||2)}
    const p=syl(q.passage);
    return 1.5+(p+(age>=8?syl(q.prompt):0)+choices)/r+.4*n+(age>=9?.3*p/r:0);
  }
  /* 기본 제한시간(초) = 필요 시간 × 1.3, 나이별 최저(7세 10 · 8세 9 · 9·10세 8초)와 최고 50초 사이 */
  function baseSeconds(q){const age=SPEED[q.age]?q.age:8;return clamp(MIN_SEC[age],MAX_SEC,Math.ceil(SLACK*needSeconds(q)))}
  const limit=(q,s)=>Math.round(baseSeconds(q)*(1+FENCE*Math.min(6,s&&s.fence||0)+HELP*(s&&s.help||0))/TICK);
  /* 보기가 나타나기까지의 틱. 8세 이상 읽기 문제는 '글 먼저 읽기': 빠른 아이(보통의 1.5배)가 지문을 읽는 시간만큼 보기를 숨긴다.
     그 밖에는 0.3초(앞 화면에서 이어진 두 번 누르기 방지). 이 동안에도 시계는 흐른다. */
  function reveal(q){
    const age=SPEED[q.age]?q.age:8;
    if(q.mode!=='story'||age<8)return 3; /* 상식·수학·영어 문제와 7세 낱말은 바로 보인다 */
    return Math.max(3,Math.round(syl(q.passage)/(1.5*SPEED[age])/TICK));
  }
  /* 놓친 뒤(두 번째에 맞혔거나 두 번 틀림) 초록 정답을 누를 수 있기까지 기다리는 틱. 읽어 주는 음성은 없다(0.11).
     아이가 다시 볼 글의 양 ÷ 4음절/초: 8세 이하 읽기는 지문·질문·정답, 9세 이상 읽기는 질문·정답만(짧게), 상식·수학·영어는 질문·지문·정답. 1.5~8초 */
  const LEARN={min:15,max:80,rate:4};
  function learnTicks(q){
    const answer=q.choices[q.answer],text=q.mode==='quiz'?q.prompt+' '+q.passage+' '+answer:q.age>=9?q.prompt+' '+answer:q.passage+' '+(q.age>=8?q.prompt+' ':'')+answer;
    return clamp(LEARN.min,LEARN.max,Math.ceil(units(text)/LEARN.rate/TICK));
  }
  /* 긴 글 배수(1~5). 0.12부터 금화에는 곱하지 않고(GOLD_SCALE 'flat': 엔딩까지 문제 수가 나이와 무관하게 비슷해짐) 일제 사격 화살 수와 동전 수 연출에만 쓴다. */
  const scale=q=>Math.max(1,baseSeconds(q)/10);
  const goldScale=q=>FLAGS.GOLD_SCALE==='length'?scale(q):FLAGS.GOLD_SCALE==='sqrt'?Math.sqrt(scale(q)):1;
  /* 번개(빨리 맞힘): 풀이 시작부터 ticks틱 만에 맞혔을 때, 기본 시간의 60% 안이면서 최소 읽기 시간은 지났는지 */
  const isFast=(q,ticks)=>ticks<=(1-FAST)*baseSeconds(q)/TICK+1e-6&&ticks>=FAST_MIN*needSeconds(q)/TICK-1e-6;
  /* (0.8 유산, 0.9 화면은 쓰지 않음) 한 번에 맞혔을 때 고를 수 있던 카드 수 */
  const picks=q=>Math.min(3,Math.max(1,Math.round(scale(q))));

  /* 지은 것(고치기·잔치 제외, 닭은 처음 1마리 제외) */
  function built(s){return (s.level|0)+(s.fence|0)+Math.max(0,(s.chickens|0)-1)+(s.farmers|0)+(s.pond|0)+(s.hall|0)+(s.power|0)}
  /* 이번 판에 새로 지은 수(시작 꾸러미 제외). 종·여우의 기준 */
  const builtNew=s=>built(s)-(FLAGS.BELL_COUNTS_PACK?0:runOf(s).built0|0);
  /* 회관 자동 승급(결정 C): 회관을 뺀 지은 수가 HALL_AUTO[h]에 이르면 h+1단계. 내려가지 않는다 */
  const hallSteps=s=>FLAGS.HALL_AUTO_BY_AGE&&FLAGS.HALL_AUTO_BY_AGE[s.age]||FLAGS.HALL_AUTO;
  function autoHall(s){if(FLAGS.HALL_MODE!=='auto')return s.hall|0;const b=built(s)-(s.hall|0),A=hallSteps(s);let h=0;while(h<3&&b>=A[h])h++;return Math.max(s.hall|0,h)}
  const bellBuilt=s=>FLAGS.BELL_BUILT_BY_AGE&&FLAGS.BELL_BUILT_BY_AGE[s.age]||FLAGS.BELL_BUILT;
  const bellDue=s=>runOf(s).bell===0&&(builtNew(s)>=bellBuilt(s)||!!FLAGS.BELL_WINS_CAP&&runOf(s).first>=FLAGS.BELL_WINS_CAP);
  /* 지은 수가 바뀐 뒤의 진행 갱신(buy·settle·restore가 부른다): 회관 자동 승급 + 종 래치. → {hall: 오른 단계 수, bell: 방금 열렸는가}
     종은 한 번 열리면(run.bell ≥ 1) 닭을 잃어 지은 수가 내려가도 닫히지 않는다 */
  function grow(s){const h=autoHall(s),up=h-(s.hall|0);s.hall=h;let bell=false;if(bellDue(s)){const r=runOf(s);r.bell=1;r.bellQ=s.index|0;bell=true}return {hall:up,bell}}
  /* (0.6 유산) 문제 하나 단위 늑대 수: 5개 지을 때마다 1마리, 최대 5마리. 늑대 세계는 world.js가 맡는다 */
  const wolves=s=>Math.min(MAX_WOLVES,1+Math.floor(built(s)/5));

  /* 한 번에 맞혔을 때 받는 금화와 알의 흐름. fast = 번개.
     eggs·value는 0.8 화면과의 호환 이름(eggs = sold, value = eggValue) */
  const combo=n=>1+STREAK.step*Math.min(STREAK.max,Math.max(0,(n|0)-1));
  const basket=s=>PAY.basket*(1+(s.farmers|0));
  const eggPrice=s=>{const full=PAY.egg+PAY.hall*clamp(0,3,s.hall|0);return s.marketDown?Math.max(1,Math.floor(full/2)):full};
  /* 찍기 막기 배수(ticks = 풀이 시작부터 맞힐 때까지 틱, 없으면 1) */
  const guard=(q,ticks)=>Number.isFinite(ticks)&&ticks>=0?clamp(GUARD.floor,1,(ticks+1e-6)*TICK/(needSeconds(q)*FAST_MIN)):1;
  function income(s,q,fast,ticks){
    const hens=Math.max(0,s.chickens|0),laid=Math.max(0,hens-(s.hidden|0)),nest=Math.max(0,s.nest|0),cap=basket(s);
    const sold=Math.min(nest+laid,cap),left=Math.min(hens,nest+laid-sold),eggValue=eggPrice(s);
    const fish=PAY.fish*(s.pond|0),base=PAY.base+PAY.feast*(s.feast|0),m=goldScale(q),streak=(s.streak|0)+1,c=combo(streak),g=guard(q,ticks);
    const plain=Math.round((base+sold*eggValue+fish)*m*c*g),bonus=fast?Math.ceil(plain*FAST_BONUS):0;
    return {laid,sold,left,eggValue,fish,base,m,coin:FLAGS.COIN_SCALE?scale(q):1,streak,combo:c,guard:g,plain,bonus,gold:plain+bonus,basket:cap,eggs:sold,value:eggValue};
  }
  /* 읽기 속도 갱신: 그 문제의 첫 고르기까지 걸린 틱 ÷ 보통 아이 필요 시간(%) */
  function trackPace(s,q,ticks){
    if(!Number.isFinite(ticks)||ticks<0)return;
    const r=clamp(PACE.lo,PACE.hi,Math.round(100*ticks*TICK/needSeconds(q))),p=Number.isFinite(s.pace)?s.pace:100,n=s.paced|0;
    s.pace=Math.round(p+(r-p)*(n<PACE.first?PACE.firstEma:PACE.ema));s.paced=n+1;
  }
  /* (0.6 유산) 늑대가 마을에 닿았을 때: 타워가 level마리를 쏘고, 나머지가 닭을 놀래켜 숨게 한다. */
  function raid(s){
    const w=wolves(s),shot=Math.min(w,s.level),through=w-shot,scared=Math.min(through,Math.max(0,s.chickens-s.hidden));
    return {wolves:w,shot,through,scared};
  }

  /* 한 문제의 결말을 상태에 반영한다. result: 'first'(한 번에 정답) | 'second'(두 번째에 정답) | 'miss'(늑대가 마을에 닿음)
     first만 금화를 주고 둥지의 알을 바꾼다(남은 알 = left). second는 금화 없음. miss는 (0.6 유산) 닭이 놀라 숨는다.
     opt.fast = 번개, opt.ticks = 문제 시작부터 맞힐 때까지 틱(있으면 읽기 속도 s.pace를 갱신), opt.finale = 결전 문제(판 기록 목록에 넣지 않음)
     화면의 '두 번 틀림'은 settle 대신 track(s,q,'miss')만 부른다(0.6 유산인 닭 숨기를 쓰지 않으므로) */
  /* 이번 판 기록: 푼 문제 수·한 번에 맞힌 수, 결전에 쓸 문제 번호 목록(결전 문제 자체는 넣지 않는다), 처음으로 한 번에 맞힌 문항(q.id, 별 3) */
  const pushCap=(list,v,cap)=>{if(!list.includes(v)){list.push(v);if(list.length>cap)list.splice(0,list.length-cap)}};
  function track(s,q,result,opt){
    const r=runOf(s),m=metaOf(s),fin=!!(opt&&opt.finale);r.asked++;
    if(result==='first'){r.first++;if(!fin)pushCap(r.ok,s.index|0,CAPS.ok);
      if(q&&typeof q.id==='string'&&!m.seenOk.includes(q.id)){m.seenOk.push(q.id);r.newOk++;if(m.seenOk.length>CAPS.seenOk)m.seenOk.splice(0,m.seenOk.length-CAPS.seenOk)}}
    else if(!fin)pushCap(r.miss,s.index|0,CAPS.miss);
  }
  function settle(s,q,result,opt){
    const o=opt||{};
    track(s,q,result,o);
    if(result==='first'){
      const inc=income(s,q,!!o.fast,o.ticks),back=s.hidden>0?1:0;
      s.gold+=inc.gold;s.wins++;s.streak=inc.streak;s.hidden-=back;s.late=0;s.nest=inc.left;if(o.fast)s.help=Math.max(0,s.help-1);
      trackPace(s,q,o.ticks);
      if(FLAGS.BELL_WINS_CAP)grow(s);
      return Object.assign({result,back},inc);
    }
    s.streak=0;
    if(result==='second'){s.late=0;return {result}}
    const r=raid(s);s.hidden+=r.scared;s.misses++;
    if(o.timeout){s.late++;if(s.late>=2){s.help=Math.min(MAX_HELP,s.help+1);s.late=0}}else s.late=0;
    return Object.assign({result:'miss'},r);
  }

  function price(s,key){
    const it=ITEMS[key];if(!it)return Infinity;
    if(key==='feast')return FEAST.first+FEAST.step*(s.feast|0);
    if(key==='repair')return REPAIR.base+REPAIR.per*Math.max(1,s.broken|0);
    const i=count(s,key);return i<it.prices.length?it.prices[i]:Infinity;
  }
  /* 지금 살 수 있는 상품인가(금화와 무관): 고치기는 부서진 건물이 있을 때, 나머지는 회관 단계가 되고 숨은 상한 전 */
  /* 회관은 자동 승급이면 살 수 없다. 잔치는 FEAST_AFTER_END면 엔딩 뒤 자유 놀이(run.bell 4)에서만 */
  const feastOpen=s=>FLAGS.FEAST_AFTER_END?runOf(s).bell===4:true;
  const open=(s,key)=>key==='repair'?(s.broken|0)>0:key==='hall'&&FLAGS.HALL_MODE==='auto'?false:key==='feast'&&!feastOpen(s)?false:!!ITEMS[key]&&(ITEMS[key].need||0)<=(s.hall|0)&&count(s,key)<max(key);
  const canBuy=(s,key)=>open(s,key)&&s.gold>=price(s,key);
  /* 사면 진행도 갱신한다(grow: 회관 자동 승급·종 래치). 화면은 사기 전후의 s.hall·s.run.bell을 견주어 연출한다 */
  function buy(s,key){
    if(!canBuy(s,key))return 0;
    const p=price(s,key);s.gold-=p;s[ITEMS[key].key]=(s[ITEMS[key].key]|0)+1;grow(s);return p;
  }
  /* 지금 상점 8칸의 키. 8번째 칸: 종이 열려 있으면(run.bell 1~3) 'bell', 엔딩 뒤 자유 놀이(4)는 'feast',
     그 밖에는 'hall'(사기 방식이고 다 키웠고 잔치가 엔딩 전에도 열리는 설정이면 'feast') */
  const shopKeys=s=>{const b=runOf(s).bell;return SHOP.map(k=>k!=='hall'?k:b>=1&&b<=3?'bell':b===4?'feast':(s.hall|0)>=max('hall')&&feastOpen(s)&&FLAGS.HALL_MODE!=='auto'?'feast':'hall')};
  /* 상점 띠: 8칸 {key, state, price, need}. state = buy(살 수 있음) · poor(금화 부족) · locked(회관 단계 부족, need) · none(고칠 곳 없음) · max(숨은 상한, price 0)
     0.12: auto(회관 그림 칸: 저절로 자람, 살 수 없음) · 종 칸 key 'bell': buy(값 0, 누르면 결전) · fight(결전 중) · done(늑대 왕을 물리침) */
  function shop(s){
    return shopKeys(s).map(key=>{
      if(key==='bell'){const b=runOf(s).bell;return {key,state:b===1?'buy':b===2?'fight':'done',price:0,need:0}}
      if(key==='hall'&&FLAGS.HALL_MODE==='auto')return {key,state:'auto',price:0,need:0};
      const it=ITEMS[key],need=it.need||0,p=price(s,key);let state;
      if(key==='repair')state=(s.broken|0)>0?(s.gold>=p?'buy':'poor'):'none';
      else if(need>(s.hall|0))state='locked';
      else if(count(s,key)>=max(key))state='max';
      else state=s.gold>=p?'buy':'poor';
      return {key,state,price:Number.isFinite(p)?p:0,need};
    });
  }

  /* ---------- 추천 말풍선 (game-plan §4.5) ----------
     recommend(s, ctx) → {key, line, urgent, rule} 또는 null. 순수 함수(빈도 제한·띄우는 때는 화면 몫).
     ctx = {wolvesInside, towers, lostHenRecently, brokenKinds:[...], opened:[...]}
       wolvesInside: 마을 안 늑대 수 · towers: 타워 수(없으면 1 + level) · lostHenRecently: 30초 안에 닭을 잃음
       brokenKinds: 부서진 진짜 건물 종류(coop·market·tower·nursery·barn) · opened: 이미 '새 상품' 말풍선(rule 4)을 띄운 key 목록
     규칙 순서: 1 고치기 → 2 위험(타워, 못 사면 울타리) → 3 닭 0~1 → 4 회관으로 열린 새 상품(1회) → 5 회관 → 6 둥지에 알이 남음(농부)
               → 보너스(회관 목표: 회관 값의 70%를 모았거나 이 단계에서 지은 것이 REC.hallGoal에 이름 → 모으자는 말, 살 수 없는 key 'hall', urgent false, rule 0)
               → 7 닭 < 6 또는 닭 < 타워 × 2 → 8 덜 산 쪽(지켜요/벌어요)
     보너스를 7·8보다 앞에 둔 까닭: 7·8번이 금화를 생기는 대로 써 버리면 회관 값이 영영 모이지 않는다(시뮬레이터: 보통 아이 10분에 회관 0).
     지은 것 목표는 회관 단계를 '마을이 그만큼 자랐을 때'에 오게 한다. 위험·고치기·농부는 모으는 중에도 먼저 추천한다. */
  const LINES={
    repairCoop:'회관을 고쳐야 할 것 같아요!',repairTower:'타워가 부서졌어요. 고쳐 줄래요?',repairMarket:'매대가 부서지면 알을 반값에 팔아요!',
    repairNursery:'작은 닭장이 부서졌어요. 고쳐 줄래요?',repairBarn:'헛간이 부서졌어요. 고쳐 줄래요?',repair:'부서진 건물을 고쳐 줄래요?',
    lostHen:'꼬꼬를 지키려면 타워가 더 필요해요!',manyWolves:'늑대가 너무 많아요! 타워를 세워요!',
    fenceGap:'이쪽이 뻥 뚫렸어요. 울타리를 쳐요!',fenceThick:'울타리를 더 두껍게 쌓아요!',
    noHen:'꼬꼬가 한 마리도 없어요. 꼬꼬를 데려와요!',moreHens:'닭이 많으면 알을 많이 낳아서 골드를 빨리 모을 수 있어요!',
    openPower:'펑! 터지는 화살을 쓸 수 있어요!',openPond:'연못을 파면 물고기도 팔 수 있어요!',openFeast:'마을 잔치를 열면 금화가 더 생겨요!',
    hall:'회관을 키우면 마을이 더 커져요!',hallSoon:'조금만 더 모으면 회관을 키울 수 있어요!',hallSave:'금화를 모아서 회관을 키워 봐요!',
    farmer:'알이 남았어요! 농부가 더 있으면 다 팔 수 있어요.',
    tower:'타워가 많으면 늑대를 빨리 쓰러뜨려요!',power:'타워를 강화하면 화살이 더 세져요!',pond:'연못을 파면 물고기도 팔 수 있어요!',feast:'마을 잔치를 열면 금화가 더 생겨요!',
    boar:'멧돼지는 건물로 돌진해요. 타워가 막아 줘요!',
    bell1:'늑대 왕이 왔어요! 준비되면 종을 울려요.',bell2:'종을 울리면 황금 화살이 날아가요!',bell3:'언제든 종을 누르면 늑대 왕과 겨뤄요.'
  };
  const REPAIR_LINE=[['coop','repairCoop'],['market','repairMarket'],['tower','repairTower'],['nursery','repairNursery'],['barn','repairBarn']];
  const OPENED=['power','pond','feast'];          /* 회관 단계로 열리는 상품(필요 단계 순) */
  const DEFEND=['tower','power','fence'],EARN=['chicken','farmer','pond'];
  /* 추천 손잡이: hallSoon = 회관 값의 이 비율을 모으면 '조금만 더 모으자', hallGoal[회관 단계] = 지은 것(built)이 이만큼이면 회관을 위해 모으자 */
  const REC={hallSoon:.7,hallGoal:[12,35,40]};
  function recommend(s,ctx){
    const c=ctx||{},ok=k=>canBuy(s,k),hens=s.chickens|0,towers=Number.isFinite(c.towers)?c.towers:1+(s.level|0);
    const say=(key,line,rule,urgent)=>({key,line:LINES[line],urgent:!!urgent,rule});
    /* 1 진짜 건물이 부서짐. 단, 닭이 0~1마리이고 부서진 것이 닭장·매대가 아니면 닭을 먼저(0.10, 10세 점검: 첫 금화가 고치기로 나가 닭 0마리가 몇 분씩 이어짐) */
    const kinds=Array.isArray(c.brokenKinds)?c.brokenKinds:[];
    if(ok('repair')&&!(hens<=1&&ok('chicken')&&!kinds.includes('coop')&&!kinds.includes('market'))){const hit=REPAIR_LINE.find(([k])=>kinds.includes(k));return say('repair',hit?hit[1]:'repair',1,true)}
    /* 2 방금 닭을 물려 감, 또는 마을 안 늑대 ≥ 타워 수 × 3 */
    const inside=Math.max(0,Number(c.wolvesInside)||0),lost=!!c.lostHenRecently;
    if(lost||inside>0&&inside>=towers*3){
      if(ok('tower'))return say('tower',lost?'lostHen':'manyWolves',2,true);
      if(ok('fence'))return say('fence',(s.fence|0)<6?'fenceGap':'fenceThick',2,true);
    }
    /* 3 닭 0~1마리 */
    if(hens<=1&&ok('chicken'))return say('chicken',hens===0?'noHen':'moreHens',3);
    /* 9 종 권유(0.12): 종이 열려 있고 아직 BELL_PROMPTS번을 안 했으면. 화면이 띄울 때 bellPrompted로 횟수를 올리고,
       앞 권유 뒤 60초가 안 됐으면 ctx.bellQuiet로 막는다. 사는 칸이 아니라 누르는 칸(값 없음) */
    {const r=runOf(s);if(r.bell===1&&r.prompts<FLAGS.BELL_PROMPTS&&!c.bellQuiet)return say('bell','bell'+(r.prompts+1),9)}
    /* 4 회관 단계로 새 상품이 열림(아직 안 산 것, 말풍선은 한 번) */
    const shown=Array.isArray(c.opened)?c.opened:[];
    for(const k of OPENED)if(count(s,k)===0&&!shown.includes(k)&&ok(k))return say(k,'open'+k[0].toUpperCase()+k.slice(1),4);
    /* 5 회관 값만큼 있음 */
    if(ok('hall'))return say('hall','hall',5);
    /* 6 둥지에 알이 남음 */
    if((s.nest|0)>0&&ok('farmer'))return say('farmer','farmer',6);
    /* 보너스(회관 목표): 회관 값의 70% 이상 모음, 또는 이 단계에서 충분히 지음 → 회관을 위해 모으자(살 수 없는 key, urgent 아님) */
    const H=s.hall|0;
    if(H<max('hall')&&FLAGS.HALL_MODE!=='auto'){if(s.gold>=REC.hallSoon*price(s,'hall'))return say('hall','hallSoon',0);if(built(s)>=REC.hallGoal[H])return say('hall','hallSave',0)}
    /* 7 닭 < 6, 또는 닭 < 타워 × 2 */
    if((hens<6||hens<towers*2)&&ok('chicken'))return say('chicken','moreHens',7);
    /* 8 덜 산 쪽(지켜요 = 타워·강화·울타리 / 벌어요 = 닭·농부·연못)에서 살 수 있는 가장 싼 것, 없으면 다른 쪽, 그다음 잔치.
       농부는 닭이 바구니보다 많을 때만(남는 바구니는 쓸모가 없다) */
    const defend=(s.level|0)+(s.power|0)+(s.fence|0),earn=Math.max(0,hens-1)+(s.farmers|0)+(s.pond|0);
    const useful=k=>k!=='farmer'||hens>basket(s);
    for(const side of defend<=earn?[DEFEND,EARN,['feast']]:[EARN,DEFEND,['feast']]){
      let best=null;for(const k of side)if(useful(k)&&ok(k)&&(!best||price(s,k)<price(s,best)))best=k;
      if(best)return say(best,best==='chicken'?'moreHens':best==='fence'?((s.fence|0)<6?'fenceGap':'fenceThick'):best==='farmer'?'farmer':best,8);
    }
    return null;
  }

  /* ---------- 종 · 늑대 왕 결전 · 엔딩 · 다음 마을 (0.12, 설계 v2 §3·§4) ----------
     모두 순수 함수다(난수·시각은 opt로 받는다). 화면(index.html)과 시뮬(scripts/sim-village.cjs)이 같은 함수를 쓴다. */
  const isObj=o=>!!o&&typeof o==='object'&&!Array.isArray(o);
  const intIn=(x,lo,hi,d)=>Number.isSafeInteger(x)&&x>=lo&&x<=hi?x:d;
  /* 닭을 잃음(늑대·여우): 닭 수와 이번 판 기록 */
  function lostHen(s){s.chickens=Math.max(0,(s.chickens|0)-1);runOf(s).lost++;return s.chickens}
  /* 종 권유 말풍선을 띄웠음 */
  function bellPrompted(s){const r=runOf(s);if(r.bell===1&&r.prompts<FLAGS.BELL_PROMPTS)r.prompts++;return r.prompts}
  /* 종을 울림(값 없음): 결전 문제 번호 shields개를 정해 run.fpick에 넣는다(이어하기에도 같은 문제).
     이번 판에 한 번에 맞힌 것(최근 recent문제 제외, 모자라면 최근 것도) ok개 + 틀린 것 review개, 순서는 맞힌 것 2 → 복습 → 맞힌 것 → 복습 → 맞힌 것(마지막 방패는 맞힌 문제).
     기록이 모자라면(예전 저장 등) 평소 순서의 다음 문제(−1)로 채운다. opt.rnd = 0~1 난수, opt.idOf(번호) = 그 번호의 문항 id(같은 문항을 두 번 고르지 않게, 없어도 됨) */
  function ringBell(s,opt){
    const r=runOf(s),o=opt||{};if(r.bell!==1)return false;
    const R=typeof o.rnd==='function'?o.rnd:Math.random,idOf=typeof o.idOf==='function'?o.idOf:(i=>i),used=new Set(),N=FINALE.shields;
    const take=(list,n)=>{const a=list.slice(),out=[];while(out.length<n&&a.length){const i=a.splice(Math.min(a.length-1,Math.floor(R()*a.length)),1)[0],k=idOf(i);if(used.has(k))continue;used.add(k);out.push(i)}return out};
    const cut=(s.index|0)-FINALE.recent,review=take(r.miss,Math.min(FINALE.review,N-1));
    let oks=take(r.ok.filter(i=>i<cut),N-review.length);
    if(oks.length<N-review.length)oks=oks.concat(take(r.ok.filter(i=>i>=cut),N-review.length-oks.length));
    const pick=[];let a=0,b=0;
    for(let i=0;i<N;i++)pick.push(i%3===2&&b<review.length?review[b++]:a<oks.length?oks[a++]:-1);
    while(b<review.length){const j=pick.indexOf(-1);if(j<0)break;pick[j]=review[b++]}
    /* 마지막 방패는 복습이 아니게: 마지막이 복습이면 바로 앞과 바꾼다 */
    if(N>=2&&review.includes(pick[N-1])&&!review.includes(pick[N-2])){const t=pick[N-1];pick[N-1]=pick[N-2];pick[N-2]=t}
    r.bell=2;r.shields=0;r.fq=0;r.steps=0;r.fpick=pick;return true;
  }
  /* 지금 낼 결전 문제: {index: 문제 번호, normal: 평소 순서의 문제인가(끝나면 s.index를 넘긴다)} 또는 null(결전 중이 아님) */
  function finaleNow(s){const r=runOf(s);if(r.bell!==2||!r.fpick.length)return null;const i=r.fpick[0];return {index:i>=0?i:s.index|0,normal:i<0}}
  /* 결전 문제 하나의 결말: 한 번에 맞히면 방패 1개가 깨지고, 아니면 그 문제는 맨 뒤로 돌아간다(다시 나온다).
     두 번 틀리면 8세부터 왕이 한 걸음(최대 FINALE.steps). 방패를 다 깨면 finish. 지는 경우는 없다. → {shield, shields, stepped, won, normal} */
  function finaleSettle(s,result,opt){
    const r=runOf(s);if(r.bell!==2||!r.fpick.length)return null;
    const cur=r.fpick.shift(),out={shield:false,shields:r.shields,stepped:false,won:false,normal:cur<0};r.fq++;
    if(result==='first'){r.shields=Math.min(FINALE.shields,r.shields+1);out.shield=true}
    else{r.fpick.push(cur);if(result==='miss'&&(s.age|0)>FINALE.noStepAge&&r.steps<FINALE.steps){r.steps++;out.stepped=true}}
    out.shields=r.shields;
    if(r.shields>=FINALE.shields){finish(s,opt);out.won=true}
    return out;
  }
  /* 별 3개(사건 기반): ① 꼬꼬 지킴이(온 여우를 모두 막음. 여우를 끈 설정이면 닭을 한 마리도 잃지 않음) ② 늑대 왕을 물리침 ③ 새 글 STAR_NEW개 */
  function stars(s){const r=runOf(s);return [FOX.on?(r.fox>=1&&r.foxLost===0&&r.foxSaved>=r.fox?1:0):(r.lost===0?1:0),1,r.newOk>=FLAGS.STAR_NEW?1:0]}
  const snapOf=s=>({level:s.level|0,fence:s.fence|0,chickens:s.chickens|0,farmers:s.farmers|0,pond:s.pond|0,hall:s.hall|0,power:s.power|0});
  /* 늑대 왕을 물리침: 도장·마을 스냅숏·정답률을 meta에 남긴다. opt.now = 지금 시각(ms, 없으면 0) */
  function finish(s,opt){
    const r=runOf(s),m=metaOf(s),o=opt||{},now=Number.isFinite(o.now)&&o.now>0?o.now:0,acc=r.asked?Math.round(100*r.first/r.asked):0;
    r.bell=3;r.shields=FINALE.shields;r.fpick=[];r.steps=0;
    m.stamps.push({no:r.no,village:r.village,age:s.age|0,stars:stars(s),q:r.asked,acc,lost:r.lost,min:now&&r.t0?Math.max(0,Math.round((now-r.t0)/60000)):0,date:now});
    m.villages.push({no:r.no,village:r.village,snap:snapOf(s)});m.acc.push(acc);
    for(const k of ['stamps','villages','acc'])if(m[k].length>CAPS[k])m[k].splice(0,m[k].length-CAPS[k]);
    return m.stamps[m.stamps.length-1];
  }
  /* 엔딩 카드에서 '이 마을에서 더 놀기': 자유 놀이(잔치가 열린다) */
  function keepPlaying(s){const r=runOf(s);if(r.bell!==3)return false;r.bell=4;return true}
  /* 다음 판 늑대 세기 %(끝낸 판 기록으로): 잃은 닭이 많으면 내리고, 첫 정답률 80% 이상이고 잃은 닭이 적으면 올린다(상한 +20%) */
  function nextMul(s){
    const r=runOf(s),acc=r.asked?100*r.first/r.asked:0,cur=clamp(WOLF_MUL.min,WOLF_MUL.max,(r.wolfMul|0)||100);
    if(r.lost>=WOLF_MUL.lowerLost)return Math.max(WOLF_MUL.min,cur-WOLF_MUL.step);
    if(acc>=WOLF_MUL.raiseAcc&&r.lost<=WOLF_MUL.raiseLostMax)return Math.min(WOLF_MUL.max,cur+WOLF_MUL.step);
    return cur;
  }
  /* 새 마을로 떠나기: 끝낸 판(run.bell ≥ 3)에서만. 회관 0부터 새로 시작하되 도장 수만큼 시작 꾸러미(타워·닭)를 들고 간다.
     종 문턱은 '이번 판에 새로 지은 수'라 꾸러미(built0)는 세지 않는다. 나이·읽기 속도·meta는 이어 간다. opt.seed = 문제 순서 씨앗, opt.now = 시각 */
  function nextRun(s,opt){
    const r=runOf(s);if(r.bell<3)return null;
    const o=opt||{},m=restoreMeta(metaOf(s)),n=fresh(s.age),k=Math.min(START_PACK.max,m.stamps.length);
    const last=m.villages[m.villages.length-1];if(last&&last.no===r.no)last.snap=snapOf(s);
    const pack={towers:k*START_PACK.perStamp.towers,hens:k*START_PACK.perStamp.hens};
    n.level+=pack.towers;n.chickens=Math.min(HENS_MAX,n.chickens+pack.hens);n.meta=m;n.pace=s.pace;n.paced=s.paced|0;n.seed=o.seed>0?o.seed:0;
    n.run=Object.assign(freshRun(),{no:r.no+1,village:villageOf(r.no+1),built0:pack.towers+pack.hens,pack,wolfMul:nextMul(s),t0:Number.isFinite(o.now)&&o.now>0?o.now:0});
    grow(n);return n;
  }
  /* 도둑 여우(규칙의 경제 쪽. 움직임은 world.js): 다음 문제를 시작할 때 올 차례인가, 닭까지 오는 틱, 이 나이는 놀래키기만인가 */
  const foxDue=s=>{const r=runOf(s);return !!FOX.on&&r.bell<2&&r.fox<FOX.at.length&&(s.hall|0)>=FOX.needHall&&builtNew(s)>=FOX.at[r.fox]};
  const foxTicks=(s,q)=>Math.max(10,Math.round(baseSeconds(q)*Math.max(1,(Number(s.pace)||100)/100)*FOX.f/TICK));
  const foxScareOnly=s=>(s.age|0)<=FOX.scareOnlyAge;
  function foxCame(s){return ++runOf(s).fox}
  function foxEnded(s,saved){const r=runOf(s);if(saved)r.foxSaved++;else r.foxLost++}

  /* 저장의 run·meta 다듬기: 틀린 값은 그 칸만 기본값으로(저장 전체를 버리지 않는다). 모르는 칸은 버린다 */
  const intList=(a,lo)=>Array.isArray(a)?a.filter(x=>Number.isSafeInteger(x)&&x>=lo):[];
  function restoreRun(raw){
    const r=freshRun(),o=isObj(raw)?raw:{},P=START_PACK,p=isObj(o.pack)?o.pack:{};
    r.no=intIn(o.no,1,99999,1);r.village=VILLAGES.includes(o.village)?o.village:villageOf(r.no);
    r.pack={towers:intIn(p.towers,0,P.max*P.perStamp.towers,0),hens:intIn(p.hens,0,P.max*P.perStamp.hens,0)};r.built0=r.pack.towers+r.pack.hens;
    r.wolfMul=intIn(o.wolfMul,WOLF_MUL.min,WOLF_MUL.max,100);
    r.bell=intIn(o.bell,0,4,0);r.bellQ=intIn(o.bellQ,-1,1e9,-1);r.prompts=intIn(o.prompts,0,99,0);
    for(const k of ['fq','fox','foxSaved','foxLost','asked','first','lost','newOk'])r[k]=intIn(o[k],0,1e9,0);
    r.t0=Number.isFinite(o.t0)&&o.t0>0?o.t0:0;
    r.ok=[...new Set(intList(o.ok,0))].slice(-CAPS.ok);r.miss=[...new Set(intList(o.miss,0))].slice(-CAPS.miss);
    /* 결전 중이던 저장: 깬 방패와 남은 문제는 그대로, 왕은 처음 자리로(steps 0). 남은 문제 수 = 방패 수 − 깬 수(모자라면 평소 순서로 채움) */
    r.steps=0;
    if(r.bell===2){r.shields=intIn(o.shields,0,FINALE.shields-1,0);const left=FINALE.shields-r.shields;r.fpick=intList(o.fpick,-1).slice(0,left);while(r.fpick.length<left)r.fpick.push(-1)}
    else{r.fpick=[];r.shields=r.bell>=3?FINALE.shields:0}
    return r;
  }
  function restoreMeta(raw){
    const m=freshMeta(),o=isObj(raw)?raw:{},vil=v=>VILLAGES.includes(v)?v:VILLAGES[0];
    if(Array.isArray(o.stamps))for(const t of o.stamps.slice(-CAPS.stamps))if(isObj(t))m.stamps.push({no:intIn(t.no,1,99999,1),village:vil(t.village),age:intIn(t.age,7,10,8),
      stars:[0,1,2].map(i=>Array.isArray(t.stars)&&t.stars[i]?1:0),q:intIn(t.q,0,1e9,0),acc:intIn(t.acc,0,100,0),lost:intIn(t.lost,0,1e9,0),min:intIn(t.min,0,1e9,0),date:Number.isFinite(t.date)&&t.date>0?t.date:0});
    if(Array.isArray(o.villages))for(const v of o.villages.slice(-CAPS.villages))if(isObj(v)){const sn=isObj(v.snap)?v.snap:{},snap={};for(const k of ['level','fence','chickens','farmers','pond','hall','power'])snap[k]=intIn(sn[k],0,99,0);m.villages.push({no:intIn(v.no,1,99999,1),village:vil(v.village),snap})}
    m.acc=intList(o.acc,0).map(x=>Math.min(100,x)).slice(-CAPS.acc);
    m.seenOk=Array.isArray(o.seenOk)?[...new Set(o.seenOk.filter(x=>typeof x==='string'&&x.length>0&&x.length<=40))].slice(-CAPS.seenOk):[];
    m.from=o.from===9?9:0;return m;
  }

  /* (0.8 유산, 0.9 화면은 쓰지 않음) 카드 3장: 같은 상태면 언제나 같은 3장 */
  function offers(s){
    const pick=(list,turn)=>{const a=list.filter(k=>open(s,k)),fresh=a.find(k=>ITEMS[k].need&&count(s,k)===0);return fresh||(a.length?a[turn%a.length]:null)};
    const out=[open(s,'repair')?'repair':pick(['tower','fence','power'],s.level+s.fence+(s.power|0)),pick(['chicken','farmer','pond'],Math.max(0,s.chickens-1)+s.farmers+s.pond),pick(['hall','feast'],0)];
    for(let i=0;i<3;i++)if(!out[i])out[i]=ORDER.find(k=>open(s,k)&&!out.includes(k))||null;
    return out;
  }

  /* 저장 복원·이행. 0.5 저장(hp·combat·claimed)도 받아들인다. 정답 보상을 이미 받은 문제는 다음 문제로 넘겨 이중 지급을 막는다.
     0.8 저장: 카드 고르기 중(round.phase 'pick')이던 문제는 금화를 이미 받았으므로 round를 버리고 다음 문제로. 남은 카드 수(left)는 버린다.
     새 상한으로 자르고, 둥지 알은 닭 수 이하, 매대 부서짐은 0/1.
     0.12 저장 v3: version 1(0.5~0.11)과 3을 모두 받는다(숫자 칸은 같다). 3에는 run(이번 판 진행)·meta(도장·지도)가 더 있다. 화면은 언제나 version 3으로 쓴다.
       version 1 이행(결정 F): 금화 × 0.25(새 가격이 예전의 4분의 1), 잔치 10까지, 회관은 자동 승급 기준으로 올리기만, 66개 넘게 지은 마을은 바로 종이 열림(grow).
       그 밖의 버전은 버린다(화면이 버리기 전에 원본을 '-bak' 열쇠에 한 번 복사한다).
     0.11: 듣고 고르기 폐쇄. 예전 저장의 mode 'sound'(또는 없음)는 story로 바꾸고, 풀던 소리 문제(round, token '나이:sound:번호')는 버려 같은 번호의 읽기 문제로 잇는다. */
  function restore(saved,ages){
    const s=fresh(8),list=ages||[7,8,9,10];
    const V=saved&&typeof saved==='object'?saved.version:0;
    if(!(V===1||V===3))return s;
    for(const k of NUMS)if(Number.isSafeInteger(saved[k])&&saved[k]>=0)s[k]=saved[k];
    const old=saved.mode==='story'?'story':'sound';s.mode='story';
    s.age=list.includes(saved.age)?saved.age:8;
    s.chickens=clamp(0,HENS_MAX,s.chickens);if(!('round' in saved)&&s.chickens===0)s.chickens=1;
    for(const k of ['tower','fence','power','farmer','pond','hall']){const key=ITEMS[k].key;s[key]=Math.min(s[key],max(k))}
    s.hidden=Math.min(s.hidden,s.chickens);s.help=Math.min(MAX_HELP,s.help);s.late=Math.min(1,s.late);
    s.nest=Math.min(s.nest,s.chickens);s.marketDown=s.marketDown?1:0;s.pace=clamp(PACE.lo,PACE.hi,s.pace);
    const r=saved.round;
    if(r&&typeof r==='object'&&r.phase==='pick'&&typeof r.token==='string')s.index++;
    else if(r&&typeof r==='object'&&typeof r.token==='string'&&['ask','learn'].includes(r.phase)&&Number.isSafeInteger(r.t)&&r.t>=0&&[0,1].includes(r.tries)){
      if(saved.mode!=='sound'&&!r.token.includes(':sound:'))s.round={token:r.token,phase:r.phase,t:r.t,tries:r.tries,gold:Number.isSafeInteger(r.gold)?r.gold:0};
    }else if(!('round' in saved)&&typeof saved.claimed==='string'&&saved.claimed===old+':'+s.index)s.index++;
    s.run=restoreRun(saved.run);s.meta=restoreMeta(saved.meta);
    if(V===1){s.gold=Math.max(MIGRATE.goldMin,Math.round(s.gold*MIGRATE.goldRate/5)*5);s.feast=Math.min(s.feast,MIGRATE.feastMax);s.meta.from=9}
    s.feast=Math.min(s.feast,FLAGS.FEAST_MAX);
    grow(s);
    return s;
  }

  const api={API:4,SAVE_VERSION:3,FLAGS,FINALE,FOX,MIGRATE,START_PACK,WOLF_MUL,VILLAGES,VILLAGE_NAME,villageOf,CAPS,FEAST,freshRun,freshMeta,builtNew,autoHall,bellBuilt,bellDue,grow,goldScale,track,lostHen,
    bellPrompted,ringBell,finaleNow,finaleSettle,stars,finish,keepPlaying,nextMul,nextRun,foxDue,foxTicks,foxScareOnly,foxCame,foxEnded,restoreRun,restoreMeta,TICK,SPEED,MIN_SEC,MAX_SEC,SLACK,FENCE,HELP,FAST,FAST_BONUS,FAST_MIN,isFast,STREAK,BOUNTY,combo,DASH,DASH_TICKS,MAX_WOLVES,PACE,PAY,REPAIR,CURVE,ITEMS,SHOP,ORDER,POWER_NOTE,THINK,LINES,REC,units,
    HENS_MAX,TOWERS_MAX,FARMERS_MAX,syl,fresh,max,count,needSeconds,baseSeconds,limit,reveal,LEARN,learnTicks,scale,picks,built,wolves,basket,eggPrice,income,raid,settle,price,open,canBuy,buy,shopKeys,shop,recommend,offers,restore,
    GUARD,guard,trackPace};
  if(typeof module!=='undefined')module.exports=api;
  else root.Combat=api;
})(typeof window!=='undefined'?window:globalThis);
