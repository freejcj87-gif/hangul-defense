# 0.14 진행 메모

설계: `work\verification-20261113\design\v014-scale-design.md`(§9 프로듀서 결정 우선). 브랜치 `claude/v014-stages`(main 0.13.2 `b5c9ae5` 기준).

- 2026-11-17 1단계 끝(규칙·시뮬): `combat.js`(FLAGS.STAGES·ROUTES·STAGE_AT·STAGE_AT_BY_AGE·STAGE_HALL·STAGE_BELL_BY_AGE, stage·stageInfo), `world.js`(STAGE.radius·open·range, w.stage 래치, sync의 hold, 열린 길 출현), `scripts/sim-flow.cjs`(단계 도달·길별 유입·잃은 닭 출력, 단계 보류 반영). 기존 검사는 단계를 끄고 돌려 9,203 통과(= 끄면 0.13.2와 같음). 시뮬 원자료는 `work\verification-20261113\v014-sim\`. 남은 것: index.html(8번째 칸·전환 띠·보류·주소 플래그·버전), src/village.js(길·집·단계 표시), 검사 추가, 브라우저 검사, 캡처, 문서.
- 2026-11-17 2단계 끝(화면·검사): `index.html`(이름표·8번째 칸 진행 표시·읽는 중 구매는 문제 사이에 넓힘·전환 띠 알림·?stages=0·?routes=0·머리글 0.14), `src/layout.js`·`src/props.js`·`src/village.js`(열린 길만 흙길, 닫힌 방향은 숲, 집·우물·물레방아 오두막·길목 표시·성탑, 전환 때 솟는 연출), `test-dom.cjs`(기존 검사는 단계 끔 회귀 + 0.14 절, 11,330 통과), `test.cjs`(기존 구간 stages=0 회귀 + stage 구간 추가, 전체 실행은 아직). 회관 승급은 [2,4,5]단계, 종 9세 50·10세 46, 첫 문턱 5, 사거리 덤 0.75배로 확정(시뮬). 남은 것: 시뮬 최종표, test.cjs 전체, 캡처, 문서.
