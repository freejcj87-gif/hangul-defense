# Claude Code 작업 인계

기준일: 2026-11-11. 0.5([PR #3](https://github.com/freejcj87-gif/hangul-defense/pull/3), main `965ad4e`로 병합·배포) 기준으로 갱신했습니다. 0.4 인계 시점의 기록은 main `800f3f9` 기준이며 아래 “확인된 검증과 배포”에 그대로 남겼습니다. 문서 커밋 자체는 이후 이력에서 확인하세요.

## 먼저 알아야 할 것

- 저장소: https://github.com/freejcj87-gif/hangul-defense (공개)
- 실제 테스트 주소: https://freejcj87-gif.github.io/hangul-defense/
- 원본 화면 참고: https://freejcj87-gif.github.io/coopnight-web/?showcase=1
- Windows 작업 폴더: `C:\Users\user\.codex\project\HangulDefense`. 저장소 체크아웃은 그 아래 `work\`에 있습니다(2026-11-11 직접 확인).
  - `work\art-handoff-20261111`: 기존 체크아웃(브랜치 `art-handoff/coopnight-20261111`). 0.5 작업에서 손대지 않았습니다.
  - `work\claude-village-polish`: 0.5 작업용 worktree(브랜치 `claude/village-polish`).
  - `work\verification-20261111`: 검증 스크린샷(저장소 밖, 커밋하지 않음).
- WSL2에서 열 때 일반적인 경로: `/mnt/c/Users/user/.codex/project/HangulDefense`. 별도 WSL 복제본 여부는 확인하지 않았습니다.
- 0.5는 이 Windows 폴더에서 구현하고 로컬과 GitHub Actions 양쪽에서 검사했습니다.
- 기존 작업 폴더를 우선 확인하고 새 저장소를 만들지 마세요. 원본 CoopNight 로컬 프로젝트는 별도이며 이 작업에서 수정하지 않았습니다.

## 사용자가 원하는 제품

7~10세가 나이를 선택해 시작하는 한글 읽기·문해력 게임입니다. 소리를 듣고 글자를 맞히면 골드를 얻고, 터치로 타워와 마을을 강화합니다. 이후 단어·문장·몇 문장으로 된 글과 5지선다 독해로 발전해야 합니다.

핵심은 학습 중 실수 부담을 낮추면서, 방어할 때 긴장감과 타격감을 주고, 마을이 예뻐지고 커지는 성취감을 주는 것입니다. 사용자는 초기 시제품의 품질이 꼬꼬마을보다 현저히 낮다고 평가했고, “거의 베껴오다시피” 원본 화면 감각과 계속 살아 움직이는 마을을 요청했습니다. 0.4는 그 방향의 첫 3D 구현이며 사용자 품질 승인을 받은 완성판이 아닙니다. 0.5에서는 사용자가 두 가지를 강조했습니다. 나이를 고르면 그 난이도의 문제로 정확히 바뀔 것, 문제를 맞히면 타워·닭·울타리 가운데 하나를 골라 짓고 생성 순간의 손맛이 살 것. 0.5도 사용자 체감 승인 전입니다.

- 기존 꼬꼬마을 아트를 최대한 재사용하세요.
- Higgsfield 복사·배포·크레딧 사용은 하지 마세요.
- 현재 저장소의 공개 전환과 main 병합·Pages 배포는 사용자 승인 사항입니다. 동일 링크가 업데이트되는 방식을 유지하세요.
- 원본 프로젝트의 진행 중 작업을 덮어쓰지 마세요. 자산은 인계 패키지에서 사용하고 출처를 보존하세요.
- 중요한 구조·밸런스·학습 설계 판단에서는 사용자가 요청한 “울트라 코드” 활용을 선제적으로 제안할 수 있습니다. 실제 실행하지 않은 모델·모드 사용을 주장하지 마세요.

## 현재 구현

- `index.html`: UI/CSS, 상태·저장, 정답 보상, 골라서 짓기(상점), 다음 방어 예측과 추천, 전투 진행, 화면(DOM) 이펙트, 브라우저 한국어 음성, 효과음, 설정.
- `questions.js`: 나이별 문제은행(7~10세 × 소리/읽기, 124문항)과 조회·검증. DOM 의존 없음. `Questions.get(age,mode,index)`, `count`, `validate`, `LEVELS`.
- `combat.js`: 렌더러와 분리된 직렬화 가능한 전투 규칙. `create/valid/step`. `step(battle,level,dt,fence)`의 네 번째 인자가 울타리 칸 수입니다.
- `src/village.js`: Three.js 3D 장면. 원본 건물·농부·닭 GLB와 잔디 텍스처, 주민 이동, 알 운반, 나무·연기, 투사체·금화·반동, 짓기 연출.
- `window.getVillageState()`: UI 상태를 장면에 전달합니다.
- `window.VillageView.events/reward/build(kind)/upgrade/inspect`: 전투·보상·짓기 연출과 테스트 관측 인터페이스입니다. `build`는 `'tower'|'chicken'|'fence'`를 받아 생성 연출을 재생하고 화면 좌표를 돌려줍니다. `inspect()`의 `frames`는 처리한 프레임 수로, 검사가 벽시계 대신 이 값을 기준으로 기다립니다.
- `scripts/build-pages.cjs`: `.pages-build/`에 실행 파일·사용 자산을 모으고 `village.js`를 번들링합니다. 생성물을 직접 편집하지 마세요.
- `test-questions.cjs`: 문제은행 단독 검사(나이별 수준 규칙, 정답 위치 분포, 중복, 보기 수).
- `test-dom.cjs`: 규칙·모의 DOM 검사.
- `test.cjs`: Chromium/WebKit 실제 브라우저 검사와 스크린샷. `ONLY=matrix|feel|fallback`으로 구간만 돌릴 수 있고(출력에 `PARTIAL` 표시), 전체 통과 수치는 `ONLY` 없이 돌린 것만 인정합니다.
- `art-handoff/coopnight/`: 기존 인계 원본·사용 지침·manifest. 실제 장면 설명은 [docs/living-village.md](docs/living-village.md).

3D는 원본 `source-3d/models/environment-pack.glb`의 EnvCoop/Market/Tower/CornTower/Chicken/Chick/FarmerPolished/Fence/Gate/Tree/Bush/Rock 등을 재사용합니다. GLB에는 애니메이션 채널이 없어 동작은 새 절차 애니메이션입니다. 늑대도 새로 만든 절차 모델이며 원본 Unity 늑대 애니메이션을 가져온 것은 아닙니다. 원본 Unity 실행 코드 자체를 포팅하지 않았습니다.

주민 생활 동작은 장식이며 자동 골드를 주지 않습니다(닭 보너스는 정답을 맞힐 때만 붙습니다). WebGL 또는 모델 로딩 실패 시 기존 PNG 화면으로 학습·전투·짓기를 유지합니다. 픽셀비 최대 1.5, 렌더링 약 30fps 제한, 움직임 줄이기·일시정지를 지원합니다.

0.5에서 3D 장면은 390px 폭 기준으로 카메라와 배치를 다시 잡았고, GLB 메시를 버텍스 컬러로 병합해 드로우콜을 줄였습니다(CI 성숙 마을 관측 약 321 → 25, 소프트웨어 렌더링 기준이며 실기기 프레임 시간은 재지 않았습니다). 짓기 연출은 예고 → 충격 → 여운 순서이고 장면 시간(프레임당 최대 0.05초)으로 흐릅니다. 파티클 상한 300, 움직임 줄이기에서는 연출 없이 완성 상태로 바로 나타납니다.

## 실제 규칙과 한계

- 초기 20골드. 소리 문제 정답 +20, 읽기 문제 정답 +40, 닭 1마리당 정답마다 +5.
- 골라서 짓기: 정답 뒤 카드 세 장 가운데 골드가 되는 것을 누르면 바로 마을에 생깁니다. 타워 40골드(최대 5단계), 닭 20골드(최대 6마리), 울타리 20골드(최대 6칸, 칸마다 늑대 6% 감속). 골드가 남으면 이어서 더 고를 수 있고, 고르지 않고 방어하러 가도 됩니다.
- 카드 아래에 다음 방어 예측을 보여 주고(실제 전투 규칙을 미리 돌린 결과) 필요한 카드에 “추천”을 붙입니다.
- 오답은 골드 차감 없이 재시도. 두 번 오답이면 정답을 색으로 표시합니다.
- 문제를 푸는 동안 전투는 멈춰 있고, 정답 후 사용자가 방어 시작 버튼을 누릅니다.
- 전투 tier는 문제 index를 기준으로 3문제마다 상승하며 최대 8. 적 2~5마리, HP·속도가 상승합니다. 타워 레벨에 따라 피해와 공격 주기가 변합니다.
- 누출 늑대 한 마리당 성문 피해 15. 다음 문제에서 성문은 최소 60으로 회복합니다.
- 3D 추가 닭장은 방어 성공 2회부터, 두 번째 타워는 레벨 3부터 보입니다. 두 번째 타워는 현재 별도 공격 규칙을 가진 독립 시설이 아니라 기존 레벨 기반 공격의 시각 표현입니다.
- PNG 대체 화면은 기존 성공 3/6회 시설 규칙을 사용하여 3D와 성장 단계가 다릅니다. 후속 정리 대상입니다.
- 문제은행은 나이별로 고정된 124문항입니다. 문항 수(소리/읽기): 7세 14/16(받침 없는 글자 · 낱말과 그림, 보기 3개), 8세 16/14(받침 있는 낱말 · 한 문장, 보기 3개), 9세 20/14(헷갈리는 낱말 · 두 문장, 보기 4개), 10세 16/14(문장 받아쓰기 · 짧은 글 이해, 보기 4개/5개). 순번이 문항 수를 넘으면 처음으로 돌아갑니다.
- 나이를 바꾸면: 아직 답하지 않았을 때는 그 자리에서 새 나이의 문제로 바뀌고, 이미 답한 뒤에는 다음 문제부터 적용됩니다. 이미 맞힌 문제는 맞힐 때의 나이(`qage`)로 다시 보여 줍니다.
- 난도는 나이로만 정해집니다. 진단·적응 난도·복습은 없습니다. 문항 난도와 그림(이모지) 보기의 직관성은 규칙 검사만 거쳤고 아동·교육 전문가 검수는 받지 않았습니다.
- 저장 키: `hangul-defense-v1`, version 1. 골드·성문·레벨·성공 수·문제 index·모드·나이·닭·울타리·맞힌 나이·보상/전투 완료 토큰·전투 상태를 저장합니다. 0.5에서 추가한 값(`chickens`, `fence`, `qage`)은 없으면 0 또는 빈 값으로 읽으므로 0.4 저장과 호환됩니다. 기존 저장 호환성을 지키거나 명시적으로 이관하세요.
- 음성은 브라우저 SpeechSynthesis, ko-KR 음성을 우선 선택합니다. 녹음이나 서버 음성 인식은 없습니다.
- 효과음·읽기 속도·움직임 설정은 현재 접속 동안만 유지됩니다.
- 저장은 origin별 localStorage여서 로컬 테스트와 Pages의 진행은 서로 다릅니다.

## 로컬에서 이어받기

먼저 해당 폴더에서 아래 읽기 작업을 하세요.

```sh
git status --short --branch
git remote -v
git log -5 --oneline
git fetch origin
```

origin이 위 저장소인지, 다른 에이전트의 미커밋 작업이 있는지 확인하세요. 자동 reset/clean/stash나 기존 작업 덮어쓰기는 하지 마세요. 깨끗한 main에서만 `git pull --ff-only origin main`을 사용하고, 그 외에는 별도 브랜치 또는 worktree로 기존 작업을 보존하세요. 협업 기능 작업은 예를 들어 `claude/village-polish` 브랜치에서 시작하세요.

Node.js 22, Python 3 기준입니다. 현재 package.json/lockfile은 없고 버전을 지정해 설치합니다.

```sh
npm install --no-save --package-lock=false three@0.180.0 esbuild@0.25.10 playwright@1.56.1
node scripts/build-pages.cjs
python3 -m http.server 8000 --directory .pages-build
```

Windows PowerShell에서는 마지막 줄을 `py -3 -m http.server 8000 --directory .pages-build`로 사용할 수 있습니다. http://localhost:8000 에 접속하세요. 저장소 루트의 index.html을 file://로 여는 것은 3D 실행 방법이 아닙니다. 소스 변경 후 다시 빌드해야 합니다. 현재 빌드 도구는 출력 폴더를 청소하지 않으므로 배포 목록을 제거·변경했다면 생성물 잔존도 확인하세요.

검증은 별도 터미널에서:

```sh
node test-questions.cjs
node test-dom.cjs
npx playwright install --with-deps chromium webkit
node scripts/build-pages.cjs
node test.cjs
```

Playwright 시스템 의존성 설치는 WSL/Ubuntu 환경에 맞춰 수행하세요. test.cjs는 자체 임시 HTTP 서버를 띄웁니다. 스크린샷은 test-results/에 생성됩니다. 느린 PC에서는 전체 실행이 10분을 넘길 수 있으니 시간 제한을 짧게 걸지 마세요. 3D 상태를 읽는 검사는 정해진 시간만큼 기다리지 말고 `inspect().frames`나 조건이 될 때까지 기다리게 쓰세요. CI의 소프트웨어 렌더링은 프레임 간격이 200ms를 넘습니다.

## 확인된 검증과 배포

- [PR #2](https://github.com/freejcj87-gif/hangul-defense/pull/2) main 병합 완료.
- [0.4 CI](https://github.com/freejcj87-gif/hangul-defense/actions/runs/42944238923): 규칙/모의 DOM 31 + 브라우저 79 = 110개 검사 통과.
- Chromium/WebKit, 1366/390/320px, 터치 입력 모사, 정답·구매·전투·저장 재개·5지선다·화면 넘침 검사.
- Chromium 실제 3D 주민 이동·정지·움직임 줄이기·성장·적 표시, GLB 로드 실패 시 대체 화면과 학습·구매 검사.
- [Pages 배포](https://github.com/freejcj87-gif/hangul-defense/actions/runs/42944631074): `b324a694cf54382453a12213b1dd08282c4e9d6a` 배포, 실제 URL의 커밋·HTML·스크립트·GLB·PNG 21개 HTTP 응답 확인.
- 후속 main `800f3f9`는 다운로드 패키지의 숨김 출력 디렉터리 업로드 수정만 포함합니다. 게임 배포 내용은 동일합니다.
- [다운로드 패키지 검사](https://github.com/freejcj87-gif/hangul-defense/actions/runs/42944850204) 성공.
- 실제 iPhone/Android 성능·발열·한국어 음성, 아동 사용성, 학습효과는 아직 검증하지 않았습니다. 모바일 화면 모사를 실기기 검증이라고 보고하지 마세요.

### 0.5 (2026-11-11)

- [PR #3](https://github.com/freejcj87-gif/hangul-defense/pull/3) main 병합 완료. 병합 커밋 `965ad4e79a92b23bada2f0183393a9c5c4422c05`, 브랜치 끝 `21ab7e9`.
- [0.5 CI](https://github.com/freejcj87-gif/hangul-defense/actions/runs/42968363993): 문제은행 3,016 + 규칙/모의 DOM 748 + 브라우저 1,015개 검사 통과. 직전 커밋 `5cc897f`의 로컬 실행(Windows, Chromium SwiftShader + WebKit)에서도 1,015개 통과.
- 브라우저 검사 범위: Chromium/WebKit × 1366/390/320px에서 나이 7~10세 × 소리/읽기 8조합 전환, 정답 뒤 타워·닭·울타리 구매와 이름표, 전투·일시정지·저장 재개. Chromium 3D에서 짓기 연출 횟수와 반영(타워 단계·닭·울타리 수), GLB 실패 시 대체 화면의 구매·생성 표시.
- [Pages 배포](https://github.com/freejcj87-gif/hangul-defense/actions/runs/42968917130): `965ad4e` 배포. 실제 URL에서 version.json의 커밋, index.html, questions.js, village.js, `fx-feathers.png` 응답을 직접 확인.
- [다운로드 패키지 검사](https://github.com/freejcj87-gif/hangul-defense/actions/runs/42968917176) 성공.
- CI 통과까지 다섯 번 실패했고 원인은 네 가지였습니다. 세 가지는 검사가 벽시계 시간에 기대던 문제(움직임 줄이기 정지 확인, 3D 짓기 반영 대기, 대체 화면에서 떨어지는 중인 울타리 크기 측정)였고 프레임 수·조건·연출 종료 기준으로 바꿨습니다. 한 가지는 게임 쪽 문제였습니다. 전투 중 0.1초마다 “잠깐 쉬기” 버튼 글자를 다시 써서 누름이 사라질 수 있었고, 값이 바뀔 때만 쓰도록 고쳤습니다(`put()`).
- 미해결: 고친 뒤 로컬 브라우저 검사에서 “늑대가 그려짐”과 “전투 중 나이 잠금”이 한 번씩 실패했고, 이후 같은 구간은 로컬 2회·CI 2회 모두 통과했습니다. 원인을 확정하지 못했습니다. 두 검사에는 실패 시 상태·클릭 기록·페이지 오류를 출력하는 진단을 넣어 두었으니 재발하면 그 출력부터 보세요.
- 통합 화면 스크린샷 66장: `work\verification-20261111\integrated-0.5\`. 짓기 연출 프레임 시트는 `work\verification-20261111\village-3d\`(연출 주입 하네스 기준).
- 0.5에서도 실기기(iPhone/Android), 실제 한국어 음성, 문제 난도와 그림 보기의 직관성(아동·교육 전문가 검수), 생성 손맛의 사용자 체감은 확인하지 않았습니다.

## 자동 배포와 협업

- `.github/workflows/pages.yml`: main의 지정된 게임 경로 변경 → 규칙 검사 → 빌드 → Pages → 실제 URL 검사.
- `.github/workflows/validate.yml`: main 대상 PR과 지정 브랜치(improve 두 개, `claude/village-polish`) push에 문제은행·규칙·브라우저 검사. 같은 브랜치에 PR이 열려 있으면 push 쪽 실행은 취소로 표시되는 것이 정상이며 PR 쪽 결과를 보세요. 다른 이름의 새 브랜치는 PR을 열어야 실행됩니다.
- `.github/workflows/package-test.yml`: 다운로드용 동일 실행판. `.pages-build`가 숨김 폴더이므로 `include-hidden-files: true`가 필요합니다.
- src의 새 파일·학습 데이터·새 자산 경로를 만들면 build-pages.cjs와 workflow paths 필터도 함께 검토하세요. 현재 필터는 index.html, combat.js, questions.js, src/village.js 등 특정 경로 위주입니다.
- README/인계 문서만 변경하면 게임 재배포가 발생하지 않는 것이 정상입니다.
- Claude와 Codex가 같은 브랜치/파일을 동시에 수정하지 않도록 작업 시작 시 담당 파일과 브랜치를 합의하세요. 권장: Claude는 화면·애니메이션, Codex는 규칙·학습·검증 검토. index.html은 둘이 동시에 편집하지 마세요.
- main에 병합한 뒤 Actions 성공과 실제 링크를 확인하고 사용자에게 같은 URL을 전달하세요. 아직 확인하지 않은 품질·기능을 완료라고 쓰지 마세요.

다음 작업은 [TODO.md](TODO.md)를 확인하세요.
