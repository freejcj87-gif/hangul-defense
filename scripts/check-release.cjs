'use strict';
/* 출시 점검(웹 쪽): 게시·제출 전에 남아 있으면 안 되는 자리표시를 찾는다.
   node scripts/check-release.cjs           경고만 하고 끝 코드 0. GitHub Actions에서는 ::warning 주석으로 실행 화면·PR 검사에 뜬다
   node scripts/check-release.cjs --strict  자리표시가 하나라도 남으면 끝 코드 1(출시 빌드·스토어 제출 직전 관문)
   보는 것
   ① notes.js 맨 위 POLICY: 개발자 이름 · 문의 이메일 · 시행일 · 인터넷 권한 문장 · 상담 번호 재확인 표시 · 개정 이력(채웠으면 모양도 본다)
   ② 처리방침 본문(NOTES.PRIVACY)에 POLICY 밖에서 직접 적힌 대괄호 [ ]
   ③ privacy/index.html이 앱 안 본문과 같은 글인지(다르면 --strict가 아니어도 끝 코드 1)
   Android 앱 묶음·매니페스트 쪽 점검은 Android 브랜치(android.yml)의 몫이다. */
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const STRICT = process.argv.includes('--strict');
const GHA = process.env.GITHUB_ACTIONS === 'true';
const NOTES = require(path.join(ROOT, 'notes.js'));
const Page = require('./privacy-page.cjs');
const notesLines = fs.readFileSync(path.join(ROOT, 'notes.js'), 'utf8').split(/\r?\n/);
const lineOf = text => { const i = notesLines.findIndex(l => l.includes(text)); return i < 0 ? 1 : i + 1; };
const BRACKET = /\[[^\]\n]+\]/g;
const isTodo = v => typeof v !== 'string' || !v.trim() || /\[[^\]\n]+\]/.test(v);
const warns = [], errors = [];
const warn = (line, msg) => warns.push({ file: 'notes.js', line, msg });

/* ① POLICY 칸 */
const P = NOTES.POLICY || {};
const FIELDS = [
  ['developer', '개발자 이름(스토어 개발자 이름과 같게)', v => v.length <= 60],
  ['email', '보호자 문의 이메일', v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)],
  ['since', '시행일(예: 2027년 1월 20일)', v => /^\d{4}년 \d{1,2}월 \d{1,2}일$/.test(v)],
  ['internet', '7항 인터넷 권한 문장(Android 포장 결과에 맞춰 하나)', v => /인터넷 권한/.test(v)]
];
for (const [key, label, shape] of FIELDS) {
  const v = P[key];
  if (isTodo(v)) warn(lineOf(key + ":'"), 'POLICY.' + key + ' 자리표시 남음: ' + (v || '(빈 값)') + ' → ' + label);
  else if (!shape(v)) warn(lineOf(key + ":'"), 'POLICY.' + key + ' 모양 확인: "' + v + '" → ' + label);
}
if (P.phoneCheck) warn(lineOf("phoneCheck:'"), '12항 상담 번호 재확인 표시 남음: ' + P.phoneCheck + ' → 118 · 1833-6972를 각 기관 누리집에서 확인한 뒤 phoneCheck를 \'\'로');
const hist = Array.isArray(P.history) ? P.history : [];
if (!hist.length) warn(lineOf('history:['), 'POLICY.history(개정 이력)가 비었음');
for (const [d, t] of hist) if (isTodo(d) || isTodo(t)) warn(lineOf('history:['), '개정 이력 자리표시 남음: ' + d + ' ' + t);
if (hist.length && !isTodo(P.since) && hist[hist.length - 1][0] !== P.since) warn(lineOf('history:['), '개정 이력 마지막 줄 날짜(' + hist[hist.length - 1][0] + ')가 시행일(' + P.since + ')과 다름');

/* ② POLICY 밖에서 본문에 직접 적힌 대괄호 */
const known = new Set(Object.values(P).flatMap(v => (Array.isArray(v) ? v.flat() : [v])).filter(v => typeof v === 'string'));
const flat = (NOTES.PRIVACY || []).flatMap(([h, l]) => [h, ...l]);
const stray = new Set();
for (const text of flat) for (const m of text.match(BRACKET) || []) if (![...known].some(k => k.includes(m))) stray.add(m);
for (const m of stray) warn(lineOf(m), '처리방침 본문에 대괄호가 직접 남음: ' + m + ' → notes.js PRIVACY(채울 칸이면 POLICY로 옮김)');

/* ③ 웹 페이지 = 앱 안 본문 */
if (!Page.read()) errors.push({ file: 'privacy/index.html', line: 1, msg: 'privacy/index.html이 없음 → node scripts/privacy-page.cjs' });
else if (!Page.same()) errors.push({ file: 'privacy/index.html', line: 1, msg: 'privacy/index.html이 notes.js의 앱 안 본문과 다름 → node scripts/privacy-page.cjs' });

/* 결과 */
const esc = s => String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
for (const e of errors) { console.log((GHA ? '::error file=' + e.file + ',line=' + e.line + ',title=출시 점검::' : '오류 ' + e.file + ':' + e.line + ' ') + esc(e.msg)); }
for (const w of warns) { console.log((GHA ? '::' + (STRICT ? 'error' : 'warning') + ' file=' + w.file + ',line=' + w.line + ',title=출시 자리표시::' : '경고 ' + w.file + ':' + w.line + ' ') + esc(w.msg)); }
console.log('출시 점검(웹): 오류 ' + errors.length + ' · 자리표시·확인 ' + warns.length + (STRICT ? ' · 엄격 모드' : ' · 경고 모드(제출 직전에는 --strict)')
  + (warns.length ? '' : ' · 처리방침 자리표시 없음') + ' · 방침 주소 ' + Page.URL);
process.exit(errors.length || (STRICT && warns.length) ? 1 : 0);
