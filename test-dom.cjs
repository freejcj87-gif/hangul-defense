/* node test-dom.cjs : 0.6 규칙(combat.js) 검사 + 가짜 DOM 위에서 실제 게임 스크립트(index.html 인라인)를 틱 단위로 돌리는 흐름 검사.
   브라우저·실제 음성·기기 검증이 아니다(그건 test.cjs와 실기기). */
const fs=require('fs'),assert=require('node:assert/strict'),C=require('./combat.js'),W=require('./world.js'),Q=require('./questions.js');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
const src=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const KEY='hangul-defense-v1';
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++};const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++};
const bank=(a,m)=>Array.from({length:Q.count(a,m)},(_,i)=>Q.get(a,m,i));
const S=(o)=>Object.assign(C.fresh(8),o||{});

/* ======================= 1. 규칙 모듈 ======================= */
eq(C.API,2,'규칙 API 버전');
/* 1-1 제한시간: 짧은 문제(7세 전부·8세 소리·9세 소리)는 8~10초, 긴 글은 길이에 비례(최대 50초), 언제나 보통 아이 필요 시간 이상 */
let shortCount=0;
for(const a of Q.AGES)for(const m of Q.MODES)for(const q of bank(a,m)){
 const sec=C.baseSeconds(q),need=C.needSeconds(q),tag=q.id;
 ok(Number.isInteger(sec)&&sec>=C.MIN_SEC[a]&&sec<=C.MAX_SEC,tag+' 제한시간 범위 '+sec);
 ok(sec>=need,tag+' 보통 아이 필요 시간('+need.toFixed(1)+'초) 이상');
 eq(C.limit(q,S()),sec*10,tag+' 틱 = 초×10');
 if(a===7||m==='sound'&&a<=9){ok(sec>=8&&sec<=10,tag+' 짧은 문제 8~10초');shortCount++}else ok(sec>10,tag+' 긴 글은 10초보다 김');
 const lock=C.reveal(q);
 if(m==='story'&&a>=8){ok(lock>3&&lock<C.limit(q,S())*.3,tag+' 글 먼저 읽기 잠금은 제한시간의 30% 미만')}else eq(lock,3,tag+' 보기 잠금 0.3초');
 const lesson=C.lesson(q);ok(lesson.includes(q.choices[q.answer]),tag+' 놓친 뒤 읽어 줄 글에 정답');
 if(m==='story')ok(lesson.includes(q.passage.split('\n')[0]),tag+' 읽어 줄 글에 지문');
 ok(C.scale(q)>=1&&C.scale(q)<=5,tag+' 긴 글 배수 1~5');
}
eq(shortCount,66,'8~10초 문항 수 66');
{const q=Q.get(8,'sound',0),base=C.limit(q,S());
 eq(C.limit(q,S({fence:6})),Math.round(base*1.3),'울타리 6칸 = +30%');
 eq(C.limit(q,S({help:2})),Math.round(base*1.4),'도움 2단계 = +40%');}

/* 1-2 수입: 시간을 늦게 쓴다고 늘지 않고(경과 시간은 입력이 아님), 번개면 25% 더 */
{const q=Q.get(8,'sound',0),s=S();
 const a=C.income(s,q,false),b=C.income(s,q,true);
 eq([a.base,a.eggs,a.value,a.gold],[8,1,4,12],'처음 수입 = 기본 8 + 알 1×4');
 eq(b.gold,15,'번개 +25%(올림)');ok(b.gold>a.gold,'빨리 맞히면 더 받음');
 const long=Q.get(10,'story',0);ok(C.income(s,long,false).gold>a.gold*3,'긴 글은 문제당 더 받음');
 eq(C.income(S({chickens:4,hidden:1}),q,false).eggs,3,'숨은 닭은 알을 못 낳음');}

/* 1-3 결말 반영 */
{const q=Q.get(8,'sound',0);
 let s=S({hidden:1,chickens:3,help:2});const r=C.settle(s,q,'first',{fast:true});
 eq([s.gold,s.wins,s.hidden,s.help],[20+r.gold,1,0,1],'한 번에 정답: 금화·정답 수·숨은 닭 1마리 복귀·도움 1단계 감소');
 eq(r.eggs,2,'복귀한 닭은 이번에는 알을 낳지 않음');
 s=S();const before=JSON.stringify(s);C.settle(s,q,'second');eq(JSON.stringify(s),before,'두 번째 정답: 금화·카드 없음, 상태 그대로');
 s=S({chickens:3});let m=C.settle(s,q,'miss',{timeout:true});eq([m.wolves,m.shot,m.through,m.scared,s.hidden,s.misses,s.late],[1,0,1,1,1,1,1],'놓침: 늑대 1마리가 닭 1마리를 숨게 함');
 m=C.settle(s,q,'miss',{timeout:true});eq([s.help,s.late],[1,0],'시간 초과 2연속 → 도움 1단계');
 s=S({chickens:3,late:1});C.settle(s,q,'miss',{timeout:false});eq([s.help,s.late],[0,0],'틀려서 놓친 것은 시간 초과로 세지 않음');
 s=S({chickens:8,level:5,fence:6,farmers:2,pond:3,hall:3});eq(C.wolves(s),5,'늑대 최대 5마리');m=C.settle(s,q,'miss');eq([m.shot,m.scared],[5,0],'타워 5층이면 5마리 모두 쏨');
 s=S({chickens:2,level:1,fence:6,hall:3});eq(C.wolves(s),3,'지은 것 10개 → 늑대 3마리');m=C.raid(s);eq([m.shot,m.through,m.scared],[1,2,2],'타워 1층: 1마리 쏘고 2마리 통과');
 s=S({help:3,late:1});C.settle(s,q,'miss',{timeout:true});eq(s.help,3,'도움 최대 3단계');}

/* 1-4 카드 3장: 같은 상태면 같은 3장, 그 칸에서 사면 다음 종류로 */
{let s=S({gold:9999});eq(C.offers(s),['tower','chicken','hall'],'처음 카드');eq(C.offers(s),C.offers(JSON.parse(JSON.stringify(s))),'같은 상태 = 같은 카드');
 eq(C.buy(s,'tower'),40,'타워 40');eq(C.offers(s)[0],'fence','타워를 사면 지켜요 칸이 울타리로');
 eq(C.buy(s,'fence'),20,'울타리 20');eq(C.offers(s)[0],'tower','다시 타워');
 ok(!C.offers(s).includes('farmer')&&!C.offers(s).includes('pond'),'회관 전에는 농부·연못 없음');
 C.buy(s,'hall');eq(s.hall,1,'회관 1');C.buy(s,'chicken');ok(C.offers(s).includes('farmer'),'회관 1단계 → 농부 카드');
 const s2=S({gold:9999,hall:2,chickens:2,farmers:0});const seen=new Set();for(let i=0;i<6;i++){const k=C.offers(s2)[1];seen.add(k);C.buy(s2,k)}ok(seen.has('pond')&&seen.has('farmer')&&seen.has('chicken'),'벌어요 칸은 닭·농부·연못이 번갈아');
 const s3=S({gold:9999,hall:3});ok(C.offers(s3).includes('feast'),'회관 3단계 → 잔치');
 const full=S({gold:9999,level:5,fence:6,chickens:8,farmers:2,pond:3,hall:3});eq(C.offers(full),[null,null,'feast'],'다 지으면 잔치만');eq(C.buy(full,'feast'),200,'잔치 200');eq(C.price(full,'feast'),260,'잔치 값은 점점 오름');
 const poor=S({gold:10});eq(C.buy(poor,'tower'),0,'금화가 모자라면 못 삼');eq(C.buy(S({gold:999}),'pond'),0,'제시되지 않은 카드는 못 삼');
 for(const k of C.ORDER)if(k!=='feast')eq(C.max(k),C.ITEMS[k].prices.length+(C.ITEMS[k].base||0),k+' 최대치');}

/* 1-5 모든 카드는 산 순간 수입·제한시간·방어·새 카드 가운데 하나가 바로 변한다(명분 있는 선택지) */
{const q=Q.get(8,'sound',0);
 for(const k of C.ORDER){
  const s=S({gold:99999,hall:k==='feast'?3:k==='farmer'?1:k==='pond'?2:0,chickens:3});
  /* 그 카드가 제시될 때까지 같은 칸의 다른 카드를 산다 */
  for(let i=0;i<20&&!C.offers(s).includes(k);i++){const o=C.offers(s)[C.ITEMS[k].slot];if(!o)break;C.buy(s,o)}
  ok(C.offers(s).includes(k),k+' 카드가 제시됨');
  const before={inc:C.income(s,q,false).gold,lim:C.limit(q,s),scared:C.raid(s).scared,shot:C.raid(s).shot,offers:C.offers(s).join()};
  ok(C.buy(s,k)>0,k+' 구매');
  const after={inc:C.income(s,q,false).gold,lim:C.limit(q,s),scared:C.raid(s).scared,shot:C.raid(s).shot,offers:C.offers(s).join()};
  const changed=after.inc>before.inc||after.lim>before.lim||after.shot>before.shot||(k==='hall'&&after.offers!==before.offers);
  ok(changed,k+' 산 즉시 효과가 보임 '+JSON.stringify([before,after]));
 }}

/* 1-6 저장 복원·0.5 이행 */
{eq(C.restore(null).gold,20,'저장 없음 → 새 판');eq(C.restore({version:2,gold:999}).gold,20,'모르는 버전은 무시');
 const old=C.restore({version:1,gold:120,hp:40,level:2,wins:9,index:4,mode:'story',age:9,chickens:3,fence:2,claimed:'story:4',completed:null,qage:9,combat:{stage:4}});
 eq([old.gold,old.level,old.wins,old.index,old.mode,old.age,old.chickens,old.fence,old.round],[120,2,9,5,'story',9,3,2,null],'0.5 저장 이행: 보상받은 문제는 다음으로');
 ok(!('hp' in old)&&!('combat' in old),'0.5 전투·성문 값은 버림');
 eq(C.restore({version:1,chickens:0}).chickens,1,'닭 0마리 저장 → 1마리');
 const big=C.restore({version:1,level:99,fence:99,chickens:99,farmers:99,pond:99,hall:99,hidden:99,help:9,age:12,gold:-5});
 eq([big.level,big.fence,big.chickens,big.farmers,big.pond,big.hall,big.hidden,big.help,big.age,big.gold],[5,6,8,2,3,3,8,3,8,20],'상한·하한·나이 보정');
 const r=C.restore({version:1,index:3,round:{token:'8:sound:3',phase:'pick',t:41,tries:0,gold:15}});eq(r.round,{token:'8:sound:3',phase:'pick',t:41,tries:0,gold:15},'진행 중 문제 복원');
 eq(C.restore({version:1,round:{token:'x',phase:'battle',t:1,tries:0}}).round,null,'모르는 단계는 버림');}

/* 1-7 늑대 세계(world.js) 규칙 */
{const S0=o=>Object.assign(C.fresh(8),o||{});
 /* 결정적: 같은 시드·같은 입력이면 같은 결과 */
 const run=(seed,n,s)=>{const w=W.create({seed,interval:300});W.sync(w,s);for(let i=0;i<n;i++)W.step(w,s);return w};
 eq(JSON.stringify(run(5,1500,S0({level:2,fence:2,chickens:4}))),JSON.stringify(run(5,1500,S0({level:2,fence:2,chickens:4}))),'같은 시드·같은 입력 = 같은 세계');
 ok(JSON.stringify(run(5,1500,S0()))!==JSON.stringify(run(6,1500,S0())),'시드가 다르면 무리 방향이 다름');
 /* 경제 상태와 맞추기 */
 let s=S0({level:2,fence:3,chickens:5,hall:1}),w=W.sync(W.create({seed:1,interval:300}),s);
 eq(w.buildings.filter(b=>b.kind==='tower').length,3,'타워 = 1 + level');eq(w.buildings.filter(b=>b.kind==='fence').map(b=>b.side),[0,1,2],'울타리 = 앞에서부터 면 3개');
 eq(w.hens.length,5,'닭 5마리');ok(w.buildings.some(b=>b.kind==='nursery'),'회관 1단계 → 작은 닭장');eq(W.radius(w),10,'회관 1단계 → 마을 반지름 10');
 const fence0=w.buildings.find(b=>b.kind==='fence'&&b.side===0);ok(Math.abs(Math.hypot(fence0.x,fence0.z)-10)<1e-9,'울타리는 마을 경계에');
 s.hall=2;W.sync(w,s);ok(Math.abs(Math.hypot(fence0.x,fence0.z)-13)<1e-9,'마을이 커지면 울타리도 바깥으로');
 /* 무리 일정 */
 s=S0();w=W.sync(W.create({seed:2,interval:300}),s);eq(W.barLeft(w),1,'처음 시간 바는 가득');
 for(let i=0;i<300-W.TRAVEL-1;i++)W.step(w,s);eq(w.wolves.length,0,'도착 '+W.TRAVEL+'틱 전까지는 늑대 없음');
 W.step(w,s);eq(w.wolves.length,1,'첫 무리 1마리가 가장자리에 나타남');const v=w.wolves[0];ok(Math.abs(Math.hypot(v.x,v.z)-(7+W.EDGE))<.5,'출현 지점 = 마을 반지름 + 10');
 const d0=Math.hypot(v.x,v.z);for(let i=0;i<20;i++)W.step(w,s);ok(Math.hypot(v.x,v.z)<d0-1,'늑대가 마을 쪽으로 걸어옴');
 ok(W.secondsLeft(w)>0&&W.barLeft(w)<1,'시간 바가 줄어듦');
 /* 무리 크기는 마을 크기를 따른다 */
 const pw=W.create({seed:1,interval:300});ok(W.packSize(pw,S0({level:5,fence:6,chickens:8,farmers:2,pond:3,hall:3}))>W.packSize(pw,S0())*10,'큰 마을에는 큰 무리');
 /* 울타리가 막는다: 그 방향 늑대는 울타리를 먼저 부순다 */
 s=S0({fence:6});w=W.sync(W.create({seed:3,interval:300}),s);for(const b of w.buildings)if(b.kind==='tower')b.broken=true;
 w.wolves.push({id:900,x:8,z:.5,sx:17,sz:1,hp:20,max:20,speed:.8,state:'walk',target:0,timer:0,inside:0,hen:0});
 for(let i=0;i<40;i++)W.step(w,s);eq(w.wolves[0].state,'smash','울타리 앞에서 부수기');const f0=w.buildings.find(b=>b.kind==='fence'&&b.side===W.sectorOf(8,.5));ok(f0.hp<f0.max,'울타리 체력이 준다');
 /* 닭은 숨고, 닭장이 부서지면 숨지 못한다 */
 s=S0({chickens:2});w=W.sync(W.create({seed:4,interval:3000}),s);for(const b of w.buildings)if(b.kind==='tower')b.broken=true;
 w.wolves.push({id:901,x:3,z:3,sx:12,sz:12,hp:20,max:20,speed:.8,state:'hunt',target:0,timer:0,inside:0,hen:0});
 for(let i=0;i<60;i++)W.step(w,s);ok(w.hens.every(h=>h.state==='hidden'||h.state==='flee'||h.state==='caught'||h.state==='carried'),'늑대가 들어오면 닭이 닭장으로');
 /* 닭을 물어 가면 사라지고, 도망치는 늑대를 쓰러뜨리면 돌아온다 */
 s=S0({chickens:1});w=W.sync(W.create({seed:5,interval:3000}),s);for(const b of w.buildings){if(b.kind==='tower'||b.kind==='coop')b.broken=true}
 const hen=w.hens[0];w.wolves.push({id:902,x:hen.x+.3,z:hen.z,sx:16,sz:0,hp:20,max:20,speed:.8,state:'hunt',target:0,timer:0,inside:0,hen:0});
 let lost=false;for(let i=0;i<400&&!lost;i++)lost=W.step(w,s).some(e=>e.type==='henLost');ok(lost,'닭장이 부서지면 늑대가 닭을 물어 감');eq(w.hens.length,0,'잃은 닭은 세계에서 사라짐');
 s=S0({chickens:1});w=W.sync(W.create({seed:6,interval:3000}),s);for(const b of w.buildings)if(b.kind==='coop')b.broken=true;
 const hen2=w.hens[0];hen2.state='carried';w.wolves.push({id:903,x:hen2.x+1,z:hen2.z+1,sx:16,sz:0,hp:5,max:20,speed:.8,state:'carry',target:0,timer:0,inside:0,hen:hen2.id});
 let saved2=false;for(let i=0;i<120&&!saved2;i++)saved2=W.step(w,s).some(e=>e.type==='henSaved');ok(saved2,'타워가 도망치는 늑대를 쓰러뜨리면 닭이 돌아옴');
 /* 건물이 부서지고 고쳐진다 */
 s=S0();w=W.sync(W.create({seed:7,interval:3000}),s);for(const b of w.buildings)if(b.kind==='tower')b.broken=true;
 const market=w.buildings.find(b=>b.kind==='market');w.wolves.push({id:904,x:market.x+1.5,z:market.z,sx:20,sz:0,hp:20,max:20,speed:.8,state:'hunt',target:0,timer:0,inside:0,hen:0});
 let broke=false;for(let i=0;i<400&&!broke;i++)broke=W.step(w,s).some(e=>e.type==='broken');ok(broke&&W.brokenCount(w)>=2,'늑대가 건물을 부숨');
 eq(W.repairAll(w)>=2&&W.brokenCount(w),0,'고치기로 모두 고침');
 /* 일제 사격 */
 s=S0({level:2});w=W.sync(W.create({seed:8,interval:3000}),s);w.wolves.push({id:905,x:5,z:5,sx:20,sz:20,hp:80,max:80,speed:.8,state:'walk',target:0,timer:0,inside:0,hen:0});
 eq(W.volley(w,s),3,'타워 3개 × 늑대 1마리 = 화살 3발');eq(w.arrows.length,3,'화살이 날아감');
 /* 저장 복원 */
 const back=W.restore(JSON.parse(JSON.stringify(run(9,800,S0({level:1,chickens:3})))));eq(back.t,800,'세계 저장·복원');eq(W.restore({v:2}).t,0,'모르는 형식은 새 세계');eq(W.restore(null,{interval:400}).interval,400,'없으면 새 세계');
}
/* 1-8 유인 구조(세계 포함): 같은 벽시계 10분 동안 제 나이 보통 속도로 읽는 아이가 찍는 아이보다 마을을 더 크게 키운다.
   읽기 속도·정확도·화면 시간은 가정값이다(scripts/sim-village.cjs와 같은 모형). */
{let seed=7;const rnd=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648};
 const RATE={7:120/2,8:120,9:180,10:230};
 const need=(q,r)=>{const rps=r/60,n=q.choices.length,cc=q.choices.reduce((s,c)=>s+C.syl(c),0),p=C.syl(q.passage);
  return q.mode==='sound'?1+cc/rps+.4*n:1.5+p/rps+(q.age===7?0:C.syl(q.prompt)/rps)+cc/rps+.4*n+(q.age>=9?.3*p/rps:0)};
 const interval=(age,mode)=>{const t=Array.from({length:Q.count(age,mode)},(_,i)=>C.baseSeconds(Q.get(age,mode,i))).sort((a,b)=>a-b);return Math.round(3*t[t.length>>1]/W.TICK)};
 function play(age,mode,kind,minutes){
  const s=C.fresh(age);s.mode=mode;const w=W.sync(W.create({seed:Math.floor(rnd()*1e9),interval:interval(age,mode)}),s);let clock=0;
  const go=sec=>{for(let i=0;i<Math.round(sec/W.TICK);i++)for(const e of W.step(w,s))if(e.type==='henLost')s.chickens=Math.max(0,s.chickens-1);clock+=sec};
  while(clock<minutes*60){
   const q=Q.get(age,mode,s.index),n=q.choices.length,lock=C.reveal(q)/10;if(mode==='sound')go(1+C.syl(q.speak)/4.5);
   const t=kind==='guess'?lock+.4:Math.max(lock+.3,need(q,RATE[age])*(.75+rnd()*.5)),ok1=kind==='guess'?rnd()<1/n:rnd()<.85;go(t);
   if(ok1){C.settle(s,q,'first',{fast:t<=C.baseSeconds(q)*(1-C.FAST)});W.volley(w,s);s.broken=W.brokenCount(w);clock+=kind==='guess'?1.5:4;
    const o=C.offers(s).filter(k=>k&&C.canBuy(s,k)).sort((a,b)=>['repair','tower','chicken','fence','hall','farmer','pond','feast'].indexOf(a)-['repair','tower','chicken','fence','hall','farmer','pond','feast'].indexOf(b));
    if(o.length){C.buy(s,o[0]);if(o[0]==='repair')W.repairAll(w);W.sync(w,s);clock+=1.2}}
   else{go(W.dashTicks(w)*W.TICK);go(kind==='guess'?.4:need(q,RATE[age])*.35);go(C.syl(C.lesson(q))/4.5+1.2+(kind==='guess'?.4:1))}
   s.index++}
  return C.built(s)}
 const avg=(a,m,k)=>{let t=0;for(let i=0;i<6;i++)t+=play(a,m,k,10);return t/6};
 for(const [a,m] of [[7,'sound'],[8,'sound'],[9,'story'],[10,'story']]){const typ=avg(a,m,'typ'),g=avg(a,m,'guess');ok(typ>g*1.4,`${a}세 ${m}: 보통 아이 지은 것 ${typ.toFixed(1)} > 찍기 ${g.toFixed(1)}×1.4 (10분)`)}
}

/* ======================= 2. 가짜 DOM 위의 실제 게임 ======================= */
let saved={};
function boot(opts={}){
 const nodes={},intervals=[],speakLog=[],pending=[],docHandlers={},winHandlers={};
 class E{
  constructor(tag){this.tagName=tag||'div';this.style={setProperty(k,v){this[k]=v}};this.dataset={};this.children=[];this.disabled=false;this.checked=false;this.hidden=false;this._t='';this.value='';this.offsetWidth=40;this.clientWidth=390;this.clientHeight=260;this.attrs={};const set=this._c=new Set();
   this.classList={add:(...n)=>n.forEach(x=>set.add(x)),remove:(...n)=>n.forEach(x=>set.delete(x)),contains:n=>set.has(n),toggle:(n,f)=>{const on=f===undefined?!set.has(n):!!f;on?set.add(n):set.delete(n);return on}}}
  get className(){return [...this._c].join(' ')}set className(v){this._c.clear();String(v).split(/\s+/).filter(Boolean).forEach(x=>this._c.add(x))}
  get textContent(){return this.children.length?this._t+this.children.map(c=>c.textContent).join(''):this._t}set textContent(v){this._t=String(v);this.children=[]}
  set innerHTML(v){this.children=[];this._t=''}append(...ns){for(const n of ns){if(typeof n==='string'){const t=new E('#text');t._t=n;this.children.push(t)}else{n.parentNode=this;this.children.push(n)}}}
  setAttribute(k,v){this.attrs[k]=String(v)}getAttribute(k){return this.attrs[k]}remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(x=>x!==this)}
  click(){if(!this.disabled&&this.onclick)this.onclick()}getBoundingClientRect(){return {left:0,top:0,width:0,height:0}}scrollIntoView(){}
 }
 const document={body:new E('body'),hidden:false,getElementById:id=>nodes[id]??=new E(),createElement:t=>new E(t),addEventListener:(k,f)=>{(docHandlers[k]??=[]).push(f)}};
 if(opts.reduced)document.body.classList.add('reduced');
 const window={addEventListener:(k,f)=>{(winHandlers[k]??=[]).push(f)}};
 const events=[],built=[];
 if(opts.view)window.VillageView={build:k=>{built.push(k);return {x:.4,y:.5}},reward(){},events:l=>events.push(...l),inspect(){return {ready:true}}};
 const tts=opts.tts||'sync';let U;
 if(tts!=='none'){
  window.speechSynthesis={speak(u){speakLog.push(u.text);if(tts==='sync'){u.onstart&&u.onstart();u.onend&&u.onend()}else if(tts==='error')u.onerror&&u.onerror({error:'synthesis-failed'});else if(tts==='manual'){u.onstart&&u.onstart();pending.push(u)}},
   cancel(){pending.splice(0).forEach(u=>u.onerror&&u.onerror({error:'canceled'}))},getVoices(){return [{lang:'ko-KR',name:'가짜 음성'}]}};
  U=function(t){this.text=t}}
 const localStorage={getItem:k=>k in saved?saved[k]:null,setItem:(k,v)=>{saved[k]=v}};
 const api=new Function('document','window','localStorage','setInterval','setTimeout','confirm','Combat','World','Questions','SpeechSynthesisUtterance','performance',
  src+'\nreturn {get state(){return state},get phase(){return phase},get round(){return round},get paused(){return paused},get voiceOff(){return voiceOff},get world(){return world},render};')
  (document,window,localStorage,f=>{intervals.push(f);return intervals.length},()=>0,()=>true,C,W,Q,U,undefined);
 const n=new Proxy(nodes,{get:(t,k)=>typeof k==='string'?(t[k]??=new E()):t[k]}),kids=()=>n.answers.children;
 const h={n,api,events,built,speakLog,pending,intervals,document,window,
  tick(c=1){for(let i=0;i<c;i++)intervals[0]()},
  go(){n.go.click()},
  btn:i=>kids().find(b=>Number(b.dataset.i)===i),
  right(){h.btn(api.round.q.answer).click()},
  wrongIndex(k=0){return api.round.q.choices.map((_,i)=>i).filter(i=>i!==api.round.q.answer)[k]},
  wrong(k=0){h.btn(h.wrongIndex(k)).click()},
  cards:()=>n.cards.children,
  card:k=>n.cards.children.find(b=>b.dataset.kind===k),
  untilAsk(){for(let i=0;i<200&&api.phase!=='ask';i++)h.tick()},
  unlock(){for(let i=0;i<600&&api.round.lock>0;i++)h.tick()},
  speechEnd(){const u=pending.shift();u&&u.onend&&u.onend()},
  hide(v){document.hidden=v;(docHandlers.visibilitychange||[]).forEach(f=>f())},
  unload(){(winHandlers.beforeunload||[]).forEach(f=>f())},
  game:()=>window.__game()};
 return h;
}
const fresh=o=>{saved={};return boot(o)};
const seed=(s,o)=>{saved={[KEY]:JSON.stringify({version:1,...C.fresh(8),...s})};return boot(o)};
function shows(a,age,mode,index,msg){
 const q=Q.get(age,mode,index),list=a.n.answers;
 eq([list.dataset.qid,list.dataset.age,list.dataset.mode],[q.id,String(age),mode],msg+' 문항 '+q.id);
 eq(a.n.prompt.textContent,q.prompt,msg+' 질문');eq(a.n.passage.textContent,q.passage||'',msg+' 지문');
 eq([...list.children].map(b=>b._t).sort(),q.choices.slice().sort(),msg+' 보기');
 ok(a.n.levelChip.textContent.startsWith(age+'세 · '),msg+' 단계 표시');
}

/* 2-1 시작 화면과 시계(시간 바 = 다음 늑대 무리 도착) */
const pct=w=>(Math.round(W.barLeft(w)*1000)/10)+'%';
let a=fresh();
eq(a.intervals.length,1,'시계 인터벌은 1개');eq(a.api.phase,'start','처음엔 시작 화면');ok(!a.n.start.hidden,'시작 화면 보임');
eq(a.n.ageRow.children.map(b=>b.textContent),['7살','8살','9살','10살'],'시작 화면 나이 4칸');
a.tick(30);eq(a.api.round,null,'시작 화면에서는 문제 없음');eq(a.api.world.t,0,'시작 화면에서는 늑대 세계도 멈춤');
for(const id of ['battle','next','shield','combatInfo','buildPrompt','buyChicken','buyFence'])ok(!html.includes('id="'+id+'"'),'0.5 요소 제거: '+id);
ok(!html.includes('소리 도움말'),'정답을 글자로 보여 주던 소리 도움말 제거');
ok(html.includes('src="combat.js?v=0.7"')&&html.includes('src="world.js?v=0.7"')&&html.includes('src="village.js?v=0.7"'),'캐시 갱신용 ?v=0.7');
a.go();ok(a.n.start.hidden,'시작하면 시작 화면 닫힘');eq(a.api.phase,'ask','소리 모드: 다 들은 뒤 풀이 시작');eq(a.speakLog[0],Q.get(8,'sound',0).speak,'문제 소리를 읽어 줌');
shows(a,8,'sound',0,'시작');
ok(a.api.world.interval>=200,'무리 간격');eq(a.n.timeFill.style.width,pct(a.api.world),'시간 바 = 다음 무리까지 남은 시간');
let w0=a.api.world.t;a.tick(10);eq(a.api.round.t,10,'풀이 시간 10틱');eq(a.api.world.t,w0+10,'늑대 세계도 10틱');eq(a.n.timeFill.style.width,pct(a.api.world),'시간 바가 줄어듦');eq(a.n.wolfHead.style.left,a.n.timeFill.style.width,'늑대 머리가 시간 바 끝에');
ok(a.window.getVillageState().world===a.api.world,'3D 마을이 같은 늑대 세계를 읽음');eq(a.window.getVillageState().radius,7,'처음 마을 반지름 7');
ok(a.n.timeTag.textContent.startsWith('다음 무리'),'시간 바 글자: 다음 무리 몇 초');eq(a.api.world.towers===undefined,true,'(세계 상태는 건물 목록으로)');eq(a.api.world.buildings.filter(b=>b.kind==='tower').length,1,'처음 화살 타워 1개');

/* 2-2 듣기·음성 실패 */
a=fresh({tts:'manual'});a.go();eq(a.api.phase,'listen','듣는 중');const lw=a.api.world.t;a.tick(40);eq(a.api.round.t,0,'듣는 동안 풀이 시간은 시작 전');eq(a.api.world.t,lw+40,'늑대는 듣는 동안에도 옴');ok(a.n.answers.classList.contains('veiled'),'듣는 동안 보기 가림');
a.speechEnd();eq(a.api.phase,'ask','다 들으면 시작');ok(!a.n.answers.classList.contains('veiled'),'보기 보임');ok(!a.n.speak.classList.contains('hidden'),'소리 모드: 다시 듣기 버튼');
a.n.speak.click();a.tick(5);ok(a.api.round.t>=5,'다시 듣는 동안에도 시계가 흐름');
a=fresh({tts:'none'});a.go();eq([a.api.voiceOff,a.api.state.mode,a.api.phase],[true,'story','ask'],'음성 없음 → 읽고 고르기로 전환');ok(a.n.feedback.textContent.includes('소리'),'전환 안내');
a=fresh({tts:'never'});a.go();eq(a.api.phase,'listen','음성이 시작 안 됨');a.tick(31);eq([a.api.voiceOff,a.api.state.mode],[true,'story'],'3초 안에 시작 안 하면 음성 실패 처리');
a=fresh({tts:'error'});a.go();eq(a.api.state.mode,'story','음성 오류 → 읽고 고르기');

/* 2-3 읽기 모드 '글 먼저 읽기'와 읽기 중 듣기 금지 */
a=seed({age:9,mode:'story'});a.go();shows(a,9,'story',0,'9세 읽기');
ok(a.api.round.lock>3,'글 먼저 읽기 잠금');ok(a.n.answers.classList.contains('veiled'),'잠금 중 보기 가림');ok(a.n.speak.classList.contains('hidden'),'읽기 모드 풀이 중 듣기 버튼 없음');
eq(a.speakLog.length,0,'읽기 모드는 문제를 읽어 주지 않음');
a.right();eq(a.api.phase,'ask','잠금 중에는 눌러도 무시');const lock=a.api.round.lock;a.unlock();eq(a.api.round.t,lock,'잠금 동안에도 시계는 흐름');ok(!a.n.answers.classList.contains('veiled'),'잠금 끝나면 보기');

/* 2-4 한 번에 정답 → 일제 사격 → 늑대 세계 멈춤 → 카드 → 다음 문제 */
a=fresh({view:true});a.go();a.tick(3);
let g0=a.api.state.gold,exp=C.income(a.api.state,a.api.round.q,true).gold;a.right();
eq(a.api.phase,'pick','한 번에 정답 → 카드 고르기');eq(a.api.state.gold,g0+exp,'번개 정답 금화');ok(a.n.gainLine.textContent.includes('+'+exp),'받은 금화 표시');
ok(a.events.some(e=>e.type==='volley')&&a.events.some(e=>e.type==='produce'&&e.eggs===1),'3D: 일제 사격 + 알 팔기 연출');
const wt=a.api.world.t,wStop=a.n.timeFill.style.width;a.tick(80);eq(a.api.world.t,wt,'고르는 동안 늑대 세계 멈춤');eq(a.n.timeFill.style.width,wStop,'고르는 동안 시간 바도 멈춤');
eq(a.cards().length,3,'카드 3장');eq(a.cards().map(b=>b.dataset.kind),C.offers(a.api.state),'카드 = 규칙의 3장');ok(a.n.answers.classList.contains('hidden'),'보기 자리를 카드가 대신');
a=fresh();a.go();a.unlock();a.right();
const yay=a.btn(a.api.round.q.answer);ok(yay.classList.contains('yay')&&yay.classList.contains('correct'),'맞힌 보기가 통통 튐');ok(yay.children.some(x=>x.classList.contains('btn-ring'))&&yay.children.filter(x=>x.classList.contains('btn-star')).length===12,'맞힌 보기에 초록 고리와 별 12개');
ok(yay.children.some(x=>x.classList.contains('btn-yay')&&x.textContent==='⚡ 번개!'),'번개로 맞히면 보기 위에 ⚡ 번개!');
eq(a.cards().length,0,'0.7초 동안은 맞힌 보기 연출만(카드 없음, 두 번 누르기 방지)');ok(!a.n.answers.classList.contains('hidden'),'그동안 보기가 보임');
a.tick(6);eq(a.cards().length,0,'0.6초에도 아직');a.tick(1);eq(a.cards().length,3,'0.7초에 카드 3장');ok(a.n.answers.classList.contains('hidden'),'카드가 보기 자리를 대신');ok(!a.card('chicken').disabled,'카드 바로 누를 수 있음');eq(a.card('tower').disabled,a.api.state.gold<40,'금화가 모자란 카드는 잠김');
g0=a.api.state.gold;a.card('chicken').click();eq([a.api.phase,a.api.state.chickens,a.api.state.gold],['build',2,g0-25],'닭 데려오기');eq(a.api.state.index,1,'고르면 다음 문제로');eq(a.api.world.hens.length,2,'늑대 세계에도 닭 2마리');
a.tick(12);eq(a.api.phase,'ask','짓는 연출 뒤 바로 다음 문제');shows(a,8,'sound',1,'다음 문제');eq(a.api.round.t,0,'새 문제 풀이 시간');
a=fresh();a.go();a.unlock();a.api.state.gold=500;a.right();a.tick(7);a.card('tower').click();eq(a.api.world.buildings.filter(b=>b.kind==='tower').length,2,'타워 세우기 → 화살 타워 2개');
/* 금화 모으기 */
a=fresh();a.go();a.unlock();a.right();a.tick(7);g0=a.api.state.gold;a.n.skip.click();eq([a.api.phase,a.api.state.gold,a.api.state.index],['build',g0,1],'금화 모으기 → 다음 문제');a.tick(3);eq(a.api.phase,'ask','곧 다음 문제');
/* 늦게 맞히면 번개 없음 */
a=fresh();a.go();a.tick(Math.ceil(C.baseSeconds(a.api.round.q)*10*.7));exp=C.income(a.api.state,a.api.round.q,false).gold;g0=a.api.state.gold;a.right();eq(a.api.state.gold,g0+exp,'늦게 맞히면 번개 없음');

/* 2-5 틀림 → 늑대 성큼(세계 빨리 감기) → 두 번째 정답(금화 없음) → 정답 누르고 다음 */
a=fresh({view:true});a.go();a.tick(5);a.wrong(0);
eq(a.api.round.tries,1,'한 번 틀림');ok(a.btn(a.wrongIndex(0)).classList.contains('wrong'),'틀린 보기 표시');ok(a.events.some(e=>e.type==='dash'),'3D: 늑대 성큼');
a.right();eq(a.api.phase,'ask','성큼 다가오는 동안은 못 누름');const wb=a.api.world.t;a.tick(C.DASH_TICKS);
eq(a.api.world.t-wb,Math.max(1,Math.round(W.dashTicks(a.api.world)/C.DASH_TICKS))*C.DASH_TICKS,'틀리면 늑대 세계가 무리 간격의 12%만큼 빨리 감김');
g0=a.api.state.gold;a.right();eq([a.api.phase,a.api.round.result,a.api.state.gold],['learn','second',g0],'두 번째 정답: 금화 없음');eq(a.btn(a.api.round.q.answer).children.filter(x=>x.classList.contains('btn-star')).length,6,'두 번째 정답은 작은 연출(별 6개)');ok(a.cards().length===0||a.n.choices.classList.contains('hidden'),'카드 없음');
eq(a.speakLog.at(-1),C.lesson(a.api.round.q),'정답을 읽어 줌');a.btn(a.api.round.q.answer).click();eq(a.api.phase,'learn','다 읽기 전(1초)에는 안 넘어감');
a.tick(10);ok(a.api.round.ready,'읽고 나면 누를 수 있음');ok(a.btn(a.api.round.q.answer).classList.contains('tap-me'),'초록 답 깜빡임');
a.btn(a.wrongIndex(1)).click();eq(a.api.phase,'learn','다른 보기는 무시');a.right();eq([a.api.phase,a.api.state.index],['ask',1],'초록 답을 누르면 다음 문제');
/* 두 번 틀림 → 정답 배우기(늑대는 계속 옴) */
a=fresh({view:true});a.go();a.unlock();a.wrong(0);a.tick(C.DASH_TICKS);a.wrong(1);
eq([a.api.phase,a.api.round.result,a.api.state.misses],['learn','miss',1],'두 번 틀리면 정답 배우기');ok(a.n.feedback.textContent.includes('두 번 틀렸어요'),'안내');
const lw2=a.api.world.t;a.tick(500);eq([a.api.phase,a.api.state.misses],['learn',1],'손대지 않으면 그대로 기다림(자리 비운 아이가 연달아 놓치지 않게)');ok(a.api.world.t>lw2,'배우는 동안에도 늑대는 옴');

/* 2-6 늑대 세계 → 경제: 닭을 잃고, 건물이 부서지면 고치기 카드 */
a=fresh({view:true});a.go();a.unlock();
{const w=a.api.world,hen=w.hens[0];for(const b of w.buildings)if(b.kind==='tower')b.broken=true;hen.state='carried';
 w.wolves.push({id:999,x:0,z:-16.9,sx:0,sz:-17,hp:20,max:20,speed:.8,state:'carry',target:0,timer:0,inside:0,hen:hen.id});
 a.tick(3);eq(a.api.state.chickens,0,'늑대가 닭을 물어 가면 닭 수가 준다');ok(a.events.some(e=>e.type==='henLost'),'3D: 닭 잃음 사건');ok(a.n.villageStatus.textContent.includes('물어 갔어요'),'잃었다는 안내');
 a.api.state.gold=300;a.right();a.tick(7);ok(a.card('repair'),'부서진 건물이 있으면 고치기 카드');eq(a.cards()[0].dataset.kind,'repair','고치기는 지켜요 칸에 먼저');
 g0=a.api.state.gold;const price=C.price(a.api.state,'repair');a.card('repair').click();eq([W.brokenCount(a.api.world),a.api.state.repairs,a.api.state.gold],[0,1,g0-price],'고치기로 모두 고침');}

/* 2-7 쉬기·탭 숨김: 늑대 세계도 멈춘다 */
a=fresh();a.go();a.tick(4);a.n.pause.click();ok(a.api.paused&&a.document.body.classList.contains('paused'),'쉬기');ok(a.document.body.classList.contains('covered'),'쉬는 동안 문제를 가림(공짜 읽기 시간 방지)');
const pw=a.api.world.t;a.tick(50);eq(a.api.round.t,4,'쉬는 동안 시계 멈춤');eq(a.api.world.t,pw,'쉬는 동안 늑대 세계도 멈춤');a.right();eq(a.api.phase,'ask','쉬는 동안 못 누름');a.n.pause.click();a.tick(2);eq(a.api.round.t,6,'다시 흐름');
a=fresh({tts:'manual'});a.go();a.n.pause.click();eq(a.pending.length,0,'쉬면 읽기 멈춤');a.n.pause.click();eq(a.pending.length,1,'계속하면 다시 읽음');
a=fresh();a.go();a.hide(true);ok(a.api.paused,'탭이 숨으면 자동으로 쉬기');a.tick(20);eq(a.api.round.t,0,'숨은 동안 시계 멈춤');
a=fresh();a.go();a.unlock();a.right();a.n.pause.click();ok(!a.document.body.classList.contains('covered'),'카드 고르기는 가리지 않음');a.n.pause.click();a.tick(7);a.n.pause.click();a.card('chicken').click();eq(a.api.phase,'pick','쉬는 동안 못 삼');

/* 2-8 나이·모드 전환: 문제 중이면 바로 그 나이 문제로, 정답 뒤면 다음 문제부터. 늑대 세계는 그대로, 무리 간격만 새 나이에 맞춤 */
for(const age of Q.AGES)for(const mode of Q.MODES){
 a=seed({age,mode});a.go();shows(a,age,mode,0,`${age}세 ${mode} 시작`);
 for(const to of Q.AGES){if(to===age)continue;a.n.age.value=String(to);a.n.age.onchange();shows(a,to,mode,0,`${age}→${to}세 전환`);eq(a.api.state.age,to,'저장되는 나이')}
}
a=seed({index:3});a.go();a.tick(20);const wt7=a.api.world.t,iv7=a.api.world.interval;a.n.age.value='10';a.n.age.onchange();shows(a,10,'sound',3,'문제 중 전환');eq(a.api.world.t,wt7,'전환해도 늑대 세계는 그대로');ok(a.api.world.interval>iv7,'무리 간격은 새 나이·모드에 맞춤');
a.n.mode.click();shows(a,10,'story',3,'모드 전환');eq(a.n.mode.textContent,'🔊 듣고 고르기로','모드 버튼 문구');
a=fresh();a.go();a.unlock();a.right();a.n.age.value='7';a.n.age.onchange();shows(a,8,'sound',0,'정답 뒤에는 그대로');ok(a.n.feedback.textContent.includes('다음 문제부터 7세'),'다음부터 적용 안내');a.tick(7);a.n.skip.click();a.tick(3);shows(a,7,'sound',1,'다음 문제는 7세');
a=seed({index:Q.count(8,'sound')});a.go();const lap1=a.n.answers.children.map(b=>b.dataset.i).join();eq(lap1,Q.get(8,'sound',0).choices.map((_,i)=>String((i+1)%3)).join(),'두 바퀴째는 보기를 한 칸 돌림');

/* 2-9 저장·복원(늑대 세계 포함) */
a=fresh();a.go();a.tick(7);a.right();g0=a.api.state.gold;a.tick(2);
let b=boot();eq(b.n.go.textContent,'이어서 하기 ▶','하던 문제가 있으면 이어서 하기');b.go();eq([b.api.phase,b.api.state.gold],['pick',g0],'카드 고르기로 복원, 금화 이중 지급 없음');eq(b.cards().length,3,'복원하면 카드가 바로');b.card('chicken').click();eq(b.api.state.chickens,2,'복원 뒤 구매');
a=fresh();a.go();a.tick(333);a.n.pause.click();const st9=JSON.stringify({...a.api.world,events:[]});b=boot();b.go();eq([b.api.phase,b.api.round.t],['ask',333],'문제 중 저장 → 같은 시계로 복원');eq(JSON.stringify({...b.api.world,events:[]}),st9,'늑대 세계(늑대·닭·건물)도 그대로 복원');
a=fresh();a.go();a.unlock();a.wrong(0);a.tick(C.DASH_TICKS);a.wrong(1);b=boot();b.go();eq(b.api.phase,'learn','놓친 문제는 정답 보기부터');b.tick(10);b.right();eq(b.api.state.index,1,'복원 뒤 다음 문제');
saved={[KEY]:JSON.stringify({version:1,gold:77,hp:30,level:1,wins:4,index:2,mode:'sound',age:9,chickens:0,fence:1,claimed:'sound:2',completed:null,combat:{stage:2,done:false}})};
b=boot();b.go();eq([b.api.state.gold,b.api.state.level,b.api.state.chickens,b.api.state.index,b.api.phase],[77,1,1,3,'ask'],'0.5 저장으로 시작');shows(b,9,'sound',3,'0.5 저장 다음 문제');eq(b.api.world.buildings.filter(x=>x.kind==='tower').length,2,'0.5 저장의 타워 단계 → 화살 타워 2개');
saved[KEY]='broken';b=boot();b.go();eq(b.api.state.gold,20,'깨진 저장 → 새 판');shows(b,8,'sound',0,'깨진 저장은 8세부터');
a=fresh();a.go();a.unlock();a.right();b=boot();eq(b.api.phase,'start','다시 열면 시작 화면');const before=JSON.parse(saved[KEY]).round;ok(before&&before.phase==='pick','저장된 하던 문제');
b.unload();eq(JSON.parse(saved[KEY]).round,before,'시작 화면에서 떠나도 하던 문제를 지우지 않음');

/* 2-10 처음부터·움직임 줄이기·3D 상태 */
a=seed({gold:500,level:3,chickens:5});a.go();a.tick(400);a.n.reset.click();eq([a.api.state.gold,a.api.state.level,a.api.state.chickens,a.api.state.index],[20,0,1,0],'처음부터');ok(a.api.world.t<5&&a.api.world.wolves.length===0,'처음부터 → 늑대 세계도 새로');
a=fresh();a.n.motion.checked=true;a.n.motion.onchange();ok(a.document.body.classList.contains('reduced'),'움직임 줄이기');
a=fresh({view:true});a.go();a.unlock();a.right();a.tick(7);a.card('chicken').click();eq(a.built,['chicken'],'3D 마을에 지은 것 전달');
const vs=a.window.getVillageState();for(const k of ['phase','paused','level','chickens','fence','farmers','pond','hall','feast','wins','world','radius','tries','dash','result'])ok(k in vs,'getVillageState.'+k);
eq(vs.phase,'build','짓는 중 상태');
a=fresh();a.go();a.unlock();a.right();a.tick(7);a.card('chicken').click();eq(a.n.flock.children.length,2,'그림 마을 닭 2마리');ok(a.n.effects.children.some(x=>x.classList.contains('fx-label')),'이름표 연출');
a=fresh({reduced:true});a.go();a.unlock();a.right();ok(a.n.effects.children.some(x=>x.classList.contains('sale')),'움직임 줄이기에서도 알 판매 글자 띠');ok(!a.btn(a.api.round.q.answer).children.some(x=>x.classList.contains('btn-star')),'움직임 줄이기: 보기 별 없음');a.tick(7);a.card('chicken').click();ok(!a.n.effects.children.some(x=>x.classList.contains('fx-star')),'움직임 줄이기: 별 입자 없음');
/* 그림 마을(3D 없는 기기)에도 늑대가 세계 위치대로 나타남 */
a=fresh();a.go();a.tick(300);ok(a.n.enemies.children.filter(x=>!x.classList.contains('hidden')).length===a.api.world.wolves.filter(v=>v.state!=='gone').length,'그림 마을 늑대 수 = 세계 늑대 수');

/* 2-11 긴 판: 무작위로 맞히고 틀리고 사고 기다리는 120문제 동안 규칙 불변식 */
{a=fresh();a.go();let r=11;const rnd=()=>{r=(r*1103515245+12345)%2147483648;return r/2147483648};
 for(let step=0;step<120;step++){
  a.untilAsk();const st=a.api.state,w=a.api.world;ok(st.gold>=0&&st.chickens>=0&&st.chickens===w.hens.length&&w.wolves.length<=W.MAX_WOLVES,'불변식 '+step);
  const roll=rnd();if(roll<.6){a.unlock();a.right()}else if(roll<.8){a.unlock();a.wrong(0);a.tick(C.DASH_TICKS);if(rnd()<.5)a.right();else a.wrong(1)}else{a.tick(80);a.unlock();a.right()}
  if(a.api.phase==='pick'){a.tick(7);const can=a.cards().filter(b=>!b.disabled&&b.dataset.kind);if(can.length)can[Math.floor(rnd()*can.length)].click();else a.n.skip.click()}
  else if(a.api.phase==='learn'){a.tick(200);a.right()}
 }
 ok(a.api.state.index>=118,'120문제 진행');ok(a.api.world.stats.waves>5,'늑대 무리가 여러 번 옴');ok(a.api.world.stats.kills>0,'타워가 늑대를 쓰러뜨림');}

console.log('PASS '+checks+' rule + simulated DOM assertions. Not browser/audio/device validation.');
