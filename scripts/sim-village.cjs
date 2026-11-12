/* node scripts/sim-village.cjs [분] [횟수] : 0.8 마을 방어 시뮬레이션(개발용, 배포·CI 제외).
   문제 풀이(경제, combat.js)와 늑대 세계(world.js)를 함께 돌려, 같은 벽시계 시간 동안 아이 유형별로
   마을 크기·잃은 닭·부서진 건물·쓰러뜨린 늑대·늑대가 보이는 시간 비율 등을 비교한다. 읽기 속도·정확도·화면 시간은 가정값이다. */
const path=require('node:path'),ROOT=path.join(__dirname,'..');
const C=require(path.join(ROOT,'combat.js')),W=require(path.join(ROOT,'world.js')),Q=require(path.join(ROOT,'questions.js'));
const MIN=Number(process.argv[2])||20,RUNS=Number(process.argv[3])||30,ONLY=process.argv[4]||'';
let seed=11;const rnd=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648};
const RATE={7:{slow:30,typ:60,fast:100},8:{slow:70,typ:120,fast:180},9:{slow:120,typ:180,fast:250},10:{slow:160,typ:230,fast:300}};
const ACC={slow:.75,typ:.85,fast:.95};
const THINK={slow:1.5,typ:1,fast:.7};
const syl=C.syl,units=C.units;
const need=(q,r,kind)=>{const rps=r/60,n=q.choices.length,cc=q.choices.reduce((s,c)=>s+units(c),0),p=syl(q.passage);
  if(q.mode==='quiz'){const t=(C.THINK[q.cat]||C.THINK.common)[q.age]||2;return 1+(syl(q.prompt)+units(q.passage))/rps+cc/rps+.4*n+t*THINK[kind]}
  return q.mode==='sound'?1+cc/rps+.4*n:1.5+p/rps+(q.age===7?0:syl(q.prompt)/rps)+cc/rps+.4*n+(q.age>=9?.3*p/rps:0)};

const median=a=>{const s=[...a].sort((x,y)=>x-y);return s[s.length>>1]};
function interval(age,mode){return W.intervalFor(median(Array.from({length:Q.count(age,mode)},(_,i)=>C.baseSeconds(Q.get(age,mode,i)))))}
function play(age,mode,kind){
  const s=C.fresh(age);s.mode=mode;const w=W.create({seed:Math.floor(rnd()*1e9),interval:interval(age,mode)});W.sync(w,s);
  let clock=0,earned=0,maxPack=0,maxWolves=0,correct=0,qn=0,ticks=0,seen=0,sumWolves=0,inside=0,hall1=0,hall2=0,hall3=0,power1=0;const kinds={};
  const run=sec=>{for(let i=0;i<Math.round(sec/W.TICK);i++){const ev=W.step(w,s);ticks++;
    for(const e of ev){if(e.type==='henLost'){s.chickens=Math.max(0,s.chickens-1)}if(e.type==='pack')maxPack=Math.max(maxPack,e.n);if(e.type==='kill')kinds[e.kind]=(kinds[e.kind]||0)+1}
    let live=0,inn=0;const R=W.radius(w);for(const v of w.wolves){if(v.state==='dead'||v.state==='gone')continue;live++;if(Math.hypot(v.x,v.z)<R+.5)inn++}
    if(live)seen++;sumWolves+=live;if(inn)inside++;maxWolves=Math.max(maxWolves,live)}clock+=sec};
  while(clock<MIN*60){
    const q=Q.at(age,mode,s.index),n=q.choices.length,lock=C.reveal(q)/10;qn++;
    if(mode==='sound')run(1+syl(q.speak)/4.5);
    let t,ok1;
    if(kind==='guess'){t=lock+.4;ok1=rnd()<1/n}else{t=Math.max(lock+.3,need(q,RATE[age][kind],kind)*(.75+rnd()*.5));ok1=rnd()<ACC[kind]}
    run(t);
    if(ok1){
      const fast=C.isFast(q,Math.round(t/W.TICK));s.hidden=0;const res=C.settle(s,q,'first',{fast});earned+=res.gold;correct++;W.volley(w,s,{scale:C.scale(q),fast});
      /* 카드 고르기(세계 멈춤): 부서진 것이 있으면 고치기, 아니면 지켜요 > 벌어요 > 마을 중 살 수 있는 것 */
      const pri=['repair','tower','power','chicken','fence','hall','farmer','pond','feast'];
      clock+=kind==='guess'?1.5:4;
      for(let pk=0;pk<C.picks(q);pk++){s.broken=W.brokenCount(w);const offers=C.offers(s).filter(k=>k&&C.canBuy(s,k));offers.sort((a,b)=>pri.indexOf(a)-pri.indexOf(b));if(!offers.length)break;const k=offers[0];C.buy(s,k);if(k==='repair')W.repairAll(w);W.sync(w,s);clock+=1.2;
        if(s.hall>=1&&!hall1)hall1=clock/60;if(s.hall>=2&&!hall2)hall2=clock/60;if(s.hall>=3&&!hall3)hall3=clock/60;if(s.power>=1&&!power1)power1=clock/60}
    }else{
      run(W.dashTicks(w)*W.TICK);
      const t2=kind==='guess'?.4:need(q,RATE[age][kind],kind)*.35;run(t2);
      const ok2=kind==='guess'?rnd()<1/(n-1):rnd()<.8;C.settle(s,q,ok2?'second':'miss',{timeout:false});
      run(syl(C.lesson(q))/4.5+1.2+(kind==='guess'?.4:1));
    }
    s.index++;
  }
  return {qn,correct,earned,built:C.built(s),hall:s.hall,towers:1+s.level,power:s.power,fence:s.fence,chickens:s.chickens,henLost:w.stats.henLost,broken:w.stats.broken,fenceBroken:w.stats.fenceBroken,kills:w.stats.kills,splash:w.stats.splash,waves:w.stats.waves,maxPack,maxWolves,
    seenPct:seen/ticks*100,avgWolves:sumWolves/ticks,insidePct:inside/ticks*100,nowBroken:W.brokenCount(w),hall1:hall1||MIN*2,hall2:hall2||MIN*2,hall3:hall3||MIN*2,power1:power1||MIN*2,bossKills:w.stats.bossKills,kinds};
}
const avg=(a,m,k)=>{const acc={},kinds={};for(let i=0;i<RUNS;i++){const r=play(a,m,k);for(const x in r){if(x==='kinds'){for(const q in r.kinds)kinds[q]=(kinds[q]||0)+r.kinds[q]/RUNS;continue}acc[x]=(acc[x]||0)+r[x]/RUNS}}acc.kinds=kinds;return acc};
const f=(x,d=0)=>x.toFixed(d);
console.log(`== ${MIN}분 평균(${RUNS}회). 회관 도달은 분(못 가면 ${MIN*2}). 보임% = 늑대가 1마리 이상 있는 시간, 마을% = 마을 안에 늑대가 있는 시간`);
for(const a of Q.AGES)for(const m of Q.MODES){
  if(ONLY&&!(a+m).includes(ONLY))continue;
  for(const k of ['slow','typ','fast','guess']){const r=avg(a,m,k);
    console.log(`${a}세 ${m.padEnd(5)} ${k.padEnd(5)} 정답 ${f(r.correct)}/${f(r.qn)} 지음 ${f(r.built,1)} 회관 ${f(r.hall,1)}(${f(r.hall1,1)}/${f(r.hall2,1)}/${f(r.hall3,1)}분) 타워 ${f(r.towers,1)} 강화 ${f(r.power,1)} 울타리 ${f(r.fence,1)} 닭 ${f(r.chickens,1)} 잃은닭 ${f(r.henLost,1)} 부서짐 ${f(r.broken,1)}/${f(r.nowBroken,1)} 울타리깨짐 ${f(r.fenceBroken)} 처치 ${f(r.kills)}(펑 ${f(r.splash)}) 보임 ${f(r.seenPct)}% 평균 ${f(r.avgWolves,1)} 마을 ${f(r.insidePct)}% 최대무리 ${f(r.maxPack)} 동시 ${f(r.maxWolves)} 왕처치 ${f(r.bossKills,1)} ${Object.entries(r.kinds).map(([q,v])=>q+':'+f(v)).join(' ')}`)}}
