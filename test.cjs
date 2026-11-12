const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const Questions=require('./questions.js'),Combat=require('./combat.js');
const INTERIM=process.env.INTERIM_NO_3D_BUILD==='1',FULL_SHOTS=process.env.FULL_SHOTS==='1';
const ONLY=process.env.ONLY||'',run=part=>!ONLY||ONLY.split(',').includes(part);/* ONLY=matrix,clock,feel,fallback 중 일부만 돌릴 때(개발용). CI는 전부 돌린다. */
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
 async function expectQuestion(page,age,mode,index,msg){
  const s=await shown(page),q=Questions.get(age,mode,index);
  eq(s.qid,q.id,msg+': question id');eq(s.age,age,msg+': age');eq(s.mode,mode,msg+': mode');eq(s.labels,q.choices,msg+': choices');eq(s.prompt,q.prompt,msg+': prompt');eq(s.passage,q.passage||'',msg+': passage');
  eq(s.chip,age+'세 · '+Questions.LEVELS[age][mode],msg+': level chip');eq(Questions.checkLevel(age,mode,q),[],msg+': level rules');
  return q}
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
 let g=await game(page);ok(g.world.interval>=200&&g.world.radius===7,'wave rhythm and starting village radius');
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
 await tick(page,12);await phaseIs(page,'ask');

 /* 쉬기: 문제를 가리고 시계를 멈춘다 */
 await page.locator('#pause').click();ok(await page.locator('body').evaluate(b=>b.classList.contains('covered')),'pause covers the question');
 g=await game(page);await tick(page,30);eq((await game(page)).round.t,g.round.t,'paused clock does not move');eq((await game(page)).world.t,g.world.t,'paused wolf world does not move');await page.locator('#pause').click();

 /* 늑대 무리가 가장자리에서 나타나 마을로 걸어온다(세계 시뮬레이션 + 3D) */
 {const until=await page.evaluate(()=>{const g=window.__game();return g.world.wave.arrive-g.world.t});await tick(page,Math.max(1,until-60));}
 g=await game(page);ok(g.world.wolves>=1,'a wolf pack is on the map before it arrives: '+JSON.stringify(g.world));
 const d1=await page.evaluate(()=>Math.min(...world.wolves.filter(v=>v.state==='walk').map(v=>Math.hypot(v.x,v.z))));await tick(page,20);const d2=await page.evaluate(()=>Math.min(...world.wolves.filter(v=>v.state!=='dead').map(v=>Math.hypot(v.x,v.z))));
 ok(d2<d1,'wolves walk toward the village: '+[d1,d2]);
 if(three&&!INTERIM){await frames(page,3);const i=await page.evaluate(()=>window.VillageView.inspect());ok(i.wolvesVisible>=1,'3D wolves visible: '+i.wolvesVisible);eq(i.wolvesVisible,(await game(page)).world.wolves,'3D wolf count = simulated wolves')}
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
  const want=['tower','chicken','hall','fence','farmer','hall','pond','hall','feast'],made=[];
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
   await tick(page,12);await phaseIs(page,'ask');
   await page.waitForFunction(()=>!document.querySelector('#effects .fx'),{},{timeout:8000});checks++;
  }
  const st=(await game(page)).state;eq([st.level,st.chickens,st.hall,st.fence,st.farmers,st.pond,st.feast],[1,2,3,1,1,1,1],'everything built');
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
 await tick(p,200);eq(await p.locator('#enemies .enemy:not(.hidden)').count(),(await game(p)).world.wolves,'fallback: wolves drawn where the simulation has them');const l0=await wolfPos();await tick(p,40);ok(await wolfPos()!==l0,'fallback wolf moves');
 await answer(p,true,false);const fz=await wolfPos();await tick(p,30);eq(await wolfPos(),fz,'fallback wolves stop while choosing');
 await tick(p,7);
 const still=await p.locator('#cards .choice[data-kind="chicken"]').evaluate(async b=>{const a=b.getBoundingClientRect();await new Promise(r=>setTimeout(r,330));const c=b.getBoundingClientRect();return [getComputedStyle(b).animationName,getComputedStyle(b.querySelector('.icon')).animationName,Math.abs(a.top-c.top)<.01]});
 eq(still,['none','choiceBob',true],'cards: the picture bobs, the tap target stays still');
 await p.locator('#cards .choice[data-kind="chicken"]').click();eq(await p.locator('#flock img').count(),2,'fallback chicken appears');ok(await p.locator('#flock img').last().evaluate(e=>e.classList.contains('spawn')),'fallback chicken pops in');
 await tick(p,12);await p.evaluate(()=>{state.gold=3000;render()});
 const inScene=sel=>p.locator(sel).evaluateAll(a=>{const s=document.getElementById('scene').getBoundingClientRect();return a.length>0&&a.every(e=>{const r=e.getBoundingClientRect();return r.width>20&&r.left>=s.left-1&&r.right<=s.right+1&&r.top>=s.top-1&&r.bottom<=s.bottom+1})});
 for(const target of ['tower','hall','fence','hall','farmer','pond']){await answer(p,true,false);await tick(p,7);await p.locator('#cards .choice[data-kind="'+target+'"]').click();await tick(p,12)}
 await p.evaluate(()=>Promise.all(document.getAnimations().filter(a=>a.animationName==='spawnPop').map(a=>a.finished.catch(()=>{}))));
 ok((await p.locator('#houseArt').getAttribute('src')).endsWith('home-03.png'),'fallback hall grows');ok(await inScene('#pond'),'fallback pond inside the scene');ok(await inScene('#fenceRow img'),'fallback fence inside the scene');ok(await inScene('#flock img'),'fallback hens inside the scene');
 ok(await p.locator('#villageCanvas').isHidden(),'canvas hidden in fallback');
 await shot(p.locator('.scene'),'fallback-390-built');await shot(p,'fallback-390');
 eq(errors,[],'fallback page errors');await ctx.close();
 }}finally{await fallbackBrowser.close()}
 console.log((ONLY?'PARTIAL('+ONLY+') ':'')+'PASS '+checks+' browser assertions (Chromium/WebKit, desktop + mobile emulation, held clock + one real-clock run). Physical audio/device validation remains manual.');
 }finally{server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
