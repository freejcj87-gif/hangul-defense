'use strict';
/* app-shell.js 검사. 기기·브라우저 없이 Capacitor Android 다리(PluginHeaders·nativeCallback·nativePromise)를 흉내 내고,
   묶은 www/app-shell.js를 그대로 돌린다(@capacitor/core의 실제 플러그인 연결 코드가 함께 돈다). 실제 기기 동작은 QA가 따로 확인한다.
   사용: npm run web(또는 sync) 뒤에 node scripts/test-shell.cjs [묶음 경로] */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const bundle = fs.readFileSync(process.argv[2] || path.resolve(__dirname, '..', 'www', 'app-shell.js'), 'utf8');
const tick = () => new Promise(done => setTimeout(done, 0));

async function start(initial) {
  const calls = [], listeners = {}, winListeners = {}, timers = [];
  const st = { phase: initial.phase, paused: !!initial.paused };
  const session = new Map(Object.entries(initial.session || {}));
  const pauseButton = { click() { calls.push('pause-click'); if (st.phase !== 'start' && st.phase !== 'ending') { st.paused = !st.paused; calls.push('save'); } } };
  const drawer = { open: !!initial.drawer };
  const document = { hidden: false, documentElement: { dataset: {} }, getElementById: id => (id === 'pause' ? pauseButton : id === 'drawer' ? drawer : null), addEventListener() {} };
  const win = {
    document, console,
    androidBridge: { postMessage() {} },
    getVillageState: () => ({ phase: st.phase, paused: st.paused, running: st.phase !== 'start' && st.phase !== 'ending' && !st.paused }),
    save: () => calls.push('save'),
    setInterval: fn => { timers.push(fn); return timers.length; },
    addEventListener: (type, fn, capture) => { winListeners[type] = { fn, capture }; },
    sessionStorage: { getItem: k => (session.has(k) ? session.get(k) : null), setItem: (k, v) => session.set(k, String(v)) },
    location: { reload: () => calls.push('reload') },
    Capacitor: {
      PluginHeaders: [
        { name: 'App', methods: [{ name: 'addListener', rtype: 'callback' }, { name: 'removeListener', rtype: 'promise' }, { name: 'minimizeApp', rtype: 'promise' }, { name: 'exitApp', rtype: 'promise' }] },
        { name: 'ScreenAwake', methods: [{ name: 'set', rtype: 'promise' }] },
      ],
      nativeCallback(plugin, method, options, callback) { if (plugin === 'App' && method === 'addListener') listeners[options.eventName] = callback; return 'callback-1'; },
      nativePromise(plugin, method, options) { calls.push(plugin + '.' + method + (plugin === 'ScreenAwake' ? ':' + options.on : '')); return Promise.resolve(); },
    },
  };
  win.window = win;
  win.globalThis = win;
  vm.runInNewContext(bundle, win);
  await tick();
  const beat = async () => { for (const fn of timers) fn(); await tick(); };
  return { calls, listeners, winListeners, drawer, st, win, session, beat };
}

(async () => {
  let n = 0;
  const ok = label => { n++; console.log('PASS ' + label); };

  let r = await start({ phase: 'ask' });
  assert.equal(r.win.document.documentElement.dataset.shell, 'android');
  for (const e of ['backButton', 'pause', 'resume']) assert(r.listeners[e], 'listener ' + e + ' (have ' + Object.keys(r.listeners).join(',') + ')');
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
  r.listeners.pause(); await tick();
  assert.deepEqual(r.calls.filter(c => !c.startsWith('ScreenAwake')), ['pause-click', 'save']);
  r.listeners.pause(); await tick();
  assert.deepEqual(r.calls.filter(c => !c.startsWith('ScreenAwake')).slice(2), ['save']);
  assert.equal(r.st.paused, true);
  ok('app goes to background while running -> game pause; again -> save only (never un-pauses)');

  r = await start({ phase: 'ending' });
  r.listeners.pause(); await tick();
  assert.deepEqual(r.calls.filter(c => !c.startsWith('ScreenAwake')), ['save']);
  ok('app goes to background on ending card -> save only');

  r = await start({ phase: 'ask' });
  await r.beat(); await r.beat();
  assert.deepEqual(r.calls, ['ScreenAwake.set:true']);
  r.st.paused = true; await r.beat();
  r.st.paused = false; r.st.phase = 'start'; await r.beat(); await r.beat();
  r.st.phase = 'learn'; await r.beat();
  r.win.document.hidden = true; await r.beat();
  assert.deepEqual(r.calls, ['ScreenAwake.set:true', 'ScreenAwake.set:false', 'ScreenAwake.set:true', 'ScreenAwake.set:false']);
  ok('screen stays on only while the wolf world runs (reading included), off when paused/start/hidden, called only on change');

  r = await start({ phase: 'ask' });
  assert(r.winListeners.webglcontextlost && r.winListeners.webglcontextlost.capture === true, 'capture-phase webglcontextlost listener');
  r.listeners.resume();
  assert.deepEqual(r.calls, []);
  r.winListeners.webglcontextlost.fn({});
  r.listeners.pause(); await tick();
  r.listeners.resume();
  assert.deepEqual(r.calls.filter(c => !c.startsWith('ScreenAwake')), ['pause-click', 'save', 'save', 'reload']);
  ok('WebGL context lost -> on next resume: save + reload once (no reload without a loss)');

  r = await start({ phase: 'start', session: { 'app-shell-gl-reload-at': String(Date.now() - 1000) } });
  r.winListeners.webglcontextlost.fn({});
  r.listeners.resume();
  assert.deepEqual(r.calls, []);
  ok('context lost again within 2 minutes of a recovery reload -> keep picture fallback (no reload loop)');

  console.log('PASS app shell ' + n + ' scenarios (simulated bridge)');
})().catch(error => { console.error(error); process.exit(1); });
