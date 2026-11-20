/* 친구 카드 그림(0.17): 몬스터 8종 × 보통·반짝 = 16장, art/cards/<키>[-shiny].webp (300×400, 투명 배경).
   저장소의 3D 모형(src/monsters.js 절차 모형 6종 · 0.15 GLB 늑대 왕·도둑 여우)을 렌더한 그림이다(docs/v017-card-art.md, scripts/card-shots.cjs).
   make()는 카드 바탕 틀(span.card-art) 안에 그림을 넣고, 그림을 못 불러오면 그 자리를 지금까지의 그림 문자로 바꾼다.
   경로는 상대 경로만 쓴다(GitHub Pages · Android 오프라인 포장에서 같은 자리). 브라우저에서는 window.CARDS, node(test-book.cjs)에서는 module.exports */
(function(root){
  const KINDS=['wolf','bramble','boar','granite','frost','ember','fox','king'];
  const DIR='art/cards/';
  const src=(kind,shiny)=>DIR+kind+(shiny?'-shiny':'')+'.webp';
  const ALL=KINDS.flatMap(k=>[src(k,false),src(k,true)]);
  /* doc: document(검사에서는 가짜 문서), icon: 그림을 못 쓸 때 보일 그림 문자.
     그림 문자도 틀 안쪽 요소(i)에 넣는다: 발자국 단계 그림자 필터가 틀의 따뜻한 바탕이 아니라 그림(문자)에만 걸리게 */
  function make(doc,kind,shiny,icon){
    const box=doc.createElement('span');box.className='card-art'+(shiny?' shiny':'');box.setAttribute('aria-hidden','true');
    const fallback=()=>{const t=doc.createElement('i');t.textContent=icon||'❔';box.textContent='';box.append(t);box.classList.add('emoji')};
    if(!KINDS.includes(kind)){fallback();return box}
    const img=doc.createElement('img');img.alt='';img.draggable=false;img.decoding='async';
    img.onerror=()=>{img.onerror=null;img.remove();fallback()};
    img.src=src(kind,shiny);box.append(img);return box;
  }
  const api={KINDS,DIR,src,ALL,make,W:300,H:400};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.CARDS=api;
})(this);
