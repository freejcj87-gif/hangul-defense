const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const Questions=require('./questions.js'),Combat=require('./combat.js'),World=require('./world.js');
const INTERIM=process.env.INTERIM_NO_3D_BUILD==='1',FULL_SHOTS=process.env.FULL_SHOTS==='1';
const ONLY=process.env.ONLY||'',run=part=>!ONLY||ONLY.split(',').includes(part);/* ONLY=matrix,clock,feel,fallback,demo,flow 중 일부만 돌릴 때(개발용). CI는 전부 돌린다. */
const KEY='hangul-defense-v1',SWIFT=['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'];
/* 검사 기본: 시계를 세우고(__HOLD_CLOCK) 틱을 직접 돌린다. CI의 SwiftShader는 프레임 간격이 200ms를 넘기도 해서 벽시계 대기는 쓰지 않는다.
   0.11: 게임은 읽어 주는 음성(음성 합성)을 쓰지 않는다. speechSynthesis를 감시용으로 바꿔, 부르면 window.__said에 남긴다(언제나 비어 있어야 함). */
const HOLD=()=>{window.__HOLD_CLOCK=true};
const FAKE_TTS=()=>{window.__said=[];const S={speak(u){window.__said.push('speak:'+(u&&u.text))},cancel(){window.__said.push('cancel')},getVoices(){window.__said.push('getVoices');return []}};
 Object.defineProperty(window,'speechSynthesis',{value:S,configurable:true})};
const CHICK=Combat.LINES.moreHens;
/* 0.11: 소리 모드도 읽어 주는 음성도 없다. 아이는 글을 읽기만 한다. phase는 start → ask → reward / learn */
/* 그 나이 읽기 문항 기준 무리 간격(index.html waveInterval과 같은 식) */
const ivFor=age=>{const t=[];for(let i=0;i<Questions.count(age,'story');i++)t.push(Combat.baseSeconds(Questions.get(age,'story',i)));t.sort((a,b)=>a-b);return World.intervalFor(t[t.length>>1])};
/* 7세 첫 퀴즈 칸(예전에는 질문을 읽어 주던 문제) */
const I7=Array.from({length:60},(_,k)=>k).find(k=>Questions.isQuiz(7,k));
(async()=>{
 const output=path.join(__dirname,'.pages-build'),shots=path.join(__dirname,'test-results');
 const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const file=pathname==='/'?'index.html':['/combat.js','/world.js','/questions-gen.js','/questions.js','/village.js'].includes(pathname)?pathname.slice(1):pathname==='/art-handoff/coopnight/source-3d/models/environment-pack.glb'?pathname.slice(1):/^\/art-handoff\/coopnight\/browser\/[a-z/-]+[0-9a-z-]*\.png$/.test(pathname)?pathname.slice(1):null;
 if(!file||!fs.existsSync(path.join(output,file))){res.writeHead(404);return res.end()}
 res.setHeader('Content-Type',file.endsWith('.glb')?'model/gltf-binary':file.endsWith('.png')?'image/png':file.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8');
 res.end(fs.readFileSync(path.join(output,file)));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 fs.mkdirSync(shots,{recursive:true});let checks=0;
 const ok=(v,m)=>{assert.ok(v,m);checks++},eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++};
 const shot=(target,name)=>target.screenshot({path:path.join(shots,name+'.png')});

 /* 화면에 나온 문제를 문제은행(Node 쪽 사본)과 대조한다. */
 async function shown(page){return page.locator('#answers').evaluate(n=>({qid:n.dataset.qid,age:Number(n.dataset.age),mode:n.dataset.mode,labels:[...n.children].map(b=>b.textContent),chip:document.getElementById('levelChip').textContent,prompt:document.getElementById('prompt').textContent,passage:document.getElementById('passage').textContent}))}
 /* 화면 문제 = 그 나이의 index번째(상식·수학·영어가 섞인 순서, Questions.at). mode는 언제나 'story'. 보기 순서는 바퀴(lap)마다 한 칸씩 돈다. */
 async function expectQuestion(page,age,mode,index,msg){
  const s=await shown(page),seed=await page.evaluate(()=>window.__game().seed),q=Questions.at(age,mode,index,seed),n=q.choices.length,order=q.choices.map((_,k)=>q.choices[(k+(q.lap||0))%n]);
  eq(s.qid,q.id,msg+': question id');eq(s.age,age,msg+': age');eq(s.mode,q.mode,msg+': mode');eq(s.labels,order,msg+': choices');eq(s.prompt,q.prompt,msg+': prompt');eq(s.passage,q.passage||'',msg+': passage');
  if(q.mode==='quiz')ok(s.chip.startsWith(age+'세 · ')&&s.chip.endsWith(Questions.CATS[q.cat]),msg+': category chip '+s.chip);else{eq(s.chip,age+'세 · '+Questions.LEVELS[age][mode],msg+': level chip');eq(Questions.checkLevel(age,mode,q),[],msg+': level rules')}
  return q}
 const notGone=page=>page.evaluate(()=>world.wolves.filter(v=>v.state!=='gone').length);
 const game=page=>page.evaluate(()=>window.__game());
 const tick=(page,n)=>page.evaluate(n=>window.__tick(n),n);
 const phaseIs=(page,p)=>page.waitForFunction(p=>window.__game().phase===p,p,{timeout:20000});
 const ready=page=>page.waitForFunction(()=>['three','fallback'].includes(document.querySelector('.scene').dataset.renderer),{},{timeout:45000});
 /* 한 번에 맞힌 뒤 판매 연출(1.2초)이 끝나 다음 문제를 풀 수 있을 때까지 틱을 돌린다. */
 async function settle(page){for(let i=0;i<120&&(await game(page)).phase==='reward';i++)await tick(page,1);await phaseIs(page,'ask')}
 /* 시작 화면: 나이만 고르고 시작(모드 고르기 없음) */
 async function begin(page,{age=8}={},touch){const tap=l=>touch?l.tap():l.click();
  await tap(page.locator('#ageRow button[data-age="'+age+'"]'));await tap(page.locator('#go'));await phaseIs(page,'ask')}
 /* right=true면 정답, false면 첫 번째 오답. 보기 잠금(0.3초·글 먼저 읽기)은 틱으로 넘긴다. */
 async function answer(page,right,touch,k=0){await phaseIs(page,'ask');await page.evaluate(()=>{const g=window.__game();if(g.phase==='ask'&&g.round.lock>0)window.__tick(g.round.lock)});
  /* 0.10: 첫 시도 정답은 글을 읽을 만한 시간(번개 시작 = 찍기 막기 기준)까지 기다렸다 누른다(바로 누르면 금화 75%) */
  if(right)await page.evaluate(()=>{if(phase==='ask'&&round&&round.tries===0){const k=Math.ceil(Combat.FAST_MIN*Combat.needSeconds(round.q)/Combat.TICK)-round.t;if(k>0)window.__tick(k)}});
  const g=await game(page),wrongs=g.round.choices.map((_,i)=>i).filter(i=>i!==g.round.answer),i=right?g.round.answer:wrongs[k];
  const b=page.locator('#answers button[data-i="'+i+'"]');if(touch)await b.tap();else await b.click();return g}
 /* 가게 칸 누르기(두 번 눌림 방지 0.4초를 넘기려고 먼저 4틱) */
 async function buy(page,key,touch){await tick(page,4);const s=page.locator('#shop .slot[data-key="'+key+'"]');if(touch)await s.tap();else await s.click()}
 const slotStates=page=>page.locator('#shop .slot').evaluateAll(a=>a.map(b=>b.dataset.key+':'+b.dataset.state));
 const gold=page=>page.locator('#gold').textContent();
 const noOverflow=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
 async function answersFit(page){return page.evaluate(()=>{const r=[...document.querySelectorAll('#answers button')].map(b=>b.getBoundingClientRect());const inside=r.every(x=>x.left>=0&&x.right<=innerWidth+.5&&x.width>=44&&x.height>=44);const apart=r.every((a,i)=>r.every((b,j)=>i>=j||a.right<=b.left+.5||b.right<=a.left+.5||a.bottom<=b.top+.5||b.bottom<=a.top+.5));return inside&&apart})}
 const pillsFit=page=>page.evaluate(()=>{const s=document.querySelector('.stats').getBoundingClientRect(),r=[...document.querySelectorAll('.stats .pill')].map(p=>p.getBoundingClientRect());return r.length===4&&r.every((a,i)=>a.width>0&&a.left>=s.left-.5&&a.right<=s.right+.5&&r.every((b,j)=>i>=j||a.right<=b.left+.5||b.right<=a.left+.5||a.bottom<=b.top+.5||b.bottom<=a.top+.5))});
 /* 가게 8칸: 카드 안, 서로 겹치지 않고, 손가락으로 누를 만한 크기(폭 44 이상, 높이 40 이상) */
 const shopFits=page=>page.evaluate(()=>{const c=document.getElementById('stageCard').getBoundingClientRect(),r=[...document.querySelectorAll('#shop .slot')].map(b=>b.getBoundingClientRect());
  return r.length===8&&r.every(x=>x.width>=44&&x.height>=40&&x.left>=c.left-.5&&x.right<=c.right+.5&&x.bottom<=c.bottom+.5)&&r.every((a,i)=>r.every((b,j)=>i>=j||a.right<=b.left+.5||b.right<=a.left+.5||a.bottom<=b.top+.5||b.bottom<=a.top+.5))});
 /* 휴대폰: 보기(문제)를 화면 아래쪽에 맞춰 스크롤해도 상태 줄·마을 장면·가게가 위에 붙어 함께 보이고, 가게와 보기 사이가 떨어져 있는지(잘못 누름 방지) */
 const stickyView=(page,target)=>page.evaluate(id=>{document.getElementById(id).scrollIntoView({block:'end'});const r=x=>{const b=document.getElementById(x).getBoundingClientRect();return {top:Math.round(b.top),bottom:Math.round(b.bottom),h:Math.round(b.height)}};return {stats:r('gold'),scene:r('scene'),shop:r('shopWrap'),target:r(id),prompt:r('prompt'),h:innerHeight}},target);
 const together=(v,withPrompt)=>v.stats.top>=0&&v.scene.bottom<=v.shop.top+1&&v.shop.bottom<=v.target.top-6&&v.target.bottom<=v.h+1&&v.scene.h>=120&&(!withPrompt||v.prompt.top>=v.shop.bottom-1);
 async function frames(page,n){const from=await page.evaluate(()=>window.VillageView.inspect().frames);await page.waitForFunction(t=>window.VillageView.inspect().frames>=t,from+n,{timeout:30000})}
 const beats=(page,n)=>page.evaluate(n=>new Promise(r=>{const goal=(window.__beats||0)+n;const f=()=>(window.__beats||0)>=goal?r():setTimeout(f,20);f()}),n);
 async function seed(page,s){await page.evaluate(s=>{Object.assign(state,s);state.round=null;save()},s);await page.reload();await ready(page)}
 const stored=page=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),KEY);
 /* 이펙트는 1초 안팎으로 사라지므로, 생성되는 순간을 페이지 안에서 기록해 두고 읽는다. */
 const RECORD=()=>{window.__fx=[];document.addEventListener('DOMContentLoaded',()=>{const scene=document.getElementById('scene');new MutationObserver(m=>m.forEach(r=>r.addedNodes.forEach(n=>{if(!n.classList)return;if(n.classList.contains('sale')){window.__fx.push({c:'sale',t:n.textContent});return}if(n.classList.contains('paws')){window.__fx.push({c:'paws',t:n.dataset.point});return}if(!n.classList.contains('fx'))return;const e={c:[...n.classList].find(x=>x.startsWith('fx-')),t:n.textContent};if(e.c==='fx-label'){const w=n.offsetWidth/2,h=n.offsetHeight/2,x=parseFloat(n.style.left),y=parseFloat(n.style.top);e.inside=n.style.left.endsWith('px')&&x-w>=0&&x+w<=scene.clientWidth&&y-48-h>=0&&y+h<=scene.clientHeight;e.box=[Math.round(x-w),Math.round(x+w),Math.round(y),scene.clientWidth,scene.clientHeight]}window.__fx.push(e)}))).observe(document.getElementById('effects'),{childList:true})})};
 const fxLog=page=>page.evaluate(()=>window.__fx.splice(0));const names=f=>f.map(x=>x.c+':'+x.t);
 /* 말풍선: 카드 안에 있고, 꼬리 끝이 추천 칸 위에 있는지 */
 const bubbleBox=page=>page.evaluate(()=>{const b=document.getElementById('bubble');if(b.classList.contains('hidden'))return null;const r=b.getBoundingClientRect(),c=document.getElementById('stageCard').getBoundingClientRect(),key=b.dataset.key,sl=document.querySelector('#shop .slot[data-key="'+key+'"]').getBoundingClientRect(),tail=r.left+parseFloat(getComputedStyle(b).getPropertyValue('--tail'))/100*r.width,stats=document.querySelector('.stats').getBoundingClientRect();
  return {text:document.getElementById('bubbleText').textContent,key,inside:r.left>=c.left-.5&&r.right<=c.right+.5&&r.top>=stats.bottom-.5&&r.bottom<=sl.top,tailOnSlot:tail>=sl.left&&tail<=sl.right,glow:document.querySelector('#shop .slot[data-key="'+key+'"]').classList.contains('rec')}});

 try{
 /* ===== 1. 화면 매트릭스: 두 엔진 × 세 폭. 시작 화면 → 나이·모드 전환 → 정답·판매·말풍선 → 가게 → 오답·막기 → 놓침 ===== */
 for(const [name,engine] of run('matrix')?[['chromium',chromium],['webkit',webkit]]:[]){
 const browser=await engine.launch({headless:true,...(name==='chromium'?{args:SWIFT}:{})});
 try{
 for(const [width,height] of name==='chromium'?[[1366,844],[390,844],[320,844],[320,568]]:[[1366,844],[390,844],[320,844]]){
 const touch=width<600,tag=name+' '+width+'x'+height;
 const ctx=await browser.newContext({viewport:{width,height},hasTouch:touch,reducedMotion:'reduce'});
 await ctx.addInitScript(HOLD);await ctx.addInitScript(FAKE_TTS);await ctx.addInitScript(RECORD);
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await ready(page);
 const three=await page.locator('.scene').getAttribute('data-renderer')==='three';
 if(name==='chromium')ok(three,'chromium renders 3D');
 /* 시작 화면 */
 ok(await page.locator('#start').isVisible(),tag+' start screen');eq(await page.locator('#ageRow button').count(),4,'four age buttons');eq(await page.locator('#startSound, #startStory, #mode, .mode-row').count(),0,tag+' no mode picker: the game is reading only');eq((await game(page)).phase,'start','start phase');
 await page.locator('#go').scrollIntoViewIfNeeded();ok(await page.locator('#go').isVisible(),tag+' start button reachable');ok(await noOverflow(page),tag+' start screen fits the width');
 if(name==='chromium'&&(width===390||height===568))await shot(page,'start-'+width+'x'+height);
 await page.evaluate(async()=>{await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))});
 ok(await page.locator('#houseArt').evaluate(i=>i.naturalWidth===256),'house art');ok(await page.locator('#towerArt').evaluate(i=>i.naturalWidth===96),'tower art');
 await begin(page,{age:8},touch);ok(await page.locator('#start').isHidden(),'start screen closes');
 eq(await gold(page),'🪙 20','initial gold');ok(await noOverflow(page),'no horizontal overflow');ok(await pillsFit(page),'status pills do not overlap');
 await expectQuestion(page,8,'story',0,tag+' default');
 let g=await game(page);eq([g.state.mode,g.world.interval,g.world.radius],['story',ivFor(8),7],'reading mode, wave rhythm for 8세 reading items, starting village radius');
 eq(await page.locator('#speak, #rate, #voiceStatus').count(),0,'no voice controls (replay button, reading speed, voice notice)');eq(await page.evaluate(()=>window.__said.length),0,'nothing is read aloud');
 eq(await page.locator('#drawerSummary').textContent(),'⚙️ 설정 · 8세','settings summary shows the age only');
 await tick(page,20);g=await game(page);eq(g.round.t,20,'held clock advances only by explicit ticks');
 /* 0.9: 늑대 시간 바가 없다. 압박은 🐺 수·상태 문구·발자국·울음으로(숫자 없음). ⚡는 문제 칸 귀퉁이에. */
 eq(await page.locator('#timebar, #timeFill, #wolfHead, #choices, #cards, #skip').count(),0,'no time bar, no cards, no skip button');
 ok(!/\d+ *초/.test(await page.locator('#villageStatus').textContent()),'status line shows no seconds');
 ok(await page.locator('#quiz #fastIcon').isVisible(),'⚡ sits in the question box');
 eq((await page.locator('#level').textContent()).endsWith('🐺'+g.world.wolves),true,'🐺 pill = live wolves');
 /* 가게: 장면 바로 아래 2줄 × 4칸, 규칙 shop()의 상태 그대로 */
 ok(await shopFits(page),tag+' shop: 8 slots, finger-sized, inside the card');
 eq(await slotStates(page),Combat.shop({...g.state,gold:g.gold.shown}).map(r=>r.key+':'+r.state),'shop slots = rules');
 ok(await page.locator('#shop .slot').evaluateAll(a=>a.every(b=>!b.disabled&&!/\d+ *\/ *\d+/.test(b.textContent))),'no counts or caps on the shop');
 ok(await page.locator('#shop .slot .ico img').evaluateAll(a=>a.length>=3&&a.every(i=>i.complete&&i.naturalWidth>0)),'shop art loads');
 eq(await page.locator('#shop .slot .nm').evaluateAll(a=>a.some(x=>getComputedStyle(x).display!=='none')),width>380,'names on wide screens, icon + price only at 320');
 if(touch){const v=await stickyView(page,'answers');ok(together(v,false),tag+' stats, scene, shop and answers on one screen: '+JSON.stringify(v))}
 if(name==='chromium'&&(FULL_SHOTS||width===390||height===568))await shot(page,'ask-'+width+'x'+height);

 /* 나이 전환: 설정 서랍에서 바꾸면 그 나이 문제로 바로 바뀐다(늑대 위치는 유지). 모드 전환 버튼은 없다. */
 await page.locator('#drawerSummary').click();
 for(const mode of ['story']){
  for(const age of [9,10,7,8]){
   await page.locator('#age').selectOption(String(age));await phaseIs(page,'ask');
   const q=await expectQuestion(page,age,mode,0,tag+' '+age+'세 '+mode);
   eq(await page.locator('#answers button').count(),q.choices.length,'button count');
   ok((await page.locator('#feedback').textContent()).startsWith(age+'세 '),'switch feedback');
   await page.evaluate(()=>{const g=window.__game();if(g.round.lock>0)window.__tick(g.round.lock)});
   ok(await noOverflow(page),age+'세 '+mode+' fits the width');ok(await answersFit(page),age+'세 '+mode+' answer buttons fit');
   eq((await stored(page)).age,age,'age saved');
   if(touch){const v=await stickyView(page,'answers');const short=age===7;ok(together(v,short&&height>=844),tag+' '+age+'세 '+mode+' sticky scene + shop with answers: '+JSON.stringify(v))}
   if(name==='chromium'&&(FULL_SHOTS||width===390&&(age===10||age===7)||height===568&&age===10&&mode==='story'))await shot(page,'question-'+width+'x'+height+'-'+age+'-'+mode);
  }
 }
 await page.locator('#age').selectOption('9');await phaseIs(page,'ask');
 await page.reload();await ready(page);ok(await page.locator('#ageRow button[data-age="9"]').evaluate(b=>b.classList.contains('on')),'age survives reload');
 eq(await page.locator('#go').textContent(),'이어서 하기 ▶','unfinished question resumes');
 await page.locator('#ageRow button[data-age="8"]').click();await page.locator('#go').click();await phaseIs(page,'ask');await expectQuestion(page,8,'story',0,'back to 8세');

 /* 한 번에 정답 → 판매 연출(세계는 흐름, 말풍선은 글로만) → 1.2초 뒤 저절로 다음 문제.
    앞 구간에서 오래 흐른 세계(늑대가 마을 안·닭 잃음·건물 부서짐)는 급한 말풍선을 먼저 띄우므로, 이 확인 동안만 세계를 조용히 하고 말풍선 간격을 처음으로 돌린다. */
 await page.evaluate(()=>{world.wolves=[];world.arrows=[];world.trickle=world.t+99999;world.wave.arrive=world.t+99999;world.wave.spawned=true;World.repairAll(world);Object.assign(state,{broken:0,chickens:1,hidden:0,nest:0});World.sync(world,state);syncMarket();recReset();render()});
 g=await game(page);const fresh=JSON.parse(JSON.stringify(g.state)),Q0=Questions.at(8,'story',0,g.state.seed),said0=await page.evaluate(()=>window.__said.length);
 await tick(page,Math.ceil(Combat.FAST_MIN*Combat.needSeconds(Q0)/Combat.TICK));/* 번개는 최소 읽기 시간이 지나야 */
 eq(await page.locator('#fastIcon').getAttribute('data-state'),'on','⚡ glows in the fast window');
 await answer(page,true,touch);const expGold=Combat.income(fresh,Q0,true).gold;
 g=await game(page);eq(g.phase,'reward','first-try correct: sale, no card picking');eq(await gold(page),'🪙 '+(20+expGold),'reduced motion: gold number jumps at once (+⚡)');eq(g.state.index,1,'question counter moves on at once');
 ok((await fxLog(page)).some(x=>x.c==='sale'&&x.t.includes('🧑‍🌾')),'egg → farmer → market strip');
 ok(await page.locator('#answers button.correct.yay').count()===1,'the answered button celebrates');eq(await page.locator('#fastIcon').getAttribute('data-state'),'won','⚡ flashes after a fast answer');
 const wt=g.world.t;await tick(page,5);eq((await game(page)).world.t,wt+5,'the wolf world keeps running during the sale');
 await tick(page,3);eq((await game(page)).phase,'reward','still the sale at 0.8 s');let bb=await bubbleBox(page);ok(bb&&bb.text===CHICK&&bb.key==='chicken'&&bb.inside&&bb.tailOnSlot&&bb.glow,tag+' chicken bubble above the shop, tail on the chicken slot, slot glows: '+JSON.stringify(bb));
 if(name==='chromium'&&(width===390||height===568))await shot(page,'reward-bubble-'+width+'x'+height);
 await tick(page,4);eq((await game(page)).phase,'ask','the next question comes 1.2 s after the answer (the sale never waits for the bubble)');await expectQuestion(page,8,'story',1,'next question by itself');
 eq(await page.evaluate(()=>window.__said.length),said0,'nothing is read aloud: the bubble is text only');
 await tick(page,40);ok(await page.locator('#bubble').isHidden(),'the bubble goes away by itself');
 await page.evaluate(()=>{world.trickle=world.t+5;world.wave.arrive=world.t+world.interval;world.wave.spawned=false});
 if(touch){const v=await stickyView(page,'answers');ok(together(v,false),tag+' after the sale: scene + shop + answers: '+JSON.stringify(v))}

 /* 가게: 풀고 있는 문제는 그대로, 세계도 흐르는 채로 바로 산다 */
 await page.evaluate(()=>{state.gold=500;render()});
 const kind=width===1366?'chicken':width===390?'tower':'hall',qBefore=(await game(page)).round.id,wb=(await game(page)).world.t;
 await buy(page,kind,touch);
 g=await game(page);eq([g.phase,g.round.id],['ask',qBefore],'buying keeps the question');eq(g.world.t,wb+4,'the world never stops for the shop');
 const label=(await fxLog(page)).filter(x=>x.c==='fx-label');eq(label.map(x=>x.t),[{chicken:'🐔 꼬꼬 2마리!',tower:'🏹 화살 타워 2개!',hall:'🏠 회관 1단계!'}[kind]],'name tag (reduced motion: label only)');
 ok(await page.locator('#shopTip').isVisible(),'a short line above the shop');
 const vs=await page.evaluate(()=>getVillageState());eq([vs.chickens,vs.level,vs.fence,vs.hall],{chicken:[2,0,0,0],tower:[1,1,0,0],hall:[1,0,0,1]}[kind],'village state after buying');
 if(three&&!INTERIM){await frames(page,2);const i=await page.evaluate(()=>window.VillageView.inspect());eq([i.chickens,i.towers,i.fences],[vs.chickens,1+vs.level,vs.fence],'3D village shows the purchase')}
 /* 금화가 모자란 칸·잠긴 칸은 눌러도 안내만 */
 await page.evaluate(()=>{state.gold=0;render()});await buy(page,'fence',touch);eq((await page.locator('#shopTip').textContent()),'🪙 '+Combat.price((await game(page)).state,'fence')+' 더 모아요','poor slot: how much more');
 if(kind!=='hall'){await buy(page,'power',touch);eq(await page.locator('#shopTip').textContent(),'회관을 키우면 생겨요','locked slot: grow the hall')}
 if(name==='chromium'&&(width===390||height===568))await shot(page,'shop-tip-'+width+'x'+height);

 /* 오답 → 늑대 성큼(장면 테두리 붉게) → 두 번째 정답(막기만, 금화 없음) → 초록 답을 눌러 다음 */
 const before=await gold(page);
 await answer(page,false,touch);g=await game(page);eq(g.round.tries,1,'one wrong answer');ok(await page.locator('#scene').evaluate(n=>n.classList.contains('dash')),'red scene border on the wolf dash');
 if(name==='chromium'&&width===390)await shot(page.locator('.stage-card'),'dash-390');
 await tick(page,Combat.DASH_TICKS);ok(!(await page.locator('#scene').evaluate(n=>n.classList.contains('dash'))),'border clears after the dash');
 await answer(page,true,touch);g=await game(page);eq([g.phase,g.round.result],['learn','second'],'second try only stops the wolves');eq(await gold(page),before,'no gold on the second try');
 /* 음성 없이: 다시 볼 시간(Combat.learnTicks, 1.5~8초)이 지나면 초록 답이 열린다 */
 {const lt=Combat.learnTicks(Questions.at(8,'story',1,(await game(page)).seed));eq(await page.locator('#answers button.tap-me').count(),0,'the green answer waits first');ok((await page.locator('#feedback').textContent()).includes('초록색 정답을 확인해요'),'learning notice');
  await tick(page,lt-1);eq(await page.locator('#answers button.tap-me').count(),0,'still waiting one tick before the end');await tick(page,1);ok(await page.locator('#answers button.tap-me').count()===1,tag+' the right answer glows after the wait (no voice): '+JSON.stringify(await game(page)))}
 await page.locator('#answers button.tap-me').click();await phaseIs(page,'ask');await expectQuestion(page,8,'story',2,'continue after learning');
 /* 늑대가 닭을 물어 가고 건물이 부서지면: 닭 수가 줄고, 고치기 칸이 켜짐 */
 g=await game(page);const hensBefore=g.state.chickens;
 await page.evaluate(()=>{const hen=world.hens[0];hen.state='carried';world.wolves.push({id:9999,x:0,z:-16.9,sx:0,sz:-17,hp:20,max:20,speed:.8,state:'carry',target:0,timer:0,inside:0,hen:hen.id});
  const t=world.buildings.find(b=>b.kind==='tower');t.hp=.01;world.wolves.push({id:9998,kind:'wolf',x:t.x+1,z:t.z,sx:30,sz:0,hp:9999,max:9999,speed:0,state:'smash',target:t.id,timer:0,inside:0,hen:0})});
 await tick(page,3);g=await game(page);eq(g.state.chickens,hensBefore-1,'a carried-off hen is lost');ok(g.world.broken>=1,'a tower breaks');await page.evaluate(()=>{world.wolves=world.wolves.filter(v=>v.id!==9998)});eq((await page.locator('#flockPill').textContent()).startsWith('🐔 '+(hensBefore-1)),true,'hen pill follows at once');
 if(name==='chromium'&&width===390)await shot(page,'raid-390');
 await page.evaluate(()=>{state.gold=500;render()});ok((await slotStates(page))[0]==='repair:buy','repair slot lights up when something is broken');
 await buy(page,'repair',touch);eq((await game(page)).world.broken,0,'repair fixes every broken building');
 await answer(page,true,touch);await settle(page);
 /* 다음 문제(8세 퀴즈 칸은 20칸마다 3칸, 5·12·19번) */
 await expectQuestion(page,8,'story',3,tag+' fourth question');await page.evaluate(()=>{const g=window.__game();if(g.round.lock>0)window.__tick(g.round.lock)});ok(await answersFit(page),tag+' quiz answer buttons fit');
 if(name==='chromium'&&(width===390||height===568))await shot(page,'quiz-'+width+'x'+height);

 /* 쉬기: 문제를 가리고 시계를 멈춘다. 가게도 멈춤 */
 await page.locator('#pause').click();ok(await page.locator('body').evaluate(b=>b.classList.contains('covered')),'pause covers the question');
 g=await game(page);await tick(page,30);eq((await game(page)).round.t,g.round.t,'paused clock does not move');eq((await game(page)).world.t,g.world.t,'paused wolf world does not move');
 {const lv=g.state.level;await page.evaluate(()=>{state.gold=500});const s=page.locator('#shop .slot[data-key="tower"]');if(touch)await s.tap();else await s.click();eq((await game(page)).state.level,lv,'no shopping while paused')}
 await page.locator('#pause').click();

 /* 늑대 무리가 가장자리에서 나타나 마을로 걸어온다(세계 시뮬레이션 + 3D). 나오는 쪽 가장자리에 붉은 발자국 */
 /* 발자국은 1.5초 뒤 사라지므로 틱과 같은 호출 안에서 위치를 잰다 */
 /* 앞 구간에서 남은 급한 문구가 무리 직전에 만료되면 문구가 비어 흔들렸다(0.10): 무리를 부르기 전에 문구를 비운다 */
 {const pw=await page.evaluate(()=>{worldNote=null;world.wave.arrive=world.t+World.TRAVEL+10;world.wave.spawned=false;window.__tick(12);const s=document.getElementById('scene').getBoundingClientRect(),prints=[...document.querySelectorAll('#effects .paws i')];
   return {n:prints.length,inside:prints.every(p=>{const r=p.getBoundingClientRect(),x=(r.left+r.right)/2,y=(r.top+r.bottom)/2;return x>=s.left+8&&x<=s.right-8&&y>=s.top+8&&y<=s.bottom-8}),
    edge:prints.every(p=>{const r=p.getBoundingClientRect(),x=(r.left+r.right)/2,y=(r.top+r.bottom)/2;return Math.min(x-s.left,s.right-x,y-s.top,s.bottom-y)<=70})}});
  ok(pw.n>=3&&pw.inside&&pw.edge,tag+' red paw prints near the scene edge, inside it: '+JSON.stringify(pw))}
 g=await game(page);ok(g.world.wolves>=1,'a wolf pack is on the map before it arrives: '+JSON.stringify(g.world));
 ok((await fxLog(page)).some(x=>x.c==='paws'),'paw prints logged for the pack');
 /* 무리 문구는 낮은 순위: 닭을 잃거나 건물이 부서진 문구가 떠 있으면 그것이 먼저다 */
 {const st=await page.locator('#villageStatus').textContent(),urgent=await page.evaluate(()=>!!(worldNote&&!worldNote.low));ok(st.includes('몰려와요')||urgent,tag+' status line: the pack is coming (unless something more urgent is shown): '+st)}
 if(name==='chromium'&&width===390)await shot(page.locator('.stage-card'),'pack-paws-390');
 /* 0.8: 늑대가 쉬지 않고 오고 쓰러지므로 '가장 가까운 늑대'가 바뀔 수 있다. 같은 늑대(id)를 따라가 걷는 늑대가 모두 마을 쪽으로 왔는지 본다. */
 {let walked=false,seen=[];for(let k=0;k<6&&!walked;k++){
  const walk0=await page.evaluate(()=>world.wolves.filter(v=>v.state==='walk').map(v=>[v.id,Math.hypot(v.x,v.z)]));await tick(page,10);
  const walk1=await page.evaluate(ids=>world.wolves.filter(v=>ids.includes(v.id)&&v.state!=='dead'&&v.state!=='gone').map(v=>[v.id,Math.hypot(v.x,v.z),v.state]),walk0.map(x=>x[0]));
  seen=[walk0.slice(0,3),walk1.slice(0,3)];if(walk1.length)walked=walk1.every(([id,d,st])=>st==='walk'?d<walk0.find(x=>x[0]===id)[1]:['smash','hunt','bite'].includes(st))}
  ok(walked,'wolves walk toward the village: '+JSON.stringify(seen))}
 /* 🐺 알약은 틱마다 세계를 따라간다 */
 {let miss=0;for(let k=0;k<5;k++){await tick(page,7);const [txt,n]=await page.evaluate(()=>[document.getElementById('level').textContent,window.__game().world.wolves]);if(!txt.endsWith('🐺'+n))miss++}eq(miss,0,'🐺 pill follows the world every tick')}
 if(three&&!INTERIM){await frames(page,3);const i=await page.evaluate(()=>window.VillageView.inspect());ok(i.wolvesVisible>=1,'3D wolves visible: '+i.wolvesVisible);eq(i.wolvesVisible,await notGone(page),'3D wolf count = simulated wolves (incl. falling ones)')}
 if(name==='chromium'&&(width===390||width===1366))await shot(page.locator('.scene'),'pack-'+width);
 ok(await noOverflow(page),'no overflow after a few rounds');
 await page.screenshot({path:path.join(shots,name+'-'+width+'x'+height+'.png'),fullPage:true});

 if(name==='chromium'&&width===390){
  if(three&&!INTERIM){
   /* 세계가 흐르면 3D 늑대가 움직이고, 쉬기에서는 멈춘다 */
   await page.emulateMedia({reducedMotion:'no-preference'});
   await page.evaluate(()=>{const g=window.__game();if(!world.wolves.some(v=>v.state!=='dead'&&v.state!=='gone'))window.__tick(Math.max(1,g.world.wave.arrive-g.world.t-60))});
   const wp=async()=>(await page.evaluate(()=>window.VillageView.inspect())).wolfPos;
   await frames(page,3);const p0=await wp();await tick(page,10);await frames(page,6);const p1=await wp();
   assert.notDeepEqual(p1,p0,'3D wolves move when the world ticks');checks++;
   await page.locator('#pause').click();await frames(page,2);const s0=await wp();await tick(page,10);await frames(page,4);eq(await wp(),s0,'pause freezes 3D wolves');await page.locator('#pause').click();
   await page.emulateMedia({reducedMotion:'reduce'});
  }
  /* 다 자란 마을 */
  const smallHalf=three&&!INTERIM?(await page.evaluate(()=>window.VillageView.inspect())).cameraHalf:0;
  await page.evaluate(()=>{localStorage.removeItem('hangul-defense-v1')});
  await seed(page,{gold:900,level:4,fence:4,chickens:8,farmers:2,pond:2,hall:3,feast:1,wins:40,index:5,age:8});await begin(page,{age:8},touch);
  await page.waitForFunction(()=>window.VillageView?.inspect().ready,{},{timeout:45000});
  await frames(page,40);
  const grown=await page.evaluate(()=>window.VillageView.inspect());
  if(!INTERIM){eq([grown.towers,grown.chickens,grown.farmers,grown.pond,grown.hall,grown.feast,grown.radius],[5,8,2,2,3,1,16],'3D grown village state');ok(grown.cameraHalf>smallHalf+4,'camera pulls back for a big village: '+[smallHalf,grown.cameraHalf])}
  eq((await slotStates(page))[7].split(':')[0],'feast','hall 3: the 8th slot becomes the feast');
  await tick(page,40);await frames(page,3);await shot(page.locator('.scene'),'grown-390');console.log('SCENE_METRICS:'+JSON.stringify(await page.evaluate(()=>window.VillageView.inspect())));
 }
 /* 숫자가 가장 길어지는 상태(0.9 숨은 상한 근처)에서도 상단 표시·가게가 겹치지 않아야 한다. */
 await page.evaluate(()=>{Object.assign(state,{gold:12800,wins:999,streak:0,level:19,power:10,chickens:20,broken:9,fence:18,hall:3,pond:3,farmers:9,feast:30});render()});
 ok(await pillsFit(page),'status pills fit with the longest values');ok(await noOverflow(page),'no overflow with the longest values');ok(await shopFits(page),'shop fits with the longest prices');
 if(name==='chromium')await shot(page.locator('.stage-card'),'stats-full-'+width+'x'+height);
 eq(errors,[],tag+' page errors');await ctx.close();
 }
 }finally{await browser.close()}
 }

 /* ===== 2. 실제 시계: 훅 없이 인터벌로 흐르고, 판매 연출 동안에도 세계는 흐르고, 쉬는 동안만 멈춘다(박자 수로 확인) ===== */
 const clockBrowser=await chromium.launch({headless:true,args:SWIFT});
 try{if(run('clock')){
  const ctx=await clockBrowser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});await ctx.addInitScript(FAKE_TTS);
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await ready(page);
  await begin(page,{age:8});await page.waitForFunction(()=>window.__game().round.t>=5,{},{timeout:30000});ok(true,'real interval moves the clock');checks++;
  await page.locator('#pause').click();const t1=(await game(page)).round.t;await beats(page,6);eq((await game(page)).round.t,t1,'pause stops the real clock');await page.locator('#pause').click();
  await page.waitForFunction(t=>window.__game().round.t>t,t1,{timeout:30000});checks++;
  await answer(page,true,false);eq((await game(page)).phase,'reward','answered on the real clock');const w2=(await game(page)).world.t;
  await page.waitForFunction(w=>window.__game().world.t>=w+3,w2,{timeout:30000});ok(true,'the world clock keeps running during the sale');
  await page.waitForFunction(()=>window.__game().phase==='ask'&&window.__game().round.t>=3,{},{timeout:30000});ok(true,'next question comes by itself on the real clock');
  await page.waitForFunction(()=>window.__game().gold.pending===0,{},{timeout:30000});eq((await game(page)).gold.shown,(await game(page)).state.gold,'gold number caught up');
  eq(errors,[],'clock page errors');await ctx.close();
 }}finally{await clockBrowser.close()}

 /* ===== 3. 손맛: 움직임을 켠 3D 화면. 동전이 매대에서 금화 칸으로 날아가고, 가게에서 여러 종류를 차례로 지어 본다 ===== */
 const feel=await chromium.launch({headless:true,args:SWIFT});
 try{for(const width of run('feel')?[1366,390]:[]){
  const ctx=await feel.newContext({viewport:{width,height:844},hasTouch:width<600,reducedMotion:'no-preference'});
  await ctx.addInitScript(HOLD);await ctx.addInitScript(FAKE_TTS);await ctx.addInitScript(RECORD);const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await ready(page);
  /* 7세 낱말 문제로 돌린다: 짧아서 정답 사이에 세계가 흐르는 시간이 예전 소리 문제와 비슷하다(8세 읽기는 문제마다 번개 대기 7초 남짓 → 그사이 닭을 잃어 마지막 '다 지음' 확인이 흔들릴 수 있음) */
  await seed(page,{gold:6000,hall:0,index:0,age:7});await page.waitForFunction(()=>window.VillageView?.inspect().ready,{},{timeout:45000});
  eq(await page.locator('.scene').getAttribute('data-renderer'),'three','feel test runs in 3D');
  await begin(page,{age:7});
  /* 동전 비행: 숫자는 동전이 닿을 때 오르고 2.4초 안에 규칙 금화와 같아진다 */
  {const g0=(await game(page)).gold.shown;await answer(page,true,false);const g=await game(page);eq(g.gold.shown,g0,'number waits for the coins');ok(g.gold.pending>0,'coins on the way');
   await tick(page,15);const fly=await page.evaluate(()=>{const card=document.getElementById('stageCard').getBoundingClientRect(),p=document.getElementById('gold').getBoundingClientRect(),s=document.getElementById('scene').getBoundingClientRect();
    return [...document.querySelectorAll('#coinLayer .coin-fly')].map(c=>{const cs=getComputedStyle(c),x0=parseFloat(cs.getPropertyValue('--x0')),y0=parseFloat(cs.getPropertyValue('--y0')),dx=parseFloat(cs.getPropertyValue('--dx')),dy=parseFloat(cs.getPropertyValue('--dy'));
     return {fromScene:x0+card.left>=s.left&&x0+card.left<=s.right&&y0+card.top>=s.top&&y0+card.top<=s.bottom,toPill:Math.abs(x0+dx+card.left-(p.left+11))<3&&Math.abs(y0+dy+card.top-(p.top+p.height/2))<3,img:getComputedStyle(c.firstChild).backgroundImage.includes('animation/')}})});
   ok(fly.length>=1&&fly.every(c=>c.fromScene&&c.toPill&&c.img),'coins fly from the market (in the scene) to the gold pill: '+JSON.stringify(fly));
   await shot(page.locator('.stage-card'),'feel-'+width+'-coins');
   await tick(page,5);const mid=(await game(page)).gold.shown;ok(mid>g0&&mid<=g.state.gold,'number climbs as coins land: '+mid);
   /* +N는 1초 남짓 뒤 사라지므로 마지막 틱과 같은 호출 안에서 센다 */
   const [end,plus]=await page.evaluate(()=>{const g=window.__tick(4);return [g,[...document.querySelectorAll('#coinLayer .gold-plus')].map(e=>e.textContent)]});eq([end.gold.shown,end.gold.pending],[end.state.gold,0],'all coins in by 2.4 s');eq(await gold(page),'🪙 '+end.state.gold,'gold pill shows it');
   eq(plus,['+'+(end.state.gold-g0)],'+N pops next to the gold pill');await settle(page);await fxLog(page)}
  const want=['tower','chicken','hall','power','farmer','hall','pond','hall','feast'],made=[];
  for(const target of want){
   /* 3D 알 판매 연출은 2초 남짓이라, 누르기 전부터 프레임마다 지켜보다가 한 번이라도 재생되면 기록한다 */
   await page.evaluate(()=>{window.__saleSeen=false;const watch=()=>{try{if(window.VillageView.inspect().sale){window.__saleSeen=true;return}}catch{}requestAnimationFrame(watch)};requestAnimationFrame(watch)});
   await answer(page,true,false);await phaseIs(page,'reward');
   const strip=(await fxLog(page)).filter(x=>x.c==='sale');eq(strip.length,1,'sale strip on every first-try answer');
   if(!INTERIM){await page.waitForFunction(()=>window.__saleSeen===true,{},{timeout:30000}).then(()=>checks++).catch(()=>ok(false,'3D sale sequence plays'))}
   await settle(page);await page.evaluate(()=>{const g=window.__game();if(g.gold.pending>0)window.__tick(30)});
   const st=await slotStates(page);ok(st.includes(target+':buy'),'slot '+target+' can be bought: '+st);
   const before=await page.evaluate(()=>window.VillageView.inspect());
   await buy(page,target,width<600);made.push(target);
   const fx=await fxLog(page),count=c=>fx.filter(x=>x.c===c).length,tagx=fx.find(x=>x.c==='fx-label');
   ok(count('fx-flash')===1&&count('fx-ring')===1&&count('fx-star')>=7&&count('fx-label')===1,target+' flash, ring, sparks and name tag: '+names(fx).join(','));ok(tagx.inside,target+' name tag stays inside the scene: '+tagx.box);
   eq((await game(page)).phase,'ask','still answering after buying '+target);
   if(made.filter(x=>x===target).length===1){for(const f of [2,6,12]){await frames(page,f===2?2:f===6?4:6);await shot(page.locator('.scene'),'feel-'+width+'-'+target+'-f'+String(f).padStart(2,'0'))}}
   if(!INTERIM){await page.waitForFunction(([k,v])=>(window.VillageView.inspect().builds||{})[k]>=v,[target,((before.builds||{})[target]||0)+1],{timeout:30000}).catch(()=>{});
    const after=await page.evaluate(()=>window.VillageView.inspect());eq((after.builds||{})[target],((before.builds||{})[target]||0)+1,target+' plays one 3D build effect')}
   await page.waitForFunction(()=>!document.querySelector('#effects .fx'),{},{timeout:8000});checks++;
  }
  const st=(await game(page)).state;eq([st.level,st.chickens>=2,st.hall,st.power,st.farmers,st.pond,st.feast],[1,true,3,1,1,1,1],'everything built (incl. tower power)');
  /* 추천 반짝임(움직임 켬): 금빛 테두리가 숨 쉬듯 빛나고 위에 ⭐ */
  {const r=await page.evaluate(()=>{const s=document.querySelector('#shop .slot');s.classList.add('rec');const cs=getComputedStyle(s),b=getComputedStyle(s,'::before');const out=[cs.animationName,b.content,parseFloat(cs.borderTopWidth)];s.classList.remove('rec');return out});
   ok(r[0].includes('recGlow')&&r[1].includes('⭐')&&r[2]>=3,'recommended slot: breathing gold border + ⭐: '+r)}
  await shot(page,'feel-'+width+'-after');
  eq(errors,[],'feel '+width+' page errors');await ctx.close();
 }}finally{await feel.close()}

 /* ===== 4. 3D를 못 쓰는 기기: 그림 화면에서도 늑대가 다가오고, 산 것이 나타나야 한다 ===== */
 const fallbackBrowser=await chromium.launch({headless:true,args:SWIFT});
 try{if(run('fallback')){
 const ctx=await fallbackBrowser.newContext({viewport:{width:390,height:844},reducedMotion:'no-preference'});await ctx.addInitScript(HOLD);await ctx.addInitScript(FAKE_TTS);await ctx.addInitScript(RECORD);
 const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/environment-pack.glb',route=>route.abort());
 await p.goto(url);await p.waitForFunction(()=>document.querySelector('.scene').dataset.renderer==='fallback');
 await begin(p,{age:8});await expectQuestion(p,8,'story',0,'fallback default');
 /* 늑대마다 부수기·물기로 멈춰 있을 수 있으므로, 보이는 늑대 전체 자리를 본다 */
 const wolfPos=()=>p.locator('#enemies .enemy:not(.hidden)').evaluateAll(a=>a.map(n=>n.style.left+'|'+n.style.bottom).sort().join(';'));
 await tick(p,200);eq(await p.locator('#enemies .enemy:not(.hidden)').count(),await notGone(p),'fallback: wolves drawn where the simulation has them');const l0=await wolfPos();await tick(p,40);ok(await wolfPos()!==l0,'fallback wolf moves');
 ok((await fxLog(p)).some(x=>x.c==='paws'),'fallback: paw prints for the pack');
 {const g0=(await game(p)).state.gold;await answer(p,true,false);const g=await game(p);eq(g.gold.shown,g.state.gold,'fallback: no coin flight, the number jumps');ok(g.state.gold>g0,'gold paid');
  const w=g.world.t;await tick(p,6);eq((await game(p)).world.t,w+6,'fallback: the world keeps running during the sale')}
 await settle(p);
 const still=await p.locator('#shop .slot[data-key="fence"]').evaluate(async b=>{const a=b.getBoundingClientRect();await new Promise(r=>setTimeout(r,330));const c=b.getBoundingClientRect();return [getComputedStyle(b).animationName,Math.abs(a.top-c.top)<.01]});
 eq(still,['none',true],'shop slots hold still (tap target does not move)');
 await p.evaluate(()=>{state.gold=60;render()});await buy(p,'chicken',false);eq(await p.locator('#flock img').count(),2,'fallback chicken appears');ok(await p.locator('#flock img').last().evaluate(e=>e.classList.contains('spawn')),'fallback chicken pops in');
 await p.evaluate(()=>{state.gold=3000;render()});
 const inScene=sel=>p.locator(sel).evaluateAll(a=>{const s=document.getElementById('scene').getBoundingClientRect();return a.length>0&&a.every(e=>{const r=e.getBoundingClientRect();return r.width>20&&r.left>=s.left-1&&r.right<=s.right+1&&r.top>=s.top-1&&r.bottom<=s.bottom+1})});
 for(const target of ['tower','fence','hall','power','hall','farmer','pond'])await buy(p,target,false);
 await p.evaluate(()=>Promise.all(document.getAnimations().filter(a=>a.animationName==='spawnPop').map(a=>a.finished.catch(()=>{}))));
 ok((await p.locator('#houseArt').getAttribute('src')).endsWith('home-03.png'),'fallback hall grows');ok(await inScene('#pond'),'fallback pond inside the scene');ok(await inScene('#fenceRow img'),'fallback fence inside the scene');ok(await inScene('#flock img'),'fallback hens inside the scene');
 ok(await p.locator('#villageCanvas').isHidden(),'canvas hidden in fallback');
 /* 많이 사도(닭 20·울타리 18·농부 10) 그림 마을이 장면 밖으로 넘치지 않는다 */
 await p.evaluate(()=>{Object.assign(state,{chickens:20,fence:18,farmers:9});World.sync(world,state);render()});ok(await inScene('#flock img'),'20 hens stay inside the scene');ok(await inScene('#fenceRow img'),'fence posts stay inside');ok(await inScene('#farmers'),'farmers stay inside');
 await shot(p.locator('.scene'),'fallback-390-built');await shot(p,'fallback-390');
 eq(errors,[],'fallback page errors');await ctx.close();
 }}finally{await fallbackBrowser.close()}
 /* ===== 5. 체험 주소(?demo=3): 다 자란 마을에서 몬스터 5종·우두머리·터지는 화살이 실제 화면에 나오고, 원래 저장은 그대로 ===== */
 const demoBrowser=await chromium.launch({headless:true,args:SWIFT});
 try{if(run('demo')){
  const ctx=await demoBrowser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'no-preference'});await ctx.addInitScript(HOLD);await ctx.addInitScript(FAKE_TTS);
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url+'/?demo=3');await ready(page);
  ok((await page.locator('header small').textContent()).includes('체험: 마을회관 3단계'),'demo label');
  const is3d=await page.locator('.scene').getAttribute('data-renderer')==='three';ok(is3d,'demo runs in 3D');
  await begin(page,{age:8},true);let g=await game(page);eq([g.state.hall,g.state.level,g.state.power,g.world.radius],[3,5,2,16],'demo starts with a grown village');
  eq((await slotStates(page)).map(x=>x.split(':')[0]),Combat.shopKeys(g.state),'demo shop: 8 slots, feast in the 8th');
  /* 우두머리는 네 번째 무리마다: 무리 5번 + 걸어오는 시간만큼 흘린다(100틱씩, 3D가 따라오게) */
  const goal=g.world.interval*5+80;for(let t=0;t<goal;t+=100){await tick(page,100);if(is3d)await frames(page,1)}
  g=await game(page);const seen=Object.keys(g.world.seen);
  for(const k of ['wolf','bramble','boar','granite','frost','ember'])ok(seen.includes(k),'demo: '+k+' appeared ('+seen+')');ok(g.world.stats.bosses>=1&&g.world.stats.splash>0,'demo: boss arrived and splash arrows hit: '+JSON.stringify(g.world.stats));
  ok(g.world.wolves>=10,'demo: many wolves at once: '+g.world.wolves);
  if(is3d&&!INTERIM){await frames(page,3);const i=await page.evaluate(()=>window.VillageView.inspect());eq(i.wolvesVisible,await notGone(page),'demo: 3D draws every wolf');ok(i.drawCalls>0,'demo scene metrics');console.log('DEMO_METRICS:'+JSON.stringify({wolves:i.wolvesVisible,drawCalls:i.drawCalls,triangles:i.triangles,kinds:i.wolfKinds}))}
  await shot(page.locator('.scene'),'demo3-390');
  eq(await page.evaluate(()=>localStorage.getItem('hangul-defense-v1')),null,'demo never touches the real save');ok(await page.evaluate(()=>!!localStorage.getItem('hangul-defense-demo3')),'demo has its own save');
  eq(errors,[],'demo page errors');await ctx.close();
 }}finally{await demoBrowser.close()}
 /* ===== 6. 흐름 가장자리: 판매 연출 중 쉬기·새로고침·나이 바꾸기, 7세 퀴즈(듣기 없이 바로 풀이·놓친 뒤 기다림), 예전 듣고 고르기 저장 이어받기, 움직임 줄이기의 알림 띠, 우두머리 보상, 체험 초기화,
    말풍선(글만·움직임 줄이기의 굵은 테두리), 320 가게 안내.
    3D와 무관한 흐름이라 GLB를 막아 그림 화면으로 돌린다. ===== */
 const flowBrowser=await chromium.launch({headless:true,args:SWIFT});
 try{if(run('flow')){
  const BANNERS=()=>{window.__banners=[];document.addEventListener('DOMContentLoaded',()=>{new MutationObserver(m=>m.forEach(r=>r.addedNodes.forEach(n=>{if(n.classList&&n.classList.contains('banner'))window.__banners.push(n.textContent)}))).observe(document.getElementById('effects'),{childList:true})})};
  const open=async(o={})=>{const ctx=await flowBrowser.newContext({viewport:{width:o.width||390,height:o.height||844},hasTouch:true,reducedMotion:o.motion?'no-preference':'reduce'});await ctx.addInitScript(HOLD);await ctx.addInitScript(FAKE_TTS);await ctx.addInitScript(BANNERS);
   const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/environment-pack.glb',r=>r.abort());await page.goto(url+(o.query||''));await ready(page);return {ctx,page,errors}};
  const bannerBoxes=page=>page.evaluate(()=>{const s=document.getElementById('scene').getBoundingClientRect();
   return [...document.querySelectorAll('#effects .banner')].map(b=>{const r=b.getBoundingClientRect(),cs=getComputedStyle(b);return {text:b.textContent,shown:cs.display!=='none',opacity:cs.opacity,anim:cs.animationName,inside:r.left>=s.left-.5&&r.right<=s.right+.5&&r.top>=s.top-.5&&r.bottom<=s.bottom+.5,w:Math.round(r.width),sceneW:Math.round(s.width)}})});

  /* 10세: 판매 연출 중 쉬기 → 새로고침 → 나이 바꾸기 */
  {const {ctx,page,errors}=await open();
   await seed(page,{age:10,index:0,gold:3000,hall:1,level:1,chickens:3});await begin(page,{age:10},true);
   await expectQuestion(page,10,'story',0,'flow: long passage');
   await answer(page,true,true);await phaseIs(page,'reward');const paid=(await game(page)).state.gold;
   await page.locator('#pause').tap();await tick(page,30);let g=await game(page);eq([g.phase,g.paused],['reward',true],'paused during the sale: it waits');
   await page.locator('#shop .slot[data-key="tower"]').tap();eq((await game(page)).state.gold,paid,'paused: tapping the shop does nothing');await page.locator('#pause').tap();
   /* 연출 중 새로고침: 금화는 다시 주지 않고 다음 문제부터 */
   eq((await stored(page)).round,null,'saved during the sale without an unfinished question');
   await page.reload();await ready(page);eq(await page.locator('#go').textContent(),'시작하기 ▶','no resume prompt: the paid question is done');await page.locator('#go').tap();await phaseIs(page,'ask');
   g=await game(page);eq([g.state.gold,g.state.index],[paid,1],'reload during the sale: no gold twice, next question');await expectQuestion(page,10,'story',1,'flow: next passage after reload');
   /* 연출 중에 나이를 바꾸면 다음 문제부터 새 나이 */
   await answer(page,true,true);await phaseIs(page,'reward');
   await page.locator('#drawerSummary').tap();await page.locator('#age').selectOption('8');
   g=await game(page);eq([g.phase,g.state.age,g.state.mode],['reward',8,'story'],'switching during the sale keeps it');eq(await page.locator('#feedback').textContent(),'다음 문제부터 8세 문제가 나와요.','next-question notice (no mode name)');
   await settle(page);await expectQuestion(page,8,'story',2,'flow: next question in the new age');
   eq(errors,[],'flow reward page errors');await ctx.close()}

  /* 7세 상식·수학·영어: 듣기 없이 바로 푼다. 놓치면 음성 없이 다시 볼 시간만큼 기다린 뒤 초록 답을 눌러 다음 문제 */
  {const {ctx,page,errors}=await open();await seed(page,{age:7,index:I7});await page.locator('#ageRow button[data-age="7"]').tap();await page.locator('#go').tap();
   let g=await game(page);eq([g.phase,g.round.t],['ask',0],'7세 quiz: answering starts at once (no listening step)');const q=await expectQuestion(page,7,'story',I7,'flow: 7세 quiz item');eq(q.mode,'quiz','7세 quiz slot');
   eq(await page.locator('#speak, #rate, #voiceStatus').count(),0,'7세 quiz: no voice controls');ok(!('voiceOff' in g)&&!('speaking' in g),'no voice state in __game');
   await answer(page,false,true);await tick(page,Combat.DASH_TICKS);await answer(page,false,true,1);eq((await game(page)).phase,'learn','7세 quiz missed twice: learning step');
   const lt=Combat.learnTicks(q);eq(await page.locator('#answers button.tap-me').count(),0,'the green answer waits first');await tick(page,lt-1);eq(await page.locator('#answers button.tap-me').count(),0,'still waiting');await tick(page,1);eq(await page.locator('#answers button.tap-me').count(),1,'the green answer opens by time');
   await page.locator('#answers button.tap-me').tap();await phaseIs(page,'ask');await expectQuestion(page,7,'story',I7+1,'flow: next item after learning');
   await answer(page,true,true);eq((await game(page)).phase,'reward','play goes on');eq(await page.evaluate(()=>window.__said),[],'speech synthesis is never called');
   eq(errors,[],'flow 7세 quiz page errors');await ctx.close()}

  /* 예전 '듣고 고르기' 저장(풀던 소리 문제 포함): 읽고 고르기로 이어진다. 금화·번호는 그대로, 풀던 소리 문제는 같은 번호의 읽기 문제로 새로 */
  {const {ctx,page,errors}=await open();
   await page.evaluate(()=>{Object.assign(state,{gold:321,wins:4,index:4,age:8,mode:'sound'});state.round={token:'8:sound:4',phase:'ask',t:30,tries:1};save()});eq((await stored(page)).mode,'sound','(an old sound-mode save is in storage)');
   await page.reload();await ready(page);let g=await game(page);eq([g.phase,g.state.mode,g.state.round,g.state.gold,g.state.index],['start','story',null,321,4],'old sound save loads as reading mode, the unfinished sound item is dropped');
   eq(await page.locator('#go').textContent(),'시작하기 ▶','no resume prompt for the dropped sound item');eq(await page.locator('#startSound, #startStory, #mode').count(),0,'no mode buttons');
   await page.locator('#go').tap();await phaseIs(page,'ask');const q=await expectQuestion(page,8,'story',4,'flow: old sound save continues with the reading item of the same number');eq(q.mode,'story','a reading item');
   g=await game(page);eq([g.round.t,g.round.tries,g.state.gold],[0,0,321],'fresh question, gold kept');eq((await stored(page)).mode,'story','saved again as story');eq((await stored(page)).version,1,'save version stays 1');
   await answer(page,true,true);eq((await game(page)).phase,'reward','old sound save: play goes on');eq(await page.evaluate(()=>window.__said),[],'old sound save: nothing is read aloud');
   eq(errors,[],'flow old sound save page errors');await ctx.close()}

  /* ?demo=3 첫 무리: 새 몬스터 여러 종류가 한꺼번에 → 알림 띠는 하나씩 차례로(움직임 줄이기에서도 멈춘 채 읽힘), 판매 연출 동안 숨김, 우두머리 보상 띠는 바로 */
  {const {ctx,page,errors}=await open({query:'/?demo=3'});await begin(page,{age:8},true);
   let most=0;const seen=[];
   for(let i=0;i<80&&seen.length<3;i++){await tick(page,5);const b=await bannerBoxes(page);most=Math.max(most,b.length);
    for(const x of b){if(!seen.includes(x.text)){seen.push(x.text);ok(x.shown&&x.opacity==='1'&&x.anim==='none'&&x.inside,'reduced motion: banner still, inside the scene: '+JSON.stringify(x));
     if(x.text.includes('새 몬스터'))ok(x.w>x.sceneW/2,'banner not squeezed into half the scene: '+JSON.stringify(x))}}}
   eq(most,1,'one banner at a time');ok(seen.length>=3,'queued banners take turns: '+seen.join(' / '));
   const gold0=(await game(page)).state.gold;
   await page.evaluate(()=>{world.wolves=[];world.arrows=[];world.trickle=world.t+9999;const t=world.buildings.find(b=>b.kind==='tower'&&!b.broken);t.cd=0;t.stun=0;
    world.wolves.push({id:777777,kind:'ember',x:t.x+1.2,z:t.z,sx:t.x+30,sz:t.z,hp:1,max:200,speed:0,state:'walk',target:0,timer:0,inside:0,hen:0,roar:999})});
   for(let i=0;i<30&&!(await game(page)).world.stats.bossKills;i++)await tick(page,1);
   let g=await game(page);eq(g.world.stats.bossKills,1,'the boss falls');eq(g.state.gold,gold0+Combat.BOUNTY,'boss bounty gold');eq(g.gold.shown,g.state.gold,'bounty shows at once');
   let b=await bannerBoxes(page);eq(b.length,1,'bounty banner alone');ok(b[0].text.includes('불씨 왕을 쓰러뜨렸어요!')&&b[0].text.includes('🪙 +'+Combat.BOUNTY),'bounty banner right away (jumps the queue): '+b[0].text);
   ok((await page.locator('#villageStatus').textContent()).includes('👑'),'bounty in the status line');
   await answer(page,true,true);await phaseIs(page,'reward');b=await bannerBoxes(page);ok(b.length===1&&!b[0].shown,'banner hidden during the sale (no clash with the sale strip)');
   await settle(page);b=await bannerBoxes(page);ok(b.length===1&&b[0].shown&&b[0].text.includes('불씨 왕을 쓰러뜨렸어요'),'banner back after the sale');
   await page.locator('#pause').tap();const left=await page.evaluate(()=>bannerLeft);await tick(page,50);eq(await page.evaluate(()=>bannerLeft),left,'banner waits while paused');await page.locator('#pause').tap();
   eq(errors,[],'flow demo3 page errors');await ctx.close()}

  /* 체험 초기화: 체험 마을로 돌아가고, 원래 저장은 그대로 */
  {const {ctx,page,errors}=await open();await seed(page,{gold:777,wins:5,index:9,age:8});
   await page.goto(url+'/?demo=2');await ready(page);const real=await page.evaluate(()=>localStorage.getItem('hangul-defense-v1'));
   ok((await page.locator('header .demo-tag').textContent())==='체험: 마을회관 2단계','demo 2 label');
   await begin(page,{age:8},true);await answer(page,true,true);await phaseIs(page,'reward');await settle(page);
   let g=await game(page);ok(g.state.wins===1&&g.state.index===1&&g.state.gold!==450,'progress inside the demo');
   page.once('dialog',d=>d.accept());await page.locator('#drawerSummary').tap();await page.locator('#reset').tap();await phaseIs(page,'ask');
   g=await game(page);eq([g.state.hall,g.state.level,g.state.fence,g.state.chickens,g.state.farmers,g.state.power,g.state.gold,g.state.wins,g.state.index,g.world.radius],[2,3,4,6,1,1,450,0,0,13],'demo reset brings back the demo village');
   eq(await page.evaluate(()=>localStorage.getItem('hangul-defense-v1')),real,'demo reset leaves the real save alone');eq((await page.evaluate(()=>JSON.parse(localStorage.getItem('hangul-defense-demo2')))).hall,2,'demo save after reset');
   await page.goto(url);await ready(page);g=await game(page);eq([g.state.gold,g.state.wins,g.state.index],[777,5,9],'real progress intact outside the demo');eq(await page.locator('header .demo-tag').count(),0,'no demo label without ?demo');
   eq(errors,[],'flow demo reset page errors');await ctx.close()}

  /* 말풍선(320×568, 움직임 줄이기 = 굵은 금빛 테두리만): 맞힌 뒤 뜨고, 꼬리가 칸을 가리킨다(글만, 눌러 듣기 없음). 사면 반짝임이 끝난다. */
  {const {ctx,page,errors}=await open({width:320,height:568});await seed(page,{age:7,index:0});await begin(page,{age:7},true);
   await answer(page,true,true);await tick(page,2);let bb=await bubbleBox(page);
   ok(bb&&bb.text===CHICK&&bb.inside&&bb.tailOnSlot&&bb.glow,'320: bubble above the shop, tail on the chicken slot: '+JSON.stringify(bb));
   eq(await page.evaluate(()=>window.__said.length),0,'the bubble is not read aloud');eq(await page.locator('#bubble').getAttribute('title'),null,'no tap-to-listen hint on the bubble');
   {const lit=await page.locator('#shop .slot[data-key="chicken"]').evaluate(s=>[s.classList.contains('lit'),getComputedStyle(s,'::after').display]);ok(lit[0]&&lit[1]==='none','reduced motion: the slot lights up without a leftover light band: '+lit)}
   const rim=await page.locator('#shop .slot[data-key="chicken"]').evaluate(s=>{const c=getComputedStyle(s);return [parseFloat(c.borderTopWidth),c.animationName,c.borderTopColor]});ok(rim[0]>=3&&rim[1]==='none','reduced motion: a still, thick gold border: '+rim);
   await shot(page,'flow-bubble-320x568');
   await settle(page);await buy(page,'chicken',true);ok(!(await page.locator('#shop .slot[data-key="chicken"]').evaluate(s=>s.classList.contains('rec'))),'buying it ends the glow');eq(await page.evaluate(()=>getVillageState().recommend),null,'getVillageState.recommend cleared');
   /* 320 가게 안내는 카드 안에 */
   await page.evaluate(()=>{state.gold=0;render()});await buy(page,'farmer',true);const tip=await page.evaluate(()=>{const t=document.getElementById('shopTip').getBoundingClientRect(),c=document.getElementById('stageCard').getBoundingClientRect();return {text:document.getElementById('shopTip').textContent,inside:t.left>=c.left-.5&&t.right<=c.right+.5&&t.top>=c.top}});
   ok(tip.text.endsWith('더 모아요')&&tip.inside,'320: the poor-slot tip stays inside the card: '+JSON.stringify(tip));
   eq(errors,[],'flow bubble page errors');await ctx.close()}
 }}finally{await flowBrowser.close()}
 console.log((ONLY?'PARTIAL('+ONLY+') ':'')+'PASS '+checks+' browser assertions (Chromium/WebKit, desktop + mobile emulation, held clock + one real-clock run). Physical audio/device validation remains manual.');
 }finally{server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
