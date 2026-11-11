/* node test-dom.cjs : 0.6 규칙(combat.js) 검사 + 가짜 DOM 위에서 실제 게임 스크립트(index.html 인라인)를 틱 단위로 돌리는 흐름 검사.
   브라우저·실제 음성·기기 검증이 아니다(그건 test.cjs와 실기기). */
const fs=require('fs'),assert=require('node:assert/strict'),C=require('./combat.js'),Q=require('./questions.js');
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

/* 1-7 유인 구조 시뮬: 같은 벽시계 시간에 '제 나이 보통 속도로 읽는 아이'가 '찍는 아이'보다 훨씬 많이 번다.
   읽기 속도·정확도·화면 시간은 가정값이다(실제 아이 관찰로 보정할 것). */
{let seed=7;const rnd=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648};
 const RATE={7:{typ:60,slow:30},8:{typ:120,slow:70},9:{typ:180,slow:120},10:{typ:230,slow:160}};
 const need=(q,r)=>{const rps=r/60,n=q.choices.length,cc=q.choices.reduce((s,c)=>s+C.syl(c),0),p=C.syl(q.passage);
  return q.mode==='sound'?1+cc/rps+.4*n:1.5+p/rps+(q.age===7?0:C.syl(q.prompt)/rps)+cc/rps+.4*n+(q.age>=9?.3*p/rps:0)};
 function play(age,mode,kind,minutes){
  const s=C.fresh(age);s.mode=mode;let clock=0,earned=0;
  while(clock<minutes*60){
   const q=Q.get(age,mode,s.index),T=C.limit(q,s)/10,n=q.choices.length,lock=C.reveal(q)/10;
   if(mode==='sound')clock+=1+C.syl(q.speak)/4.5;
   let t,ok1,out,timeout=false;
   if(kind==='guess'){t=lock+.4;ok1=rnd()<1/n}else{t=Math.max(lock+.3,need(q,RATE[age][kind])*(.75+rnd()*.5));ok1=rnd()<(kind==='typ'?.85:.75)}
   if(t>=T){out='miss';timeout=true;t=T}else if(ok1)out='first';else{const left=T-t-C.DASH*T;
    if(left<=0){out='miss';t=T}else{const t2=kind==='guess'?.4:need(q,RATE[age][kind])*.35,ok2=kind==='guess'?rnd()<1/(n-1):rnd()<.8;if(t2>=left){out='miss';timeout=true;t=T}else{out=ok2?'second':'miss';t+=C.DASH*T+.8+t2}}}
   clock+=t;const fast=out==='first'&&(T-t)/T>=C.FAST,res=C.settle(s,q,out,{fast,timeout});
   if(out==='first'){earned+=res.gold;clock+=1.8+(kind==='guess'?.8:2.5);const o=C.offers(s).filter(k=>k&&C.canBuy(s,k));if(o.length){C.buy(s,o[0]);clock+=1}}
   else clock+=(out==='miss'?1.2:0)+C.syl(C.lesson(q))/4.5+1.2+(kind==='guess'?.4:1);
   s.index++}
  return earned}
 const avg=(a,m,k,min)=>{let t=0;for(let i=0;i<40;i++)t+=play(a,m,k,min);return t/40};
 /* 느린 아이 = 제 나이 보통 속도의 50~70%. 도움 단계가 쌓이는 20분 기준으로 본다. 8세 읽기는 사실상 7세 수준이라 제외(나이를 낮추도록 안내). */
 for(const a of Q.AGES)for(const m of Q.MODES){const g=avg(a,m,'guess',10),typ=avg(a,m,'typ',10);
  ok(typ>g*2,`${a}세 ${m}: 보통 아이(${typ.toFixed(0)}) > 찍기(${g.toFixed(0)})×2 (10분)`);
  if(!(a===8&&m==='story')){const g2=avg(a,m,'guess',20),slow=avg(a,m,'slow',20);ok(slow>g2,`${a}세 ${m}: 느린 아이(${slow.toFixed(0)}) > 찍기(${g2.toFixed(0)}) (20분)`)}}}

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
 const api=new Function('document','window','localStorage','setInterval','setTimeout','confirm','Combat','Questions','SpeechSynthesisUtterance','performance',
  src+'\nreturn {get state(){return state},get phase(){return phase},get round(){return round},get paused(){return paused},get voiceOff(){return voiceOff},render};')
  (document,window,localStorage,f=>{intervals.push(f);return intervals.length},()=>0,()=>true,C,Q,U,undefined);
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

/* 2-1 시작 화면과 시계 */
let a=fresh();
eq(a.intervals.length,1,'시계 인터벌은 1개');eq(a.api.phase,'start','처음엔 시작 화면');ok(!a.n.start.hidden,'시작 화면 보임');
eq(a.n.ageRow.children.map(b=>b.textContent),['7살','8살','9살','10살'],'시작 화면 나이 4칸');
a.tick(30);eq(a.api.round,null,'시작 화면에서는 문제·늑대 없음');
for(const id of ['battle','next','shield','combatInfo','buildPrompt','buyChicken','buyFence'])ok(!html.includes('id="'+id+'"'),'0.5 요소 제거: '+id);
ok(!html.includes('소리 도움말'),'정답을 글자로 보여 주던 소리 도움말 제거');
ok(html.includes('src="combat.js?v=0.6"')&&html.includes('src="village.js?v=0.6"'),'캐시 갱신용 ?v=0.6');
a.go();ok(a.n.start.hidden,'시작하면 시작 화면 닫힘');eq(a.api.phase,'ask','소리 모드: 다 들은 뒤 시계 시작');eq(a.speakLog[0],Q.get(8,'sound',0).speak,'문제 소리를 읽어 줌');
shows(a,8,'sound',0,'시작');
let T=a.api.round.T;eq(T,C.limit(Q.get(8,'sound',0),a.api.state),'제한시간 = 규칙');eq(a.n.timeFill.style.width,'100%','시간 바 가득');
a.tick(10);eq(a.api.round.t,10,'10틱 = 1초 진행');eq(a.n.timeFill.style.width,(Math.round((1-10/T)*1000)/10)+'%','시간 바 줄어듦');eq(a.n.wolfHead.style.left,a.n.timeFill.style.width,'늑대 머리가 시간 바 끝에');
ok(Math.abs(a.window.getVillageState().progress-10/T)<1e-9,'3D 마을이 읽는 늑대 위치 = 경과/제한');
eq(a.n.timebar.dataset.zone,'fast','앞부분은 번개 구간');

/* 2-2 듣는 동안 시계 멈춤, 음성 실패 처리 */
a=fresh({tts:'manual'});a.go();eq(a.api.phase,'listen','듣는 중');a.tick(40);eq(a.api.round.t,0,'듣는 동안 시계·늑대 멈춤');ok(a.n.answers.classList.contains('veiled'),'듣는 동안 보기 가림');
a.speechEnd();eq(a.api.phase,'ask','다 들으면 시작');ok(!a.n.answers.classList.contains('veiled'),'보기 보임');ok(!a.n.speak.classList.contains('hidden'),'소리 모드: 다시 듣기 버튼');
a.n.speak.click();a.tick(5);ok(a.api.round.t>=5,'다시 듣는 동안에는 시계가 흐름');
a=fresh({tts:'none'});a.go();eq([a.api.voiceOff,a.api.state.mode,a.api.phase],[true,'story','ask'],'음성 없음 → 읽고 고르기로 전환');ok(a.n.feedback.textContent.includes('소리'),'전환 안내');
a=fresh({tts:'never'});a.go();eq(a.api.phase,'listen','음성이 시작 안 됨');a.tick(31);eq([a.api.voiceOff,a.api.state.mode],[true,'story'],'3초 안에 시작 안 하면 음성 실패 처리');
a=fresh({tts:'error'});a.go();eq(a.api.state.mode,'story','음성 오류 → 읽고 고르기');

/* 2-3 읽기 모드 '글 먼저 읽기'와 읽기 중 듣기 금지 */
a=seed({age:9,mode:'story'});a.go();shows(a,9,'story',0,'9세 읽기');
ok(a.api.round.lock>3,'글 먼저 읽기 잠금');ok(a.n.answers.classList.contains('veiled'),'잠금 중 보기 가림');ok(a.n.speak.classList.contains('hidden'),'읽기 모드 풀이 중 듣기 버튼 없음');
eq(a.speakLog.length,0,'읽기 모드는 문제를 읽어 주지 않음');
a.right();eq(a.api.phase,'ask','잠금 중에는 눌러도 무시');const lock=a.api.round.lock;a.unlock();eq(a.api.round.t,lock,'잠금 동안에도 시계는 흐름');ok(!a.n.answers.classList.contains('veiled'),'잠금 끝나면 보기');

/* 2-4 한 번에 정답 → 멈춤 → 카드 → 다음 문제 */
a=fresh({view:true});a.go();a.tick(3);
let g0=a.api.state.gold,exp=C.income(a.api.state,a.api.round.q,true).gold;a.right();
eq(a.api.phase,'pick','한 번에 정답 → 카드 고르기');eq(a.api.state.gold,g0+exp,'번개 정답 금화');ok(a.n.gainLine.textContent.includes('+'+exp),'받은 금화 표시');
ok(a.events.some(e=>e.type==='shoot')&&a.events.some(e=>e.type==='produce'&&e.eggs===1),'3D: 타워 발사 + 알 팔기 연출');
const tStop=a.api.round.t,wStop=a.n.timeFill.style.width;a.tick(80);eq(a.api.round.t,tStop,'고르는 동안 시계 멈춤');eq(a.n.timeFill.style.width,wStop,'고르는 동안 늑대 멈춤');
eq(a.cards().length,3,'카드 3장');eq(a.cards().map(b=>b.dataset.kind),C.offers(a.api.state),'카드 = 규칙의 3장');ok(a.n.answers.classList.contains('hidden'),'보기 자리를 카드가 대신');
a=fresh();a.go();a.unlock();a.right();
const yay=a.btn(a.api.round.q.answer);ok(yay.classList.contains('yay')&&yay.classList.contains('correct'),'맞힌 보기가 통통 튐');ok(yay.children.some(x=>x.classList.contains('btn-ring'))&&yay.children.filter(x=>x.classList.contains('btn-star')).length===12,'맞힌 보기에 초록 고리와 별 12개');
ok(yay.children.some(x=>x.classList.contains('btn-yay')&&x.textContent==='⚡ 번개!'),'번개로 맞히면 보기 위에 ⚡ 번개!');
eq(a.cards().length,0,'0.7초 동안은 맞힌 보기 연출만(카드 없음, 두 번 누르기 방지)');ok(!a.n.answers.classList.contains('hidden'),'그동안 보기가 보임');
a.tick(6);eq(a.cards().length,0,'0.6초에도 아직');a.tick(1);eq(a.cards().length,3,'0.7초에 카드 3장');ok(a.n.answers.classList.contains('hidden'),'카드가 보기 자리를 대신');ok(!a.card('chicken').disabled,'카드 바로 누를 수 있음');eq(a.card('tower').disabled,a.api.state.gold<40,'금화가 모자란 카드는 잠김');
g0=a.api.state.gold;a.card('chicken').click();eq([a.api.phase,a.api.state.chickens,a.api.state.gold],['build',2,g0-25],'닭 데려오기');eq(a.api.state.index,1,'고르면 다음 문제로');
a.tick(12);eq(a.api.phase,'ask','짓는 연출 뒤 바로 다음 문제');shows(a,8,'sound',1,'다음 문제');eq(a.api.round.t,0,'새 시계');
/* 금화 모으기 */
a=fresh();a.go();a.unlock();a.right();a.tick(7);g0=a.api.state.gold;a.n.skip.click();eq([a.api.phase,a.api.state.gold,a.api.state.index],['build',g0,1],'금화 모으기 → 다음 문제');a.tick(3);eq(a.api.phase,'ask','곧 다음 문제');
/* 늦게 맞히면 번개 없음 */
a=fresh();a.go();T=a.api.round.T;a.tick(Math.ceil(T*.7));exp=C.income(a.api.state,a.api.round.q,false).gold;g0=a.api.state.gold;a.right();eq(a.api.state.gold,g0+exp,'늦게 맞히면 번개 없음');

/* 2-5 틀림 → 늑대 성큼 → 두 번째 정답(막기만) → 정답 누르고 다음 */
a=fresh({view:true});a.go();T=a.api.round.T;a.tick(5);a.wrong(0);
eq(a.api.round.tries,1,'한 번 틀림');ok(a.btn(a.wrongIndex(0)).classList.contains('wrong'),'틀린 보기 표시');ok(a.events.some(e=>e.type==='dash'),'3D: 늑대 성큼');
a.right();eq(a.api.phase,'ask','성큼 다가오는 동안은 못 누름');a.tick(C.DASH_TICKS);ok(Math.abs(a.api.round.t-(5+C.DASH*T))<1e-6,'늑대가 제한시간의 35%만큼 다가옴');
g0=a.api.state.gold;a.right();eq([a.api.phase,a.api.round.result,a.api.state.gold],['learn','second',g0],'두 번째 정답: 막기만, 금화 없음');eq(a.btn(a.api.round.q.answer).children.filter(x=>x.classList.contains('btn-star')).length,6,'두 번째 정답은 작은 연출(별 6개)');ok(a.cards().length===0||a.n.choices.classList.contains('hidden'),'카드 없음');
eq(a.speakLog.at(-1),C.lesson(a.api.round.q),'정답을 읽어 줌');a.btn(a.api.round.q.answer).click();eq(a.api.phase,'learn','다 읽기 전(1초)에는 안 넘어감');
a.tick(10);ok(a.api.round.ready,'읽고 나면 누를 수 있음');ok(a.btn(a.api.round.q.answer).classList.contains('tap-me'),'초록 답 깜빡임');
a.btn(a.wrongIndex(1)).click();eq(a.api.phase,'learn','다른 보기는 무시');a.right();eq([a.api.phase,a.api.state.index],['ask',1],'초록 답을 누르면 다음 문제');
/* 두 번 틀림 → 늑대 도착 → 닭이 숨음 */
a=fresh({view:true});a.go();a.unlock();a.wrong(0);a.tick(C.DASH_TICKS);a.wrong(1);
eq([a.api.phase,a.api.round.result,a.api.state.hidden,a.api.state.misses],['learn','miss',1,1],'두 번 틀리면 늑대가 와서 닭이 숨음');ok(a.events.some(e=>e.type==='raid'&&e.scared===1),'3D: 습격');
ok(a.n.feedback.textContent.includes('숨었'),'숨었다는 안내');eq(a.window.getVillageState().progress,1,'늑대는 마을에');eq(a.n.flockPill.textContent,'🐔 1 (🙈1)','숨은 닭 표시');
/* 정답을 안 누르면 다음 문제로 안 감(자리 비운 아이가 연달아 놓치지 않게) */
a.tick(500);eq([a.api.phase,a.api.state.misses],['learn',1],'손대지 않으면 그대로 기다림');
/* 시간 초과 2번 → 도움 */
a=fresh();a.go();let q0=a.api.round.q;a.tick(a.api.round.T);eq([a.api.phase,a.api.round.result,a.api.state.late],['learn','miss',1],'시간 초과');a.tick(10);a.right();
a.untilAsk();a.tick(a.api.round.T);eq(a.api.state.help,1,'시간 초과 2번 → 도움 1단계');a.tick(10);a.right();a.untilAsk();eq(a.api.round.T,C.limit(a.api.round.q,a.api.state),'도움이 제한시간에 반영');ok(a.api.round.T>C.limit(a.api.round.q,C.fresh(8)),'제한시간이 늘어남');
/* 성큼이 제한시간을 넘으면 그대로 도착 */
a=fresh();a.go();a.tick(a.api.round.T-3);a.wrong(0);a.tick(C.DASH_TICKS);eq([a.api.phase,a.api.round.result,a.api.state.late],['learn','miss',0],'틀린 뒤 늑대가 도착하면 시간 초과로 세지 않음');

/* 2-6 쉬기·탭 숨김 */
a=fresh();a.go();a.tick(4);a.n.pause.click();ok(a.api.paused&&a.document.body.classList.contains('paused'),'쉬기');ok(a.document.body.classList.contains('covered'),'쉬는 동안 문제를 가림(공짜 읽기 시간 방지)');
a.tick(50);eq(a.api.round.t,4,'쉬는 동안 시계 멈춤');a.right();eq(a.api.phase,'ask','쉬는 동안 못 누름');a.n.pause.click();a.tick(2);eq(a.api.round.t,6,'다시 흐름');
a=fresh({tts:'manual'});a.go();a.n.pause.click();eq(a.pending.length,0,'쉬면 읽기 멈춤');a.n.pause.click();eq(a.pending.length,1,'계속하면 다시 읽음');
a=fresh();a.go();a.hide(true);ok(a.api.paused,'탭이 숨으면 자동으로 쉬기');a.tick(20);eq(a.api.round.t,0,'숨은 동안 시계 멈춤');
a=fresh();a.go();a.unlock();a.right();a.n.pause.click();ok(!a.document.body.classList.contains('covered'),'카드 고르기는 가리지 않음');a.n.pause.click();a.tick(7);a.n.pause.click();a.card('chicken').click();eq(a.api.phase,'pick','쉬는 동안 못 삼');

/* 2-7 나이·모드 전환: 문제 중이면 바로 그 나이 문제로(늑대 위치 유지), 정답 뒤면 다음 문제부터 */
for(const age of Q.AGES)for(const mode of Q.MODES){
 a=seed({age,mode});a.go();shows(a,age,mode,0,`${age}세 ${mode} 시작`);
 for(const to of Q.AGES){if(to===age)continue;a.n.age.value=String(to);a.n.age.onchange();shows(a,to,mode,0,`${age}→${to}세 전환`);eq(a.api.state.age,to,'저장되는 나이')}
}
a=seed({index:3});a.go();a.tick(20);let frac=a.api.round.t/a.api.round.T;a.n.age.value='10';a.n.age.onchange();shows(a,10,'sound',3,'문제 중 전환');ok(Math.abs(a.api.round.t/a.api.round.T-frac)<.02,'늑대 위치 비율 유지');
a.n.mode.click();shows(a,10,'story',3,'모드 전환');eq(a.n.mode.textContent,'🔊 듣고 고르기로','모드 버튼 문구');
a=fresh();a.go();a.unlock();a.right();a.n.age.value='7';a.n.age.onchange();shows(a,8,'sound',0,'정답 뒤에는 그대로');ok(a.n.feedback.textContent.includes('다음 문제부터 7세'),'다음부터 적용 안내');a.tick(7);a.n.skip.click();a.tick(3);shows(a,7,'sound',1,'다음 문제는 7세');
/* 같은 문항이 다시 돌아오면 보기 순서가 바뀜 */
a=seed({index:Q.count(8,'sound')});a.go();const lap1=a.n.answers.children.map(b=>b.dataset.i).join();eq(lap1,Q.get(8,'sound',0).choices.map((_,i)=>String((i+1)%3)).join(),'두 바퀴째는 보기를 한 칸 돌림');

/* 2-8 저장·복원 */
a=fresh();a.go();a.tick(7);a.right();g0=a.api.state.gold;a.tick(2);
let b=boot();eq(b.n.go.textContent,'이어서 하기 ▶','하던 문제가 있으면 이어서 하기');b.go();eq([b.api.phase,b.api.state.gold],['pick',g0],'카드 고르기로 복원, 금화 이중 지급 없음');eq(b.cards().length,3,'복원하면 카드가 바로');b.card('chicken').click();eq(b.api.state.chickens,2,'복원 뒤 구매');
a=fresh();a.go();a.tick(33);a.n.pause.click();b=boot();b.go();eq([b.api.phase,b.api.round.t],['ask',33],'문제 중 저장 → 같은 시계로 복원');
a=fresh();a.go();a.tick(a.api.round.T);b=boot();b.go();eq(b.api.phase,'learn','놓친 문제는 정답 보기부터');b.tick(10);b.right();eq(b.api.state.index,1,'복원 뒤 다음 문제');
saved={[KEY]:JSON.stringify({version:1,gold:77,hp:30,level:1,wins:4,index:2,mode:'sound',age:9,chickens:0,fence:1,claimed:'sound:2',completed:null,combat:{stage:2,done:false}})};
b=boot();b.go();eq([b.api.state.gold,b.api.state.level,b.api.state.chickens,b.api.state.index,b.api.phase],[77,1,1,3,'ask'],'0.5 저장으로 시작');shows(b,9,'sound',3,'0.5 저장 다음 문제');
saved[KEY]='broken';b=boot();b.go();eq(b.api.state.gold,20,'깨진 저장 → 새 판');shows(b,8,'sound',0,'깨진 저장은 8세부터');
a=fresh();a.go();a.unlock();a.right();b=boot();eq(b.api.phase,'start','다시 열면 시작 화면');const before=JSON.parse(saved[KEY]).round;ok(before&&before.phase==='pick','저장된 하던 문제');
b.unload();eq(JSON.parse(saved[KEY]).round,before,'시작 화면에서 떠나도 하던 문제를 지우지 않음');

/* 2-9 처음부터·움직임 줄이기·3D 상태 */
a=seed({gold:500,level:3,chickens:5});a.go();a.n.reset.click();eq([a.api.state.gold,a.api.state.level,a.api.state.chickens,a.api.state.index],[20,0,1,0],'처음부터');
a=fresh();a.n.motion.checked=true;a.n.motion.onchange();ok(a.document.body.classList.contains('reduced'),'움직임 줄이기');
a=fresh({view:true});a.go();a.unlock();a.right();a.tick(7);a.card('chicken').click();eq(a.built,['chicken'],'3D 마을에 지은 것 전달');
const vs=a.window.getVillageState();for(const k of ['phase','paused','level','chickens','hidden','fence','farmers','pond','hall','feast','wins','wolves','progress','tries','dash','result','raid'])ok(k in vs,'getVillageState.'+k);
eq(vs.phase,'build','짓는 중 상태');
/* 카드를 사면 그림 마을에도 바로 나타남(3D 없는 기기) */
a=fresh();a.go();a.unlock();a.right();a.tick(7);a.card('chicken').click();eq(a.n.flock.children.length,2,'그림 마을 닭 2마리');ok(a.n.effects.children.some(x=>x.classList.contains('fx-label')),'이름표 연출');
a=fresh({reduced:true});a.go();a.unlock();a.right();ok(a.n.effects.children.some(x=>x.classList.contains('sale')),'움직임 줄이기에서도 알 판매 글자 띠');ok(!a.btn(a.api.round.q.answer).children.some(x=>x.classList.contains('btn-star')),'움직임 줄이기: 보기 별 없음');a.tick(7);a.card('chicken').click();ok(!a.n.effects.children.some(x=>x.classList.contains('fx-star')),'움직임 줄이기: 별 입자 없음');

/* 2-10 긴 판: 무작위로 맞히고 틀리고 사는 120문제 동안 규칙 불변식 */
{a=fresh();a.go();let r=11;const rnd=()=>{r=(r*1103515245+12345)%2147483648;return r/2147483648};
 for(let step=0;step<120;step++){
  a.untilAsk();const st=a.api.state;ok(st.gold>=0&&st.hidden<=st.chickens&&st.chickens>=1,'불변식 '+step);
  const roll=rnd();if(roll<.6){a.unlock();a.right()}else if(roll<.8){a.unlock();a.wrong(0);a.tick(C.DASH_TICKS);if(rnd()<.5)a.right();else a.wrong(1)}else a.tick(a.api.round.T);
  if(a.api.phase==='pick'){a.tick(7);const can=a.cards().filter(b=>!b.disabled&&b.dataset.kind);if(can.length)can[Math.floor(rnd()*can.length)].click();else a.n.skip.click()}
  else if(a.api.phase==='learn'){a.tick(200);a.right()}
 }
 ok(a.api.state.index>=118,'120문제 진행');ok(C.built(a.api.state)>0,'무언가 지음');}

console.log('PASS '+checks+' rule + simulated DOM assertions. Not browser/audio/device validation.');
