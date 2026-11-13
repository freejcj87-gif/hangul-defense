/* 꼬꼬마을 규칙 모듈(0.6에서 만들고 0.8에서 타워 강화·상식/수학/영어 문제 시간, 0.9에서 항상 열린 상점·알 경제·추천 말풍선): 정답 수입 · 상점 · 추천.
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

  /* ---------- 알 경제 (game-plan §4.4) ----------
     한 번에 맞힌 금화 = (기본 + 판 알 × 알값 + 물고기) × 긴 글 배수 × 연속 배수 (+ 번개)
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
  const CURVE={tower:[35,1.23],fence:[20,1.32],chicken:[30,1.26],farmer:[85,1.15],power4:[480,1.065]};
  /* 상품. slot은 0.8 카드 칸(0 지켜요 · 1 벌어요 · 2 마을, 화면 분류용), need = 필요한 회관 단계, base = 처음부터 있는 수(닭 1마리) */
  const ITEMS={
    tower:{slot:0,key:'level',name:'타워',note:'화살 타워 +1',prices:curve(CURVE.tower[0],CURVE.tower[1],19)},
    power:{slot:0,key:'power',name:'타워 강화',note:'펑! 터지는 화살',prices:[110,260,450].concat(curve(CURVE.power4[0],CURVE.power4[1],7)),need:1},
    fence:{slot:0,key:'fence',name:'울타리',note:'마을 한 면을 막아요',prices:curve(CURVE.fence[0],CURVE.fence[1],18)},
    chicken:{slot:1,key:'chickens',name:'닭',note:'정답마다 알 +1개',prices:curve(CURVE.chicken[0],CURVE.chicken[1],19),base:1},
    farmer:{slot:1,key:'farmers',name:'농부',note:'알을 4개 더 날라요',prices:curve(CURVE.farmer[0],CURVE.farmer[1],9)},
    pond:{slot:1,key:'pond',name:'연못',note:'정답마다 물고기 +6골드',prices:[180,400,650],need:2},
    hall:{slot:2,key:'hall',name:'회관 키우기',note:'마을이 커져요',prices:[150,420,1080]},
    feast:{slot:2,key:'feast',name:'마을 잔치',note:'정답마다 +5골드',need:3},
    repair:{slot:0,key:'repairs',name:'고치기',note:'부서진 건물을 모두 고쳐요'}
  };
  /* 상점 띠 2줄 × 4칸(위치 고정). 회관을 다 키우면(3단계) 8번째 칸은 잔치가 이어받는다 */
  const SHOP=['repair','tower','power','fence','chicken','farmer','pond','hall'];
  const ORDER=['tower','fence','power','chicken','farmer','pond','hall','feast'];/* (0.8 카드 순서, offers 전용) */
  const NUMS=['gold','level','fence','chickens','hidden','farmers','pond','hall','feast','wins','misses','index','help','late','repairs','broken','power','streak','nest','marketDown','pace','paced','seed'];
  /* 타워 강화 단계별 설명(지금 단계 → 다음 단계). 1~3단계 펑·큰 펑·세 갈래, 4~10단계 화살 피해 +1 */
  const POWER_NOTE=['펑! 터져서 둘레도 맞아요','더 크게 펑!','한 번에 세 마리!'].concat(Array(7).fill('화살이 더 세져요!'));
  /* 상식·수학·영어 문제: 생각하는 시간(초, 수학은 계산 시간 포함) */
  const THINK={common:{7:2,8:2,9:2.5,10:3},math:{7:3,8:4,9:4.5,10:5},english:{7:2,8:2,9:2.5,10:3}};

  const syl=s=>{let n=0;for(const ch of String(s||''))if(ch>='가'&&ch<='힣')n++;return n};
  const clamp=(lo,hi,v)=>Math.min(hi,Math.max(lo,v));

  function fresh(age){return {gold:20,level:0,fence:0,chickens:1,hidden:0,farmers:0,pond:0,hall:0,feast:0,wins:0,misses:0,index:0,help:0,late:0,repairs:0,broken:0,power:0,streak:0,nest:0,marketDown:0,pace:100,paced:0,seed:0,mode:'story',age:age||8,round:null}}
  /* 숨은 상한(산 횟수). 아이에게 보이지 않는다. 타워 1+19=20 · 닭 1+19=20 · 농부 1+9=10 */
  const max=key=>key==='feast'||key==='repair'?Infinity:ITEMS[key]?ITEMS[key].prices.length:0;
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
  /* 긴 글은 문제 하나에 시간이 더 드는 만큼 금화도 더 준다(분당 수입이 비슷해지도록). 느리게 푼다고 더 주지는 않는다. */
  const scale=q=>Math.max(1,baseSeconds(q)/10);
  /* 번개(빨리 맞힘): 풀이 시작부터 ticks틱 만에 맞혔을 때, 기본 시간의 60% 안이면서 최소 읽기 시간은 지났는지 */
  const isFast=(q,ticks)=>ticks<=(1-FAST)*baseSeconds(q)/TICK+1e-6&&ticks>=FAST_MIN*needSeconds(q)/TICK-1e-6;
  /* (0.8 유산, 0.9 화면은 쓰지 않음) 한 번에 맞혔을 때 고를 수 있던 카드 수 */
  const picks=q=>Math.min(3,Math.max(1,Math.round(scale(q))));

  /* 지은 것(고치기·잔치 제외, 닭은 처음 1마리 제외) */
  function built(s){return (s.level|0)+(s.fence|0)+Math.max(0,(s.chickens|0)-1)+(s.farmers|0)+(s.pond|0)+(s.hall|0)+(s.power|0)}
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
    const fish=PAY.fish*(s.pond|0),base=PAY.base+PAY.feast*(s.feast|0),m=scale(q),streak=(s.streak|0)+1,c=combo(streak),g=guard(q,ticks);
    const plain=Math.round((base+sold*eggValue+fish)*m*c*g),bonus=fast?Math.ceil(plain*FAST_BONUS):0;
    return {laid,sold,left,eggValue,fish,base,m,streak,combo:c,guard:g,plain,bonus,gold:plain+bonus,basket:cap,eggs:sold,value:eggValue};
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
     opt.fast = 번개, opt.ticks = 문제 시작부터 맞힐 때까지 틱(있으면 읽기 속도 s.pace를 갱신) */
  function settle(s,q,result,opt){
    const o=opt||{};
    if(result==='first'){
      const inc=income(s,q,!!o.fast,o.ticks),back=s.hidden>0?1:0;
      s.gold+=inc.gold;s.wins++;s.streak=inc.streak;s.hidden-=back;s.late=0;s.nest=inc.left;if(o.fast)s.help=Math.max(0,s.help-1);
      trackPace(s,q,o.ticks);
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
    if(key==='feast')return 200+60*(s.feast|0);
    if(key==='repair')return REPAIR.base+REPAIR.per*Math.max(1,s.broken|0);
    const i=count(s,key);return i<it.prices.length?it.prices[i]:Infinity;
  }
  /* 지금 살 수 있는 상품인가(금화와 무관): 고치기는 부서진 건물이 있을 때, 나머지는 회관 단계가 되고 숨은 상한 전 */
  const open=(s,key)=>key==='repair'?(s.broken|0)>0:!!ITEMS[key]&&(ITEMS[key].need||0)<=(s.hall|0)&&count(s,key)<max(key);
  const canBuy=(s,key)=>open(s,key)&&s.gold>=price(s,key);
  function buy(s,key){
    if(!canBuy(s,key))return 0;
    const p=price(s,key);s.gold-=p;s[ITEMS[key].key]=(s[ITEMS[key].key]|0)+1;return p;
  }
  /* 지금 상점 8칸의 키(회관 3단계부터 8번째 칸은 잔치) */
  const shopKeys=s=>SHOP.map(k=>k==='hall'&&(s.hall|0)>=max('hall')?'feast':k);
  /* 상점 띠: 8칸 {key, state, price, need}. state = buy(살 수 있음) · poor(금화 부족) · locked(회관 단계 부족, need) · none(고칠 곳 없음) · max(숨은 상한, price 0) */
  function shop(s){
    return shopKeys(s).map(key=>{
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
    boar:'멧돼지는 건물로 돌진해요. 타워가 막아 줘요!'
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
    /* 4 회관 단계로 새 상품이 열림(아직 안 산 것, 말풍선은 한 번) */
    const shown=Array.isArray(c.opened)?c.opened:[];
    for(const k of OPENED)if(count(s,k)===0&&!shown.includes(k)&&ok(k))return say(k,'open'+k[0].toUpperCase()+k.slice(1),4);
    /* 5 회관 값만큼 있음 */
    if(ok('hall'))return say('hall','hall',5);
    /* 6 둥지에 알이 남음 */
    if((s.nest|0)>0&&ok('farmer'))return say('farmer','farmer',6);
    /* 보너스(회관 목표): 회관 값의 70% 이상 모음, 또는 이 단계에서 충분히 지음 → 회관을 위해 모으자(살 수 없는 key, urgent 아님) */
    const H=s.hall|0;
    if(H<max('hall')){if(s.gold>=REC.hallSoon*price(s,'hall'))return say('hall','hallSoon',0);if(built(s)>=REC.hallGoal[H])return say('hall','hallSave',0)}
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

  /* (0.8 유산, 0.9 화면은 쓰지 않음) 카드 3장: 같은 상태면 언제나 같은 3장 */
  function offers(s){
    const pick=(list,turn)=>{const a=list.filter(k=>open(s,k)),fresh=a.find(k=>ITEMS[k].need&&count(s,k)===0);return fresh||(a.length?a[turn%a.length]:null)};
    const out=[open(s,'repair')?'repair':pick(['tower','fence','power'],s.level+s.fence+(s.power|0)),pick(['chicken','farmer','pond'],Math.max(0,s.chickens-1)+s.farmers+s.pond),pick(['hall','feast'],0)];
    for(let i=0;i<3;i++)if(!out[i])out[i]=ORDER.find(k=>open(s,k)&&!out.includes(k))||null;
    return out;
  }

  /* 저장 복원·이행. 0.5 저장(hp·combat·claimed)도 받아들인다. 정답 보상을 이미 받은 문제는 다음 문제로 넘겨 이중 지급을 막는다.
     0.8 저장: 카드 고르기 중(round.phase 'pick')이던 문제는 금화를 이미 받았으므로 round를 버리고 다음 문제로. 남은 카드 수(left)는 버린다.
     새 상한으로 자르고, 둥지 알은 닭 수 이하, 매대 부서짐은 0/1. 저장 형식은 그대로 version 1.
     0.11: 듣고 고르기 폐쇄. 예전 저장의 mode 'sound'(또는 없음)는 story로 바꾸고, 풀던 소리 문제(round, token '나이:sound:번호')는 버려 같은 번호의 읽기 문제로 잇는다. */
  function restore(saved,ages){
    const s=fresh(8),list=ages||[7,8,9,10];
    if(!saved||typeof saved!=='object'||saved.version!==1)return s;
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
    return s;
  }

  const api={API:3,TICK,SPEED,MIN_SEC,MAX_SEC,SLACK,FENCE,HELP,FAST,FAST_BONUS,FAST_MIN,isFast,STREAK,BOUNTY,combo,DASH,DASH_TICKS,MAX_WOLVES,PACE,PAY,REPAIR,CURVE,ITEMS,SHOP,ORDER,POWER_NOTE,THINK,LINES,REC,units,
    HENS_MAX,TOWERS_MAX,FARMERS_MAX,syl,fresh,max,count,needSeconds,baseSeconds,limit,reveal,LEARN,learnTicks,scale,picks,built,wolves,basket,eggPrice,income,raid,settle,price,open,canBuy,buy,shopKeys,shop,recommend,offers,restore,
    GUARD,guard,trackPace};
  if(typeof module!=='undefined')module.exports=api;
  else root.Combat=api;
})(typeof window!=='undefined'?window:globalThis);
