# 꼬꼬마을 아트 적용 상태

## 확인한 출처와 범위
- 원본 작업 세션: Game Project Brand new.
- 인계 브랜치: art-handoff/coopnight-20261111.
- 기준 커밋: 638204fc4632128c279ab5f9a761419b3ac8a926.
- [인계 README](../art-handoff/coopnight/README.md), [사용 지침](../art-handoff/coopnight/USAGE.md), [파일 목록](../art-handoff/coopnight/FILES.md), [원본 경로·해시](../art-handoff/coopnight/manifest.json).
- 패키지 81개, 약 103MiB. 비공개 개발·테스트·통합 목적을 확인했습니다.
- 기존 로컬 프로젝트에 접근하거나 변경하지 않았습니다. 인계 브랜치 자체도 수정하지 않았습니다.

## 실제 화면 연결
| 요소 | 자산 | 규칙 |
|---|---|---|
| 마을 | background-meadow.png | 중앙을 기준으로 화면 크기에 맞게 배치 |
| 중심 집 | home-01~05.png | 성공 0/3/6/9/12회에 외형 성장 |
| 타워 | tower-01/03/05/08/10.png | 게임 강화 1~5단계와 매핑 |
| 주민·브랜드 | chicken.png | 헤더·마을·성장 패널 |
| 추가 시설 | coop.png, store.png | 성공 3회·6회에 등장 |
| 적 | wolf.png | 정적 초상 마커와 별도 체력바 |
| 골드 | front/quarter/edge/reverse-quarter.png | 정답 보상 때 프레임 교체 |
| 명중 | fx-impact.png | 짧은 파티클 효과 |

늑대 초상은 전신 걷기 애니메이션이 아닙니다. 전신 시안과 6개 MP4는 참고용이며 게임 루프로 연결하지 않았습니다.
3D BLEND/GLB는 원본 패키지 안에 보존하되 웹 화면에서 로드하지 않습니다.
원본 파일 내용은 변경하지 않고 상대 경로로 사용합니다. 배경 PNG는 약 6MiB이므로 향후 실기기에서 로딩 최적화가 필요할 수 있습니다.

## 검증
규칙·모의 DOM 31개 유지. Chromium/WebKit의 1366/390/320px에서 이미지 디코드,
집·타워 원본 크기, 늑대 이미지, 터치·골드·저장 재개·독해 및 화면 넘침을 검사합니다.
실제 휴대폰 음성·발열·터치 사용감과 학습효과는 별도 검증 대상입니다.
