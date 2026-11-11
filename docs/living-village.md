# 살아 움직이는 마을 0.4
사용자가 원본 꼬꼬마을의 살아 움직이는 농장 체감을 요청하여, 원본 공개 showcase를 읽기 전용으로 확인한 뒤 실제 인계 GLB를 재사용했다.
- 원본: art-handoff/coopnight/source-3d/models/environment-pack.glb. EnvCoop/EnvMarket/EnvTower/EnvCornTower/EnvChicken/EnvChick/FarmerPolished/EnvFence/EnvGate/EnvTree/EnvBush/EnvRock를 재사용.
- 절차 애니메이션: 닭의 배회와 뛰기, 농부 이동/팔·다리/알 운반, 나무 흔들림, 연기, 씨앗 발사, 금화 이동, 타워 반동.
- 주민 일상은 장식이며 자동으로 골드를 생성하지 않는다. 학습·전투·보상 규칙과 기존 저장 키는 유지.
- 3D 늑대는 새 절차 모델이다. 기존 Unity의 늑대 모델/애니메이션을 가져온 것으로 주장하지 않는다.
- 원본 Unity 코드나 로컬 프로젝트는 변경하지 않았다. Unity 빌드를 iframe으로 감싸는 방식이 아니라, 공유된 자산으로 한글 학습 게임 장면을 구현했다.
- WebGL/GLB 로드 실패 시 기존 PNG 장면에서 게임을 계속할 수 있다. 움직임 줄이기와 일시 정지는 주민·전투 연출에도 적용된다.
- 실행 시 외부 CDN 없음. Three.js 0.180.0과 esbuild 0.25.10을 CI에서 번들링하며 Three.js 라이선스를 배포물에 포함한다.
