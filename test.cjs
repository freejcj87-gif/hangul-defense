const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const Questions=require('./questions.js');
const INTERIM=process.env.INTERIM_NO_3D_BUILD==='1',FULL_SHOTS=process.env.FULL_SHOTS==='1';
const ONLY=process.env.ONLY||'',run=part=>!ONLY||ONLY.split(',').includes(part);/* ONLY=matrix,feel,fallback 중 일부만 돌릴 때(개발용). CI는 전부 돌린다. *//* 통합 전 임시 실행용. CI에서는 쓰지 않는다. */
const KEY='hangul-defense-v1',SWIFT=['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'];
(async()=>{
 const output=path.join(__dirname,'.pages-build'),shots=path.join(__dirname,'test-results');
 const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const file=pathname==='/'?'index.html':['/combat.js','/questions.js','/village.js'].includes(pathname)?pathname.slice(1):pathname==='/art-handoff/coopnight/source-3d/models/environment-pack.glb'?pathname.slice(1):/^\/art-handoff\/coopnight\/browser\/[a-z/-]+[0-9a-z-]*\.png$/.test(pathname)?pathname.slice(1):null;
 if(!file||!fs.existsSync(path.join(output,file))){res.writeHead(404);return res.end()}
 res.setHeader('Content-Type',file.endsWith('.glb')?'model/gltf-binary':file.endsWith('.png')?'image/png':file.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8');
 res.end(fs.readFileSync(path.join(output,file)));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 fs.mkdirSync(shots,{recursive:true});let checks=0;
 const ok=(v,m)=>{assert.ok(v,m);checks++},eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++};
 const shot=(target,name)=>target.screenshot({path:path.join(shots,name+'.png')});

 /* 화면에 나온 문제를 문제은행(Node 쪽 사본)과 대조한다. 페이지 내부 변수에 기대지 않는다. */
 async function shown(page){return page.locator('#answers').evaluate(n=>({qid:n.dataset.qid,age:Number(n.dataset.age),mode:n.dataset.mode,labels:[...n.children].map(b=>b.textContent),chip:document.getElementById('levelChip').textContent,prompt:document.getElementById('prompt').textContent,passage:document.getElementById('passage').textContent}))}
 const bank=s=>Questions.get(s.age,s.mode,Number(s.qid.split('-')[2])-1);
 async function expectQuestion(page,age,mode,index,msg){
  const s=await shown(page),q=Questions.get(age,mode,index);
  eq(s.qid,q.id,msg+': question id');eq(s.age,age,msg+': age');eq(s.labels,q.choices,msg+': choices');eq(s.prompt,q.prompt,msg+': prompt');eq(s.passage,q.passage||'',msg+': passage');
  eq(s.chip,age+'세 · '+Questions.LEVELS[age][mode],msg+': level chip');eq(Questions.checkLevel(age,mode,q),[],msg+': level rules');
  return q}
 async function pick(page,right,touch){const s=await shown(page),q=bank(s);const i=right?q.answer:(q.answer+1)%q.choices.length;const b=page.locator('#answers button').nth(i);if(touch)await b.tap();else await b.click()}
 const gold=page=>page.locator('#gold').textContent();
 const noOverflow=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
 /* 보기 버튼이 모두 화면 폭 안에 있고 서로 겹치지 않는지 */
 async function answersFit(page){return page.evaluate(()=>{const r=[...document.querySelectorAll('#answers button')].map(b=>b.getBoundingClientRect());const inside=r.every(x=>x.left>=0&&x.right<=innerWidth+.5&&x.width>=44&&x.height>=44);const apart=r.every((a,i)=>r.every((b,j)=>i>=j||a.right<=b.left+.5||b.right<=a.left+.5||a.bottom<=b.top+.5||b.bottom<=a.top+.5));return inside&&apart})}
 /* 상단 상태 표시(골드·성문·방어·마을)가 서로 겹치거나 띠 밖으로 나가지 않는지 */
 const pillsFit=page=>page.evaluate(()=>{const s=document.querySelector('.stats').getBoundingClientRect(),r=[...document.querySelectorAll('.stats .pill')].map(p=>p.getBoundingClientRect());return r.length===4&&r.every((a,i)=>a.width>0&&a.left>=s.left-.5&&a.right<=s.right+.5&&r.every((b,j)=>i>=j||a.right<=b.left+.5||b.right<=a.left+.5||a.bottom<=b.top+.5||b.bottom<=a.top+.5))});
 /* 3D 장면이 프레임을 n장 더 처리할 때까지 기다린다. 느린 기계에서도 '멈춤이 반영된 뒤'를 정확히 잡기 위해 시간 대신 프레임 수를 쓴다. */
 async function frames(page,n){const from=await page.evaluate(()=>window.VillageView.inspect().frames);await page.waitForFunction(t=>window.VillageView.inspect().frames>=t,from+n,{timeout:30000})}
 const residents=page=>page.evaluate(()=>window.VillageView.inspect().residents);
 const ready=page=>page.waitForFunction(()=>['three','fallback'].includes(document.querySelector('.scene').dataset.renderer),{},{timeout:45000});
 async function seed(page,s){await page.evaluate(s=>{Object.assign(state,{claimed:null,completed:null,combat:null,qage:null},s);save()},s);await page.reload();await ready(page)}
 const stored=page=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),KEY);
 /* 이펙트는 1초 안팎으로 사라지므로, 생성되는 순간을 페이지 안에서 기록해 두고 읽는다. */
 const RECORD=()=>{window.__fx=[];document.addEventListener('DOMContentLoaded',()=>{const scene=document.getElementById('scene');new MutationObserver(m=>m.forEach(r=>r.addedNodes.forEach(n=>{if(!n.classList||!n.classList.contains('fx'))return;const e={c:[...n.classList].find(x=>x.startsWith('fx-')),t:n.textContent};if(e.c==='fx-label'){const w=n.offsetWidth/2,h=n.offsetHeight/2,x=parseFloat(n.style.left),y=parseFloat(n.style.top);e.inside=n.style.left.endsWith('px')&&x-w>=0&&x+w<=scene.clientWidth&&y-48-h>=0&&y+h<=scene.clientHeight;e.box=[Math.round(x-w),Math.round(x+w),Math.round(y),scene.clientWidth,scene.clientHeight]}window.__fx.push(e)}))).observe(document.getElementById('effects'),{childList:true})})};
 const fxLog=page=>page.evaluate(()=>window.__fx.splice(0));const names=f=>f.map(x=>x.c+':'+x.t);

 try{for(const [name,engine] of run('matrix')?[['chromium',chromium],['webkit',webkit]]:[]){
 const browser=await engine.launch({headless:true,...(name==='chromium'?{args:SWIFT}:{})});
 try{
 for(const width of [1366,390,320]){
 const touch=width<600;
 const ctx=await browser.newContext({viewport:{width,height:844},hasTouch:touch,reducedMotion:'reduce'});
 await ctx.addInitScript(RECORD);const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await ready(page);
 const three=await page.locator('.scene').getAttribute('data-renderer')==='three';
 if(name==='chromium')ok(three,'chromium renders 3D');
 await page.evaluate(async()=>{await Promise.all([...document.images].map(i=>i.decode()));const bg=new Image();bg.src='art-handoff/coopnight/browser/backgrounds/background-meadow.png';await bg.decode()});
 ok(await page.locator('#houseArt').evaluate(i=>i.naturalWidth===256),'house art');
 ok(await page.locator('#towerArt').evaluate(i=>i.naturalWidth===96),'tower art');
 ok(await page.locator('.choice img').evaluateAll(a=>a.length===3&&a.every(i=>i.complete&&i.naturalWidth>0)),'choice card art loads');
 eq(await gold(page),'🪙 20골드','initial gold');ok(await noOverflow(page),'no horizontal overflow');ok(await pillsFit(page),'status pills do not overlap');

 /* 나이 선택 → 그 나이 문제로 즉시 전환 (실제 select 조작) */
 await expectQuestion(page,8,'sound',0,name+' '+width+' default');
 for(const mode of ['sound','story']){
  if(mode==='story')await page.locator('#mode').click();
  for(const age of [9,10,7,8]){
   await page.locator('#age').selectOption(String(age));
   const q=await expectQuestion(page,age,mode,0,name+' '+width+' '+age+'세 '+mode);
   eq(await page.locator('#answers button').count(),q.choices.length,'button count');
   eq(await page.locator('#feedback').textContent(),age+'세 문제로 바꿨어요.','switch feedback');
   ok(await noOverflow(page),age+'세 '+mode+' fits the width');ok(await answersFit(page),age+'세 '+mode+' answer buttons fit');
   eq((await stored(page)).age,age,'age saved');
   if(name==='chromium'&&(FULL_SHOTS||width===390||age===10&&mode==='story'))await shot(page.locator('.lesson'),'question-'+width+'-'+age+'-'+mode);
  }
 }
 await page.locator('#mode').click();await page.locator('#age').selectOption('9');await page.reload();await ready(page);
 await expectQuestion(page,9,'sound',0,'age survives reload');eq(await page.locator('#age').inputValue(),'9','selector restored');
 await page.locator('#age').selectOption('8');

 /* 오답 → 정답 → 고르기 */
 await pick(page,false,touch);eq(await gold(page),'🪙 20골드','wrong answer costs nothing');
 await pick(page,true,touch);eq(await gold(page),'🪙 40골드','correct answer pays 20');
 ok(await page.locator('#choices').evaluate(n=>n.classList.contains('ready')),'choices light up');
 ok(await page.locator('#build.recommended').count()===1,'tower is recommended first');
 if(touch){
  /* 세로 휴대폰: 카드를 고르는 순간에도 마을 장면과 카드가 한 화면에 보여야 한다. */
  await page.waitForTimeout(150);
  const view=await page.evaluate(()=>{const s=document.getElementById('scene').getBoundingClientRect(),c=document.getElementById('choices').getBoundingClientRect();return {sceneTop:s.top,sceneBottom:s.bottom,sceneHeight:s.height,cardsTop:c.top,cardsBottom:c.bottom,h:innerHeight}});
  ok(view.sceneTop>=0&&view.sceneBottom<=view.h&&view.sceneHeight>=220,'scene stays fully on screen while choosing: '+JSON.stringify(view));
  ok(view.cardsTop>=view.sceneBottom&&view.cardsBottom<=view.h,'choice cards are fully visible below the scene: '+JSON.stringify(view));
 }
 await page.locator('#age').selectOption('10');
 eq((await shown(page)).qid,'a8-sound-01','answered question stays after an age change');eq(await page.locator('#feedback').textContent(),'다음 문제부터 10세 문제가 나와요.','deferred switch feedback');
 await page.locator('#age').selectOption('8');

 if(width===1366){await page.locator('#build').click();eq(await gold(page),'🪙 0골드','tower costs 40');
  eq(names(await fxLog(page)),['fx-label:🗼 타워 완성!'],'reduced motion: only the name tag appears');
  await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));ok((await page.locator('#towerArt').getAttribute('src')).endsWith('tower-01.png'),'tower art');
 }else if(width===390){await page.locator('#build').tap();eq(await gold(page),'🪙 0골드','tower costs 40');eq((await page.evaluate(()=>getVillageState())).level,1,'tower level');
 }else{await page.locator('#buyChicken').tap();eq(names(await fxLog(page)),['fx-label:🐔 꼬꼬 1마리!'],'chicken name tag');
  await page.locator('#buyFence').tap();eq(names(await fxLog(page)),['fx-label:🪵 울타리 1칸!'],'fence name tag');eq(await gold(page),'🪙 0골드','chicken 20 + fence 20');
  const v=await page.evaluate(()=>getVillageState());eq([v.level,v.chickens,v.fence],[0,1,1],'village state after buying');
  eq(await page.locator('#level').textContent(),'🗼0 🐔1 🪵1','status pill');
  ok(await page.locator('.choice').evaluateAll(a=>a.every(b=>b.disabled)),'cards lock at 0 gold');
  await page.reload();await ready(page);const r=await page.evaluate(()=>getVillageState());eq([r.chickens,r.fence],[1,1],'purchases survive reload');
  eq(await page.locator('#flock img').count(),1,'chicken element restored');eq(await page.locator('#fenceRow img').count(),1,'fence element restored');
  if(three&&!INTERIM){const i=await page.evaluate(()=>window.VillageView.inspect());eq([i.chickens,i.fences],[1,1],'3D village restores bought chicken and fence')}
 }
 ok(await noOverflow(page),'no overflow after buying');
 await page.screenshot({path:path.join(shots,name+'-'+width+'.png'),fullPage:true});
 if(name==='chromium')await shot(page,'viewport-'+width);

 if(width===390){
 if(name==='chromium'){
  await page.emulateMedia({reducedMotion:'no-preference'});
  const initial=await residents(page);
  await frames(page,6);
  assert.notDeepEqual(await residents(page),initial,'residents move while the village is live');checks++;
  await page.locator('#pause').click();await frames(page,2);
  const frozen=await residents(page);
  await frames(page,4);
  eq(await residents(page),frozen,'pause freezes residents');
  await page.locator('#pause').click();await page.emulateMedia({reducedMotion:'reduce'});await frames(page,2);
  const reduced=await residents(page);
  await frames(page,4);
  eq(await residents(page),reduced,'reduced motion freezes residents');
 }
 await page.evaluate(()=>{window.__pointer=[];for(const type of ['mousedown','mouseup','click'])document.addEventListener(type,e=>window.__pointer.push(type+':'+(e.target.id||e.target.nodeName)),true)});
 const before=await page.evaluate(()=>JSON.stringify([document.hidden,getVillageState(),document.getElementById('battle').disabled]));
 await page.locator('#battle').click();ok(await page.locator('#age').isDisabled(),'age locked during battle; before '+before+' after '+await page.evaluate(()=>JSON.stringify([document.hidden,getVillageState(),window.__pointer]))+' errors '+JSON.stringify(errors));await page.waitForTimeout(3500);
 /* 전투는 0.1초마다 화면을 다시 그린다. 그때 버튼 글자를 갈아 끼우면 누르는 도중 글자가 교체되어 클릭이 사라질 수 있다. */
 ok(await page.evaluate(async()=>{const label=()=>document.getElementById('pause').firstChild,first=label();await new Promise(r=>setTimeout(r,450));return first===label()}),'battle ticks leave the pause button label in place');
 eq(await page.evaluate(()=>[document.hidden,getVillageState().paused,getVillageState().phase]),[false,false,'battle'],'battle is running before the pause click');
 await page.evaluate(()=>{window.__pointer.length=0});
 await page.locator('#pause').click();
 eq([await page.locator('#pause').textContent(),await page.evaluate(()=>getVillageState().paused)],['계속하기',true],'pause click pauses the battle; pointer events seen: '+await page.evaluate(()=>window.__pointer.join(' ')));
 ok(await page.locator('.enemy img').count()>0,'wolves drawn; '+await page.evaluate(()=>JSON.stringify([getVillageState().phase,getVillageState().combat,document.getElementById('enemies').childElementCount])));
 if(name==='chromium')ok((await page.evaluate(()=>window.VillageView.inspect())).enemies>0,'3D wolves');
 ok(await page.locator('.enemy img').first().evaluate(i=>i.complete&&i.naturalWidth===128),'wolf art');
 if(name==='chromium')await shot(page.locator('.scene'),'battle-390');
 const combat=(await stored(page)).combat;
 await page.waitForTimeout(350);eq((await stored(page)).combat,combat,'paused battle does not advance');
 await page.reload();eq(await page.locator('#pause').textContent(),'계속하기','battle resumes paused');
 await page.locator('#pause').click();await page.locator('#next').waitFor({state:'visible',timeout:30000});
 ok((await page.locator('#stage').textContent()).includes('1회'),'victory counted');
 await page.reload();ok(await page.locator('#battle').isDisabled(),'finished battle cannot replay');
 eq((await shown(page)).qid,'a8-sound-01','result screen keeps the answered question');
 /* 다음 문제는 새로 고른 나이로, 독해는 5지선다 */
 await page.locator('#age').selectOption('10');await page.locator('#next').click();await expectQuestion(page,10,'sound',1,'next question uses the chosen age');
 await page.locator('#mode').click();await expectQuestion(page,10,'story',1,'10세 story');
 eq(await page.locator('#answers button').count(),5,'five reading options');
 await page.getByRole('button',{name:'물을 주었어요',exact:true}).click();
 eq(await gold(page),'🪙 40골드','reading pays 40');
 /* 닭 보너스: 닭 2마리를 사고 다음 정답에서 +10 */
 await page.locator('#buyChicken').click();await page.locator('#buyChicken').click();eq(await gold(page),'🪙 0골드','two chickens');
 await page.locator('#battle').click();await page.locator('#next').waitFor({state:'visible',timeout:40000});await page.locator('#next').click();
 await pick(page,true,false);eq(await gold(page),'🪙 50골드','story 40 + 2 chickens x 5');
 ok((await page.locator('#feedback').textContent()).includes('보너스 +10'),'bonus explained');
 }
 if(name==='chromium'&&width===390){
  await seed(page,{wins:8,level:4,gold:200,chickens:0,fence:0,index:0,mode:'sound',age:8});await page.waitForFunction(()=>window.VillageView?.inspect().ready,{},{timeout:45000});
  eq(await page.locator('.scene').getAttribute('data-renderer'),'three','mature village renders 3D');
  const grown=await page.evaluate(()=>window.VillageView.inspect());eq(grown.level,4,'3D level');eq(grown.wins,8,'3D wins');eq(grown.towers,2,'3D towers');ok(grown.extraBuildings,'3D extra buildings');
  await shot(page.locator('.scene'),'mature-390');
  console.log('SCENE_METRICS:'+JSON.stringify(grown));
 }
 /* 숫자가 가장 길어지는 저장 상태에서도 상단 표시가 겹치지 않아야 한다. */
 await page.evaluate(()=>{Object.assign(state,{gold:1280,hp:100,wins:12,level:5,chickens:6,fence:6});render()});
 eq(await page.locator('#level').textContent(),'🗼5 🐔6 🪵6','full village pill');ok(await pillsFit(page),'status pills fit with the longest values');ok(await noOverflow(page),'no overflow with the longest values');
 if(name==='chromium')await shot(page.locator('.stage-card'),'stats-full-'+width);
 eq(errors,[],name+' '+width+' page errors');await ctx.close();
 }
 }finally{await browser.close()}
 }

 /* 손맛: 움직임을 켠 3D 화면에서 세 가지를 차례로 지어 본다. */
 const feel=await chromium.launch({headless:true,args:SWIFT});
 try{for(const width of run('feel')?[1366,390]:[]){
  const ctx=await feel.newContext({viewport:{width,height:844},hasTouch:width<600,reducedMotion:'no-preference'});
  await ctx.addInitScript(RECORD);const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await ready(page);
  await seed(page,{gold:400,index:0,mode:'sound',age:8});await page.waitForFunction(()=>window.VillageView?.inspect().ready,{},{timeout:45000});
  eq(await page.locator('.scene').getAttribute('data-renderer'),'three','feel test runs in 3D');
  if(width<600)await page.locator('#actions').scrollIntoViewIfNeeded();
  const labels={build:['🗼 타워 완성!','🗼 타워 2단계!'],buyChicken:['🐔 꼬꼬 1마리!','🐔 꼬꼬 2마리!'],buyFence:['🪵 울타리 1칸!','🪵 울타리 2칸!']};
  const field={build:'towerLevel',buyChicken:'chickens',buyFence:'fences'};
  for(const id of ['build','buyChicken','buyFence'])for(let n=0;n<2;n++){
   const before=await page.evaluate(()=>window.VillageView.inspect());
   await page.locator('#'+id).click();
   const made=await fxLog(page),count=c=>made.filter(x=>x.c===c).length,tag=made.find(x=>x.c==='fx-label');
   ok(count('fx-flash')===1&&count('fx-ring')===1&&count('fx-star')>=7&&count('fx-label')===1,id+' flash, ring, sparks and name tag are created: '+names(made).join(','));
   eq(count('fx-dust'),id==='buyChicken'?0:2,id+' dust');eq(tag.t,labels[id][n],id+' name tag '+(n+1));ok(tag.inside,id+' name tag stays inside the scene: '+tag.box);
   ok(await page.locator('#'+id).evaluate(b=>b.classList.contains('bought')),id+' card reacts');
   for(const t of [60,180,360,700]){await page.waitForTimeout(t===60?60:t===180?120:t===360?180:340);if(n===0)await shot(page.locator('.scene'),'feel-'+width+'-'+id+'-'+String(t).padStart(3,'0'))}
   /* 3D 연출은 장면 시간(프레임당 최대 0.05초)으로 흐른다. 느린 기계에서는 벽시계 0.7초 안에 끝나지 않으므로 반영될 때까지 기다린다. */
   if(!INTERIM){await page.waitForFunction(([f,v])=>window.VillageView.inspect()[f]>=v,[field[id],before[field[id]]+1],{timeout:30000}).catch(()=>{});
   const after=await page.evaluate(()=>window.VillageView.inspect());
   eq(after[field[id]],before[field[id]]+1,id+' appears in the 3D village ('+field[id]+')');
   const kind={build:'tower',buyChicken:'chicken',buyFence:'fence'}[id];eq(after.builds[kind],before.builds[kind]+1,id+' plays one 3D build effect')}
   await page.waitForFunction(()=>!document.querySelector('#effects .fx'),{},{timeout:8000});checks++;
  }
  eq(await gold(page),'🪙 '+(400-2*40-4*20)+'골드','gold after six builds');
  await shot(page,'feel-'+width+'-after');
  eq(errors,[],'feel '+width+' page errors');await ctx.close();
 }}finally{await feel.close()}

 /* 3D를 못 쓰는 기기: 그림 화면에서도 고른 것이 실제로 나타나야 한다. */
 const fallbackBrowser=await chromium.launch({headless:true,args:SWIFT});
 try{if(run('fallback')){
 const p=await fallbackBrowser.newPage({viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/environment-pack.glb',route=>route.abort());
 await p.goto(url);await p.waitForFunction(()=>document.querySelector('.scene').dataset.renderer==='fallback');
 await expectQuestion(p,8,'sound',0,'fallback default');await p.locator('#age').selectOption('9');await expectQuestion(p,9,'sound',0,'fallback 9세');await p.locator('#age').selectOption('8');
 await pick(p,true,false);
 /* 움직임이 켜진 상태: 카드 그림은 까딱여도 누르는 자리(카드)는 움직이지 않아야 한다. */
 await p.waitForTimeout(900);/* 정답 뒤 카드 쪽으로 부드럽게 스크롤되는 동안은 재지 않는다. */
 const still=await p.locator('#build').evaluate(async b=>{const a=b.getBoundingClientRect();await new Promise(r=>setTimeout(r,330));const c=b.getBoundingClientRect();return [getComputedStyle(b).animationName,getComputedStyle(b.querySelector('img')).animationName,Math.abs(a.top-c.top)<.01]});
 eq(still,['none','choiceBob',true],'ready cards: the picture bobs, the tap target stays still');
 await p.locator('#build').click();
 eq(await gold(p),'🪙 0골드','fallback tower purchase');
 eq(await p.locator('.scene').getAttribute('data-renderer'),'fallback','still fallback');
 ok(await p.locator('#villageCanvas').isHidden(),'canvas hidden in fallback');
 ok(await p.locator('#tower').evaluate(n=>n.classList.contains('spawn')&&n.dataset.level==='1'),'fallback tower pops in');
 await p.evaluate(()=>{state.gold=120;save();render()});
 const inScene=sel=>p.locator(sel).evaluateAll(a=>{const s=document.getElementById('scene').getBoundingClientRect();return a.every(e=>{const r=e.getBoundingClientRect();return r.width>20&&r.left>=s.left&&r.right<=s.right&&r.top>=s.top&&r.bottom<=s.bottom})});
 for(let n=1;n<=3;n++){await p.locator('#buyChicken').click();eq(await p.locator('#flock img').count(),n,'fallback chicken '+n);ok(await p.locator('#flock img').last().evaluate(e=>e.classList.contains('spawn')),'fallback chicken pops in')}
 for(let n=1;n<=3;n++){await p.locator('#buyFence').click();eq(await p.locator('#fenceRow img').count(),n,'fallback fence '+n);ok(await p.locator('#fenceRow img').last().evaluate(e=>e.classList.contains('spawn')),'fallback fence pops in')}
 await p.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
 ok(await inScene('#flock img'),'fallback chickens are visible inside the scene');ok(await inScene('#fenceRow img'),'fallback fences are visible inside the scene');
 eq(await gold(p),'🪙 0골드','fallback purchases charged');
 await p.waitForTimeout(700);await shot(p.locator('.scene'),'fallback-390-built');await shot(p,'fallback-390');
 eq(errors,[],'fallback page errors');
 }}finally{await fallbackBrowser.close()}
 console.log((ONLY?'PARTIAL('+ONLY+') ':'')+'PASS '+checks+' browser assertions (Chromium/WebKit, desktop + mobile emulation). Physical audio/device validation remains manual.');
 }finally{server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
