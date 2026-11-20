/* 7·8세 문항 초안 조립·검사 (브랜치 claude/bank-78, 2026-11-20)
     node bank-drafts/bank-78-build.cjs            원고(bank-78-src.cjs) → 초안 JSON(bank-78-20261120.json) + 검사
     node bank-drafts/bank-78-build.cjs --merge    위에 더해, 임시 폴더의 저장소 사본에 scripts/bank-add.cjs로 붙이고 test-questions.cjs까지 돌림
     node bank-drafts/bank-78-build.cjs --merge --keep   임시 폴더를 지우지 않고 경로를 알려 줌
   - 원고의 보기는 언제나 [정답, 오답, 오답] 순서로 적는다. 정답 자리는 여기서 정한다(기존 생성 구간 끝에 이어 3연속 없이, 자리별 수가 고르게).
   - 초안 id는 k78 계열(a7-quiz-k78001, a8-story-k78001, a8-quiz-k78001). 합칠 때 bank-add.cjs가 생성 구간 순번(-g…)으로 다시 매긴다.
   - 저장소의 questions.js·questions-gen.js·test-questions.cjs는 고치지 않는다(은행 판은 리드가 합칠 때 올림). */
'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const ROOT=path.join(__dirname,'..'),OUT=path.join(__dirname,'bank-78-20261120.json');
const Q=require(path.join(ROOT,'questions.js')),GEN=require(path.join(ROOT,'questions-gen.js')),SRC=require('./bank-78-src.cjs');
const H=Q.hangul,args=process.argv.slice(2);
const chars=s=>Array.from(String(s));
const fail=[],warn=[],F=(id,m)=>fail.push(id+': '+m),W=(id,m)=>warn.push(id+': '+m);

/* ---------- 읽는 소리 ---------- */
const DIGIT='영일이삼사오육칠팔구';
const sino=n=>{if(n===0)return '영';let s='';for(const [v,w] of [[1000,'천'],[100,'백'],[10,'십']]){const d=Math.floor(n/v)%10;if(d)s+=(d===1?'':DIGIT[d])+w}const d=n%10;return d?s+DIGIT[d]:s};
const NATIVE=['','한','두','세','네','다섯','여섯','일곱','여덟','아홉','열'];
const bat=w=>H.hasBatchim(chars(w).pop());
const eun=w=>w+(bat(w)?'은':'는'),gwa=w=>w+(bat(w)?'과':'와');

/* ---------- 그림 수 줄(한 줄 4개 이하) ---------- */
const ROWS={1:[1],2:[2],3:[3],4:[4],5:[3,2],6:[3,3],7:[4,3],8:[4,4],9:[3,3,3],10:[4,3,3]};
const rows=(e,n)=>ROWS[n].map(k=>e.repeat(k)).join('\n');

/* ---------- 원고 펼치기 ---------- */
let seq={};
const nid=(age,mode)=>{const k=age+mode;seq[k]=(seq[k]||0)+1;return 'a'+age+'-'+mode+'-k78'+String(seq[k]).padStart(3,'0')};
const item=(age,mode,o)=>Object.assign({id:nid(age,mode),age,mode},mode==='quiz'?{cat:o.cat}:{},{prompt:o.prompt,passage:o.passage,speak:o.speak===undefined?o.passage:o.speak,choices:o.choices,answer:0,note:o.note||'',level:o.level||2});
const uniq3=(ans,cands)=>{const out=[];for(const c of cands)if(c!==ans&&c>0&&!out.includes(c)&&out.length<2)out.push(c);return [ans,...out].map(String)};

function math7(m,k){
  const [t,...a]=m;
  if(t==='add'){const [x,y]=a,s=x+y;return {cat:'math',prompt:'얼마일까요?',passage:x+' + '+y,speak:sino(x)+' 더하기 '+eun(sino(y))+' 얼마일까요?',choices:uniq3(s,[k%2?s+1:s-1,Math.abs(x-y),k%2?s-1:s+1,s+2]),level:1}}
  if(t==='sub'){const [x,y]=a,s=x-y;return {cat:'math',prompt:'얼마일까요?',passage:x+' − '+y,speak:sino(x)+' 빼기 '+eun(sino(y))+' 얼마일까요?',choices:uniq3(s,[k%2?s+1:s-1,x+y,k%2?s-1:s+1,s+2]),level:x>=10?2:1}}
  if(t==='next'){const [x,y,z]=a,d=z-y,s=z+d,lead=d===1?'':d===2?'이씩 뛰어 세었어요. ':'수가 하나씩 작아져요. ';return {cat:'math',prompt:'□에 알맞은 수는?',passage:x+', '+y+', '+z+', □',speak:lead+sino(z)+' 다음에 오는 수는 무엇일까요?',choices:uniq3(s,[s+d,z,s-d]),level:d===1?1:2}}
  if(t==='prev'){const [y]=a,s=y-1;return {cat:'math',prompt:'□에 알맞은 수는?',passage:'□, '+y+', '+(y+1),speak:sino(y)+' 바로 앞에 오는 수는 무엇일까요?',choices:uniq3(s,[y+1,s-1]),level:1}}
  if(t==='btw'){const [x]=a,s=x+1;return {cat:'math',prompt:'□에 알맞은 수는?',passage:x+', □, '+(x+2),speak:gwa(sino(x))+' '+sino(x+2)+' 사이에 있는 수는 무엇일까요?',choices:[s,x,x+2].map(String),level:1}}
  if(t==='big'||t==='small'){const v=a[0],s=t==='big'?Math.max(...v):Math.min(...v),w=t==='big'?'큰':'작은';return {cat:'math',prompt:'가장 '+w+' 수는?',passage:v.join(', '),speak:v.map(sino).join(', ')+' 중에서 가장 '+w+' 수는 무엇일까요?',choices:[s,...v.filter(x=>x!==s)].map(String),level:1}}
  if(t==='pat'){const [p,extra]=a,e=chars(p);let ans=null,per=0;for(const q of [2,3])if(ans===null&&e.every((x,i)=>i<q||x===e[i-q])){ans=e[4-q];per=q}
    if(ans===null)throw new Error('규칙 없음 '+p);const other=[...new Set(e)].filter(x=>x!==ans);
    return {cat:'math',prompt:'다음에 올 것은?',passage:p,speak:'그림이 규칙대로 놓여 있어요. 다음에 올 그림은 무엇일까요?',choices:[ans,other[0],extra],level:per===2?1:2}}
  if(t==='pic'){const [e,name,unit,x,op,y]=a;
    if(!op){return {cat:'math',prompt:'모두 몇 '+unit+'일까요?',passage:rows(e,x),speak:eun(name)+' 모두 몇 '+unit+'일까요?',choices:uniq3(x,[x+1,x-1,x+2]),level:1}}
    if(op==='+'){const s=x+y;return {cat:'math',prompt:'모두 몇 '+unit+'일까요?',passage:rows(e,x)+'\n+ '+rows(e,y),speak:name+' '+NATIVE[x]+' '+unit+'와 '+NATIVE[y]+' '+unit+'를 더하면 모두 몇 '+unit+'일까요?',choices:uniq3(s,[k%2?s+1:s-1,k%2?s-1:s+1,s+2]),level:1}}
    const s=x-y;return {cat:'math',prompt:'남은 것은 몇 '+unit+'일까요?',passage:rows(e,x)+'\n− '+rows(e,y),speak:name+' '+NATIVE[x]+' '+unit+'에서 '+NATIVE[y]+' '+unit+'를 빼면 몇 '+unit+'가 남을까요?',choices:uniq3(s,[s+1,x+y,s-1]),level:1}}
  throw new Error('모르는 수학 틀 '+t);
}
function math8(m,k){
  const [t,...a]=m,rev=n=>+String(n).split('').reverse().join('');
  if(t==='add'){const [x,y]=a,s=x+y,cands=(x%10+y%10>=10)?[s-10,s+10]:[s+10,rev(s)!==s?rev(s):s-10];return {cat:'math',prompt:'얼마일까요?',passage:x+' + '+y,speak:sino(x)+' 더하기 '+eun(sino(y))+' 얼마일까요?',choices:uniq3(s,cands.concat([s+1,s-1])),level:(x%10+y%10>=10)?2:1}}
  if(t==='sub'){const [x,y]=a,s=x-y,borrow=x%10<y%10,dig=Math.abs(Math.floor(x/10)-Math.floor(y/10))*10+Math.abs(x%10-y%10),cands=borrow?[s+10,dig]:[s+10,s-10];return {cat:'math',prompt:'얼마일까요?',passage:x+' − '+y,speak:sino(x)+' 빼기 '+eun(sino(y))+' 얼마일까요?',choices:uniq3(s,cands.concat([s+1,s-1])),level:borrow?2:1}}
  if(t==='three'){const [x,y,z]=a,s=x+y+z;return {cat:'math',prompt:'세 수를 더하면 얼마일까요?',passage:x+' + '+y+' + '+z,speak:sino(x)+' 더하기 '+sino(y)+' 더하기 '+eun(sino(z))+' 얼마일까요?',choices:uniq3(s,k%2?[s+1,s-1]:[s-1,s+1]),level:2}}
  if(t==='box+'){const [x,c]=a,s=c-x;return {cat:'math',prompt:'□에 알맞은 수는 무엇일까요?',passage:x+' + □ = '+c,speak:sino(x)+(bat(sino(x))?'에':'에')+' 어떤 수를 더하면 '+sino(c)+(bat(sino(c))?'이':'가')+' 될까요?',choices:uniq3(s,[x+c,s+1,s-1]),level:1}}
  if(t==='box-'){const [x,c]=a,s=x-c;return {cat:'math',prompt:'□에 알맞은 수는 무엇일까요?',passage:x+' − □ = '+c,speak:sino(x)+'에서 어떤 수를 빼면 '+sino(c)+(bat(sino(c))?'이':'가')+' 될까요?',choices:uniq3(s,[x+c,s+1,s-1]),level:2}}
  if(t==='even'||t==='odd'){const v=a[0],w=t==='even'?'짝수':'홀수',s=v.filter(x=>x%2===(t==='even'?0:1));if(s.length!==1)throw new Error(w+' 하나가 아님 '+v);return {cat:'math',prompt:v.join(', ')+' 중 '+w+'는?',passage:'',speak:v.map(sino).join(', ')+' 중에서 '+w+'는 무엇일까요?',choices:[s[0],...v.filter(x=>x!==s[0])].map(String),level:1}}
  if(t==='skip'){const [d,x,y,z]=a,s=z+d;return {cat:'math',prompt:d+'씩 뛰어 세었어요. 빈칸에 알맞은 수는?',passage:x+', '+y+', '+z+', □',speak:sino(d)+'씩 뛰어 세었어요. '+[x,y,z].map(sino).join(', ')+', 그다음에 올 수는 무엇일까요?',choices:uniq3(s,[z+1,s+d]),level:1}}
  if(t==='tens'){const [x,y]=a,s=10*x+y;return {cat:'math',prompt:'10개씩 묶음 '+x+'개와 낱개 '+y+'개는 어떤 수일까요?',passage:'',speak:'열 개씩 묶음 '+NATIVE[x]+' 개와 낱개 '+NATIVE[y]+' 개는 어떤 수일까요?',choices:uniq3(s,[x+y,10*y+x]),level:1}}
  throw new Error('모르는 수학 틀 '+t);
}

const NEW={7:{story:[],quiz:[]},8:{story:[],quiz:[]}};
SRC.a7common.forEach(([prompt,passage,choices,speak,level])=>NEW[7].quiz.push(item(7,'quiz',{cat:'common',prompt,passage,choices,speak,level})));
SRC.a7math.forEach((m,k)=>NEW[7].quiz.push(item(7,'quiz',math7(m,k))));
SRC.a8story.forEach(([note,passage,prompt,choices,level])=>NEW[8].story.push(item(8,'story',{note,passage,prompt,choices,level})));
SRC.a8common.forEach(([prompt,choices,speak,level])=>NEW[8].quiz.push(item(8,'quiz',{cat:'common',prompt,passage:'',choices,speak:speak||prompt,level})));
SRC.a8math.forEach((m,k)=>NEW[8].quiz.push(item(8,'quiz',math8(m,k))));
/* 7세 퀴즈는 상식·수학을 번갈아 섞어 둔다(같은 분류가 길게 몰리지 않게) */
{const c=NEW[7].quiz.filter(q=>q.cat==='common'),m=NEW[7].quiz.filter(q=>q.cat==='math'),out=[];let i=0,j=0;
 while(i<c.length||j<m.length){if(j<m.length)out.push(m[j++]);if(j<m.length)out.push(m[j++]);if(i<c.length)out.push(c[i++])}NEW[7].quiz=out}
{const c=NEW[8].quiz.filter(q=>q.cat==='common'),m=NEW[8].quiz.filter(q=>q.cat==='math'),out=[];let i=0,j=0;
 while(i<c.length||j<m.length){if(i<c.length)out.push(c[i++]);if(j<m.length)out.push(m[j++])}NEW[8].quiz=out}

/* ---------- 정답 자리 정하기 ---------- */
const rng=(a=>()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296})(78112026);
const numOf=c=>Number(c),mono=v=>v.every((x,k)=>!k||x>v[k-1])||v.every((x,k)=>!k||x<v[k-1]);
function place(age,mode){
  const old=GEN[age][mode],list=NEW[age][mode],n=3,tally=Array(n).fill(0),cat={};
  old.forEach(q=>{tally[q.answer]++;const c=q.cat||'s';(cat[c]=cat[c]||Array(n).fill(0))[q.answer]++});
  const pos=old.slice(-2).map(q=>q.answer);
  for(const q of list){
    const c=q.cat||'s',ct=(cat[c]=cat[c]||Array(n).fill(0));
    let can=[...Array(n).keys()].filter(p=>!(pos.length>=2&&pos[pos.length-1]===p&&pos[pos.length-2]===p));
    const score=p=>tally[p]*2+ct[p]*3+rng();
    can.sort((x,y)=>score(x)-score(y));const p=can[0];
    const ans=q.choices[0],rest=q.choices.slice(1);if(rng()<.5)rest.reverse();
    rest.splice(p,0,ans);
    if(/가장 (큰|작은)/.test(q.prompt)&&rest.every(x=>!Number.isNaN(numOf(x)))&&mono(rest.map(numOf))){const w=[0,1,2].filter(k=>k!==p);[rest[w[0]],rest[w[1]]]=[rest[w[1]],rest[w[0]]]}
    q.choices=rest;q.answer=p;tally[p]++;ct[p]++;pos.push(p);
  }
  return tally;
}
const T={a7quiz:place(7,'quiz'),a8story:place(8,'story'),a8quiz:place(8,'quiz')};

/* ---------- 검사 ---------- */
const PIC=/\p{Extended_Pictographic}/u;
const SAFE_PIC=new Set([...'🐺👑🐗🌿'+'🌙🌞🌈🍎🎈⛄☔🐶🍓⭐✋🐱🐰🐥🐔🐘🐟🍪🥚🐦🐢🐷👂👃👀🐞🦋🐝🚗🚲🚢🔴🐯'+'💙💜💛🌸🍉❄🚶🛑🏃🍌🥛🍰🔵⚫🍇🔺⬛'+'🐮🐴🐵🐻🦁🦊🦆🍞🥕🥔🍬🍖📕🎒⚽✏🔑☂🚪🛏📱📦✂🥄👟🌳🌧☁⛰🌊🔥👁👄🚂✈👶🏠🚌🍕']);
const BAD_SUB=['씨발','시발','시바','개새','새끼','병신','지랄','좆','존나','졸라','썅','염병','니미','엠창','꺼져','닥쳐','죽어','죽여','죽음','죽이','살인','자살','섹스','마약','똥꼬','젖꼭','성기','강간','폭탄','전쟁','총알','귀신','악마','지옥','변태','멍청','등신','찐따','미친','또라이','개같','개똥','엿먹','보지','자지','애미','애비','조또','씹','쌍놈','빠구리'];
const BAD_WHOLE=['년','놈','뇬','똥','바보','피','칼','총','술','담배','독','뼈','시체','무덤','도끼','코피','방귀','오줌','거지','고자','사기','뒤지','소피','아비','제모'];
const isBad=t=>BAD_SUB.some(b=>t.includes(b))||t.split(/[\s,.?!]+/).some(w=>BAD_WHOLE.includes(w));
const SPELL=[[/되요|되서|안되|않되/,'되/돼'],[/몇일/,'며칠'],[/어떻해/,'어떡해'],[/금새/,'금세'],[/[할볼줄]께/,'ㄹ게'],[/깨끗히|일일히|곰곰히|틈틈히|번번히|따뜻히|솔직이|꼼꼼이|가만이/,'-이/-히'],[/오랫만/,'오랜만'],[/뵈요/,'봬요'],[/윗층|윗쪽/,'위층·위쪽'],[/아니예요/,'아니에요'],
  [/[가-힣]수있|[을를] 수있|[가-힣]것같/,'띄어쓰기'],[/밀어 내|끌어 당|빨아 들|올라 가|내려 가|뛰어 가|걸어 가|달려 가|날아 다|들려 주|가져다 주|데려다 주|도와 주/,'한 낱말을 띄어 씀'],[/ {2,}/,'공백 두 칸'],[/ [.,?!]/,'문장부호 앞 공백'],[/[가-힣][.?!][가-힣]/,'문장부호 뒤 공백 없음']];
const spellBad=q=>{const out=[];for(const t of [q.passage,q.prompt,...q.choices]){const s=String(t).replace(/\n/g,' ');for(const [re,why] of SPELL)if(re.test(s))out.push(why);
  for(const m of s.matchAll(/([가-힣])(이에요|예요)/g)){const b=H.hasBatchim(m[1]);if(m[2]==='예요'?b&&m[1]!=='이':!b)out.push('예요/이에요 '+m[0])}}return out};
const BAN8=[['토끼','당근'],['다람쥐','도토리'],['다람쥐','밤'],['다람쥐','호두'],['곰','꿀'],['고양이','생선'],['고양이','우유'],['강아지','공'],['염소','풀'],['병아리','모이'],['개구리','연못'],['오리','연못'],['오리','강가'],['거북이','바닷가'],['거북이','연못'],['거북이','강가'],['부엉이','밤'],['꼬꼬','아침'],['꼬꼬','달걀'],['참새','쌀'],['엄마','요리'],['엄마','설거지'],['아빠','회사'],['간호사','누나'],['의사','아저씨']];
const words8=p=>p.split(/[\s,.]+/).map(w=>w.replace(/(에게|에서|으로|보다|이|가|은|는|을|를|와|과|로|에|의)$/,''));
const SAME=[['장대','막대'],['개','강아지'],['엄마','어머니'],['아빠','아버지'],['과자','쿠키'],['차','자동차']];
const snap=Q.snapshot(),allOld=[];for(const a of Q.AGES){allOld.push(...snap[a].story,...snap[a].quiz)}
/* 조사(test-questions.cjs 9-3과 같은 규칙): 낱말 목록 = 8~10세 읽기 보기 낱말(새 문항 포함) + 이름 */
const NOUN=new Set(['곰','집','밭','공','컵','연','빵','떡','감','밤','죽','꽃','책','형','귤','콩','춤','붓','숲','강','산','문','종','두리','솔이','하늘이','다온이','마루','나래','꼬꼬','병아리','늑대','오리','토끼','염소','다람쥐','고양이','강아지','부엉이','참새','사슴','너구리','거북이','개구리','돼지','여우']);
for(const a of [8,9,10])for(const q of snap[a].story)for(const c of q.choices)if(H.isWord(c)&&chars(c).length>=2)NOUN.add(c);
for(const q of NEW[8].story)for(const c of q.choices)if(H.isWord(c)&&chars(c).length>=2)NOUN.add(c);
const JOSA=[['이','가'],['을','를'],['은','는'],['과','와'],['으로','로'],['이랑','랑'],['이나','나'],['이라고','라고']];
const josaBad=w=>{const out=[];for(const [withB,noB] of JOSA)for(const [p,needB] of [[withB,true],[noB,false]]){if(!w.endsWith(p)||w.length<=p.length)continue;const stem=w.slice(0,-p.length);if(!NOUN.has(stem))continue;const j=H.jong(Array.from(stem).pop());
  if(!(withB==='으로'?(needB?j>0&&j!==8:j===0||j===8):(needB?j>0:j===0)))out.push(stem+'+'+p)}return out};
const SUBJ=[...NOUN].filter(w=>/^(두리|솔이|하늘이|다온이|마루|나래|꼬꼬|병아리|늑대|오리|토끼|염소|다람쥐|고양이|강아지|부엉이|참새|사슴|너구리|거북이|개구리|돼지|여우|곰)$/.test(w)).sort((x,y)=>y.length-x.length);
const PN={'이':'가','가':'가','은':'는','는':'는','을':'를','를':'를','과':'와','와':'와','의':'의','에게':'에게'};
const unsubj=s=>String(s).split(/\s+/).map(w=>{for(const n of SUBJ)if(w.startsWith(n)){const r=w.slice(n.length),e=(r.match(/[.,?!]$/)||[''])[0],b=r.replace(/[.,?!]$/,'');return 'X'+(b in PN?PN[b]:b)+e}return w}).join(' ');
const bigr=s=>{const t=chars(String(s).replace(/[\s.,?!]/g,''));const o=new Set();for(let i=0;i+1<t.length;i++)o.add(t[i]+t[i+1]);return o};
const jac=(a,b)=>{let i=0;for(const x of a)if(b.has(x))i++;return i/(a.size+b.size-i||1)};
const fake=(q,k)=>Object.assign({},q,{id:q.id.replace(/-k78\d+$/,'-g'+String(900+k).padStart(3,'0'))});

/* 공통·수준 규칙(questions.js와 같은 함수) */
for(const age of [7,8])for(const mode of ['story','quiz'])NEW[age][mode].forEach((q,k)=>{
  const f=fake(q,k),e=mode==='quiz'?Q.checkQuiz(age,f):Q.checkCommon(f).concat(Q.checkLevel(age,mode,f));
  e.forEach(m=>F(q.id,m));
  for(const t of [q.passage,q.prompt,...q.choices,q.speak])if(isBad(String(t)))F(q.id,'부적절 낱말 '+t);
  spellBad(q).forEach(m=>F(q.id,'맞춤법 '+m));
  const bad=[];for(const t of [q.passage,q.prompt,...q.choices])for(const w0 of String(t).split(/\s+/)){const w=w0.replace(/[.,?!'"]/g,'');if(w&&!NOUN.has(w))bad.push(...josaBad(w))}
  if(bad.length)F(q.id,'조사 '+bad.join(','));
  if(mode==='quiz'){
    if(/[0-9A-Za-z]/.test(q.speak)||PIC.test(q.speak)||/[+−×÷=□<>%]/.test(q.speak)||!/[?.]$/.test(q.speak))F(q.id,'speak는 한글 문장(숫자·기호 없이, ?/.로 끝남) '+q.speak);
    if(PIC.test(q.prompt))F(q.id,'질문 글에 그림');
    for(const s of [q.passage,...q.choices])for(const c of s)if(PIC.test(c)&&!SAFE_PIC.has(c))F(q.id,'검수 목록 밖 그림 '+c);
    if(!q.passage.split('\n').every(l=>chars(l).filter(c=>PIC.test(c)).length<=4))F(q.id,'그림 한 줄 4개 초과');
    if(q.choices.some(c=>/[A-Za-z]/.test(c)))F(q.id,'7·8세 보기에 영문');
    if(age===7)for(const c of q.choices){if(PIC.test(c)||/^\d+$/.test(c))continue;if(!(H.isWord(c)&&chars(c).length<=3&&!chars(c).some(H.hasBatchim)))F(q.id,'7세 글자 보기는 받침 없는 1~3음절 낱말만(이 작업의 자체 규칙) '+c)}
  }
});
/* 7세 낱말 규칙(받침 없는 1~3음절): 이번에 7세 읽기(story) 문항은 더하지 않았다. 더했다면 여기서 모두 확인한다 */
for(const q of NEW[7].story){const w=H.isWord(q.passage)?q.passage:q.choices[q.answer];if(!(H.isWord(w)&&chars(w).length<=3&&!chars(w).some(H.hasBatchim)))F(q.id,'7세 낱말 규칙 위반 '+w)}
/* 8세 읽기: 정답은 지문에 그대로(뜻: 유형 면제), 지문 속 오답 하나 이상(글자 그대로), 질문 낱말, 고정관념 짝 */
const QW=/누가|누구|어디|어느|언제|몇|무슨 색|무엇/;
for(const q of NEW[8].story){
  const ans=q.choices[q.answer],wrong=q.choices.filter((_,i)=>i!==q.answer),n=H.compactLength(q.passage);
  if(!/^뜻:/.test(q.note)&&!q.passage.includes(ans))F(q.id,'정답이 지문에 그대로 없음(뜻: 유형이 아님) '+ans);
  if(/^뜻:/.test(q.note)&&q.passage.includes(ans))W(q.id,'뜻: 유형인데 정답이 지문에 그대로 있음 '+ans);
  if(!wrong.some(c=>q.passage.includes(c)))F(q.id,'지문에 그대로 있는 오답 없음');
  if(!QW.test(q.prompt))F(q.id,'질문 낱말(누가·누구·어디·어느·언제·몇·무슨 색·무엇) 없음');
  if(q.prompt.includes(ans))F(q.id,'질문에 정답');
  const w=words8(q.passage);for(const [x,y] of BAN8)if(w.includes(x)&&w.includes(y))F(q.id,'고정관념 짝 '+x+'-'+y);
  for(const [x,y] of SAME)if(q.choices.includes(x)&&q.choices.includes(y))F(q.id,'같은 뜻 보기 '+x+'·'+y);
  if(/(형|언니|누나|오빠)보다/.test(q.passage)&&q.choices.includes('동생'))F(q.id,'손위 형제 문장에 동생 오답');
  if(n<10||n>20)F(q.id,'길이 '+n);
}
/* 중복: 같은 지문·질문, 나이 사이 같은 지문, 주어만 다른 문항, 이름·동물만 다른 지문, 거의 같은 글 */
{const oldStory=[];for(const a of Q.AGES)oldStory.push(...snap[a].story);
 const passOwner=new Map(oldStory.map(q=>[q.passage,q]));
 const key8=new Map(),pass8=new Map();
 for(const q of snap[8].story){key8.set(unsubj(q.passage)+'|'+unsubj(q.prompt)+'|'+q.choices[q.answer],q.id);if(!pass8.has(unsubj(q.passage)))pass8.set(unsubj(q.passage),q)}
 const seen=new Set();
 for(const q of NEW[8].story){
   const o=passOwner.get(q.passage);if(o&&(o.age!==8||o.prompt===q.prompt))F(q.id,'지문이 기존 '+o.id+'와 같음');
   const k=q.passage+'\n'+q.prompt;if(seen.has(k))F(q.id,'새 문항끼리 같은 지문·질문');seen.add(k);
   const ks=unsubj(q.passage)+'|'+unsubj(q.prompt)+'|'+q.choices[q.answer];if(key8.has(ks))F(q.id,'주어만 다른 같은 문항 '+key8.get(ks));key8.set(ks,q.id);
   const kp=unsubj(q.passage),pp=pass8.get(kp);if(pp&&pp.passage!==q.passage)F(q.id,'이름·동물만 다른 지문 '+pp.id);if(!pp)pass8.set(kp,q);
 }
 /* 거의 같은 글: 글자 두 자 묶음 겹침(자카드)이 0.6 이상이면 사람이 다시 봄(목록으로 남김), 0.8 이상은 실패 */
 const pool=snap[8].story.map(q=>({id:q.id,t:q.passage,b:bigr(q.passage)}));
 for(const q of NEW[8].story){const b=bigr(q.passage);let best=null;for(const o of pool){if(o.id===q.id)continue;const s=jac(b,o.b);if(!best||s>best.s)best={s,o}}
   if(best&&best.s>=.8)F(q.id,'거의 같은 지문 '+best.o.id+' ('+best.s.toFixed(2)+') '+best.o.t);else if(best&&best.s>=.6)W(q.id,'비슷한 지문 '+best.o.id+' ('+best.s.toFixed(2)+') '+q.passage+' ~ '+best.o.t);
   pool.push({id:q.id,t:q.passage,b});}
 /* 퀴즈: 같은 나이·다른 나이 모두 (질문, 지문)이 같으면 실패, 같은 나이에서 정답·보기 묶음이 같으면(7세 상식) 실패, 질문 글이 거의 같으면 목록 */
 const qkey=new Map();for(const a of Q.AGES)for(const q of snap[a].quiz)qkey.set(q.prompt+'\n'+q.passage,q.id);
 for(const a of [7,8]){
   const bag=new Map();for(const q of snap[a].quiz)if(q.cat==='common')bag.set(q.choices[q.answer]+'|'+q.choices.slice().sort().join(','),q.id);
   const pr=snap[a].quiz.filter(q=>q.cat==='common').map(q=>({id:q.id,t:q.prompt+q.passage,b:bigr(q.prompt+q.passage),ans:q.choices[q.answer]}));
   for(const q of NEW[a].quiz){
     const k=q.prompt+'\n'+q.passage;if(qkey.has(k))F(q.id,'질문·지문이 기존 '+qkey.get(k)+'와 같음');qkey.set(k,q.id);
     if(q.cat!=='common')continue;
     const kb=q.choices[q.answer]+'|'+q.choices.slice().sort().join(',');if(bag.has(kb))F(q.id,'정답·보기 묶음이 '+bag.get(kb)+'와 같음');bag.set(kb,q.id);
     const b=bigr(q.prompt+q.passage);for(const o of pr){const s=jac(b,o.b);if(s>=.6&&o.ans===q.choices[q.answer])W(q.id,'비슷한 상식(정답 같음) '+o.id+' ('+s.toFixed(2)+') '+q.prompt+' ~ '+o.t)}
     pr.push({id:q.id,t:q.prompt+q.passage,b,ans:q.choices[q.answer]});
   }
 }
 /* 다른 나이 상식과 정답 글이 같고 질문이 비슷하면 목록(나이 사이 같은 퀴즈 줄이기) */
 for(const a of [7,8])for(const q of NEW[a].quiz.filter(q=>q.cat==='common'))for(const b of Q.AGES)if(b!==a)for(const o of snap[b].quiz.filter(o=>o.cat==='common')){const s=jac(bigr(q.prompt),bigr(o.prompt));if(s>=.7)W(q.id,'다른 나이와 비슷한 상식 '+o.id+' ('+s.toFixed(2)+') '+q.prompt+' ~ '+o.prompt)}
}
/* 수학: 정답 다시 계산(test-questions.cjs와 같은 방식), 같은 틀·같은 수, 8세 정답·보기 묶음 */
const picValue=p=>{let t=0,op='+';for(const tok of p.split(/\s+/)){if(tok==='+'||tok==='−'){op=tok;continue}const g=[...tok];if(!g.every(c=>PIC.test(c)))return NaN;t+=op==='+'?g.length:-g.length;op='+'}return t};
for(const a of [7,8]){
  const oldM=snap[a].quiz.filter(q=>q.cat==='math'),key=new Map(),bag=new Map();
  const mk=q=>{const n=(q.passage+' '+q.prompt).match(/\d+/g);return n?q.passage.replace(/\d+/g,'n')+'|'+q.prompt.replace(/\d+/g,'n')+'|'+n.slice().sort().join(','):null};
  for(const q of oldM){const k=mk(q);if(k)key.set(k,q.id);bag.set(q.choices[q.answer]+'|'+q.choices.slice().sort().join(','),q.id)}
  for(const q of NEW[a].quiz.filter(q=>q.cat==='math')){
    const ans=q.choices[q.answer];let want;const ex=q.passage.match(/^(\d+) ([+−]) (\d+)$/);let m;
    if(ex)want=String(ex[2]==='+'?+ex[1]+ +ex[3]:ex[1]-ex[3]);
    else if((m=q.passage.match(/^(\d+) \+ (\d+) \+ (\d+)$/)))want=String(+m[1]+ +m[2]+ +m[3]);
    else if((m=q.passage.match(/^(\d+) \+ □ = (\d+)$/)))want=String(m[2]-m[1]);
    else if((m=q.passage.match(/^(\d+) − □ = (\d+)$/)))want=String(m[1]-m[2]);
    else if((m=q.passage.match(/^(\d+), (\d+), (\d+), □$/)))want=String(2*m[3]-m[2]);
    else if((m=q.passage.match(/^□, (\d+), (\d+)$/)))want=String(2*m[1]-m[2]);
    else if((m=q.passage.match(/^(\d+), □, (\d+)$/))){want=String((+m[1]+ +m[2])/2);if(m[2]-m[1]!==2)F(q.id,'사이의 수는 하나')}
    else if((m=q.prompt.match(/^가장 (큰|작은) 수는\?$/))){const v=q.passage.split(', ').map(Number);want=String(m[1]==='큰'?Math.max(...v):Math.min(...v));if(v.slice().sort().join()!==q.choices.map(Number).sort().join())F(q.id,'보기 = 지문의 수')}
    else if(q.prompt==='다음에 올 것은?'){const e=chars(q.passage);for(const per of [2,3])if(want===undefined&&e.every((x,i)=>i<per||x===e[i-per]))want=e[4-per]}
    else if((m=q.prompt.match(/^([\d, ]+) 중 (짝수|홀수)는\?$/))){const v=m[1].split(', ').map(Number),s=v.filter(x=>x%2===(m[2]==='짝수'?0:1));want=s.length===1?String(s[0]):'여럿'}
    else if((m=q.prompt.match(/^10개씩 묶음 (\d)개와 낱개 (\d)개는 어떤 수일까요\?$/)))want=String(10*m[1]+ +m[2]);
    else if(q.passage&&!Number.isNaN(picValue(q.passage)))want=String(picValue(q.passage));
    if(want!==ans)F(q.id,'수학 정답 다시 계산 '+want+' ≠ '+ans);
    if(new Set(q.choices.map(c=>Number.isNaN(Number(c))?c:Number(c))).size!==q.choices.length)F(q.id,'같은 값 보기');
    if(/가장 (큰|작은)/.test(q.prompt)&&mono(q.choices.map(Number)))F(q.id,'가장 큰·작은 수 보기가 크기순');
    const k=mk(q);if(k){if(key.has(k))F(q.id,'수만 자리를 바꾼 같은 수학 '+key.get(k));key.set(k,q.id)}
    if(a===8){const b=ans+'|'+q.choices.slice().sort().join(',');if(bag.has(b))F(q.id,'정답·보기 묶음이 '+bag.get(b)+'와 같음');bag.set(b,q.id)}
    if(a===7&&ex&&+ex[1]>10)F(q.id,'7세 식은 10 이하');
  }
}
/* 7세 수학 틀 쏠림(합친 뒤 생성 수학 중 한 틀 25% 이하) */
{const gm=GEN[7].quiz.filter(q=>q.cat==='math').concat(NEW[7].quiz.filter(q=>q.cat==='math')),kind=q=>q.passage.match(/^\d+ ([+−×÷]) \d+$/)?q.passage.replace(/\d+/g,'n')+':'+q.passage.split(' ')[0].length+'x'+q.passage.split(' ')[2].length:q.prompt.replace(/[\d,.]+/g,'n').slice(0,12);
 for(const [a,list] of [[7,gm],[8,GEN[8].quiz.filter(q=>q.cat==='math').concat(NEW[8].quiz.filter(q=>q.cat==='math'))]]){const t={};list.forEach(q=>{t[kind(q)]=(t[kind(q)]||0)+1});for(const [k,v] of Object.entries(t))if(v>list.length/4)F(a+'세 수학','틀 쏠림 '+k+' '+v+'/'+list.length);if(a===7)console.log('7세 생성 수학 틀(합친 뒤):',JSON.stringify(t))}}
/* 8세 읽기 틀: 합친 뒤 한 틀 15% 이하, 질문 낱말 고르게 */
{const all8=GEN[8].story.concat(NEW[8].story),t={};all8.forEach(q=>{t[q.note]=(t[q.note]||0)+1});for(const [k,v] of Object.entries(t))if(v>all8.length*.15)F('8세 읽기','틀 쏠림 '+k+' '+v);
 const nt={};NEW[8].story.forEach(q=>{nt[q.note]=(nt[q.note]||0)+1});console.log('8세 새 읽기 틀:',JSON.stringify(nt))}

/* ---------- 쓰기·보고 ---------- */
const out={story:NEW[8].story,quiz:NEW[7].quiz.concat(NEW[8].quiz)};
fs.writeFileSync(OUT,'{"story":[\n'+out.story.map(q=>JSON.stringify(q)).join(',\n')+'\n],\n"quiz":[\n'+out.quiz.map(q=>JSON.stringify(q)).join(',\n')+'\n]}\n');
const cnt=(l,f)=>l.filter(f).length;
console.log('새 문항: 7세 퀴즈 '+NEW[7].quiz.length+'(상식 '+cnt(NEW[7].quiz,q=>q.cat==='common')+', 수학 '+cnt(NEW[7].quiz,q=>q.cat==='math')+') · 8세 읽기 '+NEW[8].story.length+' · 8세 퀴즈 '+NEW[8].quiz.length+'(상식 '+cnt(NEW[8].quiz,q=>q.cat==='common')+', 수학 '+cnt(NEW[8].quiz,q=>q.cat==='math')+')');
console.log('정답 자리(기존 생성 + 새): 7세 퀴즈 '+T.a7quiz.join('/')+' · 8세 읽기 '+T.a8story.join('/')+' · 8세 퀴즈 '+T.a8quiz.join('/'));
for(const a of [7,8]){const s=Q.count(a,'story')+NEW[a].story.length,z=Q.quizCount(a)+NEW[a].quiz.length;console.log(a+'세 합친 뒤: 읽기 '+s+' + 퀴즈 '+z+' = '+(s+z))}
console.log('초안: '+path.relative(ROOT,OUT));
if(warn.length){console.log('\n사람이 다시 볼 것('+warn.length+'):');warn.forEach(m=>console.log(' ~ '+m))}
if(fail.length){console.log('\n실패('+fail.length+'):');fail.forEach(m=>console.log(' x '+m));process.exit(1)}
console.log('\n검사 통과(실패 0)');

/* ---------- 저장소 사본에 붙여 test-questions.cjs 돌리기 ---------- */
if(args.includes('--merge')){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'bank78-'));
  for(const f of ['questions.js','questions-gen.js','test-questions.cjs','scripts/bank-add.cjs']){fs.mkdirSync(path.dirname(path.join(tmp,f)),{recursive:true});fs.copyFileSync(path.join(ROOT,f),path.join(tmp,f))}
  const r=cp.execFileSync(process.execPath,[path.join(tmp,'scripts','bank-add.cjs'),OUT],{cwd:tmp,encoding:'utf8'});
  process.stdout.write('\n[bank-add] '+r);
  const line=(r.match(/BANK_PRINT에 더할 줄 →\s+(\d+:\{.*\}),/)||[])[1];if(!line)throw new Error('지문 줄을 못 찾음');
  const tf=path.join(tmp,'test-questions.cjs'),src=fs.readFileSync(tf,'utf8'),eol=src.includes('\r\n')?'\r\n':'\n';
  const at=src.indexOf(eol+' };',src.indexOf('const BANK_PRINT={'));fs.writeFileSync(tf,src.slice(0,at)+','+eol+'  '+line+src.slice(at));
  try{process.stdout.write('[test-questions 사본] '+cp.execFileSync(process.execPath,[tf],{cwd:tmp,encoding:'utf8',maxBuffer:1<<26}))}
  catch(e){console.log('[test-questions 사본] 실패\n'+String(e.stdout||'').slice(-3000)+String(e.stderr||'').slice(0,3000));process.exitCode=1}
  if(args.includes('--keep'))console.log('임시 폴더: '+tmp);else fs.rmSync(tmp,{recursive:true,force:true});
}
