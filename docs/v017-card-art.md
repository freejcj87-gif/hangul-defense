# 0.17 친구 카드 그림 (art/cards)

2026-11-20. 발자국 수첩의 친구 카드 그림 문자(🐺🌿🐗…)를 저장소에 이미 있는 3D 모형을 렌더한 그림 16장으로 바꿨다. 새 모형, 이미지 생성 서비스, 외부 그림은 쓰지 않았다(명세 `launch/design/02-MVP-구현명세-20261118.md` §5.1).

## 16장 목록

몬스터 8종 × 보통·반짝. 파일은 모두 `art/cards/`, 300×400(카드 3:4), 투명 배경 webp(손실 압축, 품질 0.9, 알파 포함).

| 키 | 종 이름 | 원본 모형 | 보통 | 반짝 | 반짝 색(명세 §5.1 초안) |
|---|---|---|---|---|---|
| `wolf` | 늑대 | `src/monsters.js` 절차 모형 | `wolf.webp` 20,488 B | `wolf-shiny.webp` 26,458 B | 달빛(은청): 털 은청색, 눈 연노랑 |
| `bramble` | 덤불 늑대 | `src/monsters.js` 절차 모형 | `bramble.webp` 22,926 B | `bramble-shiny.webp` 30,874 B | 단풍(주홍): 잎 주홍·주황·노랑, 털 따뜻한 회갈색 |
| `boar` | 멧돼지 | `src/monsters.js` 절차 모형 | `boar.webp` 21,056 B | `boar-shiny.webp` 27,566 B | 흙빛 금: 가죽 금빛, 갈기 구릿빛 |
| `granite` | 바위 늑대 | `src/monsters.js` 절차 모형 | `granite.webp` 20,804 B | `granite-shiny.webp` 27,822 B | 이끼(초록): 바위 이끼색, 털 녹회색 |
| `frost` | 서리 늑대 | `src/monsters.js` 절차 모형 | `frost.webp` 21,578 B | `frost-shiny.webp` 28,074 B | 눈꽃(흰분홍): 털 분홍, 얼음 볏 연분홍, 눈 장밋빛 |
| `ember` | 불씨 왕 | `src/monsters.js` 절차 모형 | `ember.webp` 23,120 B | `ember-shiny.webp` 30,100 B | 푸른 불씨: 불꽃 파랑·하늘색, 털 남색 |
| `fox` | 도둑 여우 | `art-handoff/v015-v016/glb/thief-fox.glb` | `fox.webp` 23,802 B | `fox-shiny.webp` 29,706 B | 은여우: 털 은회색(가방·금빛 고리는 그대로) |
| `king` | 늑대 왕 | `art-handoff/v015-v016/glb/wolf-king.glb` | `king.webp` 23,718 B | `king-shiny.webp` 32,224 B | 금빛 왕: 털 금빛, 관 연금빛(청록 보석·붉은 목걸이는 그대로) |

- 합계 **410,316 B(약 401 KB)**, 장당 20~32 KB. 예산(장당 60 KB 이하, 16장 1 MB 이하)의 약 40%다.
- 모형이 없어 그림 문자로 남은 칸은 없다.
- 반짝 그림에는 둘레에 작은 금빛 별 6개를 2D로 덧그렸다(그림 파일 안).
- 지금 실제 렌더 파일은 CI 실행 `44649292903`(커밋 `b18ed38`)의 아티팩트 `card-art`에서 받은 그대로다. 커밋 `80a9385` 메시지에 적은 실행 번호 `44649224811`은 잘못 적은 것이다.

## 렌더 방법

- `tools/card-render.js`(three.js 0.180): 절차 모형 6종은 `monsterGeometry()`·`rigMaterial()`을 게임과 똑같이 쓰고(리그 셰이더, 불꽃·눈 빛남 포함), 자세 속성만 고정값으로 넣는다(머리를 카메라 쪽으로 조금 돌림, 입 살짝 벌림, 꼬리 조금 듦). 늑대 왕·도둑 여우는 GLB를 `GLTFLoader`로 그대로 읽고 `Head`·`Tail` 노드만 조금 돌린다.
- 반짝 모습은 꼭짓점 색만 바꾼다. 원래 색(sRGB hex) → 반짝 색 표(`SHINY`)이고, 표에 없는 중립색(눈동자·코·이빨·혀 등)은 그대로 둔다. 렌더 로그에 "색 그대로" 목록이 나온다.
- 카메라와 조명: 몸을 보는 사람 오른쪽으로 0.62 rad 돌린 정면 3/4, 카메라 높이각 약 15°, 시야각 26°. 조명은 게임과 같은 ACES 톤 매핑에 따뜻한 반구광, 앞 왼쪽 위 주광, 오른쪽 보조광, 뒤 테두리 빛을 쓴다. 발밑은 부드러운 원형 그림자 하나다. 그림자 맵은 쓰지 않는다(1차 렌더에서 확대하면 몬스터 뒤 바닥에 계단진 띠가 생겼다).
- 맞춤: 1차로 그려 불투명 픽셀 경계를 재고, 2차에 `setViewOffset`으로 몬스터가 가로 86%·세로 76% 안에 들고 발끝이 아래 89% 자리에 오게 잘라 확대한다. 600×800으로 그린 뒤 300×400으로 줄인다.
- 배경은 투명이다. 따뜻한 카드 바탕은 게임 CSS(`.card-art`)가 깐다. 그래서 발자국 단계 그림자(`filter: brightness(0) opacity(.35)`)가 바탕까지 까맣게 하지 않고 그림 모양대로 나온다.
- 확인용 `sheet.png`: 종마다 [보통 · 발자국 그림자 · 반짝]을 게임과 같은 카드 바탕에 얹어 한 장에 찍는다(`tools/card-render.html`).

## 다시 렌더하는 법

브라우저를 쓰므로 로컬 PC가 아니라 CI에서 돌린다(로컬 여유 메모리 1 GB 미만).

1. `tools/card-render.js`(자세·색·조명) 등을 고쳐 `claude/card-art` 브랜치에 push한다. `.github/workflows/card-art.yml`이 돈다(경로: `tools/**`, `scripts/card-shots.cjs`, `src/monsters.js`, 두 GLB, 워크플로 파일). 기본 가지에 이 워크플로가 들어간 뒤에는 `gh workflow run card-art.yml --ref <가지>`로도 돌릴 수 있다.
2. 받기:
   ```
   gh run list --branch claude/card-art --workflow card-art.yml --limit 1
   gh run watch <실행 번호>
   gh run download <실행 번호> -n card-art -D <작업 트리 밖 임시 폴더>
   ```
3. `sheet.png`를 눈으로 확인하고, 마음에 들면 webp 16장을 `art/cards/`에 덮어쓴다. `node test-book.cjs`가 파일·크기·크기 예산을 확인한다.

CI 단계는 Playwright 1.56.1 컨테이너(`mcr.microsoft.com/playwright:v1.56.1-noble`, `--ipc=host`, 브라우저 설치 단계 없음)에서 `npm install --no-save --package-lock=false playwright@1.56.1 three@0.180.0 esbuild@0.25.10` 뒤 `node scripts/card-shots.cjs card-shots`를 돌린다. 브라우저 여유가 있는 PC라면 같은 두 줄을 로컬에서 돌려도 된다(결과는 `card-shots/`, `.gitignore`에 있음). 한 번 도는 데 약 1분 걸린다.

## 게임에 연결한 곳

- `cards.js`(새 파일, `window.CARDS`): 경로 목록(`ALL` 16개, 상대 경로 `art/cards/…`)과 `make(document, kind, shiny, icon)`. 틀(`span.card-art`) 안에 `img`를 넣고, `onerror`가 나면 그 자리를 그림 문자(`i`)로 바꾼다. `index.html`이 `notes.js` 뒤·`book.js` 앞에 부른다.
- `index.html`의 `cardPic(kind, shiny)`: `cards.js`가 있으면 `CARDS.make`, 없으면 바로 그림 문자(`NOTE_ICON`). 친구가 되는 연출(`friendCard`)이 이것을 쓴다.
- `bookui.js` 수첩 쪽: 발자국 뒤에는 카드 그림(발자국 단계는 그림자, 친구면 그대로), 만나기 전에는 점선 빈 틀 + ❔. 오른쪽 아래 작은 칸은 반짝 칸이다(받으면 반짝 그림, 발자국 뒤 아직이면 "?").
- 반짝 그림 틀: 금빛 테두리와 은은한 빛, 지나가는 빛줄기(움직임 줄이기 설정이면 멈춤).
- 배포: `scripts/build-pages.cjs`(`cards.js` + 16장), `pages.yml`·`package-test.yml` 경로와 실제 주소 확인(webp 16장), `test.cjs` 정적 서버 허용 목록과 `image/webp` 형식, `scripts/book-shots.cjs` 형식. 모두 상대 경로라 Android 오프라인 포장(`.pages-build` 묶음)에도 그대로 들어간다.

## 검사

- `node test-book.cjs` C절: 16개 경로·파일 존재, webp·알파·300×400, 장당 64 KB 이하·합계 1 MB 이하, `art/cards`에 16장만, 배포 목록 = `cards.js` 목록, 워크플로 경로, 대체 길(가짜 문서에서 `onerror` → 그림 문자, 모르는 종 → 바로 그림 문자).
- `node test-dom.cjs` 수첩 쪽 그림 자리(그림 문자 · 카드 그림 · 반짝 칸 · 못 불러올 때).
- `node test.cjs` book 구간(브라우저, CI): 수첩 쪽 카드 그림 로드(너비 300), 발자국 쪽 그림자 필터, 친구 카드 연출의 그림, 그림 요청을 막았을 때 그림 문자.

## 남은 것

- 게임 안 반짝 손님은 아직 모든 종이 같은 금빛 색조(`src/village.js` `SHINY_TINT`)로 나온다. 카드의 종별 반짝 색(위 표)과 맞추려면 3D 쪽에도 같은 색 표를 넣어야 한다(명세 C11 "3D 색").
- 명세 §1.5의 "더 놀기" 그림 화면(`#garden`)에 친구 카드 작은 아이콘 최대 4개는 아직 없다(이 작업 범위 밖).
- 버전 올림(`?v=0.16` 캐시 키, 버전 표기)은 0.17 출시 때 함께 한다.
