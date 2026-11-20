/* 문제은행 판 이행 검사: 예전 은행의 최신 판(예: 판 3)으로 진행 중이던 저장이 새 은행(예: 판 4)에서도 그대로인지 예전 파일과 직접 견준다.
     node scripts/bank-migrate-check.cjs [git 기준, 기본 origin/main]
   예전 questions-gen.js·questions.js는 git show로 읽고, 지금 파일과 함께 브라우저처럼(window) 따로 실행해 견준다.
   보는 것
   (1) 묶음 크기: 새 은행의 예전 판 = 예전 은행의 최신 판
   (2) 예전 은행의 모든 문항 id → 새 은행 byId가 같은 문항(수첩 기억 늑대·걸어 둔 복습 글이 기억한 id)
   (3) 씨앗 × 번호 0~599 × 이어 순서(off) 여러 개에서 at()의 문항·보기 순서·정답 자리·바퀴가 같음(새로고침·결전 문제 번호 포함)
   (4) used()(판을 마칠 때 이어 순서에 더하는 수)가 같음
   (5) 수첩 이어 순서(book.js): 읽기 한 바퀴 전에는 예전 판을 그대로 쓰고, 한 바퀴가 끝난 곳에서만 새 판으로 올림
   (6) 판 저장의 bank 복원(Combat.restore)과 화면의 판 번호 규칙(index.html), 기록 열기(knows)에서 기억 늑대 id가 살아남음
   새 판을 붙일 때마다(scripts/bank-add.cjs 뒤) 한 번 돌린다. 실패하면 첫 차이를 보이고 종료 코드 1 */
const {execFileSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.join(__dirname,'..'),ref=process.argv[2]||'origin/main';
const show=f=>execFileSync('git',['show',ref+':'+f],{cwd:ROOT,maxBuffer:64<<20}).toString('utf8');
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const load=(gen,q)=>{const win={};const ctx=vm.createContext({window:win});vm.runInContext(gen,ctx);vm.runInContext(q,ctx);return win.Questions};
const OLD=load(show('questions-gen.js'),show('questions.js')),NEW=load(read('questions-gen.js'),read('questions.js'));
const B=require(path.join(ROOT,'book.js')),C=require(path.join(ROOT,'combat.js'));
const V=OLD.BANK_VERSION,L=NEW.BANK_VERSION,AGES=NEW.AGES,J=JSON.stringify;
let n=0,fail=null;
const eq=(a,b,msg)=>{n++;if(fail)return;const x=J(a),y=J(b);if(x!==y)fail='#'+n+' '+msg+'\n  새: '+x.slice(0,300)+'\n  예전: '+y.slice(0,300)};
const ok=(v,msg)=>{n++;if(!fail&&!v)fail='#'+n+' '+msg};
console.log('기준 '+ref+': 예전 은행 판 '+V+' → 지금 판 '+L);
if(L<=V){console.log('판이 오르지 않았음(견줄 것 없음)');process.exit(0)}
const zero={story:0,common:0,math:0,english:0};
/* (1) 묶음 크기 */
for(const a of AGES)eq(NEW.bankCount(a,V),OLD.bankCount(a),a+'세 판 '+V+' 묶음 크기');
/* (2) 예전 은행의 모든 id → 같은 문항 */
let ids=0;
{const S=OLD.snapshot();for(const a of AGES)for(const m of ['story','quiz'])for(const q of S[a][m]){ids++;eq(NEW.byId(q.id),OLD.byId(q.id),q.id+' byId')}}
/* (3)·(4) at()·used(): off = 없음 · 0 · 중간 · 바퀴 끝 바로 앞 · 두 바퀴 넘게 */
const SEEDS=[0,1,7,42,4242,123456,2147483646];
let calls=0;
for(const a of AGES){
  const size=NEW.bankCount(a,V),offs=[undefined,zero,{story:37,common:5,math:9,english:2},
    {story:size.story-5,common:size.common-1,math:size.math-2,english:Math.max(0,size.english-1)},
    {story:size.story*2+3,common:size.common+4,math:size.math*3,english:size.english+1}];
  for(const s of SEEDS){
    for(const off of offs)for(let i=0;i<600;i++){calls++;eq(NEW.at(a,'story',i,s,V,off),OLD.at(a,'story',i,s,V,off),a+'세 씨앗 '+s+' 번호 '+i+' off '+J(off))}
    for(const k of [0,1,37,160,599])eq(NEW.used(a,k,s,V),OLD.used(a,k,s),a+'세 used('+k+') 씨앗 '+s);
  }
}
/* (5) 수첩 이어 순서: 판 V로 시작한 아이 */
for(const a of AGES){
  const s=4242,size=NEW.bankCount(a,V),b=B.fresh(1700000000000,s);
  b.order.bank[a]=V;b.order.off[a]={story:40,common:3,math:6,english:1};
  const o0=B.orderFor(b,a);eq([o0.bank,o0.off],[V,b.order.off[a]],a+'세 기록의 이어 순서(판 '+V+')');
  /* 한 판(73문제)을 마침: 바퀴 전 → 판 V 그대로, 다음 판 첫 문제 = 예전 은행에서 이어 갔을 문제 */
  const u=NEW.used(a,73,s,V),o1=B.advanceOrder(b,a,u,{bank:V,latest:L,size});
  ok(o1.bank===V&&o1.off.story===40+u.story,a+'세: 읽기 한 바퀴 전에는 판 '+V+' 그대로 '+J(o1));
  for(let i=0;i<60;i++)eq(NEW.at(a,'story',i,s,o1.bank,o1.off),OLD.at(a,'story',i,s,V,o1.off),a+'세 다음 판 '+i+'번 = 예전 은행에서 이어 갔을 문제');
  /* 읽기 한 바퀴가 끝남 → 새 판, 새 바퀴 처음부터 */
  const o2=B.advanceOrder(b,a,{story:size.story,common:0,math:0,english:0},{bank:V,latest:L,size});
  eq([o2.bank,o2.off],[L,zero],a+'세: 한 바퀴 끝에서 판 '+L+'로 올리고 0부터');
  eq(NEW.at(a,'story',0,s,o2.bank,o2.off).id,NEW.at(a,'story',0,s,L).id,a+'세: 올린 뒤 첫 문제 = 판 '+L+'의 첫 문제');
}
/* (6) 판 저장·화면 규칙·기록 열기 */
{const st=C.restore({...C.fresh(8),version:3,bank:V,seed:77,index:40},AGES);eq(st.bank,V,'Combat.restore가 판 '+V+'를 이어받음');
 const html=read('index.html');ok(html.includes('if(!(state.bank>=1&&state.bank<=Questions.BANK_VERSION))state.bank=stateKept?1:Questions.BANK_VERSION;'),'index.html: 1~최신 사이 판 번호는 그대로 둠');
 ok(st.bank>=1&&st.bank<=L,'판 '+V+'는 1~'+L+' 사이라 그대로 쓰임');
 for(let i=0;i<40;i++)eq(NEW.at(8,'story',40+i,77,st.bank),OLD.at(8,'story',40+i,77),'저장된 판의 '+(40+i)+'번 = 예전 은행의 같은 번호');
 /* 기억 늑대: 나이·묶음마다 예전 은행의 처음·가운데·마지막 생성 문항 id를 담은 기록 */
 const S=OLD.snapshot(),rv=[];for(const a of AGES)for(const m of ['story','quiz']){const g=S[a][m].filter(q=>/-g\d+$/.test(q.id));for(const q of [g[0],g[g.length>>1],g[g.length-1]])rv.push({id:q.id,box:2,due:0,dp:1,miss:1,seen:0})}
 const raw={...B.fresh(1700000000000,4242),rv,pend:{kind:'review',key:'x',id:rv[rv.length-1].id,index:12,run:1,seed:4242}};
 const store={m:{'hangul-defense-book':J(raw)},getItem(k){return this.m[k]||null},setItem(k,v){this.m[k]=v}};
 const h=B.open(store,B.keys({}),{now:1700000000000,knows:id=>!!NEW.byId(id)});
 eq([h.status,h.book.rv.map(e=>e.id)],['ok',rv.map(e=>e.id).slice(-200)],'기록을 열어도 예전 판의 기억 늑대 id '+rv.length+'개가 모두 남음');
 eq(h.book.pend&&h.book.pend.id,rv[rv.length-1].id,'걸어 둔 복습 글 id도 그대로');
 for(const e of rv)eq(NEW.byId(e.id),OLD.byId(e.id),e.id+' 기억 늑대가 다시 낼 글이 같음');
}
if(fail){console.error('FAIL '+fail);process.exit(1)}
console.log('PASS '+n+'건: 묶음 크기 · id '+ids+'개 byId · at() '+calls+'칸(씨앗 '+SEEDS.length+' × off 5 × 600) · used · 수첩 이어 순서 · 판 저장 · 기억 늑대');
