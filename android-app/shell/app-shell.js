/* 꼬꼬마을 Android 껍데기 전용 스크립트. 웹 배포(Pages)에는 들어가지 않는다.
   prepare-web.cjs가 esbuild로 묶어 www/app-shell.js로 넣고, 앱 안 index.html 끝에만 붙인다.
   게임 규칙은 건드리지 않는다. 게임이 이미 가진 '잠깐 쉬기' 버튼(#pause)과 저장 함수(save)만 부른다.
   - 하드웨어 뒤로 가기: 설정 서랍이 열려 있으면 닫기 → 늑대 세계가 흐르는 중이면 '잠깐 쉬기'
     → 시작 화면·엔딩 카드·쉬는 중이면 저장하고 앱을 내린다(종료하지 않는다. 다시 열면 그 자리).
   - 앱이 뒤로 갈 때(Android onPause): 흐르는 중이면 '잠깐 쉬기'(게임이 저장한다), 아니면 저장만.
     돌아와도 쉬는 중으로 남고, 아이가 '계속'을 눌러 이어 간다(웹의 visibilitychange 처리와 같은 방향). */
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

const byId = id => document.getElementById(id);

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

function onBack() {
  const drawer = byId('drawer');
  if (drawer && drawer.open) { drawer.open = false; return; }
  if (pauseIfRunning()) return;
  saveNow();
  App.minimizeApp().catch(() => {});
}

if (Capacitor.isNativePlatform()) {
  document.documentElement.dataset.shell = Capacitor.getPlatform();
  App.addListener('backButton', onBack);
  App.addListener('pause', () => { if (!pauseIfRunning()) saveNow(); });
}
