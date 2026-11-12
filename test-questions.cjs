/* node test-questions.cjs : 연령별 문제은행(questions.js) 단독 검사 */
const assert=require('node:assert');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const Q=require('./questions.js');

let n=0;
const ok=(v,msg)=>{assert.ok(v,msg);n++;};
const eq=(a,b,msg)=>{assert.deepStrictEqual(a,b,msg);n++;};
const H=Q.hangul;
const KEYS=['id','age','mode','prompt','passage','speak','choices','answer'];
const CHOICES={7:{sound:3,story:3},8:{sound:3,story:3},9:{sound:4,story:4},10:{sound:4,story:5}};
const answerKey=q=>q.mode==='story'?q.passage:q.choices[q.answer];
const all=(age,mode)=>Array.from({length:Q.count(age,mode)},(_,i)=>Q.get(age,mode,i));

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
eq(Q.MODES,['sound','story']);
for(const a of Q.AGES)for(const m of Q.MODES){
  const label=Q.LEVELS[a][m];
  ok(typeof label==='string'&&label.length>0&&label.length<=12,`LEVELS[${a}].${m} 라벨`);
  ok(Q.count(a,m)>=12,`${a}세 ${m} 12문항 이상`);
}
eq(new Set(Q.AGES.flatMap(a=>Q.MODES.map(m=>Q.LEVELS[a][m]))).size,8,'라벨 8개가 서로 다름');
eq(Q.validate(),[],'validate()는 빈 배열');

/* 3. get 계약: 형태·순환·불변 */
const ids=new Set();
for(const a of Q.AGES)for(const m of Q.MODES){
  const cnt=Q.count(a,m);
  for(let i=0;i<cnt;i++){
    const q=Q.get(a,m,i),tag=`${a}/${m}/${i}`;
    eq(Object.keys(q),KEYS,tag+' 키');
    eq(q.id,`a${a}-${m}-${String(i+1).padStart(2,'0')}`,tag+' id');
    ok(!ids.has(q.id),tag+' id 유일');ids.add(q.id);
    eq([q.age,q.mode],[a,m],tag+' age/mode');
    ok(typeof q.prompt==='string'&&q.prompt.trim().length>0,tag+' prompt');
    ok(Array.isArray(q.choices)&&q.choices.every(c=>typeof c==='string'&&c.length>0),tag+' choices');
    eq(q.choices.length,CHOICES[a][m],tag+' 보기 개수');
    eq(new Set(q.choices).size,q.choices.length,tag+' 보기 중복 없음');
    ok(Number.isInteger(q.answer)&&q.answer>=0&&q.answer<q.choices.length,tag+' answer 범위');
    if(m==='sound'){eq(q.passage,'',tag+' passage 빈 문자열');eq(q.speak,q.choices[q.answer],tag+' speak=정답');}
    else{ok(q.passage.length>0,tag+' passage');eq(q.speak,q.passage,tag+' speak=passage');ok(!/\r/.test(q.passage),tag+' 줄바꿈은 \\n');}
    eq(Q.checkCommon(q),[],tag+' 공통 규칙');
    eq(Q.get(a,m,i+cnt),q,tag+' 순환(+count)');
    eq(Q.get(a,m,i+cnt*3),q,tag+' 순환(+3count)');
    const pristine=JSON.stringify(q),victim=Q.get(a,m,i);
    ok(victim!==Q.get(a,m,i)&&victim.choices!==Q.get(a,m,i).choices,tag+' 매번 새 객체');
    victim.choices[0]='오염';victim.choices.push('추가');victim.answer=99;victim.prompt='';victim.passage='x';victim.id='x';
    eq(JSON.stringify(Q.get(a,m,i)),pristine,tag+' 변형해도 은행 오염 없음');
  }
}
eq(ids.size,Q.AGES.reduce((s,a)=>s+Q.count(a,'sound')+Q.count(a,'story'),0),'id 총수');
ok(ids.size>=96,'총 96문항 이상');

/* 4. 나이별 변별(전수) */
for(const m of Q.MODES){
  const sets=Q.AGES.map(a=>all(a,m));
  const longest=Math.max(...sets.map(s=>s.length));
  for(let i=0;i<longest;i++){
    const qs=Q.AGES.map(a=>Q.get(a,m,i));
    eq(new Set(qs.map(q=>q.id)).size,4,`${m} index ${i}: 나이별 id가 모두 다름`);
    eq(new Set(qs.map(answerKey)).size,4,`${m} index ${i}: 나이별 정답/지문이 모두 다름`);
    eq(new Set(qs.map(q=>q.choices.join('|'))).size,4,`${m} index ${i}: 나이별 보기가 모두 다름`);
  }
  const keys=sets.flat().map(answerKey);
  eq(new Set(keys).size,keys.length,`${m}: 모든 나이를 통틀어 정답/지문 중복 없음`);
  Q.AGES.forEach((a,k)=>{
    for(const q of sets[k]){
      eq(Q.checkLevel(a,m,q),[],`${q.id}: 자기 수준(${a}세) 규칙 통과`);
      for(const other of Q.AGES)if(other!==a)
        ok(Q.checkLevel(other,m,q).length>0,`${q.id}: ${other}세 규칙은 통과하면 안 됨`);
    }
  });
}
const chars=s=>Array.from(s);
for(const q of all(7,'sound'))ok(q.choices.every(c=>H.isSyllable(c)&&!H.hasBatchim(c)),q.id+' 7세: 전부 받침 없는 한 글자');
for(const q of all(8,'sound')){
  const a=chars(q.speak);
  ok(a.length<=2&&a.some(H.hasBatchim)&&!a.some(H.hasDoubleBatchim),q.id+' 8세: 홑받침 있는 1~2음절');
}
for(const q of all(9,'sound'))ok(H.isWord(q.speak)&&[2,3].includes(chars(q.speak).length),q.id+' 9세: 2~3음절 낱말');
for(const q of all(10,'sound')){
  ok(q.speak.includes(' ')&&H.compactLength(q.speak)>=8&&H.compactLength(q.speak)<=18,q.id+' 10세: 문장');
  ok(q.choices.every(c=>c.split(' ').length>=3),q.id+' 10세: 보기도 모두 문장');
}
for(const q of all(7,'story')){
  ok(H.isWord(q.passage)&&chars(q.passage).length<=3&&!chars(q.passage).some(H.hasBatchim),q.id+' 7세: 받침 없는 낱말');
  ok(q.choices.every(c=>!/[ㄱ-ㆎ가-힣A-Za-z0-9]/.test(c)&&chars(c).length===1),q.id+' 7세: 보기는 이모지 1개');
}
for(const q of all(8,'story'))ok(H.sentences(q.passage)===1&&H.compactLength(q.passage)>=10&&H.compactLength(q.passage)<=20,q.id+' 8세: 한 문장');
for(const q of all(9,'story'))ok(H.sentences(q.passage)===2&&q.passage.split('\n').length===2,q.id+' 9세: 두 문장');
for(const q of all(10,'story')){
  const s=H.sentences(q.passage);
  ok((s===3||s===4)&&q.passage.split('\n').length===s,q.id+' 10세: 3~4문장');
}
/* 정답 위치 분포 */
for(const a of Q.AGES)for(const m of Q.MODES){
  const pos=all(a,m).map(q=>q.answer),tally={};
  pos.forEach(p=>{tally[p]=(tally[p]||0)+1;});
  ok(Object.values(tally).every(c=>c*2<=pos.length),`${a}/${m} 한 위치 50% 이하`);
  ok(pos.every((p,i)=>i<2||!(p===pos[i-1]&&p===pos[i-2])),`${a}/${m} 3연속 같은 위치 없음`);
  eq(Object.keys(tally).length,CHOICES[a][m],`${a}/${m} 모든 위치가 정답으로 쓰임`);
}

/* 5. 잘못된 입력 */
for(const m of Q.MODES){
  for(const bad of [6,11,'8',NaN,undefined,null,8.5]){
    eq(Q.get(bad,m,3),Q.get(8,m,3),`age ${String(bad)} → 8세`);
    eq(Q.count(bad,m),Q.count(8,m),`count age ${String(bad)} → 8세`);
  }
}
for(const a of Q.AGES)for(const bad of ['x',undefined,null,'SOUND',0]){
  eq(Q.get(a,bad,2),Q.get(a,'sound',2),`mode ${String(bad)} → sound`);
  eq(Q.count(a,bad),Q.count(a,'sound'),`count mode ${String(bad)} → sound`);
}
for(const a of Q.AGES)for(const m of Q.MODES){
  const cnt=Q.count(a,m);
  eq(Q.get(a,m,-1),Q.get(a,m,cnt-1),'index -1 → 마지막 문항');
  eq(Q.get(a,m,1.5),Q.get(a,m,1),'index 1.5 → 1');
  for(const bad of [NaN,undefined,'2',Infinity])eq(Q.get(a,m,bad),Q.get(a,m,0),`index ${String(bad)} → 0`);
}
eq(Q.get(6,'x',-1),Q.get(8,'sound',Q.count(8,'sound')-1),'전부 잘못된 입력');

/* 6. validate가 실제로 오류를 잡는지(스냅숏을 고장 내서 확인) */
const broken=fn=>{const s=Q.snapshot();fn(s);return Q.validate(s);};
eq(Q.validate(Q.snapshot()),[],'스냅숏 그대로는 통과');
ok(broken(s=>{s[7].sound[0].choices[1]='곰';}).length>0,'7세 sound에 받침 글자');
ok(broken(s=>{const q=s[8].sound[0];q.choices[q.answer]='고';q.speak='고';}).length>0,'8세 sound 정답에 받침 없음');
ok(broken(s=>{const q=s[8].sound[1];q.choices[q.answer]='닭';q.speak='닭';}).length>0,'8세 sound 정답에 겹받침');
ok(broken(s=>{s[9].sound[4].note='';}).length>0,'9세 sound 소리≠표기 표시 누락');
ok(broken(s=>{s[9].story[0].passage=s[9].story[0].speak='한 문장만 있어요.';}).length>0,'9세 story 문장 수');
ok(broken(s=>{s[10].story[0].choices.pop();}).length>0,'10세 story 보기 4개');
ok(broken(s=>{s[10].sound[0].choices[1]=s[10].sound[0].choices[2];}).length>0,'보기 중복');
ok(broken(s=>{s[7].story[0].answer=3;}).length>0,'answer 범위');
ok(broken(s=>{s[7].story[0].choices[0]='나무';}).length>0,'7세 story 보기에 한글');
ok(broken(s=>{s[8].story[0].speak='다른 말';}).length>0,'story speak≠passage');
ok(broken(s=>{s[9].sound[0].passage='글';}).length>0,'sound passage 비어 있지 않음');
ok(broken(s=>{s[9].sound[0].speak='토기';}).length>0,'sound speak≠정답');
ok(broken(s=>{s[8].story[2].id='a8-story-01';}).length>0,'id 중복·형식');
ok(broken(s=>{s[8].sound.length=11;}).length>0,'12문항 미만');
ok(broken(s=>{s[10].story[3].passage=s[10].story[3].speak=s[10].story[2].passage;}).length>0,'묶음 안 지문 중복');
ok(broken(s=>{const q=s[8].sound[0];q.choices=['곰','공','국'];const t=s[7].sound[0];t.choices=['곰','마','다'];t.speak='곰';}).some(e=>e.startsWith('a8-sound-01')&&e.includes('a7-sound-01와 중복')),'나이 간 정답 중복');
ok(broken(s=>{for(const q of s[9].story.slice(0,3)){const a=q.choices[q.answer];q.choices=[a].concat(q.choices.filter(c=>c!==a));q.answer=0;}}).some(e=>e.includes('연속')),'정답 위치 3연속');
ok(broken(s=>{for(const q of s[7].sound){const a=q.choices[q.answer];q.choices=[a].concat(q.choices.filter(c=>c!==a));q.answer=0;}}).some(e=>e.includes('50%')),'정답 위치 쏠림');
ok(broken(s=>{delete s[9].story;}).length>0,'묶음 누락');

/* 7. 기존 문항 흡수 */
const LEGACY_BANK=[['나',['나','마','다']],['모',['무','모','마']],['가',['나','다','가']],['바',['바','파','다']],['소',['수','소','서']],['하',['나','아','하']]];
LEGACY_BANK.forEach(([answer,choices],i)=>{
  const q=Q.get(7,'sound',i);
  eq([q.speak,q.choices],[answer,choices],`기존 글자 문항 ${i+1} 유지`);
});
const LEGACY_STORY=[
  {text:'밤새 비가 와서 다리가 물에 잠겼어요.\n꼬꼬는 친구를 만나러 언덕길로 돌아갔어요.',q:'꼬꼬는 왜 언덕길로 갔나요?',a:['다리가 물에 잠겨서','언덕길이 더 짧아서','친구를 만나기 싫어서','꽃에 물을 주려고','친구가 이사해서'],key:0},
  {text:'꼬꼬는 꽃에 물을 주었어요.\n다음 날 작은 꽃이 활짝 피었어요.',q:'꼬꼬가 꽃을 위해 한 일은 무엇인가요?',a:['꽃을 꺾었어요','그늘에 숨겼어요','물을 주었어요','꽃을 친구에게 주었어요','물을 마셨어요'],key:2}
];
LEGACY_STORY.forEach((old,i)=>{
  const q=Q.get(10,'story',i);
  ok(q.passage.startsWith(old.text+'\n'),`기존 독해 ${i+1}: 원래 두 문장으로 시작`);
  eq([q.prompt,q.choices,q.answer],[old.q,old.a,old.key],`기존 독해 ${i+1}: 질문·보기·정답 유지`);
});

/* 9. 퀴즈(상식·수학·영어) 묶음 */
const QKEYS=['id','age','mode','cat','prompt','passage','speak','choices','answer'];
const QCHOICES={7:3,8:3,9:4,10:4},QMAX={7:10,8:20,9:30,10:40},QMIN={common:12,math:12,english:8};
const quizAll=a=>Array.from({length:Q.quizCount(a)},(_,i)=>Q.quiz(a,i));
eq(Q.CATS,{common:'상식',math:'수학',english:'영어'},'CATS');
eq(Q.MODES,['sound','story'],'MODES에는 quiz가 없음');
const qids=new Set();
for(const a of Q.AGES){
  const list=quizAll(a),cnt=list.length,cats={common:0,math:0,english:0},keys=new Set();
  ok(cnt>=32,`${a}세 quiz 32문항 이상`);
  list.forEach((q,i)=>{
    const tag=`${a}/quiz/${i}`;
    eq(Object.keys(q),QKEYS,tag+' 키(note 없음)');
    eq(q.id,`a${a}-quiz-${String(i+1).padStart(2,'0')}`,tag+' id');
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
    eq(Q.checkLevel(a,'sound',q),[],tag+' checkLevel은 quiz를 퀴즈 규칙으로');
    const k=q.prompt+'\n'+q.passage;ok(!keys.has(k),tag+' 질문·지문 중복 없음');keys.add(k);
    eq(Q.quiz(a,i+cnt),q,tag+' 순환(+count)');
    eq(Q.quiz(a,i-cnt*2),q,tag+' 순환(-2count)');
    const pristine=JSON.stringify(q),victim=Q.quiz(a,i);
    ok(victim!==Q.quiz(a,i)&&victim.choices!==Q.quiz(a,i).choices,tag+' 매번 새 객체');
    victim.choices[0]='오염';victim.choices.push('추가');victim.answer=99;victim.cat='x';victim.speak='';victim.prompt='';
    eq(JSON.stringify(Q.quiz(a,i)),pristine,tag+' 변형해도 은행 오염 없음');
  });
  Object.keys(QMIN).forEach(c=>ok(cats[c]>=QMIN[c],`${a}세 ${Q.CATS[c]} ${QMIN[c]}문항 이상(현재 ${cats[c]})`));
  /* 분류 섞기: 같은 분류 3연속 없음, 영어는 붙지 않고 고르게 */
  const cs=list.map(q=>q.cat),en=cs.map((c,i)=>c==='english'?i:-1).filter(i=>i>=0);
  ok(cs.every((c,i)=>i<2||!(c===cs[i-1]&&c===cs[i-2])),`${a}세 quiz 같은 분류 3연속 없음`);
  ok(en.every((p,j)=>j===0||(p-en[j-1]>=2&&p-en[j-1]<=6))&&en[0]<=5&&cnt-1-en[en.length-1]<=5,`${a}세 영어 문항 고르게 분포`);
  /* 정답 위치 */
  const pos=list.map(q=>q.answer),tally={};
  pos.forEach(p=>{tally[p]=(tally[p]||0)+1;});
  ok(Object.values(tally).every(c=>c*2<=pos.length),`${a}/quiz 한 위치 50% 이하`);
  ok(pos.every((p,i)=>i<2||!(p===pos[i-1]&&p===pos[i-2])),`${a}/quiz 3연속 같은 위치 없음`);
  eq(Object.keys(tally).length,QCHOICES[a],`${a}/quiz 모든 위치가 정답으로 쓰임`);
  /* 지문이 식인 수학 문항은 다시 계산 */
  for(const q of list){
    const m=q.cat==='math'&&q.passage.match(/^(\d+) ([+−×÷]) (\d+)$/);
    if(!m)continue;
    const x=+m[1],y=+m[3],ans=q.choices[q.answer];
    const want=m[2]==='÷'&&/^몫/.test(ans)?`몫 ${Math.floor(x/y)}, 나머지 ${x%y}`:String({'+':x+y,'−':x-y,'×':x*y,'÷':x/y}[m[2]]);
    eq(ans,want,`${q.id}: ${q.passage} 정답 재계산`);
  }
}
eq(qids.size,Q.AGES.reduce((s,a)=>s+Q.quizCount(a),0),'퀴즈 id 총수');
/* get에는 퀴즈가 섞이지 않음(섞기는 별도 변경) */
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
ok(hit(s=>{const t=s[10].quiz[5],o=s[10].quiz[3];t.prompt=o.prompt;t.passage=o.passage;},'a10-quiz-06','a10-quiz-04와 중복'),'퀴즈 질문·지문 중복');
ok(hit(s=>{s[7].quiz[4].id='a7-quiz-5';},'a7-quiz-5','id'),'퀴즈 id 형식');
ok(hit(s=>{s[7].quiz[4].id='a7-sound-05';},'a7-sound-05','id'),'퀴즈 id에 다른 모드');
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

/* 8. 파일 조건과 브라우저 전역 */
const file=path.join(__dirname,'questions.js'),buf=fs.readFileSync(file);
ok(buf.length<=60*1024,'questions.js 60KB 이하');
ok(!(buf[0]===0xEF&&buf[1]===0xBB&&buf[2]===0xBF),'BOM 없음');
ok(!buf.toString('utf8').includes('�'),'UTF-8로 깨짐 없이 읽힘');
const win={};
vm.runInNewContext(buf.toString('utf8'),{window:win});
ok(win.Questions&&typeof win.Questions.get==='function','브라우저에서는 window.Questions');
eq(JSON.stringify(win.Questions.get(9,'story',0)),JSON.stringify(Q.get(9,'story',0)),'브라우저 전역과 node 모듈이 같은 데이터');
eq(Array.from(win.Questions.validate()),[],'브라우저 전역 validate()');
eq(JSON.stringify(win.Questions.quiz(10,5)),JSON.stringify(Q.quiz(10,5)),'브라우저 전역 quiz()');

console.log(`PASS ${n} question bank assertions.`);
