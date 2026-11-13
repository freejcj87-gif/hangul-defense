/* node scripts/sim-village.cjs end [판 수=12] [거르기] [도장 수=0] : 0.12 엔딩까지 시뮬레이션(아래 playEnd). 나이 4개 × 아이 유형 4개의 엔딩까지 문제 수·분, 10분 붕괴 수를 설계 v2 표와 견준다.
   node scripts/sim-village.cjs [분=40] [횟수=16] [거르기] : 0.9 마을 방어 시뮬레이션(개발용, 배포·CI 제외).
   문제 풀이(경제, combat.js)와 늑대 세계(world.js)를 함께 돌려, 같은 벽시계 시간 동안 아이 유형별로 game-plan §4.7 지표를 잰다.
   0.9 방식: 카드 고르기 멈춤이 없다. 상점은 늘 열려 있고 세계는 계속 흐른다. 아이는 꼬꼬 추천(Combat.recommend, 게임과 같은 순수 함수)을
   따라 금화가 되는 대로 산다(한 번 사는 데 0.8초, 그동안에도 늑대는 온다). 추천이 '조금만 더 모으자'면 기다린다.
   읽기 속도·정확도·화면 시간은 가정값이다. 거르기: '8story'·'10'처럼 나이(+모드) 일부, 또는 'typ' 같은 아이 유형.
   0.11: 듣고 고르기 모드 폐쇄로 읽고 고르기(story)만 돌린다(Questions.MODES = ['story']). */
const path=require('node:path'),ROOT=path.join(__dirname,'..');
const C=require(path.join(ROOT,'combat.js')),W=require(path.join(ROOT,'world.js')),Q=require(path.join(ROOT,'questions.js'));
const MIN=Number(process.argv[2])||40,RUNS=Number(process.argv[3])||16,ONLY=process.argv[4]||'';
let seed=11;const rnd=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648};
const RATE={7:{slow:30,typ:60,fast:100},8:{slow:70,typ:120,fast:180},9:{slow:120,typ:180,fast:250},10:{slow:160,typ:230,fast:300}};
const ACC={slow:.75,typ:.85,fast:.95};
const THINK={slow:1.5,typ:1,fast:.7};
const KIDS=['slow','typ','fast','guess'];
const syl=C.syl,units=C.units;
const need=(q,r,kind)=>{const rps=r/60,n=q.choices.length,cc=q.choices.reduce((s,c)=>s+units(c),0),p=syl(q.passage);
  if(q.mode==='quiz'){const t=(C.THINK[q.cat]||C.THINK.common)[q.age]||2;return 1+(syl(q.prompt)+units(q.passage))/rps+cc/rps+.4*n+t*THINK[kind]}
  return 1.5+p/rps+(q.age===7?0:syl(q.prompt)/rps)+cc/rps+.4*n+(q.age>=9?.3*p/rps:0)};
const BUY_SEC=.8,CHEER_SEC=1.2,MAX_BUYS=3,MID_SEC=20; /* 한 번 사기 0.8초, 정답 축하·판매 연출 1.2초, 한 번 쉴 때 최대 3개, 20초 넘는 문제는 읽는 도중 한 번 더 */
const BUBBLE={gap:200,urgent:100,bonus:600};    /* 말풍선 간격(틱): 20초, 고치기·위험 10초, '조금만 더 모으자'는 60초에 한 번 */
const marksFor=min=>{const out=[];for(let m=5;m<=min;m+=5)out.push(m);if(!out.length||out[out.length-1]!==min)out.push(min);return out};
const gapsFor=min=>[10,20,40].filter(m=>m<=min);

const median=a=>{const s=[...a].sort((x,y)=>x-y);return s[s.length>>1]};
/* 0.12 무리 간격: 실제로 나올 다음 120문제의 평균 기본 시간 × 1.3, 13~45초(index.html waveInterval과 같은 식) */
function interval(age,mode,seed0){let sum=0;for(let i=0;i<120;i++)sum+=C.baseSeconds(Q.at(age,mode,i,seed0|0));return W.tempoInterval(sum/120)}
function play(age,mode,kind,minutes){
  const MIN_=minutes||MIN,MARKS=marksFor(MIN_),GAPS=gapsFor(MIN_);
  const s=C.fresh(age);s.mode=mode;const w=W.create({seed:Math.floor(rnd()*1e9),interval:interval(age,mode),guard:true});W.sync(w,s);/* 0.10: 게임처럼 새 판 보호 */
  let correct=0,qn=0,ticks=0,seen=0,inside=0,maxPack=0,maxWolves=0,bought=0,repairs=0,feasts=0,earned=0,lastLost=-1e9,bubbles=0,lastBubble=-1e9,lastBonus=-1e9,mark=0;
  const buyTimes=[],opened=[],line={},at={},keys=()=>C.shopKeys(s);let poorSince=0;const poorMax={};
  const snap=m=>{at[m]={bought,built:C.built(s),earned,hall:s.hall,gold:s.gold,chickens:s.chickens,towers:1+s.level,power:s.power,fence:s.fence,farmers:s.farmers,pond:s.pond,nest:s.nest,henLost:w.stats.henLost,henSaved:w.stats.henSaved,broken:w.stats.broken}};
  const clock=()=>w.t*W.TICK;
  const run=sec=>{for(let i=0,n=Math.round(sec/W.TICK);i<n;i++){const ev=W.step(w,s);ticks++;
    for(const e of ev){if(e.type==='henLost'){C.lostHen(s);lastLost=w.t}else if(e.type==='pack')maxPack=Math.max(maxPack,e.n);else if(e.type==='kill'&&e.boss){s.gold+=C.BOUNTY;earned+=C.BOUNTY}}
    let live=0;for(const v of w.wolves)if(v.state!=='dead'&&v.state!=='gone')live++;
    if(live)seen++;if(W.wolvesInside(w))inside++;maxWolves=Math.max(maxWolves,live);
    /* 살 수 있는 상품이 하나도 없던 구간(기획서의 '아무것도 못 산') */
    if(keys().some(k=>C.canBuy(s,k)))poorSince=w.t;else for(const g of GAPS)if(w.t<=g*600)poorMax[g]=Math.max(poorMax[g]||0,(w.t-poorSince)*W.TICK);
    while(mark<MARKS.length&&w.t>=MARKS[mark]*600){snap(MARKS[mark]);mark++}}};
  /* 화면과 같은 ctx: towers = 서 있는 타워 수(계약) */
  const ctx=()=>({wolvesInside:W.wolvesInside(w),towers:w.buildings.filter(b=>b.kind==='tower'&&!b.broken).length,lostHenRecently:w.t-lastLost<300,brokenKinds:W.brokenKinds(w),opened});
  /* 상점: 추천을 따라 산다. 동전이 닿는 순간(정답 뒤) 말풍선 하나를 센다(화면의 빈도 제한을 흉내) */
  function shop(afterCorrect,most){
    s.broken=W.brokenCount(w);s.marketDown=W.marketDown(w);
    for(let k=0;k<(most||MAX_BUYS);k++){
      const rec=C.recommend(s,ctx());if(!rec)break;
      if(k===0&&afterCorrect&&w.t-lastBubble>=(rec.urgent?BUBBLE.urgent:BUBBLE.gap)&&(rec.rule!==0||w.t-lastBonus>=BUBBLE.bonus)){bubbles++;lastBubble=w.t;if(rec.rule===0)lastBonus=w.t}
      if(rec.rule===4&&!opened.includes(rec.key))opened.push(rec.key);
      if(!C.canBuy(s,rec.key))break; /* '조금만 더 모으자': 기다린다 */
      C.buy(s,rec.key);line[rec.key]=(line[rec.key]||0)+1;
      if(rec.key==='repair'){W.repairAll(w);repairs++}else if(rec.key==='feast')feasts++;else bought++;
      W.sync(w,s);s.broken=W.brokenCount(w);s.marketDown=W.marketDown(w);buyTimes.push(clock());run(BUY_SEC);
    }
  }
  while(clock()<MIN_*60){
    const q=Q.at(age,mode,s.index),n=q.choices.length,lock=C.reveal(q)/10;qn++;
    let t,ok1;
    if(kind==='guess'){t=lock+.4;ok1=rnd()<1/n}else{t=Math.max(lock+.3,need(q,RATE[age][kind],kind)*(.75+rnd()*.5));ok1=rnd()<ACC[kind]}
    /* 긴 문제(20초 넘게 읽음)는 읽는 도중에도 한 번 상점을 본다(상점은 늘 열려 있음, 최대 2개) */
    if(t>MID_SEC){run(t/2);shop(false,2);run(t/2)}else run(t);
    if(ok1){
      const fast=C.isFast(q,Math.round(t/W.TICK));s.marketDown=W.marketDown(w);const res=C.settle(s,q,'first',{fast,ticks:Math.round(t/W.TICK)});earned+=res.gold;correct++;W.answered(w);W.volley(w,s,{scale:C.scale(q),fast});
      run(CHEER_SEC);shop(true);
    }else{
      C.trackPace(s,q,Math.round(t/W.TICK));W.answered(w);/* 0.10: 틀려도 읽기 속도 갱신, 새 판 보호는 처음 몇 문제 */
      run(W.dashTicks(w)*W.TICK);
      const t2=kind==='guess'?.4:need(q,RATE[age][kind],kind)*.35;run(t2);
      if(kind==='guess'?rnd()<1/(n-1):rnd()<.8)C.settle(s,q,'second');else{s.misses++;s.streak=0}
      run(C.learnTicks(q)*C.TICK+(kind==='guess'?.4:1));shop(false);
    }
    s.index++;
  }
  while(mark<MARKS.length){snap(MARKS[mark]);mark++}
  const gaps={};for(const m of GAPS){let prev=0,g=0;for(const b of buyTimes){if(b>m*60)break;g=Math.max(g,b-prev);prev=b}gaps[m]=Math.max(g,m*60-prev)}
  const poor={};for(const g of GAPS)poor[g]=poorMax[g]||0;
  return {qn,correct,earned,bought,repairs,feasts,at,gaps,poor,henLost:w.stats.henLost,henSaved:w.stats.henSaved,broken:w.stats.broken,kills:w.stats.kills,
    seenPct:seen/ticks*100,insidePct:inside/ticks*100,maxPack,maxWolves,bubblesPerMin:bubbles/MIN_,nest:s.nest,line,threat:W.threat(s)};
}
/* ---------- 0.12 엔딩까지 한 판(playEnd) ----------
   게임과 같은 규칙 함수(Combat.ringBell·finaleNow·finaleSettle·foxDue…, World.king·fox·foxShoo·retreat)로 종 → 결전 → 엔딩까지 돌린다.
   아이 모형은 설계 v2 보정 시뮬(design/sim/sim-v2.cjs의 time 'real' · buyer 'bot' 1개씩)과 같게 했다. 모두 가정값이다:
   - 첫 고르기 시간 = 보통 아이 필요 시간(Combat.needSeconds) × 속도(느린 1.8 · 보통 1 · 빠른 0.62) × 균등 0.75~1.25, 첫 정답률 75 · 85 · 95%, 두 번째 정답률 80%. 찍기는 보기가 열리고 0.4초 뒤 아무거나
   - 사는 방식: 꼬꼬 말풍선이 떠서 칸이 반짝일 때만 그 칸을 사고, 아니면 고치기 → 닭 → 타워 → 농부 → 울타리 → 강화 → 연못 순으로 살 수 있는 것 하나(정답 연출 중 1개, 20초 넘는 문제는 절반 확률로 읽는 도중에도)
   - 종은 열린 다음 문제 경계에서 바로 울린다. 붕괴(10분) = 첫 10분 안에 닭이 0마리가 된 적 있음, 또는 10분에 닭 2마리 이하이면서 산 타워 0 */
const mulberry=a=>()=>{a=(a+0x6D2B79F5)>>>0;let t=Math.imul(a^a>>>15,a|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296};
const SPEEDK={slow:1.8,typ:1,fast:.62,guess:1},ACC1={slow:.75,typ:.85,fast:.95};
const CHEAP=['repair','chicken','tower','farmer','fence','power','pond','feast'];
function playEnd(age,kind,seed,opt){
  const o=opt||{},rnd=mulberry(seed>>>0),mode='story',QMAX=o.qmax||600,MINMAX=o.minmax||200;
  let s=C.fresh(age);
  /* 도장 n개를 가진 채 시작하는 판(다회차): 끝낸 판을 흉내 내 Combat.nextRun으로 새 마을을 만든다 */
  for(let k=0;k<(o.stamps|0);k++){s.run.bell=2;s.run.fpick=[-1];s.run.shields=C.FINALE.shields-1;s.run.asked=100;s.run.first=Math.round(100*(ACC1[kind]||.3));C.finaleSettle(s,'first');s=C.nextRun(s,{})}
  const iv=interval(age,mode,s.seed),w=W.sync(W.create({seed:Math.floor(rnd()*2147483646)+1,interval:iv,guard:true}),s);
  const clock=()=>w.t*W.TICK;let qn=0,phaseQuiet=false,shopLock=0,minHen10=s.chickens,snap10=null,maxGold=0,ended=null,finale=null;
  const ms={},mark=k=>{if(!ms[k])ms[k]={q:qn,min:clock()/60}};
  /* 추천 말풍선·반짝임 흉내(index.html의 빈도 규칙) */
  const REC={show:35,gap:200,urgentGap:100,window:600,mute:600,stale:150,perMin:2,bellGap:600},rec={glow:null,bubble:null,left:0,last:-1e9,times:[],prev:null,ign:{},mute:{},want:null,opened:[],lostAt:-1e9,uiT:0,bellAt:-1e9};
  const ctx=()=>({wolvesInside:W.wolvesInside(w),towers:w.buildings.filter(b=>b.kind==='tower'&&!b.broken).length,lostHenRecently:w.t-rec.lostAt<=300,brokenKinds:W.brokenKinds(w),opened:rec.opened.slice(),bellQuiet:w.t-rec.bellAt<REC.bellGap});
  const recNow=()=>C.recommend(s,ctx())||null;
  function account(){const p=rec.prev;if(!p||p.done)return;p.done=true;if(p.followed){rec.ign[p.key]=0;return}rec.ign[p.key]=(rec.ign[p.key]||0)+1;if(rec.ign[p.key]>=2){rec.mute[p.key]=w.t+REC.mute;rec.ign[p.key]=0}}
  function show(){if(rec.bubble)return;account();const r=recNow();if(!r)return;const t=w.t,recent=rec.times.filter(x=>t-x<REC.window).length;
    if(t-rec.last<(r.urgent?REC.urgentGap:REC.gap)||recent>=REC.perMin||(rec.mute[r.key]||-1)>t)return;
    if(rec.prev&&rec.prev.key!==r.key)rec.ign[rec.prev.key]=0;if(r.key==='bell'){C.bellPrompted(s);rec.bellAt=t}
    rec.prev={key:r.key,followed:false,done:false};rec.glow=r.key;rec.bubble=r;rec.left=REC.show;rec.last=t;rec.times=rec.times.filter(x=>t-x<REC.window).concat(t);if(r.rule===4&&!rec.opened.includes(r.key))rec.opened.push(r.key)}
  const ask=u=>{if(!rec.want||u)rec.want={at:w.t}};
  function recTick(){rec.uiT++;if(rec.bubble&&--rec.left<=0)rec.bubble=null;
    if(rec.glow&&rec.uiT%10===0){const r=recNow();if(!r||r.key!==rec.glow)rec.glow=null}
    if(rec.want){if(w.t-rec.want.at>REC.stale)rec.want=null;else if(!phaseQuiet&&!rec.bubble){rec.want=null;show()}}}
  function stepOnce(){
    for(const e of W.step(w,s)){
      if(e.type==='henLost'){C.lostHen(s);rec.lostAt=w.t;ask(true)}
      else if(e.type==='foxLost'||e.type==='foxScare')C.foxEnded(s,false);
      else if(e.type==='kill'&&e.boss)s.gold+=C.BOUNTY;
      else if(e.type==='broken'&&e.kind!=='fence'){s.broken=W.brokenCount(w);s.marketDown=W.marketDown(w);ask(true)}}
    if(shopLock>0)shopLock--;recTick();
    if(clock()<=600&&s.chickens<minHen10)minHen10=s.chickens;
    if(!snap10&&clock()>=600)snap10={hens:s.chickens,level:s.level,built:C.built(s),hall:s.hall,q:qn};
    maxGold=Math.max(maxGold,s.gold)}
  const run=sec=>{for(let i=0,n=Math.round(sec/W.TICK);i<n;i++)stepOnce()};
  const marks=()=>{for(const x of [1,2,3])if(s.hall>=x)mark('h'+x);if(s.run.bell>=1)mark('bell')};
  function buyOne(){
    s.broken=W.brokenCount(w);s.marketDown=W.marketDown(w);if(shopLock>0)return 0;
    const rows=C.shopKeys(s).filter(x=>C.canBuy(s,x));if(!rows.length)return 0;
    const key=rec.glow&&rows.includes(rec.glow)?rec.glow:CHEAP.find(c=>rows.includes(c));if(!key)return 0;
    C.buy(s,key);if(rec.prev&&rec.prev.key===key)rec.prev.followed=true;if(rec.glow===key){rec.glow=null;if(rec.bubble&&rec.bubble.key===key)rec.bubble=null}
    if(key==='repair')W.repairAll(w);W.sync(w,s);s.broken=W.brokenCount(w);s.marketDown=W.marketDown(w);shopLock=4;run(.5);marks();return 1}
  const kidTime=(q,first)=>{const lock=Math.max(3,C.reveal(q))/10;if(kind==='guess')return first?lock+.4:.4;const need=C.needSeconds(q)*SPEEDK[kind]*(.75+rnd()*.5);return first?Math.max(lock+.4,need):Math.max(.4,need*.35)};
  while(qn<QMAX&&clock()<MINMAX*60&&!ended){
    /* 종: 열려 있으면 문제 경계에서 울린다(가정). 결전 문제는 게임과 같은 규칙으로 고른다 */
    if(s.run.bell===1){C.ringBell(s,{rnd,idOf:i=>Q.at(age,mode,i,s.seed).id});W.king(w,'fight',0);finale={q0:qn,t0:clock()};mark('ring')}
    const fin=C.finaleNow(s),q=Q.at(age,mode,fin?fin.index:s.index,s.seed),n=q.choices.length;qn++;
    if(!fin&&!w.fox&&C.foxDue(s)){W.fox(w,s,C.foxTicks(s,q),{scare:C.foxScareOnly(s)});C.foxCame(s)}
    const t=kidTime(q,true),lock=Math.max(3,C.reveal(q))/10,ok1=kind==='guess'?rnd()<1/n:rnd()<ACC1[kind];
    phaseQuiet=true;run(Math.min(t,lock));phaseQuiet=false;
    if(t>20&&!fin&&rnd()<.5){run((t-lock)/2);buyOne();run((t-lock)/2)}else run(Math.max(0,t-lock));
    const ticks=Math.round(t/W.TICK);
    if(ok1){
      const fast=C.isFast(q,ticks);s.marketDown=W.marketDown(w);C.settle(s,q,'first',{fast,ticks,finale:!!fin});
      const fz=fin?C.finaleSettle(s,'first',{}):null;if(!fin||fin.normal)s.index++;
      W.answered(w);W.volley(w,s,{scale:C.scale(q),fast});if(W.foxShoo(w))C.foxEnded(s,true);
      if(fz){W.kingHit(w);if(fz.won){W.king(w,'flee');W.retreat(w,-1);ended={q:qn,min:clock()/60,finaleQ:qn-finale.q0,finaleMin:(clock()-finale.t0)/60,steps:0}}}
      ask(false);run(.6);if(!fin)buyOne();run(.6);
    }else{
      C.trackPace(s,q,ticks);W.answered(w);run(W.dashTicks(w)*W.TICK+.2);run(kidTime(q,false));
      const ok2=kind==='guess'?rnd()<1/(n-1):rnd()<.8;
      if(ok2){C.settle(s,q,'second',{finale:!!fin});if(C.FOX.second&&W.foxShoo(w))C.foxEnded(s,true);if(fin)C.finaleSettle(s,'second')}
      else{s.misses++;s.streak=0;C.track(s,q,'miss',{finale:!!fin});if(fin){const fz=C.finaleSettle(s,'miss');if(fz&&fz.stepped)W.king(w,'fight',s.run.steps)}}
      run(C.learnTicks(q)*C.TICK+.2);if(!fin||fin.normal)s.index++;
    }
    marks();
  }
  /* collapse = 첫 10분 안에 닭이 0마리가 된 적 있음(설계 v2 시뮬과 같은 기준). weak = 10분에 닭 2마리 이하이면서 산 타워 0(무너진 것은 아니고 거의 자라지 못한 판, 찍기 아이에게서 나옴) */
  const collapse=minHen10===0,weak=!!snap10&&snap10.hens<=2&&snap10.level<=Math.max(0,C.FLAGS.START_TOWERS-1);
  return {ended,qn,min:clock()/60,ms,collapse,weak,snap10,maxGold,henLost:w.stats.henLost,broken:w.stats.broken,saved:w.stats.henSaved,fox:s.run.fox,foxSaved:s.run.foxSaved,foxLost:s.run.foxLost,
    stars:ended?s.meta.stamps[s.meta.stamps.length-1].stars:null,built:C.built(s),interval:iv,pace:s.pace,first:s.run.first,asked:s.run.asked};
}
/* 설계 v2 표(§2.6, 읽고 고르기, 엔딩까지 문제 수 · 분 중앙값). 9·10세는 지문 묶음(지문 1 + 질문 3)을 가정한 값이고, 괄호 밖 비교용으로 '묶음 없음' 행(§2.4)도 둔다 */
const DESIGN={typ:{7:[85,12],8:[86,32],9:[86,35],10:[86,40]},slow:{7:[108,25],8:[105,70],9:[98,70],10:[98,81]},fast:{7:[74,7],8:[74,17],9:[74,19],10:[73,21]},guess:{7:[358,35],8:[359,96],9:[459,111],10:[560,161]}};
const DESIGN_NOBUNDLE={typ:{9:[85,43],10:[84,50]},slow:{9:[105,95],10:[98,102]}};
function endReport(runs,only,stamps){
  const med=a=>{const x=a.filter(Number.isFinite).sort((p,q)=>p-q);return x.length?x[x.length>>1]:NaN},pq=(a,p)=>{const x=a.filter(Number.isFinite).sort((u,v)=>u-v);return x.length?x[Math.min(x.length-1,Math.floor(p*x.length))]:NaN};
  const f=(x,d=0)=>Number.isFinite(x)?x.toFixed(d):'-',pct=(x,y)=>Number.isFinite(x)&&y?(x>=y?'+':'')+Math.round((x/y-1)*100)+'%':'-',within=(x,y)=>Number.isFinite(x)&&Math.abs(x/y-1)<=.2;
  const NAME={typ:'보통(85%)',slow:'느린(×1.8, 75%)',fast:'빠른(×0.62, 95%)',guess:'찍기'},t0=Date.now();let inQ=0,inM=0,cells=0,collapses=0,total=0;
  console.log('== 0.12 엔딩까지 시뮬: 나이 × 아이 유형, '+runs+'판씩(씨앗 1000 + 7919i)'+(stamps?', 도장 '+stamps+'개로 시작':'')+'. 아이 읽기 속도·정확도·사는 방식은 모두 가정값');
  console.log('| 나이 | 아이 | 엔딩까지 문제(p25~p75) | 분 | 설계 v2 | 문제 차 | 분 차 | ±20% | 10분 붕괴 | 회관 1·2·3(문제) | 종(문제) | 결전 문제·분 | 여우 구출 | 잃은 닭 | 무리 간격 |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for(const age of Q.AGES)for(const kind of ['typ','slow','fast','guess']){
    if(only&&!String(age).includes(only)&&only!==kind)continue;
    const rs=Array.from({length:runs},(_,i)=>playEnd(age,kind,1000+7919*i,{stamps})),done=rs.filter(r=>r.ended),D=DESIGN[kind][age];
    const q=med(done.map(r=>r.ended.q)),m=med(done.map(r=>r.ended.min)),col=rs.filter(r=>r.collapse).length,okQ=within(q,D[0]),okM=within(m,D[1]);
    const fox=rs.reduce((a,r)=>a+r.fox,0),saved=rs.reduce((a,r)=>a+r.foxSaved,0);
    cells++;if(okQ)inQ++;if(okM)inM++;collapses+=col;total+=rs.length;
    const nb=DESIGN_NOBUNDLE[kind]&&DESIGN_NOBUNDLE[kind][age];
    console.log(`| ${age}세 | ${NAME[kind]} | ${f(q)} (${f(pq(done.map(r=>r.ended.q),.25))}~${f(pq(done.map(r=>r.ended.q),.75))})${done.length<rs.length?' · 못 감 '+(rs.length-done.length)+'판':''} | ${f(m,1)} | ${D[0]} · ${D[1]}분${nb?' (묶음 없음 '+nb[0]+' · '+nb[1]+'분)':''} | ${pct(q,D[0])} | ${pct(m,D[1])}${nb?' ('+pct(m,nb[1])+')':''} | ${okQ?'○':'✗'}${okM?'○':'✗'} | ${col}/${rs.length}${rs.some(r=>r.weak)?' (거의 못 자람 '+rs.filter(r=>r.weak).length+')':''} | ${['h1','h2','h3'].map(k=>f(med(rs.map(r=>r.ms[k]?r.ms[k].q:NaN)))).join(' · ')} | ${f(med(rs.map(r=>r.ms.bell?r.ms.bell.q:NaN)))} | ${f(med(done.map(r=>r.ended.finaleQ)))} · ${f(med(done.map(r=>r.ended.finaleMin)),1)} | ${fox?Math.round(100*saved/fox)+'% ('+saved+'/'+fox+')':'-'} | ${f(med(rs.map(r=>r.henLost)))} | ${f(rs[0].interval/10,1)}초 |`);
  }
  console.log(`설계 v2 표와 ±20% 안: 문제 수 ${inQ}/${cells}칸, 분 ${inM}/${cells}칸 · 10분 붕괴 ${collapses}/${total}판 (${((Date.now()-t0)/1000).toFixed(0)}초)`);
}
/* 평균: 숫자는 평균, 객체(at·gaps·line)는 같은 열쇠끼리 평균 */
const mean=list=>{const add=(acc,o)=>{for(const k in o){if(typeof o[k]==='number')acc[k]=(acc[k]||0)+o[k]/list.length;else if(o[k]&&typeof o[k]==='object')add(acc[k]||(acc[k]={}),o[k])}return acc};return list.reduce((acc,o)=>add(acc,o),{})};
if(require.main===module&&process.argv[2]==='end'){endReport(Number(process.argv[3])||12,process.argv[4]&&process.argv[4]!=='-'?process.argv[4]:'',Number(process.argv[5])||0)}
else if(require.main===module){
const MARKS=marksFor(MIN),GAPS=gapsFor(MIN);
const f=(x,d=0)=>x===undefined||Number.isNaN(x)?'-':x.toFixed(d);
const res={};
const t0=Date.now();
console.log(`== ${MIN}분 × ${RUNS}회 평균. 지음 = 가진 상품 수(끝이 있는 81개 중, Combat.built), 산횟수 = 끝이 있는 상품을 산 횟수(물려 간 닭을 다시 산 것 포함)`);
console.log('   최장 = 아무것도 사지 않은 가장 긴 구간(초, 0~10/0~20/0~40분, 고치기·잔치 포함), 살 것 없음 = 살 수 있는 상품이 하나도 없던 가장 긴 구간(기획서 "못 산"), 잃은닭·부서짐(진짜 건물)·구한닭 = 20분까지/끝까지, 보임·마을 = 늑대가 보이는/마을 안에 있는 시간 비율');
for(const a of Q.AGES)for(const m of Q.MODES)for(const k of KIDS){
  if(ONLY&&!(a+m).includes(ONLY)&&ONLY!==k)continue;
  const r=mean(Array.from({length:RUNS},()=>play(a,m,k)));res[a+m+k]=r;
  const A=r.at,pick=(mm,key,d=0)=>A[mm]?f(A[mm][key],d):'-',ms=[10,20,40].filter(x=>A[x]);
  console.log(`${a}세 ${m.padEnd(5)} ${k.padEnd(5)} 지음 ${ms.map(x=>pick(x,'built',1)).join('/')} 산횟수 ${ms.map(x=>pick(x,'bought',1)).join('/')} 회관 ${ms.map(x=>pick(x,'hall',1)).join('/')} 닭 ${ms.map(x=>pick(x,'chickens',1)).join('/')} 타워 ${ms.map(x=>pick(x,'towers',1)).join('/')}`+
    ` 최장 ${GAPS.map(x=>f(r.gaps[x])).join('/')}초(살 것 없음 ${GAPS.map(x=>f(r.poor[x])).join('/')}) 잃은닭 ${pick(20,'henLost',1)}/${f(r.henLost,1)} 부서짐 ${pick(20,'broken',1)}/${f(r.broken,1)} 구한닭 ${pick(20,'henSaved',1)}/${f(r.henSaved,1)} 보임 ${f(r.seenPct)}% 마을 ${f(r.insidePct)}%`+
    ` 무리 ${f(r.maxPack)} 동시 ${f(r.maxWolves)} 말풍선 ${f(r.bubblesPerMin,2)}/분 둥지 ${f(r.nest,1)} 정답 ${f(r.correct)}/${f(r.qn)} 고치기 ${f(r.repairs,1)} 잔치 ${f(r.feasts,1)}`);
  console.log('   5분표(지음/회관/금화) '+MARKS.map(x=>x+'분 '+pick(x,'built')+'/'+pick(x,'hall')+'/'+pick(x,'gold')).join(' · ')+'  |  끝: 강화 '+f(A[MIN].power,1)+' 울타리 '+f(A[MIN].fence,1)+' 농부 '+f(1+A[MIN].farmers,1)+' 연못 '+f(A[MIN].pond,1)+' 위협 '+f(r.threat,1));
}
/* §4.7 목표표 대조(보통 아이, 나이·모드별). 20분 기준 유형 비교: 느린 ≥ 보통의 60%, 찍기 ≤ 보통의 50% 그리고 < 느린 */
const T={built:{10:[15,20],20:[30,40],40:[60,70]},hall:{10:1,20:2,40:3},hens:{10:[6,8],20:[10,14],40:[18,20]},gap:{10:90,20:90,40:120}};
const ok=(x,lo,hi)=>x>=lo&&x<=hi?' OK':' NG';
console.log('\n== §4.7 목표 대조 (보통 아이). OK/NG');
const tally={ok:0,n:0},mark=s=>{tally.n++;if(s===' OK')tally.ok++;return s};
for(const a of Q.AGES)for(const m of Q.MODES){
  const typ=res[a+m+'typ'];if(!typ)continue;const slow=res[a+m+'slow'],guess=res[a+m+'guess'],A=typ.at,out=[];
  for(const x of [10,20,40])if(A[x]){const b=A[x].built,h=A[x].hall,c=A[x].chickens;out.push(`${x}분 지음 ${f(b,1)}${mark(ok(b,...T.built[x]))} 회관 ${f(h,1)}${mark(Math.round(h)===T.hall[x]?' OK':' NG')} 닭 ${f(c,1)}${mark(ok(c,...T.hens[x]))} 못 산 ${f(typ.poor[x])}초${mark(ok(typ.poor[x],0,T.gap[x]))}(산 사이 ${f(typ.gaps[x])})`)}
  if(A[20])out.push(`20분 잃은닭 ${f(A[20].henLost,1)}${mark(ok(A[20].henLost,0,3))} 부서짐 ${f(A[20].broken,1)}${mark(ok(A[20].broken,2,6))} 구한닭 ${f(A[20].henSaved,1)}${mark(ok(A[20].henSaved,3,8))}`);
  const mm=A[20]?20:MIN,tb=A[mm].built;
  if(slow&&guess){const sb=slow.at[mm].built,gb=guess.at[mm].built;out.push(`${mm}분 느린 ${f(sb,1)}(${f(sb/tb*100)}%${mark(sb>=.6*tb?' OK':' NG')}) 찍기 ${f(gb,1)}(${f(gb/tb*100)}%${mark(gb<=.5*tb&&gb<sb?' OK':' NG')})`)}
  out.push(`보임 ${f(typ.seenPct)}%${mark(ok(typ.seenPct,95,100))} 마을 ${f(typ.insidePct)}%${mark(ok(typ.insidePct,50,80))} 말풍선 ${f(typ.bubblesPerMin,2)}/분${mark(ok(typ.bubblesPerMin,0,2))}`);
  console.log(`${a}세 ${m.padEnd(5)} `+out.join(' | '));
}
console.log(`목표 충족 ${tally.ok}/${tally.n} (${((Date.now()-t0)/1000).toFixed(0)}초)`);
}
module.exports={play,playEnd,endReport,mean,reseed:n=>{seed=n},C,W,Q,KIDS};
