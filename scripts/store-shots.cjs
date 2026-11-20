'use strict';
/* 스토어 이미지 자동 촬영(출시 준비). Play 등록정보 스크린샷과 그래픽 이미지(1024×500)를 출시 후보 빌드(.pages-build)에서 찍는다.
   node scripts/build-pages.cjs && node scripts/store-shots.cjs [저장 폴더=store-shots] [--sizes=tablet,portrait,phone] [--only=T1,G1]
   CI 전용(.github/workflows/store-shots.yml, Playwright 1.56.1 컨테이너). 브라우저와 SwiftShader가 메모리를 많이 써서 PC에서는 돌리지 않는다.
   구성안: launch/store/04-이미지구성안-20261118.md §2·§4(T1~T9 · N1~N3 · G1). 규격: launch/store/01-규격표-20261118.md §2.
   - 태블릿 가로 1920×1080(화면 1280×720 × 배율 1.5, 16:9): 7인치·10인치 태블릿 칸에 같은 묶음을 쓴다. 세로(1080×1920)·폰(1080×1920)은 --sizes로 고른다.
   - 주소는 일반 주소다(테스트 막대 ?test=1 · 체험 표시 ?demo= 없음). 단계 상태는 테스트 모드의 jumpState(단계 진입 중앙값)로 한 번 만든 뒤
     일반 주소의 저장 열쇠에 넣어 연다. 쪽지·반짝 손님은 장면을 가리지 않게 주소 플래그로 끈다(?notes=0&shiny=0, 화면 모양은 같다).
   - 시계: window.__HOLD_CLOCK + __tick(n)으로 세계를 돌리고, 3D는 VillageView.debug({hold, advance})로 같은 만큼 흘린다. CSS 애니메이션(동전 비행)은 찍기 직전에 멈춘다.
   - 출력: 24비트 PNG(알파 없음, Play 규격). 크기·색 형식은 저장 전에 다시 읽어 확인한다. 장면 설명·대체 텍스트는 manifest.json에 함께 쓴다.
   - 찍기 전 확인: 테스트 막대·체험 표시·성능 숫자·열린 설정 서랍(버전 글자) 없음. 하나라도 있으면 그 장면은 실패로 적는다. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, '.pages-build');
const argv = process.argv.slice(2);
const flag = k => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : ''; };
const DIR = path.resolve(argv.find(a => !a.startsWith('--')) || path.join(ROOT, 'store-shots'));
const Combat = require(path.join(ROOT, 'combat.js'));
const Book = require(path.join(ROOT, 'book.js'));

const SIZES = {
  tablet: { w: 1280, h: 720, dsf: 1.5, px: [1920, 1080], name: '태블릿 가로 16:9 (7인치·10인치 칸 공용, 게임 추천 지면 조건)' },
  portrait: { w: 810, h: 1440, dsf: 4 / 3, px: [1080, 1920], name: '태블릿 세로 9:16 (선택)' },
  phone: { w: 360, h: 640, dsf: 3, px: [1080, 1920], name: '폰 9:16 (폰에 배포할 때만)' }
};
const SIZE_LIST = (flag('sizes') || 'tablet').split(',').filter(s => SIZES[s]);
const ONLY = flag('only') ? flag('only').split(',') : null;
const SEED = 4242;
const SWIFT = ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
/* 찍히면 안 되는 것은 숨기고, 3.2초짜리 띠 애니메이션은 떠 있는 모습으로 고정(느린 러너에서도 같은 장면) */
const CLEAN = '#testBar,#tmPerf,.demo-tag,.tm-head{display:none!important}#effects .banner:not(.later){animation:none!important;opacity:1!important}';
const BARE = '#stageTag,#yardEggs,#effects,#pauseNote,#finale,#coinLayer,#bubble,#shopTip{visibility:hidden!important}';

/* ---------------- PNG: 알파 없는 24비트로 다시 쓰기(Play 스크린샷·그래픽 이미지 규격) ---------------- */
const SIG = Buffer.from('89504e470d0a1a0a', 'hex');
const CRC = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
const crc32 = b => { let c = -1; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) {
  const head = Buffer.alloc(4); head.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const tail = Buffer.alloc(4); tail.writeUInt32BE(crc32(body));
  return Buffer.concat([head, body, tail]);
}
function pngInfo(buf) {
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error('not a PNG');
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), depth: buf[24], ct: buf[25], interlace: buf[28] };
}
/* 8비트 RGB(2)·RGBA(6), 비월 없음만 읽는다(Chromium 스크린샷과 이 파일이 쓰는 PNG) → 줄마다 필터를 푼 화소 */
function decodePng(buf) {
  const info = pngInfo(buf), ch = info.ct === 6 ? 4 : info.ct === 2 ? 3 : 0;
  if (info.depth !== 8 || info.interlace !== 0 || !ch) throw new Error('unsupported PNG ' + JSON.stringify(info));
  const idat = [];
  for (let p = 8; p < buf.length;) { const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8); if (type === 'IDAT') idat.push(buf.subarray(p + 8, p + 8 + len)); p += 12 + len; if (type === 'IEND') break; }
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = info.w * ch, data = Buffer.alloc(stride * info.h);
  for (let y = 0; y < info.h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, row = y * stride, up = row - stride;
    for (let x = 0; x < stride; x++) {
      const v = raw[src + x], a = x >= ch ? data[row + x - ch] : 0, b = y ? data[up + x] : 0, c = y && x >= ch ? data[up + x - ch] : 0;
      let r;
      if (f === 0) r = v; else if (f === 1) r = v + a; else if (f === 2) r = v + b; else if (f === 3) r = v + ((a + b) >> 1);
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
      else throw new Error('bad PNG filter ' + f);
      data[row + x] = r & 255;
    }
  }
  return { w: info.w, h: info.h, ch, data };
}
function encodeRgb(w, h, rgb) {
  const stride = w * 3, out = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * stride, up = row - stride, o = y * (stride + 1);
    let sSub = 0, sUp = 0;
    for (let x = 0; x < stride; x++) { const s = (rgb[row + x] - (x >= 3 ? rgb[row + x - 3] : 0)) & 255, u = (rgb[row + x] - (y ? rgb[up + x] : 0)) & 255; sSub += s < 128 ? s : 256 - s; sUp += u < 128 ? u : 256 - u; }
    const useUp = sUp < sSub; out[o] = useUp ? 2 : 1;
    for (let x = 0; x < stride; x++) out[o + 1 + x] = (useUp ? rgb[row + x] - (y ? rgb[up + x] : 0) : rgb[row + x] - (x >= 3 ? rgb[row + x - 3] : 0)) & 255;
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([SIG, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(out, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
/* RGBA면 흰 바탕에 얹어 알파를 버린다(스크린샷은 원래 불투명). 다시 읽어 화소가 같은지까지 확인 */
function png24(buf) {
  const img = decodePng(buf);
  let rgb = img.data;
  if (img.ch === 4) {
    rgb = Buffer.alloc(img.w * img.h * 3);
    for (let i = 0, o = 0; i < img.data.length; i += 4, o += 3) { const al = img.data[i + 3]; for (let k = 0; k < 3; k++) rgb[o + k] = al === 255 ? img.data[i + k] : Math.round((img.data[i + k] * al + 255 * (255 - al)) / 255); }
  }
  const out = encodeRgb(img.w, img.h, rgb), back = decodePng(out);
  if (back.ch !== 3 || back.w !== img.w || back.h !== img.h || !back.data.equals(rgb)) throw new Error('24-bit PNG round trip mismatch');
  return out;
}

/* ---------------- 기록(수첩) 저장 ---------------- */
const NOW = Date.now(), DAY = Book.dayOf(NOW), PAST = NOW - 3 * 86400000;
/* 게임 장면용: 모든 몬스터 발자국이 이미 찍힌 수첩(첫 발자국 알림 띠가 정답 장면을 가리지 않게). 실제 아이 기록이 아니라 만든 기록 */
function livedBook() { const b = Book.fresh(NOW, SEED); for (const k of Object.keys(b.mon)) b.mon[k].foot = PAST; return b; }
/* 수첩·보호자 화면 장면용(scripts/book-shots.cjs와 같은 가상 기록): 친구 3 · 발자국 6 · 반짝 2 · 훈장 여럿 · 놓친 글 */
function richBook() {
  const b = Book.fresh(NOW, SEED), t = PAST;
  Object.assign(b.mon.wolf, { foot: t, card: t, note: 3, plays: 6, last: 5, kills: 140, rib: { n: 3, last: 5 }, shiny: t });
  Object.assign(b.mon.bramble, { foot: t, card: NOW, note: 3, plays: 4, kills: 90, rib: { n: 1, last: 5 } });
  Object.assign(b.mon.boar, { foot: t, card: t, note: 3, plays: 3, kills: 14, rib: { n: 2, last: 5 } });
  Object.assign(b.mon.granite, { foot: t, plays: 2, last: 5, kills: 5 }); Object.assign(b.mon.frost, { foot: t, plays: 1, kills: 3 }); Object.assign(b.mon.fox, { foot: t, plays: 2, kills: 3, note: 1, shiny: t });
  const n = { one: 412, fresh: 130, again: 7, rush: 18, en: 9, quiz: 61, king: 5, fox: 4, arrow: 1240, keeper: 3, star: 2, map: 1 };
  for (const k of Object.keys(n)) { b.medal[k].n = n[k]; Book.BOOK.MEDAL[k].forEach((need, i) => { if (n[k] >= need) b.medal[k].at[i] = t; }); }
  b.play = 6; b.pq = 6; b.tot = { q: 540, f: 455, s: 9800, days: 6 }; b.day[DAY] = [42, 36, 900, 11];
  /* 최근 놀이 6번 요약(보호자 기록 탭의 분류별 줄): 합계가 위 tot와 맞게 */
  b.log = [0, 1, 2, 3, 4, 5].map(i => ({ p: i + 1, d: Book.dayOf(NOW - (10 - 2 * i) * 86400000), age: 8, q: 90, f: i < 5 ? 76 : 75, nw: 20, en: [6, 4], qz: [14, 11], rd: [70, i < 5 ? 61 : 60], rv: [2, 1], s: 1630 }));
  b.rv = [['a8-story-03', 4], ['a8-story-12', 3], ['a8-quiz-07', 2], ['a8-story-g041', 2], ['a8-story-g102', 1]].map(([id, miss]) => ({ id, box: 1, due: 99, dp: 6, miss, seen: 1 }));
  return b;
}
const runJson = (s, extra) => JSON.stringify({ ...s, version: Combat.SAVE_VERSION, seed: SEED, ...(extra || {}) });

/* ---------------- 장면(구성안 store/04 §2·§4) ---------------- */
const QUIET = '?notes=0&shiny=0';
const SCENES = [
  { id: 'T1', file: '01-answer-volley', title: '정답 순간: 타워 일제 사격', alt: '글을 읽고 맞히면 마을의 타워가 한꺼번에 화살을 쏘아 늑대를 막아요', state: '물레방아 마을 · 8세 · 늑대 무리 접근 중 정답 직후',
    run: J => runJson(J['8:3']), query: QUIET,
    css: 220, async make(t) { await t.begin(); await t.story(); await t.pack(); await t.run(60); await t.answer(); await t.run(3); } },
  { id: 'T2', file: '02-read-choose', title: '읽고 고르기', alt: '한 문장을 끝까지 읽고 알맞은 답을 골라요', state: '장터 마을 · 8세 · 읽기 문제 답 칸이 열린 뒤',
    run: J => runJson(J['8:2']), query: QUIET,
    async make(t) { await t.begin(); await t.story(); await t.pack(); await t.run(30); await t.unlock(); await t.run(6); } },
  { id: 'T3', file: '03-castle', title: '농가에서 성까지', alt: '많이 지을수록 농가가 마을, 장터 마을을 지나 성으로 자라요', state: '성 · 8세 · 늑대 몇 마리 접근',
    run: J => runJson(J['8:5']), query: QUIET,
    async make(t) { await t.begin(); await t.story(); await t.pack(); await t.run(70); await t.unlock(); await t.clearBanners(); } },
  /* 알·농부는 화면이 가장 가까운 '마을' 단계에서(장터 마을은 마을이 넓어져 알이 작다). 정답 뒤 판매 연출 중: 알을 든 농부가 매대로, 동전이 금화 칸으로 */
  { id: 'T4', file: '04-eggs-farmers', title: '알 → 농부 → 장터', alt: '닭이 알을 낳으면 농부가 장터에 팔아 금화가 생겨요', state: '마을 · 8세 · 닭 6마리 · 농부 3명 · 정답 뒤 판매 연출',
    run: J => runJson(J['8:1'], { chickens: Math.max(6, J['8:1'].chickens | 0), farmers: Math.max(2, J['8:1'].farmers | 0) }), query: QUIET,
    /* 추천 말풍선은 T5가 보여 준다. 여기서는 마을 앞을 가리지 않게 숨긴다(말풍선은 20초에 한 번이라 없는 순간도 실제 화면이다) */
    hide: '#bubble,#shopTip{visibility:hidden!important}',
    css: 250, async make(t) { await t.begin(); await t.story(); await t.run(20); await t.answer(); await t.run(7); } },
  /* 말풍선은 문제 사이에만, 20초에 한 번만 뜬다(REC.gap). 앞 문제를 넘기지 않고 첫 정답에서 뜬 말풍선을 찍는다 */
  { id: 'T5', file: '05-shop-bubble', title: '가게와 추천 말풍선', alt: '모은 금화로 언제든 타워, 닭, 농부, 울타리를 사요', state: '마을 · 8세 · 금화 넉넉 · 정답 뒤 추천 말풍선',
    run: J => runJson(J['8:1'], { gold: 420 }), query: QUIET,
    async make(t) { await t.begin(); await t.run(10); await t.answer(); for (let i = 0; i < 40 && !(await t.st()).bubble; i++) await t.run(2); if (!(await t.st()).bubble) throw new Error('추천 말풍선이 뜨지 않음'); await t.run(2); } },
  { id: 'T6', file: '06-stage-up', title: '단계가 오르는 순간', alt: '마을이 커질 때마다 땅이 넓어지고 새 길과 새 몬스터가 나와요', state: '농가 → 마을 · 8세 · 단계 전환 띠',
    run: () => runJson(Combat.fresh(8), { age: 8, index: 0, level: 2, fence: 1, chickens: 2, gold: 300 }), query: QUIET,
    async make(t) { await t.begin(); await t.story(); await t.run(4); await t.buy('chicken'); await t.run(8); await t.answer(); await t.run(5); } },
  { id: 'T7', file: '07-age10-passage', title: '10세 짧은 글', alt: '나이에 맞는 글이 나와요. 10세는 짧은 글을 읽고 질문에 답해요', state: '성 · 10세 · 종이 열린 상태(결전 직전)',
    run: J => runJson(J['10:bell']), query: QUIET,
    async make(t) { await t.begin(); await t.story(16); await t.unlock(); await t.run(6); } },
  { id: 'T8', file: '08-wolf-king', title: '늑대 왕과 겨루기', alt: '마을이 다 자라면 종을 울리고 글을 읽어 늑대 왕을 물리쳐요', state: '성 · 8세 · 결전 중 별 방패 3개 깬 때',
    run: J => runJson(J['8:bell']), query: QUIET,
    async make(t) { await t.begin(); await t.run(4); await t.buy('bell'); await t.run(6); for (let k = 0; k < 8 && (await t.st()).shields < 3; k++) { await t.settle(); await t.answer(); await t.run(4); } if ((await t.st()).shields < 3) throw new Error('별 방패가 3개 깨지지 않음'); await t.settle(); await t.unlock(); await t.run(20); } },
  { id: 'T9', file: '09-ending', title: '엔딩 카드', alt: '늑대 왕을 물리치면 지도에 도장을 받고 새 마을로 떠나요', state: '성 · 8세 · 결전 승리 뒤 엔딩 카드',
    run: J => { const r = Object.assign(Combat.freshRun(), { asked: 74, first: 63, t0: NOW - 25 * 60000, bell: 3, newOk: 40 }); const meta = Combat.fresh(8).meta; meta.stamps.push({ no: 1, village: 'meadow', age: 8, stars: [1, 1, 1], q: 74, acc: 85, lost: 0, min: 25, date: NOW }); return runJson(J['8:5'], { run: r, meta }); }, query: QUIET,
    async make(t) { await t.page.locator('#go').click(); await t.page.waitForFunction(() => !document.getElementById('ending').hidden, {}, { timeout: 20000 }); await t.run(2); }, css: 600 },
  { id: 'N1', file: '10-notebook', title: '발자국 수첩 · 친구 카드', alt: '몬스터의 이름 쪽지를 읽으면 친구가 되어 발자국 수첩에 카드가 생겨요', state: '시작 화면에서 수첩 열기 · 가상 기록(친구 3)',
    book: richBook, run: J => runJson(J['8:3']),
    css: 300, async make(t) { await t.page.locator('#openBook').click(); } },
  { id: 'N3', file: '11-medals', title: '지킴이 훈장', alt: '조건이 보이는 지킴이 훈장을 동, 은, 금으로 받아요', state: '수첩 아래 훈장 칸 · 가상 기록',
    book: richBook, run: J => runJson(J['8:3']),
    async make(t) { await t.page.locator('#openBook').click(); await t.page.evaluate(() => { document.querySelector('#bookScreen .start-card').scrollIntoView({ block: 'end' }); document.getElementById('bookScreen').scrollTop = 1e5; }); await t.page.evaluate(() => document.querySelector('#bookMedals .medal[data-key="arrow"]').click()); }, css: 300 },
  { id: 'N2', file: '12-guardian-log', title: '보호자 화면 기록', alt: '보호자 화면에서 아이가 읽은 기록을 보고 나이와 설정을 바꿔요', state: '보호자 화면 기록 탭 · 가상 기록(실제 아이 기록 아님)',
    book: richBook, run: J => runJson(J['8:3']),
    async make(t) { await t.longPress('openGuard'); await t.passGate(); await t.page.locator('#gTabs button[data-tab="log"]').click(); }, css: 300 }
];
const FEATURE = { id: 'G1', title: '그래픽 이미지(1024×500)', alt: '숲에서 늑대가 다가오고 성 단계 마을의 타워가 화살을 쏘는 꼬꼬마을', state: '성 · 8세 · 정답 직후 일제 사격, 장면만(UI 없음)', run: J => runJson(J['8:5']), query: QUIET };

/* ---------------- 실행 ---------------- */
const TYPES = { '.js': 'text/javascript; charset=utf-8', '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.glb': 'model/gltf-binary', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8' };
async function main() {
  const { chromium } = require('playwright');
  if (!fs.existsSync(path.join(OUT, 'index.html'))) throw new Error('.pages-build가 없어요. 먼저 node scripts/build-pages.cjs');
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(OUT, p.slice(1));
    if (!f.startsWith(OUT) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); return res.end(); }
    res.setHeader('Content-Type', TYPES[path.extname(f)] || 'application/octet-stream'); res.end(fs.readFileSync(f));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = 'http://127.0.0.1:' + server.address().port;
  fs.mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: SWIFT });
  const manifest = { made: new Date(NOW).toISOString(), commit: process.env.GITHUB_SHA || null, seed: SEED, sizes: {}, shots: [], failed: [] };

  /* 단계 상태: 테스트 모드의 jumpState(시뮬 중앙값, testmode.js)를 한 번 받아 둔다. 이 페이지는 찍지 않는다 */
  const J = await (async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await ctx.addInitScript(() => { window.__HOLD_CLOCK = true; });
    const page = await ctx.newPage(); await page.goto(url + '/?test=1');
    await page.waitForFunction(() => window.__testmode && typeof window.__testmode.jumpState === 'function', {}, { timeout: 120000 });
    const o = await page.evaluate(() => { const r = {}; for (const age of [7, 8, 9, 10]) for (const [k] of window.__testmode.JUMPS) r[age + ':' + k] = window.__testmode.jumpState(k, age); return r; });
    await ctx.close(); return o;
  })();
  console.log('단계 상태 ' + Object.keys(J).length + '개(테스트 모드 jumpState)');

  async function open(size, scene) {
    const S = SIZES[size];
    const ctx = await browser.newContext({ viewport: { width: S.w, height: S.h }, deviceScaleFactor: S.dsf, hasTouch: true, reducedMotion: 'no-preference', locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
    await ctx.addInitScript(s => { window.__HOLD_CLOCK = true; try { if (!localStorage.getItem('hangul-defense-book')) { localStorage.setItem('hangul-defense-book', s.book); if (s.run) localStorage.setItem('hangul-defense-v1', s.run); } } catch {} },
      { book: JSON.stringify((scene.book || livedBook)()), run: scene.run ? scene.run(J) : null });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url + '/' + (scene.query || ''));
    await page.waitForFunction(() => ['three', 'fallback'].includes(document.querySelector('.scene').dataset.renderer), {}, { timeout: 120000 });
    await page.waitForFunction(() => !window.VillageView || !window.VillageView.inspect || window.VillageView.inspect().ready, {}, { timeout: 120000 }).catch(() => {});
    await page.addStyleTag({ content: CLEAN + (scene.hide || '') });
    await page.evaluate(() => { try { window.VillageView && window.VillageView.debug({ hold: true }); } catch {} });
    const cdp = await ctx.newCDPSession(page); await cdp.send('Animation.enable');
    const frames = async n => { try { const f = await page.evaluate(() => (window.VillageView && window.VillageView.inspect ? window.VillageView.inspect().frames : 0)); await page.waitForFunction(x => !window.VillageView || !window.VillageView.inspect || window.VillageView.inspect().frames >= x, f + n, { timeout: 30000 }); } catch {} };
    const t = {
      page, ctx, cdp, errors,
      st: () => page.evaluate(() => ({ phase, lock: round ? round.lock : 0, mode: round ? round.q.mode : '', special: !!(round && round.special), answer: round ? round.q.answer : -1, bell: state.run.bell, shields: state.run.shields, bubble: !!rec.bubble })),
      /* 세계 n틱(0.1초씩) + 3D를 같은 만큼 */
      async run(n) { for (let left = n; left > 0; left -= 50) { const k = Math.min(50, left); await page.evaluate(k => { window.__tick(k); try { window.VillageView && window.VillageView.debug({ advance: k / 10 }); } catch {} }, k); await frames(2); } },
      async phase(p) { await page.waitForFunction(p => phase === p, p, { timeout: 30000 }); },
      async begin() { await page.locator('#go').click(); await t.phase('ask'); },
      async unlock() { const s = await t.st(); if (s.lock > 0) await t.run(s.lock); },
      async pack() { await page.evaluate(() => World.callPack(world)); },
      async buy(key) { await page.locator('#shop .slot[data-key="' + key + '"]').click(); },
      /* 아이가 글을 읽을 만한 시간(번개 문턱 = 필요 시간 × FAST_MIN)을 채운 뒤 정답을 누른다 */
      async answer() {
        await t.phase('ask'); await t.unlock();
        const k = await page.evaluate(() => Math.max(0, Math.ceil(Combat.FAST_MIN * Combat.needSeconds(round.q) / Combat.TICK) - round.t));
        if (k > 0) await t.run(k);
        await page.locator('#answers button[data-i="' + (await t.st()).answer + '"]').click();
      },
      async settle() { for (let i = 0; i < 80; i++) { const s = await t.st(); if (s.phase === 'ask') return; if (s.phase === 'learn') { await t.run(30); await page.locator('#answers button[data-i="' + s.answer + '"]').click().catch(() => {}); } await t.run(4); } throw new Error('다음 문제가 나오지 않음'); },
      /* 지금 문제가 읽기 문제(상식·수학·영어 퀴즈·쪽지 아님)가 될 때까지 맞히며 넘긴다 */
      async story(max = 10) { for (let i = 0; i < max; i++) { const s = await t.st(); if (s.mode !== 'quiz' && !s.special) return; await t.answer(); await t.settle(); } throw new Error('읽기 문제를 찾지 못함'); },
      /* 알림 띠(새 몬스터 등)가 사라질 때까지 세계를 조금씩 흘린다(띠가 단계 이름표를 가리는 장면용) */
      async clearBanners(max = 150) { for (let i = 0; i < max; i += 6) { if (!(await page.evaluate(() => !!document.querySelector('#effects .banner:not(.later)')))) return; await t.run(6); } },
      async longPress(id) { await page.evaluate(id => { const b = document.getElementById(id), n = Date.now; b.onpointerdown(); Date.now = () => n() + 2500; b.onpointerup(); Date.now = n; }, id); },
      async passGate() { await page.evaluate(() => { const N = { 이: 2, 삼: 3, 사: 4, 오: 5, 육: 6, 칠: 7, 팔: 8, 구: 9 }, m = /^(.)백(.)십(.)$/.exec(document.getElementById('gateCode').textContent); for (const c of [m[1], m[2], m[3]]) [...document.getElementById('gatePad').children].find(b => b.dataset.d === String(N[c])).click(); }); },
      /* CSS 애니메이션(동전 비행·튀는 칸)을 ms만큼 실제로 흘린 뒤 멈춘다: 찍는 동안 바뀌지 않게 */
      async settleCss(ms) {
        await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 }); await page.waitForTimeout(ms);
        /* 말풍선·가게 안내의 등장(0.25~0.35초, 끝 = 다 보임)은 실제 시간에 달려 반투명으로 찍히기도 해서 끝 상태로 맞춘다. 다른 애니메이션(동전 비행 등)은 그대로 */
        await page.evaluate(() => { for (const a of document.getAnimations()) if (a.animationName === 'bubbleIn' || a.animationName === 'tipIn') { try { a.finish(); } catch {} } });
        await cdp.send('Animation.setPlaybackRate', { playbackRate: 0 }); await frames(2);
      }
    };
    return t;
  }
  /* 찍기 전 확인: 테스트·개발 표시가 없어야 한다 */
  const audit = page => page.evaluate(() => {
    const vis = e => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none';
    const bad = [];
    if (vis(document.getElementById('testBar'))) bad.push('테스트 막대');
    if (vis(document.getElementById('tmPerf'))) bad.push('성능 숫자');
    if ([...document.querySelectorAll('.demo-tag,.tm-head')].some(vis)) bad.push('체험·테스트 표시');
    if (document.getElementById('drawer') && document.getElementById('drawer').open) bad.push('설정 서랍(버전 글자)');
    if (/[?&](test|demo)=/.test(location.search)) bad.push('테스트·체험 주소');
    return { bad, renderer: document.querySelector('.scene').dataset.renderer, overflowX: document.documentElement.scrollWidth > innerWidth + 1 };
  });
  const save = (name, buf, want) => {
    const out = png24(buf), info = pngInfo(out);
    if (info.w !== want[0] || info.h !== want[1]) throw new Error(name + ': 크기 ' + info.w + '×' + info.h + ' ≠ ' + want.join('×'));
    if (info.ct !== 2) throw new Error(name + ': 24비트 RGB가 아님');
    if (out.length > 8 * 1024 * 1024) throw new Error(name + ': 8MB 넘음');
    fs.writeFileSync(path.join(DIR, name), out);
    return { w: info.w, h: info.h, bytes: out.length };
  };

  for (const size of SIZE_LIST) {
    const S = SIZES[size]; manifest.sizes[size] = { viewport: [S.w, S.h], scale: S.dsf, px: S.px, name: S.name };
    for (const scene of SCENES) {
      if (ONLY && !ONLY.includes(scene.id)) continue;
      const name = size + '-' + scene.file + '-' + S.px.join('x') + '.png', t0 = Date.now();
      let t = null;
      try {
        t = await open(size, scene);
        await scene.make(t);
        await t.settleCss(scene.css || 150);
        const a = await audit(t.page);
        if (a.bad.length) throw new Error('찍히면 안 되는 것: ' + a.bad.join(', '));
        const meta = save(name, await t.page.screenshot({ type: 'png' }), S.px);
        manifest.shots.push({ id: scene.id, size, file: name, ...meta, title: scene.title, alt: scene.alt, state: scene.state, hidden: scene.hide || '', renderer: a.renderer, overflowX: a.overflowX, pageErrors: t.errors.slice(0, 5) });
        console.log('  ' + scene.id + ' ' + name + ' (' + a.renderer + ', ' + ((Date.now() - t0) / 1000).toFixed(0) + '초' + (t.errors.length ? ', 페이지 오류 ' + t.errors.length : '') + ')');
      } catch (e) {
        manifest.failed.push({ id: scene.id, size, error: String(e && e.message || e) });
        console.log('  실패 ' + scene.id + ' ' + size + ': ' + (e && e.message || e));
        if (t) await t.page.screenshot({ path: path.join(DIR, '_fail-' + size + '-' + scene.id + '.png') }).catch(() => {});
      } finally { if (t) await t.ctx.close().catch(() => {}); }
    }
  }

  /* 그래픽 이미지 1024×500: 성 단계 장면만(UI 없이) 배율 1.5로 찍어 2.048:1로 자르고, 제목 글자를 캔버스로 얹는다 */
  if (!ONLY || ONLY.includes('G1')) {
    let t = null;
    try {
      t = await open('tablet', FEATURE);
      await t.begin(); await t.story(); await t.pack(); await t.run(70); await t.answer(); await t.run(4); await t.settleCss(150);
      await t.page.addStyleTag({ content: BARE }); await t.run(1);
      const scene = await t.page.locator('#scene').screenshot({ type: 'png' });
      fs.writeFileSync(path.join(DIR, 'feature-G1-scene-source.png'), png24(scene));
      const a = await audit(t.page); await t.ctx.close(); t = null;
      const ctx = await browser.newContext({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      await page.setContent('<!doctype html><html><body style="margin:0;background:#9fbf7c"><canvas id="c" width="1024" height="500" style="display:block"></canvas></body></html>');
      for (const [suffix, sub] of [['', ''], ['-sub', '한글 읽기로 마을 지키기']]) {
        await page.evaluate(async ({ src, title, sub }) => {
          const img = new Image(); img.src = src; await img.decode();
          const c = document.getElementById('c'), x = c.getContext('2d'), W = 1024, H = 500, r = W / H, ir = img.width / img.height;
          let sw, sh, sx, sy; if (ir > r) { sh = img.height; sw = sh * r; sx = (img.width - sw) / 2; sy = 0; } else { sw = img.width; sh = sw / r; sx = 0; sy = (img.height - sh) * 0.55; }
          x.clearRect(0, 0, W, H); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
          const g = x.createLinearGradient(0, 0, 0, H * 0.52); g.addColorStop(0, 'rgba(22,38,30,.62)'); g.addColorStop(1, 'rgba(22,38,30,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H * 0.52);
          const face = '"Noto Sans CJK KR","Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic","WenQuanYi Zen Hei",sans-serif';
          x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
          const ty = sub ? 104 : 120;
          x.font = '900 104px ' + face; x.lineWidth = 16; x.strokeStyle = '#21382d'; x.strokeText(title, W / 2, ty); x.fillStyle = '#fff6d8'; x.fillText(title, W / 2, ty);
          if (sub) { x.font = '800 36px ' + face; x.lineWidth = 9; x.strokeText(sub, W / 2, ty + 82); x.fillStyle = '#ffe39a'; x.fillText(sub, W / 2, ty + 82); }
        }, { src: 'data:image/png;base64,' + scene.toString('base64'), title: '꼬꼬마을', sub });
        const name = 'feature-G1' + suffix + '-1024x500.png', meta = save(name, await page.locator('#c').screenshot({ type: 'png' }), [1024, 500]);
        manifest.shots.push({ id: 'G1' + suffix, size: 'feature', file: name, ...meta, title: FEATURE.title + (sub ? ' · 부제 있음' : ' · 제목 한 줄'), alt: FEATURE.alt, state: FEATURE.state, renderer: a.renderer, source: 'feature-G1-scene-source.png' });
        console.log('  G1 ' + name);
      }
      await ctx.close();
    } catch (e) {
      manifest.failed.push({ id: 'G1', size: 'feature', error: String(e && e.message || e) });
      console.log('  실패 G1: ' + (e && e.message || e));
      if (t) { await t.page.screenshot({ path: path.join(DIR, '_fail-feature-G1.png') }).catch(() => {}); await t.ctx.close().catch(() => {}); }
    }
  }

  fs.writeFileSync(path.join(DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  await browser.close(); server.close();
  console.log('저장: ' + DIR + ' · ' + manifest.shots.length + '장 · 실패 ' + manifest.failed.length);
  if (manifest.failed.length) process.exit(1);
}
module.exports = { png24, decodePng, pngInfo, encodeRgb, SCENES, SIZES };
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
