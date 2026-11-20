/* 친구 카드 그림(0.17): 몬스터 8종 × 보통·반짝 = 16장, art/cards/<키>[-shiny].webp (300×400, 투명 배경).
   저장소의 3D 모형(src/monsters.js 절차 모형 6종 · 0.15 GLB 늑대 왕·도둑 여우)을 렌더한 그림이다(docs/v017-card-art.md, scripts/card-shots.cjs).
   SHINY는 종별 반짝 색 표(카드 렌더 · 3D 반짝 손님 공용). make()는 카드 바탕 틀(span.card-art) 안에 그림을 넣고, 그림을 못 불러오면 그 자리를 지금까지의 그림 문자로 바꾼다.
   경로는 상대 경로만 쓴다(GitHub Pages · Android 오프라인 포장에서 같은 자리). 브라우저에서는 window.CARDS, node(test-book.cjs)에서는 module.exports */
(function(root){
  const KINDS=['wolf','bramble','boar','granite','frost','ember','fox','king'];
  const DIR='art/cards/';
  const src=(kind,shiny)=>DIR+kind+(shiny?'-shiny':'')+'.webp';
  const ALL=KINDS.flatMap(k=>[src(k,false),src(k,true)]);
  /* 반짝 색(명세 §5.1 · C11): 원래 꼭짓점 색(sRGB hex) → 반짝 색. 표에 없는 중립색(눈동자·코·이빨·혀, 여우 가방 등)은 그대로.
     이 표 하나를 카드 렌더(tools/card-render.js)와 3D 마을의 반짝 손님(src/village.js)이 같이 쓴다. 그림 화면(3D 실패)의 반짝 손님은 이 표로 렌더한 반짝 카드 그림을 쓴다.
     절차 모형 6종은 src/monsters.js의 색, 늑대 왕·도둑 여우는 0.15 GLB의 COLOR_0 색이다. 색을 고치면 card-art.yml로 카드를 다시 렌더한다 */
  const SHINY={
    wolf:{0x66717f:0xa3b8da,0x4a5360:0x7489b3,0xf1e4c8:0xf3f6ff,0xffb43a:0xffe98a,0xe8988f:0xc4b5ee},
    bramble:{0x55893a:0xc94a2c,0x74aa44:0xe8752f,0x96c955:0xf5b440,0x4f7d33:0xb04a2a,0x4d525b:0x5f514c,0x3a3d44:0x4a3a3a},
    boar:{0x7b5034:0xc39531,0x86593a:0xd6ab45,0xa6774e:0xe9cd7e,0x3a2416:0x7b5320,0x6b4228:0xa87a2e,0x6b4429:0xa47830,0xc08a66:0xe0ba74,0xdcb08a:0xf4dda8,0x2e2018:0x4d3518,0xfffaf0:0xfffbe2},
    granite:{0xb3b6bb:0x86b45a,0x9a9ea5:0x649a48,0xc6c8cc:0xa9cf70,0x474c55:0x4c5a48,0x34383f:0x37463a,0xe6dcc6:0xe9e7c6},
    frost:{0xa8c7ee:0xf4bdd6,0x8fb3e0:0xe79cc0,0xf6f8fd:0xfff5fa,0x4a9cff:0xe2569c,0x8fd8ff:0xffbfe6,0xc4ecff:0xffeefa},
    ember:{0xff4a26:0x2f6bff,0xff7a2e:0x3db2ff,0xffb43c:0xaaf0ff,0xffa62b:0x70e2ff,0xff7a3a:0x52a8ff,0x3c3248:0x22304e,0x2a2232:0x17203a,0xead8c0:0xdce5f3},
    fox:{0xbd663b:0x8f97a8,0xcf7549:0xa8afbd,0xdc8951:0xc3c9d4,0xf3d7a8:0xeef1f6,0xf7e3bf:0xf6f8fb,0xfff3d6:0xfbfcff,0xf3bf78:0xdde2ea,0x472e2a:0x2d3039,0xb55f56:0xc4a3bd},
    king:{0x63636a:0xcaa23c,0x757784:0xdeb95c,0x565863:0xa88228,0x32323d:0x4a3a1f,0xb6ada1:0xf2e4bd,0xcec2ad:0xfff1cf,0xfff3d6:0xfffaf0,0xefb051:0xfff0ab,0xeab758:0xfff5c4,0xe1a64d:0xffe38c,0xbd8145:0xe9c35c,0xc58342:0xf0cb66,0x9b7676:0xc99272}
  };
  const SHINY_NAME={wolf:'달빛',bramble:'단풍',boar:'흙빛 금',granite:'이끼',frost:'눈꽃',ember:'푸른 불씨',fox:'은여우',king:'금빛 왕'};
  /* 꼭짓점 색 하나(sRGB hex) → 반짝 색. 표에 없으면 그대로 */
  const shinyHex=(kind,hex)=>{const m=SHINY[kind],to=m&&m[hex];return to===undefined?hex:to};
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
  const api={KINDS,DIR,src,ALL,make,SHINY,SHINY_NAME,shinyHex,W:300,H:400};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.CARDS=api;
})(this);
