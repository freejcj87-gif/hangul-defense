const { chromium } = require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
 page.on('pageerror',e=>console.log('REFERENCE_ERROR '+e.message.slice(0,300)));
 await page.goto('https://freejcj87-gif.github.io/coopnight-web/?showcase=1',{waitUntil:'domcontentloaded',timeout:60000});
 await page.locator('#play').click();
 await page.locator('#loading').waitFor({state:'hidden',timeout:150000});
 await page.waitForTimeout(3000);
 console.log('REFERENCE_A:'+(await page.screenshot({type:'jpeg',quality:55})).toString('base64'));
 await page.waitForTimeout(8000);
 console.log('REFERENCE_B:'+(await page.screenshot({type:'jpeg',quality:55})).toString('base64'));
 console.log('REFERENCE_DONE');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
