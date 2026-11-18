'use strict';
/* 앱 묶음 만들기(prepare-web.cjs) → Capacitor 동기화(cap sync android) → 빌드 종류에 맞게 앱 설정 마무리.
   npm run sync     출시용(release AAB). 시작 주소 https://localhost/ . 원격 디버깅은 release라 꺼짐.
   npm run sync:qa  QA용(디버그 APK, 패키지 .qa). 시작 주소 https://localhost/?test=1 (게임 테스트 모드, 0.14.1부터).
                    디버그 빌드라 원격 디버깅(chrome://inspect)은 Capacitor가 자동으로 켠다.
   두 종류가 같은 android/ 폴더를 쓰므로 QA 빌드 뒤 출시 빌드를 만들 때는 npm run sync를 다시 돌린다(CI는 QA → 출시 순서).
   ?test=1을 모르는 게임 버전(0.14)에서는 주소에 붙어도 아무 일이 없다. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

const QA_START = '/?test=1';
const qa = process.argv.includes('--qa');
const appRoot = path.resolve(__dirname, '..');
const run = args => execFileSync(process.execPath, args, { cwd: appRoot, stdio: 'inherit' });

run([path.join(__dirname, 'prepare-web.cjs')]);
run([path.join(appRoot, 'node_modules', '@capacitor', 'cli', 'bin', 'capacitor'), 'sync', 'android']);

const configFile = path.join(appRoot, 'android', 'app', 'src', 'main', 'assets', 'capacitor.config.json');
const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
if (qa) {
  config.server = { ...(config.server || {}), appStartPath: QA_START };
  fs.writeFileSync(configFile, JSON.stringify(config, null, '\t') + '\n');
} else {
  assert(!(config.server && config.server.appStartPath), '출시용 앱 설정에 appStartPath가 있으면 안 돼요');
}
assert(!('webContentsDebuggingEnabled' in (config.android || {})), 'webContentsDebuggingEnabled를 적으면 디버그·출시 자동 구분이 깨져요(디버그만 켜짐이 기본)');
console.log('Synced Android app for ' + (qa ? 'QA (debug APK, start ' + QA_START + ')' : 'release (AAB, start /)') + '.');
