# 한글 디펜스 0.4 — 살아 움직이는 꼬꼬마을

플레이: https://freejcj87-gif.github.io/hangul-defense/

GitHub Pages가 연결되어 있으며 main의 게임 파일을 변경하면 같은 주소에 자동 배포됩니다.

개발 인계: [HANDOVER.md](HANDOVER.md) · 우선순위별 작업: [TODO.md](TODO.md)

## 이번 장면
꼬꼬마을에서 인계한 실제 3D 모델로 농장 장면을 구성했습니다. 닭·병아리 배회, 일꾼 이동과 알 운반, 나무와 연기, 타워 발사·반동, 금화 연출을 포함합니다.
정답으로 골드를 얻고 타워를 강화하는 기존 규칙과 저장 형식은 유지됩니다. 주민의 생활 동작은 장식이며 별도의 골드 수입을 생성하지 않습니다.
원본 Unity 프로젝트는 수정하지 않았습니다. 자세한 자산/동작 범위는 [장면 구현 메모](docs/living-village.md)를 참고하세요.

## 로컬 실행
Node.js 22와 Python 3 기준:
```sh
npm install --no-save --package-lock=false three@0.180.0 esbuild@0.25.10
node scripts/build-pages.cjs
python -m http.server 8000 --directory .pages-build
```
http://localhost:8000 에 접속합니다. 원본 index.html만 열면 3D 번들이 없으므로 먼저 빌드해야 합니다.
진행은 주소와 브라우저별로 저장됩니다. WebGL/모델 로딩 실패 시 기본 PNG 마을에서 학습·전투는 계속됩니다.

## 검증
- `node test-dom.cjs`: 전투·보상·구매·저장·독해 힌트 검사.
- Playwright 1.56.1과 Chromium/WebKit 설치 후 `node test.cjs`: .pages-build를 제공하며 데스크톱·모바일 크기, 전투·저장·이미지 및 3D 주민 이동/정지/움직임 줄이기를 검사합니다.
- 배포 후 실제 URL의 HTML·스크립트·모델·이미지 응답과 커밋을 검사합니다.
- 실제 휴대폰 GPU·한국어 음성·체감 품질은 별도로 확인해야 합니다.

## 현재 학습 범위
6글자와 짧은 글 2개는 기술 시연용입니다. 연령 선택은 기록용이며 연령별 적응 학습은 아직 없습니다.
글자 정답은 20골드, 짧은 글 정답은 40골드입니다. 틀려도 골드는 잃지 않습니다.
성문은 다음 문제에서 최소 60으로 회복합니다. 효과음·속도·움직임 설정은 현재 접속 동안 적용됩니다.
녹음·클라우드 저장·학습 개인정보 전송은 없습니다.

## 자산
인계 패키지 원본과 출처 문서는 art-handoff에 보존합니다. 사용자의 공개 전환 및 GitHub Pages 배포 승인으로 이 저장소와 웹 실행판이 공개되어 있습니다.
배포물에는 실제 사용하는 PNG·GLB와 실행 코드만 포함하며 BLEND/참고 영상은 포함하지 않습니다.
Three.js MIT 라이선스를 배포물에 함께 제공합니다.
