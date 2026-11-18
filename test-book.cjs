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

/*__B__*/
console.log('PASS '+n+' book assertions (콘텐츠 '+A_COUNT+').');
