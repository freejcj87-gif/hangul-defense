/* 0.13 흐르는 농장 시뮬레이터: 실제 규칙(combat.js · world.js)을 그대로 돌려 엔딩까지의 문제 수, 방치·찍기 이득, 일손 부족(쌓임) 시간, 농부 한계 수입을 잰다.
   node scripts/sim-flow.cjs end  [판 수=12] [나이들=7,8,9,10] [아이들] [상수 덮어쓰기 JSON]   엔딩까지(방치·틀리기만은 30분)
   node scripts/sim-flow.cjs farm [나이들=8] [상수 덮어쓰기 JSON]                                농부 1~10명의 문제당 금화(닭 20 · 회관 3 고정, 늑대 없음)
   덮어쓰기 JSON 예: '{"FLOW":false}'(0.12 기준선) · '{"W":{"carry":4.5},"C":{"paceFloor":100}}'(World.FLOW · Combat.FLOW 상수)
   아이 모형은 가정값이다(실제 아이 측정이 아님): 보통 · 느린(1.8배) · 빠른(0.62배) · 찍기 · 방치 · 방치(상점만) · 틀리기만 · 아주 느린(2.2배) · 농부 안 삼 · 아무거나 삼.
   0.14: 단계(농가→성) 도달 문제 수, 길(출현 지점)별 늑대 유입, 잃은 닭을 함께 잰다. 0.15: 맨 끝 두 열 = 20분까지 울타리 면별 부서짐, 다리 길(6번) 유입 %(기준선 '{"FLAGS":{"BRIDGE":false}}' = 0.14).
     단계가 오르는 구매는 화면과 같은 때에 세계에 반영한다: 문제를 읽는 중(ask)에 산 것만 보류했다가(World.sync hold) 그 문제를 답한 순간에 풀고,
     정답 연출 · 정답 배우기 중(문제 사이)에 산 것은 바로 반영한다(화면의 stageRelease · buy). 0.15에서 고침(리뷰 v014 2번): 0.14 시뮬은 문제 사이 구매까지
     보류해 다음 답에 반영해서 단계 도달이 약 1문제, 첫 전환이 0.5~0.7분 늦게 잡혔다.
     기준선(0.13.2): '{"FLAGS":{"STAGES":false,"ROUTES":false}}'
   봇은 추천 말풍선을 따르고, 한 번에 맞힐 때마다 하나를 산다(sim-village.cjs playEnd와 같은 방식). 결과 정본: docs/game-plan.md §13 */
const path=require('node:path'),ROOT=path.join(__dirname,'..');
const C=require(path.join(ROOT,'combat.js')),W=require(path.join(ROOT,'world.js')),Q=require(path.join(ROOT,'questions.js'));
/* 수첩 MVP: book 명령이 쓰는 기록 규칙·쪽지 문항. playEnd의 opt.bk가 없으면 한 줄도 쓰지 않는다(0.15 시뮬과 같은 결과) */
const B=require(path.join(ROOT,'book.js')),N=require(path.join(ROOT,'notes.js'));
/* 문제은행 판 고르기: BANK=1 node scripts/sim-flow.cjs … (없으면 최신 판) */
if(process.env.BANK){const at=Q.at;Q.at=(a,m,i,s)=>at(a,m,i,s,+process.env.BANK)}
const mulberry=a=>()=>{a=(a+0x6D2B79F5)>>>0;let t=Math.imul(a^a>>>15,a|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296};
const SPEEDK={slow:1.8,typ:1,fast:.62,guess:1,wrong:1,vslow:2.2,nofarmer:1,randbuy:1},ACC1={slow:.75,typ:.85,fast:.95,vslow:.75,nofarmer:.85,randbuy:.85};
const CHEAP=['repair','chicken','tower','farmer','fence','power','pond','feast'];
const NAME={typ:'보통',slow:'느린',fast:'빠른',guess:'찍기',idle:'방치',idleBuy:'방치(상점만)',wrong:'틀리기만',vslow:'아주 느린',nofarmer:'농부 안 삼',randbuy:'아무거나 삼'};
const ALL=Object.keys(NAME);
const meanCache={};
function meanBase(age,seed){const k=age+':'+seed;if(!meanCache[k]){let sum=0;for(let i=0;i<120;i++)sum+=C.baseSeconds(Q.at(age,'story',i,seed));meanCache[k]=sum/120}return meanCache[k]}
function apply(over){const o=over||{};if('FLOW' in o)C.FLAGS.FLOW=!!o.FLOW;if(o.C)Object.assign(C.FLOW,o.C);if(o.W)Object.assign(W.FLOW,o.W);if(o.FLAGS)Object.assign(C.FLAGS,o.FLAGS);if(o.PAY)Object.assign(C.PAY,o.PAY);if(o.STAGE)Object.assign(W.STAGE,o.STAGE)}

/* 엔딩까지 한 판. opt.buys = 한 번에 맞힐 때마다 사는 횟수(기본 1) */
function playEnd(age,kind,seed,opt){
  const o=opt||{},rnd=mulberry(seed>>>0),mode='story',QMAX=o.qmax||600,MINMAX=o.minmax||200;
  let s=o.state||C.fresh(age);const flowing=C.flowOn(s);
  const bk=o.bk||null,now=()=>bk.t0+Math.round(w.t*W.TICK*1000);/* bk = {book, byId, t0, sp:[], boost} (수첩을 들고 도는 판) */
  const w=W.sync(W.create({seed:Math.floor(rnd()*2147483646)+1,interval:W.tempoInterval(meanBase(age,s.seed)),guard:true}),s);
  if(flowing)W.flowOn(w);
  const clock=()=>w.t*W.TICK;let qn=0,phaseQuiet=false,shopLock=0,minHen10=s.chickens,ended=null,finale=null,earned=0,first=0,reading=false,idling=false,fenceHits=0;
  const sideHits=Array(6).fill(0);   /* 0.15: 울타리 면(0~5)별 부서진 횟수(다리 길 한 줄이 한 면에 몰리는지) */
  const st={ticks:0,pile:0,full:0,boost:0,read:0,readLow:0,late:0,latePile:0,lateFull:0,sold:0,eggGold:0,credit:0,laid:0,tries:0,poor:0},snaps={},ms={};
  const mark=k=>{if(!ms[k])ms[k]={q:qn,min:clock()/60}};
  /* 0.14: 길별 유입(1단계부터)과 단계 도달. release = 문제 사이에 단계를 세계에 반영(화면의 stageRelease와 같은 때) */
  const inflow=Array(W.SPAWNS).fill(0);let inflowN=0;
  const markStages=()=>{if(Number.isSafeInteger(w.stage))for(let k=1;k<=w.stage;k++)mark('s'+k)};
  const release=()=>{W.sync(w,s);markStages()};
  const REC={show:35,gap:200,urgentGap:100,window:600,mute:600,stale:150,perMin:2,bellGap:600},rec={glow:null,bubble:null,left:0,last:-1e9,times:[],prev:null,ign:{},mute:{},want:null,opened:[],lostAt:-1e9,uiT:0,bellAt:-1e9};
  const ctx=()=>({wolvesInside:W.wolvesInside(w),towers:w.buildings.filter(b=>b.kind==='tower'&&!b.broken).length,lostHenRecently:w.t-rec.lostAt<=300,brokenKinds:W.brokenKinds(w),opened:rec.opened.slice(),bellQuiet:w.t-rec.bellAt<REC.bellGap,pile:W.flowPile(w)});
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
    const g0=s.gold;
    for(const e of W.step(w,s)){
      if(bk){if(e.type==='kill'&&e.by==='volley')B.volleyKill(bk.book,e.kind,{now:now()});else if(e.type==='shinyMet')B.shinyMet(bk.book,{now:now()})}
      if(e.type==='henLost'){C.lostHen(s);rec.lostAt=w.t;ask(true)}
      else if(e.type==='foxLost'||e.type==='foxScare')C.foxEnded(s,false);
      else if(e.type==='kill'&&e.boss)s.gold+=C.BOUNTY;
      else if(e.type==='sold'){s.marketDown=W.marketDown(w);st.eggGold+=C.sellEggs(s,e.n);st.sold+=e.n}
      else if(e.type==='laid')st.laid++;
      else if(e.type==='pack'&&w.stage>0){for(let i=0;i<e.n;i++)inflow[e.points[i%e.points.length]]++;inflowN+=e.n}
      else if(e.type==='straggler'&&w.stage>0){inflow[e.point]+=e.n;inflowN+=e.n}
      else if(e.type==='broken'){if(e.kind==='fence'){fenceHits++;const b=w.buildings.find(x=>x.id===e.building);if(b&&b.side>=0&&b.side<6)sideHits[b.side]++}else{s.broken=W.brokenCount(w);s.marketDown=W.marketDown(w);ask(true)}}}
    earned+=s.gold-g0;st.ticks++;if(bk&&st.ticks%10===0)B.tick(bk.book,now(),1);
    if(w.flow){const f=w.flow,yard=W.flowYard(w),hens=W.flowLayers(w);if(yard>=Math.max(2,hens))st.pile++;if(yard>=W.flowCap(w))st.full++;if(f.boost.left>0)st.boost++;if((s.farmers|0)>=9){st.late++;if(yard>=Math.max(2,hens))st.latePile++;if(yard>=W.flowCap(w))st.lateFull++}
      if(reading){st.read++;if(f.rate*f.beat<.25||f.credit<=0)st.readLow++}}
    if(shopLock>0)shopLock--;recTick();
    if(clock()<=600&&s.chickens<minHen10)minHen10=s.chickens;
    for(const m of [10,20,30])if(!snaps[m]&&clock()>=m*60)snaps[m]={built:C.built(s),earned,q:qn,fenceHits,sideHits:sideHits.slice()}}
  const run=sec=>{for(let i=0,n=Math.round(sec/W.TICK);i<n;i++)stepOnce()};
  const marks=()=>{if(s.run.bell>=1)mark('bell')};
  function buyOne(){
    s.broken=W.brokenCount(w);s.marketDown=W.marketDown(w);if(shopLock>0)return 0;
    const rows=C.shopKeys(s).filter(x=>x!=='bell'&&C.canBuy(s,x)&&!(kind==='nofarmer'&&x==='farmer'));st.tries++;if(!rows.length){st.poor++;return 0}
    const key=kind==='randbuy'?rows[Math.floor(rnd()*rows.length)]:rec.glow&&rows.includes(rec.glow)?rec.glow:CHEAP.find(c=>rows.includes(c));if(!key)return 0;
    C.buy(s,key);if(rec.prev&&rec.prev.key===key)rec.prev.followed=true;if(rec.glow===key){rec.glow=null;if(rec.bubble&&rec.bubble.key===key)rec.bubble=null}
    /* 읽는 중(그리고 방치 아이가 띄워 둔 문제)에만 보류, 문제 사이에 산 것은 바로(화면과 같음) */
    const held=reading||idling;if(key==='repair')W.repairAll(w);W.sync(w,s,{hold:held});if(!held)markStages();s.broken=W.brokenCount(w);s.marketDown=W.marketDown(w);shopLock=4;run(.5);marks();return 1}
  const kidTime=(q,firstTry)=>{const lock=Math.max(3,C.reveal(q))/10;if(kind==='guess'||kind==='wrong')return firstTry?lock+.4:.4;const need=C.needSeconds(q)*SPEEDK[kind]*(.75+rnd()*.5);return firstTry?Math.max(lock+.4,need):Math.max(.4,need*.35)};
  const done=()=>({lost:s.run.lost,stage:w.stage,topRoute:inflowN?100*Math.max(...inflow)/inflowN:NaN,bridgeRoute:inflowN?100*inflow[6]/inflowN:NaN,state:s,ended,qn,min:clock()/60,ms,collapse:minHen10===0,snaps,earned,first,built:C.built(s),hens:s.chickens,farmers:1+s.farmers,gold:s.gold,st,fenceHits,yard:W.flowYard(w),credit:w.flow?w.flow.credit:0});
  if(kind==='idle'||kind==='idleBuy'){
    idling=true;   /* 방치 아이는 첫 문제를 띄운 채 답하지 않는다: 산 것은 화면처럼 보류된 채 */
    if(flowing)W.flowQuestion(w,C.beatTicks(s,Q.at(age,mode,0,s.seed)));
    const end=(o.idleMin||30)*60;while(clock()<end){run(3);if(kind==='idleBuy'){ask(false);buyOne()}}
    return Object.assign(done(),{idle:true});
  }
  while(qn<QMAX&&clock()<MINMAX*60&&!ended){
    if(s.run.bell===1){C.ringBell(s,{rnd,idOf:i=>Q.at(age,mode,i,s.seed).id});W.king(w,'fight',0);finale={q0:qn,t0:clock()};mark('ring');if(bk){B.finaleStart(bk.book);W.guestGone(w)}}
    /* 수첩: 쪽지·기억 늑대는 문제 번호를 넘기지 않고 이 칸에 끼워 넣는다(화면의 makeRound와 같음) */
    const fin=C.finaleNow(s),sp=bk?B.nextSpecial(bk.book,{age,index:s.index|0,run:s.run.no|0,finale:!!fin,noteOf:N.get,byId:bk.byId}):null,q=sp?sp.q:Q.at(age,mode,fin?fin.index:s.index,s.seed),n=q.choices.length;qn++;
    if(sp)bk.sp.push({kind:sp.kind,id:sp.id,at:qn});
    if(flowing)W.flowQuestion(w,C.beatTicks(s,q));
    if(!fin&&!w.fox&&C.foxDue(s)){W.fox(w,s,C.foxTicks(s,q),{scare:C.foxScareOnly(s)});C.foxCame(s)}
    const t=kidTime(q,true),lock=Math.max(3,C.reveal(q))/10,ok1=kind==='wrong'?false:kind==='guess'?rnd()<1/n:rnd()<ACC1[kind]-(sp&&sp.kind==='review'?.15:0);/* 가정: 복습 글은 한 번 놓친 글이라 정답률 −0.15 */
    reading=true;phaseQuiet=true;run(Math.min(t,lock));phaseQuiet=flowing; /* 흐름: 읽는 동안에는 새 말풍선이 뜨지 않는다 */
    if(t>20&&!fin&&rnd()<.5){run((t-lock)/2);buyOne();run((t-lock)/2)}else run(Math.max(0,t-lock));
    reading=false;phaseQuiet=false;
    const ticks=Math.round(t/W.TICK);
    if(ok1){
      const fast=C.isFast(q,ticks);s.marketDown=W.marketDown(w);const g0=s.gold,res=C.settle(s,q,'first',{fast,ticks,finale:!!fin,extra:!!sp});earned+=s.gold-g0;first++;
      const fz=fin?C.finaleSettle(s,'first',{}):null;if(!sp&&(!fin||fin.normal))s.index++;
      if(res.flow){const nf=C.finaleNow(s),nq=Q.at(age,mode,nf?nf.index:s.index,s.seed);W.flowCorrect(w,res.flow.credit,res.flow.boost,C.beatTicks(s,nq));st.credit+=res.flow.credit}
      W.answered(w);W.volley(w,s,{scale:C.scale(q),fast});release();if(W.foxShoo(w)){C.foxEnded(s,true);if(bk)B.foxSaved(bk.book,{now:now()})}
      if(bk){const lv=res.flow?res.flow.boost|0:0,rose=lv>=2&&bk.boost<2;bk.boost=lv;
        const br=B.answered(bk.book,q,'first',{now:now(),age,run:s.run.no|0,special:sp&&sp.kind,finale:!!fin});if(rose)B.rushed(bk.book,{now:now()});
        if(w.guest)W.guestGreet(w);else{const kinds=W.kindsAt(w.hall|0).slice();if(C.FOX.on&&(s.run.fox|0)<C.FOX.at.length)kinds.push('fox');
          const c=B.shinyChance(bk.book,{run:s.run.no|0,asked:s.run.asked|0,boost2:lv>=2,kinds,finale:!!fin||s.run.bell>=2,free:false});if(c&&c.win&&W.guest(w,c.kind))B.shinySpawned(bk.book)}
        if(br.friend)run(1.3);/* 친구 카드 연출만큼 정답 연출이 길어짐 */}
      if(fz){W.kingHit(w);if(fz.won){if(bk)B.kingWon(bk.book,{now:now(),stars:C.stars(s),village:s.run.village,perfect:(s.run.fq|0)===C.FINALE.shields});W.king(w,'flee');W.retreat(w,-1);ended={q:qn,min:clock()/60,finaleQ:qn-finale.q0}}}
      ask(false);run(.6);if(!fin)for(let b=0;b<(o.buys||1);b++){if(b)run(.4);buyOne()}run(.6);
    }else{
      C.trackPace(s,q,ticks);W.answered(w);run(W.dashTicks(w)*W.TICK+.2);run(kidTime(q,false));
      const ok2=kind==='wrong'?false:kind==='guess'?rnd()<1/(n-1):rnd()<.8;
      if(bk){bk.boost=0;B.answered(bk.book,q,ok2?'second':'miss',{now:now(),age,run:s.run.no|0,special:sp&&sp.kind,finale:!!fin})}
      if(ok2){C.settle(s,q,'second',{finale:!!fin,extra:!!sp});if(C.FOX.second&&W.foxShoo(w)){C.foxEnded(s,true);if(bk)B.foxSaved(bk.book,{now:now()})}if(fin)C.finaleSettle(s,'second')}
      else{s.misses++;s.streak=0;C.track(s,q,'miss',{finale:!!fin,extra:!!sp});if(fin){const fz=C.finaleSettle(s,'miss');if(fz&&fz.stepped)W.king(w,'fight',s.run.steps)}}
      release();if(flowing||kind==='wrong'||kind==='guess')ask(false);run(C.learnTicks(q)*C.TICK+.2);if(kind==='wrong'||kind==='guess')buyOne();
      if(!sp&&(!fin||fin.normal))s.index++;
    }
    marks();
    if(kind==='wrong'&&clock()>=(o.idleMin||30)*60)break;
  }
  return done();
}

const med=a=>{const x=a.filter(Number.isFinite).sort((p,q)=>p-q);return x.length?x[x.length>>1]:NaN};
const avg=a=>{const x=a.filter(Number.isFinite);return x.length?x.reduce((p,q)=>p+q,0)/x.length:NaN};
const f=(x,d=0)=>Number.isFinite(x)?x.toFixed(d):'-';
function endReport(runs,ages,kinds,opt){
  const out={};
  console.log('| 나이 | 아이 | 엔딩 문제(p25~p75) | 분 | 10분 붕괴 | 금화/문제 | 10분 지음 | 20분 지음 | 쌓임(알≥닭) | 꽉 참 | 신바람 | 읽는 중 닭이 쉼 | 농부 다 산 뒤 쌓임·꽉 참 | 끝 농부 | 못 산 횟수 | 20분까지 울타리 부서짐 | 잃은 닭 | 단계 도달 문제(마을·장터·물레방아·성곽·성) | 첫 단계(분) | 가장 붐빈 길 | 20분까지 울타리 면별(0·1·2·3·4·5) | 다리 길(6번) 유입 |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for(const age of ages)for(const kind of kinds){
    const rs=Array.from({length:runs},(_,i)=>playEnd(age,kind,1000+7919*i,opt)),dn=rs.filter(r=>r.ended),qs=dn.map(r=>r.ended.q).sort((a,b)=>a-b),q=med(qs);
    const fs=k=>avg(rs.map(r=>r.st.ticks?100*r.st[k]/r.st.ticks:NaN)),bl=m=>avg(rs.map(r=>r.snaps[m]?r.snaps[m].built:(r.ended?NaN:r.built)));
    const idle=kind==='idle'||kind==='idleBuy'||kind==='wrong';
    const row=out[age+kind]={q,gpq:avg(rs.map(r=>r.idle?NaN:r.earned/r.qn)),gpm:avg(rs.map(r=>r.earned/r.min)),b10:bl(10),earned:avg(rs.map(r=>r.earned)),built:avg(rs.map(r=>r.built)),undone:rs.length-dn.length,col:rs.filter(r=>r.collapse).length,min:med(dn.map(r=>r.ended.min)),lost:avg(rs.map(r=>r.lost)),s1:med(rs.map(r=>r.ms.s1?r.ms.s1.min:NaN))};
    const sq=[1,2,3,4,5].map(k=>f(med(rs.map(r=>r.ms['s'+k]?r.ms['s'+k].q:NaN)))).join('·');
    console.log(`| ${age}세 | ${NAME[kind]} | ${idle?'30분 금화 '+f(row.earned)+' · 지음 '+f(row.built,1)+' · 남은 알 '+f(avg(rs.map(r=>r.yard)),1):f(q)+' ('+f(qs[Math.floor(qs.length*.25)])+'~'+f(qs[Math.floor(qs.length*.75)])+')'+(row.undone?' 못 감 '+row.undone:'')} | ${idle?'-':f(med(dn.map(r=>r.ended.min)),1)} | ${idle?'-':row.col+'/'+rs.length} | ${f(row.gpq,1)} | ${f(row.b10,1)} | ${f(bl(20),1)} | ${f(fs('pile'))}% | ${f(fs('full'))}% | ${f(fs('boost'))}% | ${f(avg(rs.map(r=>r.st.read?100*r.st.readLow/r.st.read:NaN)))}% | ${f(avg(rs.map(r=>r.st.late?100*r.st.latePile/r.st.late:NaN)))}%·${f(avg(rs.map(r=>r.st.late?100*r.st.lateFull/r.st.late:NaN)))}% | ${f(avg(rs.map(r=>r.farmers)),1)} | ${f(avg(rs.map(r=>r.st.poor)),1)} | ${f(avg(rs.map(r=>r.snaps[20]?r.snaps[20].fenceHits:NaN)),1)} | ${f(row.lost,1)} | ${sq} | ${f(row.s1,1)} | ${f(avg(rs.map(r=>r.topRoute)))}% | ${[0,1,2,3,4,5].map(k=>f(avg(rs.map(r=>r.snaps[20]?r.snaps[20].sideHits[k]:NaN)),1)).join('·')} | ${f(avg(rs.map(r=>r.bridgeRoute)),1)}% |`);
  }
  console.log('\n| 나이 | 느린 ÷ 보통(문제) | 빠른 ÷ 보통(문제) | 빠른 ÷ 보통(금화/문제) | 찍기 엔딩 ÷ 보통 | 찍기 10분 지음 ÷ 보통 | 방치·상점만·틀리기만 30분 금화 |');console.log('|---|---|---|---|---|---|---|');
  for(const age of ages){const g=k=>out[age+k]||{},t=g('typ');if(!t.q)continue;const pc=(x,y)=>Number.isFinite(x)&&y?f(100*x/y)+'%':'-';
    console.log(`| ${age}세 | ${pc(g('slow').q,t.q)} | ${pc(g('fast').q,t.q)} | ${pc(g('fast').gpq,t.gpq)} | ${g('guess').undone?'못 감 '+g('guess').undone+'판':f(g('guess').q/t.q,1)+'배'} | ${pc(g('guess').b10,t.b10)} | ${f(g('idle').earned)} · ${f(g('idleBuy').earned)} · ${f(g('wrong').earned)} |`)}
  return out;
}
/* 농부 1~10명의 문제당 금화: 닭 20 · 회관 3 고정, 늑대 없음, 사지 않음 */
function farm(age,kind,nq,seed){
  const rows=[];
  for(let men=1;men<=10;men++){
    const rnd=mulberry(seed>>>0),s=C.fresh(age);s.chickens=20;s.hall=3;s.farmers=men-1;s.pond=0;
    const w=W.sync(W.create({seed:7,interval:300}),s);w.peace=-1;if(C.flowOn(s))W.flowOn(w);
    const g0=s.gold;let pile=0,ticks=0;
    const run=sec=>{for(let i=0,n=Math.round(sec*10);i<n;i++){for(const e of W.step(w,s))if(e.type==='sold')C.sellEggs(s,e.n);ticks++;if(w.flow&&W.flowYard(w)>=20)pile++}};
    for(let i=0;i<nq;i++){
      const q=Q.at(age,'story',i,0),lock=Math.max(3,C.reveal(q))/10;if(w.flow)W.flowQuestion(w,C.beatTicks(s,q));
      const need=C.needSeconds(q)*SPEEDK[kind]*(.75+rnd()*.5),tt=Math.max(lock+.4,need),tk=Math.round(tt*10),ok=rnd()<ACC1[kind];
      run(tt);
      if(ok){const fast=C.isFast(q,tk),res=C.settle(s,q,'first',{fast,ticks:tk});s.index++;if(res.flow)W.flowCorrect(w,res.flow.credit,res.flow.boost,C.beatTicks(s,Q.at(age,'story',s.index,0)));run(1.2)}
      else{C.trackPace(s,q,tk);run(1);run(need*.35);if(rnd()<.8)C.settle(s,q,'second');else{s.misses++;s.streak=0}run(C.learnTicks(q)*C.TICK+.2);s.index++}
    }
    rows.push({men,gpq:(s.gold-g0)/nq,pile:100*pile/ticks});
  }
  return rows;
}
function farmReport(ages){
  console.log('| 나이·아이 | 1명 | '+Array.from({length:9},(_,i)=>(i+2)+'명째').join(' | ')+' | 쌓임%(1·3·5·7·10명) |');console.log('|---|'+'---|'.repeat(11));
  for(const age of ages)for(const kind of ['typ','slow','fast']){const r=farm(age,kind,200,4242);
    console.log(`| ${age}세 ${NAME[kind]} | ${f(r[0].gpq,1)} | `+r.slice(1).map((x,i)=>'+'+f(x.gpq-r[i].gpq,1)).join(' | ')+` | ${[0,2,4,6,9].map(i=>f(r[i].pile)).join('·')} |`)}
}
/* ---------- 수첩 MVP: 기록을 들고 판을 이어서 돈다(명세 §3.8 통과선 S1~S12) ----------
   node scripts/sim-flow.cjs book [판 수=30] [나이들=7,8,9,10] [아이들=typ,slow,fast,guess,idle,idleBuy,wrong] [덮어쓰기 JSON]
   판마다 엔딩(방치·틀리기만은 30분)까지 돌고 새 마을로 떠난다(Combat.nextRun + Book.newVillage, 하루에 한 판 가정). 같은 씨앗으로 수첩을 끈 줄(기준선)과 견준다.
   덮어쓰기 JSON의 "BOOK"은 Book.BOOK에 덮는다(예: '{"BOOK":{"REVIEW":{"share":0.15}}}'). 아이 모형은 가정값이다(실제 아이 측정이 아님).
   이어 순서(출제 순번 잇기)와 영어 비중 설정은 문제은행 판을 합친 뒤 연결하므로 여기서는 재지 않는다(S9 · S12 미측정) */
let QMAP=null;
function byId(id){if(!QMAP){QMAP=new Map();const s=Q.snapshot();for(const a of Q.AGES)for(const k of ['story','quiz'])for(const q of s[a][k])QMAP.set(q.id,q)}const q=QMAP.get(id);if(!q)return null;const o={...q,choices:q.choices.slice()};delete o.note;return o}
const DAY=86400000,T0=Date.UTC(2026,10,19,3);
function playBook(age,kind,plays,seed0,on){
  const rnd=mulberry((seed0^0x9e3779b9)>>>0),newSeed=()=>1+Math.floor(rnd()*2147483646),idle=kind==='idle'||kind==='idleBuy';
  let state=Object.assign(C.fresh(age),{seed:newSeed()}),t0=T0;state.run.t0=t0;
  const book=on?B.fresh(t0,state.seed):null;if(book)book.set.day=0;/* 하루 한 판 가정이라 하루 시간 멈춤은 끈다(멈춤은 판 길이와 무관) */
  const rows=[],mark={};
  for(let p=1;p<=plays;p++){
    const bk=book?{book,byId,t0,sp:[],boost:0}:null;if(book)B.beginSession(book,t0);
    const r=playEnd(age,kind,seed0+p*104729,{state,bk});
    const sp=bk?bk.sp:[],rv=sp.filter(x=>x.kind==='review'),nt=sp.filter(x=>x.kind==='note'),same={};rv.forEach(x=>same[x.id]=(same[x.id]||0)+1);
    let gap=Infinity;for(let i=1;i<sp.length;i++)gap=Math.min(gap,sp[i].at-sp[i-1].at-1);
    rows.push({q:r.ended?r.ended.q:NaN,min:r.ended?r.ended.min:NaN,gpm:r.earned/r.min,earned:r.earned,qn:r.qn,ended:!!r.ended,rv:rv.length,nt:nt.length,gap,same:Math.max(0,...Object.values(same)),
      cells:book?B.cells(book):0,cards:book?B.KINDS.filter(k=>book.mon[k].card>0).length:0,foot:book?B.KINDS.filter(k=>book.mon[k].foot>0).length:0,rib:book?B.KINDS.filter(k=>book.mon[k].rib.n>=B.BOOK.RIBBON.need).length:0,
      shiny:book?B.KINDS.filter(k=>book.mon[k].shiny>0).length:0,bronze:book?B.MEDALS.filter(k=>book.medal[k].at[0]>0).length:0,tiers:book?B.MEDALS.reduce((s,k)=>s+book.medal[k].at.filter(Boolean).length,0):0,rvLen:book?book.rv.length:0});
    if(book){const x=rows[rows.length-1];for(const [k,ok] of [['card8',x.cards>=8],['rib8',x.rib>=8],['full',x.cells>=B.CELLS]])if(ok&&!mark[k])mark[k]=p}
    if(idle||!r.ended){state=r.state;t0+=DAY;continue}/* 엔딩을 못 본 판은 같은 마을에서 이어 간다 */
    t0+=DAY;const next=C.nextRun(r.state,{seed:newSeed(),now:t0});if(!next){state=r.state;continue}
    if(book)B.newVillage(book,t0,{age});state=next;
  }
  return {rows,book,mark,size:book?JSON.stringify(book).length:0};
}
function bookReport(plays,ages,kinds,runs){
  const out={};
  console.log('| 나이 | 아이 | 엔딩 문제(수첩 ÷ 끔) | 분(수첩 · 끔) | 분당 금화(수첩 ÷ 끔) | 판당 복습 · 쪽지(최대) | 복습 비율 최대 | 특별 사이 최소 | 같은 글 최대 | 첫 판 발자국 · 훈장 동 | 카드 8장(판) | 리본 8개(판) | 32칸(판) | 반짝(20판 · 끝) | 끝: 칸 · 카드 · 훈장 단계 | 복습 대기열 최대 · 졸업 | 기록 크기 |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for(const age of ages)for(const kind of kinds){
    const on=[],off=[];for(let i=0;i<runs;i++){on.push(playBook(age,kind,plays,5000+7919*i,true));off.push(playBook(age,kind,plays,5000+7919*i,false))}
    const all=(list,k)=>list.flatMap(x=>x.rows.map(r=>r[k])),m=(list,k)=>med(all(list,k)),a=(list,k)=>avg(all(list,k)),idle=kind==='idle'||kind==='idleBuy'||kind==='wrong';
    const at=(k)=>med(on.map(x=>x.mark[k]||NaN)),lastRow=x=>x.rows[x.rows.length-1],row20=x=>x.rows[Math.min(19,x.rows.length-1)];
    const share=Math.max(...on.flatMap(x=>x.rows.map(r=>r.qn?r.rv/r.qn:0)));
    const row=out[age+kind]={q:m(on,'q')/m(off,'q'),min:m(on,'min'),min0:m(off,'min'),gpm:a(on,'gpm')/a(off,'gpm'),share,gap:Math.min(...all(on,'gap')),same:Math.max(...all(on,'same')),nt:Math.max(...all(on,'nt')),
      foot1:avg(on.map(x=>x.rows[0].foot)),bronze1:avg(on.map(x=>x.rows[0].bronze)),card8:at('card8'),rib8:at('rib8'),full:at('full'),shiny20:avg(on.map(x=>row20(x).shiny)),shinyEnd:avg(on.map(x=>lastRow(x).shiny)),
      cells:avg(on.map(x=>lastRow(x).cells)),cards:avg(on.map(x=>lastRow(x).cards)),tiers:avg(on.map(x=>lastRow(x).tiers)),rvMax:Math.max(...all(on,'rvLen')),grad:avg(on.map(x=>x.book.medal.again.n)),size:Math.max(...on.map(x=>x.size)),undone:all(on,'ended').filter(v=>!v).length};
    console.log(`| ${age}세 | ${NAME[kind]} | ${idle?'-':f(m(on,'q'))+' ÷ '+f(m(off,'q'))+' = '+f(100*row.q,1)+'% (평균 '+f(100*a(on,'q')/a(off,'q'),1)+'%)'+(row.undone?' (못 감 '+row.undone+')':'')} | ${idle?'-':f(row.min,1)+' · '+f(row.min0,1)+' (평균 '+f(100*a(on,'min')/a(off,'min'),1)+'%)'} | ${f(a(on,'gpm'),1)} ÷ ${f(a(off,'gpm'),1)} = ${f(100*row.gpm,1)}% | ${f(a(on,'rv'),1)} · ${f(a(on,'nt'),1)}(${row.nt}) | ${f(100*share,1)}% | ${Number.isFinite(row.gap)?row.gap:'-'} | ${row.same} | ${f(row.foot1,1)} · ${f(row.bronze1,1)} | ${f(row.card8)} | ${f(row.rib8)} | ${f(row.full)} | ${f(row.shiny20,1)} · ${f(row.shinyEnd,1)} | ${f(row.cells,1)} · ${f(row.cards,1)} · ${f(row.tiers,1)} | ${row.rvMax} · ${f(row.grad,1)} | ${(row.size/1024).toFixed(1)}KB |`);
  }
  /* S6: 찍기 아이의 수첩 칸(10판) ÷ 보통 아이 */
  for(const age of ages){const t=out[age+'typ'],g=out[age+'guess'],s=out[age+'slow'];if(t&&g)console.log(`${age}세 끝 수첩 칸: 보통 ${f(t.cells,1)} · 느린 ${s?f(s.cells,1):'-'} · 찍기 ${f(g.cells,1)} (찍기 ÷ 보통 = ${f(100*g.cells/t.cells)}%)`)}
  return out;
}
/* S8: 반짝 손님 규칙(결정적). 기회 3번 안에 반드시 1번, 첫 기회 당첨률 */
function shinyCheck(){
  let worst=0,win=0;const NUM=100000,ctx=r=>({run:r,asked:10,boost2:true,kinds:['wolf']});
  for(let s=1;s<=200;s++){const b=B.fresh(T0,s);let gap=0;for(let r=1;r<=300;r++){const c=B.shinyChance(b,ctx(r));gap=c.win?0:gap+1;worst=Math.max(worst,gap);b.shiny.pend=null}}
  for(let i=0;i<NUM;i++){const b=B.fresh(T0+i,i+1);if(B.shinyChance(b,ctx(1)).win)win++}
  console.log('반짝 손님: 이어진 꽝 최대 '+worst+'번(통과선 '+B.BOOK.SHINY.pity+'번 = 세 번째 확정) · 첫 기회 당첨률 '+(100*win/NUM).toFixed(2)+'% (통과선 '+(100*B.BOOK.SHINY.p)+'% ± 1%p, 모의 '+NUM+'번)');
}
function applyBook(over){const set=(dst,src)=>{for(const k of Object.keys(src)){if(src[k]&&typeof src[k]==='object'&&!Array.isArray(src[k])&&dst[k]&&typeof dst[k]==='object')set(dst[k],src[k]);else dst[k]=src[k]}};if(over&&over.BOOK)set(B.BOOK,over.BOOK)}
module.exports={playEnd,endReport,farm,farmReport,apply,playBook,bookReport,shinyCheck,applyBook,C,W,Q,B,NAME,ALL,med,avg,f};
if(require.main===module){
  const a=process.argv.slice(2),cmd=a[0]||'end',t0=Date.now(),json=a.find(x=>x.startsWith('{')),rest=a.slice(1).filter(x=>!x.startsWith('{'));
  const over=json?JSON.parse(json):{};apply(over);
  console.log(`== ${cmd} · STAGES ${C.FLAGS.STAGES} · ROUTES ${C.FLAGS.ROUTES} · 단계 문턱 ${JSON.stringify(C.FLAGS.STAGE_AT)} · 종 ${C.FLAGS.BELL_BUILT} ${JSON.stringify(C.FLAGS.STAGE_BELL_BY_AGE)} · 반지름 ${JSON.stringify(W.STAGE.radius)}`);
  console.log(`== ${cmd} · FLOW ${C.FLAGS.FLOW} · Combat.FLOW ${JSON.stringify(C.FLOW)} · World.FLOW ${JSON.stringify(W.FLOW)}`);
  if(cmd==='book'){applyBook(over);console.log('== book · Book.BOOK '+JSON.stringify({NOTE:{cap:B.BOOK.NOTE.cap,gap:B.BOOK.NOTE.gap,after:B.BOOK.NOTE.after},REVIEW:B.BOOK.REVIEW,SHINY:B.BOOK.SHINY,SPECIAL:B.BOOK.SPECIAL}));
    bookReport(Number(rest[0])||30,rest[1]?rest[1].split(',').map(Number):Q.AGES,rest[2]?rest[2].split(','):['typ','slow','fast','guess','idle','idleBuy','wrong'],Number(over.runs)||3);shinyCheck()}
  else if(cmd==='farm')farmReport(rest[0]?rest[0].split(',').map(Number):[8]);
  else endReport(Number(rest[0])||12,rest[1]?rest[1].split(',').map(Number):Q.AGES,rest[2]?rest[2].split(','):ALL,{buys:over.buys});
  console.log(`(${((Date.now()-t0)/1000).toFixed(0)}초)`);
}
