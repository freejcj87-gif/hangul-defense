/* 꼬꼬마을 Android 껍데기 전용 스크립트. 웹 배포(Pages)에는 들어가지 않는다.
   prepare-web.cjs가 esbuild로 묶어 www/app-shell.js로 넣고, 앱 안 index.html 끝에만 붙인다.
   게임 규칙은 건드리지 않는다. 게임이 이미 가진 단추(#pause, 겹창 닫기 단추), 저장 함수(save), 상태 읽기(getVillageState),
   진행 파일 훅(window.__lastExport · window.__importText, bookui.js)만 쓴다. 쓰는 자리가 게임에서 사라지면 prepare-web.cjs가 빌드를 멈춘다.
   1) 하드웨어 뒤로 가기: 맨 위 겹창부터 닫는다(오픈소스 고지 → 보호자 문턱 → 내보내기 고르기 → 보호자 화면 → 수첩) → 설정 서랍 닫기
      → 늑대 세계가 흐르는 중이면 '잠깐 쉬기' → 시작 화면·엔딩 카드·쉬는 중이면 저장하고 앱을 내린다(종료하지 않는다. 다시 열면 그 자리).
   2) 앱이 뒤로 갈 때(Android onPause): 흐르는 중이면 '잠깐 쉬기'(게임이 저장한다), 아니면 저장만.
      돌아와도 쉬는 중으로 남고, 아이가 '계속'을 눌러 이어 간다(웹의 visibilitychange 처리와 같은 방향).
   3) 화면 켜두기: 늑대 세계가 흐르는 동안(문제를 읽는 중 포함)만 화면이 꺼지지 않게 한다. 시작 화면·쉬는 중·엔딩에서는 기기 설정대로 꺼진다.
      앱 안 플러그인 ScreenAwake(MainActivity에 등록, FLAG_KEEP_SCREEN_ON)를 1초마다 상태를 보고 바뀔 때만 부른다.
   4) 3D 문맥 손실 복구: WebGL 문맥을 잃으면 게임은 그림 화면으로 바꾸고(src/village.js) 다시 3D로 돌아오지 않는다.
      앱이 다시 앞으로 올 때(resume) 저장하고 한 번 다시 불러와 3D를 되살린다(2분 안에 또 잃으면 그림 화면 유지: 반복 방지).
      진행 파일 화면(시스템 문서 화면·공유 창)에서 돌아오는 중이면 미룬다(결과를 받을 페이지가 사라지지 않게).
   5) 진행 파일 옮기기(보호자 화면 '진행 파일' 탭, 보호자 문턱 뒤): WebView는 웹판의 내려받기(a download)와 형식 거른 파일 고르기를
      그대로 처리하지 못한다. 그 두 누름을 잡기 단계에서 받아 앱 안 플러그인 ProgressFile(ProgressFilePlugin.java, 권한 없음)로 넘긴다.
      - 내보내기: 게임이 만든 글(window.__lastExport)을 두고 '저장할 곳 고르기'(시스템 문서 화면) · '다른 앱으로 보내기'(Android 공유 창) · '그만두기'.
      - 불러오기: 시스템 문서 화면에서 고른 파일의 글을 게임의 window.__importText로 넘긴다(검사·미리 보기·'바꾸기' 문턱은 게임 그대로).
      플러그인이 없는 껍데기(웹 포함)에서는 아무것도 잡지 않아 웹 방식 그대로다.
   6) 오픈소스 고지: 보호자 화면 도움말의 '오픈소스 고지' 아래에 '전체 보기'를 붙여 앱 안 oss-licenses.html을 겹창으로 연다(바깥 링크 없음). */
import { App } from '@capacitor/app';
import { Capacitor, registerPlugin } from '@capacitor/core';

const ScreenAwake = registerPlugin('ScreenAwake');
const ProgressFile = registerPlugin('ProgressFile');
const RELOAD_KEY = 'app-shell-gl-reload-at';
const RELOAD_GAP_MS = 120000;
const byId = id => document.getElementById(id);
const shown = id => { const e = byId(id); return !!e && !e.hidden; };
let awake = null;
let glLost = false;
let fileBusy = false;
let choiceAt = 0;

function game() {
  try { return typeof window.getVillageState === 'function' ? window.getVillageState() : null; } catch { return null; }
}

function saveNow() {
  try { if (typeof window.save === 'function') window.save(); } catch { /* 저장 실패는 게임이 스스로 알린다 */ }
}

function pauseIfRunning() {
  const g = game();
  if (!g || !g.running || g.paused) return false;
  const button = byId('pause');
  if (!button) return false;
  button.click();
  return true;
}

function setAwake(on) {
  if (awake === on) return;
  awake = on;
  ScreenAwake.set({ on }).catch(() => { /* 플러그인이 없는 껍데기에서는 기기 설정대로 */ });
}

/* ---------- 5) 진행 파일 옮기기 ---------- */
function fileMax() {
  try { const n = Number(window.Book.FILE_MAX); return n > 0 ? n : 1048576; } catch { return 1048576; }
}
/* 보호자 화면이 손대지 않은 채 이만큼 지나면 닫힌다(book.js GATE.idle, 0.1초 단위). 앱이 붙인 고르기 단추도 같은 규칙을 따른다 */
function idleMs() {
  try { const n = Number(window.Book.BOOK.GATE.idle); return Number.isFinite(n) ? n * 100 : 180000; } catch { return 180000; }
}
function note(text) { const n = byId('gNote'); if (n) n.textContent = text; }
function closeChoice() { const c = byId('appFileChoice'); if (!c) return false; c.remove(); return true; }

function fileTask(promise, ok, failText) {
  fileBusy = true;
  return Promise.resolve(promise).then(ok, () => note(failText)).finally(() => { fileBusy = false; });
}

function offerExport(name, text) {
  closeChoice();
  const gNote = byId('gNote');
  if (!gNote || !shown('guardian')) return;
  choiceAt = Date.now();
  note('진행 파일을 어디에 둘까요?');
  const box = document.createElement('div');
  box.id = 'appFileChoice';
  box.className = 'g-tabs';
  const add = (label, run) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.onclick = () => {
      if (fileBusy) return;
      if (!shown('guardian')) { closeChoice(); return; }
      if (Date.now() - choiceAt > idleMs()) { closeChoice(); const close = byId('guardClose'); if (close) close.click(); return; }
      closeChoice();
      run();
    };
    box.append(b);
  };
  add('📁 저장할 곳 고르기', () => fileTask(ProgressFile.save({ name, text }),
    r => note(r && r.done ? '진행 파일을 저장했어요: ' + name + '. 새 기기에서 보호자 화면 → 진행 파일 → 파일 불러오기로 열어요.' : '저장하지 않았어요.'),
    '파일을 저장하지 못했어요. 다시 해 주세요.'));
  add('📤 다른 앱으로 보내기', () => fileTask(ProgressFile.share({ name, text }),
    () => note('보낼 곳을 골라 마저 보내 주세요. 받은 기기에서는 보호자 화면 → 진행 파일 → 파일 불러오기로 열어요.'),
    '보내기 창을 열지 못했어요. 다시 해 주세요.'));
  add('그만두기', () => note('내보내지 않았어요.'));
  gNote.after(box);
}

function openFile() {
  if (fileBusy) return;
  fileTask(ProgressFile.open({ maxBytes: fileMax() }), r => {
    if (!r || !r.done || !shown('guardian')) return; /* 고르지 않았거나 그 사이 보호자 화면이 닫힘 */
    if (r.tooBig) { note('진행 파일이 아니에요.'); return; }
    if (typeof window.__importText === 'function') window.__importText(String(r.text || ''));
    else note('파일을 읽지 못했어요.');
  }, '파일을 열지 못했어요. 다시 해 주세요.');
}

/* 잡기 단계(capture)에서 받는다. 게임의 exportNow는 a.click() 뒤에 '진행 파일을 만들었어요' 알림을 쓰므로 고르기 단추는 그 뒤(마이크로태스크)에 그린다 */
function onFileClick(ev) {
  const t = ev.target;
  if (!t || !shown('guardian')) return;
  if (t === byId('importFile')) {
    ev.preventDefault();
    openFile();
    return;
  }
  const a = typeof t.closest === 'function' ? t.closest('a[download]') : null;
  if (!a) return;
  ev.preventDefault();
  const name = a.getAttribute('download') || 'kkomaeul-progress.json';
  const last = window.__lastExport;
  Promise.resolve().then(() => {
    if (last && last.name === name && typeof last.text === 'string' && last.text) offerExport(name, last.text);
    else note('진행 파일을 만들지 못했어요. 다시 내보내 주세요.');
  });
}

/* ---------- 6) 오픈소스 고지 전체 보기 ---------- */
function closeOss() { const o = byId('appOss'); if (!o) return false; o.remove(); return true; }
function openOss() {
  if (byId('appOss')) return;
  const wrap = document.createElement('div');
  wrap.id = 'appOss';
  wrap.className = 'start-screen';
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-modal', 'true');
  wrap.setAttribute('aria-label', '오픈소스 고지');
  wrap.style.zIndex = '65';
  const card = document.createElement('div');
  card.className = 'start-card wide';
  const frame = document.createElement('iframe');
  frame.src = 'oss-licenses.html';
  frame.title = '오픈소스 고지';
  frame.style.cssText = 'display:block;width:100%;height:62svh;border:1px solid #e6d9b8;border-radius:12px;background:#fff9e9';
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '닫기';
  close.onclick = closeOss;
  card.append(frame, close);
  wrap.append(card);
  document.body.append(wrap);
}
function addOssButton(body) {
  if (byId('appOssOpen')) return;
  const kids = Array.from(body.children);
  const head = kids.find(p => p.tagName === 'P' && String(p.className).split(' ').includes('g-h') && String(p.textContent).trim() === '오픈소스 고지');
  if (!head) return;
  const b = document.createElement('button');
  b.id = 'appOssOpen';
  b.type = 'button';
  b.textContent = '오픈소스 고지 전체 보기';
  b.onclick = openOss;
  (kids[kids.indexOf(head) + 1] || head).after(b);
}

function watchGuardian() {
  const guardian = byId('guardian');
  const body = byId('gBody');
  if (!guardian || !body || typeof window.MutationObserver !== 'function') return;
  /* 보호자 화면이 닫히거나(시간 초과 포함) 탭이 다시 그려지면 앱이 붙인 고르기 단추는 치운다 */
  new window.MutationObserver(() => { if (guardian.hidden) closeChoice(); }).observe(guardian, { attributes: true, attributeFilter: ['hidden'] });
  new window.MutationObserver(() => { closeChoice(); addOssButton(body); }).observe(body, { childList: true });
}

/* ---------- 1) 뒤로 가기 ---------- */
function closeTop() {
  if (closeOss()) return true;
  if (shown('gate')) { const b = byId('gateClose'); if (b) b.click(); return true; }
  if (closeChoice()) { note('내보내지 않았어요.'); return true; }
  if (shown('guardian')) { const b = byId('guardClose'); if (b) b.click(); return true; }
  if (shown('bookScreen')) { const b = byId('bookClose'); if (b) b.click(); return true; }
  return false;
}

function onBack() {
  if (closeTop()) return;
  const drawer = byId('drawer');
  if (drawer && drawer.open) { drawer.open = false; return; }
  if (pauseIfRunning()) return;
  saveNow();
  App.minimizeApp().catch(() => {});
}

function recoverLostContext() {
  if (!glLost || fileBusy) return false;
  let last = 0;
  try { last = Number(window.sessionStorage.getItem(RELOAD_KEY)) || 0; } catch { /* 없으면 0 */ }
  const now = Date.now();
  if (now - last < RELOAD_GAP_MS) return false;
  try { window.sessionStorage.setItem(RELOAD_KEY, String(now)); } catch { /* 저장 못 해도 다시 불러온다 */ }
  saveNow();
  window.location.reload();
  return true;
}

if (Capacitor.isNativePlatform()) {
  document.documentElement.dataset.shell = Capacitor.getPlatform();
  App.addListener('backButton', onBack);
  App.addListener('pause', () => { setAwake(false); if (!pauseIfRunning()) saveNow(); });
  App.addListener('resume', recoverLostContext);
  // 캔버스의 webglcontextlost는 거품이 일지 않지만, 잡기 단계(capture)에서는 window까지 지나간다
  window.addEventListener('webglcontextlost', () => { glLost = true; }, true);
  window.setInterval(() => {
    const g = game();
    setAwake(!!(g && g.running) && !document.hidden);
  }, 1000);
  if (Capacitor.isPluginAvailable('ProgressFile')) document.addEventListener('click', onFileClick, true);
  watchGuardian();
}
