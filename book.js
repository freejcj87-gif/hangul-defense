/* 판을 넘는 기록(발자국 수첩·지킴이 훈장·기억 늑대·이어 순서·보호자 설정·날짜별 기록)과 그 규칙. DOM·저장소·시계에 손대지 않는 순수 함수(combat.js처럼 브라우저 window.Book / Node module.exports).
   명세: launch/design/02-MVP-구현명세-20261118.md(§2 저장, §3 규칙 수치, 끝의 변경 기록 2차까지 반영). 수치는 모두 [가정] 초안이고 연결 단계 시뮬(§3.8)로 맞춘다.
   판 저장(hangul-defense-v1, 저장 v3)은 건드리지 않는다. 기록은 새 열쇠 hangul-defense-book(기록 v1)에 따로 둔다.
   시각(now, ms)·저장소(getItem/setItem/removeItem)·문항 조회(noteOf, byId)는 모두 인자로 받는다. 화면 연결은 docs/book-mvp-progress.md */
(function(root){
  const V=1,FMT='kkm-book',FILE_FMT='kkomaeul-progress',FILE_V=1,FILE_MAX=1048576;
  const KINDS=['wolf','bramble','boar','granite','frost','ember','fox','king'];
  const MEDALS=['one','fresh','again','rush','en','quiz','king','fox','arrow','keeper','star','map'];
  const POOLS=['story','common','math','english'],AGES=[7,8,9,10];
  const HOUR=3600000,DAYMS=24*HOUR,T0=Date.UTC(2026,0,1);
  /* 모든 상수는 여기(검사·시뮬이 덮어쓸 수 있게, Combat.FLAGS와 같은 방식) */
  const BOOK={
    ON:true,
    FLAGS:{notes:true,review:true,order:true,shiny:true,medals:true,friends:true,book3d:true},/* book3d(0.17): 마을 안 3D 표현(쪽지 종이·기억 늑대 팻말·친구 방문). ?book3d=0이면 장면만 끔(규칙 그대로) */
    SESSION_GAP:4*HOUR,/* 마지막 활동에서 이만큼 지나 다시 시작하면 새 놀이(§3.6) */
    DAY_DEFAULT:30,DAY_CHOICES:[0,20,30,45,60],DAY_EXTEND:15,/* 하루 시간(분). 0 = 없음. 기본 30분은 프로듀서 결정(2026-11-19) */
    VILLAGES:['meadow','quarry','frost','ember'],/* Combat.VILLAGES와 같아야 함(검사) */
    /* §3.1 쪽지 자격: 정답 화살로 물리친 놀이 수 + 누적 처치. 자격이 된 그다음 처치에서 떨어뜨린다. 여우 = 구출, 왕 = 결전 승리(두 번째 승리 때 떨어뜨림) */
    /* cap: 한 놀이에 쪽지 문제 수. 2 → 1(2026-11-19 시뮬: 2이면 친구 카드 8장이 6판에 끝남, 통과선 7~12판) */
    NOTE:{cap:1,gap:10,after:5,
      need:{wolf:{plays:2,kills:30},bramble:{plays:2,kills:30},boar:{plays:2,kills:8},granite:{plays:2,kills:8},frost:{plays:2,kills:12},ember:{plays:2,kills:2},fox:{plays:2,kills:0},king:{plays:1,kills:1}}},
    /* 리본: 카드 뒤, 한 놀이에 이만큼 정답 화살로 물리친 놀이 need번 */
    RIBBON:{need:3,kills:{wolf:10,bramble:10,boar:3,granite:3,frost:4,ember:1,fox:1,king:1}},
    SPECIAL:{gap:3},/* 특별 문제(쪽지·복습) 사이 문제 수 */
    /* §3.4 반짝 손님: 판당 기회 한 번(after번째 문제 뒤, 신바람 2단 또는 그 판 한 번에 맞힌 수 firsts 중 먼저), 확률 p, 꽝 pity번 뒤 확정. firsts 0 = 누적 경로 끔 */
    /* firsts 0: 프로듀서 결정(2026-11-19) '반짝 손님은 연속 정답 때만'. 누적 경로(느린 아이용, 25개)는 꺼 둔다(찍기 아이도 이 경로로 손님을 만났음, 시뮬 S6) */
    SHINY:{p:.25,pity:2,after:10,firsts:0},
    /* §3.5 기억 늑대: 칸 1 같은 놀이 delay문제 뒤, 칸 2 다음 놀이, 칸 3 세 놀이 뒤 */
    /* share: 한 놀이 문제 가운데 복습 비율 상한. 0.2 → 0.1(2026-11-19 시뮬: 0.2이면 엔딩까지 문제 +1.4~4.6%·분당 금화 −5~−6%로 통과선 +3%·±2%를 넘음) */
    /* 0.1 → 0.07(2026-11-19 2차 시뮬: 복습 문제는 놓쳐도 연속을 끊지 않게 한 뒤에도 0.1이면 분당 금화 −2.0~−3.2%, 0.07이면 −1.2~−1.7%로 통과선 ±2% 안) */
    REVIEW:{share:.07,same:3,after:3,delay:[5,10],wait:[0,0,1,3],cap:200},
    /* §3.3 훈장 문턱 [동, 은, 금] */
    MEDAL:{one:[50,300,1000],fresh:[30,100,200],again:[5,30,100],rush:[1,15,60],en:[5,25,80],quiz:[10,50,150],king:[1,5,15],fox:[3,15,40],arrow:[100,1000,5000],keeper:[1,5,15],star:[1,5,15],map:[1,2,4]},
    MEDAL_GROUP:{one:'read',fresh:'read',again:'read',rush:'read',en:'read',quiz:'read',king:'guard',fox:'guard',arrow:'guard',keeper:'guard',star:'town',map:'town'},
    /* 보호자 문턱(변경 기록 2차): 2초 길게 누르기 + 글로 적힌 세 자리 수 입력. 보안 장치가 아니라 아이가 우연히 들어가지 않게 하는 문턱 */
    GATE:{hold:20,digits:3,tries:3,wait:300,idle:1800},
    /* §3.9 영어 설정별 퀴즈 분류 가중치(20칸). std = 지금 Questions.QUIZ_MIX. more는 9세부터 */
    MIX:{off:{7:{math:13,common:7,english:0},8:{math:10,common:10,english:0},9:{math:8,common:12,english:0},10:{math:7,common:13,english:0}},
      std:{7:{math:13,common:6,english:1},8:{math:10,common:8,english:2},9:{math:8,common:8,english:4},10:{math:7,common:9,english:4}},
      more:{9:{math:7,common:7,english:6},10:{math:6,common:8,english:6}}},
    MORE_FROM:9,
    CAPS:{seen:4000,rv:200,day:35,log:30,count:1e7,friends:4},
    /* 0.17 수첩 3D(장면 전용: 세계·경제·기록에 쓰지 않는다. 단위는 틱 0.1초 · 장면 거리)
       note: 떨어진 쪽지 종이가 땅에 남는 틱(그 쪽지 문제가 나오면 그 전에 사라짐) · edge: 종이를 놓는 가장 먼 자리(마을 반지름 + edge, 화면 안)
       sign: 기억 늑대 문제가 시작된 뒤 새로 오는 늑대를 기다리는 틱(그 뒤에는 울타리 밖에서 다가오는 늑대 가운데 가장 바깥)
       친구 방문: 늑대·왕·여우가 없는 틈이 quiet틱 이어지면, 지난 방문에서 gap~gap+jitter틱(첫 방문 first, 더 놀기 free~free+jitter) 지난 뒤 한 마리가
       숲 쪽 r0에서 길을 따라 울타리 밖 r1까지 walk(장면 거리/틱)로 걸어와 stay틱 인사하고 돌아간다. 늑대가 나오면 곧바로 돌아간다(run배 빠르기) */
    SCENE:{note:900,edge:3.5,sign:30,quiet:30,gap:600,jitter:300,first:300,free:200,walk:.14,run:2,stay:30,r0:6,r1:1.3,river:50}
  };

  /* ---------- 작은 도구 ---------- */
  const isObj=o=>!!o&&typeof o==='object'&&!Array.isArray(o);
  const has=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  const int=(v,lo,hi,d)=>Number.isFinite(v)?Math.min(hi,Math.max(lo,Math.floor(v))):d;
  const cnt=v=>int(v,0,BOOK.CAPS.count,0);
  const nowOf=now=>Number.isFinite(now)&&now>=T0?Math.floor(now):T0;
  const stamp=(v,now)=>Number.isFinite(v)&&v>=T0&&v<=nowOf(now)+DAYMS?Math.floor(v):0;
  const p2=n=>(n<10?'0':'')+n;
  /* 기기 현지 날짜 YYYY-MM-DD */
  const dayOf=now=>{const d=new Date(nowOf(now));return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate())};
  const isDay=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s);
  /* FNV-1a 32비트(UTF-8 바이트), 16진수 8자리 */
  function fnv1a(str){
    let h=2166136261;const put=b=>{h^=b;h=Math.imul(h,16777619)};
    for(const ch of String(str)){const c=ch.codePointAt(0);
      if(c<0x80)put(c);else if(c<0x800){put(0xC0|c>>6);put(0x80|c&63)}else if(c<0x10000){put(0xE0|c>>12);put(0x80|c>>6&63);put(0x80|c&63)}else{put(0xF0|c>>18);put(0x80|c>>12&63);put(0x80|c>>6&63);put(0x80|c&63)}}
    return ('0000000'+(h>>>0).toString(16)).slice(-8);
  }
  const hash=str=>parseInt(fnv1a(str),16);
  /* 결정적 난수 xorshift32: 상태는 0이 아닌 32비트 정수 */
  const xs=x=>{x^=x<<13;x>>>=0;x^=x>>>17;x^=x<<5;return x>>>0};
  const seedOf=v=>{const s=int(v,0,4294967295,0);return s||2463534242};
  /* 기록의 난수(반짝 손님 전용): 상태를 한 칸 넘기고 [0,1) */
  function rand(b){b.rng=xs(seedOf(b.rng));return b.rng/4294967296}

  /* ---------- 기록 v1 ---------- */
  const freshMon=()=>({foot:0,plays:0,last:0,kills:0,note:0,nv:0,card:0,rib:{n:0,last:0},ribKills:0,shiny:0});
  const freshCur=()=>({d:'',age:0,q:0,f:0,nw:0,en:[0,0],qz:[0,0],rd:[0,0],rv:[0,0],s:0});
  /* now = 지금 시각(ms), seed = 이어 순서 씨앗(지금 판의 state.seed) */
  function fresh(now,seed){
    const t=nowOf(now),b={fmt:FMT,v:V,made:t,at:t,from:0,play:1,pq:0,
      order:{seed:int(seed,0,4294967295,0),off:{},bank:{}},
      mon:{},drop:null,pend:null,notes:{play:1,n:0,lastQ:-99},
      shiny:{miss:0,run:0,pend:null,guest:null,f:0,fr:0},
      medal:{},vil:{},rv:[],rvPlay:{play:1,n:0,ids:{},lastQ:-99},seen:[],day:{},log:[],cur:freshCur(),tot:{q:0,f:0,s:0,days:0},
      set:{en:'std',day:BOOK.DAY_DEFAULT,sfx:1},today:{d:'',s:0,ext:0},rng:seedOf(hash('rng|'+t+'|'+(seed||0)))};
    for(const k of KINDS)b.mon[k]=freshMon();
    for(const k of MEDALS)b.medal[k]={n:0,at:[0,0,0]};
    return b;
  }
  const pair=v=>[cnt(Array.isArray(v)?v[0]:0),cnt(Array.isArray(v)?v[1]:0)];
  const curOf=(o,now)=>{const c=freshCur();if(!isObj(o))return c;c.d=isDay(o.d)?o.d:'';c.age=int(o.age,0,10,0);for(const k of ['q','f','nw','s'])c[k]=cnt(o[k]);for(const k of ['en','qz','rd','rv'])c[k]=pair(o[k]);return c};
  const eligible=(m,kind)=>{const n=BOOK.NOTE.need[kind];return m.plays>=n.plays&&m.kills>=n.kills};
  /* 다듬기: 틀린 칸만 기본값, 모르는 칸은 버림, 숫자는 범위로 자름. opt.now = 지금, opt.knows(id) = 문제은행이 아는 id인지(없으면 모양만 봄) */
  function restore(raw,opt){
    const o=opt||{},now=nowOf(o.now),b=fresh(now,0),r=isObj(raw)?raw:{};
    b.made=stamp(r.made,now)||now;b.at=stamp(r.at,now)||now;if(b.at>now)b.at=now;
    b.from=r.from===3?3:0;b.play=int(r.play,1,BOOK.CAPS.count,1);b.pq=cnt(r.pq);
    if(isObj(r.order)){
      b.order.seed=int(r.order.seed,0,4294967295,0);
      for(const a of AGES){const f=isObj(r.order.off)&&r.order.off[a];if(isObj(f)){b.order.off[a]={};for(const p of POOLS)b.order.off[a][p]=cnt(f[p])}
        const k=isObj(r.order.bank)&&r.order.bank[a];if(Number.isFinite(k)&&k>=1)b.order.bank[a]=int(k,1,9999,1)}
    }
    if(isObj(r.mon))for(const k of KINDS){
      const s=r.mon[k],m=b.mon[k];if(!isObj(s))continue;
      m.foot=stamp(s.foot,now);m.plays=cnt(s.plays);m.last=cnt(s.last);m.kills=cnt(s.kills);m.nv=s.nv===1?1:0;m.ribKills=cnt(s.ribKills);m.shiny=stamp(s.shiny,now);
      m.card=m.foot?stamp(s.card,now):0;/* 친구는 발자국이 있어야 인정 */
      if(isObj(s.rib)){m.rib.n=int(s.rib.n,0,BOOK.RIBBON.need,0);m.rib.last=cnt(s.rib.last)}
      if(!m.card)m.rib.n=0;
      m.note=m.card?3:s.note===2?2:eligible(m,k)?1:0;
    }
    if(isObj(r.drop)&&KINDS.includes(r.drop.kind)&&b.mon[r.drop.kind].note===1)b.drop={kind:r.drop.kind,at:int(r.drop.at,1,BOOK.CAPS.count,b.play)};
    if(isObj(r.pend)&&(r.pend.kind==='note'||r.pend.kind==='review')&&typeof r.pend.id==='string'&&r.pend.id.length<=40&&typeof r.pend.key==='string'&&r.pend.key.length<=40&&(r.pend.kind!=='note'||KINDS.includes(r.pend.key)))
      b.pend={kind:r.pend.kind,key:r.pend.key,id:r.pend.id,index:cnt(r.pend.index),run:cnt(r.pend.run),seed:int(r.pend.seed,0,4294967295,0)};
    if(isObj(r.notes)){b.notes.play=int(r.notes.play,1,BOOK.CAPS.count,b.play);b.notes.n=int(r.notes.n,0,99,0);b.notes.lastQ=int(r.notes.lastQ,-99,BOOK.CAPS.count,-99)}
    if(isObj(r.shiny)){const s=r.shiny;b.shiny.miss=int(s.miss,0,BOOK.SHINY.pity,0);b.shiny.run=cnt(s.run);b.shiny.f=cnt(s.f);b.shiny.fr=cnt(s.fr);
      b.shiny.pend=KINDS.includes(s.pend)&&s.pend!=='king'?s.pend:null;b.shiny.guest=KINDS.includes(s.guest)&&s.guest!=='king'?s.guest:null}
    if(isObj(r.medal))for(const k of MEDALS){const s=r.medal[k];if(!isObj(s))continue;const m=b.medal[k];m.n=cnt(s.n);
      BOOK.MEDAL[k].forEach((need,i)=>{m.at[i]=m.n>=need?(stamp(Array.isArray(s.at)?s.at[i]:0,now)||b.at):0})}
    if(isObj(r.vil))for(const v of BOOK.VILLAGES)if(Number.isFinite(r.vil[v]))b.vil[v]=cnt(r.vil[v]);
    if(Array.isArray(r.rv)){const seen=new Set();for(const e of r.rv){
      if(!isObj(e)||typeof e.id!=='string'||!/^a(7|8|9|10)-[a-z]+-[a-z0-9]+$/.test(e.id)||seen.has(e.id)||(o.knows&&!o.knows(e.id)))continue;seen.add(e.id);
      b.rv.push({id:e.id,box:int(e.box,1,3,1),due:cnt(e.due),dp:int(e.dp,1,BOOK.CAPS.count,b.play),miss:int(e.miss,1,BOOK.CAPS.count,1),seen:cnt(e.seen)})}
      trimRv(b)}
    if(isObj(r.rvPlay)){b.rvPlay.play=int(r.rvPlay.play,1,BOOK.CAPS.count,b.play);b.rvPlay.n=cnt(r.rvPlay.n);b.rvPlay.lastQ=int(r.rvPlay.lastQ,-99,BOOK.CAPS.count,-99);
      if(isObj(r.rvPlay.ids))for(const id of Object.keys(r.rvPlay.ids).slice(0,BOOK.CAPS.rv))if(id.length<=40&&Number.isFinite(r.rvPlay.ids[id]))b.rvPlay.ids[id]=int(r.rvPlay.ids[id],0,99,0)}
    if(Array.isArray(r.seen))b.seen=[...new Set(r.seen.filter(x=>typeof x==='string'&&x.length>0&&x.length<=40))].slice(-BOOK.CAPS.seen);
    if(isObj(r.day))for(const d of Object.keys(r.day).filter(isDay).sort().slice(-BOOK.CAPS.day)){const v=r.day[d];if(Array.isArray(v))b.day[d]=[cnt(v[0]),cnt(v[1]),cnt(v[2]),cnt(v[3])]}
    if(Array.isArray(r.log))for(const e of r.log.slice(-BOOK.CAPS.log))if(isObj(e)){const c=curOf(e,now);b.log.push({p:int(e.p,1,BOOK.CAPS.count,1),d:c.d,age:c.age,q:c.q,f:c.f,nw:c.nw,en:c.en,qz:c.qz,rd:c.rd,rv:c.rv,s:c.s})}
    b.cur=curOf(r.cur,now);
    if(isObj(r.tot))for(const k of ['q','f','s','days'])b.tot[k]=cnt(r.tot[k]);
    if(isObj(r.set)){b.set.en=has(BOOK.MIX,r.set.en)?r.set.en:'std';b.set.day=BOOK.DAY_CHOICES.includes(r.set.day)?r.set.day:BOOK.DAY_DEFAULT;b.set.sfx=r.set.sfx===0?0:1}
    if(isObj(r.today)&&isDay(r.today.d)){b.today.d=r.today.d;b.today.s=int(r.today.s,0,86400,0);b.today.ext=int(r.today.ext,0,600,0)}
    b.rng=seedOf(r.rng);
    return b;
  }
  /* 버전 올림: UP[k] = 기록 vk → v(k+1). 지금은 v1뿐 */
  const UP={};
  function migrate(raw){let r=raw;while(isObj(r)&&Number.isInteger(r.v)&&r.v<V&&UP[r.v])r=UP[r.v](r);return r}
  /* 처음 이행: 판 저장 v3의 meta에서 한 번(§2.4). 몬스터 발자국은 이행하지 않는다(처치 출처가 예전 저장에 없음) */
  function fromMeta(meta,opt){
    const o=opt||{},now=nowOf(o.now),b=fresh(now,o.seed),m=isObj(meta)?meta:{},stamps=Array.isArray(m.stamps)?m.stamps.filter(isObj):[];
    b.from=3;
    if(Array.isArray(m.seenOk))b.seen=[...new Set(m.seenOk.filter(x=>typeof x==='string'&&x.length>0&&x.length<=40))].slice(-BOOK.CAPS.seen);
    let one=0,q=0;
    for(const t of stamps){const n=cnt(t.q),acc=int(t.acc,0,100,0),st=Array.isArray(t.stars)?t.stars:[];
      q+=n;one+=Math.round(n*acc/100);
      if(st[0])b.medal.keeper.n++;if(st[0]&&st[1]&&st[2])b.medal.star.n++;
      if(BOOK.VILLAGES.includes(t.village))b.vil[t.village]=(b.vil[t.village]||0)+1}
    b.medal.king.n=stamps.length;b.medal.one.n=one;b.medal.fresh.n=b.seen.length;b.medal.map.n=laps(b);
    b.mon.king.kills=stamps.length;b.mon.king.plays=stamps.length?1:0;b.mon.king.note=eligible(b.mon.king,'king')?1:0;
    b.tot.q=q;b.tot.f=one;
    for(const k of MEDALS)BOOK.MEDAL[k].forEach((need,i)=>{if(b.medal[k].n>=need)b.medal[k].at[i]=now});
    return b;
  }

  /* ---------- 저장소(인자로 받은 storage에만 손댐) ---------- */
  /* 열쇠: 체험(?demo=N)·?book=0은 기록을 읽지도 쓰지도 않는다(book=null). 시험(?test=1)은 -test. run = 화면이 쓰는 판 저장 열쇠 */
  function keys(opt){const o=opt||{},book=o.off||o.demo?null:'hangul-defense-book'+(o.test?'-test':'');return {book,bak:book?book+'-bak':null,run:o.runKey||null}}
  /* 저장 글을 읽어 기록으로. status: none(없음) · ok · broken(깨짐: 새 기록으로 시작) · newer(앱보다 새 버전: 메모리 안 새 기록, 쓰지 않음) */
  function parse(text,opt){
    const o=opt||{},now=nowOf(o.now);
    if(typeof text!=='string'||!text)return {status:'none',book:null,locked:false};
    let raw=null;try{raw=JSON.parse(text)}catch(e){}
    if(!isObj(raw)||raw.fmt!==FMT||!Number.isInteger(raw.v)||raw.v<1)return {status:'broken',book:fresh(now,o.seed),locked:false};
    if(raw.v>V)return {status:'newer',book:fresh(now,o.seed),locked:true};
    return {status:'ok',book:restore(migrate(raw),o),locked:false};
  }
  /* 기록 열기. opt.meta = 판 저장의 meta(기록 열쇠가 없을 때 한 번 이행), opt.seed = 지금 판 씨앗. 돌려줌 {book, status, locked}. locked면 save가 쓰지 않는다 */
  function open(store,ks,opt){
    const o=opt||{},now=nowOf(o.now);
    if(!ks||!ks.book||!store)return {status:'memory',book:fresh(now,o.seed),locked:true};
    let text=null;try{text=store.getItem(ks.book)}catch(e){return {status:'memory',book:fresh(now,o.seed),locked:true}}
    const r=parse(text,o);
    if(r.status!=='none')return r;
    const m=o.meta,old=isObj(m)&&((Array.isArray(m.stamps)&&m.stamps.length)||(Array.isArray(m.seenOk)&&m.seenOk.length));
    return old?{status:'migrated',book:fromMeta(m,o),locked:false}:{status:'new',book:fresh(now,o.seed),locked:false};
  }
  /* 기록 쓰기. 잠긴 기록(새 버전·체험·?book=0)은 쓰지 않는다. 실패(용량·사생활 모드)면 false */
  function save(store,ks,handle){
    if(!handle||handle.locked||!ks||!ks.book||!store)return false;
    try{store.setItem(ks.book,JSON.stringify(handle.book));return true}catch(e){return false}
  }
  /* 모든 기록 지우기(보호자 화면에서만): 기록·되돌리기 사본·판 저장 */
  function wipeAll(store,ks){let ok=true;for(const k of [ks&&ks.book,ks&&ks.bak,ks&&ks.run])if(k)try{store.removeItem(k)}catch(e){ok=false}return ok}

  /* ---------- 진행 파일(§2.7) ---------- */
  const sumOf=(book,run)=>fnv1a(JSON.stringify({fmt:FILE_FMT,v:FILE_V,book,run}));
  const isoLocal=now=>{const d=new Date(nowOf(now)),z=-d.getTimezoneOffset(),a=Math.abs(z);return dayOf(now)+'T'+p2(d.getHours())+':'+p2(d.getMinutes())+':'+p2(d.getSeconds())+(z<0?'-':'+')+p2(Math.floor(a/60))+':'+p2(a%60)};
  const fileName=now=>'kkomaeul-progress-'+dayOf(now).replace(/-/g,'')+'.json';
  /* 내보내기: runSave = 판 저장 객체(세계 world는 뺀다) 또는 null. opt.app = 앱 버전(정보용) */
  function exportFile(book,runSave,opt){
    const o=opt||{};let run=null;
    if(isObj(runSave)){run={};for(const k of Object.keys(runSave))if(k!=='world')run[k]=runSave[k];run=JSON.parse(JSON.stringify(run))}
    const b=JSON.parse(JSON.stringify(book));
    return {fmt:FILE_FMT,v:FILE_V,app:String(o.app||''),made:isoLocal(o.now),book:b,run,sum:sumOf(b,run)};
  }
  const exportText=(book,runSave,opt)=>JSON.stringify(exportFile(book,runSave,opt));
  /* 미리보기 숫자: 친구 카드·훈장(받은 단계 수)·놀이 번호·마지막 날짜 */
  function preview(b){
    return {cards:KINDS.filter(k=>b.mon[k].card>0).length,medals:MEDALS.reduce((s,k)=>s+b.medal[k].at.filter(Boolean).length,0),play:b.play,last:dayOf(b.at)};
  }
  /* 불러오기 검사(§2.7 단계 1~6). 돌려줌 {ok, error:'size'|'format'|'newer'|null, sumOk, book, run, preview}.
     sumOk=false면 화면이 "그래도 불러올까요?"를 묻는다(우연한 손상만 막는 수준, 변조 방지 아님). opt.cleanRun(run) = Combat.restore */
  function importFile(text,opt){
    const o=opt||{},bad=error=>({ok:false,error,sumOk:false,book:null,run:null,preview:null});
    if(typeof text!=='string'||text.length>FILE_MAX)return bad('size');
    let f=null;try{f=JSON.parse(text)}catch(e){}
    if(!isObj(f)||f.fmt!==FILE_FMT||!Number.isInteger(f.v)||f.v<1||!isObj(f.book))return bad('format');
    if(f.v>FILE_V||(Number.isInteger(f.book.v)&&f.book.v>V))return bad('newer');
    if(f.book.fmt!==FMT)return bad('format');
    const run=isObj(f.run)?f.run:null,sumOk=typeof f.sum==='string'&&f.sum===sumOf(f.book,run);
    const book=restore(migrate(f.book),o);let clean=run;
    if(run&&typeof o.cleanRun==='function'){try{clean=o.cleanRun(run)}catch(e){clean=null}}
    return {ok:true,error:null,sumOk,book,run:clean,preview:preview(book)};
  }
  /* 바꾸기: 지금 기록·판 저장 글을 -bak 한 벌에 담고(직전 것만) 불러온 것으로 덮어쓴다. runText = 화면이 만든 판 저장 글(없으면 판 저장을 지움) */
  function swapIn(store,ks,book,runText,opt){
    if(!ks||!ks.book||!store)return false;
    try{
      const bak={at:nowOf(opt&&opt.now),book:store.getItem(ks.book),run:ks.run?store.getItem(ks.run):null};
      store.setItem(ks.bak,JSON.stringify(bak));
      store.setItem(ks.book,JSON.stringify(book));
      if(ks.run){if(typeof runText==='string')store.setItem(ks.run,runText);else store.removeItem(ks.run)}
      return true;
    }catch(e){return false}
  }
  const canUndo=(store,ks)=>{try{return !!(ks&&ks.bak&&store.getItem(ks.bak))}catch(e){return false}};
  /* 되돌리기(마지막 1번): -bak의 기록·판 저장을 되살리고 -bak을 지운다 */
  function undo(store,ks){
    if(!ks||!ks.bak||!store)return false;
    try{
      const bak=JSON.parse(store.getItem(ks.bak)||'null');if(!isObj(bak))return false;
      const put=(k,v)=>{if(!k)return;if(typeof v==='string')store.setItem(k,v);else store.removeItem(k)};
      put(ks.book,bak.book);put(ks.run,bak.run);store.removeItem(ks.bak);return true;
    }catch(e){return false}
  }

  /* ---------- 날짜·시간·놀이 번호 ---------- */
  const touch=(b,now)=>{b.at=nowOf(now)};
  function rollDay(b,now){
    const d=dayOf(now);
    if(b.today.d!==d)b.today={d,s:0,ext:0};
    if(!b.day[d]){b.day[d]=[0,0,0,0];/* [푼 문제, 한 번에 맞힘, 초, 처음 맞힌 새 글] */const ds=Object.keys(b.day).sort();while(ds.length>BOOK.CAPS.day)delete b.day[ds.shift()]}
    return d;
  }
  /* 세계 시계가 흐른 초(시작 화면·엔딩 카드·쉬기·탭 숨김 제외, 화면이 10틱마다 1초씩 부름) */
  function tick(b,now,sec){
    if(!BOOK.ON)return;const n=int(sec,0,3600,1),d=rollDay(b,now);
    b.today.s=Math.min(86400,b.today.s+n);b.day[d][2]+=n;b.tot.s+=n;b.cur.s+=n;if(!b.cur.d)b.cur.d=d;
  }
  /* 하루 시간이 찼는가. 멈춤은 문제 사이에서만, 결전 중이면 결전이 끝난 뒤(opt.finale) */
  function sleepy(b,now,opt){
    if(!BOOK.ON||!b.set.day||(opt&&opt.finale))return false;
    return b.today.d===dayOf(now)&&b.today.s>=(b.set.day+b.today.ext)*60;
  }
  function extend(b,now,min){rollDay(b,now);b.today.ext=Math.min(600,b.today.ext+int(min,1,120,BOOK.DAY_EXTEND));touch(b,now);return b.today.ext}
  /* 놀이 번호 +1(§3.6): 놀이 요약을 log에, 놀이마다 세는 칸을 0으로 */
  function nextPlay(b,now){
    if(b.cur.q>0||b.cur.s>0){const c=b.cur;b.log.push({p:b.play,d:c.d||dayOf(now),age:c.age,q:c.q,f:c.f,nw:c.nw,en:c.en,qz:c.qz,rd:c.rd,rv:c.rv,s:c.s});if(b.log.length>BOOK.CAPS.log)b.log.splice(0,b.log.length-BOOK.CAPS.log)}
    b.play++;b.pq=0;b.cur=freshCur();b.notes={play:b.play,n:0,lastQ:-99};b.rvPlay={play:b.play,n:0,ids:{},lastQ:-99};
    for(const k of KINDS){const m=b.mon[k];m.ribKills=0;if(m.note===2)m.note=1}
    touch(b,now);return b.play;
  }
  /* "시작하기/이어서 하기": 마지막 활동에서 SESSION_GAP 넘게 지났으면 새 놀이. 돌려줌 = 새 놀이가 됐는가 */
  function beginSession(b,now){
    if(!BOOK.ON)return false;const t=nowOf(now),fresh1=t-b.at>BOOK.SESSION_GAP;
    if(fresh1)nextPlay(b,t);else touch(b,t);return fresh1;
  }

  /* ---------- 이어 순서(§3.7) 인터페이스 ----------
     문제은행 판(edition, 브랜치 claude/bank-expand): Questions.at(age, mode, index, seed, bank) + state.bank(그 판이 쓰는 문제은행 판 번호).
     기록은 나이별 묶음 소비 수 off와 그 수를 센 문제은행 판 bank를 들고 있다. 전제: bank는 한 바퀴가 끝나는 곳에서만 올린다.
     orderFor(b, age)가 새 판에 넘길 {seed, off, bank}를 주고, advanceOrder가 끝난 판의 소비 수를 더한다.
     Questions 쪽에 off를 받는 인자(예: at(…, bank, off))와 used(age, index, seed, bank)를 더하는 일은 연결 단계(C4) */
  const offOf=(b,age)=>{const f=b.order.off[age]||{};const o={};for(const p of POOLS)o[p]=f[p]|0;return o};
  function orderFor(b,age){return {seed:b.order.seed,off:BOOK.ON&&BOOK.FLAGS.order?offOf(b,age):{story:0,common:0,math:0,english:0},bank:b.order.bank[age]||0}}
  /* used = 끝난 판이 묶음별로 쓴 수({story, common, math, english}).
     opt.bank = 그 판이 쓴 문제은행 판, opt.latest = 최신 판(Questions.BANK_VERSION), opt.size = 그 판(opt.bank) 기준 묶음 크기.
     읽기 묶음이 한 바퀴를 다 돌았고 더 새 판이 있으면 bank를 최신으로 올리고 소비 수를 새 바퀴 처음(0)으로 돌린다(예전 판의 남은 자리 수는 새 판 묶음과 맞지 않으므로) */
  function advanceOrder(b,age,used,opt){
    if(!AGES.includes(age))return orderFor(b,8);
    const o=opt||{},off=offOf(b,age),u=isObj(used)?used:{};
    for(const p of POOLS)off[p]=cnt(off[p]+cnt(u[p]));
    const bank=int(o.bank,1,9999,b.order.bank[age]||1),latest=int(o.latest,1,9999,bank),size=isObj(o.size)?o.size:null;
    let next=bank;
    if(latest>bank&&size&&size.story>0&&off.story>=size.story){next=latest;for(const p of POOLS)off[p]=0}
    b.order.off[age]=off;b.order.bank[age]=next;
    return orderFor(b,age);
  }

  /* ---------- 훈장(§3.3) ---------- */
  const tierOf=(key,n)=>BOOK.MEDAL[key].filter(need=>n>=need).length;
  function setMedal(b,key,n,now,out){
    if(!BOOK.FLAGS.medals)return;const m=b.medal[key];m.n=cnt(n);
    BOOK.MEDAL[key].forEach((need,i)=>{if(m.n>=need&&!m.at[i]){m.at[i]=nowOf(now);if(out)out.medals.push({key,tier:i+1})}});
  }
  const bump=(b,key,now,out)=>setMedal(b,key,b.medal[key].n+1,now,out);
  const laps=b=>Math.min(...BOOK.VILLAGES.map(v=>b.vil[v]|0));
  /* 진열용 목록: 영어 "끄기"면 en 숨김(hidden). next = 다음 단계까지 남은 수(금이면 0) */
  function medals(b){return MEDALS.map(key=>{const m=b.medal[key],tier=m.at.filter(Boolean).length,need=BOOK.MEDAL[key];
    return {key,group:BOOK.MEDAL_GROUP[key],n:m.n,tier,need:need.slice(),next:tier<3?Math.max(0,need[tier]-m.n):0,at:m.at.slice(),hidden:key==='en'&&b.set.en==='off'}})}

  /* ---------- 수첩(§3.1·§3.2) ---------- */
  const noteCount=b=>b.notes.play===b.play?b.notes.n:0;
  /* 지금 이 몬스터가 쪽지를 떨어뜨릴 수 있는가: 자격 + 들고 있는 쪽지 없음 + 이번 놀이 쪽지 수 상한 안 */
  function canDrop(b,kind){
    const m=b.mon[kind];
    return !!(BOOK.ON&&BOOK.FLAGS.notes&&m&&m.note===1&&!b.drop&&!(b.pend&&b.pend.kind==='note')&&noteCount(b)<BOOK.NOTE.cap);
  }
  /* 공통: 정답 화살 처치(늑대 6종) · 여우 구출 · 결전 승리 한 번. 돌려줌 {foot, drop, ribbon, medals} */
  function met(b,kind,now,out){
    const m=b.mon[kind];
    m.kills=cnt(m.kills+1);
    if(!m.foot){m.foot=nowOf(now);out.foot=true}
    if(m.last!==b.play){m.plays++;m.last=b.play}
    m.ribKills++;
    if(BOOK.FLAGS.notes){
      if(canDrop(b,kind)){b.drop={kind,at:b.play};out.drop=true}
      else if(m.note===0&&eligible(m,kind))m.note=1;
      if(m.card&&m.rib.n<BOOK.RIBBON.need&&m.rib.last!==b.play&&m.ribKills>=BOOK.RIBBON.kills[kind]){m.rib.n++;m.rib.last=b.play;if(m.rib.n>=BOOK.RIBBON.need)out.ribbon=true}
    }
    touch(b,now);return out;
  }
  const blank=()=>({foot:false,drop:false,ribbon:false,shiny:false,medals:[]});
  /* world 'kill' 사건 가운데 by:'volley'인 것(§3.0). kind = wolf·bramble·boar·granite·frost·ember */
  function volleyKill(b,kind,opt){
    const out=blank(),now=opt&&opt.now;
    if(!BOOK.ON||!KINDS.includes(kind)||kind==='fox'||kind==='king')return out;
    bump(b,'arrow',now,out);return met(b,kind,now,out);
  }
  /* 여우에게서 닭을 구함(foxShoo 성공) */
  function foxSaved(b,opt){const out=blank(),now=opt&&opt.now;if(!BOOK.ON)return out;bump(b,'fox',now,out);return met(b,'fox',now,out)}
  /* 결전 승리(Combat.finish 뒤). opt.stars = Combat.stars(state), opt.village = run.village, opt.perfect = 방패 6개를 한 번도 안 틀리고 깸(run.fq===6) */
  function kingWon(b,opt){
    const o=opt||{},out=blank(),now=o.now,st=Array.isArray(o.stars)?o.stars:[];
    if(!BOOK.ON)return out;
    bump(b,'king',now,out);
    if(st[0])bump(b,'keeper',now,out);
    if(st[0]&&st[1]&&st[2])bump(b,'star',now,out);
    if(BOOK.VILLAGES.includes(o.village)){b.vil[o.village]=cnt((b.vil[o.village]|0)+1);setMedal(b,'map',laps(b),now,out)}
    met(b,'king',now,out);
    if(o.perfect&&BOOK.FLAGS.shiny&&!b.mon.king.shiny){b.mon.king.shiny=nowOf(now);out.shiny=true}
    return out;
  }
  /* 신바람 2단에 오름(연속이 끊겼다가 다시 오르면 또 셈) */
  function rushed(b,opt){const out=blank();if(!BOOK.ON)return out;bump(b,'rush',opt&&opt.now,out);return out}
  /* 수첩 한 쪽의 진행(화면용) */
  function page(b,kind){
    const m=b.mon[kind],need=BOOK.NOTE.need[kind];
    return {kind,foot:m.foot>0,card:m.card>0,ribbon:m.rib.n>=BOOK.RIBBON.need,shiny:m.shiny>0,note:m.note,kills:m.kills,plays:m.plays,needKills:need.kills,needPlays:need.plays,
      rib:m.rib.n,ribNeed:BOOK.RIBBON.need,ribKills:m.ribKills,ribNeedKills:BOOK.RIBBON.kills[kind],since:m.card};
  }
  /* 채운 칸 수(32칸 = 8종 × 발자국·카드·리본 + 반짝 8) */
  const CELLS=KINDS.length*4;
  function cells(b){let n=0;for(const k of KINDS){const p=page(b,k);n+=(p.foot?1:0)+(p.card?1:0)+(p.ribbon?1:0)+(p.shiny?1:0)}return n}
  /* 더 놀기에 놀러 오는 친구: 리본 먼저, 다음은 최근에 친구가 된 순서, 최대 4(무작위 없음) */
  function friends(b){
    if(!BOOK.ON||!BOOK.FLAGS.friends)return [];
    return KINDS.filter(k=>b.mon[k].card>0).map(k=>({kind:k,ribbon:b.mon[k].rib.n>=BOOK.RIBBON.need,shiny:b.mon[k].shiny>0,card:b.mon[k].card}))
      .sort((x,y)=>(y.ribbon-x.ribbon)||(y.card-x.card)||KINDS.indexOf(x.kind)-KINDS.indexOf(y.kind)).slice(0,BOOK.CAPS.friends).map(f=>({kind:f.kind,ribbon:f.ribbon,shiny:f.shiny}));
  }
  /* 0.17 친구 방문(장면 전용): 친구 카드를 받은 모든 종 가운데 한 마리를 고른다(처음 만난 친구만이 아니라 모은 친구 전부, 바로 전 방문 친구는 둘 이상이면 피함).
     ctx: seed(판의 문제 순서 씨앗) · run(판 번호) · n(이번 화면에서 몇 번째 방문) · last(바로 전 방문 종).
     난수는 이 값들의 해시에서만 만든다: 세계 난수(world.rng)와 기록 난수(b.rng, 반짝 손님)를 건드리지 않고, 기록도 바꾸지 않는다(같은 ctx = 같은 결과).
     돌려줌 {kind, ribbon, shiny, u, v} (u·v = 길 고르기·다음 간격에 쓰는 [0,1) 두 수) 또는 친구가 없으면 null */
  function visitPick(b,ctx){
    if(!BOOK.ON||!BOOK.FLAGS.friends||!b||!isObj(b.mon))return null;
    const list=KINDS.filter(k=>b.mon[k]&&b.mon[k].card>0);if(!list.length)return null;
    const c=ctx||{};let x=seedOf(hash('visit|'+(c.seed|0)+'|'+(c.run|0)+'|'+(c.n|0)));x=xs(xs(x));
    let i=x%list.length;if(list.length>1&&list[i]===c.last)i=(i+1+xs(x)%(list.length-1))%list.length;
    const k=list[i],m=b.mon[k];x=xs(x);const u=x/4294967296;x=xs(x);const v=x/4294967296;
    return {kind:k,ribbon:m.rib.n>=BOOK.RIBBON.need,shiny:m.shiny>0,u,v};
  }

  /* ---------- 반짝 손님(§3.4) ---------- */
  /* 한 번에 맞힌 직후 부른다. ctx: run(run.no) · asked(run.asked) · boost2(방금 신바람 2단이 됨) · kinds(지금 나오는 종류 + 여우가 남았으면 'fox') · finale · free(더 놀기).
     기회가 아니면 null. 기회를 썼으면 {win, kind}. 당첨이면 shiny.pend = 종류(세계가 다음 무리에 손님을 섞은 뒤 shinySpawned) */
  function shinyChance(b,ctx){
    const c=ctx||{},S=BOOK.SHINY,s=b.shiny;
    if(!BOOK.ON||!BOOK.FLAGS.shiny||c.finale||c.free||!(c.run>0)||s.run===c.run||s.pend||s.guest)return null;
    if(!(c.asked>=S.after))return null;
    const byCount=S.firsts>0&&s.fr===c.run&&s.f>=S.firsts;
    if(!c.boost2&&!byCount)return null;
    const pool=(Array.isArray(c.kinds)?c.kinds:[]).filter(k=>KINDS.includes(k)&&k!=='king'&&!b.mon[k].shiny);
    if(!pool.length)return null;/* 받을 칸이 없으면 기회를 쓰지 않고 기다림 */
    s.run=c.run;
    const win=s.miss>=S.pity||rand(b)<S.p;
    if(!win){s.miss++;return {win:false,kind:null}}
    s.miss=0;s.pend=pool[Math.floor(rand(b)*pool.length)%pool.length];
    return {win:true,kind:s.pend};
  }
  function shinySpawned(b){if(b.shiny.pend){b.shiny.guest=b.shiny.pend;b.shiny.pend=null}return b.shiny.guest}
  /* 정답 화살이 손님에게 닿음(world 'shinyMet') → 반짝 칸 */
  function shinyMet(b,opt){const k=b.shiny.guest,out=blank();if(!k)return out;b.shiny.guest=null;if(!b.mon[k].shiny){b.mon[k].shiny=nowOf(opt&&opt.now);out.shiny=true}touch(b,opt&&opt.now);return out}
  /* 손님이 있는 채로(또는 오기로 한 채로) 판이 끝남: 결전 시작·새 마을. 꽝이 아니라 다음 기회 확정 */
  function shinyGone(b){const s=b.shiny;if(!s.guest&&!s.pend)return false;s.guest=null;s.pend=null;s.miss=BOOK.SHINY.pity;return true}
  /* 보호자 화면 공개 문구: 숫자는 상수에서 만든다(코드 값과 늘 같게) */
  function shinyText(){
    const S=BOOK.SHINY,pct=Math.round(S.p*100),ord=['첫','두','세','네','다섯'][S.pity]||(S.pity+1)+'';
    return '반짝 손님은 한 판에 한 번 올 수 있어요. 그 판에서 처음으로 신바람(6번 연속 정답, 또는 3번 연속 + 번개)이 되'+(S.firsts>0?'거나, 한 번에 맞힌 문제가 '+S.firsts+'개가 되':'')+'면 '+pct+'% 확률로 와요. '
      +['한','두','세','네'][S.pity-1]+' 번 오지 않으면 '+ord+' 번째에는 반드시 와요. 온 손님은 아이가 다음 문제를 맞힐 때까지 기다려요. 늑대 왕의 반짝 모습은 결전에서 한 번도 틀리지 않으면 나와요. 돈으로 사거나 뽑는 것은 없어요.';
  }

  /* ---------- 기억 늑대(§3.5)와 특별 문제 ---------- */
  function trimRv(b){while(b.rv.length>BOOK.REVIEW.cap){let i=0;b.rv.forEach((e,k)=>{if(e.dp<b.rv[i].dp)i=k});b.rv.splice(i,1)}}
  const delayOf=(id,pq)=>{const [lo,hi]=BOOK.REVIEW.delay;return lo+hash(id+'|'+pq)%(hi-lo+1)};
  const rvAt=(b,id)=>b.rv.findIndex(e=>e.id===id);
  function rvMiss(b,id){
    const i=rvAt(b,id);
    if(i>=0){const e=b.rv[i];e.box=1;e.due=b.pq+delayOf(id,b.pq);e.dp=b.play;e.miss++}
    else{b.rv.push({id,box:1,due:b.pq+delayOf(id,b.pq),dp:b.play,miss:1,seen:0});trimRv(b)}
  }
  /* 지금 낼 수 있는 복습 글인가 */
  function rvDue(b,e){
    const R=BOOK.REVIEW;
    if(e.box===1)return e.dp===b.play?b.pq>=e.due:b.pq>=R.after;
    return b.play>=e.dp+R.wait[e.box]&&b.pq>=R.after;
  }
  /* 보기 순서를 씨앗으로 섞은 복사본(seed 0 = 그대로). 같은 씨앗 = 같은 순서(이어하기) */
  function shuffle(q,seed){
    const o=Object.assign({},q,{choices:q.choices.slice()});if(!seed)return o;
    let x=seedOf(seed);const ans=o.choices[o.answer],c=o.choices;
    for(let k=c.length-1;k>0;k--){x=xs(x);const j=x%(k+1);[c[k],c[j]]=[c[j],c[k]]}
    o.answer=c.indexOf(ans);return o;
  }
  /* 다음 문제 칸에 끼워 넣을 특별 문제(makeRound 맨 앞에서 부름). 없으면 null.
     ctx: age · index(state.index) · run(run.no) · finale(결전 중) · noteOf(age, kind, n) → 쪽지 문항(NOTES.get) · byId(id) → 은행 문항 복사본(Questions.byId)
     돌려줌 {kind:'note'|'review', key, id, q}. 문제 번호는 넘기지 않는다(화면 몫). 같은 칸에서 다시 부르면(이어하기) 같은 문제 */
  function nextSpecial(b,ctx){
    const c=ctx||{};
    if(!BOOK.ON||c.finale)return null;
    const made=(p,seen)=>{
      const src=p.kind==='note'?(c.noteOf?c.noteOf(c.age,p.key,b.mon[p.key].nv+1):null):(c.byId?c.byId(p.id):null);
      if(!src)return null;
      if(p.kind==='note')p.id=src.id;/* 풀기 전에 나이를 바꾸면 그 나이의 쪽지로 */
      const q=shuffle(src,p.seed);if(p.kind==='review')q.lap=seen;
      return {kind:p.kind,key:p.key,id:p.id,q};
    };
    if(b.pend){
      if(b.pend.index===(c.index|0)&&b.pend.run===(c.run|0)&&(b.pend.kind==='note'||b.pend.id.startsWith('a'+c.age+'-'))){/* 나이를 바꾸면 걸려 있던 다른 나이의 복습 글은 내려놓는다 */const e=b.rv[rvAt(b,b.pend.id)],r=made(b.pend,e?e.seen:1);if(r)return r}
      b.pend=null;/* 다른 칸의 낡은 표(마을 처음부터 등)는 버린다. 쪽지는 drop이 남아 있어 다시 나온다 */
    }
    const lastSp=Math.max(b.notes.play===b.play?b.notes.lastQ:-99,b.rvPlay.play===b.play?b.rvPlay.lastQ:-99);
    if(b.pq-lastSp<=BOOK.SPECIAL.gap)return null;/* 특별 문제 사이에 평소 문제가 gap개 이상(특별 문제 자신이 pq를 1 올리므로 +1) */
    /* 쪽지 먼저(드문 쪽) */
    const N=BOOK.NOTE,d=b.drop;
    if(BOOK.FLAGS.notes&&d&&b.mon[d.kind].note===1&&noteCount(b)<N.cap&&b.pq>=N.after&&(noteCount(b)===0||b.pq-b.notes.lastQ>=N.gap)&&c.noteOf){
      const src=c.noteOf(c.age,d.kind,b.mon[d.kind].nv+1);
      if(src){
        b.pend={kind:'note',key:d.kind,id:src.id,index:c.index|0,run:c.run|0,seed:0};
        b.notes={play:b.play,n:noteCount(b)+1,lastQ:b.pq};
        return made(b.pend,0);
      }
    }
    if(!BOOK.FLAGS.review||!c.byId)return null;
    const R=BOOK.REVIEW;if(b.rvPlay.play!==b.play)b.rvPlay={play:b.play,n:0,ids:{},lastQ:-99};
    if(b.rvPlay.n>=Math.max(1,Math.floor(R.share*b.pq)))return null;
    const pre='a'+c.age+'-',list=b.rv.filter(e=>e.id.startsWith(pre)&&(b.rvPlay.ids[e.id]|0)<R.same&&rvDue(b,e)).sort((x,y)=>y.box-x.box||x.due-y.due||x.dp-y.dp);/* 칸 높은 것(졸업에 가까운 글) 먼저: 낮은 칸 먼저면 새로 놓친 글에 밀려 다음 놀이·3놀이 뒤 복습이 영영 차례를 못 얻는다(2026-11-19 시뮬: 졸업 0) */
    for(const e of list){
      const src=c.byId(e.id);
      if(!src||(b.set.en==='off'&&src.cat==='english'))continue;
      e.seen++;
      b.pend={kind:'review',key:e.id,id:e.id,index:c.index|0,run:c.run|0,seed:seedOf(hash(e.id+'|'+e.seen))};
      b.rvPlay.n++;b.rvPlay.ids[e.id]=(b.rvPlay.ids[e.id]|0)+1;b.rvPlay.lastQ=b.pq;
      return made(b.pend,e.seen);
    }
    return null;
  }
  /* 문제 하나의 결말(평소·특별·결전 모두). result: 'first'(한 번에) | 'second' | 'miss'.
     opt: now · age · run(run.no) · special('note'|'review'|null) · finale(결전 문제)
     돌려줌 {medals:[{key,tier}], friend(친구가 된 종)|null, lost(쪽지를 놓친 종)|null, graduated(기억 늑대 졸업), queued(복습 대기열에 들어감), fresh(처음 맞힌 글)} */
  function answered(b,q,result,opt){
    const o=opt||{},now=o.now,out={medals:[],friend:null,lost:null,graduated:false,queued:false,fresh:false};
    if(!BOOK.ON)return out;
    const first=result==='first',sp=o.special==='note'||o.special==='review'?o.special:null,id=q&&typeof q.id==='string'?q.id:'';
    const cat=q&&q.mode==='quiz'?q.cat:'read',d=rollDay(b,now),c=b.cur;
    if(!b.day[d][0])b.tot.days++;
    b.pq++;c.q++;b.tot.q++;b.day[d][0]++;if(!c.d)c.d=d;if(AGES.includes(o.age))c.age=o.age;
    const bucket=cat==='english'?c.en:cat==='read'?c.rd:c.qz;bucket[0]++;if(sp==='review')c.rv[0]++;
    if(first){
      c.f++;b.tot.f++;b.day[d][1]++;bucket[1]++;if(sp==='review')c.rv[1]++;
      bump(b,'one',now,out);
      if(id&&!b.seen.includes(id)){b.seen.push(id);if(b.seen.length>BOOK.CAPS.seen)b.seen.splice(0,b.seen.length-BOOK.CAPS.seen);c.nw++;b.day[d][3]++;out.fresh=true;bump(b,'fresh',now,out)}
      if(cat==='english')bump(b,'en',now,out);else if(cat==='common'||cat==='math')bump(b,'quiz',now,out);
      if(o.run>0){if(b.shiny.fr!==o.run){b.shiny.fr=o.run;b.shiny.f=0}b.shiny.f++}
    }
    if(sp==='note'){
      const k=b.pend&&b.pend.kind==='note'?b.pend.key:b.drop&&b.drop.kind,m=k&&b.mon[k];
      if(m&&m.note!==3){
        if(first){m.note=3;m.card=nowOf(now);m.rib.last=b.play;/* 카드가 생긴 놀이는 리본에 세지 않음 */out.friend=k}
        else{m.note=2;m.nv=m.nv?0:1;out.lost=k}
      }
      b.drop=null;
    }else if(id&&BOOK.FLAGS.review&&!o.finale){
      const i=rvAt(b,id);
      if(sp==='review'||i>=0){/* 평소 순서에 기다리던 글이 나와도 복습으로 침 */
        if(!first)rvMiss(b,id);
        else if(i>=0){const e=b.rv[i];if(e.box>=3){b.rv.splice(i,1);out.graduated=true;bump(b,'again',now,out)}else{e.box++;e.dp=b.play}}
      }else if(!first){rvMiss(b,id);out.queued=true}
    }
    if(sp)b.pend=null;
    touch(b,now);return out;
  }

  /* ---------- 판의 고비 ---------- */
  /* 결전 시작(종을 울림): 남은 손님은 떠남 */
  function finaleStart(b){if(!BOOK.ON)return false;return shinyGone(b)}
  /* 새 마을로 떠남(endNew, Combat.nextRun 앞): 손님 떠남 · 놀이 +1 · 이어 순서 더하기. opt: age · used · bank · latest · size(advanceOrder와 같음). 돌려줌 = 새 판에 넘길 {seed, off, bank} */
  function newVillage(b,now,opt){
    const o=opt||{};
    if(!BOOK.ON)return orderFor(b,o.age);
    shinyGone(b);b.pend=null;nextPlay(b,now);
    return advanceOrder(b,o.age,o.used,o);
  }
  /* 설정의 "마을을 처음부터 (수첩·훈장은 그대로)": 판 저장만 새로 만든다. 기록은 수첩·훈장·복습·이어 순서 씨앗을 그대로 두고, 그 판에 묶인 칸(걸린 특별 문제·손님·판별 셈)만 푼다.
     떨어진 쪽지(drop)는 들고 있는다. 놀이 번호는 그대로. opt는 newVillage와 같음(쓴 만큼 이어 순서를 민다) */
  function resetVillage(b,now,opt){
    const o=opt||{};
    if(!BOOK.ON)return orderFor(b,o.age);
    shinyGone(b);b.pend=null;b.shiny.run=0;b.shiny.f=0;b.shiny.fr=0;touch(b,now);
    return advanceOrder(b,o.age,o.used,o);
  }

  /* ---------- 보호자 화면(§3.9) ---------- */
  /* 설정 바꾸기. en 'more'는 MORE_FROM세부터. 돌려줌 = 바뀌었는가 */
  function setOpt(b,key,val,opt){
    if(key==='en'){if(!has(BOOK.MIX,val)||(val==='more'&&!((opt&&opt.age)>=BOOK.MORE_FROM)))return false;b.set.en=val}
    else if(key==='day'){if(!BOOK.DAY_CHOICES.includes(val))return false;b.set.day=val}
    else if(key==='sfx')b.set.sfx=val?1:0;
    else return false;
    touch(b,opt&&opt.now);return true;
  }
  /* 그 나이의 퀴즈 분류 가중치(Questions.setMix에 넘길 값). 'more'를 못 쓰는 나이는 std */
  function mixOf(b,age){const a=AGES.includes(age)?age:8,t=BOOK.MIX[b.set.en]||BOOK.MIX.std;return Object.assign({},t[a]||BOOK.MIX.std[a])}
  /* 기록 탭 숫자(사실만, 평가·비교 없음). week = 최근 7일, all = 전체, rate = 최근 30놀이 분류별 [푼 수, 한 번에 맞힌 수], missed = 자주 놓친 글 id */
  function report(b,now,opt){
    const o=opt||{},t=nowOf(now),week={q:0,f:0,nw:0,s:0,days:0};
    for(let i=0;i<7;i++){const v=b.day[dayOf(t-i*DAYMS)];if(v){week.q+=v[0];week.f+=v[1];week.s+=v[2];week.nw+=v[3];if(v[0]>0)week.days++}}
    const plays=b.log.concat(b.cur.q?[b.cur]:[]),rate={rd:[0,0],qz:[0,0],en:[0,0]};
    for(const p of plays){for(const k of ['rd','qz','en']){rate[k][0]+=p[k][0];rate[k][1]+=p[k][1]}}
    return {week,all:{plays:b.play,q:b.tot.q,f:b.tot.f,s:b.tot.s,days:b.tot.days,villages:b.medal.king.n},rate,
      missed:b.rv.slice().sort((x,y)=>y.miss-x.miss||y.dp-x.dp).slice(0,int(o.top,1,20,5)).map(e=>({id:e.id,miss:e.miss})),again:b.medal.again.n};
  }
  /* 보호자 문턱의 세 자리 수: 0·1이 없는 자리(2~9)라 글로 적어도 헷갈리지 않는다. seed로 결정적. 돌려줌 {digits:'347', text:'삼백사십칠'} */
  function gate(seed){
    const NAME=' 일이삼사오육칠팔구',UNIT=['','십','백','천'];let x=seedOf(seed),digits='',text='';
    for(let i=BOOK.GATE.digits-1;i>=0;i--){x=xs(x);const d=2+x%8;digits+=d;text+=NAME[d]+UNIT[i]}
    return {digits,text};
  }

  const api={V,FMT,FILE_FMT,FILE_V,FILE_MAX,KINDS:KINDS.slice(),MEDALS:MEDALS.slice(),POOLS:POOLS.slice(),CELLS,BOOK,
    fnv1a,rand,dayOf,fresh,restore,migrate,fromMeta,
    keys,parse,open,save,wipeAll,
    sumOf,fileName,exportFile,exportText,preview,importFile,swapIn,canUndo,undo,
    tick,sleepy,extend,nextPlay,beginSession,
    orderFor,advanceOrder,
    tierOf,medals,
    canDrop,volleyKill,foxSaved,kingWon,rushed,page,cells,friends,visitPick,
    shinyChance,shinySpawned,shinyMet,shinyGone,shinyText,
    shuffle,nextSpecial,answered,
    finaleStart,newVillage,resetVillage,
    setOpt,mixOf,report,gate};
  if(typeof module!=='undefined')module.exports=api;
  else root.Book=api;
})(typeof window!=='undefined'?window:globalThis);
