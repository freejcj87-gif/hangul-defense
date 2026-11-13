# 0.13 진행 메모

- 2026-11-14 시작: 설계 정본 읽음. 다음은 1단계 재시뮬 R1~R4.
- 2026-11-14 1단계 끝: 재시뮬 R1~R4. 실제 규칙 시뮬레이터 scripts/sim-flow.cjs, 결과와 최종 상수는 docs/game-plan.md §13.1~13.4. 방치·찍기·기운 손실 통과 → 흐름 시계 구현으로 진행.
- 2026-11-14 2단계 진행: combat.js(FLAGS.FLOW·기운·sellEggs), world.js(w.flow·낳기·마당 알·농부 슬롯·tidy), index.html(마당 알 숫자·연속 불꽃·말풍선 누르기·읽는 중 말풍선 없음·저장 이행), test-dom.cjs(기존 검사는 FLOW=false 회귀, 흐름 검사 80개 추가, 9,203 통과). 남은 것: src/village.js 3D 연출, 브라우저 검사, 문서.
