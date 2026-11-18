/* 문제은행에 새 문항 붙이기
     node scripts/bank-add.cjs [--dry] 파일.json [파일.json …]   새 문항을 붙이고 은행 판을 하나 올린다
     node scripts/bank-add.cjs --print                           판마다 이행 검사용 지문만 찍는다
   - 파일 = 문항 배열 또는 {story:[…], quiz:[…]}. 항목은 questions-gen.js와 같은 꼴 {id, age, mode, (cat), prompt, passage, speak, choices, answer, note, level}.
     id는 아무 것이나 되고(초안의 x·y 계열 등) 여기서 생성 구간 순번(a8-story-g186 …)으로 다시 매긴다.
   - 새 문항은 나이·묶음마다 생성 구간 맨 뒤에만 붙인다(앞 문항의 자리·번호는 그대로).
   - 붙이기 전의 생성 문항 수를 questions-gen.js의 DATA.editions에 한 줄 더한다 = 은행 판이 하나 오른다(Questions.BANK_VERSION).
     진행 중인 저장(state.bank)은 예전 판의 문항·순서를 그대로 쓰고, 새 판부터 새 문항이 섞인다(questions.js '문제은행 판').
     한 번에 여러 파일을 주면 판은 한 번만 오른다(10·9세를 같이 붙일 때는 한 번에).
   - 붙인 뒤 Questions.validate()와 거부 목록을 보고, 문제가 있으면 파일을 되돌린다. 그다음 node test-questions.cjs를 돌린다.
     test-questions.cjs의 BANK_PRINT(이행 검사)에 새 판 줄을 더한다(끝에 찍어 주는 값). 예전 판 줄은 절대 고치지 않는다. */
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const ROOT=path.join(__dirname,'..'),FILE=path.join(ROOT,'questions-gen.js'),QFILE=path.join(ROOT,'questions.js');
const args=process.argv.slice(2),dry=args.includes('--dry'),files=args.filter(a=>!a.startsWith('--'));
const AGES=[7,8,9,10],MODES=['story','quiz'],p3=n=>('00'+n).slice(-3);
const KEYS=m=>['id','age','mode'].concat(m==='quiz'?['cat']:[],['prompt','passage','speak','choices','answer','note','level']);
const load=()=>{delete require.cache[require.resolve(FILE)];delete require.cache[require.resolve(QFILE)];return require(QFILE)};
/* 지문: (나이, 씨앗 5개, 번호 0~599)의 문항 id·보기 순서·정답 자리·바퀴 해시 */
const print=(Q,v)=>{const o={};for(const a of AGES){const h=crypto.createHash('sha1');
  for(const s of [0,1,7,42,123456])for(let i=0;i<600;i++){const q=Q.at(a,'story',i,s,v);h.update(q.id+'|'+q.choices.join('/')+'|'+q.answer+'|'+q.lap+'\n')}
  o[a]=h.digest('hex').slice(0,16)}return o};
if(!files.length){
  if(!args.includes('--print')){console.error('쓰는 법: node scripts/bank-add.cjs [--dry] 새문항.json …  |  --print');process.exit(2)}
  const Q=load();for(let v=1;v<=Q.BANK_VERSION;v++)console.log(' '+v+':'+JSON.stringify(print(Q,v))+',');
  process.exit(0);
}
const src=fs.readFileSync(FILE,'utf8'),eol=src.includes('\r\n')?'\r\n':'\n',text=src.replace(/\r\n/g,'\n');
const head=text.slice(0,text.indexOf('(function(root){'));
delete require.cache[require.resolve(FILE)];
const DATA=require(FILE),editions=Array.isArray(DATA.editions)?DATA.editions.slice():[];
const before={};for(const a of AGES)before[a]={story:DATA[a].story.length,quiz:DATA[a].quiz.length};
const added={};let total=0;
for(const f of files){
  const raw=JSON.parse(fs.readFileSync(f,'utf8')),list=Array.isArray(raw)?raw:[].concat(raw.story||[],raw.quiz||[]);/* 배열 또는 {story:[…], quiz:[…]} */
  if(!list.length)throw new Error(f+': 문항이 없음');
  for(const q of list){
    if(!AGES.includes(q.age)||!MODES.includes(q.mode))throw new Error(f+' '+q.id+': age/mode');
    const o={};for(const k of KEYS(q.mode)){if(q[k]===undefined)throw new Error(f+' '+q.id+': '+k+' 없음');o[k]=q[k]}
    const dst=DATA[q.age][q.mode];o.id='a'+q.age+'-'+q.mode+'-g'+p3(dst.length+1);dst.push(o);
    const k=q.age+'세 '+q.mode;added[k]=(added[k]||0)+1;total++;
  }
}
editions.push(before);
const body=AGES.map(a=>' '+a+':{\n'+MODES.map(m=>'  '+m+':[\n'+DATA[a][m].map(q=>'   '+JSON.stringify(q)).join(',\n')+'\n  ]').join(',\n')+'\n }').join(',\n');
const out=head+'(function(root){\nconst DATA={\n'+body+'\n};\n'+
  '/* 은행 판: editions[k] = 판 k+1의 생성 문항 수(scripts/bank-add.cjs가 붙일 때마다 한 줄 더함. 손으로 고치지 않는다) */\n'+
  'DATA.editions=[\n'+editions.map(e=>' '+JSON.stringify(e)).join(',\n')+'\n];\n'+
  "if(typeof module!=='undefined'&&module.exports)module.exports=DATA;else root.QUESTIONS_GEN=DATA;\n})(typeof window!=='undefined'?window:globalThis);\n";
console.log('붙일 문항 '+total+'개:',JSON.stringify(added),'→ 은행 판',editions.length+1);
if(dry){console.log('(--dry: 파일을 쓰지 않음)');process.exit(0)}
fs.writeFileSync(FILE,out.replace(/\n/g,eol));
const Q=load(),bad=Q.genRejected.concat(Q.validate());
if(bad.length){fs.writeFileSync(FILE,src);console.error('규칙에 어긋나 되돌림('+bad.length+'):');bad.slice(0,40).forEach(m=>console.error(' - '+m));process.exit(1)}
console.log('썼음. 문항 수:',AGES.map(a=>a+'세 '+Q.count(a,'story')+'+'+Q.quizCount(a)).join(', '));
console.log('test-questions.cjs BANK_PRINT에 더할 줄 →  '+Q.BANK_VERSION+':'+JSON.stringify(print(Q,Q.BANK_VERSION))+',');
