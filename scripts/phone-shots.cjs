/* 폰 화면 캡처(개발용, CI·배포 제외, 2026-11-20 폰 배포 결정): 기준 폰 화면(docs/phone-20261120.md §1)에서
   시작 · 문제 읽기(나이별 가장 긴 지문) · 가게 · 마을 단계 1/4/6 · 늑대 결전 · 수첩 · 보호자 화면을 찍고, 화면마다 배치 숫자를 metrics.json에 남긴다.
   - 사진: <장면>-<화면>.jpg(실제 기기 픽셀 배율), contact-<장면>-<묶음>.jpg(세로 3종 / 작은 Chrome + 가로 2종을 한 장에, 눈 검수용)
   - 숫자: 가로 넘침 · 44px 미만 누름 칸 · 잘린 글 · 화면 밖 글 · 장면 크기 · 글자 크기 · 핵심 요소가 한 화면에 드는지 · 배치 지문(패드 전후 비교용)
   node scripts/build-pages.cjs && node scripts/phone-shots.cjs [저장 폴더] [views=p360,l780] [scenes=02-read-10,03-shop]
   브라우저를 쓰므로 PC 여유 메모리가 2GB 이상일 때만, 한 번에 하나만. 모바일 뷰포트 흉내(isMobile·hasTouch·deviceScaleFactor)이지 실기기가 아니다.
   통과·실패를 판정하지 않는다(판정은 test.cjs의 phone 구간) */
const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.join(__dirname,'..'),OUT=path.join(ROOT,'.pages-build');
const ARGS=process.argv.slice(2),opt=k=>{const a=ARGS.find(x=>x.startsWith(k+'='));return a?a.slice(k.length+1).split(',').filter(Boolean):null};
const DIR=path.resolve(ARGS.find(a=>!a.includes('='))||path.join(ROOT,'test-results','phone-shots')),ONLY_VIEWS=opt('views'),ONLY_SCENES=opt('scenes');
const Combat=require(path.join(ROOT,'combat.js')),Book=require(path.join(ROOT,'book.js'));
const TYPES={'.js':'text/javascript; charset=utf-8','.html':'text/html; charset=utf-8','.png':'image/png','.glb':'model/gltf-binary','.json':'application/json'};
/* 기준 화면: 기기 화면(CSS px)에서 앱 안쪽은 상태 표시줄 24 + 제스처 막대 24를 뺀 값(껍데기는 시스템 막대 native, android\02 7번).
   가장 낮은 세로는 폰 Chrome(상태 24 + 주소창 56 + 3버튼 막대 48). 패드 3종은 바뀌지 않았는지 보는 비교용(배치 지문) */
const VIEWS=[
 {id:'p360',w:360,h:732,dsf:3,label:'세로 360×780 앱 → 360×732'},
 {id:'p393',w:393,h:804,dsf:2.75,label:'세로 393×852 앱 → 393×804'},
 {id:'p412',w:412,h:867,dsf:2.625,label:'세로 412×915 앱 → 412×867'},
 {id:'p360c',w:360,h:652,dsf:3,label:'세로 360×780 Chrome → 360×652'},
 {id:'l780',w:780,h:312,dsf:3,label:'가로 780×360 앱 → 780×312'},
 {id:'l852',w:852,h:345,dsf:2.75,label:'가로 852×393 앱 → 852×345'},
 {id:'pad1366',w:1366,h:640,dsf:1,pad:true,label:'노트북 1366×640'},
 {id:'pad1180',w:1180,h:820,dsf:1,pad:true,label:'패드 가로 1180×820'},
 {id:'pad820',w:820,h:1180,dsf:1,pad:true,label:'패드 세로 820×1180'}].filter(v=>!ONLY_VIEWS||ONLY_VIEWS.includes(v.id));
const SHEETS=[['portrait',['p360','p393','p412']],['other',['p360c','l780','l852']]];
const PAD_SCENES=['01-start','02-read-10','06-stage-6','08-notebook','09-guardian-log'];
const want=(v,name)=>(!ONLY_SCENES||ONLY_SCENES.includes(name))&&(!v.pad||PAD_SCENES.includes(name));
/* 0.14 단계별 마을(test.cjs 단계 둘러보기와 같은 값, 8세). 단계 1/4/6 = 농가 · 물레방아 마을 · 성 */
const VILLAGE=[{level:1,fence:1,chickens:2},{level:3,fence:3,chickens:4},{level:5,fence:6,chickens:6,farmers:1},{level:7,fence:8,chickens:9,farmers:2,power:2},{level:10,fence:12,chickens:12,farmers:4,power:3,pond:1},{level:14,fence:16,chickens:16,farmers:6,power:5,pond:2}];
const now=Date.now(),day=Book.dayOf(now);
/* 여러 칸이 찬 수첩(book-shots.cjs와 같은 기록) */
const rich=()=>{const b=Book.fresh(now,4242),t=now-3*86400000;
 Object.assign(b.mon.wolf,{foot:t,card:t,note:3,plays:6,last:5,kills:140,rib:{n:3,last:5},shiny:t});Object.assign(b.mon.bramble,{foot:t,card:now,note:3,plays:4,kills:90,rib:{n:1,last:5}});
 Object.assign(b.mon.boar,{foot:t,card:t,note:3,plays:3,kills:14,rib:{n:2,last:5}});Object.assign(b.mon.granite,{foot:t,plays:2,last:5,kills:5});Object.assign(b.mon.frost,{foot:t,plays:1,kills:3});Object.assign(b.mon.fox,{foot:t,plays:2,kills:3,note:1,shiny:t});
 const n={one:412,fresh:130,again:7,rush:18,en:9,quiz:61,king:5,fox:4,arrow:1240,keeper:3,star:2,map:1};for(const k of Object.keys(n)){b.medal[k].n=n[k];Book.BOOK.MEDAL[k].forEach((need,i)=>{if(n[k]>=need)b.medal[k].at[i]=t})}
 b.play=6;b.pq=6;b.tot={q:540,f:455,s:9800,days:6};b.day[day]=[42,36,900,11];b.rv=[['a8-story-03',4],['a8-story-12',3],['a8-quiz-07',2],['a8-story-g041',2],['a8-story-g102',1]].map(([id,miss])=>({id,box:1,due:99,dp:6,miss,seen:1}));return b};
const runState=o=>JSON.stringify({version:3,...Combat.fresh(8),seed:4242,index:20,gold:480,level:3,fence:4,chickens:6,farmers:2,hall:1,...o});

/* 페이지 안에서 재는 값(스스로 완결된 함수: Playwright가 글로 옮겨 실행) */
function measure(kind){
 const vw=innerWidth,vh=innerHeight,R=e=>{const r=e.getBoundingClientRect();return {x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height),b:Math.round(r.bottom),r:Math.round(r.right)}};
 const shown=e=>{if(!e)return false;const r=e.getBoundingClientRect();if(r.width<1||r.height<1)return false;for(let p=e;p&&p.nodeType===1;p=p.parentElement){const cs=getComputedStyle(p);if(cs.display==='none'||cs.visibility==='hidden'||Number(cs.opacity)===0)return false}return true};
 const dialogs=[...document.querySelectorAll('.start-screen')].filter(d=>!d.hidden&&shown(d)).sort((a,b)=>(parseInt(getComputedStyle(b).zIndex)||0)-(parseInt(getComputedStyle(a).zIndex)||0));
 const top=dialogs[0]||null,scope=top||document.querySelector('main');
 const nm=e=>e.id||(e.dataset&&(e.dataset.key||e.dataset.tab||e.dataset.age||e.dataset.d))||(typeof e.className==='string'&&e.className.split(' ')[0])||e.tagName.toLowerCase();
 const txt=e=>(e.textContent||'').trim().replace(/\s+/g,' ').slice(0,14);
 /* 누름 칸: 단추 · 고르기 · 서랍 머리 · 가게 칸 · 확인란을 품은 이름표(확인란 자체는 이름표가 누름 칸) */
 const targets=[...scope.querySelectorAll('button,select,summary,.slot,label')].filter(e=>shown(e)&&(e.tagName!=='LABEL'||e.querySelector('input')));
 if(!top){const p=document.getElementById('pause');if(shown(p))targets.push(p)}
 const small=targets.map(e=>({e,r:R(e)})).filter(x=>x.r.w<44||x.r.h<44).map(x=>nm(x.e)+'「'+txt(x.e)+'」'+x.r.w+'×'+x.r.h);
 const leaves=[...scope.querySelectorAll('*')].filter(e=>shown(e)&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()));
 const clipped=leaves.filter(e=>{const cs=getComputedStyle(e);return (cs.overflowX!=='visible'||cs.textOverflow==='ellipsis')&&e.scrollWidth>e.clientWidth+1}).map(e=>nm(e)+'「'+txt(e)+'」');
 const outside=leaves.filter(e=>{const r=e.getBoundingClientRect();return r.right>vw+1||r.left<-1}).map(e=>nm(e)+'「'+txt(e)+'」');
 const fontOf=sel=>{const a=[...document.querySelectorAll(sel)].filter(shown).map(e=>parseFloat(getComputedStyle(e).fontSize));return a.length?Math.min(...a):null};
 const font={prompt:fontOf('#prompt'),passage:fontOf('#passage'),answers:fontOf('#answers button'),pill:fontOf('.stats .pill'),slotName:fontOf('#shop .slot .nm'),slotPrice:fontOf('#shop .slot .pr'),caption:fontOf('#villageStatus'),
  min:leaves.length?Math.min(...leaves.map(e=>parseFloat(getComputedStyle(e).fontSize))):null};
 const g=id=>document.getElementById(id),scene=g('scene'),sr=R(scene);
 const out={vw,vh,dpr:devicePixelRatio,scrollH:document.scrollingElement.scrollHeight,scrollW:document.documentElement.scrollWidth,overflowX:document.documentElement.scrollWidth>vw,dialog:top&&top.id,
  small,clipped,outside,font,scene:{w:sr.w,h:sr.h,shownH:Math.max(0,Math.min(sr.b,vh)-Math.max(sr.y,0)),renderer:scene.dataset.renderer}};
 if(top){const c=top.querySelector('.start-card'),cr=R(c);out.card={...cr,scroll:top.scrollHeight>top.clientHeight+1,fits:cr.h<=vh,lastButton:(()=>{const bs=[...c.querySelectorAll('button')].filter(shown);const l=bs[bs.length-1];return l?{n:nm(l),...R(l)}:null})()};
  const gb=top.querySelector('.g-body');if(gb&&shown(gb))out.gBody={h:Math.round(gb.clientHeight),content:Math.round(gb.scrollHeight),scroll:gb.scrollHeight>gb.clientHeight+1}}
 if(kind==='ask'||kind==='shop'||kind==='stage'){
  const box=id=>{const e=g(id);return shown(e)?R(e):null},s=box('gold'),sh=box('shopWrap'),a=box('answers'),p=box('prompt'),card=box('stageCard');
  const inV=r=>!!r&&r.y>=-1&&r.b<=vh+1&&r.x>=-1&&r.r<=vw+1;
  out.view={stats:s,shop:sh,answers:a,prompt:p,stageCard:card,statsIn:inV(s),sceneIn:sr.y>=-1&&sr.b<=vh+1,shopIn:inV(sh),answersIn:inV(a),promptIn:inV(p),
   apart:!!(a&&card)&&(a.y>=card.b-1||a.x>=card.r-1),together:inV(s)&&sr.y>=-1&&sr.b<=vh+1&&inV(sh)&&inV(a)&&sr.h>=120};
  const sl=[...document.querySelectorAll('#shop .slot')].filter(shown).map(R);out.slots={n:sl.length,minW:sl.length?Math.min(...sl.map(r=>r.w)):0,minH:sl.length?Math.min(...sl.map(r=>r.h)):0,allIn:sl.every(inV)};
  const ab=[...document.querySelectorAll('#answers button')].filter(shown).map(R);out.answerButtons={n:ab.length,minW:ab.length?Math.min(...ab.map(r=>r.w)):0,minH:ab.length?Math.min(...ab.map(r=>r.h)):0,allIn:ab.every(inV)};
 }
 if(window.VillageView&&scene.dataset.renderer==='three'){try{const i=window.VillageView.inspect();out.three={cameraHalf:+(+i.cameraHalf).toFixed(2),aspect:+(+i.aspect).toFixed(2),radius:i.radius,drawCalls:i.drawCalls,triangles:i.triangles,stage:i.stage,quality:i.quality||null}}catch{}}
 /* 배치 지문: 같은 상태에서 고치기 전후 패드 화면이 같은지(사각형·글자 크기) 비교한다 */
 const lay={};for(const sel of ['header','#stageCard','.stats','#scene','.stage-caption','#shopWrap','.lesson','#prompt','#passage','#answers','.growth-panel']){const e=document.querySelector(sel);if(shown(e))lay[sel]=[...Object.values(R(e)),parseFloat(getComputedStyle(e).fontSize)]}
 lay.slots=[...document.querySelectorAll('#shop .slot')].filter(shown).map(e=>Object.values(R(e)));lay.answerButtons=[...document.querySelectorAll('#answers button')].filter(shown).map(e=>[...Object.values(R(e)),parseFloat(getComputedStyle(e).fontSize)]);
 if(top){lay.card=Object.values(R(top.querySelector('.start-card')));lay.cardButtons=[...top.querySelectorAll('button')].filter(shown).map(e=>[nm(e),...Object.values(R(e))])}
 out.layout=lay;return out;
}

(async()=>{
 const server=http.createServer((req,res)=>{const p=new URL(req.url,'http://x').pathname,f=path.join(OUT,p==='/'?'index.html':decodeURIComponent(p.slice(1)));
  if(p==='/__blank'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end('<!doctype html><title>blank</title>')}/* 저장을 고칠 같은 출처 빈 문서(404는 브라우저 오류 문서라 localStorage를 못 씀) */
  if(!f.startsWith(OUT)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);return res.end()}
  res.setHeader('Content-Type',TYPES[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f))});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;fs.mkdirSync(DIR,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const SHOTS=[],METRICS=[];
 const ready=page=>page.waitForFunction(()=>['three','fallback'].includes(document.querySelector('.scene').dataset.renderer),null,{timeout:60000});
 const frames=async(page,n)=>{if(await page.evaluate(()=>document.querySelector('.scene').dataset.renderer!=='three'||!window.VillageView))return;const from=await page.evaluate(()=>window.VillageView.inspect().frames);await page.waitForFunction(t=>window.VillageView.inspect().frames>=t,from+n,{timeout:30000}).catch(()=>{})};
 /* 저장을 비우고 넣은 뒤 연다(같은 출처 빈 문서 /__blank에서 localStorage를 고친다) */
 const load=async(page,{book=null,run=null,query='/?book=1'}={})=>{await page.goto(url+'/__blank');await page.evaluate(s=>{localStorage.clear();if(s.book)localStorage.setItem('hangul-defense-book',s.book);if(s.run)localStorage.setItem('hangul-defense-v1',s.run)},{book,run});await page.goto(url+query);await ready(page)};
 const phaseIs=(page,p)=>page.waitForFunction(p=>window.__game().phase===p,p,{timeout:20000});
 const begin=async(page,age)=>{await page.locator('#ageRow button[data-age="'+age+'"]').tap();await page.locator('#go').tap();await phaseIs(page,'ask')};
 const unlock=page=>page.evaluate(()=>{const g=window.__game();if(g.phase==='ask'&&g.round.lock>0)window.__tick(g.round.lock)});
 const answerRight=page=>page.evaluate(()=>{const g=window.__game();if(g.round.lock>0)window.__tick(g.round.lock);if(phase==='ask'&&round&&round.tries===0){const k=Math.ceil(Combat.FAST_MIN*Combat.needSeconds(round.q)/Combat.TICK)-round.t;if(k>0)window.__tick(k)}
  document.querySelector('#answers button[data-i="'+window.__game().round.answer+'"]').click()});
 const settle=async page=>{for(let i=0;i<160&&(await page.evaluate(()=>window.__game().phase))!=='ask';i++)await page.evaluate(()=>window.__tick(1))};
 const longPress=(page,id)=>page.evaluate(id=>{const b=document.getElementById(id),n=Date.now;b.onpointerdown();Date.now=()=>n()+2500;b.onpointerup();Date.now=n},id);
 const passGate=page=>page.evaluate(()=>{const N={이:2,삼:3,사:4,오:5,육:6,칠:7,팔:8,구:9},m=/^(.)백(.)십(.)$/.exec(document.getElementById('gateCode').textContent);for(const c of [m[1],m[2],m[3]])[...document.getElementById('gatePad').children].find(b=>b.dataset.d===String(N[c])).click()});
 const still=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 async function take(page,v,name,kind,extra){
  if(!want(v,name))return;await still(page);
  const file=path.join(DIR,name+'-'+v.id+'.jpg');await page.screenshot({path:file,type:'jpeg',quality:80});
  const m=await page.evaluate(measure,kind);if(extra)Object.assign(m,extra);SHOTS.push({name,view:v,file});METRICS.push({shot:name,view:v.id,label:v.label,...m});
  const issues=[m.overflowX&&'가로 넘침 '+m.scrollW,m.small.length&&'44px 미만 '+m.small.length+'개: '+m.small.slice(0,6).join(', '),m.clipped.length&&'잘린 글 '+m.clipped.slice(0,4).join(', '),m.outside.length&&'화면 밖 글 '+m.outside.slice(0,4).join(', '),
   m.card&&!m.card.fits&&'카드 '+m.card.h+'>'+m.vh,m.view&&!m.view.together&&'한 화면 아님 '+JSON.stringify({stats:m.view.statsIn,scene:m.view.sceneIn,shop:m.view.shopIn,answers:m.view.answersIn}),m.gBody&&m.gBody.scroll&&'보호자 본문 안쪽 스크롤 '+m.gBody.h+'/'+m.gBody.content].filter(Boolean);
  console.log('  '+name+' · 장면 '+m.scene.w+'×'+m.scene.h+(m.three?' · 3D 반높이 '+m.three.cameraHalf+' 그리기 '+m.three.drawCalls:'')+' · 글자 최소 '+m.font.min+(m.font.passage?' 지문 '+m.font.passage:'')+(m.font.answers?' 보기 '+m.font.answers:'')+(issues.length?'\n    ⚠ '+issues.join('\n    ⚠ '):''));
 }
 const scenesFor=v=>[
  /* 1 시작 화면 · 수첩 · 문턱 · 보호자 */
  async page=>{
   if(!['01-start','08-notebook','08b-notebook-end','09a-gate','09-guardian-log','09b-guardian-set'].some(n=>want(v,n)))return;
   await load(page,{book:JSON.stringify(rich()),run:runState({})});await take(page,v,'01-start','dialog');
   await page.locator('#openBook').tap();await take(page,v,'08-notebook','dialog');
   await page.evaluate(()=>{document.getElementById('bookScreen').scrollTop=1e5});await take(page,v,'08b-notebook-end','dialog');
   await page.locator('#bookClose').tap();await longPress(page,'openGuard');await take(page,v,'09a-gate','dialog');await passGate(page);
   await page.locator('#gTabs button[data-tab="log"]').tap();await take(page,v,'09-guardian-log','dialog');
   await page.locator('#gTabs button[data-tab="set"]').tap();await take(page,v,'09b-guardian-set','dialog')},
  /* 2 문제 읽기: 나이마다 가장 긴 지문(씨앗 4242, 앞 240문제 가운데 음절 수가 가장 많은 읽기 문제). 수첩 기록은 비워 쪽지·기억 늑대가 끼지 않게 */
  async page=>{
   for(const age of [7,8,9,10]){const name='02-read-'+age;if(!want(v,name)&&!(age===8&&want(v,'03-shop')))continue;
    await load(page,{run:runState({age,index:0,gold:age===8?300:60,level:2,fence:2,chickens:3,farmers:0,hall:0})});
    const best=await page.evaluate(age=>{state.bank=Questions.BANK_VERSION;let bi=0,bl=-1;for(let i=0;i<240;i++){const q=Questions.at(age,'story',i,state.seed,state.bank,ordOff());const l=q.mode==='story'&&q.passage?Combat.syl(q.passage):-1;if(l>bl){bl=l;bi=i}}
     state.index=bi;state.round=null;save();return {index:bi,syllables:bl}},age);
    await page.reload();await ready(page);await begin(page,age);await unlock(page);await page.evaluate(()=>window.__tick(4));
    await take(page,v,name,'ask',{question:{age,...best,id:await page.evaluate(()=>window.__game().round.id)}});
    if(age===8&&want(v,'03-shop')){await answerRight(page);await settle(page);await unlock(page);await page.evaluate(()=>window.__tick(4));await page.locator('#shop .slot[data-key="tower"]').tap();await page.evaluate(()=>window.__tick(1));await take(page,v,'03-shop','shop')}}},
  /* 3 마을 단계 1/4/6 */
  async page=>{
   for(const [k,name] of [[0,'04-stage-1'],[3,'05-stage-4'],[5,'06-stage-6']]){if(!want(v,name))continue;
    await load(page,{run:runState({age:8,index:0,wins:0,gold:300,farmers:0,power:0,pond:0,hall:0,...VILLAGE[k]})});await begin(page,8);
    const three=await page.evaluate(()=>document.querySelector('.scene').dataset.renderer==='three'&&!!window.VillageView);
    if(three){await page.evaluate(()=>window.VillageView.debug({hold:true}));for(let i=0;i<6;i++){await page.evaluate(()=>{window.__tick(2);window.VillageView.debug({advance:.2})});await frames(page,1)}}
    await unlock(page);await take(page,v,name,'stage')}},
  /* 4 늑대 결전: 종 문턱 근처 마을(testmode 결전 직전 값) → 종 → 지금 문제를 맞힌 뒤 결전 문제 */
  async page=>{
   if(!want(v,'07-finale'))return;await load(page,{});
   await page.evaluate(()=>{const s=Combat.fresh(8);Object.assign(s,{level:19,fence:14,chickens:20,farmers:9,pond:3,power:1,gold:79,index:48,wins:41,seed:4242,bank:Questions.BANK_VERSION});s.run.t0=Date.now();Combat.grow(s);
    const R=s.run;R.asked=s.index;R.first=s.wins;R.ok=[];R.miss=[];for(let i=0;i<s.index;i++)(i%7===3?R.miss:R.ok).push(i);R.ok=R.ok.slice(-Combat.CAPS.ok);R.miss=R.miss.slice(-Combat.CAPS.miss);localStorage.setItem(KEY,JSON.stringify(s))});
   await page.reload();await ready(page);await begin(page,8);
   const bell=await page.evaluate(()=>state.run.bell);let fin=false;
   if(bell===1){await page.evaluate(()=>{world.wolves=[];world.trickle=1e9;world.wave.arrive=1e9;world.wave.spawned=true;window.__tick(4)});await page.locator('#shop .slot[data-key="bell"]').tap();
    await answerRight(page);await settle(page);await page.evaluate(()=>window.__tick(40));await frames(page,6);await unlock(page);fin=await page.evaluate(()=>!!(window.__game().round&&window.__game().round.fin));}
   else console.log('  (결전: 종이 열리지 않음 bell='+bell+')');
   await take(page,v,'07-finale','ask',{finale:fin})}];
 try{
  for(const v of VIEWS){
   console.log(v.id+' '+v.w+'x'+v.h+' @'+v.dsf+(v.pad?' (패드 비교)':''));
   const ctx=await browser.newContext({viewport:{width:v.w,height:v.h},deviceScaleFactor:v.dsf,isMobile:!v.pad,hasTouch:true,reducedMotion:'reduce'});
   await ctx.addInitScript(()=>{window.__HOLD_CLOCK=true});
   const page=await ctx.newPage();page.on('pageerror',e=>console.log('  page error ['+v.id+']:',e.message));
   for(const s of scenesFor(v)){try{await s(page)}catch(e){console.log('  장면 실패 ['+v.id+']: '+e.message.split('\n')[0])}}
   await ctx.close()}
  /* 눈 검수용 묶음 사진: CSS 크기 그대로(배율 1) 나란히 */
  const ctx=await browser.newContext({viewport:{width:1300,height:900},deviceScaleFactor:1});const page=await ctx.newPage();
  for(const name of [...new Set(SHOTS.map(s=>s.name))])for(const [group,ids] of SHEETS){
   const items=ids.map(id=>SHOTS.find(s=>s.name===name&&s.view.id===id)).filter(Boolean);if(!items.length)continue;
   await page.setContent('<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:8px;background:#cfcfcf;font:600 13px system-ui,sans-serif;display:flex;flex-wrap:wrap;gap:10px;align-items:flex-start;width:fit-content;max-width:1284px}figure{margin:0}figcaption{margin:0 0 3px}img{display:block;outline:1px solid #777}</style>'+
    items.map(s=>'<figure><figcaption>'+name+' · '+s.view.label+'</figcaption><img style="width:'+s.view.w+'px;height:'+s.view.h+'px" src="data:image/jpeg;base64,'+fs.readFileSync(s.file).toString('base64')+'"></figure>').join(''));
   await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))));
   const size=await page.evaluate(()=>({w:Math.ceil(document.body.getBoundingClientRect().width),h:Math.ceil(document.body.scrollHeight)}));
   await page.setViewportSize({width:Math.min(1300,size.w),height:Math.max(100,size.h)});
   await page.screenshot({path:path.join(DIR,'contact-'+name+'-'+group+'.jpg'),type:'jpeg',quality:85,fullPage:true})}
  await ctx.close();
 }finally{fs.writeFileSync(path.join(DIR,'metrics.json'),JSON.stringify(METRICS,null,1));await browser.close();server.close()}
 console.log('저장: '+DIR+' (사진 '+SHOTS.length+'장, 숫자 metrics.json)');
})().catch(e=>{console.error(e);process.exit(1)});
