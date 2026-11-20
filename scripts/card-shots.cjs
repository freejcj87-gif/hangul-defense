/* 친구 카드 그림 16장 렌더(개발용, 배포 묶음·검사 제외). 브라우저를 쓰므로 CI(.github/workflows/card-art.yml)에서 돌린다.
   node scripts/card-shots.cjs [저장 폴더=card-shots]
   필요: npm install --no-save --package-lock=false playwright@1.56.1 three@0.180.0 esbuild@0.25.10 (Playwright 컨테이너에는 브라우저가 이미 있음)
   결과: <저장 폴더>/<키>[-shiny].webp 16장(300×400, 투명 배경) + sheet.png(게임 카드 바탕에 얹은 모습 · 발자국 그림자 · 반짝) + sizes.json.
   저장소에는 받은 webp를 art/cards/에 그대로 넣는다(docs/v017-card-art.md). 렌더 코드는 tools/card-render.js · tools/card-render.html */
'use strict';
const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.join(__dirname,'..'),BUILD=path.join(ROOT,'.card-build'),DIR=path.resolve(process.argv[2]||path.join(ROOT,'card-shots'));
const KINDS=['wolf','bramble','boar','granite','frost','ember','fox','king'];
const TYPES={'.js':'text/javascript; charset=utf-8','.html':'text/html; charset=utf-8','.glb':'model/gltf-binary'};
(async()=>{
  fs.mkdirSync(BUILD,{recursive:true});fs.mkdirSync(DIR,{recursive:true});
  require('esbuild').buildSync({entryPoints:[path.join(ROOT,'tools/card-render.js')],bundle:true,format:'iife',target:'es2020',outfile:path.join(BUILD,'card-render.js'),logLevel:'warning'});
  /* 렌더 페이지 · 묶은 스크립트 · 0.15 GLB만 내준다 */
  const pick=p=>p==='/'?path.join(ROOT,'tools/card-render.html'):p==='/card-render.js'?path.join(BUILD,'card-render.js'):/^\/art-handoff\/v015-v016\/glb\/[a-z-]+\.glb$/.test(p)?path.join(ROOT,p.slice(1)):null;
  const server=http.createServer((req,res)=>{const f=pick(new URL(req.url,'http://x').pathname);
    if(!f||!fs.existsSync(f)){res.writeHead(404);return res.end()}res.setHeader('Content-Type',TYPES[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f))});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/';
  const browser=await chromium.launch({args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await (await browser.newContext({viewport:{width:1000,height:900},deviceScaleFactor:1.5})).newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')console.log('  [page] '+m.text())});
  await page.goto(url);await page.waitForFunction(()=>window.cardReady===true||!!window.cardError,{},{timeout:60000});
  const err=await page.evaluate(()=>window.cardError||null);if(err)throw new Error('WebGL: '+err);
  const cards=[];
  for(const kind of KINDS)for(const shiny of [false,true]){
    const r=await page.evaluate(([k,s])=>window.renderCard(k,s),[kind,shiny]),m=/^data:image\/(webp|png);base64,(.*)$/.exec(r.data);
    if(!m)throw new Error(r.info.name+': no image data');if(m[1]!=='webp')console.warn('  webp를 못 만들어 png로 저장: '+r.info.name);
    const file=path.join(DIR,r.info.name+'.'+m[1]);fs.writeFileSync(file,Buffer.from(m[2],'base64'));
    const bytes=fs.statSync(file).size;cards.push({...r.info,file:path.basename(file),bytes});
    console.log(r.info.name.padEnd(14)+String(bytes).padStart(7)+' B  zoom '+r.info.zoom+'  box '+JSON.stringify(r.info.box)+(r.info.unmapped.length?'  색 그대로: '+r.info.unmapped.join(','):''));
  }
  await page.evaluate(()=>window.showSheet());await page.screenshot({path:path.join(DIR,'sheet.png'),fullPage:true});
  const total=cards.reduce((s,c)=>s+c.bytes,0);fs.writeFileSync(path.join(DIR,'sizes.json'),JSON.stringify({total,cards},null,1)+'\n');
  console.log('합계 '+total+' B ('+(total/1024).toFixed(1)+' KB), 저장: '+DIR);
  await browser.close();server.close();
  if(errors.length){console.error('page errors:\n'+errors.join('\n'));process.exit(1)}
})().catch(e=>{console.error(e);process.exit(1)});
