/* node test-dom.cjs : 0.6~0.8 규칙(combat.js·world.js) 검사 + 가짜 DOM 위에서 실제 게임 스크립트(index.html 인라인)를 틱 단위로 돌리는 흐름 검사.
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
/* 1-1b 상식·수학·영어(4문제마다 1문제, 두 모드 공통): 풀이 시간·읽어 줄 글·섞는 순서 */
for(const a of Q.AGES)for(let i=0;i<Q.quizCount(a);i++){const q=Q.quiz(a,i),tag=q.id,sec=C.baseSeconds(q);
 ok(sec>=C.needSeconds(q)&&sec<=C.MAX_SEC,tag+' 풀이 시간 '+sec);eq(C.reveal(q),3,tag+' 바로 보임');
 const l=C.lesson(q),ans=q.choices[q.answer];ok(l.includes(q.speak)&&(C.sayable(ans)?l.includes(ans):l.includes('초록색 보기')&&!l.includes(ans)),tag+' 읽어 줄 글 = 질문 + 정답(그림·영어 정답은 초록 보기로)');ok(C.picks(q)>=1&&C.picks(q)<=3,tag+' 카드 1~3장')}
for(const m of Q.MODES){const seq=Array.from({length:12},(_,i)=>Q.at(8,m,i));
 eq(seq.map(q=>q.mode),[m,m,m,'quiz',m,m,m,'quiz',m,m,m,'quiz'],m+': 4문제마다 상식·수학·영어');
 eq(seq.filter(q=>q.mode!=='quiz').map(q=>q.id),Array.from({length:9},(_,i)=>Q.get(8,m,i).id),m+': 나머지는 그 모드 문제를 차례로');
 eq(seq.filter(q=>q.mode==='quiz').map(q=>q.cat),[Q.quiz(8,0).cat,Q.quiz(8,1).cat,Q.quiz(8,2).cat],m+': 섞인 문제는 분류가 돌아감')}
{const i=Array.from({length:200},(_,k)=>k).find(k=>Q.at(8,'sound',k).lap===1);eq(Q.at(8,'sound',i).id,Q.get(8,'sound',0).id,'두 바퀴째 첫 문제');}
eq([C.picks(Q.get(8,'sound',0)),C.picks(Q.get(10,'story',0))],[1,3],'카드 수: 짧은 문제 1장 · 긴 글 3장');
{const q=Q.get(8,'sound',0),base=C.limit(q,S());
 eq(C.limit(q,S({fence:6})),Math.round(base*1.3),'울타리 6칸 = +30%');
 eq(C.limit(q,S({help:2})),Math.round(base*1.4),'도움 2단계 = +40%');}

/* 1-2 수입: 시간을 늦게 쓴다고 늘지 않고(경과 시간은 입력이 아님), 번개면 25% 더 */
{const q=Q.get(8,'sound',0),s=S();
 const a=C.income(s,q,false),b=C.income(s,q,true);
 eq([a.base,a.eggs,a.value,a.gold],[8,1,4,12],'처음 수입 = 기본 8 + 알 1×4');
 eq(b.gold,15,'번개 +25%(올림)');ok(b.gold>a.gold,'빨리 맞히면 더 받음');
 const fa=Math.ceil(C.FAST_MIN*C.needSeconds(q)/C.TICK);ok(!C.isFast(q,3)&&!C.isFast(q,fa-1)&&C.isFast(q,fa)&&C.isFast(q,Math.floor(C.baseSeconds(q)*10*(1-C.FAST)))&&!C.isFast(q,Math.floor(C.baseSeconds(q)*10*(1-C.FAST))+1),'번개 = 최소 읽기 시간('+fa+'틱) ~ 기본 시간의 60%: 마구 누르기는 번개가 아님');
 const long=Q.get(10,'story',0);ok(C.income(s,long,false).gold>a.gold*3,'긴 글은 문제당 더 받음');
 eq(C.income(S({chickens:4,hidden:1}),q,false).eggs,3,'숨은 닭은 알을 못 낳음');
 /* 연속 정답: 2연속 ×1.1 … 6연속부터 ×1.5, 틀리면 처음부터 */
 const st=S();const golds=[];for(let i=0;i<7;i++)golds.push(C.settle(st,q,'first',{fast:false}).gold);
 eq(golds,[12,13,14,16,17,18,18],'연속 정답 금화 12→13→14→16→17→18(최대 ×1.5)');eq(st.streak,7,'연속 7');
 C.settle(st,q,'second');eq(st.streak,0,'두 번째에 맞히면 연속 끊김');C.settle(st,q,'first');C.settle(st,q,'miss');eq(st.streak,0,'놓쳐도 끊김');eq(C.combo(1),1,'첫 정답 ×1');}

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
 C.buy(s,'hall');eq(s.hall,1,'회관 1');eq(C.offers(s)[0],'power','회관 1단계 → 지켜요 칸에 타워 강화가 먼저');eq(C.buy(s,'power'),110,'타워 강화 110');C.buy(s,'chicken');ok(C.offers(s).includes('farmer'),'회관 1단계 → 농부 카드');
 ok(!C.offers(S({gold:9999})).includes('power'),'회관 전에는 타워 강화 없음');
 const s2=S({gold:9999,hall:2,chickens:2,farmers:0});const seen=new Set();for(let i=0;i<6;i++){const k=C.offers(s2)[1];seen.add(k);C.buy(s2,k)}ok(seen.has('pond')&&seen.has('farmer')&&seen.has('chicken'),'벌어요 칸은 닭·농부·연못이 번갈아');
 const s3=S({gold:9999,hall:3});ok(C.offers(s3).includes('feast'),'회관 3단계 → 잔치');
 const full=S({gold:9999,level:5,fence:6,chickens:8,farmers:2,pond:3,hall:3,power:3});eq(C.offers(full),[null,null,'feast'],'다 지으면 잔치만');eq(C.buy(full,'feast'),200,'잔치 200');eq(C.price(full,'feast'),260,'잔치 값은 점점 오름');
 const poor=S({gold:10});eq(C.buy(poor,'tower'),0,'금화가 모자라면 못 삼');eq(C.buy(S({gold:999}),'pond'),0,'제시되지 않은 카드는 못 삼');
 for(const k of C.ORDER)if(k!=='feast')eq(C.max(k),C.ITEMS[k].prices.length+(C.ITEMS[k].base||0),k+' 최대치');}

/* 1-5 모든 카드는 산 순간 수입·제한시간·방어·새 카드 가운데 하나가 바로 변한다(명분 있는 선택지) */
{const q=Q.get(8,'sound',0);
 for(const k of C.ORDER){
  const s=S({gold:99999,hall:k==='feast'?3:k==='farmer'||k==='power'?1:k==='pond'?2:0,chickens:3});
  /* 그 카드가 제시될 때까지 같은 칸의 다른 카드를 산다 */
  for(let i=0;i<20&&!C.offers(s).includes(k);i++){const o=C.offers(s)[C.ITEMS[k].slot];if(!o)break;C.buy(s,o)}
  ok(C.offers(s).includes(k),k+' 카드가 제시됨');
  const before={inc:C.income(s,q,false).gold,lim:C.limit(q,s),scared:C.raid(s).scared,shot:C.raid(s).shot,offers:C.offers(s).join(),pow:W.damage(s)+W.power(s).splash+W.power(s).multi};
  ok(C.buy(s,k)>0,k+' 구매');
  const after={inc:C.income(s,q,false).gold,lim:C.limit(q,s),scared:C.raid(s).scared,shot:C.raid(s).shot,offers:C.offers(s).join(),pow:W.damage(s)+W.power(s).splash+W.power(s).multi};
  const changed=after.inc>before.inc||after.lim>before.lim||after.shot>before.shot||after.pow>before.pow||(k==='hall'&&after.offers!==before.offers);
  ok(changed,k+' 산 즉시 효과가 보임 '+JSON.stringify([before,after]));
 }}

/* 1-6 저장 복원·0.5 이행 */
{eq(C.restore(null).gold,20,'저장 없음 → 새 판');eq(C.restore({version:2,gold:999}).gold,20,'모르는 버전은 무시');
 const old=C.restore({version:1,gold:120,hp:40,level:2,wins:9,index:4,mode:'story',age:9,chickens:3,fence:2,claimed:'story:4',completed:null,qage:9,combat:{stage:4}});
 eq([old.gold,old.level,old.wins,old.index,old.mode,old.age,old.chickens,old.fence,old.round],[120,2,9,5,'story',9,3,2,null],'0.5 저장 이행: 보상받은 문제는 다음으로');
 ok(!('hp' in old)&&!('combat' in old),'0.5 전투·성문 값은 버림');
 eq(C.restore({version:1,chickens:0}).chickens,1,'닭 0마리 저장 → 1마리');
 const big=C.restore({version:1,level:99,fence:99,chickens:99,farmers:99,pond:99,hall:99,hidden:99,help:9,age:12,gold:-5,power:99});
 eq([big.level,big.fence,big.chickens,big.farmers,big.pond,big.hall,big.hidden,big.help,big.age,big.gold,big.power],[5,6,8,2,3,3,8,3,8,20,3],'상한·하한·나이 보정');
 const r=C.restore({version:1,index:3,round:{token:'8:sound:3',phase:'pick',t:41,tries:0,gold:15}});eq(r.round,{token:'8:sound:3',phase:'pick',t:41,tries:0,gold:15,left:1},'진행 중 문제 복원(0.7 저장은 카드 1장)');
 eq(C.restore({version:1,round:{token:'8:story:3',phase:'pick',t:1,tries:0,gold:9,left:3}}).round.left,3,'남은 카드 수 복원');
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
 /* 0.8: 시작하자마자 낙오 늑대가 숲 가장자리에서 나온다(무리를 기다리지 않아도 늑대가 보임) */
 let evs=[];for(let i=0;i<5;i++)evs.push(...W.step(w,s));ok(evs.some(e=>e.type==='straggler')&&w.wolves.length>=1,'시작 0.5초 만에 낙오 늑대');
 const v=w.wolves[0];ok(Math.abs(Math.hypot(v.x,v.z)-(7+W.EDGE))<.9,'출현 지점 = 마을 반지름 + '+W.EDGE+'(숲 가장자리)');eq(v.kind,'wolf','처음엔 회색 늑대만');
 const d0=Math.hypot(v.x,v.z);for(let i=0;i<20;i++)W.step(w,s);ok(Math.hypot(v.x,v.z)<d0-1,'늑대가 마을 쪽으로 걸어옴');
 ok(W.secondsLeft(w)>0&&W.barLeft(w)<1,'시간 바가 줄어듦');
 let packAt=-1,seenTicks=0;for(let i=w.t;i<900;i++){const e=W.step(w,s);if(packAt<0&&e.some(x=>x.type==='pack'))packAt=w.t;if(w.wolves.some(x=>x.state!=='dead'))seenTicks++}
 eq(packAt,300-W.TRAVEL,'무리는 도착 '+W.TRAVEL+'틱 전에 나타남');ok(seenTicks/(900-25)>.9,'무리 사이에도 늑대가 거의 늘 보임('+Math.round(seenTicks/8.75)+'%)');
 eq([W.intervalFor(8),W.intervalFor(10),W.intervalFor(24),W.intervalFor(50)],[130,130,200,200],'무리 간격 13~20초');
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
 /* 일제 사격: 타워마다 2발(긴 글일수록·빨리 맞힐수록 더 많이, 최대 8발×1.5) */
 s=S0({level:2});w=W.sync(W.create({seed:8,interval:3000}),s);w.wolves.push({id:905,kind:'wolf',x:5,z:5,sx:20,sz:20,hp:80,max:80,speed:.8,state:'walk',target:0,timer:0,inside:0,hen:0});
 eq(W.volley(w,s),6,'타워 3개 × 2발 = 화살 6발');eq(w.arrows.length,6,'화살이 날아감');
 eq([W.volleyArrows(s,{}),W.volleyArrows(s,{fast:true}),W.volleyArrows(s,{scale:5}),W.volleyArrows(s,{scale:5,fast:true}),W.volleyArrows(S0({power:3}),{})],[2,3,8,12,4],'일제 사격 화살 수: 기본 2 · 번개 3 · 긴 글 8 · 긴 글 번개 12 · 세 갈래 +2');
 /* 타워는 닭을 물고 가는 늑대를 먼저 쏜다 */
 s=S0();w=W.sync(W.create({seed:10,interval:3000}),s);w.trickle=1e9;const t0=w.buildings.find(b=>b.kind==='tower');
 w.wolves.push({id:906,kind:'wolf',x:t0.x+1,z:t0.z,sx:20,sz:0,hp:99,max:99,speed:0,state:'walk',target:0,timer:0,inside:0,hen:0},{id:907,kind:'wolf',x:t0.x+4,z:t0.z,sx:20,sz:0,hp:99,max:99,speed:0,state:'carry',target:0,timer:0,inside:0,hen:0});
 W.step(w,s);eq(w.arrows.map(a=>a.wolf),[907],'가까운 늑대보다 닭을 물고 가는 늑대를 먼저');
 /* 몬스터: 마을회관 단계마다 새 종류가 섞이고, 처음 나올 때 알림(newKind) */
 eq(W.kindsAt(0),['wolf'],'0단계: 늑대만');eq(W.kindsAt(1),['wolf','bramble'],'1단계: + 덤불 늑대');eq(W.kindsAt(2),['wolf','bramble','boar','granite'],'2단계: + 멧돼지·바위 늑대');eq(W.kindsAt(3).length,6,'3단계: + 서리 늑대·불씨 왕');
 for(const h of [0,1,2,3]){s=S0({hall:h,level:3});w=W.sync(W.create({seed:20+h,interval:150}),s);const news=[];let boss=0;
  for(let i=0;i<2400;i++)for(const e of W.step(w,s)){if(e.type==='newKind')news.push(e.kind);if(e.type==='boss')boss++}
  for(const k of Object.keys(W.KINDS))if(k!=='ember')eq(news.includes(k),W.KINDS[k].unlock<=h,h+'단계 '+k+' 등장 여부');
  eq(new Set(news).size,news.length,h+'단계: 새 몬스터 알림은 종류마다 한 번');ok(h===3?boss>=3&&news.includes('ember'):boss===0,h+'단계 우두머리 '+boss+'번(3단계만, 네 번째 무리마다)')}
 {const big=S0({hall:2,level:3}),w2=W.sync(W.create({seed:30,interval:150}),big);w2.trickle=1e9;w2.wave.arrive=W.TRAVEL+1;W.step(w2,big);W.step(w2,big);
  const g=w2.wolves.find(v=>v.kind==='granite'),b=w2.wolves.find(v=>v.kind==='bramble'),f=w2.wolves.find(v=>v.kind==='wolf');
  if(g&&f)ok(g.max>f.max*3&&g.speed<f.speed,'바위 늑대는 단단하고 느림');if(b&&f)ok(b.max<f.max&&b.speed>f.speed*1.1,'덤불 늑대는 약하고 빠름');ok(!!(g||b),'2단계 무리에 새 몬스터가 섞임')}
 /* 멧돼지는 닭을 쫓지 않고 건물로 돌진한다 */
 s=S0({chickens:2});w=W.sync(W.create({seed:31,interval:3000}),s);w.trickle=1e9;for(const b of w.buildings)if(b.kind==='tower')b.broken=true;
 w.wolves.push({id:908,kind:'boar',x:0,z:0,sx:20,sz:0,hp:99,max:99,speed:1,state:'hunt',target:0,timer:0,inside:0,hen:0});
 for(let i=0;i<80;i++)W.step(w,s);ok(w.wolves[0].state==='smash'&&w.hens.every(h=>h.state!=='caught'&&h.state!=='carried'),'멧돼지는 건물로 돌진');
 /* 펑 화살: 맞은 자리 둘레의 늑대도 맞는다 */
 s=S0({power:1});w=W.sync(W.create({seed:32,interval:3000}),s);w.trickle=1e9;const tw=w.buildings.find(b=>b.kind==='tower');
 for(let k=0;k<4;k++)w.wolves.push({id:910+k,kind:'wolf',x:tw.x+4+k*.3,z:tw.z+(k%2)*.3,sx:20,sz:0,hp:50,max:50,speed:0,state:'walk',target:0,timer:0,inside:0,hen:0});
 let sp=null;for(let i=0;i<20&&!sp;i++)sp=W.step(w,s).find(e=>e.type==='splash');ok(sp&&sp.n>=2&&sp.r===W.POWER[1].splash,'펑 화살이 터져 둘레 늑대 '+(sp&&sp.n)+'마리도 맞음');ok(w.wolves.filter(v=>v.hp<50).length>=3,'여러 마리가 함께 다침');
 s=S0({power:3});w=W.sync(W.create({seed:33,interval:3000}),s);w.trickle=1e9;for(let k=0;k<4;k++)w.wolves.push({id:920+k,kind:'wolf',x:tw.x+2,z:tw.z+k*1.5-2,sx:20,sz:0,hp:99,max:99,speed:0,state:'walk',target:0,timer:0,inside:0,hen:0});
 W.step(w,s);eq(new Set(w.arrows.map(a=>a.wolf)).size,3,'세 갈래 화살: 한 번에 세 마리');
 /* 불씨 왕의 포효: 가까운 타워가 2.5초 멈춘다 */
 s=S0({level:1});w=W.sync(W.create({seed:34,interval:3000}),s);w.trickle=1e9;const tw2=w.buildings.filter(b=>b.kind==='tower');
 w.wolves.push({id:930,kind:'ember',x:tw2[0].x+2,z:tw2[0].z,sx:20,sz:0,hp:999,max:999,speed:0,state:'walk',target:0,timer:0,inside:0,hen:0,roar:1});
 const roarE=W.step(w,s).find(e=>e.type==='roar');ok(roarE&&roarE.towers.length>=1,'포효');const stunned=w.buildings.filter(b=>b.stun>0).map(b=>b.id);ok(stunned.length>=1,'타워가 멈춤');
 const before=w.arrows.length;let fired=0;for(let i=0;i<W.ROAR.stun-2;i++)for(const e of W.step(w,s))if(e.type==='shoot'&&stunned.includes(e.tower))fired++;eq(fired,0,'멈춘 타워는 그동안 못 쏨');
 /* 울타리는 늑대가 떠나면 15초 뒤 저절로 다시 서고, 고치기 카드는 건물만 센다 */
 s=S0({fence:1});w=W.sync(W.create({seed:35,interval:3000}),s);w.trickle=1e9;const fz=w.buildings.find(b=>b.kind==='fence');fz.hp=0;fz.broken=true;eq(W.brokenCount(w),0,'부서진 울타리는 고치기 대상이 아님');
 let reb=-1;for(let i=1;i<=W.REBUILD+5&&reb<0;i++)if(W.step(w,s).some(e=>e.type==='rebuilt'))reb=i;eq(reb,W.REBUILD,'울타리가 '+W.REBUILD/10+'초 뒤 다시 섬');ok(!fz.broken&&fz.hp>=fz.max/2,'반쯤 튼튼하게');
 /* 공격받지 않는 건물은 조금씩 회복 */
 const mk=w.buildings.find(b=>b.kind==='market');mk.hp=50;for(let i=0;i<100;i++)W.step(w,s);ok(Math.abs(mk.hp-55)<.01,'건물은 10초에 5씩 회복');
 /* 완충: 닭을 잃으면 다음 무리가 작아지고, 30초마다 풀린다 */
 s=S0({level:3,fence:4,chickens:6});w=W.sync(W.create({seed:36,interval:200}),s);w.trickle=1e9;const p0=W.packSize(w,s);w.mercy=3;ok(W.packSize(w,s)<p0,'닭을 잃으면 무리가 작아짐 '+p0+'→'+W.packSize(w,s));for(let i=0;i<W.MERCY.decay*3;i++)W.step(w,s);ok(w.mercy<=0+w.stats.henLost+w.stats.broken,'완충은 서서히 풀림');
 /* 닭을 사도 무리가 크게 늘지 않는다(방어 시설이 무리를 키움) */
 ok(W.packSize(W.create({}),S0({chickens:8}))<W.packSize(W.create({}),S0({level:5})),'닭 7마리보다 타워 5개가 늑대를 더 부름');
 /* 저장 복원 */
 const back=W.restore(JSON.parse(JSON.stringify(run(9,800,S0({level:1,chickens:3})))));eq(back.t,800,'세계 저장·복원');eq(W.restore({v:3}).t,0,'모르는 형식은 새 세계');eq(W.restore(null,{interval:400}).interval,400,'없으면 새 세계');
 const v1={v:1,t:500,rng:7,hall:0,interval:300,wave:{n:1,arrive:700,spawned:false},wolves:[{id:3,x:9,z:0,sx:17,sz:0,hp:20,max:20,speed:.8,state:'walk',target:0,timer:0,inside:0,hen:0}],hens:[],buildings:[{id:1,kind:'tower',slot:0,x:1.2,z:1.4,hp:90,max:90,broken:false,cd:0}],arrows:[],nextId:9,stats:{kills:2,henLost:0,henSaved:0,broken:1,waves:1},events:[]};
 const m1=W.restore(v1,{interval:130});eq([m1.v,m1.wolves[0].kind,m1.interval,m1.wave.arrive,m1.stats.kills,m1.buildings[0].stun],[2,'wolf',130,630,2,0],'0.7 세계 저장 이행: 늑대 종류·새 무리 간격(다음 무리를 당김)');
}
/* 1-8 유인 구조(세계 포함): 같은 벽시계 10분 동안 제 나이 보통 속도로 읽는 아이가 찍는 아이보다 마을을 더 크게 키운다.
   읽기 속도·정확도·화면 시간은 가정값이다(scripts/sim-village.cjs와 같은 모형: 섞인 상식·수학·영어, 카드 여러 장, 연속 정답 포함). */
{let seed=7;const rnd=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648};
 const RATE={7:120/2,8:120,9:180,10:230};
 const need=(q,r)=>{const rps=r/60,n=q.choices.length,cc=q.choices.reduce((s,c)=>s+C.units(c),0),p=C.syl(q.passage);
  if(q.mode==='quiz')return 1+(C.syl(q.prompt)+C.units(q.passage))/rps+cc/rps+.4*n+((C.THINK[q.cat]||C.THINK.common)[q.age]||2);
  return q.mode==='sound'?1+cc/rps+.4*n:1.5+p/rps+(q.age===7?0:C.syl(q.prompt)/rps)+cc/rps+.4*n+(q.age>=9?.3*p/rps:0)};
 const interval=(age,mode)=>{const t=Array.from({length:Q.count(age,mode)},(_,i)=>C.baseSeconds(Q.get(age,mode,i))).sort((a,b)=>a-b);return W.intervalFor(t[t.length>>1])};
 const PRI=['repair','tower','power','chicken','fence','hall','farmer','pond','feast'];
 function play(age,mode,kind,minutes){
  const s=C.fresh(age);s.mode=mode;const w=W.sync(W.create({seed:Math.floor(rnd()*1e9),interval:interval(age,mode)}),s);let clock=0;
  const go=sec=>{for(let i=0;i<Math.round(sec/W.TICK);i++)for(const e of W.step(w,s))if(e.type==='henLost')s.chickens=Math.max(0,s.chickens-1);clock+=sec};
  while(clock<minutes*60){
   const q=Q.at(age,mode,s.index),n=q.choices.length,lock=C.reveal(q)/10;if(mode==='sound')go(1+C.syl(q.speak)/4.5);
   const t=kind==='guess'?lock+.4:Math.max(lock+.3,need(q,RATE[age])*(.75+rnd()*.5)),ok1=kind==='guess'?rnd()<1/n:rnd()<.85;go(t);
   if(ok1){const fast=C.isFast(q,Math.round(t/W.TICK));C.settle(s,q,'first',{fast});W.volley(w,s,{scale:C.scale(q),fast});clock+=kind==='guess'?1.5:4;
    for(let p=0;p<C.picks(q);p++){s.broken=W.brokenCount(w);const o=C.offers(s).filter(k=>k&&C.canBuy(s,k)).sort((a,b)=>PRI.indexOf(a)-PRI.indexOf(b));if(!o.length)break;C.buy(s,o[0]);if(o[0]==='repair')W.repairAll(w);W.sync(w,s);clock+=1.2}}
   else{go(W.dashTicks(w)*W.TICK);go(kind==='guess'?.4:need(q,RATE[age])*.35);C.settle(s,q,(kind==='guess'?rnd()<1/(n-1):rnd()<.8)?'second':'miss');go(C.syl(C.lesson(q))/4.5+1.2+(kind==='guess'?.4:1))}
   s.index++}
  return C.built(s)}
 const avg=(a,m,k)=>{let t=0;for(let i=0;i<6;i++)t+=play(a,m,k,10);return t/6};
 for(const [a,m] of [[7,'sound'],[8,'sound'],[9,'story'],[10,'story']]){const typ=avg(a,m,'typ'),g=avg(a,m,'guess');ok(typ>g*1.4,`${a}세 ${m}: 보통 아이 지은 것 ${typ.toFixed(1)} > 찍기 ${g.toFixed(1)}×1.4 (10분)`)}
}

/* 1-9 세계 무작위 시험(fuzz)·회귀 검사(world.js). 회관 0~3·타워 0~5·강화 0~3·울타리 0~6(일부 부서짐)·닭 0~8에서 온갖 종류·상태의 늑대를 끼워 넣고,
   틱 사이에 일제 사격·고치기·카드(sync)를 무작위로 섞어 수천 틱 돌리며 불변식을 본다. 같은 시드 = 같은 결과, 저장·복원 뒤 이어 돌려도 같은 결과. */
{const S0=o=>Object.assign(C.fresh(8),o||{}),alive=v=>v.state!=='dead'&&v.state!=='gone';
 const mk=seed=>{let r=seed>>>0||1;return ()=>{r=(Math.imul(r,1103515245)+12345)>>>0;return r/4294967296}};
 const KINDS=Object.keys(W.KINDS),STATES=['walk','smash','hunt','bite','carry','leave','dead'],CAP={level:5,fence:6,chickens:8,hall:3,power:3,farmers:2,pond:3};
 const HEN_OK=new Set(['yard','flee','hidden','home','caught','carried']),WOLF_OK=new Set(STATES);
 const badNum=(o,p)=>{if(typeof o==='number')return Number.isFinite(o)?null:p;if(o&&typeof o==='object')for(const k in o){const b=badNum(o[k],p+'.'+k);if(b)return b}return null};
 const onSide=(w,v,side)=>Math.abs(Math.hypot(v.x,v.z)-W.radius(w))<W.SIDE_REACH&&W.sectorOf(v.x,v.z)===side;
 /* 판 하나: 무작위 경제 상태와 세계. 입력 난수(rs)는 세계와 따로 둔다(저장·복원 비교 때 같은 입력을 주려고) */
 const game=seed=>{const rnd=mk(seed),ri=n=>Math.floor(rnd()*n);
  const s=S0({hall:ri(4),level:ri(6),power:ri(4),fence:ri(7),chickens:ri(9),farmers:ri(3),pond:ri(4)}),w=W.sync(W.create({seed:1+ri(1e9),interval:130+ri(71)}),s);
  for(const b of w.buildings)if(rnd()<.2){b.broken=true;b.hp=0;b.rebuild=W.REBUILD}
  return {w,s,rs:seed}};
 /* 한 틱 입력: 일제 사격·고치기·카드 사기(sync)·닭 줄이기·건물 부수기·늑대 끼워 넣기. odd면 주인 없는 잡힌 닭 같은 어긋난 상태도 만든다 */
 function input(g,odd){const rnd=mk(g.rs);g.rs=(g.rs*7+13)>>>0;const ri=n=>Math.floor(rnd()*n),pick=a=>a[ri(a.length)],{w,s}=g,R=W.radius(w);
  if(rnd()<.012)W.volley(w,s,{scale:1+rnd()*4,fast:rnd()<.5});
  if(rnd()<.003)W.repairAll(w);
  if(rnd()<.004){const k=pick(Object.keys(CAP));if((s[k]|0)<CAP[k])s[k]=(s[k]|0)+1;W.sync(w,s)}
  if(rnd()<.002)W.sync(w,s);
  if(odd&&rnd()<.0015){s.chickens=Math.max(w.hens.filter(h=>h.state==='caught'||h.state==='carried').length,s.chickens-1-ri(3));W.sync(w,s)}
  if(rnd()<.002&&w.buildings.length){const b=pick(w.buildings);b.broken=true;b.hp=0;b.rebuild=W.REBUILD}
  if(rnd()<.01&&w.wolves.length<W.MAX_WOLVES){
   const k=pick(KINDS),st=pick(STATES),a=rnd()*Math.PI*2,d=rnd()*(R+W.EDGE+3),c=Math.cos(a),n=Math.sin(a);
   const v={id:w.nextId++,kind:k,x:c*d,z:n*d,sx:c*(R+W.EDGE),sz:n*(R+W.EDGE),hp:1+ri(80),max:80,speed:.3+rnd()*1.4,state:st,target:0,timer:ri(15),inside:ri(300),hen:0};
   if(k==='ember')v.roar=ri(80);
   if(st==='smash')v.target=rnd()<.8&&w.buildings.length?pick(w.buildings).id:pick([0,99999]);
   if(st==='bite'||st==='carry'){const free=w.hens.filter(h=>h.state==='yard'||h.state==='home'||h.state==='flee'||h.state==='hidden'),h=free.length?pick(free):null;
    if(h&&(!odd||rnd()<.75)){v.hen=h.id;h.state=st==='bite'?'caught':'carried'}else if(!odd)v.state='hunt';else v.hen=rnd()<.5?0:(h?h.id:99999)}
   w.wolves.push(v)}
  if(odd&&rnd()<.002&&w.hens.length)pick(w.hens).state=pick(['caught','carried']); /* 주인 없는 잡힌 닭 */
 }
 const tick=g=>{const ev=W.step(g.w,g.s);for(const e of ev)if(e.type==='henLost')g.s.chickens=Math.max(0,g.s.chickens-1);return ev};
 const snap=g=>JSON.stringify(g.w)+JSON.stringify(g.s);
 /* 불변식 검사 판: 어긋난 것은 종류별 첫 예만 모은다 */
 const bad={},seen={},LIFE=3000,STUCK=20;let maxLife=0;const flag=(k,m)=>{if(!bad[k])bad[k]=m};
 function checked(seed,ticks,odd){
  const g=game(seed),w=g.w,sig=new Map(),born=new Map(),deadAt=new Map(),killed=new Set();let lastUp=-1;
  for(let i=0;i<ticks;i++){
   input(g,odd);const s=g.s;
   const pre={mercy:w.mercy,n:w.wave.n,stun:new Map(w.buildings.filter(b=>b.kind==='tower').map(b=>[b.id,b.stun])),dead:new Set(w.wolves.filter(v=>!alive(v)).map(v=>v.id)),arrows:new Map(w.arrows.map(a=>[a.id,a.t]))};
   let ev;try{ev=tick(g)}catch(e){flag('throw',e.stack);return}
   const t=w.t,R=W.radius(w);for(const e of ev)seen[e.type]=(seen[e.type]||0)+1;
   const nb=badNum(w,'w');if(nb)flag('NaN/Infinity',nb+' t='+t);
   if(w.wolves.length>W.MAX_WOLVES)flag('늑대 수 상한',w.wolves.length);
   for(const v of w.wolves)if(!WOLF_OK.has(v.state)||!W.KINDS[v.kind])flag('늑대 상태·종류',v.state+' '+v.kind);
   /* 닭: 잡힌 닭은 언제나 무는/물고 가는 늑대가 있고, 무는 늑대의 닭은 잡혀 있다. 세계 닭 수 = 경제 닭 수 */
   for(const h of w.hens){if(!HEN_OK.has(h.state))flag('닭 상태',h.state);
    if(h.state==='caught'&&!w.wolves.some(v=>v.state==='bite'&&v.hen===h.id))flag('주인 없는 caught 닭','hen '+h.id+' t='+t);
    if(h.state==='carried'&&!w.wolves.some(v=>v.state==='carry'&&v.hen===h.id))flag('주인 없는 carried 닭','hen '+h.id+' t='+t)}
   for(const v of w.wolves)if(v.state==='bite'){const h=w.hens.find(h=>h.id===v.hen);if(!h||h.state!=='caught')flag('닭 없이 무는 늑대','wolf '+v.id)}
   if(w.hens.length!==s.chickens)flag('닭 수',w.hens.length+' vs '+s.chickens);
   /* 멈춘 늑대: 살아 있는데 상태·위치·지루함·타이머·부수는 건물 체력이 STUCK틱 넘게 그대로. 쓰러진 늑대는 16틱 안에 치운다. 어떤 늑대도 LIFE틱 넘게 살지 않는다 */
   for(const v of w.wolves){if(!alive(v)){if(!deadAt.has(v.id))deadAt.set(v.id,t);else if(t-deadAt.get(v.id)>16)flag('안 치운 늑대',v.id);continue}
    if(!born.has(v.id))born.set(v.id,t);const life=t-born.get(v.id);maxLife=Math.max(maxLife,life);if(life>LIFE)flag('너무 오래 사는 늑대',v.kind+' '+v.state);
    const tb=v.state==='smash'?w.buildings.find(b=>b.id===v.target):null,k=[v.state,v.x,v.z,v.inside,v.timer,tb?tb.hp:'-'].join('|'),o=sig.get(v.id);
    if(o&&o.k===k){if(++o.n>STUCK)flag('멈춘 늑대',v.kind+' '+k)}else sig.set(v.id,{k,n:0});
    if(v.state==='smash'&&tb&&tb.kind==='fence'&&Math.hypot(v.x,v.z)<R-W.INNER)flag('마을 안에서 울타리 부수기',v.id)}
   /* 화살: 틱마다 1씩 줄고 0이 되는 틱에 사라진다(언제나 total틱 안에 끝남) */
   for(const [id,pt] of pre.arrows){const a=w.arrows.find(a=>a.id===id);if(a?a.t!==pt-1:pt>1)flag('화살 시간',id+' '+pt)}
   for(const a of w.arrows){if(!pre.arrows.has(a.id)&&a.t!==a.total-1)flag('새 화살',a.t+'/'+a.total);if(a.t<1||a.t>a.total||a.total>40)flag('화살 범위',a.t+'/'+a.total)}
   /* 포효 멈춤: 0~25, 포효가 없으면 부서져 있어도 1씩 줄어 0까지. 멈춘 타워는 쏘지 않는다 */
   const roared=new Set();for(const e of ev)if(e.type==='roar')for(const id of e.towers)roared.add(id);
   for(const b of w.buildings)if(b.kind==='tower'){if(!(b.stun>=0&&b.stun<=W.ROAR.stun))flag('멈춤 범위',b.stun);
    if(pre.stun.has(b.id)&&!roared.has(b.id)&&b.stun!==Math.max(0,pre.stun.get(b.id)-1))flag('멈춤 줄기',pre.stun.get(b.id)+'->'+b.stun+' broken='+b.broken)}
   for(const e of ev)if(e.type==='shoot'&&pre.stun.get(e.tower)>0)flag('멈춘 타워 사격',e.tower);
   /* 울타리는 그 면 울타리 줄 가까이에 산 늑대가 있으면 다시 서지 않는다 */
   for(const e of ev)if(e.type==='rebuilt'){const f=w.buildings.find(b=>b.id===e.building);if(w.wolves.some(v=>alive(v)&&onSide(w,v,f.side)))flag('늑대 곁에서 다시 선 울타리',f.id)}
   /* 완충: 0~5 정수, 마지막으로 늘어난 뒤 30초 전에는 풀리지 않음 */
   if(!(Number.isInteger(w.mercy)&&w.mercy>=0&&w.mercy<=W.MERCY_CAP))flag('완충 범위',w.mercy);
   if(w.mercy>pre.mercy)lastUp=t;else if(w.mercy<pre.mercy&&lastUp>=0&&t-lastUp<W.MERCY.decay)flag('완충이 너무 빨리 풀림',t-lastUp);
   /* 우두머리: 회관 3단계의 네 번째 무리마다(무리 첫 마리), 그 밖에는 없음 */
   const want=s.hall>=3&&pre.n%W.BOSS_EVERY===W.BOSS_EVERY-1;
   for(const p of ev)if(p.type==='pack'&&p.boss!==want)flag('우두머리 규칙','hall '+s.hall+' n '+pre.n);
   if(ev.some(e=>e.type==='boss')&&!(want&&ev.some(e=>e.type==='pack')))flag('무리 밖 우두머리','t='+t);
   /* 처치는 늑대마다 한 번, 이미 쓰러진 늑대는 다시 못 쓰러뜨림 */
   for(const e of ev)if(e.type==='kill'){if(killed.has(e.wolf)||pre.dead.has(e.wolf))flag('두 번 처치',e.wolf);killed.add(e.wolf)}
  }}
 for(let k=0;k<16;k++)checked(1000+k*7919,3000,k%2===1);
 eq(bad,{},'1-9 무작위 16판 × 3000틱 불변식');
 for(const e of ['pack','straggler','boss','roar','splash','kill','bite','carry','henLost','henSaved','broken','rebuilt'])ok(seen[e]>0,'무작위 판에서 '+e+' 사건이 일어남('+(seen[e]|0)+')');
 ok(maxLife>200&&maxLife<LIFE,'가장 오래 산 늑대 '+maxLife+'틱');
 /* 결정성: 같은 시드·같은 입력 = 같은 JSON(500틱마다) */
 const replay=seed=>{const g=game(seed),out=[];for(let i=0;i<3000;i++){input(g,true);tick(g);if(i%500===499)out.push(snap(g))}return out};
 for(const seed of [501,502,503])eq(replay(seed),replay(seed),'같은 시드 '+seed+' = 같은 세계');
 /* 저장·복원 동등성: 도중에 JSON으로 저장·복원한 세계를 같은 입력으로 이어 돌리면 원래 세계와 바이트까지 같다 */
 for(let k=0;k<4;k++){const a=game(600+k);for(let i=0;i<900+k*377;i++){input(a,k%2===1);tick(a)}
  const b={w:W.restore(JSON.parse(JSON.stringify(a.w))),s:JSON.parse(JSON.stringify(a.s)),rs:a.rs};let same=true;
  for(let i=0;i<2000&&same;i++){input(a,k%2===1);tick(a);input(b,k%2===1);tick(b);if(i%50===0||i===1999)same=snap(a)===snap(b)}ok(same,'저장·복원 뒤 이어 돌려도 같은 세계 '+k)}
 /* 멀쩡한 저장은 restore가 한 글자도 바꾸지 않는다 */
 {const g=game(77);for(let i=0;i<1500;i++){input(g,true);tick(g)}const raw=JSON.parse(JSON.stringify(g.w));raw.events=[];eq(JSON.stringify(W.restore(raw)),JSON.stringify(raw),'멀쩡한 저장은 그대로 복원')}
 /* 망가진 저장: 값을 지우거나 이상한 형(null·NaN·문자·배열…)으로 바꿔도 restore·sync·step이 던지지 않고, 숫자는 유한, id는 겹치지 않음 */
 {const JUNK=[null,undefined,NaN,Infinity,-Infinity,-1,1e300,'7',true,{},[],[null],0,-0,2.5,'wolf',{x:1}];let cases=0;
  for(let k=0;k<120;k++){const rnd=mk(9000+k),ri=n=>Math.floor(rnd()*n),pick=a=>a[ri(a.length)];
   const g=game(70+k%9);for(let i=0;i<200+ri(600);i++){input(g,true);tick(g)}
   const raw=JSON.parse(JSON.stringify(g.w)),paths=[];const walk=o=>{if(o&&typeof o==='object')for(const key of Object.keys(o)){paths.push([o,key]);walk(o[key])}};walk(raw);
   for(let m=0;m<1+ri(8);m++){const [o,key]=pick(paths);if(rnd()<.2)delete o[key];else o[key]=pick(JUNK)}
   try{const w=W.restore(raw,rnd()<.5?{interval:130+ri(70)}:undefined),s=JSON.parse(JSON.stringify(g.s));W.sync(w,s);
    for(let i=0;i<300;i++){if(i%50===0)W.volley(w,s,{scale:2});for(const e of W.step(w,s))if(e.type==='henLost')s.chickens=Math.max(0,s.chickens-1)}
    const nb=badNum(w,'w'),all=[...w.wolves,...w.hens,...w.buildings,...w.arrows];
    if(nb)flag('망가진 저장 NaN',nb);if(new Set(all.map(o=>o.id)).size!==all.length)flag('망가진 저장 id 겹침',k);
    if(w.hens.some(h=>h.state==='caught'&&!w.wolves.some(v=>v.state==='bite'&&v.hen===h.id)))flag('망가진 저장 주인 없는 닭',k);cases++}
   catch(e){flag('망가진 저장 예외',e.stack)}}
  for(const junk of [0,'x',[],{v:2},{v:2,wolves:[],hens:[],buildings:[],wave:5,t:1,rng:1,interval:150},{v:2,wolves:[],hens:[],buildings:[],wave:{},t:1,rng:1,interval:0},{v:1,wolves:[null],hens:[1],buildings:['a'],wave:[],t:3,rng:3,interval:200}])
   try{const s=S0(),w=W.restore(junk);W.sync(w,s);for(let i=0;i<300;i++)W.step(w,s);if(badNum(w,'w')||w.stats.waves>3)flag('엉터리 저장',JSON.stringify(junk));cases++}catch(e){flag('엉터리 저장 예외',JSON.stringify(junk)+' '+e.message)}
  eq(bad,{},'망가진 저장 '+cases+'가지: 예외·NaN·id 겹침·무리 폭주 없음')}

 /* ---- 회귀 검사(0.8 하드닝에서 고친 것) ---- */
 const quiet=(s,seed)=>{const w=W.sync(W.create({seed,interval:3000}),s);w.trickle=1e9;w.wave.arrive=1e9;return w};
 const wolf=(w,o)=>{const v=Object.assign({id:w.nextId++,kind:'wolf',x:0,z:0,sx:20,sz:0,hp:50,max:50,speed:1,state:'walk',target:0,timer:0,inside:0,hen:0},o);w.wolves.push(v);return v};
 /* 완충은 5단계까지만 쌓이고, 마지막으로 잃은 뒤 꼭 300틱(30초) 뒤에 한 단계 풀린다(전: 무한히 쌓이고 t%300이면 잃자마자 풀림) */
 {const s=S0({chickens:8}),w=quiet(s,41);for(const b of w.buildings)if(b.kind==='tower')b.broken=true;
  for(const h of w.hens){h.state='carried';wolf(w,{x:h.x,z:h.z,sx:h.x+.1,sz:h.z,state:'carry',hen:h.id})}
  w.t=298;const ev=W.step(w,s);eq([ev.filter(e=>e.type==='henLost').length,w.t%W.MERCY.decay,w.mercy],[8,299,W.MERCY_CAP],'닭 8마리를 잃어도 완충은 5단계까지');
  W.step(w,s);eq(w.mercy,5,'t%300 경계에서도 바로 풀리지 않음');for(let i=0;i<298;i++)W.step(w,s);eq(w.mercy,5,'299틱 뒤에도 그대로');W.step(w,s);eq(w.mercy,4,'300틱 뒤 한 단계 풀림')}
 /* 포효로 멈춘 타워가 부서져도 멈춤은 줄어든다: 고친 뒤 바로 쏜다(전: 부서진 동안 멈춤이 얼어 고친 뒤에도 멈춰 있음) */
 {const s=S0(),w=quiet(s,42),t=w.buildings.find(b=>b.kind==='tower');t.stun=20;t.broken=true;t.hp=0;
  for(let i=0;i<20;i++)W.step(w,s);eq(t.stun,0,'부서진 타워의 멈춤도 0까지');W.repairAll(w);wolf(w,{x:t.x+2,z:t.z,speed:0,hp:999,max:999});
  ok(W.step(w,s).some(e=>e.type==='shoot'&&e.tower===t.id),'고친 타워는 바로 쏨')}
 /* 주인 없는 잡힌 닭은 놓여나고, 물고 가는 늑대는 제 닭이 아닌 닭을 끌고 가거나 없애지 않는다 */
 {const s=S0({chickens:3}),w=quiet(s,43);for(const b of w.buildings)if(b.kind==='tower')b.broken=true;const [h1,h2,h3]=w.hens;h1.state='caught';h2.state='carried';
  const c=wolf(w,{x:15,z:0,sx:15.2,sz:0,state:'carry',hen:h3.id}),x3=h3.x;let lost=0;for(let i=0;i<5;i++)lost+=W.step(w,s).filter(e=>e.type==='henLost').length;
  eq([h1.state,h2.state,h3.state,h3.x,lost,w.hens.length,c.state==='gone'||!w.wolves.includes(c)],['flee','flee','yard',x3,0,3,true],'주인 없는 닭은 풀려나 도망치고, 남의 닭은 끌려가지 않음');
  const b=wolf(w,{x:h1.x+5,z:h1.z,state:'bite',hen:h1.id,timer:9});W.step(w,s);eq(b.state==='hunt'||b.state==='bite'&&h1.state==='caught',true,'닭 없이 무는 늑대는 다시 사냥')}
 /* 무는 중에 쓰러지면 닭이 풀려난다 */
 {const s=S0({chickens:1}),w=quiet(s,44),h=w.hens[0],t=w.buildings.find(b=>b.kind==='tower');h.x=t.x+1;h.z=t.z;h.state='caught';const v=wolf(w,{x:t.x+1.2,z:t.z,state:'bite',hen:h.id,timer:99,hp:1});
  let saved=false;for(let i=0;i<20&&!saved;i++)saved=W.step(w,s).some(e=>e.type==='henSaved'&&e.hen===h.id);ok(saved&&v.state==='dead'&&h.state!=='caught','무는 늑대를 쓰러뜨리면 닭이 풀려남')}
 /* 경제 닭 수가 줄면(망가진 저장 등) sync가 잡히지 않은 닭부터 뺀다. 물려 가는 닭은 남긴다 */
 {const s=S0({chickens:5}),w=quiet(s,45);w.hens[0].state='carried';wolf(w,{x:9,z:0,sx:20,sz:0,state:'carry',hen:w.hens[0].id});s.chickens=0;W.sync(w,s);
  eq(w.hens.map(h=>h.state),['carried'],'닭 0마리로 맞추면 물려 가는 닭만 남음');s.chickens=2;W.sync(w,s);eq(w.hens.length,2,'다시 늘면 채움')}
 /* 마을이 커져 울타리 안쪽에 들어온 늑대는 울타리를 부수지 않고 사냥한다(전: 안쪽에서 바깥 울타리를 13초씩 부숨) */
 {const s=S0({fence:6}),w=quiet(s,46);for(const b of w.buildings)if(b.kind==='tower')b.broken=true;
  const f0=w.buildings.find(b=>b.kind==='fence'&&b.side===0),a=wolf(w,{x:7.25,z:.5,state:'smash',target:f0.id}),b=wolf(w,{x:8*Math.cos(.3),z:8*Math.sin(.3)});
  s.hall=1;W.sync(w,s);W.step(w,s);eq([a.state,b.state],['hunt','hunt'],'울타리가 바깥으로 물러나면 안쪽 늑대는 사냥');ok(f0.hp===f0.max,'안쪽에서는 울타리를 깎지 않음');
  const c=wolf(w,{x:10.2*Math.cos(.5),z:10.2*Math.sin(.5)});W.step(w,s);eq(c.state,'smash','울타리 줄에 선 늑대는 여전히 부숨')}
 /* 울타리 한 면 어디든(모서리 쪽도) 늑대가 서 있으면 다시 세우지 않는다(전: 면 가운데 2.2만 봐서 38%가 늑대 곁에서 다시 섬) */
 {const s=S0({fence:6,hall:3,chickens:0}),w=quiet(s,47);for(const b of w.buildings)if(b.kind==='tower')b.broken=true;
  const f0=w.buildings.find(b=>b.kind==='fence'&&b.side===0);f0.broken=true;f0.hp=0;f0.rebuild=W.REBUILD;const v=wolf(w,{x:16*Math.cos(.09),z:16*Math.sin(.09),speed:0});
  ok(Math.hypot(v.x-f0.x,v.z-f0.z)>2.2,'늑대는 면 가운데에서 먼 모서리 쪽');let reb=false;for(let i=0;i<W.REBUILD+20;i++)reb=reb||W.step(w,s).some(e=>e.type==='rebuilt');ok(!reb&&f0.broken,'모서리에 늑대가 있으면 다시 세우지 않음');
  w.wolves=[];for(let i=0;i<W.REBUILD+1&&!reb;i++)reb=W.step(w,s).some(e=>e.type==='rebuilt');ok(reb,'늑대가 떠나면 다시 세움')}
 /* 같은 틱에 먼저 쓰러진 과녁: 펑 화살은 쓰러진 자리에서 터진다(전: 한 틱 전 자리) */
 {const s=S0({power:1}),w=quiet(s,48),t=w.buildings.find(b=>b.kind==='tower'),v=wolf(w,{x:12,z:0,hp:5}),o=wolf(w,{x:12,z:-1,speed:0,hp:99,max:99});
  const A=(dmg,splash)=>({id:w.nextId++,tower:t.id,wolf:v.id,fx:t.x,fz:t.z,tx:-5,tz:-5,t:1,total:5,damage:dmg,splash,share:.6});w.arrows.push(A(50,0),A(10,1.3));
  const ev=W.step(w,s),sp=ev.find(e=>e.type==='splash');ok(v.state==='dead'&&sp&&sp.x===v.x&&sp.z===v.z,'먼저 쓰러진 과녁 자리에서 펑');ok(o.hp<99,'그 둘레 늑대가 맞음')}
 /* 망가진 저장의 세부: null·NaN 항목 버림, 겹친 울타리·타워 자리 정리, 무리 간격 0·도착 시각 엉터리여도 무리가 쏟아지지 않음, 우두머리 포효 시계 */
 {const raw={v:2,t:50,rng:9,hall:7,interval:0,wave:{n:-1,arrive:'soon',spawned:1},trickle:1e12,mercy:99,nextId:1,seen:null,stats:null,arrows:[{id:2}],
   wolves:[null,{id:'x'},{id:3,kind:'ember',x:NaN,z:0,hp:5},{id:4,kind:'ember',x:12,z:0,sx:20,sz:0,hp:30,max:30,speed:0,state:'zzz'}],
   hens:[1,{id:5,x:0,z:0,state:'caught',slot:99}],buildings:[{id:6,kind:'fence',side:0,x:0,z:0,hp:9,max:70,broken:false},{id:7,kind:'fence',side:0,x:0,z:0,hp:9,max:70},{id:8,kind:'tower',slot:9,x:0,z:0,hp:1,max:90},{id:9,kind:'tower',slot:0,x:1.2,z:1.4,hp:NaN,max:90,broken:false,cd:-3,stun:1e9}]};
  const w=W.restore(raw),s=S0({level:1,fence:1,chickens:1});
  eq([w.hall,w.interval,w.wave.n,w.wave.arrive>w.t,w.mercy,w.wolves.map(v=>v.id),w.wolves[0].state,w.wolves[0].speed>0,w.hens.length,w.buildings.map(b=>b.id),w.buildings[1].stun,w.nextId>9],[3,80,0,true,5,[4],'walk',true,1,[6,9],0,true],'망가진 저장 정리');
  W.sync(w,s);eq(w.buildings.filter(b=>b.kind==='tower').map(b=>b.slot).sort(),[0,1],'타워 자리 겹치지 않음');eq(w.hens.length,1,'닭 수 맞춤');
  for(let i=0;i<300;i++)W.step(w,s);ok(w.stats.waves<=4&&!badNum(w,'w'),'무리 폭주·NaN 없음 (무리 '+w.stats.waves+')');
  const e=quiet(S0(),49);const k=wolf(e,{kind:'ember',x:3,z:0,speed:0,hp:999,max:999});W.step(e,S0());ok(Number.isFinite(k.roar),'포효 시계 없는 불씨 왕도 시계가 생김')}

 /* 성능: 회관 3·강화 3·타워 6·늑대 90마리·화살 수십 발에서 step 평균(데스크톱 Node 기준. 휴대폰은 5~10배 느리고, 틀린 직후엔 0.1초에 최대 5틱) */
 {const s=S0({hall:3,level:5,power:3,fence:6,chickens:8,farmers:2,pond:3}),w=W.sync(W.create({seed:12345,interval:150}),s),rnd=mk(99);let tot=0n,n=0,arrows=0;
  const fill=()=>{while(w.wolves.length<W.MAX_WOLVES){const a=rnd()*Math.PI*2,d=2+rnd()*20,k=KINDS[Math.floor(rnd()*KINDS.length)];
   w.wolves.push({id:w.nextId++,kind:k,x:Math.cos(a)*d,z:Math.sin(a)*d,sx:Math.cos(a)*24,sz:Math.sin(a)*24,hp:1e6,max:60,speed:.6+rnd(),state:['walk','hunt','smash'][Math.floor(rnd()*3)],target:0,timer:0,inside:0,hen:0,...(k==='ember'?{roar:40}:{})})}};
  for(let i=0;i<3000;i++){fill();if(i%10===0)W.volley(w,s,{scale:5,fast:true});if(i%20===0)W.repairAll(w);const t0=process.hrtime.bigint();W.step(w,s);if(i>=500){tot+=process.hrtime.bigint()-t0;n++;arrows+=w.arrows.length}}
  const us=Number(tot)/n/1000;console.log('  세계 step 평균 '+us.toFixed(1)+'µs (늑대 90·회관 3·강화 3·타워 6·화살 평균 '+Math.round(arrows/n)+'발)');ok(us<1500,'step 평균 1.5ms 미만')}
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
/* 화면에 나온 문제 = 그 나이·모드의 index번째 문제(4문제마다 상식·수학·영어가 섞인 순서, Questions.at) */
const fastAt=q=>Math.ceil(C.FAST_MIN*C.needSeconds(q)/C.TICK);/* 번개를 받을 수 있는 가장 이른 틱 */
function shows(a,age,mode,index,msg){
 const q=Q.at(age,mode,index),list=a.n.answers;
 eq([list.dataset.qid,list.dataset.age,list.dataset.mode],[q.id,String(age),q.mode],msg+' 문항 '+q.id);
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
ok(html.includes('src="combat.js?v=0.8"')&&html.includes('src="world.js?v=0.8"')&&html.includes('src="questions.js?v=0.8"')&&html.includes('src="village.js?v=0.8"'),'캐시 갱신용 ?v=0.8');
a.go();ok(a.n.start.hidden,'시작하면 시작 화면 닫힘');eq(a.api.phase,'ask','소리 모드: 다 들은 뒤 풀이 시작');eq(a.speakLog[0],Q.get(8,'sound',0).speak,'문제 소리를 읽어 줌');
shows(a,8,'sound',0,'시작');
eq(a.api.world.interval,W.intervalFor(9),'무리 간격 = 8세 소리 문제 기준 시간(13초)');eq(a.n.timeFill.style.width,pct(a.api.world),'시간 바 = 다음 무리까지 남은 시간');
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
a=fresh({view:true});a.go();a.tick(fastAt(a.api.round.q));
let g0=a.api.state.gold,exp=C.income(a.api.state,a.api.round.q,true).gold;a.right();
eq(a.api.phase,'pick','한 번에 정답 → 카드 고르기');eq(a.api.state.gold,g0+exp,'번개 정답 금화');ok(a.n.gainLine.textContent.includes('+'+exp),'받은 금화 표시');
ok(a.events.some(e=>e.type==='volley')&&a.events.some(e=>e.type==='produce'&&e.eggs===1),'3D: 일제 사격 + 알 팔기 연출');
const wt=a.api.world.t,wStop=a.n.timeFill.style.width;a.tick(80);eq(a.api.world.t,wt,'고르는 동안 늑대 세계 멈춤');eq(a.n.timeFill.style.width,wStop,'고르는 동안 시간 바도 멈춤');
eq(a.cards().length,3,'카드 3장');eq(a.cards().map(b=>b.dataset.kind),C.offers(a.api.state),'카드 = 규칙의 3장');ok(a.n.answers.classList.contains('hidden'),'보기 자리를 카드가 대신');
a=fresh();a.go();a.tick(fastAt(a.api.round.q));a.right();
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
eq(a.api.world.t-wb,Math.max(1,Math.round(W.dashTicks(a.api.world)/C.DASH_TICKS))*C.DASH_TICKS,'틀리면 늑대 세계가 무리 간격의 30%만큼 빨리 감김');
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
a=seed({index:Array.from({length:200},(_,k)=>k).find(k=>Q.at(8,'sound',k).lap===1)});a.go();const lap1=a.n.answers.children.map(b=>b.dataset.i).join();eq(lap1,Q.get(8,'sound',0).choices.map((_,i)=>String((i+1)%3)).join(),'두 바퀴째는 보기를 한 칸 돌림');

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
  for(let k=0;k<4&&a.api.phase==='pick';k++){a.tick(10);const can=a.cards().filter(b=>!b.disabled&&b.dataset.kind);if(can.length&&rnd()<.85)can[Math.floor(rnd()*can.length)].click();else a.n.skip.click()}
  if(a.api.phase==='learn'){a.tick(200);a.right()}
 }
 ok(a.api.state.index>=118,'120문제 진행');ok(a.api.world.stats.waves>5,'늑대 무리가 여러 번 옴');ok(a.api.world.stats.kills>0,'타워가 늑대를 쓰러뜨림');}

/* 2-12 0.8: 섞인 상식·수학·영어 · 연속 정답 · 빠른 정답 일제 사격 · 카드 여러 장 · 타워 강화 · 새 몬스터 알림 · 우두머리 보상 · 0.7 저장 이어받기 */
{const banners=a=>a.n.effects.children.filter(x=>x.classList.contains('banner')).map(x=>x.textContent);
 /* 듣고 고르기에서도 4번째 문제는 상식·수학·영어: 질문을 읽어 주고, 분류를 보여 준다 */
 a=seed({index:3});a.go();let q=Q.at(8,'sound',3);shows(a,8,'sound',3,'섞인 문제(듣기)');eq(q.mode,'quiz','4번째는 상식·수학·영어');eq(a.speakLog[0],q.speak,'질문을 읽어 줌');ok(a.n.levelChip.textContent.includes(Q.CATS[q.cat]),'분류 표시 '+a.n.levelChip.textContent);
 a.unlock();a.right();eq(a.api.phase,'pick','섞인 문제도 맞히면 카드');
 a=seed({index:7,mode:'story'});a.go();q=Q.at(8,'story',7);shows(a,8,'story',7,'섞인 문제(읽기)');eq(a.speakLog.length,0,'읽기 모드는 읽어 주지 않음');
 a.unlock();a.wrong(0);a.tick(C.DASH_TICKS);a.wrong(1);a.tick(10);eq(a.speakLog.at(-1),C.lesson(q),'놓치면 질문과 정답을 읽어 줌');
 /* 연속 정답: 🔥 표시, 틀리면 처음부터 */
 a=fresh();a.go();for(let i=0;i<3;i++){a.untilAsk();a.unlock();a.right();a.tick(7);a.n.skip.click();a.tick(3)}
 eq(a.api.state.streak,3,'3연속');ok(a.n.stage.textContent.includes('🔥 3연속'),'연속 표시');a.untilAsk();a.unlock();a.right();ok(a.n.gainLine.textContent.includes('🔥 4연속')&&a.n.gainParts.textContent.includes('연속 ×'),'금화 줄에 연속 배수');
 a.tick(7);a.n.skip.click();a.tick(3);a.untilAsk();a.unlock();a.wrong(0);eq(a.api.state.streak,0,'틀리면 연속이 끊김');
 /* 빨리 맞히면 일제 사격이 더 많다(타워당 3발 대 2발) */
 a=fresh({view:true});a.go();a.api.world.wolves.push({id:5e3,kind:'wolf',x:3,z:3,sx:15,sz:15,hp:999,max:999,speed:0,state:'walk',target:0,timer:0,inside:0,hen:0});a.tick(fastAt(a.api.round.q));const ar0=a.api.world.arrows.length;a.right();
 ok(a.events.some(e=>e.type==='volley'&&e.fast),'번개 정답 사건');eq(a.api.world.arrows.length-ar0,3,'번개 정답: 타워 1개 × 3발');
 a=fresh({view:true});a.go();a.api.world.trickle=1e9;a.api.world.wolves.push({id:5e3,kind:'wolf',x:3,z:3,sx:15,sz:15,hp:999,max:999,speed:0,state:'walk',target:0,timer:0,inside:0,hen:0});a.tick(Math.ceil(C.baseSeconds(a.api.round.q)*10*.7));const ar1=a.api.world.arrows.length;a.right();eq(a.api.world.arrows.length-ar1,2,'늦은 정답: 타워 1개 × 2발');
 /* 긴 글은 카드를 여러 장: 10세 읽기는 3장 */
 a=seed({age:10,mode:'story',gold:3000});a.go();a.unlock();a.right();eq([a.api.phase,a.api.round.picks],['pick',3],'10세 읽기: 카드 3장까지');a.tick(7);
 let k1=a.cards().find(b=>!b.disabled).dataset.kind;a.card(k1).click();eq([a.api.phase,a.api.round.picked,a.api.state.index],['pick',1,0],'한 장 산 뒤에도 고르는 중(문제 번호 그대로)');ok(a.cards().every(b=>b.disabled),'연출 동안 카드 잠김');
 a.tick(9);ok(a.cards().some(b=>!b.disabled),'0.9초 뒤 카드가 다시');ok(a.n.gainLine.textContent.includes('2장 더'),'남은 장수 표시 '+a.n.gainLine.textContent);eq(a.n.skip.textContent,'▶ 다음 문제','하나라도 샀으면 다음 문제 버튼');
 let b2=boot();b2.go();eq([b2.api.phase,b2.api.round.picks],['pick',2],'고르는 도중 저장 → 남은 2장으로 복원');
 a.card(a.cards().find(b=>!b.disabled).dataset.kind).click();a.tick(9);a.card(a.cards().find(b=>!b.disabled).dataset.kind).click();eq([a.api.phase,a.api.round.picked,a.api.state.index],['build',3,1],'3장째를 사면 다음 문제로');
 a=seed({age:8,mode:'sound',gold:3000});a.go();a.unlock();a.right();eq(a.api.round.picks,1,'짧은 문제는 1장');a.tick(7);a.card(a.cards().find(b=>!b.disabled).dataset.kind).click();eq(a.api.phase,'build','1장이면 바로 다음 문제로');
 /* 타워 강화: 회관 1단계부터 지켜요 칸에, 사면 화살이 터진다 */
 a=seed({hall:1,gold:500});a.go();a.unlock();a.right();a.tick(7);ok(a.card('power'),'타워 강화 카드');eq(a.card('power').children.find(x=>x.tagName==='small').textContent,C.POWER_NOTE[0],'카드 설명: 펑 화살');
 a.card('power').click();eq(a.api.state.power,1,'강화 1단계');ok(a.n.feedback.textContent.includes('펑 화살'),'강화 안내');ok(a.n.level.textContent.includes('💥1'),'상태 줄에 강화 단계');
 a.tick(12);a.api.world.wolves.push({id:6e3,kind:'wolf',x:3,z:3,sx:15,sz:15,hp:999,max:999,speed:0,state:'walk',target:0,timer:0,inside:0,hen:0});a.tick(20);ok(a.api.world.arrows.length===0||a.api.world.arrows.every(x=>x.splash>0),'강화 뒤 화살은 펑 화살');eq(a.window.getVillageState().power,1,'3D 상태에 강화 단계');
 /* 새 몬스터 알림·우두머리 보상 */
 a=seed({hall:1,level:2});a.go();let found=false;for(let i=0;i<1500&&!found;i++){a.tick(1);found=banners(a).some(t=>t.includes('덤불 늑대'))}ok(found,'덤불 늑대가 처음 나오면 알림 띠');ok(a.api.world.seen.bramble,'세계도 봤다고 기록');
 a=fresh();a.go();a.unlock();const tw=a.api.world.buildings.find(b=>b.kind==='tower');a.api.world.wolves.push({id:7e3,kind:'ember',x:tw.x+1,z:tw.z,sx:20,sz:0,hp:1,max:1,speed:0,state:'walk',target:0,timer:0,inside:0,hen:0,roar:99});
 g0=a.api.state.gold;for(let i=0;i<30&&a.api.world.stats.bossKills===0;i++)a.tick(1);eq(a.api.world.stats.bossKills,1,'불씨 왕 쓰러뜨림');eq(a.api.state.gold,g0+C.BOUNTY,'우두머리 보상 금화 +'+C.BOUNTY);ok(banners(a).some(t=>t.includes('불씨 왕을 쓰러뜨렸어요')),'보상 알림 띠');
 /* 울타리만 부서졌으면 고치기 카드가 없다(농부가 다시 세움) */
 a=seed({fence:2,gold:300});a.go();a.unlock();for(const b of a.api.world.buildings)if(b.kind==='fence'){b.broken=true;b.hp=0}a.right();a.tick(7);ok(!a.card('repair'),'울타리만 부서지면 고치기 카드 없음');
 /* 그림 마을 늑대도 종류를 표시 */
 a=seed({hall:2,level:3});a.go();a.tick(900);const live=a.api.world.wolves.filter(v=>v.state!=='gone'),shown=a.n.enemies.children.filter(x=>!x.classList.contains('hidden'));
 eq(shown.map(x=>x.dataset.kind),live.map(v=>v.kind),'그림 마을 몬스터 종류 = 세계');ok(live.some(v=>v.kind!=='wolf'),'2단계 마을에 새 몬스터');
 /* 0.7 저장(세계 v1) 이어받기: 늑대에 종류, 무리 간격은 새 규칙 */
 saved={[KEY]:JSON.stringify({version:1,...C.fresh(8),level:1,world:{v:1,t:900,rng:5,hall:0,interval:270,wave:{n:3,arrive:1110,spawned:false},wolves:[{id:40,x:12,z:0,sx:17,sz:0,hp:20,max:20,speed:.8,state:'walk',target:0,timer:0,inside:0,hen:0}],hens:[],buildings:[],arrows:[],nextId:50,stats:{kills:5,henLost:0,henSaved:0,broken:0,waves:3},events:[]}})};
 b2=boot();eq([b2.api.world.v,b2.api.world.interval,b2.api.world.wolves[0].kind,b2.api.world.stats.kills],[2,W.intervalFor(9),'wolf',5],'0.7 세계 저장을 0.8로 이어받음');ok(b2.api.world.wave.arrive<=b2.api.world.t+b2.api.world.interval,'다음 무리를 새 간격으로 당김');b2.go();b2.tick(50);ok(b2.api.world.t===950,'이어서 진행');
}

console.log('PASS '+checks+' rule + simulated DOM assertions. Not browser/audio/device validation.');
