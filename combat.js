/* 꼬꼬마을 규칙 모듈(0.6에서 만들고 0.8에서 타워 강화·상식/수학/영어 문제 시간 추가): 정답 수입(알·물고기) · 골라 짓기 카드.
   화면과 무관한 순수 함수만 둔다. 같은 상태를 넣으면 언제나 같은 결과가 나와야 한다(저장·복원·검사용).
   시간 단위는 틱(0.1초). 늑대의 위치는 따로 저장하지 않고 '경과 틱 / 제한 틱'으로 계산한다. */
(function(root){
  'use strict';
  const TICK=.1;
  /* 보통 아이의 읽기 속도 가정(음절/초). 실제 아이 관찰 뒤 이 표만 바꾸면 된다. */
  const SPEED={7:1,8:2,9:3,10:3.8};
  const MIN_SEC={7:10,8:9,9:8,10:8},MAX_SEC=50;
  const SLACK=1.3;         /* 제한시간 = 보통 아이 필요 시간 × 1.3 */
  const FENCE=.05;         /* 울타리 1칸 = 늑대가 5% 느려져 읽을 시간이 그만큼 늘어난다(10초 문제면 +0.5초) */
  const HELP=.2,MAX_HELP=3; /* 시간 초과가 2번 이어지면 도움 1단계(+20%, 최대 3단계). 번개로 맞히면 1단계씩 내려간다 */
  const FAST=.4;           /* 남은 시간이 40% 이상일 때 맞히면 번개 보너스 */
  const FAST_BONUS=.25;    /* 번개 보너스 = 그 정답 금화의 25% */
  const BOUNTY=30;          /* 우두머리(불씨 왕)를 쓰러뜨리면 금화 +30 */
  const STREAK={step:.1,max:5}; /* 연속 정답: 한 번에 맞힌 것이 이어질 때마다 금화 +10%(2연속 ×1.1 … 6연속부터 ×1.5). 한 번이라도 틀리면 처음부터 */
  const DASH=.35;          /* 한 번 틀리면 늑대가 제한시간의 35%만큼 성큼 다가온다 */
  const DASH_TICKS=8;      /* 성큼 다가오는 동안(0.8초)은 보기를 누를 수 없다 */
  const MAX_WOLVES=5;

  /* 카드 목록. slot 0 = 지켜요, 1 = 벌어요, 2 = 마을. need = 필요한 마을회관 단계 */
  /* 수입 = (기본 + 알 수 × 알값 + 연못 × 물고기값) × 긴 글 배수 (+ 번개 보너스) */
  const PAY={base:8,egg:4,farmer:2,fish:6,feast:5};
  const ITEMS={
    tower:{slot:0,key:'level',name:'타워 세우기',note:'화살 타워 +1',prices:[40,150,280,450,650]},
    power:{slot:0,key:'power',name:'타워 강화',note:'펑! 터지는 화살',prices:[110,260,450],need:1},
    fence:{slot:0,key:'fence',name:'울타리 치기',note:'마을 한 면을 막아요',prices:[20,50,80,110,150,190]},
    chicken:{slot:1,key:'chickens',name:'닭 데려오기',note:'정답마다 알 +1개',prices:[25,60,95,130,170,210,260],base:1},
    farmer:{slot:1,key:'farmers',name:'농부 고용',note:'알 1개당 +2골드',prices:[120,300],need:1},
    pond:{slot:1,key:'pond',name:'연못 파기',note:'정답마다 물고기 +6골드',prices:[180,400,650],need:2},
    hall:{slot:2,key:'hall',name:'마을회관 키우기',note:'새 카드가 생겨요',prices:[150,380,700]},
    feast:{slot:2,key:'feast',name:'마을 잔치',note:'정답마다 +5골드',need:3},
    repair:{slot:0,key:'repairs',name:'고치기',note:'부서진 건물을 모두 고쳐요'}
  };
  const ORDER=['tower','fence','power','chicken','farmer','pond','hall','feast'];/* repair는 부서진 건물이 있을 때만 지켜요 칸에 먼저 나온다 */
  const NUMS=['gold','level','fence','chickens','hidden','farmers','pond','hall','feast','wins','misses','index','help','late','repairs','broken','power','streak'];
  /* 타워 강화 단계별 카드 설명(지금 단계 → 다음 단계) */
  const POWER_NOTE=['펑! 터져서 둘레도 맞아요','더 크게 펑!','한 번에 세 마리!'];
  /* 상식·수학·영어 문제: 생각하는 시간(초, 수학은 계산 시간 포함) */
  const THINK={common:{7:2,8:2,9:2.5,10:3},math:{7:3,8:4,9:4.5,10:5},english:{7:2,8:2,9:2.5,10:3}};

  const syl=s=>{let n=0;for(const ch of String(s||''))if(ch>='가'&&ch<='힣')n++;return n};
  const clamp=(lo,hi,v)=>Math.min(hi,Math.max(lo,v));

  function fresh(age){return {gold:20,level:0,fence:0,chickens:1,hidden:0,farmers:0,pond:0,hall:0,feast:0,wins:0,misses:0,index:0,help:0,late:0,repairs:0,broken:0,power:0,streak:0,mode:'sound',age:age||8,round:null}}
  const max=key=>key==='feast'||key==='repair'?Infinity:ITEMS[key].prices.length+(ITEMS[key].base||0);

  /* 보통 아이가 읽고 고르는 데 드는 시간(초, 가정). 소리 모드는 듣는 시간을 뺀다(듣는 동안 시계가 멈춤).
     읽기 모드는 지문 + 질문(8세부터) + 보기를 읽고, 9세부터는 지문을 한 번 더 훑는 시간을 더한다. */
  /* 보기 읽는 양: 한글 음절 + 숫자·영문 글자 3개당 1 */
  const units=s=>syl(s)+(String(s||'').match(/[0-9A-Za-z]/g)||[]).length/3;
  function needSeconds(q){
    const age=SPEED[q.age]?q.age:8,r=SPEED[age],n=q.choices.length,choices=q.choices.reduce((a,c)=>a+syl(c),0);
    /* 상식·수학·영어: 질문과 그림·식을 읽고, 생각하고, 보기를 읽는다 */
    if(q.mode==='quiz'){const t=THINK[q.cat]||THINK.common;return 1.5+(syl(q.prompt)+units(q.passage))/r+q.choices.reduce((a,c)=>a+units(c),0)/r+.4*n+(t[age]||2)}
    if(q.mode!=='story')return 1+choices/r+.4*n;
    const p=syl(q.passage);
    return 1.5+(p+(age>=8?syl(q.prompt):0)+choices)/r+.4*n+(age>=9?.3*p/r:0);
  }
  /* 기본 제한시간(초) = 필요 시간 × 1.3, 나이별 최저(7세 10 · 8세 9 · 9·10세 8초)와 최고 50초 사이 */
  function baseSeconds(q){const age=SPEED[q.age]?q.age:8;return clamp(MIN_SEC[age],MAX_SEC,Math.ceil(SLACK*needSeconds(q)))}
  const limit=(q,s)=>Math.round(baseSeconds(q)*(1+FENCE*(s&&s.fence||0)+HELP*(s&&s.help||0))/TICK);
  /* 보기가 나타나기까지의 틱. 8세 이상 읽기 모드는 '글 먼저 읽기': 빠른 아이(보통의 1.5배)가 지문을 읽는 시간만큼 보기를 숨긴다.
     그 밖에는 0.3초(앞 화면에서 이어진 두 번 누르기 방지). 이 동안에도 시계는 흐른다. */
  function reveal(q){
    const age=SPEED[q.age]?q.age:8;
    if(q.mode!=='story'||age<8)return 3; /* 소리·상식·수학·영어 문제와 7세 낱말은 바로 보인다 */
    return Math.max(3,Math.round(syl(q.passage)/(1.5*SPEED[age])/TICK));
  }
  /* 놓쳤을 때 읽어 줄 글: 소리 모드는 정답 낱말, 읽기 모드는 지문 · 질문 · 정답 */
  function lesson(q){
    const answer=q.choices[q.answer];
    if(q.mode==='quiz')return q.speak+' 정답은 '+answer+'.';
    if(q.mode!=='story')return answer;
    return q.passage.replace(/\n/g,' ')+' '+(q.age>=8?q.prompt+' ':'')+'정답은 '+answer+'.';
  }
  /* 긴 글은 문제 하나에 시간이 더 드는 만큼 금화도 더 준다(분당 수입이 비슷해지도록). 느리게 푼다고 더 주지는 않는다. */
  const scale=q=>Math.max(1,baseSeconds(q)/10);
  /* 한 번에 맞혔을 때 고를 수 있는 카드 수: 긴 글일수록 많이(글 길이 배수 반올림, 1~3장). 짧은 문제를 빨리 많이 푸는 아이와 짓는 횟수를 맞춘다. */
  const picks=q=>Math.min(3,Math.max(1,Math.round(scale(q))));

  function built(s){return s.level+s.fence+Math.max(0,s.chickens-1)+s.farmers+s.pond+s.hall+(s.power|0)}
  /* 마을이 커질수록 늑대가 늘어난다(5개 지을 때마다 1마리, 최대 5마리). */
  const wolves=s=>Math.min(MAX_WOLVES,1+Math.floor(built(s)/5));

  /* 한 번에 맞혔을 때 받는 금화. fast = 남은 시간이 40% 이상 */
  const combo=n=>1+STREAK.step*Math.min(STREAK.max,Math.max(0,(n|0)-1));
  function income(s,q,fast){
    const eggs=Math.max(0,s.chickens-s.hidden),value=PAY.egg+PAY.farmer*s.farmers,fish=PAY.fish*s.pond,base=PAY.base+PAY.feast*s.feast,m=scale(q),streak=(s.streak|0)+1,c=combo(streak);
    const plain=Math.round((base+eggs*value+fish)*m*c),bonus=fast?Math.ceil(plain*FAST_BONUS):0;
    return {eggs,value,fish,base,m,streak,combo:c,plain,bonus,gold:plain+bonus};
  }
  /* 늑대가 마을에 닿았을 때: 타워가 level마리를 쏘고, 나머지가 닭을 놀래켜 숨게 한다. */
  function raid(s){
    const w=wolves(s),shot=Math.min(w,s.level),through=w-shot,scared=Math.min(through,Math.max(0,s.chickens-s.hidden));
    return {wolves:w,shot,through,scared};
  }

  /* 한 문제의 결말을 상태에 반영한다. result: 'first'(한 번에 정답) | 'second'(두 번째에 정답) | 'miss'(늑대가 마을에 닿음)
     first만 금화를 주고 카드를 연다. second는 늑대를 막지만 금화·카드는 없다. miss는 닭이 놀라 숨는다. */
  function settle(s,q,result,opt){
    const o=opt||{};
    if(result==='first'){
      const inc=income(s,q,!!o.fast),back=s.hidden>0?1:0;
      s.gold+=inc.gold;s.wins++;s.streak=inc.streak;s.hidden-=back;s.late=0;if(o.fast)s.help=Math.max(0,s.help-1);
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
    if(key==='feast')return 200+60*s.feast;
    if(key==='repair')return 20+15*Math.max(1,s.broken|0);
    const i=s[it.key]-(it.base||0);return i>=0&&i<it.prices.length?it.prices[i]:Infinity;
  }
  const open=(s,key)=>key==='repair'?(s.broken|0)>0:!!ITEMS[key]&&(ITEMS[key].need||0)<=s.hall&&s[ITEMS[key].key]<max(key);

  /* 카드 3장. 같은 상태면 언제나 같은 3장(새로고침해도 그대로)이고, 그 칸에서 하나를 사면 다음 종류로 바뀐다.
     마을회관으로 새로 열린 카드(아직 하나도 안 산 농부·연못·잔치)는 바로 다음 고르기에 먼저 나온다. */
  function offers(s){
    const pick=(list,turn)=>{const a=list.filter(k=>open(s,k)),fresh=a.find(k=>ITEMS[k].need&&s[ITEMS[k].key]===0);return fresh||(a.length?a[turn%a.length]:null)};
    const out=[open(s,'repair')?'repair':pick(['tower','fence','power'],s.level+s.fence+(s.power|0)),pick(['chicken','farmer','pond'],Math.max(0,s.chickens-1)+s.farmers+s.pond),pick(['hall','feast'],0)];
    for(let i=0;i<3;i++)if(!out[i])out[i]=ORDER.find(k=>open(s,k)&&!out.includes(k))||null;
    return out;
  }
  const canBuy=(s,key)=>offers(s).includes(key)&&s.gold>=price(s,key);
  function buy(s,key){
    if(!canBuy(s,key))return 0;
    const p=price(s,key);s.gold-=p;s[ITEMS[key].key]++;return p;
  }

  /* 저장 복원·이행. 0.5 저장(hp·combat·claimed)도 받아들인다. 정답 보상을 이미 받은 문제는 다음 문제로 넘겨 이중 지급을 막는다. */
  function restore(saved,ages){
    const s=fresh(8),list=ages||[7,8,9,10];
    if(!saved||typeof saved!=='object'||saved.version!==1)return s;
    for(const k of NUMS)if(Number.isSafeInteger(saved[k])&&saved[k]>=0)s[k]=saved[k];
    s.mode=saved.mode==='story'?'story':'sound';
    s.age=list.includes(saved.age)?saved.age:8;
    s.chickens=clamp(0,max('chicken'),s.chickens);if(!('round' in saved)&&s.chickens===0)s.chickens=1;
    for(const k of ['tower','fence','power','farmer','pond','hall']){const key=ITEMS[k].key;s[key]=Math.min(s[key],max(k))}
    s.hidden=Math.min(s.hidden,s.chickens);s.help=Math.min(MAX_HELP,s.help);s.late=Math.min(1,s.late);
    const r=saved.round;
    if(r&&typeof r==='object'&&typeof r.token==='string'&&['ask','pick','learn'].includes(r.phase)&&Number.isSafeInteger(r.t)&&r.t>=0&&[0,1].includes(r.tries))
      s.round={token:r.token,phase:r.phase,t:r.t,tries:r.tries,gold:Number.isSafeInteger(r.gold)?r.gold:0,left:Number.isSafeInteger(r.left)?clamp(1,3,r.left):1};
    else if(!('round' in saved)&&typeof saved.claimed==='string'&&saved.claimed===s.mode+':'+s.index)s.index++;
    return s;
  }

  const api={API:2,TICK,SPEED,MIN_SEC,MAX_SEC,SLACK,FENCE,HELP,FAST,FAST_BONUS,STREAK,BOUNTY,combo,DASH,DASH_TICKS,MAX_WOLVES,PAY,ITEMS,ORDER,POWER_NOTE,THINK,units,
    syl,fresh,max,needSeconds,baseSeconds,limit,reveal,lesson,scale,picks,built,wolves,income,raid,settle,price,open,offers,canBuy,buy,restore};
  if(typeof module!=='undefined')module.exports=api;
  else root.Combat=api;
})(typeof window!=='undefined'?window:globalThis);
