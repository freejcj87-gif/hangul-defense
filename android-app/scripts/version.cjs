'use strict';
/* 앱 버전 규칙(정본: 이 파일).
   - 게임 버전 = index.html의 스크립트 캐시 문자열 `?v=X.Y` 또는 `?v=X.Y.Z` (test-dom.cjs가 모든 스크립트에서 같은 값인지 이미 검사한다).
   - versionName = 게임 버전 그대로(같은 게임 버전을 다시 올리면 `-bB`를 붙인다).
   - versionCode = X*1,000,000 + Y*10,000 + Z*100 + B. B는 같은 게임 버전을 Play에 다시 올릴 때 쓰는 빌드 번호 0~99(환경 변수 HD_BUILD_NUMBER).
     예: 0.14 → 140000, 0.14.1 → 140100, 0.14.1을 한 번 더 → 140101, 1.0 → 1000000. 게임 버전이 오르면 versionCode도 반드시 오른다.
   Play는 한 번 올린 versionCode를 다시 받지 않는다. 같은 게임 버전으로 껍데기만 고쳐 다시 올릴 때만 B를 올린다. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const INDEX = path.resolve(__dirname, '..', '..', 'index.html');

function gameVersion(html) {
  const found = [...html.matchAll(/\.js\?v=([0-9]+(?:\.[0-9]+){1,2})(?![0-9.])/g)].map(m => m[1]);
  if (!found.length) throw new Error('index.html에서 스크립트 캐시 문자열 ?v=를 찾지 못했어요');
  const uniq = [...new Set(found)];
  if (uniq.length !== 1) throw new Error('index.html의 ?v= 값이 서로 달라요: ' + uniq.join(', '));
  return uniq[0];
}

function appVersion(version, build = 0) {
  if (!/^[0-9]+(\.[0-9]+){1,2}$/.test(version)) throw new Error('게임 버전 형식이 X.Y 또는 X.Y.Z가 아니에요: ' + version);
  const parts = version.split('.').map(Number);
  while (parts.length < 3) parts.push(0);
  const [major, minor, patch] = parts;
  const b = typeof build === 'string' && build.trim() === '' ? 0 : Number(build);
  if (!Number.isInteger(b) || b < 0 || b > 99) throw new Error('빌드 번호(HD_BUILD_NUMBER)는 0~99 정수여야 해요: ' + build);
  if (minor > 99 || patch > 99) throw new Error('부 버전·수정 번호는 99 이하여야 해요: ' + version);
  const versionCode = major * 1000000 + minor * 10000 + patch * 100 + b;
  if (versionCode < 1 || versionCode > 2100000000) throw new Error('versionCode가 Play 허용 범위(1~2,100,000,000)를 벗어났어요: ' + versionCode);
  return { gameVersion: version, build: b, versionCode, versionName: b ? version + '-b' + b : version };
}

function current(build = process.env.HD_BUILD_NUMBER || 0) {
  return appVersion(gameVersion(fs.readFileSync(INDEX, 'utf8')), build);
}

function properties(v) {
  return '# prepare-web.cjs가 만든다(커밋하지 않음). 규칙: android-app/scripts/version.cjs\n'
    + 'versionCode=' + v.versionCode + '\n'
    + 'versionName=' + v.versionName + '\n'
    + 'gameVersion=' + v.gameVersion + '\n';
}

function selfTest() {
  let n = 0;
  const eq = (a, b) => { assert.deepEqual(a, b); n++; };
  eq(appVersion('0.14').versionCode, 140000);
  eq(appVersion('0.14').versionName, '0.14');
  eq(appVersion('0.14.1').versionCode, 140100);
  eq(appVersion('0.14.1', 2).versionCode, 140102);
  eq(appVersion('0.14.1', '2').versionName, '0.14.1-b2');
  eq(appVersion('0.14', '').versionCode, 140000);
  eq(appVersion('1.0').versionCode, 1000000);
  // 순서: 빌드 번호를 끝까지 올려도 다음 게임 버전보다 작다
  assert(appVersion('0.14', 99).versionCode < appVersion('0.14.1').versionCode); n++;
  assert(appVersion('0.14.99', 99).versionCode < appVersion('0.15').versionCode); n++;
  assert(appVersion('0.99.99', 99).versionCode < appVersion('1.0').versionCode); n++;
  for (const bad of [['0.14', 100], ['0.14', -1], ['0.14', 1.5], ['0.100'], ['0.14.100'], ['v0.14'], ['0.14.1.2']]) {
    assert.throws(() => appVersion(...bad)); n++;
  }
  eq(gameVersion('<script src="combat.js?v=0.14"></script><script src="village.js?v=0.14" defer>'), '0.14');
  eq(gameVersion('<script src="a.js?v=0.14.1"></script><script src="b.js?v=0.14.1">'), '0.14.1');
  assert.throws(() => gameVersion('<script src="a.js?v=0.14"></script><script src="b.js?v=0.13">')); n++;
  assert.throws(() => gameVersion('<script src="a.js"></script>')); n++;
  const now = current(0);
  assert(now.versionCode > 0); n++;
  console.log('PASS version rule ' + n + ' checks. Current game ' + now.gameVersion + ' -> versionCode ' + now.versionCode + ', versionName ' + now.versionName);
}

module.exports = { gameVersion, appVersion, current, properties };

if (require.main === module) {
  if (process.argv.includes('--self-test')) selfTest();
  else console.log(JSON.stringify(current(), null, 2));
}
