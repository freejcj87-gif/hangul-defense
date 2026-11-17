'use strict';
/* app-shell.js(뒤로 가기·앱 내려감) 검사. 기기·브라우저 없이 Capacitor Android 다리(PluginHeaders·nativeCallback·nativePromise)를 흉내 내고,
   묶은 www/app-shell.js를 그대로 돌린다(@capacitor/core의 실제 플러그인 연결 코드가 함께 돈다). 실제 기기 동작은 QA가 따로 확인한다.
   사용: npm run web 뒤에 node scripts/test-shell.cjs [묶음 경로] */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const bundle = fs.readFileSync(process.argv[2] || path.resolve(__dirname, '..', 'www', 'app-shell.js'), 'utf8');
const tick = () => new Promise(done => setTimeout(done, 0));

async function start(initial) {
  const calls = [], listeners = {};
  const st = { phase: initial.phase, paused: !!initial.paused };
  const pauseButton = { click() { calls.push('pause-click'); if (st.phase !== 'start' && st.phase !== 'ending') { st.paused = !st.paused; calls.push('save'); } } };
  const drawer = { open: !!initial.drawer };
  const document = { documentElement: { dataset: {} }, getElementById: id => (id === 'pause' ? pauseButton : id === 'drawer' ? drawer : null), addEventListener() {} };
  const win = {
    document, console,
    androidBridge: { postMessage() {} },
    getVillageState: () => ({ phase: st.phase, paused: st.paused, running: st.phase !== 'start' && st.phase !== 'ending' && !st.paused }),
    save: () => calls.push('save'),
    Capacitor: {
      PluginHeaders: [{ name: 'App', methods: [{ name: 'addListener', rtype: 'callback' }, { name: 'removeListener', rtype: 'promise' }, { name: 'minimizeApp', rtype: 'promise' }, { name: 'exitApp', rtype: 'promise' }] }],
      nativeCallback(plugin, method, options, callback) { if (plugin === 'App' && method === 'addListener') listeners[options.eventName] = callback; return 'callback-1'; },
      nativePromise(plugin, method) { calls.push(plugin + '.' + method); return Promise.resolve(); },
    },
  };
  win.window = win;
  win.globalThis = win;
  vm.runInNewContext(bundle, win);
  await tick();
  return { calls, listeners, drawer, st, win };
}

(async () => {
  let n = 0;
  const ok = label => { n++; console.log('PASS ' + label); };

  let r = await start({ phase: 'ask' });
  assert.equal(r.win.document.documentElement.dataset.shell, 'android');
  assert(r.listeners.backButton && r.listeners.pause, 'listeners: ' + Object.keys(r.listeners).join(','));
  r.listeners.backButton({ canGoBack: false });
  assert.deepEqual(r.calls, ['pause-click', 'save']);
  assert.equal(r.st.paused, true);
  r.listeners.backButton({ canGoBack: false }); await tick();
  assert.deepEqual(r.calls.slice(2), ['save', 'App.minimizeApp']);
  ok('back while playing -> pause (game saves); back again -> save + minimize, never exitApp');

  r = await start({ phase: 'start' });
  r.listeners.backButton({}); await tick();
  assert.deepEqual(r.calls, ['save', 'App.minimizeApp']);
  ok('back on start screen -> save + minimize');

  r = await start({ phase: 'ask', drawer: true });
  r.listeners.backButton({}); await tick();
  assert.equal(r.drawer.open, false);
  assert.deepEqual(r.calls, []);
  assert.equal(r.st.paused, false);
  ok('back with settings drawer open -> closes drawer only');

  r = await start({ phase: 'reward' });
  r.listeners.pause();
  assert.deepEqual(r.calls, ['pause-click', 'save']);
  r.listeners.pause();
  assert.deepEqual(r.calls.slice(2), ['save']);
  assert.equal(r.st.paused, true);
  ok('app goes to background while running -> game pause; again -> save only (never un-pauses)');

  r = await start({ phase: 'ending' });
  r.listeners.pause();
  assert.deepEqual(r.calls, ['save']);
  ok('app goes to background on ending card -> save only');

  console.log('PASS app shell ' + n + ' scenarios (simulated bridge)');
})().catch(error => { console.error(error); process.exit(1); });
