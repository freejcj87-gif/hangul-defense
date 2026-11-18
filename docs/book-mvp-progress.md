# 수첩 MVP 진행 기록 (브랜치 `claude/book-mvp`, worktree `work\claude-book`)

- 명세(정본): `launch\design\02-MVP-구현명세-20261118.md` (변경 기록 2차, 2026-11-18까지 반영)
- 기준: `claude/v0142`(0.14.2, `4fa88c8`) 위. push·PR 없음.
- 이 문서는 다음 담당(화면 연결)이 그대로 따라 할 수 있게 "어느 함수에서 무엇을 부를지"를 적는다.

## 1. 1단계에서 한 것 (2026-11-18)

| 커밋 | 내용 |
|---|---|
| `11eb447` | 콘텐츠 `notes.js`: 몬스터 카드 8종, 이름 쪽지 문항 64, 영어 이름 문항 48 + 검사 `test-book.cjs` A절 |
| `a3440c3` | 기록 모듈 `book.js`(기록 v1, 규칙 순수 함수) + 검사 B절, 배포 목록(`scripts/build-pages.cjs`)에 두 파일 추가 |
| (이 문서) | 진행 기록·연결 지점 |

**고치지 않은 것**: `index.html` · `combat.js` · `world.js` · `src/` · `questions.js` · `questions-gen.js` · `testmode.js` · `test-dom.cjs` · `test-questions.cjs` · `.github/`. 화면에는 아직 아무것도 보이지 않는다(검사 B-15가 `index.html`에 `Book`·`NOTES`가 없음을 확인).

**검사(실제로 돌린 것, 2026-11-18)**

| 명령 | 결과 |
|---|---|
| `node test-book.cjs` | PASS 2,942건(콘텐츠 2,249 · 기록 693) |
| `node test-questions.cjs` | PASS 54,890건 |
| `SOFT=1 node test-dom.cjs` | PASS 12,429건 |
| `node scripts/build-pages.cjs` | 34개 파일 묶음(`book.js`·`notes.js` 포함) |

돌리지 않은 것: `node test.cjs`(브라우저), 실기기, 시뮬(`scripts/sim-flow.cjs book` 명령은 아직 없음).

## 2. 파일과 API

### `book.js` (`window.Book` / `require('./book.js')`)

시계·난수·저장소·통신에 손대지 않는다. 지금 시각 `now`(ms), 저장소(`getItem`/`setItem`/`removeItem`), 문항 조회(`noteOf`, `byId`)는 모두 인자로 받는다.

| 묶음 | 함수 |
|---|---|
| 상수 | `Book.BOOK`(모든 수치·플래그. 검사·시뮬이 덮어씀), `Book.KINDS` 8, `Book.MEDALS` 12, `Book.CELLS` 32 |
| 기록 | `fresh(now, seed)` · `restore(raw, {now, knows})` · `migrate(raw)` · `fromMeta(meta, {now, seed})` |
| 저장소 | `keys({demo, test, off, runKey})` · `open(store, keys, {now, seed, meta, knows})` → `{book, status, locked}` · `save(store, keys, handle)` · `wipeAll(store, keys)` |
| 진행 파일 | `exportFile`/`exportText(book, 판 저장, {now, app})` · `fileName(now)` · `importFile(text, {now, knows, cleanRun})` · `preview(book)` · `swapIn(store, keys, book, 판 저장 글, {now})` · `canUndo` · `undo` · `fnv1a` |
| 판 안 사건 | `answered(b, q, result, {now, age, run, special, finale})` · `volleyKill(b, kind, {now})` · `foxSaved(b, {now})` · `kingWon(b, {now, stars, village, perfect})` · `rushed(b, {now})` |
| 특별 문제 | `nextSpecial(b, {age, index, run, finale, noteOf, byId})` → `{kind:'note'\|'review', key, id, q}` · `shuffle(q, seed)` |
| 반짝 손님 | `shinyChance(b, {run, asked, boost2, kinds, finale, free})` · `shinySpawned` · `shinyMet` · `shinyGone` · `shinyText()` |
| 판의 고비 | `beginSession(b, now)` · `finaleStart(b)` · `newVillage(b, now, {age, used, bank, latest, size})` · `resetVillage(…같음)` · `nextPlay` |
| 이어 순서 | `orderFor(b, age)` → `{seed, off, bank}` · `advanceOrder(b, age, used, {bank, latest, size})` |
| 하루 시간 | `tick(b, now, 초)` · `sleepy(b, now, {finale})` · `extend(b, now, 분)` |
| 화면용 | `page(b, kind)` · `cells(b)` · `friends(b)` · `medals(b)` · `tierOf` · `report(b, now)` · `setOpt(b, key, val, {age})` · `mixOf(b, age)` · `gate(seed)` |

`status`: `new`(새 기록) · `migrated`(판 저장 meta에서 이행) · `ok` · `broken`(깨진 글 → 새 기록으로 계속) · `newer`(앱보다 새 버전 → 메모리 안 빈 기록, `locked`라 `save`가 쓰지 않음) · `memory`(체험·`?book=0`·저장소 못 씀).

### `notes.js` (`window.NOTES`)

`MON[kind] = {name, nick, en, line}` · `ALT`(대체 이름 후보) · `get(age, kind, 1|2)` · `byId(id)` · `all()` · `english(age)`.

## 3. 화면 연결 지점 (다음 단계, 0.15 병합 뒤)

줄 번호는 0.15 병합으로 밀리므로 함수 이름으로 적는다(`index.html` 인라인 스크립트, 0.14.2 기준).

### 3.1 불러오기·저장 (명세 C2)

| 어디 | 무엇을 |
|---|---|
| `<script src>` 줄 | `questions.js` 뒤에 `notes.js`, `book.js` 추가(버전 꼬리표 포함). `test-dom.cjs`는 인라인 스크립트만 뽑아 돌리므로 가짜 창에 `Book`·`NOTES`를 넣어 줘야 한다 |
| `KEY` 정의 바로 뒤 | `const BK = Book.keys({demo: DEMO, test: TEST, off: /[?&]book=0\b/.test(location.search), runKey: KEY})`. `?notes=0`·`?review=0`·`?order=0`·`?shiny=0`·`?medals=0`·`?friends=0`은 `Book.BOOK.FLAGS.*=false`, `?book=0`은 `Book.BOOK.ON=false`도 함께 |
| `state = Combat.restore(…)` 뒤, `state.seed` 정한 뒤 | `bookH = Book.open(localStorage, BK, {now: Date.now(), seed: state.seed, meta: state.meta, knows: id => !!Questions.byId(id) \|\| !!NOTES.byId(id)})`; `book = bookH.book`. `status==='migrated'`이면 판 저장 원본을 `KEY+'-bak'`에 없을 때 한 번 복사(0.12 방식). `status==='newer'`면 보호자 화면에 "새 버전에서 만든 기록이에요. 앱을 업데이트하면 이어져요" |
| `save()` 끝 | `bookDirty && (문제 사이 \|\| 30초 지남 \|\| 강제)`일 때만 `Book.save(localStorage, BK, bookH)`. 풀이 중 1초마다 쓰는 판 저장에 얹지 않는다(쓰기 횟수 검사). 실패(false)면 판 저장과 같은 안내 한 번. 순서는 판 저장 → 기록 |
| 강제 쓰기 | `enterReward`·`enterLearn` 진입, 친구 카드·훈장·반짝 칸을 받은 순간, 쉬기(`#pause`), `visibilitychange`(숨김), `beforeunload`, 엔딩 카드, 보호자 설정 변경 |
| "시작하기/이어서 하기" 단추 | `Book.beginSession(book, Date.now())`(4시간 넘게 쉬었으면 새 놀이) |

### 3.2 문제 흐름 (C5·C6·C8)

| 어디 | 무엇을 |
|---|---|
| `makeRound()` 맨 앞 | `const fin = Combat.finaleNow(state); const sp = Book.nextSpecial(book, {age: state.age, index: state.index, run: state.run.no, finale: !!fin, noteOf: NOTES.get, byId: Questions.byId})`. `sp`가 있으면 `q = sp.q`, `round.special = {kind: sp.kind, key: sp.key, id: sp.id}`. 칩: 쪽지 "📜 이름 쪽지", 복습 "🐺 기억 늑대: 지난번 글이에요". 같은 칸에서 다시 불러도(이어하기) 같은 문제가 나온다(기록의 `pend`) |
| `token()` | 특별 칸이면 `나이:story:X<id>` |
| `choose()` 한 번에 정답 갈래 | `state.index++`는 `!round.special`일 때만. `Combat.track(…, {extra: true})`(combat.js에 추가할 한 줄: 특별 문제는 `run.ok`·`run.miss`에 안 넣음, `API` 5). 그 뒤 `const r = Book.answered(book, q, 'first', {now, age: state.age, run: state.run.no, special: round.special && round.special.kind, finale: !!round.fin})`. `r.friend`면 친구 카드 연출(`round.wait = max(round.wait, 25)`, 효과음 `friend`), 복습이면 문구 끝 " · 🧠 기억했어요!" |
| `choose()` 두 번째 정답 갈래 · `miss()` | `Book.answered(book, q, 'second'\|'miss', 같은 opt)`. `r.lost`면 배우기 화면에 "📜 쪽지가 바람에 날아갔어요. 다음 판에 또 떨어뜨릴 거예요" |
| 한 번에 맞힌 직후(금화 계산 `income` 뒤) | 신바람 2단에 **새로** 오른 순간이면 `Book.rushed(book, {now})`. 이어서 `Book.shinyChance(book, {run: state.run.no, asked: state.run.asked, boost2: 방금 2단이 됨, kinds: World.kindsAt(state.hall).concat(여우가 남았으면 'fox'), finale: !!round.fin, free: state.run.bell===4})`. 결과가 `{win:true}`면 세계가 다음 무리에 손님을 섞고 `Book.shinySpawned(book)`. "당첨" 문구·두근거림 연출 금지 |
| 세계 사건 처리(`e.type==='kill'`) | `e.by==='volley'`이면 `const k = Book.volleyKill(book, e.kind, {now})`. `k.drop`이면 3D `noteDrop` 사건, 띠 알림은 문제 사이(`enterReward`/`enterLearn`)에. world.js에 `a.v`·`v.vh`·`by:'volley'`·`stats.volleyKills` 추가(C3) |
| `foxShoo()` 성공 | `Book.foxSaved(book, {now})` |
| 세계 사건 `shinyMet` | `Book.shinyMet(book, {now})` → 띠 "✨ 반짝 손님이 인사하고 갔어요!"는 문제 사이에 |
| `ringBell()`(결전 시작) | `Book.finaleStart(book)`(남은 손님은 떠나고 다음 기회 확정). 세계의 손님도 치움 |
| `victory()`(`Combat.finish` 뒤) | `Book.kingWon(book, {now, stars: Combat.stars(state), village: state.run.village, perfect: state.run.fq===6 && 결전에서 틀린 적 없음})`. 왕의 쪽지는 다음 평소 문제 칸에서 나온다(결전 중 `nextSpecial`은 null) |
| 새 마을 단추(`Combat.nextRun` 앞) | `const ord = Book.newVillage(book, Date.now(), {age: state.age, used: Questions.used(…), bank: state.bank, latest: Questions.BANK_VERSION, size: Questions.bankCount(state.age, state.bank)})` → `Combat.nextRun(state, {seed: ord.seed, now})`, 새 판의 `state.bank = ord.bank \|\| Questions.BANK_VERSION` |
| `#reset`(마을을 처음부터) | 판 상태만 `Combat.fresh`로 새로 만들고 `Book.resetVillage(book, Date.now(), {위와 같은 opt})`. 기록 열쇠는 지우지 않는다. 단추 글 "마을을 처음부터 (수첩·훈장은 그대로)" |
| 세계가 흐르는 틱 | 10틱마다 `Book.tick(book, Date.now(), 1)`. `newRound` 직전·배우기에서 초록 답을 누른 직후 `Book.sleepy(book, Date.now(), {finale: 결전 중})`이면 "🌙 꼬꼬가 졸려요" 화면. "15분 더"는 문턱을 거쳐 `Book.extend` |
| 더 놀기(`run.bell===4`) | `getVillageState().friends = Book.friends(book)` |

### 3.3 판 밖 화면 (C9·C10·C13·C16)

- 수첩: `Book.page(book, kind)` + `NOTES.MON[kind]`(종 이름·개인 이름·영어 이름·한 줄 소개), 표지 `Book.cells(book)` / `Book.CELLS`, 뒤표지 `Book.medals(book)`(`hidden`은 진열에서 뺌). 카드 이야기는 친구가 된 쪽지의 `card`(`NOTES.get(나이, kind, book.mon[kind].nv+1).card`).
- 보호자 문턱: `Book.BOOK.GATE`(2초 길게 누르기 `hold` 20틱 → `Book.gate(씨앗)`의 `text`를 보여 주고 `digits`를 입력받음, `tries` 3번 틀리면 `wait` 300틱, `idle` 1,800틱 뒤 다시 잠김). 씨앗은 화면이 준다(`Math.random`은 화면에서).
- 기록 탭: `Book.report(book, Date.now())`(이번 주·전체·분류별 [푼 수, 한 번에 맞힌 수]·자주 놓친 글 id). 글 본문은 `Questions.byId`로. "읽기 단계 제안" 한 줄은 `state.pace`가 필요해 화면 쪽에서 만든다(아직 없음).
- 설정 탭: `Book.setOpt(book, 'en'|'day'|'sfx', 값, {age})` → 영어는 `Questions.setMix(Book.mixOf(book, state.age))`(questions.js에 `setMix` 추가 필요).
- 도움말 탭: `Book.shinyText()`를 그대로 넣는다(숫자를 글로 따로 적지 않는다).
- 진행 파일: 내보내기 `Book.exportText(book, {...state, version: Combat.SAVE_VERSION}, {now, app})` + `Book.fileName(now)`. 불러오기 `Book.importFile(text, {now, knows, cleanRun: r => Combat.restore(r, AGES)})` → `error`가 `size`·`format`이면 "진행 파일이 아니에요", `newer`면 업데이트 안내, `sumOk===false`면 "파일이 바뀌었거나 손상됐을 수 있어요. 그래도 불러올까요?" → 미리보기(`preview` vs `Book.preview(book)`) → `Book.swapIn(localStorage, BK, r.book, JSON.stringify({...r.run, version: 3}), {now})` → 상태 교체 + `freshWorld()`. 되돌리기 단추는 `Book.canUndo`일 때만, `Book.undo` 뒤 같은 방식으로 다시 불러온다.
- 모든 기록 지우기(보호자 화면에서만, 재확인): `Book.wipeAll(localStorage, BK)`.

### 3.4 다른 파일에 필요한 것

| 파일 | 할 일 |
|---|---|
| `questions.js` | `byId(id)` · `used(age, index, seed, bank)`(번호 0~index−1에서 묶음별로 쓴 수) · 순번을 미는 인자 `off` · `setMix`. **bank-expand(0.14.3)와 맞춤**: 그쪽은 `at(age, mode, index, seed, bank)`라 명세 §3.7의 "다섯째 인자 off"와 자리가 겹친다 → `at(…, seed, bank, off)`처럼 여섯째로 두는 안을 권한다. 묶음 크기는 그쪽의 `Questions.bankCount(age, bank)`가 `{story, common, math, english}`로 주므로 `advanceOrder`의 `size`에 그대로 넣으면 된다 |
| `questions-gen.js` | 영어 이름 문항 48개(`NOTES.english(나이)`)를 `scripts/bank-add.cjs`(bank-expand)로 생성 구간 뒤에 붙이고 새 판(edition)으로 올림. 손 문항 목록에 끼우면 진행 중인 판의 순서가 바뀐다 |
| `test-questions.cjs` | `SAFE_PIC`에 🐺·👑·🐗·🌿 추가(실기기 표시를 사람이 확인한 뒤). 7세 영어 이름 문항이 쓴다 |
| `combat.js` | `track`의 `opt.extra`, `API` 5 |
| `world.js` | §2.6 선택 칸(화살 `v`, 늑대 `vh`·`shiny`·`sign`, 사건 `by`·`shinyMet`·`shinyGone`). 변경 기록 2차: 손님은 머무는 시간 제한 없음, `shinyGone`은 결전 시작·새 마을 때만 |
| `.github/workflows/*.yml` | `node test-book.cjs`를 검사 줄에 추가 |
| `test-dom.cjs` | 기존 절은 `Book.BOOK.ON=false`로 돌려 회귀를 지키고, 끝에 "MVP 수첩" 절(명세 §6.2) |

## 4. 명세와 달라진 점

| # | 명세 | 구현 | 까닭 |
|---|---|---|---|
| 1 | 영어 이름 문항 48개를 평소 영어 묶음(`questions.js`)에 넣음 | `notes.js`에 id 없이 두고 검사만 함 | 문제은행 판(edition) 규칙상 새 문항은 생성 구간 뒤에 붙여야 하고(bank-expand 진행 중), 묶음 크기가 바뀌면 출제 순서가 통째로 바뀜. 연결 단계에서 `bank-add.cjs`로 붙임 |
| 2 | 서리 늑대 영어 이름 Snow Wolf | **Frost Wolf** | 조정자 검수 메모(한글 이름의 뜻과 어긋나지 않게). 이름 낱말 8개도 snow → frost. 불씨 왕은 Fire King 유지 + 후보 Ember King(`NOTES.ALT`) |
| 3 | 기록 칸 | `cur`(이번 놀이 셈: 놀이 요약 `log`의 원본) · `vil`(마을별 승리 수: 훈장 `map`의 바퀴 계산) · `order.bank`(나이별 문제은행 판) · `rvPlay.lastQ`(특별 문제 간격) 추가, `day[날짜]`에 넷째 값(처음 맞힌 새 글) | 명세 형식만으로는 놀이 요약·네 마을 바퀴·"이번 주 새 글"·특별 문제 사이 3문제를 셀 수 없음. 기록 버전은 1 그대로(배포 전) |
| 4 | `-bak`에 기록·판 저장을 각각 복사 | 열쇠 `hangul-defense-book-bak` 하나에 `{at, book, run}` 글 두 벌 | 판 저장의 `-bak`(`hangul-defense-v1-bak`)은 0.12부터 "버전 이행 전 원본"이 쓰고 있어 덮어쓰면 그 용도가 깨짐 |
| 5 | 복습 재출제 시점 `pq + 5~10(난수)` | 문항 id와 `pq`의 해시로 5~10(결정적) | 기록의 난수(`rng`)는 반짝 손님 전용으로 두어 검사가 고정하기 쉽게 |
| 6 | 복습 보기 `q.lap = seen+1`로 순서를 돌림 | `Book.shuffle`(id와 나온 횟수로 섞음), `q.lap = 나온 횟수` | 0.14.2부터 보기 순서는 `at()`가 (나이, 씨앗, 번호)로 섞고 lap 돌리기는 없어짐. 쪽지 문항은 콘텐츠의 보기 순서 그대로 |
| 7 | 왕의 쪽지 자격 "놀이 2번" | 왕은 `{plays:1, kills:1}`(첫 승리로 자격, 두 번째 승리 때 떨어뜨림) | 표의 "두 번째 승리 때 떨어뜨림"을 "자격 뒤 다음 처치에 떨어뜨림" 규칙에 맞춘 값 |
| 8 | 한 놀이 쪽지 상한에 걸린 쪽지 | 떨어뜨리지 않고 다음 놀이로 미룸(자격 유지) | 띠로 "쪽지를 떨어뜨렸어요"를 알리고 그 놀이에 못 읽는 일을 피함 |
| 9 | 칸 2 "처음 20문제 안에 내도록 우선" | 따로 없음(칸 낮은 것 → 이른 것 순서로 3문제 뒤부터 나옴) | 순서 규칙만으로 놀이 초반에 나옴. 시뮬 S4·S10에서 모자라면 더함 |
| 10 | 풀기 전 나이를 바꾼 쪽지 | 그 나이의 쪽지 문항으로 바뀜 | 다른 나이 글을 내지 않게 |
| 11 | 보호자 화면 "읽기 단계 제안" | 없음 | `state.pace`(판 저장)가 필요해 화면 연결 때 |
| 12 | 7세 영어 이름 8문항 모두 그림 고르기 | `rock`만 뜻 고르기(바위·나무·바다) | 바위를 뜻이 하나로 읽히는 유니코드 9.0 이하 그림이 없음. `bush`는 🌿(검수 필요) |

## 5. 가정으로 남긴 수치 (연결 단계 시뮬로 잴 것)

- `Book.BOOK`의 모든 수(쪽지 자격·`NOTE.cap` 2·`gap` 10·`after` 5, `REVIEW.share` 0.2, 훈장 문턱, `SHINY.p` 0.25·`firsts` 25, `DAY_DEFAULT` 30)는 명세의 [가정] 초안 그대로다.
- **쪽지·복습 문제가 한 판 30분·금화에 주는 영향은 재지 않았다.** 특별 문제는 화면이 문제 번호를 넘기지 않고 끼워 넣을 때 비로소 판 길이에 영향을 주므로, `scripts/sim-flow.cjs book` 명령(C18)을 만든 뒤 명세 §3.8의 S1~S12를 잰다. 이번 검사가 확인한 것은 규칙 단위뿐이다: 복습 ≤ 20%·같은 글 3번·특별 사이 3문제(S4 일부), 방치·틀리기만 진행 0(S5의 규칙 쪽), 세 번째 확정·첫 기회 25% ± 1%p(S8), 많이 논 기록 80KB 이하(S11은 6판 고정본 기준이라 90판 시뮬로 다시).
- 수집 속도(S7: 카드 8장 7~12판 등), 찍기 아이(S6), 영어 비율(S12)은 미측정.

## 6. 콘텐츠 검수에 넘길 것

- 쪽지 64문항·카드 한 줄·한 줄 소개는 초안이다. 기존 검사 규칙(나이 수준·맞춤법·조사·금지 낱말·정답 자리)은 통과했지만 사람이 읽고 확정해야 한다. 7세 낱말 "고기"(우두), 설정 "호야의 꼬리 끝 불씨"처럼 새로 지은 내용 포함.
- 개인 이름 "두부"·"우두"는 사전 뜻이 있어 후보를 두었다(`NOTES.ALT`): 두부 → 무무·도토, 우두 → 하루·가비. 바꾸면 `MON`·쪽지 지문·카드 문구를 함께 고친다. 상표 검색은 사람이.
- 새 그림 문자 🐺·👑·🐗·🌿는 실기기(Android·iOS·Windows) 표시 확인 전이다.
- 10세 영어 이름 문항은 "Fire King = 불의 왕"으로 풀이한다(게임 이름은 불씨 왕).

## 7. 다음 단계 작업 목록 (0.15 병합 뒤, 명세 §6.1 번호)

1. 브랜치를 0.15 병합본·0.14.3(bank-expand) 위로 옮김(이 브랜치는 새 파일뿐이라 충돌은 `scripts/build-pages.cjs` 한 줄).
2. C2 저장 연결(§3.1) + `test-dom.cjs` "MVP 수첩" 절 뼈대(기존 절은 `BOOK.ON=false`).
3. C3 `world.js` 처치 출처(`by:'volley'`).
4. C4 이어 순서: `Questions.at(…, bank, off)`·`used`·`byId`, 부르는 곳 전부(`waveInterval`·`makeRound`·`flowCorrect`·`ringBell`·`testmode.js`·시뮬).
5. C5 특별 문제 틀(§3.2) + `Combat.track` `extra`.
6. C6·C8 기억 늑대 칩, 쪽지 떨어뜨림·쪽지 문제·친구 카드 연출·리본.
7. C10·C11 훈장 셈 연결, 반짝 손님 세계 쪽(손님 출현·일제 사격 1순위·`shinyMet`).
8. C9·C13·C15·C16 수첩 화면, 보호자 화면(문턱·기록·설정·도움말·진행 파일·모든 기록 지우기), 하루 시간 화면.
9. C14 영어 이름 문항을 문제은행 새 판으로 붙이고 `setMix`.
10. C12·C17 친구 방문, 카드 그림 렌더(브라우저 작업은 리드가 한 번에 하나).
11. C18 시뮬 `book` 명령으로 §3.8 통과선 측정 → 상수 조정 → 기획서 새 절.
