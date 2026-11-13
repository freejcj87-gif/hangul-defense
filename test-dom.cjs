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
eq(C.API,3,'규칙 API 버전(0.9 상점·알 경제·추천)');
/* 1-1 제한시간: 짧은 문제(7세 낱말)는 8~10초, 긴 글은 길이에 비례(최대 50초), 언제나 보통 아이 필요 시간 이상. 0.11: 문항은 읽기(story)뿐 */
let shortCount=0;
for(const a of Q.AGES)for(const m of Q.MODES)for(const q of bank(a,m)){
 const sec=C.baseSeconds(q),need=C.needSeconds(q),tag=q.id;
 ok(Number.isInteger(sec)&&sec>=C.MIN_SEC[a]&&sec<=C.MAX_SEC,tag+' 제한시간 범위 '+sec);
 ok(sec>=need,tag+' 보통 아이 필요 시간('+need.toFixed(1)+'초) 이상');
 eq(C.limit(q,S()),sec*10,tag+' 틱 = 초×10');
 if(a===7){ok(sec>=8&&sec<=10,tag+' 짧은 문제 8~10초');shortCount++}else ok(sec>10,tag+' 긴 글은 10초보다 김');
 const lock=C.reveal(q);
 if(m==='story'&&a>=8){ok(lock>3&&lock<C.limit(q,S())*.3,tag+' 글 먼저 읽기 잠금은 제한시간의 30% 미만')}else eq(lock,3,tag+' 보기 잠금 0.3초');
 /* 0.11: 읽어 주는 음성이 없다. 놓친 뒤에는 다시 볼 글의 양만큼(1.5~8초) 기다렸다가 초록 답을 누른다. 9세 이상은 지문을 빼고 짧게 */
 const lt=C.learnTicks(q);ok(Number.isInteger(lt)&&lt>=C.LEARN.min&&lt<=C.LEARN.max,tag+' 놓친 뒤 기다리는 틱 '+lt);
 if(a>=9){eq(C.learnTicks({...q,passage:q.passage+'가'.repeat(300)}),lt,tag+' 9세 이상: 기다림은 지문 길이와 무관(질문·정답만)');ok(lt<=C.learnTicks({...q,age:8}),tag+' 9세 이상은 지문까지 볼 때보다 짧거나 같음')}
  else if(a===8)eq(C.learnTicks({...q,passage:q.passage+'가'.repeat(400)}),C.LEARN.max,tag+' 8세: 지문이 길면 더 기다림(최대 8초)');
 ok(C.scale(q)>=1&&C.scale(q)<=5,tag+' 긴 글 배수 1~5');
}
eq(shortCount,Q.count(7,'story'),'8~10초 문항 = 7세 낱말 전부(0.11: 소리 문항 삭제)');eq(Q.MODES,['story'],'모드는 읽고 고르기 하나');
/* 1-1b 상식·수학·영어: 풀이 시간·읽어 줄 글·섞는 순서 */
for(const a of Q.AGES)for(let i=0;i<Q.quizCount(a);i++){const q=Q.quiz(a,i),tag=q.id,sec=C.baseSeconds(q);
 ok(sec>=C.needSeconds(q)&&sec<=C.MAX_SEC,tag+' 풀이 시간 '+sec);eq(C.reveal(q),3,tag+' 바로 보임');
 const lt=C.learnTicks(q);ok(Number.isInteger(lt)&&lt>=C.LEARN.min&&lt<=C.LEARN.max,tag+' 놓친 뒤 기다리는 틱 '+lt)}
ok(!('lesson' in C)&&!('sayable' in C),'읽어 줄 글(lesson·sayable)은 규칙에서 삭제');eq([C.LEARN.min,C.LEARN.max],[15,80],'놓친 뒤 기다림 1.5~8초');
/* 0.10 출제: 20칸마다 퀴즈 칸 수는 나이·문제 번호로 정해지고(7세 2, 8세 3, 9세 5→7, 10세 7→10), 연달아 나오지 않으며, 같은 씨앗이면 같은 순서 */
for(const a of Q.AGES)for(const m of Q.MODES){const seq=Array.from({length:200},(_,i)=>Q.at(a,m,i,4242));
 for(let b=0;b<10;b++){const n=seq.slice(b*20,b*20+20).filter(q=>q.mode==='quiz').length;if(n!==Q.quizPer20(a,b*20)){eq(n,Q.quizPer20(a,b*20),a+'세 '+m+' '+b+'번째 20칸 퀴즈 수');break}}
 eq(seq.every((q,i)=>(q.mode==='quiz')===Q.isQuiz(a,i)),true,a+'세 '+m+': 칸 종류 = Q.isQuiz');
 if(Q.quizPer20(a,0)<=8)eq(seq.some((q,i)=>i&&q.mode==='quiz'&&seq[i-1].mode==='quiz'),false,a+'세 '+m+': 퀴즈가 연달아 나오지 않음');
 eq(seq.map(q=>q.id),Array.from({length:200},(_,i)=>Q.at(a,m,i,4242).id),a+'세 '+m+': 같은 씨앗이면 같은 순서');
 ok(seq.slice(0,40).map(q=>q.id).join()!==Array.from({length:40},(_,i)=>Q.at(a,m,i,99).id).join(),a+'세 '+m+': 씨앗이 다르면 순서가 다름')}
eq([2,3,5,7].map((n,k)=>Q.quizPer20(Q.AGES[k],0)),[2,3,5,7],'첫 20칸 퀴즈 수: 7세 2 · 8세 3 · 9세 5 · 10세 7');ok(Q.quizPer20(9,200)>Q.quizPer20(9,0)&&Q.quizPer20(10,200)>Q.quizPer20(10,0),'9·10세는 진행할수록 퀴즈가 늘어남');
{const n=Q.count(8,'story'),ids=Array.from({length:n*2+40},(_,i)=>Q.at(8,'story',i,7)).filter(q=>q.mode==='story');const first=ids.slice(0,n).map(q=>q.id);
 eq(new Set(first).size,n,'한 바퀴 안에서는 같은 문항이 다시 나오지 않음');ok(ids.find(q=>q.lap===1),'두 바퀴째는 lap 1(보기 순서 돌림)')}
{const q=Q.get(7,'story',0),base=C.limit(q,S());
 eq(C.limit(q,S({fence:6})),Math.round(base*1.3),'울타리 6칸 = +30%');
 eq(C.limit(q,S({help:2})),Math.round(base*1.4),'도움 2단계 = +40%');
 eq(C.limit(q,S({fence:18})),C.limit(q,S({fence:6})),'(0.6 유산) 울타리 시간은 6칸까지만');}

/* 1-2 수입: 시간을 늦게 쓴다고 늘지 않고(경과 시간은 입력이 아님), 번개면 25% 더 */
{const q=Q.get(7,'story',0),s=S(),P=C.PAY,one=P.base+P.egg;
 const a=C.income(s,q,false),b=C.income(s,q,true);
 eq([a.base,a.laid,a.sold,a.left,a.eggValue,a.gold],[P.base,1,1,0,P.egg,one],'처음 수입 = 기본 '+P.base+' + 알 1 × '+P.egg);
 eq([a.eggs,a.value],[a.sold,a.eggValue],'0.8 호환 이름: eggs = sold, value = eggValue');
 ok(['laid','sold','left','eggValue','fish','base','m','streak','combo','plain','bonus','gold'].every(k=>Number.isFinite(a[k])),'income 필드(계약)');
 eq(b.gold,one+Math.ceil(one*C.FAST_BONUS),'번개 +25%(올림)');ok(b.gold>a.gold,'빨리 맞히면 더 받음');
 const fa=Math.ceil(C.FAST_MIN*C.needSeconds(q)/C.TICK);ok(!C.isFast(q,3)&&!C.isFast(q,fa-1)&&C.isFast(q,fa)&&C.isFast(q,Math.floor(C.baseSeconds(q)*10*(1-C.FAST)))&&!C.isFast(q,Math.floor(C.baseSeconds(q)*10*(1-C.FAST))+1),'번개 = 최소 읽기 시간('+fa+'틱) ~ 기본 시간의 60%: 마구 누르기는 번개가 아님');
 const long=Q.get(10,'story',0);ok(C.income(s,long,false).gold>a.gold*3,'긴 글은 문제당 더 받음');
 eq(C.income(S({chickens:4,hidden:1}),q,false).laid,3,'숨은 닭은 알을 못 낳음');
 /* 연속 정답: 2연속 ×1.1 … 6연속부터 ×1.5, 틀리면 처음부터 */
 const st=S();const golds=[];for(let i=0;i<7;i++)golds.push(C.settle(st,q,'first',{fast:false}).gold);
 eq(golds,[1,2,3,4,5,6,7].map(n=>Math.round(one*C.combo(n))),'연속 정답 금화 ×1.0 → ×1.5(6연속부터)');eq([C.combo(2),C.combo(6),C.combo(9)],[1.1,1.5,1.5],'연속 배수');eq(st.streak,7,'연속 7');
 C.settle(st,q,'second');eq(st.streak,0,'두 번째에 맞히면 연속 끊김');C.settle(st,q,'first');C.settle(st,q,'miss');eq(st.streak,0,'놓쳐도 끊김');eq(C.combo(1),1,'첫 정답 ×1');}

/* 1-2b 알 경제(game-plan §4.4): 닭마다 알 1개 → 농부 바구니(1 + 농부) × 4만큼 팔고 → 남은 알은 둥지(닭 수까지)에 남아 다음 정답에 먼저 판다 */
{const q=Q.get(7,'story',0),P=C.PAY,B=P.basket,egg=h=>P.egg+P.hall*h;
 const s=S({chickens:7});let nest=0;
 for(let i=0;i<4;i++){const r=C.settle(s,q,'first'),tot=nest+7,sold=Math.min(tot,B),left=Math.min(7,tot-sold);
  eq([r.laid,r.sold,r.left,s.nest,r.basket],[7,sold,left,left,B],(i+1)+'번째 정답: 닭 7 · 농부 1명 → 판 알 '+sold+', 둥지 '+left);nest=left}
 eq(s.nest,7,'둥지 알은 닭 수까지만');
 let r=C.income(S({chickens:7,farmers:1}),q,false);eq([r.sold,r.left,r.basket],[7,0,2*B],'농부 2명이면 바구니 '+2*B+': 다 팜');
 r=C.income(S({chickens:20,farmers:9,nest:20}),q,false);eq([r.sold,r.left],[Math.min(40,10*B),Math.min(20,40-10*B)],'농부 10명 · 닭 20 · 둥지 20');
 eq(C.income(S({chickens:2,nest:9}),q,false).left,Math.min(2,9+2-B),'닭이 줄면 둥지도 닭 수까지');
 for(const h of [0,1,2,3]){r=C.income(S({hall:h,chickens:3}),q,false);eq(r.eggValue,egg(h),'회관 '+h+'단계 알값 '+egg(h));eq(r.gold,Math.round((P.base+3*egg(h))*r.m*r.combo),'금화 = (기본 + 판 알 × 알값) × 배수')}
 for(const h of [0,3]){eq(C.income(S({hall:h,chickens:3,marketDown:1}),q,false).eggValue,Math.max(1,Math.floor(egg(h)/2)),'매대가 부서지면 알값 절반(내림) '+h)}
 eq(C.eggPrice(S({marketDown:1,hall:0})),Math.max(1,Math.floor(P.egg/2)),'eggPrice = 알값');
 r=C.income(S({pond:2,feast:3,chickens:1}),q,false);eq([r.fish,r.base],[2*P.fish,P.base+3*P.feast],'연못 물고기 · 잔치 기본금');
 const long=Q.get(10,'story',0);r=C.income(S({chickens:3}),long,false);eq(r.plain,Math.round((P.base+3*P.egg)*C.scale(long)),'긴 글 배수는 알까지 곱함');
 const s2=S({chickens:6,nest:3});C.settle(s2,q,'second');eq(s2.nest,3,'두 번째 정답은 둥지를 건드리지 않음(금화 없음)');C.settle(s2,q,'miss');eq(s2.nest,3,'놓쳐도 그대로');
 ok(C.income(S({chickens:6}),q,false).gold<C.income(S({chickens:6,farmers:1}),q,false).gold,'닭이 바구니보다 많으면 농부가 수입을 늘림');}

/* 1-3 결말 반영 */
{const q=Q.get(7,'story',0);
 let s=S({hidden:1,chickens:3,help:2});const r=C.settle(s,q,'first',{fast:true});
 eq([s.gold,s.wins,s.hidden,s.help],[20+r.gold,1,0,1],'한 번에 정답: 금화·정답 수·숨은 닭 1마리 복귀·도움 1단계 감소');
 eq(r.eggs,2,'복귀한 닭은 이번에는 알을 낳지 않음');
 s=S();const before=JSON.stringify(s);C.settle(s,q,'second');eq(JSON.stringify(s),before,'두 번째 정답: 금화·카드 없음, 상태 그대로');
 s=S({chickens:3});let m=C.settle(s,q,'miss',{timeout:true});eq([m.wolves,m.shot,m.through,m.scared,s.hidden,s.misses,s.late],[1,0,1,1,1,1,1],'놓침: 늑대 1마리가 닭 1마리를 숨게 함');
 m=C.settle(s,q,'miss',{timeout:true});eq([s.help,s.late],[1,0],'시간 초과 2연속 → 도움 1단계');
 s=S({chickens:3,late:1});C.settle(s,q,'miss',{timeout:false});eq([s.help,s.late],[0,0],'틀려서 놓친 것은 시간 초과로 세지 않음');
 s=S({chickens:8,level:5,fence:6,farmers:2,pond:3,hall:3});eq(C.wolves(s),5,'늑대 최대 5마리');m=C.settle(s,q,'miss');eq([m.shot,m.scared],[5,0],'타워 5층이면 5마리 모두 쏨');
 s=S({chickens:2,level:1,fence:6,hall:3});eq(C.wolves(s),3,'지은 것 10개 → 늑대 3마리');m=C.raid(s);eq([m.shot,m.through,m.scared],[1,2,2],'타워 1층: 1마리 쏘고 2마리 통과');
 s=S({help:3,late:1});C.settle(s,q,'miss',{timeout:true});eq(s.help,3,'도움 최대 3단계');
 /* 읽기 속도(pace): 맞힌 시간 ÷ 보통 아이 필요 시간(%)을 섞는다. ticks가 없으면 그대로. 천천히 읽는 아이에게만 늑대 완충(World.slowEase) */
 const need=C.needSeconds(q)/C.TICK;s=S();C.settle(s,q,'first');eq(s.pace,100,'ticks 없으면 pace 그대로');
 for(let i=0;i<30;i++)C.settle(s,q,'first',{ticks:Math.round(need*1.6)});ok(Math.abs(s.pace-160)<=3,'천천히 읽으면 pace → 160 ('+s.pace+')');ok(W.slowEase(s)<1&&W.slowEase(s)>=W.SLOW.min,'느린 아이는 늑대 완충 '+W.slowEase(s).toFixed(2));
 const g=S();for(let i=0;i<30;i++)C.settle(g,q,'first',{ticks:7});ok(g.pace<=C.PACE.lo+3,'찍기처럼 바로 누르면 pace는 하한 근처 ('+g.pace+')');eq(W.slowEase(g),1,'빨리 누르는 아이는 완충 없음');
 eq([C.restore({version:1,pace:999}).pace,C.restore({version:1,pace:3}).pace,C.restore({version:1}).pace],[C.PACE.hi,C.PACE.lo,100],'저장된 pace는 범위 안으로');
 const w0=W.create({seed:3,interval:200});w0.wave.n=30;ok(W.packSize(w0,Object.assign(S({level:8,fence:4,chickens:8}),{pace:200}))<W.packSize(w0,S({level:8,fence:4,chickens:8})),'느린 아이에게는 무리가 작음');}

/* 1-4 상점(game-plan §4.3): 2줄 × 4칸 고정, 카드 순환과 무관하게 언제든 산다. 칸 상태 buy · poor · locked · none · max */
{eq(C.SHOP,['repair','tower','power','fence','chicken','farmer','pond','hall'],'상점 8칸 순서(계약)');
 const keys=s=>C.shop(s).map(x=>x.key),st=s=>Object.fromEntries(C.shop(s).map(x=>[x.key,x.state]));
 eq(keys(S()),C.SHOP,'회관 0~2단계: 8번째 칸은 회관');eq(keys(S({hall:3})),C.SHOP.slice(0,7).concat('feast'),'회관 3단계: 8번째 칸은 잔치');eq(C.shopKeys(S({hall:3})),keys(S({hall:3})),'shopKeys');
 for(const x of C.shop(S()))ok(Object.keys(x).join()==='key,state,price,need'&&Number.isFinite(x.price)&&Number.isInteger(x.need),x.key+' 칸 = {key, state, price, need}');
 eq(st(S({gold:0})),{repair:'none',tower:'poor',power:'locked',fence:'poor',chicken:'poor',farmer:'poor',pond:'locked',hall:'poor'},'금화 0: 고칠 곳 없음 · 부족 · 잠김');
 eq(C.shop(S()).filter(x=>x.state==='locked').map(x=>[x.key,x.need]),[['power',1],['pond',2]],'잠긴 칸은 필요한 회관 단계(강화 1 · 연못 2)');
 eq(st(S({gold:1e6,broken:2})),{repair:'buy',tower:'buy',power:'locked',fence:'buy',chicken:'buy',farmer:'buy',pond:'locked',hall:'buy'},'금화가 넉넉하면 회관 0단계에서도 농부까지 삼');
 eq(st(S({gold:1e6,hall:2})).pond,'buy','회관 2단계: 연못');eq(st(S({gold:1e6,hall:1})).power,'buy','회관 1단계: 강화');
 eq(C.price(S({broken:2}),'repair'),C.REPAIR.base+2*C.REPAIR.per,'고치기 값 = 기본 + 부서진 곳마다');eq(C.price(S(),'repair'),C.REPAIR.base+C.REPAIR.per,'고칠 곳이 없을 때 보이는 값');
 for(const k of ['tower','fence','chicken','farmer','hall']){const p=C.price(S(),k);eq([st(S({gold:p-1}))[k],st(S({gold:p}))[k]],['poor','buy'],k+': '+(p-1)+'이면 부족, '+p+'이면 삼')}
 /* 카드 순환(offers)과 무관하게 언제든 산다(0.8: 제시되지 않은 카드는 못 삼) */
 let s=S({gold:1e6,hall:2});ok(!C.offers(s).includes('pond')||true);eq(C.buy(s,'pond'),C.ITEMS.pond.prices[0],'연못은 언제든');eq(C.buy(s,'farmer'),C.ITEMS.farmer.prices[0],'농부도 언제든');eq(C.buy(s,'power'),C.ITEMS.power.prices[0],'강화도');
 for(const k of ['tower','power','fence','chicken','farmer','pond','hall','feast']){const s=S({gold:1e6,hall:k==='feast'?3:k==='pond'?2:k==='power'?1:0}),key=C.ITEMS[k].key,before=s[key],g=s.gold,p=C.price(s,k);
  ok(C.canBuy(s,k),k+' 살 수 있음');eq(C.buy(s,k),p,k+' 값 '+p);eq([s.gold,s[key]],[g-p,before+1],k+': 금화가 빠지고 하나 늘어남')}
 s=S({gold:10});const snap=JSON.stringify(s);eq(C.buy(s,'tower'),0,'모자라면 못 삼');eq(JSON.stringify(s),snap,'못 사면 상태 그대로');
 eq([C.buy(S({gold:1e6}),'power'),C.buy(S({gold:1e6}),'repair'),C.buy(S({gold:1e6}),'nope'),C.buy(S({gold:1e6,hall:2}),'feast')],[0,0,0,0],'잠김 · 고칠 곳 없음 · 없는 상품 · 회관 3 전 잔치는 못 삼');
 s=S({gold:1e6,broken:3});eq(C.buy(s,'repair'),C.REPAIR.base+3*C.REPAIR.per,'고치기는 부서진 곳 수만큼');eq(s.repairs,1,'고친 횟수');
 const f3=S({gold:1e6,hall:3});eq(C.buy(f3,'feast'),200,'잔치 200');eq(C.price(f3,'feast'),260,'잔치 값은 60씩');eq(C.max('feast'),Infinity,'잔치는 끝없음');}

/* 1-4b 숨은 상한(계약)·가격 곡선: 늘 오르고, 상한까지 사면 max, 상한 뒤에는 못 삼 */
{eq(Object.fromEntries(['tower','power','fence','chicken','farmer','pond','hall','feast','repair'].map(k=>[k,C.max(k)])),{tower:19,power:10,fence:18,chicken:19,farmer:9,pond:3,hall:3,feast:Infinity,repair:Infinity},'숨은 상한(산 횟수)');
 eq([C.TOWERS_MAX,C.HENS_MAX,C.FARMERS_MAX],[20,20,10],'타워 1+19 · 닭 1+19 · 농부 1+9');
 let total=0,n=0;
 for(const k of ['tower','power','fence','chicken','farmer','pond','hall']){const p=C.ITEMS[k].prices;eq(p.length,C.max(k),k+' 가격 수 = 상한');
  ok(p.every((x,i)=>Number.isInteger(x)&&x>0&&(i===0||x>p[i-1])),k+' 가격은 늘 오름: '+p.join(','));total+=p.reduce((a,b)=>a+b,0);n+=p.length;
  const s=S({gold:1e9,hall:k==='hall'?0:3});for(let i=0;i<p.length;i++){if(C.price(s,k)!==p[i]||!(C.buy(s,k)>0)){ok(false,k+' '+(i+1)+'번째 값·구매');break}}
  ok(!C.canBuy(s,k)&&C.price(s,k)===Infinity&&C.buy(s,k)===0,k+' 상한 뒤에는 못 삼');
  const cell=C.shop(s).find(x=>x.key===k);if(cell)eq([cell.state,cell.price],['max',0],k+' 상한 칸 = max(값 0)')}
 console.log('  끝이 있는 상품 '+n+'번, 모두 사는 값 '+total+'금화');eq(n,81,'끝이 있는 상품은 81번');ok(total>10000&&total<80000,'모두 사는 값 '+total);
 const s=S({gold:1e6,chickens:20});eq(C.shop(s)[4].state,'max','닭 20마리면 다 지음');s.chickens=18;eq([C.shop(s)[4].state,C.price(s,'chicken')],['buy',C.ITEMS.chicken.prices[17]],'물려 가서 줄면 다시 사고 값도 내려감');
 eq(C.price(S({chickens:0}),'chicken'),C.ITEMS.chicken.prices[0],'닭 0마리면 첫 값');eq(C.count(S({chickens:0}),'chicken'),0,'닭 산 횟수는 0 아래로 안 감');
 /* 강화 4~10단계: 화살 피해 +1씩(세 갈래 그대로) */
 const d=[];for(let p=0;p<=10;p++)d.push(W.damage(S({power:p})));eq(d.slice(4).map((x,i)=>x-d[3+i]),Array(7).fill(W.POWER_STEP),'강화 4~10단계: 화살 피해 +'+W.POWER_STEP+'씩');
 eq([W.power(S({power:10})).multi,W.power(S({power:10})).splash],[3,W.POWER[3].splash],'10단계도 세 갈래 · 큰 펑');eq(C.POWER_NOTE.length,10,'강화 설명 10단계');}

/* 1-5 모든 상품은 산 순간 수입·화살·타워·울타리·상점·알값 가운데 하나가 바로 변한다(명분 있는 선택지) */
{const q=Q.get(7,'story',0);
 const sig=s=>{const w=W.sync(W.create({seed:1,interval:300}),s);return JSON.stringify([C.income(s,q,false).gold,W.damage(s),W.power(s),W.towerUnits(w),w.buildings.filter(b=>b.kind==='fence').map(b=>b.layer),C.shop(s).map(x=>x.state==='locked'),C.eggPrice(s)])};
 for(const k of ['tower','power','fence','chicken','farmer','pond','hall','feast']){
  const s=S({gold:1e6,hall:k==='feast'?3:k==='pond'?2:k==='power'?1:0,chickens:k==='farmer'?9:3}),before=sig(s);
  ok(C.buy(s,k)>0,k+' 삼');ok(sig(s)!==before,k+' 산 즉시 효과가 보임')}
 /* 타워·울타리는 상한까지 살 때마다 세계가 바뀐다(층·겹) */
 for(const k of ['tower','fence']){const s=S({gold:1e9,hall:k==='tower'?0:3});let same=0;for(let i=0;i<C.max(k);i++){const b=sig(s);C.buy(s,k);if(sig(s)===b)same++}eq(same,0,k+' '+C.max(k)+'번 모두 세계가 바뀜')}}

/* 1-6 저장 복원·0.5/0.8 이행(저장 형식 version 1 그대로) */
{eq(C.restore(null).gold,20,'저장 없음 → 새 판');eq(C.restore({version:2,gold:999}).gold,20,'모르는 버전은 무시');
 const old=C.restore({version:1,gold:120,hp:40,level:2,wins:9,index:4,mode:'story',age:9,chickens:3,fence:2,claimed:'story:4',completed:null,qage:9,combat:{stage:4}});
 eq([old.gold,old.level,old.wins,old.index,old.mode,old.age,old.chickens,old.fence,old.round,old.nest,old.marketDown],[120,2,9,5,'story',9,3,2,null,0,0],'0.5 저장 이행: 보상받은 문제는 다음으로');
 ok(!('hp' in old)&&!('combat' in old),'0.5 전투·성문 값은 버림');
 eq(C.restore({version:1,chickens:0}).chickens,1,'닭 0마리 저장 → 1마리');
 const big=C.restore({version:1,level:99,fence:99,chickens:99,farmers:99,pond:99,hall:99,hidden:99,help:9,age:12,gold:-5,power:99,nest:99,marketDown:7});
 eq([big.level,big.fence,big.chickens,big.farmers,big.pond,big.hall,big.hidden,big.help,big.age,big.gold,big.power,big.nest,big.marketDown],[19,18,20,9,3,3,20,3,8,20,10,20,1],'새 상한으로 자름(둥지 ≤ 닭, 매대 0/1)');
 /* 0.8 저장: 카드 고르기 중이던 문제는 금화를 이미 받았다 → 다음 문제로, 남은 카드 수(left)는 버림 */
 const v8={version:1,gold:57,level:5,fence:6,chickens:8,farmers:2,pond:1,hall:2,power:3,index:12,mode:'sound',age:8,wins:10,streak:3,round:{token:'8:sound:12',phase:'pick',t:41,tries:0,gold:15,left:2}};
 const r8=C.restore(v8);eq([r8.round,r8.index,r8.gold,r8.nest,r8.marketDown,r8.streak,r8.mode],[null,13,57,0,0,3,'story'],'0.8 카드 고르기 저장 → 다음 문제(금화 두 번 안 줌), 소리 모드 저장은 story로');
 eq([r8.level,r8.fence,r8.chickens,r8.farmers,r8.pond,r8.hall,r8.power],[5,6,8,2,1,2,3],'0.8 마을은 그대로');
 eq(C.restore({version:1,index:3,mode:'story',round:{token:'8:story:3',phase:'ask',t:41,tries:1,gold:0,left:3}}).round,{token:'8:story:3',phase:'ask',t:41,tries:1,gold:0},'풀던 읽기 문제는 그대로(left 버림)');
 /* 0.11 듣고 고르기 폐쇄: 예전 mode 'sound'(또는 mode 없는) 저장은 story로, 풀던 소리 문제는 버리고 같은 번호의 읽기 문제로. 마을·금화는 그대로 */
 eq(C.fresh(8).mode,'story','새 판 기본 모드 = story');
 for(const phase of ['ask','learn']){const r=C.restore({version:1,gold:88,level:3,chickens:5,wins:6,index:6,seed:5,mode:'sound',age:9,round:{token:'9:sound:6',phase,t:44,tries:1,gold:0}});
  eq([r.mode,r.round,r.index,r.gold,r.level,r.chickens,r.wins,r.seed,r.age],['story',null,6,88,3,5,6,5,9],'소리 모드 저장('+phase+' 중) → story, 풀던 소리 문제는 버림, 번호·마을 그대로')}
 eq([C.restore({version:1,index:3,round:{token:'8:sound:3',phase:'ask',t:41,tries:1}}).mode,C.restore({version:1,index:3,round:{token:'8:sound:3',phase:'ask',t:41,tries:1}}).round],['story',null],'mode 없는 옛 저장(기본이 소리였음)도 story, 풀던 문제 버림');
 eq([C.restore({version:1,mode:'x'}).mode,C.restore({version:1,mode:'story'}).mode],['story','story'],'어떤 mode든 story');
 {const o=C.restore({version:1,gold:77,index:2,mode:'sound',age:9,claimed:'sound:2'});eq([o.mode,o.index],['story',3],'0.5 소리 저장: 보상받은 문제는 다음으로, 모드는 story')}
 eq(C.restore({version:1,round:{token:'8:story:3',phase:'learn',t:1,tries:1}}).round,{token:'8:story:3',phase:'learn',t:1,tries:1,gold:0},'배우기 단계 복원');
 eq(C.restore({version:1,round:{token:'x',phase:'battle',t:1,tries:0}}).round,null,'모르는 단계는 버림');eq(C.restore({version:1,index:3,round:{phase:'pick'}}).index,3,'모양이 틀린 pick 저장은 넘기지 않음');
 const s9=S({gold:345,level:12,fence:9,chickens:14,farmers:3,pond:1,hall:2,power:4,nest:5,marketDown:1,index:40,wins:33,streak:2,mode:'story',age:10,repairs:2,feast:0});s9.round={token:'10:story:40',phase:'ask',t:12,tries:0,gold:0};
 eq(C.restore(JSON.parse(JSON.stringify({...s9,version:1})),[7,8,9,10]),s9,'0.9 저장 왕복');}

/* 1-6b 추천 말풍선(game-plan §4.5): 순수 함수 recommend(s, ctx) → {key, line, urgent, rule} | null. 규칙 순서·문장·잔소리 막기(순수 함수 몫) */
{const R=(o,c)=>C.recommend(S(o),c||{}),K=r=>r&&[r.key,r.rule,r.urgent],L=C.LINES,P=k=>C.price(S(),k);
 /* 1 고치기(급함) */
 eq(K(R({gold:500,broken:1},{brokenKinds:['coop']})),['repair',1,true],'1 진짜 건물 부서짐 → 고치기(급함)');
 eq([R({gold:500,broken:1,chickens:4},{brokenKinds:['coop']}).line,R({gold:500,broken:2,chickens:4},{brokenKinds:['tower','market']}).line,R({gold:500,broken:1,chickens:4},{brokenKinds:['tower']}).line,R({gold:500,broken:1,chickens:4},{brokenKinds:['barn']}).line,R({gold:500,broken:1,chickens:4}).line],
  [L.repairCoop,L.repairMarket,L.repairTower,L.repairBarn,L.repair],'고치기 문장: 회관 > 매대 > 타워 > …, 모르면 일반 문장');
 /* 0.10: 닭 0~1마리이면 닭장·매대가 아닌 건물 고치기보다 닭을 먼저 */
 eq(K(R({gold:500,broken:1,chickens:1},{brokenKinds:['tower']})),['chicken',3,false],'닭 1마리 + 타워 부서짐 → 닭 먼저');
 eq(K(R({gold:500,broken:1,chickens:0},{brokenKinds:['barn']})),['chicken',3,false],'닭 0마리 + 헛간 부서짐 → 닭 먼저');
 eq(K(R({gold:500,broken:1,chickens:1},{brokenKinds:['coop']})),['repair',1,true],'닭장이 부서지면 닭이 적어도 고치기 먼저');
 eq(K(R({gold:500,broken:1,chickens:1},{brokenKinds:['market']})),['repair',1,true],'매대가 부서지면 닭이 적어도 고치기 먼저');
 eq(K(R({gold:25,broken:1,chickens:1},{brokenKinds:['tower']})),['repair',1,true],'닭을 못 사면 고치기');
 eq(L.repairCoop,'회관을 고쳐야 할 것 같아요!','기획서 문장');
 ok((K(R({gold:10,broken:1}))||[])[1]!==1,'고칠 돈이 없으면 다음 규칙으로');ok((K(R({gold:500},{brokenKinds:['coop']}))||[])[1]!==1,'경제 상태에 부서진 곳이 없으면 고치기 아님');
 /* 2 위험 → 타워, 못 사면 울타리(급함) */
 eq(K(R({gold:500,chickens:6},{lostHenRecently:true})),['tower',2,true],'2 방금 닭을 물려 감 → 타워');eq(R({gold:500,chickens:6},{lostHenRecently:true}).line,L.lostHen,'꼬꼬를 지키려면 타워');
 eq(K(R({gold:500,chickens:6,level:1},{wolvesInside:6})),['tower',2,true],'마을 안 늑대 ≥ 타워 × 3 → 타워');eq(R({gold:500,chickens:6,level:1},{wolvesInside:6}).line,L.manyWolves,'늑대가 너무 많아요');
 ok((K(R({gold:500,chickens:6,level:1},{wolvesInside:5}))||[])[1]!==2,'타워 2개에 늑대 5마리는 위험 아님');eq(K(R({gold:500,chickens:6,level:1},{wolvesInside:6,towers:3})),K(R({gold:500,chickens:6,level:1},{wolvesInside:5})),'ctx.towers가 있으면 그것으로 셈');
 {const s=S({chickens:6,level:4});s.gold=C.price(s,'fence');ok(s.gold<C.price(s,'tower'),'(전제) 울타리가 타워보다 쌈');eq(K(C.recommend(s,{lostHenRecently:true})),['fence',2,true],'타워 값이 없으면 울타리');eq(C.recommend(s,{lostHenRecently:true}).line,L.fenceGap,'빈 면이 있으면 뚫렸다는 문장')}
 {const s=S({level:15,fence:7,chickens:6});s.gold=C.price(s,'fence');ok(s.gold<C.price(s,'tower'),'(전제)');eq(C.recommend(s,{lostHenRecently:true}).line,L.fenceThick,'6면이 다 막혔으면 두껍게')}
 /* 3 닭 0~1 */
 eq(K(R({gold:P('chicken'),chickens:0})),['chicken',3,false],'3 닭 0마리 → 닭');eq(R({gold:P('chicken'),chickens:0}).line,L.noHen,'꼬꼬가 한 마리도 없어요');eq(K(R({gold:P('chicken'),chickens:1})),['chicken',3,false],'닭 1마리 → 닭');
 /* 4 회관으로 새로 열린 상품(1회) */
 const at=(o,k)=>{const s=S(o);s.gold=C.price(s,k);return s};
 eq(K(C.recommend(at({hall:1,chickens:6,level:3},'power'),{})),['power',4,false],'4 회관 1단계 → 강화');eq(C.recommend(at({hall:1,chickens:6,level:3},'power'),{}).line,L.openPower,'펑! 문장');
 ok((K(C.recommend(at({hall:1,chickens:6,level:3},'power'),{opened:['power']}))||[])[1]!==4,'한 번 알린 상품은 다시 4번이 아님');
 eq(K(C.recommend(at({hall:2,chickens:6,level:3,power:1},'pond'),{})),['pond',4,false],'회관 2단계 → 연못');eq(K(C.recommend(at({hall:3,chickens:6,level:3,power:1,pond:1},'feast'),{})),['feast',4,false],'회관 3단계 → 잔치');
 /* 5 회관 */
 eq(K(R({gold:P('hall'),chickens:6,level:3})),['hall',5,false],'5 회관 값만큼 → 회관');eq(R({gold:P('hall'),chickens:6,level:3}).line,L.hall,'회관 문장');
 /* 6 둥지에 알이 남음 → 농부 */
 {const s=S({chickens:6,level:3,nest:2,hall:1,power:1});s.gold=C.price(s,'farmer');ok(s.gold<C.price(s,'hall'),'(전제)');eq(K(C.recommend(s,{opened:['power']})),['farmer',6,false],'6 둥지에 알 → 농부');eq(C.recommend(s,{opened:['power']}).line,L.farmer,'알이 남았어요')}
 /* 보너스(회관 목표): 70% 모음 → 조금만 더 / 이 단계에서 충분히 지음 → 모으자. 살 수 없는 key, urgent 아님 */
 {const g=Math.ceil(P('hall')*C.REC.hallSoon);ok(g<P('hall'),'(전제)');eq(K(R({gold:g,chickens:6,level:3})),['hall',0,false],'보너스: 회관 값의 70% → 조금만 더');eq(R({gold:g,chickens:6,level:3}).line,L.hallSoon,'조금만 더 모으면');
  const s=S({fence:C.REC.hallGoal[0],chickens:2,gold:0});eq(K(C.recommend(s,{})),['hall',0,false],'이 단계에서 충분히 지었으면 회관을 위해 모으자');eq(C.recommend(s,{}).line,L.hallSave,'모으자 문장');
  s.gold=C.price(s,'repair');s.broken=1;eq(K(C.recommend(s,{})),['repair',1,true],'모으는 중에도 고치기 먼저');s.broken=0;eq(K(C.recommend(S({hall:3,fence:18,gold:0,chickens:6,level:3}),{})),null,'회관을 다 키우면 모으자는 말 없음')}
 /* 7 닭 < 6 또는 닭 < 타워 × 2 */
 {const s=S({chickens:3});s.gold=C.price(s,'chicken');eq(K(C.recommend(s,{})),['chicken',7,false],'7 닭 < 6 → 닭');eq(C.recommend(s,{}).line,L.moreHens,'닭이 많으면 … 골드를 빨리')}
 {const s=S({chickens:7,level:4,hall:1,power:1});s.gold=C.price(s,'chicken');ok(C.built(s)<C.REC.hallGoal[1]&&s.gold<C.REC.hallSoon*C.price(s,'hall'),'(전제)');eq(K(C.recommend(s,{opened:['power']})),['chicken',7,false],'닭 < 타워 × 2 → 닭')}
 /* 8 덜 산 쪽: 지켜요(타워·강화·울타리) / 벌어요(닭·농부·연못)에서 살 수 있는 가장 싼 것 */
 {const s=S({chickens:8,level:3,gold:60});eq(K(C.recommend(s,{})),['fence',8,false],'8 지켜요가 덜 삼 → 가장 싼 울타리');
  const s2=S({chickens:8,farmers:1,level:3,fence:8,gold:1e3,hall:1,power:1});s2.gold=Math.min(C.price(s2,'chicken'),C.REC.hallSoon*C.price(s2,'hall')-1);ok(C.built(s2)<C.REC.hallGoal[1],'(전제)');eq(K(C.recommend(s2,{opened:['power']})),['chicken',8,false],'벌어요가 덜 삼 → 닭');
  const s3=S({chickens:20,farmers:9,level:19,power:10,fence:18,pond:3,hall:3,gold:200});eq(K(C.recommend(s3,{opened:['feast']})),['feast',8,false],'다 지으면 잔치')}
 eq(R({gold:0}),null,'살 것이 없으면 null');
 /* 잔소리 막기(순수 함수 몫) 무작위 3000: 늘 같은 답, 상태·ctx를 바꾸지 않음, 살 수 있는 상품만(보너스만 예외), 급함은 1·2번만, 문장은 짧고 표에 있음 */
 {let seed=5;const r=()=>{seed=(Math.imul(seed,1103515245)+12345)>>>0;return seed/4294967296},ri=n=>Math.floor(r()*n),lines=new Set(Object.values(L)),bad={};
  for(let i=0;i<3000;i++){
   const s=S({gold:ri(r()<.3?3000:400),level:ri(20),power:ri(11),fence:ri(19),chickens:ri(21),farmers:ri(10),pond:ri(4),hall:ri(4),feast:ri(4),broken:r()<.2?1+ri(3):0,nest:ri(12)}),
    c={wolvesInside:ri(30),towers:r()<.5?undefined:1+ri(20),lostHenRecently:r()<.2,brokenKinds:r()<.3?['coop','market','tower','barn'].filter(()=>r()<.5):[],opened:['power','pond','feast'].filter(()=>r()<.5)};
   const s0=JSON.stringify(s),c0=JSON.stringify(c),x=C.recommend(s,c),y=C.recommend(s,c),cell=x&&C.shop(s).find(e=>e.key===x.key);
   if(JSON.stringify(x)!==JSON.stringify(y))bad.same=i;if(JSON.stringify(s)!==s0||JSON.stringify(c)!==c0)bad.pure=i;
   if(!x){if(C.shop(s).some(e=>e.state==='buy'&&e.key!=='farmer'))bad.nullWithBuy=i;continue}
   if(!lines.has(x.line)||x.line.length>40)bad.line=x.line;
   if(x.rule===0){if(x.key!=='hall'||x.urgent||C.canBuy(s,'hall'))bad.bonus=i}else if(!C.canBuy(s,x.key)||!cell||cell.state!=='buy')bad.unbuyable=x.key;
   if(x.urgent!==(x.rule===1||x.rule===2))bad.urgent=i;const henFirst=(s.chickens|0)<=1&&C.canBuy(s,'chicken')&&!c.brokenKinds.includes('coop')&&!c.brokenKinds.includes('market');
   if(C.canBuy(s,'repair')&&(henFirst?x.rule===1:x.rule!==1))bad.repairFirst=i;if(x.rule===1&&x.key!=='repair')bad.rule1=i}
  eq(bad,{},'추천 무작위 3000: 결정적·순수·살 수 있는 것만·급함 규칙')}}

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
 const pw=W.create({seed:1,interval:300});ok(W.packSize(pw,S0({level:19,power:10,fence:18,chickens:20,farmers:9,pond:3,hall:3}))>W.packSize(pw,S0())*10,'큰 마을에는 큰 무리');
 ok(W.packSize(pw,S0({level:19,power:10,fence:18,chickens:20,farmers:9,pond:3,hall:3}))<=W.PACK.max,'무리 상한');
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
 const m1=W.restore(v1,{interval:130});eq([m1.v,m1.wolves[0].kind,m1.interval,m1.wave.arrive,m1.stats.kills,m1.buildings[0].stun,m1.buildings[0].floor],[2,'wolf',130,630,2,0,1],'0.7 세계 저장 이행: 늑대 종류·새 무리 간격(다음 무리를 당김)');
 /* ---- 0.9: 타워 자리 20(회관 단계마다 고리)·층, 닭 20, 울타리 3겹, 나이 손잡이, 경제 도우미, 0.8 세계 이행 ---- */
 const SIZE={coop:1.4,market:1.6,nursery:1,barn:1.6},d2=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
 {const slots=[0,1,2,3].map(h=>W.towerSlots(h)),all=slots[3];eq(slots.map(a=>a.length),[6,10,14,20],'타워 자리 6 / 10 / 14 / 20');
  eq(slots[0],W.TOWER_SLOTS,'0단계 자리는 0.8 그대로');for(let h=1;h<4;h++)eq(slots[h].slice(0,slots[h-1].length),slots[h-1],h+'단계는 앞 자리를 두고 바깥 고리를 더함');
  for(let h=0;h<4;h++)slots[h].forEach((p,i)=>ok(Math.hypot(p[0],p[1])<=W.RADIUS[h]-(i<6?.6:1.4),h+'단계 자리 ('+p+')는 그 마을 울타리 안쪽(바깥 고리는 1.4 이상)'));
  /* 늑대는 출현 방향(22.5° + 45°k)에서 ±0.25rad(14.3°) 안으로 나와 곧장 가운데로 걷는다 → 그 밖이면 늑대 길 위가 아님 */
  for(let i=6;i<20;i++){let a=Math.atan2(all[i][1],all[i][0])*180/Math.PI;if(a<0)a+=360;let off=360;for(let p=0;p<W.SPAWNS;p++){const d=Math.abs(a-(p+.5)*360/W.SPAWNS)%360;off=Math.min(off,d,360-d)}ok(off>=14.5,'바깥 고리 자리 '+i+'는 늑대 출현 퍼짐(±14.3°) 밖 '+off.toFixed(1)+'°')}
  /* 3D 흙길(대각선, r 2.6~14, 반폭 0.58)과 1.2 이상(src/props.js villageProps) */
  for(let i=6;i<20;i++)for(const d of [45,135,225,315]){const c=Math.cos(d*Math.PI/180),sn=Math.sin(d*Math.PI/180),[x,z]=all[i],t=Math.max(2.6,Math.min(14,x*c+z*sn));ok(Math.hypot(x-t*c,z-t*sn)-.58>=1.2,'바깥 고리 자리 '+i+'는 '+d+'° 흙길과 1.2 이상')}
  let md=99;for(let i=0;i<20;i++)for(let j=i+1;j<20;j++)md=Math.min(md,d2(all[i],all[j]));ok(md>=1.2,'타워 자리끼리 1.2 이상 ('+md.toFixed(2)+')');
  for(const p of all){for(const k in W.PLACE)ok(d2(p,W.PLACE[k])>=SIZE[k]+.5,'타워 자리 ('+p+')가 '+k+'와 겹치지 않음');for(const h of W.HOMES)ok(d2(p,h)>=.9,'타워 자리가 닭 자리와 겹치지 않음')}
  /* 층: 자리가 다 차면 가장 낮은 타워부터 한 층, 회관이 커져도 층은 그대로, 새 자리는 다음 타워부터 */
  const fl=w=>w.buildings.filter(b=>b.kind==='tower').sort((a,b)=>a.slot-b.slot).map(b=>b.floor);
  let s=S0({level:9}),w=W.sync(W.create({seed:1,interval:300}),s);eq(fl(w),[2,2,2,2,1,1],'타워 10 = 자리 6 + 낮은 것부터 4층');eq(W.towerUnits(w),10,'층 포함 타워 수 = 1 + level');
  s.hall=1;W.sync(w,s);eq(fl(w),[2,2,2,2,1,1],'회관이 커져도 층은 내려가지 않음');s.level=12;W.sync(w,s);eq(fl(w),[2,2,2,2,1,1,1,1,1],'새 자리부터 채움');
  for(const b of w.buildings)if(b.kind==='tower')ok(Math.hypot(b.x,b.z)<W.radius(w)-1,'타워는 마을 안');
  const t2=w.buildings.find(b=>b.kind==='tower'&&b.floor===2);eq(W.towerDamage(s,t2),W.damage(s)+W.FLOOR.damage,'2층 타워 피해 +2');ok(Math.abs(W.towerRange(s,t2)-W.range(s)-W.FLOOR.range)<1e-9,'2층 타워 사거리 +0.3');
  w.trickle=1e9;w.wave.arrive=1e9;for(const b of w.buildings)if(b.kind==='tower'&&b!==t2)b.broken=true;w.wolves.push({id:w.nextId++,kind:'wolf',x:t2.x+W.range(s)+.1,z:t2.z,sx:20,sz:0,hp:999,max:999,speed:0,state:'walk',target:0,timer:0,inside:0,hen:0});
  let shot=null;for(let i=0;i<20&&!shot;i++){W.step(w,s);shot=w.arrows.find(a=>a.tower===t2.id)}ok(shot&&shot.damage===W.towerDamage(s,t2),'2층 타워는 1층 사거리 밖도 쏘고 피해가 큼');
  s=S0({level:5});w=W.sync(W.create({seed:3,interval:300}),s);w.buildings.find(b=>b.kind==='tower'&&b.slot===0).broken=true;s.level=6;W.sync(w,s);eq(fl(w),[1,2,1,1,1,1],'층은 서 있는 타워부터(부서진 타워는 건너뜀)');
  s=S0({hall:3,level:19});w=W.sync(W.create({seed:2,interval:300}),s);eq(fl(w),Array(20).fill(1),'회관 3단계 타워 20개');s.level=40;W.sync(w,s);eq(W.towerUnits(w),W.TOWER_UNITS,'타워는 20까지');
  s.level=2;W.sync(w,s);eq(W.towerUnits(w),3,'경제보다 많으면(망가진 저장) 줄여 맞춤');}
 {eq(W.HOMES.length,20,'닭 자리 20');eq(W.HOMES.slice(0,8).map(p=>p.map(v=>Math.round(v*10)/10)),Array.from({length:8},(_,i)=>[Math.round((-1.8+(i%4)*1.2)*10)/10,Math.round((-.4+Math.floor(i/4)*1.1)*10)/10]),'앞 8자리는 0.8 그대로');
  let md=99;for(let i=0;i<20;i++)for(let j=i+1;j<20;j++)md=Math.min(md,d2(W.HOMES[i],W.HOMES[j]));ok(md>=1-1e-9,'닭 자리끼리 1 이상('+md.toFixed(2)+')');
  for(const h of W.HOMES){ok(Math.hypot(h[0],h[1])<=W.RADIUS[0]-1.4,'닭 자리 ('+h+')는 0단계 마을 안');for(const k in W.PLACE)ok(d2(h,W.PLACE[k])>=SIZE[k]+.9,'닭 자리 ('+h+')가 '+k+'와 떨어짐')}
  for(let i=8;i<20;i++)for(const p of W.towerSlots(3))ok(d2(W.HOMES[i],p)>=1.2,'새 닭 자리 '+i+'는 타워 자리와 1.2 이상');
  const s=S0({chickens:20}),w=W.sync(W.create({seed:4,interval:300}),s);eq([w.hens.length,new Set(w.hens.map(h=>h.slot)).size],[20,20],'닭 20마리 · 자리 겹침 없음');s.chickens=25;W.sync(w,s);eq(w.hens.length,20,'세계 닭은 20까지')}
 {eq([0,1,6,7,12,13,18,25].map(n=>W.fenceLayers(n).join('')),['000000','100000','111111','211111','222222','322222','333333','333333'],'울타리 겹: 빈 면 먼저, 다 막으면 앞에서부터 덧댐(최대 3겹)');
  const F=w=>w.buildings.filter(b=>b.kind==='fence').sort((a,b)=>a.side-b.side);let s=S0({fence:8}),w=W.sync(W.create({seed:5,interval:3000}),s);
  eq(F(w).map(b=>[b.layer,b.max,b.hp]),[[2,140,140],[2,140,140],[1,70,70],[1,70,70],[1,70,70],[1,70,70]],'겹마다 체력 '+W.FENCE_HP.join('/'));
  const f2=F(w)[2];f2.hp=30;s.fence=9;W.sync(w,s);eq([f2.layer,f2.max,f2.hp],[2,140,100],'덧대면 늘어난 만큼 체력도 늘어남');
  const f3=F(w)[3];f3.broken=true;f3.hp=0;s.fence=10;W.sync(w,s);eq([f3.layer,f3.broken,f3.hp],[2,false,140],'부서진 면에 덧대면 바로 새로 섬');
  s.fence=18;W.sync(w,s);eq(F(w).map(b=>b.layer+':'+b.max),Array(6).fill('3:220'),'3겹 돌담 220');
  w.trickle=1e9;w.wave.arrive=1e9;const f0=F(w)[0];f0.broken=true;f0.hp=0;f0.rebuild=W.REBUILD;let reb=false;for(let i=0;i<=W.REBUILD&&!reb;i++)reb=W.step(w,s).some(e=>e.type==='rebuilt');
  eq([reb,f0.layer,f0.hp],[true,3,Math.round(W.FENCE_HP[2]/2)],'저절로 다시 서면 겹은 그대로, 체력은 그 겹의 절반')}
 {eq(Object.keys(W.AGE).map(Number),[7,8,9,10],'나이 손잡이 7~10세');for(const a in W.AGE)ok(['speed','hp','pack'].every(k=>W.AGE[a][k]>.5&&W.AGE[a][k]<1.5),a+'세 손잡이 범위');
  const spawn=age=>{const s=S0({age,level:6,fence:3,chickens:6}),w=W.sync(W.create({seed:9,interval:3000}),s);for(let i=0;i<6;i++)W.step(w,s);return {v:w.wolves[0],p:W.packSize(Object.assign(w,{wave:{n:30,arrive:1e9,spawned:true}}),s)}};
  const a7=spawn(7),a10=spawn(10),base=W.WOLF.hp+W.WOLF.hpPerBuilt*W.threat(S0({level:6,fence:3,chickens:6}));
  ok(Math.abs(a7.v.speed/a10.v.speed-W.AGE[7].speed/W.AGE[10].speed)<1e-9,'늑대 속도 × 나이 손잡이');eq([a7.v.max,a10.v.max],[Math.round(Math.min(W.WOLF.hpMax,base)*W.AGE[7].hp),Math.round(Math.min(W.WOLF.hpMax,base)*W.AGE[10].hp)],'늑대 체력 × 나이 손잡이');
  ok(W.AGE[7].pack<=W.AGE[10].pack?a7.p<=a10.p:a7.p>=a10.p,'무리 크기 × 나이 손잡이 '+a7.p+'/'+a10.p);eq(W.ageOf({age:99}),{speed:1,hp:1,pack:1},'모르는 나이는 1')}
 {const s=S0(),w=W.sync(W.create({seed:6,interval:3000}),s);eq([W.marketDown(w),W.brokenKinds(w),W.wolvesInside(w)],[0,[],0],'처음: 매대 멀쩡 · 부서진 곳 없음 · 마을 안 늑대 없음');
  w.buildings.find(b=>b.kind==='market').broken=true;w.buildings.find(b=>b.kind==='coop').broken=true;w.buildings.find(b=>b.kind==='tower').broken=true;
  eq([W.marketDown(w),W.brokenKinds(w).sort(),W.brokenCount(w)],[1,['coop','market','tower'],3],'매대 부서짐 → 반값, 부서진 종류');
  w.wolves.push({id:990,kind:'wolf',x:1,z:1,sx:20,sz:0,hp:9,max:9,speed:1,state:'hunt',target:0,timer:0,inside:0,hen:0},{id:991,kind:'wolf',x:30,z:0,sx:30,sz:0,hp:9,max:9,speed:1,state:'walk',target:0,timer:0,inside:0,hen:0});eq(W.wolvesInside(w),1,'마을 안 늑대 = 사냥·물기·안쪽 부수기')}
 /* 0.8 세계 저장(v2, 층·겹 없음) 이행 */
 {const v08={v:2,t:400,rng:5,hall:1,interval:150,wave:{n:2,arrive:450,spawned:false},trickle:410,seen:{wolf:true},mercy:0,mercyT:100,wolves:[],hens:[{id:2,slot:0,x:-1.8,z:-.4,state:'yard',calm:0}],
   buildings:[{id:1,kind:'tower',slot:0,x:1.2,z:1.4,hp:90,max:90,broken:false,cd:0,stun:0},{id:3,kind:'fence',side:0,x:8.66,z:5,hp:50,max:70,broken:false}],arrows:[],nextId:4,stats:{kills:1,henLost:0,henSaved:0,broken:0,fenceBroken:0,waves:2,bosses:0,bossKills:0,splash:0},events:[]};
  const m8=W.restore(v08);eq([m8.buildings[0].floor,m8.buildings[1].layer,m8.buildings[1].max,m8.buildings[1].hp,m8.t],[1,1,70,50,400],'0.8 세계 저장 이행: 타워 1층 · 울타리 1겹(체력 그대로)');
  const s=S0({level:2,fence:7,hall:1,chickens:1});W.sync(m8,s);eq([W.towerUnits(m8),m8.buildings.find(b=>b.id===3).layer,m8.buildings.find(b=>b.id===3).hp],[3,2,120],'이어서 0.9 규칙으로 맞춤')}
}
/* 1-8 유인 구조(세계 포함): 같은 벽시계 10분 동안 제 나이 보통 속도로 읽는 아이가 찍는 아이보다 마을을 2배 넘게 키운다(game-plan §4.4).
   0.9 방식: 카드 멈춤 없이 세계가 계속 흐르고, 아이는 꼬꼬 추천(Combat.recommend)을 따라 산다(scripts/sim-village.cjs와 같은 모형, 가정값). */
{let seed=7;const rnd=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648};
 const RATE={7:120/2,8:120,9:180,10:230};
 const need=(q,r)=>{const rps=r/60,n=q.choices.length,cc=q.choices.reduce((s,c)=>s+C.units(c),0),p=C.syl(q.passage);
  if(q.mode==='quiz')return 1+(C.syl(q.prompt)+C.units(q.passage))/rps+cc/rps+.4*n+((C.THINK[q.cat]||C.THINK.common)[q.age]||2);
  return 1.5+p/rps+(q.age===7?0:C.syl(q.prompt)/rps)+cc/rps+.4*n+(q.age>=9?.3*p/rps:0)};
 const interval=(age,mode)=>{const t=Array.from({length:Q.count(age,mode)},(_,i)=>C.baseSeconds(Q.get(age,mode,i))).sort((a,b)=>a-b);return W.intervalFor(t[t.length>>1])};
 function play(age,mode,kind,minutes){
  const s=C.fresh(age);s.mode=mode;const w=W.sync(W.create({seed:Math.floor(rnd()*1e9),interval:interval(age,mode)}),s),opened=[];let lost=-1e9;
  const go=sec=>{for(let i=0;i<Math.round(sec/W.TICK);i++)for(const e of W.step(w,s)){if(e.type==='henLost'){s.chickens=Math.max(0,s.chickens-1);lost=w.t}else if(e.type==='kill'&&e.boss)s.gold+=C.BOUNTY}};
  const shop=()=>{for(let k=0;k<4;k++){s.broken=W.brokenCount(w);s.marketDown=W.marketDown(w);
   const r=C.recommend(s,{wolvesInside:W.wolvesInside(w),towers:1+s.level,lostHenRecently:w.t-lost<300,brokenKinds:W.brokenKinds(w),opened});if(!r)break;if(r.rule===4)opened.push(r.key);
   if(!C.canBuy(s,r.key))break;C.buy(s,r.key);if(r.key==='repair')W.repairAll(w);W.sync(w,s);go(.8)}};
  while(w.t<minutes*600){
   const q=Q.at(age,mode,s.index),n=q.choices.length,lock=C.reveal(q)/10;
   const t=kind==='guess'?lock+.4:Math.max(lock+.3,need(q,RATE[age])*(.75+rnd()*.5)),ok1=kind==='guess'?rnd()<1/n:rnd()<.85;go(t);
   if(ok1){const fast=C.isFast(q,Math.round(t/W.TICK));s.marketDown=W.marketDown(w);C.settle(s,q,'first',{fast,ticks:Math.round(t/W.TICK)});W.volley(w,s,{scale:C.scale(q),fast});go(1.2);shop()}
   else{go(W.dashTicks(w)*W.TICK);go(kind==='guess'?.4:need(q,RATE[age])*.35);if(kind==='guess'?rnd()<1/(n-1):rnd()<.8)C.settle(s,q,'second');else{s.misses++;s.streak=0}go(C.learnTicks(q)*C.TICK+(kind==='guess'?.4:1));shop()}
   s.index++}
  return C.built(s)}
 const avg=(a,m,k)=>{let t=0;for(let i=0;i<6;i++)t+=play(a,m,k,10);return t/6};
 for(const [a,m] of [[7,'story'],[8,'story'],[9,'story'],[10,'story']]){const typ=avg(a,m,'typ'),g=avg(a,m,'guess');ok(typ>g*2,`${a}세 ${m}: 보통 아이 지은 것 ${typ.toFixed(1)} > 찍기 ${g.toFixed(1)}×2 (10분)`)}
}

/* 1-9 세계 무작위 시험(fuzz)·회귀 검사(world.js). 회관 0~3·타워 0~19(층)·강화 0~10·울타리 0~18(겹, 일부 부서짐)·닭 0~20·나이 7~10에서 온갖 종류·상태의 늑대를 끼워 넣고,
   틱 사이에 일제 사격·고치기·사기(sync)를 무작위로 섞어 수천 틱 돌리며 불변식을 본다. 같은 시드 = 같은 결과, 저장·복원 뒤 이어 돌려도 같은 결과. */
{const S0=o=>Object.assign(C.fresh(8),o||{}),alive=v=>v.state!=='dead'&&v.state!=='gone';
 const mk=seed=>{let r=seed>>>0||1;return ()=>{r=(Math.imul(r,1103515245)+12345)>>>0;return r/4294967296}};
 const KINDS=Object.keys(W.KINDS),STATES=['walk','smash','hunt','bite','carry','leave','dead'],CAP={level:19,fence:18,chickens:20,hall:3,power:10,farmers:9,pond:3};
 const HEN_OK=new Set(['yard','flee','hidden','home','caught','carried']),WOLF_OK=new Set(STATES);
 const badNum=(o,p)=>{if(typeof o==='number')return Number.isFinite(o)?null:p;if(o&&typeof o==='object')for(const k in o){const b=badNum(o[k],p+'.'+k);if(b)return b}return null};
 const onSide=(w,v,side)=>Math.abs(Math.hypot(v.x,v.z)-W.radius(w))<W.SIDE_REACH&&W.sectorOf(v.x,v.z)===side;
 /* 판 하나: 무작위 경제 상태와 세계. 입력 난수(rs)는 세계와 따로 둔다(저장·복원 비교 때 같은 입력을 주려고) */
 const game=seed=>{const rnd=mk(seed),ri=n=>Math.floor(rnd()*n);
  const s=S0({hall:ri(4),level:ri(20),power:ri(11),fence:ri(19),chickens:ri(21),farmers:ri(10),pond:ri(4),age:7+ri(4)}),w=W.sync(W.create({seed:1+ri(1e9),interval:130+ri(71)}),s);
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
   if(new Set(w.hens.map(h=>h.slot)).size!==w.hens.length||w.hens.some(h=>!(h.slot>=0&&h.slot<W.HENS_MAX)))flag('닭 자리',w.hens.map(h=>h.slot).join());
   /* 0.9 타워·울타리: 층의 합 = 1 + level(20까지), 자리는 그 단계 안·겹치지 않음, 울타리 겹 = fenceLayers, 체력 상한 = 그 겹 */
   {const tw=w.buildings.filter(b=>b.kind==='tower'),n=W.towerSlots(w.hall).length;if(W.towerUnits(w)!==Math.min(W.TOWER_UNITS,1+s.level))flag('타워 수',W.towerUnits(w)+' vs '+s.level);
    if(new Set(tw.map(b=>b.slot)).size!==tw.length||tw.some(b=>!(b.slot<n)||!Number.isInteger(b.floor)||b.floor<1))flag('타워 자리·층',tw.map(b=>b.slot+':'+b.floor).join());
    const L=W.fenceLayers(s.fence);for(const b of w.buildings)if(b.kind==='fence'&&(b.layer!==L[b.side]||b.max!==W.FENCE_HP[b.layer-1]||b.hp>b.max))flag('울타리 겹',b.side+':'+b.layer+'/'+L[b.side]+' '+b.hp+'/'+b.max)}
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
   hens:[1,{id:5,x:0,z:0,state:'caught',slot:99}],buildings:[{id:6,kind:'fence',side:0,x:0,z:0,hp:9,max:70,broken:false},{id:7,kind:'fence',side:0,x:0,z:0,hp:9,max:70},{id:8,kind:'tower',slot:29,x:0,z:0,hp:1,max:90},{id:9,kind:'tower',slot:0,x:1.2,z:1.4,hp:NaN,max:90,broken:false,cd:-3,stun:1e9,floor:-2}]};
  const w=W.restore(raw),s=S0({level:1,fence:1,chickens:1});
  eq([w.hall,w.interval,w.wave.n,w.wave.arrive>w.t,w.mercy,w.wolves.map(v=>v.id),w.wolves[0].state,w.wolves[0].speed>0,w.hens.length,w.buildings.map(b=>b.id),w.buildings[1].stun,w.nextId>9],[3,80,0,true,5,[4],'walk',true,1,[6,9],0,true],'망가진 저장 정리');
  W.sync(w,s);eq(w.buildings.filter(b=>b.kind==='tower').map(b=>b.slot).sort(),[0,1],'타워 자리 겹치지 않음');eq(w.hens.length,1,'닭 수 맞춤');
  for(let i=0;i<300;i++)W.step(w,s);ok(w.stats.waves<=4&&!badNum(w,'w'),'무리 폭주·NaN 없음 (무리 '+w.stats.waves+')');
  const e=quiet(S0(),49);const k=wolf(e,{kind:'ember',x:3,z:0,speed:0,hp:999,max:999});W.step(e,S0());ok(Number.isFinite(k.roar),'포효 시계 없는 불씨 왕도 시계가 생김')}

 /* 성능: 회관 3·강화 10·타워 20·닭 20·늑대 90마리·화살 수백 발에서 step 평균(데스크톱 Node 기준. 휴대폰은 5~10배 느리고, 틀린 직후엔 0.1초에 최대 5틱) */
 {const s=S0({hall:3,level:19,power:10,fence:18,chickens:20,farmers:9,pond:3}),w=W.sync(W.create({seed:12345,interval:150}),s),rnd=mk(99);let tot=0n,n=0,arrows=0;
  const fill=()=>{while(w.wolves.length<W.MAX_WOLVES){const a=rnd()*Math.PI*2,d=2+rnd()*20,k=KINDS[Math.floor(rnd()*KINDS.length)];
   w.wolves.push({id:w.nextId++,kind:k,x:Math.cos(a)*d,z:Math.sin(a)*d,sx:Math.cos(a)*24,sz:Math.sin(a)*24,hp:1e6,max:60,speed:.6+rnd(),state:['walk','hunt','smash'][Math.floor(rnd()*3)],target:0,timer:0,inside:0,hen:0,...(k==='ember'?{roar:40}:{})})}};
  for(let i=0;i<3000;i++){fill();if(i%10===0)W.volley(w,s,{scale:5,fast:true});if(i%20===0)W.repairAll(w);const t0=process.hrtime.bigint();W.step(w,s);if(i>=500){tot+=process.hrtime.bigint()-t0;n++;arrows+=w.arrows.length}}
  const us=Number(tot)/n/1000;console.log('  세계 step 평균 '+us.toFixed(1)+'µs (늑대 90·회관 3·강화 10·타워 '+W.towerUnits(w)+'·닭 '+w.hens.length+'·화살 평균 '+Math.round(arrows/n)+'발)');ok(us<1500,'step 평균 1.5ms 미만')}
}

/* ======================= 2. 가짜 DOM 위의 실제 게임 ======================= */
let saved={};
/* opts: view(3D 연출 받기) · reduced(움직임 줄이기) · rec(추천: 없으면 끔, 'real'이면 규칙 그대로, 함수면 그 함수) */
let spoken=0;
function boot(opts={}){
 const nodes={},intervals=[],docHandlers={},winHandlers={};
 class E{
  constructor(tag){this.tagName=tag||'div';this.style={setProperty(k,v){this[k]=v}};this.dataset={};this.children=[];this.disabled=false;this.checked=false;this.hidden=false;this._t='';this.value='';this.offsetWidth=40;this.clientWidth=390;this.clientHeight=260;this.attrs={};const set=this._c=new Set();
   this.classList={add:(...n)=>n.forEach(x=>set.add(x)),remove:(...n)=>n.forEach(x=>set.delete(x)),contains:n=>set.has(n),toggle:(n,f)=>{const on=f===undefined?!set.has(n):!!f;on?set.add(n):set.delete(n);return on}}}
  get className(){return [...this._c].join(' ')}set className(v){this._c.clear();String(v).split(/\s+/).filter(Boolean).forEach(x=>this._c.add(x))}
  get textContent(){return this.children.length?this._t+this.children.map(c=>c.textContent).join(''):this._t}set textContent(v){this._t=String(v);this.children=[]}
  set innerHTML(v){this.children=[];this._t='';this._html=String(v)}get innerHTML(){return this._html||''}append(...ns){for(const n of ns){if(typeof n==='string'){const t=new E('#text');t._t=n;this.children.push(t)}else{n.parentNode=this;this.children.push(n)}}}
  setAttribute(k,v){this.attrs[k]=String(v)}getAttribute(k){return k in this.attrs?this.attrs[k]:null}remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(x=>x!==this)}
  click(){if(!this.disabled&&this.onclick)this.onclick()}getBoundingClientRect(){return {left:0,top:0,width:0,height:0}}scrollIntoView(){}
 }
 const document={body:new E('body'),hidden:false,getElementById:id=>nodes[id]??=new E(),createElement:t=>new E(t),addEventListener:(k,f)=>{(docHandlers[k]??=[]).push(f)}};
 if(opts.reduced)document.body.classList.add('reduced');
 const window={addEventListener:(k,f)=>{(winHandlers[k]??=[]).push(f)}};
 const events=[],built=[];
 if(opts.view)window.VillageView={build:k=>{built.push(k);return {x:.4,y:.5}},reward(){},events:l=>events.push(...l),inspect(){return {ready:true}}};
 /* 0.11: 게임은 음성 합성을 쓰지 않는다. 브라우저에 있더라도 한 번도 부르지 않는지 센다(맨 끝에서 0 확인) */
 window.speechSynthesis={speak(){spoken++},cancel(){spoken++},getVoices(){spoken++;return []}};
 const localStorage={getItem:k=>k in saved?saved[k]:null,setItem:(k,v)=>{saved[k]=v}};
 /* 추천 규칙은 기본으로 끈다(말풍선이 문제 흐름 시간을 바꾸지 않게). 말풍선 검사만 규칙이나 가짜 규칙을 켠다. */
 const Cx=opts.rec==='real'?C:{...C,recommend:typeof opts.rec==='function'?opts.rec:()=>null};
 const api=new Function('document','window','localStorage','setInterval','setTimeout','confirm','Combat','World','Questions','performance',
  src+'\nreturn {get state(){return state},get phase(){return phase},get round(){return round},get paused(){return paused},get world(){return world},get uiT(){return uiT},render};')
  (document,window,localStorage,f=>{intervals.push(f);return intervals.length},()=>0,()=>true,Cx,W,Q,undefined);
 const n=new Proxy(nodes,{get:(t,k)=>typeof k==='string'?(t[k]??=new E()):t[k]}),kids=()=>n.answers.children;
 const h={n,api,events,built,intervals,document,window,
  tick(c=1){for(let i=0;i<c;i++)intervals[0]()},
  go(){n.go.click()},
  btn:i=>kids().find(b=>Number(b.dataset.i)===i),
  /* 0.10: 첫 시도는 글을 읽을 만한 시간(번개를 받을 수 있는 때 = 찍기 막기 기준)까지 기다렸다 누른다. 즉시 누르기는 rightNow */
  /* 보기가 열리고 번개를 받을 수 있는 때까지 기다림(누르지는 않음) */
  ready(){h.unlock();const r=api.round,k=fastAt(r.q)-r.t;if(k>0)h.tick(k)},
  right(){const r=api.round;if(r&&api.phase==='ask'&&r.tries===0&&r.lock<=0&&r.dash<=0){const k=fastAt(r.q)-r.t;if(k>0)h.tick(k)}h.btn(api.round.q.answer).click()},
  rightNow(){h.btn(api.round.q.answer).click()},
  wrongIndex(k=0){return api.round.q.choices.map((_,i)=>i).filter(i=>i!==api.round.q.answer)[k]},
  wrong(k=0){h.btn(h.wrongIndex(k)).click()},
  slots:()=>n.shop.children,
  slot:k=>n.shop.children.find(b=>b.dataset.key===k),
  buy(k){h.slot(k).click()},
  row:k=>h.game().shop.find(r=>r.key===k),
  untilAsk(){for(let i=0;i<200&&api.phase!=='ask';i++)h.tick()},
  unlock(){for(let i=0;i<600&&api.round.lock>0;i++)h.tick()},
  land(){for(let i=0;i<120&&h.game().gold.pending>0;i++)h.tick()},
  hide(v){document.hidden=v;(docHandlers.visibilitychange||[]).forEach(f=>f())},
  unload(){(winHandlers.beforeunload||[]).forEach(f=>f())},
  bubble:()=>n.bubble.classList.contains('hidden')||!n.bubbleText.textContent?null:n.bubbleText.textContent,/* 가짜 DOM은 HTML의 hidden 클래스를 모르므로 글이 있을 때만 */
  fx:c=>n.effects.children.filter(x=>x.classList.contains(c)),
  game:()=>window.__game()};
 return h;
}
const fresh=o=>{saved={};return boot(o)};
const seed=(s,o)=>{saved={[KEY]:JSON.stringify({version:1,...C.fresh(8),...s})};return boot(o)};
const REWARD=12,LAND=24;/* 한 번에 맞힌 뒤: 1.2초 뒤 다음 문제, 2.4초 안에 동전이 다 닿음 */
/* 화면에 나온 문제 = 그 나이의 index번째 문제(상식·수학·영어가 섞인 순서, Questions.at) */
/* 그 나이 읽기 문항 기준 무리 간격(index.html waveInterval과 같은 식) */
const ivFor=age=>{const t=[];for(let i=0;i<Q.count(age,'story');i++)t.push(C.baseSeconds(Q.get(age,'story',i)));t.sort((x,y)=>x-y);return W.intervalFor(t[t.length>>1])};
/* 7세 상식·수학·영어 칸에서 시작하는 저장(예전에는 질문을 읽어 주던 문제) */
const SEED7=777,I7=Array.from({length:60},(_,k)=>k).find(k=>Q.at(7,'story',k,SEED7).mode==='quiz'),L7={age:7,index:I7,seed:SEED7};
const fastAt=q=>Math.ceil(C.FAST_MIN*C.needSeconds(q)/C.TICK);/* 번개를 받을 수 있는 가장 이른 틱 */
const live=w=>w.wolves.filter(v=>v.state!=='dead'&&v.state!=='gone').length;
function shows(a,age,mode,index,msg){
 const q=Q.at(age,mode,index,a.api.state.seed),list=a.n.answers;/* 0.10: 그 판의 문제 순서 씨앗 */
 eq([list.dataset.qid,list.dataset.age,list.dataset.mode],[q.id,String(age),q.mode],msg+' 문항 '+q.id);
 eq(a.n.prompt.textContent,q.prompt,msg+' 질문');eq(a.n.passage.textContent,q.passage||'',msg+' 지문');
 eq([...list.children].map(b=>b._t).sort(),q.choices.slice().sort(),msg+' 보기');
 ok(a.n.levelChip.textContent.startsWith(age+'세 · '),msg+' 단계 표시');
}
/* 늑대가 닭 한 마리를 물고 숲 가장자리에 막 닿는 장면(다음 틱에 닭을 잃음) */
function loseHen(a){const w=a.api.world,hen=w.hens.find(h=>h.state!=='carried'&&h.state!=='gone');hen.state='carried';
 w.wolves.push({id:9e4+w.t,kind:'wolf',x:0,z:-16.9,sx:0,sz:-17,hp:20,max:20,speed:.8,state:'carry',target:0,timer:0,inside:0,hen:hen.id})}
/* 늑대가 더 오지 않게(말풍선 빈도 검사가 진짜 늑대 사건에 흔들리지 않게) */
function calmWorld(a){const w=a.api.world;w.wolves=[];w.arrows=[];w.trickle=1e9;w.wave.arrive=1e9;w.wave.spawned=true}
/* 건물 하나를 다음 틱에 부서지게(늑대가 붙어 부수는 중, 체력 거의 0) */
function breakNext(a,kind){const w=a.api.world,b=w.buildings.find(x=>x.kind===kind&&!x.broken);b.hp=.01;
 w.wolves.push({id:8e4+w.t,kind:'wolf',x:b.x+1,z:b.z,sx:30,sz:0,hp:9999,max:9999,speed:0,state:'smash',target:b.id,timer:0,inside:0,hen:0});return b}

/* 2-1 시작 화면과 시계. 0.9: 시간 바·카드·금화 모으기 버튼 없음 */
let a=fresh();
eq(a.intervals.length,1,'시계 인터벌은 1개');eq(a.api.phase,'start','처음엔 시작 화면');ok(!a.n.start.hidden,'시작 화면 보임');
eq(a.n.ageRow.children.map(b=>b.textContent),['7살','8살','9살','10살'],'시작 화면 나이 4칸');
a.tick(30);eq(a.api.round,null,'시작 화면에서는 문제 없음');eq(a.api.world.t,0,'시작 화면에서는 늑대 세계도 멈춤');
for(const id of ['battle','next','shield','combatInfo','buildPrompt','buyChicken','buyFence','timebar','timeFill','wolfHead','timeTag','choices','cards','skip','gainLine','gainParts'])ok(!html.includes('id="'+id+'"'),'없앤 요소: '+id);
ok(!html.includes('소리 도움말'),'정답을 글자로 보여 주던 소리 도움말 제거');ok(!src.includes('다음 무리')&&!src.includes('barLeft')&&!src.includes('secondsLeft'),'늑대 시간 표시(초·막대) 코드 없음');
ok(!src.includes('enterPick')&&!src.includes('picks')&&!src.includes('offers('),'카드 고르기 단계 코드 없음');
ok(html.includes('src="combat.js?v=0.11"')&&html.includes('src="world.js?v=0.11"')&&html.includes('src="questions.js?v=0.11"')&&html.includes('src="village.js?v=0.11"')&&!html.includes('?v=0.10'),'캐시 갱신용 ?v=0.11');
ok(html.indexOf('src="questions-gen.js?v=0.11"')>0&&html.indexOf('src="questions-gen.js?v=0.11"')<html.indexOf('src="questions.js?v=0.11"'),'생성 문항 파일을 questions.js보다 먼저 불러옴');
/* 0.11: 듣고 고르기 모드 폐쇄. 시작 화면·설정에 모드 고르기가 없고, 스크립트에 소리 모드 분기가 없다 */
for(const id of ['startSound','startStory','mode'])ok(!html.includes('id="'+id+'"'),'없앤 모드 버튼: '+id);
ok(!html.includes('mode-row')&&!html.replace(/<script>[\s\S]*?<\/script>/,'').includes('듣고 고르기'),'화면에 모드 고르기·듣고 고르기 문구 없음');
ok(!src.includes("'sound'")&&!src.includes('startSound')&&!src.includes("$('mode')")&&!src.includes('round.reading'),'스크립트에 소리 모드 분기 없음');
a.go();ok(a.n.start.hidden,'시작하면 시작 화면 닫힘');eq([a.api.phase,a.api.state.mode],['ask','story'],'언제나 읽고 고르기: 바로 풀이');eq(a.n.drawerSummary.textContent,'⚙️ 설정 · 8세','설정 요약에 모드 없음');
shows(a,8,'story',0,'시작');
eq(a.api.world.interval,ivFor(8),'무리 간격 = 8세 읽기 문항 기준 시간');
let w0=a.api.world.t;a.tick(10);eq(a.api.round.t,10,'풀이 시간 10틱');eq(a.api.world.t,w0+10,'늑대 세계도 10틱');
ok(a.window.getVillageState().world===a.api.world,'3D 마을이 같은 늑대 세계를 읽음');eq(a.window.getVillageState().radius,7,'처음 마을 반지름 7');
eq(a.api.world.buildings.filter(b=>b.kind==='tower').length,1,'처음 화살 타워 1개');
/* 🐺 알약은 틱마다 세계를 따라간다(0.8 실사이트: render 때만 바뀌어 늑대 43마리인데 🐺0). 화면 문구에는 초 숫자가 없다. */
{let miss=0,seen=new Set(),secs=0;for(let i=0;i<500;i++){a.tick(1);const n=live(a.api.world);seen.add(n);if(!a.n.level.textContent.endsWith('🐺'+n))miss++;if(/\d+ *초/.test(a.n.villageStatus.textContent))secs++}
 eq(miss,0,'🐺 알약 = 지금 늑대 수(틱마다)');ok(seen.size>=3,'늑대 수가 바뀌는 동안 확인: '+[...seen]);eq(secs,0,'상태 문구에 초 표시 없음');eq(a.n.level.getAttribute('aria-label').endsWith('늑대 '+live(a.api.world)+'마리'),true,'읽어 주는 이름표도 같은 수')}

/* 2-2 0.11: 읽어 주기(음성 합성) 삭제. 듣기 단계·다시 듣기 버튼·읽는 속도·음성 안내가 없고, 7세 퀴즈도 바로 푼다 */
for(const id of ['speak','rate','voiceStatus'])ok(!html.includes('id="'+id+'"'),'없앤 요소: '+id);
{const page=html.replace(/<script>[\s\S]*?<\/script>/,'').replace(/<style>[\s\S]*?<\/style>/,'');for(const w of ['듣','읽어 줘','읽어 주','🔊','소리','음성','읽고 고르기'])ok(!page.includes(w),'화면 글에 없음: '+w)}
for(const w of ['speechSynthesis','SpeechSynthesisUtterance','voiceOff','voiceFail','watchSpeech','cancelSpeech','speak(','readsQuiz',"'listen'",'🔊','잘 들어','Combat.lesson'])ok(!src.includes(w),'스크립트에 없음: '+w);
a=seed(L7);a.go();eq(a.api.phase,'ask','7세 퀴즈도 듣기 없이 바로 풀이');shows(a,7,'story',I7,'7세 퀴즈');eq(a.api.round.q.mode,'quiz','(퀴즈 칸)');ok(!a.n.answers.classList.contains('veiled')||a.api.round.lock>0,'보기는 잠금 0.3초 뒤 열림');a.tick(3);ok(!a.n.answers.classList.contains('veiled'),'보기 보임');eq(a.api.round.t,3,'풀이 시계는 처음부터 흐름');
ok(!('voiceOff' in a.game())&&!('speaking' in a.game()),'__game에 음성 상태 없음');

/* 2-3 '글 먼저 읽기'(8세 이상) */
a=seed({age:9,mode:'story'});a.go();shows(a,9,'story',0,'9세 읽기');
ok(a.api.round.lock>3,'글 먼저 읽기 잠금');ok(a.n.answers.classList.contains('veiled'),'잠금 중 보기 가림');
a.right();eq(a.api.phase,'ask','잠금 중에는 눌러도 무시');const lock=a.api.round.lock;a.unlock();eq(a.api.round.t,lock,'잠금 동안에도 시계는 흐름');ok(!a.n.answers.classList.contains('veiled'),'잠금 끝나면 보기');

/* 2-4 한 번에 정답 → 일제 사격 → 판매 연출(세계는 흐름) → 동전이 금화 칸에 닿으며 숫자가 오름 → 1.2초 뒤 다음 문제 */
a=fresh({view:true});a.go();
/* ⚡: 최소 읽기 시간 전에는 꺼진 채 기다리고, 번개 시간 동안 빛나다가, 지나면 조용히 꺼진다 */
{const q=a.api.round.q;let end=fastAt(q);while(C.isFast(q,end))end++;eq(a.n.fastIcon.dataset.state,'wait','⚡ 처음엔 대기');a.tick(fastAt(q));eq(a.n.fastIcon.dataset.state,'on','⚡ 번개 시간에 빛남');
 /* 판마다 문제가 다르므로(씨앗) 그 판의 문제로 번개 끝을 다시 센다 */
 const b=fresh();b.go();const qb=b.api.round.q;end=fastAt(qb);while(C.isFast(qb,end))end++;b.tick(end-1);eq(b.n.fastIcon.dataset.state,'on','⚡ 번개 마지막 틱까지 빛남');b.tick(1);eq(b.n.fastIcon.dataset.state,'off','⚡ 번개 시간이 지나면 꺼짐');ok(!/\d/.test(b.n.fastIcon.textContent),'⚡에는 숫자 없음')}
a.unlock();let q0=a.api.round.q,t0=a.api.round.t,g0=a.api.state.gold,inc=C.income(a.api.state,q0,true),exp=inc.gold,u0=a.api.uiT;a.right();
eq(a.api.phase,'reward','한 번에 정답 → 판매 연출(카드 고르기 없음)');eq(a.api.state.gold,g0+exp,'규칙은 정답 순간 금화를 더함(저장 안전)');eq(a.api.state.index,1,'문제 번호는 바로 다음으로(이중 지급 방지)');
eq(a.api.state.pace,C.fresh(8).pace===undefined?undefined:(()=>{const s=C.fresh(8);C.settle(s,q0,'first',{fast:true,ticks:t0});return s.pace})(),'정답까지 걸린 틱을 규칙에 넘겨 읽기 속도(pace)가 바뀜');
eq(a.game().gold.shown,g0,'화면 숫자는 아직 그대로(동전이 날아오는 중)');eq(a.n.gold.textContent,'🪙 '+g0,'금화 칸도 그대로');ok(a.n.feedback.textContent.includes('🪙 +'+exp),'받은 금화 안내 '+a.n.feedback.textContent);
ok(a.events.some(e=>e.type==='volley'),'3D: 일제 사격');{const pe=a.events.find(e=>e.type==='produce');eq([pe.laid,pe.sold,pe.left,pe.eggs,pe.gold],[inc.laid,inc.sold,inc.left,inc.sold,exp],'3D: 알 낳기·팔기·남김(eggs = sold)')}
ok(a.fx('sale').length===1&&a.fx('sale')[0].textContent.includes('🪙+'+exp),'알 → 농부 → 매대 → 금화 글자 띠');eq(a.n.fastIcon.dataset.state,'won','번개로 맞히면 ⚡ 반짝');
ok(a.btn(q0.answer).classList.contains('yay')&&a.btn(q0.answer).children.filter(x=>x.classList.contains('btn-star')).length===12,'맞힌 보기에 초록 고리와 별 12개');ok(a.btn(q0.answer).children.some(x=>x.classList.contains('btn-yay')&&x.textContent==='⚡ 번개!'),'번개로 맞히면 보기 위에 ⚡ 번개!');
{const wt=a.api.world.t;a.tick(5);eq(a.api.world.t,wt+5,'판매 연출 동안에도 늑대 세계는 흐름');a.right();eq(a.api.state.gold,g0+exp,'연출 중에 다시 눌러도 금화 그대로')}
a.tick(REWARD-6);eq(a.api.phase,'reward','1.1초까지는 판매 연출');a.tick(1);eq(a.api.phase,'ask','1.2초 뒤 저절로 다음 문제');shows(a,8,'story',1,'다음 문제');eq(a.api.round.t,0,'새 문제 풀이 시간');
eq(a.game().gold.flying,0,'동전은 아직 매대에');a.tick(14-REWARD);ok(a.game().gold.flying>=1&&a.n.coinLayer.children.some(x=>x.classList.contains('coin-fly')),'1.4초: 동전이 매대에서 날아오름');eq(a.game().gold.shown,g0,'닿기 전 숫자 그대로');
a.tick(20-14);{const s=a.game().gold.shown;ok(s>g0&&s<g0+exp,'동전이 닿을 때마다 숫자가 오름: '+s)}
a.tick(LAND-20);eq([a.game().gold.shown,a.game().gold.pending,a.game().gold.coins],[g0+exp,0,0],'2.4초 안에 숫자 = 규칙 금화');eq(a.n.gold.textContent,'🪙 '+(g0+exp),'금화 칸 숫자');
ok(a.n.gold.classList.contains('bump'),'마지막에 금화 칸이 통통');ok(a.n.coinLayer.children.some(x=>x.classList.contains('gold-plus')&&x.textContent==='+'+exp),'금화 칸 옆에 +'+exp);ok(!a.n.coinLayer.children.some(x=>x.classList.contains('coin-fly')),'닿은 동전은 사라짐');
eq(a.api.uiT-u0,LAND,'(검사 시간 확인)');
/* 빨리 연달아 맞히면 동전을 이어 붙이고, 그래도 숫자는 결국 규칙 금화와 같다 */
a=fresh();a.go();a.unlock();a.right();a.tick(REWARD);a.unlock();g0=a.api.state.gold;a.right();ok(a.game().gold.pending>0,'두 번째 금화도 날아오는 중');a.land();eq(a.game().gold.shown,a.api.state.gold,'이어 붙인 동전이 다 닿으면 숫자 = 규칙 금화');
/* 움직임 줄이기·그림 화면: 날지 않고 숫자가 한 번에 오른다(글자 띠는 남음) */
a=fresh({reduced:true});a.go();a.unlock();g0=a.api.state.gold;a.right();eq(a.game().gold.shown,a.api.state.gold,'움직임 줄이기: 숫자가 바로 오름');ok(a.api.state.gold>g0,'금화 받음');ok(a.fx('sale').length===1,'움직임 줄이기에서도 알 판매 글자 띠');ok(!a.btn(a.api.round.q.answer).children.some(x=>x.classList.contains('btn-star')),'움직임 줄이기: 보기 별 없음');ok(a.n.gold.classList.contains('bump'),'움직임 줄이기: 금화 칸만 통통');a.tick(LAND);ok(!a.n.coinLayer.children.some(x=>x.classList.contains('coin-fly')),'움직임 줄이기: 동전 비행 없음');
a=fresh();a.n.scene.dataset.renderer='fallback';a.go();a.unlock();a.right();eq(a.game().gold.shown,a.api.state.gold,'그림 화면: 숫자가 바로 오름');eq(a.game().gold.coins,0,'그림 화면: 동전 비행 없음');
/* 늦게 맞히면 번개 없음 */
a=fresh();a.go();a.tick(Math.ceil(C.baseSeconds(a.api.round.q)*10*.7));exp=C.income(a.api.state,a.api.round.q,false).gold;g0=a.api.state.gold;a.right();eq(a.api.state.gold,g0+exp,'늦게 맞히면 번개 없음');eq(a.n.fastIcon.dataset.state,'off','⚡ 꺼진 채');

/* 2-5 틀림 → 늑대 성큼(세계 빨리 감기, 장면 테두리 붉게) → 두 번째 정답(금화 없음) → 정답 누르고 다음 */
a=fresh({view:true});a.go();a.unlock();a.wrong(0);
eq(a.api.round.tries,1,'한 번 틀림');ok(a.btn(a.wrongIndex(0)).classList.contains('wrong'),'틀린 보기 표시');ok(a.events.some(e=>e.type==='dash'),'3D: 늑대 성큼');ok(a.n.scene.classList.contains('dash'),'장면 테두리가 붉게 번쩍');eq(a.n.fastIcon.dataset.state,'off','틀리면 ⚡ 꺼짐');
ok(a.n.villageStatus.textContent.includes('성큼'),'성큼 안내');
a.right();eq(a.api.phase,'ask','성큼 다가오는 동안은 못 누름');const wb=a.api.world.t;a.tick(C.DASH_TICKS);
eq(a.api.world.t-wb,Math.max(1,Math.round(W.dashTicks(a.api.world)/C.DASH_TICKS))*C.DASH_TICKS,'틀리면 늑대 세계가 무리 간격의 30%만큼 빨리 감김');ok(!a.n.scene.classList.contains('dash'),'성큼이 끝나면 붉은 테두리도 꺼짐');
g0=a.api.state.gold;a.right();eq([a.api.phase,a.api.round.result,a.api.state.gold],['learn','second',g0],'두 번째 정답: 금화 없음');eq(a.btn(a.api.round.q.answer).children.filter(x=>x.classList.contains('btn-star')).length,6,'두 번째 정답은 작은 연출(별 6개)');ok(!a.events.some(e=>e.type==='produce'),'알 팔기 없음');
const lt5=C.learnTicks(a.api.round.q);eq([a.api.round.learn,a.api.round.ready],[lt5,false],'정답을 초록으로 보여 주고 다시 볼 시간만큼 기다림');ok(a.n.feedback.textContent.includes('초록색 정답을 확인해요'),'안내 '+a.n.feedback.textContent);a.btn(a.api.round.q.answer).click();eq(a.api.phase,'learn','기다리는 동안에는 안 넘어감');a.tick(lt5-1);eq([a.api.phase,a.api.round.ready],['learn',false],'기다림이 끝나기 전');a.btn(a.api.round.q.answer).click();eq(a.api.phase,'learn','끝나기 직전에도 안 넘어감');
a.tick(1);ok(a.api.round.ready,'기다림이 끝나면 누를 수 있음');ok(a.n.feedback.textContent.includes('초록 답을 누르면')&&!a.n.feedback.textContent.includes('확인해요'),'누르라는 안내로 바뀜');ok(a.btn(a.api.round.q.answer).classList.contains('tap-me'),'초록 답 깜빡임');
a.btn(a.wrongIndex(1)).click();eq(a.api.phase,'learn','다른 보기는 무시');a.right();eq([a.api.phase,a.api.state.index],['ask',1],'초록 답을 누르면 다음 문제');
/* 두 번 틀림 → 정답 배우기(늑대는 계속 옴) */
a=fresh({view:true});a.go();a.unlock();a.wrong(0);a.tick(C.DASH_TICKS);a.wrong(1);
eq([a.api.phase,a.api.round.result,a.api.state.misses],['learn','miss',1],'두 번 틀리면 정답 배우기');ok(a.n.feedback.textContent.includes('두 번 틀렸어요'),'안내');
const lw2=a.api.world.t;a.tick(500);eq([a.api.phase,a.api.state.misses],['learn',1],'손대지 않으면 그대로 기다림(자리 비운 아이가 연달아 놓치지 않게)');ok(a.api.world.t>lw2,'배우는 동안에도 늑대는 옴');

/* 2-6 늑대 세계 → 경제: 닭을 잃고, 건물이 부서지면 가게의 고치기 칸이 켜짐 */
a=fresh({view:true});a.go();a.unlock();
{eq(a.row('repair').state,'none','부서진 건물이 없으면 고치기 칸은 ✓');
 loseHen(a);a.tick(3);eq(a.api.state.chickens,0,'늑대가 닭을 물어 가면 닭 수가 준다');ok(a.events.some(e=>e.type==='henLost'),'3D: 닭 잃음 사건');ok(a.n.villageStatus.textContent.includes('물어 갔어요'),'잃었다는 안내');eq(a.n.flockPill.textContent.startsWith('🐔 0'),true,'닭 알약이 바로 줄어듦');
 breakNext(a,'coop');a.tick(2);ok(a.api.state.broken>=1,'건물이 부서지면 경제 상태에 반영');ok(a.n.villageStatus.textContent.includes('고치기로'),'고치기 안내 '+a.n.villageStatus.textContent);
 a.api.state.gold=300;a.tick(1);eq(a.row('repair').state,'buy','부서진 건물이 있으면 고치기 칸이 켜짐');eq(a.slots()[0].dataset.key,'repair','고치기는 윗줄 첫 칸(위치 고정)');
 const qid=a.n.answers.dataset.qid;g0=a.api.state.gold;const price=a.row('repair').price;a.buy('repair');eq([W.brokenCount(a.api.world),a.api.state.repairs,a.api.state.gold],[0,1,g0-price],'고치기로 모두 고침');
 eq([a.api.phase,a.n.answers.dataset.qid],['ask',qid],'사도 문제는 그대로');ok(a.n.shopTip.textContent.includes('고쳤어요')&&!a.n.shopTip.classList.contains('hidden'),'가게 칸 위 안내 '+a.n.shopTip.textContent);eq(a.row('repair').state,'none','다 고치면 다시 ✓');}

/* 2-7 쉬기·탭 숨김: 늑대 세계·동전·가게도 멈춘다 */
a=fresh();a.go();a.tick(4);a.n.pause.click();ok(a.api.paused&&a.document.body.classList.contains('paused'),'쉬기');ok(a.document.body.classList.contains('covered'),'쉬는 동안 문제를 가림(공짜 읽기 시간 방지)');
const pw=a.api.world.t;a.tick(50);eq(a.api.round.t,4,'쉬는 동안 시계 멈춤');eq(a.api.world.t,pw,'쉬는 동안 늑대 세계도 멈춤');a.right();eq(a.api.phase,'ask','쉬는 동안 못 누름');
g0=a.api.state.gold;a.buy('fence');eq([a.api.state.fence,a.api.state.gold],[0,g0],'쉬는 동안 가게도 못 삼');a.n.pause.click();a.tick(2);eq(a.api.round.t,6,'다시 흐름');
a=fresh();a.go();a.unlock();a.wrong(0);a.tick(C.DASH_TICKS);a.wrong(1);a.tick(3);{const l0=a.api.round.learn;a.n.pause.click();a.tick(200);eq([a.api.round.learn,a.api.round.ready],[l0,false],'쉬는 동안 배우기 기다림도 멈춤');a.n.pause.click();a.tick(l0-1);ok(!a.api.round.ready,'계속하면 남은 만큼 마저 기다림');a.tick(1);ok(a.api.round.ready,'다 기다리면 초록 답')}
a=fresh();a.go();a.hide(true);ok(a.api.paused,'탭이 숨으면 자동으로 쉬기');a.tick(20);eq(a.api.round.t,0,'숨은 동안 시계 멈춤');
a=fresh();a.go();a.unlock();a.right();a.n.pause.click();ok(!a.document.body.classList.contains('covered'),'판매 연출은 가리지 않음');const pend=a.game().gold.pending;a.tick(40);eq([a.game().gold.pending,a.api.phase],[pend,'reward'],'쉬는 동안 동전·연출도 멈춤');a.n.pause.click();a.land();eq(a.game().gold.shown,a.api.state.gold,'계속하면 동전이 마저 닿음');

/* 2-8 나이 전환(0.11: 모드 전환 없음): 문제 중이면 바로 그 나이 문제로, 정답 뒤면 다음 문제부터. 늑대 세계는 그대로, 무리 간격만 새 나이에 맞춤 */
for(const age of Q.AGES)for(const mode of Q.MODES){
 a=seed({age,mode});a.go();shows(a,age,mode,0,`${age}세 ${mode} 시작`);
 for(const to of Q.AGES){if(to===age)continue;a.n.age.value=String(to);a.n.age.onchange();shows(a,to,mode,0,`${age}→${to}세 전환`);eq(a.api.state.age,to,'저장되는 나이')}
}
a=seed({age:7,index:3});a.go();a.tick(20);const wt7=a.api.world.t,iv7=a.api.world.interval;a.n.age.value='10';a.n.age.onchange();shows(a,10,'story',3,'문제 중 전환');eq(a.api.world.t,wt7,'전환해도 늑대 세계는 그대로');eq([iv7,a.api.world.interval],[ivFor(7),ivFor(10)],'무리 간격은 새 나이에 맞춤');ok(ivFor(10)>ivFor(7),'(10세 간격이 7세보다 김)');
eq(a.n.feedback.textContent,'10세 문제로 바꿨어요. 늑대는 그대로 와요.','전환 안내에 모드 이름 없음');eq(a.n.drawerSummary.textContent,'⚙️ 설정 · 10세','설정 요약');
a=fresh();a.go();a.unlock();a.right();a.n.age.value='7';a.n.age.onchange();shows(a,8,'story',0,'정답 뒤(판매 연출 중)에는 그대로');ok(a.n.feedback.textContent.includes('다음 문제부터 7세'),'다음부터 적용 안내');a.tick(REWARD);shows(a,7,'story',1,'다음 문제는 7세');
{const L1=Array.from({length:2000},(_,k)=>k).find(k=>Q.at(8,'story',k,1).lap===1);a=seed({index:L1,seed:1});a.go();const q=Q.at(8,'story',L1,1),lap1=a.n.answers.children.map(b=>b.dataset.i).join();
 eq(lap1,q.choices.map((_,i)=>String((i+1)%q.choices.length)).join(),'두 바퀴째는 보기를 한 칸 돌림')}

/* 2-9 저장·복원(늑대 세계 포함) */
a=fresh();a.go();a.unlock();a.right();g0=a.api.state.gold;eq(JSON.parse(saved[KEY]).round,null,'판매 연출 중 저장: 하던 문제 없음(금화는 이미 받음)');
let b=boot();eq(b.n.go.textContent,'시작하기 ▶','다시 열면 다음 문제부터');b.go();eq([b.api.phase,b.api.state.gold,b.api.state.index],['ask',g0,1],'새로고침해도 금화 이중 지급 없음');shows(b,8,'story',1,'연출 중 새로고침 → 다음 문제');
a=fresh();a.go();a.tick(333);a.n.pause.click();const st9=JSON.stringify({...a.api.world,events:[]});b=boot();eq(b.n.go.textContent,'이어서 하기 ▶','하던 문제가 있으면 이어서 하기');b.go();eq([b.api.phase,b.api.round.t],['ask',333],'문제 중 저장 → 같은 시계로 복원');eq(JSON.stringify({...b.api.world,events:[]}),st9,'늑대 세계(늑대·닭·건물)도 그대로 복원');
a=fresh();a.go();a.unlock();a.wrong(0);a.tick(C.DASH_TICKS);a.wrong(1);b=boot();b.go();eq(b.api.phase,'learn','놓친 문제는 정답 보기부터');b.tick(C.LEARN.max);b.right();eq(b.api.state.index,1,'복원 뒤 다음 문제');
/* 0.8 저장: 카드 고르기 중(pick)이던 문제는 금화를 이미 받았으므로 다음 문제로 */
saved={[KEY]:JSON.stringify({version:1,...C.fresh(8),mode:'sound',gold:99,wins:4,index:4,round:{token:'8:sound:4',phase:'pick',t:30,tries:0,gold:15,left:2}})};
b=boot();b.go();eq([b.api.phase,b.api.state.gold,b.api.state.index],['ask',99,5],'0.8 카드 고르기 저장 → 다음 문제, 금화 그대로');shows(b,8,'story',5,'0.8 pick 저장 다음 문제');
saved={[KEY]:JSON.stringify({version:1,gold:77,hp:30,level:1,wins:4,index:2,mode:'sound',age:9,chickens:0,fence:1,claimed:'sound:2',completed:null,combat:{stage:2,done:false}})};
b=boot();b.go();eq([b.api.state.gold,b.api.state.level,b.api.state.chickens,b.api.state.index,b.api.phase],[77,1,1,3,'ask'],'0.5 저장으로 시작');shows(b,9,'story',3,'0.5 저장 다음 문제');eq(b.api.world.buildings.filter(x=>x.kind==='tower').length,2,'0.5 저장의 타워 단계 → 화살 타워 2개');
saved[KEY]='broken';b=boot();b.go();eq(b.api.state.gold,20,'깨진 저장 → 새 판');shows(b,8,'story',0,'깨진 저장은 8세부터');
a=fresh();a.go();a.tick(5);b=boot();eq(b.api.phase,'start','다시 열면 시작 화면');const before=JSON.parse(saved[KEY]).round;ok(before&&before.phase==='ask','저장된 하던 문제');
b.unload();{const r=JSON.parse(saved[KEY]).round;eq(r&&[r.token,r.phase,r.t,r.tries],[before.token,before.phase,before.t,before.tries],'시작 화면에서 떠나도 하던 문제를 지우지 않음')}
/* 0.11 듣고 고르기 폐쇄: 예전 소리 모드 저장(풀던 소리 문제 포함)은 읽고 고르기로 이어진다. 금화·마을·문제 번호는 그대로, 풀던 소리 문제는 같은 번호의 읽기 문제로 새로 */
for(const ph of ['ask','learn']){saved={[KEY]:JSON.stringify({version:1,...C.fresh(8),mode:'sound',gold:88,level:2,chickens:3,wins:6,index:6,seed:5,round:{token:'8:sound:6',phase:ph,t:44,tries:1}})};
 b=boot();eq([b.api.state.mode,b.api.state.round],['story',null],'소리 저장('+ph+') → story, 풀던 소리 문제 버림');eq(b.n.go.textContent,'시작하기 ▶','소리 문제는 이어서 하기가 아님');eq(b.n.drawerSummary.textContent,'⚙️ 설정 · 8세','설정 요약');
 b.go();eq([b.api.phase,b.api.state.gold,b.api.state.level,b.api.state.chickens,b.api.state.index,b.api.round.t,b.api.round.tries],['ask',88,2,3,6,0,0],'소리 저장 → 같은 번호의 읽기 문제로 새로 시작, 금화·마을 그대로');shows(b,8,'story',6,'소리 저장 뒤 문제');eq(b.api.round.q.mode,'story','읽기 문항');
 eq(b.api.world.buildings.filter(x=>x.kind==='tower').length,3,'소리 저장의 마을(타워 3개) 그대로');eq(JSON.parse(saved[KEY]).mode,'story','다시 저장하면 mode story');eq(JSON.parse(saved[KEY]).version,1,'저장 version은 그대로 1');
 b.unlock();b.right();eq([b.api.phase,b.api.state.index],['reward',7],'이어서 정상 진행')}

/* 2-10 처음부터·움직임 줄이기·3D 상태 */
a=seed({gold:500,level:3,chickens:5});a.go();a.unlock();a.right();a.tick(400);a.n.reset.click();eq([a.api.state.gold,a.api.state.level,a.api.state.chickens,a.api.state.index],[20,0,1,0],'처음부터');ok(a.api.world.t<5&&a.api.world.wolves.length===0,'처음부터 → 늑대 세계도 새로');eq([a.game().gold.shown,a.game().gold.pending],[20,0],'처음부터 → 날던 동전도 정리');
a=fresh();a.n.motion.checked=true;a.n.motion.onchange();ok(a.document.body.classList.contains('reduced'),'움직임 줄이기');
a=fresh({view:true});a.go();a.unlock();a.buy('chicken');eq(a.built,[],'금화가 모자라면 안 지음');a.api.state.gold=100;a.tick(1);a.buy('chicken');eq(a.built,['chicken'],'3D 마을에 지은 것 전달');
const vs=a.window.getVillageState();for(const k of ['phase','paused','running','level','power','streak','chickens','fence','farmers','farmersTotal','nest','marketDown','recommend','pond','hall','feast','wins','world','radius','tries','dash','result'])ok(k in vs,'getVillageState.'+k);
eq([vs.phase,vs.running,vs.farmersTotal,vs.recommend],['ask',true,1,null],'사는 동안에도 풀이 단계·세계 흐름');
a.n.pause.click();eq(a.window.getVillageState().running,false,'쉬면 running 멈춤');
a=fresh();a.go();a.unlock();a.api.state.gold=100;a.tick(1);a.buy('chicken');eq(a.n.flock.children.length,2,'그림 마을 닭 2마리');ok(a.fx('fx-label').some(x=>x.textContent==='🐔 꼬꼬 2마리!'),'이름표 연출');
a=fresh({reduced:true});a.go();a.unlock();a.api.state.gold=100;a.tick(1);a.buy('chicken');ok(!a.fx('fx-star').length,'움직임 줄이기: 별 입자 없음');ok(a.fx('fx-label').length===1,'움직임 줄이기: 이름표만');
/* 그림 마을(3D 없는 기기)에도 늑대가 세계 위치대로 나타남 */
a=fresh();a.go();a.tick(300);ok(a.n.enemies.children.filter(x=>!x.classList.contains('hidden')).length===a.api.world.wolves.filter(v=>v.state!=='gone').length,'그림 마을 늑대 수 = 세계 늑대 수');

/* 2-11 긴 판: 무작위로 맞히고 틀리고, 아무 때나(듣기·풀기·연출·배우기) 사고 기다리는 120문제 동안 규칙 불변식 */
{a=fresh();a.go();let r=11;const rnd=()=>{r=(r*1103515245+12345)%2147483648;return r/2147483648};let bought=0,byPhase={};
 const shopNow=()=>{if(rnd()<.45){const can=a.game().shop.filter(x=>x.state==='buy');if(can.length){const k=can[Math.floor(rnd()*can.length)].key,before=a.api.state.gold;a.tick(4);if(a.row(k)&&a.row(k).state==='buy'){a.buy(k);if(a.api.state.gold<before){bought++;byPhase[a.api.phase]=(byPhase[a.api.phase]||0)+1}}}}};
 for(let step=0;step<120;step++){
  a.untilAsk();const st=a.api.state,w=a.api.world,gg=a.game();ok(st.gold>=0&&st.chickens>=0&&st.chickens===w.hens.length&&w.wolves.length<=W.MAX_WOLVES&&gg.gold.shown<=st.gold&&gg.shop.length===8,'불변식 '+step);
  shopNow();const roll=rnd();if(roll<.6){a.unlock();a.right()}else if(roll<.8){a.unlock();a.wrong(0);a.tick(C.DASH_TICKS);if(rnd()<.5)a.right();else a.wrong(1)}else{a.tick(80);a.unlock();a.right()}
  if(a.api.phase==='reward')shopNow();
  if(a.api.phase==='learn'){shopNow();a.tick(200);a.right()}
 }
 ok(a.api.state.index>=118,'120문제 진행');ok(a.api.world.stats.waves>5,'늑대 무리가 여러 번 옴');ok(a.api.world.stats.kills>0,'타워가 늑대를 쓰러뜨림');ok(bought>=20,'아무 때나 산 횟수 '+bought+' '+JSON.stringify(byPhase));ok(byPhase.ask&&byPhase.reward,'풀이·연출 중에 삼 '+JSON.stringify(byPhase));
 a.land();eq(a.game().gold.shown,a.api.state.gold,'긴 판 뒤 화면 금화 = 규칙 금화');}

/* 2-12 0.8 기능 유지: 섞인 상식·수학·영어 · 연속 정답 · 빠른 정답 일제 사격 · 타워 강화 · 새 몬스터 알림 · 우두머리 보상 · 0.7 저장 이어받기 */
{const banners=a=>a.fx('banner').map(x=>x.textContent);
 /* 퀴즈 칸(0.10: 8세는 20칸마다 3칸, Q.isQuiz)은 상식·수학·영어: 분류를 보여 준다 */
 const QI=Array.from({length:40},(_,k)=>k).filter(k=>Q.isQuiz(8,k));
 a=seed({index:QI[0],seed:3});a.go();let q=Q.at(8,'story',QI[0],3);shows(a,8,'story',QI[0],'섞인 문제');eq(q.mode,'quiz','퀴즈 칸은 상식·수학·영어');eq(a.api.phase,'ask','퀴즈도 바로 풀이');ok(a.n.levelChip.textContent.includes(Q.CATS[q.cat]),'분류 표시 '+a.n.levelChip.textContent);
 a.unlock();a.right();eq(a.api.phase,'reward','섞인 문제도 맞히면 판매 연출');
 a=seed({index:QI[1],mode:'story',seed:3});a.go();q=Q.at(8,'story',QI[1],3);shows(a,8,'story',QI[1],'섞인 문제(둘째 퀴즈 칸)');
 a.unlock();a.wrong(0);a.tick(C.DASH_TICKS);a.wrong(1);eq([a.api.phase,a.api.round.learn],['learn',C.learnTicks(q)],'퀴즈를 놓치면 질문·정답을 다시 볼 시간만큼 기다림');
 /* 연속 정답: 🔥 표시, 틀리면 처음부터 */
 a=fresh();a.go();for(let i=0;i<3;i++){a.untilAsk();a.unlock();a.right();a.tick(REWARD)}
 eq(a.api.state.streak,3,'3연속');ok(a.n.stage.textContent.includes('🔥 3연속'),'연속 표시');a.untilAsk();a.unlock();a.right();ok(a.n.feedback.textContent.includes('🔥4연속'),'금화 줄에 연속 '+a.n.feedback.textContent);
 a.tick(REWARD);a.untilAsk();a.unlock();a.wrong(0);eq(a.api.state.streak,0,'틀리면 연속이 끊김');
 /* 빨리 맞히면 일제 사격이 더 많다 */
 a=fresh({view:true});a.go();a.api.world.wolves.push({id:5e3,kind:'wolf',x:3,z:3,sx:15,sz:15,hp:999,max:999,speed:0,state:'walk',target:0,timer:0,inside:0,hen:0});a.ready();const ar0=a.api.world.arrows.length,sc=C.scale(a.api.round.q);a.right();
 ok(a.events.some(e=>e.type==='volley'&&e.fast),'번개 정답 사건');eq(a.api.world.arrows.length-ar0,W.volleyArrows(a.api.state,{scale:sc,fast:true}),'번개 정답: 타워 1개 × 번개 화살 수');
 a=fresh({view:true});a.go();a.api.world.trickle=1e9;a.api.world.wolves.push({id:5e3,kind:'wolf',x:3,z:3,sx:15,sz:15,hp:999,max:999,speed:0,state:'walk',target:0,timer:0,inside:0,hen:0});a.tick(Math.ceil(C.baseSeconds(a.api.round.q)*10*.7));const ar1=a.api.world.arrows.length;a.right();eq(a.api.world.arrows.length-ar1,W.volleyArrows(a.api.state,{scale:C.scale(a.api.round.q),fast:false}),'늦은 정답: 보통 화살 수');ok(W.volleyArrows(a.api.state,{fast:true})>W.volleyArrows(a.api.state,{fast:false}),'번개가 더 많음');
 /* 타워 강화: 회관 1단계부터 윗줄 셋째 칸, 사면 화살이 터진다 */
 a=seed({gold:500});a.go();a.unlock();eq(a.row('power').state,'locked','회관 0단계: 강화 칸 잠김');a.buy('power');eq([a.api.state.power,a.n.shopTip.textContent],[0,'회관을 키우면 생겨요'],'잠긴 칸을 누르면 안내만');
 a=seed({hall:1,gold:500});a.go();a.unlock();eq([a.slots()[2].dataset.key,a.row('power').state],['power','buy'],'강화 칸');
 a.buy('power');eq(a.api.state.power,1,'강화 1단계');ok(a.n.shopTip.textContent.includes('펑'),'강화 안내 '+a.n.shopTip.textContent);ok(a.n.level.textContent.includes('💥1'),'상태 줄에 강화 단계');
 a.tick(12);a.api.world.wolves.push({id:6e3,kind:'wolf',x:3,z:3,sx:15,sz:15,hp:999,max:999,speed:0,state:'walk',target:0,timer:0,inside:0,hen:0});a.tick(20);ok(a.api.world.arrows.length===0||a.api.world.arrows.every(x=>x.splash>0),'강화 뒤 화살은 펑 화살');eq(a.window.getVillageState().power,1,'3D 상태에 강화 단계');
 /* 새 몬스터 알림·우두머리 보상 */
 a=seed({hall:1,level:2});a.go();let found=false;for(let i=0;i<1500&&!found;i++){a.tick(1);found=banners(a).some(t=>t.includes('덤불 늑대'))}ok(found,'덤불 늑대가 처음 나오면 알림 띠');ok(a.api.world.seen.bramble,'세계도 봤다고 기록');
 a=fresh();a.go();a.unlock();const tw=a.api.world.buildings.find(b=>b.kind==='tower');a.api.world.wolves.push({id:7e3,kind:'ember',x:tw.x+1,z:tw.z,sx:20,sz:0,hp:1,max:1,speed:0,state:'walk',target:0,timer:0,inside:0,hen:0,roar:99});
 g0=a.api.state.gold;for(let i=0;i<30&&a.api.world.stats.bossKills===0;i++)a.tick(1);eq(a.api.world.stats.bossKills,1,'불씨 왕 쓰러뜨림');eq(a.api.state.gold,g0+C.BOUNTY,'우두머리 보상 금화 +'+C.BOUNTY);eq(a.game().gold.shown,g0+C.BOUNTY,'보상 금화는 화면에도 바로');ok(banners(a).some(t=>t.includes('불씨 왕을 쓰러뜨렸어요')),'보상 알림 띠');
 /* 판매 연출 동안 알림 띠는 숨었다가 끝나면 다시 */
 a.rightNow();/* 바로 누름: 읽기 문항은 번개 대기(약 7초)가 띠 3.3초보다 길다 */eq(a.api.phase,'reward','(연출)');ok(a.fx('banner').length>0&&a.fx('banner').every(x=>x.classList.contains('later')),'판매 연출 동안 알림 띠 숨김');a.tick(REWARD);ok(a.fx('banner').some(x=>!x.classList.contains('later')),'연출 뒤 알림 띠 다시');
 /* 울타리만 부서졌으면 고치기 칸은 ✓(농부가 다시 세움) */
 a=seed({fence:2,gold:300});a.go();a.unlock();for(const b of a.api.world.buildings)if(b.kind==='fence'){b.broken=true;b.hp=0}a.tick(1);eq(a.row('repair').state,'none','울타리만 부서지면 고칠 곳 없음');a.buy('repair');eq([a.api.state.repairs,a.n.shopTip.textContent],[0,'✓ 부서진 곳이 없어요'],'누르면 안내만');
 /* 그림 마을 늑대도 종류를 표시 */
 /* 무리 간격이 읽기 문항 기준(8세 20초)으로 길어져, 한순간에는 새 몬스터가 없을 수 있다 → 나올 때까지 조금 더 흘린다 */
 a=seed({hall:2,level:3});a.go();a.tick(900);for(let i=0;i<900&&!a.api.world.wolves.some(v=>v.state!=='gone'&&v.kind!=='wolf');i++)a.tick(1);const liv=a.api.world.wolves.filter(v=>v.state!=='gone'),shown=a.n.enemies.children.filter(x=>!x.classList.contains('hidden'));
 eq(shown.map(x=>x.dataset.kind),liv.map(v=>v.kind),'그림 마을 몬스터 종류 = 세계');ok(liv.some(v=>v.kind!=='wolf'),'2단계 마을에 새 몬스터');
 /* 0.7 저장(세계 v1) 이어받기 */
 saved={[KEY]:JSON.stringify({version:1,...C.fresh(8),level:1,world:{v:1,t:900,rng:5,hall:0,interval:270,wave:{n:3,arrive:1110,spawned:false},wolves:[{id:40,x:12,z:0,sx:17,sz:0,hp:20,max:20,speed:.8,state:'walk',target:0,timer:0,inside:0,hen:0}],hens:[],buildings:[],arrows:[],nextId:50,stats:{kills:5,henLost:0,henSaved:0,broken:0,waves:3},events:[]}})};
 const b2=boot();eq([b2.api.world.interval,b2.api.world.wolves[0].kind,b2.api.world.stats.kills],[ivFor(8),'wolf',5],'0.7 세계 저장을 이어받음');ok(b2.api.world.wave.arrive<=b2.api.world.t+b2.api.world.interval,'다음 무리를 새 간격으로 당김');b2.go();b2.tick(50);ok(b2.api.world.t===950,'이어서 진행');
}

/* 2-13 0.9 가게: 2줄 × 4칸이 늘 열려 있고, 듣기·풀기·연출·배우기 중 언제든 한 번 눌러 바로 산다(세계는 멈추지 않음) */
{a=fresh();a.go();
 eq(a.slots().length,8,'가게 8칸');eq(a.slots().map(b=>b.dataset.key),C.shopKeys(a.api.state),'칸 순서 = 규칙(위치 고정)');eq(a.slots().map(b=>b.dataset.row),['0','0','0','0','1','1','1','1'],'윗줄 지켜요 · 아랫줄 벌어요·마을');
 eq(a.slots().map(b=>b.dataset.state),C.shop(a.api.state).map(r=>r.state),'칸 상태 = 규칙 shop()');ok(a.slots().every(b=>!/\d+ *\/ *\d+/.test(b.textContent)&&!b.disabled),'개수·상한 표시 없음, 누를 수 없는 칸 없음');
 ok(a.slots().every(b=>b.getAttribute('aria-label')),'칸마다 읽어 주는 이름표');eq(a.slot('chicken')._pr.textContent,'🪙 '+C.price(a.api.state,'chicken'),'칸 = 그림 + 🪙 가격');
 /* 금화 부족 */
 const need=a.row('chicken').price-a.game().gold.shown;a.buy('chicken');eq([a.api.state.chickens,a.n.shopTip.textContent],[1,'🪙 '+need+' 더 모아요'],'금화 부족: 누르면 얼마 더 모을지');a.tick(16);ok(a.n.shopTip.classList.contains('hidden'),'안내는 잠깐 뒤 사라짐');
 /* 회관 3단계부터 8번째 칸은 잔치 */
 const c3=seed({hall:3,gold:900});c3.go();eq(c3.slots()[7].dataset.key,'feast','회관 3단계: 8번째 칸 = 잔치');}
/* 푸는 중(글 먼저 읽기 잠금 중)에 사기: 문제는 그대로, 세계는 흐름 */
a=fresh();a.go();ok(a.api.round.lock>3,'(글 먼저 읽기 중)');a.api.state.gold=200;a.tick(1);let wt=a.api.world.t;a.buy('chicken');
eq([a.api.state.chickens,a.api.phase],[2,'ask'],'글 먼저 읽는 중에 닭 사기');a.tick(5);eq(a.api.world.t,wt+5,'사는 동안·뒤에도 늑대 세계는 흐름');
a.unlock();let qid=a.n.answers.dataset.qid,rt=a.api.round.t;a.buy('fence');eq([a.api.state.fence,a.api.phase,a.n.answers.dataset.qid],[1,'ask',qid],'푸는 중에 울타리: 문제는 그대로');a.tick(3);eq(a.api.round.t,rt+3,'풀이 시계도 흐름');
/* 두 번 눌림 방지 0.4초 */
{const n0=a.api.state.chickens;a.buy('chicken');a.buy('chicken');eq(a.api.state.chickens,n0,'0.4초 안에 또 누르면 무시(앞 구매 직후)');a.tick(4);a.buy('chicken');a.buy('chicken');eq(a.api.state.chickens,n0+1,'0.4초 지나면 한 번만');a.tick(3);a.buy('chicken');eq(a.api.state.chickens,n0+1,'0.3초 뒤에도 무시');a.tick(1);a.buy('chicken');eq(a.api.state.chickens,n0+2,'0.4초 뒤 다시 살 수 있음')}
/* 판매 연출 중·배우기 중에 사기 */
a.tick(4);a.right();eq(a.api.phase,'reward','(연출)');a.api.state.gold+=300;a.tick(4);a.buy('tower');eq([a.api.state.level,a.api.phase],[1,'reward'],'판매 연출 중에 타워');a.tick(REWARD-4);eq(a.api.phase,'ask','연출은 늘어나지 않고 다음 문제로');
a.unlock();a.wrong(0);a.tick(C.DASH_TICKS);a.wrong(1);eq(a.api.phase,'learn','(배우기)');a.tick(4);const lv=a.api.state.level;a.buy('tower');eq([a.api.state.level,a.api.phase],[lv+1,'learn'],'배우는 중에도 삼');
/* 화면 금화로 칸이 켜진다: 규칙 금화가 넉넉해도 동전이 닿기 전에는 흐림, 닿으면 '띵' 하고 켜짐 */
a=fresh();a.go();a.unlock();{const p=a.row('chicken').price,g=a.api.state.gold;ok(g<p,'(처음엔 닭을 못 삼)');a.tick(fastAt(a.api.round.q));a.right();ok(a.api.state.gold>=p,'(규칙 금화는 넉넉)');
 eq(a.row('chicken').state,'poor','동전이 닿기 전에는 흐림');a.tick(1);a.buy('chicken');eq(a.api.state.chickens,1,'흐린 칸은 사지지 않음');ok(a.n.shopTip.textContent.endsWith('더 모아요'),'대신 안내');
 a.land();eq(a.row('chicken').state,'buy','동전이 닿으면 켜짐');ok(a.slot('chicken').classList.contains('lit'),'켜지는 순간 빛이 훑음');a.buy('chicken');eq(a.api.state.chickens,2,'이제 삼')}
/* 날아오는 중에 사면 화면 숫자도 같이 줄고, 다 닿으면 규칙 금화와 같다 */
a=fresh();a.go();a.unlock();a.right();{const s=a.game().gold.shown,p=a.row('fence').price;ok(a.row('fence').state==='buy','(울타리는 지금 금화로 삼)');a.buy('fence');eq(a.game().gold.shown,s-p,'날아오는 중에 사도 화면 숫자 = 보이던 금화 − 값');a.land();eq(a.game().gold.shown,a.api.state.gold,'다 닿으면 같음')}
/* 매대가 부서지면 알을 반값에(경제 상태에 반영), 고치면 원래대로. 둥지에 남은 알도 3D에 넘긴다 */
a=seed({chickens:6},{view:true});a.go();a.unlock();breakNext(a,'market');a.tick(1);eq([a.api.state.marketDown,a.window.getVillageState().marketDown],[1,1],'매대 부서짐 → marketDown');calmWorld(a);
{a.tick(Math.ceil(C.baseSeconds(a.api.round.q)*7));const inc=C.income(a.api.state,a.api.round.q,false);g0=a.api.state.gold;a.right();eq(a.api.state.gold-g0,inc.gold,'반값 알 금화');eq(inc.eggValue,Math.max(1,Math.floor(C.eggPrice({...a.api.state,marketDown:0})/2)),'(알값 절반)');
 const pe=a.events.filter(e=>e.type==='produce').at(-1);eq([pe.laid,pe.sold,pe.left],[inc.laid,inc.sold,inc.left],'3D: 낳은·판·남은 알');ok(inc.left>0,'(바구니보다 알이 많음)');eq(a.window.getVillageState().nest,inc.left,'getVillageState.nest = 둥지 남은 알');ok(a.fx('sale').at(-1).textContent.includes('🪺'+inc.left),'글자 띠에 남은 알 🪺');
 a.api.state.gold=500;a.tick(1);a.buy('repair');eq([a.api.state.marketDown,a.window.getVillageState().marketDown],[0,0],'고치면 매대 원래대로')}
eq(a.window.getVillageState().farmersTotal,1,'농부 수(기본 1)');a.api.state.gold=900;a.tick(4);a.buy('farmer');eq(a.window.getVillageState().farmersTotal,2,'농부를 사면 2');

/* 2-14 늑대 무리 알림(시간 바 대신): 장면 가장자리 붉은 발자국 + 울음 + 상태 문구 */
a=fresh({view:true});a.go();{let pk=null;for(let i=0;i<400&&!pk;i++){a.tick(1);pk=a.events.find(e=>e.type==='pack')}
 ok(pk,'무리가 나옴');const paws=a.fx('paws'),pts=[...new Set(pk.points)];eq(paws.map(x=>Number(x.dataset.point)).sort(),pts.sort(),'출현 지점마다 발자국 하나 '+JSON.stringify(pk.points));
 ok(paws.every(x=>{const l=parseFloat(x.style.left),t=parseFloat(x.style.top);return l>=0&&l<=390&&t>=0&&t<=260&&(l<=40||l>=350||t<=40||t>=220)}),'발자국은 장면 가장자리에: '+paws.map(x=>x.style.left+','+x.style.top));
 ok(paws.every(x=>x.children.length===3&&x.children.every(i=>i.innerHTML.includes('<svg'))),'발자국 세 개(붉은 그림)');ok(a.n.villageStatus.textContent.includes('늑대 무리 '+pk.n+'마리가 몰려와요'),'상태 문구 '+a.n.villageStatus.textContent);}
/* 그림 화면은 그림 투영(x → 오른쪽, z → 아래)으로: 오른쪽 출현 지점(0번, 22.5°)은 오른쪽 가장자리 */
a=fresh();a.n.scene.dataset.renderer='fallback';a.go();{let pk=null;a.api.world.wave.arrive=a.api.world.t+W.TRAVEL+1;for(let i=0;i<5&&!pk;i++){a.tick(1);pk=a.fx('paws').length}
 ok(pk>0,'(그림 화면 무리)');ok(a.fx('paws').every(x=>{const p=Number(x.dataset.point),ang=(p+.5)*Math.PI*2/W.SPAWNS,l=parseFloat(x.style.left),t=parseFloat(x.style.top);return (Math.cos(ang)>.5?l>=350:Math.cos(ang)<-.5?l<=40:true)&&(Math.sin(ang)>.7?t>=220:Math.sin(ang)<-.7?t<=40:true)}),'그림 화면: 출현 방향 쪽 가장자리 '+a.fx('paws').map(x=>x.dataset.point+'@'+x.style.left+','+x.style.top))}

/* 2-15 추천 말풍선: 언제 띄우나(동전이 닿을 때·급할 때), 얼마나 자주(20초·10초·분당 2개·두 번 무시하면 60초 쉼), 글 먼저 읽기 중에는 안 띄움 */
const CHICK='닭이 많으면 알을 많이 낳아서 골드를 빨리 모을 수 있어요!',TOWER_LINE='꼬꼬를 지키려면 타워가 더 필요해요!';
const answerLand=a=>{a.untilAsk();a.unlock();a.right();a.tick(LAND+2);return a.game().rec.shown};
/* 읽고 고르기(실제 규칙): 동전이 다 닿은 다음에 뜬다. 닭 1마리면 닭 추천, 칸이 반짝이고 꼬리가 그 칸을 가리킴 */
a=seed({age:7,mode:'story'},{rec:'real'});a.go();a.unlock();a.right();
{let early=false;for(let i=0;i<LAND-1;i++){a.tick(1);if(a.bubble())early=true}ok(!early,'동전이 닿기 전에는 말풍선 없음');a.tick(2);
 eq(a.bubble(),CHICK,'동전이 닿으면 꼬꼬 말풍선(닭 1마리 → 닭 추천)');ok(a.slot('chicken').classList.contains('rec'),'닭 칸이 반짝');eq(a.window.getVillageState().recommend,'chicken','getVillageState.recommend');
 eq(a.n.bubble.style['--tail'],'12.5%','꼬리가 닭 칸(아랫줄 첫 칸)을 가리킴');ok(!a.n.bubble.onclick&&!a.n.bubble.getAttribute('title'),'말풍선은 글만: 눌러 듣기 없음');
 a.n.bubble.click();eq(a.bubble(),CHICK,'말풍선을 눌러도 그대로');
 a.tick(40);eq(a.bubble(),null,'말풍선은 3~4초 뒤 사라짐');ok(a.slot('chicken').classList.contains('rec'),'반짝임은 남음');
 a.tick(4);a.buy('chicken');ok(!a.slot('chicken').classList.contains('rec')&&a.window.getVillageState().recommend===null,'사면 반짝임도 끝');}
/* 0.11: 판매 연출은 말풍선을 기다리지 않는다. 1.2초 뒤 다음 문제, 말풍선은 동전이 닿은 뒤 글로만 */
a=fresh({rec:'real'});a.go();a.unlock();a.right();a.tick(REWARD);eq([a.api.phase,a.bubble(),a.api.state.index],['ask',null,1],'말풍선 차례여도 1.2초 뒤 바로 다음 문제');
a.tick(LAND-REWARD+1);a.unlock();a.tick(1);eq([a.api.phase,a.bubble()],['ask',CHICK],'동전이 닿고 보기가 열리면 말풍선');
ok(!('reading' in a.game().round),'round.reading(소리 모드 말풍선 읽기 대기) 없음');
/* 급한 추천(닭을 잃음): 보기가 열려 있으면 바로 */
const URG=()=>({key:'tower',line:TOWER_LINE,urgent:true,rule:2});
a=seed({age:7,chickens:4,gold:200},{rec:URG});a.go();loseHen(a);a.tick(5);eq(a.bubble(),TOWER_LINE,'닭을 잃으면 급한 말풍선');ok(a.slot('tower').classList.contains('rec'),'타워 칸 반짝');
/* 판매 연출 중에 생긴 급한 일: 미루지 않고 바로 띄운다(연출은 늘어나지 않음) */
a=seed({chickens:4,gold:200},{rec:URG});a.go();calmWorld(a);a.unlock();a.right();loseHen(a);a.tick(3);eq([a.api.phase,a.bubble()],['reward',TOWER_LINE],'판매 연출 중에도 급한 말풍선은 바로');a.tick(REWARD-3);eq(a.api.phase,'ask','연출은 1.2초 그대로');
/* 글 먼저 읽기 동안에도 안 뜸 */
a=seed({age:9,mode:'story',chickens:4,gold:200},{rec:URG});a.go();calmWorld(a);ok(a.api.round.lock>10,'(글 먼저 읽기)');loseHen(a);a.tick(3);eq(a.bubble(),null,'글 먼저 읽는 동안 말풍선 없음');a.unlock();a.tick(1);eq(a.bubble(),TOWER_LINE,'보기가 열리면 말풍선');
/* 급한 것은 10초 간격: 9초 뒤 또 잃어도 안 뜨고, 10초가 지나면 뜸. 1분에 3개까지 */
{const t0=a.game().rec.last;a.tick(REC_WAIT(a,t0+90));loseHen(a);a.tick(3);eq(a.game().rec.shown,1,'급한 것도 10초 안에는 다시 안 뜸');a.tick(REC_WAIT(a,t0+101));loseHen(a);a.tick(3);eq(a.game().rec.shown,2,'10초가 지나면 급한 말풍선 다시')}
function REC_WAIT(a,t){return Math.max(0,t-a.api.world.t)}
/* 보통 추천: 20초 간격, 같은 추천을 두 번 연달아 안 따르면 60초 쉼 */
const NORMAL=()=>({key:'chicken',line:CHICK,urgent:false,rule:7});
a=seed({age:7,mode:'story',gold:0},{rec:NORMAL});a.go();calmWorld(a);eq(answerLand(a),1,'첫 말풍선');const t1=a.game().rec.last;
eq(answerLand(a),1,'20초 안에는 다음 말풍선 없음');a.tick(REC_WAIT(a,t1+200));eq(answerLand(a),2,'20초 지나면 다시(같은 추천, 안 따름 1번)');const t2=a.game().rec.last;
a.tick(REC_WAIT(a,t2+200));eq(answerLand(a),2,'같은 추천을 두 번 연달아 안 따르면 쉼');ok(a.game().rec.mute.chicken>a.api.world.t+500,'60초 쉼 '+JSON.stringify(a.game().rec.mute));
/* 0.10: 무시한 같은 문장은 회관 단계마다 2번까지. 60초 쉰 뒤에도 같은 단계에서는 다시 안 뜨고, 회관이 커지면 다시 */
a.tick(REC_WAIT(a,a.game().rec.mute.chicken+1));eq(answerLand(a),2,'같은 단계에서 무시한 문장은 2번까지(60초 뒤에도 안 뜸)');
a.api.state.hall=1;a.tick(REC_WAIT(a,a.game().rec.last+201));eq(answerLand(a),3,'회관이 커지면 다시');
/* 따르면(사면) 쉬지 않는다 */
a=seed({age:7,mode:'story',gold:0},{rec:NORMAL});a.go();calmWorld(a);answerLand(a);a.api.state.gold+=200;a.tick(4);a.buy('chicken');let tt=a.game().rec.last;
for(let k=0;k<2;k++){a.tick(REC_WAIT(a,tt+320));answerLand(a);tt=a.game().rec.last;if(k===0){a.api.state.gold+=200;a.tick(4);a.buy('chicken')}}eq(a.game().rec.shown,3,'추천을 따르면 계속 말해 줌(두 번 안 따름 쉼 없음)');
/* 1분에 2개(보통): 20초마다 다른 추천이 나와도 셋째는 1분이 지나야 */
const ALT=s=>({key:s.wins%2?'fence':'chicken',line:s.wins%2?'이쪽이 뻥 뚫렸어요. 울타리를 쳐요!':CHICK,urgent:false,rule:8});
a=seed({age:7,mode:'story',gold:0},{rec:ALT});a.go();calmWorld(a);answerLand(a);const f1=a.game().rec.last;a.tick(REC_WAIT(a,f1+205));answerLand(a);a.tick(REC_WAIT(a,f1+410));answerLand(a);
eq(a.game().rec.shown,2,'1분에 보통 말풍선 2개까지 '+JSON.stringify(a.game().rec.times));a.tick(REC_WAIT(a,f1+620));answerLand(a);eq(a.game().rec.shown,3,'1분이 지나면 다시');
/* 상황이 바뀌면 반짝임이 꺼짐 */
let want='chicken';a=seed({age:7,mode:'story',gold:0},{rec:()=>want&&{key:want,line:CHICK,urgent:false,rule:7}});a.go();answerLand(a);ok(a.slot('chicken').classList.contains('rec'),'(반짝)');want=null;a.tick(10);ok(!a.slot('chicken').classList.contains('rec'),'추천이 바뀌면 반짝임 꺼짐');
/* 실제 규칙: 회관 단계로 새로 열린 상품은 한 번만(rule 4) */
/* 늑대가 몰려들면 더 급한 추천(타워)이 먼저라 시드에 따라 흔들린다 → 세계를 조용히 한 뒤 본다 */
a=seed({age:7,mode:'story',hall:1,chickens:8,level:4,gold:150},{rec:'real'});a.go();calmWorld(a);answerLand(a);eq([a.bubble(),a.game().rec.glow,a.game().rec.opened],['펑! 터지는 화살을 쓸 수 있어요!','power',['power']],'회관 1단계: 강화가 열렸다고 한 번');

/* ---------- 0.10 플레이 점검 수정 ---------- */
{const S0=o=>Object.assign(C.fresh(8),o||{});
 const quiet=(s,seed,o)=>{const w=W.sync(W.create(Object.assign({seed,interval:3000},o)),s);w.trickle=1e9;w.wave.arrive=1e9;return w};
 const wolf=(w,o)=>{const v=Object.assign({id:w.nextId++,kind:'wolf',x:0,z:0,sx:20,sz:0,hp:9999,max:9999,speed:1,state:'walk',target:0,timer:0,inside:0,hen:0},o);w.wolves.push(v);return v};
 const exposed=w=>{for(const b of w.buildings)if(b.kind==='tower'||b.kind==='coop')b.broken=true};
 /* 새 판 보호 */
 {const w=W.create({seed:1,guard:true}),w2=W.create({seed:1});eq([w.calm,w.keep],[W.GUARD.calm,true],'새 판 보호 켜짐(guard)');eq(['calm' in w2,'keep' in w2],[false,false],'guard 없으면 예전과 같은 세계');
  W.answered(w);eq(w.calm,W.GUARD.calm-1,'한 번에 맞히면 보호가 한 칸 줄어듦');w.calm=0;W.answered(w);eq(w.calm,0,'0 아래로는 안 내려감')}
 {const s=S0({chickens:4}),w=quiet(s,51,{guard:true});exposed(w);for(const h of w.hens)wolf(w,{x:h.x+2,z:h.z,state:'hunt'});
  let bites=0,broke=0;for(let i=0;i<300;i++)for(const e of W.step(w,s)){if(e.type==='bite')bites++;if(e.type==='broken'&&e.kind!=='fence')broke++}
  eq([bites,broke],[0,0],'보호 동안 늑대는 쫓기만 함(물지도 부수지도 않음)');
  w.calm=0;w.wolves=[];for(const h of w.hens)wolf(w,{x:h.x+2,z:h.z,state:'hunt'});let after=0;for(let i=0;i<300;i++)for(const e of W.step(w,s))if(e.type==='bite')after++;ok(after>0,'보호가 끝나면 다시 뭄')}
 {const s=S0({chickens:1}),w=quiet(s,52,{guard:true});w.calm=0;exposed(w);wolf(w,{x:w.hens[0].x+2,z:w.hens[0].z,state:'hunt'});
  let bites=0;for(let i=0;i<300;i++)for(const e of W.step(w,s))if(e.type==='bite')bites++;eq(bites,0,'마지막 닭 한 마리는 노리지 않음(keep)');
  const s2=S0({chickens:2}),w2=quiet(s2,53,{guard:true});w2.calm=0;exposed(w2);for(const h of w2.hens)wolf(w2,{x:h.x+1.5,z:h.z,state:'hunt'});
  let b2=0;for(let i=0;i<600;i++)for(const e of W.step(w2,s2))if(e.type==='bite')b2++;ok(b2>=1,'닭이 둘이면 하나는 물려 갈 수 있음');ok(w2.hens.some(h=>h.state!=='gone'&&h.state!=='carried'&&h.state!=='caught'),'그래도 한 마리는 남음');
  const s3=S0({chickens:1}),w3=quiet(s3,54);w3.calm=0;exposed(w3);wolf(w3,{x:w3.hens[0].x+2,z:w3.hens[0].z,state:'hunt'});let b3=0;for(let i=0;i<300;i++)for(const e of W.step(w3,s3))if(e.type==='bite')b3++;ok(b3>0,'keep 없는 세계(규칙 검사용)는 예전처럼 마지막 닭도 뭄')}
 /* 닭은 가까운 늑대에만 숨는다 */
 {const s=S0({chickens:8,hall:3}),w=quiet(s,55);wolf(w,{x:15,z:0,speed:0,state:'hunt'});for(let i=0;i<40;i++)W.step(w,s);
  eq(w.hens.filter(h=>h.state==='hidden'||h.state==='flee').length,0,'큰 마을 가장자리 늑대 한 마리로는 닭이 숨지 않음');
  /* 마당 한쪽 바깥(닭 0번 자리에서 경보 반경보다 조금 가까이)의 늑대: 그쪽 닭은 숨고, 반대편 닭은 마당에 남는다 */
  const h0=w.hens.find(h=>h.slot===0),wx=h0.x-(W.HEN.alert-.5);wolf(w,{x:wx,z:h0.z,speed:0,state:'hunt'});for(let i=0;i<10;i++)W.step(w,s);ok(h0.state==='flee'||h0.state==='hidden','가까운 닭은 숨으러 감 '+h0.state);
  const farH=w.hens.filter(h=>Math.hypot(h.x-wx,h.z-h0.z)>W.HEN.alert+1);ok(farH.length>0&&farH.every(h=>h.state==='yard'),'먼 닭은 마당에 남음 '+farH.map(h=>h.state))}
 /* 찍기 막기·읽기 속도 */
 {const q=Q.get(8,'story',0),need=C.needSeconds(q),at=Math.ceil(C.FAST_MIN*need/C.TICK);
  eq([C.guard(q,0),C.guard(q,at),C.guard(q,undefined)],[C.GUARD.floor,1,1],'찍기 막기: 바로 누르면 75%, 번개를 받을 수 있는 때부터 100%, 시간을 모르면 100%');
  ok(C.isFast(q,at)===C.isFast(q,at)&&C.guard(q,at)===1,'번개 시작과 찍기 막기 기준이 같음');
  const s=S({chickens:3}),a=C.income(s,q,false,0).gold,b=C.income(s,q,false,9999).gold;ok(a<b&&a>=Math.floor(b*C.GUARD.floor)-1,'찍기 금화 '+a+' < 읽기 금화 '+b);
  const p=S(),tk=Math.round(need*2/C.TICK);C.trackPace(p,q,tk);eq([p.pace,p.paced],[150,1],'읽기 속도: 처음엔 절반씩 따라감');C.trackPace(p,q,tk);C.trackPace(p,q,tk);C.trackPace(p,q,tk);eq(p.paced,4,'갱신 횟수');ok(p.pace>185&&p.pace<200,'넷째부터는 천천히 '+p.pace);
  const r=C.restore(JSON.parse(JSON.stringify({version:1,...S({seed:12345,paced:2})})),Q.AGES);eq([r.seed,r.paced],[12345,2],'씨앗·읽기 속도 갱신 횟수 저장')}
}
/* 펑(스플래시)은 늑대만 맞힌다: 울타리·건물 위에서 터져도 체력은 그대로, 울타리를 부수는 늑대를 빨리 쓰러뜨려 오히려 지켜 준다(0.10.1 프로듀서 질문) */
{const S0=o=>Object.assign(C.fresh(8),o||{});
 {const s=S0({level:4,fence:6,power:3}),w=W.sync(W.create({seed:5,interval:3000}),s);w.trickle=1e9;w.wave.arrive=1e9;const bs=w.buildings.slice(),hp0=bs.map(b=>b.hp);
  for(const b of bs)w.arrows.push({id:w.nextId++,tower:0,wolf:-1,fx:0,fz:0,tx:b.x,tz:b.z,t:1,total:1,damage:50,splash:1.9,share:.75});for(let i=0;i<3;i++)W.step(w,s);
  eq(bs.map(b=>b.hp),hp0,'펑이 울타리·건물 위에서 터져도 체력은 그대로')}
 const fenceLeft=power=>{const s=S0({level:4,fence:6,chickens:4,power}),w=W.sync(W.create({seed:77,interval:3000}),s);w.trickle=1e9;w.wave.arrive=1e9;const f=w.buildings.find(b=>b.kind==='fence'&&b.side===0);
  for(let i=0;i<8;i++)w.wolves.push({id:w.nextId++,kind:'wolf',x:f.x+(i%4-1.5)*.5,z:f.z+Math.floor(i/4)*.4,sx:20,sz:0,hp:200,max:200,speed:1,state:'smash',target:f.id,timer:0,inside:0,hen:0});
  let m=f.hp;for(let t=0;t<120;t++){if(t%20===0)W.volley(w,s,{scale:2});W.step(w,s);m=Math.min(m,f.hp)}return m};
 ok(fenceLeft(3)>fenceLeft(0),'같은 늑대 무리에도 펑 강화가 있으면 울타리가 덜 상함 '+fenceLeft(0)+' → '+fenceLeft(3))}
/* 화면: 새 판 보호·씨앗·찍기 막기·틀린 문제 읽기 속도 */
a=fresh();a.go();eq([a.game().calm,a.game().keep],[W.GUARD.calm,true],'새 판은 보호 3번·마지막 닭 지킴');ok(a.game().seed>0,'판마다 문제 순서 씨앗');
eq(a.game().round.id,Q.at(8,'story',0,a.game().seed).id,'화면 문제 = Questions.at(나이, 모드, 번호, 씨앗)');
a.unlock();a.right();eq(a.game().calm,W.GUARD.calm-1,'한 번에 맞히면 보호가 줄어듦');
a=seed({index:5});a.go();ok(a.game().seed>0,'예전 저장(씨앗 없음)은 이어할 때 씨앗을 받음');
a=fresh();a.go();a.unlock();{const q=a.api.round.q,g0=a.api.state.gold,exp=C.income(a.api.state,q,false,a.api.round.t).gold,full=C.income(a.api.state,q,false,9999).gold;a.rightNow();
 eq(a.api.state.gold-g0,exp,'바로 찍어 맞히면 찍기 막기 금화');ok(exp<full,'찍기 금화 '+exp+' < 읽고 맞힌 금화 '+full)}
a=fresh();a.go();a.unlock();a.tick(40);{const q=a.api.round.q,t=a.api.round.t,s=JSON.parse(JSON.stringify(a.api.state));C.trackPace(s,q,t);a.wrong(0);eq([a.api.state.pace,a.api.state.paced],[s.pace,1],'틀려도 첫 고르기까지의 시간으로 읽기 속도 갱신')}
/* 효과음 예산: 여럿이 한꺼번에 쓰러져도 깨갱은 0.3초 간격, 정답 직후 1초는 쉼 */
{const a=fresh();a.go();calmWorld(a);a.unlock();const w=a.api.world,t=w.buildings.find(b=>b.kind==='tower');
 const put=n=>{for(let i=0;i<n;i++)w.wolves.push({id:w.nextId++,kind:'wolf',x:t.x+1+i*.05,z:t.z+.3,sx:20,sz:0,hp:1,max:1,speed:0,state:'hunt',target:0,timer:0,inside:0,hen:0})};
 put(12);const y0=a.game().sfx.yelp|0,k0=w.stats.kills;W.volley(w,a.api.state,{scale:3});a.tick(8);const kills=w.stats.kills-k0,y=(a.game().sfx.yelp|0)-y0;
 ok(kills>=6,'(일제 사격으로 여럿 쓰러짐 '+kills+')');ok(y>=1&&y<=3,'깨갱은 0.3초 간격: '+kills+'마리에 '+y+'번');
 a.tick(20);put(12);const y1=a.game().sfx.yelp|0,k1=w.stats.kills;a.rightNow();a.tick(9);ok(w.stats.kills-k1>=1,'(정답 일제 사격으로 쓰러짐 '+(w.stats.kills-k1)+')');eq((a.game().sfx.yelp|0)-y1,0,'정답 직후 1초는 깨갱 쉼(정답 소리가 묻히지 않게)')}
/* 7세·8세 퀴즈 모두 듣기 없이 바로 풀이 */
{const SEED=777;let i7=0;while(Q.at(7,'story',i7,SEED).mode!=='quiz')i7++;let i8=0;while(Q.at(8,'story',i8,SEED).mode!=='quiz')i8++;
 let a=seed({age:7,mode:'story',index:i7,seed:SEED});a.go();eq([a.api.phase,a.api.round.q.mode],['ask','quiz'],'7세 퀴즈는 바로 풀이');
 a=seed({age:8,mode:'story',index:i8,seed:SEED});a.go();eq([a.api.phase,a.api.round.q.mode],['ask','quiz'],'8세 퀴즈도 바로 풀이')}
/* 9세 이상 읽기: 놓친 뒤 기다림은 질문·정답 분량만(지문 제외) */
{const a=seed({age:9,mode:'story'});a.go();a.unlock();a.wrong(0);a.tick(C.DASH_TICKS);a.wrong(1);eq(a.api.phase,'learn','(배우기)');
 const q=a.api.round.q,lt=C.learnTicks(q);eq(a.api.round.learn,lt,'두 번 틀리면 질문·정답을 볼 시간만큼');ok(lt<C.learnTicks({...q,age:8}),'지문까지 볼 때보다 짧음');a.tick(lt);ok(a.api.round.ready,'(기다린 뒤 초록 답)');a.right();eq(a.api.phase,'ask','초록 답을 누르면 다음 문제')}
/* 시작 화면에서 고른 나이로 무리 간격(전: 페이지를 연 때의 8세 값으로 고정) */
{const a=fresh();a.n.ageRow.children.find(b=>b.dataset.age==='10').click();a.go();
 eq([a.api.state.age,a.api.state.mode,a.api.world.interval,a.api.world.wave.arrive],[10,'story',ivFor(10),ivFor(10)],'새 판은 고른 나이의 무리 간격으로 시작');
 const b=fresh();b.n.ageRow.children.find(x=>x.dataset.age==='7').click();b.go();eq(b.api.world.interval,ivFor(7),'7세를 고르면 7세 간격');ok(ivFor(10)>ivFor(7),'(10세 간격이 7세보다 김)')}
/* '모아서 회관을 키워 봐요'는 회관 값의 절반을 모은 뒤에만 */
a=seed({age:7,mode:'story',level:5,fence:4,chickens:4,gold:0},{rec:'real'});a.go();calmWorld(a);eq(answerLand(a),0,'회관 값의 절반 전에는 모으자 말풍선 없음');
a.tick(250);a.api.state.gold=70;eq(answerLand(a),1,'절반을 넘으면 띄움');eq(a.bubble(),C.LINES.hallSave,'(모으자 말풍선)');

eq(spoken,0,'검사 전체에서 음성 합성(speechSynthesis)을 한 번도 부르지 않음');
console.log('PASS '+checks+' rule + simulated DOM assertions. Not browser/audio/device validation.');
