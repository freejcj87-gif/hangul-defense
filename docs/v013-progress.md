# 0.13 진행 메모

- 2026-11-14 시작: 설계 정본 읽음. 다음은 1단계 재시뮬 R1~R4.
- 2026-11-14 1단계 끝: 재시뮬 R1~R4. 실제 규칙 시뮬레이터 scripts/sim-flow.cjs, 결과와 최종 상수는 docs/game-plan.md §13.1~13.4. 방치·찍기·기운 손실 통과 → 흐름 시계 구현으로 진행.
- 2026-11-14 2단계 진행: combat.js(FLAGS.FLOW·기운·sellEggs), world.js(w.flow·낳기·마당 알·농부 슬롯·tidy), index.html(마당 알 숫자·연속 불꽃·말풍선 누르기·읽는 중 말풍선 없음·저장 이행), test-dom.cjs(기존 검사는 FLOW=false 회귀, 흐름 검사 80개 추가, 9,203 통과). 남은 것: src/village.js 3D 연출, 브라우저 검사, 문서.
- 2026-11-15 이어받음(다른 작업자 멈춤 확인). 시뮬 재확인(§13.2 표 재현), src/village.js 3D 연출(금빛 마당 알·한 알씩 나르기·신바람 뛰기·수리 농부·울타리 겹 높이/색·물고기 매대로), test.cjs: 기존 구간은 ?flow=0 회귀, farm 구간 추가(58 통과), 캐시 ?v=0.13. 남은 것: test.cjs 전체, 문서.
- 2026-11-15 끝: test.cjs 전체 1,648 통과(기존 구간 flow=0 회귀 1,590 + farm 58), test-dom 9,203 × 5회, test-questions 44,208, build-pages 통과. 문서(기획서 §13.5, README, HANDOVER 0.13 절, TODO) 반영. 캡처 7장은 work\verification-20261113\v013-shots. push·main 병합은 하지 않음(승인 사항).
