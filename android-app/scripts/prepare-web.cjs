'use strict';
/* 웹 게임을 앱에 넣을 묶음(android-app/www/)을 만든다. `npm run sync`가 이것을 돌린 뒤 `cap sync android`로 앱 프로젝트에 복사한다.
   1) 저장소 루트 scripts/build-pages.cjs로 Pages와 똑같은 묶음(.pages-build/)을 새로 만든다(남은 옛 생성물이 앱에 섞이지 않게 먼저 지운다).
   2) www/로 복사한다(robots.txt·.nojekyll은 웹 전용이라 뺀다).
   3) 앱 안 index.html에만 네 가지를 고친다(웹 배포 파일은 그대로):
      - 바닥글 저장 문장: "이 브라우저에" → "이 기기에"(정책 03 문서 §4 기준 문장).
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
/* 저장 위치 기준 문장(정책 03 문서 §4): 웹판 바닥글은 "이 브라우저에", 앱 바닥글은 짧은 문장 "이 기기에". 고쳐 쓰지 않고 글자 그대로 쓴다 */
swap('<span id="saveNote">게임 기록은 이 브라우저에 저장되고, 개발자에게 보내지 않아요.</span>', '<span id="saveNote">게임 기록은 이 기기에 저장되고, 개발자에게 보내지 않아요.</span>', '바닥글 저장 문장');
fs.writeFileSync(indexFile, html);

/* app-shell.js가 기대는 게임 쪽 자리(겹창·단추 id, 진행 파일 훅, 도움말의 오픈소스 고지 제목). 게임이 바뀌어 하나라도 없어지면
   앱에서 뒤로 가기·진행 파일 옮기기·오픈소스 고지가 조용히 깨지므로 여기서 멈춘다. 고칠 때는 shell/app-shell.js와 함께 고친다. */
const bookui = fs.readFileSync(path.join(www, 'bookui.js'), 'utf8');
const hooks = [
  ...['drawer', 'pause', 'guardian', 'gBody', 'gNote', 'importFile', 'guardClose', 'gate', 'gateClose', 'bookScreen', 'bookClose'].map(id => ['index.html', html, 'id="' + id + '"']),
  ['bookui.js', bookui, 'window.__lastExport='], // 내보내기: 방금 만든 진행 파일 {name,text}
  ['bookui.js', bookui, 'a.download=name'], // 내보내기: 웹은 a download 누름. 앱은 이 누름을 잡는다
  ['bookui.js', bookui, 'window.__importText=importText'], // 불러오기: 앱이 읽은 글을 넘길 곳
  ['bookui.js', bookui, "$('importFile').click()"], // 불러오기: 웹은 파일 고르기. 앱은 이 누름을 잡는다
  ['bookui.js', bookui, "para(box,'오픈소스 고지','g-h')"], // 도움말: 앱이 그 아래에 '오픈소스 고지 전체 보기'를 붙인다
];
for (const [file, text, needle] of hooks) {
  const count = text.split(needle).length - 1;
  assert.equal(count, 1, file + '에서 앱 껍데기가 쓰는 자리 "' + needle + '"가 ' + count + '번 나와요(1번이어야 함). shell/app-shell.js와 이 목록을 함께 고쳐 주세요.');
}

/* 아동 앱: 게임 코드에 바깥 주소가 없어야 한다(바깥 링크·외부 요청 없음, 정책 04 §3·등급 설문 "바깥 링크 없음"). three.js를 묶은 village.js는 뺀다
   (라이브러리 안의 XML 이름공간 문자열 등). 개인정보처리방침 본문(notes.js NOTES.PRIVACY)도 여기서 함께 걸린다. */
for (const file of ['index.html', 'combat.js', 'world.js', 'questions.js', 'questions-gen.js', 'book.js', 'notes.js', 'bookui.js', 'testmode.js']) {
  const found = fs.readFileSync(path.join(www, file), 'utf8').match(/https?:\/\/[^\s"'`)<]*/g);
  assert(!found, file + '에 바깥 주소가 있어요: ' + (found || []).slice(0, 3).join(', ') + ' (앱 안에서 바깥으로 나가는 길이 생기지 않게 확인해 주세요)');
}
/* 처리방침 본문의 빈칸(대괄호: 시행일·개발자 이름·문의처 등)은 게시 전에 사람이 채운다. 빌드는 막지 않고 알린다 */
const blanks = [...new Set((require(path.join(www, 'notes.js')).PRIVACY.flat(2).join('\n').match(/\[[^\]]+\]/g) || []))];
if (blanks.length) console.log((process.env.GITHUB_ACTIONS ? '::warning::' : '') + 'Privacy text still has blanks to fill before release: ' + blanks.join(' '));

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

/* 오픈소스 고지(정책 04 문서 §2.1): 앱 안 오프라인 화면 oss-licenses.html. 보호자 화면 도움말(보호자 안내 포함)의 '오픈소스 고지 전체 보기'
   (app-shell.js가 붙임)가 이 파일을 겹창 안 iframe으로 연다. 그래서 '게임으로' 링크는 두지 않는다(iframe 안에서 게임이 또 열린다).
   AndroidX 등 Gradle 의존성은 Apache-2.0 전문 한 벌로 고지한다. 이름 목록은 CI의 release-dependencies.txt(첫 실행 44219925998)에 맞춘 것. */
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const lic = (...p) => fs.readFileSync(path.join(...p), 'utf8').trim();
const notices = [
  ['three.js 0.180.0 (MIT)', lic(repo, 'node_modules', 'three', 'LICENSE')],
  ['Capacitor: @capacitor/core, @capacitor/android ' + require('@capacitor/core/package.json').version + ' (MIT)', lic(appRoot, 'node_modules', '@capacitor', 'core', 'LICENSE')],
  ['@capacitor/app ' + require('@capacitor/app/package.json').version + ' (MIT)', lic(appRoot, 'node_modules', '@capacitor', 'app', 'LICENSE')],
  ['AndroidX (Activity, AppCompat, Core, CoordinatorLayout, Fragment, Lifecycle, SplashScreen, WebKit 외), Apache Cordova Android, Kotlin 표준 라이브러리, kotlinx.coroutines, Guava ListenableFuture, JetBrains·AndroidX 주석 라이브러리 (Apache License 2.0)', lic(appRoot, 'shell', 'licenses', 'Apache-2.0.txt')],
];
fs.writeFileSync(path.join(www, 'oss-licenses.html'), '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>오픈소스 고지 · 꼬꼬마을</title>'
  + '<style>body{margin:0;padding:16px;background:#fff9e9;color:#294235;font-family:system-ui,sans-serif;line-height:1.5}h1{font-size:20px;margin:0 0 8px}h2{font-size:15px;margin-top:24px}pre{white-space:pre-wrap;word-break:break-word;font-size:12px;background:#fff;border:1px solid #e6d9b8;border-radius:10px;padding:12px}</style></head>'
  + '<body><h1>오픈소스 고지</h1><p>꼬꼬마을은 아래 오픈소스 소프트웨어를 사용합니다.</p>'
  + notices.map(([name, text]) => '<h2>' + esc(name) + '</h2><pre>' + esc(text) + '</pre>').join('') + '</body></html>\n');

for (const file of ['index.html', 'village.js', 'combat.js', 'world.js', 'questions.js', 'questions-gen.js', 'book.js', 'notes.js', 'bookui.js', 'app-shell.js', 'webview-old.html', 'oss-licenses.html', 'art-handoff/coopnight/source-3d/models/environment-pack.glb']) {
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
