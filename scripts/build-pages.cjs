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
  "animation/fx-impact.png",
  "animation/front.png",
  "animation/quarter.png",
  "animation/edge.png",
  "animation/reverse-quarter.png"
];
const files = ['index.html', 'combat.js', 'art-handoff/coopnight/source-3d/models/environment-pack.glb', ...assets.map(file => prefix + file)];
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const match of html.matchAll(/art-handoff\/coopnight\/browser\/[a-zA-Z0-9_/-]+\.png/g)) {
  assert(files.includes(match[0]), 'Missing static artwork in Pages package: ' + match[0]);
}
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
fs.writeFileSync(path.join(out, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
fs.writeFileSync(path.join(out, 'version.json'), JSON.stringify({commit:process.env.GITHUB_SHA || null, title:'꼬꼬마을: 읽어서 지켜요'}, null, 2)+'\n');
console.log('Packaged ' + files.length + ' runtime files for GitHub Pages.');
