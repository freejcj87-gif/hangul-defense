/* node test-questions.cjs : 연령별 문제은행(questions.js + questions-gen.js) 단독 검사 */
const assert=require('node:assert');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const Q=require('./questions.js');
const GEN=require('./questions-gen.js');

let n=0;
const ok=(v,msg)=>{assert.ok(v,msg);n++;};
const eq=(a,b,msg)=>{assert.deepStrictEqual(a,b,msg);n++;};
const H=Q.hangul;
const KEYS=['id','age','mode','prompt','passage','speak','choices','answer'];
const CHOICES={7:{story:3},8:{story:3},9:{story:4},10:{story:5}};
const answerKey=q=>q.mode==='story'?q.passage:q.choices[q.answer];
const all=(age,mode)=>Array.from({length:Q.count(age,mode)},(_,i)=>Q.get(age,mode,i));
const isGen=q=>/-g\d{3,}$/.test(q.id);
const p2=i=>String(i).padStart(2,'0'),p3=i=>String(i).padStart(3,'0');
/* 손 문항 a8-story-01…, 그 뒤 생성 문항 a8-quiz-g001… */
const wantIds=list=>{let h=0,g=0;return list.map(q=>isGen(q)?q.id.replace(/-g\d+$/,'')+'-g'+p3(++g):q.id.replace(/-\d+$/,'')+'-'+p2(++h));};
const segments=list=>[list.filter(q=>!isGen(q)),list.filter(isGen)];
const LEVEL=new Map();
for(const a of Q.AGES)for(const m of ['story','quiz'])for(const g of GEN[a][m])LEVEL.set(g.id,g.level);
const levelOf=q=>LEVEL.get(q.id)||2;

/* 1. 음절 분해 헬퍼 */
ok(H.isSyllable('나')&&!H.hasBatchim('나'),"'나'는 받침 없음");
ok(H.hasBatchim('곰')&&!H.hasDoubleBatchim('곰'),"'곰'은 홑받침");
ok(H.hasBatchim('닭')&&H.hasDoubleBatchim('닭'),"'닭'은 겹받침");
ok(H.hasDoubleBatchim('값')&&H.hasDoubleBatchim('앉')&&H.hasDoubleBatchim('많'),'값·앉·많은 겹받침');
ok(H.hasBatchim('밖')&&!H.hasDoubleBatchim('밖'),"'밖'(ㄲ)은 쌍받침이지 겹받침이 아님");
eq([H.cho('까'),H.jung('까'),H.jong('까')],[1,0,0],"'까' 분해");
eq(H.jong('힣'),27,"마지막 음절 '힣'");
ok(H.hasTenseInitial('끼')&&H.hasTenseInitial('쓰')&&!H.hasTenseInitial('기'),'된소리 초성');
ok(H.hasDiphthong('의')&&H.hasDiphthong('과')&&H.hasDiphthong('외')&&!H.hasDiphthong('여'),'이중모음 목록');
ok(!H.isSyllable('a')&&!H.isSyllable('ㄱ')&&!H.isSyllable('🍎')&&!H.isSyllable('가나')&&H.jong('a')===-1,'음절이 아닌 입력');
ok(H.isWord('바나나')&&!H.isWord('바 나')&&!H.isWord('')&&!H.isWord('나무.'),'isWord');
eq([H.sentences('가요.'),H.sentences('가요? 와요!\n봐요.'),H.sentences('나무')],[1,3,0],'문장 수');
eq(H.compactLength('우리 같이\n가요.'),7,'공백 제외 글자 수');

/* 2. 상수와 전체 검증 */
eq(Q.AGES,[7,8,9,10]);
eq(Q.MODES,['story'],'0.11: 모드는 읽고 고르기 하나');
for(const a of Q.AGES)for(const m of Q.MODES){
  const label=Q.LEVELS[a][m];
  ok(typeof label==='string'&&label.length>0&&label.length<=12,`LEVELS[${a}].${m} 라벨`);
  ok(Q.count(a,m)>=12,`${a}세 ${m} 12문항 이상`);
}
eq(new Set(Q.AGES.flatMap(a=>Q.MODES.map(m=>Q.LEVELS[a][m]))).size,4,'라벨 4개가 서로 다름');
for(const a of Q.AGES)eq(Object.keys(Q.LEVELS[a]),['story'],`LEVELS[${a}]에 sound 없음`);
eq(Q.validate(),[],'validate()는 빈 배열');
eq(Q.genRejected,[],'생성 문항이 하나도 거부되지 않음');

/* 2-1. 생성 문항 파일 형태: {나이: {story, quiz}}, 항목은 은행 형식 + level (0.11: sound 묶음 삭제) */
for(const a of Q.AGES){
  eq(Object.keys(GEN[a]),['story','quiz'],`questions-gen.js ${a}세 묶음 둘(sound 없음)`);
  ok(['story','quiz'].every(m=>Array.isArray(GEN[a][m])),`questions-gen.js ${a}세 묶음은 배열`);
  for(const m of ['story','quiz'])GEN[a][m].forEach((g,i)=>{
    eq(g.id,`a${a}-${m}-g${p3(i+1)}`,g.id+' 생성 id');
    eq([g.age,g.mode],[a,m],g.id+' age/mode');
    ok([1,2,3].includes(g.level),g.id+' level 1~3');
    eq(Object.keys(g),['id','age','mode'].concat(m==='quiz'?['cat']:[],['prompt','passage','speak','choices','answer','note','level']),g.id+' 키');
  });
  for(const m of Q.MODES)eq(Q.count(a,m),all(a,m).filter(q=>!isGen(q)).length+GEN[a][m].length,`${a}세 ${m}: 생성 문항이 모두 합쳐짐`);
  eq(Q.quizCount(a),Array.from({length:Q.quizCount(a)},(_,i)=>Q.quiz(a,i)).filter(q=>!isGen(q)).length+GEN[a].quiz.length,`${a}세 quiz: 생성 문항이 모두 합쳐짐`);
}
for(const a of Q.AGES)ok(GEN[a].quiz.filter(q=>q.cat==='math').length>=45,`${a}세 수학 생성 45개 이상`);
for(const a of [9,10])ok(GEN[a].quiz.filter(q=>q.cat==='english').length>=45,`${a}세 영어 생성 45개 이상`);
eq(GEN[7].quiz.filter(q=>q.cat==='english').length+GEN[8].quiz.filter(q=>q.cat==='english').length,0,'7·8세 영어는 생성하지 않음');

/* 3. get 계약: 형태·순환·불변 */
const ids=new Set();
for(const a of Q.AGES)for(const m of Q.MODES){
  const cnt=Q.count(a,m),list=all(a,m),want=wantIds(list);
  ok(list.findIndex(isGen)<0||list.slice(list.findIndex(isGen)).every(isGen),`${a}/${m} 손 문항이 먼저, 생성 문항이 뒤`);
  for(let i=0;i<cnt;i++){
    const q=Q.get(a,m,i),tag=`${a}/${m}/${i}`;
    eq(Object.keys(q),KEYS,tag+' 키');
    eq(q.id,want[i],tag+' id');
    ok(!ids.has(q.id),tag+' id 유일');ids.add(q.id);
    eq([q.age,q.mode],[a,m],tag+' age/mode');
    ok(typeof q.prompt==='string'&&q.prompt.trim().length>0,tag+' prompt');
    ok(Array.isArray(q.choices)&&q.choices.every(c=>typeof c==='string'&&c.length>0),tag+' choices');
    eq(q.choices.length,CHOICES[a][m],tag+' 보기 개수');
    eq(new Set(q.choices).size,q.choices.length,tag+' 보기 중복 없음');
    ok(Number.isInteger(q.answer)&&q.answer>=0&&q.answer<q.choices.length,tag+' answer 범위');
    ok(q.passage.length>0,tag+' passage');eq(q.speak,q.passage,tag+' speak=passage');ok(!/\r/.test(q.passage),tag+' 줄바꿈은 \\n');
    eq(Q.checkCommon(q),[],tag+' 공통 규칙');
    eq(Q.get(a,m,i+cnt),q,tag+' 순환(+count)');
    if(i<20){
      eq(Q.get(a,m,i+cnt*3),q,tag+' 순환(+3count)');
      const pristine=JSON.stringify(q),victim=Q.get(a,m,i);
      ok(victim!==Q.get(a,m,i)&&victim.choices!==Q.get(a,m,i).choices,tag+' 매번 새 객체');
      victim.choices[0]='오염';victim.choices.push('추가');victim.answer=99;victim.prompt='';victim.passage='x';victim.id='x';
      eq(JSON.stringify(Q.get(a,m,i)),pristine,tag+' 변형해도 은행 오염 없음');
    }
  }
}
eq(ids.size,Q.AGES.reduce((s,a)=>s+Q.count(a,'story'),0),'id 총수');
ok([...ids].every(id=>/^a(7|8|9|10)-story-/.test(id)),'읽기 문항뿐(sound id 없음)');
ok(ids.size>=56,'읽기 56문항 이상');
for(const [a,min] of [[7,150],[8,150],[9,80],[10,60]])ok(GEN[a].story.length>=min,`0.12 읽기 1차 확충: ${a}세 새 문항 ${min}개 이상(현재 ${GEN[a].story.length})`);

/* 4. 나이별 변별(전수) */
for(const m of Q.MODES){
  const sets=Q.AGES.map(a=>all(a,m));
  const longest=Math.max(...sets.map(s=>s.length));
  for(let i=0;i<longest;i++){
    const qs=Q.AGES.map(a=>Q.get(a,m,i));
    eq(new Set(qs.map(answerKey)).size,4,`${m} index ${i}: 나이별 정답/지문이 모두 다름`);
    eq(new Set(qs.map(q=>q.choices.join('|'))).size,4,`${m} index ${i}: 나이별 보기가 모두 다름`);
  }
  /* 지문은 한 나이에만. 같은 나이 안에서는 (지문, 질문)이 한 번만(0.12: 한 지문에 질문 여러 개, 7세는 보기까지 같아야 같은 문항) */
  const owner=new Map(),per=new Map();
  Q.AGES.forEach((a,k)=>sets[k].forEach(q=>{
    const key=answerKey(q),full=key+'\n'+q.prompt+(a===7?'\n'+q.choices.slice().sort().join('|'):'');
    ok(!owner.has(key)||owner.get(key)===a,`${q.id}: 정답/지문 '${key}'이 다른 나이에도 있음`);
    owner.set(key,a);per.set(a+'|'+full,(per.get(a+'|'+full)||0)+1);
  }));
  for(const [k,c] of per)ok(c===1,`${m} ${k}: 같은 지문·질문 ${c}문항`);
  Q.AGES.forEach((a,k)=>{
    for(const q of sets[k]){
      eq(Q.checkLevel(a,m,q),[],`${q.id}: 자기 수준(${a}세) 규칙 통과`);
      for(const other of Q.AGES)if(other!==a)
        ok(Q.checkLevel(other,m,q).length>0,`${q.id}: ${other}세 규칙은 통과하면 안 됨`);
    }
  });
}
const chars=s=>Array.from(s);
/* 7세: 낱말 → 그림(보기 그림 3개) 또는 그림 → 낱말(보기 낱말 3개). 낱말은 언제나 받침 없는 1~3음절 */
const word7=w=>H.isWord(w)&&chars(w).length<=3&&!chars(w).some(H.hasBatchim);
const pic7=c=>!/[ㄱ-ㆎ가-힣A-Za-z0-9]/.test(c)&&chars(c.replace(/\uFE0F/g,'')).length===1;
for(const q of all(7,'story')){
  if(word7(q.passage))ok(q.choices.every(pic7),q.id+' 7세: 보기는 이모지 1개');
  else ok(pic7(q.passage)&&q.choices.every(word7),q.id+' 7세: 그림 지문이면 보기는 받침 없는 낱말');
}
for(const q of all(8,'story'))ok(H.sentences(q.passage)===1&&H.compactLength(q.passage)>=10&&H.compactLength(q.passage)<=20,q.id+' 8세: 한 문장');
for(const q of all(9,'story'))ok(H.sentences(q.passage)===2&&q.passage.split('\n').length===2,q.id+' 9세: 두 문장');
for(const q of all(10,'story')){
  const s=H.sentences(q.passage);
  ok((s===3||s===4)&&q.passage.split('\n').length===s,q.id+' 10세: 3~4문장');
}
/* 4-1. 8세 이상 읽기: 글자 찾기로 못 풀게 오답 하나 이상이 지문에 나오는 말(독립 구현), 8세는 질문에 정답 없음 */
const PART=/(에서|에게|으로|이에요|예요|은|는|이|가|을|를|에|의|와|과|로|도)$/;
const stemOf=w=>{const s=w.replace(/[^가-힣]/g,''),t=s.replace(PART,'');return t||s};
const inText=(c,p)=>p.includes(c)||p.split(/\s+/).map(stemOf).includes(stemOf(c.split(/\s+/)[0]));
for(const a of [8,9,10])for(const q of all(a,'story')){
  const wrong=q.choices.filter((_,i)=>i!==q.answer);
  ok(wrong.some(c=>inText(c,q.passage)),q.id+': 오답 중 하나 이상이 지문에 나옴 '+wrong.join('/'));
  if(a===8){ok(!q.prompt.includes(q.choices[q.answer]),q.id+': 질문에 정답이 없음');ok(q.passage.includes(q.choices[q.answer]),q.id+': 8세 정답은 지문에 그대로');}
}
eq(all(8,'story').filter(q=>q.choices.filter((c,i)=>i!==q.answer&&q.passage.includes(c)).length===0).map(q=>q.id),[],'8세 읽기: 같은 글자 찾기만으로 100% 풀리는 문항 없음');
/* 4-2. 9·10세 읽기: 정답이 혼자 가장 긴 보기인 문항이 1/보기수 + 10%p 이하 */
for(const a of [9,10]){
  const list=all(a,'story'),sole=list.filter(q=>{const L=q.choices.map(c=>H.compactLength(c)),mx=Math.max(...L);return L[q.answer]===mx&&L.filter(v=>v===mx).length===1});
  ok(sole.length<=list.length*(1/CHOICES[a].story+.1),`${a}세 읽기: 정답=가장 긴 보기 ${sole.length}/${list.length}`);
}
/* 정답 위치 분포: 묶음 전체 50% 이하·모든 위치 사용, 3연속은 손·생성 구간마다 */
for(const a of Q.AGES)for(const m of Q.MODES){
  const list=all(a,m),pos=list.map(q=>q.answer),tally={};
  pos.forEach(p=>{tally[p]=(tally[p]||0)+1;});
  ok(Object.values(tally).every(c=>c*2<=pos.length),`${a}/${m} 한 위치 50% 이하`);
  eq(Object.keys(tally).length,CHOICES[a][m],`${a}/${m} 모든 위치가 정답으로 쓰임`);
  for(const seg of segments(list)){const p=seg.map(q=>q.answer);ok(p.every((v,i)=>i<2||!(v===p[i-1]&&v===p[i-2])),`${a}/${m} 3연속 같은 위치 없음`);}
}

/* 5. 잘못된 입력 */
for(const m of Q.MODES){
  for(const bad of [6,11,'8',NaN,undefined,null,8.5]){
    eq(Q.get(bad,m,3),Q.get(8,m,3),`age ${String(bad)} → 8세`);
    eq(Q.count(bad,m),Q.count(8,m),`count age ${String(bad)} → 8세`);
  }
}
/* 0.11: mode는 무엇을 넣어도(예전 'sound' 포함) 읽기 문항 */
for(const a of Q.AGES)for(const bad of ['x',undefined,null,'SOUND','sound',0]){
  eq(Q.get(a,bad,2),Q.get(a,'story',2),`mode ${String(bad)} → story`);
  eq(Q.get(a,bad,2).mode,'story',`mode ${String(bad)}로 불러도 읽기 문항`);
  eq(Q.count(a,bad),Q.count(a,'story'),`count mode ${String(bad)} → story`);
}
for(const a of Q.AGES)for(const m of Q.MODES){
  const cnt=Q.count(a,m);
  eq(Q.get(a,m,-1),Q.get(a,m,cnt-1),'index -1 → 마지막 문항');
  eq(Q.get(a,m,1.5),Q.get(a,m,1),'index 1.5 → 1');
  for(const bad of [NaN,undefined,'2',Infinity])eq(Q.get(a,m,bad),Q.get(a,m,0),`index ${String(bad)} → 0`);
}
eq(Q.get(6,'x',-1),Q.get(8,'story',Q.count(8,'story')-1),'전부 잘못된 입력');

/* 6. validate가 실제로 오류를 잡는지(스냅숏을 고장 내서 확인) */
const broken=fn=>{const s=Q.snapshot();fn(s);return Q.validate(s);};
eq(Q.validate(Q.snapshot()),[],'스냅숏 그대로는 통과');
ok(broken(s=>{s[9].story[0].passage=s[9].story[0].speak='한 문장만 있어요.';}).length>0,'9세 story 문장 수');
ok(broken(s=>{s[10].story[0].choices.pop();}).length>0,'10세 story 보기 4개');
ok(broken(s=>{s[10].story[0].choices[1]=s[10].story[0].choices[2];}).some(e=>e.includes('보기 중복')),'보기 중복');
ok(broken(s=>{s[7].story[0].answer=3;}).length>0,'answer 범위');
ok(broken(s=>{s[7].story[0].choices[0]='나무';}).length>0,'7세 story 보기에 한글');
ok(broken(s=>{s[8].story[0].speak='다른 말';}).length>0,'story speak≠passage');
ok(broken(s=>{s[8].story[2].id='a8-story-01';}).length>0,'id 중복·형식');
ok(broken(s=>{s[8].story.length=11;}).some(e=>e.includes('12문항')),'12문항 미만');
ok(broken(s=>{s[10].story[3].passage=s[10].story[3].speak=s[10].story[2].passage;s[10].story[3].prompt=s[10].story[2].prompt;}).some(e=>e.includes('중복')),'묶음 안 지문·질문 중복');
ok(broken(s=>{s[7].story[0].passage=s[7].story[0].speak='🌳';s[7].story[0].choices=['나무','나비','너구리'];}).length===0,'7세 그림 지문 + 받침 없는 낱말 보기는 통과');
ok(broken(s=>{s[7].story[0].passage=s[7].story[0].speak='🌳';s[7].story[0].choices=['나무','나비','단풍'];}).length>0,'7세 그림 지문 보기에 받침 낱말');
ok(broken(s=>{s[10].story[0].passage=s[10].story[0].speak=s[9].story[0].passage;}).some(e=>e.startsWith('a10-story-01')&&e.includes('a9-story-01와 중복')),'나이 간 지문 중복');
ok(broken(s=>{s[8].story[0].mode='sound';}).some(e=>e.startsWith('a8-story-01')),'mode sound인 문항은 거부');
ok(broken(s=>{s[8].story[0].id='a8-sound-01';}).some(e=>e.startsWith('a8-sound-01')&&e.includes('id')),'sound id는 거부');
ok(Q.checkLevel(8,'sound',Q.get(8,'story',0)).length>0,'checkLevel: sound 수준은 없음');
ok(!('sound' in Q.snapshot()[8]),'snapshot에 sound 묶음 없음');
ok(broken(s=>{for(const q of s[9].story.slice(0,3)){const a=q.choices[q.answer];q.choices=[a].concat(q.choices.filter(c=>c!==a));q.answer=0;}}).some(e=>e.includes('연속')),'정답 위치 3연속');
ok(broken(s=>{for(const q of s[7].story){const a=q.choices[q.answer];q.choices=[a].concat(q.choices.filter(c=>c!==a));q.answer=0;}}).some(e=>e.includes('50%')),'정답 위치 쏠림');
ok(broken(s=>{delete s[9].story;}).length>0,'묶음 누락');
const hitAny=(fn,word)=>broken(fn).some(e=>e.includes(word));
ok(hitAny(s=>{s[8].story[0].choices=['마당','지붕','연못'];},'지문 속 말'),'8세 읽기 오답이 모두 지문 밖');
ok(hitAny(s=>{s[10].story[11].choices=['꽃이 피었어요','비가 왔어요','바람이 불었어요','낙엽이 떨어졌어요','눈이 내렸어요'];},'지문 속 말'),'10세 읽기 오답이 모두 지문 밖');
ok(hitAny(s=>{s[8].story[9].prompt='감나무에 무엇이 열렸나요?';},'질문에 정답'),'8세 질문이 정답을 드러냄');
ok(hitAny(s=>{const l=s[9].quiz;l[l.length-1].id='a9-quiz-g999';},'id는'),'생성 문항 id 순번');
ok(hitAny(s=>{s[9].quiz.push(s[9].quiz.shift());},'생성 문항 앞에'),'손 문항이 생성 문항 뒤에 있음');
ok(hitAny(s=>{for(const q of s[9].story)q.choices[q.answer]+=' 그리고 아주 길게 늘인 말';},'가장 긴 보기'),'9세 읽기 정답=가장 긴 보기 과다');

/* 7. 기존 문항 흡수 */
const LEGACY_STORY=[
  {text:'밤새 비가 와서 다리가 물에 잠겼어요.\n꼬꼬는 친구를 만나러 언덕길로 돌아갔어요.',q:'꼬꼬는 왜 언덕길로 갔나요?',a:'다리가 물에 잠겨서'},
  {text:'꼬꼬는 꽃에 물을 주었어요.\n다음 날 작은 꽃이 활짝 피었어요.',q:'꼬꼬가 꽃을 위해 한 일은 무엇인가요?',a:'물을 주었어요'}
];
LEGACY_STORY.forEach((old,i)=>{
  const q=Q.get(10,'story',i);
  ok(q.passage.startsWith(old.text+'\n'),`기존 독해 ${i+1}: 원래 두 문장으로 시작`);
  eq([q.prompt,q.choices[q.answer]],[old.q,old.a],`기존 독해 ${i+1}: 질문·정답 유지`);
});

/* 9. 퀴즈(상식·수학·영어) 묶음 */
const QKEYS=['id','age','mode','cat','prompt','passage','speak','choices','answer'];
const QCHOICES={7:3,8:3,9:4,10:4},QMAX={7:10,8:20,9:30,10:40},QMIN={common:12,math:12,english:8};
const quizAll=a=>Array.from({length:Q.quizCount(a)},(_,i)=>Q.quiz(a,i));
eq(Q.CATS,{common:'상식',math:'수학',english:'영어'},'CATS');
eq(Q.MODES,['story'],'MODES에는 quiz가 없음');
const qids=new Set();
for(const a of Q.AGES){
  const list=quizAll(a),cnt=list.length,cats={common:0,math:0,english:0},keys=new Set(),want=wantIds(list);
  ok(cnt>=32,`${a}세 quiz 32문항 이상`);
  list.forEach((q,i)=>{
    const tag=`${a}/quiz/${i}`;
    eq(Object.keys(q),q.say?QKEYS.concat('say'):QKEYS,tag+' 키(note 없음, say는 있을 때만)');
    eq(q.id,want[i],tag+' id');
    ok(!qids.has(q.id)&&!ids.has(q.id),tag+' id 유일');qids.add(q.id);
    eq([q.age,q.mode],[a,'quiz'],tag+' age/mode');
    ok(Object.keys(QMIN).includes(q.cat),tag+' cat');cats[q.cat]++;
    ok(typeof q.prompt==='string'&&q.prompt.trim().length>0&&H.syllables(q.prompt)<=QMAX[a],tag+' prompt 길이');
    ok(typeof q.passage==='string'&&!/\r/.test(q.passage),tag+' passage');
    ok(typeof q.speak==='string'&&/[가-힣]/.test(q.speak),tag+' speak에 한글');
    eq(q.choices.length,QCHOICES[a],tag+' 보기 개수');
    ok(q.choices.every(c=>typeof c==='string'&&c.trim().length>0),tag+' choices');
    eq(new Set(q.choices).size,q.choices.length,tag+' 보기 중복 없음');
    ok(Number.isInteger(q.answer)&&q.answer>=0&&q.answer<q.choices.length,tag+' answer 범위');
    eq(Q.checkQuiz(a,q),[],tag+' checkQuiz');
    eq(Q.checkCommon(q),[],tag+' checkCommon은 quiz를 퀴즈 규칙으로');
    eq(Q.checkLevel(a,'story',q),[],tag+' checkLevel은 quiz를 퀴즈 규칙으로');
    const k=q.prompt+'\n'+q.passage;ok(!keys.has(k),tag+' 질문·지문 중복 없음');keys.add(k);
    eq(Q.quiz(a,i+cnt),q,tag+' 순환(+count)');
    eq(Q.quiz(a,i-cnt*2),q,tag+' 순환(-2count)');
    if(i<10){
      const pristine=JSON.stringify(q),victim=Q.quiz(a,i);
      ok(victim!==Q.quiz(a,i)&&victim.choices!==Q.quiz(a,i).choices,tag+' 매번 새 객체');
      victim.choices[0]='오염';victim.choices.push('추가');victim.answer=99;victim.cat='x';victim.speak='';victim.prompt='';
      eq(JSON.stringify(Q.quiz(a,i)),pristine,tag+' 변형해도 은행 오염 없음');
    }
  });
  Object.keys(QMIN).forEach(c=>ok(cats[c]>=QMIN[c],`${a}세 ${Q.CATS[c]} ${QMIN[c]}문항 이상(현재 ${cats[c]})`));
  /* 정답 위치 */
  const pos=list.map(q=>q.answer),tally={};
  pos.forEach(p=>{tally[p]=(tally[p]||0)+1;});
  ok(Object.values(tally).every(c=>c*2<=pos.length),`${a}/quiz 한 위치 50% 이하`);
  eq(Object.keys(tally).length,QCHOICES[a],`${a}/quiz 모든 위치가 정답으로 쓰임`);
  for(const seg of segments(list)){const p=seg.map(q=>q.answer);ok(p.every((v,i)=>i<2||!(v===p[i-1]&&v===p[i-2])),`${a}/quiz 3연속 같은 위치 없음`);}
  for(const c of Object.keys(QMIN)){const p=list.filter(q=>q.cat===c).map(q=>q.answer),t={};p.forEach(v=>{t[v]=(t[v]||0)+1});ok(Object.values(t).every(v=>v*2<=p.length),`${a}/quiz ${c} 묶음 한 위치 50% 이하`);}
  /* 7·8세 영어는 영어 보기를 읽지 않아도 풀림(그림·한국어 뜻 보기) */
  if(a<=8)for(const q of list.filter(q=>q.cat==='english'))ok(!q.choices.some(c=>/[A-Za-z]/.test(c)),q.id+': 7·8세 영어 보기에 영문 없음');
}
eq(qids.size,Q.AGES.reduce((s,a)=>s+Q.quizCount(a),0),'퀴즈 id 총수');
eq(Q.quiz(8,8).say,'일일구','119 정답 읽기(say)');
/* get에는 퀴즈가 섞이지 않음 */
for(const a of Q.AGES)for(const m of Q.MODES)ok(all(a,m).every(q=>q.mode===m&&!('cat' in q)),`${a}/${m}: get은 퀴즈를 내지 않음`);
/* 잘못된 입력 */
for(const bad of [6,11,'8',NaN,undefined,null,8.5]){
  eq(Q.quiz(bad,3),Q.quiz(8,3),`quiz age ${String(bad)} → 8세`);
  eq(Q.quizCount(bad),Q.quizCount(8),`quizCount age ${String(bad)} → 8세`);
}
for(const a of Q.AGES){
  eq(Q.quiz(a,-1),Q.quiz(a,Q.quizCount(a)-1),'quiz index -1 → 마지막 문항');
  eq(Q.quiz(a,1.5),Q.quiz(a,1),'quiz index 1.5 → 1');
  for(const bad of [NaN,undefined,'2',Infinity])eq(Q.quiz(a,bad),Q.quiz(a,0),`quiz index ${String(bad)} → 0`);
}
/* snapshot에 quiz 포함(note까지) */
const snap=Q.snapshot();
for(const a of Q.AGES){
  eq(snap[a].quiz.length,Q.quizCount(a),`snapshot ${a}세 quiz 개수`);
  ok(snap[a].quiz.every(q=>q.note===''),`snapshot ${a}세 quiz note`);
  eq(snap[a].quiz.map(q=>{const o=Object.assign({},q);delete o.note;return o;}),quizAll(a),`snapshot ${a}세 quiz 내용`);
}
/* validate가 퀴즈 오류를 잡는지 */
const hit=(fn,id,word)=>broken(fn).some(e=>e.startsWith(id)&&e.includes(word));
ok(hit(s=>{s[9].quiz[0].choices.pop();},'a9-quiz-01','보기 4개'),'퀴즈 9세 보기 개수');
ok(hit(s=>{s[7].quiz[1].choices.push('9');},'a7-quiz-02','보기 3개'),'퀴즈 7세 보기 개수');
ok(hit(s=>{delete s[8].quiz[2].speak;},'a8-quiz-03','speak'),'퀴즈 speak 누락');
ok(hit(s=>{s[8].quiz[3].speak='dog';},'a8-quiz-04','speak'),'퀴즈 speak에 한글 없음');
ok(hit(s=>{s[8].quiz[8].say='119';},'a8-quiz-09','say'),'퀴즈 say에 숫자');
ok(hit(s=>{const t=s[10].quiz[5],o=s[10].quiz[3];t.prompt=o.prompt;t.passage=o.passage;},'a10-quiz-06','a10-quiz-04와 중복'),'퀴즈 질문·지문 중복');
ok(hit(s=>{s[7].quiz[4].id='a7-quiz-5';},'a7-quiz-5','id'),'퀴즈 id 형식');
ok(hit(s=>{s[7].quiz[4].id='a7-story-05';},'a7-story-05','id'),'퀴즈 id에 다른 모드');
ok(hit(s=>{s[9].quiz[0].cat='science';},'a9-quiz-01','cat'),'퀴즈 cat 오류');
ok(hit(s=>{s[7].quiz[0].prompt='밤하늘에 반짝반짝 뜨는 것은 무엇일까요?';},'a7-quiz-01','10음절'),'퀴즈 7세 질문 길이');
ok(hit(s=>{s[9].quiz[1].passage=null;},'a9-quiz-02','passage'),'퀴즈 passage 문자열');
ok(hit(s=>{s[10].quiz[0].answer=4;},'a10-quiz-01','answer'),'퀴즈 answer 범위');
ok(hit(s=>{const c=s[10].quiz[1].choices;c[0]=c[1];},'a10-quiz-02','보기 중복'),'퀴즈 보기 중복');
ok(hit(s=>{s[8].quiz[0].age=9;},'a8-quiz-01','age/mode'),'퀴즈 age 불일치');
ok(hit(s=>{s[8].quiz.find(q=>q.cat==='english').cat='common';},'8세 quiz','영어 8문항'),'퀴즈 분류별 최소 문항');
ok(hit(s=>{for(const q of s[9].quiz.slice(0,3)){const a=q.choices[q.answer];q.choices=[a].concat(q.choices.filter(c=>c!==a));q.answer=0;}},'a9-quiz-03','연속'),'퀴즈 정답 위치 3연속');
ok(hit(s=>{for(const q of s[7].quiz){const a=q.choices[q.answer];q.choices=[a].concat(q.choices.filter(c=>c!==a));q.answer=0;}},'7세 quiz','50%'),'퀴즈 정답 위치 쏠림');
ok(hit(s=>{delete s[10].quiz;},'10세 quiz','묶음 없음'),'퀴즈 묶음 누락');
ok(Q.checkQuiz(8,Q.quiz(9,0)).length>0&&Q.checkQuiz(9,Q.quiz(8,0)).length>0,'checkQuiz: 보기 수가 다른 나이 규칙은 실패');

/* 9-1. 퀴즈 내용 검수 회귀 */
const PIC=/\p{Extended_Pictographic}/u;
/* 유니코드 9.0(Emoji 3.0) 이하이면서 작게 봐도 뜻이 하나인 그림 문자만. 새 그림은 iOS·Android·Windows에서 확인하고 더한다(생성기 export-v010.cjs SAFE와 같게). 시계(🕐~🕧) 금지 */
const SAFE_PIC=new Set([...'🌙🌞🌈🍎🎈⛄☔🐶🍓⭐✋🐱🐰🐥🐔🐘🐟🍪🥚🐦🐢🐷👂👃👀🐞🦋🐝🚗🚲🚢🔴🐯'+
  '💙💜💛🌸🍉❄🚶🛑🏃🍌🥛🍰🔵⚫🍇🔺⬛'+
  '🐮🐴🐵🐻🦁🦊🦆🍞🥕🥔🍬🍖📕🎒⚽✏🔑☂🚪🛏📱📦✂🥄👟🌳🌧☁⛰🌊🔥👁👄🚂✈👶🏠🚌🍕']);
const DIGIT='영일이삼사오육칠팔구';
const sino=n=>{if(n===0)return '영';let s='';for(const [v,w] of [[1000,'천'],[100,'백'],[10,'십']]){const d=Math.floor(n/v)%10;if(d)s+=(d===1?'':DIGIT[d])+w}const d=n%10;return d?s+DIGIT[d]:s};
const OPW={'+':'더하기','−':'빼기','×':'곱하기','÷':'나누기'};
const picValue=p=>{let t=0,op='+';for(const tok of p.split(/\s+/)){if(tok==='+'||tok==='−'){op=tok;continue}const g=[...tok];if(!g.every(c=>PIC.test(c)))return NaN;t+=op==='+'?g.length:-g.length;op='+'}return t};
const frac=s=>{const m=String(s).match(/^(\d+)분의 (\d+)$/);return m?+m[2]/+m[1]:NaN};
const only=(list,why)=>list.length===1?list[0]:why+' '+list.length+'개';
const afterMin=(h,m,add)=>{const t=h*60+m+add;return [Math.floor(t/60),t%60]};
const nums=s=>s.split(', ').map(Number);
/* 식이 지문에 없는 손 수학 문항: 문항마다 따로 계산한 정답(문항을 바꾸면 이 표도 함께 고친다) */
const WORD={
  'a7-quiz-23':q=>String(Math.max(...q.choices.map(Number))),
  'a7-quiz-26':()=>String(3+1),
  'a8-quiz-07':()=>String(15-7),
  'a8-quiz-10':()=>'3시',
  'a8-quiz-13':()=>60+'분',
  'a8-quiz-15':()=>String(34+9),
  'a8-quiz-18':()=>String(10*4+7),
  'a8-quiz-21':q=>only(q.choices.filter(c=>+c%2===0),'짝수'),
  'a8-quiz-29':()=>String(20-6),
  'a8-quiz-31':()=>String(15+5),
  'a9-quiz-07':()=>100+' cm',
  'a9-quiz-10':()=>'4분의 1',
  'a9-quiz-13':()=>String(6*4),
  'a9-quiz-18':()=>String(425+138),
  'a9-quiz-23':()=>(2*100+30)+' cm',
  'a9-quiz-26':()=>'사각형',
  'a9-quiz-31':()=>60/2+'분',
  'a10-quiz-07':()=>String(54/6),
  'a10-quiz-10':q=>only(q.choices.filter(c=>frac(c)===Math.max(...q.choices.map(frac))),'가장 큰 분수'),
  'a10-quiz-13':q=>only(q.choices.filter(c=>frac(c)===Math.min(...q.choices.map(frac))),'가장 작은 분수'),
  'a10-quiz-15':()=>'180도',
  'a10-quiz-18':()=>{const [h,m]=afterMin(1,40,50);return h+'시 '+m+'분'},
  'a10-quiz-21':()=>(2*60+15)+'분',
  'a10-quiz-29':()=>{const [h,m]=afterMin(15,20,60+50);return '오후 '+(h-12)+'시 '+m+'분'},
  'a10-quiz-31':q=>only(q.choices.filter(c=>{const d=parseInt(c,10);return d>90&&d<180}),'둔각')
};
/* 생성 수학 틀: 질문·지문을 읽어 정답을 따로 계산(생성기와 독립). 질문에 늘어놓은 수는 보기와 같은 묶음이어야 함 */
const SHAPE={'세모':'🔺','네모':'⬛','동그라미':'🔵'};
const listIs=(q,list)=>eq([...list].sort().join('|'),[...q.choices].sort().join('|'),q.id+': 질문에 늘어놓은 것 = 보기');
function genMath(q){
  const p=q.prompt,s=q.passage;let m;
  if((m=s.match(/^(\d+) \+ (\d+) \+ (\d+)$/)))return String(+m[1]+ +m[2]+ +m[3]);
  if((m=s.match(/^(\d+) \+ □ = (\d+)$/)))return String(m[2]-m[1]);
  if((m=s.match(/^(\d+) − □ = (\d+)$/)))return String(m[1]-m[2]);
  if((m=s.match(/^(\d+), (\d+), (\d+), □$/)))return String(2*m[3]-m[2]);
  /* 0.12 7세: 글 대신 수 줄(앞의 수·사이의 수), 수 묶음(가장 큰·작은 수), 물건 그림(같은 모양) */
  if((m=s.match(/^□, (\d+), (\d+)$/)))return String(2*m[1]-m[2]);
  if((m=s.match(/^(\d+), □, (\d+)$/))){eq(m[2]-m[1],2,q.id+': 사이의 수는 하나');return String((+m[1]+ +m[2])/2)}
  if((m=p.match(/^가장 (큰|작은) 수는\?$/))&&s){const v=nums(s);listIs(q,v.map(String));return String(m[1]==='큰'?Math.max(...v):Math.min(...v))}
  if(p==='같은 모양은?')return ({'🚪':'⬛','⚽':'🔵','🍕':'🔺'})[s];
  if((m=s.match(/^(\d+)분의 (\d+) \+ \1분의 (\d+)$/)))return m[1]+'분의 '+(+m[2]+ +m[3]);
  if(p==='다음에 올 것은?'){const e=[...s];for(const per of [2,3])if(e.every((x,i)=>i<per||x===e[i-per]))return e[4-per];return '규칙 없음'}
  if((m=p.match(/^(세모|네모|동그라미) 모양은\?$/)))return SHAPE[m[1]];
  if((m=p.match(/^(\d+) 다음 수는\?$/)))return String(+m[1]+1);
  if((m=p.match(/^(\d+) 바로 앞의 수는\?$/)))return String(m[1]-1);
  if((m=p.match(/^(\d+)[과와] (\d+) 사이의 수는\?$/)))return only(q.choices.filter(c=>+c>+m[1]&&+c<+m[2]),'사이 수');
  if((m=p.match(/^([\d, ]+) 중 가장 (큰|작은) 수는\?$/))){const v=nums(m[1]);listIs(q,v.map(String));return String(m[2]==='큰'?Math.max(...v):Math.min(...v))}
  if((m=p.match(/^([\d, ]+) 중 (짝수|홀수)는\?$/))){const v=nums(m[1]);listIs(q,v.map(String));return only(v.filter(x=>x%2===(m[2]==='짝수'?0:1)).map(String),m[2])}
  if((m=p.match(/^10개씩 묶음 (\d)개와 낱개 (\d)개는 어떤 수일까요\?$/)))return String(10*m[1]+ +m[2]);
  if((m=p.match(/^\d+씩 뛰어 세었어요\./))&&(m=s.match(/^(\d+), (\d+), (\d+), □$/)))return String(2*m[3]-m[2]);
  if((m=p.match(/^긴바늘이 12를, 짧은바늘이 (\d+)[을를] 가리키면 몇 시일까요\?$/)))return m[1]+'시';
  if((m=p.match(/^짧은바늘이 (\d+)[과와] (\d+) 사이, 긴바늘이 6이면 몇 시 몇 분\?$/))){eq(+m[2],+m[1]%12+1,q.id+': 짧은바늘 사이 두 수가 이웃');return m[1]+'시 30분'}
  if((m=p.match(/^한 \S+에 \S+ (\d+)\S+씩 들어 있어요\. (\d+)\S+에는 모두 몇 \S+일까요\?$/)))return String(m[1]*m[2]);
  if(/인 수는\?$/.test(p)){let v=0;for(const x of p.matchAll(/(1000|100|10)이 (\d)개/g))v+=x[1]*x[2];return String(v)}
  if((m=p.match(/^(\d+) m (\d+) cm는 몇 cm일까요\?$/)))return (100*m[1]+ +m[2])+' cm';
  if((m=p.match(/^(\d+)시 (\d+)분은 (\d+)시 몇 분 전일까요\?$/))){eq(+m[3],+m[1]%12+1,q.id+': 다음 시');return (60-m[2])+'분 전'}
  if((m=p.match(/^\S+ (\d+)\S+ (\d+)명이 똑같이 나누면 한 명이 몇 \S+씩 가질까요\?$/))){ok(m[1]%m[2]===0,q.id+': 나누어떨어짐');return String(m[1]/m[2])}
  if((m=p.match(/^\S+ 하나를 똑같이 (\d+)조각으로 나누었어요\. 한 조각은 전체의 얼마일까요\?$/)))return m[1]+'분의 1';
  if((m=p.match(/^(.+) 중 가장 (큰|작은) 분수는\?$/))){const v=m[1].split(', ');listIs(q,v);const f=v.map(frac),t=m[2]==='큰'?Math.max(...f):Math.min(...f);return only(v.filter((_,i)=>f[i]===t),'분수')}
  if((m=p.match(/^(\d+)시 (\d+)분에서 (\d+)분이 지나면 몇 시 몇 분일까요\?$/))){const [h,mm]=afterMin(+m[1],+m[2],+m[3]);return h+'시'+(mm?' '+mm+'분':'')}
  if((m=p.match(/^(\d+)시간 (\d+)분은 모두 몇 분일까요\?$/)))return (60*m[1]+ +m[2])+'분';
  if((m=p.match(/^(\d+) (L|kg) (\d+) (mL|g)[은는] 몇 \4일까요\?$/)))return (1000*m[1]+ +m[3])+' '+m[4];
  if((m=p.match(/^반지름이 (\d+) cm인 원의 지름은 몇 cm일까요\?$/)))return 2*m[1]+' cm';
  if((m=p.match(/^지름이 (\d+) cm인 원의 반지름은 몇 cm일까요\?$/)))return m[1]/2+' cm';
  if((m=p.match(/^(.+) 중 (둔각|예각)은\?$/))){const v=m[1].split(', ');listIs(q,v);return only(v.filter(x=>{const d=parseInt(x,10);return m[2]==='둔각'?d>90&&d<180:d<90}),m[2])}
  if((m=p.match(/^삼각형의 두 각이 (\d+)도, (\d+)도일 때 나머지 한 각은 몇 도일까요\?$/)))return (180-m[1]-m[2])+'도';
  return undefined;
}
const usedWord=new Set();
for(const a of Q.AGES)for(const q of quizAll(a)){
  const id=q.id,ans=q.choices[q.answer];
  /* speak: 음성이 그대로 읽으므로 숫자·영문·기호·그림 없이 한글 문장으로 */
  ok(!/[0-9A-Za-z]/.test(q.speak),id+': speak에 숫자·영문 없음(한글로 읽는 소리를 적음) '+q.speak);
  ok(!PIC.test(q.speak)&&!/[+−×÷=□<>%]/.test(q.speak),id+': speak에 그림·수식 기호 없음');
  ok(/[?.]$/.test(q.speak),id+': speak는 문장부호로 끝남');
  ok(!PIC.test(q.prompt),id+': 질문 글에 그림 문자 없음');
  /* 그림 문자: 검수한 목록 안, 시계 금지, 한 줄 4개 이하 */
  for(const s of [q.passage,...q.choices])for(const c of s)if(PIC.test(c))ok(SAFE_PIC.has(c),id+': 검수한 그림 문자 '+c);
  ok(!/[\u{1F550}-\u{1F567}]/u.test(q.passage+q.choices.join('')),id+': 시계 그림 없음');
  ok(q.passage.split('\n').every(l=>[...l].filter(c=>PIC.test(c)).length<=4),id+': 그림은 한 줄에 4개 이하');
  /* 보기 형식이 정답을 드러내지 않음: 끝 문장부호와 영문 첫 글자 대소문자가 보기끼리 같음 */
  eq(new Set(q.choices.map(c=>/[.?!]$/.test(c)?c.slice(-1):'')).size,1,id+': 보기 끝 문장부호 통일');
  const latin=q.choices.filter(c=>/[A-Za-z]/.test(c));
  if(latin.length){eq(latin.length,q.choices.length,id+': 영문 보기는 모두 영문');eq(new Set(latin.map(c=>c[0]===c[0].toUpperCase())).size,1,id+': 영문 보기 대소문자 통일')}
  if(/가장 (큰|작은)/.test(q.prompt)){const v=q.choices.map(c=>Number.isNaN(Number(c))?frac(c):Number(c)),up=v.every((x,i)=>!i||x>v[i-1]),down=v.every((x,i)=>!i||x<v[i-1]);
    ok(!up&&!down,id+': 가장 큰·작은 수를 묻는 보기는 크기순으로 늘어놓지 않음(끝자리 찍기 방지)')}
  if(q.say!==undefined)ok(/^[가-힣 ]+$/.test(q.say),id+': say는 한글');
  if(q.cat!=='math')continue;
  /* 수학: 모든 문항 정답 재계산 */
  const ex=q.passage.match(/^(\d+) ([+−×÷]) (\d+)$/);
  if(ex){
    const x=+ex[1],y=+ex[3],head=sino(x)+' '+OPW[ex[2]]+' '+sino(y);
    ok(q.speak.startsWith(head),id+': speak가 식을 한글로 읽음('+head+')');
    const p=q.speak.charAt(head.length),last=head.slice(-1),batchim=H.hasBatchim(last);
    ok(p==='의'||(p==='은'&&batchim)||(p==='는'&&!batchim),id+': '+last+' 뒤 조사 '+p);
    const want=ex[2]==='÷'&&/^몫/.test(ans)?`몫 ${Math.floor(x/y)}, 나머지 ${x%y}`:String({'+':x+y,'−':x-y,'×':x*y,'÷':x/y}[ex[2]]);
    eq(ans,want,`${id}: ${q.passage} 정답 재계산`);
  }else if(WORD[id]){
    eq(ans,WORD[id](q),id+': 정답 재계산');usedWord.add(id);
  }else if(q.passage&&!Number.isNaN(picValue(q.passage))&&q.prompt!=='다음에 올 것은?'&&q.prompt!=='같은 모양은?'){
    eq(ans,String(picValue(q.passage)),id+': 그림 식 정답 재계산');
  }else{
    const g=genMath(q);
    ok(g!==undefined,id+': 수학 정답 재계산 규칙이 있음 '+q.prompt);
    eq(ans,g,id+': 정답 재계산 '+q.prompt+' '+q.passage);
  }
  const vals=q.choices.map(c=>Number.isNaN(Number(c))?c:Number(c));
  eq(new Set(vals).size,vals.length,id+': 같은 값을 다르게 쓴 보기 없음');
}
eq([...usedWord].sort(),Object.keys(WORD).sort(),'재계산 표의 id가 모두 실제 수학 문항');
/* 생성 수학은 틀별로 고르게(한 틀이 나이 수학 생성분의 25% 이하) */
for(const a of Q.AGES){
  const gm=GEN[a].quiz.filter(q=>q.cat==='math'),kind=q=>q.passage.match(/^\d+ ([+−×÷]) \d+$/)?q.passage.replace(/\d+/g,'n').replace(/n( [+−×÷] )n/,(_,o)=>'n'+o+'n')+':'+q.passage.split(' ')[0].length+'x'+q.passage.split(' ')[2].length:q.prompt.replace(/[\d,.]+/g,'n').slice(0,12);
  const tally={};gm.forEach(q=>{tally[kind(q)]=(tally[kind(q)]||0)+1});
  ok(Object.values(tally).every(c=>c<=gm.length/4),`${a}세 생성 수학 틀 쏠림 없음 ${JSON.stringify(tally)}`);
}
eq(GEN[8].quiz.filter(q=>/몇 시 몇 분\?$/.test(q.prompt)&&/시 30분$/.test(q.choices[q.answer])).length>=4,true,'8세 몇 시 30분 문항(글 설명형)');

/* 9-2. 0.12 읽기 문항 1차 확충(생성 파일의 story 묶음) 내용 검사. note = 문항 유형 */
const BAD_SUB=['씨발','시발','시바','개새','새끼','병신','지랄','좆','존나','졸라','썅','염병','니미','엠창','꺼져','닥쳐','죽어','죽여','죽음','죽이','살인','자살','섹스','마약','똥꼬','젖꼭','성기','강간','폭탄','전쟁','총알','귀신','악마',
  '지옥','변태','멍청','등신','찐따','미친','또라이','개같','개똥','엿먹','보지','자지','애미','애비','조또','씹','쌍놈','빠구리'];
const BAD_WHOLE=['년','놈','뇬','똥','바보','피','칼','총','술','담배','독','뼈','시체','무덤','도끼','코피','방귀','오줌','거지','고자','사기','뒤지','소피','아비','제모'];
const isBad=t=>BAD_SUB.some(b=>t.includes(b))||t.split(/[\s,.?!]+/).some(w=>BAD_WHOLE.includes(w));
for(const a of Q.AGES)for(const q of all(a,'story'))ok(![q.passage,q.prompt,...q.choices].some(isBad),q.id+': 부적절 낱말 없음');
const soleLong=q=>{const L=q.choices.map(c=>H.compactLength(c)),mx=Math.max(...L);return L[q.answer]===mx&&L.filter(v=>v===mx).length===1};
const share=(list,f)=>list.filter(f).length/list.length;
for(const a of Q.AGES){
  const list=GEN[a].story,n=CHOICES[a].story,tally=Array(n).fill(0);
  list.forEach(q=>{tally[q.answer]++;ok(typeof q.note==='string'&&q.note.length>0,q.id+': note에 문항 유형')});
  ok(Math.max(...tally)-Math.min(...tally)<=3,`${a}세 새 읽기: 정답 위치가 고름 ${tally.join('/')}`);
  if(a>=9)ok(share(list,soleLong)<=1/n,`${a}세 새 읽기: 정답이 혼자 가장 긴 보기인 비율 ${list.filter(soleLong).length}/${list.length} ≤ 1/${n}`);
}
/* 7세: 그림 문자는 유니코드 9.0 이하에서 고른 목록 안(실기기 표시는 사람이 확인), 그림 하나 = 낱말 하나, 오답 낱말은 음절 수가 같고 ㅐ/ㅔ만 다른 것 없음 */
const READ_PIC=new Set(['🐶','🐮','🐦','🦀','🦊','🦆','🐰','🐷','🦁','🐘','🐳','🕷️','🐜','🦋','🐸','🦐','🍎','🍌','🍇','🍅','🥒','🍠','🍒','🥝','🌶️','🍆','🥛','🍕','🧀','🍪','🍰','🍖',
  '🌳','☀️','🌧️','🌊','🌈','🌍','🎄','🚂','🚌','🚢','🚗','👖','👞','👕','👗','👢','✂️','⏰','🎹','🎸','🎲','📏','📷','🎤','🕯️','🛋️','🗺️','⚾','🎿','🚿','❤️','🔺','⬛','➕','➖','👃','👂','👅','👶']);
const HAND_PIC=new Set([...'🌳🦋🍄🍌🍎🍇🥕🦆🥒🍓🍉🍑🍋🌽🍠🐝🐞🐻🦊🐰👟👕👖🚂🚌🚲🍞🥛🧀🍰🍪🍕🐔🦉🌈🌊🌙🍒🍅🐜🐌🐛']);
const merge=w=>chars(w).map(ch=>{const j=H.jung(ch);return H.cho(ch)+'.'+({1:5,3:7,10:15,11:15}[j]||j)}).join('|');/* ㅐ=ㅔ, ㅒ=ㅖ, ㅙ=ㅚ=ㅞ */
{const picOf=new Map(),wordOf=new Map(),perPic=new Map();
 for(const q of GEN[7].story){
   const w=q.choices[q.answer];
   if(word7(q.passage)){eq(q.note,'낱말→그림',q.id+' 유형');q.choices.forEach(c=>ok(READ_PIC.has(c),q.id+': 검수 목록 안 그림 '+c));ok(!picOf.has(q.passage)||picOf.get(q.passage)===w,q.id+': 낱말의 그림은 하나');picOf.set(q.passage,w)}
   else{eq(q.note,'그림→낱말',q.id+' 유형');ok(READ_PIC.has(q.passage),q.id+': 검수 목록 안 그림 '+q.passage);
     ok(!wordOf.has(q.passage)||wordOf.get(q.passage)===w,q.id+': 그림의 낱말은 하나');wordOf.set(q.passage,w);perPic.set(q.passage,(perPic.get(q.passage)||0)+1);
     q.choices.forEach((c,i)=>{if(i===q.answer)return;eq(chars(c).length,chars(w).length,q.id+': 오답 낱말 음절 수 = 정답 '+c);ok(merge(c)!==merge(w),q.id+': ㅐ/ㅔ만 다른 오답 없음 '+c)})}
 }
 for(const [w,p] of picOf)eq(wordOf.get(p),w,'7세 낱말 '+w+': 두 방향의 그림·낱말이 같음');
 for(const [p,c] of perPic)ok(c<=2,'7세 그림 '+p+': 그림 → 낱말은 2문항까지');
 eq(new Set(wordOf.values()).size,wordOf.size,'7세 표: 낱말 하나에 그림 하나');
 for(const q of all(7,'story').filter(q=>!isGen(q)))q.choices.forEach(c=>ok(HAND_PIC.has(c)||READ_PIC.has(c),q.id+': 손 문항 그림 '+c));
}
/* 8세: 상식·고정관념만으로 답이 정해지는 짝이 한 문장에 없음(생성 틀 금지 목록과 같게), 유형이 한쪽으로 쏠리지 않음 */
const BAN8=[['토끼','당근'],['다람쥐','도토리'],['다람쥐','밤'],['다람쥐','호두'],['곰','꿀'],['고양이','생선'],['고양이','우유'],['강아지','공'],['염소','풀'],['병아리','모이'],['개구리','연못'],['오리','연못'],['오리','강가'],
  ['거북이','바닷가'],['거북이','연못'],['거북이','강가'],['부엉이','밤'],['꼬꼬','아침'],['꼬꼬','달걀'],['참새','쌀'],['엄마','요리'],['엄마','설거지'],['아빠','회사'],['간호사','누나'],['의사','아저씨']];
{const words=p=>p.split(/[\s,.]+/).map(w=>w.replace(/(에게|에서|으로|보다|이|가|은|는|을|를|와|과|로|에|의)$/,''));
 for(const q of GEN[8].story){const w=words(q.passage);for(const [x,y] of BAN8)ok(!(w.includes(x)&&w.includes(y)),q.id+': 고정관념 짝 '+x+'-'+y)}
 const t={};GEN[8].story.forEach(q=>{t[q.note]=(t[q.note]||0)+1});
 ok(Object.keys(t).length>=10&&Object.values(t).every(c=>c<=GEN[8].story.length*.15),'8세 새 읽기: 틀 10가지 이상, 한 틀 15% 이하 '+JSON.stringify(t));
 const k={};GEN[8].story.forEach(q=>{const w=(q.prompt.match(/누가|누구|어디|어느|언제|몇|무슨 색|무엇/)||['기타'])[0];k[w]=(k[w]||0)+1});
 ok(Object.keys(k).length>=6&&!k['기타'],'8세 새 읽기: 질문 낱말 6가지 이상 '+JSON.stringify(k));
}
/* 9·10세: 지문 하나에 질문 1~3개, 같은 지문의 질문끼리 답을 알려 주지 않음, 유형·갈래 비율, 문장 길이 */
for(const a of [9,10]){
  const list=GEN[a].story,by=new Map();
  list.forEach(q=>{ok(/^(이야기|설명문)·(사실|순서|까닭|마음|추론|중심)$/.test(q.note),q.id+': note 형식 '+q.note);by.set(q.passage,(by.get(q.passage)||[]).concat(q))});
  for(const [p,qs] of by){
    ok(qs.length>=1&&qs.length<=3,qs[0].id+': 지문당 질문 1~3개');
    eq(new Set(qs.map(q=>q.note.split('·')[0])).size,1,qs[0].id+': 같은 지문은 갈래가 같음');
    eq(new Set(qs.map(q=>q.prompt)).size,qs.length,qs[0].id+': 같은 지문의 질문이 서로 다름');
    eq(new Set(qs.map(q=>q.choices[q.answer])).size,qs.length,qs[0].id+': 같은 지문의 정답이 서로 다름');
    for(const x of qs)for(const y of qs)if(x!==y){const ans=x.choices[x.answer];if(chars(ans).length>=2)ok(!y.prompt.includes(ans),y.id+': 질문이 같은 지문 '+x.id+'의 정답을 드러내지 않음')}
    const sent=p.split('\n');
    ok(sent.every(t=>H.compactLength(t)<=(a===9?30:36)),qs[0].id+': 문장 길이 '+sent.map(t=>H.compactLength(t)).join('/'));
    if(a===10)ok(H.syllables(p)<=90,qs[0].id+': 10세 지문 90음절 이하('+H.syllables(p)+')');
  }
  const info=[...by.values()].filter(qs=>qs[0].note.startsWith('설명문')).length/by.size,deep=share(list,q=>/마음|추론|중심/.test(q.note));
  if(a===9){ok(by.size>=40&&info>=.2&&info<=.35,'9세: 지문 40편 이상, 설명문 20~35% ('+by.size+'편, '+info.toFixed(2)+')');ok(deep>=.2,'9세: 마음·추론·중심 20% 이상 ('+deep.toFixed(2)+')')}
  else{ok(by.size>=24&&info>=.3&&info<=.5,'10세: 지문 24편 이상, 설명문 30~50% ('+by.size+'편, '+info.toFixed(2)+')');ok(deep>=.4&&deep<=.6,'10세: 마음·추론·중심 40~60% ('+deep.toFixed(2)+')')}
}

/* 10. 출제 순서: Questions.at(age, mode, index, seed) */
const EXPECT=(a,i)=>({7:2,8:3,9:i<40?5:i<100?6:7,10:i<40?7:i<80?8:i<120?9:10})[a];
for(const a of Q.AGES){
  for(let b=0;b<10;b++){
    let c=0;for(let i=b*20;i<b*20+20;i++)if(Q.isQuiz(a,i))c++;
    eq(c,EXPECT(a,b*20),`${a}세 ${b*20}~${b*20+19}번 퀴즈 칸 수`);
    eq(Q.quizPer20(a,b*20+7),EXPECT(a,b*20),`${a}세 quizPer20`);
  }
  ok(Array.from({length:1000},(_,i)=>i).every(i=>!(Q.isQuiz(a,i)&&Q.isQuiz(a,i+1))),`${a}세 퀴즈가 연달아 나오지 않음(1000문제)`);
  for(const s of [0,5,123456])for(let i=0;i<160;i++){
    const qs=Q.at(a,'sound',i,s),qt=Q.at(a,'story',i,s);
    eq(qt.mode==='quiz',Q.isQuiz(a,i),`${a}세 ${i}번 칸 종류는 시드와 무관`);
    eq(qs,qt,`${a}세 ${i}번: 예전 mode 'sound'로 불러도 같은 읽기·퀴즈 문항`);
    if(qt.mode!=='quiz')eq(qt.mode,'story','퀴즈가 아닌 칸은 읽기 문항');
  }
}
/* 결정성: 같은 입력이면 다른 호출을 섞어도 같은 문항, seed 기본값과 정규화 */
for(const a of Q.AGES)for(const m of Q.MODES){
  const ref=Array.from({length:60},(_,i)=>Q.at(a,m,i*7,42));
  for(let s=0;s<120;s++)Q.at(a,m,s*13,s);
  eq(Array.from({length:60},(_,i)=>Q.at(a,m,i*7,42)),ref,`${a}/${m}: 같은 (나이, 모드, 번호, 시드) = 같은 문항`);
  for(const i of [0,3,9,57]){
    eq(Q.at(a,m,i),Q.at(a,m,i,0),`${a}/${m}/${i}: seed 기본 0`);
    for(const bad of [-1,NaN,'3',null,undefined,Infinity])eq(Q.at(a,m,i,bad),Q.at(a,m,i,0),`${a}/${m}/${i}: seed ${String(bad)} → 0`);
    eq(Q.at(a,m,i,2.7),Q.at(a,m,i,2),`${a}/${m}/${i}: seed 2.7 → 2`);
    eq(Q.at(a,m,i+0.6),Q.at(a,m,i),'index 내림');
  }
  eq(Q.at(a,m,-5,1),Q.at(a,m,0,1),'index 음수 → 0');
}
for(const bad of [6,'8',null])eq(Q.at(bad,'story',5,1),Q.at(8,'story',5,1),`at age ${String(bad)} → 8세`);
eq(Q.at(9,'x',4,1),Q.at(9,'story',4,1),'at mode 이상 → story');
/* 판마다 다른 순서: seed가 다르면 첫 30개 모드 문항 순서가 다름 */
const modeSeq=(a,m,s,len)=>{const out=[];for(let i=0;out.length<len;i++){const q=Q.at(a,m,i,s);if(q.mode!=='quiz')out.push(q)}return out};
const quizSeq=(a,s,len)=>{const out=[];for(let i=0;out.length<len;i++){const q=Q.at(a,'story',i,s);if(q.mode==='quiz')out.push(q)}return out};
for(const a of Q.AGES)for(const m of Q.MODES){
  const ids0=modeSeq(a,m,0,30).map(q=>q.id);
  for(const s of [1,2,99])ok(modeSeq(a,m,s,30).map(q=>q.id).join()!==ids0.join(),`${a}/${m}: seed ${s}는 seed 0과 순서가 다름`);
}
for(const a of Q.AGES)ok(quizSeq(a,0,20).map(q=>q.id).join()!==quizSeq(a,1,20).map(q=>q.id).join(),`${a}세 퀴즈 순서도 seed마다 다름`);
/* 한 바퀴 안 반복 0, 바퀴 경계 반복 없음, lap 필드 */
for(const a of Q.AGES)for(const m of Q.MODES)for(const s of [0,3,77]){
  const cnt=Q.count(a,m),seq=modeSeq(a,m,s,cnt*3),pool=all(a,m).map(q=>q.id).sort();
  for(let L=0;L<3;L++){
    const lap=seq.slice(L*cnt,(L+1)*cnt);
    eq(lap.map(q=>q.id).sort(),pool,`${a}/${m} seed ${s} ${L+1}바퀴째: 묶음 전부를 한 번씩(반복 0)`);
    ok(lap.every(q=>q.lap===L),`${a}/${m} seed ${s}: lap=${L}`);
    if(L)ok(seq[L*cnt].id!==seq[L*cnt-1].id,`${a}/${m} seed ${s}: 바퀴 경계에서 같은 문항 연속 없음`);
  }
  const G=Math.min(10,cnt>>2);
  ok(seq.every((q,k)=>!seq.slice(Math.max(0,k-G),k).some(p=>p.id===q.id)),`${a}/${m} seed ${s}: ${G}칸 안에 같은 문항 없음`);
}
/* 0.12: 같은 지문의 다른 질문(7세는 같은 낱말의 다른 방향)은 10칸 안에 다시 나오지 않고, 한 판 100문제 안에 같은 문항은 없다 */
const groupOf=q=>q.age===7?(word7(q.passage)?q.passage:q.choices[q.answer]):q.passage;
for(const a of Q.AGES)for(const s of [0,3,77]){
  const cnt=Q.count(a,'story'),seq=modeSeq(a,'story',s,cnt*2),last=new Map();let worst=Infinity;
  seq.forEach((q,k)=>{const g=groupOf(q);if(last.has(g))worst=Math.min(worst,k-last.get(g));last.set(g,k)});
  ok(worst>=10,`${a}세 seed ${s}: 같은 지문·낱말 사이 간격 ${worst} ≥ 10`);
  const game=Array.from({length:100},(_,i)=>Q.at(a,'story',i,s)).filter(q=>q.mode!=='quiz').map(q=>q.id);
  eq(new Set(game).size,game.length,`${a}세 seed ${s}: 한 판 100문제 안에 같은 읽기 문항 없음`);
}
for(const a of Q.AGES)for(const s of [0,4]){
  const pools={};for(const c of Object.keys(Q.CATS))pools[c]=quizAll(a).filter(q=>q.cat===c).map(q=>q.id).sort();
  const need=Math.max(...Object.keys(pools).map(c=>Math.ceil(pools[c].length*2/Q.QUIZ_MIX[a][c]*20)))+20;
  const seq=quizSeq(a,s,need),by={};
  seq.forEach(q=>(by[q.cat]=by[q.cat]||[]).push(q));
  for(const c of Object.keys(pools)){
    const l=by[c],k=pools[c].length;
    eq(l.slice(0,k).map(q=>q.id).sort(),pools[c],`${a}세 ${c} seed ${s}: 첫 바퀴에 묶음 전부를 한 번씩`);
    eq(l.slice(k,2*k).map(q=>q.id).sort(),pools[c],`${a}세 ${c} seed ${s}: 두 바퀴째도 반복 0`);
    ok(l[k].id!==l[k-1].id&&l.slice(0,2*k).every((q,i)=>q.lap===Math.floor(i/k)),`${a}세 ${c} seed ${s}: 경계·lap`);
  }
  /* 퀴즈 분류 비율: 연속한 퀴즈 20개마다 QUIZ_MIX와 같음 */
  for(let st=0;st+20<=Math.min(seq.length,200);st+=7){
    const t={math:0,common:0,english:0};seq.slice(st,st+20).forEach(q=>t[q.cat]++);
    eq(t,Object.assign({math:0,common:0,english:0},Q.QUIZ_MIX[a]),`${a}세 seed ${s} 퀴즈 ${st}~${st+19}: 분류 비율`);
  }
}
eq(Q.QUIZ_MIX,{7:{math:13,common:6,english:1},8:{math:10,common:8,english:2},9:{math:8,common:8,english:4},10:{math:7,common:9,english:4}},'퀴즈 분류 비율(20개 기준)');
for(const a of Q.AGES)for(const s of [0,1]){
  const math=quizSeq(a,s,400).filter(q=>q.cat==='math'),k=quizAll(a).filter(q=>q.cat==='math').length,lap=math.slice(0,k).map(levelOf),third=Math.floor(k/3),avg=l=>l.reduce((x,y)=>x+y,0)/l.length;
  ok(avg(lap.slice(0,third))<avg(lap.slice(-third)),`${a}세 수학 seed ${s}: 앞쪽이 더 쉬움`);
}
/* slot(): 칸 정보 */
{const t=Q.slot(9,'story',2,0);ok(!Q.isQuiz(9,2)&&Q.isQuiz(9,3)&&t.kind==='story'&&t.seq===2&&t.lap===0&&t.pos>=0&&t.size===Q.count(9,'story'),'slot: 읽기 칸(9세는 3번이 첫 퀴즈 칸)');
 eq(Q.slot(9,'sound',2,0),t,"slot: mode 'sound'도 읽기 칸");
 const v=Q.slot(9,'story',4,0);ok(v.kind==='story'&&v.seq===3,'slot: 퀴즈 칸 다음 모드 칸의 순번');
 const i=Array.from({length:40},(_,k)=>k).find(k=>Q.isQuiz(9,k)),u=Q.slot(9,'story',i,0);ok(u.kind==='quiz'&&Object.keys(Q.CATS).includes(u.cat)&&u.seq===0,'slot: 첫 퀴즈 칸');}

/* 8. 파일 조건과 브라우저 전역 */
const file=path.join(__dirname,'questions.js'),buf=fs.readFileSync(file);
const gfile=path.join(__dirname,'questions-gen.js'),gbuf=fs.readFileSync(gfile);
/* 크기는 저장소·배포 기준(LF)으로 셈: Windows 체크아웃(autocrlf)의 CR은 빼고 */
const lfSize=b=>Buffer.byteLength(b.toString('utf8').replace(/\r\n/g,'\n'));
ok(lfSize(buf)<=60*1024,'questions.js 60KB 이하 ('+lfSize(buf)+')');
ok(lfSize(gbuf)<=300*1024,'questions-gen.js 300KB 이하 ('+lfSize(gbuf)+')');
for(const [name,b] of [['questions.js',buf],['questions-gen.js',gbuf]]){
  ok(!(b[0]===0xEF&&b[1]===0xBB&&b[2]===0xBF),name+' BOM 없음');
  ok(!b.toString('utf8').includes('�'),name+' UTF-8로 깨짐 없이 읽힘');
}
/* 브라우저: questions-gen.js를 먼저, 그다음 questions.js(같은 window) */
const win={};
vm.runInNewContext(gbuf.toString('utf8'),{window:win});
ok(win.QUESTIONS_GEN&&Array.isArray(win.QUESTIONS_GEN[9].quiz)&&!('sound' in win.QUESTIONS_GEN[9]),'브라우저에서는 window.QUESTIONS_GEN(sound 없음)');
vm.runInNewContext(buf.toString('utf8'),{window:win});
ok(win.Questions&&typeof win.Questions.get==='function','브라우저에서는 window.Questions');
for(const a of Q.AGES){
  eq([win.Questions.count(a,'story'),win.Questions.quizCount(a)],[Q.count(a,'story'),Q.quizCount(a)],`브라우저 전역 ${a}세 문항 수 = node`);
  eq(JSON.stringify(Array.from({length:30},(_,i)=>win.Questions.at(a,'story',i,9))),JSON.stringify(Array.from({length:30},(_,i)=>Q.at(a,'story',i,9))),`브라우저 전역 ${a}세 at() = node`);
}
eq(JSON.stringify(win.Questions.get(9,'story',0)),JSON.stringify(Q.get(9,'story',0)),'브라우저 전역과 node 모듈이 같은 데이터');
eq(Array.from(win.Questions.validate()),[],'브라우저 전역 validate()');
eq(JSON.stringify(win.Questions.quiz(10,5)),JSON.stringify(Q.quiz(10,5)),'브라우저 전역 quiz()');
/* questions-gen.js가 없어도(손 문항만) 동작 */
const bare={};
vm.runInNewContext(buf.toString('utf8'),{window:bare});
eq(Array.from(bare.Questions.validate()),[],'생성 문항 없이도 validate 통과');
for(const a of Q.AGES){
  eq(bare.Questions.count(a,'story'),all(a,'story').filter(q=>!isGen(q)).length,`생성 문항 없이 ${a}세 읽기 = 손 문항`);
  ok(Array.from({length:120},(_,i)=>bare.Questions.at(a,'story',i,3)).every(q=>q&&q.id),`생성 문항 없이 ${a}세 at() 동작`);
}
/* 0.11: 듣고 고르기 문항은 두 파일 어디에도 남지 않음 */
ok(!/"mode":"sound"|-sound-/.test(gbuf.toString('utf8')),'questions-gen.js에 sound 문항 없음');
ok(!/-sound-|mode:'sound'|\.sound\b|SOUND_PROMPT/.test(buf.toString('utf8')),'questions.js에 sound 문항·규칙 없음');

console.log(`PASS ${n} question bank assertions.`);
