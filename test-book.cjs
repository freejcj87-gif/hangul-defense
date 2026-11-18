/* node test-book.cjs : 발자국 수첩 MVP 1단계 검사(브라우저 없음).
   A. 콘텐츠(notes.js): 몬스터 카드 8종 · 쪽지 문항 64 · 영어 이름 문항 48 — 기존 문제은행 검사 규칙(나이 수준·맞춤법·조사·금지 낱말)을 그대로 적용
   B. 기록 모듈(book.js): 아래 'B.' 절부터
   SOFT=1 이면 첫 실패에서 멈추지 않고 모아 보여 준다. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Q=require('./questions.js'),C=require('./combat.js'),W=require('./world.js'),N=require('./notes.js');
const SOFT=!!process.env.SOFT,fails=[];
let n=0;
const run=(fn,m)=>{n++;try{fn()}catch(e){if(!SOFT)throw e;fails.push(String(m||e.message))}};
const ok=(v,m)=>run(()=>assert.ok(v,m),m),eq=(a,b,m)=>run(()=>assert.deepEqual(a,b,m),m);
process.on('exit',()=>{if(fails.length)console.log(fails.map((f,i)=>(i+1)+'. '+f).join('\n')+'\nFAIL '+fails.length)});
const H=Q.hangul,chars=s=>Array.from(String(s));
const bankStory=a=>Array.from({length:Q.count(a,'story')},(_,i)=>Q.get(a,'story',i));
const bankQuiz=a=>Array.from({length:Q.quizCount(a)},(_,i)=>Q.quiz(a,i));

/* ======================= A. 콘텐츠 ======================= */
/* A-1 몬스터 카드 정보 */
eq(N.KINDS,['wolf','bramble','boar','granite','frost','ember','fox','king'],'몬스터 8종 키');
eq(Object.keys(N.MON),N.KINDS,'카드 정보 8종');
for(const k of Object.keys(W.KINDS))eq(N.MON[k].name,W.KINDS[k].name,k+': 종 이름은 게임 띠(World.KINDS)와 같음');
eq([N.MON.fox.name,N.MON.king.name],['도둑 여우','늑대 왕'],'여우·왕 종 이름');
eq(N.KINDS.map(k=>N.MON[k].nick),['누리','보리','두부','도리','유리','호야','라미','우두'],'개인 이름(프로듀서 결정 초안)');
eq(N.KINDS.map(k=>N.MON[k].en),['Wolf','Bush Wolf','Wild Boar','Rock Wolf','Frost Wolf','Fire King','Fox','Wolf King'],'영어 이름(서리 = Frost: 한글 이름의 뜻과 어긋나지 않게)');
eq([N.ALT.boar.nick.length,N.ALT.king.nick.length],[2,2],'두부·우두 대체 이름 후보 2개씩');
for(const k of ['boar','king'])for(const w of N.ALT[k].nick)ok(H.isWord(w)&&chars(w).length===2&&!chars(w).some(H.hasBatchim)&&!N.KINDS.some(x=>N.MON[x].nick===w),k+' 대체 이름 '+w+': 받침 없는 두 글자, 다른 이름과 다름');
for(const k of N.KINDS){const m=N.MON[k];
  ok(H.isWord(m.nick)&&chars(m.nick).length===2&&!chars(m.nick).some(H.hasBatchim),k+': 개인 이름은 받침 없는 두 글자');
  ok(!/shiny/i.test(m.en)&&/^[A-Z][a-z]+( [A-Z][a-z]+)?$/.test(m.en),k+': 영어 이름은 쉬운 낱말 1~2개, Shiny 표기 없음');
  ok(typeof m.line==='string'&&H.sentences(m.line)===1&&H.compactLength(m.line)<=20,k+': 한 줄 소개는 한 문장 20자 이하');
}
eq(new Set(N.KINDS.map(k=>N.MON[k].nick)).size,8,'개인 이름이 서로 다름');

/* A-2 쪽지 문항 64 */
const notes=N.all();
eq([notes.length,N.count],[64,64],'쪽지 문항 64개');
const WANT={7:3,8:3,9:4,10:5};
const READ_PIC=new Set(['🐶','🐮','🐦','🦀','🦊','🦆','🐰','🐷','🦁','🐘','🐳','🕷️','🐜','🦋','🐸','🦐','🍎','🍌','🍇','🍅','🥒','🍠','🍒','🥝','🌶️','🍆','🥛','🍕','🧀','🍪','🍰','🍖',
  '🌳','☀️','🌧️','🌊','🌈','🌍','🎄','🚂','🚌','🚢','🚗','👖','👞','👕','👗','👢','✂️','⏰','🎹','🎸','🎲','📏','📷','🎤','🕯️','🛋️','🗺️','⚾','🎿','🚿','❤️','🔺','⬛','➕','➖','👃','👂','👅','👶']);
const HAND_PIC=new Set([...'🌳🦋🍄🍌🍎🍇🥕🦆🥒🍓🍉🍑🍋🌽🍠🐝🐞🐻🦊🐰👟👕👖🚂🚌🚲🍞🥛🧀🍰🍪🍕🐔🦉🌈🌊🌙🍒🍅🐜🐌🐛']);
const keyOf=q=>q.passage+'\n'+q.prompt+(q.age===7?'\n'+q.choices.slice().sort().join('|'):'');
const soleLong=q=>{const L=q.choices.map(c=>H.compactLength(c)),mx=Math.max(...L);return L[q.answer]===mx&&L.filter(v=>v===mx).length===1};
const PART=/(에서|에게|으로|이에요|예요|은|는|이|가|을|를|에|의|와|과|로|도)$/;
const stemOf=w=>{const s=w.replace(/[^가-힣]/g,''),t=s.replace(PART,'');return t||s};
const inText=(c,p)=>p.includes(c)||p.split(/\s+/).map(stemOf).includes(stemOf(c.split(/\s+/)[0]));
const seenId=new Set(),seenKey=new Set();
for(const a of N.AGES)for(const k of N.KINDS)for(const i of [1,2]){
  const id='a'+a+'-note-'+k+'-'+i,q=N.get(a,k,i);
  ok(q&&q.id===id,id+' 있음');if(!q)continue;
  eq(Object.keys(q),['id','age','mode','kind','prompt','passage','speak','choices','answer','card'],id+' 키');
  eq([q.age,q.mode,q.kind],[a,'story',k],id+' age/mode/kind');
  eq(N.byId(id),q,id+' byId');
  ok(!seenId.has(id),id+' id 유일');seenId.add(id);
  eq(q.speak,q.passage,id+' speak=passage');
  eq(q.choices.length,WANT[a],id+' 보기 수');
  eq(new Set(q.choices).size,q.choices.length,id+' 보기 중복 없음');
  ok(Number.isInteger(q.answer)&&q.answer>=0&&q.answer<q.choices.length,id+' answer 범위');
  eq(Q.checkLevel(a,'story',q),[],id+' 나이 수준 규칙(Questions.checkLevel)');
  ok(!seenKey.has(a+keyOf(q)),id+' 쪽지끼리 중복 없음');seenKey.add(a+keyOf(q));
  ok(typeof q.card==='string'&&H.sentences(q.card)===1&&q.card.includes(N.MON[k].nick)&&H.compactLength(q.card)<=30,id+' 카드 한 줄(한 문장, 개인 이름 포함) '+q.card);
  ok(!/\r/.test(q.passage),id+' 줄바꿈은 \\n');
  if(a===7){
    ok(H.isWord(q.passage)&&chars(q.passage).length<=3&&!chars(q.passage).some(H.hasBatchim),id+' 7세: 받침 없는 1~3음절');
    q.choices.forEach(c=>ok(READ_PIC.has(c)||HAND_PIC.has(c),id+' 7세: 검수한 그림 '+c));
    eq(q.prompt,Q.get(7,'story',0).prompt,id+' 7세 공통 질문');
    eq(q.card,N.MON[k].nick+'는 '+q.passage+'를 좋아해요.',id+' 7세 카드 문구');
  }else{
    const ans=q.choices[q.answer];
    ok(q.choices.some((c,j)=>j!==q.answer&&inText(c,q.passage)),id+' 오답 하나 이상이 지문에 나옴');
    ok(q.passage.includes(N.MON[k].nick),id+' 지문에 개인 이름');
    if(a===8){ok(q.passage.includes(ans),id+' 8세 정답은 지문에 그대로');ok(!q.prompt.includes(ans),id+' 8세 질문에 정답 없음')}
    const lines=q.passage.split('\n');
    eq(lines.length,H.sentences(q.passage),id+' 한 줄에 한 문장');
    if(a===9)ok(lines.every(t=>H.compactLength(t)<=30),id+' 9세 문장 길이 '+lines.map(t=>H.compactLength(t)).join('/'));
    if(a===10){ok(lines.every(t=>H.compactLength(t)<=36),id+' 10세 문장 길이 '+lines.map(t=>H.compactLength(t)).join('/'));ok(H.syllables(q.passage)<=90,id+' 10세 지문 90음절 이하('+H.syllables(q.passage)+')')}
  }
}
ok(N.get(6,'wolf',1)===null&&N.get(8,'dragon',1)===null&&N.byId('x')===null,'없는 나이·종·id는 null');
{const q=N.get(8,'wolf',1);q.choices.push('오염');q.passage='x';ok(N.get(8,'wolf',1).choices.length===3&&N.get(8,'wolf',1).passage!=='x','get은 복사본(은행 오염 없음)')}
/* 정답 자리: 나이별 16문항에서 한 자리 50% 이하·모든 자리 사용·3연속 없음, 9·10세 정답=혼자 가장 긴 보기 과다 금지 */
for(const a of N.AGES){
  const list=notes.filter(q=>q.age===a),pos=list.map(q=>q.answer),t={};pos.forEach(p=>t[p]=(t[p]||0)+1);
  eq(list.length,16,a+'세 쪽지 16문항');
  ok(Object.values(t).every(c=>c*2<=pos.length)&&Object.keys(t).length===WANT[a],a+'세 쪽지 정답 자리 고름 '+JSON.stringify(t));
  ok(pos.every((v,i)=>i<2||!(v===pos[i-1]&&v===pos[i-2])),a+'세 쪽지 정답 자리 3연속 없음');
  if(a>=9){const s=list.filter(soleLong);ok(s.length<=list.length*(1/WANT[a]+.1),a+'세 쪽지: 정답=가장 긴 보기 '+s.length+'/'+list.length+' '+s.map(q=>q.id).join(','))}
}
/* 은행과 겹치지 않음: 같은 (지문, 질문[, 7세 보기]) 없음, 8~10세 지문은 은행 어느 나이에도 없음, 7세 낱말의 그림은 은행과 같은 그림 */
{const keys=new Set(),passages=new Set(),pic7=new Map();
 for(const a of Q.AGES)for(const q of bankStory(a)){keys.add(a+keyOf(q));if(a>7)passages.add(q.passage);else if(H.isWord(q.passage))pic7.set(q.passage,q.choices[q.answer])}
 for(const q of notes){ok(!keys.has(q.age+keyOf(q)),q.id+' 은행 문항과 겹치지 않음');if(q.age>7)ok(!passages.has(q.passage),q.id+' 지문이 은행에 없음');
   else if(pic7.has(q.passage))eq(q.choices[q.answer],pic7.get(q.passage),q.id+' 7세 낱말의 그림이 은행과 같음')}
 const w7=notes.filter(q=>q.age===7).map(q=>q.passage);eq(new Set(w7).size,16,'7세 쪽지 낱말 16개가 서로 다름');
}
/* 맞춤법·띄어쓰기·조사·금지 낱말: test-questions.cjs 9-2·9-3과 같은 규칙(개인 이름을 낱말 목록에 더함) */
const BAD_SUB=['씨발','시발','시바','개새','새끼','병신','지랄','좆','존나','졸라','썅','염병','니미','엠창','꺼져','닥쳐','죽어','죽여','죽음','죽이','살인','자살','섹스','마약','똥꼬','젖꼭','성기','강간','폭탄','전쟁','총알','귀신','악마',
  '지옥','변태','멍청','등신','찐따','미친','또라이','개같','개똥','엿먹','보지','자지','애미','애비','조또','씹','쌍놈','빠구리'];
const BAD_WHOLE=['년','놈','뇬','똥','바보','피','칼','총','술','담배','독','뼈','시체','무덤','도끼','코피','방귀','오줌','거지','고자','사기','뒤지','소피','아비','제모'];
const isBad=t=>BAD_SUB.some(b=>t.includes(b))||t.split(/[\s,.?!]+/).some(w=>BAD_WHOLE.includes(w));
const SPELL=[[/되요|되서|안되|않되/,'되/돼'],[/몇일/,'며칠'],[/어떻해/,'어떡해'],[/금새/,'금세'],[/[할볼줄]께/,'ㄹ게'],[/깨끗히|일일히|곰곰히|틈틈히|번번히|따뜻히|솔직이|꼼꼼이|가만이/,'-이/-히'],[/오랫만/,'오랜만'],[/뵈요/,'봬요'],[/윗층|윗쪽/,'위층·위쪽'],[/아니예요/,'아니에요'],
  [/[가-힣]수있|[을를] 수있|[가-힣]것같/,'수 있·것 같 띄어쓰기'],[/밀어 내|끌어 당|빨아 들|올라 가|내려 가|뛰어 가|걸어 가|달려 가|날아 다|들려 주|가져다 주|데려다 주|도와 주/,'한 낱말을 띄어 씀'],[/ {2,}/,'공백 두 칸'],[/ [.,?!]/,'문장부호 앞 공백'],[/[가-힣][.?!][가-힣]/,'문장부호 뒤 공백 없음']];
const spellBad=texts=>{const out=[];for(const t of texts){const s=String(t).replace(/\n/g,' ');for(const [re,why] of SPELL)if(re.test(s))out.push(why+': '+s);
  for(const m of s.matchAll(/([가-힣])(이에요|예요)/g)){const b=H.hasBatchim(m[1]);if(m[2]==='예요'?b&&m[1]!=='이':!b)out.push('예요/이에요: '+m[0])}}return out};
const NOUN=new Set(['곰','집','밭','공','컵','연','빵','떡','감','밤','죽','꽃','책','형','귤','콩','춤','붓','숲','강','산','문','종','꼬꼬','병아리','늑대','오리','토끼','염소','다람쥐','고양이','강아지','부엉이','참새','사슴','너구리','거북이','개구리','돼지','여우',
  '멧돼지','덤불','바위','방패','불씨','왕','서리','눈밭','통나무','꼬리','닭장','마을','언덕','달',...N.KINDS.map(k=>N.MON[k].nick)]);
for(const a of [8,9,10])for(const q of bankStory(a))for(const c of q.choices)if(H.isWord(c)&&chars(c).length>=2)NOUN.add(c);
const JOSA=[['이','가'],['을','를'],['은','는'],['과','와'],['으로','로'],['이랑','랑'],['이나','나'],['이라고','라고']];
const josaBad=w=>{const out=[];for(const [withB,noB] of JOSA)for(const [p,needB] of [[withB,true],[noB,false]]){if(!w.endsWith(p)||w.length<=p.length)continue;const stem=w.slice(0,-p.length);if(!NOUN.has(stem))continue;const j=H.jong(Array.from(stem).pop());
  if(!(withB==='으로'?(needB?j>0&&j!==8:j===0||j===8):(needB?j>0:j===0)))out.push(stem+'+'+p)}return out};
const lint=(id,texts)=>{
  ok(!texts.some(isBad),id+': 부적절 낱말 없음');
  const sp=spellBad(texts);ok(!sp.length,id+': 맞춤법·띄어쓰기 '+sp.join(' / '));
  const bad=[];for(const t of texts)for(const w0 of String(t).split(/\s+/)){const w=w0.replace(/[.,?!'"]/g,'');if(w&&!NOUN.has(w))bad.push(...josaBad(w))}
  ok(!bad.length,id+': 조사 '+bad.join(','));
};
ok(spellBad(['같은 극끼리는 서로 밀어 내고','몇일이 되요?','책예요']).length===4&&josaBad('누리이').length&&josaBad('보리을').length&&josaBad('왕를').length&&!josaBad('누리가').length&&!josaBad('왕을').length&&isBad('바보 늑대')&&!isBad('누리는 노래해요.'),'검사 규칙 자체(맞춤법·조사·금지 낱말)');
for(const q of notes)lint(q.id,[q.passage,q.prompt,q.card,...q.choices]);
for(const k of N.KINDS)lint('카드 '+k,[N.MON[k].name,N.MON[k].line]);

/* A-3 영어 이름 문항 48: 평소 영어 퀴즈 묶음에 붙일 문항. 임시 id를 달아 기존 퀴즈 규칙(Questions.checkQuiz)과 내용 검수 규칙으로 본다 */
const PIC=/\p{Extended_Pictographic}/u;
const SAFE_PIC=new Set([...'🌙🌞🌈🍎🎈⛄☔🐶🍓⭐✋🐱🐰🐥🐔🐘🐟🍪🥚🐦🐢🐷👂👃👀🐞🦋🐝🚗🚲🚢🔴🐯'+'💙💜💛🌸🍉❄🚶🛑🏃🍌🥛🍰🔵⚫🍇🔺⬛'+'🐮🐴🐵🐻🦁🦊🦆🍞🥕🥔🍬🍖📕🎒⚽✏🔑☂🚪🛏📱📦✂🥄👟🌳🌧☁⛰🌊🔥👁👄🚂✈👶🏠🚌🍕']);
const PENDING_PIC=new Set([...'🐺👑🐗🌿']);/* 실기기 표시 확인 뒤 test-questions.cjs SAFE_PIC에 더할 그림(연결 단계 할 일) */
const HYPER={bird:['duck','chicken','owl','chick','swan'],fruit:['apple','grape','banana','strawberry','cherry','peach'],animal:['dog','cat','cow','pig','duck','bear','lion','tiger','fox','horse','monkey','rabbit'],vegetable:['potato','carrot','onion'],color:['red','blue','yellow','green','black','white','pink','brown']};
const ECOUNT={7:8,8:8,9:16,10:16};let etotal=0;const usedPending=new Set();
for(const a of N.AGES){
  const list=N.english(a),have=new Set(bankQuiz(a).map(q=>q.prompt+'\n'+q.passage)),mine=new Set();
  eq(list.length,ECOUNT[a],a+'세 영어 이름 문항 수');etotal+=list.length;
  list.forEach((q,i)=>{
    const id='영어 이름 '+a+'세 #'+(i+1)+' '+q.passage;
    eq(Object.keys(q),['age','mode','cat','prompt','passage','speak','choices','answer','note','level'],id+' 키(생성 문항 형식에서 id만 뺌)');
    eq([q.age,q.mode,q.cat],[a,'quiz','english'],id+' age/mode/cat');
    eq(Q.checkQuiz(a,Object.assign({id:'a'+a+'-quiz-g'+String(900+i)},q)),[],id+' 퀴즈 규칙(Questions.checkQuiz)');
    const k=q.prompt+'\n'+q.passage;ok(!have.has(k)&&!mine.has(k),id+' 질문·지문이 은행·서로와 겹치지 않음');mine.add(k);
    ok(!/[0-9A-Za-z]/.test(q.speak)&&!PIC.test(q.speak)&&/[?.]$/.test(q.speak),id+' speak는 한글 문장');
    ok(!PIC.test(q.prompt),id+' 질문 글에 그림 문자 없음');
    for(const s of [q.passage,...q.choices])for(const c of s)if(PIC.test(c)){ok(SAFE_PIC.has(c)||PENDING_PIC.has(c),id+' 그림 '+c);if(PENDING_PIC.has(c))usedPending.add(c)}
    eq(new Set(q.choices.map(c=>/[.?!]$/.test(c)?c.slice(-1):'')).size,1,id+' 보기 끝 문장부호 통일');
    const latin=q.choices.filter(c=>/[A-Za-z]/.test(c));
    if(latin.length){eq(latin.length,q.choices.length,id+' 영문 보기는 모두 영문');eq(new Set(latin.map(c=>c[0]===c[0].toUpperCase())).size,1,id+' 영문 보기 대소문자 통일')}
    if(a<=8)ok(!latin.length,id+' 7·8세 영어 보기에 영문 없음');
    const ans=q.choices[q.answer];for(const [h,kids] of Object.entries(HYPER))if(kids.includes(ans))ok(!q.choices.includes(h),id+' 정답의 상위어가 오답에 없음');
    ok(!/shiny/i.test(q.passage+q.choices.join(' ')),id+' Shiny 표기 없음');
    lint(id,[q.prompt,/[가-힣]/.test(q.passage)?q.passage.replace(/^[a-z]+ /,''):'',...q.choices.filter(c=>/[가-힣]/.test(c))]);
    ok([1,2].includes(q.level)&&q.note==='영어 이름',id+' level·note');
  });
  const pos=list.map(q=>q.answer),t={};pos.forEach(p=>t[p]=(t[p]||0)+1);
  ok(Object.values(t).every(c=>c*2<=pos.length)&&pos.every((v,i)=>i<2||!(v===pos[i-1]&&v===pos[i-2])),a+'세 영어 이름 정답 자리 '+JSON.stringify(t));
  /* 이름을 이루는 낱말 8개가 모두 나옴 */
  const text=list.map(q=>q.passage+' '+q.choices[q.answer]).join(' ').toLowerCase();
  for(const w of ['wolf','fox','frost','fire','king','boar','bush','rock'])ok(text.includes(w),a+'세 영어 이름 낱말 '+w);
}
eq(etotal,48,'영어 이름 문항 48개');
eq([...usedPending].sort(),[...PENDING_PIC].sort(),'검수 대기 그림 목록 = 실제로 쓴 새 그림(🐺👑🐗🌿)');
{const win={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'notes.js'),'utf8'),{window:win});
 ok(win.NOTES&&win.NOTES.count===64&&JSON.stringify(win.NOTES.all())===JSON.stringify(N.all()),'브라우저에서는 window.NOTES(node와 같은 데이터)');
 const buf=fs.readFileSync(path.join(__dirname,'notes.js'));ok(!(buf[0]===0xEF&&buf[1]===0xBB)&&!buf.toString('utf8').includes('�'),'notes.js BOM·깨짐 없음')}
const A_COUNT=n;

/* ======================= B. 기록 모듈(book.js) ======================= */
const B=require('./book.js'),K=B.BOOK;
const T=Date.UTC(2026,10,18,3),MIN=60000,HOURMS=3600000,DAY=86400000;/* 2026-11-18 12:00 KST */
const clone=o=>JSON.parse(JSON.stringify(o));
const BANKQ=new Map();for(const a of Q.AGES){for(const q of bankStory(a))BANKQ.set(q.id,q);for(const q of bankQuiz(a))BANKQ.set(q.id,q)}
const byId=id=>BANKQ.has(id)?clone(BANKQ.get(id)):null,knows=id=>BANKQ.has(id)||!!N.byId(id);
const story=(a,i)=>Q.get(a,'story',i),eng=a=>bankQuiz(a).find(q=>q.cat==='english'),math=a=>bankQuiz(a).find(q=>q.cat==='math');
const ctxOf=(o)=>Object.assign({age:8,index:0,run:1,finale:false,noteOf:N.get,byId},o||{});
const mk=seed=>B.fresh(T,seed===undefined?777:seed);
/* 평소 문제 n개를 한 번에 맞힘(서로 다른 글) */
let fillAt=0;const fill=(b,k,o)=>{for(let i=0;i<k;i++)B.answered(b,story(8,(fillAt++)%90),'first',Object.assign({now:T,age:8,run:1},o||{}))};
const kills=(b,kind,k,now)=>{let last;for(let i=0;i<k;i++)last=B.volleyKill(b,kind,{now:now||T});return last};
class Store{constructor(){this.m=new Map();this.reads=0;this.writes=0}getItem(k){this.reads++;return this.m.has(k)?this.m.get(k):null}setItem(k,v){this.writes++;this.m.set(k,String(v))}removeItem(k){this.writes++;this.m.delete(k)}}
const withBook=(patch,fn)=>{const keep=clone(K);const set=(dst,src)=>{for(const k of Object.keys(src)){if(src[k]&&typeof src[k]==='object'&&!Array.isArray(src[k]))set(dst[k],src[k]);else dst[k]=src[k]}};set(K,patch);try{return fn()}finally{set(K,keep)}};

/* B-1 상수: 명세 §3 수치 표 그대로 */
eq([B.V,B.FMT,B.FILE_FMT,B.FILE_V],[1,'kkm-book','kkomaeul-progress',1],'기록 v1 · 진행 파일 v1');
eq(B.KINDS,N.KINDS,'몬스터 키 8종이 콘텐츠와 같음');
eq(B.MEDALS,['one','fresh','again','rush','en','quiz','king','fox','arrow','keeper','star','map'],'훈장 12종');
eq(K.MEDAL,{one:[50,300,1000],fresh:[30,100,200],again:[5,30,100],rush:[1,15,60],en:[5,25,80],quiz:[10,50,150],king:[1,5,15],fox:[3,15,40],arrow:[100,1000,5000],keeper:[1,5,15],star:[1,5,15],map:[1,2,4]},'훈장 조건표(§3.3)');
eq(Object.values(K.MEDAL_GROUP).reduce((t,g)=>(t[g]=(t[g]||0)+1,t),{}),{read:6,guard:4,town:2},'읽기 6 · 지킴이 4 · 마을 2');
eq(K.NOTE.need,{wolf:{plays:2,kills:30},bramble:{plays:2,kills:30},boar:{plays:2,kills:8},granite:{plays:2,kills:8},frost:{plays:2,kills:12},ember:{plays:2,kills:2},fox:{plays:2,kills:0},king:{plays:1,kills:1}},'쪽지 자격(§3.1)');
eq([K.NOTE.cap,K.NOTE.gap,K.NOTE.after,K.SPECIAL.gap],[2,10,5,3],'쪽지 빈도(§3.2)');
eq([K.RIBBON.need,K.RIBBON.kills],[3,{wolf:10,bramble:10,boar:3,granite:3,frost:4,ember:1,fox:1,king:1}],'리본 조건(§3.1)');
eq(K.SHINY,{p:.25,pity:2,after:10,firsts:25},'반짝 손님(§3.4, 변경 기록 2차: firsts 25, 머무는 시간 제한 없음)');
eq(K.REVIEW,{share:.2,same:3,after:3,delay:[5,10],wait:[0,0,1,3],cap:200},'기억 늑대(§3.5)');
eq([K.SESSION_GAP,K.DAY_DEFAULT,K.DAY_CHOICES,K.DAY_EXTEND],[4*HOURMS,30,[0,20,30,45,60],15],'놀이 간격 4시간 · 하루 시간 기본 30분');
eq(K.GATE,{hold:20,digits:3,tries:3,wait:300,idle:1800},'보호자 문턱 상수(변경 기록 2차)');
eq(K.VILLAGES,C.VILLAGES,'마을 4곳이 Combat.VILLAGES와 같음');
eq(B.CELLS,32,'수첩 32칸');
for(const a of Q.AGES)eq(K.MIX.std[a],Q.QUIZ_MIX[a],a+'세 영어 "보통" = 지금 QUIZ_MIX');
for(const en of ['off','std','more'])for(const a of Object.keys(K.MIX[en]))eq(Object.values(K.MIX[en][a]).reduce((x,y)=>x+y,0),20,en+' '+a+'세 분류 가중치 합 20');
eq([Object.keys(K.MIX.more),Object.values(K.MIX.off).every(m=>m.english===0)],[['9','10'],true],'"조금 더"는 9·10세만, "끄기"는 영어 0');

/* B-2 새 기록의 모양과 저장 왕복 */
{const b=mk();
 eq(Object.keys(b),['fmt','v','made','at','from','play','pq','order','mon','drop','pend','notes','shiny','medal','vil','rv','rvPlay','seen','day','log','cur','tot','set','today','rng'],'기록 v1 칸');
 eq([b.fmt,b.v,b.made,b.at,b.from,b.play,b.pq],['kkm-book',1,T,T,0,1,0],'새 기록 머리');
 eq([Object.keys(b.mon),Object.keys(b.medal)],[B.KINDS,B.MEDALS],'몬스터 8 · 훈장 12 칸');
 eq(b.mon.wolf,{foot:0,plays:0,last:0,kills:0,note:0,nv:0,card:0,rib:{n:0,last:0},ribKills:0,shiny:0},'몬스터 칸');
 eq(b.shiny,{miss:0,run:0,pend:null,guest:null,f:0,fr:0},'반짝 칸(f·fr 포함)');
 eq(b.set,{en:'std',day:30,sfx:1},'보호자 설정 기본값(하루 30분)');
 eq(b.order,{seed:777,off:{},bank:{}},'이어 순서 칸');
 ok(b.rng>0&&Number.isInteger(b.rng),'난수 상태');
 ok(!JSON.stringify(b).match(/name|birth|email|device|adid/i),'개인정보 칸 없음');
 eq(B.restore(clone(b),{now:T}),b,'새 기록 저장 왕복');
 eq(B.restore(undefined,{now:T}).play,1,'빈 입력도 새 기록 모양');
}
/* 많이 논 기록의 저장 왕복: 사건을 고루 일으킨 뒤 JSON 왕복 = 같은 기록 */
const played=(()=>{const b=mk(5);let t=T;
 B.beginSession(b,t);
 for(let p=0;p<6;p++){
  for(let i=0;i<30;i++){const q=i%7===3?eng(9):i%5===2?math(8):story(8,p*30+i),r=i%6===5?'second':i%11===10?'miss':'first';
    B.answered(b,q,r,{now:t,age:8,run:p+1});B.tick(b,t,20);B.nextSpecial(b,ctxOf({index:i,run:p+1}));if(b.pend)B.answered(b,b.pend.kind==='note'?N.byId(b.pend.id):byId(b.pend.id),i%2?'first':'second',{now:t,age:8,run:p+1,special:b.pend.kind});
    if(i%3===0)for(const k of ['wolf','bramble','boar','granite','frost','ember'])B.volleyKill(b,k,{now:t});
    if(i===12)B.foxSaved(b,{now:t});if(i===20)B.rushed(b,{now:t});
    const c=B.shinyChance(b,{run:p+1,asked:i,boost2:i===20,kinds:['wolf','bramble','fox']});if(c&&c.win){B.shinySpawned(b);if(p%2)B.shinyMet(b,{now:t})}}
  B.finaleStart(b);B.kingWon(b,{now:t,stars:[1,1,p%2],village:K.VILLAGES[p%4],perfect:p===3});
  t+=DAY;B.newVillage(b,t,{age:8,used:{story:25,common:2,math:2,english:1}});}
 return b})();
{const b=played;
 eq(B.restore(clone(b),{now:b.at,knows}),b,'많이 논 기록 저장 왕복(JSON → 다듬기 = 같은 기록)');
 ok(b.play===7&&b.log.length===6&&b.medal.king.n===6&&b.rv.length>0&&B.cells(b)>8&&Object.keys(b.day).length===6,'왕복 고정본이 여러 칸을 채움 '+JSON.stringify([b.play,b.log.length,b.rv.length,B.cells(b)]));
 ok(JSON.stringify(b).length<80*1024,'기록 크기 80KB 이하('+JSON.stringify(b).length+')');
}

/* B-3 다듬기: 틀린 칸만 기본값, 모르는 칸은 버림, 범위로 자름 */
{const raw=clone(played);
 Object.assign(raw,{extra:'x',play:-5,pq:'많이',at:T+400*DAY,made:5,from:7,rng:0,seen:['a8-story-01','a8-story-01',7,'x'.repeat(50)],drop:{kind:'dragon'},pend:{kind:'gift',id:'x',key:'y'},today:{d:'어제',s:5}});
 raw.mon.dragon={foot:T};raw.mon.wolf={foot:0,card:T,kills:5e9,plays:'2',note:9,rib:{n:99,last:2},shiny:T+900*DAY};raw.mon.boar.zzz=1;
 raw.medal.one={n:-3,at:[T,T,T]};raw.medal.king={n:6,at:[0,0,0]};raw.medal.nope={n:1};
 raw.set={en:'lots',day:7,sfx:0};raw.shiny={miss:9,run:-1,pend:'king',guest:'dragon',f:'a',fr:2};
 raw.rv=[{id:'a8-story-01',box:9,due:-1,dp:0,miss:0},{id:'a8-story-01',box:1},{id:'a8-story-zz99'},{id:'<script>'},null,{id:'a8-story-g001',box:2,due:3,dp:2,miss:4,seen:1}];
 raw.day={'2026-11-18':[5,'x',-1],'soon':[1,1,1]};raw.vil={meadow:3,moon:9};raw.order={seed:-1,off:{8:{story:1e12,math:'x'},6:{story:1}},bank:{8:2,9:0,6:3}};
 const NP=played.at,b=B.restore(raw,{now:NP,knows});
 ok(!('extra' in b)&&!('dragon' in b.mon)&&!('zzz' in b.mon.boar)&&!('nope' in b.medal)&&!('moon' in b.vil),'모르는 칸은 버림');
 eq([b.play,b.pq,b.at,b.made,b.from],[1,0,NP,NP,0],'놀이·시각 범위(미래 시각은 지금으로)');
 ok(b.rng>0,'난수 상태 0은 기본값으로');
 eq(b.seen,['a8-story-01'],'seen 중복·모양 다듬기');
 eq([b.drop,b.pend],[null,null],'틀린 drop·pend는 비움');
 eq([b.mon.wolf.card,b.mon.wolf.note,b.mon.wolf.kills,b.mon.wolf.rib.n,b.mon.wolf.shiny],[0,0,1e7,0,0],'친구는 발자국이 있어야 인정, 누적 수 10^7 이하, 시각은 지금+1일 이하');
 eq(b.mon.bramble,played.mon.bramble,'멀쩡한 몬스터 칸은 그대로');
 eq([b.medal.one.n,b.medal.one.at,b.medal.king.at[0]>0,b.medal.king.at[2]],[0,[0,0,0],true,0],'훈장: 수에 맞지 않는 받은 시각은 지우고, 문턱을 넘었는데 시각이 없으면 채움');
 eq(b.set,{en:'std',day:30,sfx:0},'설정: 범위 밖 하루 시간은 기본값 30');
 eq(b.shiny,{miss:2,run:0,pend:null,guest:null,f:0,fr:2},'반짝 칸 다듬기(왕은 손님이 아님)');
 eq(b.rv,[{id:'a8-story-01',box:3,due:0,dp:1,miss:1,seen:0},{id:'a8-story-g001',box:2,due:3,dp:2,miss:4,seen:1}],'복습 대기열: 모르는 id·중복·깨진 줄은 버림');
 eq([b.day,b.vil,b.today],[{'2026-11-18':[5,0,0,0]},{meadow:3},{d:'',s:0,ext:0}],'날짜·마을·오늘 칸');
 eq(b.order,{seed:0,off:{8:{story:1e7,common:0,math:0,english:0}},bank:{8:2}},'이어 순서 칸');
 for(const junk of [null,7,'x',[],{mon:5,medal:'x',rv:{},seen:{},day:[],log:'x',set:3,order:[],shiny:[]}])eq(B.restore(junk,{now:T}),B.restore(undefined,{now:T}),'쓰레기 입력은 새 기록 모양 '+JSON.stringify(junk));
 const big=clone(played);big.rv=Array.from({length:260},(_,i)=>({id:'a8-story-g'+String(i+1).padStart(3,'0'),box:1,due:0,dp:1+(i%7),miss:1,seen:0}));big.seen=Array.from({length:5000},(_,i)=>'id'+i);big.log=Array.from({length:40},()=>big.log[0]);
 for(let i=0;i<50;i++)big.day['2026-09-'+String(1+i%30).padStart(2,'0')+(i>=30?'x':'')]=[1,1,1];
 const c=B.restore(big,{now:T});
 eq([c.rv.length,c.seen.length,c.log.length,Object.keys(c.day).length<=35],[200,4000,30,true],'목록 상한(복습 200 · seen 4000 · 놀이 요약 30 · 날짜 35)');
 ok(c.rv.every(e=>e.dp>1)||c.rv.filter(e=>e.dp===1).length<big.rv.filter(e=>e.dp===1).length,'복습 대기열이 넘치면 오래된 것부터 버림');
}

/* B-4 열기·쓰기: 없음 → 새 기록 / meta 이행(한 번) / 깨짐 / 앱보다 새 버전은 덮어쓰지 않음 / 체험·?book=0은 읽지도 쓰지도 않음 */
eq(B.keys({}),{book:'hangul-defense-book',bak:'hangul-defense-book-bak',run:null},'열쇠 이름');
eq(B.keys({test:true,runKey:'hangul-defense-v1-test'}),{book:'hangul-defense-book-test',bak:'hangul-defense-book-test-bak',run:'hangul-defense-v1-test'},'시험 모드 열쇠 -test');
eq([B.keys({demo:2}).book,B.keys({off:true}).book],[null,null],'체험·?book=0은 기록 열쇠 없음');
const KS=B.keys({runKey:'hangul-defense-v1'});
{const st=new Store(),h=B.open(st,KS,{now:T,seed:42});
 eq([h.status,h.locked,h.book.order.seed,h.book.from],['new',false,42,0],'기록이 없으면 새 기록(씨앗 = 지금 판 씨앗)');
 ok(B.save(st,KS,h)&&st.m.has(KS.book),'새 기록 쓰기');
 kills(h.book,'wolf',3);B.save(st,KS,h);
 const again=B.open(st,KS,{now:T,seed:99,meta:{stamps:[{q:10,acc:50}]}});
 eq([again.status,again.book.mon.wolf.kills,again.book.order.seed,again.book.from],['ok',3,42,0],'기록이 있으면 그대로(이행은 열쇠가 없을 때 한 번만)');
 eq(again.book,h.book,'열쇠 왕복 = 같은 기록');
}
/* v3 meta 고정본 이행(§2.4) */
const META={stamps:[
  {no:1,village:'meadow',age:8,stars:[1,1,1],q:60,acc:85,lost:0,min:20,date:T-5*DAY},
  {no:2,village:'quarry',age:8,stars:[0,1,1],q:47,acc:70,lost:1,min:18,date:T-4*DAY},
  {no:3,village:'frost',age:8,stars:[1,1,0],q:82,acc:91,lost:0,min:25,date:T-3*DAY},
  {no:4,village:'ember',age:8,stars:[1,1,1],q:55,acc:80,lost:0,min:22,date:T-2*DAY},
  {no:5,village:'meadow',age:8,stars:[1,1,1],q:50,acc:90,lost:0,min:19,date:T-DAY}],
 villages:[],acc:[85,70,91,80,90],seenOk:Array.from({length:120},(_,i)=>'a8-story-g'+String(i+1).padStart(3,'0')),from:0};
{const st=new Store(),h=B.open(st,KS,{now:T,seed:321,meta:META}),b=h.book;
 eq([h.status,b.from,b.order.seed,b.set.day],['migrated',3,321,30],'판 저장 meta가 있으면 이행(from 3, 씨앗 = 지금 판, 하루 30분)');
 eq(b.seen,META.seenOk,'seen ← meta.seenOk');
 const one=Math.round(60*.85)+Math.round(47*.7)+Math.round(82*.91)+Math.round(55*.8)+Math.round(50*.9);
 eq([b.medal.king.n,b.medal.star.n,b.medal.keeper.n,b.medal.one.n,b.medal.map.n,b.medal.fresh.n],[5,3,4,one,1,120],'훈장 누적 이행값(왕 5 · 별 셋 3 · 지킴이 4 · 한 번에 '+one+' · 네 마을 1바퀴 · 새 글 120)');
 eq([B.tierOf('king',5),b.medal.king.at.map(v=>v>0),b.medal.fresh.at.map(v=>v>0),b.medal.one.at.map(v=>v>0)],[2,[true,true,false],[true,true,false],[true,false,false]],'이행한 훈장 단계');
 eq([b.vil,b.mon.king.kills,b.mon.king.foot,b.mon.king.note,b.mon.fox.kills],[{meadow:2,quarry:1,frost:1,ember:1},5,0,1,0],'마을별 도장 · 왕 승리 수(발자국은 이행하지 않음, 다음 승리에 쪽지) · 여우 0');
 eq(B.KINDS.filter(k=>b.mon[k].foot>0).length,0,'몬스터 발자국은 이행하지 않음');
 eq([b.tot.q,b.tot.f],[294,one],'누적 푼 문제');
 eq(B.restore(clone(b),{now:T,knows}),b,'이행 결과 저장 왕복');
 eq(B.fromMeta(C.restoreMeta(META),{now:T,seed:321}),b,'Combat.restoreMeta를 거친 meta도 같은 결과');
 eq(B.open(new Store(),KS,{now:T,meta:C.freshMeta()}).status,'new','빈 meta는 이행하지 않고 새 기록');
}
{const st=new Store();st.setItem(KS.book,'{깨진 글');
 const h=B.open(st,KS,{now:T,seed:1});eq([h.status,h.locked,h.book.play],['broken',false,1],'깨진 기록은 판을 막지 않고 새 기록으로');
 st.setItem(KS.book,JSON.stringify({fmt:'other',v:1}));eq(B.open(st,KS,{now:T}).status,'broken','다른 형식도 깨진 것으로');
 const newer=JSON.stringify(Object.assign(clone(played),{v:2,future:{x:1}}));st.setItem(KS.book,newer);
 const n2=B.open(st,KS,{now:T,seed:1});
 eq([n2.status,n2.locked,n2.book.play,n2.book.medal.king.n],['newer',true,1,0],'앱보다 새 버전 기록: 메모리 안 빈 기록으로 놀게 함');
 kills(n2.book,'wolf',5);const w=st.writes;
 eq([B.save(st,KS,n2),st.writes,st.getItem(KS.book)],[false,w,newer],'새 버전 기록은 덮어쓰지 않음(글이 한 글자도 안 바뀜)');
 const st2=new Store(),demo=B.open(st2,B.keys({demo:1}),{now:T});kills(demo.book,'wolf',2);
 eq([demo.status,B.save(st2,B.keys({demo:1}),demo),st2.reads,st2.writes],['memory',false,0,0],'체험·?book=0: 열쇠를 읽지도 쓰지도 않음');
 const bad={getItem(){throw new Error('막힘')},setItem(){throw new Error('가득')},removeItem(){}};
 eq([B.open(bad,KS,{now:T}).locked,B.save(bad,KS,{book:mk(),locked:false})],[true,false],'저장소를 못 쓰면(사생활 모드·용량) 메모리로 계속, 쓰기는 false');
}

/* B-5 진행 파일: 내보내기 → 불러오기 왕복, 검사합(FNV-1a), 새 버전·크기·형식 거절, 망가진 칸 다듬기 */
eq([B.fnv1a(''),B.fnv1a('a'),B.fnv1a('foobar'),B.fnv1a('꼬꼬')===B.fnv1a('꼬꼬'),B.fnv1a('꼬꼬')!==B.fnv1a('꼬끼')],['811c9dc5','e40c292c','bf9cf968',true,true],'FNV-1a 32비트 알려진 값');
{const state=Object.assign(C.fresh(8),{gold:345,index:27,seed:99});state.meta.stamps.push({no:1,village:'meadow',age:8,stars:[1,1,1],q:50,acc:80,lost:0,min:10,date:T});
 const runSave=Object.assign({},state,{version:3,world:{t:1,wolves:[{x:1}],events:[]}});
 const file=B.exportFile(played,runSave,{now:T,app:'0.17.0'}),text=B.exportText(played,runSave,{now:T,app:'0.17.0'});
 eq(Object.keys(file),['fmt','v','app','made','book','run','sum'],'진행 파일 칸');
 eq([file.fmt,file.v,file.app,/^2026-11-18T\d\d:\d\d:\d\d[+-]\d\d:\d\d$/.test(file.made),/^[0-9a-f]{8}$/.test(file.sum)],['kkomaeul-progress',1,'0.17.0',true,true],'진행 파일 머리');
 ok(!('world' in file.run)&&file.run.gold===345&&file.run.version===3,'판 저장에서 세계(world)는 뺌');
 ok(/^kkomaeul-progress-\d{8}\.json$/.test(B.fileName(T)),'파일 이름 '+B.fileName(T));
 ok(text.length<200*1024&&!/name|email|device/i.test(Object.keys(file.book).join()),'크기 '+text.length+'바이트, 개인정보 칸 없음');
 const opt={now:played.at,knows,cleanRun:C.restore};
 const r=B.importFile(text,opt);
 eq([r.ok,r.error,r.sumOk],[true,null,true],'내보낸 파일은 그대로 불러옴');
 eq(r.book,played,'왕복: 기록이 같음');
 eq([r.run.gold,r.run.index,r.run.seed,r.run.meta.stamps.length,r.run.age],[345,27,99,1,8],'왕복: 판 저장(Combat.restore로 다듬음)');
 eq(r.preview,{cards:B.KINDS.filter(k=>played.mon[k].card>0).length,medals:B.MEDALS.reduce((s,k)=>s+played.medal[k].at.filter(Boolean).length,0),play:7,last:B.dayOf(played.at)},'미리보기(친구 카드 · 훈장 · 놀이 · 마지막 날짜)');
 eq(B.importFile(JSON.stringify(JSON.parse(text),null,2),opt).sumOk,true,'검사합은 공백·줄바꿈과 무관(해석한 객체로 다시 계산)');
 /* 변조: 값 하나를 고치면 검사합이 어긋남(그래도 보호자가 고르면 불러올 수 있게 ok는 true) */
 const t1=JSON.parse(text);t1.book.medal.king.n=999;const r1=B.importFile(JSON.stringify(t1),opt);
 eq([r1.ok,r1.sumOk,r1.book.medal.king.n],[true,false,999],'검사합 변조 감지(기록 값 변경)');
 const t2=JSON.parse(text);t2.run.gold=99999;eq(B.importFile(JSON.stringify(t2),opt).sumOk,false,'검사합 변조 감지(판 저장 값 변경)');
 const t3=JSON.parse(text);t3.sum='00000000';eq(B.importFile(JSON.stringify(t3),opt).sumOk,false,'검사합 변조 감지(검사합 자체)');
 const t4=JSON.parse(text);delete t4.sum;eq([B.importFile(JSON.stringify(t4),opt).ok,B.importFile(JSON.stringify(t4),opt).sumOk],[true,false],'검사합이 없으면 경고 대상');
 /* 망가진 칸은 기본값(파일 전체를 버리지 않음) */
 const t5=JSON.parse(text);t5.book.mon.wolf='x';t5.book.medal.one.n=5e12;t5.book.play='?';t5.run.gold='많이';const r5=B.importFile(JSON.stringify(t5),opt);
 eq([r5.ok,r5.book.mon.wolf.kills,r5.book.medal.one.n,r5.book.play,r5.book.mon.bramble.kills,typeof r5.run.gold],[true,0,1e7,1,played.mon.bramble.kills,'number'],'망가진 칸만 기본값·범위 자르기');
 /* 거절 */
 const t6=JSON.parse(text);t6.v=2;eq(B.importFile(JSON.stringify(t6),opt).error,'newer','새 버전 파일은 거절');
 const t7=JSON.parse(text);t7.book.v=2;eq([B.importFile(JSON.stringify(t7),opt).error,B.importFile(JSON.stringify(t7),opt).book],['newer',null],'새 버전 기록이 든 파일은 거절');
 eq(B.importFile('x'.repeat(1048577),opt).error,'size','1MB 넘는 파일은 거절');
 for(const junk of ['','{','[]','{"fmt":"kkomaeul-progress"}',JSON.stringify({fmt:'kkomaeul-progress',v:1,book:{fmt:'other',v:1}}),JSON.stringify({fmt:'x',v:1,book:{}}),null,5])eq(B.importFile(junk,opt).ok,false,'진행 파일이 아님 '+String(junk).slice(0,30));
 eq(B.importFile(B.exportText(mk(),null,{now:T}),{now:T}).run,null,'판 저장 없이 내보낸 파일(run null)');

 /* B-6 바꾸기 → 되돌리기(직전 기록 -bak 한 번) */
 const st=new Store(),mine=B.open(st,KS,{now:T,seed:8});kills(mine.book,'boar',4);B.save(st,KS,mine);st.setItem(KS.run,'{"gold":20,"version":3}');
 const before=[st.getItem(KS.book),st.getItem(KS.run)];
 eq(B.canUndo(st,KS),false,'바꾸기 전에는 되돌릴 것이 없음');
 ok(B.swapIn(st,KS,r.book,JSON.stringify(Object.assign({},r.run,{version:3})),{now:T}),'바꾸기');
 eq(B.open(st,KS,{now:played.at,knows}).book,played,'바꾼 뒤 기록 = 불러온 기록');
 eq([JSON.parse(st.getItem(KS.run)).gold,B.canUndo(st,KS)],[345,true],'바꾼 뒤 판 저장 · 되돌리기 가능');
 ok(B.undo(st,KS),'되돌리기');
 eq([[st.getItem(KS.book),st.getItem(KS.run)],B.canUndo(st,KS),B.undo(st,KS)],[before,false,false],'되돌리면 직전 기록·판 저장이 글자 그대로, 되돌리기는 한 번뿐');
 /* 기록이 없던 기기에서 바꾸기 → 되돌리면 다시 없음 */
 const st3=new Store();B.swapIn(st3,KS,r.book,null,{now:T});ok(st3.m.has(KS.book)&&!st3.m.has(KS.run),'빈 기기에 불러오기(판 저장 없음)');
 B.undo(st3,KS);eq([st3.m.has(KS.book),st3.m.has(KS.run),st3.m.has(KS.bak)],[false,false,false],'되돌리면 빈 기기로');
 /* 바꾸기를 두 번 하면 -bak은 직전 것만 */
 const st4=new Store();st4.setItem(KS.book,'A');B.swapIn(st4,KS,mk(1),null,{now:T});const mid=st4.getItem(KS.book);B.swapIn(st4,KS,mk(2),null,{now:T});B.undo(st4,KS);eq(st4.getItem(KS.book),mid,'-bak은 직전 기록 한 벌');
 eq(B.swapIn(new Store(),B.keys({demo:1}),mk(),null,{now:T}),false,'체험에서는 바꾸지 않음');
}

/* B-7 반짝 손님: 한 판 한 번, 25%, 꽝 2번 뒤 확정(세 번째 확정), 결정적 난수 */
const CH=o=>Object.assign({run:1,asked:10,boost2:true,kinds:['wolf','bramble','fox']},o||{});
{const b=mk(1);
 eq(B.shinyChance(b,CH({asked:9})),null,'그 판의 11번째 문제 전에는 기회 없음');eq(b.shiny.run,0,'…기회를 쓰지 않음');
 eq(B.shinyChance(b,CH({boost2:false})),null,'신바람 2단도 누적 25개도 아니면 기회 없음');
 eq([B.shinyChance(b,CH({finale:true})),B.shinyChance(b,CH({free:true})),B.shinyChance(b,CH({run:0}))],[null,null,null],'결전 중·더 놀기는 제외');
 eq(B.shinyChance(b,CH({kinds:[]})),null,'받을 반짝 칸이 없으면 기회를 쓰지 않고 기다림');eq(b.shiny.run,0,'…기회를 쓰지 않음(빈 후보)');
 b.shiny.miss=0;b.rng=1;/* 작은 상태값: 첫 난수가 0.25보다 작다 → 당첨 */
 const r=B.shinyChance(b,CH());ok(r&&r.win&&['wolf','bramble','fox'].includes(r.kind)&&b.shiny.pend===r.kind&&b.shiny.run===1,'당첨이면 종류가 정해지고 그 판의 기회를 씀');
 eq(B.shinyChance(b,CH()),null,'한 판에 기회 한 번');
 eq(B.shinyChance(b,CH({run:2})),null,'손님이 오기로 했거나 와 있으면 새 기회 없음');
 eq([B.shinySpawned(b),b.shiny.guest,b.shiny.pend],[r.kind,r.kind,null],'세계에 나타남(pend → guest)');
 eq(B.restore(clone(b),{now:T}).shiny.guest,r.kind,'손님은 저장에 남음(앱을 닫았다 열어도 있음)');
 const m=B.shinyMet(b,{now:T});ok(m.shiny&&b.mon[r.kind].shiny===T&&b.shiny.guest===null,'정답 화살이 닿으면 반짝 칸');
 eq(B.shinyMet(b,{now:T}).shiny,false,'손님이 없으면 아무 일도 없음');
}
{/* 꽝 2번 뒤 세 번째는 반드시(난수와 무관) */
 const b=mk(2);b.rng=4000000000;let runNo=1;const big=()=>{b.rng=4000000000};/* 큰 상태값이라도 다음 난수가 클지는 모르므로 직접 꽝을 만든다 */
 withBook({SHINY:{p:0}},()=>{eq(B.shinyChance(b,CH({run:runNo++})),{win:false,kind:null},'확률 0: 꽝');eq(B.shinyChance(b,CH({run:runNo++})),{win:false,kind:null},'꽝 두 번');eq(b.shiny.miss,2,'연속 꽝 2');
   const r=B.shinyChance(b,CH({run:runNo++}));ok(r.win&&b.shiny.miss===0,'확률이 0이어도 세 번째 기회는 반드시 당첨(보장)')});
 /* 못 만나고 판이 끝남(결전 시작·새 마을) → 꽝이 아니라 다음 기회 확정 */
 eq([B.finaleStart(b),b.shiny.guest,b.shiny.pend,b.shiny.miss],[true,null,null,2],'손님이 있는(오기로 한) 채 결전 시작 → 다음 기회 확정');
 withBook({SHINY:{p:0}},()=>ok(B.shinyChance(b,CH({run:runNo++})).win,'…다음 판 기회는 반드시'));
 B.shinySpawned(b);B.newVillage(b,T,{age:8});eq([b.shiny.guest,b.shiny.miss],[null,2],'새 마을로 떠날 때도 같음');
 eq(B.finaleStart(mk()),false,'손님이 없으면 shinyGone 없음');
}
{/* 연속한 기회 3번 안에 반드시 1번(결정적, 씨앗 200개 × 기회 300번) + 첫 기회 당첨률 25% ± 1%p(모의 10만 번) */
 let worst=0;
 for(let s=1;s<=200;s++){const b=mk(s);let gap=0;for(let r=1;r<=300;r++){const c=B.shinyChance(b,CH({run:r}));if(!c){ok(false,'기회가 있어야 함');break}gap=c.win?0:gap+1;worst=Math.max(worst,gap);b.shiny.pend=null}}
 eq(worst,2,'어느 씨앗에서도 꽝은 2번까지만 이어짐(세 번째 확정)');
 let win=0;const NUM=100000;
 for(let i=0;i<NUM;i++){const b={rng:parseInt(B.fnv1a('first|'+i),16)||1,shiny:{miss:0,run:0,pend:null,guest:null,f:0,fr:0},mon:{wolf:{shiny:0}}};if(B.shinyChance(b,CH({kinds:['wolf']})).win)win++}
 ok(Math.abs(win/NUM-.25)<.01,'첫 기회 당첨률 '+(100*win/NUM).toFixed(2)+'% (25% ± 1%p, 모의 10만 번)');
 /* 한 기록의 난수 줄기에서도 같은 확률(보장 없이 재려고 miss를 지움) */
 const b=mk(9);let w2=0;for(let i=0;i<NUM;i++){b.shiny.miss=0;b.shiny.pend=null;if(B.shinyChance(b,CH({run:i+1})).win)w2++}
 ok(Math.abs(w2/NUM-.25)<.01,'한 줄기 난수의 당첨률 '+(100*w2/NUM).toFixed(2)+'%');
 /* 보장을 넣은 실제 흐름: 기회당 당첨 = 1/2.3125 */
 const b3=mk(11);let w3=0;for(let i=0;i<NUM;i++){b3.shiny.pend=null;if(B.shinyChance(b3,CH({run:i+1})).win)w3++}
 ok(Math.abs(NUM/w3-2.3125)<.05,'당첨까지 평균 기회 수 '+(NUM/w3).toFixed(3)+' (계산값 2.31)');
 /* 종류는 후보 가운데 고르게 */
 const t={wolf:0,bramble:0,fox:0};const b4=mk(12);for(let i=0;i<30000;i++){b4.shiny.pend=null;b4.shiny.miss=2;t[B.shinyChance(b4,CH({run:i+1})).kind]++}
 ok(Object.values(t).every(v=>Math.abs(v/30000-1/3)<.02),'손님 종류가 고름 '+JSON.stringify(t));
 /* 결정적: 같은 기록 = 같은 결과, 난수 상태가 저장을 건넘 */
 const seq=b=>Array.from({length:40},(_,i)=>{b.shiny.pend=null;const c=B.shinyChance(b,CH({run:i+1}));return c.win?c.kind:'-'}).join(',');
 const x=mk(77),y=B.restore(clone(mk(77)),{now:T});eq(seq(x),seq(y),'같은 난수 상태 = 같은 손님 순서(저장 왕복 뒤에도)');
 ok(seq(mk(78))!==seq(mk(77)),'씨앗이 다르면 순서가 다름');
 const h=mk(3);for(const k of ['wolf','bramble'])h.mon[k].shiny=T;h.shiny.miss=2;eq(B.shinyChance(h,CH()).kind,'fox','이미 받은 종류는 후보에서 빠짐');
 const g=mk(3);g.shiny.miss=2;eq(B.shinyChance(g,CH({kinds:['king','dragon','wolf']})).kind,'wolf','왕·모르는 종류는 손님이 되지 않음');
}
{/* 누적 경로(느린 아이): 그 판에서 한 번에 맞힌 수 25개 */
 const b=mk(4);b.shiny.miss=2;
 for(let i=0;i<24;i++)B.answered(b,story(8,i),'first',{now:T,age:8,run:3});
 for(let i=0;i<10;i++)B.answered(b,story(8,30+i),'second',{now:T,age:8,run:3});
 eq([b.shiny.f,b.shiny.fr,B.shinyChance(b,CH({run:3,asked:34,boost2:false}))],[24,3,null],'24개까지는 기회 없음(두 번째 정답은 세지 않음)');
 B.answered(b,story(8,50),'first',{now:T,age:8,run:3});
 ok(B.shinyChance(b,CH({run:3,asked:35,boost2:false})).win,'25개가 되면 연속이 아니어도 기회');
 B.answered(b,story(8,51),'first',{now:T,age:8,run:4});eq([b.shiny.f,b.shiny.fr],[1,4],'판이 바뀌면 다시 0부터');
 const c=mk(4);for(let i=0;i<40;i++)B.answered(c,story(8,i),'first',{now:T,age:8,run:1});
 withBook({SHINY:{firsts:0}},()=>eq(B.shinyChance(c,CH({asked:40,boost2:false})),null,'SHINY.firsts 0이면 누적 경로 끔(연속 경로만)'));
 withBook({FLAGS:{shiny:false}},()=>eq(B.shinyChance(c,CH({asked:40})),null,'?shiny=0이면 기회 없음'));
 /* 늑대 왕 반짝: 확률 없음, 결전에서 한 번도 안 틀렸을 때만 */
 const k=mk();eq([B.kingWon(k,{now:T,stars:[1,1,1],village:'meadow',perfect:false}).shiny,k.mon.king.shiny],[false,0],'틀린 적 있는 결전: 왕 반짝 없음');
 eq([B.kingWon(k,{now:T,stars:[1,1,1],village:'quarry',perfect:true}).shiny,k.mon.king.shiny],[true,T],'한 번도 안 틀린 결전: 왕 반짝 칸');
 /* 공개 문구의 숫자는 상수에서 */
 const txt=B.shinyText();ok(txt.includes('25% 확률')&&txt.includes('25개가 되')&&txt.includes('두 번 오지 않으면 세 번째에는 반드시')&&txt.includes('기다려요')&&!/당첨|뽑기|레어|shiny/i.test(txt.replace('뽑는 것은 없어요','')),'공개 문구 '+txt);
 withBook({SHINY:{p:.2,firsts:30}},()=>ok(B.shinyText().includes('20% 확률')&&B.shinyText().includes('30개가 되'),'공개 문구는 상수를 바꾸면 같이 바뀜'));
 withBook({SHINY:{firsts:0}},()=>ok(!B.shinyText().includes('개가 되'),'누적 경로를 끄면 문구에서도 빠짐'));
}

/* B-8 훈장: 사건 하나에 +1, 문턱에서 받은 시각 */
{const b=mk();let got=[];const A=(q,r,o)=>{const x=B.answered(b,q,r,Object.assign({now:T,age:8,run:1},o||{}));got=got.concat(x.medals);return x};
 A(story(8,0),'second');A(story(8,1),'miss');eq([b.medal.one.n,b.medal.fresh.n,b.seen.length],[0,0,0],'한 번에 못 맞히면 한 번에 읽기·새 글은 0');
 const f=A(story(8,2),'first');eq([b.medal.one.n,b.medal.fresh.n,f.fresh,b.seen],[1,1,true,['a8-story-03']],'한 번에 맞힘: 한 번에 읽기 +1, 새 글 +1');
 A(story(8,2),'first');eq([b.medal.one.n,b.medal.fresh.n],[2,1],'같은 글을 다시 맞히면 새 글은 그대로');
 A(eng(8),'first');A(math(8),'first');A(bankQuiz(8).find(q=>q.cat==='common'),'first');A(eng(8),'second');
 eq([b.medal.en.n,b.medal.quiz.n,b.medal.one.n],[1,2,5],'영어 +1 · 상식·수학 +2');
 A(story(8,3),'first',{finale:true});eq(b.medal.one.n,6,'결전 문제도 한 번에 읽기에 셈');
 eq([B.rushed(b,{now:T}).medals,b.medal.rush.n],[[{key:'rush',tier:1}],1],'신바람 동(1번)');
 for(let i=0;i<2;i++)B.foxSaved(b,{now:T});eq(b.medal.fox.at[0],0,'여우 2번: 아직');eq(B.foxSaved(b,{now:T+5}).medals,[{key:'fox',tier:1}],'여우 3번: 동');eq(b.medal.fox.at,[T+5,0,0],'받은 시각');
 kills(b,'wolf',99);eq(b.medal.arrow.at[0],0,'정답 화살 99: 아직');eq(B.volleyKill(b,'wolf',{now:T}).medals,[{key:'arrow',tier:1}],'정답 화살 100: 동');
 eq([B.volleyKill(b,'fox',{now:T}).foot,B.volleyKill(b,'king',{now:T}).foot,B.volleyKill(b,'dragon',{now:T}).foot,b.medal.arrow.n],[false,false,false,100],'여우·왕·모르는 종류는 정답 화살 처치로 세지 않음');
 /* 왕·지킴이·별 셋·네 마을 */
 const w=(st,v)=>B.kingWon(b,{now:T,stars:st,village:v});
 eq(w([0,1,0],'meadow').medals.map(m=>m.key),['king'],'첫 승리: 늑대 왕 동(별 ① 없으면 지킴이 없음)');
 eq(w([1,1,0],'quarry').medals.map(m=>m.key),['keeper'],'별 ①: 꼬꼬 지킴이');
 eq(w([1,1,1],'frost').medals.map(m=>m.key),['star'],'별 3개: 별 셋');
 eq([b.medal.map.n,w([1,1,1],'ember').medals.map(m=>m.key),b.medal.map.n],[0,['map'],1],'네 마을을 다 지켜야 한 바퀴');
 w([1,1,1],'meadow');eq([b.medal.king.n,b.medal.king.at.map(Boolean),b.medal.map.n],[5,[true,true,false],1],'늑대 왕 5번: 은, 바퀴는 min(마을별)');
 /* 문턱 전부: 수를 올려 가며 단계가 표와 같음 */
 for(const key of B.MEDALS){const [x,y,z]=K.MEDAL[key];eq([B.tierOf(key,x-1),B.tierOf(key,x),B.tierOf(key,y-1),B.tierOf(key,y),B.tierOf(key,z-1),B.tierOf(key,z),B.tierOf(key,z*9)],[0,1,1,2,2,3,3],key+' 동·은·금 문턱')}
 const c=mk();for(let i=0;i<50;i++)B.answered(c,story(8,i),'first',{now:T+i,age:8,run:1});
 eq([c.medal.one.at,c.medal.fresh.at[0],c.medal.fresh.n],[[T+49,0,0],T+29,50],'한 번에 읽기 50번째에 동, 새 글 30번째에 동');
 const list=B.medals(c);eq([list.length,list[0],list.find(m=>m.key==='en').hidden],[12,{key:'one',group:'read',n:50,tier:1,need:[50,300,1000],next:250,at:[T+49,0,0],hidden:false},false],'진열 목록(다음 단계까지 남은 수)');
 B.setOpt(c,'en','off');eq([B.medals(c).find(m=>m.key==='en').hidden,B.medals(c).filter(m=>m.hidden).length],[true,1],'영어 끄기면 영어 훈장 숨김');
 withBook({FLAGS:{medals:false}},()=>{const d=mk();B.answered(d,story(8,0),'first',{now:T,age:8});B.kingWon(d,{now:T,stars:[1,1,1],village:'meadow'});eq(B.MEDALS.map(k=>d.medal[k].n),Array(12).fill(0),'?medals=0이면 세지 않음')});
}

/* B-9 발자국 수첩: 발자국 → 쪽지 자격 → 떨어뜨림 → 쪽지 문제 → 친구 카드 → 리본 */
{const b=mk();
 const k1=B.volleyKill(b,'wolf',{now:T+1});eq([k1.foot,b.mon.wolf.foot,b.mon.wolf.plays,b.mon.wolf.last,B.cells(b)],[true,T+1,1,1,1],'첫 정답 화살 처치 = 발자국');
 kills(b,'wolf',59);eq([b.mon.wolf.kills,b.mon.wolf.note,b.drop,b.mon.wolf.plays],[60,0,null,1],'처음 놀이에는 처치가 많아도 자격이 생기지 않음(놀이 2번 조건)');
 B.nextPlay(b,T);const k2=B.volleyKill(b,'wolf',{now:T});eq([b.mon.wolf.plays,b.mon.wolf.note,k2.drop,b.drop],[2,1,false,null],'두 번째 놀이의 처치로 자격(이 처치에는 안 떨어뜨림)');
 eq(B.canDrop(b,'wolf'),true,'자격이 됨');
 const k3=B.volleyKill(b,'wolf',{now:T});eq([k3.drop,b.drop],[true,{kind:'wolf',at:2}],'그다음 정답 화살 처치에 쪽지를 떨어뜨림');
 eq([B.volleyKill(b,'wolf',{now:T}).drop,B.canDrop(b,'wolf')],[false,false],'들고 있는 쪽지가 있으면 또 떨어뜨리지 않음');
 /* 쪽지 문제는 놀이 5문제 이후, 결전 중에는 내지 않음 */
 fill(b,4);eq(B.nextSpecial(b,ctxOf({index:4,run:2})),null,'놀이 시작 뒤 5문제 전에는 쪽지 문제 없음');
 fill(b,1);eq(B.nextSpecial(b,ctxOf({index:5,run:2,finale:true})),null,'결전 중에는 쪽지 문제를 내지 않고 들고 있음');ok(b.drop,'…쪽지는 그대로');
 const sp=B.nextSpecial(b,ctxOf({index:5,run:2}));
 eq([sp.kind,sp.key,sp.id,sp.q.id,sp.q.kind],['note','wolf','a8-note-wolf-1','a8-note-wolf-1','wolf'],'쪽지 문제(8세 늑대 1번 문항)');
 eq(sp.q,N.get(8,'wolf',1),'쪽지 문항은 콘텐츠 그대로(보기 순서 포함)');
 eq(b.pend,{kind:'note',key:'wolf',id:'a8-note-wolf-1',index:5,run:2,seed:0},'걸린 특별 문제 표');
 eq(B.nextSpecial(B.restore(clone(b),{now:T}),ctxOf({index:5,run:2})),sp,'새로 불러와도 같은 칸에서는 같은 쪽지 문제(이어하기)');
 eq([b.notes.n,b.pq],[1,5],'쪽지 수는 한 번만 셈(이어하기로 두 번 세지 않음), 문제 수는 답해야 오름');
 /* 놓침: 잃는 것 없이 다음 놀이에 2번째 문항 */
 const a1=B.answered(b,sp.q,'second',{now:T,age:8,run:2,special:'note'});
 eq([a1.lost,a1.friend,b.mon.wolf.note,b.mon.wolf.nv,b.mon.wolf.card,b.drop,b.pend],['wolf',null,2,1,0,null,null],'두 번째 정답: 쪽지가 날아감(다음 문항으로 바뀜)');
 eq([b.rv.length,B.volleyKill(b,'wolf',{now:T}).drop],[0,false],'쪽지 문항은 복습 대기열에 넣지 않음, 이번 놀이에는 다시 안 떨어뜨림');
 B.nextPlay(b,T);eq(b.mon.wolf.note,1,'다음 놀이에 다시 자격');
 ok(B.volleyKill(b,'wolf',{now:T}).drop,'다음 놀이 첫 처치에 다시 떨어뜨림');fill(b,5);
 const sp2=B.nextSpecial(b,ctxOf({index:9,run:2}));eq(sp2.id,'a8-note-wolf-2','놓친 뒤에는 2번째 문항');
 const a2=B.answered(b,sp2.q,'first',{now:T+7,age:8,run:2,special:'note'});
 eq([a2.friend,a2.lost,b.mon.wolf.note,b.mon.wolf.card,b.drop,b.pend,B.cells(b)],['wolf',null,3,T+7,null,null,2],'한 번에 맞히면 친구 카드');
 eq(B.page(b,'wolf'),{kind:'wolf',foot:true,card:true,ribbon:false,shiny:false,note:3,kills:b.mon.wolf.kills,plays:3,needKills:30,needPlays:2,rib:0,ribNeed:3,ribKills:b.mon.wolf.ribKills,ribNeedKills:10,since:T+7},'수첩 한 쪽 진행');
 /* 리본: 카드가 생긴 놀이는 세지 않고, 그 뒤 놀이 3번 */
 kills(b,'wolf',20);eq(b.mon.wolf.rib.n,0,'카드가 생긴 놀이는 리본에 세지 않음');
 for(let p=1;p<=3;p++){B.nextPlay(b,T);kills(b,'wolf',9);eq(b.mon.wolf.rib.n,p-1,'한 놀이 9마리: 아직');const r=B.volleyKill(b,'wolf',{now:T});eq([b.mon.wolf.rib.n,r.ribbon],[p,p===3],'한 놀이 10마리: 리본 진행 '+p);kills(b,'wolf',15);eq(b.mon.wolf.rib.n,p,'놀이당 한 번만')}
 eq([B.page(b,'wolf').ribbon,B.cells(b),B.volleyKill(b,'wolf',{now:T}).drop],[true,3,false],'리본 완성(3칸), 친구는 쪽지를 다시 떨어뜨리지 않음');
}
{/* 놀이당 쪽지 2개, 쪽지 사이 10문제, 특별 문제 사이 3문제 */
 const b=mk();for(const k of ['wolf','bramble','boar'])b.mon[k]=Object.assign(b.mon[k],{foot:T,plays:2,last:0,kills:40,note:1});
 ok(kills(b,'wolf',1).drop,'늑대 쪽지');eq(B.volleyKill(b,'bramble',{now:T}).drop,false,'쪽지 하나를 들고 있으면 다른 종도 기다림');
 fill(b,5);const s1=B.nextSpecial(b,ctxOf({index:5}));B.answered(b,s1.q,'first',{now:T,age:8,run:1,special:'note'});
 ok(B.volleyKill(b,'bramble',{now:T}).drop,'첫 쪽지를 읽고 나면 다음 쪽지를 떨어뜨림');
 const at=b.pq;fill(b,8);eq(B.nextSpecial(b,ctxOf({index:14})),null,'쪽지 사이 10문제 전(지금 '+(b.pq-at+1)+'문제)');
 fill(b,1);const s2=B.nextSpecial(b,ctxOf({index:15}));eq([s2&&s2.key,b.pq-b.notes.lastQ,b.notes.n],['bramble',0,2],'10문제 뒤 두 번째 쪽지');
 B.answered(b,s2.q,'first',{now:T,age:8,run:1,special:'note'});
 eq([B.canDrop(b,'boar'),B.volleyKill(b,'boar',{now:T}).drop,b.drop],[false,false,null],'한 놀이에 쪽지는 2개까지(세 번째는 떨어뜨리지 않고 다음 놀이로)');
 B.nextPlay(b,T);ok(B.volleyKill(b,'boar',{now:T}).drop,'다음 놀이에 떨어뜨림');
 /* 떨어진 쪽지가 문제로 못 나간 채 놀이가 끝나면 다음 놀이 5문제 이후 */
 B.nextPlay(b,T);ok(b.drop&&b.drop.kind==='boar','놀이가 바뀌어도 쪽지는 들고 있음');fill(b,5);eq(B.nextSpecial(b,ctxOf({index:40})).key,'boar','다음 놀이 5문제 이후에 나옴');
 withBook({FLAGS:{notes:false}},()=>{const c=mk();c.mon.wolf=Object.assign(c.mon.wolf,{plays:2,kills:40,note:1});eq([B.volleyKill(c,'wolf',{now:T}).drop,c.mon.wolf.foot>0],[false,true],'?notes=0: 쪽지는 없고 발자국은 남음')});
 /* 7~10세 모두 그 나이의 쪽지가 나옴, 나이가 바뀌면 걸린 쪽지는 그 나이 것으로 다시 */
 for(const a of Q.AGES){const c=mk();c.mon.frost=Object.assign(c.mon.frost,{foot:T,plays:2,kills:20,note:1});kills(c,'frost',1);fill(c,5);const s=B.nextSpecial(c,ctxOf({age:a,index:5}));eq([s.id,s.q.age],['a'+a+'-note-frost-1',a],a+'세 쪽지 문항');
   if(a===8){const s9=B.nextSpecial(c,ctxOf({age:9,index:5}));eq(s9&&s9.id,'a9-note-frost-1','풀기 전에 나이를 바꾸면 그 나이의 쪽지로')}}
}
{/* 종별 자격 문턱(놀이 2번 + 누적 처치), 여우(구출한 놀이 2번), 왕(두 번째 승리에 떨어뜨림) */
 for(const kind of ['wolf','bramble','boar','granite','frost','ember']){const need=K.NOTE.need[kind].kills,b=mk();
   kills(b,kind,1);B.nextPlay(b,T);kills(b,kind,Math.max(0,need-2));eq(b.mon[kind].note,0,kind+': 누적 '+b.mon[kind].kills+'마리(자격 '+need+')');
   kills(b,kind,1);eq(b.mon[kind].note,1,kind+': 놀이 2번 + '+need+'마리면 자격');ok(kills(b,kind,1).drop,kind+': 그다음 처치에 쪽지')}
 const f=mk();B.foxSaved(f,{now:T});B.foxSaved(f,{now:T});eq([f.mon.fox.foot,f.mon.fox.note,f.mon.fox.kills],[T,0,2],'여우: 첫 구출 = 발자국, 한 놀이에 여러 번 구해도 자격 없음');
 B.nextPlay(f,T);eq(B.foxSaved(f,{now:T}).drop,false,'여우: 구출한 놀이 2번째에 자격');ok(B.foxSaved(f,{now:T}).drop,'여우: 다음 구출에 쪽지');
 const g=mk();const w1=B.kingWon(g,{now:T,stars:[1,1,1],village:'meadow'});eq([w1.foot,w1.drop,g.mon.king.note],[true,false,1],'왕: 첫 승리 = 발자국');
 B.newVillage(g,T,{age:8});const w2=B.kingWon(g,{now:T,stars:[1,1,1],village:'quarry'});eq([w2.drop,g.drop],[true,{kind:'king',at:2}],'왕: 두 번째 승리 때 쪽지');
 eq(B.nextSpecial(g,ctxOf({index:60,run:2,finale:true})),null,'결전 문제 칸에는 내지 않음');B.newVillage(g,T,{age:8});fill(g,5);eq(B.nextSpecial(g,ctxOf({index:5,run:3})).id,'a8-note-king-1','왕의 쪽지는 새 마을의 평소 문제 칸에');
 /* 32칸 */
 const full=mk();for(const k of B.KINDS)Object.assign(full.mon[k],{foot:T,card:T,note:3,rib:{n:3,last:1},shiny:T});eq([B.cells(full),B.cells(mk())],[32,0],'32칸을 다 채움 / 새 기록 0칸');
 /* 놀러 오는 친구: 리본 먼저, 다음은 최근에 친구가 된 순서, 최대 4 */
 const v=mk();[['wolf',T+1,0],['boar',T+5,3],['frost',T+3,0],['fox',T+4,0],['king',T+2,3],['ember',T+9,0]].forEach(([k,t,r])=>Object.assign(v.mon[k],{foot:T,card:t,note:3,rib:{n:r,last:1}}));v.mon.ember.shiny=T;
 eq(B.friends(v),[{kind:'boar',ribbon:true,shiny:false},{kind:'king',ribbon:true,shiny:false},{kind:'ember',ribbon:false,shiny:true},{kind:'fox',ribbon:false,shiny:false}],'놀러 오는 친구 순서');
 eq([B.friends(mk()),withBook({FLAGS:{friends:false}},()=>B.friends(v))],[[],[]],'친구가 없거나 ?friends=0이면 없음');
}

/* B-10 기억 늑대: 같은 놀이 → 다음 놀이 → 3놀이 뒤 → 졸업 */
{const b=mk(),X=story(8,100),o={now:T,age:8,run:1};
 const a=B.answered(b,X,'second',o);eq([a.queued,b.rv.length,b.rv[0].id,b.rv[0].box,b.rv[0].dp,b.rv[0].miss,b.rv[0].due>=b.pq+5&&b.rv[0].due<=b.pq+10],[true,1,X.id,1,1,1,true],'한 번에 못 맞힌 평소 문제는 칸 1로(같은 놀이 5~10문제 뒤)');
 const due=b.rv[0].due;while(b.pq<due-1){fill(b,1);eq(B.nextSpecial(b,ctxOf({index:b.pq})),null,'칸 1: '+b.pq+'문제째에는 아직(나올 때 '+due+')')}
 fill(b,1);const s=B.nextSpecial(b,ctxOf({index:b.pq}));
 eq([s.kind,s.id,s.q.id,s.q.lap,s.q.choices.slice().sort(),s.q.choices[s.q.answer]],['review',X.id,X.id,1,X.choices.slice().sort(),X.choices[X.answer]],'칸 1: 같은 놀이에 다시 나옴(같은 글·같은 정답, 보기 순서는 섞음)');
 eq(B.nextSpecial(B.restore(clone(b),{now:T,knows}),ctxOf({index:b.pq})),s,'복습 문제도 이어하기에서 같은 문제·같은 보기 순서');
 const r1=B.answered(b,s.q,'first',Object.assign({special:'review'},o));eq([r1.graduated,b.rv[0].box,b.rv[0].dp,b.pend,b.medal.again.n],[false,2,1,null,0],'한 번에 맞히면 칸 2');
 fill(b,30);eq(B.nextSpecial(b,ctxOf({index:b.pq})),null,'칸 2는 같은 놀이에 나오지 않음');
 B.nextPlay(b,T);fill(b,2);eq(B.nextSpecial(b,ctxOf({index:2,run:2})),null,'다음 놀이 3문제 전에는 아직');
 fill(b,1);const s2=B.nextSpecial(b,ctxOf({index:3,run:2}));eq([s2&&s2.id,s2&&s2.q.lap],[X.id,2],'칸 2: 다음 놀이 3문제 이후');
 B.answered(b,s2.q,'first',Object.assign({special:'review'},o));eq([b.rv[0].box,b.rv[0].dp],[3,2],'칸 3으로');
 for(const p of [3,4]){B.nextPlay(b,T);fill(b,5);eq(B.nextSpecial(b,ctxOf({index:5,run:p})),null,'칸 3: 놀이 '+p+'에는 아직(3놀이 뒤 = 놀이 5)')}
 B.nextPlay(b,T);fill(b,3);const s3=B.nextSpecial(b,ctxOf({index:3,run:5}));eq(s3&&s3.id,X.id,'칸 3: 3놀이 뒤');
 const r3=B.answered(b,s3.q,'first',Object.assign({special:'review'},o));eq([r3.graduated,b.rv.length,b.medal.again.n,b.cur.rv],[true,0,1,[1,1]],'칸 3을 한 번에 맞히면 졸업(다시 읽기 훈장 +1)');
 /* 복습에서 또 놓치면 칸 1로 */
 const c=mk();B.answered(c,X,'miss',o);c.rv[0].box=3;c.rv[0].dp=1;B.nextPlay(c,T);B.nextPlay(c,T);B.nextPlay(c,T);fill(c,3);const t=B.nextSpecial(c,ctxOf({index:3,run:4}));
 B.answered(c,t.q,'second',Object.assign({special:'review'},o));eq([c.rv[0].box,c.rv[0].dp,c.rv[0].miss,c.rv[0].due>c.pq],[1,4,2,true],'복습에서 못 맞히면 칸 1, 놓친 수 +1');
 /* 평소 순서에 기다리던 글이 나오면 복습으로 침 */
 const d=mk();B.answered(d,X,'second',o);B.answered(d,X,'first',o);eq([d.rv[0].box,d.rv.length],[2,1],'평소 문제로 나온 기다리던 글을 맞히면 칸이 오름');
 B.answered(d,X,'miss',o);eq([d.rv[0].box,d.rv[0].miss],[1,2],'…놓치면 칸 1');
 B.answered(d,story(8,101),'second',Object.assign({finale:true},o));eq(d.rv.length,1,'결전 문제는 대기열에 넣지 않음');
 eq(B.answered(d,story(8,102),'first',o).queued,false,'한 번에 맞힌 글은 넣지 않음');
 withBook({FLAGS:{review:false}},()=>{const e=mk();B.answered(e,X,'miss',o);eq([e.rv.length,B.nextSpecial(e,ctxOf({index:9}))],[0,null],'?review=0: 대기열·복습 문제 없음')});
}
{/* 한 놀이 상한(문제의 20%, 같은 글 3번), 특별 문제 사이 3문제, 나이·영어 끄기, 고르는 순서, 크기 200 */
 const b=mk(),o={now:T,age:8,run:1};
 for(let i=0;i<40;i++)b.rv.push({id:story(8,i+100).id,box:1,due:0,dp:1,miss:1,seen:0});
 let sp=0,asked=0,lastAt=-99,minGap=99,maxShare=0;const seenIds={};
 for(let i=0;i<120;i++){const s=B.nextSpecial(b,ctxOf({index:i}));
   if(s){sp++;minGap=Math.min(minGap,b.pq-lastAt);lastAt=b.pq;seenIds[s.id]=(seenIds[s.id]||0)+1;B.answered(b,s.q,'second',Object.assign({special:'review'},o));if(b.pq>=5)maxShare=Math.max(maxShare,sp/b.pq)}
   else{fill(b,1);asked++}}
 ok(sp>10&&sp<=Math.max(1,Math.floor(.2*b.pq))+1,'복습 문제 수 '+sp+'/'+b.pq+' ≤ 20%');
 ok(maxShare<=.25,'어느 시점에도 복습 비율이 20% 언저리(최대 '+maxShare.toFixed(2)+')');
 ok(minGap>=3,'특별 문제 사이 3문제 이상(최소 '+minGap+')');
 ok(Object.values(seenIds).every(v=>v<=3),'같은 글은 한 놀이에 3번까지 '+Math.max(...Object.values(seenIds)));
 /* 나이: 지금 나이 글만 */
 const c=mk();c.rv=[{id:story(9,3).id,box:1,due:0,dp:1,miss:1,seen:0}];fill(c,5);
 eq(B.nextSpecial(c,ctxOf({age:8,index:5})),null,'다른 나이 글은 쉼');eq(B.nextSpecial(c,ctxOf({age:9,index:5})).id,story(9,3).id,'그 나이로 돌아오면 다시');
 /* 영어 끄기: 영어 글은 쉼 */
 const e=mk();e.rv=[{id:eng(8).id,box:1,due:0,dp:1,miss:1,seen:0}];fill(e,5);B.setOpt(e,'en','off');eq(B.nextSpecial(e,ctxOf({index:5})),null,'영어 끄기면 영어 글은 쉼');
 B.setOpt(e,'en','std');eq(B.nextSpecial(e,ctxOf({index:5})).id,eng(8).id,'영어를 켜면 다시');
 /* 고르는 순서: 칸 낮은 것 → due 이른 것 → dp 오래된 것 */
 const g=mk();g.play=9;g.notes.play=9;g.rvPlay.play=9;g.rv=[{id:story(8,1).id,box:3,due:0,dp:2,miss:1,seen:0},{id:story(8,2).id,box:2,due:0,dp:8,miss:1,seen:0},{id:story(8,3).id,box:2,due:0,dp:5,miss:1,seen:0},{id:story(8,4).id,box:1,due:9,dp:8,miss:1,seen:0},{id:story(8,5).id,box:1,due:4,dp:8,miss:1,seen:0}];
 const order=[];for(let i=0;i<5;i++){g.pq=50+i*10;g.rvPlay.lastQ=-99;const s=B.nextSpecial(g,ctxOf({index:i,run:9}));order.push(s.id);g.rv=g.rv.filter(x=>x.id!==s.id);g.pend=null}
 eq(order,[5,4,3,2,1].map(i=>story(8,i).id),'고르는 순서');
 /* 쪽지와 복습이 같이 기다리면 쪽지 먼저 */
 const h=mk();h.mon.wolf=Object.assign(h.mon.wolf,{foot:T,plays:2,kills:40,note:1});kills(h,'wolf',1);h.rv=[{id:story(8,1).id,box:1,due:0,dp:1,miss:1,seen:0}];fill(h,5);
 eq(B.nextSpecial(h,ctxOf({index:5})).kind,'note','쪽지와 복습이 같이 기다리면 쪽지 먼저');
 /* 크기 200: 넘치면 오래된 것부터 */
 const z=mk();for(let i=0;i<230;i++){if(i===100)B.nextPlay(z,T);B.answered(z,{id:'a8-story-g'+String(i+1).padStart(3,'0'),mode:'story',choices:['a','b','c'],answer:0},'miss',o)}
 eq([z.rv.length,z.rv.filter(x=>x.dp===1).length,z.rv.filter(x=>x.dp===2).length],[200,70,130],'대기열 200: 오래된 놀이의 글부터 버림');
 /* 모르는 id(문제은행에서 사라진 글)는 건너뜀 */
 const u=mk();u.rv=[{id:'a8-story-g999',box:1,due:0,dp:1,miss:1,seen:0},{id:story(8,7).id,box:1,due:1,dp:1,miss:1,seen:0}];fill(u,5);eq(B.nextSpecial(u,ctxOf({index:5})).id,story(8,7).id,'은행에 없는 글은 건너뜀');
 /* 보기 순서 섞기: 결정적, 정답 글은 같음 */
 const q=story(10,3),s1=B.shuffle(q,12345),s2=B.shuffle(q,12345);eq(s1,s2,'같은 씨앗 = 같은 보기 순서');eq([s1.choices[s1.answer],q.choices.length],[q.choices[q.answer],5],'섞어도 정답 글은 같음');eq(B.shuffle(q,0),q,'씨앗 0은 그대로');
 ok(new Set(Array.from({length:30},(_,i)=>B.shuffle(q,i+1).answer)).size>=4,'씨앗마다 정답 자리가 달라짐');
}

/* B-11 놀이 번호 · 날짜별 기록 · 하루 시간 */
{const b=mk();
 eq([B.beginSession(b,T+HOURMS),b.play],[false,1],'4시간 안의 재접속은 같은 놀이');
 eq([B.beginSession(b,T+HOURMS+4*HOURMS+1),b.play],[true,2],'4시간 넘게 쉬고 시작하면 새 놀이');
 fill(b,7,{now:T+6*HOURMS});B.answered(b,eng(8),'second',{now:T+6*HOURMS,age:8,run:1});B.tick(b,T+6*HOURMS,90);
 kills(b,'wolf',4);b.mon.boar.note=2;const d0=B.dayOf(T+6*HOURMS);
 eq([b.pq,b.cur.q,b.cur.f,b.cur.nw,b.cur.rd,b.cur.en,b.cur.s,b.cur.age,b.day[d0],b.tot],[8,8,7,7,[7,7],[1,0],90,8,[8,7,90,7],{q:8,f:7,s:90,days:1}],'이번 놀이·날짜·누적 셈');
 const p=B.nextPlay(b,T+7*HOURMS);
 eq([p,b.pq,b.notes,b.rvPlay,b.mon.wolf.ribKills,b.mon.boar.note,b.cur.q],[3,0,{play:3,n:0,lastQ:-99},{play:3,n:0,ids:{},lastQ:-99},0,1,0],'놀이 +1: 놀이마다 세는 칸을 0으로, 놓친 쪽지는 다시 자격');
 eq(b.log,[{p:2,d:d0,age:8,q:8,f:7,nw:7,en:[1,0],qz:[0,0],rd:[7,7],rv:[0,0],s:90}],'놀이 요약을 log에');
 B.nextPlay(b,T+8*HOURMS);eq(b.log.length,1,'아무것도 안 한 놀이는 요약에 넣지 않음');
 for(let i=0;i<40;i++){fill(b,1,{now:T+9*HOURMS});B.nextPlay(b,T+9*HOURMS)}eq(b.log.length,30,'놀이 요약은 최근 30개');
 /* 날짜가 바뀌면 논 날 수 +1, 날짜 기록은 35일 */
 const c=mk();for(let i=0;i<40;i++){fill(c,2,{now:T+i*DAY});B.tick(c,T+i*DAY,60)}
 eq([c.tot.days,Object.keys(c.day).length,Object.keys(c.day)[0],c.day[B.dayOf(T+39*DAY)]],[40,35,B.dayOf(T+5*DAY),[2,2,60,2]],'논 날 수 40, 날짜 기록은 최근 35일');
 const rep=B.report(c,T+39*DAY);eq([rep.week,rep.all],[{q:14,f:14,nw:14,s:420,days:7},{plays:1,q:80,f:80,s:2400,days:40,villages:0}],'보호자 기록: 이번 주(최근 7일)·전체');
 const r2=mk();B.answered(r2,story(8,1),'miss',{now:T,age:8});B.answered(r2,story(8,2),'miss',{now:T,age:8});B.answered(r2,story(8,2),'miss',{now:T,age:8});B.answered(r2,eng(8),'first',{now:T,age:8});
 eq([B.report(r2,T).missed,B.report(r2,T).rate],[[{id:story(8,2).id,miss:2},{id:story(8,1).id,miss:1}],{rd:[3,0],qz:[0,0],en:[1,1]}],'자주 놓친 글(많이 놓친 순)·분류별 [푼 수, 한 번에 맞힌 수]');
 ok(!/%|등|순위|평균보다/.test(JSON.stringify(B.report(c,T))),'기록 값에 비율·순위·비교 없음(숫자 사실만)');
 /* 하루 시간: 기본 30분, 넘으면 졸림, 결전 중에는 미룸, 보호자 15분, 다음 날 풀림 */
 const s=mk();B.tick(s,T,1799);eq(B.sleepy(s,T),false,'29분 59초: 아직');B.tick(s,T,1);eq([B.sleepy(s,T),s.today],[true,{d:B.dayOf(T),s:1800,ext:0}],'30분이 되면 쉬기 권유');
 eq(B.sleepy(s,T,{finale:true}),false,'결전 중이면 결전이 끝난 뒤로 미룸');
 eq([B.extend(s,T),B.sleepy(s,T)],[15,false],'보호자 15분 더');B.tick(s,T,900);eq(B.sleepy(s,T),true,'45분에 다시');
 eq(B.sleepy(B.restore(clone(s),{now:T}),T),true,'같은 날 다시 열어도 이 화면부터(저장 왕복)');
 eq(B.sleepy(s,T+DAY),false,'다음 날은 풀림');B.tick(s,T+DAY,10);eq(s.today,{d:B.dayOf(T+DAY),s:10,ext:0},'날짜가 바뀌면 0부터(늘려 준 분도)');
 const n0=mk();B.setOpt(n0,'day',0);B.tick(n0,T,9999);eq(B.sleepy(n0,T),false,'하루 시간 "없음"');
 for(const v of [20,45,60]){const x=mk();B.setOpt(x,'day',v);B.tick(x,T,v*60-1);const pre=B.sleepy(x,T);B.tick(x,T,1);eq([pre,B.sleepy(x,T)],[false,true],'하루 '+v+'분')}
 withBook({DAY_DEFAULT:0},()=>eq([B.fresh(T,1).set.day,B.restore({set:{day:7}},{now:T}).set.day],[0,0],'DAY_DEFAULT 상수 하나로 기본값을 바꿀 수 있음'));
}

/* B-12 '처음부터 시작'은 기록을 지우지 않음 / 모든 기록 지우기는 따로 */
{const st=new Store(),h=B.open(st,KS,{now:T,seed:4242}),b=h.book;
 let state=Object.assign(C.fresh(8),{seed:4242,gold:500,index:63});state.run.no=3;
 for(const k of ['wolf','boar'])Object.assign(b.mon[k],{foot:T,plays:2,kills:40,note:1});
 kills(b,'wolf',1);fill(b,5);const sp=B.nextSpecial(b,ctxOf({index:63,run:3}));B.answered(b,sp.q,'first',{now:T,age:8,run:3,special:'note'});
 kills(b,'boar',1);B.kingWon(b,{now:T,stars:[1,1,1],village:'meadow'});B.answered(b,story(8,140),'miss',{now:T,age:8,run:3});
 b.shiny.miss=2;B.shinyChance(b,CH({run:3}));B.shinySpawned(b);B.nextSpecial(b,ctxOf({index:63,run:3}));
 B.save(st,KS,h);st.setItem(KS.run,JSON.stringify(Object.assign({},state,{version:3})));
 const keep=clone(b);
 /* 화면의 #reset과 같은 일: 판 상태만 새로 만들고(Combat.fresh), 기록에는 resetVillage만 */
 state=Object.assign(C.fresh(state.age),{seed:B.orderFor(b,8).seed});
 const next=B.resetVillage(b,T+MIN,{age:8,used:{story:50,common:5,math:6,english:2},bank:1,latest:1});
 B.save(st,KS,h);st.setItem(KS.run,JSON.stringify(Object.assign({},state,{version:3})));
 const after=B.open(st,KS,{now:T+MIN,knows}).book;
 eq([state.gold,state.index,state.meta.stamps.length],[20,0,0],'판 저장은 새로(금화·문제 번호·도장)');
 for(const k of ['mon','medal','vil','rv','seen','tot','day','log','set','play','pq','made','from','drop'])eq(after[k],keep[k],"'처음부터 시작' 뒤에도 기록 칸 "+k+' 유지');
 eq([after.mon.wolf.card>0,after.medal.king.n,after.rv.length,B.cells(after)],[true,1,1,B.cells(keep)],'친구 카드·훈장·복습 대기열이 남아 있음');
 eq([after.order.seed,state.seed,next],[4242,4242,{seed:4242,off:{story:50,common:5,math:6,english:2},bank:1}],'이어 순서 씨앗 유지, 쓴 만큼 순번을 밀어 같은 글이 곧바로 반복되지 않게');
 eq([after.pend,after.shiny.guest,after.shiny.miss,after.shiny.run,after.shiny.f],[null,null,2,0,0],'그 판에 묶인 칸만 풀림(걸린 특별 문제 · 손님은 떠나고 다음 기회 확정)');
 ok(st.m.has(KS.book)&&JSON.parse(st.getItem(KS.book)).medal.king.n===1,'기록 열쇠가 저장소에 그대로 있음');
 withBook({ON:false},()=>{const x=clone(after);B.resetVillage(after,T,{age:8,used:{story:9}});eq(after,x,'?book=0이면 아무것도 바꾸지 않음')});
 /* 모든 기록 지우기(보호자 화면에서만) */
 B.swapIn(st,KS,after,st.getItem(KS.run),{now:T});
 ok(B.wipeAll(st,KS),'모든 기록 지우기');eq([st.m.has(KS.book),st.m.has(KS.run),st.m.has(KS.bak),B.open(st,KS,{now:T}).status],[false,false,false,'new'],'두 열쇠와 되돌리기 사본까지 비움');
}

/* B-13 수첩을 끄면(?book=0) 규칙이 아무것도 바꾸지 않음 + 방치·틀리기만으로는 진행 0 */
withBook({ON:false},()=>{const b=mk(),x=clone(b);
 B.answered(b,story(8,0),'first',{now:T,age:8,run:1});kills(b,'wolf',50);B.foxSaved(b,{now:T});B.kingWon(b,{now:T,stars:[1,1,1],village:'meadow',perfect:true});B.rushed(b,{now:T});B.tick(b,T,100);
 eq([B.nextSpecial(b,ctxOf({index:9})),B.shinyChance(b,CH()),B.beginSession(b,T+9*HOURMS),B.sleepy(b,T),B.friends(b)],[null,null,false,false,[]],'BOOK.ON=false: 특별 문제·기회·새 놀이·졸림·친구 없음');
 eq(b,x,'BOOK.ON=false: 기록이 한 글자도 안 바뀜')});
{/* 방치(답 없음)·틀리기만 30분: 발자국·카드·훈장·반짝 = 0. 정답 화살은 한 번에 맞혀야만 나가므로 처치 사건이 오지 않는다 */
 const idle=mk();for(let i=0;i<1800;i++)B.tick(idle,T,1);
 const wrong=mk();for(let i=0;i<300;i++){B.answered(wrong,story(8,i%150),i%2?'miss':'second',{now:T,age:8,run:1});B.tick(wrong,T,6);B.shinyChance(wrong,CH({asked:i,boost2:false}));const s=B.nextSpecial(wrong,ctxOf({index:i}));if(s)B.answered(wrong,s.q,'miss',{now:T,age:8,run:1,special:s.kind})}
 for(const [name,b] of [['방치',idle],['틀리기만',wrong]])eq([B.cells(b),B.MEDALS.reduce((s,k)=>s+b.medal[k].n,0),B.KINDS.filter(k=>b.mon[k].shiny||b.mon[k].card||b.mon[k].foot).length,b.shiny.run,b.seen.length],[0,0,0,0,0],name+' 30분: 발자국·카드·훈장·반짝 진행 0');
 ok(wrong.rv.length>0&&wrong.rv.length<=200,'틀리기만 하면 복습 대기열만 쌓임('+wrong.rv.length+')');
}

/* B-14 설정 · 영어 비중 · 보호자 문턱 · 이어 순서 인터페이스 */
{const b=mk();
 eq([B.setOpt(b,'en','more',{age:8}),b.set.en,B.setOpt(b,'en','more',{age:9}),b.set.en],[false,'std',true,'more'],'"영어 조금 더"는 9세부터');
 eq([B.mixOf(b,10),B.mixOf(b,7)],[{math:6,common:8,english:6},{math:13,common:6,english:1}],'"조금 더": 10세 6·8·6, 7세는 보통 그대로');
 B.setOpt(b,'en','off');eq([B.mixOf(b,9),B.mixOf(b,8)],[{math:8,common:12,english:0},{math:10,common:10,english:0}],'"끄기": 영어 0');
 eq([B.setOpt(b,'en','lots'),B.setOpt(b,'day',25),B.setOpt(b,'day',45),B.setOpt(b,'sfx',0),B.setOpt(b,'nope',1),b.set],[false,false,true,true,false,{en:'off',day:45,sfx:0}],'설정 값 범위');
 const m=B.mixOf(b,9);m.math=99;eq(B.mixOf(b,9).math,8,'mixOf는 복사본');
 /* 보호자 문턱: 글로 적힌 세 자리 수(0·1 없는 자리), 결정적 */
 const NAMES={2:'이',3:'삼',4:'사',5:'오',6:'육',7:'칠',8:'팔',9:'구'};
 for(let s=1;s<=300;s++){const g=B.gate(s);ok(/^[2-9]{3}$/.test(g.digits)&&g.text===NAMES[g.digits[0]]+'백'+NAMES[g.digits[1]]+'십'+NAMES[g.digits[2]],'문턱 수 '+g.digits+' = '+g.text)}
 eq(B.gate(5),B.gate(5),'같은 씨앗 = 같은 수');ok(new Set(Array.from({length:200},(_,i)=>B.gate(i+1).digits)).size>100,'씨앗마다 다른 수');
 /* 이어 순서: 새 판에 넘길 {seed, off, bank}. 문제은행 판(bank)은 한 바퀴가 끝나는 곳에서만 올림 */
 const o=mk(31);eq(B.orderFor(o,8),{seed:31,off:{story:0,common:0,math:0,english:0},bank:0},'처음: 순번 0, 판 미정(0 = 판 저장의 state.bank를 따름)');
 eq(B.advanceOrder(o,8,{story:40,common:3,math:4,english:1},{bank:1,latest:2,size:{story:199,common:30,math:60,english:8}}),{seed:31,off:{story:40,common:3,math:4,english:1},bank:1},'한 판을 마치면 쓴 만큼 더함(바퀴 도중에는 예전 판 유지)');
 B.advanceOrder(o,8,{story:150,common:9,math:9,english:2},{bank:1,latest:2,size:{story:199,common:30,math:60,english:8}});eq(o.order.off[8].story,190,'누적');
 eq(B.advanceOrder(o,8,{story:20},{bank:1,latest:2,size:{story:199,common:30,math:60,english:8}}),{seed:31,off:{story:0,common:0,math:0,english:0},bank:2},'읽기 한 바퀴가 끝나면 최신 판으로 올리고 새 바퀴 처음부터');
 eq(B.advanceOrder(o,8,{story:30},{bank:2,latest:2}).off.story,30,'최신 판이면 그대로 이어 감');
 eq([B.orderFor(o,9).off.story,B.orderFor(o,9).bank],[0,0],'나이마다 따로');
 eq(B.restore(clone(o),{now:T}).order,o.order,'이어 순서 저장 왕복');
 withBook({FLAGS:{order:false}},()=>eq(B.orderFor(o,8).off,{story:0,common:0,math:0,english:0},'?order=0이면 순번을 밀지 않음'));
 const nv=mk(31);fill(nv,3);eq([B.newVillage(nv,T,{age:8,used:{story:3},bank:1,latest:1}),nv.play,nv.pq],[{seed:31,off:{story:3,common:0,math:0,english:0},bank:1},2,0],'새 마을: 놀이 +1, 이어 순서 더함');
}

/* B-15 파일 조건: 브라우저 전역, 순수 함수(시계·난수·저장소·통신에 손대지 않음), 배포 목록 */
{const srcB=fs.readFileSync(path.join(__dirname,'book.js'),'utf8'),win={};
 vm.runInNewContext(srcB,{window:win});
 ok(win.Book&&win.Book.V===1&&typeof win.Book.nextSpecial==='function','브라우저에서는 window.Book');
 eq(JSON.stringify(win.Book.restore(clone(played),{now:played.at})),JSON.stringify(B.restore(clone(played),{now:played.at})),'브라우저 전역과 node 모듈이 같은 결과');
 const code=srcB.replace(/\/\*[\s\S]*?\*\//g,'');
 for(const w of ['Date.now','Math.random','localStorage','sessionStorage','fetch(','XMLHttpRequest','sendBeacon','document.','navigator.','setTimeout','setInterval'])ok(!code.includes(w),'book.js는 '+w+'를 쓰지 않음(시계·난수·저장소·통신은 인자로만)');
 const buf=fs.readFileSync(path.join(__dirname,'book.js'));ok(!(buf[0]===0xEF&&buf[1]===0xBB)&&!srcB.includes('\uFFFD')&&Buffer.byteLength(srcB.replace(/\r\n/g,'\n'))<60*1024,'book.js BOM 없음·60KB 이하('+Buffer.byteLength(srcB.replace(/\r\n/g,'\n'))+')');
 const pages=fs.readFileSync(path.join(__dirname,'scripts/build-pages.cjs'),'utf8');ok(/'book\.js'/.test(pages)&&/'notes\.js'/.test(pages),'배포 목록(build-pages.cjs)에 book.js·notes.js');
 {const page=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');ok(page.includes('<script src="notes.js')&&page.indexOf('<script src="book.js')>page.indexOf('<script src="notes.js')&&page.indexOf('<script src="bookui.js')>page.indexOf('<script src="book.js'),'2단계: index.html이 notes.js · book.js를 인라인 스크립트 앞에, bookui.js를 뒤에 불러옴');
  ok(pages.includes("'bookui.js'"),'배포 목록에 bookui.js')}
}
if(fails.length)process.exitCode=1;
console.log((fails.length?'FAIL '+fails.length+' / ':'PASS ')+n+' book assertions (콘텐츠 '+A_COUNT+' · 기록 '+(n-A_COUNT)+').');
