/* 0.14.1 프로듀서용 테스트 모드. 주소에 ?test=1이 있을 때만 index.html이 이 파일을 불러온다(없으면 불러오지도 않는다). 아이 화면에는 아무것도 없다.
   화면 아래 막대:
   - 다음 ▶: 지금 문제를 아이가 읽는 데 걸릴 시간(아이 속도 × Combat.needSeconds)이 아직 안 지났으면, 남은 시간만큼 세계를 빨리 감은 뒤(약 1초, 여러 프레임에 나눠서
     늑대가 걷고 알이 쌓이는 것이 보이게) 정답 보기를 누른다. 이미 지났으면 바로 누른다. 정답 배우기·정답 연출에서는 남은 기다림을 감고 넘어가고,
     시작 화면은 '시작하기', 엔딩 카드는 '새 마을로 떠나기'를 누른다.
   - 틀리기: 같은 방식으로 시간을 채운 뒤 틀린 보기 하나를 누른다(실수 흉내).
   - 아이 속도 느림·보통·빠름 = 보통 아이 필요 시간 × 1.8 · 1 · 0.62. 두 번째 고르기는 그 × 0.35.
     근거: 시뮬(scripts/sim-flow.cjs · sim-village.cjs)의 아이 모형 SPEEDK와 두 번째 고르기 시간. 테스트 모드는 흔들림(× 0.75~1.25) 없이 고정값을 쓴다.
   - 자동 넘기기: 빨리 감기 없이, 읽는 시간이 실제 시계로 지난 순간 저절로 정답(정답 배우기도 초록 답이 열리면 저절로).
   - 🗺️ 단계로: 농가 · 마을 · 장터 마을 · 물레방아 마을 · 성곽 마을 · 성 · 결전 직전(종 열림) 가운데 고르면, 지금 나이로 그 단계에 막 들어선 마을에서 새로 시작(확인 한 번).
   - 📊 성능 표시(기본 켬): 막대 위 작은 글에 FPS · 3D 그리기 호출 · 삼각형 · 지금 단계. 그림 화면이면 '그림 화면'. 0.5초에 한 번 화면 쪽 숫자만 읽는다.
     0.15.2: 마을(단계 1)부터는 끝에 지금 무리의 대형(🐺 곧장 · 휘어 오기 · 갈라지기 · 따라 돌기, 대형을 끄면 '대형 끔')을 붙인다.
   - 🐺 무리 부르기(0.15.2): 다음 무리를 지금 숲에 내보낸다(World.callPack, 다음 틱에 나온다). 대형 차례는 무리 번호를 따르므로 4~7번 부르면 넷이 다 나온다.
   - 🗺️ 칸 맨 끝 "🐺 대형 끄기/켜기"(0.15.2): Combat.FLAGS.FORMS를 같은 탭에서 바로 바꾼다(새로고침 없음). 끄면 걷던 대형 늑대도 곧게 걷고, 켜면 다음 무리부터.
     막대 자리가 모자라(패드 세로 820에서 남는 폭 약 70px) 버튼은 🐺 하나만 두고 켬/끔은 메뉴에 넣었다. 저장하지 않는다(새로고침하면 주소 ?forms=0 또는 기본 켬).
   게임은 이 답을 그 시간에 푼 답으로 센다: 빨리 감기는 게임의 tick()(검사 훅 window.__tick과 같은 길)을 돌려 round.t가 실제 틱으로 흐르고,
   누르는 것은 화면의 보기 버튼이라 찍기 막기(Combat.guard)·읽기 속도(trackPace)·번개(isFast) 판정이 아이가 그 시간에 누른 것과 같다.
   규칙·세계 숫자는 건드리지 않는다. 가게는 사람이 직접 산다(자동 구매 없음). 저장은 index.html이 '-test' 열쇠로 따로 한다.
   시계를 세운 검사(__HOLD_CLOCK)에서는 빨리 감기 프레임을 스스로 돌리지 않는다. 검사가 window.__testmode.frame()·drain()으로 돌린다. */
(function(){
 'use strict';
 if(typeof TEST==='undefined'||!TEST||window.__testmode)return;
 const SPEED={slow:{k:1.8,name:'느림'},typ:{k:1,name:'보통'},fast:{k:.62,name:'빠름'}},ORDER=['slow','typ','fast'];
 const RETRY=.35;      /* 두 번째 고르기 = 읽는 시간 × 0.35(시뮬 아이 모형) */
 const AFTER_LOCK=4;   /* 보기가 열린 뒤 적어도 0.4초 뒤에 누른다(시뮬: 잠금 + 0.4초) */
 const FF_FRAMES=54,FF_MS=900; /* 빨리 감기: 약 0.9초에 걸쳐(60fps에서 54프레임, 느린 기기는 시간 기준으로 더 많이씩) */
 const OPT_KEY=KEY+'-opts';
 const opt={speed:'typ',auto:false,perf:true};
 try{const o=JSON.parse(localStorage.getItem(OPT_KEY));if(o&&typeof o==='object'){if(SPEED[o.speed])opt.speed=o.speed;opt.auto=!!o.auto;if('perf' in o)opt.perf=!!o.perf}}catch{}
 const saveOpt=()=>{try{localStorage.setItem(OPT_KEY,JSON.stringify(opt))}catch{}};
 /* job: 진행 중인 빨리 감기 · last: 마지막으로 누른 답(게임이 매긴 값) · done: 마지막 빨리 감기(틱·프레임 수) */
 const T={job:null,last:null,done:null,note:'',tok:null,wrongAt:null,nudged:false,form:null,packs:0};/* form: 마지막으로 나온 무리의 대형(0~3, 대형 없이 나왔으면 null) · packs: 나온 무리 수 */
 const sec=t=>(Math.max(0,t|0)/10).toFixed(1);
 const set=(e,v)=>{if(e.textContent!==v)e.textContent=v};
 const el=(tag,attrs,text)=>{const e=document.createElement(tag);for(const k in attrs||{}){if(k==='class')e.className=attrs[k];else e.setAttribute(k,attrs[k])}if(text!==undefined)e.textContent=text;return e};
 const buttonOf=i=>answerButtons().find(b=>Number(b.dataset.i)===i);

 /* ---------- 읽는 시간 ---------- */
 /* 이 문제에서 누를 때(round.t 틱). 첫 고르기 = max(보기 잠금 + 0.4초, 필요 시간 × 아이 속도), 두 번째 = 틀린 때 + 필요 시간 × 아이 속도 × 0.35(최소 0.4초) */
 function target(){
  const q=round.q,k=SPEED[opt.speed].k,need=Combat.needSeconds(q);
  if(!round.tries)return Math.max(Math.max(3,Combat.reveal(q))+AFTER_LOCK,Math.round(need*k/Combat.TICK));
  const at=T.tok===round.token&&T.wrongAt!==null?T.wrongAt:round.t;
  return at+Math.max(AFTER_LOCK,Math.round(need*k*RETRY/Combat.TICK));
 }
 const canAnswer=()=>phase==='ask'&&!!round&&round.lock<=0&&round.dash<=0&&round.t>=target();
 /* 틱마다: 틀린 순간(round.t)을 기억하고(두 번째 고르기 시간의 기준), 보기가 열리면 막대에 가리지 않게 한 번 올린다 */
 function watch(){
  if(phase!=='ask'||!round)return;
  if(T.tok!==round.token){T.tok=round.token;T.wrongAt=null;T.nudged=false}
  if(round.tries>=1&&T.wrongAt===null)T.wrongAt=round.t;
  if(!T.nudged&&round.lock<=0){T.nudged=true;nudge()}
 }
 function nudge(){try{const a=$('answers').getBoundingClientRect(),b=bar.getBoundingClientRect();if(a.height>0&&b.height>0&&a.bottom>b.top-6&&window.scrollBy)window.scrollBy(0,Math.ceil(a.bottom-b.top+10))}catch{}}

 /* ---------- 누르기: 화면의 보기 버튼을 누르고, 게임이 매긴 결과를 적어 둔다 ---------- */
 function press(i,kind){
  const b=buttonOf(i);if(!b||b.disabled){T.note='그 보기를 지금은 누를 수 없어요';return false}
  const r=round,q=r.q,t=r.t,tries=r.tries,ask=phase==='ask';
  T.note='';b.click();
  if(ask)T.last={kind,t,need:Combat.needSeconds(q),speed:opt.speed,k:SPEED[opt.speed].k,tries,
   result:r.result||(r.tries>tries?'wrong':null),guard:r.info&&Number.isFinite(r.info.guard)?r.info.guard:null,fast:Combat.isFast(q,t),pace:state.pace,id:q.id};
  return true;
 }
 /* 아직 고르지 않은 틀린 보기(화면 순서로 첫 번째). live = 지금 누를 수 있는 것만 */
 function wrongChoice(live){const b=answerButtons().find(x=>Number(x.dataset.i)!==round.q.answer&&!x.classList.contains('wrong')&&(!live||!x.disabled));return b?Number(b.dataset.i):-1}

 /* ---------- 빨리 감기 ---------- */
 function estimate(kind){
  if(kind==='reward')return Math.max(1,round.wait|0);
  if(kind==='learn')return Math.max(1,round.learn|0);
  return Math.max(0,target()-round.t)+Math.max(0,round.dash|0);
 }
 function start(kind){
  const est=estimate(kind);
  const j={kind,token:round.token,phase,ran:0,frames:0,est,per:Math.max(1,Math.ceil(est/FF_FRAMES)),cap:est+120};
  T.job=j;T.note='';
  if(check(j))return true;/* 이미 읽는 시간이 지났으면 바로 */
  show();schedule();return true;
 }
 /* 끝났으면(눌렀거나 멈췄으면) true */
 function check(j){
  if(paused){stop('⏸️ 쉬는 중이라 멈췄어요');return true}
  if(j.kind==='reward'){if(phase!=='reward'){stop('');return true}return false}
  if(!round||round.token!==j.token||phase!==j.phase){stop('문제가 바뀌어 멈췄어요');return true}
  if(j.kind==='learn'){if(round.ready){stop('');press(round.q.answer,'learn');show();return true}return false}
  if(canAnswer()){stop('');
   if(j.kind==='wrong'){const i=wrongChoice(true);if(i<0)T.note='남은 틀린 보기가 없어요';else press(i,'wrong')}else press(round.q.answer,'right');
   show();return true}
  return false;
 }
 function stop(note){const j=T.job;if(j)T.done={kind:j.kind,ticks:j.ran,frames:j.frames,est:j.est};T.job=null;if(note)T.note=note;show()}
 const raf=typeof window.requestAnimationFrame==='function'?f=>window.requestAnimationFrame(f):f=>setTimeout(f,16);
 function schedule(){if(T.job&&!window.__HOLD_CLOCK)raf(ffFrame)}
 /* 한 프레임: 적어도 per틱, 화면 프레임이 느리면 시간 기준(0.9초)으로 따라잡는다. ts는 requestAnimationFrame이 줄 때만(검사의 frame()은 per틱씩) */
 function ffFrame(ts){
  const j=T.job;if(!j)return;j.frames++;
  let goal=j.ran+j.per;
  if(typeof ts==='number'){if(j.t0===undefined)j.t0=ts;goal=Math.max(goal,Math.ceil(j.est*Math.min(1,(ts-j.t0)/FF_MS)))}
  while(j.ran<goal&&j.ran<j.cap){if(check(j))return;baseTick();watch();j.ran++}
  if(check(j))return;
  if(j.ran>=j.cap){stop('빨리 감기를 멈췄어요');return}
  show();schedule();
 }

 /* ---------- 버튼 ---------- */
 function next(){
  if(T.job)return false;watch();
  if(paused){T.note='⏸️ 쉬는 중이에요. 계속하기를 누르세요';show();return false}
  if(phase==='start'){T.note='';$('go').click();show();return true}
  if(phase==='ending'){T.note='';$('endNew').click();show();return true}
  if(!round)return false;
  if(phase==='ask')return start('right');
  if(phase==='learn')return start('learn');
  if(phase==='reward')return start('reward');
  return false;
 }
 function wrong(){
  if(T.job||phase!=='ask'||!round)return false;watch();
  if(paused){T.note='⏸️ 쉬는 중이에요. 계속하기를 누르세요';show();return false}
  if(wrongChoice(false)<0){T.note='남은 틀린 보기가 없어요';show();return false}
  return start('wrong');
 }
 function setSpeed(s){if(!SPEED[s])return false;opt.speed=s;saveOpt();show();return true}
 function setAuto(v){opt.auto=!!v;saveOpt();show();return opt.auto}
 /* 자동 넘기기: 실제 시계로 읽는 시간이 지난 틱에 정답(빨리 감기 없음) */
 function autoStep(){
  if(paused||!round)return;
  if(phase==='ask'&&canAnswer())press(round.q.answer,'auto');
  else if(phase==='learn'&&round.ready)press(round.q.answer,'learn');
 }

 /* ---------- 단계로 바로 가기: 그 단계에 막 들어선 마을로 새로 시작(확인 한 번) ----------
    근거: scripts/stage-seeds.cjs(시뮬 sim-flow.cjs playEnd 그대로, 8세 보통 아이 · 한 번에 3개씩 · 12판)가 단계가 세계에 반영된 순간(문제 사이)과 종이 열린 순간에 찍은
    항목별 중앙값. level = 타워 수 − 1(시작 타워 2개 = 1), chickens = 닭 수, farmers = 산 농부 수(농부는 1 + farmers명), 회관은 넣지 않고 Combat.grow가 단계에서 정한다.
    항목별 중앙값의 합은 문턱과 1~2개 다를 수 있어, 지은 수(회관 뺌)를 그 나이 문턱에 꼭 맞게 비례로 맞춘다(최대 나머지 방식, 9·10세는 문턱이 낮아 같은 비율로 줄어든다).
    결전 직전 = 종 문턱(7·8세 66, 9세 50, 10세 46)에 꼭 맞게 지어 종이 막 열린 마을. 문제 번호·한 번에 맞힌 수도 같은 비율. 여우는 지나온 문턱(지은 수 20·40·55)만큼 이미 왔다가 쫓겨 간 것으로 */
 const JUMP_BASE={
  1:{level:1,fence:2,chickens:3,farmers:0,pond:0,power:0,gold:26,index:5,wins:5},
  2:{level:3,fence:5,chickens:8,farmers:0,pond:0,power:0,gold:54,index:17,wins:15},
  3:{level:5,fence:7,chickens:12,farmers:2,pond:0,power:1,gold:105,index:26,wins:22},
  4:{level:8,fence:9,chickens:17,farmers:4,pond:0,power:1,gold:158,index:35,wins:30},
  5:{level:15,fence:11,chickens:20,farmers:5,pond:1,power:1,gold:309,index:42,wins:36},
  bell:{level:19,fence:14,chickens:20,farmers:9,pond:3,power:1,gold:79,index:48,wins:41}};
 const JUMPS=[['0','🏡 농가'],['1','🏘️ 마을'],['2','🏪 장터 마을'],['3','💧 물레방아 마을'],['4','🧱 성곽 마을'],['5','🏰 성'],['bell','🔔 결전 직전(종 열림)']];
 const PARTS=[['level','tower',0],['fence','fence',0],['chickens','chicken',1],['farmers','farmer',0],['pond','pond',0],['power','power',0]];/* [상태 칸, 상품, 기본 수] */
 const hallTop=()=>Combat.FLAGS.STAGE_HALL.length;/* 성 단계의 회관(3) */
 /* 지은 수(회관 뺌) 목표: 단계 k의 그 나이 문턱, 결전 직전은 종 문턱 − 성 단계 회관 */
 const jumpTarget=(key,age)=>key==='bell'?Combat.bellBuilt({age})-hallTop():Combat.stageAt({age})[Number(key)];
 function jumpState(key,age){
  const s=Combat.fresh(age);s.seed=newSeed();s.run.t0=Date.now();if(key==='0')return s;
  const B=JUMP_BASE[key],T=jumpTarget(key,age),T8=jumpTarget(key,8),v=PARTS.map(([f,,b])=>Math.max(0,(B[f]|0)-b)),cap=PARTS.map(([,k])=>Combat.max(k)),S=v.reduce((a,x)=>a+x,0);
  /* 최대 나머지: 비례로 내린 정수 + 소수점이 큰 칸부터 1씩. 모자라면(목표가 더 크면) 많은 칸부터, 상한은 넘지 않는다 */
  const raw=v.map(x=>S>0?x*T/S:0),x=raw.map((r,i)=>Math.min(cap[i],Math.floor(r)));
  const order=raw.map((r,i)=>i).sort((i,j)=>(raw[j]-Math.floor(raw[j]))-(raw[i]-Math.floor(raw[i]))||v[j]-v[i]||i-j);
  let sum=x.reduce((a,y)=>a+y,0);
  for(const i of order){if(sum>=T)break;if(x[i]<cap[i]&&raw[i]>x[i]){x[i]++;sum++}}
  for(let guard=0;sum<T&&guard<500;guard++){const i=v.map((y,j)=>j).filter(j=>x[j]<cap[j]).sort((p,q)=>v[q]-v[p]||p-q)[0];if(i===undefined)break;x[i]++;sum++}
  if(x[0]<1){x[0]=1;sum++}/* 시작 타워(level 1)는 늘 있다 */
  for(let guard=0;sum>T&&guard<500;guard++){const i=x.map((y,j)=>j).filter(j=>j>0?x[j]>0:x[j]>1).sort((p,q)=>x[q]-x[p]||p-q)[0];if(i===undefined)break;x[i]--;sum--}
  PARTS.forEach(([f,,b],i)=>{s[f]=x[i]+b});
  const r=T8>0?T/T8:1;s.gold=B.gold;s.index=Math.round(B.index*r);s.wins=Math.min(s.index,Math.round(B.wins*r));
  Combat.grow(s);/* 회관(단계 2·4·5에서 1·2·3)과 종(결전 직전이면 열림) */
  const R=s.run,bn=Combat.builtNew(s);R.fox=(s.hall|0)>=Combat.FOX.needHall?Combat.FOX.at.filter(n=>bn>=n).length:0;R.foxSaved=R.fox;
  R.asked=s.index;R.first=s.wins;R.ok=[];R.miss=[];/* 판 기록(결전 문제는 여기서 맞힌·틀린 문제를 고른다): 7문제에 1개꼴로 틀림 */
  for(let i=0;i<s.index;i++)(i%7===3?R.miss:R.ok).push(i);R.ok=R.ok.slice(-Combat.CAPS.ok);R.miss=R.miss.slice(-Combat.CAPS.miss);
  return s;
 }
 function jump(key,ask){
  const J=JUMPS.find(j=>j[0]===String(key));if(!J||T.job)return false;
  if(ask!==false&&!confirm('🧪 '+J[1]+'에 막 들어선 마을로 새로 시작할까요?\n지금 테스트 판은 사라져요(아이 저장은 그대로예요).'))return false;
  state=jumpState(J[0],state.age);world=freshWorld();resetView();$('ending').hidden=true;$('start').hidden=true;
  T.last=null;T.tok=null;T.wrongAt=null;T.form=null;newRound();
  if(state.run.bell===1){syncKing(true);bellOpen()}
  T.note='🧪 '+J[1]+'에 막 들어선 마을로 시작했어요';save();render();show();return true;
 }

 /* ---------- 막대 ---------- */
 const css=
  '#testBar{position:fixed;left:0;right:0;bottom:0;z-index:60;display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:7px max(12px,env(safe-area-inset-right)) calc(7px + env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));background:#14231dee;color:#e9f3df;font-size:12px;line-height:1.35;box-shadow:0 -3px 0 #0003}'+
  '#testBar .tm-tag{flex:none;padding:3px 9px;border-radius:99px;background:#ffd84a;color:#3d2a00;font-weight:900;white-space:nowrap}'+
  '#testBar .tm-info{flex:1 1 120px;min-width:0;display:flex;flex-direction:column}#testBar .tm-info span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#testBar .tm-last{color:#b9cdb0}'+
  '#testBar .tm-label{flex:none;color:#b9cdb0;white-space:nowrap}#testBar .tm-speed{flex:none;display:flex;border:1px solid #d8c89e;border-radius:12px;overflow:hidden}'+
  '#testBar button{min-height:44px;padding:6px 12px;font-size:14px;border-radius:12px;color:#31503d;white-space:nowrap}'+
  '#testBar .tm-speed button{min-width:52px;border:0;border-radius:0;border-right:1px solid #d8c89e;padding:6px 10px}#testBar .tm-speed button:last-child{border-right:0}'+
  '#testBar .tm-speed button[aria-pressed="true"]{background:linear-gradient(#ffe7a0,#f2c44f);color:#4a3200}'+
  '#testBar #tmAuto[aria-pressed="true"]{background:linear-gradient(#d8f2d8,#8fd19a);border-color:#4f9a72}'+
  '#testBar #tmNext{min-width:112px;font-size:17px;background:linear-gradient(#4f9a72,#2d6650);color:#fff;border-color:#255741}'+
  '#testBar #tmPerfBtn{min-width:46px;padding:6px 8px}#testBar #tmPerfBtn[aria-pressed="true"]{background:linear-gradient(#e3ecff,#a9c3f2);border-color:#5d7fb8}'+
  '#tmPerf{position:fixed;right:10px;bottom:68px;z-index:60;padding:3px 9px;border-radius:9px;background:#14231dd9;color:#e9f3df;font:700 11.5px/1.4 system-ui,sans-serif;font-variant-numeric:tabular-nums;white-space:nowrap;pointer-events:none}#tmPerf[hidden]{display:none}'+
  'header .tm-head{white-space:nowrap;color:#ffd84a;font-weight:800}'+
  /* 막대 높이만큼: 장면을 줄여(가로 넓은 화면은 가게가, 세로 패드는 보기가 막대 위에 든다) 아래 여백과 보기 맞춤 여백을 준다. 폰(760 이하)은 깨지지 않게 여백만 */
  'html.test-mode{scroll-padding-bottom:78px}body.test-mode main{padding-bottom:86px}'+
  '@media(min-width:761px){body.test-mode .scene{height:clamp(380px,calc(100svh - 382px),760px)}}'+
  '@media(min-width:761px) and (max-height:800px){body.test-mode .scene{height:clamp(360px,calc(100svh - 364px),760px)}}'+
  '@media(min-width:760.02px) and (max-height:700px){body.test-mode .scene{height:300px;height:clamp(300px,calc(100svh - 304px),760px)}}'+
  '@media(min-width:761px) and (max-aspect-ratio:1/1){body.test-mode .scene{height:clamp(380px,calc(48svh - 64px),760px)}body.test-mode.long-read .scene{height:clamp(320px,calc(38svh - 64px),620px)}}'+
  '#testBar #tmJump{flex:none;min-height:44px;max-width:150px;padding:6px 8px;font-size:14px;font-weight:700;border-radius:12px;color:#31503d}'+
  /* 좁은 넓은 화면(패드 세로 820 등): 한 줄에 들도록 이름표는 🧪만(머리글에 '테스트 모드'가 있다), 글 칸·속도 칸을 줄인다 */
  '@media(max-width:1020px){#testBar .tm-label{display:none}#testBar .tm-tag{font-size:0;padding:3px 7px}#testBar .tm-tag:before{content:"🧪";font-size:14px}#testBar .tm-info{flex-basis:60px}#testBar .tm-speed button{min-width:44px;padding:6px 7px}#testBar #tmJump{max-width:104px}}'+
  '@media(max-width:760px){html.test-mode{scroll-padding-bottom:150px}body.test-mode main{padding-bottom:160px}#testBar{gap:6px;padding:6px 8px}#testBar .tm-info{flex-basis:100%;order:2}#testBar button{min-height:40px;padding:5px 9px}#testBar #tmNext{min-width:90px}#tmPerf{bottom:122px}}';
 {const st=el('style');st.textContent=css;(document.head||document.body).append(st)}
 document.body.classList.add('test-mode');try{document.documentElement.classList.add('test-mode')}catch{}
 const bar=el('div',{id:'testBar',role:'toolbar','aria-label':'테스트 모드'});
 const tag=el('b',{class:'tm-tag'},'🧪 테스트 모드');
 const info=el('span',{class:'tm-info'}),nowEl=el('span',{id:'tmNow'}),lastEl=el('span',{id:'tmLast',class:'tm-last'});info.append(nowEl,lastEl);
 const label=el('span',{class:'tm-label'},'아이 속도');
 const speedBox=el('span',{class:'tm-speed',role:'group','aria-label':'아이 속도'}),speedBtns={};
 for(const s of ORDER){const b=el('button',{type:'button','data-speed':s,title:'읽는 시간 = 보통 아이 필요 시간 × '+SPEED[s].k},SPEED[s].name);b.dataset.speed=s;b.onclick=()=>setSpeed(s);speedBtns[s]=b;speedBox.append(b)}
 const autoBtn=el('button',{type:'button',id:'tmAuto',title:'읽는 시간이 실제로 지나면 저절로 정답(빨리 감기 없음)'});autoBtn.onclick=()=>setAuto(!opt.auto);
 const wrongBtn=el('button',{type:'button',id:'tmWrong',title:'읽는 시간을 채운 뒤 틀린 보기를 눌러요'},'✖ 틀리기');wrongBtn.onclick=wrong;
 const nextBtn=el('button',{type:'button',id:'tmNext',title:'읽는 시간을 빨리 감은 뒤 정답을 눌러요'},'다음 ▶');nextBtn.onclick=next;
 const perfBtn=el('button',{type:'button',id:'tmPerfBtn',title:'성능 표시(FPS · 그리기 호출 · 삼각형 · 단계) 켜기/끄기','aria-label':'성능 표시'},'📊');perfBtn.onclick=()=>setPerf(!opt.perf);
 const jumpSel=el('select',{id:'tmJump','aria-label':'단계로 바로 가기',title:'그 단계에 막 들어선 마을로 새로 시작해요(확인 한 번)'});
 jumpSel.append(el('option',{value:''},'🗺️ 단계로'));for(const [k,n] of JUMPS)jumpSel.append(el('option',{value:k},n));
 jumpSel.onchange=()=>{const k=jumpSel.value;jumpSel.value='';if(k)jump(k)};
 bar.append(tag,info,label,speedBox,autoBtn,perfBtn,jumpSel,wrongBtn,nextBtn);document.body.append(bar);
 const perfEl=el('div',{id:'tmPerf',role:'status','aria-label':'성능'});document.body.append(perfEl);
 try{const h=document.querySelector&&document.querySelector('header small');if(h){const s=el('span',{class:'tm-head'},'🧪 테스트 모드');h.append(' · ',s)}}catch{}

 function lastText(){
  const L=T.last;if(!L)return '아이 속도 '+SPEED[opt.speed].name+': 읽는 시간 = 보통 아이 필요 시간 × '+SPEED[opt.speed].k;
  const head='지난 답 '+sec(L.t)+'초('+SPEED[L.speed].name+') · ';
  if(L.result==='first')return head+(L.guard!==null&&L.guard<1?'빨라서 금화 ×'+L.guard.toFixed(2):'감점 없음')+(L.fast?' · ⚡ 번개':'');
  return head+({second:'두 번째에 맞힘',wrong:'틀림',miss:'두 번 틀림'}[L.result]||'눌렀어요');
 }
 function show(){
  let s;const j=T.job;
  if(j)s='⏩ 빨리 감는 중'+(j.kind==='right'||j.kind==='wrong'?' '+sec(round.t)+' / '+sec(target())+'초':'');
  else if(paused)s='⏸️ 쉬는 중';
  else if(phase==='start')s='시작 화면 · 다음 ▶ = 시작하기';
  else if(phase==='ending')s='엔딩 · 다음 ▶ = 새 마을로 떠나기';
  else if(!round)s='';
  else if(phase==='reward')s='✅ 정답 연출 · 다음 ▶ = 다음 문제';
  else if(phase==='learn')s=round.ready?'📗 정답 배우기 · 다음 ▶ = 초록 답':'📗 정답 배우기 · 다시 보는 중';
  else s=(round.tries?'두 번째 고르기 ':'읽는 중 ')+sec(round.t)+' / '+sec(target())+'초'+(opt.auto?' · 자동':'');
  set(nowEl,s);set(lastEl,T.note||lastText());
  for(const k of ORDER){const v=String(opt.speed===k);if(speedBtns[k].getAttribute('aria-pressed')!==v)speedBtns[k].setAttribute('aria-pressed',v)}
  set(autoBtn,opt.auto?'⏯ 자동 켬':'⏯ 자동 끔');autoBtn.setAttribute('aria-pressed',String(opt.auto));
  nextBtn.disabled=!!j;wrongBtn.disabled=!!j||paused||phase!=='ask';jumpSel.disabled=!!j;
  perfBtn.setAttribute('aria-pressed',String(opt.perf));perfEl.hidden=!opt.perf;
 }

 /* ---------- 성능 표시: 0.5초마다 화면 쪽 숫자만 읽는다(세계 틱·게임 시계와 무관). 기본 켬 ----------
    3D: FPS = 3D가 실제로 그린 프레임 수(VillageView.inspect().frames, village.js가 초당 최대 30번 그린다)의 최근 약 1.5초 평균,
        그리기 호출·삼각형 = three.js renderer.info.render(마지막 한 장면). 그림 화면(3D 실패): 브라우저 화면 프레임(requestAnimationFrame) 수 */
 const P={samples:[],last:null,raf:0,rafOn:false,text:''};
 const rafLoop=()=>{if(!opt.perf){P.rafOn=false;return}P.raf++;raf(rafLoop)};
 const startRaf=()=>{if(opt.perf&&!P.rafOn){P.rafOn=true;raf(rafLoop)}};
 const big=n=>n>=10000?(n/10000).toFixed(1)+'만':String(n|0);
 function stageText(){try{if(typeof staged==='function'&&!staged())return '단계 끔';const k=stageNow();return (typeof STAGE_ICON!=='undefined'&&STAGE_ICON[k]?STAGE_ICON[k]+' ':'')+Combat.STAGE_NAME[k]}catch{return ''}}
 function perfTick(){
  if(!opt.perf)return P.text;
  const r=$('scene').dataset.renderer,v=window.VillageView,now=Date.now();let i=null;
  if(r==='three'&&v&&typeof v.inspect==='function'){try{const x=v.inspect();if(x&&x.ready)i=x}catch{}}
  const mode=i?'3d':'raf',n=i?i.frames|0:P.raf;
  if(P.last&&P.last.mode===mode&&now>P.last.t){P.samples.push({n:n-P.last.n,ms:now-P.last.t});if(P.samples.length>3)P.samples.shift()}else P.samples=[];
  P.last={mode,n,t:now};
  const ms=P.samples.reduce((a,s)=>a+s.ms,0),fps=ms>0?Math.round(P.samples.reduce((a,s)=>a+s.n,0)*10000/ms)/10:null,f='🎞 '+(fps===null?'…':fps.toFixed(fps>=10?0:1))+'fps';
  const st=stageText();
  P.text=i?f+'(최대 30) · 그리기 '+(i.drawCalls|0)+' · 삼각형 '+big(i.triangles)+(st?' · '+st:''):r==='fallback'?f+' · 그림 화면'+(st?' · '+st:''):'화면 준비 중'+(st?' · '+st:'');
  set(perfEl,P.text);return P.text;
 }
 function setPerf(v){opt.perf=!!v;saveOpt();if(opt.perf){P.samples=[];P.last=null;startRaf();perfTick()}show();return opt.perf}
 setInterval(perfTick,500);startRaf();

 /* 게임 시계 tick()을 감싼다: 틱마다 틀린 순간을 기억하고, 자동 넘기기를 보고, 막대 글을 고친다. 빨리 감기는 감싸지 않은 원래 tick(baseTick)을 돌린다 */
 const baseTick=tick;
 tick=function(){baseTick();watch();if(opt.auto&&!T.job)autoStep();show()};
 show();
 /* 검사·프로듀서 콘솔용 */
 window.__testmode={get speed(){return opt.speed},get auto(){return opt.auto},get perf(){return opt.perf},setPerf,perfNow:perfTick,jump,jumpState,JUMP_BASE:JSON.parse(JSON.stringify(JUMP_BASE)),JUMPS:JUMPS.map(j=>j.slice()),get job(){return T.job&&{...T.job}},get last(){return T.last&&{...T.last}},get done(){return T.done&&{...T.done}},get note(){return T.note},
  next,wrong,setSpeed,setAuto,plan:()=>phase==='ask'&&round?{t:round.t,target:target(),tries:round.tries,lock:round.lock,dash:round.dash}:null,
  frame(){if(T.job)ffFrame();return !!T.job},drain(max){let n=0;while(T.job&&n<(max||5000)){ffFrame();n++}return n},SPEED:JSON.parse(JSON.stringify(SPEED)),RETRY,AFTER_LOCK,OPT_KEY};
})();
