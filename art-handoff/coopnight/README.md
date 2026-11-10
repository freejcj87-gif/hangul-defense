# 한글 디펜스용 꼬꼬마을 아트 인계

2026-11-11. Game Project Brand new 세션의 CoopNight 아트에서 선별했다. PNG·MP4·GLB·BLEND 81개, 약 103 MiB다. [파일 목록](FILES.md) · [원본 경로·규격·SHA-256](manifest.json) · [사용 범위](USAGE.md).

| 필요한 것 | 첫 적용 후보 | 그 밖의 선택지 |
|---|---|---|
| 마을 배경 | [초원](browser/backgrounds/background-meadow.png) | 채석장·서리 과수원·불씨 숲, 지면·목재·물·안개 텍스처 |
| 캐릭터 | [닭](browser/characters/chicken.png), [일꾼](browser/characters/helper.png), [관리인](browser/characters/keeper.png) | 농부 성장 아이콘 3개, 닭 품종 8개, [농부 모델](source-3d/models/farmer.glb) |
| 건물 | [집](browser/buildings/home-01.png), [타워](browser/buildings/tower-01.png), [울타리](browser/buildings/fence.png), [문](browser/buildings/gate.png) | 집 5단계·타워 10단계 아이콘, 닭장·부화장·창고, [3D 마을 합본](source-3d/models/environment-pack.glb) |
| 늑대 | [투명 초상](browser/wolves/wolf.png) | [전신 시안](reference/wolves/wolf-base.png), 테마별 보스 4종 |
| 애니메이션 | [금화 회전 프레임](browser/animation/front.png), [착탄](browser/animation/fx-impact.png) | [걷기](reference/animation/wolf-walk-reference.mp4)·[달리기](reference/animation/wolf-run-reference.mp4)·보스 공격 참고 MP4 |

`browser/`의 PNG 56개는 HTML의 이미지나 CSS 배경 후보로 바로 읽을 수 있다. 그리기 크기와 피벗은 화면에서 맞춘다. `reference/`에는 외형·동작 참고 19개, `source-3d/`에는 Blender 원본·GLB·렌더 미리보기 6개가 있다.

첫 적용은 초원 배경과 정적 집·타워·늑대 초상을 사용한다. 늑대 초상은 임시 마커나 체력바 옆에 잘 맞는다. 전신 시안과 걷기·달리기 영상으로 전신 스프라이트를 제작할 때는 발 위치와 카메라 방향을 통일한다.

브랜치는 `main`의 `a90a5ac`에서 시작했다. 추가 커밋의 범위는 이 디렉터리다.
