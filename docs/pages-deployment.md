# GitHub Pages 테스트 배포

꼬꼬마을 coopnight-web과 같은 GitHub Pages를 사용합니다. Higgsfield는 사용하지 않습니다.

## 최초 설정
GitHub 저장소 Settings → Pages → Build and deployment → Source에서 **GitHub Actions**를 선택합니다.
설정 주소: https://github.com/freejcj87-gif/hangul-defense/settings/pages

이 저장소는 비공개입니다. GitHub Free에서 Pages는 공개 저장소에만 제공됩니다. 해당 계정에서 비공개 Pages가 지원되지 않는 경우, 원본 자산과 이력을 포함한 개발 저장소 전체를 공개로 전환하지 말고 실행 파일만 담은 별도 공개 배포 저장소를 사용해야 합니다.

## 배포
main에 게임 파일을 푸시하면 `Deploy game to GitHub Pages`가 규칙 검사 후 배포합니다.
최초 설정 후 Actions에서 해당 워크플로의 Run workflow 또는 실패 작업 Re-run을 실행합니다.
실제 접속 주소는 성공한 deploy 작업의 Environment URL을 기준으로 합니다. 설정 전에는 예상 주소를 동작하는 링크로 안내하지 않습니다.

## 배포 범위
`scripts/build-pages.cjs`는 HTML, 전투 스크립트, 게임에서 사용하는 PNG 20개만 패키징합니다. Blender·GLB·참고 영상·미사용 원본·로컬 경로 문서는 포함하지 않습니다.
공개 Pages에는 암호가 없으며 배포한 실행 파일과 아트에 누구나 접근할 수 있습니다. robots.txt는 검색 수집 제외 요청일 뿐 접근 제어가 아닙니다.
