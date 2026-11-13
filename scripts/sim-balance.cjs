/* node scripts/sim-balance.cjs : 0.6 규칙의 밸런스 시뮬레이션(개발용, 배포·CI에 포함하지 않음).
   1) 문항별 제한시간 분포  2) 같은 벽시계 10분·20분 동안 '찍는 아이' 대비 '읽는 아이'의 수입  3) 20분 상세.
   읽기 속도(분당 음절)·정확도·화면 시간은 가정값이다. 실제 아이 관찰 뒤 RATE와 combat.js의 SPEED를 함께 고친다. */
const path=require('node:path'),ROOT=path.join(__dirname,'..');
const C=require(path.join(ROOT,'combat.js')),Q=require(path.join(ROOT,'questions.js'));
const syl=C.syl;
let seed=1;const rnd=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648};
const RATE={7:{fast:100,typ:60,slow:30},8:{fast:180,typ:120,slow:70},9:{fast:250,typ:180,slow:120},10:{fast:300,typ:230,slow:160}};
function need(q,r){const rps=r/60,n=q.choices.length,Cc=q.choices.reduce((s,c)=>s+syl(c),0),P=syl(q.passage);
  return 1.5+P/rps+(q.age===7?0:syl(q.prompt)/rps)+Cc/rps+0.4*n+(q.age>=9?0.3*P/rps:0)}
const bank=(a,m)=>Array.from({length:Q.count(a,m)},(_,i)=>Q.get(a,m,i));
const st=a=>{const s=[...a].sort((x,y)=>x-y);return s[0].toFixed(0)+'/'+s[s.length>>1].toFixed(0)+'/'+s[s.length-1].toFixed(0)};
console.log('== 기본 제한시간(초) 최소/중앙/최대 · 8~10초 비율 · 보통 아이 필요시간 대비 여유(중앙) · 보통 아이가 시간 안에 드는 비율 · 느린 아이 비율');
let short=0,total=0;
for(const a of Q.AGES)for(const m of Q.MODES){const qs=bank(a,m),T=qs.map(C.baseSeconds);
  const ratio=qs.map((q,i)=>T[i]/need(q,RATE[a].typ)),inTyp=qs.filter((q,i)=>need(q,RATE[a].typ)<=T[i]).length/qs.length,inSlow=qs.filter((q,i)=>need(q,RATE[a].slow)<=T[i]).length/qs.length;
  const s810=T.filter(t=>t<=10).length;short+=s810;total+=qs.length;
  console.log(a,m.padEnd(5),'T',st(T).padEnd(9),'≤10s',(s810+'/'+qs.length).padEnd(6),'여유',st(ratio.map(x=>x*100)).padEnd(12)+'%','보통',Math.round(inTyp*100)+'%','느림',Math.round(inSlow*100)+'%','m',st(qs.map(C.scale)))}
console.log('10초 이하 문항',short,'/',total);

/* ---------- 플레이 시뮬 ---------- */
function play(age,mode,kind,minutes){
  const s=C.fresh(age);s.mode=mode;let clock=0,earned=0,first=0,second=0,miss=0,fast=0,qn=0,done=0,firstBuy=0;const recent=[];
  const prof={read_slow:{r:RATE[age].slow,acc:.75},read_typ:{r:RATE[age].typ,acc:.85},read_fast:{r:RATE[age].fast,acc:.95}}[kind];
  while(clock<minutes*60){
    const q=Q.get(age,mode,s.index),T=C.limit(q,s)/10,n=q.choices.length;qn++;
    const lock=C.reveal(q)/10;
    let t,ok1,outcome,timeout=false;
    if(kind==='guess'){t=lock+.4;ok1=rnd()<1/n}
    else{t=Math.max(lock+.3,need(q,prof.r)*(.75+rnd()*.5));ok1=rnd()<prof.acc}
    if(t>=T){outcome='miss';timeout=true;t=T}
    else if(ok1)outcome='first';
    else{let left=T-t-C.DASH*T;if(left<=0){outcome='miss';t=T}else{
        const t2=kind==='guess'?.4:need(q,prof.r)*.35*(.75+rnd()*.5),ok2=kind==='guess'?rnd()<1/(n-1):rnd()<.8;
        if(t2>=left){outcome='miss';timeout=true;t=T}else if(ok2){outcome='second';t+=C.DASH*T+.8+t2}else{outcome='miss';t+=C.DASH*T+.8+t2}}}
    clock+=t;
    const f=outcome==='first'&&(T-t)/T>=C.FAST;
    const res=C.settle(s,q,outcome,{fast:f,timeout});recent.push(outcome);if(recent.length>5)recent.shift();
    if(outcome==='first'){if(f)fast++;earned+=res.gold;first++;clock+=1.8;
      const offers=C.offers(s).filter(k=>k&&C.canBuy(s,k));
      const struggling=recent.filter(x=>x==='miss').length>=2;
      const pri=struggling?['fence','tower','chicken','farmer','pond','hall','feast']:['chicken','farmer','pond','tower','hall','fence','feast'];
      offers.sort((x,y)=>pri.indexOf(x)-pri.indexOf(y));
      clock+=kind==='guess'?.8:2.5;
      if(offers.length){C.buy(s,offers[0]);clock+=1.0;if(!firstBuy)firstBuy=qn;if(!done&&C.built(s)>=26)done=clock/60}}
    else{if(outcome==='miss'){miss++;clock+=1.2}else second++;
      const learn=C.learnTicks(q)*C.TICK;clock+=learn+(kind==='guess'?.4:1.0)}
    s.index++;
  }
  return {done:done||99,firstBuy,earned,first,second,miss,fast,qn,built:C.built(s),wolves:C.wolves(s),hidden:s.hidden,chickens:s.chickens,level:s.level,fence:s.fence,help:s.help};
}
function avg(age,mode,kind,min,N=200){const acc={};for(let i=0;i<N;i++){const r=play(age,mode,kind,min);for(const k in r)acc[k]=(acc[k]||0)+r[k]/N}return acc}
console.log('\n== 같은 시간 수입(골드) 10분/20분 · 찍기 대비 비');
for(const a of Q.AGES)for(const m of Q.MODES){
  const row=[];for(const min of [10,20]){const g=avg(a,m,'guess',min),s=avg(a,m,'read_slow',min),t=avg(a,m,'read_typ',min),f=avg(a,m,'read_fast',min);
    row.push(`${min}분 찍기 ${g.earned.toFixed(0)} 느림 ${s.earned.toFixed(0)} 보통 ${t.earned.toFixed(0)} 빠름 ${f.earned.toFixed(0)} | 찍기/느림 ${(g.earned/s.earned).toFixed(2)}`)}
  console.log(a,m.padEnd(5),row.join('  ||  '))}
console.log('\n== 20분 상세(보통 아이): 문제 수, 한번에/두번째/놓침, 번개, 지은 수, 늑대, 숨은 닭');
for(const a of Q.AGES)for(const m of Q.MODES){for(const k of ['read_slow','read_typ','read_fast','guess']){const r=avg(a,m,k,20,100);
  console.log(a,m.padEnd(5),k.padEnd(9),'문제',r.qn.toFixed(0),'한번',(r.first/r.qn*100).toFixed(0)+'%','두번째',(r.second/r.qn*100).toFixed(0)+'%','놓침',(r.miss/r.qn*100).toFixed(0)+'%','번개',(r.fast/Math.max(1,r.first)*100).toFixed(0)+'%','지음',r.built.toFixed(1),'늑대',r.wolves.toFixed(1),'타워',r.level.toFixed(1),'닭',r.chickens.toFixed(1),'숨음',r.hidden.toFixed(1),'울타리',r.fence.toFixed(1),'도움',r.help.toFixed(1),'완성(분)',r.done.toFixed(1),'첫구매(문제)',r.firstBuy.toFixed(1))}}
