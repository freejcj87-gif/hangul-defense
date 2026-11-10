const fs=require('fs'),assert=require('node:assert/strict'),Combat=require('./combat.js');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
const src=html.match(/<script>([\s\S]*?)<\/script>/)[1];
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++};
function simulate(level,stage){let b=Combat.create(stage);for(let i=0;i<3000&&!b.done;i++)Combat.step(b,level,.1);return b}
ok(simulate(0,0).leaked===2,'no tower must leak');
ok(simulate(1,0).leaked===0,'first tower can defend introduction');
ok(simulate(1,24).leaked>0,'one tower is not automatic victory');
ok(simulate(5,24).kills>simulate(1,24).kills,'upgrading improves actual combat');
let b=Combat.create(0);const before=JSON.stringify(b);Combat.step(b,1,0);ok(JSON.stringify(b)===before,'zero delta does not advance');
Combat.step(b,1,100);ok(b.elapsed<=.1,'large frame cannot fast-forward');
ok(Combat.valid(JSON.parse(JSON.stringify(b))),'combat snapshot roundtrip');
ok(!Combat.valid({version:1}),'invalid combat rejected');
const ended=simulate(1,0),done=JSON.stringify(ended);Combat.step(ended,5,.1);ok(JSON.stringify(ended)===done,'finished battle cannot resolve twice');
let saved={};
function boot(){
 let nodes={},interval;class E{
  constructor(){this.style={};this.dataset={};this.children=[];this.disabled=false;this.checked=false;this.textContent='';this.value='';this.classList={add(){},remove(){},toggle(){}}}
  set innerHTML(v){this.children=[]}append(n){this.children.push(n)}setAttribute(k,v){this[k]=v}remove(){}click(){if(!this.disabled&&this.onclick)this.onclick()}
 }
 const document={body:new E(),getElementById:id=>nodes[id]??=new E(),createElement:()=>new E(),querySelectorAll:()=>nodes.answers.children,addEventListener(){}};
 const window={addEventListener(){}};
 const localStorage={getItem:k=>saved[k],setItem:(k,v)=>saved[k]=v};
 const api=new Function('document','window','localStorage','setInterval','setTimeout','confirm','Combat',
 src+'\nreturn {snapshot:()=>JSON.parse(JSON.stringify(state)),phase:()=>phase};')
 (document,window,localStorage,f=>interval=f,()=>0,()=>true,Combat);
 return {n:nodes,...api,tick(n){for(let i=0;i<n;i++)interval()}};
}
let a=boot();ok(a.snapshot().gold===20,'initial gold');ok(a.n.battle.disabled,'question before battle');
a.n.answers.children[1].click();ok(a.snapshot().gold===20,'wrong answer costs no gold');
a.n.answers.children[2].click();ok(a.n.answers.children[0].style.background==='#b9e6be','hint after two errors');
a.n.answers.children[0].click();ok(a.snapshot().gold===40,'reward');
a.n.answers.children[0].click();ok(a.snapshot().gold===40,'reward exactly once');
a=boot();ok(a.n.answers.children.every(x=>x.disabled),'claim survives reload');
a.n.build.click();ok(a.snapshot().gold===0&&a.snapshot().level===1,'purchase costs40');
a.n.build.click();ok(a.snapshot().level===1,'cannot overspend');
a.n.battle.click();a.tick(25);let elapsed=a.snapshot().combat.elapsed;
a.n.pause.click();a.tick(30);ok(a.snapshot().combat.elapsed===elapsed,'pause freezes battle');
a=boot();ok(a.phase()==='battle'&&a.n.pause.textContent==='계속하기','resume saved battle paused');
a.n.pause.click();a.tick(800);ok(a.snapshot().wins===1,'real combat victory');
a=boot();ok(a.n.battle.disabled&&a.phase()==='result','finished battle cannot replay');
a.n.next.click();a.n.mode.click();ok(a.n.answers.children.length===5,'five options for reading');
a.n.answers.children[0].click();a.n.answers.children[1].click();
ok(a.n.answers.children[2].style.background==='#b9e6be','hint uses actual answer key');
a.n.answers.children[2].click();ok(a.snapshot().gold===40,'long passage reward40');
a.n.reset.click();ok(a.snapshot().gold===20&&a.snapshot().level===0,'reset clears progression');
a.n.speak.click();ok(a.n.feedback.textContent.includes('소리 도움말: 나'),'speech fallback');
a.n.answers.children[0].click();a.n.battle.click();a.tick(800);ok(a.snapshot().hp===70,'escaped enemies damage gate');
ok(a.snapshot().wins===0,'no false victory without tower');
saved['hangul-defense-v1']='broken';a=boot();ok(a.snapshot().gold===20,'corrupt JSON fallback');
console.log('PASS '+checks+' rule + simulated DOM assertions. Not browser/audio/device validation.');
