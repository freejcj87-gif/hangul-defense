'use strict';
/* 개인정보처리방침 웹 페이지(privacy/index.html)를 앱 안 본문(notes.js의 NOTES.PRIVACY)에서 만든다. 두 글은 늘 같은 글이다.
   node scripts/privacy-page.cjs          privacy/index.html을 다시 쓴다(notes.js 맨 위 POLICY를 채우거나 PRIVACY를 고친 뒤)
   node scripts/privacy-page.cjs --check  다시 만든 글과 파일이 다르면 실패(test-dom.cjs · build-pages.cjs도 같은 검사를 한다)
   게시 주소: launch/policy/03 §3 · store/05 §1(아래 URL). Console 개인정보처리방침 칸에는 끝 빗금까지 넣는다.
   페이지는 정적 HTML 한 장: 스크립트·바깥 글꼴·그림·추적 없음(CSP 메타로 바깥 요청을 막는다). 패드·폰에서 읽기 좋게 글 폭만 줄인다. */
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'privacy', 'index.html');
const URL = 'https://freejcj87-gif.github.io/hangul-defense/privacy/';
const BULLET = '· ';
const fresh = () => { const f = require.resolve(path.join(ROOT, 'notes.js')); delete require.cache[f]; return require(f); };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const unesc = s => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
/* 채울 칸([개발자 이름] 같은 대괄호)은 노란 표시로 눈에 띄게 */
const inline = s => esc(s).replace(/\[[^\]\n]+\]/g, m => '<mark>' + m + '</mark>');
function lines(list) {
  let out = '', open = false;
  for (const t of list) {
    const li = t.startsWith(BULLET);
    if (li && !open) { out += '<ul>\n'; open = true; }
    if (!li && open) { out += '</ul>\n'; open = false; }
    out += li ? '<li>' + inline(t.slice(BULLET.length)) + '</li>\n' : '<p>' + inline(t) + '</p>\n';
  }
  if (open) out += '</ul>\n';
  return out;
}
const CSS = `:root{color-scheme:light dark;--bg:#fbf6e9;--card:#fffdf7;--ink:#263a2f;--soft:#5b6f62;--line:#e6dcc0;--accent:#2f6b4f;--mark:#ffe08a}
@media (prefers-color-scheme:dark){:root{--bg:#17221c;--card:#1e2b24;--ink:#eef3e8;--soft:#b3c3b7;--line:#33473c;--accent:#9fd3b2;--mark:#6b5200}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.75 system-ui,-apple-system,"Apple SD Gothic Neo","Noto Sans KR","Noto Sans CJK KR","Malgun Gothic",sans-serif;word-break:keep-all;overflow-wrap:anywhere}
main,footer{max-width:44rem;margin:0 auto;padding:0 16px}main{padding-top:28px}
h1{font-size:1.45rem;line-height:1.4;margin:0 0 .5rem}.meta{margin:0;color:var(--soft)}
section{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:6px 18px 10px;margin:14px 0}
h2{font-size:1.1rem;line-height:1.45;margin:12px 0 6px;color:var(--accent)}p{margin:6px 0}ul{margin:6px 0;padding-left:1.3em}li{margin:4px 0}
mark{background:var(--mark);color:inherit;padding:0 .25em;border-radius:4px;font-weight:700}
footer{padding-top:4px;padding-bottom:36px;color:var(--soft);font-size:.9rem}
@media (min-width:768px){body{font-size:18px}main{padding-top:44px}}`;
function render(N = fresh()) {
  const [[title, meta], ...rest] = N.PRIVACY;
  let html = '<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
    + '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'">\n'
    + '<meta name="referrer" content="no-referrer">\n'
    + '<title>' + esc(title) + '</title>\n'
    + '<meta name="description" content="' + esc(N.APP_NAME) + ' 개인정보처리방침">\n'
    + '<style>\n' + CSS + '\n</style>\n</head>\n<body>\n'
    + '<!-- scripts/privacy-page.cjs가 notes.js의 NOTES.PRIVACY(앱 안 본문)에서 만든 파일이다. 손으로 고치지 말고 notes.js를 고친 뒤 다시 만든다. -->\n'
    + '<main>\n<header>\n<h1>' + inline(title) + '</h1>\n' + meta.map(t => '<p class="meta">' + inline(t) + '</p>\n').join('') + '</header>\n';
  for (const [head, body] of rest) html += '<section>\n<h2>' + inline(head) + '</h2>\n' + lines(body) + '</section>\n';
  html += '</main>\n<footer>\n<p>이 글은 앱 안 보호자 화면의 \'보호자 안내 · 개인정보처리방침\'과 같은 글입니다.</p>\n<p>' + esc(URL) + '</p>\n</footer>\n</body>\n</html>\n';
  return html;
}
/* 렌더러와 따로, HTML에서 글만 다시 읽어 [제목, 줄들] 목록으로 돌린다(검사가 NOTES.PRIVACY와 그대로 비교한다) */
function parse(html) {
  const m = /<main>([\s\S]*?)<\/main>/.exec(String(html).replace(/\r\n/g, '\n'));
  if (!m) return [];
  const out = [];
  for (const [, tag, inner] of m[1].matchAll(/<(h1|h2|p|li)\b[^>]*>([\s\S]*?)<\/\1>/g)) {
    const text = unesc(inner.replace(/<[^>]+>/g, ''));
    if (tag === 'h1' || tag === 'h2') out.push([text, []]);
    else if (out.length) out[out.length - 1][1].push(tag === 'li' ? BULLET + text : text);
  }
  return out;
}
const read = () => fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n') : null;
const same = () => read() === render();
module.exports = { FILE, URL, render, parse, read, same };
if (require.main === module) {
  if (process.argv.includes('--check')) {
    if (!same()) { console.error('privacy/index.html이 notes.js의 개인정보처리방침과 다릅니다. node scripts/privacy-page.cjs 로 다시 만드세요.'); process.exit(1); }
    console.log('PASS privacy/index.html = notes.js NOTES.PRIVACY');
  } else {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, render());
    console.log('Wrote ' + path.relative(ROOT, FILE));
  }
}
