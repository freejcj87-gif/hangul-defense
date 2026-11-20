'use strict';
/* app-shell.js 검사. 기기·브라우저 없이 Capacitor Android 다리(PluginHeaders·nativeCallback·nativePromise)와 아주 작은 가짜 DOM을 흉내 내고,
   묶은 www/app-shell.js를 그대로 돌린다(@capacitor/core의 실제 플러그인 연결 코드가 함께 돈다). 실제 기기 동작은 QA가 따로 확인한다.
   가짜 DOM은 app-shell.js가 쓰는 것만 있다(id 찾기, hidden, 잡기 단계 click, append/after/remove, children). 게임의 bookui.js는 돌리지 않고
   그 동작(겹창 닫기 단추, exportNow의 a download 누름, 파일 고르기 누름, 도움말 문단)을 흉내 낸다.
   사용: npm run web(또는 sync) 뒤에 node scripts/test-shell.cjs [묶음 경로] */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const bundle = fs.readFileSync(process.argv[2] || path.resolve(__dirname, '..', 'www', 'app-shell.js'), 'utf8');
const tick = () => new Promise(done => setTimeout(done, 0));
const FILE_PLUGIN = { name: 'ProgressFile', methods: [{ name: 'save', rtype: 'promise' }, { name: 'share', rtype: 'promise' }, { name: 'open', rtype: 'promise' }] };
const GATE_PLUGIN = { name: 'DeviceGate', methods: [{ name: 'confirm', rtype: 'promise' }, { name: 'status', rtype: 'promise' }] };
const NATIVE_TESTED = new Set(['ProgressFile', 'DeviceGate']);

class El {
  constructor(doc, tag, id) {
    this.doc = doc; this.tagName = String(tag).toUpperCase(); this.id = id || ''; this.hidden = false; this.textContent = '';
    this.className = ''; this.children = []; this.parent = null; this.attrs = {}; this.style = {}; this.onclick = null;
  }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'id') this.id = String(v); }
  getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; }
  append(...kids) { for (const k of kids) { if (k.parent) k.remove(); k.parent = this; this.children.push(k); } }
  after(node) { if (node.parent) node.remove(); const p = this.parent; node.parent = p; p.children.splice(p.children.indexOf(this) + 1, 0, node); }
  remove() { if (!this.parent) return; this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; }
  closest(sel) {
    assert.equal(sel, 'a[download]', 'fake DOM closest() supports only a[download]');
    for (let e = this; e; e = e.parent) if (e.tagName === 'A' && e.getAttribute('download') !== null) return e;
    return null;
  }
  click() {
    const ev = { type: 'click', target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    for (const l of this.doc.captureClicks) l(ev);
    if (this.onclick) this.onclick(ev);
    return ev;
  }
  find(id) { if (this.id === id) return this; for (const k of this.children) { const f = k.find(id); if (f) return f; } return null; }
}

async function start(initial, opt = {}) {
  const calls = [], listeners = {}, winListeners = {}, timers = [], observers = [];
  const st = { phase: initial.phase, paused: !!initial.paused };
  const session = new Map(Object.entries(initial.session || {}));
  const responses = opt.responses || {};
  const document = { hidden: false, documentElement: { dataset: {} }, captureClicks: [] };
  const el = (tag, id, parent) => { const e = new El(document, tag, id); if (parent) parent.append(e); return e; };
  const body = el('body', 'body');
  document.body = body;
  document.createElement = tag => el(tag);
  document.getElementById = id => body.find(id);
  document.addEventListener = (type, fn, capture) => { if (type === 'click' && capture === true) document.captureClicks.push(fn); };
  const pause = el('button', 'pause', body);
  pause.click = () => { calls.push('pause-click'); if (st.phase !== 'start' && st.phase !== 'ending') { st.paused = !st.paused; calls.push('save'); } };
  const drawer = el('details', 'drawer', body); drawer.open = !!initial.drawer;
  const guardian = el('div', 'guardian', body); guardian.hidden = !initial.guardian;
  const card = el('div', 'guardCard', guardian); card.className = 'start-card wide';
  el('div', 'gTabs', card);
  const gBody = el('div', 'gBody', card); gBody.className = 'g-body';
  const gNote = el('p', 'gNote', card);
  const importFile = el('input', 'importFile', card); importFile.hidden = true;
  const guardClose = el('button', 'guardClose', card); guardClose.onclick = () => { guardian.hidden = true; calls.push('guard-close'); };
  const gate = el('div', 'gate', body); gate.hidden = !initial.gate;
  const gateClose = el('button', 'gateClose', gate); gateClose.onclick = () => { gate.hidden = true; calls.push('gate-close'); };
  const bookScreen = el('div', 'bookScreen', body); bookScreen.hidden = !initial.book;
  const bookClose = el('button', 'bookClose', bookScreen); bookClose.onclick = () => { bookScreen.hidden = true; calls.push('book-close'); };
  const win = {
    document, console,
    androidBridge: { postMessage() {} },
    getVillageState: () => ({ phase: st.phase, paused: st.paused, running: st.phase !== 'start' && st.phase !== 'ending' && !st.paused }),
    save: () => calls.push('save'),
    setInterval: fn => { timers.push(fn); return timers.length; },
    addEventListener: (type, fn, capture) => { winListeners[type] = { fn, capture }; },
    sessionStorage: { getItem: k => (session.has(k) ? session.get(k) : null), setItem: (k, v) => session.set(k, String(v)) },
    location: { reload: () => calls.push('reload') },
    Book: { FILE_MAX: 1048576, BOOK: { GATE: { idle: opt.idle === undefined ? 1800 : opt.idle } } },
    MutationObserver: class { constructor(cb) { this.cb = cb; } observe(target, o) { observers.push({ target, o, cb: this.cb }); } },
    Capacitor: {
      PluginHeaders: [
        { name: 'App', methods: [{ name: 'addListener', rtype: 'callback' }, { name: 'removeListener', rtype: 'promise' }, { name: 'minimizeApp', rtype: 'promise' }, { name: 'exitApp', rtype: 'promise' }] },
        { name: 'ScreenAwake', methods: [{ name: 'set', rtype: 'promise' }] },
        ...(opt.noFilePlugin ? [] : [FILE_PLUGIN]),
        ...(opt.noGatePlugin ? [] : [GATE_PLUGIN]),
      ],
      nativeCallback(plugin, method, options, callback) { if (plugin === 'App' && method === 'addListener') listeners[options.eventName] = callback; return 'callback-1'; },
      nativePromise(plugin, method, options) {
        calls.push(plugin + '.' + method + (plugin === 'ScreenAwake' ? ':' + options.on : ''));
        if (NATIVE_TESTED.has(plugin)) { calls.push({ plugin, method, options: JSON.parse(JSON.stringify(options)) }); const r = responses[method]; return typeof r === 'function' ? r(options) : r instanceof Error ? Promise.reject(r) : Promise.resolve(r); }
        return Promise.resolve();
      },
    },
  };
  win.window = win;
  win.globalThis = win;
  vm.runInNewContext(bundle, win);
  await tick();
  const beat = async () => { for (const fn of timers) fn(); await tick(); };
  /* 가짜 MutationObserver: 그 대상의 관찰 함수를 부른다(실제 브라우저는 바뀐 뒤 마이크로태스크에서 부른다) */
  const mutate = target => { for (const o of observers) if (o.target === target) o.cb([]); };
  /* 게임 exportNow 흉내: __lastExport를 쓰고 a download를 눌러 지운 뒤, 알림을 쓴다 */
  const exportNow = (name, text) => {
    win.__lastExport = { name, text };
    const a = el('a', '', body); a.setAttribute('download', name); a.href = 'blob:https://localhost/x';
    const ev = a.click(); a.remove();
    gNote.textContent = '진행 파일을 만들었어요: ' + name;
    return ev;
  };
  const fileCalls = () => calls.filter(c => typeof c === 'object' && c.plugin === 'ProgressFile');
  const gateCalls = () => calls.filter(c => typeof c === 'object' && c.plugin === 'DeviceGate');
  const plain = () => calls.filter(c => typeof c === 'string' && !c.startsWith('ScreenAwake') && !c.startsWith('ProgressFile') && !c.startsWith('DeviceGate'));
  return { calls, listeners, winListeners, drawer, st, win, session, beat, mutate, exportNow, fileCalls, gateCalls, plain, body, guardian, gBody, gNote, importFile, gate, bookScreen, el, document };
}

(async () => {
  let n = 0;
  const ok = label => { n++; console.log('PASS ' + label); };

  /* ---------- 뒤로 가기 · 앱 내려감 · 화면 켜두기 · 3D 복구 (껍데기 1차) ---------- */
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

  /* ---------- 0.16 겹창: 뒤로 가기는 맨 위 겹창부터 닫는다 ---------- */
  r = await start({ phase: 'start', guardian: true, gate: true });
  r.listeners.backButton({}); await tick();
  assert.deepEqual(r.plain(), ['gate-close']);
  assert.equal(r.guardian.hidden, false);
  r.listeners.backButton({}); await tick();
  assert.deepEqual(r.plain(), ['gate-close', 'guard-close']);
  r.listeners.backButton({}); await tick();
  assert.deepEqual(r.plain(), ['gate-close', 'guard-close', 'save', 'App.minimizeApp']);
  ok('back with guardian gate over guardian screen -> closes gate, then guardian, then save + minimize');

  r = await start({ phase: 'ask', paused: true, book: true });
  r.listeners.backButton({}); await tick();
  assert.deepEqual(r.plain(), ['book-close']);
  assert.equal(r.st.paused, true);
  ok('back with footprint book open (paused) -> closes the book only, stays paused');

  /* ---------- 진행 파일 옮기기: 내보내기 ---------- */
  const NAME = 'kkomaeul-progress-20261120.json', TEXT = '{"fmt":"kkomaeul-progress","v":1}';
  r = await start({ phase: 'start', guardian: true }, { responses: { save: { done: true } } });
  let ev = r.exportNow(NAME, TEXT);
  assert.equal(ev.defaultPrevented, true, 'a download click is taken over in the app');
  await tick();
  let choice = r.win.document.getElementById('appFileChoice');
  assert(choice, 'export choice shown');
  assert.equal(r.gNote.textContent, '진행 파일을 어디에 둘까요?', 'choice note replaces the game note written after a.click()');
  assert.deepEqual(choice.children.map(b => b.textContent), ['📁 저장할 곳 고르기', '📤 다른 앱으로 보내기', '그만두기']);
  assert.equal(r.guardian.children[0].children.indexOf(choice), r.guardian.children[0].children.indexOf(r.gNote) + 1, 'choice sits right under the note');
  choice.children[0].onclick(); await tick(); await tick();
  assert.deepEqual(r.fileCalls(), [{ plugin: 'ProgressFile', method: 'save', options: { name: NAME, text: TEXT } }]);
  assert.equal(r.win.document.getElementById('appFileChoice'), null);
  assert(r.gNote.textContent.startsWith('진행 파일을 저장했어요: ' + NAME), r.gNote.textContent);
  ok('export -> choice under the note; "save" sends name + text to ProgressFile.save (system document screen) and reports saved');

  r = await start({ phase: 'start', guardian: true }, { responses: { save: { done: false } } });
  r.exportNow(NAME, TEXT); await tick();
  r.win.document.getElementById('appFileChoice').children[0].onclick(); await tick(); await tick();
  assert.equal(r.gNote.textContent, '저장하지 않았어요.');
  ok('export -> save cancelled in the document screen -> "not saved" note');

  r = await start({ phase: 'start', guardian: true }, { responses: { share: { done: true } } });
  r.exportNow(NAME, TEXT); await tick();
  r.win.document.getElementById('appFileChoice').children[1].onclick(); await tick(); await tick();
  assert.deepEqual(r.fileCalls().map(c => c.method), ['share']);
  assert(r.gNote.textContent.startsWith('보낼 곳을 골라'), r.gNote.textContent);
  ok('export -> "send to another app" opens the Android share sheet (ProgressFile.share)');

  r = await start({ phase: 'start', guardian: true }, { responses: { save: new Error('WRITE_FAILED') } });
  r.exportNow(NAME, TEXT); await tick();
  r.win.document.getElementById('appFileChoice').children[0].onclick(); await tick(); await tick();
  assert.equal(r.gNote.textContent, '파일을 저장하지 못했어요. 다시 해 주세요.');
  ok('export -> native failure -> "could not save" note, no crash');

  r = await start({ phase: 'start', guardian: true });
  r.exportNow(NAME, TEXT); await tick();
  r.win.document.getElementById('appFileChoice').children[2].onclick(); await tick();
  assert.deepEqual(r.fileCalls(), []);
  assert.equal(r.gNote.textContent, '내보내지 않았어요.');
  r.exportNow(NAME, TEXT); await tick();
  r.listeners.backButton({}); await tick();
  assert.equal(r.win.document.getElementById('appFileChoice'), null);
  assert.equal(r.guardian.hidden, false, 'back removes only the choice');
  assert.deepEqual(r.fileCalls(), []);
  ok('export -> "stop" or hardware back removes the choice without touching files');

  r = await start({ phase: 'start', guardian: true }, { idle: -1 });
  r.exportNow(NAME, TEXT); await tick();
  r.win.document.getElementById('appFileChoice').children[1].onclick(); await tick();
  assert.deepEqual(r.fileCalls(), []);
  assert.equal(r.guardian.hidden, true, 'idle guardian screen closes like the game does');
  ok('export choice left idle past the guardian timeout -> closes the guardian screen instead of sending');

  r = await start({ phase: 'start', guardian: true });
  r.exportNow(NAME, TEXT); await tick();
  r.guardian.hidden = true; r.mutate(r.guardian);
  assert.equal(r.win.document.getElementById('appFileChoice'), null);
  r.guardian.hidden = false; r.exportNow(NAME, TEXT); await tick();
  r.mutate(r.gBody);
  assert.equal(r.win.document.getElementById('appFileChoice'), null);
  ok('guardian screen closed or redrawn (tab change) -> leftover choice removed');

  r = await start({ phase: 'start', guardian: false });
  ev = r.exportNow(NAME, TEXT); await tick();
  assert.equal(ev.defaultPrevented, false);
  assert.equal(r.win.document.getElementById('appFileChoice'), null);
  ok('a download outside the guardian screen is not taken over');

  r = await start({ phase: 'start', guardian: true }, { noFilePlugin: true });
  ev = r.exportNow(NAME, TEXT); await tick();
  assert.equal(ev.defaultPrevented, false);
  assert.equal(r.importFile.click().defaultPrevented, false);
  assert.equal(r.win.document.getElementById('appFileChoice'), null);
  ok('shell without the ProgressFile plugin -> nothing taken over (web behaviour)');

  /* ---------- 진행 파일 옮기기: 불러오기 ---------- */
  r = await start({ phase: 'start', guardian: true }, { responses: { open: { done: true, text: TEXT } } });
  const imported = [];
  r.win.__importText = t => imported.push(t);
  ev = r.importFile.click();
  assert.equal(ev.defaultPrevented, true, 'WebView file chooser is not used');
  await tick(); await tick();
  assert.deepEqual(r.fileCalls(), [{ plugin: 'ProgressFile', method: 'open', options: { maxBytes: 1048576 } }]);
  assert.deepEqual(imported, [TEXT]);
  ok('import -> ProgressFile.open (system document screen, any type, max = Book.FILE_MAX) -> text handed to game __importText');

  r = await start({ phase: 'start', guardian: true }, { responses: { open: { done: true, tooBig: true } } });
  r.win.__importText = t => imported.push('big:' + t);
  r.importFile.click(); await tick(); await tick();
  assert.equal(r.gNote.textContent, '진행 파일이 아니에요.');
  assert(!imported.some(t => t.startsWith('big:')));
  ok('import -> file over the size limit -> same "not a progress file" note as the web');

  r = await start({ phase: 'start', guardian: true }, { responses: { open: { done: false } } });
  r.win.__importText = t => imported.push('cancel:' + t);
  r.importFile.click(); await tick(); await tick();
  assert(!imported.some(t => t.startsWith('cancel:')));
  assert.equal(r.gNote.textContent, '');
  ok('import -> nothing picked -> nothing happens');

  let release;
  r = await start({ phase: 'start', guardian: true }, { responses: { open: () => new Promise(done => { release = done; }) } });
  r.win.__importText = t => imported.push('late:' + t);
  r.importFile.click(); await tick();
  r.importFile.click(); await tick();
  assert.equal(r.fileCalls().length, 1, 'second tap while the document screen is open is ignored');
  r.winListeners.webglcontextlost.fn({});
  r.listeners.resume();
  assert(!r.calls.includes('reload'), 'no 3D recovery reload while a file screen is pending');
  r.guardian.hidden = true;
  release({ done: true, text: TEXT }); await tick(); await tick();
  assert(!imported.some(t => t.startsWith('late:')), 'guardian closed meanwhile -> result dropped');
  r.listeners.resume();
  assert(r.calls.includes('reload'), '3D recovery runs on the next resume');
  ok('import pending -> double tap ignored, 3D recovery reload deferred, result dropped if the guardian screen closed');

  /* ---------- 오픈소스 고지 전체 보기 ---------- */
  r = await start({ phase: 'start', guardian: true });
  const h = r.el('p', '', r.gBody); h.className = 'g-h'; h.textContent = '오픈소스 고지';
  const line = r.el('p', '', r.gBody); line.textContent = '이 앱은 three.js(MIT License)를 사용합니다.';
  r.mutate(r.gBody);
  const open = r.win.document.getElementById('appOssOpen');
  assert(open, 'button added under the notice line');
  assert.equal(r.gBody.children.indexOf(open), r.gBody.children.indexOf(line) + 1);
  r.mutate(r.gBody);
  assert.equal(r.gBody.children.filter(c => c.id === 'appOssOpen').length, 1, 'added once');
  open.onclick();
  const oss = r.win.document.getElementById('appOss');
  assert(oss && oss.children[0].children[0].tagName === 'IFRAME' && oss.children[0].children[0].src === 'oss-licenses.html', 'in-app notice page in an overlay');
  r.listeners.backButton({}); await tick();
  assert.equal(r.win.document.getElementById('appOss'), null);
  assert.equal(r.guardian.hidden, false, 'back closes the notice overlay first');
  ok('help tab -> "open source notices" button opens the in-app oss-licenses.html overlay; back closes it first');

  /* ---------- 기기 잠금 문턱(window.__deviceGate 계약) ---------- */
  r = await start({ phase: 'start' }, { noGatePlugin: true });
  assert.equal(r.win.__deviceGate, undefined, 'no DeviceGate plugin -> no __deviceGate (game keeps its web adult question)');
  ok('shell without the DeviceGate plugin -> window.__deviceGate is not defined');

  for (const [answer, expect] of [[{ result: 'ok' }, 'ok'], [{ result: 'cancel' }, 'cancel'], [{ result: 'none', why: 'no-lock' }, 'none'], [{ result: 'weird' }, 'none'], [null, 'none'], [new Error('boom'), 'none']]) {
    r = await start({ phase: 'start' }, { responses: { confirm: answer } });
    assert.equal(typeof r.win.__deviceGate, 'function');
    assert.equal(await r.win.__deviceGate({ reason: '보호자 화면을 열어요' }), expect, JSON.stringify(answer instanceof Error ? 'Error' : answer));
    assert.deepEqual(r.gateCalls(), [{ plugin: 'DeviceGate', method: 'confirm', options: { reason: '보호자 화면을 열어요' } }]);
  }
  ok('__deviceGate maps native answers to ok / cancel / none; unknown answers and native errors become none (never rejects)');

  r = await start({ phase: 'start' }, { responses: { confirm: { result: 'ok' } } });
  assert.equal(await r.win.__deviceGate(), 'ok');
  assert.equal(await r.win.__deviceGate({ reason: '   ' }), 'ok');
  assert.equal(await r.win.__deviceGate({ reason: 'ㄱ'.repeat(120) }), 'ok');
  assert.deepEqual(r.gateCalls().map(c => c.options), [{}, {}, { reason: 'ㄱ'.repeat(80) }]);
  ok('__deviceGate reason is optional, blank reasons dropped, long reasons cut to 80 characters');

  let let1;
  r = await start({ phase: 'start' }, { responses: { confirm: () => new Promise(done => { let1 = done; }) } });
  const p1 = r.win.__deviceGate({ reason: 'a' }), p2 = r.win.__deviceGate({ reason: 'b' });
  assert.equal(p1, p2, 'second call while the lock screen is up returns the same promise');
  await tick();
  assert.equal(r.gateCalls().length, 1);
  r.winListeners.webglcontextlost.fn({});
  r.listeners.resume();
  assert(!r.calls.includes('reload'), 'no 3D recovery reload while the lock screen is pending');
  let1({ result: 'cancel' });
  assert.equal(await p1, 'cancel');
  r.listeners.resume();
  assert(r.calls.includes('reload'), '3D recovery runs on the next resume');
  const p3 = r.win.__deviceGate({ reason: 'c' });
  assert.notEqual(p3, p1);
  await tick();
  assert.equal(r.gateCalls().length, 2, 'after it settles, the next call asks again');
  let1({ result: 'ok' });
  assert.equal(await p3, 'ok');
  ok('__deviceGate while pending -> same promise, one native screen; 3D recovery reload waits; next call asks again');

  console.log('PASS app shell ' + n + ' scenarios (simulated bridge)');
})().catch(error => { console.error(error); process.exit(1); });
