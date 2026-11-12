# 0.9 구현 계약 (규칙 · 화면 · 3D 공통)

기준: 2026-11-12. 설계 정본은 [game-plan.md](game-plan.md) §3~§6(프로듀서 5대 방향). 이 문서는 세 작업이 서로 기대는 **이름과 자료 모양**만 정한다. 수치는 초안이며 규칙 작업이 시뮬레이터로 맞춘다. 바꿔야 하면 이 문서를 먼저 고치고 알린다.

열린 질문 기본값(프로듀서 답 전): 상점에서 사도 늑대는 멈추지 않음 · 두 번째에 맞히면 금화 없음(지금과 같음) · 밤/새벽 없음 · 농부 상한 10.

## 파일 소유
| 작업 | 고치는 파일 |
|---|---|
| 규칙(R) | `combat.js`, `world.js`, `scripts/sim-village.cjs`, `test-dom.cjs` 1부(규칙) |
| 화면(U) | `index.html`, `test.cjs`, `test-dom.cjs` 2부(가짜 DOM 흐름) |
| 3D(T) | `src/village.js`, `src/monsters.js`, 새 `src/*.js` |

## Combat (combat.js)
- `Combat.SHOP` 표시 순서(2줄 × 4칸, 위치 고정): `['repair','tower','power','fence','chicken','farmer','pond','hall']`. 회관 3단계부터 8번째 칸은 `feast`가 이어받는다.
- `Combat.shop(s)` → 8개 `{key, state, price, need}`. `state`: `'buy'`(살 수 있음) · `'poor'`(금화 부족) · `'locked'`(회관 단계 부족, `need` = 필요한 회관 단계) · `'none'`(고칠 곳 없음, repair 전용) · `'max'`(숨은 상한, 거의 안 나옴). 화면은 이 결과만 그린다(개수·상한은 아이에게 보이지 않음).
- `Combat.price(s,key)`, `Combat.canBuy(s,key)`(카드 순환 `offers`와 무관), `Combat.buy(s,key)` → 낸 금화(못 사면 0). `Combat.max(key)` = 숨은 상한(구매 횟수): tower 19(타워 1+19=20), power 10, fence 18, chicken 19(닭 1+19=20), farmer 9(농부 1+9=10), pond 3, hall 3, feast·repair 무한.
- 카드 고르기 단계 삭제: `offers`·`picks`는 게임에서 쓰지 않는다(남겨도 되지만 화면은 부르지 않음).
- **알 경제**: 상태에 `nest`(둥지에 남은 알, 저장됨), `marketDown`(매대·가게가 부서졌으면 1, 화면이 세계에서 맞춰 넣음). `Combat.income(s,q,fast)` →
  `{laid, sold, left, eggValue, fish, base, m, streak, combo, plain, bonus, gold}`
  - `laid` = 닭 수(정답 = 닭마다 알 1개), `sold = min(nest + laid, (1 + farmers) × 4)`, `left = min(닭 수, nest + laid − sold)`
  - `eggValue = PAY.egg + PAY.hall × hall` = **2 + hall**(시뮬레이터로 4 → 2), `marketDown`이면 절반(내림, 최소 1)
  - `plain = round((PAY.base + 5×feast + sold × eggValue + 6×pond) × m × combo)`, `PAY.base` = **9**(8 → 9), 번개 +25%
  - 가격(2026-11-12 조정): 타워 35×1.23ⁿ(끝 1455) · 울타리 20×1.32ⁿ(끝 2245) · 닭 30×1.26ⁿ(끝 1920) · 농부 85×1.15ⁿ(끝 260) · 강화 110·260·450 다음 480×1.065ⁿ · 연못 180·400·650 · 회관 150·**420·1080** · 잔치 200+60n · 고치기 10+11×부서진 곳. 모두 사는 값 35,230(초안 17,930). 5골드 단위.
  - `settle(s,q,'first')`가 `s.nest = left`로 바꾼다. 두 번째 정답·놓침은 지금처럼 금화 없음.
- **추천**: `Combat.recommend(s, ctx)` → `{key, line, urgent, rule}` 또는 `null`(순수 함수, 빈도 제한은 화면 몫). `ctx = {wolvesInside, towers, lostHenRecently, brokenKinds:[...], opened:[...]}`(`towers` = 서 있는 타워 수, `opened` = 이미 띄운 rule 4 key 목록). 화면은 `s.gold`에 **화면에 보이는 금화**(동전이 닿은 만큼)를 넣어 부른다. 규칙 순서는 game-plan §4.5 표, `line`은 §4.5 문장표에서 고른 한국어 문장. 살 수 있는 상품만 고른다(보너스 "조금만 더 모으면 …"만 예외, `key`는 그대로 두고 `urgent:false`).
- `Combat.restore`: 0.8 저장의 `round.phase==='pick'`은 금화를 이미 받은 문제 → `round=null`, `index+1`. `left`(남은 카드 수)는 버린다.
- (규칙 작업이 정함, 2026-11-12 구현) 아래는 구현에서 정하거나 더한 것. 화면은 이것만 지키면 된다.
  - `Combat.API === 3`(0.8은 2). index.html의 버전 확인을 3으로.
  - `shop(s)`의 `max` 칸은 `price: 0`. 칸 키만 필요하면 `Combat.shopKeys(s)`. 산 횟수 `Combat.count(s,key)`(닭은 처음 1마리 제외, 물려 가면 줄어 다시 살 수 있고 값도 내려감). 상한 수 `Combat.HENS_MAX`(20)·`TOWERS_MAX`(20)·`FARMERS_MAX`(10).
  - `income`은 계약 필드에 더해 `basket`(바구니 = (1 + farmers) × PAY.basket)과 0.8 호환 이름 `eggs`(= sold)·`value`(= eggValue)를 준다. 알값 계산은 `Combat.eggPrice(s)`, 상수는 `Combat.PAY = {base, egg, hall, basket, fish, feast}`(알값 = egg + hall × 회관 단계).
  - 고치기 값 = `Combat.REPAIR.base + REPAIR.per × 부서진 곳`.
  - 추천 `rule`: §4.5 순서 번호 1~8, 보너스는 0. `urgent`는 rule 1·2만. 문장표는 `Combat.LINES`(기획서 문장 + 빈 곳 채움: `repairNursery`·`repairBarn`·`repair`(종류 모름)·`fenceThick`(6면 다 막힘)·`hallSave`·rule 8용 `tower`/`power`/`pond`/`feast`).
  - **보너스(회관 목표) 확장·위치**: 보너스는 rule 6 다음, rule 7 앞에서 본다. 조건 = 회관 값의 `REC.hallSoon`(70%) 이상 모음 → `hallSoon` 문장, 또는 이 회관 단계에서 지은 것(`Combat.built(s)`)이 `REC.hallGoal[회관 단계]` 이상 → `hallSave` 문장("금화를 모아서 회관을 키워 봐요!"). 둘 다 `key:'hall'`, `urgent:false`, `rule:0`, 살 수 없을 수 있음. 까닭: 7·8번이 금화를 생기는 대로 써 버리면 회관 값이 모이지 않아 회관 단계 목표(10/20/40분에 1/2/3)를 못 맞춘다(시뮬레이터 확인).
  - rule 8: 지켜요(타워·강화·울타리 산 횟수) ≤ 벌어요(닭·농부·연못)면 지켜요 쪽, 아니면 벌어요 쪽에서 **살 수 있는 가장 싼 것**, 그쪽에 없으면 다른 쪽, 그다음 잔치. 농부는 닭이 바구니보다 많을 때만.
  - `restore`가 남기는 진행 중 문제는 `ask`·`learn`만(`{token, phase, t, tries, gold}`). 저장 형식은 version 1 그대로, 새 필드 `nest`·`marketDown`·`pace`.
  - **(화면이 넘길 것 1개 추가) `Combat.settle(state,q,'first',{fast, ticks: round.t})`**: `ticks` = 그 문제에서 맞힐 때까지 흐른 틱(번개 판정과 같은 `round.t`). 규칙이 읽기 속도 `s.pace`(100 = 보통 아이 필요 시간, 50~300)를 기억하고, 세계가 천천히 읽는 아이(100 넘음)에게 무리·낙오 늑대를 덜 보낸다(`World.SLOW`, 보이지 않는 완충). 찍는 아이는 빨리 눌러 100 아래라 완충이 없다. `ticks`를 안 넘기면 pace는 100 그대로(완충 없음, 다른 규칙은 같음). 까닭: 느린 아이 ≥ 보통의 60%(§4.7)는 늑대 피해를 줄이지 않으면 안 된다(늑대가 없으면 54~73%, 있으면 19~59%, 시뮬레이터).

## World (world.js)
- 타워 자리: `World.towerSlots(hall)` → `[[x,z],…]` 길이 6 / 10 / 14 / 20(회관 0~3). `sync`: 타워 수 n = 1 + level. n ≤ 자리 수면 그 수만큼 세우고, 넘치면 자리 수만큼 세운 뒤 남은 만큼 **가장 낮은 타워부터 `floor`를 1씩 올린다**. 타워 건물 필드에 `floor`(1 이상) 추가. 층마다 피해 +2, 사거리 +0.3.
- 닭: 마당 자리 20(`World.HOME(i)`, i < 20). 세계 닭 수 = 경제 닭 수(최대 20).
- 울타리: 면 6개 × 겹 3. 건물마다 `side`, `layer`(1~3, 체력 70/140/220). 산 순서는 빈 면 먼저(겹 1), 다 막으면 가장 약한 면부터 덧댐. 부서진 울타리 자동 재건은 지금처럼(**정함: 겹은 그대로 남고 체력은 그 겹의 절반으로 다시 선다**, 아래 참고).
- 나이 손잡이: `World.AGE[age] = {speed, hp, pack}`(7세 0.85/0.8/0.8 … 10세 1.05/1.1/1.1, 초안). `step(w,s)`가 `s.age`로 쓴다. **조정값**: 7세 0.925/0.85/0.85 · 8세 0.975/0.95/0.95 · 9세 1.025/1.05/1.05 · 10세 1.075/1.15/1.15(출현할 때 곱함, 모르는 나이는 1).
- 위협(`threat`)·체력 상한은 상한 20에 맞춰 다시 잡는다(보통 아이 20분 무리 크기는 지금과 비슷, 40분에 상한).
- 사건·필드 계약은 0.8과 같다(늑대·닭·화살·사건 이름). 추가만 한다.
- (규칙 작업이 정함, 2026-11-12 구현)
  - 자리: 0단계 6자리는 0.8 `TOWER_SLOTS` 그대로(슬롯 0~5). **바깥 고리는 3D 대각선 흙길(45°·135°·225°·315°, r 2.6~14)을 비켜 기수 방향**: 1단계 +4 = (8.5, 0.6)·(−8.5, 0)·(0, 8.5)·(0, −8.5)(동쪽은 3단계 시장 상자를 비켜 z +0.6), 2단계 +4 = r 11.5의 0°·180°·90°·270°, 3단계 +6 = r 14.5의 0°·180°·90°·270° + 37.5°·217.5°(대각선 띠 가장자리, 흙길 끝에서 1.3). 모두 늑대 출현 퍼짐(22.5° + 45°k ± 14.3°) 밖, 그 단계 울타리보다 1.4 이상 안쪽, 3D 소품·흙길 가장자리와 1.2 이상. 전체 목록 `World.ALL_SLOTS`(슬롯 번호 = 순서), 고리 자료 `World.RINGS`.
  - 층: **층은 내려가지 않는다.** 회관이 커져 자리가 늘어도 이미 올린 층은 그대로, 새 자리는 다음 타워부터 채운다(그래서 회관 3단계에도 빈 자리가 남을 수 있다). 올릴 타워 = 가장 낮은 층 → 서 있는 것 → 앞 자리. 층 합 = 1 + level(최대 `World.TOWER_UNITS` 20) = `World.towerUnits(w)`. 피해·사거리는 `World.towerDamage(s,b)`·`towerRange(s,b)`. 화살 사건의 `damage`에 층 피해가 들어 있다.
  - 강화 4~10단계: 화살 피해 +`World.POWER_STEP`(1)씩, 세 갈래 그대로(`World.power(s)`는 0~3단계 표, `World.damage(s)`가 4단계부터 더함).
  - 닭 자리 `World.HOMES`(20): 0~7은 0.8 그대로, 8~11은 마당 뒤(+z, 두 흙길 사이), 12·15·18·19는 회관 옆 뜰(−x), 13·14·16·17은 더 뒤. 타워 자리와 1.2 이상, 건물 외곽과 0.9 이상, 3D 작은 소품(깃발·등불·상자·바위) 중심과 1.2 이상, 큰 소품(연못·덤불·천막·둥지) 가장자리와 0.9 이상, 흙길 가장자리와 0.5 이상(닭이 길 위에 서지 않음), 0단계 마을 안. 농부 걷는 구역·PICK 자리와는 섞인다(농부가 닭 사이에서 알을 줍는 설계).
  - 울타리: 산 수 n → 면별 겹 `World.fenceLayers(n)`(앞 면부터 1겹씩, 6면이 차면 다시 앞 면부터). 덧대면 늘어난 체력만큼 hp가 늘고, 부서진 면에 덧대면 바로 새로 선다. **저절로 다시 설 때(15초) 겹은 잃지 않는다**: 그 겹 그대로, 체력은 그 겹 최대의 절반(35/70/110). 체력 표 `World.FENCE_HP`.
  - 경제 도우미(화면·시뮬레이터 공용): `World.marketDown(w)`(매대가 부서졌으면 1 → `s.marketDown`), `World.brokenKinds(w)`(→ `ctx.brokenKinds`), `World.wolvesInside(w)`(→ `ctx.wolvesInside`, 0.8 index.html과 같은 셈), `World.towerUnits(w)`.
  - 0.8 세계 저장(v2)은 형식 그대로 받아 타워 `floor:1`, 울타리 `layer:1`(체력 그대로)을 붙인다.

## 화면 ↔ 3D
- `getVillageState()`에 추가: `farmersTotal`(1 + farmers), `nest`(둥지 남은 알), `marketDown`, `recommend`(지금 빛나는 상품 key 또는 null), `power`, `streak`(있음).
- (화면 작업이 추가, 2026-11-12) **`phase`에 `'reward'`가 생기고 `'pick'`·`'build'`는 없어진다.** reward = 한 번에 맞힌 뒤 판매·동전 연출(약 1.2초, 소리 모드에서 말풍선을 읽으면 그만큼 더). 이때도 늑대 세계는 흐른다. phase 값: `start · listen · ask · reward · learn`.
- (화면 작업이 추가) `getVillageState().running`: 늑대 세계 시계가 흐르는지(`phase!=='start' && !paused`). **3D는 `RUNNING = new Set(['listen','ask','learn'])` 대신 이 값을 쓴다**(0.8 village.js 그대로면 reward 1.2초 동안 3D 늑대만 멈춰 보인다).
- (화면 작업이 추가) `ctx.opened`는 규칙 작업이 정한 대로 **이미 '새 상품' 말풍선(rule 4)을 띄운 key 목록**(배열)이다. 화면이 rule 4 말풍선을 띄울 때 넣는다(저장하지 않음).
- `VillageView.events([{type:'produce', laid, sold, left, gold, eggs, fish, back}])`: 0.8의 `produce`에 `laid/sold/left` 추가(`eggs`는 `sold`와 같은 값으로 남겨 호환).
- `VillageView.marketScreen()` → `{x, y}`(장면 왼쪽 위 기준 0~1 비율) 또는 `null`. 화면 작업이 동전 비행 출발점으로 쓴다(없으면 기존 `FX_HOME`).
- `VillageView.build(key)`는 상점의 모든 key(repair, tower, power, fence, chicken, farmer, pond, hall, feast)에 대해 연출하고 위치를 돌려준다(지금과 같음).
- 3D가 그릴 것: 타워 최대 20 + `floor` 층 쌓기, 닭 최대 20, 농부 최대 10(인스턴스), 울타리 겹(나무 → 두 줄 나무 → 돌담), 회관 단계별 시장(매대 → 가게 → 천막 시장 → 큰 시장), 부서진 건물 위 🔨 깜빡임, `produce`에서 판 알만 농부가 나르고 남은 알은 둥지에 보이기.

## 검사 기준
- `node test-questions.cjs`, `node test-dom.cjs`, `node test.cjs`(전체, `ONLY` 없이) 모두 통과.
- 시뮬레이터: game-plan §4.7 목표표를 8개 나이·모드 × 4유형으로 출력, 찍는 아이 ≤ 보통의 50%이고 느린 아이보다 적게.
