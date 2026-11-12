/* node scripts/sim-village.cjs [분] : 0.7 마을 방어 시뮬레이션(개발용, 배포·CI 제외).
   문제 풀이(경제, combat.js)와 늑대 세계(world.js)를 함께 돌려, 같은 벽시계 시간 동안 아이 유형별로
   마을 크기·잃은 닭·부서진 건물·쓰러뜨린 늑대·가장 큰 무리를 비교한다. 읽기 속도·정확도·화면 시간은 가정값이다. */
const path=require('node:path'),ROOT=path.join(__dirname,'..');
const C=require(path.join(ROOT,'combat.js')),W=require(path.join(ROOT,'world.js')),Q=require(path.join(ROOT,'questions.js'));
const MIN=Number(process.argv[2])||20,RUNS=Number(process.argv[3])||40;
let seed=11;const rnd=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648};
const RATE={7:{slow:30,typ:60,fast:100},8:{slow:70,typ:120,fast:180},9:{slow:120,typ:180,fast:250},10:{slow:160,typ:230,fast:300}};
const ACC={slow:.75,typ:.85,fast:.95};
const syl=C.syl;
const need=(q,r)=>{const rps=r/60,n=q.choices.length,cc=q.choices.reduce((s,c)=>s+syl(c),0),p=syl(q.passage);
  return q.mode==='sound'?1+cc/rps+.4*n:1.5+p/rps+(q.age===7?0:syl(q.prompt)/rps)+cc/rps+.4*n+(q.age>=9?.3*p/rps:0)};
const median=a=>{const s=[...a].sort((x,y)=>x-y);return s[s.length>>1]};
function interval(age,mode){const qs=Array.from({length:Q.count(age,mode)},(_,i)=>Q.get(age,mode,i));return Math.round(3*median(qs.map(C.baseSeconds))/W.TICK)}

function play(age,mode,kind){
  const s=C.fresh(age);s.mode=mode;const w=W.create({seed:Math.floor(rnd()*1e9),interval:interval(age,mode)});W.sync(w,s);
  let clock=0,earned=0,maxPack=0,maxWolves=0,correct=0,qn=0;
  const run=sec=>{for(let i=0;i<Math.round(sec/W.TICK);i++){const ev=W.step(w,s);for(const e of ev){if(e.type==='henLost'){s.chickens=Math.max(0,s.chickens-1)}if(e.type==='pack')maxPack=Math.max(maxPack,e.n)}maxWolves=Math.max(maxWolves,w.wolves.length)}clock+=sec};
  while(clock<MIN*60){
    const q=Q.get(age,mode,s.index),n=q.choices.length,lock=C.reveal(q)/10;qn++;
    if(mode==='sound')run(1+syl(q.speak)/4.5);
    let t,ok1;
    if(kind==='guess'){t=lock+.4;ok1=rnd()<1/n}else{t=Math.max(lock+.3,need(q,RATE[age][kind])*(.75+rnd()*.5));ok1=rnd()<ACC[kind]}
    run(t);
    if(ok1){
      const fast=t<=C.baseSeconds(q)*(1-C.FAST);s.hidden=0;const res=C.settle(s,q,'first',{fast});earned+=res.gold;correct++;W.volley(w,s);
      /* 카드 고르기(세계 멈춤): 부서진 것이 있으면 고치기, 아니면 지켜요 > 벌어요 > 마을 중 살 수 있는 것 */
      s.broken=W.brokenCount(w);
      const offers=C.offers(s).filter(k=>k&&C.canBuy(s,k));
      const pri=['repair','tower','chicken','fence','hall','farmer','pond','feast'];offers.sort((a,b)=>pri.indexOf(a)-pri.indexOf(b));
      clock+=kind==='guess'?1.5:4;
      if(offers.length){const k=offers[0];C.buy(s,k);if(k==='repair')W.repairAll(w);W.sync(w,s);clock+=1.2}
    }else{
      run(W.dashTicks(w)*W.TICK);
      const t2=kind==='guess'?.4:need(q,RATE[age][kind])*.35;run(t2);
      const ok2=kind==='guess'?rnd()<1/(n-1):rnd()<.8;
      if(!ok2)C.settle(s,q,'miss',{timeout:false});
      run(syl(C.lesson(q))/4.5+1.2+(kind==='guess'?.4:1));
    }
    s.index++;
  }
  return {qn,correct,earned,built:C.built(s),hall:s.hall,towers:1+s.level,fence:s.fence,chickens:s.chickens,henLost:w.stats.henLost,broken:w.stats.broken,kills:w.stats.kills,waves:w.stats.waves,maxPack,maxWolves,nowBroken:W.brokenCount(w)};
}
const avg=(a,m,k)=>{const acc={};for(let i=0;i<RUNS;i++){const r=play(a,m,k);for(const x in r)acc[x]=(acc[x]||0)+r[x]/RUNS}return acc};
console.log(`== ${MIN}분 플레이 평균(${RUNS}회): 정답/문제 · 지은 것 · 회관 · 타워 · 울타리 · 닭(남음) · 잃은 닭 · 부서짐(누적/지금) · 쓰러뜨린 늑대 · 무리 수 · 최대 무리 · 동시 최대 늑대`);
for(const a of Q.AGES)for(const m of Q.MODES){
  const iv=interval(a,m)*W.TICK;
  for(const k of ['slow','typ','fast','guess']){const r=avg(a,m,k);
    console.log(`${a}세 ${m.padEnd(5)} 간격${String(iv).padStart(4)}초 ${k.padEnd(5)} 정답 ${r.correct.toFixed(0)}/${r.qn.toFixed(0)} 지음 ${r.built.toFixed(1)} 회관 ${r.hall.toFixed(1)} 타워 ${r.towers.toFixed(1)} 울타리 ${r.fence.toFixed(1)} 닭 ${r.chickens.toFixed(1)} 잃은닭 ${r.henLost.toFixed(1)} 부서짐 ${r.broken.toFixed(1)}/${r.nowBroken.toFixed(1)} 처치 ${r.kills.toFixed(0)} 무리 ${r.waves.toFixed(0)} 최대무리 ${r.maxPack.toFixed(0)} 동시 ${r.maxWolves.toFixed(0)}`)}}
