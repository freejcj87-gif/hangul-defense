# 0.15 진행 메모

계획서(정본): `work\verification-20261113\design\v015-plan.md`. 브랜치 `claude/v015-river`(main `11fca3c` = 0.14 배포본에서 팜). 이번 담당은 프로듀서 답과 상관없는 앞부분(계획서 §11의 1·3·4)만 한다. 강·다리·물레방아 배치(§11-2·5·6)와 물레방아 금화(§11-9)는 프로듀서 답(계획서 §13 질문 1·2)을 기다린다.

## 커밋별 기록

- 2026-11-17 1. 아트 들여오기(화면 변화 없음): 묶음 `outputs\art-v015-v016-20261117`(원본은 그대로 둠)을 `art-handoff/v015-v016/`에 통째로 복사(GLB 9 · PNG 9 · manifest · README · 미리보기 · 제작 스크립트 · `check_pack.mjs`, README 링크가 저장소 안에서도 열리게). 복사본으로 `node art-handoff/v015-v016/check_pack.mjs <node_modules>` 9개 PASS. `scripts/build-pages.cjs`: 0.15 아트 4쌍(물레방아 · 다리 · 늑대 왕 · 도둑 여우의 GLB와 PNG)을 배포 묶음에 넣고, `index.html`과 `src/*.js`가 글자 그대로 적은 아트 경로(coopnight PNG · environment-pack GLB · v015-v016 GLB/PNG) 가운데 묶지 않은 것이 있으면 빌드를 멈춘다(임시 파일로 멈추는 것 확인). 묶음 목록을 내보내고 직접 실행할 때만 빌드한다(test-dom이 require). 워크플로 `pages.yml` · `package-test.yml`의 `paths`에 `art-handoff/v015-v016/**`, 실제 주소 검사에 GLB 4개(glTF 머리) · PNG 4개. `docs/pages-deployment.md` 개수 문구. test-dom 새 절 "0.15 아트 들여오기": 18개 파일 크기 · SHA-256 = manifest, 머리 바이트, 배포 묶음 4쌍, 참조 검사, 워크플로 paths · 실제 주소 목록. 검사: test-questions 44,208 · test-dom 12,156(SOFT=1) · 빌드 39개 파일.

## 다음 담당에게

- 0.16 아트(성 · 성벽 · 성문 · 성탑)와 따로 된 바퀴는 저장소에만 있고 배포 묶음에는 없다. 쓰기 시작하면 `scripts/build-pages.cjs`의 `art15`(이름은 0.15지만 배포 목록) · `pages.yml`의 `art15` · test-dom 기대값을 같이 고친다.
- 아트 경로는 소스에 한 문자열로 적는다(`'art-handoff/v015-v016/glb/' + name` 같이 조각내면 빌드의 참조 검사가 못 본다).
