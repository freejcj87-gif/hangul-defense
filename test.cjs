const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const Questions=require('./questions.js'),Combat=require('./combat.js');
const INTERIM=process.env.INTERIM_NO_3D_BUILD==='1',FULL_SHOTS=process.env.FULL_SHOTS==='1';
const ONLY=process.env.ONLY||'',run=part=>!ONLY||ONLY.split(',').includes(part);/* ONLY=matrix,clock,feel,fallback,demo,flow 중 일부만 돌릴 때(개발용). CI는 전부 돌린다. */
const KEY='hangul-defense-v1',SWIFT=['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'];
/* 검사 기본: 시계를 세우고(__HOLD_CLOCK) 틱을 직접 돌린다. CI의 SwiftShader는 프레임 간격이 200ms를 넘기도 해서 벽시계 대기는 쓰지 않는다.
   음성은 가짜(바로 읽기 시작·끝)로 바꾼다. 실제 음성은 실기기에서 따로 확인해야 한다. */
const HOLD=()=>{window.__HOLD_CLOCK=true};
const FAKE_TTS=()=>{const S={speak(u){setTimeout(()=>{u.onstart&&u.onstart();u.onend&&u.onend()},0)},cancel(){},getVoices(){return [{lang:'ko-KR',name:'test'}]}};
 Object.defineProperty(window,'speechSynthesis',{value:S,configurable:true});Object.defineProperty(window,'SpeechSynthesisUtterance',{value:function(t){this.text=t},configurable:true,writable:true})};
(async()=>{
 const output=path.join(__dirname,'.pages-build'),shots=path.join(__dirname,'test-results');
 const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const file=pathname==='/'?'index.html':['/combat.js','/world.js','/questions.js','/village.js'].includes(pathname)?pathname.slice(1):pathname==='/art-handoff/coopnight/source-3d/models/environment-pack.glb'?pathname.slice(1):/^\/art-handoff\/coopnight\/browser\/[a-z/-]+[0-9a-z-]*\.png$/.test(pathname)?pathname.slice(1):null;
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
 /* 화면 문제 = 그 나이·모드의 index번째(4문제마다 상식·수학·영어가 섞인 순서, Questions.at). 보기 순서는 바퀴(lap)마다 한 칸씩 돈다. */
 async function expectQuestion(page,age,mode,index,msg){
  const s=await shown(page),q=Questions.at(age,mode,index),n=q.choices.length,order=q.choices.map((_,k)=>q.choices[(k+(q.lap||0))%n]);
  eq(s.qid,q.id,msg+': question id');eq(s.age,age,msg+': age');eq(s.mode,q.mode,msg+': mode');eq(s.labels,order,msg+': choices');eq(s.prompt,q.prompt,msg+': prompt');eq(s.passage,q.passage||'',msg+': passage');
  if(q.mode==='quiz')ok(s.chip.startsWith(age+'세 · ')&&s.chip.endsWith(Questions.CATS[q.cat]),msg+': category chip '+s.chip);else{eq(s.chip,age+'세 · '+Questions.LEVELS[age][mode],msg+': level chip');eq(Questions.checkLevel(age,mode,q),[],msg+': level rules')}
  return q}
 /* 카드를 여러 장 고르는 문제(긴 글·상식 등)면 남은 카드는 건너뛰고 다음 문제로 */
 async function finishPick(page){for(let i=0;i<3&&(await game(page)).phase==='pick';i++){await page.evaluate(()=>{const g=window.__game();if(g.round.pickLock>0)window.__tick(g.round.pickLock)});await page.locator('#skip').click()}}
 const notGone=page=>page.evaluate(()=>world.wolves.filter(v=>v.state!=='gone').length);
 const game=page=>page.evaluate(()=>window.__game());
 const tick=(page,n)=>page.evaluate(n=>window.__tick(n),n);
 const quiet=page=>page.waitForFunction(()=>!window.__game().speaking,{},{timeout:20000});
 const phaseIs=(page,p)=>page.waitForFunction(p=>window.__game().phase===p,p,{timeout:20000});
 const ready=page=>page.waitForFunction(()=>['three','fallback'].includes(document.querySelector('.scene').dataset.renderer),{},{timeout:45000});
 async function begin(page,{age=8,mode='sound'}={},touch){const tap=l=>touch?l.tap():l.click();
  await tap(page.locator('#ageRow button[data-age="'+age+'"]'));await tap(page.locator(mode==='sound'?'#startSound':'#startStory'));await tap(page.locator('#go'));await phaseIs(page,'ask')}
 /* right=true면 정답, false면 첫 번째 오답. 보기 잠금(0.3초·글 먼저 읽기)은 틱으로 넘긴다. */
 async function answer(page,right,touch,k=0){await phaseIs(page,'ask');await page.evaluate(()=>{const g=window.__game();if(g.phase==='ask'&&g.round.lock>0)window.__tick(g.round.lock)});
  const g=await game(page),wrongs=g.round.choices.map((_,i)=>i).filter(i=>i!==g.round.answer),i=right?g.round.answer:wrongs[k];
  const b=page.locator('#answers button[data-i="'+i+'"]');if(touch)await b.tap();else await b.click();return g}
 const gold=page=>page.locator('#gold').textContent();
 const noOverflow=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
 async function answersFit(page){return page.evaluate(()=>{const r=[...document.querySelectorAll('#answers button')].map(b=>b.getBoundingClientRect());const inside=r.every(x=>x.left>=0&&x.right<=innerWidth+.5&&x.width>=44&&x.height>=44);const apart=r.every((a,i)=>r.every((b,j)=>i>=j||a.right<=b.left+.5||b.right<=a.left+.5||a.bottom<=b.top+.5||b.bottom<=a.top+.5));return inside&&apart})}
 const pillsFit=page=>page.evaluate(()=>{const s=document.querySelector('.stats').getBoundingClientRect(),r=[...document.querySelectorAll('.stats .pill')].map(p=>p.getBoundingClientRect());return r.length===4&&r.every((a,i)=>a.width>0&&a.left>=s.left-.5&&a.right<=s.right+.5&&r.every((b,j)=>i>=j||a.right<=b.left+.5||b.right<=a.left+.5||a.bottom<=b.top+.5||b.bottom<=a.top+.5))});
 /* 휴대폰: 보기(또는 카드)를 화면 아래쪽에 맞춰 스크롤해도 시간 바와 마을 장면이 위에 붙어 함께 보이는지 */
 const stickyView=(page,target)=>page.evaluate(id=>{document.getElementById(id).scrollIntoView({block:'end'});const r=x=>{const b=document.getElementById(x).getBoundingClientRect();return {top:Math.round(b.top),bottom:Math.round(b.bottom),h:Math.round(b.height)}};return {timebar:r('timebar'),scene:r('scene'),target:r(id),prompt:r('prompt'),h:innerHeight}},target);
 const together=(v,withPrompt)=>v.timebar.top>=0&&v.scene.bottom<=v.target.top+1&&v.target.bottom<=v.h+1&&v.scene.h>=140&&(!withPrompt||v.prompt.top>=v.scene.bottom-1);
 async function frames(page,n){const from=await page.evaluate(()=>window.VillageView.inspect().frames);await page.waitForFunction(t=>window.VillageView.inspect().frames>=t,from+n,{timeout:30000})}
 const beats=(page,n)=>page.evaluate(n=>new Promise(r=>{const goal=(window.__beats||0)+n;const f=()=>(window.__beats||0)>=goal?r():setTimeout(f,20);f()}),n);
 const residents=page=>page.evaluate(()=>window.VillageView.inspect().residents);
 async function seed(page,s){await page.evaluate(s=>{Object.assign(state,s);state.round=null;save()},s);await page.reload();await ready(page)}
 const stored=page=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),KEY);
 /* 이펙트는 1초 안팎으로 사라지므로, 생성되는 순간을 페이지 안에서 기록해 두고 읽는다. */
 const RECORD=()=>{window.__fx=[];document.addEventListener('DOMContentLoaded',()=>{const scene=document.getElementById('scene');new MutationObserver(m=>m.forEach(r=>r.addedNodes.forEach(n=>{if(!n.classList)return;if(n.classList.contains('sale')){window.__fx.push({c:'sale',t:n.textContent});return}if(!n.classList.contains('fx'))return;const e={c:[...n.classList].find(x=>x.startsWith('fx-')),t:n.textContent};if(e.c==='fx-label'){const w=n.offsetWidth/2,h=n.offsetHeight/2,x=parseFloat(n.style.left),y=parseFloat(n.style.top);e.inside=n.style.left.endsWith('px')&&x-w>=0&&x+w<=scene.clientWidth&&y-48-h>=0&&y+h<=scene.clientHeight;e.box=[Math.round(x-w),Math.round(x+w),Math.round(y),scene.clientWidth,scene.clientHeight]}window.__fx.push(e)}))).observe(document.getElementById('effects'),{childList:true})})};
 const fxLog=page=>page.evaluate(()=>window.__fx.splice(0));const names=f=>f.map(x=>x.c+':'+x.t);

 try{
 /* ===== 1. 화면 매트릭스: 두 엔진 × 세 폭. 시작 화면 → 나이·모드 전환 → 정답·카드 → 오답·막기 → 놓침 ===== */
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
 ok(await page.locator('#start').isVisible(),tag+' start screen');eq(await page.locator('#ageRow button').count(),4,'four age buttons');eq((await game(page)).phase,'start','start phase');
 await page.locator('#go').scrollIntoViewIfNeeded();ok(await page.locator('#go').isVisible(),tag+' start button reachable');ok(await noOverflow(page),tag+' start screen fits the width');
 if(name==='chromium'&&(width===390||height===568))await shot(page,'start-'+width+'x'+height);
 await page.evaluate(async()=>{await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))});
 ok(await page.locator('#houseArt').evaluate(i=>i.naturalWidth===256),'house art');ok(await page.locator('#towerArt').evaluate(i=>i.naturalWidth===96),'tower art');
 await begin(page,{age:8,mode:'sound'},touch);ok(await page.locator('#start').isHidden(),'start screen closes');
 eq(await gold(page),'🪙 20','initial gold');ok(await noOverflow(page),'no horizontal overflow');ok(await pillsFit(page),'status pills do not overlap');
 await expectQuestion(page,8,'sound',0,tag+' default');
 let g=await game(page);ok(g.world.interval===130&&g.world.radius===7,'wave rhythm (13 s for 8세 sound) and starting village radius');
 ok(!(await page.locator('#speak').isHidden()),'sound mode: replay button');
 await tick(page,20);g=await game(page);eq(g.round.t,20,'held clock advances only by explicit ticks');
 const bar=await page.locator('#timeFill').evaluate(n=>n.style.width),left=Math.max(0,Math.min(1,(g.world.wave.arrive-g.world.t)/g.world.interval));eq(bar,(Math.round(left*1000)/10)+'%','time bar = time until the next wolf pack');
 ok((await page.locator('#timeTag').textContent()).startsWith('다음 무리'),'time bar label counts down to the next pack');
 if(touch){const v=await stickyView(page,'answers');ok(together(v,true),tag+' time bar, scene, question and answers on one screen: '+JSON.stringify(v))}
 if(name==='chromium'&&(FULL_SHOTS||width===390||height===568))await shot(page,'ask-'+width+'x'+height);

 /* 나이·모드 전환: 설정 서랍에서 바꾸면 그 나이 문제로 바로 바뀐다(늑대 위치는 유지). */
 await page.locator('#drawerSummary').click();
 for(const mode of ['sound','story']){
  if(mode==='story'){await page.locator('#mode').click();await phaseIs(page,'ask')}
  for(const age of [9,10,7,8]){
   await page.locator('#age').selectOption(String(age));await phaseIs(page,'ask');
   const q=await expectQuestion(page,age,mode,0,tag+' '+age+'세 '+mode);
   eq(await page.locator('#answers button').count(),q.choices.length,'button count');
   ok((await page.locator('#feedback').textContent()).startsWith(age+'세 '),'switch feedback');
   await page.evaluate(()=>{const g=window.__game();if(g.round.lock>0)window.__tick(g.round.lock)});
   ok(await noOverflow(page),age+'세 '+mode+' fits the width');ok(await answersFit(page),age+'세 '+mode+' answer buttons fit');
   eq((await stored(page)).age,age,'age saved');
   if(touch){const v=await stickyView(page,'answers');const short=age===7||mode==='sound'&&age<=9;ok(together(v,short&&height>=844),tag+' '+age+'세 '+mode+' sticky time bar + scene with answers: '+JSON.stringify(v))}
   if(name==='chromium'&&(FULL_SHOTS||width===390&&(age===10||age===7)||height===568&&age===10&&mode==='story'))await shot(page,'question-'+width+'x'+height+'-'+age+'-'+mode);
  }
 }
 await page.locator('#mode').click();await page.locator('#age').selectOption('9');await phaseIs(page,'ask');
 await page.reload();await ready(page);ok(await page.locator('#ageRow button[data-age="9"]').evaluate(b=>b.classList.contains('on')),'age survives reload');
 eq(await page.locator('#go').textContent(),'이어서 하기 ▶','unfinished question resumes');
 await page.locator('#ageRow button[data-age="8"]').click();await page.locator('#go').click();await phaseIs(page,'ask');await expectQuestion(page,8,'sound',0,'back to 8세');

 /* 한 번에 정답 → 늑대·시계 멈춤 → 카드 3장 → 고르면 다음 문제 */
 g=await game(page);const fresh=JSON.parse(JSON.stringify(g.state));
 await tick(page,Math.ceil(Combat.FAST_MIN*Combat.needSeconds(Questions.get(8,'sound',0))/Combat.TICK));/* 번개는 최소 읽기 시간이 지나야 */
 await answer(page,true,touch);const expGold=Combat.income(fresh,Questions.get(8,'sound',0),true).gold;
 eq((await game(page)).phase,'pick','first-try correct opens the cards');eq(await gold(page),'🪙 '+(20+expGold),'gold from eggs (+⚡)');
 ok((await fxLog(page)).some(x=>x.c==='sale'&&x.t.includes('🧑‍🌾')),'egg → farmer → market strip');
 ok(await page.locator('#answers button.correct.yay').count()===1,'the answered button celebrates');ok(await page.locator('#answers').isVisible(),'answers stay for the celebration');
 const frozen=(await game(page)).world.t;await tick(page,60);eq((await game(page)).world.t,frozen,'wolf world frozen while choosing');
 eq(await page.locator('#cards .choice').count(),3,'three cards');ok(await page.locator('#answers').isHidden(),'cards replace the answers');
 ok(await page.locator('#cards .choice .icon img').evaluateAll(a=>a.length>=2&&a.every(i=>i.complete&&i.naturalWidth>0)),'card art loads');
 eq(await page.locator('#cards .choice').evaluateAll(a=>a.map(b=>b.dataset.kind)),Combat.offers((await game(page)).state),'cards = rules');
 await tick(page,7);
 if(touch){const v=await stickyView(page,'choices');ok(together(v,false),tag+' scene and cards on one screen: '+JSON.stringify(v))}
 if(name==='chromium'&&(width===390||height===568))await shot(page,'pick-'+width+'x'+height);
 await page.evaluate(()=>{state.gold=500;drawCards();render()});
 const kind=width===1366?'chicken':width===390?'tower':'hall';
 const card=page.locator('#cards .choice[data-kind="'+kind+'"]');if(touch)await card.tap();else await card.click();
 eq((await game(page)).phase,'build','buying starts the build');
 const label=(await fxLog(page)).filter(x=>x.c==='fx-label');eq(label.map(x=>x.t),[{chicken:'🐔 꼬꼬 2마리!',tower:'🏹 화살 타워 2개!',hall:'🏠 마을회관 1단계!'}[kind]],'name tag (reduced motion: label only)');
 const vs=await page.evaluate(()=>getVillageState());eq([vs.chickens,vs.level,vs.fence],{chicken:[2,0,0],tower:[1,1,0],hall:[1,0,0]}[kind],'village state after buying');
 await tick(page,12);await phaseIs(page,'ask');ok(true,'next question right after building');await expectQuestion(page,8,'sound',1,'next question');
 if(three&&!INTERIM){await frames(page,2);const i=await page.evaluate(()=>window.VillageView.inspect());eq([i.chickens,i.towers,i.fences],[vs.chickens,1+vs.level,vs.fence],'3D village shows the purchase')}

 /* 오답 → 늑대 성큼 → 두 번째 정답(막기만, 금화·카드 없음) → 초록 답을 눌러 다음 */
 const before=await gold(page);g=await game(page);
 await answer(page,false,touch);g=await game(page);eq(g.round.tries,1,'one wrong answer');ok(await page.locator('#timebar').evaluate(n=>n.classList.contains('dash')),'wolf dash on the time bar');
 await tick(page,Combat.DASH_TICKS);await answer(page,true,touch);g=await game(page);eq([g.phase,g.round.result],['learn','second'],'second try only stops the wolves');eq(await gold(page),before,'no gold on the second try');
 await quiet(page);await tick(page,12);ok(await page.locator('#answers button.tap-me').count()===1,tag+' the right answer glows after it is read: '+JSON.stringify(await game(page)));
 await page.locator('#answers button.tap-me').click();await phaseIs(page,'ask');await expectQuestion(page,8,'sound',2,'continue after learning');
 /* 늑대가 닭을 물어 가고 건물이 부서지면: 닭 수가 줄고, 다음 정답 때 고치기 카드 */
 g=await game(page);const hensBefore=g.state.chickens;
 await page.evaluate(()=>{const hen=world.hens[0];for(const b of world.buildings)if(b.kind==='tower')b.broken=true;hen.state='carried';world.wolves.push({id:9999,x:0,z:-16.9,sx:0,sz:-17,hp:20,max:20,speed:.8,state:'carry',target:0,timer:0,inside:0,hen:hen.id})});
 await tick(page,3);g=await game(page);eq(g.state.chickens,hensBefore-1,'a carried-off hen is lost');ok((await page.locator('#villageStatus').textContent()).includes('물어 갔어요'),'loss explained');
 if(name==='chromium'&&width===390)await shot(page,'raid-390');
 await page.evaluate(()=>{state.gold=500});await answer(page,true,touch);await tick(page,7);ok(await page.locator('#cards .choice[data-kind="repair"]').count()===1,'repair card when something is broken');
 const rp=page.locator('#cards .choice[data-kind="repair"]');if(touch)await rp.tap();else await rp.click();eq((await game(page)).world.broken,0,'repair fixes every broken building');
 await finishPick(page);await tick(page,12);await phaseIs(page,'ask');
 /* 4번째 문제는 상식·수학·영어(듣고 고르기에서도 질문을 읽어 준 뒤 푼다) */
 await expectQuestion(page,8,'sound',3,tag+' quiz mixed in');await page.evaluate(()=>{const g=window.__game();if(g.round.lock>0)window.__tick(g.round.lock)});ok(await answersFit(page),tag+' quiz answer buttons fit');
 if(name==='chromium'&&(width===390||height===568))await shot(page,'quiz-'+width+'x'+height);

 /* 쉬기: 문제를 가리고 시계를 멈춘다 */
 await page.locator('#pause').click();ok(await page.locator('body').evaluate(b=>b.classList.contains('covered')),'pause covers the question');
 g=await game(page);await tick(page,30);eq((await game(page)).round.t,g.round.t,'paused clock does not move');eq((await game(page)).world.t,g.world.t,'paused wolf world does not move');await page.locator('#pause').click();

 /* 늑대 무리가 가장자리에서 나타나 마을로 걸어온다(세계 시뮬레이션 + 3D) */
 {const until=await page.evaluate(()=>{const g=window.__game();return g.world.wave.arrive-g.world.t});await tick(page,Math.max(1,until-60));}
 g=await game(page);ok(g.world.wolves>=1,'a wolf pack is on the map before it arrives: '+JSON.stringify(g.world));
 /* 0.8: 늑대가 쉬지 않고 오고 쓰러지므로 '가장 가까운 늑대'가 바뀔 수 있다. 같은 늑대(id)를 따라가 걷는 늑대가 모두 마을 쪽으로 왔는지 본다. */
 /* 계속 걷는 늑대는 더 가까워지고, 마을에 닿아 부수기·사냥으로 바뀐 늑대도 다가온 것으로 본다. 따라간 늑대가 모두 쓰러졌으면 다시 본다. */
 {let walked=false,seen=[];for(let k=0;k<6&&!walked;k++){
  const walk0=await page.evaluate(()=>world.wolves.filter(v=>v.state==='walk').map(v=>[v.id,Math.hypot(v.x,v.z)]));await tick(page,10);
  const walk1=await page.evaluate(ids=>world.wolves.filter(v=>ids.includes(v.id)&&v.state!=='dead'&&v.state!=='gone').map(v=>[v.id,Math.hypot(v.x,v.z),v.state]),walk0.map(x=>x[0]));
  seen=[walk0.slice(0,3),walk1.slice(0,3)];if(walk1.length)walked=walk1.every(([id,d,st])=>st==='walk'?d<walk0.find(x=>x[0]===id)[1]:['smash','hunt','bite'].includes(st))}
  ok(walked,'wolves walk toward the village: '+JSON.stringify(seen))}
 if(three&&!INTERIM){await frames(page,3);const i=await page.evaluate(()=>window.VillageView.inspect());ok(i.wolvesVisible>=1,'3D wolves visible: '+i.wolvesVisible);eq(i.wolvesVisible,await notGone(page),'3D wolf count = simulated wolves (incl. falling ones)')}
 if(name==='chromium'&&(width===390||width===1366))await shot(page.locator('.scene'),'pack-'+width);
 ok(await noOverflow(page),'no overflow after a few rounds');
 await page.screenshot({path:path.join(shots,name+'-'+width+'x'+height+'.png'),fullPage:true});

 if(name==='chromium'&&width===390){
  /* 움직임 켜기: 주민이 움직이고, 쉬기·움직임 줄이기에서 멈춘다 */
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
  await seed(page,{gold:900,level:4,fence:4,chickens:8,farmers:2,pond:2,hall:3,feast:1,wins:40,index:5,mode:'sound',age:8});await begin(page,{age:8,mode:'sound'},touch);
  await page.waitForFunction(()=>window.VillageView?.inspect().ready,{},{timeout:45000});
  await frames(page,40);
  const grown=await page.evaluate(()=>window.VillageView.inspect());
  if(!INTERIM){eq([grown.towers,grown.chickens,grown.farmers,grown.pond,grown.hall,grown.feast,grown.radius],[5,8,2,2,3,1,16],'3D grown village state');ok(grown.cameraHalf>smallHalf+4,'camera pulls back for a big village: '+[smallHalf,grown.cameraHalf])}
  await tick(page,40);await frames(page,3);await shot(page.locator('.scene'),'grown-390');console.log('SCENE_METRICS:'+JSON.stringify(await page.evaluate(()=>window.VillageView.inspect())));
 }
 /* 숫자가 가장 길어지는 상태에서도 상단 표시가 겹치지 않아야 한다. */
 await page.evaluate(()=>{Object.assign(state,{gold:12800,wins:999,level:5,chickens:8,broken:9,fence:6,hall:3,pond:3,farmers:2});render()});
 ok(await pillsFit(page),'status pills fit with the longest values');ok(await noOverflow(page),'no overflow with the longest values');
 if(name==='chromium')await shot(page.locator('.stage-card'),'stats-full-'+width+'x'+height);
 eq(errors,[],tag+' page errors');await ctx.close();
 }
 }finally{await browser.close()}
 }

 /* ===== 2. 실제 시계: 훅 없이 인터벌로 흐르고, 고르는 동안·쉬는 동안 멈춘다(박자 수로 확인) ===== */
 const clockBrowser=await chromium.launch({headless:true,args:SWIFT});
 try{if(run('clock')){
  const ctx=await clockBrowser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});await ctx.addInitScript(FAKE_TTS);
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await ready(page);
  await begin(page,{age:8,mode:'sound'});await page.waitForFunction(()=>window.__game().round.t>=5,{},{timeout:30000});ok(true,'real interval moves the clock');checks++;
  await page.locator('#pause').click();const t1=(await game(page)).round.t;await beats(page,6);eq((await game(page)).round.t,t1,'pause stops the real clock');await page.locator('#pause').click();
  await page.waitForFunction(t=>window.__game().round.t>t,t1,{timeout:30000});checks++;
  await answer(page,true,false);eq((await game(page)).phase,'pick','answered on the real clock');const t2=(await game(page)).round.t;await beats(page,6);eq((await game(page)).round.t,t2,'choosing stops the real clock');
  await page.waitForFunction(()=>window.__game().round.pickLock===0,{},{timeout:30000});await page.locator('#skip').click();await page.waitForFunction(()=>window.__game().phase==='ask',{},{timeout:30000});
  await page.waitForFunction(()=>window.__game().round.t>=3,{},{timeout:30000});checks++;
  eq(errors,[],'clock page errors');await ctx.close();
 }}finally{await clockBrowser.close()}

 /* ===== 3. 손맛: 움직임을 켠 3D 화면에서 여러 종류를 차례로 지어 본다 ===== */
 const feel=await chromium.launch({headless:true,args:SWIFT});
 try{for(const width of run('feel')?[1366,390]:[]){
  const ctx=await feel.newContext({viewport:{width,height:844},hasTouch:width<600,reducedMotion:'no-preference'});
  await ctx.addInitScript(HOLD);await ctx.addInitScript(FAKE_TTS);await ctx.addInitScript(RECORD);const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await ready(page);
  await seed(page,{gold:6000,hall:0,index:0,mode:'sound',age:8});await page.waitForFunction(()=>window.VillageView?.inspect().ready,{},{timeout:45000});
  eq(await page.locator('.scene').getAttribute('data-renderer'),'three','feel test runs in 3D');
  await begin(page,{age:8,mode:'sound'});
  const want=['tower','chicken','hall','power','farmer','hall','pond','hall','feast'],made=[];
  for(const target of want){
   /* 3D 알 판매 연출은 2초 남짓이라, 누르기 전부터 프레임마다 지켜보다가 한 번이라도 재생되면 기록한다 */
   await page.evaluate(()=>{window.__saleSeen=false;const watch=()=>{try{if(window.VillageView.inspect().sale){window.__saleSeen=true;return}}catch{}requestAnimationFrame(watch)};requestAnimationFrame(watch)});
   await answer(page,true,false);await phaseIs(page,'pick');
   const strip=(await fxLog(page)).filter(x=>x.c==='sale');eq(strip.length,1,'sale strip on every first-try answer');
   if(!INTERIM){await page.waitForFunction(()=>window.__saleSeen===true,{},{timeout:30000}).then(()=>checks++).catch(()=>ok(false,'3D sale sequence plays'))}
   await tick(page,7);
   const kinds=await page.locator('#cards .choice').evaluateAll(a=>a.map(b=>b.dataset.kind));ok(kinds.includes(target),'card '+target+' offered: '+kinds);
   const before=await page.evaluate(()=>window.VillageView.inspect());
   await page.locator('#cards .choice[data-kind="'+target+'"]').click();made.push(target);
   const fx=await fxLog(page),count=c=>fx.filter(x=>x.c===c).length,tagx=fx.find(x=>x.c==='fx-label');
   ok(count('fx-flash')===1&&count('fx-ring')===1&&count('fx-star')>=7&&count('fx-label')===1,target+' flash, ring, sparks and name tag: '+names(fx).join(','));ok(tagx.inside,target+' name tag stays inside the scene: '+tagx.box);
   if(made.filter(x=>x===target).length===1){for(const f of [2,6,12]){await frames(page,f===2?2:f===6?4:6);await shot(page.locator('.scene'),'feel-'+width+'-'+target+'-f'+String(f).padStart(2,'0'))}}
   if(!INTERIM){await page.waitForFunction(([k,v])=>(window.VillageView.inspect().builds||{})[k]>=v,[target,((before.builds||{})[target]||0)+1],{timeout:30000}).catch(()=>{});
    const after=await page.evaluate(()=>window.VillageView.inspect());eq((after.builds||{})[target],((before.builds||{})[target]||0)+1,target+' plays one 3D build effect')}
   await finishPick(page);await tick(page,12);await phaseIs(page,'ask');
   await page.waitForFunction(()=>!document.querySelector('#effects .fx'),{},{timeout:8000});checks++;
  }
  const st=(await game(page)).state;eq([st.level,st.chickens,st.hall,st.power,st.farmers,st.pond,st.feast],[1,2,3,1,1,1,1],'everything built (incl. tower power)');
  await shot(page,'feel-'+width+'-after');
  eq(errors,[],'feel '+width+' page errors');await ctx.close();
 }}finally{await feel.close()}

 /* ===== 4. 3D를 못 쓰는 기기: 그림 화면에서도 늑대가 다가오고, 고른 것이 나타나야 한다 ===== */
 const fallbackBrowser=await chromium.launch({headless:true,args:SWIFT});
 try{if(run('fallback')){
 const ctx=await fallbackBrowser.newContext({viewport:{width:390,height:844},reducedMotion:'no-preference'});await ctx.addInitScript(HOLD);await ctx.addInitScript(FAKE_TTS);
 const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/environment-pack.glb',route=>route.abort());
 await p.goto(url);await p.waitForFunction(()=>document.querySelector('.scene').dataset.renderer==='fallback');
 await begin(p,{age:8,mode:'sound'});await expectQuestion(p,8,'sound',0,'fallback default');
 const wolfPos=()=>p.locator('#enemies .enemy:not(.hidden)').first().evaluate(n=>n.style.left+'|'+n.style.bottom);
 await tick(p,200);eq(await p.locator('#enemies .enemy:not(.hidden)').count(),await notGone(p),'fallback: wolves drawn where the simulation has them');const l0=await wolfPos();await tick(p,40);ok(await wolfPos()!==l0,'fallback wolf moves');
 await answer(p,true,false);const fz=await wolfPos();await tick(p,30);eq(await wolfPos(),fz,'fallback wolves stop while choosing');
 await tick(p,7);
 const still=await p.locator('#cards .choice[data-kind="chicken"]').evaluate(async b=>{const a=b.getBoundingClientRect();await new Promise(r=>setTimeout(r,330));const c=b.getBoundingClientRect();return [getComputedStyle(b).animationName,getComputedStyle(b.querySelector('.icon')).animationName,Math.abs(a.top-c.top)<.01]});
 eq(still,['none','choiceBob',true],'cards: the picture bobs, the tap target stays still');
 await p.locator('#cards .choice[data-kind="chicken"]').click();eq(await p.locator('#flock img').count(),2,'fallback chicken appears');ok(await p.locator('#flock img').last().evaluate(e=>e.classList.contains('spawn')),'fallback chicken pops in');
 await tick(p,12);await p.evaluate(()=>{state.gold=3000;render()});
 const inScene=sel=>p.locator(sel).evaluateAll(a=>{const s=document.getElementById('scene').getBoundingClientRect();return a.length>0&&a.every(e=>{const r=e.getBoundingClientRect();return r.width>20&&r.left>=s.left-1&&r.right<=s.right+1&&r.top>=s.top-1&&r.bottom<=s.bottom+1})});
 for(const target of ['tower','fence','hall','power','hall','farmer','pond']){await answer(p,true,false);await tick(p,7);await p.locator('#cards .choice[data-kind="'+target+'"]').click();await finishPick(p);await tick(p,12)}
 await p.evaluate(()=>Promise.all(document.getAnimations().filter(a=>a.animationName==='spawnPop').map(a=>a.finished.catch(()=>{}))));
 ok((await p.locator('#houseArt').getAttribute('src')).endsWith('home-03.png'),'fallback hall grows');ok(await inScene('#pond'),'fallback pond inside the scene');ok(await inScene('#fenceRow img'),'fallback fence inside the scene');ok(await inScene('#flock img'),'fallback hens inside the scene');
 ok(await p.locator('#villageCanvas').isHidden(),'canvas hidden in fallback');
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
  await begin(page,{age:8,mode:'sound'},true);let g=await game(page);eq([g.state.hall,g.state.level,g.state.power,g.world.radius],[3,5,2,16],'demo starts with a grown village');
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
 /* ===== 6. 흐름 가장자리(0.8): 카드 여러 장 고르는 중 쉬기·새로고침·나이 바꾸기, 상식 문제에서 음성 실패, 움직임 줄이기의 알림 띠, 우두머리 보상, 체험 초기화.
    3D와 무관한 흐름이라 GLB를 막아 그림 화면으로 돌린다. ===== */
 const flowBrowser=await chromium.launch({headless:true,args:SWIFT});
 try{if(run('flow')){
  const BANNERS=()=>{window.__banners=[];document.addEventListener('DOMContentLoaded',()=>{new MutationObserver(m=>m.forEach(r=>r.addedNodes.forEach(n=>{if(n.classList&&n.classList.contains('banner'))window.__banners.push(n.textContent)}))).observe(document.getElementById('effects'),{childList:true})})};
  const BROKEN_TTS=()=>{const S={speak(u){setTimeout(()=>{u.onerror&&u.onerror({error:'synthesis-failed'})},0)},cancel(){},getVoices(){return [{lang:'ko-KR',name:'test'}]}};
   Object.defineProperty(window,'speechSynthesis',{value:S,configurable:true});Object.defineProperty(window,'SpeechSynthesisUtterance',{value:function(t){this.text=t},configurable:true,writable:true})};
  const SILENT_TTS=()=>{const S={speak(){},cancel(){},getVoices(){return [{lang:'ko-KR',name:'test'}]}};
   Object.defineProperty(window,'speechSynthesis',{value:S,configurable:true});Object.defineProperty(window,'SpeechSynthesisUtterance',{value:function(t){this.text=t},configurable:true,writable:true})};
  const open=async(o={})=>{const ctx=await flowBrowser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'});await ctx.addInitScript(HOLD);await ctx.addInitScript(o.tts||FAKE_TTS);await ctx.addInitScript(BANNERS);
   const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/environment-pack.glb',r=>r.abort());await page.goto(url+(o.query||''));await ready(page);return {ctx,page,errors}};
  const bannerBoxes=page=>page.evaluate(()=>{const s=document.getElementById('scene').getBoundingClientRect(),t=document.getElementById('timebar').getBoundingClientRect();
   return [...document.querySelectorAll('#effects .banner')].map(b=>{const r=b.getBoundingClientRect(),cs=getComputedStyle(b);return {text:b.textContent,shown:cs.display!=='none',opacity:cs.opacity,anim:cs.animationName,inside:r.left>=s.left-.5&&r.right<=s.right+.5&&r.top>=s.top-.5&&r.bottom<=s.bottom+.5,belowBar:r.top>=t.bottom,w:Math.round(r.width),sceneW:Math.round(s.width)}})});
  const enabledCard=page=>page.locator('#cards .choice:not([disabled])').first().getAttribute('data-kind');

  /* 10세 읽기(카드 3장): 쉬기 → 새로고침 → 고르는 중 나이·모드 바꾸기 */
  {const {ctx,page,errors}=await open();
   await seed(page,{age:10,mode:'story',index:0,gold:3000,hall:1,level:1,chickens:3});await begin(page,{age:10,mode:'story'},true);
   const q=await expectQuestion(page,10,'story',0,'flow: long passage');eq(Combat.picks(q),3,'flow: a long passage gives three cards');
   await answer(page,true,true);await phaseIs(page,'pick');const paid=(await game(page)).state.gold;
   await page.locator('#pause').tap();await tick(page,30);let g=await game(page);eq([g.phase,g.paused,g.round.pickLock],['pick',true,7],'paused before the cards come out: the card lock waits');ok(await page.locator('#choices').isHidden(),'paused: cards not out yet');
   await page.locator('#pause').tap();await tick(page,7);ok(await page.locator('#choices').isVisible(),'cards after resuming');
   const k0=await enabledCard(page);await page.locator('#pause').tap();await page.locator('#cards .choice[data-kind="'+k0+'"]').tap();await page.locator('#skip').tap();
   g=await game(page);eq([g.phase,g.round.picked,g.state.gold],['pick',0,paid],'paused: tapping a card or skip does nothing');await page.locator('#pause').tap();
   await page.locator('#cards .choice[data-kind="'+k0+'"]').tap();g=await game(page);eq([g.phase,g.round.picked,g.round.pickLock],['pick',1,9],'first of three cards');
   await page.locator('#pause').tap();await tick(page,20);eq((await game(page)).round.pickLock,9,'paused during the build: the lock waits');await page.locator('#pause').tap();
   await tick(page,9);ok(await page.locator('#cards .choice:not([disabled])').count()>=1,'cards come back after the build');eq(await page.locator('#skip').textContent(),'▶ 다음 문제','skip label after a pick');
   ok((await page.locator('#gainLine').textContent()).endsWith('🃏 2장 더 고를 수 있어요'),'two more cards: '+await page.locator('#gainLine').textContent());
   /* 새로고침: 남은 2장으로 이어서, 금화는 다시 주지 않는다 */
   const goldMid=(await game(page)).state.gold;eq((await stored(page)).round.left,2,'saved with two cards left');
   await page.reload();await ready(page);eq(await page.locator('#go').textContent(),'이어서 하기 ▶','resume offered in the middle of picking');await page.locator('#go').tap();
   g=await game(page);eq([g.phase,g.round.picks,g.round.picked,g.state.gold],['pick',2,0,goldMid],'reload mid-pick: two cards left, no gold twice');ok(await page.locator('#choices').isVisible(),'cards right away after reload');
   const gl=await page.locator('#gainLine').textContent();ok(gl.startsWith('🪙 이 문제의 금화는 이미 받았어요')&&gl.endsWith('🃏 2장 더 고를 수 있어요'),'restored gain line: '+gl);
   /* 고르는 중에 나이·모드를 바꾸면 남은 카드는 그대로, 다음 문제부터 새 나이·모드 */
   await page.locator('#drawerSummary').tap();await page.locator('#age').selectOption('8');await page.locator('#mode').tap();
   g=await game(page);eq([g.phase,g.round.picks,g.state.age,g.state.mode],['pick',2,8,'sound'],'switching while picking keeps the cards');ok((await page.locator('#feedback').textContent()).startsWith('다음 문제부터 8세 듣고 고르기'),'next-question notice');ok(await page.locator('#choices').isVisible(),'cards stay after switching');
   await page.locator('#cards .choice[data-kind="'+(await enabledCard(page))+'"]').tap();await finishPick(page);await tick(page,12);
   await phaseIs(page,'ask');await expectQuestion(page,8,'sound',1,'flow: next question in the new age and mode');
   eq(errors,[],'flow pick page errors');await ctx.close()}

  /* 듣고 고르기의 상식·수학·영어 문제에서 음성이 안 되면(오류·무응답): 같은 문제를 읽고 고르기로 */
  for(const [label,tts] of [['error',BROKEN_TTS],['silent',SILENT_TTS]]){const {ctx,page,errors}=await open({tts});
   await seed(page,{age:9,mode:'sound',index:3});await page.locator('#ageRow button[data-age="9"]').tap();await page.locator('#startSound').tap();await page.locator('#go').tap();
   if(label==='silent'){eq((await game(page)).phase,'listen','silent voice: waiting to hear the question');await tick(page,31)}
   await page.waitForFunction(()=>window.__game().voiceOff&&window.__game().phase==='ask',{},{timeout:20000});
   const q=await expectQuestion(page,9,'story',3,'flow: voice '+label+' on a quiz item');eq(q.mode,'quiz','voice '+label+': still the quiz item');
   const g=await game(page);eq(g.state.mode,'story','voice '+label+': switched to reading');ok((await page.locator('#feedback').textContent()).startsWith('🔇'),'voice '+label+' explained');ok(await page.locator('#speak').isHidden(),'voice '+label+': no replay button');
   await page.evaluate(()=>{const g=window.__game();if(g.round.lock>0)window.__tick(g.round.lock)});ok((await page.locator('#feedback').textContent()).startsWith('🔇'),'voice '+label+': the notice stays after the answers open');
   await answer(page,true,true);eq((await game(page)).phase,'pick','voice '+label+': the quiz can still be answered');
   eq(errors,[],'flow voice '+label+' page errors');await ctx.close()}

  /* ?demo=3 첫 무리: 새 몬스터 여러 종류가 한꺼번에 → 알림 띠는 하나씩 차례로(움직임 줄이기에서도 멈춘 채 읽힘), 카드 고르는 동안 숨김, 우두머리 보상 띠는 바로 */
  {const {ctx,page,errors}=await open({query:'/?demo=3'});await begin(page,{age:8,mode:'sound'},true);
   let most=0;const seen=[];
   for(let i=0;i<80&&seen.length<3;i++){await tick(page,5);const b=await bannerBoxes(page);most=Math.max(most,b.length);
    for(const x of b){if(!seen.includes(x.text)){seen.push(x.text);ok(x.shown&&x.opacity==='1'&&x.anim==='none'&&x.inside&&x.belowBar,'reduced motion: banner still, inside the scene, under the time bar: '+JSON.stringify(x));
     if(x.text.includes('새 몬스터'))ok(x.w>x.sceneW/2,'banner not squeezed into half the scene: '+JSON.stringify(x))}}}
   eq(most,1,'one banner at a time');ok(seen.length>=3,'queued banners take turns: '+seen.join(' / '));
   const gold0=(await game(page)).state.gold;
   await page.evaluate(()=>{world.wolves=[];world.arrows=[];world.trickle=world.t+9999;const t=world.buildings.find(b=>b.kind==='tower'&&!b.broken);t.cd=0;t.stun=0;
    world.wolves.push({id:777777,kind:'ember',x:t.x+1.2,z:t.z,sx:t.x+30,sz:t.z,hp:1,max:200,speed:0,state:'walk',target:0,timer:0,inside:0,hen:0,roar:999})});
   for(let i=0;i<30&&!(await game(page)).world.stats.bossKills;i++)await tick(page,1);
   let g=await game(page);eq(g.world.stats.bossKills,1,'the boss falls');eq(g.state.gold,gold0+Combat.BOUNTY,'boss bounty gold');
   let b=await bannerBoxes(page);eq(b.length,1,'bounty banner alone');ok(b[0].text.includes('불씨 왕을 쓰러뜨렸어요!')&&b[0].text.includes('🪙 +'+Combat.BOUNTY),'bounty banner right away (jumps the queue): '+b[0].text);
   ok((await page.locator('#villageStatus').textContent()).includes('👑'),'bounty in the status line');
   await answer(page,true,true);await phaseIs(page,'pick');b=await bannerBoxes(page);ok(b.length===1&&!b[0].shown,'banner hidden while picking (no clash with the sale strip)');
   await finishPick(page);await tick(page,12);await phaseIs(page,'ask');b=await bannerBoxes(page);ok(b.length===1&&b[0].shown&&b[0].text.includes('불씨 왕을 쓰러뜨렸어요'),'banner back after picking');
   await page.locator('#pause').tap();const left=await page.evaluate(()=>bannerLeft);await tick(page,50);eq(await page.evaluate(()=>bannerLeft),left,'banner waits while paused');await page.locator('#pause').tap();
   eq(errors,[],'flow demo3 page errors');await ctx.close()}

  /* 체험 초기화: 체험 마을로 돌아가고, 원래 저장은 그대로 */
  {const {ctx,page,errors}=await open();await seed(page,{gold:777,wins:5,index:9,age:8,mode:'sound'});
   await page.goto(url+'/?demo=2');await ready(page);const real=await page.evaluate(()=>localStorage.getItem('hangul-defense-v1'));
   ok((await page.locator('header .demo-tag').textContent())==='체험: 마을회관 2단계','demo 2 label');
   await begin(page,{age:8,mode:'sound'},true);await answer(page,true,true);await phaseIs(page,'pick');await finishPick(page);await tick(page,12);await phaseIs(page,'ask');
   let g=await game(page);ok(g.state.wins===1&&g.state.index===1&&g.state.gold!==450,'progress inside the demo');
   page.once('dialog',d=>d.accept());await page.locator('#drawerSummary').tap();await page.locator('#reset').tap();await phaseIs(page,'ask');
   g=await game(page);eq([g.state.hall,g.state.level,g.state.fence,g.state.chickens,g.state.farmers,g.state.power,g.state.gold,g.state.wins,g.state.index,g.world.radius],[2,3,4,6,1,1,450,0,0,13],'demo reset brings back the demo village');
   eq(await page.evaluate(()=>localStorage.getItem('hangul-defense-v1')),real,'demo reset leaves the real save alone');eq((await page.evaluate(()=>JSON.parse(localStorage.getItem('hangul-defense-demo2')))).hall,2,'demo save after reset');
   await page.goto(url);await ready(page);g=await game(page);eq([g.state.gold,g.state.wins,g.state.index],[777,5,9],'real progress intact outside the demo');eq(await page.locator('header .demo-tag').count(),0,'no demo label without ?demo');
   eq(errors,[],'flow demo reset page errors');await ctx.close()}
 }}finally{await flowBrowser.close()}
 console.log((ONLY?'PARTIAL('+ONLY+') ':'')+'PASS '+checks+' browser assertions (Chromium/WebKit, desktop + mobile emulation, held clock + one real-clock run). Physical audio/device validation remains manual.');
 }finally{server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
