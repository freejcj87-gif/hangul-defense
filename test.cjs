const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const output=path.join(__dirname,'.pages-build');
 const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const file=pathname==='/'?'index.html':['/combat.js','/village.js'].includes(pathname)?pathname.slice(1):pathname==='/art-handoff/coopnight/source-3d/models/environment-pack.glb'?pathname.slice(1):/^\/art-handoff\/coopnight\/browser\/[a-z/-]+[0-9a-z-]*\.png$/.test(pathname)?pathname.slice(1):null;
 if(!file||!fs.existsSync(path.join(output,file))){res.writeHead(404);return res.end()}
 res.setHeader('Content-Type',file.endsWith('.glb')?'model/gltf-binary':file.endsWith('.png')?'image/png':file.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8');
 res.end(fs.readFileSync(path.join(output,file)));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 fs.mkdirSync(path.join(__dirname,'test-results'),{recursive:true});let checks=0;
 try{for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch({headless:true,...(name==='chromium'?{args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}:{})});
 try{
 for(const width of [1366,390,320]){
 const ctx=await browser.newContext({viewport:{width,height:844},hasTouch:width<600,reducedMotion:'reduce'});
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);
 await page.waitForFunction(()=>['three','fallback'].includes(document.querySelector('.scene').dataset.renderer),{},{timeout:45000});
 if(name==='chromium'){assert.equal(await page.locator('.scene').getAttribute('data-renderer'),'three');checks++;}
 await page.evaluate(async()=>{await Promise.all([...document.images].map(i=>i.decode()));const bg=new Image();bg.src='art-handoff/coopnight/browser/backgrounds/background-meadow.png';await bg.decode()});
 assert(await page.locator('#houseArt').evaluate(i=>i.naturalWidth===256));checks++;
 assert(await page.locator('#towerArt').evaluate(i=>i.naturalWidth===96));checks++;
 assert.equal(await page.locator('#gold').textContent(),'🪙 20골드');checks++;
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));checks++;
 const wrong=page.getByRole('button',{name:'마',exact:true});if(width<600)await wrong.tap();else await wrong.click();
 assert.equal(await page.locator('#gold').textContent(),'🪙 20골드');checks++;
 const right=page.getByRole('button',{name:'나',exact:true});if(width<600)await right.tap();else await right.click();
 await page.locator('#build').click();assert.equal(await page.locator('#gold').textContent(),'🪙 0골드');checks++;
 await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
 assert((await page.locator('#towerArt').getAttribute('src')).endsWith('tower-01.png'));checks++;
 if(name==='chromium'){const visual=await page.locator('.scene').screenshot({type:'jpeg',quality:50});console.log('VISUAL_SCENE_'+width+':'+visual.toString('base64'))}
 await page.screenshot({path:path.join(__dirname,'test-results',name+'-'+width+'.png'),fullPage:true});
 if(width===390){
 if(name==='chromium'){
  await page.emulateMedia({reducedMotion:'no-preference'});
  const initial=await page.evaluate(()=>window.VillageView.inspect().residents);
  await page.waitForTimeout(700);
  assert.notDeepEqual(await page.evaluate(()=>window.VillageView.inspect().residents),initial);checks++;
  await page.locator('#pause').click();await page.waitForTimeout(150);
  const frozen=await page.evaluate(()=>window.VillageView.inspect().residents);
  await page.waitForTimeout(300);
  assert.deepEqual(await page.evaluate(()=>window.VillageView.inspect().residents),frozen);checks++;
  await page.locator('#pause').click();await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(150);
  const reduced=await page.evaluate(()=>window.VillageView.inspect().residents);
  await page.waitForTimeout(250);
  assert.deepEqual(await page.evaluate(()=>window.VillageView.inspect().residents),reduced);checks++;
 }
 await page.locator('#battle').click();await page.waitForTimeout(4000);await page.locator('#pause').click();
 assert(await page.locator('.enemy img').count()>0);checks++;
 if(name==='chromium'){assert((await page.evaluate(()=>window.VillageView.inspect())).enemies>0);checks++;}
 assert(await page.locator('.enemy img').first().evaluate(i=>i.complete&&i.naturalWidth===128));checks++;
 if(name==='chromium'){const visual=await page.locator('.scene').screenshot({type:'jpeg',quality:50});console.log('VISUAL_BATTLE:'+visual.toString('base64'))}
 const combat=await page.evaluate(()=>JSON.parse(localStorage.getItem('hangul-defense-v1')).combat);
 await page.waitForTimeout(350);assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('hangul-defense-v1')).combat),combat);checks++;
 await page.reload();assert.equal(await page.locator('#pause').textContent(),'계속하기');checks++;
 await page.locator('#pause').click();await page.locator('#next').waitFor({state:'visible',timeout:30000});
 assert((await page.locator('#stage').textContent()).includes('1회'));checks++;
 await page.reload();assert(await page.locator('#battle').isDisabled());checks++;
 await page.locator('#next').click();await page.locator('#mode').click();
 assert.equal(await page.locator('#answers button').count(),5);checks++;
 await page.getByRole('button',{name:'물을 주었어요',exact:true}).click();
 assert.equal(await page.locator('#gold').textContent(),'🪙 40골드');checks++;
 }
 if(name==='chromium'&&width===390){
  await page.evaluate(()=>{Object.assign(state,{wins:8,level:4,gold:200,claimed:null,completed:null,combat:null});save();render()});
  await page.reload();await page.waitForFunction(()=>window.VillageView?.inspect().ready,{},{timeout:45000});
  assert.equal(await page.locator('.scene').getAttribute('data-renderer'),'three');checks++;
  const grown=await page.evaluate(()=>window.VillageView.inspect());assert.equal(grown.level,4);assert.equal(grown.wins,8);assert.equal(grown.towers,2);assert(grown.extraBuildings);checks+=4;
  console.log('VISUAL_MATURE:'+(await page.locator('.scene').screenshot({type:'jpeg',quality:55})).toString('base64'));
  console.log('SCENE_METRICS:'+JSON.stringify(await page.evaluate(()=>window.VillageView.inspect())));
 }
 assert.deepEqual(errors,[]);checks++;await ctx.close();
 }
 }finally{await browser.close()}
 }
 const fallbackBrowser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
 const p=await fallbackBrowser.newPage({viewport:{width:390,height:844}});
 await p.route('**/environment-pack.glb',route=>route.abort());
 await p.goto(url);await p.waitForFunction(()=>document.querySelector('.scene').dataset.renderer==='fallback');
 await p.getByRole('button',{name:'나',exact:true}).click();await p.locator('#build').click();
 assert.equal(await p.locator('#gold').textContent(),'🪙 0골드');checks++;
 assert.equal(await p.locator('.scene').getAttribute('data-renderer'),'fallback');checks++;
 assert(await p.locator('#villageCanvas').isHidden());checks++;
 }finally{await fallbackBrowser.close()}
 console.log('PASS '+checks+' browser assertions (Chromium/WebKit, desktop + mobile emulation). Physical audio/device validation remains manual.');
 }finally{server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
