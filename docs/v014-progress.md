# 0.14 진행 메모

설계: `work\verification-20261113\design\v014-scale-design.md`(§9 프로듀서 결정 우선). 브랜치 `claude/v014-stages`(main 0.13.2 `b5c9ae5` 기준).

- 2026-11-17 1단계 끝(규칙·시뮬): `combat.js`(FLAGS.STAGES·ROUTES·STAGE_AT·STAGE_AT_BY_AGE·STAGE_HALL·STAGE_BELL_BY_AGE, stage·stageInfo), `world.js`(STAGE.radius·open·range, w.stage 래치, sync의 hold, 열린 길 출현), `scripts/sim-flow.cjs`(단계 도달·길별 유입·잃은 닭 출력, 단계 보류 반영). 기존 검사는 단계를 끄고 돌려 9,203 통과(= 끄면 0.13.2와 같음). 시뮬 원자료는 `work\verification-20261113\v014-sim\`. 남은 것: index.html(8번째 칸·전환 띠·보류·주소 플래그·버전), src/village.js(길·집·단계 표시), 검사 추가, 브라우저 검사, 캡처, 문서.
