'use strict';
/* 웹 게임을 앱에 넣을 묶음(android-app/www/)을 만든다. `npm run sync`가 이것을 돌린 뒤 `cap sync android`로 앱 프로젝트에 복사한다.
   1) 저장소 루트 scripts/build-pages.cjs로 Pages와 똑같은 묶음(.pages-build/)을 새로 만든다(남은 옛 생성물이 앱에 섞이지 않게 먼저 지운다).
   2) www/로 복사한다(robots.txt·.nojekyll은 웹 전용이라 뺀다).
   3) 앱 안 index.html에만 세 가지를 고친다(웹 배포 파일은 그대로):
      - viewport-fit=cover 빼기: 게임은 안전 영역(env(safe-area-inset-*))을 쓰지 않는다. 앱에서는 Capacitor System Bars(insetsHandling native)가
        WebView를 상태 표시줄·탐색 막대 안쪽에 두게 해서, Android 15+ 전체 화면(edge-to-edge)에서도 화면이 막대 밑으로 들어가지 않게 한다.
      - 길게 누르기 글자 선택·탭 강조색 끄기.
      - app-shell.js(뒤로 가기·앱 내려감 처리, shell/app-shell.js) 붙이기.
   4) 버전(scripts/version.cjs)을 android/app/hd-version.properties에 쓴다(app/build.gradle이 읽는다).
   고칠 자리가 index.html에서 정확히 한 번씩 나오지 않으면 멈춘다(게임 쪽 HTML이 바뀌면 여기서 알 수 있게). */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const version = require('./version.cjs');

const appRoot = path.resolve(__dirname, '..');
const repo = path.resolve(appRoot, '..');
const pages = path.join(repo, '.pages-build');
const www = path.join(appRoot, 'www');
const WEB_ONLY = new Set(['robots.txt', '.nojekyll']);

fs.rmSync(pages, { recursive: true, force: true });
execFileSync(process.execPath, [path.join(repo, 'scripts', 'build-pages.cjs')], { cwd: repo, stdio: 'inherit' });

fs.rmSync(www, { recursive: true, force: true });
fs.cpSync(pages, www, { recursive: true, filter: src => !(path.dirname(src) === pages && WEB_ONLY.has(path.basename(src))) });

const indexFile = path.join(www, 'index.html');
let html = fs.readFileSync(indexFile, 'utf8');
const v = version.appVersion(version.gameVersion(html), process.env.HD_BUILD_NUMBER || 0);
function swap(from, to, label) {
  const count = html.split(from).length - 1;
  assert.equal(count, 1, 'index.html 앱 수정 자리 "' + label + '"가 ' + count + '번 나와요(1번이어야 함). prepare-web.cjs를 고쳐 주세요.');
  html = html.replace(from, () => to);
}
swap(',viewport-fit=cover"', '"', 'viewport-fit=cover');
swap('</head>', '<style id="app-shell-css">html{-webkit-tap-highlight-color:transparent}body{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}</style></head>', '</head>');
swap('</body>', '<script src="app-shell.js" defer></script></body>', '</body>');
fs.writeFileSync(indexFile, html);

require('esbuild').buildSync({
  entryPoints: [path.join(appRoot, 'shell', 'app-shell.js')],
  bundle: true, format: 'iife', target: 'es2020', minify: true, legalComments: 'eof',
  outfile: path.join(www, 'app-shell.js'),
});

/* WebView가 capacitor.config.json의 android.minWebViewVersion(108)보다 낮거나 첫 화면을 못 불러올 때 Capacitor가 여는 화면(server.errorPath).
   108 근거: 게임 화면 배치가 100svh(Chrome 108)·CSS translate/scale 속성(104)·:has()(105)를 쓴다. 오래된 엔진에서도 보이게 기본 CSS만 쓴다. */
fs.writeFileSync(path.join(www, 'webview-old.html'), '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>꼬꼬마을</title>'
  + '<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#253e34;color:#fff9df;font-family:sans-serif;text-align:center;padding:24px;box-sizing:border-box}div{max-width:560px;line-height:1.6}h1{font-size:22px}p{font-size:16px;color:#e8efd9}</style></head>'
  + '<body><div><h1>꼬꼬마을을 열지 못했어요</h1><p>보호자께: 이 기기의 화면 엔진(Android System WebView)이 오래되었거나 화면을 불러오지 못했어요.</p>'
  + '<p>Play 스토어에서 \'Android System WebView\'와 \'Chrome\'을 업데이트한 뒤 앱을 다시 열어 주세요.</p></div></body></html>\n');

for (const file of ['index.html', 'village.js', 'combat.js', 'world.js', 'questions.js', 'questions-gen.js', 'app-shell.js', 'webview-old.html', 'art-handoff/coopnight/source-3d/models/environment-pack.glb']) {
  assert(fs.statSync(path.join(www, file)).isFile(), '앱 묶음에 없는 파일: ' + file);
}
for (const file of WEB_ONLY) assert(!fs.existsSync(path.join(www, file)), '웹 전용 파일이 앱 묶음에 들어갔어요: ' + file);

const appDir = path.join(appRoot, 'android', 'app');
if (fs.existsSync(appDir)) fs.writeFileSync(path.join(appDir, 'hd-version.properties'), version.properties(v));

let files = 0, bytes = 0;
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full); else { files++; bytes += fs.statSync(full).size; }
  }
})(www);
console.log('App web bundle: ' + files + ' files, ' + (bytes / 1048576).toFixed(1) + ' MB in android-app/www. Game ' + v.gameVersion + ' -> versionCode ' + v.versionCode + ', versionName ' + v.versionName + (fs.existsSync(appDir) ? '' : ' (android/ not created yet, version file skipped)'));
