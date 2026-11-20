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

---

## 8. 2단계: 화면 연결 (2026-11-19)

기반: 0.15(로컬 브랜치 `claude/v015-river` `5425e3a`)를 합친 위. 원격에는 아직 `origin/claude/v015-river`가 없어(main은 0.14.2) 같은 저장소의 로컬 브랜치를 합쳤다. 문제은행 확장(`claude/bank-expand`)은 아직 합치지 않았다(리드 연락 대기).

### 8.1 커밋

| 커밋 | 내용 |
|---|---|
| `1f58e45` | 0.15 합침(충돌은 `scripts/build-pages.cjs` 한 곳) |
| `7136562` | 화면 연결: 저장·특별 문제·처치 출처·훈장·반짝 손님·수첩 화면·보호자 화면·하루 시간 |
| `b0d5a80` | 시뮬 `book` 명령·상수 조정, 3D 손님·연출, `test.cjs` book 구간, CI에 `test-book` |
| `ea907dc` | 웹판 바닥글을 저장 위치 기준 문장으로 |

### 8.2 무엇이 어디에 연결됐나

| 파일 | 연결한 것 |
|---|---|
| `index.html` | `notes.js`·`book.js`(인라인 스크립트 앞)·`bookui.js`(뒤) 불러오기. `BOOK_ON`(주소 `?book=0`이면 끔)·`BK`(열쇠)·`bookOpen()`·`bookSave()`(문제 사이·30초·강제). `makeRound`에 `Book.nextSpecial`, `token()`의 `X<id>`, `choose`·`miss`의 `bookFirst`·`bookOther`, `worldStep`의 `by:'volley'`·`shinyMet`, `foxShoo`·`ringBell`·`victory`·새 마을·`#reset`, `nextQuestion()`(하루 시간), `later()`·`flushLater()`(읽는 중에는 띠를 모아 둠), `friendCard()`, `syncGuest()`, `reloadFromStore()` |
| `bookui.js`(새) | 발자국 수첩 화면, 보호자 문턱(2초 길게 누르기 + 글로 적힌 세 자리 수, 3번 틀리면 30초, 3분 뒤 닫힘), 보호자 탭 4개(기록·설정·진행 파일·도움말), 쉬기 화면 "15분 더", 엔딩 카드 요약·"오늘은 그만하기", 시작 화면 "보호자 안내"(개인정보처리방침 본문) |
| `world.js` | 화살 `v`, 늑대 `vh`, `kill` 사건 `by:'volley'`, `stats.volleyKills`, 반짝 손님 `w.guest`(`World.guest`·`guestGreet`·`guestGone`, 사건 `shinyMet`·`shinyGone`). 세계 판(`V`) 2 그대로, 난수를 더 쓰지 않음 |
| `combat.js` | `track`의 `opt.extra`, `API` 5 |
| `src/village.js` | 손님을 늑대 무리 틀로 그림(색은 그대로, 금빛 반짝이가 따라다님), `shinyMet`·`guest`·`friend`·`noteDrop` 반짝이 |
| `notes.js` | `PRIVACY`(개인정보처리방침 본문, 개발자 이름·이메일·시행일은 `[ ]` 자리표시) |

수첩을 끄면(`?book=0`, 또는 `book.js`가 없으면) 0.15와 같은 화면·규칙이다. `test-dom.cjs`의 기존 절은 모두 수첩 없이 돌고, 수첩은 맨 끝 "MVP 수첩" 절이 본다.

### 8.3 검사 (실제로 돌린 것, 2026-11-19)

| 명령 | 결과 |
|---|---|
| `node test-book.cjs` | PASS 2,947건(콘텐츠 2,249 · 기록 698) |
| `SOFT=1 node test-dom.cjs` | PASS 12,989건(수첩 절 +191) |
| `node test-questions.cjs` | PASS 54,890건 |
| `node scripts/build-pages.cjs` | 43개 파일 묶음(esbuild로 `src/village.js` 묶기 포함) |
| `node --check test.cjs` | 문법만 확인 |

- **돌리지 않은 것**: `node test.cjs`(브라우저. 새 `book` 구간 포함, 실행은 CI), 실기기, 3D 화면 눈 확인(손님·반짝이·친구 카드·수첩·보호자 화면 배치).
- `test-dom.cjs`의 "그림 화면이면 그림 화면과 단계"(테스트 모드 성능 표시) 검사는 PC가 바쁠 때 가끔 떨어진다(fps 글자가 두 번 읽는 사이에 바뀜). 수첩과 무관하고 0.15에도 있는 검사다. 다시 돌리면 통과한다.
- `test.cjs`의 기존 구간은 `book.js`를 받지 않는다(검사 서버가 주소에 `book=1`이 있을 때만 줌) = 수첩 없는 0.15 회귀. 수첩을 켠 화면은 `ONLY=book` 구간이 `/?book=1`로 본다.

### 8.4 시뮬 통과선 (`node scripts/sim-flow.cjs book`, 명세 §3.8)

실행: `book 12 7,8,9,10 (7종 아이) '{"runs":4}'`(나이·아이마다 12판 × 4줄, 수첩 켬·끔을 같은 씨앗으로) + `book 40 8,10 typ,slow '{"runs":2}'`. 아이 모형은 가정값이다(실제 아이 측정이 아님, 복습 글 정답률 = 그 아이 −0.15). 같은 조건에서 복습만 끈 줄로 본 잡음은 분당 금화 ±1~2%p다.

**상수 조정**: 처음 값(`REVIEW.share` 0.2 · `NOTE.cap` 2)으로는 엔딩까지 문제 +1.4~4.6%, 분당 금화 −5~−6%, 카드 8장 6판이라 통과선을 넘었다. → `REVIEW.share` **0.1**, `NOTE.cap` **1**로 낮춤(금화·가격·문턱 상수는 그대로).

| # | 지표 | 통과선 | 결과(조정 뒤) | 판정 |
|---|---|---|---|---|
| S1 | 엔딩까지 문제 수(켬 ÷ 끔, 평균) | +3% 이내 | 보통 98.5~102.6% · 느린 99.9~103.5% · 빠른 101.0~102.5% | 통과(7세 느린 +3.5%만 경계 밖) |
| S2 | 엔딩까지 분 | +3% 이내, 보통 아이 30분 안쪽 | 보통 7세 12.3 · 8세 28.9 · 9세 27.9 · 10세 28.0분(98.0~102.8%). 느린·빠른 일부 +3.3~4.0% | 보통 통과. 느린 아이는 수첩과 무관하게 0.15에서도 48~55분 |
| S3 | 분당 금화 | ±2% | 보통 12판 96.8~101.9%, 40판 93.8~95.1% · 느린 94.7~99.0% · 빠른 95.3~98.3% | **미달**(−2~−6%). 복습 글 정답률 가정에 좌우됨. 더 줄이려면 `REVIEW.share` 0.07 |
| S4 | 판당 특별 문제 | 복습 ≤ 20%, 쪽지 ≤ 2, 사이 ≥ 3, 같은 글 ≤ 3 | 복습 최대 9.9% · 쪽지 최대 1 · 사이 최소 3 · 같은 글 최대 3 | 통과 |
| S5 | 방치·방치(상점만)·틀리기만 30분 | 진행 0 | 발자국·카드·훈장·반짝 모두 0 | 통과 |
| S6 | 찍기 아이 수첩 칸 | 보통의 50% 이하, 느린 아이보다 적음 | 찍기 ÷ 보통 = 62~72%(느린 아이보다는 적음) | **미달**. 찍기 아이는 한 판에 문제를 250개쯤 풀어(보통 50~83개) 한 번에 맞힌 수가 보통 아이와 비슷해짐. 발자국 8·반짝 5(누적 25개 경로)·카드 3~4 |
| S7 | 수집 속도(하루 한 판 가정) | 첫 판 발자국 5~8 · 훈장 동 2~4 / 카드 8장 7~12판 / 리본 8개 15~30판 / 반짝 4~8개 20~40판 / 32칸 40~90판 | 첫 판 발자국 6.5~8.0 · 훈장 동 4.0~8.3 / 카드 8장 10~14판(10세 느린 19) / 리본 8개 15~22판 / 반짝 20판에 8개 / 32칸 16~22판 | 카드·리본 통과. **훈장 동·반짝·32칸은 목표보다 빠름**(32칸이 목표의 절반 이하) |
| S8 | 반짝 보장 | 3번 안에 반드시, 첫 기회 25% ± 1%p | 이어진 꽝 최대 2번 · 첫 기회 25.38%(10만 번) | 통과 |
| S9 | 같은 글 반복 | 바퀴 안 중복 0 | 미측정(이어 순서는 문제은행 판 합친 뒤) | - |
| S10 | 복습 대기열 | 크기 ≤ 200, 졸업 > 0 | 보통·느린 최대 101, 졸업 40판에 128~213개. 찍기·틀리기만은 200 상한에 닿음 | 통과 |
| S11 | 기록 크기 | ≤ 80KB | 40판 11.8~15.7KB, 찍기 12판 21.1KB | 통과(90판은 미측정) |
| S12 | 영어 비율 | 설정별 | 미측정(`setMix`는 문제은행 판 합친 뒤) | - |

**프로듀서·기획에 넘길 판단**(상수로만 풀리지 않는 것)
- S6: "정답 화살을 맞은 뒤 쓰러짐" 기준과 누적 25개 경로가 찍기 아이에게도 열려 있다. 후보: ① `SHINY.firsts` 0(연속 경로만) ② 발자국·반짝은 그대로 두고 카드(쪽지 읽기)만 수집의 중심으로 봄(찍기 아이 카드는 12판에 3~4장).
- S7: 리본 "3판 더"와 판당 기회 1번 구조에서는 32칸이 16~22판에 찬다. 목표(40~90판)에 맞추려면 리본 놀이 수(3 → 6~8)나 `SHINY.p`(0.25 → 0.12쯤)를 바꿔야 하는데, 화면 문구("세 번 더", "25%")가 함께 바뀌므로 결정이 필요하다.

### 8.5 명세와 달라진 점 (2단계에서 더한 것, §4에 이어서)

| # | 명세 | 구현 | 까닭 |
|---|---|---|---|
| 13 | `REVIEW.share` 0.2, `NOTE.cap` 2 | **0.1**, **1** | 시뮬(§8.4). 명세 §7.1 위험 2의 대응 그대로 |
| 14 | 반짝 손님은 다음 무리에 섞여 나옴, 여우가 뽑히면 다음 여우가 반짝 여우 | 당첨된 순간 숲에서 걸어 나와 울타리 밖을 돎(`w.guest`, 늑대 목록과 별개) | 무리·여우 출현 규칙과 난수를 건드리지 않게(세계 결과가 손님과 무관하게 같음, 검사로 고정). 일제 사격의 화살을 빼앗지 않고 황금 화살 한 발이 따로 나감 |
| 15 | 손님의 3D 색(반짝 모습) | 색은 평소와 같고 금빛 반짝이만 | 인스턴스별 재질 색은 카드 렌더(C17)와 함께 |
| 16 | 수첩 8쪽을 좌우로 넘김 | 한 화면에 8칸 격자 | 패드·노트북에서 한눈에. 넘기기는 카드 그림이 생긴 뒤 |
| 17 | 카드 그림(3D 렌더 PNG) | 그림 문자(🐺 등) 자리표시 | C17(브라우저 렌더)은 리드 몫 |
| 18 | 쉬기 중 수첩 단추, 설정 서랍의 보호자 단추 | 있음. 보호자 화면을 판 중에 열면 저절로 "잠깐 쉬기" | 세계가 멈춘 때만 열리게 |
| 19 | 처음 실행한 시작 화면에 하루 시간 안내 한 번 | 시작 화면에 늘 한 줄("하루 30분 놀면 꼬꼬가 쉬어요. 보호자 화면에서 바꿀 수 있어요.") | "한 번 봤음"을 적을 칸이 기록에 없음. 한 줄이라 늘 보여도 됨 |
| 20 | 진행 파일 바꾸기 뒤 상태 교체 | 저장소에서 다시 읽어 시작 화면으로(`reloadFromStore`) | 불러오기·되돌리기·모든 기록 지우기가 한 길 |
| 21 | 엔딩 카드 "이번 판" 요약 | 화면 기억(새로고침하면 그 판 요약은 비어 보임) | 판 저장을 바꾸지 않으려고 |
| 22 | 영어 비중 설정 | `Questions.setMix`가 있을 때만 보임(지금은 숨김) | 문제은행 판을 합친 뒤 연결(C14) |
| 23 | 개인정보처리방침 본문 | `policy\03` §2에서 웹 주소·GitHub Pages 문단을 뺀 앱용 본문 | 출시 총괄 권고(바깥 링크 없음). 주소는 글로도 적지 않음 |
| 24 | 3D 쪽지 종이·기억 늑대 팻말·친구 방문 | 반짝이 연출만, 친구는 엔딩 카드 글과 `getVillageState().friends` 목록까지 | 명세 §6.1의 "미뤄도 되는 것" 순서(① 친구 3D 방문 ② 팻말) |

### 8.6 프로듀서 확인 대기 (상수 그대로)

- 하루 시간 기본값 **30분** (`Book.BOOK.DAY_DEFAULT`). "없음"을 원하면 0.
- 반짝 손님 누적 경로 **25개** (`Book.BOOK.SHINY.firsts`). 연속 경로만 원하면 0. 시뮬에서 찍기 아이가 이 경로로 손님을 만난다(§8.4 S6).

### 8.7 남은 작업

1. **문제은행 판 합친 뒤**: 이어 순서(`Questions.at(…, bank, off)`·`used`·`byId`, `Book.orderFor`·`newVillage`의 `used`·`bank`), 영어 이름 문항 48개를 새 판으로 붙이기(`scripts/bank-add.cjs`), `Questions.setMix`, `SAFE_PIC`에 🐺·👑·🐗·🌿. 지금은 새 마을마다 새 씨앗(0.15와 같음)이고 `qById`는 `Questions.snapshot()`으로 만든 표를 쓴다.
2. 카드 그림 렌더(C17)·손님 색·3D 쪽지 종이·팻말·친구 방문(C12).
3. 시험 모드(`testmode.js`) 단추: 쪽지 자격 주기·반짝 기회·놀이 +1·기록 비우기.
4. 앱 포장: `window.Capacitor`일 때 진행 파일 공유 시트·Preferences 이중 기록, 바닥글 "이 기기에"(android 역할).
5. 기획서(`docs/game-plan.md`) 새 절과 `HANDOVER.md` 갱신, 버전 문자열(리드가 병합 때).
6. 콘텐츠 검수(쪽지 64·카드 문구·개인 이름), 개인정보처리방침 자리표시 채우기.

---

## 9. 3단계: 문제은행 합침 · 프로듀서 결정 · 분당 금화 (2026-11-19)

기반: 0.15.1(문제은행 확장, `claude/bank-expand` `d3547fc` = 원격 머리)을 합친 위. 이 저장소의 원격 설정은 main만 받아 와서 `origin/claude/bank-expand`가 없고, 같은 커밋인 로컬 브랜치를 합쳤다.

### 9.1 프로듀서 결정 (2026-11-19) → 결정됨

| 결정 | 반영 |
|---|---|
| ① 수첩 32칸은 지금 속도(시뮬 16~22판, 약 3주) 유지. 리본 "세 번 더"·25% 그대로 | 상수 그대로. S7 목표를 그 범위로 고쳐 적음(§9.4) |
| ② 반짝 손님은 연속 정답 때만 | `SHINY.firsts` **0**(누적 경로 끔). 공개 문구는 상수에서 만들어 "…신바람이 되면 25% 확률로 와요"만 남음 |
| ③ 하루 시간 기본 30분 | `DAY_DEFAULT` 30 확정(확인 대기 아님) |

### 9.2 커밋

| 커밋 | 내용 |
|---|---|
| `db36f66` | 0.15.1 합침(충돌: `index.html` 5곳 · `scripts/sim-flow.cjs` 1곳. 바닥글은 그쪽 `#saveNote` 문장으로 통일, 버전은 `#appVersion`에서 읽음) |
| `6fa4d0c` | 이어 순서(`Questions.at(…, bank, off)`·`used`·`byId`), 영어 이름 48문항을 은행 판 3으로, `setMix`와 보호자 설정 "영어 문제", 결정 ②③, 기억 늑대 고르는 순서, 테스트 모드 📒 단추, 시뮬 S9·S12 |
| `32e77df` | 기억 늑대 문제는 놓쳐도 연속을 끊지 않음, 복습 상한 0.1 → 0.07 |
| (이 커밋) | 캡처 도구 `scripts/book-shots.cjs`, 기획서 §17, HANDOVER, 이 절 |

### 9.3 이어 순서가 도는 방식

- 문제은행: `Questions.at(age, mode, index, seed, bank, off)`. `off = {story, common, math, english}`만큼 묶음 순번을 민다. 없으면 출제가 한 글자도 같다(검사 B-16). `Questions.used(age, index, seed, bank)` = 그 판이 묶음별로 쓴 수, `Questions.bankCount(age, bank)` = 묶음 크기.
- 화면: `ordOff()`가 `Book.orderFor(book, 나이).off`를 모든 `Questions.at` 호출(`waveInterval`·`makeRound`·정답 직후 다음 박·`ringBell`)에 넘긴다. 판의 씨앗이 기록의 씨앗과 다르면(이어 순서를 켜기 전에 시작한 판) 밀지 않는다.
- 판이 끝날 때(새 마을·마을을 처음부터): `Book.newVillage`/`resetVillage`에 `ordDone()`(쓴 수·그 판의 은행 판·최신 판·묶음 크기)을 넘기고, 돌려받은 `{seed, bank}`로 새 판을 만든다. **문제은행 판은 읽기 묶음 한 바퀴가 끝난 곳에서만 최신으로 올린다**(올릴 때 순번은 0부터). 그 전에는 예전 판의 문항·순서 그대로 이어 간다.
- 기억 늑대의 문항 조회는 `Questions.byId`. 영어 비중은 `applyMix()`가 `Questions.setMix(나이, Book.mixOf(book, 나이))`로 넘긴다(수첩이 꺼져 있으면 처음 값). "조금 더"는 9세부터.

### 9.4 시뮬 통과선 (§8.4를 대신함)

실행(2026-11-19, 최종 상수): `book 12 7,8,9,10 (7종 아이) '{"runs":4}'` · `book 30 8,10 typ,slow '{"runs":2}'` · 영어 설정 `'{"en":"more"}'`·`'{"en":"off"}'` · 복습만 끈 줄 `'{"runs":8,"BOOK":{"FLAGS":{"review":false}}}'`. 수첩 켬·끔을 같은 씨앗으로 견준다. 아이 모형은 가정값(실제 아이 측정 아님, 복습 글 정답률 = 그 아이 −0.15). 잡음은 분당 금화 ±1~2%p.

| # | 지표 | 통과선 | 결과 | 판정 |
|---|---|---|---|---|
| S1 | 엔딩까지 문제 수(켬 ÷ 끔, 평균) | +3% 이내 | 보통 99.3~102.2% · 느린 99.1~101.2% · 빠른 98.0~101.7% | 통과 |
| S2 | 한 판 길이 | 보통 아이 30분 안쪽 | 보통 7세 14.8 · 8세 28.1 · 9세 29.3 · 10세 29.6분 | 통과(10세는 30분 선에 가까움) |
| S3 | 분당 금화(특별 문제의 영향: 같은 조건에서 복습만 끈 줄 대비) | ±2% | 7세 +1.1% · 8세 −1.3% · 9세 −1.2% · 10세 −1.7%(8줄 평균) | 통과 |
| S4 | 판당 특별 문제 | 복습 ≤ 20%, 쪽지 ≤ 2, 사이 ≥ 3, 같은 글 ≤ 3 | 복습 최대 6.9% · 쪽지 최대 1 · 사이 최소 3 · 같은 글 최대 2 | 통과 |
| S5 | 방치·방치(상점만)·틀리기만 30분 | 진행 0 | 발자국·카드·훈장·반짝 모두 0 | 통과 |
| S6 | 찍기 아이 수첩 칸(12판) | 보통의 50% 이하, 느린 아이보다 적음 | 찍기 ÷ 보통 = 7세 53% · 8세 49% · 9세 48% · 10세 43%. 찍기 아이 반짝 0~0.8개(누적 경로를 끈 효과, 전에는 5.3개) | 8~10세 통과, 7세는 경계(53%) |
| S7 | 수집 속도(하루 한 판 가정). **프로듀서 결정으로 32칸 목표를 지금 속도(16~22판)로 고침** | 첫 판 발자국 5~8 / 카드 8장 7~12판 / 리본 8개 15~30판 / 32칸 16~22판 | 첫 판 발자국 7.0~8.0 · 훈장 동 5.0~8.5 / 카드 8장 10~14판(느린 아이 18~19) / 리본 8개 15~17판(느린 22~29) / 32칸 보통 16~26판, 느린 24~29판 / 반짝 20판에 6.5~8개 | 보통 아이는 범위 안팎(10세 26판), 느린 아이는 더 걸림 |
| S8 | 반짝 보장 | 3번 안에 반드시, 첫 기회 25% ± 1%p | 이어진 꽝 최대 2번 · 첫 기회 25.38%(10만 번) | 통과 |
| S9 | 같은 글 반복 | 바퀴 안 중복 0 | 이어 순서 켬 0건(끔은 12판에 200~456건) | 통과 |
| S10 | 복습 대기열 | 크기 ≤ 200, 졸업 > 0 | 보통 12판 최대 110 · 30판 199, 느린·찍기는 200 상한. 졸업 12판 3~23개 · 30판 19~56개 | 통과(느린 아이는 상한에 닿아 오래된 글부터 빠짐) |
| S11 | 기록 크기 | ≤ 80KB | 12판 11~24KB, 30판 25~28KB | 통과(90판 미측정) |
| S12 | 영어 비율(평소 칸 가운데) | 조금 더 9세 7.5~10.5% · 10세 10.5~15%(±1%p), 끄기 0 | 조금 더 9세 8.3% · 10세 10.4% / 끄기 0.0% / 보통 9세 5.7% · 10세 7.2% | 통과 |

**이어 순서로 생기는 변화(유지가 기본, 통과선에서 뺌)**: S2·S3은 "수첩 끔 대비"가 아니라 "특별 문제의 영향"과 "보통 아이 30분 안쪽"으로 본다(2026-11-19). 쉬운 앞쪽 문항만 되풀이하던 것이 뒤쪽 문항으로 넘어가며 생기는 변화는 따로 적는다. 수첩을 끈 0.15는 판마다 새 씨앗으로 0번부터 내서 그 나이의 쉬운 앞쪽 문항(바퀴 안 순서가 쉬운 것 먼저)만 되풀이한다(12판에 같은 글 200~456번). 이어 순서를 켜면 같은 글이 한 바퀴 안에 다시 나오지 않는 대신 판이 거듭될수록 뒤쪽(더 길고 어려운) 문항으로 가서, 복습을 끈 줄로만 봐도 한 판이 7세 12.0 → 14.5분(+19.5%), 9세 +4.9%, 10세 +5.3% 길어지고 분당 금화가 7세 −19.7%, 9세 −4.7%, 10세 −5.3% 줄어든다(8세는 차이 없음). 금화·가격은 그대로이고 문제 수도 같다(읽는 시간이 늘어난 것). 10세 보통 아이는 29.6분으로 30분 선에 닿는다. 이어 순서만 끄려면 `?order=0`(`Book.BOOK.FLAGS.order`).

**분당 금화를 맞춘 순서**: ① 복습 상한 0.1(2단계): 복습 끈 줄 대비 −1.4~−5.6% ② 복습 문제는 놓쳐도 연속(신바람)을 끊지 않게(`Combat.settle`의 `keepStreak`): +0.5~−3.2% ③ 상한 0.07: −1.2~−1.7%. 복습은 판당 2.4~5.1문제가 된다(0.1일 때 3.6~7.1).

### 9.5 검사 (실제로 돌린 것, 2026-11-19)

| 명령 | 결과 |
|---|---|
| `node test-book.cjs` | PASS 3,178건(콘텐츠 2,297 · 기록 881) |
| `SOFT=1 node test-dom.cjs` | PASS 19,627건(0.15.1 합친 뒤. 수첩 절 포함) |
| `node test-questions.cjs` | PASS 97,365건(은행 판 3) |
| `node scripts/build-pages.cjs` | 43개 파일 묶음 |
| `node --check test.cjs` · `testmode.js` · `scripts/book-shots.cjs` | 문법만 |

- **돌리지 못한 것**: 브라우저 전부. PC 여유 메모리가 0.8~1.4GB라(조건 2GB 이상, 여러 번 다시 확인) `ONLY=book node test.cjs`, 화면 캡처, 카드 그림 렌더를 돌리지 않았다. 캡처는 도구만 만들어 두었다(§9.6).

### 9.6 화면 캡처 · 카드 그림 (메모리가 될 때 리드가 실행)

- 캡처: `node scripts/build-pages.cjs && node scripts/book-shots.cjs "C:\Users\user\.codex\project\HangulDefense\work\verification-20261113\book-shots"`. 기준 화면 3개(1366×640·1180×820·820×1180) × 13장면(시작 화면·수첩·훈장·문턱·보호자 탭 4개·쪽지 문제·친구 카드·쉬는 중 단추·기억 늑대 문제·반짝 손님·인사 뒤·쉬기 화면·엔딩 카드). 이 도구는 **한 번도 실행하지 못했다**(문법만 확인).
- 판정이 있는 검사: `ONLY=book node test.cjs`(넘침·단추 44px·바깥 요청 0). 이것도 미실행, CI가 처음 돈다.
- 카드 그림(평소 8 + 반짝 8): 만들지 못했다. 사유: 브라우저(3D 렌더)가 필요한데 메모리 조건이 안 됐다. 수첩·친구 카드는 그림 문자 자리표시(🐺 등) 그대로다. 만들 때는 명세 §5.1대로 `?studio=<키>` 개발 화면과 렌더 스크립트가 더 필요하다(아직 없음).

### 9.7 버전 문자열 (리드가 수첩 판 버전을 정할 때 바꿀 곳)

지금 값은 모두 0.15.1 그대로다. 수첩 판에서 내용이 바뀐 파일의 `?v=`는 다음 자리에 있다.

| 자리 | 지금 | 바뀐 파일인가 |
|---|---|---|
| `index.html` `<script src="combat.js?v=…">` · `world.js` · `questions-gen.js` · `questions.js` | 0.15.1 | 넷 다 바뀜 |
| `index.html` `notes.js?v=…` · `book.js?v=…` · `bookui.js?v=…` | 0.15.1 | 새 파일 |
| `index.html` 끝 `testmode.js?v=…`(문자열) · `village.js?v=…` | 0.15.1 | 둘 다 바뀜 |
| `index.html` `#appVersion` "꼬꼬마을 0.15.1" | 0.15.1 | 진행 파일의 `app` 칸이 여기서 읽음 |
| `docs/game-plan.md` §17 제목, `HANDOVER.md` "수첩 MVP" 절 | 버전 없이 "수첩 MVP" | 리드가 번호를 넣음 |

### 9.8 남은 일

1. 브라우저: `ONLY=book node test.cjs`, 화면 캡처 후 배치 손보기, 3D 손님·반짝이 눈 확인.
2. 카드 그림 16장(스튜디오 화면·렌더 스크립트), 손님 색, 3D 쪽지 종이·팻말·친구 방문.
3. 앱 포장 쪽: 진행 파일 공유 시트, Preferences 이중 기록, 바닥글 "이 기기에".
4. 콘텐츠 검수(쪽지 64·카드 문구·개인 이름), 새 그림 문자 🐺·👑·🐗·🌿 실기기 표시, 개인정보처리방침 자리표시.
5. 판단이 필요한 것: 이어 순서로 7세 한 판이 12 → 14.8분으로 길어지는 것(§9.4), 7세 찍기 아이 53%.

---

## 10. CI 브라우저 검사 · 캡처 · 초안 PR (2026-11-19)

PC 여유 메모리가 1.2GB 안팎이라 로컬 브라우저 대신 GitHub Actions에서 확인한다. 초안 PR **#28**(`claude/book-mvp` → main, 병합 금지).

### 10.1 CI 결과 (`gh pr checks 28` / `gh run view`로 직접 읽음)

| 실행 | 커밋 | 결과 | 비고 |
|---|---|---|---|
| 44427059786 | `6c0a4e0` | 취소 | 새 커밋에 밀려 취소(concurrency). 취소 전 `node test.cjs` 단계가 failure로 찍혔지만 로그가 남지 않아 원인 미확인. 다음 실행부터 같은 검사가 통과 |
| 44430263242 | `1b4e55d` | **pass** (23분 29초) | `test.cjs` PASS 1,984건(book 구간 포함), 캡처 48장 |
| 44460963476 | `fc8ca15` | **pass** (22분 25초) | Playwright 공식 컨테이너(`mcr.microsoft.com/playwright:v1.56.1-noble`)로 바꾼 첫 실행. `test.cjs` PASS 1,984건, 캡처 48장 |
| 44463940254 | `a4e9474` | **pass** (19분 22초) | 손님 금빛 색. 캡처 48장(인사 띠는 아직 찍히는 시점이 안 맞음) |
| 44466438207 | `1c300f1` | **pass** (19분 4초) | `test.cjs` PASS 1,984건. 캡처 로그 "반짝 손님: 띠 보임"이 3개 화면 모두(손님 상태 leave, 반짝 칸 기록됨). 캡처 48장 |

- 워크플로(`validate.yml`)는 PR #27과 같은 줄(컨테이너, 설치 단계 없음, 작업 제한 45분)이고, 그 뒤에 `node test-book.cjs`와 "Notebook screenshots"(`if: always()`, `continue-on-error`, 8분) → `book-shots` 아티팩트를 더했다. 캡처 단계는 약 4~5분.
- PR #27(`449cd85`)이 main에 들어가 한 번 더 합쳤다(충돌 없음, `pages.yml`·`test-dom.cjs` 한 줄씩). `validate.yml`은 main과 같은 컨테이너 방식이고, 수첩 쪽 차이는 `node test-book.cjs`와 캡처 단계뿐이다.

### 10.2 캡처를 눈으로 본 결과와 고친 것

저장 위치: `C:\Users\user\.codex\project\HangulDefense\work\verification-20261113\book-shots\` 아래 `run1-44430263242`(설치 방식) · `run2-44460963476`(컨테이너, 배치 고친 뒤) · `run3-44463940254`(손님 금빛 색) · `run4-44466438207`(인사 띠 확인, 최종). 실행마다 48장. 기준 화면 3개 × 16장면(시작·수첩·훈장·문턱·보호자 탭 4개·쪽지 문제·친구 카드·쉬는 중 수첩 단추·기억 늑대 문제·반짝 손님·인사 뒤·쉬기 화면·엔딩 카드).

| 본 것(run1) | 고친 것(run2에서 확인) |
|---|---|
| 1366×640 시작 화면: 수첩·보호자 단추와 하루 시간 줄이 더해져 아래 "보호자 안내"가 화면 끝에 걸림 | 높이 700px 이하에서 시작 화면·엔딩 카드를 줄임(그림 44px, 규칙 글 13px·줄 간격 1.5, 단추 높이 44~52px). run2에서 두 화면 모두 640 안에 들어옴 |
| 1366×640 엔딩 카드: "수첩 보기" 단추와 아래 안내가 잘림 | 위와 같은 규칙으로 해결(run2) |
| 쪽지 문제 칸: 종이 줄무늬가 질문·지문 글자를 가로지름 | 줄무늬를 빼고 종이색 바탕 + 점선 테두리만(run2에서 깨끗함) |
| 3D 반짝 손님: 색이 평소 몬스터와 같아 아이가 알아보기 어려움 | 발밑에 숨 쉬는 금빛 고리 + 머리 위 반짝이(run2에서 보임). 그 뒤 금빛 인스턴스 색(`SHINY_TINT`)도 더함(run3에서 확인) |
| 보호자 기록 탭: 분류별 기록이 없으면 "0 / 0 · 0 / 0 · 0 / 0" | "아직 기록이 없어요." |
| "반짝 손님이 인사하고 갔어요" 띠가 캡처에 안 보임 | 규칙상 정답 연출 중에 화살이 닿으면 바로, 읽는 중에 닿으면 다음 정답 때 뜨고 33틱 뒤 사라진다(캡처가 그 뒤를 찍었음). 캡처 도구가 2틱씩 돌리며 띠가 보이는 순간을 찍게 고침. run4에서 3개 화면 모두 "✨ 반짝 손님이 인사하고 갔어요!" 확인 |

문제없음으로 본 것: 수첩 8칸 격자(3개 화면 모두 넘침 없음, 발자국만 찍힌 칸은 그림자 처리), 훈장 12개 진열, 문턱(글로 적힌 수만 크게, 숫자판 단추 큼), 보호자 탭 4개(넘침 없음, 바깥 링크 없음), 친구 카드 연출(장면 가운데, 문제 칸 문구와 함께), 쉬는 중 "📒 수첩 보기", 기억 늑대 칩, 하루 시간 쉬기 화면.

- 컨테이너의 한글 글꼴은 굵은 글씨가 없어 제목이 보통 굵기로 보인다(실기기 글꼴과 다름, 배치 판단에는 영향 없음).

### 10.3 카드 그림 16장

만들지 않고 그림 문자 자리표시를 유지한다. 사유: 몬스터는 종류마다 인스턴스 무리 하나로 그려지고(`src/village.js` `rigMesh`, 자세는 정점 셰이더) 한 마리만 고정 카메라·투명 배경으로 찍는 장면이 없다. 명세 §5.1의 `?studio=<키>` 화면(카메라·조명·배경)과 렌더 스크립트를 새로 만들어야 하고, CI의 SwiftShader 렌더는 계단 현상이 있어 320px 카드 품질을 보장하기 어렵다. 반짝 모습은 인스턴스 색(`setColorAt`)으로 칠할 수 있음을 확인했다(손님 금빛 색에 같은 방법을 씀). **다음 방법**: 메모리 여유가 있을 때 로컬 창 모드 Chromium에서 스튜디오 화면으로 렌더해 PNG를 커밋(리드 몫).

### 10.4 이어 순서 기록 정리

- 기획서 §17과 이 문서 §9.4의 S2·S3을 "특별 문제의 영향"과 "보통 아이 30분 안쪽"으로 고쳐 적었다. 이어 순서로 7세 한 판이 12.0 → 14.5분, 분당 금화 −19.7%가 되는 것은 "쉬운 앞쪽 문항만 되풀이하던 것이 뒤쪽 문항으로 넘어가며 생기는 변화"로 따로 적고 유지한다(7세는 30분 한참 안쪽). 7세 찍기 아이 53%는 경계로 기록.

---

## 11. 0.16 준비: 0.15.2(늑대 무리 대형) 위로 (2026-11-19)

수첩은 0.15.2 다음 **0.16**으로 낸다(성벽은 0.17). PR #28 초안에 쌓고, 초안 해제·병합은 리드가 한다.

### 11.1 합침과 충돌 해결

| 커밋 | 내용 |
|---|---|
| `a31c17c` | `claude/wolf-forms`(3446291) 합침 + 충돌 해결 + 버전 0.16 + 반짝 손님 띠 + 문서 |
| `accff0d` | `claude/wolf-forms` 검사 수정(5426d84, 여우 그림 검사) 한 번 더 |
| `df88521` | main(0.15.2 배포 `be518a1`) 합침, 내용 변화 없음 |

| 파일 | 해결 |
|---|---|
| `world.js` | 내보내는 목록만 겹침 → 대형 쪽(`FORM`·`formsOn`·`callPack` …) + 수첩 쪽(`GUEST`·`guest`·`guestGreet`·`guestGone`)을 모두. 처치 출처(`by`)·손님 걸음 코드는 자동으로 합쳐졌다 |
| `index.html` | 마크업·스크립트 줄은 수첩 쪽(수첩·보호자·쉬기 겹창), `getVillageState`는 대형의 `forms` + 수첩의 `friends`·`special` |
| `testmode.js` | 막대는 대형 쪽 그대로(🐺 무리 부르기 하나). 수첩 단추(📒)는 패드 세로 820에서 막대에 남는 폭이 없어 **🗺️ 칸 끝 항목**으로 옮김(📜·✨·🗓️·🧹, 수첩이 켜져 있을 때만). `__testmode`는 양쪽 손잡이를 모두 |
| `scripts/sim-flow.cjs` | 대형의 `rebuilt`·`trackForms()` + 수첩의 `B.tick`, 결과에 대형 `forms`와 수첩 `state` 둘 다 |
| `docs/game-plan.md` | 늑대가 §17 → 수첩은 **§18 "0.16 수첩 · 훈장 · 보호자 화면"**(18.1에 대형 켬 재측정) |
| `HANDOVER.md` · `TODO.md` | 0.16 절로 고침, TODO 맨 위에 0.16 |
| `validate.yml` | 충돌 없음. main과 다른 점은 `node test-book.cjs`와 캡처 단계뿐 |
| `test-dom.cjs` | 버전 기대값 0.16, 대형 끔 세계 지문(F-2)은 수첩 기록 칸(`v`·`vh`·`by`·`volleyKills`)을 빼고 잼(빼면 0.15.1과 같음) |

### 11.2 반짝 손님과 대형

따라 돌기 늑대는 울타리 바깥 띠(반지름 + 2)를 달린다. 손님이 반지름 + 1.6을 돌면 그 띠와 0.4밖에 떨어지지 않아 "띠를 도는 늑대"로 보일 수 있어, 반지름 + 4.5(숲 가장자리 + 7과의 사이)로 옮겼다(`World.GUEST.out`). test-dom에 "손님 띠가 따라 돌기 띠보다 2 이상 바깥, 숲 가장자리보다 안" 검사를 더했다. 손님은 금빛 몸 색·발밑 고리로도 구별된다.

### 11.3 버전

`index.html`의 `?v=` 9곳과 `#appVersion` "꼬꼬마을 0.16", test-dom 기대값(스크립트 줄·버전 표기·테스트 모드 스크립트).

### 11.4 시뮬

대형 켬 + 수첩 켬 결과는 기획서 §18.1 표. S1~S5·S8~S12 통과, S6은 7세 54%(경계), S7은 10세·느린 아이가 22판보다 오래 걸림, 0.15.2 울타리 통과선(10세 3개씩 48판 +15% 이내)은 +14.9%로 선에 가깝게 통과.

### 11.5 검사 (로컬)

`test-book` 3,178 · `test-dom` 19,716 · `test-questions` 97,365 · `build-pages` 43개 파일. `test-dom`의 세계 step 성능 검사(1.5ms 미만)는 PC가 시뮬을 돌리는 동안 한 번 떨어졌고, 조용할 때 다시 돌려 통과했다.

### 11.6 CI (0.16 준비)

| 실행 | 커밋 | 결과(`gh pr checks 28`) | 걸린 시간 |
|---|---|---|---|
| 44469501774 | `de24e83` | pass | 18분 53초 |
| 44480823614 | `6c865dd` | pass, 브라우저 검사 2,000건, 캡처 로그 "반짝 손님: 띠 보임" 3개 화면 | 38분 54초(test.cjs 31.1분 · 캡처 6.5분, 느린 러너) |
| 44486433867 | `ffc2d07` | pass, 2,000건 | 28분 9초(test.cjs 22.3분) |
| 44490695860 | `b6ca822` | pass, 2,000건 | 23분 46초. 불투명도 확인으로 바꾼 캡처는 띠를 한 번도 못 잡음("띠 안 보임", 반짝 칸은 기록됨) → 이 장면만 띠 애니메이션을 끄고 찍게 다시 고침 |
| 44494402717 | `aff7dbd` | 취소(바로 뒤 `6abbc8b` 푸시로 대체) | - |
| 44494437627 | `6abbc8b` | pass, 2,000건, 캡처 로그 "반짝 손님: 띠 보임" 3개 화면 | 36분 39초(test.cjs 29.2분 · 캡처 6.1분) |

- 0.15.2 대형 검사와 수첩 검사가 합쳐져 test.cjs가 14분(수첩만) · 19분(대형만)에서 22~31분으로 늘었다. 느린 러너에서 45분 제한에 가까워 검사 작업 제한을 60분, 캡처 단계를 10분으로 올렸다(`ffc2d07`).
- 캡처(`run5-44480823614-v016`): 0.16 시작 화면·엔딩 카드는 1366×640 안에 들어오고, 반짝 손님은 반지름 + 4.5 띠(울타리와 숲 가장자리 사이 풀밭)에서 금빛 고리로 보인다(820×1180에서는 나무에 일부 가림). 인사 띠는 1366에서는 찍혔지만 1180·820에서는 띠의 CSS 애니메이션(실제 시간 3.2초)이 끝난 뒤를 찍었다(DOM에는 있었음, 장면 이름표가 가려진 것으로 확인). 캡처 도구가 불투명한 순간 바로 찍게 고침(`b6ca822`).
- 캡처(`run6-44494437627-v016`, 48장): 인사 장면만 띠 애니메이션을 끄고 찍게 한 뒤(`aff7dbd`) 1180×820 · 1366×640 · 820×1180 모두 "반짝 손님이 인사하고 갔어요! / 수첩에 반짝 칸이 생겼어요" 띠가 지도 위쪽 가운데에 온전히 찍혔다. 띠는 상단 정보줄·문제 칸·건설 단추를 가리지 않는다. 기록에는 반짝 3마리(wolf·bramble·fox), 놓침 0.
