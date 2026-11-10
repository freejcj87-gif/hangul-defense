const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const server=http.createServer((req,res)=>{const file=req.url==='/'?'index.html':req.url==='/combat.js'?'combat.js':null;if(!file){res.writeHead(404);return res.end()}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8');res.end(fs.readFileSync(path.join(__dirname,file)))});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 fs.mkdirSync(path.join(__dirname,'test-results'),{recursive:true});let checks=0;
 try{for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch({headless:true});
 try{
 for(const width of [1366,390,320]){
 const ctx=await browser.newContext({viewport:{width,height:844},hasTouch:width<600,reducedMotion:'reduce'});
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);
 assert.equal(await page.locator('#gold').textContent(),'🪙 20골드');checks++;
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));checks++;
 const wrong=page.getByRole('button',{name:'마',exact:true});if(width<600)await wrong.tap();else await wrong.click();
 assert.equal(await page.locator('#gold').textContent(),'🪙 20골드');checks++;
 const right=page.getByRole('button',{name:'나',exact:true});if(width<600)await right.tap();else await right.click();
 await page.locator('#build').click();assert.equal(await page.locator('#gold').textContent(),'🪙 0골드');checks++;
 await page.screenshot({path:path.join(__dirname,'test-results',name+'-'+width+'.png'),fullPage:true});
 if(width===390){
 await page.locator('#battle').click();await page.waitForTimeout(1400);await page.locator('#pause').click();
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
 assert.deepEqual(errors,[]);checks++;await ctx.close();
 }
 }finally{await browser.close()}
 }
 console.log('PASS '+checks+' browser assertions (Chromium/WebKit, desktop + mobile emulation). Physical audio/device validation remains manual.');
 }finally{server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
