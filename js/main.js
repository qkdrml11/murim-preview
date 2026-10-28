// 화면 시작점: 게임(규칙) + 화면 모듈을 버스로 잇고, 저장·디버그 매개변수를 처리해요.
import { createGame, isOurSave } from './game.js';
import { resolveSave, saveKeyFor } from './systems/savekeys.js';
import { calendar, SEC_PER_MONTH } from './systems/time.js';
import { FACTIONS } from './data/factions.js';
import { CONFIG } from './data/config.js';
import { TASKS, BUILDINGS } from './data/tasks.js';
import { createMap } from './ui/map.js';
import { createSheets } from './ui/sheets.js';
import { createTabs } from './ui/tabs.js';
import { createDuelUI } from './ui/duel.js';
import { modal } from './ui/modal.js';
import { toast } from './ui/toast.js';
import { $, esc, portrait, haptic, bindSettings, fmtSilver } from './ui/util.js';

const Q = new URLSearchParams(location.search);
const DEBUG = Q.get('debug') === '1';
const isPreview = /murim-preview/.test(location.pathname) || Q.get('preview') === '1';
// 저장 키(§9 ⑤ Q1): 본판 murim_save_v7 · 미리보기 murim_save_v7_preview. murim_save_v5(예전 v0.5.2)는 안 건드려요.
const SAVE_KEY = saveKeyFor(isPreview);
const debugSpeed = DEBUG && Q.get('speed') ? Math.max(1, Math.min(200, +Q.get('speed'))) : 0;

let game, map, sheets, tabs, duelUI;
const ui = { alerts: {}, alertsByProv: {}, saveKey: SAVE_KEY };

function boot(state, allOpen) {
  game = createGame({ state, debugSpeed, allOpen });
  if (allOpen && state) game.unlocks.openAll();
  bindSettings(() => game.state.settings);
  ui.sheets = sheets = sheets || null;
  wire();
}
function wire() {
  const bus = game.bus;
  sheets = createSheets(game, ui); ui.sheets = sheets;
  tabs = tabs || createTabs(game, ui); ui.tabs = tabs;
  duelUI = createDuelUI(game);
  map = map || createMap($('#map'), game, ui); ui.map = map;
  ui.openPlace = id => { delete ui.alerts[id]; recountAlerts(); sheets.place(id); };
  ui.closePanel = () => tabs.show('map');
  bus.on('feature:open', f => { applyFeatures(f.key); });
  bus.on('notify', n => { if (n.kind === 'feature') { haptic([10, 30, 10]); modal({ title: n.text.replace(/^새로 열렸어요: /, '새로 열렸어요 — '), body: n.story ? `${n.story}` : n.text, cls: 'unlock-card' }); if (tabs.tab !== 'news') $('#newsDot').classList.add('on'); return; }
    toast(n.text, n.kind === 'unlock' ? 'big' : n.kind || 'info', n.kind === 'unlock' ? 6000 : 3400); if (n.place) { ui.alerts[n.place] = 1; recountAlerts(); }
    if (n.kind === 'unlock') modal({ title: '자동 겨루기가 열렸어요', body: n.text }); if (tabs.tab !== 'news') $('#newsDot').classList.add('on'); if (n.kind === 'alert') haptic([20, 40, 20]); });
  bus.on('ask', spec => { haptic(15); modal({ title: spec.title, body: spec.body, choices: spec.choices }).then(id => { spec.cb && spec.cb(id); refresh(); }); if (spec.place) { ui.alerts[spec.place] = 1; recountAlerts(); } });
  bus.on('duel:request', full => duelUI.request(full));
  bus.on('recruit', pr => { tabs.show('map'); sheets.recruit(pr); });
  bus.on('pickTeam', spec => { tabs.show('map'); sheets.pickTeam(spec); });
  bus.on('speed', () => paintSpeed());
  bus.on('changed', () => scheduleRefresh());
  bus.on('colors', () => map.redrawWash());
  bus.on('month', () => { map.redrawWash(); bumpSilver(); });
  bus.on('autosave', () => save());
  bus.on('loaded', () => map.redrawWash());
  bus.on('achievement', () => haptic([15, 30, 15, 30, 60]));
}
// data-feature="키" 붙은 요소는 그 기능이 열렸을 때만 보여요(§9 ②: 잠금 회색 없이 아예 숨김). 막 열린 건 잠깐 반짝여요.
function applyFeatures(justOpened) {
  document.querySelectorAll('[data-feature]').forEach(el => { const on = game.isOpen(el.dataset.feature); el.hidden = !on;
    if (on && justOpened && el.dataset.feature === justOpened) { el.classList.remove('feat-pop'); void el.offsetWidth; el.classList.add('feat-pop'); } });
  map?.redrawFog?.();
}
ui.applyFeatures = applyFeatures;
function recountAlerts() { ui.alertsByProv = {}; for (const id of Object.keys(ui.alerts)) { const pl = game.place(id); if (pl) ui.alertsByProv[pl.prov] = (ui.alertsByProv[pl.prov] || 0) + 1; } map?.redraw(); }
ui.seenNews = () => $('#newsDot').classList.remove('on');
// 화면 밀림 방지: 무엇이(포커스·scrollIntoView·가상 키보드) 페이지나 #app을 스크롤해도 바로 0으로 되돌려요.
const appEl = document.getElementById('app');
ui.unshift = () => { if (appEl.scrollTop || appEl.scrollLeft) appEl.scrollTop = appEl.scrollLeft = 0; const se = document.scrollingElement; if (se && (se.scrollTop || se.scrollLeft)) se.scrollTop = se.scrollLeft = 0; if (window.scrollY || window.scrollX) window.scrollTo(0, 0); };
appEl.addEventListener('scroll', ui.unshift); window.addEventListener('scroll', ui.unshift, { passive: true });
window.visualViewport?.addEventListener('resize', () => setTimeout(ui.unshift, 50));
document.addEventListener('focusin', () => requestAnimationFrame(ui.unshift));
function save() { try { localStorage.setItem(SAVE_KEY, game.serialize()); } catch (e) { console.warn('save failed', e); } }
ui.save = () => { save(); refresh(); };
ui.resetGame = () => { localStorage.removeItem(SAVE_KEY); location.reload(); }; // 새 키만 지움(v5는 절대 안 지움)
let lastSilver = null;
function bumpSilver() { const c = $('#chipSilver'); c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); }
ui.bumpSilver = bumpSilver;
let refreshQueued = false;
function scheduleRefresh() { if (refreshQueued) return; refreshQueued = true; requestAnimationFrame(() => { refreshQueued = false; refresh(); }); }
function refresh() {
  const s = game.state; const c = calendar(s.month);
  $('#hudDate').textContent = c.text;
  const mine = Object.values(s.towns).filter(t => t.owner === 'cw').length;
  $('#hudSub').textContent = `귀주 · 청운문 · 우리 고을 ${mine}`;
  $('#vSilver').textContent = fmtSilver(s.silver); $('#chipSilver').classList.toggle('neg', game.ledger().net < 0 && s.silver < 100);
  if (lastSilver !== null && s.silver !== lastSilver) bumpSilver(); lastSilver = s.silver;
  $('#vFame').textContent = s.fame;
  applyFeatures(); people(); goal(); paintSpeed(); legend();
  if (sheets.open) sheets.refresh();
  tabs.render(); map.redraw();
}
ui.refresh = refresh;
function people() {
  const s = game.state;
  $('#peopleRow').innerHTML = s.people.map(p => { const t = game.taskOf(p); const cls = p.injured > 0 ? 'hurt busy' : t ? 'busy' : 'idle';
    const stt = p.injured > 0 ? `부상 ${p.injured}달` : t ? `${t.short}${t.remaining != null ? ' ' + t.remaining + '달' : ''}` : '쉬는 중';
    return `<button class="pp ${cls}" data-p="${p.id}" aria-label="${esc(game.name(p))}">${portrait(p)}<span class="nm">${esc(game.name(p))}</span><span class="st">${esc(stt)}</span></button>`; }).join('');
}
$('#peopleRow').addEventListener('click', e => { const b = e.target.closest('.pp'); if (!b) return; haptic(10); tabs.show('map'); sheets.person(b.dataset.p); });
function legend() {
  const s = game.state; const cnt = {}; for (const t of Object.values(s.towns)) if (t.owner) cnt[t.owner] = (cnt[t.owner] || 0) + 1;
  const fs = Object.entries(cnt).filter(([f]) => f === 'cw' || ['hd', 'hs', 'jc', 'dg', 'sd'].includes(f)).sort((a, b) => (b[0] === 'cw') - (a[0] === 'cw') || b[1] - a[1]).slice(0, 4);
  $('#legend').innerHTML = fs.map(([f, n]) => `<span><i style="background:${FACTIONS[f].color}"></i>${FACTIONS[f].name} ${n}</span>`).join('');
}
function goal() { // 목표 한 줄: 지금 열린 기능 안에서만 권해요(§9 하나씩 열기)
  const s = game.state; const idle = s.people.filter(p => !game.isBusy(p)); const O = k => game.isOpen(k);
  let g;
  const hasBiz = type => Object.values(s.towns).some(t => t.biz.some(b => b.owner === 'cw' && b.type === type && !b.startOwned));
  const busyType = t => s.tasks.some(x => x.type === t);
  if (s.month === 1 && !s.tasks.length) g = '사람을 눌러 일을 맡겨 보세요 — 수련, 또는 주막 돌보기';
  else if (s.speed === 0 && s.month === 1 && s.prog === 0) g = '아래 [▶ 1배]를 누르면 시간이 흘러요';
  else if (s.flags.sweepPending) g = '숯막골 소탕 — 강호소식에서 2~3명을 보내요';
  else if (O('biz_inn') && !hasBiz('jumak') && !busyType('openJumak')) g = `${game.name(game.person('p2'))}에게 청석 주막 열기(${TASKS.openJumak.cost}냥 · ${TASKS.openJumak.months}달)`;
  else if (O('quest') && !O('biz_inn') && !busyType('request')) g = `쉬는 제자에게 의뢰 맡기기(${TASKS.request.cost}냥) — 운봉 우물`;
  else if (O('stay') && s.towns['청석'].owner !== 'cw' && !busyType('stay')) g = `청석에 머물기 — 우리 세력 ${s.towns['청석'].inf.cw || 0}/30, 1위·10 앞서기`;
  else if (O('biz_pyo') && !hasBiz('pyoguk') && !busyType('openPyoguk')) g = `일류 제자에게 표국 열기(${TASKS.openPyoguk.cost}냥 · ${TASKS.openPyoguk.months}달)`;
  else if (O('recruit') && !s.achievements.disciples10 && s.people.length < 8 && !busyType('recruit')) g = `장문인으로 제자 모집(${TASKS.recruit.cost}냥) — 후보는 골라 받아요`;
  else if (O('build') && !Object.keys(s.buildings).length && !busyType('build')) g = `본산 짓기 — 수련동(${BUILDINGS.suryeondong.cost}냥 · ${BUILDINGS.suryeondong.months}달)`;
  else if (O('tourney')) g = '무림대회 준비 — 대표 제자 수련(참가는 명성 조건 · 다음 업데이트)';
  else if (idle.length) g = `쉬는 사람 ${idle.length}명 — 눌러서 일을 맡겨요`;
  else g = '시간을 흘려 보내요 — 달마다 새 일이 하나씩 열려요';
  $('#goalText').textContent = g;
}
$('#goal').addEventListener('click', () => { haptic(6); if (game.isOpen('ledger')) tabs.show('biz'); });
function paintSpeed() { const s = game.state; document.querySelectorAll('.sp').forEach(b => { b.classList.toggle('on', +b.dataset.s === s.speed); b.classList.toggle('nudge', s.speed === 0 && +b.dataset.s === 1 && s.tasks.length > 0 && s.month === 1); }); }
$('#speedBar').addEventListener('click', e => { const b = e.target.closest('.sp'); if (!b) return; haptic(8); game.setSpeed(+b.dataset.s); paintSpeed(); });
$('#levelSeg').addEventListener('click', e => { const b = e.target.closest('button[data-l]'); if (!b) return; haptic(6); map.setLevelFromSeg(+b.dataset.l); });
$('#btnHome').addEventListener('click', () => { haptic(6); map.goHome(); });
document.querySelectorAll('.chip[data-tab]').forEach(c => c.addEventListener('click', () => { const t = c.dataset.tab; if (t === 'biz' && !game.isOpen('ledger')) return; haptic(6); tabs.show(t); }));
ui.onLevel = l => document.querySelectorAll('#levelSeg button').forEach(b => b.classList.toggle('on', +b.dataset.l === l));
ui.afterAssign = () => { if (game.state.month === 1 && game.state.speed === 0) toast('아래 [▶ 1배]를 누르면 시간이 흘러요', 'info', 3000); };

async function intro() {
  const pages = [
    '<span class="big">청운문 淸雲門</span>귀주 산골, 한때 이름 높던 문파가 있었어요. 지금 남은 건 장문인 단청우와 제자 다섯, 그리고 본산 아래 주막 하나.',
    `흑담채 산적이 청석 고을을 넘보고, 은자는 ${CONFIG.startSilver}냥뿐.<br>그래도 제자들은 떠나지 않았어요. <b>"첫해는 의리로 버티겠습니다."</b>`,
    '하연: <b>"사형제 다섯이 남았습니다. 우선 칼부터 다시 잡지요."</b><br>사람을 눌러 <b>일</b>을 맡겨요. 지금 할 수 있는 일은 <b>수련</b>과 <b>주막 돌보기</b>. 달마다 새 일이 하나씩 열려요.',
  ];
  for (let i = 0; i < pages.length; i++) await modal({ html: `<div class="story">${pages[i]}</div>`, choices: [{ id: 'n', label: i < pages.length - 1 ? '다음' : '시작하기', primary: true }] });
  game.endIntro();
  await modal({ title: '살림 알림', body: `첫해는 창립 제자 생활비가 절반이에요(30냥, ${game.FIRST_YEAR_MONTHS}달까지).\n${game.FIRST_YEAR_MONTHS + 1}달부터는 전액(60냥)이라 그 전에 수입을 늘려 두세요.` });
  toast('할 수 있는 일: 수련, 주막 돌보기', 'big', 3600);
  refresh();
}
// 시작
(async function start() {
  if (isPreview) $('#badge').hidden = false;
  let R = { raw: null, oldFound: false }; try { R = resolveSave(localStorage, isPreview, isOurSave); } catch (e) {}
  let state = null; if (R.raw) { try { state = JSON.parse(R.raw); } catch (e) { state = null; } if (state && !isOurSave(state)) state = null; }
  const oldFormat = !state && R.oldFound;
  boot(state || undefined, Q.get('unlock') === 'all' && DEBUG);
  map.init(); refresh();
  window.addEventListener('resize', () => map.resize());
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  let last = performance.now(), acc = 0;
  const loop = t => { const dt = Math.min(0.1, (t - last) / 1000); last = t;
    if (!duelUI.busy) { const pm = game.state.month; game.tick(dt); if (game.state.speed) { acc += dt; if (acc > 0.25) { acc = 0; $('#mprog').style.width = (game.state.prog * 100).toFixed(1) + '%'; } } }
    map.frame(dt); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  if (oldFormat && !game.state.flags.oldSaveNoticed) { game.state.flags.oldSaveNoticed = true; toast('예전 버전 저장은 그대로 두었어요', 'big', 3600); }
  if (!game.state.introDone) await intro();
  else { toast(`이어서 — ${calendar(game.state.month).text}`, 'info', 2200); if (game.migrateNotice) toast(game.migrateNotice, 'big', 4000); }
  game.resumePending(); save();
  $('#mprog').style.width = (game.state.prog * 100).toFixed(1) + '%';
  if (DEBUG) window.ND = { game, ui, map, save, SAVE_KEY, SEC_PER_MONTH };
})();
