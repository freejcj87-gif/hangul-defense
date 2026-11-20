# GitHub Pages 테스트 배포

현재 저장소는 사용자의 명시적 승인으로 공개 전환되어 있으며, GitHub Actions 방식 Pages가 활성화되어 있습니다. 별도 저장소나 Higgsfield는 사용하지 않습니다.

플레이 주소: https://freejcj87-gif.github.io/hangul-defense/

## 자동 배포

main의 지정된 게임 파일을 변경하면 `Deploy game to GitHub Pages`가 규칙 검사 → 빌드 → 배포 → 실제 URL 검사를 실행합니다. 이미 설정된 Pages를 다시 만들 필요는 없습니다.

- 워크플로: `.github/workflows/pages.yml`.
- 해당 workflow의 paths 필터에 포함된 런타임/아트/빌드 파일 변경이 배포를 유발합니다.
- 문서만 변경하면 자동 배포되지 않습니다.
- 새 소스/자산을 추가하면 paths 필터와 빌드 포함 목록을 함께 검토하세요.
- 배포 결과는 Actions의 deploy 작업과 Environment URL로 확인하세요.
- 실제 URL 검사에서 version.json의 커밋, HTML, combat.js, questions.js, village.js, GLB 5개(environment-pack + 0.15 아트 4개)와 PNG 29개(0.4 그림 25개 + 0.15 아트 4개) 응답을 확인합니다.

## 배포 범위

`scripts/build-pages.cjs`는 `.pages-build/`에 HTML, 전투 스크립트, 번들링한 3D 스크립트, environment-pack.glb, 사용 PNG 25개, 0.15 아트(`art-handoff/v015-v016/`의 물레방아·다리·늑대 왕·도둑 여우 GLB와 PNG 4쌍), Three.js 라이선스와 배포 메타데이터를 만듭니다. `index.html`과 `src/*.js`가 글자 그대로 적은 아트 경로 가운데 묶음에 없는 것이 있으면 빌드가 멈춥니다(경로는 한 문자열로 적습니다). 0.16 아트(성·성벽·성문·성탑)와 따로 된 바퀴는 저장소에만 있고 아직 배포하지 않습니다. BLEND·참고 영상·미사용 원본은 웹 배포에 포함하지 않습니다. 다만 공개 GitHub 저장소의 파일 공개 여부와 웹 배포 목록은 서로 다릅니다.

Three.js 0.180.0과 esbuild 0.25.10을 빌드에 사용하며 실행 중 외부 CDN은 필요하지 않습니다. robots.txt는 검색 수집 제외 요청이며 접근 제어는 아닙니다(개인정보처리방침 경로만 `Allow`).

## 개인정보처리방침 페이지(출시 준비)

- 주소: https://freejcj87-gif.github.io/hangul-defense/privacy/ (저장소 `privacy/index.html`). Play Console 개인정보처리방침 칸에 끝 빗금까지 넣습니다.
- 원본은 `notes.js`의 `NOTES.PRIVACY`(앱 안 보호자 화면 본문) 하나입니다. 개발자 이름·문의 이메일·시행일 등 채울 칸은 `notes.js` 맨 위 `POLICY`에서만 바꾸고, `node scripts/privacy-page.cjs`로 웹 페이지를 다시 만듭니다. 둘이 어긋나면 `test-dom.cjs`와 `build-pages.cjs`가 멈춥니다.
- 배포 묶음은 `privacy/` 아래 파일을 모두 넣습니다(개정 때 지난 판 `privacy/YYYY-MM-DD.html`도 함께). 배포 뒤 실제 URL 검사가 `privacy/`의 응답·제목·본문을 확인합니다.
- 자리표시 점검: `node scripts/check-release.cjs`(경고만), 제출 직전에는 `--strict`(남으면 실패).

## 스토어 이미지(출시 준비)

`Store screenshots` 워크플로(`.github/workflows/store-shots.yml`, 수동 실행 또는 `claude/release-kit` push)가 `scripts/store-shots.cjs`로 Play 스크린샷(태블릿 1920×1080)과 그래픽 이미지(1024×500)를 찍어 `store-shots` 묶음으로 올립니다. 브라우저를 쓰므로 PC에서는 돌리지 않습니다.

## 검증 이력

0.4 게임 배포: [Actions 42944631074](https://github.com/freejcj87-gif/hangul-defense/actions/runs/42944631074), 커밋 `b324a694cf54382453a12213b1dd08282c4e9d6a`. 배포 후 실제 URL 검사 통과.

다운로드용 테스트 패키지는 별도 `package-test.yml`에서 같은 빌드를 묶습니다. 숨김 디렉터리인 .pages-build를 포함하도록 `include-hidden-files: true`를 지정합니다.

로컬 실행, 브라우저 검사와 협업 방법은 [HANDOVER.md](../HANDOVER.md)를 참고하세요.
