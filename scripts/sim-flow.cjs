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
   0.15.2: 두 번째 표(대형 표) = 대형 비율, 늑대마다 (울타리 줄에 닿은 때 ÷ 곧은 길로 왔을 때) 중앙, 따라 돌기 중 옆 면으로 간 비율, 20분까지 면별 부서짐 · 다시 세움, 가장 몰린 면 몫.
     대형 끔(= 0.15.1): '{"FLAGS":{"FORMS":false}}'
   봇은 추천 말풍선을 따르고, 한 번에 맞힐 때마다 하나를 산다(sim-village.cjs playEnd와 같은 방식). 결과 정본: docs/game-plan.md §13 */
const path=require('node:path'),ROOT=path.join(__dirname,'..');
const C=require(path.join(ROOT,'combat.js')),W=require(path.join(ROOT,'world.js')),Q=require(path.join(ROOT,'questions.js'));
/* 수첩 MVP: book 명령이 쓰는 기록 규칙·쪽지 문항. playEnd의 opt.bk가 없으면 한 줄도 쓰지 않는다(0.15 시뮬과 같은 결과) */
const B=require(path.join(ROOT,'book.js')),N=require(path.join(ROOT,'notes.js'));
/* 문제은행 판 고르기: BANK=1 node scripts/sim-flow.cjs … (없으면 최신 판) */
if(process.env.BANK){const at=Q.at;Q.at=(a,m,i,s,b,off)=>at(a,m,i,s,+process.env.BANK,off)}
const mulberry=a=>()=>{a=(a+0x6D2B79F5)>>>0;let t=Math.imul(a^a>>>15,a|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296};
const SPEEDK={slow:1.8,typ:1,fast:.62,guess:1,wrong:1,vslow:2.2,nofarmer:1,randbuy:1},ACC1={slow:.75,typ:.85,fast:.95,vslow:.75,nofarmer:.85,randbuy:.85};
const CHEAP=['repair','chicken','tower','farmer','fence','power','pond','feast'];
const NAME={typ:'보통',slow:'느린',fast:'빠른',guess:'찍기',idle:'방치',idleBuy:'방치(상점만)',wrong:'틀리기만',vslow:'아주 느린',nofarmer:'농부 안 삼',randbuy:'아무거나 삼'};
const ALL=Object.keys(NAME);
const meanCache={};
function meanBase(age,seed){const k=age+':'+seed;if(!meanCache[k]){let sum=0;for(let i=0;i<120;i++)sum+=C.baseSeconds(Q.at(age,'story',i,seed));meanCache[k]=sum/120}return meanCache[k]}
/* 0.17 성벽: '{"WALL":{"add":35}}'(World.WALL) · '{"SLOT_R":{"5":[10.5,14.5,17]}}'(World.SLOT_R) · 0.16 기준선 '{"FLAGS":{"WALLS":false,"TOWER_RING":false}}' */
function apply(over){const o=over||{};if('FLOW' in o)C.FLAGS.FLOW=!!o.FLOW;if(o.C)Object.assign(C.FLOW,o.C);if(o.W)Object.assign(W.FLOW,o.W);if(o.FLAGS)Object.assign(C.FLAGS,o.FLAGS);if(o.PAY)Object.assign(C.PAY,o.PAY);if(o.STAGE)Object.assign(W.STAGE,o.STAGE);if(o.FORM)Object.assign(W.FORM,o.FORM);
  if(o.WALL&&W.WALL)Object.assign(W.WALL,o.WALL);if(o.SLOT_R&&W.SLOT_R)Object.assign(W.SLOT_R,o.SLOT_R)}

/* 엔딩까지 한 판. opt.buys = 한 번에 맞힐 때마다 사는 횟수(기본 1) */
function playEnd(age,kind,seed,opt){
  const o=opt||{},rnd=mulberry(seed>>>0),mode='story',QMAX=o.qmax||600,MINMAX=o.minmax||200;
  let s=o.state||C.fresh(age);const flowing=C.flowOn(s);
  /* 이어 순서: 수첩을 든 판은 지난 판들이 쓴 만큼 묶음 순번을 민다(bk.off). 수첩이 없으면 0.15와 같은 호출 */
  const QA=i=>bk&&bk.off?Q.at(age,mode,i,s.seed,s.bank||undefined,bk.off):Q.at(age,mode,i,s.seed);
  const bk=o.bk||null,now=()=>bk.t0+Math.round(w.t*W.TICK*1000);/* bk = {book, byId, t0, sp:[], boost} (수첩을 들고 도는 판) */
  const w=W.sync(W.create({seed:Math.floor(rnd()*2147483646)+1,interval:W.tempoInterval(meanBase(age,s.seed)),guard:true}),s);
  if(flowing)W.flowOn(w);
  const clock=()=>w.t*W.TICK;let qn=0,phaseQuiet=false,shopLock=0,minHen10=s.chickens,ended=null,finale=null,earned=0,first=0,reading=false,idling=false,fenceHits=0;
  const sideHits=Array(6).fill(0);   /* 0.15: 울타리 면(0~5)별 부서진 횟수(다리 길 한 줄이 한 면에 몰리는지) */
  /* 0.15.2 무리 대형: 단계 1부터 나온 늑대의 대형별 수, 울타리 줄에 닿은 늑대의 (닿은 틱 ÷ 곧은 길 틱), 따라 돌기 중 다른 면으로 간 수, 면별 다시 세움 */
  const sideRebuilt=Array(6).fill(0),forms={n:[0,0,0,0],ratio:[[],[],[],[]],circle:0,away:0},walkers=[];let lastId=0;
  /* 0.17 성벽 표: 단계 4(성곽 마을)에 들어선 틱, 그 뒤 울타리(성벽) · 건물 부서짐, 성벽을 처음 두드린 자리(성문 폭 안 · 성탑 옆 · 그 밖 성벽, 모두 · 따라 돌기 늑대).
     규칙에는 손대지 않는다(세는 것만). 성문 = 그 단계 열린 길 축, 성곽 마을 · 성 모두 GATE_W(성문 GLB 폭 3.18, 정문 2번 길 × 1.15)의 절반 안. 성탑 = 면 경계(0° · 60° …) ± TOWER_NEAR */
  const GATE_W=3.18,TOWER_NEAR=1.3,wall={t4:-1,end:-1,fence:0,bld:0,hit:{all:[0,0,0],ring:[0,0,0]},seen:new Set()};
  function trackWalls(){
    if(!Number.isSafeInteger(w.stage)||w.stage<4)return;if(wall.t4<0)wall.t4=w.t;
    const R=W.radius(w),open=W.routes(w)||[];
    for(const v of w.wolves){if(v.state!=='smash'||wall.seen.has(v.id))continue;const b=w.buildings.find(x=>x.id===v.target);if(!b||b.kind!=='fence')continue;wall.seen.add(v.id);
      const a=Math.atan2(v.z,v.x),dA=(x,y)=>{let d=(x-y)%(Math.PI*2);if(d>Math.PI)d-=Math.PI*2;if(d<-Math.PI)d+=Math.PI*2;return Math.abs(d)};
      const gate=open.some(p=>dA(a,(p+.5)*Math.PI/4)*(R-.5)<=GATE_W/2*(p===2?1.15:1)),tower=[0,1,2,3,4,5].some(k=>dA(a,k*Math.PI/3)*(R-.4)<=TOWER_NEAR),i=gate?0:tower?1:2;
      wall.hit.all[i]++;if(v.fm===3)wall.hit.ring[i]++}
  }
  function trackForms(){
    const R=W.radius(w);
    for(let i=w.wolves.length-1;i>=0;i--){const v=w.wolves[i];if(v.id<=lastId)break;if(w.stage>0&&v.state==='walk'){const fm=v.fm|0;forms.n[fm]++;walkers.push({v,t0:w.t,fm,side0:W.sectorOf(v.sx,v.sz),line:Math.max(.5,Math.hypot(v.sx,v.sz)-R-.3)/(v.speed*W.TICK)})}}
    if(w.wolves.length)lastId=Math.max(lastId,w.wolves[w.wolves.length-1].id);
    for(let i=walkers.length-1;i>=0;i--){const o=walkers[i],v=o.v;if(v.state==='walk')continue;walkers.splice(i,1);
      if(v.state!=='smash'&&v.state!=='hunt')continue;forms.ratio[o.fm].push((w.t-o.t0)/o.line);if(o.fm===3){forms.circle++;if(W.sectorOf(v.x,v.z)!==o.side0)forms.away++}}
  }
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
      else if(e.type==='broken'){if(w.stage>=4){if(e.kind==='fence')wall.fence++;else wall.bld++}if(e.kind==='fence'){fenceHits++;const b=w.buildings.find(x=>x.id===e.building);if(b&&b.side>=0&&b.side<6)sideHits[b.side]++}else{s.broken=W.brokenCount(w);s.marketDown=W.marketDown(w);ask(true)}}
      else if(e.type==='rebuilt'){const b=w.buildings.find(x=>x.id===e.building);if(b&&b.side>=0&&b.side<6)sideRebuilt[b.side]++}}
    trackForms();trackWalls();
    earned+=s.gold-g0;st.ticks++;if(bk&&st.ticks%10===0)B.tick(bk.book,now(),1);
    if(w.flow){const f=w.flow,yard=W.flowYard(w),hens=W.flowLayers(w);if(yard>=Math.max(2,hens))st.pile++;if(yard>=W.flowCap(w))st.full++;if(f.boost.left>0)st.boost++;if((s.farmers|0)>=9){st.late++;if(yard>=Math.max(2,hens))st.latePile++;if(yard>=W.flowCap(w))st.lateFull++}
      if(reading){st.read++;if(f.rate*f.beat<.25||f.credit<=0)st.readLow++}}
    if(shopLock>0)shopLock--;recTick();
    if(clock()<=600&&s.chickens<minHen10)minHen10=s.chickens;
    for(const m of [10,20,30])if(!snaps[m]&&clock()>=m*60)snaps[m]={built:C.built(s),earned,q:qn,fenceHits,sideHits:sideHits.slice(),sideRebuilt:sideRebuilt.slice()}}
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
  const done=()=>({wall:{t4:wall.t4,end:wall.end>=0?wall.end:w.t,fence:wall.fence,bld:wall.bld,hit:wall.hit},forms,lost:s.run.lost,stage:w.stage,topRoute:inflowN?100*Math.max(...inflow)/inflowN:NaN,bridgeRoute:inflowN?100*inflow[6]/inflowN:NaN,state:s,ended,qn,min:clock()/60,ms,collapse:minHen10===0,snaps,earned,first,built:C.built(s),hens:s.chickens,farmers:1+s.farmers,gold:s.gold,st,fenceHits,yard:W.flowYard(w),credit:w.flow?w.flow.credit:0});
  if(kind==='idle'||kind==='idleBuy'){
    idling=true;   /* 방치 아이는 첫 문제를 띄운 채 답하지 않는다: 산 것은 화면처럼 보류된 채 */
    if(flowing)W.flowQuestion(w,C.beatTicks(s,QA(0)));
    const end=(o.idleMin||30)*60;while(clock()<end){run(3);if(kind==='idleBuy'){ask(false);buyOne()}}
    return Object.assign(done(),{idle:true});
  }
  while(qn<QMAX&&clock()<MINMAX*60&&!ended){
    if(s.run.bell===1){C.ringBell(s,{rnd,idOf:i=>QA(i).id});W.king(w,'fight',0);finale={q0:qn,t0:clock()};mark('ring');if(bk){B.finaleStart(bk.book);W.guestGone(w)}}
    /* 수첩: 쪽지·기억 늑대는 문제 번호를 넘기지 않고 이 칸에 끼워 넣는다(화면의 makeRound와 같음) */
    const fin=C.finaleNow(s),sp=bk?B.nextSpecial(bk.book,{age,index:s.index|0,run:s.run.no|0,finale:!!fin,noteOf:N.get,byId:bk.byId}):null,q=sp?sp.q:QA(fin?fin.index:s.index),n=q.choices.length;qn++;
    if(sp)bk.sp.push({kind:sp.kind,id:sp.id,at:qn});
    if(o.seen&&!sp){o.seen.cat[q.mode==='quiz'?q.cat:'story']++;if((!fin||fin.normal)&&q.mode!=='quiz')o.seen.ids.push(q.id)}/* S9·S12: 평소 순서로 나온 글(결전이 이번 판 글을 다시 내는 칸은 뺌) */
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
      if(res.flow){const nf=C.finaleNow(s),nq=QA(nf?nf.index:s.index);W.flowCorrect(w,res.flow.credit,res.flow.boost,C.beatTicks(s,nq));st.credit+=res.flow.credit}
      W.answered(w);W.volley(w,s,{scale:C.scale(q),fast});release();if(W.foxShoo(w)){C.foxEnded(s,true);if(bk)B.foxSaved(bk.book,{now:now()})}
      if(bk){const lv=res.flow?res.flow.boost|0:0,rose=lv>=2&&bk.boost<2;bk.boost=lv;
        const br=B.answered(bk.book,q,'first',{now:now(),age,run:s.run.no|0,special:sp&&sp.kind,finale:!!fin});if(rose)B.rushed(bk.book,{now:now()});
        if(w.guest)W.guestGreet(w);else{const kinds=W.kindsAt(w.hall|0).slice();if(C.FOX.on&&(s.run.fox|0)<C.FOX.at.length)kinds.push('fox');
          const c=B.shinyChance(bk.book,{run:s.run.no|0,asked:s.run.asked|0,boost2:lv>=2,kinds,finale:!!fin||s.run.bell>=2,free:false});if(c&&c.win&&W.guest(w,c.kind))B.shinySpawned(bk.book)}
        if(br.friend)run(1.3);/* 친구 카드 연출만큼 정답 연출이 길어짐 */}
      if(fz){W.kingHit(w);if(fz.won){if(bk)B.kingWon(bk.book,{now:now(),stars:C.stars(s),village:s.run.village,perfect:(s.run.fq|0)===C.FINALE.shields});W.king(w,'flee');W.retreat(w,-1);ended={q:qn,min:clock()/60,finaleQ:qn-finale.q0};wall.end=w.t}}
      ask(false);run(.6);if(!fin)for(let b=0;b<(o.buys||1);b++){if(b)run(.4);buyOne()}run(.6);
    }else{
      C.trackPace(s,q,ticks);W.answered(w);run(W.dashTicks(w)*W.TICK+.2);run(kidTime(q,false));
      const ok2=kind==='wrong'?false:kind==='guess'?rnd()<1/(n-1):rnd()<.8;
      if(bk){bk.boost=0;B.answered(bk.book,q,ok2?'second':'miss',{now:now(),age,run:s.run.no|0,special:sp&&sp.kind,finale:!!fin})}
      const keep=!!(sp&&sp.kind==='review');/* 기억 늑대 문제는 놓쳐도 연속이 끊기지 않는다(화면과 같음) */
      if(ok2){C.settle(s,q,'second',{finale:!!fin,extra:!!sp,keepStreak:keep});if(C.FOX.second&&W.foxShoo(w)){C.foxEnded(s,true);if(bk)B.foxSaved(bk.book,{now:now()})}if(fin)C.finaleSettle(s,'second')}
      else{s.misses++;if(!keep)s.streak=0;C.track(s,q,'miss',{finale:!!fin,extra:!!sp});if(fin){const fz=C.finaleSettle(s,'miss');if(fz&&fz.stepped)W.king(w,'fight',s.run.steps)}}
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
  const out={},runsOf={};
  console.log('| 나이 | 아이 | 엔딩 문제(p25~p75) | 분 | 10분 붕괴 | 금화/문제 | 10분 지음 | 20분 지음 | 쌓임(알≥닭) | 꽉 참 | 신바람 | 읽는 중 닭이 쉼 | 농부 다 산 뒤 쌓임·꽉 참 | 끝 농부 | 못 산 횟수 | 20분까지 울타리 부서짐 | 잃은 닭 | 단계 도달 문제(마을·장터·물레방아·성곽·성) | 첫 단계(분) | 가장 붐빈 길 | 20분까지 울타리 면별(0·1·2·3·4·5) | 다리 길(6번) 유입 |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for(const age of ages)for(const kind of kinds){
    const rs=runsOf[age+kind]=Array.from({length:runs},(_,i)=>playEnd(age,kind,1000+7919*i,opt)),dn=rs.filter(r=>r.ended),qs=dn.map(r=>r.ended.q).sort((a,b)=>a-b),q=med(qs);
    const fs=k=>avg(rs.map(r=>r.st.ticks?100*r.st[k]/r.st.ticks:NaN)),bl=m=>avg(rs.map(r=>r.snaps[m]?r.snaps[m].built:(r.ended?NaN:r.built)));
    const idle=kind==='idle'||kind==='idleBuy'||kind==='wrong';
    const row=out[age+kind]={q,gpq:avg(rs.map(r=>r.idle?NaN:r.earned/r.qn)),gpm:avg(rs.map(r=>r.earned/r.min)),b10:bl(10),earned:avg(rs.map(r=>r.earned)),built:avg(rs.map(r=>r.built)),undone:rs.length-dn.length,col:rs.filter(r=>r.collapse).length,min:med(dn.map(r=>r.ended.min)),lost:avg(rs.map(r=>r.lost)),s1:med(rs.map(r=>r.ms.s1?r.ms.s1.min:NaN))};
    const sq=[1,2,3,4,5].map(k=>f(med(rs.map(r=>r.ms['s'+k]?r.ms['s'+k].q:NaN)))).join('·');
    console.log(`| ${age}세 | ${NAME[kind]} | ${idle?'30분 금화 '+f(row.earned)+' · 지음 '+f(row.built,1)+' · 남은 알 '+f(avg(rs.map(r=>r.yard)),1):f(q)+' ('+f(qs[Math.floor(qs.length*.25)])+'~'+f(qs[Math.floor(qs.length*.75)])+')'+(row.undone?' 못 감 '+row.undone:'')} | ${idle?'-':f(med(dn.map(r=>r.ended.min)),1)} | ${idle?'-':row.col+'/'+rs.length} | ${f(row.gpq,1)} | ${f(row.b10,1)} | ${f(bl(20),1)} | ${f(fs('pile'))}% | ${f(fs('full'))}% | ${f(fs('boost'))}% | ${f(avg(rs.map(r=>r.st.read?100*r.st.readLow/r.st.read:NaN)))}% | ${f(avg(rs.map(r=>r.st.late?100*r.st.latePile/r.st.late:NaN)))}%·${f(avg(rs.map(r=>r.st.late?100*r.st.lateFull/r.st.late:NaN)))}% | ${f(avg(rs.map(r=>r.farmers)),1)} | ${f(avg(rs.map(r=>r.st.poor)),1)} | ${f(avg(rs.map(r=>r.snaps[20]?r.snaps[20].fenceHits:NaN)),1)} | ${f(row.lost,1)} | ${sq} | ${f(row.s1,1)} | ${f(avg(rs.map(r=>r.topRoute)))}% | ${[0,1,2,3,4,5].map(k=>f(avg(rs.map(r=>r.snaps[20]?r.snaps[20].sideHits[k]:NaN)),1)).join('·')} | ${f(avg(rs.map(r=>r.bridgeRoute)),1)}% |`);
  }
  /* 0.15.2 대형 표: 단계 1부터 나온 늑대의 대형 비율, 울타리 줄에 닿은 늑대의 (닿은 때 ÷ 곧은 길로 왔을 때) 중앙, 따라 돌기 중 옆 면으로 간 비율,
     20분까지 면별 부서짐 · 다시 세움, 가장 몰린 면 몫(20분까지 부서짐 중 가장 많은 면의 몫, 판 평균) */
  console.log('\n| 나이 | 아이 | 대형 비율(곧장·휘어·갈라·돌기) | 닿음 ÷ 곧은 시간 중앙(곧장·휘어·갈라·돌기) | 돌기 중 옆 면 | 20분까지 면별 부서짐(0~5) | 20분까지 면별 다시 세움(0~5) | 가장 몰린 면 몫 |');
  console.log('|---|---|---|---|---|---|---|---|');
  for(const age of ages)for(const kind of kinds){const rs=runsOf[age+kind];if(!rs)continue;
    const n=[0,1,2,3].map(k=>rs.reduce((a,r)=>a+r.forms.n[k],0)),tot=n.reduce((a,x)=>a+x,0),ratio=[0,1,2,3].map(k=>f(med([].concat(...rs.map(r=>r.forms.ratio[k]))),2));
    const circ=rs.reduce((a,r)=>a+r.forms.circle,0),away=rs.reduce((a,r)=>a+r.forms.away,0),sn=k=>rs.map(r=>r.snaps[20]?r.snaps[20][k]:null).filter(Boolean);
    const per=k=>[0,1,2,3,4,5].map(i=>f(avg(sn(k).map(a=>a[i])),1)).join('·'),top=avg(sn('sideHits').map(a=>{const t=a.reduce((p,q)=>p+q,0);return t?100*Math.max(...a)/t:NaN}));
    console.log(`| ${age}세 | ${NAME[kind]} | ${tot?n.map(x=>f(100*x/tot)).join('·')+'%':'-'} | ${ratio.join('·')} | ${circ?f(100*away/circ)+'% ('+away+'/'+circ+')':'-'} | ${per('sideHits')} | ${per('sideRebuilt')} | ${f(top)}% |`)}
  /* 0.17 성벽 표(계획서 v016-plan §3.4): 성곽 마을(단계 4)에 들어선 판만. 단계 4 이후 울타리(성벽) · 건물 부서짐(판당), 단계 4 이후 머문 분(엔딩 또는 시뮬 끝까지),
     성벽을 처음 두드린 자리(늑대마다 한 번: 성문 폭 안 · 성탑 옆 · 그 밖 성벽), 따라 돌기 늑대만 같은 셈 */
  console.log('\n| 나이 | 아이 | 단계 4 간 판 | 단계 4 이후 울타리 부서짐(판당) | 단계 4 이후 머문 분 | 단계 4 이후 건물 부서짐(판당) | 두드린 자리 모두(성문·성탑 옆·성벽) | 따라 돌기(성문·성탑 옆·성벽) |');
  console.log('|---|---|---|---|---|---|---|---|');
  for(const age of ages)for(const kind of kinds){const rs=runsOf[age+kind];if(!rs)continue;const r4=rs.filter(r=>r.wall&&r.wall.t4>=0);
    const pct=k=>{const a=[0,1,2].map(i=>r4.reduce((s,r)=>s+r.wall.hit[k][i],0)),t=a[0]+a[1]+a[2];return t?a.map(x=>f(100*x/t)).join('·')+'% ('+t+')':'-'};
    console.log(`| ${age}세 | ${NAME[kind]} | ${r4.length}/${rs.length} | ${f(avg(r4.map(r=>r.wall.fence)),1)} | ${f(avg(r4.map(r=>(r.wall.end-r.wall.t4)*W.TICK/60)),1)} | ${f(avg(r4.map(r=>r.wall.bld)),2)} | ${pct('all')} | ${pct('ring')} |`)}
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
  let state=Object.assign(C.fresh(age),{seed:newSeed(),bank:Q.BANK_VERSION}),t0=T0;state.run.t0=t0;
  const book=on?B.fresh(t0,state.seed):null;if(book){book.set.day=0;/* 하루 한 판 가정이라 하루 시간 멈춤은 끈다(멈춤은 판 길이와 무관) */
    if(EN!=='std'&&B.setOpt(book,'en',EN,{age}))Q.setMix(age,B.mixOf(book,age))}
  const rows=[],mark={},seen={ids:[],cat:{story:0,common:0,math:0,english:0}};
  for(let p=1;p<=plays;p++){
    const bk=book?{book,byId,t0,sp:[],boost:0,off:B.BOOK.FLAGS.order?B.orderFor(book,age).off:null}:null;if(book)B.beginSession(book,t0);
    const r=playEnd(age,kind,seed0+p*104729,{state,bk,seen,buys:BUYS});
    const sp=bk?bk.sp:[],rv=sp.filter(x=>x.kind==='review'),nt=sp.filter(x=>x.kind==='note'),same={};rv.forEach(x=>same[x.id]=(same[x.id]||0)+1);
    let gap=Infinity;for(let i=1;i<sp.length;i++)gap=Math.min(gap,sp[i].at-sp[i-1].at-1);
    rows.push({fence20:r.snaps[20]?r.snaps[20].fenceHits:NaN,q:r.ended?r.ended.q:NaN,min:r.ended?r.ended.min:NaN,gpm:r.earned/r.min,earned:r.earned,qn:r.qn,ended:!!r.ended,rv:rv.length,nt:nt.length,gap,same:Math.max(0,...Object.values(same)),
      cells:book?B.cells(book):0,cards:book?B.KINDS.filter(k=>book.mon[k].card>0).length:0,foot:book?B.KINDS.filter(k=>book.mon[k].foot>0).length:0,rib:book?B.KINDS.filter(k=>book.mon[k].rib.n>=B.BOOK.RIBBON.need).length:0,
      shiny:book?B.KINDS.filter(k=>book.mon[k].shiny>0).length:0,bronze:book?B.MEDALS.filter(k=>book.medal[k].at[0]>0).length:0,tiers:book?B.MEDALS.reduce((s,k)=>s+book.medal[k].at.filter(Boolean).length,0):0,rvLen:book?book.rv.length:0});
    if(book){const x=rows[rows.length-1];for(const [k,ok] of [['card8',x.cards>=8],['rib8',x.rib>=8],['full',x.cells>=B.CELLS]])if(ok&&!mark[k])mark[k]=p}
    if(idle||!r.ended){state=r.state;t0+=DAY;continue}/* 엔딩을 못 본 판은 같은 마을에서 이어 간다 */
    t0+=DAY;if(r.state.run.bell<3){state=r.state;continue}
    /* 새 마을: 수첩이 있으면 같은 씨앗으로 이어 가고(쓴 만큼 순번을 밀고, 문제은행 판은 한 바퀴 끝에서만 올림), 없으면 판마다 새 씨앗(0.15) */
    const ord=book?B.newVillage(book,t0,{age,used:Q.used(age,r.state.index,r.state.seed,r.state.bank),bank:r.state.bank,latest:Q.BANK_VERSION,size:Q.bankCount(age,r.state.bank)}):null;
    state=C.nextRun(r.state,{seed:ord&&B.BOOK.FLAGS.order?ord.seed:newSeed(),bank:ord?ord.bank:Q.BANK_VERSION,now:t0});
  }
  if(EN!=='std')Q.setMix();
  /* S9: 읽기 묶음 크기만큼씩 끊어 그 안에서 겹친 글 수(이어 순서가 있으면 0이어야 함). S12: 평소 칸 가운데 영어 비율 */
  const size=Q.bankCount(age,Q.BANK_VERSION).story;let dup=0;for(let i=0;i<seen.ids.length;i+=size){const lap=seen.ids.slice(i,i+size);dup+=lap.length-new Set(lap).size}
  const total=Object.values(seen.cat).reduce((x,y)=>x+y,0);
  return {rows,book,mark,size:book?JSON.stringify(book).length:0,dup,read:seen.ids.length,lap:size,english:total?seen.cat.english/total:0};
}
let EN='std',BUYS=1;/* BUYS = 한 번에 맞힐 때마다 사는 수(덮어쓰기 JSON의 "buys", 0.15.2 울타리 통과선은 3개씩) *//* 영어 설정(시뮬 덮어쓰기 JSON의 "en": off · std · more) */
function bookReport(plays,ages,kinds,runs){
  const out={};
  console.log('| 나이 | 아이 | 엔딩 문제(수첩 ÷ 끔) | 분(수첩 · 끔) | 분당 금화(수첩 ÷ 끔) | 판당 복습 · 쪽지(최대) | 복습 비율 최대 | 특별 사이 최소 | 같은 글 최대 | 첫 판 발자국 · 훈장 동 | 카드 8장(판) | 리본 8개(판) | 32칸(판) | 반짝(20판 · 끝) | 끝: 칸 · 카드 · 훈장 단계 | 복습 대기열 최대 · 졸업 | 기록 크기 | 같은 글 다시 나옴(수첩 · 끔, 읽은 글 ÷ 한 바퀴) | 영어 비율(' + EN + ') |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for(const age of ages)for(const kind of kinds){
    const on=[],off=[];for(let i=0;i<runs;i++){on.push(playBook(age,kind,plays,5000+7919*i,true));off.push(playBook(age,kind,plays,5000+7919*i,false))}
    const all=(list,k)=>list.flatMap(x=>x.rows.map(r=>r[k])),m=(list,k)=>med(all(list,k)),a=(list,k)=>avg(all(list,k)),idle=kind==='idle'||kind==='idleBuy'||kind==='wrong';
    const at=(k)=>med(on.map(x=>x.mark[k]||NaN)),lastRow=x=>x.rows[x.rows.length-1],row20=x=>x.rows[Math.min(19,x.rows.length-1)];
    const share=Math.max(...on.flatMap(x=>x.rows.map(r=>r.qn?r.rv/r.qn:0)));
    const row=out[age+kind]={q:m(on,'q')/m(off,'q'),min:m(on,'min'),min0:m(off,'min'),gpm:a(on,'gpm')/a(off,'gpm'),share,gap:Math.min(...all(on,'gap')),same:Math.max(...all(on,'same')),nt:Math.max(...all(on,'nt')),
      foot1:avg(on.map(x=>x.rows[0].foot)),bronze1:avg(on.map(x=>x.rows[0].bronze)),card8:at('card8'),rib8:at('rib8'),full:at('full'),shiny20:avg(on.map(x=>row20(x).shiny)),shinyEnd:avg(on.map(x=>lastRow(x).shiny)),
      cells:avg(on.map(x=>lastRow(x).cells)),cards:avg(on.map(x=>lastRow(x).cards)),tiers:avg(on.map(x=>lastRow(x).tiers)),rvMax:Math.max(...all(on,'rvLen')),grad:avg(on.map(x=>x.book.medal.again.n)),size:Math.max(...on.map(x=>x.size)),fenceOn:avg(on.map(x=>x.rows[0].fence20)),fenceOff:avg(off.map(x=>x.rows[0].fence20)),undone:all(on,'ended').filter(v=>!v).length};
    console.log(`| ${age}세 | ${NAME[kind]} | ${idle?'-':f(m(on,'q'))+' ÷ '+f(m(off,'q'))+' = '+f(100*row.q,1)+'% (평균 '+f(100*a(on,'q')/a(off,'q'),1)+'%)'+(row.undone?' (못 감 '+row.undone+')':'')} | ${idle?'-':f(row.min,1)+' · '+f(row.min0,1)+' (평균 '+f(100*a(on,'min')/a(off,'min'),1)+'%)'} | ${f(a(on,'gpm'),1)} ÷ ${f(a(off,'gpm'),1)} = ${f(100*row.gpm,1)}% | ${f(a(on,'rv'),1)} · ${f(a(on,'nt'),1)}(${row.nt}) | ${f(100*share,1)}% | ${Number.isFinite(row.gap)?row.gap:'-'} | ${row.same} | ${f(row.foot1,1)} · ${f(row.bronze1,1)} | ${f(row.card8)} | ${f(row.rib8)} | ${f(row.full)} | ${f(row.shiny20,1)} · ${f(row.shinyEnd,1)} | ${f(row.cells,1)} · ${f(row.cards,1)} · ${f(row.tiers,1)} | ${row.rvMax} · ${f(row.grad,1)} | ${(row.size/1024).toFixed(1)}KB | ${f(avg(on.map(x=>x.dup)),1)} · ${f(avg(off.map(x=>x.dup)),1)} (${f(avg(on.map(x=>x.read)))} ÷ ${on[0].lap}) | ${f(100*avg(on.map(x=>x.english)),1)}% |`);
  }
  /* 0.15.2 울타리 통과선 대조: 첫 판(새 마을) 20분까지 울타리 부서짐, 수첩 켬 · 끔(같은 씨앗) */
  for(const k of Object.keys(out))if(Number.isFinite(out[k].fenceOn))console.log(k.replace(/^(\d+)(\w+)$/,(_,a,b)=>a+'세 '+(NAME[b]||b))+' 첫 판 20분까지 울타리 부서짐: 수첩 '+f(out[k].fenceOn,2)+' · 끔 '+f(out[k].fenceOff,2)+' (사는 수 '+BUYS+')');
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
  if(W.WALL)console.log(`== ${cmd} · 0.17 성벽 WALLS ${C.FLAGS.WALLS} · 고리 TOWER_RING ${C.FLAGS.TOWER_RING} · World.WALL ${JSON.stringify(W.WALL)} · World.SLOT_R ${JSON.stringify(W.SLOT_R)}`);
  if(cmd==='book'){applyBook(over);if(over.en)EN=String(over.en);if(over.buys)BUYS=Number(over.buys)||1;console.log('== book · Book.BOOK '+JSON.stringify({NOTE:{cap:B.BOOK.NOTE.cap,gap:B.BOOK.NOTE.gap,after:B.BOOK.NOTE.after},REVIEW:B.BOOK.REVIEW,SHINY:B.BOOK.SHINY,SPECIAL:B.BOOK.SPECIAL}));
    bookReport(Number(rest[0])||30,rest[1]?rest[1].split(',').map(Number):Q.AGES,rest[2]?rest[2].split(','):['typ','slow','fast','guess','idle','idleBuy','wrong'],Number(over.runs)||3);shinyCheck()}
  else if(cmd==='farm')farmReport(rest[0]?rest[0].split(',').map(Number):[8]);
  else endReport(Number(rest[0])||12,rest[1]?rest[1].split(',').map(Number):Q.AGES,rest[2]?rest[2].split(','):ALL,{buys:over.buys});
  console.log(`(${((Date.now()-t0)/1000).toFixed(0)}초)`);
}
