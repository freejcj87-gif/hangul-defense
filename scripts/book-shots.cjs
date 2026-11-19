/* 수첩 MVP 화면 캡처(개발용, CI·배포 제외): 기준 화면 3종에서 수첩·보호자 화면·친구 카드·반짝 손님·쉬기 화면·엔딩 카드를 찍는다.
   node scripts/build-pages.cjs && node scripts/book-shots.cjs [저장 폴더] [headed]
   브라우저를 쓰므로 PC 여유 메모리가 2GB 이상일 때, 한 번에 하나만 돌린다. 눈으로 보는 용도이며 통과·실패를 판정하지 않는다(판정은 test.cjs의 book 구간) */
const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.join(__dirname,'..'),OUT=path.join(ROOT,'.pages-build'),DIR=path.resolve(process.argv[2]||path.join(ROOT,'test-results','book-shots')),HEADED=process.argv.includes('headed');
const Combat=require(path.join(ROOT,'combat.js')),Book=require(path.join(ROOT,'book.js'));
const TYPES={'.js':'text/javascript; charset=utf-8','.html':'text/html; charset=utf-8','.png':'image/png','.glb':'model/gltf-binary','.json':'application/json'};
(async()=>{
  const server=http.createServer((req,res)=>{const p=new URL(req.url,'http://x').pathname,f=path.join(OUT,p==='/'?'index.html':decodeURIComponent(p.slice(1)));
    if(!f.startsWith(OUT)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);return res.end()}
    res.setHeader('Content-Type',TYPES[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f))});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;fs.mkdirSync(DIR,{recursive:true});
  const browser=await chromium.launch({headless:!HEADED,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const now=Date.now(),day=Book.dayOf(now);
  /* 여러 칸이 찬 기록: 친구 3(리본 1) · 발자국 6 · 반짝 2 · 훈장 여럿 · 놓친 글 */
  const rich=()=>{const b=Book.fresh(now,4242),t=now-3*86400000;
    Object.assign(b.mon.wolf,{foot:t,card:t,note:3,plays:6,last:5,kills:140,rib:{n:3,last:5},shiny:t});Object.assign(b.mon.bramble,{foot:t,card:now,note:3,plays:4,kills:90,rib:{n:1,last:5}});
    Object.assign(b.mon.boar,{foot:t,card:t,note:3,plays:3,kills:14,rib:{n:2,last:5}});Object.assign(b.mon.granite,{foot:t,plays:2,last:5,kills:5});Object.assign(b.mon.frost,{foot:t,plays:1,kills:3});Object.assign(b.mon.fox,{foot:t,plays:2,kills:3,note:1,shiny:t});
    const n={one:412,fresh:130,again:7,rush:18,en:9,quiz:61,king:5,fox:4,arrow:1240,keeper:3,star:2,map:1};for(const k of Object.keys(n)){b.medal[k].n=n[k];Book.BOOK.MEDAL[k].forEach((need,i)=>{if(n[k]>=need)b.medal[k].at[i]=t})}
    b.play=6;b.pq=6;b.tot={q:540,f:455,s:9800,days:6};b.day[day]=[42,36,900,11];b.rv=[['a8-story-03',4],['a8-story-12',3],['a8-quiz-07',2],['a8-story-g041',2],['a8-story-g102',1]].map(([id,miss])=>({id,box:1,due:99,dp:6,miss,seen:1}));return b};
  const run=o=>JSON.stringify({version:3,...Combat.fresh(8),seed:4242,index:20,gold:480,level:3,fence:4,chickens:6,farmers:2,hall:1,...o});
  const open=async(w,h,book,state)=>{const ctx=await browser.newContext({viewport:{width:w,height:h},hasTouch:true});
    await ctx.addInitScript(s=>{window.__HOLD_CLOCK=true;if(!localStorage.getItem('hangul-defense-book')){localStorage.setItem('hangul-defense-book',s.book);localStorage.setItem('hangul-defense-v1',s.run)}},{book:JSON.stringify(book),run:state});
    const page=await ctx.newPage();page.on('pageerror',e=>console.log('  page error:',e.message));await page.goto(url+'/?book=1');
    await page.waitForFunction(()=>['three','fallback'].includes(document.querySelector('.scene').dataset.renderer),{},{timeout:60000});return {ctx,page}};
  const shot=(page,name,w,h)=>page.screenshot({path:path.join(DIR,name+'-'+w+'x'+h+'.png')});
  const longPress=(page,id)=>page.evaluate(id=>{const b=document.getElementById(id),n=Date.now;b.onpointerdown();Date.now=()=>n()+2500;b.onpointerup();Date.now=n},id);
  const passGate=page=>page.evaluate(()=>{const N={이:2,삼:3,사:4,오:5,육:6,칠:7,팔:8,구:9},m=/^(.)백(.)십(.)$/.exec(document.getElementById('gateCode').textContent);for(const c of [m[1],m[2],m[3]])[...document.getElementById('gatePad').children].find(b=>b.dataset.d===String(N[c])).click()});
  const answer=page=>page.evaluate(()=>{const g=window.__game();window.__tick(Math.max(g.round.lock,60));document.querySelector('#answers button[data-i="'+window.__game().round.answer+'"]').click()});
  for(const [w,h] of [[1366,640],[1180,820],[820,1180]]){
    console.log(w+'x'+h);
    /* 1 시작 화면 · 수첩 · 문턱 · 보호자 탭 4개 */
    {const b=rich(),{ctx,page}=await open(w,h,b,run({}));await shot(page,'01-start',w,h);
     await page.locator('#openBook').click();await shot(page,'02-notebook',w,h);await page.evaluate(()=>{document.querySelector('#bookScreen .start-card').scrollIntoView({block:'end'});document.getElementById('bookScreen').scrollTop=1e5});await shot(page,'03-notebook-medals',w,h);
     await page.evaluate(()=>document.querySelector('#bookMedals .medal').click());await page.locator('#bookClose').click();
     await longPress(page,'openGuard');await shot(page,'04-gate',w,h);await passGate(page);
     for(const t of ['log','set','file','help']){await page.locator('#gTabs button[data-tab="'+t+'"]').click();await shot(page,'05-guardian-'+t,w,h)}
     await ctx.close()}
    /* 2 쪽지 문제 → 친구 카드, 쉬는 중 수첩 단추 */
    {const b=rich();b.drop={kind:'fox',at:6};const {ctx,page}=await open(w,h,b,run({}));await page.locator('#go').click();await page.waitForFunction(()=>window.__game().phase==='ask');
     await page.evaluate(()=>window.__tick(40));await shot(page,'06-note-question',w,h);await answer(page);await page.waitForTimeout(700);await shot(page,'07-friend-card',w,h);
     await page.evaluate(()=>window.__tick(40));await page.locator('#pause').click();await shot(page,'08-paused-book-button',w,h);await ctx.close()}
    /* 3 기억 늑대 문제 */
    {const b=rich();b.rv[0].due=0;b.rv[0].box=1;const {ctx,page}=await open(w,h,b,run({}));await page.locator('#go').click();await page.waitForFunction(()=>window.__game().phase==='ask');await page.evaluate(()=>window.__tick(40));await shot(page,'09-review-question',w,h);await ctx.close()}
    /* 4 반짝 손님: 마을 둘레를 걷는 손님, 인사 뒤 띠 */
    {const b=rich();b.shiny.guest='bramble';b.shiny.run=1;const {ctx,page}=await open(w,h,b,run({}));await page.locator('#go').click();await page.waitForFunction(()=>window.__game().phase==='ask');
     await page.evaluate(()=>window.__tick(160));await page.waitForTimeout(900);await shot(page,'10-shiny-guest',w,h);/* 정답 화살이 손님에게 닿으면(shinyMet) 띠가 뜬다. 정답 연출 중에 닿으면 바로, 읽는 중에 닿으면 다음 정답 때. 2틱씩 돌리며 띠가 보이는 순간을 찍는다 */
     /* 띠는 CSS 애니메이션(실제 시간 3.2초)으로 나타났다 사라지므로, 보이는(불투명) 순간 바로 찍는다 */
     const seen=()=>page.evaluate(()=>[...document.querySelectorAll('#effects .banner')].some(e=>/반짝 손님/.test(e.textContent)&&!e.classList.contains('later')&&parseFloat(getComputedStyle(e).opacity)>.6));
     let got=false;for(let round=0;round<3&&!got;round++){await page.waitForFunction(()=>window.__game().phase==='ask');await answer(page);for(let k=0;k<40&&!(got=await seen());k++)await page.evaluate(()=>window.__tick(2))}
     if(got)await shot(page,'11-shiny-met',w,h);
     console.log('  반짝 손님: 띠 '+(got?'보임':'안 보임')+' · '+JSON.stringify(await page.evaluate(()=>{const b=window.__game().book;return {guest:b.guest&&b.guest.state,shiny:Object.keys(b.data.mon).filter(k=>b.data.mon[k].shiny>0),miss:b.data.shiny.miss}})));
     if(!got)await shot(page,'11-shiny-met',w,h);await ctx.close()}
    /* 5 하루 시간 쉬기 화면 */
    {const b=rich();b.today={d:day,s:1800,ext:0};const {ctx,page}=await open(w,h,b,run({}));await page.locator('#go').click();await page.waitForTimeout(300);await shot(page,'12-sleepy',w,h);await ctx.close()}
    /* 6 엔딩 카드 */
    {const b=rich(),r=Combat.freshRun();Object.assign(r,{asked:74,first:63,t0:now-25*60000,bell:3,newOk:40});
     const st=Combat.fresh(8);const meta=st.meta;meta.stamps.push({no:1,village:'meadow',age:8,stars:[1,1,1],q:74,acc:85,lost:0,min:25,date:now});
     const {ctx,page}=await open(w,h,b,run({run:r,meta}));await page.locator('#go').click();await page.waitForTimeout(400);await shot(page,'13-ending',w,h);await ctx.close()}
  }
  await browser.close();server.close();console.log('저장: '+DIR);
})().catch(e=>{console.error(e);process.exit(1)});
