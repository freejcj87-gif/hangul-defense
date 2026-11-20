'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const out = path.join(root, '.pages-build');
const prefix = 'art-handoff/coopnight/browser/';
const assets = [
  "backgrounds/background-meadow.png",
  "backgrounds/grass.png",
  "characters/chicken.png",
  "wolves/wolf.png",
  "buildings/coop.png",
  "buildings/store.png",
  "buildings/home-01.png",
  "buildings/home-02.png",
  "buildings/home-03.png",
  "buildings/home-04.png",
  "buildings/home-05.png",
  "buildings/tower-01.png",
  "buildings/tower-03.png",
  "buildings/tower-05.png",
  "buildings/tower-08.png",
  "buildings/tower-10.png",
  "buildings/fence.png",
  "animation/fx-impact.png",
  "animation/fx-ring.png",
  "animation/fx-dust.png",
  "animation/fx-feathers.png",
  "animation/front.png",
  "animation/quarter.png",
  "animation/edge.png",
  "animation/reverse-quarter.png"
];

// 0.15 아트(art-handoff/v015-v016, 묶음 원본은 outputs\art-v015-v016-20261117): 0.15가 쓰는 4개만 배포한다(GLB는 3D, PNG는 그림 화면).
// 성·성벽·성문·성탑은 0.16에서 넣고, 따로 된 바퀴(waterwheel)는 쓰지 않는다(물레방아 GLB 안의 바퀴를 돌린다).
const ART15_DIR = 'art-handoff/v015-v016/';
const art15 = ['watermill', 'bridge', 'wolf-king', 'thief-fox'];
const files = ['index.html', 'combat.js', 'world.js', 'questions-gen.js', 'questions.js', 'testmode.js', 'art-handoff/coopnight/source-3d/models/environment-pack.glb', ...assets.map(file => prefix + file),
  ...art15.flatMap(name => [ART15_DIR + 'glb/' + name + '.glb', ART15_DIR + 'png/' + name + '.png'])];
/* 수첩 MVP: 기록 모듈과 쪽지·카드 콘텐츠 */
files.push('book.js', 'notes.js', 'bookui.js');
/* 출시 준비: 개인정보처리방침 페이지(주소 …/hangul-defense/privacy/, launch/policy/03 §3). privacy/ 아래 파일을 모두 묶는다(개정 때 남기는 지난 판 privacy/YYYY-MM-DD.html도 함께).
   글은 scripts/privacy-page.cjs가 notes.js의 앱 안 본문에서 만든다. 둘이 어긋나면 빌드를 멈춘다(build) */
const PRIVACY_DIR = 'privacy';
const walk = dir => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  .flatMap(e => (e.isDirectory() ? walk(dir + '/' + e.name) : [dir + '/' + e.name]));
if (fs.existsSync(path.join(root, PRIVACY_DIR))) files.push(...walk(PRIVACY_DIR));
// 페이지(index.html)와 3D 스크립트(src/*.js)가 글자 그대로 적은 아트 경로. 참조했는데 묶지 않은 파일이 있으면 빌드를 멈춘다
// (실제 주소에서는 깨진 그림이나 코드 도형으로만 드러나서 놓치기 쉽다). 경로는 조각내지 말고 한 문자열로 적는다.
const ART_REF = /art-handoff\/(?:coopnight\/browser|coopnight\/source-3d\/models|v015-v016\/(?:glb|png))\/[a-zA-Z0-9/_-]+\.(?:png|glb)/g;
function references() {
  const sources = ['index.html', ...fs.readdirSync(path.join(root, 'src')).filter(file => file.endsWith('.js')).sort().map(file => 'src/' + file)];
  const found = new Map();
  for (const file of sources) {
    for (const match of fs.readFileSync(path.join(root, file), 'utf8').matchAll(ART_REF)) if (!found.has(match[0])) found.set(match[0], file);
  }
  return found;
}
function build() {
  for (const [file, from] of references()) assert(files.includes(file), 'Missing artwork in Pages package: ' + file + ' (referenced by ' + from + ')');
  assert(files.includes('privacy/index.html'), 'Missing privacy policy page: privacy/index.html');
  assert(require('./privacy-page.cjs').same(), 'privacy/index.html differs from the in-app policy (notes.js). Run: node scripts/privacy-page.cjs');
  fs.mkdirSync(out, { recursive: true });
  for (const file of files) {
    const source = path.join(root, file);
    assert(fs.statSync(source).isFile(), 'Missing runtime file: ' + file);
    const target = path.join(out, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
  require('esbuild').buildSync({entryPoints:[path.join(root,'src/village.js')],bundle:true,format:'iife',target:'es2020',minify:true,legalComments:'eof',outfile:path.join(out,'village.js')});
  fs.copyFileSync(path.join(root,'node_modules/three/LICENSE'),path.join(out,'THREE-LICENSE.txt'));
  fs.writeFileSync(path.join(out, '.nojekyll'), '');
  // 방침 경로만 열어 둔다(store/05 §1.1. 하위 경로 robots는 크롤러가 읽는 자리가 아니라 정책상 차단 요인은 아님, policy/03 §3)
  fs.writeFileSync(path.join(out, 'robots.txt'), 'User-agent: *\nAllow: /hangul-defense/privacy/\nDisallow: /\n');
  fs.writeFileSync(path.join(out, 'version.json'), JSON.stringify({commit:process.env.GITHUB_SHA || null, title:'꼬꼬마을: 한글 읽기로 마을 지키기'}, null, 2)+'\n');
  console.log('Packaged ' + files.length + ' runtime files for GitHub Pages.');
}
// test-dom.cjs가 묶음 목록·참조 검사를 빌드 없이 읽는다(require). `node scripts/build-pages.cjs`로 직접 실행할 때만 빌드한다.
module.exports = { files, art15, ART15_DIR, references };
if (require.main === module) build();
