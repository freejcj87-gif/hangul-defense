const fs=require('fs'),assert=require('node:assert/strict'),Combat=require('./combat.js'),Questions=require('./questions.js');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
const src=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const KEY='hangul-defense-v1';
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++};const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++};

/* 1. 전투 규칙 */
function simulate(level,stage,fence){let b=Combat.create(stage);for(let i=0;i<4000&&!b.done;i++)Combat.step(b,level,.1,fence);return b}
ok(simulate(0,0).leaked===2,'no tower must leak');
ok(simulate(1,0).leaked===0,'first tower can defend introduction');
ok(simulate(1,24).leaked>0,'one tower is not automatic victory');
ok(simulate(5,24).kills>simulate(1,24).kills,'upgrading improves actual combat');
ok(simulate(5,24).leaked===0,'maximum tower can defend capped difficulty');
let b=Combat.create(0);const before=JSON.stringify(b);Combat.step(b,1,0);ok(JSON.stringify(b)===before,'zero delta does not advance');
Combat.step(b,1,100);ok(b.elapsed<=.1,'large frame cannot fast-forward');
ok(Combat.valid(JSON.parse(JSON.stringify(b))),'combat snapshot roundtrip');
ok(!Combat.valid({version:1}),'invalid combat rejected');
const ended=simulate(1,0),done=JSON.stringify(ended);Combat.step(ended,5,.1);ok(JSON.stringify(ended)===done,'finished battle cannot resolve twice');
/* 울타리: 늑대를 늦출 뿐, 타워 없이는 막지 못한다. */
ok(simulate(0,0,6).leaked===2,'fence alone never defends');
ok(simulate(0,0,6).elapsed>simulate(0,0,0).elapsed,'fence slows wolves');
ok(simulate(1,6,0).leaked>0&&simulate(1,6,6).leaked===0,'full fence lets a level 1 tower hold stage 6');
ok(simulate(2,6,0).leaked===0,'tower upgrade is the other way to hold stage 6');
eq(JSON.stringify(simulate(1,6,99)),JSON.stringify(simulate(1,6,6)),'fence is capped at 6');
eq(JSON.stringify(simulate(1,6,-3)),JSON.stringify(simulate(1,6,0)),'negative fence is ignored');
eq(JSON.stringify(simulate(1,6)),JSON.stringify(simulate(1,6,0)),'fence defaults to 0 (old callers unchanged)');
for(let f=1;f<=6;f++)ok(simulate(0,0,f).elapsed>=simulate(0,0,f-1).elapsed,'each fence segment never speeds wolves up');

/* 2. 가짜 DOM 위에서 실제 게임 스크립트 실행 */
let saved={};
function boot(opts={}){
 let nodes={},interval;
 class E{
  constructor(){this.style={setProperty(k,v){this[k]=v}};this.dataset={};this.children=[];this.disabled=false;this.checked=false;this.textContent='';this.value='';this.offsetWidth=1;const set=this._c=new Set();
   this.classList={add:(...n)=>n.forEach(x=>set.add(x)),remove:(...n)=>n.forEach(x=>set.delete(x)),contains:n=>set.has(n),toggle:(n,f)=>{const on=f===undefined?!set.has(n):!!f;on?set.add(n):set.delete(n);return on}}}
  get className(){return [...this._c].join(' ')}set className(v){this._c.clear();String(v).split(/\s+/).filter(Boolean).forEach(x=>this._c.add(x))}
  set innerHTML(v){this.children=[]}append(n){this.children.push(n)}setAttribute(k,v){this[k]=v}remove(){this.removed=true}click(){if(!this.disabled&&this.onclick)this.onclick()}
 }
 const document={body:new E(),getElementById:id=>nodes[id]??=new E(),createElement:()=>new E(),addEventListener(){}};
 if(opts.reduced)document.body.classList.add('reduced');
 const built=[];
 const window={addEventListener(){}};
 if(opts.view)window.VillageView={build:k=>{built.push(k);return {x:.4,y:.5}},upgrade(){built.push('upgrade')},reward(){},events(){}};
 const localStorage={getItem:k=>saved[k],setItem:(k,v)=>saved[k]=v};
 const api=new Function('document','window','localStorage','setInterval','setTimeout','confirm','Combat','Questions',
 src+'\nreturn {snapshot:()=>JSON.parse(JSON.stringify(state)),phase:()=>phase,current:()=>current,village:()=>window.getVillageState()};')
 (document,window,localStorage,f=>interval=f,()=>0,()=>true,Combat,Questions);
 const n=nodes,kids=()=>n.answers.children;
 return {n,built,...api,tick(c){for(let i=0;i<c;i++)interval()},
  labels:()=>kids().map(x=>x.textContent),
  right(){kids()[api.current().answer].click()},
  wrong(k=0){const a=api.current().answer;kids().filter((_,i)=>i!==a)[k].click()},
  age(v){n.age.value=String(v);n.age.onchange()},
  fx:name=>n.effects.children.filter(x=>x.classList.contains(name)).length,
  clearFx(){n.effects.children=[]}};
}
const fresh=(opts)=>{saved={};return boot(opts)};
const seed=(s,opts)=>{saved={[KEY]:JSON.stringify({version:1,gold:20,hp:100,level:0,wins:0,index:0,mode:'sound',...s})};return boot(opts)};
/* 화면에 나온 문제가 (나이, 모드, 순번) 문제은행 문항과 정확히 같은지 본다. */
function shows(a,age,mode,index,msg){
 const q=Questions.get(age,mode,index);
 eq(a.n.answers.dataset.qid,q.id,msg+': question id');eq(a.n.answers.dataset.age,String(age),msg+': data-age');
 eq(a.labels(),q.choices,msg+': choices');eq(a.n.prompt.textContent,q.prompt,msg+': prompt');eq(a.n.passage.textContent,q.passage||'',msg+': passage');
 eq(a.n.levelChip.textContent,age+'세 · '+Questions.LEVELS[age][mode],msg+': level chip');
 eq(Questions.checkLevel(age,mode,q),[],msg+': level rules');
 for(const other of Questions.AGES)if(other!==age)ok(Questions.get(other,mode,index).id!==q.id,msg+': not the '+other+'세 item');
}

/* 기본 흐름 (기본 나이 8세) */
let a=fresh();ok(a.snapshot().gold===20,'initial gold');ok(a.n.battle.disabled,'question before battle');
shows(a,8,'sound',0,'default age 8');
ok(a.n.build.disabled&&!a.n.buyChicken.disabled&&!a.n.buyFence.disabled,'20 gold: tower locked, chicken and fence open');
a.wrong(0);ok(a.snapshot().gold===20,'wrong answer costs no gold');
a.wrong(1);const key=a.current().answer;
ok(a.n.answers.children[key].style.background==='#b9e6be'&&a.n.answers.children[key].classList.contains('hint'),'hint after two errors uses the answer key');
ok(a.n.answers.children.filter(x=>x.classList.contains('hint')).length===1,'exactly one hint');
a.right();ok(a.snapshot().gold===40,'reward');ok(a.n.choices.classList.contains('ready'),'choices light up after a correct answer');
ok(a.n.answers.children[key].classList.contains('correct'),'answer marked correct');
a.right();ok(a.snapshot().gold===40,'reward exactly once');
a=boot();ok(a.n.answers.children.every(x=>x.disabled),'claim survives reload');
a.n.build.click();ok(a.snapshot().gold===0&&a.snapshot().level===1,'tower costs 40');
ok(a.n.tower.classList.contains('spawn'),'tower pops in (fallback art)');
ok(a.fx('fx-label')===1&&a.fx('fx-ring')===1&&a.fx('fx-flash')===1&&a.fx('fx-dust')===2&&a.fx('fx-star')===10,'tower build effects');
ok(a.n.effects.children.find(x=>x.classList.contains('fx-label')).textContent==='🗼 타워 완성!','tower label');
ok(a.n.build.classList.contains('bought')&&a.n.gold.classList.contains('bump'),'card and gold react');
a.n.build.click();a.n.buyChicken.click();a.n.buyFence.click();ok(a.snapshot().level===1&&a.snapshot().chickens===0&&a.snapshot().fence===0,'cannot overspend');
ok(a.n.build.disabled&&a.n.buyChicken.disabled&&a.n.buyFence.disabled&&!a.n.choices.classList.contains('ready'),'cards lock at 0 gold');
a.n.battle.click();a.tick(25);let elapsed=a.snapshot().combat.elapsed;
a.n.pause.click();a.tick(30);ok(a.snapshot().combat.elapsed===elapsed,'pause freezes battle');
a=boot();ok(a.phase()==='battle'&&a.n.pause.textContent==='계속하기','resume saved battle paused');
a.n.pause.click();a.tick(800);ok(a.snapshot().wins===1,'real combat victory');
a=boot();ok(a.n.battle.disabled&&a.phase()==='result','finished battle cannot replay');
a.n.next.click();shows(a,8,'sound',1,'second 8세 item');

/* 독해 모드와 긴 지문 보상 */
a=fresh();a.age(10);a.n.mode.click();shows(a,10,'story',0,'10세 story');ok(a.n.answers.children.length===5,'five options for 10세 reading');
a.wrong(0);a.wrong(1);ok(a.n.answers.children[a.current().answer].style.background==='#b9e6be','story hint uses actual answer key');
a.right();ok(a.snapshot().gold===60,'long passage reward 40');
a.n.mode.click();ok(a.snapshot().mode==='story','mode locked after answering');
a.n.reset.click();ok(a.snapshot().gold===20&&a.snapshot().level===0&&a.snapshot().chickens===0&&a.snapshot().fence===0,'reset clears progression');
ok(a.snapshot().age===10&&a.snapshot().mode==='sound','reset keeps the chosen age');shows(a,10,'sound',0,'after reset');
a.n.speak.click();ok(a.n.feedback.textContent==='소리 도움말: '+Questions.get(10,'sound',0).speak,'speech fallback');
a.right();a.n.battle.click();a.tick(800);ok(a.snapshot().hp===70,'escaped enemies damage gate');
ok(a.snapshot().wins===0,'no false victory without tower');

/* 3. 나이 선택 → 그 나이 문제로 즉시 전환 */
for(const mode of Questions.MODES)for(const index of [0,1,5]){
 a=seed({index,mode});
 for(const age of [9,10,7,8,10,9]){a.age(age);shows(a,age,mode,index,age+'세 '+mode+' #'+index);
  eq(a.snapshot().age,age,'age saved');eq(a.n.feedback.textContent,age+'세 문제로 바꿨어요.','switch feedback');
  ok(a.n.answers.children.every(x=>!x.disabled),'switched question is answerable');}
}
eq([7,8,9,10].map(age=>Questions.get(age,'sound',0).choices.length),[3,3,4,4],'sound option counts by age');
eq([7,8,9,10].map(age=>Questions.get(age,'story',0).choices.length),[3,3,4,5],'story option counts by age');
/* 은행 끝을 넘어가면 같은 나이 안에서 순환한다. */
for(const age of Questions.AGES){a=seed({age,index:Questions.count(age,'sound')+2});shows(a,age,'sound',Questions.count(age,'sound')+2,age+'세 wraparound');eq(a.n.answers.dataset.qid,Questions.get(age,'sound',2).id,'wraps inside the same age')}
/* 저장된 나이로 시작 */
for(const age of Questions.AGES){a=seed({age});shows(a,age,'sound',0,'saved age '+age);eq(a.n.age.value,age,'selector shows saved age')}
a=seed({age:12});eq(a.snapshot().age,8,'invalid saved age falls back to 8');
a=fresh();a.age(11);eq(a.snapshot().age,8,'invalid selection ignored');shows(a,8,'sound',0,'after invalid selection');
/* 오답 흔적은 전환 뒤 남지 않는다. */
a=fresh();a.wrong(0);a.wrong(1);a.age(9);ok(a.n.answers.children.every(x=>!x.classList.contains('hint')&&!x.style.background&&!x.style.opacity),'hint cleared on age switch');
a.wrong(0);eq(a.n.feedback.textContent,'괜찮아요. 다시 생각해 볼까요?','wrong count restarts for the new question');
/* 이미 맞힌 문제에서 나이를 바꾸면: 화면은 그대로, 보상은 한 번, 다음 문제부터 새 나이 */
a=fresh();a.right();a.age(10);
eq(a.n.answers.dataset.qid,Questions.get(8,'sound',0).id,'answered question stays on screen');eq(a.n.feedback.textContent,'다음 문제부터 10세 문제가 나와요.','deferred switch feedback');
ok(a.n.answers.children.every(x=>x.disabled),'answered buttons stay locked');a.right();eq(a.snapshot().gold,40,'age switch cannot re-claim reward');
a=boot();shows(a,8,'sound',0,'reload keeps the age the question was answered at');eq(a.snapshot().age,10,'new age kept');eq(a.snapshot().gold,40,'no extra gold on reload');
ok(a.n.answers.children.every(x=>x.disabled)&&a.n.answers.children[a.current().answer].classList.contains('correct'),'reloaded answer still locked and marked');
a.age(9);a.age(7);eq(a.n.answers.dataset.qid,Questions.get(8,'sound',0).id,'still the answered item');a.right();eq(a.snapshot().gold,40,'still no re-claim');
a.n.build.click();a.n.battle.click();a.tick(800);eq(a.phase(),'result','battle resolved');
a=boot();eq(a.n.answers.dataset.qid,Questions.get(8,'sound',0).id,'result screen keeps the answered item');
a.n.next.click();shows(a,7,'sound',1,'next question uses the newly chosen age');
/* 전투 중에는 나이 선택이 잠긴다. */
a=fresh();a.right();a.n.battle.click();ok(a.n.age.disabled&&a.n.mode.disabled,'age and mode locked during battle');

/* 4. 골라서 짓기 */
a=fresh();a.right();
a.n.buyChicken.click();eq([a.snapshot().gold,a.snapshot().chickens],[20,1],'chicken costs 20');
eq(a.n.flock.children.length,1,'chicken appears in the village');ok(a.n.flock.children[0].classList.contains('spawn'),'chicken pops in');
ok(a.fx('fx-label')===1&&a.fx('fx-ring')===1&&a.fx('fx-dust')===0&&a.fx('fx-star')===7,'chicken effects');
eq(a.n.effects.children.find(x=>x.classList.contains('fx-label')).textContent,'🐔 꼬꼬 1마리!','chicken label');
a.clearFx();a.n.buyFence.click();eq([a.snapshot().gold,a.snapshot().fence],[0,1],'fence costs 20');
eq(a.n.fenceRow.children.length,1,'fence appears in the village');ok(a.n.fenceRow.children[0].classList.contains('spawn'),'fence pops in');
ok(a.fx('fx-label')===1&&a.fx('fx-dust')===2,'fence effects');
eq(a.n.effects.children.find(x=>x.classList.contains('fx-label')).textContent,'🪵 울타리 1칸!','fence label');
eq(a.village().chickens,1,'village state exposes chickens');eq(a.village().fence,1,'village state exposes fence');
eq(a.n.level.textContent,'🗼0 🐔1 🪵1','status pill');eq(a.n.buyChickenCount.textContent,'1/6','chicken counter');eq(a.n.buyFenceCount.textContent,'1/6','fence counter');
a=boot();eq([a.snapshot().chickens,a.snapshot().fence,a.n.flock.children.length,a.n.fenceRow.children.length],[1,1,1,1],'purchases survive reload');
ok(!a.n.flock.children[0].classList.contains('spawn'),'no spawn animation on plain reload');
/* 닭 보너스: 다음 정답부터 마리당 +5 */
a.n.battle.click();a.tick(800);a.n.next.click();a.right();eq(a.snapshot().gold,25,'one chicken adds +5');
ok(a.n.feedback.textContent.includes('+25골드')&&a.n.feedback.textContent.includes('보너스 +5'),'bonus is explained');
a=seed({gold:0,chickens:6,mode:'story',age:9});a.right();eq(a.snapshot().gold,70,'six chickens add +30 to a story reward');
/* 한도 */
a=seed({gold:999});for(let i=0;i<9;i++){a.n.build.click();a.n.buyChicken.click();a.n.buyFence.click()}
eq([a.snapshot().level,a.snapshot().chickens,a.snapshot().fence],[5,6,6],'caps: tower 5, chickens 6, fence 6');
eq(a.snapshot().gold,999-5*40-6*20-6*20,'only real purchases are charged');
ok(a.n.build.disabled&&a.n.buyChicken.disabled&&a.n.buyFence.disabled,'maxed cards lock');
ok(['build','buyChicken','buyFence'].every(id=>a.n[id].classList.contains('maxed')&&a.n[id+'Price'].textContent==='완성!'),'maxed cards say so');
eq(a.n.buildName.textContent,'최고 타워','tower card name at max');
eq([a.n.flock.children.length,a.n.fenceRow.children.length],[6,6],'all six of each are drawn');
a=seed({gold:50,level:99,chickens:99,fence:99});eq([a.snapshot().level,a.snapshot().chickens,a.snapshot().fence],[5,6,6],'saved values are clamped');
a=seed({gold:100,level:2});eq([a.snapshot().chickens,a.snapshot().fence],[0,0],'old saves without the new fields load as 0');eq(a.snapshot().level,2,'old save keeps its tower');
/* 일시정지 중에는 못 산다. */
a=seed({gold:100});a.n.pause.click();a.n.buyChicken.click();eq(a.snapshot().chickens,0,'no purchase while paused');a.n.pause.click();a.n.buyChicken.click();eq(a.snapshot().chickens,1,'purchase after resume');
/* 움직임 줄이기: 결과 표시는 남기고 번쩍임·파편은 뺀다. */
a=seed({gold:100},{reduced:true});a.n.build.click();ok(a.fx('fx-label')===1&&a.fx('fx-ring')===0&&a.fx('fx-flash')===0&&a.fx('fx-star')===0&&a.fx('fx-dust')===0,'reduced motion keeps only the label');
/* 3D 화면이 있으면 종류별로 build(kind)를 부르고, 없으면 예전 upgrade()로 물러난다. */
a=seed({gold:100},{view:true});a.n.build.click();a.n.buyChicken.click();a.n.buyFence.click();eq(a.built,['tower','chicken','fence'],'3D view is asked to build each kind');
/* 추천: 실제 전투 예측을 따른다. */
a=fresh();ok(a.n.outlook.textContent.includes('타워가 없으면')&&a.n.outlook.classList.contains('warn'),'warns when there is no tower');
a.right();ok(a.n.build.classList.contains('recommended'),'first recommendation is the tower');
a.n.build.click();ok(a.n.outlook.textContent.includes('모두 막을 수 있어요'),'outlook turns safe after the tower');
a=seed({gold:20,level:1});ok(a.n.buyChicken.classList.contains('recommended'),'safe village recommends a chicken');
a=seed({gold:20,level:1,index:6,fence:2});ok(a.n.buyFence.classList.contains('recommended'),'fence recommended when one more segment is enough');
a=seed({gold:40,level:1,index:6});ok(a.n.build.classList.contains('recommended'),'tower recommended when an upgrade is enough');

saved[KEY]='broken';a=boot();ok(a.snapshot().gold===20,'corrupt JSON fallback');shows(a,8,'sound',0,'corrupt save starts at 8세');
console.log('PASS '+checks+' rule + simulated DOM assertions. Not browser/audio/device validation.');
