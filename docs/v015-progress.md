# 0.15 진행 메모

계획서(정본): `work\verification-20261113\design\v015-plan.md`. 브랜치 `claude/v015-river`(main `11fca3c` = 0.14 배포본에서 팜). 이번 담당은 프로듀서 답과 상관없는 앞부분(계획서 §11의 1·3·4)만 한다. 강·다리·물레방아 배치(§11-2·5·6)와 물레방아 금화(§11-9)는 프로듀서 답(계획서 §13 질문 1·2)을 기다린다.

## 커밋별 기록

- 2026-11-17 1. 아트 들여오기(화면 변화 없음): 묶음 `outputs\art-v015-v016-20261117`(원본은 그대로 둠)을 `art-handoff/v015-v016/`에 통째로 복사(GLB 9 · PNG 9 · manifest · README · 미리보기 · 제작 스크립트 · `check_pack.mjs`, README 링크가 저장소 안에서도 열리게). 복사본으로 `node art-handoff/v015-v016/check_pack.mjs <node_modules>` 9개 PASS. `scripts/build-pages.cjs`: 0.15 아트 4쌍(물레방아 · 다리 · 늑대 왕 · 도둑 여우의 GLB와 PNG)을 배포 묶음에 넣고, `index.html`과 `src/*.js`가 글자 그대로 적은 아트 경로(coopnight PNG · environment-pack GLB · v015-v016 GLB/PNG) 가운데 묶지 않은 것이 있으면 빌드를 멈춘다(임시 파일로 멈추는 것 확인). 묶음 목록을 내보내고 직접 실행할 때만 빌드한다(test-dom이 require). 워크플로 `pages.yml` · `package-test.yml`의 `paths`에 `art-handoff/v015-v016/**`, 실제 주소 검사에 GLB 4개(glTF 머리) · PNG 4개. `docs/pages-deployment.md` 개수 문구. test-dom 새 절 "0.15 아트 들여오기": 18개 파일 크기 · SHA-256 = manifest, 머리 바이트, 배포 묶음 4쌍, 참조 검사, 워크플로 paths · 실제 주소 목록. 검사: test-questions 44,208 · test-dom 12,156(SOFT=1) · 빌드 39개 파일.

- 2026-11-17 2. 3D 로더(장면 변화 없음): `src/geo.js` `prep`이 원본의 `color` 속성(glTF `COLOR_0`)이 있으면 꼭짓점마다 그 색 × 재질 색을 넣는다(없으면 전처럼 재질 색). Node에서 main의 옛 `prep`과 새 `prep`을 environment-pack 283개 메시 × 행렬 2가지(뒤집힌 행렬 포함)에 돌려 위치 · 법선 · 색 배열이 바이트 단위로 모두 같음, 새 GLB 4개는 하얀 꼭짓점 0개(옛 prep은 전부 흰색). `src/village.js` `loadArt15()`: GLB 4개(물레방아 · 다리 · 늑대 왕 · 도둑 여우, `?v=0.15`)를 파일마다 따로 읽고, 실패 · 기대 노드가 없는 파일 · 핵심 아트가 들어온 뒤 8초 넘게 안 오는 파일은 null(그 모델만 0.14). 기존 핵심 아트와 함께 기다려 `renderer='three'` 전에 모두 정해진다. `?art15=0`이면 요청하지 않는다. `inspect().art15={watermill,bridge,king,fox}`(불러오기 성공 = 그 모델을 GLB로 그릴 수 있음. 이 커밋에서는 아직 아무것도 GLB로 그리지 않는다). test.cjs: 로컬 서버가 `art-handoff/v015-v016/` GLB · PNG를 내주고, 새 구간 `art`(기본 4개 요청 · `?art15=0` 요청 0 · 4개 모두 막음 · 왕만 막음 · 왕 자리에 다른 GLB, 모두 3D 유지 · 페이지 오류 0). 장면 변화 없음 확인: 캡처 스크립트 `work\verification-20261113\playtest\v015-art.cjs same`(세계는 `__HOLD_CLOCK`, 3D 화면 시계는 requestAnimationFrame 시각을 가짜 시계로 바꿔 1/30초씩 밀어 결정적으로 찍음)으로 main 빌드와 이 빌드를 기준 화면 3개 × 단계 0 · 3 · 5 · 기다리는 늑대 왕에서 찍어 12장 모두 PNG 바이트까지 같음(다른 픽셀 0, `?art15=0`도 0), 그리기 호출 · 삼각형도 같음. 캡처 `work\verification-20261113\v015-shots\same-*`. 검사: `ONLY=art node test.cjs` PASS 12, test-dom 12,156.

## 다음 담당에게

- 0.16 아트(성 · 성벽 · 성문 · 성탑)와 따로 된 바퀴는 저장소에만 있고 배포 묶음에는 없다. 쓰기 시작하면 `scripts/build-pages.cjs`의 `art15`(이름은 0.15지만 배포 목록) · `pages.yml`의 `art15` · test-dom 기대값을 같이 고친다.
- 아트 경로는 소스에 한 문자열로 적는다(`'art-handoff/v015-v016/glb/' + name` 같이 조각내면 빌드의 참조 검사가 못 본다).
