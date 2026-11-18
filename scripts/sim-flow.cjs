/* 0.13 흐르는 농장 시뮬레이터: 실제 규칙(combat.js · world.js)을 그대로 돌려 엔딩까지의 문제 수, 방치·찍기 이득, 일손 부족(쌓임) 시간, 농부 한계 수입을 잰다.
   node scripts/sim-flow.cjs end  [판 수=12] [나이들=7,8,9,10] [아이들] [상수 덮어쓰기 JSON]   엔딩까지(방치·틀리기만은 30분)
   node scripts/sim-flow.cjs farm [나이들=8] [상수 덮어쓰기 JSON]                                농부 1~10명의 문제당 금화(닭 20 · 회관 3 고정, 늑대 없음)
   덮어쓰기 JSON 예: '{"FLOW":false}'(0.12 기준선) · '{"W":{"carry":4.5},"C":{"paceFloor":100}}'(World.FLOW · Combat.FLOW 상수)
   아이 모형은 가정값이다(실제 아이 측정이 아님): 보통 · 느린(1.8배) · 빠른(0.62배) · 찍기 · 방치 · 방치(상점만) · 틀리기만 · 아주 느린(2.2배) · 농부 안 삼 · 아무거나 삼.
   0.14: 단계(농가→성) 도달 문제 수, 길(출현 지점)별 늑대 유입, 잃은 닭을 함께 잰다. 단계가 오르는 구매는 화면처럼 그 문제를 답한 순간에 세계에 반영한다(World.sync hold).
     기준선(0.13.2): '{"FLAGS":{"STAGES":false,"ROUTES":false}}'
   봇은 추천 말풍선을 따르고, 한 번에 맞힐 때마다 하나를 산다(sim-village.cjs playEnd와 같은 방식). 결과 정본: docs/game-plan.md §13 */
const path=require('node:path'),ROOT=path.join(__dirname,'..');
const C=require(path.join(ROOT,'combat.js')),W=require(path.join(ROOT,'world.js')),Q=require(path.join(ROOT,'questions.js'));
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
  let s=C.fresh(age);const flowing=C.flowOn(s);
  const w=W.sync(W.create({seed:Math.floor(rnd()*2147483646)+1,interval:W.tempoInterval(meanBase(age,s.seed)),guard:true}),s);
  if(flowing)W.flowOn(w);
  const clock=()=>w.t*W.TICK;let qn=0,phaseQuiet=false,shopLock=0,minHen10=s.chickens,ended=null,finale=null,earned=0,first=0,reading=false,fenceHits=0;
  const st={ticks:0,pile:0,full:0,boost:0,read:0,readLow:0,late:0,latePile:0,lateFull:0,sold:0,eggGold:0,credit:0,laid:0,tries:0,poor:0},snaps={},ms={};
  const mark=k=>{if(!ms[k])ms[k]={q:qn,min:clock()/60}};
  /* 0.14: 길별 유입(1단계부터)과 단계 도달. release = 문제 사이에 단계를 세계에 반영(화면의 stageRelease와 같은 때) */
  const inflow=Array(W.SPAWNS).fill(0);let inflowN=0;
  const release=()=>{W.sync(w,s);if(Number.isSafeInteger(w.stage))for(let k=1;k<=w.stage;k++)mark('s'+k)};
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
      if(e.type==='henLost'){C.lostHen(s);rec.lostAt=w.t;ask(true)}
      else if(e.type==='foxLost'||e.type==='foxScare')C.foxEnded(s,false);
      else if(e.type==='kill'&&e.boss)s.gold+=C.BOUNTY;
      else if(e.type==='sold'){s.marketDown=W.marketDown(w);st.eggGold+=C.sellEggs(s,e.n);st.sold+=e.n}
      else if(e.type==='laid')st.laid++;
      else if(e.type==='pack'&&w.stage>0){for(let i=0;i<e.n;i++)inflow[e.points[i%e.points.length]]++;inflowN+=e.n}
      else if(e.type==='straggler'&&w.stage>0){inflow[e.point]+=e.n;inflowN+=e.n}
      else if(e.type==='broken'){if(e.kind==='fence')fenceHits++;else{s.broken=W.brokenCount(w);s.marketDown=W.marketDown(w);ask(true)}}}
    earned+=s.gold-g0;st.ticks++;
    if(w.flow){const f=w.flow,yard=W.flowYard(w),hens=W.flowLayers(w);if(yard>=Math.max(2,hens))st.pile++;if(yard>=W.flowCap(w))st.full++;if(f.boost.left>0)st.boost++;if((s.farmers|0)>=9){st.late++;if(yard>=Math.max(2,hens))st.latePile++;if(yard>=W.flowCap(w))st.lateFull++}
      if(reading){st.read++;if(f.rate*f.beat<.25||f.credit<=0)st.readLow++}}
    if(shopLock>0)shopLock--;recTick();
    if(clock()<=600&&s.chickens<minHen10)minHen10=s.chickens;
    for(const m of [10,20,30])if(!snaps[m]&&clock()>=m*60)snaps[m]={built:C.built(s),earned,q:qn,fenceHits}}
  const run=sec=>{for(let i=0,n=Math.round(sec/W.TICK);i<n;i++)stepOnce()};
  const marks=()=>{if(s.run.bell>=1)mark('bell')};
  function buyOne(){
    s.broken=W.brokenCount(w);s.marketDown=W.marketDown(w);if(shopLock>0)return 0;
    const rows=C.shopKeys(s).filter(x=>x!=='bell'&&C.canBuy(s,x)&&!(kind==='nofarmer'&&x==='farmer'));st.tries++;if(!rows.length){st.poor++;return 0}
    const key=kind==='randbuy'?rows[Math.floor(rnd()*rows.length)]:rec.glow&&rows.includes(rec.glow)?rec.glow:CHEAP.find(c=>rows.includes(c));if(!key)return 0;
    C.buy(s,key);if(rec.prev&&rec.prev.key===key)rec.prev.followed=true;if(rec.glow===key){rec.glow=null;if(rec.bubble&&rec.bubble.key===key)rec.bubble=null}
    if(key==='repair')W.repairAll(w);W.sync(w,s,{hold:true});s.broken=W.brokenCount(w);s.marketDown=W.marketDown(w);shopLock=4;run(.5);marks();return 1}
  const kidTime=(q,firstTry)=>{const lock=Math.max(3,C.reveal(q))/10;if(kind==='guess'||kind==='wrong')return firstTry?lock+.4:.4;const need=C.needSeconds(q)*SPEEDK[kind]*(.75+rnd()*.5);return firstTry?Math.max(lock+.4,need):Math.max(.4,need*.35)};
  const done=()=>({lost:s.run.lost,stage:w.stage,topRoute:inflowN?100*Math.max(...inflow)/inflowN:NaN,ended,qn,min:clock()/60,ms,collapse:minHen10===0,snaps,earned,first,built:C.built(s),hens:s.chickens,farmers:1+s.farmers,gold:s.gold,st,fenceHits,yard:W.flowYard(w),credit:w.flow?w.flow.credit:0});
  if(kind==='idle'||kind==='idleBuy'){
    if(flowing)W.flowQuestion(w,C.beatTicks(s,Q.at(age,mode,0,s.seed)));
    const end=(o.idleMin||30)*60;while(clock()<end){run(3);if(kind==='idleBuy'){ask(false);buyOne()}}
    return Object.assign(done(),{idle:true});
  }
  while(qn<QMAX&&clock()<MINMAX*60&&!ended){
    if(s.run.bell===1){C.ringBell(s,{rnd,idOf:i=>Q.at(age,mode,i,s.seed).id});W.king(w,'fight',0);finale={q0:qn,t0:clock()};mark('ring')}
    const fin=C.finaleNow(s),q=Q.at(age,mode,fin?fin.index:s.index,s.seed),n=q.choices.length;qn++;
    if(flowing)W.flowQuestion(w,C.beatTicks(s,q));
    if(!fin&&!w.fox&&C.foxDue(s)){W.fox(w,s,C.foxTicks(s,q),{scare:C.foxScareOnly(s)});C.foxCame(s)}
    const t=kidTime(q,true),lock=Math.max(3,C.reveal(q))/10,ok1=kind==='wrong'?false:kind==='guess'?rnd()<1/n:rnd()<ACC1[kind];
    reading=true;phaseQuiet=true;run(Math.min(t,lock));phaseQuiet=flowing; /* 흐름: 읽는 동안에는 새 말풍선이 뜨지 않는다 */
    if(t>20&&!fin&&rnd()<.5){run((t-lock)/2);buyOne();run((t-lock)/2)}else run(Math.max(0,t-lock));
    reading=false;phaseQuiet=false;
    const ticks=Math.round(t/W.TICK);
    if(ok1){
      const fast=C.isFast(q,ticks);s.marketDown=W.marketDown(w);const g0=s.gold,res=C.settle(s,q,'first',{fast,ticks,finale:!!fin});earned+=s.gold-g0;first++;
      const fz=fin?C.finaleSettle(s,'first',{}):null;if(!fin||fin.normal)s.index++;
      if(res.flow){const nf=C.finaleNow(s),nq=Q.at(age,mode,nf?nf.index:s.index,s.seed);W.flowCorrect(w,res.flow.credit,res.flow.boost,C.beatTicks(s,nq));st.credit+=res.flow.credit}
      W.answered(w);W.volley(w,s,{scale:C.scale(q),fast});release();if(W.foxShoo(w))C.foxEnded(s,true);
      if(fz){W.kingHit(w);if(fz.won){W.king(w,'flee');W.retreat(w,-1);ended={q:qn,min:clock()/60,finaleQ:qn-finale.q0}}}
      ask(false);run(.6);if(!fin)for(let b=0;b<(o.buys||1);b++){if(b)run(.4);buyOne()}run(.6);
    }else{
      C.trackPace(s,q,ticks);W.answered(w);run(W.dashTicks(w)*W.TICK+.2);run(kidTime(q,false));
      const ok2=kind==='wrong'?false:kind==='guess'?rnd()<1/(n-1):rnd()<.8;
      if(ok2){C.settle(s,q,'second',{finale:!!fin});if(C.FOX.second&&W.foxShoo(w))C.foxEnded(s,true);if(fin)C.finaleSettle(s,'second')}
      else{s.misses++;s.streak=0;C.track(s,q,'miss',{finale:!!fin});if(fin){const fz=C.finaleSettle(s,'miss');if(fz&&fz.stepped)W.king(w,'fight',s.run.steps)}}
      release();if(flowing||kind==='wrong'||kind==='guess')ask(false);run(C.learnTicks(q)*C.TICK+.2);if(kind==='wrong'||kind==='guess')buyOne();
      if(!fin||fin.normal)s.index++;
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
  console.log('| 나이 | 아이 | 엔딩 문제(p25~p75) | 분 | 10분 붕괴 | 금화/문제 | 10분 지음 | 20분 지음 | 쌓임(알≥닭) | 꽉 참 | 신바람 | 읽는 중 닭이 쉼 | 농부 다 산 뒤 쌓임·꽉 참 | 끝 농부 | 못 산 횟수 | 20분까지 울타리 부서짐 | 잃은 닭 | 단계 도달 문제(마을·장터·물레방아·성곽·성) | 첫 단계(분) | 가장 붐빈 길 |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for(const age of ages)for(const kind of kinds){
    const rs=Array.from({length:runs},(_,i)=>playEnd(age,kind,1000+7919*i,opt)),dn=rs.filter(r=>r.ended),qs=dn.map(r=>r.ended.q).sort((a,b)=>a-b),q=med(qs);
    const fs=k=>avg(rs.map(r=>r.st.ticks?100*r.st[k]/r.st.ticks:NaN)),bl=m=>avg(rs.map(r=>r.snaps[m]?r.snaps[m].built:(r.ended?NaN:r.built)));
    const idle=kind==='idle'||kind==='idleBuy'||kind==='wrong';
    const row=out[age+kind]={q,gpq:avg(rs.map(r=>r.idle?NaN:r.earned/r.qn)),gpm:avg(rs.map(r=>r.earned/r.min)),b10:bl(10),earned:avg(rs.map(r=>r.earned)),built:avg(rs.map(r=>r.built)),undone:rs.length-dn.length,col:rs.filter(r=>r.collapse).length,min:med(dn.map(r=>r.ended.min)),lost:avg(rs.map(r=>r.lost)),s1:med(rs.map(r=>r.ms.s1?r.ms.s1.min:NaN))};
    const sq=[1,2,3,4,5].map(k=>f(med(rs.map(r=>r.ms['s'+k]?r.ms['s'+k].q:NaN)))).join('·');
    console.log(`| ${age}세 | ${NAME[kind]} | ${idle?'30분 금화 '+f(row.earned)+' · 지음 '+f(row.built,1)+' · 남은 알 '+f(avg(rs.map(r=>r.yard)),1):f(q)+' ('+f(qs[Math.floor(qs.length*.25)])+'~'+f(qs[Math.floor(qs.length*.75)])+')'+(row.undone?' 못 감 '+row.undone:'')} | ${idle?'-':f(med(dn.map(r=>r.ended.min)),1)} | ${idle?'-':row.col+'/'+rs.length} | ${f(row.gpq,1)} | ${f(row.b10,1)} | ${f(bl(20),1)} | ${f(fs('pile'))}% | ${f(fs('full'))}% | ${f(fs('boost'))}% | ${f(avg(rs.map(r=>r.st.read?100*r.st.readLow/r.st.read:NaN)))}% | ${f(avg(rs.map(r=>r.st.late?100*r.st.latePile/r.st.late:NaN)))}%·${f(avg(rs.map(r=>r.st.late?100*r.st.lateFull/r.st.late:NaN)))}% | ${f(avg(rs.map(r=>r.farmers)),1)} | ${f(avg(rs.map(r=>r.st.poor)),1)} | ${f(avg(rs.map(r=>r.snaps[20]?r.snaps[20].fenceHits:NaN)),1)} | ${f(row.lost,1)} | ${sq} | ${f(row.s1,1)} | ${f(avg(rs.map(r=>r.topRoute)))}% |`);
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
module.exports={playEnd,endReport,farm,farmReport,apply,C,W,Q,NAME,ALL,med,avg,f};
if(require.main===module){
  const a=process.argv.slice(2),cmd=a[0]||'end',t0=Date.now(),json=a.find(x=>x.startsWith('{')),rest=a.slice(1).filter(x=>!x.startsWith('{'));
  const over=json?JSON.parse(json):{};apply(over);
  console.log(`== ${cmd} · STAGES ${C.FLAGS.STAGES} · ROUTES ${C.FLAGS.ROUTES} · 단계 문턱 ${JSON.stringify(C.FLAGS.STAGE_AT)} · 종 ${C.FLAGS.BELL_BUILT} ${JSON.stringify(C.FLAGS.STAGE_BELL_BY_AGE)} · 반지름 ${JSON.stringify(W.STAGE.radius)}`);
  console.log(`== ${cmd} · FLOW ${C.FLAGS.FLOW} · Combat.FLOW ${JSON.stringify(C.FLOW)} · World.FLOW ${JSON.stringify(W.FLOW)}`);
  if(cmd==='farm')farmReport(rest[0]?rest[0].split(',').map(Number):[8]);
  else endReport(Number(rest[0])||12,rest[1]?rest[1].split(',').map(Number):Q.AGES,rest[2]?rest[2].split(','):ALL,{buys:over.buys});
  console.log(`(${((Date.now()-t0)/1000).toFixed(0)}초)`);
}
