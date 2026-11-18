/* 꼬꼬마을 Android 껍데기 전용 스크립트. 웹 배포(Pages)에는 들어가지 않는다.
   prepare-web.cjs가 esbuild로 묶어 www/app-shell.js로 넣고, 앱 안 index.html 끝에만 붙인다.
   게임 규칙은 건드리지 않는다. 게임이 이미 가진 '잠깐 쉬기' 버튼(#pause), 저장 함수(save), 상태 읽기(getVillageState)만 쓴다.
   1) 하드웨어 뒤로 가기: 설정 서랍이 열려 있으면 닫기 → 늑대 세계가 흐르는 중이면 '잠깐 쉬기'
      → 시작 화면·엔딩 카드·쉬는 중이면 저장하고 앱을 내린다(종료하지 않는다. 다시 열면 그 자리).
   2) 앱이 뒤로 갈 때(Android onPause): 흐르는 중이면 '잠깐 쉬기'(게임이 저장한다), 아니면 저장만.
      돌아와도 쉬는 중으로 남고, 아이가 '계속'을 눌러 이어 간다(웹의 visibilitychange 처리와 같은 방향).
   3) 화면 켜두기: 늑대 세계가 흐르는 동안(문제를 읽는 중 포함)만 화면이 꺼지지 않게 한다. 시작 화면·쉬는 중·엔딩에서는 기기 설정대로 꺼진다.
      앱 안 플러그인 ScreenAwake(MainActivity에 등록, FLAG_KEEP_SCREEN_ON)를 1초마다 상태를 보고 바뀔 때만 부른다.
   4) 3D 문맥 손실 복구: WebGL 문맥을 잃으면 게임은 그림 화면으로 바꾸고(src/village.js) 다시 3D로 돌아오지 않는다.
      앱이 다시 앞으로 올 때(resume) 저장하고 한 번 다시 불러와 3D를 되살린다(2분 안에 또 잃으면 그림 화면 유지: 반복 방지). */
import { App } from '@capacitor/app';
import { Capacitor, registerPlugin } from '@capacitor/core';

const ScreenAwake = registerPlugin('ScreenAwake');
const RELOAD_KEY = 'app-shell-gl-reload-at';
const RELOAD_GAP_MS = 120000;
const byId = id => document.getElementById(id);
let awake = null;
let glLost = false;

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

function onBack() {
  const drawer = byId('drawer');
  if (drawer && drawer.open) { drawer.open = false; return; }
  if (pauseIfRunning()) return;
  saveNow();
  App.minimizeApp().catch(() => {});
}

function recoverLostContext() {
  if (!glLost) return false;
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
}
