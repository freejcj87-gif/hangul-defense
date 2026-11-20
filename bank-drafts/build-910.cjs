/* 9·10세 문항 초안 조립·검사(2026-11-20, 브랜치 claude/bank-910)
     node bank-drafts/build-910.cjs            원고(src-910/*.txt) → bank-910-20261120.json + 형식·품질 검사
     node bank-drafts/build-910.cjs sim [폴더] [dom]
                                               임시 사본에 scripts/bank-add.cjs로 붙이고 BANK_PRINT 새 줄을 더해 node test-questions.cjs 실행
                                               (dom을 주면 SOFT=1 node test-dom.cjs도). 저장소 파일은 고치지 않는다.
   원고 형식
     읽기(s9.txt·s10.txt): 'P 갈래 | 문장. / 문장.' 다음 줄부터 'Q 유형[:level] | 질문 | 정답 | 오답 | 오답 | 오답(10세는 하나 더)'
       갈래 = 이야기·설명문, 유형 = 사실·순서·까닭·마음·추론·중심(level 기본: 사실 1, 순서·까닭 2, 마음·추론·중심 3)
     퀴즈(q9.txt·q10.txt): '분류level | 질문 | 지문 | 정답 | 오답 | 오답 | 오답 | 읽기(speak, 질문이 한글뿐이면 생략)'
       분류 = C 상식(우리말 포함)·M 수학·E 영어. 예: 'C1 | 일 년은 몇 달일까요? |  | 열두 달 | 열 달 | 여섯 달 | 스무 달'
   정답은 원고에서 언제나 첫 보기로 쓰고, 여기서 정답 자리를 고르게(생성 구간 끝에 이어 3연속 없이) 배치하고 오답 순서를 섞는다.
   초안 id 접두는 k(a9-story-k001 …). 합칠 때 scripts/bank-add.cjs가 생성 구간 순번(-g…)으로 다시 매긴다. */
'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),os=require('os');
const ROOT=path.join(__dirname,'..'),SRC=path.join(__dirname,'src-910'),OUT=path.join(__dirname,'bank-910-20261120.json');
const Q=require(path.join(ROOT,'questions.js')),G=require(path.join(ROOT,'questions-gen.js')),H=Q.hangul;
const AGES=[9,10],LV={사실:1,순서:2,까닭:2,마음:3,추론:3,중심:3},CAT={C:'common',M:'math',E:'english'};
const NCH={9:4,10:5};
/* 화면 길이 상한 = 지금 은행의 최댓값(test-questions.cjs 상한보다 좁게) */
const LIM={9:{syl:46,sent:28,prompt:26,choice:12,qprompt:30,qchoice:12},10:{syl:78,sent:33,prompt:28,choice:16,qprompt:25,qchoice:22}};
const hash=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0};
const rng=a=>()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
const errs=[],warns=[],E=(m)=>errs.push(m),W=(m)=>warns.push(m);
const read=f=>{const p=path.join(SRC,f);return fs.existsSync(p)?fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n').split('\n'):[]};
const cells=l=>l.split('|').map(s=>s.trim());

/* ---------- 원고 읽기 ---------- */
function parseStory(age){
  const out=[];let cur=null,ln=0;
  for(const raw of read('s'+age+'.txt')){ln++;const l=raw.trim();if(!l||l.startsWith('#'))continue;
    const tag=l.slice(0,2);
    if(tag==='P '){const c=cells(l.slice(2));if(!/^(이야기|설명문)$/.test(c[0]))E(age+'세 s'+ln+': 갈래 '+c[0]);
      cur={genre:c[0],passage:c.slice(1).join('|').split(' / ').map(s=>s.trim()).join('\n'),line:ln,qs:[]};out.push(cur)}
    else if(tag==='Q '){if(!cur){E(age+'세 s'+ln+': 지문 없이 질문');continue}
      const c=cells(l.slice(2)),m=c[0].match(/^(사실|순서|까닭|마음|추론|중심)(?::([123]))?$/);
      if(!m){E(age+'세 s'+ln+': 유형 '+c[0]);continue}
      cur.qs.push({type:m[1],level:m[2]?+m[2]:LV[m[1]],prompt:c[1],ans:c[2],wrong:c.slice(3),line:ln})}
    else E(age+'세 s'+ln+': 알 수 없는 줄 '+l.slice(0,20));
  }
  return out;
}
function parseQuiz(age){
  const out=[];let ln=0;
  for(const raw of read('q'+age+'.txt')){ln++;const l=raw.trim();if(!l||l.startsWith('#'))continue;
    const c=cells(l),m=c[0].match(/^([CME])([123])$/);
    if(!m){E(age+'세 q'+ln+': 분류 '+c[0]);continue}
    out.push({cat:CAT[m[1]],level:+m[2],prompt:c[1],passage:c[2]||'',ans:c[3],wrong:c.slice(4,7),speak:c[7]||'',line:ln});
  }
  return out;
}

/* ---------- 정답 자리: 생성 구간 끝에 이어 고르게, 3연속 없이 ---------- */
function placer(prev,n,catOf){
  const tally=Array(n).fill(0),ct={};
  prev.forEach(q=>{tally[q.answer]++;const c=catOf(q);(ct[c]=ct[c]||Array(n).fill(0))[q.answer]++});
  const seq=prev.map(q=>q.answer);
  return (key,cat)=>{
    const r=rng(hash(key)),c=(ct[cat]=ct[cat]||Array(n).fill(0)),L=seq.length;
    const ban=L>=2&&seq[L-1]===seq[L-2]?seq[L-1]:-1;
    const cand=[...Array(n).keys()].filter(v=>v!==ban).map(v=>[c[v]*4+tally[v]+r()*.5,v]).sort((x,y)=>x[0]-y[0]);
    const v=cand[0][1];tally[v]++;c[v]++;seq.push(v);return v;
  };
}
const shuffle=(arr,key)=>{const a=arr.slice(),r=rng(hash(key));for(let k=a.length-1;k>0;k--){const j=Math.floor(r()*(k+1));[a[k],a[j]]=[a[j],a[k]]}return a};

/* ---------- 검사 도구(questions.js·test-questions.cjs 규칙을 따라 씀) ---------- */
const PART=/(에서|에게|으로|이에요|예요|은|는|이|가|을|를|에|의|와|과|로|도)$/;
const stem=w=>{const s=w.replace(/[^가-힣]/g,''),t=s.replace(PART,'');return t||s};
const stems=s=>String(s).split(/\s+/).map(stem).filter(Boolean);
const inPassage=(c,p)=>p.includes(c)||stems(p).includes(stems(c)[0]);
const BAD_SUB=['씨발','시발','시바','개새','새끼','병신','지랄','좆','존나','졸라','썅','염병','니미','엠창','꺼져','닥쳐','죽어','죽여','죽음','죽이','살인','자살','섹스','마약','똥꼬','젖꼭','성기','강간','폭탄','전쟁','총알','귀신','악마','지옥','변태','멍청','등신','찐따','미친','또라이','개같','개똥','엿먹','보지','자지','애미','애비','조또','씹','쌍놈','빠구리'];
const BAD_WHOLE=['년','놈','뇬','똥','바보','피','칼','총','술','담배','독','뼈','시체','무덤','도끼','코피','방귀','오줌','거지','고자','사기','뒤지','소피','아비','제모'];
const isBad=t=>BAD_SUB.some(b=>t.includes(b))||t.split(/[\s,.?!]+/).some(w=>BAD_WHOLE.includes(w));
const SPELL=[[/되요|되서|안되|않되/,'되/돼'],[/몇일/,'며칠'],[/어떻해/,'어떡해'],[/금새/,'금세'],[/[할볼줄]께/,'ㄹ게'],[/깨끗히|일일히|곰곰히|틈틈히|번번히|따뜻히|솔직이|꼼꼼이|가만이/,'-이/-히'],[/오랫만/,'오랜만'],[/뵈요/,'봬요'],[/윗층|윗쪽/,'위층·위쪽'],[/아니예요/,'아니에요'],
  [/[가-힣]수있|[을를] 수있|[가-힣]것같/,'수 있·것 같'],[/밀어 내|끌어 당|빨아 들|올라 가|내려 가|뛰어 가|걸어 가|달려 가|날아 다|들려 주|가져다 주|데려다 주|도와 주/,'한 낱말 띄어 씀'],[/ {2,}/,'공백 두 칸'],[/ [.,?!]/,'문장부호 앞 공백'],[/[가-힣][.?!][가-힣]/,'문장부호 뒤 공백 없음']];
const spellBad=t=>{const s=String(t).replace(/\n/g,' '),o=[];for(const [re,why] of SPELL)if(re.test(s))o.push(why);
  for(const m of s.matchAll(/([가-힣])(이에요|예요)/g)){const b=H.hasBatchim(m[1]);if(m[2]==='예요'?b&&m[1]!=='이':!b)o.push('예요/이에요 '+m[0])}return o};
const bigr=s=>{const t=String(s).replace(/[^가-힣A-Za-z0-9]/g,''),o=new Set();for(let i=0;i<t.length-1;i++)o.add(t.slice(i,i+2));return o};
const jac=(a,b)=>{let n=0;for(const x of a)if(b.has(x))n++;return n/(a.size+b.size-n||1)};
const soleLong=(ch,ans)=>{const L=ch.map(c=>H.compactLength(c)),m=Math.max(...L);return L[ans]===m&&L.filter(v=>v===m).length===1};
const soleShort=(ch,ans)=>{const L=ch.map(c=>H.compactLength(c)),m=Math.min(...L);return L[ans]===m&&L.filter(v=>v===m).length===1};
/* 수학 정답 다시 계산(test-questions.cjs의 식 문항·genMath 중 9·10세가 쓰는 틀) */
const frac=s=>{const m=String(s).match(/^(\d+)분의 (\d+)$/);return m?+m[2]/+m[1]:NaN};
const after=(h,m,a)=>{const t=h*60+m+a;return [Math.floor(t/60),t%60]};
function mathAns(q){
  const p=q.prompt,s=q.passage;let m;
  if((m=s.match(/^(\d+) ([+−×÷]) (\d+)$/))){const x=+m[1],y=+m[3];if(m[2]==='÷'&&/^몫/.test(q.ans))return `몫 ${Math.floor(x/y)}, 나머지 ${x%y}`;return String({'+':x+y,'−':x-y,'×':x*y,'÷':x/y}[m[2]])}
  if((m=s.match(/^(\d+) \+ (\d+) \+ (\d+)$/)))return String(+m[1]+ +m[2]+ +m[3]);
  if((m=s.match(/^(\d+) \+ □ = (\d+)$/)))return String(m[2]-m[1]);
  if((m=s.match(/^(\d+) − □ = (\d+)$/)))return String(m[1]-m[2]);
  if((m=s.match(/^(\d+)분의 (\d+) \+ \1분의 (\d+)$/)))return m[1]+'분의 '+(+m[2]+ +m[3]);
  if((m=p.match(/^\d+씩 뛰어 세었어요\./))&&(m=s.match(/^(\d+), (\d+), (\d+), □$/)))return String(2*m[3]-m[2]);
  if((m=s.match(/^(\d+), (\d+), (\d+), □$/)))return String(2*m[3]-m[2]);
  if((m=p.match(/^한 (\S+)에 \S+ (\d+)\S+씩 들어 있어요\. (\d+)(\S+)에는 모두 몇 \S+일까요\?$/)))return m[1]===m[4]?String(m[2]*m[3]):'세는 말 다름';
  if(/인 수는\?$/.test(p)){let v=0;for(const x of p.matchAll(/(1000|100|10)이 (\d)개/g))v+=x[1]*x[2];return String(v)}
  if((m=p.match(/^(\d+) m (\d+) cm는 몇 cm일까요\?$/)))return (100*m[1]+ +m[2])+' cm';
  if((m=p.match(/^(\d+)시 (\d+)분은 (\d+)시 몇 분 전일까요\?$/)))return +m[3]===+m[1]%12+1?(60-m[2])+'분 전':'다음 시 아님';
  if((m=p.match(/^\S+ (\d+)\S+ (\d+)명이 똑같이 나누면 한 명이 몇 \S+씩 가질까요\?$/)))return m[1]%m[2]===0?String(m[1]/m[2]):'나누어떨어지지 않음';
  if((m=p.match(/^\S+ 하나를 똑같이 (\d+)조각으로 나누었어요\. 한 조각은 전체의 얼마일까요\?$/)))return m[1]+'분의 1';
  if((m=p.match(/^(.+) 중 가장 (큰|작은) 분수는\?$/))){const v=m[1].split(', '),f=v.map(frac),t=m[2]==='큰'?Math.max(...f):Math.min(...f);return v.filter((_,i)=>f[i]===t).join('/')}
  if((m=p.match(/^(\d+)시 (\d+)분에서 (\d+)분이 지나면 몇 시 몇 분일까요\?$/))){const [h,mm]=after(+m[1],+m[2],+m[3]);return h+'시'+(mm?' '+mm+'분':'')}
  if((m=p.match(/^(\d+)시간 (\d+)분은 모두 몇 분일까요\?$/)))return (60*m[1]+ +m[2])+'분';
  if((m=p.match(/^(\d+) (L|kg) (\d+) (mL|g)[은는] 몇 \4일까요\?$/)))return (1000*m[1]+ +m[3])+' '+m[4];
  if((m=p.match(/^반지름이 (\d+) cm인 원의 지름은 몇 cm일까요\?$/)))return 2*m[1]+' cm';
  if((m=p.match(/^지름이 (\d+) cm인 원의 반지름은 몇 cm일까요\?$/)))return m[1]/2+' cm';
  if((m=p.match(/^(.+) 중 (둔각|예각)은\?$/))){const v=m[1].split(', ');return v.filter(x=>{const d=parseInt(x,10);return m[2]==='둔각'?d>90&&d<180:d<90}).join('/')}
  if((m=p.match(/^삼각형의 두 각이 (\d+)도, (\d+)도일 때 나머지 한 각은 몇 도일까요\?$/)))return (180-m[1]-m[2])+'도';
  if((m=p.match(/^([\d, ]+) 중 가장 (큰|작은) 수는\?$/))){const v=m[1].split(', ').map(Number);return String(m[2]==='큰'?Math.max(...v):Math.min(...v))}
  return undefined;
}
const DIGIT='영일이삼사오육칠팔구';
const sino=n=>{if(n===0)return '영';let s='';for(const [v,w] of [[1000,'천'],[100,'백'],[10,'십']]){const d=Math.floor(n/v)%10;if(d)s+=(d===1?'':DIGIT[d])+w}const d=n%10;return d?s+DIGIT[d]:s};
const OPW={'+':'더하기','−':'빼기','×':'곱하기','÷':'나누기'};

/* ---------- 조립 ---------- */
const snap=Q.snapshot(),bankStory={},bankQuiz={};
for(const a of Q.AGES){bankStory[a]=snap[a].story;bankQuiz[a]=snap[a].quiz}
const allPassages=new Map();for(const a of Q.AGES)for(const q of bankStory[a])allPassages.set(q.passage,q.id);
const out={story:[],quiz:[]},stat={};
for(const age of AGES){
  const L=LIM[age],n=NCH[age],P=parseStory(age),QZ=parseQuiz(age);
  const place=placer(G[age].story,n,()=>'s');let k=0;
  const seenP=new Set(),newStory=[];
  for(const ps of P){
    const p=ps.passage,sent=p.split('\n'),tag=age+'세 s'+ps.line;
    if(age===9&&sent.length!==2)E(tag+': 9세 지문은 두 문장');
    if(age===10&&(sent.length<3||sent.length>4))E(tag+': 10세 지문은 3~4문장');
    if(!sent.every(t=>/[가-힣]\.$/.test(t)&&H.sentences(t)===1))E(tag+': 문장마다 마침표 하나로 끝나야 함 '+sent.join(' / '));
    if(H.syllables(p)>L.syl)E(tag+': 지문 '+H.syllables(p)+'음절 > '+L.syl);
    sent.forEach(t=>{if(H.compactLength(t)>L.sent)E(tag+': 문장 '+H.compactLength(t)+'자 > '+L.sent+' '+t)});
    if(allPassages.has(p)||seenP.has(p))E(tag+': 지문 중복');seenP.add(p);
    if(isBad(p))E(tag+': 부적절 낱말 '+p);
    spellBad(p).forEach(m=>E(tag+': 맞춤법 '+m));
    if(ps.qs.length<1||ps.qs.length>3)E(tag+': 지문당 질문 1~3개');
    if(new Set(ps.qs.map(x=>x.prompt)).size!==ps.qs.length)E(tag+': 같은 지문 질문 중복');
    if(new Set(ps.qs.map(x=>x.ans)).size!==ps.qs.length)E(tag+': 같은 지문 정답 중복');
    for(const x of ps.qs)for(const y of ps.qs)if(x!==y&&[...x.ans].length>=2&&y.prompt.includes(x.ans))E(tag+': 질문 "'+y.prompt+'"이 다른 질문의 정답 "'+x.ans+'"을 드러냄');
    for(const x of ps.qs){
      const t2=age+'세 s'+x.line,ch=[x.ans,...x.wrong];
      if(ch.length!==n)E(t2+': 보기 '+n+'개여야 함('+ch.length+')');
      if(new Set(ch).size!==ch.length)E(t2+': 보기 중복');
      if(!/\?$/.test(x.prompt))E(t2+': 질문은 ?로 끝남');
      if(H.syllables(x.prompt)>L.prompt)E(t2+': 질문 '+H.syllables(x.prompt)+'음절 > '+L.prompt);
      ch.forEach(c=>{if(H.compactLength(c)>L.choice)E(t2+': 보기 '+H.compactLength(c)+'자 > '+L.choice+' '+c)});
      if(!x.wrong.some(c=>inPassage(c,p)))E(t2+': 지문 속 오답 없음');
      if([x.prompt,...ch].some(isBad))E(t2+': 부적절 낱말');
      [x.prompt,...ch].forEach(t=>spellBad(t).forEach(m=>E(t2+': 맞춤법 '+m+' '+t)));
      const ans=place(p+'|'+x.prompt,'s'),rest=shuffle(x.wrong,p+'#'+x.prompt);rest.splice(ans,0,x.ans);
      const q={id:'a'+age+'-story-k'+String(++k).padStart(3,'0'),age,mode:'story',prompt:x.prompt,passage:p,speak:p,choices:rest,answer:ans,note:ps.genre+'·'+x.type,level:x.level};
      q._inP=x.wrong.filter(c=>inPassage(c,p)).length;q._line=x.line;
      newStory.push(q);
    }
  }
  /* 가까운 지문(낱자 둘씩 겹침 비율) */
  const bankP=[...new Set(bankStory[age].map(q=>q.passage))].map(p=>[p,bigr(p)]);
  for(const p of seenP){const b=bigr(p);let best=0,bp='';for(const [o,ob] of bankP){const j=jac(b,ob);if(j>best){best=j;bp=o}}if(best>=.45)W(age+'세 가까운 지문 '+best.toFixed(2)+': '+p.split('\n')[0]+' ≈ '+bp.split('\n')[0])}
  /* 퀴즈 */
  const qplace=placer(G[age].quiz,4,q=>q.cat);let kq=0;const newQuiz=[];
  const bankKeys=new Set(bankQuiz[age].map(q=>q.prompt+'\n'+q.passage)),bankSig=bankQuiz[age].map(q=>[q.id,bigr(q.prompt+q.passage+q.choices[q.answer])]);
  const crossKeys=new Map();for(const a of Q.AGES)for(const q of bankQuiz[a])crossKeys.set(q.prompt+'\n'+q.passage+'\n'+q.choices[q.answer],q.id);
  for(const x of QZ){
    const t2=age+'세 q'+x.line,ch=[x.ans,...x.wrong];
    if(ch.length!==4||ch.some(c=>!c))E(t2+': 보기 4개');
    if(new Set(ch).size!==ch.length)E(t2+': 보기 중복');
    if(H.syllables(x.prompt)>L.qprompt)E(t2+': 질문 '+H.syllables(x.prompt)+'음절 > '+L.qprompt);
    ch.forEach(c=>{if([...c].length>L.qchoice)E(t2+': 보기 '+[...c].length+'자 > '+L.qchoice+' '+c)});
    let speak=x.speak;
    if(!speak){if(/[0-9A-Za-z]/.test(x.prompt))E(t2+': 질문에 숫자·영문이 있으면 읽기(speak)를 따로 써야 함');speak=x.prompt}
    if(/[0-9A-Za-z]/.test(speak)||!/[?.]$/.test(speak)||/[+−×÷=□<>%]/.test(speak))E(t2+': speak 형식 '+speak);
    if(new Set(ch.map(c=>/[.?!]$/.test(c)?c.slice(-1):'')).size!==1)E(t2+': 보기 끝 문장부호 통일');
    const lat=ch.filter(c=>/[A-Za-z]/.test(c));if(lat.length&&(lat.length!==4||new Set(lat.map(c=>c[0]===c[0].toUpperCase())).size!==1))E(t2+': 영문 보기 통일');
    const key=x.prompt+'\n'+x.passage;if(bankKeys.has(key))E(t2+': 기존 문항과 질문·지문 같음 '+key.replace('\n',' / '));bankKeys.add(key);
    if(crossKeys.has(key+'\n'+x.ans))E(t2+': 다른 나이 '+crossKeys.get(key+'\n'+x.ans)+'와 같은 문항');
    [x.prompt,x.passage,...ch].forEach(t=>spellBad(t).forEach(m=>E(t2+': 맞춤법 '+m+' '+t)));
    if(x.cat==='math'){const want=mathAns(x);if(want===undefined)E(t2+': 수학 재계산 틀 없음 '+x.prompt+' '+x.passage);else if(want!==x.ans)E(t2+': 수학 정답 '+x.ans+' ≠ 계산 '+want);
      const ex=x.passage.match(/^(\d+) ([+−×÷]) (\d+)$/);if(ex){const head=sino(+ex[1])+' '+OPW[ex[2]]+' '+sino(+ex[3]);if(!speak.startsWith(head))E(t2+': speak는 '+head+'로 시작');else{const pp=speak.charAt(head.length),b=H.hasBatchim(head.slice(-1));if(!(pp==='의'||(pp==='은'&&b)||(pp==='는'&&!b)))E(t2+': 식 뒤 조사 '+pp)}}
      const vals=ch.map(c=>Number.isNaN(Number(c))?c:Number(c));if(new Set(vals).size!==4)E(t2+': 같은 값 보기');
      if(/가장 (큰|작은)/.test(x.prompt)){/* 원고 순서와 무관: 섞은 뒤 다시 확인 */}
    }
    const sg=bigr(x.prompt+x.passage+x.ans);for(const [id,b] of bankSig){const j=jac(sg,b);if(j>=.75){W(age+'세 q'+x.line+' 가까운 퀴즈 '+j.toFixed(2)+' '+id+': '+x.prompt+' '+x.passage+' = '+x.ans);break}}
    const ans=qplace(x.prompt+'|'+x.passage,x.cat);let rest=shuffle(x.wrong,x.prompt+'#'+x.passage);rest.splice(ans,0,x.ans);
    if(/가장 (큰|작은)/.test(x.prompt)){const v=rest.map(c=>Number.isNaN(Number(c))?frac(c):Number(c));const up=v.every((y,i)=>!i||y>v[i-1]),dn=v.every((y,i)=>!i||y<v[i-1]);if(up||dn){const w=[0,1,2,3].filter(i=>i!==ans);[rest[w[0]],rest[w[1]]]=[rest[w[1]],rest[w[0]]]}}
    const q={id:'a'+age+'-quiz-k'+String(++kq).padStart(3,'0'),age,mode:'quiz',cat:x.cat,prompt:x.prompt,passage:x.passage,speak,choices:rest,answer:ans,note:'',level:x.level};
    newQuiz.push(q);
  }
  /* 묶음 통계 */
  const genAll=G[age].story.concat(newStory),sl=genAll.filter(q=>soleLong(q.choices,q.answer)).length,slN=newStory.filter(q=>soleLong(q.choices,q.answer)).length,ssN=newStory.filter(q=>soleShort(q.choices,q.answer)).length;
  if(sl>genAll.length/n)E(age+'세: 생성 읽기 정답=혼자 가장 긴 보기 '+sl+'/'+genAll.length+' > 1/'+n);
  const byP=new Map();genAll.forEach(q=>byP.set(q.passage,q.note.split('·')[0]));const info=[...byP.values()].filter(g=>g==='설명문').length/byP.size;
  const deep=genAll.filter(q=>/마음|추론|중심/.test(q.note)).length/genAll.length;
  if(age===9&&!(info>=.2&&info<=.35&&deep>=.2))E('9세 갈래·유형 비율 설명문 '+info.toFixed(2)+' 깊은 질문 '+deep.toFixed(2));
  if(age===10&&!(info>=.3&&info<=.5&&deep>=.4&&deep<=.6))E('10세 갈래·유형 비율 설명문 '+info.toFixed(2)+' 깊은 질문 '+deep.toFixed(2));
  const tally=Array(n).fill(0);genAll.forEach(q=>tally[q.answer]++);if(Math.max(...tally)-Math.min(...tally)>3)E(age+'세 생성 읽기 정답 자리 '+tally.join('/'));
  const newP=new Set(newStory.map(q=>q.passage)),types={},cats={};newStory.forEach(q=>types[q.note]=(types[q.note]||0)+1);newQuiz.forEach(q=>cats[q.cat]=(cats[q.cat]||0)+1);
  stat[age]={story:newStory.length,passages:newP.size,info:[...newP].filter(p=>byP.get(p)==='설명문').length,quiz:cats,soleLongNew:slN,soleShortNew:ssN,soleLongGen:sl+'/'+genAll.length,
    inP2:newStory.filter(q=>q._inP>=2).length,infoShare:+info.toFixed(3),deepShare:+deep.toFixed(3),types,
    unique:{before:new Set(bankStory[age].map(q=>q.passage)).size+bankQuiz[age].length,after:new Set(bankStory[age].map(q=>q.passage)).size+newP.size+bankQuiz[age].length+newQuiz.length},
    total:{before:bankStory[age].length+bankQuiz[age].length,after:bankStory[age].length+bankQuiz[age].length+newStory.length+newQuiz.length}};
  newStory.forEach(q=>{delete q._inP;delete q._line});
  out.story.push(...newStory);out.quiz.push(...newQuiz);
}

const mode=process.argv[2]||'build';
if(mode==='build'){
  warns.forEach(m=>console.log('주의 '+m));
  errs.forEach(m=>console.log('오류 '+m));
  console.log(JSON.stringify(stat,null,1));
  const body='{"story":[\n'+out.story.map(q=>JSON.stringify(q)).join(',\n')+'\n],"quiz":[\n'+out.quiz.map(q=>JSON.stringify(q)).join(',\n')+'\n]}\n';
  if(errs.length){console.log('오류 '+errs.length+'개: 파일을 쓰지 않음');process.exit(1)}
  fs.writeFileSync(OUT,body);console.log('썼음 '+path.relative(ROOT,OUT)+' 읽기 '+out.story.length+' 퀴즈 '+out.quiz.length);
}else if(mode==='sim'){
  if(errs.length){errs.forEach(m=>console.log('오류 '+m));process.exit(1)}
  const dir=path.resolve(process.argv[3]||path.join(os.tmpdir(),'bank-910-sim'));
  fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir,{recursive:true});
  const skip=new Set(['.git','node_modules','art-handoff','.pages-build','test-results','bank-drafts']);
  for(const f of fs.readdirSync(ROOT)){if(skip.has(f))continue;fs.cpSync(path.join(ROOT,f),path.join(dir,f),{recursive:true})}
  for(const f of ['art-handoff','node_modules'])if(fs.existsSync(path.join(ROOT,f)))fs.symlinkSync(fs.realpathSync(path.join(ROOT,f)),path.join(dir,f),'junction');
  fs.copyFileSync(OUT,path.join(dir,'draft.json'));
  const extra=(process.argv.slice(3).find(a=>a.startsWith('with='))||'').slice(5);/* with=다른 초안.json(예: 7·8세)도 함께 붙여 본다 */
  const files=['draft.json'].concat(extra?extra.split(',').map(f=>path.resolve(f)):[]);
  const r=cp.spawnSync(process.execPath,['scripts/bank-add.cjs',...files],{cwd:dir,encoding:'utf8'});
  process.stdout.write(r.stdout);process.stderr.write(r.stderr);if(r.status)process.exit(r.status);
  const line=(r.stdout.match(/BANK_PRINT에 더할 줄 →\s+(\d+:\{.*\}),/)||[])[1];if(!line){console.log('지문 줄을 못 찾음');process.exit(1)}
  const tq=path.join(dir,'test-questions.cjs');let t=fs.readFileSync(tq,'utf8');const eol=t.includes('\r\n')?'\r\n':'\n';
  t=t.replace(/(\n\s*3:\{"7":"[0-9a-f]+","8":"[0-9a-f]+","9":"[0-9a-f]+","10":"[0-9a-f]+"\})(\r?\n)/,(_,a,b)=>a+','+eol+'  '+line+b);fs.writeFileSync(tq,t);
  console.log('BANK_PRINT 새 줄: '+line);
  const run=(args,env)=>{const s=cp.spawnSync(process.execPath,args,{cwd:dir,encoding:'utf8',env:Object.assign({},process.env,env||{}),maxBuffer:64<<20});const o=(s.stdout||'')+(s.stderr||'');console.log(o.split('\n').filter(l=>/PASS|FAIL|Error|assert|^\d+\. /.test(l)).slice(-40).join('\n'));return s.status};
  console.log('--- node test-questions.cjs');const s1=run(['test-questions.cjs']);
  let s2=0;if(process.argv.includes('dom')){console.log('--- SOFT=1 node test-dom.cjs');s2=run(['test-dom.cjs'],{SOFT:'1'})}
  console.log('사본: '+dir);process.exit(s1||s2?1:0);
}
