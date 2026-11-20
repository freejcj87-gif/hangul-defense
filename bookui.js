/* 수첩 MVP 화면: 발자국 수첩 · 보호자 화면(문턱 · 기록 · 설정 · 진행 파일 · 도움말) · 쉬기 화면 · 엔딩 카드 요약.
   index.html의 인라인 스크립트 바로 뒤에 불러오며(testmode.js처럼 같은 전역을 본다), 규칙은 book.js, 글은 notes.js에 있다. 이 파일은 그리기와 단추만 맡는다.
   기록이 꺼져 있으면(?book=0, book === null) 아무것도 보이지 않고 0.15 화면 그대로다.
   바깥 링크는 하나도 두지 않는다(등급 설문 "바깥 링크 없음"). 개인정보처리방침은 앱 안 본문(NOTES.PRIVACY) */
(function(){
  const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
  const show=(id,on)=>$(id).classList.toggle('hidden',!on);
  const MEDAL_LOOK={one:['📖','한 번에 읽기','문제를 한 번에 맞혀요'],fresh:['🌱','새 글','처음 보는 글을 한 번에 맞혀요'],again:['🔁','다시 읽기','기억 늑대가 들고 온 글을 끝까지 맞혀요'],rush:['🔥','신바람','연속으로 맞혀 신바람이 나요'],
    en:['🔤','영어 낱말','영어 문제를 한 번에 맞혀요'],quiz:['🔢','상식·수학','상식·수학 문제를 한 번에 맞혀요'],king:['👑','늑대 왕','늑대 왕을 물리쳐요'],fox:['🦊','여우 쫓기','여우에게서 꼬꼬를 구해요'],
    arrow:['🏹','정답 화살','정답 화살로 몬스터를 물리쳐요'],keeper:['🐥','꼬꼬 지킴이','여우를 다 쫓고 마을을 지켜요'],star:['⭐','별 셋','별 세 개를 모두 받아요'],map:['🗺️','네 마을','네 마을을 모두 지켜요']};
  const TIER=['','동','은','금'];
  const dateText=ms=>{if(!ms)return '';const d=Book.dayOf(ms).split('-');return Number(d[0])+'년 '+Number(d[1])+'월 '+Number(d[2])+'일'};
  const calmWorld=()=>phase==='start'||phase==='ending'||paused;

  /* ---------- 길게 누르기(보호자 단추): 짧게 누르면 안내만 ---------- */
  let holdAt=0,holdTimer=0;
  function hold(btn,done,hint){
    const fire=()=>{if(!holdAt)return;holdAt=0;done()};
    btn.onpointerdown=()=>{holdAt=Date.now();try{clearTimeout(holdTimer);holdTimer=setTimeout(fire,Book.BOOK.GATE.hold*100)}catch{}};
    btn.onpointerup=()=>{if(!holdAt)return;const long=Date.now()-holdAt>=Book.BOOK.GATE.hold*100;try{clearTimeout(holdTimer)}catch{}if(long)fire();else{holdAt=0;hint()}};
    btn.onpointerleave=btn.onpointercancel=()=>{holdAt=0;try{clearTimeout(holdTimer)}catch{}};
    btn.oncontextmenu=()=>false;
  }
  /* ---------- 보호자 문턱: 글로 적힌 세 자리 수를 숫자판으로 입력. 3번 틀리면 30초 쉼. 보안 장치가 아니라 아이가 실수로 누르지 않게 하는 문턱 ---------- */
  const gate={code:null,typed:'',tries:0,until:0,cb:null};
  function gateDraw(msg){
    const wait=Date.now()<gate.until;
    put($('gateAsk'),msg||(wait?'잠깐 쉬었다가 다시 해 주세요.':'아래 글로 적힌 수를 숫자로 눌러 주세요.'));
    put($('gateCode'),wait?'':gate.code.text);put($('gateIn'),wait?'':(gate.typed+'___').slice(0,3).split('').join(' '));
    const pad=$('gatePad');pad.innerHTML='';if(wait)return;
    for(let d=1;d<=9;d++){const b=el('button','',String(d));b.dataset.d=String(d);b.onclick=()=>gateType(String(d));pad.append(b)}
    const back=el('button','','지우기');back.dataset.d='back';back.onclick=()=>{gate.typed=gate.typed.slice(0,-1);gateDraw()};pad.append(back);
  }
  function gateNew(){gate.code=Book.gate(1+Math.floor(Math.random()*4294967294));gate.typed=''}
  function gateType(d){
    gate.typed+=d;if(gate.typed.length<Book.BOOK.GATE.digits){gateDraw();return}
    if(gate.typed===gate.code.digits){const cb=gate.cb;gate.cb=null;gate.tries=0;$('gate').hidden=true;guardAt=Date.now();if(cb)cb();return}
    gate.tries++;
    if(gate.tries>=Book.BOOK.GATE.tries){gate.tries=0;gate.until=Date.now()+Book.BOOK.GATE.wait*100;gateDraw();return}
    gateNew();gateDraw('수가 달라요. 새 수를 다시 눌러 주세요.');
  }
  function askGate(cb){gate.cb=cb;if(Date.now()>=gate.until)gateNew();$('gate').hidden=false;gateDraw()}
  $('gateClose').onclick=()=>{gate.cb=null;$('gate').hidden=true};
  /* 1초마다 보는 것(세계 시계와 따로: 시작 화면·쉬는 중에도 돈다) */
  const watch=[];setInterval(()=>{for(const f of watch)try{f()}catch{}},1000);
  /* 30초 쉼이 끝나면 문턱 화면 그대로 새 수와 숫자판을 다시 보인다. 전에는 "잠깐 쉬었다가 다시 해 주세요"에서 멈춰, 그만두기를 누르고 다시 길게 눌러야 했다(리뷰 0.16 R8) */
  watch.push(()=>{if(!$('gate').hidden&&gate.until&&Date.now()>=gate.until){gate.until=0;gateNew();gateDraw()}});

  /* ---------- 발자국 수첩(세계가 멈춘 때만 열린다: 시작 화면 · 엔딩 카드 · 잠깐 쉬기) ---------- */
  function pageLine(p,M){
    const fox=p.kind==='fox',king=p.kind==='king',obj=josa(M.name,'을','를');
    if(!p.foot)return king?'늑대 왕을 물리치면 발자국이 찍혀요':fox?'여우를 쫓아내면 발자국이 찍혀요':'정답 화살로 처음 물리치면 발자국이 찍혀요';
    if(p.ribbon)return '🎀 친구 리본을 달았어요';
    if(p.card)return '친구 리본까지 '+p.rib+' / '+p.ribNeed;
    if(p.note===1)return '곧 이름 쪽지를 떨어뜨려요. 읽어서 맞히면 친구가 돼요';
    if(p.note===2)return '쪽지가 바람에 날아갔어요. 다음 놀이에 또 떨어뜨려요';
    if(king)return '늑대 왕을 한 번 더 물리치면 쪽지를 떨어뜨려요';
    if(fox)return '다른 놀이에서 여우를 또 쫓아내면 쪽지를 떨어뜨려요';
    return '정답 화살로 '+obj+' '+p.needKills+'마리 물리치면 쪽지를 떨어뜨려요 ('+Math.min(p.kills,p.needKills)+'/'+p.needKills+')'+(p.kills>=p.needKills&&p.plays<p.needPlays?' · 두 번의 놀이에서 만나야 해요':'');
  }
  function drawBook(){
    const n=Book.cells(book);put($('bookTitle'),'📒 발자국 수첩 '+n+' / '+Book.CELLS+(n>=Book.CELLS?' 🏅':''));
    const box=$('bookPages');box.innerHTML='';
    for(const kind of Book.KINDS){
      const p=Book.page(book,kind),M=NOTES.MON[kind],card=el('div','book-page');card.dataset.kind=kind;card.dataset.state=p.card?'friend':p.foot?'foot':'none';
      const pic=el('b','book-pic',p.foot?NOTE_ICON[kind]:'❔');pic.setAttribute('aria-hidden','true');
      const name=el('strong','',p.card?M.name+' '+M.nick:p.foot?M.name:'아직 만나지 않았어요');
      card.append(pic,name);
      if(p.card){card.append(el('em','',M.en),el('span','book-story',M.line),el('small','','친구가 된 날: '+dateText(p.since)))}
      const steps=el('span','book-steps');for(const [on,label] of [[p.foot,'🐾 발자국'],[p.card,'🤝 친구 카드'],[p.ribbon,'🎀 리본'],[p.shiny,'✨ 반짝']]){const s=el('i',on?'on':'',label);steps.append(s)}
      card.append(steps,el('span','book-line',pageLine(p,M)));
      attr(card,'aria-label',(p.foot?M.name:'아직 만나지 않은 몬스터')+': '+pageLine(p,M));
      box.append(card);
    }
    const mb=$('bookMedals');mb.innerHTML='';
    for(const m of Book.medals(book)){if(m.hidden)continue;const L=MEDAL_LOOK[m.key],b=el('button','medal');b.dataset.key=m.key;b.dataset.tier=String(m.tier);
      b.append(el('b','',L[0]),el('span','',L[1]),el('small','',m.tier?TIER[m.tier]:'아직'));
      const tip=L[1]+': '+L[2]+' · 동 '+m.need[0]+' · 은 '+m.need[1]+' · 금 '+m.need[2]+' · 지금 '+m.n+(m.tier<3?' · 다음 단계까지 '+m.next:' · 금까지 받았어요');
      attr(b,'aria-label',tip);b.onclick=()=>put($('bookTip'),tip);mb.append(b)}
    put($('bookTip'),'훈장을 누르면 받는 방법이 보여요.');
  }
  function openBook(){if(!book||!calmWorld())return;drawBook();$('bookScreen').hidden=false}
  $('bookClose').onclick=()=>{$('bookScreen').hidden=true};
  $('openBook').onclick=openBook;$('endBookBtn').onclick=openBook;$('pauseBook').onclick=openBook;

  /* ---------- 보호자 화면 ---------- */
  let guardAt=0,guardTab='log',guardInfo=false,incoming=null;
  const guardAlive=()=>{if(guardInfo)return true;if(Date.now()-guardAt>Book.BOOK.GATE.idle*100){closeGuard();return false}guardAt=Date.now();return true};
  function closeGuard(){$('guardian').hidden=true;incoming=null}
  /* 보호자 화면을 3분 동안 손대지 않으면 닫는다(명세 §1.4 "3분 동안 손대지 않으면 닫힌다"). 전에는 다음 손길에야 닫혀 어른이 자리를 비운 뒤에도 열린 채 남았다(리뷰 0.16 R9).
     문턱이 떠 있는 동안은 기다린다. 화면을 누르거나 글을 내려 읽으면(3분 안) 손댄 것으로 친다 */
  const guardTouch=()=>{if(!guardInfo&&Date.now()-guardAt<=Book.BOOK.GATE.idle*100)guardAt=Date.now()};
  $('guardian').onpointerdown=guardTouch;$('gBody').onscroll=guardTouch;
  watch.push(()=>{if(!$('guardian').hidden&&!guardInfo&&$('gate').hidden&&Date.now()-guardAt>Book.BOOK.GATE.idle*100)closeGuard()});
  const para=(box,text,cls)=>{const p=el('p',cls||'',text);box.append(p);return p};
  const button=(box,text,fn,cls)=>{const b=el('button',cls||'',text);b.onclick=()=>{if(guardAlive())fn()};box.append(b);return b};
  const STORE_LINE="게임 기록은 이 기기에 저장되고, 개발자에게 보내지 않아요. 기기 백업을 켜 두면 이 기기의 Google 계정 백업에 함께 보관될 수 있어요(화면 잠금을 쓰는 기기에서만). 보호자가 '진행 파일 옮기기'로 직접 내보낼 수도 있어요.";
  const FILE_LINE='파일에는 읽기 단계, 날짜별 놀이 시간, 문제 기록, 수첩과 훈장이 들어 있어요. 이름과 연락처는 들어 있지 않아요. 받은 사람은 이 기록을 볼 수 있어요.';
  const COLLECT_LINE='수첩은 몬스터 8종, 32칸으로 끝이 있어요. 문제를 한 번에 맞혀 쏜 화살로만 칸이 차고, 시간이 지나거나 가게에서 사는 것으로는 차지 않아요. 친구 카드는 그 몬스터를 두 번 이상의 놀이에서 만난 뒤에, 리본은 세 번 더 만난 뒤에 생겨요. 날짜와는 상관없어서 며칠 쉬어도 사라지는 것이 없어요. 다 채우는 데는 여러 주가 걸리도록 만들었어요. 돈·광고·뽑기·순위·알림은 없어요.';
  const min=s=>Math.round(s/60);
  function tabLog(box){
    const r=Book.report(book,Date.now()),w=r.week,a=r.all;
    if(bookH.status==='newer')para(box,'새 버전에서 만든 기록이에요. 앱을 업데이트하면 이어져요. 지금 놀이는 저장되지 않아요.','g-warn');
    if(bookH.locked&&bookH.status==='memory'&&!DEMO)para(box,'저장 공간을 쓸 수 없어 지금 놀이는 저장되지 않아요.','g-warn');
    /* 쓰기 실패(용량 등)도 보호자 화면에 알린다(명세 §2.5 "보호자 화면에 경고". 전에는 판 중 한 줄 안내뿐이었다, 리뷰 0.16 W) */
    else if(bookFailNow)para(box,'저장 공간이 모자라 수첩 기록을 저장하지 못했어요. 기기의 저장 공간을 확인해 주세요. 지금 놀이는 계속할 수 있어요.','g-warn');
    para(box,'이번 주(최근 7일): 푼 문제 '+w.q+' · 한 번에 맞힌 문제 '+w.f+' · 처음 맞힌 새 글 '+w.nw+' · 논 시간 '+min(w.s)+'분 · 논 날 '+w.days+'일');
    para(box,'전체: 놀이 '+a.plays+'번 · 푼 문제 '+a.q+' · 한 번에 맞힌 문제 '+a.f+' · 논 날 '+a.days+'일 · 지킨 마을 '+a.villages+'곳');
    para(box,'분류별 한 번에 맞힌 문제(최근 놀이 30번): '+(r.rate.rd[0]+r.rate.qz[0]+r.rate.en[0]?'한글 읽기 '+r.rate.rd[1]+' / '+r.rate.rd[0]+' · 상식·수학 '+r.rate.qz[1]+' / '+r.rate.qz[0]+' · 영어 '+r.rate.en[1]+' / '+r.rate.en[0]:'아직 기록이 없어요.'));
    para(box,'기억 늑대로 다시 맞힌 글: '+r.again+'개');
    para(box,'자주 놓친 글','g-h');
    if(!r.missed.length)para(box,'아직 없어요.');
    for(const m of r.missed){const q=qById(m.id);if(!q)continue;const head=String(q.passage||q.prompt).replace(/\n/g,' ');para(box,'· '+q.choices[q.answer]+' ('+(head.length>24?head.slice(0,24)+'…':head)+') · 놓친 수 '+m.miss,'g-miss')}
  }
  function pick(box,label,options,value,fn){
    const row=el('label','g-row',label+' '),sel=el('select');
    for(const [v,t,off] of options){const o=el('option','',t);o.value=String(v);if(off)o.disabled=true;sel.append(o)}
    sel.value=String(value);sel.onchange=()=>{if(guardAlive())fn(sel.value,sel)};row.append(sel);box.append(row);return sel;
  }
  function tabSet(box){
    pick(box,'하루 시간',Book.BOOK.DAY_CHOICES.map(v=>[v,v?v+'분':'없음']),book.set.day,(v,sel)=>{const n=Number(v),apply=()=>{Book.setOpt(book,'day',n,{now:Date.now()});bookDirty=true;save(true);drawGuard()};
      if(n===0)askGate(apply);else apply();sel.value=String(book.set.day)});
    para(box,'하루 시간이 지나면 다음 문제 사이에 "꼬꼬가 졸려요" 화면이 나와요. 결전 중이면 결전이 끝난 뒤에 나와요. 잃는 것은 없어요.','g-note');
    /* 영어 비중은 문제은행이 받아 줄 때만 보인다(Questions.setMix, 문제은행 판 연결 뒤) */
    if(typeof Questions.setMix==='function'){
      pick(box,'영어 문제',[['off','끄기'],['std','보통'],['more','조금 더'+(state.age<Book.BOOK.MORE_FROM?' (9세부터)':''),state.age<Book.BOOK.MORE_FROM]],book.set.en,v=>{if(Book.setOpt(book,'en',v,{age:state.age,now:Date.now()})){bookDirty=true;applyMix();world.interval=waveInterval();save(true)}drawGuard()});
    }
    para(box,'읽기 단계(나이)와 효과음은 ⚙️ 설정에서 바꿔요.','g-note');
    para(box,'처음부터','g-h');
    para(box,'⚙️ 설정의 "마을을 처음부터"는 지금 마을만 새로 시작해요. 수첩, 훈장, 학습 기록은 남아요.','g-note');
    button(box,'모든 기록 지우기',()=>askGate(()=>{if(!confirm('이 기기에 저장된 게임 기록을 모두 지울까요? 되돌릴 수 없어요.'))return;Book.wipeAll(localStorage,BK);bookDirty=false;reloadFromStore()}),'g-danger');
  }
  /* 진행 파일: 내보내기는 보호자가 직접 누를 때만. 어디로 보낼지는 보호자가 고른다(앱이 스스로 올리거나 보내지 않는다) */
  function appVersion(){try{const m=/\d+\.\d+(\.\d+)?/.exec($('appVersion').textContent);return m?m[0]:''}catch{return ''}}
  /* 알림 문구(레드팀 r2 B1): 웹은 내려받기가 실제로 시작됐는지 알 수 없다(브라우저가 막거나 묻는 창을 띄우거나, WebView가 무시할 수 있음).
     그래서 "만들었어요"라고 단정하지 않고 내려받기 목록 확인을 부탁하며, 예외가 나면 실패 문구를 쓴다. 전에는 실패해도 "진행 파일을 만들었어요"였다.
     알림은 누른 바로 뒤에 동기로 쓴다: Android 앱 껍데기(app-shell.js)가 a download 누름을 잡아 그 뒤(마이크로태스크)에 자기 문구로 바꾼다 */
  const EXPORT_SENT=name=>'진행 파일('+name+')을 내려받기로 보냈어요. 저장됐는지 브라우저의 내려받기 목록에서 확인해 주세요.';
  const EXPORT_FAIL='진행 파일을 만들지 못했어요. 이 브라우저에서는 내려받기가 안 될 수 있어요. 다른 브라우저에서 다시 해 주세요.';
  function exportNow(){
    const now=Date.now();save(true);let sent=false,name='';
    try{
      const text=Book.exportText(book,{...state,version:Combat.SAVE_VERSION},{now,app:appVersion()});name=Book.fileName(now);
      window.__lastExport={name,text};/* 검사·앱 포장용: 방금 만든 진행 파일(앱 껍데기가 a download 누름 때 읽는다) */
      const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);sent=true;
    }catch{}
    put($('gNote'),sent?EXPORT_SENT(name):EXPORT_FAIL);
  }
  function importText(text){
    const r=Book.importFile(text,{now:Date.now(),knows:bookKnows,cleanRun:run=>Combat.restore(run,AGES)});
    incoming=null;
    if(!r.ok){put($('gNote'),r.error==='newer'?'새 버전 앱에서 만든 파일이에요. 앱을 업데이트해 주세요.':'진행 파일이 아니에요.');drawGuard(true);return r}
    incoming=r;drawGuard(true);return r;
  }
  window.__importText=importText;
  const pv=p=>'친구 카드 '+p.cards+' · 훈장 '+p.medals+' · 놀이 '+p.play+'번 · 마지막 '+p.last;
  function tabFile(box){
    para(box,STORE_LINE);
    /* 앱보다 새 버전 기록이 있으면 이 앱은 메모리 안 빈 기록만 들고 있어 내보내지 않는다. 전에는 빈 기록 파일을 만들어, 그 파일을 다른 기기에서 바꾸기 하면 진행이 비었다(리뷰 0.16 N) */
    if(bookH.status==='newer')para(box,'새 버전에서 만든 기록이라 이 앱에서는 내보낼 수 없어요. 앱을 업데이트한 뒤 내보내 주세요.','g-warn');
    else button(box,'파일로 내보내기',()=>askGate(exportNow));
    para(box,FILE_LINE,'g-note');para(box,'기기를 바꾸기 전에 진행 파일을 내보내 두세요.','g-note');
    button(box,'파일 불러오기',()=>{try{$('importFile').value='';$('importFile').click()}catch{}});
    if(incoming){
      if(!incoming.sumOk)para(box,'파일이 바뀌었거나 손상됐을 수 있어요. 그래도 불러올까요?','g-warn');
      para(box,'불러올 기록: '+pv(incoming.preview));para(box,'이 기기의 기록: '+pv(Book.preview(book)));
      button(box,'바꾸기',()=>askGate(()=>{const r=incoming;incoming=null;if(!r)return;
        if(Book.swapIn(localStorage,BK,r.book,r.run?JSON.stringify({...r.run,version:Combat.SAVE_VERSION}):null,{now:Date.now()})){bookDirty=false;reloadFromStore();openGuard('file',true);put($('gNote'),'기록을 바꿨어요. 잘못 바꿨으면 되돌리기를 눌러요.')}
        else put($('gNote'),'바꾸지 못했어요. 저장 공간을 확인해 주세요.')}));
      button(box,'그만두기',()=>{incoming=null;drawGuard()});
    }
    if(Book.canUndo(localStorage,BK))button(box,'되돌리기(바꾸기 전 기록으로)',()=>{if(Book.undo(localStorage,BK)){bookDirty=false;reloadFromStore();openGuard('file',true);put($('gNote'),'바꾸기 전 기록으로 되돌렸어요.')}});
  }
  /* 파일 고르기는 형식으로 거르지 않는다(index.html #importFile에 accept 없음). 메신저·Android Chrome으로 받은 파일은 이름이 .json이 아니거나
     형식이 application/octet-stream·text/plain이라 accept=".json,application/json"이면 고를 수 없었다(레드팀 r2). 대신 크기(1MB)와 내용(Book.importFile: JSON · fmt · 버전 · 검사합)으로 거른다.
     읽지 못하면(파일이 사라짐·권한) 그렇다고 알린다 */
  $('importFile').onchange=()=>{try{const f=$('importFile').files&&$('importFile').files[0];if(!f)return;if(f.size>Book.FILE_MAX){put($('gNote'),'진행 파일이 아니에요.');return}const rd=new FileReader();rd.onload=()=>importText(String(rd.result||''));rd.onerror=()=>put($('gNote'),'파일을 읽지 못했어요. 다시 골라 주세요.');rd.readAsText(f)}catch{put($('gNote'),'파일을 읽지 못했어요. 다시 골라 주세요.')}};
  function tabHelp(box){
    if(!guardInfo){para(box,'보호자 화면에 대하여','g-h');para(box,'보호자 화면의 문턱(길게 누르기와 글로 적힌 수)은 아이가 실수로 누르지 않게 하는 문턱이에요. 보안 장치가 아니에요.');
      para(box,'반짝 손님','g-h');para(box,Book.shinyText());
      para(box,'수집은 이렇게 돼요','g-h');para(box,COLLECT_LINE);
      para(box,'저장','g-h');para(box,STORE_LINE)}
    for(const [h,lines] of NOTES.PRIVACY){para(box,h,'g-h');for(const t of lines)para(box,t)}
    para(box,'오픈소스 고지','g-h');para(box,'이 앱은 three.js(MIT License, Copyright © three.js authors)를 사용합니다.');
  }
  const TABS=[['log','기록',tabLog],['set','설정',tabSet],['file','진행 파일',tabFile],['help','도움말',tabHelp]];
  function drawGuard(keepNote){
    const tabs=$('gTabs'),box=$('gBody');tabs.innerHTML='';box.innerHTML='';if(!keepNote)put($('gNote'),'');
    for(const [key,name] of guardInfo?[TABS[3]]:TABS){const b=el('button',key===guardTab?'on':'',guardInfo?'보호자 안내 · 개인정보처리방침':name);b.dataset.tab=key;b.onclick=()=>{if(!guardAlive())return;guardTab=key;incoming=null;drawGuard()};tabs.append(b)}
    (TABS.find(t=>t[0]===guardTab)||TABS[0])[2](box);
  }
  function openGuard(tab,keep){guardInfo=false;guardTab=tab||'log';guardAt=Date.now();if(phase!=='start'&&phase!=='ending'&&!paused&&!sleepyOn)$('pause').click();$('guardian').hidden=false;drawGuard(keep)}
  function openInfo(){guardInfo=true;guardTab='help';$('guardian').hidden=false;drawGuard()}
  $('guardClose').onclick=closeGuard;
  const holdHint=id=>()=>put($(id),'보호자는 단추를 2초 동안 길게 눌러요.');
  hold($('openGuard'),()=>{if(book)askGate(()=>openGuard('log'))},holdHint('dayNote'));
  hold($('drawerGuard'),()=>{if(book)askGate(()=>openGuard('log'))},()=>say('보호자는 단추를 2초 동안 길게 눌러요.'));
  hold($('sleepyMore'),()=>{if(book&&sleepyOn)askGate(()=>{Book.extend(book,Date.now(),Book.BOOK.DAY_EXTEND);bookDirty=true;save(true);wakeUp()})},holdHint('sleepyNote'));
  $('openInfo').onclick=openInfo;

  /* ---------- 시작 화면 · 엔딩 카드 · 쉬기 중 단추 ---------- */
  /* drawStart가 부른다 */
  window.bookStart=function(){
    const on=!!book;show('bookRow',on);show('openInfo',on);show('dayNote',on);show('drawerGuard',on);
    put($('reset'),on?'마을을 처음부터 (수첩·훈장은 그대로)':'처음부터 시작');
    if(on)put($('dayNote'),book.set.day?'하루 '+book.set.day+'분 놀면 꼬꼬가 쉬어요. 보호자 화면에서 바꿀 수 있어요.':'');
  };
  /* showEnding이 부른다: 쉬기 권유(단추보다 위·크게), 이번 판에 얻은 것, 놀러 올 친구 */
  window.bookEnding=function(){
    const on=!!book;for(const id of ['endRest','endQuit','endBookBtn'])show(id,on);
    const g=gain,parts=[];
    if(on){if(g.foot)parts.push('발자국 +'+g.foot);if(g.card)parts.push('친구 카드 +'+g.card);if(g.ribbon)parts.push('리본 +'+g.ribbon);if(g.shiny)parts.push('반짝 +'+g.shiny);
      g.medal.forEach((n,i)=>{if(n)parts.push('훈장 '+TIER[i+1]+' '+n)})}
    show('endBook',on&&parts.length>0);put($('endBook'),parts.length?'📒 이번 판: '+parts.join(' · '):'');
    const fr=on?Book.friends(book):[];show('endFriends',fr.length>0);put($('endFriends'),fr.length?'🎉 놀러 올 친구: '+fr.map(f=>NOTES.MON[f.kind].nick).join(' · '):'');
  };
  /* 오늘은 그만하기: 엔딩 카드를 닫고 시작 화면으로(진행은 저장돼 있어 다음에 이어 간다) */
  $('endQuit').onclick=()=>{if(phase!=='ending')return;save(true);$('ending').hidden=true;phase='start';$('start').hidden=false;drawStart()};
  /* 수첩 단추(pauseBook)는 잠깐 쉬기 중에만 보인다: index.html render()가 켜고 끈다(읽는 중에는 수첩을 열 수 없다) */
  for(const id of ['sleepy','bookScreen','guardian','gate'])$(id).hidden=true;/* 겹창은 닫힌 채로 시작 */
  window.bookStart();
})();
