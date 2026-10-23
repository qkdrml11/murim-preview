// murim 1단계 UI
'use strict';
(function () {
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const UI = { zoom: { k: 1, tx: 0, ty: 0 }, tapLog: [], tab: 'map', sub: { char: 'me', base: 'inn' }, sel: null, flash: [], busy: false, replay: null, lastDuelLog: [], instant: false, autoParry: false };
window.UI = UI;
const S = () => G.S;
const bandBadge = w => { const [t, c] = DuelLib.band(w); return '<span class="badge b-' + c + '">' + t + (G.debug ? ' ' + Math.round(w * 100) + '%' : '') + '</span>'; };

// ---------- 공통: 토스트·모달 ----------
// 토스트는 한 번에 2개까지. 3개 이상 몰리면 요약 모달 1개로 묶는다(버튼 위로 쌓이지 않게)
// 토스트는 한 번에 2개까지. 4건 이상 몰리면 요약 모달 1개로 묶어 바로 띄운다(단일 모달 큐)
function flushToasts() { if (!G.msgs.length) return; const tb = $('#toast'); const vis = [...tb.children].map(d => d.textContent);
  const all = vis.concat(G.msgs.splice(0));
  if (all.length >= 4) { tb.innerHTML = ''; modal({ title: '알림 ' + all.length + '건', html: '<ul class="sumlist">' + all.map(t => '<li>' + esc(t).replace(/\n/g, '<br>') + '</li>').join('') + '</ul>' }); return; }
  tb.innerHTML = ''; for (const t of all.slice(-2)) { const d = document.createElement('div'); d.textContent = t; tb.appendChild(d); setTimeout(() => d.remove(), 3500); } }
// 모달이 닫힌 뒤 250ms 동안 입력 무시(두 번 탭이 탭 바·행동 버튼에 닿지 않게, 큐 사이 1틱 틈도 막음)
UI.blockUntil = 0;
['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'click'].forEach(ev => document.addEventListener(ev, e => { if (performance.now() < UI.blockUntil) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); } }, { capture: true, passive: false }));
// 모든 모달은 하나의 줄(queue)로: 한 번에 하나만, 앞의 것이 닫혀야 다음 것이 열린다
let modalQ = Promise.resolve(); UI.modalLog = []; UI.modalPending = 0;
function modal(o) { UI.modalPending++;
  const p = modalQ.then(() => showModal(o)); modalQ = p.then(() => { UI.modalPending--; }, () => { UI.modalPending--; }); return p; }
function showModal(o) { // {title, text, html, buttons:[{t, cls, fn, keep}]}
  UI.modalLog.push(o.title || '');
  if (UI.goalOpen) { UI.goalOpen = false; compactTop(); }
  return new Promise(res => {
    const m = $('#modal'); m.classList.remove('hidden');
    m.innerHTML = '<div class="sheet"><h2>' + esc(o.title || '') + '</h2>' + (o.text ? '<div class="txt">' + esc(o.text) + '</div>' : '') + (o.html || '') + '<div class="btns"></div></div>';
    const box = m.querySelector('.btns');
    (o.buttons || [{ t: '확인', cls: 'pri' }]).forEach((b, i) => { const el = document.createElement('button'); el.className = 'big ' + (b.cls || ''); el.textContent = b.t; el.disabled = !!b.disabled;
      el.onclick = () => { UI.blockUntil = performance.now() + 250; m.classList.add('hidden'); m.innerHTML = ''; if (b.fn) b.fn(); res(i); }; box.appendChild(el); });
    if (o.after) o.after(m);
  });
}
UI.modal = modal;
function refresh() { if (G.PREVIEW && !document.querySelector('.prevbadge')) { const b = document.createElement('div'); b.className = 'prevbadge'; b.textContent = '미리보기'; document.body.appendChild(b); }
  if (!S()) return; G.claimable(); render(); flushToasts(); }
UI.refresh = refresh;
// 사건 큐 처리
async function drain() {
  if (UI.busy) return; UI.busy = true;
  try { while (G.queue.length) { const ev = G.queue.shift(); refresh(); await handle(ev); } }
  finally { UI.busy = false; refresh(); }
}
UI.drain = drain;
async function handle(ev) {
  const s = S();
  switch (ev.type) {
    case 'info': if (ev.title && ev.title.indexOf('무공 습득') === 0 && s.tut && s.tut.personal && !s.tut.personal.t11) { await modal({ title: ev.title, text: ev.text + '\n\n취팔 노개: "하나만 파면 질리지. 몸에 맞는 걸 골라 써."', buttons: [{ t: '익힌다', cls: 'pri', fn: () => { s.tut.personal.t11 = 1; } }] }); break; }
      await modal({ title: ev.title, text: ev.text }); break;
    case 'kiyeon': await kiyeonUI(ev); break;
    case 'choice': { let k = -1; await modal({ title: ev.title, text: ev.text, buttons: ev.opts.map((t, i) => ({ t, cls: i === 0 ? 'pri' : '', fn: () => k = i })) }); if (G[ev.cb]) G[ev.cb](k, ev.arg); break; }
    case 'encounter': { const e = G.enemyOf(ev.id); const w = G.predict(e, 'enemy', ev.id).w;
      await modal({ title: '적 조우', text: D.LOCAL[ev.id][0] + '와(과) 마주쳤다! (행동 추가 소모 없음)', html: '<p>예상 승률 ' + bandBadge(w) + '</p>' });
      const win = await duelUI(e, G.duelOpts('enemy', ev.id), { w }); G.fightResult({ kind: 'enemy', id: ev.id }, win, w); break; }
    case 'story': await storyUI(ev); break;
    case 'tourney': await tourneyUI(ev.t); break;
    case 'omen': { const [t, x] = G.omenText(ev.n); await modal({ title: t, text: x }); G.omen(ev.n); break; }
    case 'rival23': await rivalUI(); break;
    case 'branch': await branchUI(); break;
    case 'tatongHint': await tatongHintUI(); break;
  }
  flushToasts();
}
// ---------- 시작 화면 ----------
function startScreen() {
  const has = !!G.load(); const el = $('#start'); el.classList.remove('hidden'); $('#main').classList.add('hidden');
  el.innerHTML = '<h1>강호쟁패</h1><p class="muted">(가제) · 1단계 프로토타입</p><p>정마대전 전야, 검 한 자루뿐인 삼류 낭인.</p>' +
    (has ? '<button class="big pri" id="cont">이어 하기</button>' : '') +
    '<input id="nm" maxlength="8" placeholder="이름" value="한무결"><button class="big ' + (has ? '' : 'pri') + '" id="new">새 게임</button>' +
    '<button class="big ghost" id="skip">튜토리얼 건너뛰기로 새 게임</button>';
  if (has) $('#cont').onclick = () => enterGame(false);
  const go = async (skip) => {
    if (has && !(await confirmP('새 게임을 시작하면 기존 저장이 지워집니다.'))) return;
    if (skip && !(await confirmP('튜토리얼을 건너뛸까요? 남은 단계 보상은 즉시 지급됩니다.'))) return;
    G.newGame($('#nm').value.trim() || '한무결', skip); enterGame(true);
  };
  $('#new').onclick = () => go(false); $('#skip').onclick = () => go(true);
}
function confirmP(text, yes, no) { return modal({ title: '확인', text, buttons: [{ t: yes || '예', cls: 'pri' }, { t: no || '아니오' }] }).then(i => i === 0); }
async function enterGame(isNew) {
  $('#start').classList.add('hidden'); $('#main').classList.remove('hidden');
  if (isNew) {
    G.push({ type: 'info', title: '귀주의 산골 마을', text: S().name + ', 25세. 소속 없는 삼류 낭인. 낡은 검 한 자루와 은자 100냥.\n\n산적에게 쫓기던 나무꾼을 구하고, 객잔에서 개방 거지 취팔 노개를 만났다.\n"막힌 혈은 앉아서 뚫는 거야. 강해지고 싶으면 걷고, 앉고, 또 걸어."' });
  } else {
    const q = new URLSearchParams(location.search); const off = parseFloat(q.get('offline'));
    if (G.debug && !isNaN(off)) { S().off.lastSeen -= off * 60000; S().off.maxSeen = S().off.lastSeen; S().off.bucketTs -= off * 60000; history.replaceState(null, '', location.pathname + '?debug=1'); }
    await outUI(G.processOffline());
  }
  refresh(); drain();
}
// ---------- 상단 바 ----------
const progTxt = i => { const p = G.goalProg(i); return p ? ' (' + Math.min(p[0], p[1]) + '/' + p[1] + ')' : ''; };
const todoHint = () => { const w = G.whereTo(); return w.ids.length && w.why ? ' → ' + (w.why.indexOf('길') >= 0 || w.why.indexOf('미방문') >= 0 || w.why.indexOf('객잔') >= 0 ? w.why : w.ids.map(G.rname).join('·')) : ''; };
const subLine = g => '<div class="goal sub" id="subg"><span class="gt">◦ ' + esc(g.t) + ' <span class="muted">· ' + esc(g.rw) + '</span></span></div>';
function topHTML() {
  const s = S(); let h = '';
  const P = s.tut.path;
  if (s.route === 3 && P && !P.skipped && P.step < 5) {
    const r = D.RTUT[P.step]; h += '<div class="goal"><span class="gt">🧭 ' + esc(r.goal) + '</span></div>';
  } else if (s.route === 3) h += '<div class="goal"><span class="gt">🧭 홀로 걷는 길: 현상금·호위로 이름을 떨쳐라 (25~30턴)</span></div>';
  else {
    const lines = G.goalLines(), cl = G.claimable();
    const subg = G.subText(); const rest = lines.length - 1;
    lines.forEach((i, k) => { const ok = G.goalCond(i); const sub = k > 0 && !D.GOALS[i][2];
      if (k === 1) { if (subg) h += subLine(subg); if (rest > 0) h += '<div class="goal sub" id="nextTog"><span class="gt">· 다음 목표 ' + rest + '개 ' + (UI.nextOpen ? '▴' : '▾') + '</span></div>'; }
      if (k > 0 && !UI.nextOpen) return;
      h += '<div class="goal ' + (sub ? 'sub ' : '') + (ok ? 'ok' : '') + '"><span class="gt">' + (k === 0 ? '🎯 ' : '· ') + esc(D.GOALS[i][0]) + '<b style="color:#fbbf24">' + progTxt(i) + '</b><span class="muted">' + esc(G.giveText(D.GOALS[i][1])) + '</span></span>' +
        (k === 0 ? '<button class="sm ' + (cl.length ? 'pri glow' : '') + '" id="claim" ' + (cl.length ? '' : 'disabled') + '>받기' + (cl.length > 1 ? ' ' + cl.length : '') + '</button><button class="sm icon' + (s.todo ? ' glow' : '') + '" id="where" title="어디로?">➜</button>' : '') + '</div>'; });
    if (!lines.length) h += '<div class="goal"><span class="gt">🎯 1막 목표를 모두 마쳤다</span></div>';
    if (lines.length <= 1 && subg) h += subLine(subg);
  }
  if (s.todo && !s.route) h += '<div class="goal sub" style="color:#fbbf24;font-weight:700" id="todo"><span class="gt">👉 지금 할 일: ' + esc((s.goals.mainIdx >= 0 && D.GOALS[s.goals.mainIdx] ? D.GOALS[s.goals.mainIdx][0] + progTxt(s.goals.mainIdx) : G.nowTodo()) + todoHint()) + '</span></div>';
  const lk = G.breakLock();
  if (lk && !G.tatongSpot(s.loc) && s.route !== 3) h += '<div class="goal sub"><span class="gt">⚠ 타통하려면 객잔이나 산으로</span></div>';
  h += '<div class="statrow"><span>' + G.dateStr() + ' (' + s.turn + '턴)</span><span class="acts">' + '●'.repeat(Math.max(0, s.acts)) + '<span style="color:#57534e">' + '●'.repeat(3 - Math.max(0, s.acts)) + '</span></span><span>💰' + s.silver + '</span><span class="sp"></span>' +
    '<button class="icon sm" id="rest" title="폐관에 들고 쉬기">🕯️</button><button class="icon sm" id="help">?</button><button class="icon sm" id="set">⚙</button></div>';
  return h;
}
// ---------- 지도 ----------
const XY = id => { const r = D.REGIONS[id]; return [18 + r[1] * 354, 16 + r[2] * 528]; };
const TER = { '마을': '#c08a52', '도시': '#7c8aa0', '산': '#4d7c0f', '강': '#0e7490', '변방': '#78716c' };
function mapSVG() {
  const s = S(); if (s.todo && !UI.flash.length) UI.flash = G.whereTo().ids;
  const mt = G.moveTargets(), reveal = !!s.ev.branched && s.ev.branched !== false;
  const z = UI.zoom; let h = '<svg class="map" viewBox="0 0 390 560" preserveAspectRatio="xMidYMid meet"><rect class="mapbg" x="-2000" y="-2000" width="4390" height="4560" fill="transparent"/><g id="mz" transform="translate(' + z.tx + ' ' + z.ty + ') scale(' + z.k + ')">';
  const done = {};
  for (const a in D.ADJ) for (const b of D.ADJ[a]) { const k = [a, b].sort().join(); if (done[k]) continue; done[k] = 1; const [x1, y1] = XY(a), [x2, y2] = XY(b);
    const hl = (a === s.loc && mt[b]) || (b === s.loc && mt[a]); h += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + (hl ? '#fbbf24' : '#57534e') + '" stroke-width="' + (hl ? 2.5 : 1.2) + '"/>'; }
  for (const id in D.REGIONS) {
    const [x, y] = XY(id), r = G.risk(id), cl = G.closed(id);
    let ring = r <= s.realm ? '#22c55e' : r === s.realm + 1 ? '#f97316' : '#ef4444';
    let fill = cl ? '#3f3f46' : TER[G.kind(id)];
    if (reveal && s.ev.branched !== false && s.revealMap) fill = D.FACTION_COLOR[s.owners[id][0]] || D.FACTION_COLOR[s.owners[id][1]] || fill;
    const adj = mt[id], fl = UI.flash.indexOf(id) >= 0;
    h += '<g class="node' + (fl ? ' flash' : '') + '" data-id="' + id + '">';
    if (adj) h += '<circle cx="' + x + '" cy="' + y + '" r="24" fill="#fbbf2433" stroke="#fbbf24" stroke-width="2"/>';
    if (UI.sel === id) h += '<circle cx="' + x + '" cy="' + y + '" r="27" fill="none" stroke="#fff" stroke-width="2.5" stroke-dasharray="5 3"/>';
    h += '<circle cx="' + x + '" cy="' + y + '" r="18" fill="' + fill + '" stroke="' + (cl ? '#71717a' : ring) + '" stroke-width="3.5"/>';
    h += '<text x="' + x + '" y="' + (y + 6) + '" text-anchor="middle" font-size="17" font-weight="700" fill="#fff">' + (cl ? '🔒' : r) + '</text>';
    h += '<text x="' + x + '" y="' + (y + 37) + '" text-anchor="middle" font-size="18" font-weight="600" fill="#f5f5f4" stroke="#1c1917" stroke-width="3" paint-order="stroke">' + G.rname(id) + '</text>';
    if ((s.chaos[id] || 0) >= s.turn && s.visited.indexOf(id) >= 0) h += '<text x="' + (x + 13) + '" y="' + (y - 9) + '" font-size="11">🔥</text>';
    if (id === s.loc) h += '<text x="' + (x - 7) + '" y="' + (y - 14) + '" font-size="16">🗡️</text>';
    h += '<circle cx="' + x + '" cy="' + y + '" r="33" fill="transparent"/></g>';
  }
  return h + '</g></svg>';
}
function regionCard(id) {
  const s = S(), cl = G.closed(id), here = id === s.loc;
  let h = '<div class="card"><h3>' + G.rname(id) + ' <span class="badge b-n">' + G.kind(id) + '</span> <span class="badge b-' + (G.risk(id) <= s.realm ? 'g' : G.risk(id) === s.realm + 1 ? 'o' : 'r') + '">위험도 ' + G.risk(id) + '</span>' +
    '<span style="flex:1"></span><span class="muted">' + (G.has(id, '객') ? '🏮객잔 ' : '') + (G.has(id, '상') ? '💊약방 ' : '') + (D.MYEONGMUL[id] ? '🎁명물' : '') + '</span></h3>';
  if (cl) return h + '<div class="row">🔒 ' + D.CLOSED[id] + ' (25턴부터)</div></div>';
  const e = G.enemyOf(id), we = G.predict(e, 'enemy', id).w, sm = G.sweepMul(id), k = s.sweep[id] || 0;
  h += '<div class="row"><span class="f">⚔ ' + D.LOCAL[id][0] + ' <span class="muted">' + D.LOCAL[id][2] + '</span></span>' + bandBadge(we) + '</div>';
  h += '<div class="row"><span class="muted">소탕도</span><div class="bar"><i style="width:' + Math.max(0, 100 - k * 33) + '%;background:' + (k ? '#78716c' : '#22c55e') + '"></i></div>' + (k ? '<span class="muted">소탕도 ×' + (k <= 2 ? 0.5 : 0.25) + '</span>' : '') + '</div>';
  if (k >= 1) h += '<div class="muted">이 고을 졸개들은 몸을 사린다</div>';
  { const dd = s.realm - G.risk(id); if (dd >= 1) h += '<div class="muted">경지 차 감쇠: 출몰 적 보상 ×' + (dd === 1 ? 0.5 : 0.25) + '</div>'; }
  if (id === 'yunnan' && s.turn >= 2 && G.pres() < 300) h += '<div class="muted">은거 고수: 개인 위신 300 필요 (현재 ' + G.pres() + ')</div>';
  if (G.bossAlive(id)) { const wb = G.predict(G.bossOf(id), 'boss', id).w; h += '<div class="row"><span class="f">👹 ' + D.LOCAL[id][1] + ' (' + D.REALM[G.bossOf(id)[0]] + ')' + (s.resp[id] ? ' <span class="badge b-r">재등장</span>' : '') + ((s.bossLoss[id] || 0) ? ' <span class="muted">지난 싸움의 상처가 남았다</span>' : '') + '</span>' + bandBadge(wb) + '</div>'; }
  else h += '<div class="row muted">👹 ' + D.LOCAL[id][1] + ' — 처치함 (' + (6 - (s.turn - s.dead[id])) + '턴 뒤 재등장)</div>';
  if (here) { const mt = G.moveTargets(); h += '<div class="muted" style="margin-top:4px">갈 수 있는 곳 (눌러서 선택)</div><div class="nbs">' + Object.keys(mt).map(n => '<button data-nb="' + n + '"><span class="badge b-' + (G.risk(n) <= s.realm ? 'g' : G.risk(n) === s.realm + 1 ? 'o' : 'r') + '">' + G.risk(n) + '</span> ' + G.rname(n) + (s.visited.indexOf(n) < 0 ? ' ·새' : '') + '</button>').join('') + '</div>'; }
  return h + '</div>';
}
function mapTab() {
  const s = S(), sel = UI.sel || s.loc;
  let h = '<div class="mapwrap">' + mapSVG() + '<div class="zctl"><button id="zOut" aria-label="축소">－</button><span id="zLbl">' + String(+UI.zoom.k.toFixed(2)) + '×</span><button id="zIn" aria-label="확대">＋</button></div></div>';
  if (UI.sel && UI.sel !== s.loc) { const mt = G.moveTargets(), id = UI.sel;
    h += '<div class="selbar"><b>' + G.rname(id) + ' · 위험도 ' + G.risk(id) + (G.closed(id) ? ' 🔒' : '') + '</b><button class="sm ' + (mt[id] ? 'pri' : '') + '" id="goBtn" ' + (mt[id] && (s.acts > 0 || s.off.steps > 0) ? '' : 'disabled') + '>' + (mt[id] ? '이동 (' + mt[id] + '칸)' : '인접 아님') + '</button><button class="sm" id="selX">✕</button></div>'; }
  else h += '<div class="rumor">📜 ' + esc(s.rumor) + '</div>';
  const cardHTML = regionCard(sel);
  const glow = G.tatongGlow() && s.turn <= 24;
  const B = (id, label, why, cls) => '<button id="' + id + '" class="' + (cls || '') + '" ' + (why ? 'disabled' : '') + '>' + label + '<small>' + (why ? esc(why) : '&nbsp;') + '</small></button>';
  const tb = G.tatongBlock();
  h += '<div class="acts-grid">' + B('aTrain', '수련', G.canAct('train')) + B('aFight', '싸움', G.canAct('fight')) + B('aExplore', '탐색', G.canAct('explore')) +
    B('aMove', '이동', s.acts <= 0 && s.off.steps <= 0 ? '행동 없음' : null) +
    '<button id="aTat" class="' + (glow ? 'glow' : '') + '" ' + (tb ? 'disabled' : '') + '>' + (s.mer >= 12 && !s.imdok ? '생사현관' : '타통') + '<small>' + (tb ? esc(tb) : (glow ? '정경 ' + s.mer + '/' + G.gateMer() + ' · ' : '') + '은자 ' + G.tatongCost() + (s.warm ? ' (온양)' : '')) + '</small></button>' +
    B('aEnd', '턴 종료', null, s.acts === 0 ? 'pri' : '') + '</div>';
  const lk = G.breakLock();
  h += '<div class="extra">';
  if (G.canBreak()) h += '<button class="big pri glow" id="aBreak">⚡ ' + D.REALM[s.realm + 1] + ' 돌파!</button>';
  else if (lk) h += '<button class="big" id="aLock">🔒 돌파 잠김 · ' + esc(lk) + '</button>';
  if (s.route === 3) h += '<button class="big" id="myPath">🧭 나의 길</button>';
  if (s.injured && s.items['금창약']) h += '<button class="big" id="useGeum">금창약 사용</button>';
  h += '</div>' + cardHTML + '<div style="height:8px"></div>';
  return h;
}
// ---------- 인물 ----------
function charTab() {
  const s = S(), sub = UI.sub.char;
  let h = '<div class="tabs2">' + [['me', '주인공'], ['mg', '무공'], ['mer', '경맥'], ['wanted', '수배첩']].map(([k, t]) => '<button data-sub="' + k + '" class="' + (sub === k ? 'on' : '') + '">' + t + '</button>').join('') + '</div>';
  if (sub === 'me') {
    h += '<div class="card"><h3>' + esc(s.name) + ' <span class="badge b-y">' + D.REALM[s.realm] + '</span>' + (s.equipped ? ' <span class="badge b-n">' + esc(s.equipped) + '</span>' : '') + '</h3><div class="kv">' +
      '<span>수련치</span><b>' + Math.floor(s.xp) + (s.realm < 5 ? ' / ' + G.needXp() : '') + (s.off.reserve > 0 ? ' (잔여 기운 ' + Math.round(s.off.reserve) + ')' : '') + '</b>' +
      '<span>무력 / 내공 / 지략</span><b>' + s.mu + ' / ' + s.ne + ' / ' + s.ji + '</b>' +
      '<span>무공</span><b>' + (s.mg ? esc(D.MG[s.mgMain].name) + ' ' + s.mg[s.mgMain].s + '성' : '검법 ' + D.GNAME[s.grade] + (s.gsk ? ' · 초식 숙련 +' + s.gsk * 10 + '%' : '')) + '</b>' +
      '<span>정경</span><b>' + s.mer + ' / 12' + (s.imdok ? ' + 임독양맥' : '') + '</b>' +
      '<span>개인 명성 / 위신</span><b>' + s.fame + ' / ' + G.pres() + '</b>' +
      '<span>협행 / 악행</span><b>' + s.hyeop + ' / ' + s.ak + '</b>' +
      '<span>파훼</span><b>' + Math.round(G.parryRate() * 100) + '% (최근 ' + s.parryHist.length + '번)</b>' +
      '<span>상태</span><b>' + [s.injured ? '부상' : '', s.warm ? '온양' : '', s.freeTat ? '노개의 가르침' : '', s.firstAtk ? '첫 공격 +50%' : '', s.haomun ? '두목 체력 −20%' : '', s.off.steps ? '날랜 걸음 ' + s.off.steps : ''].filter(Boolean).join(', ') + '</b>' +
      '<span>토벌록</span><b>' + s.kills + '명</b>' +
      '<span>소지품</span><b>금창약 ' + s.items['금창약'] + ' · 소환단 ' + s.items['소환단'] + '</b></div>' +
      '<div class="row" style="margin-top:6px"><button class="sm" id="useSoh" ' + (s.items['소환단'] ? '' : 'disabled') + '>소환단 먹기</button><button class="sm" id="useGeum2" ' + (s.items['금창약'] && s.injured ? '' : 'disabled') + '>금창약 쓰기</button></div></div>';
    h += '<div class="card"><h3>별호</h3>' + (s.titles.length ? s.titles.map(t => '<div class="row"><span class="f">' + esc(t) + (s.equipped === t ? ' (장착)' : '') + '</span>' + (s.equipped !== t ? '<button class="sm" data-eq="' + esc(t) + '" ' + (s.fame >= 100 ? '' : 'disabled') + '>장착' + (s.fame >= 100 ? '' : '(명성 100)') + '</button>' : '') + '</div>').join('') : '<div class="muted">아직 없다. 첫 두목을 쓰러뜨려라.</div>') + '</div>';
  } else if (sub === 'mg') { h += mgTab();
  } else if (sub === 'mer') {
    h += '<div class="card"><h3>경맥 <span class="muted">' + (s.realm < 5 ? '다음 경지 ' + D.REALM[s.realm + 1] + ': 정경 ' + s.mer + '/' + G.gateMer() + (s.realm === 4 ? ' + 임독양맥' : '') : '') + '</span></h3><div class="mer">' +
      D.JUNG.map((n, i) => '<div class="' + (i < s.mer ? 'o' : i === s.mer ? 'n' : '') + '">' + (i + 1) + '. ' + n + (i === 3 ? ' ★운기' : i === 7 ? ' ★초식' : i === 11 ? ' ★체력' : '') + '</div>').join('') +
      '<div class="' + (s.imdok ? 'o' : s.mer >= 12 ? 'n' : '') + '">임맥 (생사현관)</div><div class="' + (s.imdok ? 'o' : s.mer >= 12 ? 'n' : '') + '">독맥 (생사현관)</div>' +
      D.GIGYEONG.map(n => '<div class="l">🔒 ' + n + '</div>').join('') + '</div>' +
      '<p class="muted">기경 6맥은 초절정에 이른 뒤에 열린다. 생사현관: 정경 12 + 절정 수련치 2,000, 은자 300, 16턴부터' + (s.turn < 16 ? ' — 아직 몸이 받아들이지 못한다' : '') + '</p>' +
      '<div class="kv"><span>단계 보너스</span><b>정경 4: 운기 35% · 8: 초식 쿨 6초 · 12: 체력 +10%</b><span>타통</span><b>' + (G.tatongBlock() || '가능 · 은자 ' + G.tatongCost()) + '</b><span>정경 추가원(1막)</span><b>' + s.extraJung + ' / 3</b></div></div>';
  } else {
    const ks = Object.keys(s.bossesKilled);
    h += '<div class="card"><h3>현상 수배첩 <span class="muted">' + ks.length + ' / 24</span></h3><div class="wanted">' +
      Object.keys(D.REGIONS).map(id => { const k = !!s.bossesKilled[id], seen = s.visited.indexOf(id) >= 0;
        const b = s.bounties.find(x => x.tgt === id) || s.bountyOffer.find(x => x.tgt === id);
        return '<div class="' + (k ? 'k' : '') + '">' + (k || seen ? D.LOCAL[id][1] : '???') + '<br><span class="muted">' + G.rname(id) + '</span>' + (s.resp[id] && G.bossAlive(id) ? '<br><span style="color:#f87171">재등장</span>' : '') + (s.route === 3 && b ? '<br><span style="color:#fbbf24">💰현상금 ' + 60 * G.risk(id) + '</span>' : '') + '</div>'; }).join('') + '</div>' +
      '<p class="muted">5명: 명성 20·은자 100 / 10명: 명성 40·은자 150 + 별호 흑도사냥꾼 / 15명: 명성 60·은자 200</p></div>';
  }
  return h;
}
// ---------- 거점 ----------
function baseTab() {
  const s = S(), sub = UI.sub.base, loc = s.loc;
  const tabs = [['inn', '객잔', G.has(loc, '객')], ['shop', '약방', G.has(loc, '상')], ['mm', '명물', !!D.MYEONGMUL[loc] || (s.merchant && s.merchant.kind === 'mm')]];
  let h = '<div class="tabs2">' + tabs.map(([k, t, ok]) => '<button data-sub="' + k + '" class="' + (sub === k ? 'on' : '') + '" ' + (ok ? '' : 'style="opacity:.5"') + '>' + t + '</button>').join('') + '</div>';
  if (s.quests.length || s.bounties.length || s.escort) {
    h += '<div class="card"><h3>진행 중</h3>' + s.quests.map(q => '<div class="row"><span class="f">' + q.kind + ' · ' + G.rname(q.tgt) + (q.kind === '토벌' ? ' (남은 ' + q.left + '명)' : '') + '</span><span class="muted">기한 ' + q.ttl + '턴</span></div>').join('') +
      s.bounties.map(b => '<div class="row"><span class="f">💰현상금 · ' + D.LOCAL[b.tgt][1] + ' (' + G.rname(b.tgt) + ')</span><span class="muted">기한 ' + b.ttl + '턴</span></div>').join('') +
      (s.escort ? '<div class="row"><span class="f">🛡️호위 · ' + G.rname(s.escort.tgt) + '까지</span></div>' : '') + '</div>';
  }
  if (sub === 'inn') {
    if (s.turn < 2) h += '<div class="card muted">객잔 의뢰판은 2턴에 열린다.</div>';
    else if (!G.has(loc, '객')) h += '<div class="card muted">이 지역엔 객잔이 없다.</div>';
    else { const b = G.getBoard(); h += '<div class="card"><h3>객잔 의뢰판 <span class="muted">동시 최대 2개 · 기한 3턴</span></h3>' + (b.list.length ? b.list.map((q, i) => {
        const v = q.fixed || Math.round(30 * G.risk(q.tgt) * q.mul * G.pmult()); const fm = q.fixedFame || q.fm * G.risk(q.tgt);
        return '<div class="row"><span class="f">' + (q.kind === '토벌' ? '⚔' : q.kind === '배달' ? '📦' : '👁') + ' ' + q.kind + ' · ' + G.rname(q.tgt) + (q.tgt === loc ? '' : '(인접)') + '<br><span class="muted">' + (q.kind === '토벌' ? '출몰 적 ' + q.left + '명 처치' : q.kind === '배달' ? '그 지역 방문' : '그 지역 탐색 1회') + ' · 은자 ' + v + ' · 명성 ' + fm + '</span></span><button class="sm pri" data-q="' + i + '">받기</button></div>'; }).join('') : '<div class="muted">남은 의뢰가 없다.</div>') + '</div>';
      if (s.route === 3) {
        h += '<div class="card"><h3>💰 현상금 <span class="muted">기한 4턴 · 동시 2건</span></h3>' + (s.bountyOffer.length ? s.bountyOffer.map((x, i) => '<div class="row"><span class="f">' + D.LOCAL[x.tgt][1] + ' (' + G.rname(x.tgt) + ')<br><span class="muted">은자 ' + 60 * G.risk(x.tgt) + ' · 명성 ' + 10 * G.risk(x.tgt) + '</span></span><button class="sm pri" data-b="' + i + '">수락</button></div>').join('') : '<div class="muted">걸린 현상금이 없다.</div>') + '</div>';
        h += '<div class="card"><h3>🛡️ 호위</h3>' + (s.escortOffer ? '<div class="row"><span class="f">상인과 ' + G.rname(s.escortOffer.tgt) + '까지<br><span class="muted">이동마다 30% 습격 · 보수 ' + Math.round(30 * G.risk(s.escortOffer.tgt) * (s.escortOffer.river ? 1.8 : 1.5) * G.pmult()) + '</span></span><button class="sm pri" id="escAcc">수락</button></div>' : '<div class="muted">호위 의뢰는 도시·강 객잔에서만 나온다.</div>') + '</div>';
      } }
  } else if (sub === 'shop') {
    if (s.turn < 2) h += '<div class="card muted">약방은 2턴에 열린다.</div>';
    else if (!G.has(loc, '상')) h += '<div class="card muted">이 지역엔 약방이 없다.</div>';
    else h += '<div class="card"><h3>약방</h3>' + D.SHOP.filter(x => !x.city || G.kind(loc) === '도시').map(x => { const p = G.price('shop', x.id, x.price);
      return '<div class="row"><span class="f">' + x.name + ' <b>' + p + '</b>' + (p < x.price ? ' <span class="badge b-y">약장수 할인</span>' : '') + '<br><span class="muted">' + x.desc + '</span></span><button class="sm pri" data-buy="shop:' + x.id + '">사기</button></div>'; }).join('') + '</div>';
  } else {
    if (s.turn < 5) h += '<div class="card muted">지역 명물은 5턴에 열린다.</div>';
    else { const ids = [loc].concat(s.merchant && s.merchant.kind === 'mm' && s.merchant.id !== loc ? [s.merchant.id] : []).filter(id => D.MYEONGMUL[id]);
      h += '<div class="card"><h3>그 고장의 영약·병기</h3>' + (ids.length ? ids.map(id => { const m = D.MYEONGMUL[id], p = G.price('mm', id, m.price);
        const lockQ = id === 'qinghai' && s.turn <= 24 && (!G.jungOk() || s.mer >= 12);
        return '<div class="row"><span class="f">' + G.rname(id) + ' ' + m.name + ' <b>' + p + '</b>' + (p < m.price ? ' <span class="badge b-y">약장수 할인</span>' : '') + '<br><span class="muted">' + (lockQ ? '진열만 됨 — 25턴부터' : m.desc) + (m.lim === 'once' ? ' · 1회' : ' · 턴당 1') + '</span></span><button class="sm pri" data-buy="mm:' + id + '">사기</button></div>'; }).join('') : '<div class="muted">이 고장엔 이름난 물건이 없다.</div>') + '</div>'; }
  }
  return h;
}
// ---------- 렌더 ----------
function render() {
  const s = S(); if (!s) return;
  $('#top').innerHTML = topHTML();
  $('#content').innerHTML = UI.tab === 'map' ? mapTab() : UI.tab === 'char' ? charTab() : baseTab();
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === UI.tab));
  bind(); bubble(); if (G.debug) debugPanel();
}
function on(id, fn) { const e = document.getElementById(id); if (e) e.onclick = fn; }
function bind() {
  const s = S();
  on('claim', () => { G.claim(); checkWanted(); refresh(); drain(); });
  on('where', whereTo);
  on('rest', restSheet); on('help', helpCards); on('set', settings);
  mapGestures(); on('zIn', () => zoomBy(0.25)); on('zOut', () => zoomBy(-0.25)); on('nextTog', () => { UI.nextOpen = !UI.nextOpen; refresh(); });
  on('goBtn', () => doMove(UI.sel)); on('selX', () => { UI.sel = null; refresh(); });
  document.querySelectorAll('[data-nb]').forEach(b => b.onclick = () => { UI.sel = b.dataset.nb; G.tutUse('T8'); refresh(); document.getElementById('content').scrollTop = 0; });
  on('aTrain', () => { G.train(); afterAct(); });
  on('aFight', () => { G.tutUse('T1'); fightSheet(); });
  on('aExplore', () => { G.explore(); afterAct(); });
  on('aMove', () => { G.toast('지도에서 빛나는 이웃 지역을 눌러 이동하세요'); flushToasts(); });
  on('aTat', tatongUI);
  on('aEnd', async () => { if (s.acts > 0 && !(await confirmP('행동이 ' + s.acts + '개 남았다. 턴을 끝낼까?'))) return; G.endTurn(); UI.sel = null; UI.flash = []; afterAct(); });
  on('aBreak', breakUI);
  on('aLock', () => { G.tutUse('T6'); if (s.tut.personal) s.tut.personal.seen.meridian = true; UI.tab = 'char'; UI.sub.char = 'mer'; refresh(); });
  on('myPath', () => routeCards(true));
  on('useGeum', () => { G.useItem('금창약'); refresh(); }); on('useGeum2', () => { G.useItem('금창약'); refresh(); }); on('useSoh', () => { G.useItem('소환단'); refresh(); });
  document.querySelectorAll('.tabs2 button').forEach(b => b.onclick = () => { UI.sub[UI.tab] = b.dataset.sub; if (UI.tab === 'base' && b.dataset.sub === 'inn') G.tutUse('T5'); if (UI.tab === 'char' && b.dataset.sub === 'mer') G.tutUse('T6'); if (UI.tab === 'char' && b.dataset.sub === 'wanted') G.tutUse('T9'); if (UI.tab === 'char') { s.tut.personal.seen[b.dataset.sub === 'mer' ? 'meridian' : b.dataset.sub === 'wanted' ? 'wanted' : 'x'] = true; G.save(); } refresh(); });
  document.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { const e = G.acceptQuest(+b.dataset.q); if (e) G.toast(e); refresh(); });
  document.querySelectorAll('[data-b]').forEach(b => b.onclick = () => { const e = G.acceptBounty(+b.dataset.b); if (e) G.toast(e); refresh(); });
  on('escAcc', () => { const e = G.acceptEscort(); if (e) G.toast(e); refresh(); });
  document.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => { const [k, id] = b.dataset.buy.split(':'); const e = G.buy(k, id); if (e) G.toast(e); afterAct(); });
  document.querySelectorAll('[data-eq]').forEach(b => b.onclick = () => { s.equipped = b.dataset.eq; G.save(); refresh(); });
}
function afterAct() { checkWanted(); refresh(); drain(); }
function checkWanted() { // 수배첩 단계 보상(자동)
  const s = S(), n = Object.keys(s.bossesKilled).length;
  [[5, 20, 100], [10, 40, 150], [15, 60, 200]].forEach(([k, f, sv]) => { if (n >= k && !s.wantedRw[k]) { s.wantedRw[k] = 1; s.fame += f; s.silver += sv; if (k === 10) G.addTitle('흑도사냥꾼'); G.push({ type: 'info', title: '수배첩 ' + k + '명', text: '명성 +' + f + ', 은자 +' + sv }); } });
  G.save();
}
document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => { UI.tab = b.dataset.tab; if (G.S) { if (UI.tab === 'base' && UI.sub.base === 'inn') G.tutUse('T5'); if (UI.tab === 'char' && UI.sub.char === 'mer') G.tutUse('T6'); if (UI.tab === 'char' && UI.sub.char === 'wanted') G.tutUse('T9'); } refresh(); });
// ---------- 이동 ----------
async function doMove(id) {
  const s = S(); if (!id) return; const r = G.risk(id);
  if (r > s.realm) { const w = G.predict(G.enemyOf(id), 'enemy', id).w;
    if (!(await confirmP('이 지역의 적은 당신보다 ' + (r - s.realm) + '경지 위입니다. 예상 승률: ' + DuelLib.band(w)[0] + '\n그래도 가겠습니까?', '간다', '그만둔다'))) return; }
  G.move(id); UI.sel = null; UI.flash = []; afterAct();
}
function whereTo() { const w = G.whereTo(); UI.flash = w.ids; UI.tab = 'map'; G.toast('➜ ' + (w.why || '') + (w.ids.length ? ': ' + w.ids.map(G.rname).join(', ') : '')); refresh(); setTimeout(() => { UI.flash = []; }, 4200); }
// ---------- 싸움 ----------
async function fightSheet() {
  const s = S(), ts = G.fightTargets();
  let pick = -1;
  await modal({ title: '싸움 · ' + G.rname(s.loc), html: ts.map((t, i) => { const pr = G.predict(t.e, t.kind, t.id); return '<div class="card"><div class="row"><span class="f">' + esc(t.label) + '<br><span class="muted">' + D.REALM[t.e[0]] + ' · 무 ' + t.e[1] + ' 내 ' + t.e[2] + ' · ' + D.GNAME[t.e[4]] + ' · 특기 ' + t.e[5] + '(' + D.TRAITS[t.e[5]] + ')' + (G.debug ? ' · 약 ' + pr.len.toFixed(0) + '초' : '') + '</span></span>' + bandBadge(pr.w) + '</div></div>'; }).join(''),
    buttons: ts.map((t, i) => ({ t: (t.kind === 'boss' ? '두목과 싸운다' : '출몰 적과 싸운다'), cls: 'pri', fn: () => pick = i })).concat(s.mg ? [{ t: '핫키 바꾸기', fn: () => pick = -2 }] : []).concat([{ t: '그만둔다' }]) });
  if (pick === -2) { await hotSheet(); return fightSheet(); }
  if (pick < 0) return; const t = ts[pick], w = G.predict(t.e, t.kind, t.id).w, b = DuelLib.band(w)[0];
  if (b === '위험') { const i = await modal({ title: '위험', text: '예상 승률: 위험. 정말 싸우겠습니까?', buttons: [{ t: '다음에', cls: 'pri' }, { t: '싸운다', cls: 'red' }] }); if (i !== 1) return; }
  if (b === '무모') { if (!(await confirmP('예상 승률: 무모. 정말 싸우겠습니까?', '싸운다', '다음에'))) return;
    if (!(await confirmP('정말 싸우겠습니까? 지면 이번 턴 싸울 수 없습니다.', '그래도 싸운다', '물러난다'))) return; }
  G.useAct(1);
  const tut = !s.tut.personal.skipped && t.kind === 'boss' && t.id === 'guizhou' && !s.bossesKilled.guizhou;
  const win = await duelUI(t.e, G.duelOpts(t.kind, t.id), { w, window: tut ? 2.0 : 1.2, tutorial: tut, boss: t.kind === 'boss' });
  G.fightResult(t, win, w); afterAct();
}
// 일기토 화면. resolve(win)
function duelUI(e, opts, cfg) {
  cfg = cfg || {}; const s = S();
  return new Promise(resolve => {
    const o = Object.assign(G.mgOpts ? G.mgOpts(cfg) : {}, opts, { window: cfg.window || 1.2 });
    const seed = G.duelSeed ? G.duelSeed() : 0, p = G.me();
    const d = new DuelLib.Duel(p, e.slice(0, 7), o, G.rand, seed);
    const used = new Set(), firstNew = []; let manN = 0;
    const end = (win) => { if (G.mgDuelEnd) G.mgDuelEnd(win, cfg.w, { used: [...used] }); G.inDuel = false; document.body.classList.remove('induel'); };
    if (d.auto !== null) { G.toast((d.auto ? '압도: ' : '역부족: ') + (e[7] || '상대') + ' (경지 차 2 이상, 자동 판정)'); s.lastDuel = { nm: e[7], win: d.auto, t: 1, gise: 0, ok: 0, log: ['경지 차 자동 판정'] }; end(d.auto); flushToasts(); return resolve(d.auto); }
    G.inDuel = true; document.body.classList.add('induel'); if (window.FX) FX.opt = Object.assign({}, FX.opt, s.opt || {});
    const ov = $('#overlay'); ov.classList.remove('hidden');
    const nm = e[7] || '상대', f20 = d.f20, hot = f20 ? d.hot : [];
    const es = d.eset ? ' · ' + d.eset.mg : '';
    const btns = f20 ? '<div class="hotrow" id="hotrow">' + hot.map((pi, k) => { const c = d.pool[pi], tier = D.QI_TIER(c.qi); return '<button class="hk" data-pi="' + pi + '" style="--tc:' + tier[1] + '" aria-label="' + esc(c.name) + ', 진기 ' + c.qi + '"><span class="cdr"></span><span class="ic">' + ({ 기수식: '◇', 초식: '◆', 절초: '✦', 단초: '❖' }[c.kind] || '◆') + '</span><span class="hn">' + esc(c.name.slice(0, 2)) + '</span><span class="qc">' + c.qi + '</span>' + (c.lock ? '<span class="lk">🔒</span>' : '') + '<span class="hs" aria-live="polite"></span></button>'; }).join('') + '</div><div class="lag"><i id="lagbar"></i></div>' : '<div class="hotrow empty"></div>';
    ov.innerHTML = '<div class="duel' + (f20 ? ' f20' : '') + '"><div class="fighter top"><div class="nm"><b>' + esc(nm) + '</b><span>' + D.REALM[e[0]] + (e[5] ? ' · 특기 ' + e[5] : '') + (e[6] === 'm' ? ' · 운기 1' : '') + (e[6] === 'b' ? ' · 두목' : '') + esc(es) + '</span></div><div class="hp"><i id="ehp"></i></div><div class="gise"><i id="gbar"></i></div><div class="muted sm1" id="gtxt">기세 게이지</div>' +
      '<div class="hp me"><i id="php"></i></div>' + (f20 ? '<div class="qi" id="qibar" title="진기"><i id="qif"></i><b id="qires"></b>' + qiTicks(d) + '</div>' : '') + '</div>' +
      '<div class="stage" id="arena"><canvas id="fx"></canvas><div class="who e">🗡️</div><div class="who p">👤</div></div><div class="dlog" id="dlog"></div>' +
      '<div class="fighter bot"><div class="nm"><b>' + esc(s.name) + '</b><span>' + D.REALM[s.realm] + ' · 초식 <span id="cd">준비</span> · 운기 <span id="heal">1/1</span>' + (f20 ? ' · 진기 <span id="qitxt"></span>' : '') + '</span></div>' + (cfg.w !== undefined ? '<div class="muted sm1">예상 승률 ' + DuelLib.band(cfg.w)[0] + ' · 내 파훼율 ' + Math.round(G.parryRate() * 100) + '%</div>' : '') + '</div>' +
      btns + '<button class="parry' + (f20 ? ' f20' : '') + '" id="parry" disabled>파훼</button><div class="muted sm1" style="text-align:center" id="dhint">' + (f20 ? '초식은 자동으로 나간다. 버튼으로 다음 수를 예약할 수 있다.' : '초식·운기조식은 자동. 적이 기를 모으면 [파훼]!') + '</div></div>';
    const P = $('#parry'), arena = $('#arena'); let timer = null, waitTimer = null, raf = 0, acc = 0, last = 0, stopUntil = 0, ended = false;
    if (window.FX) FX.attach(arena, $('#fx'));
    const tipKey = s.realm >= 6 ? 'qi_tip2' : 'qi_tip'; s.tips = s.tips || {};
    if (f20 && hot.length && !s.tips[tipKey]) { s.tips[tipKey] = 1; G.toast(s.realm >= 6 ? '내공이 깊어져 내력이 넘친다 — 결정타를 여러 번 쓸 수 있다. 절초가 준비되는 대로 꽂되, 숨 고를 틈을 생각하라.' : '내력을 모아 초식에 싣는다 — 가벼운 초식은 진기가 적게, 큰 초식은 많이 든다. 쓰고 나면 숨을 고르느라 한 박자 늦는다. 적이 기절했을 때나 끝낼 수 있을 때 써라.'); flushToasts(); }
    const t12 = f20 && s.realm >= 2 && s.tut && s.tut.personal && !s.tut.personal.skipped && !s.tut.personal.t12;
    if (t12) $('#dhint').textContent = '버튼을 누르면 다음 수를 고를 수 있다. 안 눌러도 몸이 알아서 움직인다.';
    const pop = (kind, txt, side) => { if (window.FX) { const ms = FX.play(kind, { text: txt, side }); const st = FX.hitstop(ms, s.speed || 1, UI.instant || UI.autoParry); if (st) stopUntil = Math.max(stopUntil, performance.now() + st); } };
    const flashMsg = (pi, msg) => { const b = ov.querySelector('.hk[data-pi="' + pi + '"] .hs'); if (!b) return; b.textContent = msg; setTimeout(() => { b.textContent = ''; }, 1000); };
    const btnState = () => {
      if (!f20) return; const prevQ = btnState.q == null ? d.qi : btnState.q; btnState.q = d.qi;
      ov.querySelectorAll('.hk').forEach(b => { const pi = +b.dataset.pi, c = d.pool[pi], cd = d.cdLeft(pi), wheel = d.deck.has(pi) && d.deck.size < d.n, low = d.qi < c.qi;
        const res = d.reserve === pi, can = d.canReserve(pi) && !c.lock, near = d.hist.length && d.ns - d.t <= 10 && !d.waiting;
        b.classList.toggle('ready', !!(near && can && !res));
        b.classList.toggle('res', res); b.classList.toggle('low', low && !res); b.classList.toggle('cd', (cd > 0 || wheel) && !res); b.classList.toggle('gs', d.waiting); b.classList.toggle('lockd', !!c.lock);
        b.querySelector('.cdr').style.background = cd > 0 ? 'conic-gradient(#0009 ' + Math.min(100, cd / d.cdOf(pi, false) * 100) + '%, transparent 0)' : 'none';
        const st = res ? '예약' : c.lock ? '초절정부터' : cd > 0 ? (cd / 10).toFixed(1) + '초' : wheel ? '바퀴' : low ? Math.ceil((c.qi - d.qi) / (D.DUEL.QI_REG)) + '초 · 파훼 +25' : '';
        let sub = b.querySelector('.st'); if (!sub) { sub = document.createElement('span'); sub.className = 'st'; b.appendChild(sub); } sub.textContent = st;
        b.setAttribute('aria-label', c.name + ', 진기 ' + c.qi + (res ? ', 예약됨' : can ? '' : ', 쓸 수 없음: ' + (c.lock ? '초절정부터' : low ? '진기 부족' : cd > 0 ? '쿨' : wheel ? '바퀴' : '대기')));
        if (prevQ < c.qi && d.qi >= c.qi && !(s.opt && s.opt.flash)) { b.classList.add('ping'); setTimeout(() => b.classList.remove('ping'), 250); } });
      const lag = $('#lagbar'); if (lag) { const left = Math.max(0, d.ns - d.t), tot = d.lastLag || d.pcd; lag.style.transform = 'scaleX(' + (d.hist.length ? Math.min(1, left / tot) : 0) + ')'; }
    };
    const draw = () => {
      $('#ehp').style.width = Math.max(0, d.he / d.ehp * 100) + '%'; $('#php').style.width = Math.max(0, d.hp / d.php * 100) + '%';
      const gp = d.waiting ? 100 : Math.max(0, 100 - (d.nextg - d.t) / 60 * 100); $('#gbar').style.width = gp + '%';
      $('#gtxt').textContent = d.waiting ? '⚠ 기세! 지금 파훼!' + (d.eset ? ' 「' + d.eset.kill[0] + '」' : '') : (d.stun > 0 ? '💫 기절 (받는 피해 ×1.5)' : '다음 기세 ' + ((d.nextg - d.t) / 10).toFixed(1) + '초');
      $('#cd').textContent = d.ns - d.t <= 0 ? '준비' : ((d.ns - d.t) / 10).toFixed(1) + '초' + (f20 && d.ns - d.t <= 10 && d.hist.length ? ' ▸' : '');
      $('#heal').textContent = (1 - d.nh) + '/1';
      if (f20) { $('#qif').style.width = (d.qi / d.qmax * 100) + '%'; $('#qitxt').textContent = Math.floor(d.qi) + '/' + d.qmax; const r = d.reserve != null ? d.pool[d.reserve] : null; const rb = $('#qires'); rb.style.left = r ? Math.max(0, (d.qi - r.qi) / d.qmax * 100) + '%' : '0'; rb.style.width = r ? (Math.min(d.qi, r.qi) / d.qmax * 100) + '%' : '0'; }
      $('#dlog').innerHTML = d.log.slice(-2).map(esc).join('<br>');
      for (const ev of d.ev || []) { const k = ev[0], v = ev[1];
        if (k === 'pskill') { const c = f20 ? d.pool.find(x => x.id === ev[2]) : null, nm2 = c ? c.name : '초식'; if (ev[4]) { manN++; pop('manual', '✋ ' + nm2 + ' ' + Math.round(v), 'e'); if (window.FX) FX.banner('✋ 결정타', 800, 'b1'); } else pop('pskill', nm2 + ' ' + Math.round(v), 'e');
          if (c) { if (!used.has(c.id) && s.fxSeen.indexOf(c.id) < 0) { s.fxSeen.push(c.id); firstNew.push(c.name); if (window.FX && !UI.instant) FX.banner('「' + c.name + '」', 1200, 'b2'); } used.add(c.id); } }
        if (k === 'phit' && f20) pop('phit', '' + Math.round(v), 'e');
        if (k === 'eskill') pop('eskill', (ev[2] ? ev[2] + ' ' : '적 초식 ') + '−' + Math.round(v), 'p');
        if (k === 'parryok') pop('parryok', '파훼 성공!' + (f20 ? ' 진기 +25' : ''), 'p'); if (k === 'parryfail') pop('parryfail', '강타 −' + Math.round(v), 'p');
        if (k === 'pheal') pop('pheal', '운기조식', 'p'); if (k === 'eheal') pop('eheal', '적 운기', 'e'); if (k === 'pdodge') pop('pdodge', '회피', 'p'); if (k === 'ctr') pop('ctr', '반격 ' + Math.round(v), 'e'); if (k === 'roll') pop('roll', '구르기!', 'p');
        if (k === 'resfail') { flashMsg(v, '진기 부족'); } }
      d.ev = []; btnState();
    };
    if (f20) ov.querySelectorAll('.hk').forEach(b => b.onclick = () => { const pi = +b.dataset.pi, c = d.pool[pi]; if (d.done) return;
      if (t12) s.tut.personal.t12 = 1;
      if (c.lock) { flashMsg(pi, '초절정부터'); return; }
      if (d.reserve === pi) { d.reserveSkill(pi); draw(); return; }
      if (!d.reserveSkill(pi)) { const m = d.qi < c.qi ? '진기 부족' : d.waiting ? '기세 중' : !d.hist.length ? '첫 박자' : '아직'; flashMsg(pi, m); const q = $('#qibar'); if (q && !(s.opt && s.opt.flash)) { q.classList.add('shk'); setTimeout(() => q.classList.remove('shk'), 300); } if (s.opt && s.opt.vib && navigator.vibrate) try { navigator.vibrate(20); } catch (x) {} return; }
      draw(); });
    const finish = () => { if (ended) return; ended = true; clearInterval(timer); clearTimeout(waitTimer); cancelAnimationFrame(raf); draw(); const r = d.done;
      UI.lastDuelLog = d.log.slice(); s.lastDuel = { nm, win: r.win, t: r.t, gise: d.gise, ok: d.okp, log: d.log.slice(-40) };
      end(r.win); if (window.FX) FX.clear();
      P.disabled = false; P.classList.remove('live'); P.textContent = r.win ? '승리! (' + r.t.toFixed(1) + '초 · 기세 ' + d.gise + '회 · 파훼 ' + d.okp + ')' : '패배… (' + r.t.toFixed(1) + '초)';
      if (f20) { const h = $('#dhint'); h.id = 'dres'; h.textContent = '이번 싸움 초식 ' + used.size + '종' + (firstNew.length ? ' · 처음 쓴 초식 ' + firstNew.join('·') : '') + ' · 결정타 ' + manN + '회'; }
      P.style.fontSize = '18px'; P.onclick = () => { ov.classList.add('hidden'); ov.innerHTML = ''; resolve(r.win); }; };
    const t3 = () => { if (cfg.boss) G.tutUse('T3'); };
    const onGise = () => {
      if (UI.instant || UI.autoParry) { const ok = G.rand() < Math.min(0.95, G.parryRate() + (d.fails2 >= 2 ? 0.15 : 0) + d.parryBonus()); d.parry(ok); t3(); return; }
      stopUntil = 0; // 정지 중 기세가 오면 정지를 끊고 연다
      cancelAnimationFrame(raf); raf = 0; P.disabled = false; P.classList.add('live'); const wms = d.window() * 1000;
      P.textContent = '파훼! (' + d.window().toFixed(1) + '초)';
      draw();
      P.onclick = () => { if (!d.waiting) return; clearTimeout(waitTimer); resolveP(true); };
      waitTimer = setTimeout(() => resolveP(false), wms);
      function resolveP(ok) { if (!d.waiting) return; s.parryHist.push(ok ? 1 : 0); if (s.parryHist.length > 20) s.parryHist.shift(); d.parry(ok); t3(); P.classList.remove('live'); P.disabled = true; P.textContent = ok ? '파훼 성공!' : '파훼 실패…'; P.onclick = null; draw(); if (d.done) return finish(); run(); }
    };
    const stepOnce = () => { d.stepA(); if (d.done) return 'done'; if (d.waiting) return 'gise'; return null; };
    // rAF 누산기: 100ms마다 1틱(2×면 50ms) · 정지 중 누산 멈춤 · 백그라운드 누산 상한 1초
    const run = () => {
      if (UI.instant) { let g = 0; while (!d.done && g++ < 5000) { const r = stepOnce(); if (r === 'gise') onGise(); } return finish(); }
      const per = (s.speed || 1) >= 2 ? 50 : 100; last = performance.now(); acc = 0;
      const loop = (now) => { raf = 0; const dt = Math.min(1000, now - last); last = now; if (window.FX) { FX.frame(dt / 1000); FX.guard(dt, lv => { s.opt.fx = lv; G.save(); G.toast('연출을 한 단계 낮췄다(' + lv + ')'); flushToasts(); }); }
        if (!UI.paused && now >= stopUntil) acc += dt;
        while (acc >= per) { acc -= per; const r = stepOnce(); if (r === 'done') return finish(); if (r === 'gise') { if (UI.autoParry) { onGise(); if (d.done) return finish(); continue; } draw(); return onGise(); } }
        draw(); raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
    };
    draw(); setTimeout(run, UI.instant ? 0 : 600);
  });
}
function qiTicks(d) { const mins = d.hot.map(i => d.pool[i].qi), out = []; const m = Math.min.apply(null, mins.length ? mins : [999]); for (let q = m; q < d.qmax && out.length < 9; q += m) out.push('<s style="left:' + (q / d.qmax * 100) + '%"></s>'); return out.join(''); }
function mgTab() {
  const s = S(); if (!s.mg) return '<div class="card">무공 없음</div>';
  const ids = Object.keys(s.mg).filter(id => D.MG[id]), tag = id => id === s.mgMain ? ' <b class="gold">주</b>' : id === s.mgSim ? ' <b class="gold">심법</b>' : id === s.mgSin ? ' <b class="gold">신법</b>' : '';
  let h = '<div class="card"><h3>익힌 무공 <span class="muted">핫키 ' + (s.hot || []).filter(x => x != null).length + '/' + G.hotN() + '</span></h3>' +
    ids.map(id => { const M = D.MG[id], m = s.mg[id], un = (M.moves || []).filter(v => v.seong <= m.s);
      return '<div class="mgrow"><div class="row"><span class="f"><b>' + esc(M.name) + '</b>' + tag(id) + ' <span class="muted">' + D.GNAME[M.grade] + ' ' + M.cat + ' · ' + m.s + '성/' + G.mgCap(id) + (G.mgSealed(id) ? ' · 봉인(일류부터)' : '') + '</span></span>' +
        (M.cat === '외공' && id !== s.mgMain && !G.mgSealed(id) ? '<button class="sm" onclick="G.mgSetMain(\'' + id + '\');UI.refresh()">주로</button>' : '') + '</div>' +
        (un.length ? '<div class="muted sm1">' + un.map(v => esc(v.name) + '(' + v.qi + ')').join(' · ') + '</div>' : '') + '</div>'; }).join('') +
    (s.mgDan.length ? '<div class="muted sm1">단초: ' + s.mgDan.map(k => esc(D.DANCHO[k].name)).join(' · ') + '</div>' : '') +
    '<div class="row" style="margin-top:6px"><button class="pri" id="hotBtn" onclick="UI.hotSheet().then(UI.refresh)">핫키 편성 ' + (s.hot || []).filter(x => x != null).length + '/' + G.hotN() + '</button></div></div>';
  if (s.tut && s.tut.personal && !s.tut.personal.t11 && ids.length > 2) s.tut.personal.t11 = 1;
  return h;
}
function hotSheet() {
  const s = S(); if (!s.mg) return Promise.resolve();
  const n = G.hotN(), cands = G.hotCands(), by = id => cands.find(c => c.id === id);
  let slots = (s.hot || []).slice(0, n).map(x => x && by(x) ? x : null); while (slots.length < n) slots.push(null);
  let sel = slots.indexOf(null), err = '';
  const qmax = D.DUEL.QI_MAX(D.QI_NY[s.realm]), mx = Math.max.apply(null, cands.map(G.hotScore));
  const body = () => { const fill = slots.filter(Boolean).map(by), mn = fill.length ? Math.min.apply(null, fill.map(c => c.qi)) : 0;
    return '<div class="hksheet"><div class="muted">내 진기 ' + qmax + ' · ' + D.REALM[s.realm] + '</div><div class="hkslots">' +
      slots.map((id, i) => { const c = id && by(id); if (!c) return '<div class="hkslot' + (i === sel ? ' sel' : '') + '" data-sl="' + i + '">빈 칸</div>'; const lk = G.hotLocked(c), t = D.QI_TIER(c.qi);
        return '<div class="hkslot f' + (i === sel ? ' sel' : '') + (lk ? ' lk' : '') + '" data-sl="' + i + '" style="--tc:' + t[1] + '">' + (lk ? '🔒 ' : '') + esc(c.name) + '<span class="qc">' + t[0] + ' ' + c.qi + '</span></div>'; }).join('') + '</div>' +
      (slots.some(id => id && G.hotLocked(by(id))) ? '<div class="muted sm1" style="color:#eab308">🔒 초절정부터 쓸 수 있다</div>' : '') +
      '<div class="muted sm1">이 편성: 싸움 시작 때 ' + (mn ? Math.floor(qmax / mn) : 0) + '번 · 파훼 성공마다 +25' + (err ? ' · <b style="color:#f87171">' + esc(err) + '</b>' : '') + '</div><div class="muted sm1">누르면 넣기 · 칸 길게 누르면 빼기 · 칸끼리 끌어 순서 바꾸기</div>' +
      '<div class="hklist">' + cands.map(c => { const t = D.QI_TIER(c.qi), on = slots.indexOf(c.id) >= 0;
        return '<div class="hkc' + (c.inPool ? '' : ' out') + (on ? ' on' : '') + '" data-id="' + c.id + '"><span class="tq" style="--tc:' + t[1] + '">' + c.qi + '</span><span class="f"><b>' + esc(c.name) + '</b> <span class="muted sm1">' + c.kind + (c.eff && c.eff.length ? ' · ' + c.eff.join('·') : '') + (G.hotLocked(c) ? ' · 🔒초절정부터' : '') + (c.inPool ? '' : ' · 자동 칸 밖') + '</span></span><span style="width:40px"><div class="w" style="width:' + Math.round(G.hotScore(c) / mx * 100) + '%"></div></span></div>'; }).join('') + '</div></div>'; };
  let res = 'x';
  const open = () => modal({ title: '핫키 편성', html: '<div id="hkbody">' + body() + '</div>', buttons: [{ t: '기본으로', fn: () => res = 'def' }, { t: '완료', cls: 'pri', fn: () => res = 'ok' }],
    after: m => { const bind = () => { const b = m.querySelector('#hkbody'); b.innerHTML = body();
      b.querySelectorAll('.hkc').forEach(el => el.onclick = () => { const id = el.dataset.id, at = slots.indexOf(id); err = '';
        if (at >= 0) { slots[at] = null; sel = at; } else { let i = sel >= 0 && sel < n ? sel : slots.indexOf(null); if (i < 0) i = n - 1; slots[i] = id; const nx = slots.indexOf(null); sel = nx; } bind(); });
      b.querySelectorAll('.hkslot').forEach(el => { const i = +el.dataset.sl; let lt = 0, down = false;
        el.onpointerdown = ev => { down = true; lt = setTimeout(() => { if (!down) return; down = false; slots[i] = null; sel = i; bind(); }, 500); };
        el.onpointerup = ev => { clearTimeout(lt); if (!down) return; down = false; const t = document.elementFromPoint(ev.clientX, ev.clientY), j = t && t.closest('.hkslot') ? +t.closest('.hkslot').dataset.sl : i;
          if (j !== i) { const x = slots[i]; slots[i] = slots[j]; slots[j] = x; sel = j; } else sel = i; bind(); };
        el.onpointercancel = () => { clearTimeout(lt); down = false; }; }); }; bind(); } });
  return open().then(() => { if (res === 'def') { G.hotDefault(); G.save(); return hotSheet(); } if (res === 'ok') { const e = G.setHot(slots); if (e) G.toast(e); flushToasts(); } });
}
UI.hotSheet = hotSheet; UI.refresh = () => refresh();
UI.duelUI = duelUI;
// ---------- 사건 UI ----------
async function kiyeonUI(ev) {
  const df = G.kiyeonDef(ev.name, ev.id); let b = false;
  await modal({ title: df.t, text: df.d, buttons: [{ t: 'A · ' + df.a, cls: 'pri', fn: () => b = false }, { t: 'B · ' + df.b, fn: () => b = true }] });
  const r = G.chooseKiyeon(ev.name, ev.id, b);
  if (r && r.duel) {
    const n = r.series || 1;
    let wins = 0;
    for (let i = 0; i < n; i++) { const w = G.predict(r.duel, 'x', ev.id).w;
      if (n > 1) await modal({ title: '비무 ' + (i + 1) + '/' + n, text: (r.duel[7] || '상대') + ' · 예상 ' + DuelLib.band(w)[0] });
      const win = await duelUI(r.duel, {}, { w });
      if (!win) { S().injured = true; G.toast('패배. 부상(이번 턴 싸움 불가)'); break; }
      wins++; G.give(r.reward); G.toast('승리' + G.giveText(r.reward)); }
    if (n > 1 && wins >= 2 && ev.id === 'anhui' && G.learnSkill) G.learnSkill('ng1', '비무');
    G.after();
  }
}
async function storyUI(ev) {
  const s = S(); const w = G.predict(ev.duel, ev.trial ? 'trial' : 'x', s.loc).w;
  let go = true;
  if (ev.reckless) { const i = await modal({ title: ev.title, text: ev.text, buttons: [{ t: '다음에 오겠다', cls: 'pri' }, { t: '그래도 겨룬다', cls: 'red' }] }); go = i === 1; }
  else await modal({ title: ev.title, text: ev.text, html: '<p>예상 승률 ' + bandBadge(w) + '</p>', buttons: [{ t: '싸운다', cls: 'pri' }] });
  if (!go) { s.explored[s.loc] = false; G.save(); return; }
  if (s.injured) { G.toast('부상 중이라 물러났다'); s.explored[s.loc] = false; return; }
  const win = await duelUI(ev.duel, {}, { w });
  if (win) { const c = ev.onWin || '';
    if (c === 'yeonhwa') { s.silver += 50; s.yeonhwaMet = true; await modal({ title: '인연 · 소연화', text: '약초꾼의 딸 소연화를 구했다. "이 은혜는 잊지 않을게요." 은자 +50, 부상 1회 무료 치료 쪽지' }); s.items['금창약']++; }
    else if (c.startsWith('fame:')) { const f = +c.slice(5); s.fame += f; G.toast('승리! 명성 +' + f); }
    if (ev.trial && G.mgTrialWin) G.mgTrialWin(s.loc);
  } else { s.injured = true; if (ev.trial || ev.onLose === 'relm') { if (ev.trial || ev.title.indexOf('소연화') >= 0) s.explored[s.loc] = false; } G.toast('패배. 부상(이번 턴 싸움 불가). 다음에 다시.'); }
  G.after();
}
async function tourneyUI(t) {
  const s = S(), opps = t === 6 ? D.T6 : D.T18; let res = 0;
  await modal({ title: (t === 6 ? '제1회' : '제2회') + ' 무림대회 (하남)', text: '어디에 있든 초청장이 날아왔다. 3경기(8강·4강·결승), 경기 사이 체력은 모두 회복된다.' });
  for (const o of opps) { const w = G.predict(o, 'x', s.loc).w;
    await modal({ title: o[7], text: D.REALM[o[0]] + ' · 무 ' + o[1] + ' 내 ' + o[2] + ' · ' + D.GNAME[o[4]], html: '<p>예상 승률 ' + bandBadge(w) + '</p>', buttons: [{ t: '비무대에 오른다', cls: 'pri' }] });
    if (await duelUI(o, {}, { w })) res++; else break; }
  const r = G.tourneyResult(t, res);
  await modal({ title: '무림대회 결과', text: ['8강 탈락', '4강 진출', '준우승', '우승!'][res] + '\n명성 +' + r.fame + (r.silver ? ', 은자 +' + r.silver : '') + (t === 6 && res < 3 ? '\n\n윤서각: "다음 대회에선 끝까지 가겠다."' : '') });
}
async function rivalUI() {
  const s = S(), e = D.RIVAL23, w = G.predict(e, 'x', s.loc).w;
  const i = await modal({ title: '윤서각의 도전', text: '"강호가 칼을 뽑기 전에, 너와 끝을 보고 싶다." — 화산 윤서각\n(응하든 거절하든 목표는 완료된다)', html: '<p>예상 승률 ' + bandBadge(w) + '</p>', buttons: [{ t: '응한다', cls: 'pri' }, { t: '거절한다' }] });
  if (i === 1) { G.rivalResult(false, false); await modal({ title: '윤서각', text: '"다음에 보자."' }); return; }
  const win = await duelUI(e, {}, { w }); G.rivalResult(true, win);
  await modal({ title: win ? '화산의 벽' : '패배', text: win ? "윤서각을 꺾었다. 별호 '화산의 벽', 명성 +30" : '"아직 멀었군." 윤서각이 검을 거둔다.' });
}
async function tatongHintUI() {
  const s = S(); if (!G.tatongGlow()) return;
  const later = s.hintIgnore >= 2;
  const i = await modal({ title: '취팔 노개', text: '"혈이 막힌 채로 칼만 휘두르면 제자리다. 이번 달은 앉아라."\n(정경 ' + s.mer + '/' + G.gateMer() + ')', buttons: [{ t: later ? '지금 앉는다(권장)' : '타통한다', cls: 'pri' }, { t: '나중에' }] });
  if (i === 0) { s.hintIgnore = 0; await tatongUI(); } else { s.hintIgnore++; G.save(); }
}
// ---------- 타통 ----------
async function tatongUI() {
  const s = S(), blk = G.tatongBlock(); if (blk) { G.toast(blk); flushToasts(); return; }
  const cost = G.tatongCost(); const saeng = s.mer >= 12;
  if (!(await confirmP((saeng ? '생사현관' : '타통') + ': 이번 달 행동 3개를 모두 쓴다. 은자 ' + cost + (s.warm ? ' (온양: 무료·자동 완벽)' : s.freeTat ? ' (노개의 가르침: 무료·자동 완벽)' : '') + '\n' + (saeng ? '임맥·독맥 개통' : '정경 2개 개통 + 수련치'), '앉는다', '그만둔다'))) return;
  const perfect = G.tatongAuto() ? true : await acupointGame();
  const r = G.doTatong(perfect); if (!r) return;
  await modal({ title: (r.saeng ? '생사현관' : '타통') + ' 완료', text: '개통: ' + r.opened.join(', ') + '\n수련치 +' + r.xp + (r.perfect ? ' (운기행공 완벽 +20%)' : '') + '\n\n한 달 사이 강호에서는…\n· ' + r.rumors.join('\n· ') });
  if (G.canBreak()) G.toast('돌파할 수 있다!');
  afterAct();
}
function acupointGame() { // 운기행공: 빛나는 혈도 3곳 순서대로 (15초)
  return new Promise(res => {
    const ov = $('#overlay'); ov.classList.remove('hidden');
    const pts = [[50, 14], [50, 30], [38, 36], [62, 36], [50, 44], [40, 55], [60, 55], [36, 72], [64, 72], [36, 90], [64, 90], [50, 22]];
    const order = []; while (order.length < 3) { const k = Math.floor(G.rand() * pts.length); if (order.indexOf(k) < 0) order.push(k); }
    ov.innerHTML = '<h2 style="text-align:center;margin:6px">운기행공</h2><p class="muted" style="text-align:center">빛나는 혈도를 순서대로 누르세요 (실패해도 효과는 그대로)</p><div class="body" id="body">' + pts.map((p, i) => '<button class="pt" data-i="' + i + '" style="left:' + p[0] + '%;top:' + p[1] + '%"></button>').join('') + '</div><p id="tt" style="text-align:center">15초</p>';
    let k = 0, ok = true, left = 15; const els = ov.querySelectorAll('.pt');
    const lit = () => els.forEach((e, i) => e.classList.toggle('on', i === order[k]));
    lit();
    const iv = setInterval(() => { left--; $('#tt').textContent = left + '초'; if (left <= 0) end(false); }, 1000);
    els.forEach(e => e.onclick = () => { const i = +e.dataset.i; if (i === order[k]) { e.classList.add('hit'); k++; if (k >= 3) end(ok); else lit(); } else { ok = false; } });
    function end(r) { clearInterval(iv); ov.classList.add('hidden'); ov.innerHTML = ''; res(!!r && k >= 3); }
  });
}
async function breakUI() {
  const s = S(); const to = D.REALM[s.realm + 1];
  await new Promise(res => { const ov = $('#overlay'); ov.classList.remove('hidden'); let n = 0;
    ov.innerHTML = '<h2 style="text-align:center">' + to + ' 돌파</h2><p class="muted" style="text-align:center">기를 모아라! 원을 5번 누르세요</p><div style="flex:1;display:flex;align-items:center;justify-content:center"><button id="orb" style="width:180px;height:180px;border-radius:50%;font-size:40px;background:radial-gradient(#fde68a,#b45309)">氣</button></div>';
    $('#orb').onclick = () => { n++; $('#orb').style.transform = 'scale(' + (1 + n * 0.08) + ')'; if (n >= 5) { ov.classList.add('hidden'); ov.innerHTML = ''; res(); } }; });
  const g0 = s.grade; G.doBreak();
  await modal({ title: to + ' 돌파!', text: '무력·내공 +3, 명성 +' + D.BFAME[s.realm] + (s.grade > g0 ? '\n무공 자동 상승: ' + D.GNAME[s.grade] : '') + (s.realm === 4 ? '\n경공: 이동 2칸' : '') + (s.realm === 5 ? '\n검강이 피어오른다.' : '') });
  afterAct();
}
// ---------- 폐관 ----------
function restSheet() {
  const s = S(); let type = s.off.type, tat = false;
  const canTat = !G.tatongBlock() && s.turn <= 24;
  modal({ title: '폐관에 들고 쉬기', html: '<p class="muted">앱이 꺼져 있던 실제 시간만큼 수련치가 쌓인다. 2시간까지 100%, 6시간까지 70%, 10시간까지 40%, 상한 10시간. 턴과 강호는 멈춘다.</p>' +
    '<div class="tabs2" id="ty">' + ['ne', 'mu', 'gy'].map(k => '<button data-k="' + k + '" class="' + (k === type ? 'on' : '') + '">' + G.OFF_NAME[k] + '<br><small>×' + G.OFF_RATE[k] + '</small></button>').join('') + '</div>' +
    (canTat ? '<label class="row" style="font-size:15px;padding:8px"><input type="checkbox" id="tatT" style="width:24px;height:24px"> 이번 달 타통도 걸어 둘까? (은자 ' + G.tatongCost() + ', 즉시 처리)</label>' : ''),
    buttons: [{ t: '쉬기', cls: 'pri', fn: () => goRest(type, tat) }, { t: '그만둔다' }],
    after: m => { m.querySelectorAll('#ty button').forEach(b => b.onclick = () => { type = b.dataset.k; m.querySelectorAll('#ty button').forEach(x => x.classList.toggle('on', x === b)); });
      const c = m.querySelector('#tatT'); if (c) c.onchange = () => tat = c.checked; } });
}
function goRest(type, tat) {
  G.startRest(type, tat); G.queue.length = 0;
  const ov = $('#overlay'); ov.classList.remove('hidden');
  ov.innerHTML = '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:14px"><div style="font-size:60px">🕯️</div><h2>폐관 중</h2><p>"몸은 쉬어도 기는 돈다."</p><p class="muted">' + G.OFF_NAME[type] + ' 폐관. 이제 앱을 닫아도 됩니다.<br>다시 열면 출관 화면이 나옵니다.</p><button class="big pri" id="outNow">출관 (지금 돌아오기)</button></div>';
  $('#outNow').onclick = async () => { ov.classList.add('hidden'); ov.innerHTML = ''; await outUI(G.processOffline()); refresh(); drain(); };
}
async function outUI(r) {
  const s = S();
  if (r.pendingTat) { const t = r.pendingTat; await modal({ title: '타통 결과', text: '개통: ' + t.opened.join(', ') + '\n수련치 +' + t.xp + '\n' + (G.canBreak() ? '돌파할 수 있다!' : '') + '\n\n한 달 사이 강호에서는…\n· ' + t.rumors.join('\n· ') }); }
  if (r.rollback) { await modal({ title: '출관', text: r.future ? '기가 흐트러졌다. (저장 시각이 지금보다 앞서 있어 이번 폐관은 0으로 처리했다)' : '기가 흐트러졌다. (시각이 되돌려져 이번 폐관은 0으로 처리했다)' }); G.queue.push(...[]); return; }
  if (r.h < 1 / 6) { G.toast('잠깐 숨을 골랐다' + (r.put > 0.5 ? ' (수련치 +' + Math.round(r.put) + ')' : '')); flushToasts(); return; }
  const hh = Math.floor(r.totH), mm = Math.floor((r.totH - hh) * 60);
  const seg = Math.min(10, r.totH);
  const w1 = Math.min(seg, 2) / 10 * 100, w2 = Math.max(0, Math.min(seg, 6) - 2) / 10 * 100, w3 = Math.max(0, Math.min(seg, 10) - 6) / 10 * 100;
  const html = '<div style="text-align:center;font-size:40px">🧘✨</div>' +
    '<div class="kv"><span>폐관</span><b>' + G.OFF_NAME[r.type] + ' · ' + hh + '시간 ' + mm + '분' + (r.capped ? ' (상한 10시간)' : '') + (r.prevH > 0 ? ' (같은 회차 이어짐)' : '') + '</b></div>' +
    '<div class="muted">효율 막대 (0~2h 100% · 2~6h 70% · 6~10h 40%)</div><div class="effbar" style="background:#44403c"><i style="width:' + w1 + '%;background:#22c55e"></i><i style="width:' + w2 + '%;background:#eab308"></i><i style="width:' + w3 + '%;background:#f97316"></i></div>' +
    '<div class="muted">폐관 그릇: 오늘 담을 수 있는 기운 ' + Math.round(r.bucketAfter / 6.4 * 100) + '% 남음 (이번에 ' + r.E.toFixed(2) + ' / 계산상 ' + r.E0.toFixed(2) + ')</div><div class="effbar" style="background:#44403c"><i style="width:' + (r.bucketAfter / 6.4 * 100) + '%;background:#60a5fa"></i></div>' +
    '<div class="kv"><span>수련치</span><b>+' + Math.round(r.put) + (r.reserveAdd > 0.5 ? ' (잔여 기운 +' + Math.round(r.reserveAdd) + ')' : '') + '</b>' +
    '<span>숙련</span><b>' + (r.suk.length ? r.suk.join(', ') : Math.round(r.sukProg * 100) + '%') + '</b>' +
    '<span>온양</span><b>' + (r.warm ? '온양 상태! 다음 타통 무료·자동 완벽' : r.warmWait ? '오늘은 이미 온양을 얻었다(20시간마다)' : '—') + '</b></div>' +
    '<p style="margin-top:10px">👉 이번 턴 할 일: <b>' + esc(G.nowTodo()) + '</b></p>';
  if (r.firstOut && !s.tut.personal.skipped) G.toast('튜토리얼 T10: ' + D.TUT[9].t);
  let again = false;
  await modal({ title: '출관', html, buttons: [{ t: '강호로', cls: 'pri' }, { t: '다시 폐관', fn: () => again = true }] });
  if (r.firstOut) G.t10Done(); // 2-24-2 T10 = 출관 화면 1번(닫을 때)
  if (again) { restSheet(); return; }
  s.todo = true; G.save(); // v0.5.2 ③ 재접속: '지금 할 일' 줄 + [어디로?] 자동 깜빡임
}
UI.outUI = outUI;
// ---------- 분기 ----------
async function branchUI() {
  const s = S(); s.ev.branched = 'choosing'; G.save();
  const st = G.settlement();
  await modal({ title: '1막 결산 — 개인 성장', text: '개인 위신 ' + G.pres() + ' × 0.3 = ' + st.p + '\n경지 ' + D.REALM[s.realm] + ' = ' + st.r + '\n별호 ' + s.titles.length + '개 = ' + st.ti + '\n무림대회 = ' + st.to + '\n수배첩 ' + Object.keys(s.bossesKilled).length + '명 = ' + st.wa + '\n윤서각 재대결 = ' + st.rv + '\n\n합계 ' + st.tot + ' → 「' + st.grade + '」' });
  await modal({ title: '정마대전 전조', text: '"정파와 마교가 칼을 뽑았다."\n30년 휴전이 끝났다. 천마신교가 정마대전을 선포했다.' });
  s.revealMap = true; G.save(); UI.tab = 'map'; refresh();
  const taken = s.aiLog.filter(x => x.taken);
  const empty = Object.keys(s.owners).filter(k => s.owners[k][0] === '무주지').length;
  await modal({ title: '천하 판도 공개', text: '2년 동안 강호는 이렇게 바뀌었다.\n' + (taken.length ? taken.slice(-8).map(x => '· ' + G.dateStr(x.turn) + ' ' + x.a + '이(가) ' + G.rname(x.b) + '을(를) 차지 (' + x.prev + ')').join('\n') : '· 큰 주인 바뀜은 없었다.') + '\n\n지도에 처음으로 세력 색이 칠해졌다. 무주지 ' + empty + '곳.', html: '<p class="muted">🟦정파 🟫사파 🟥마교 🟪세외 ⬜무주지</p>' });
  await routeCards(false);
}
async function routeCards(again) {
  const s = S(); let pick = -1;
  if (again) { s.myPathSeen = true; G.after(); }
  for (;;) {
  const card = (n, t, d, sub, ok) => '<div class="routec ' + (ok ? '' : 'off') + '"><h3>' + t + '</h3><div>' + d + '</div><div class="muted">' + sub + '</div></div>';
  await modal({ title: again ? '나의 길' : '진로 선택', html:
    card(1, '① 내 문파를 세운다', '"이름 없는 문파, 내가 장문인이다"', '2단계에서 열림 (선택 불가)', false) +
    card(2, '② 명문의 문을 두드린다', '"구파일방·오대세가·사파·마교·세외에 입문해 정상까지"', '준비 중', false) +
    card(3, '③ 낭인 계속', '홀로 강호를 걷는다 — 소속 없이 현상금 · 호위 · 비무로', s.route === 3 ? '지금 걷는 길' : '조건 없음 · 선택 가능', true),
    buttons: again ? [{ t: '닫기', cls: 'pri' }] : [{ t: '③ 낭인 계속', cls: 'pri', fn: () => pick = 3 }, { t: '① 2단계에서 열림', disabled: true }, { t: '② 준비 중', disabled: true }] });
  if (again) { refresh(); return; }
  if (await confirmP('문파의 무공 없이 걷는다. 상승 무공은 비급을 구해야만 익힐 수 있다.', '걷는다', '다시 고른다')) break;
  }
  G.chooseRoute(3); s.myPathSeen = false;
  const i = await modal({ title: '홀로 걷는 길', text: '취팔 노개: "소속 없이도 칼 한 자루면 먹고산다. 현상금, 호위, 비무."', buttons: [{ t: '배우며 시작', cls: 'pri' }, { t: '건너뛰기' }] });
  if (i === 1 && (await confirmP('낭인 튜토리얼을 건너뛸까요? 남은 단계 보상은 즉시 지급됩니다.'))) G.skipPathTut();
  G.claim(); refresh();
}
// ---------- 말풍선(튜토리얼) ----------
function compactTop() { const t = $('#top'); const c = vh() < 720; let ph = $('#topPh');
  if (!ph) { ph = document.createElement('div'); ph.id = 'topPh'; t.parentNode.insertBefore(ph, t); }
  t.classList.remove('open'); ph.style.height = '0px'; t.classList.toggle('compact', c);
  if (c && UI.goalOpen) { ph.style.height = t.offsetHeight + 'px'; t.classList.add('open'); }
  let bd = $('#goalBd'); const want = c && UI.goalOpen;
  if (want && !bd) { bd = document.createElement('div'); bd.id = 'goalBd'; $('#app').appendChild(bd);
    const swallow = e => { e.preventDefault(); e.stopPropagation(); if ((e.type === 'click' || e.type === 'touchend') && UI.goalOpen) { UI.goalOpen = false; compactTop(); placeBubble(); } };
    ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown', 'mouseup', 'click'].forEach(ev => bd.addEventListener(ev, swallow, { passive: false })); }
  if (!want && bd) bd.remove(); // 펼침은 지도 위에 겹쳐 띄우고 자리는 접힌 높이만큼만
  const g = t.querySelector('.goal .gt'); if (g && c) g.onclick = () => { UI.goalOpen = !UI.goalOpen; compactTop(); fitMap(); placeBubble(); }; }
function fitMap() { compactTop(); const svg = document.querySelector('svg.map'), grid = document.querySelector('.acts-grid'); if (!svg || !grid) return;
  const top = ($('#top').classList.contains('open') ? $('#topPh') : $('#top')).offsetHeight, tabs = $('#tabs').offsetHeight, sel = (document.querySelector('.selbar') || document.querySelector('.rumor') || { offsetHeight: 0 }).offsetHeight;
  const ex = document.querySelector('.extra'); const exH = ex && ex.children.length ? ex.offsetHeight + 6 : 0;
  const avail = vh() - top - tabs - sel - grid.offsetHeight - exH - 14; svg.style.height = Math.max(150, Math.min(540, avail)) + 'px';
  // 터치 원은 지도 배율과 상관없이 화면 기준 지름 46px 이상
  fitNodes();
  // 토스트는 상단 바 바로 아래(지도 위)에 띄워 행동 버튼을 가리지 않게
  { const nb = $('#narrow'); if (nb) nb.style.top = $('#top').offsetHeight + 'px'; }
  const tb = $('#toast'); if (tb) { tb.style.bottom = 'auto'; tb.style.top = ($('#top').getBoundingClientRect().bottom - $('#app').getBoundingClientRect().top) / (UI.appScale || 1) + 6 + 'px'; } }
// 2-24-3 화면 규격: 폭 < 360이면 #app을 폭÷360(최소 0.89)으로 축소, 가로면 덮개
const vh = () => window.innerHeight / (UI.appScale || 1);
function applyScreen() { const w = window.innerWidth, h = window.innerHeight, app = $('#app'); if (!app) return;
  const land = w > h; $('#rot').classList.toggle('hidden', !land); UI.paused = land;
  const s = w < 360 ? Math.max(320, w) / 360 : 1; UI.appScale = s;
  document.body.classList.toggle('narrow', s < 1);
  if (s < 1) { app.style.width = '360px'; app.style.maxWidth = '360px'; app.style.height = (h / s) + 'px'; app.style.transform = 'scale(' + s + ')'; app.style.transformOrigin = 'top left'; app.style.margin = '0'; }
  else { app.style.width = app.style.maxWidth = app.style.height = app.style.transform = app.style.margin = ''; }
  const nb = $('#narrow'); const ack = localStorage.getItem('murim_narrow_ack') === '1';
  nb.classList.toggle('hidden', !(s < 1 && (w < 320 || !ack))); $('#narrowX').classList.toggle('hidden', w < 320); }
UI.applyScreen = applyScreen;
document.addEventListener('DOMContentLoaded', () => { const x = $('#narrowX'); if (x) x.onclick = () => { localStorage.setItem('murim_narrow_ack', '1'); applyScreen(); fitMap(); }; applyScreen(); });
window.addEventListener('resize', () => { applyScreen(); fitMap(); placeBubble(); });
function bubble() { fitMap(); bubble0(); placeBubble(); }
function placeBubble() { const b = $('#bubble'); if (b.classList.contains('hidden')) return; const k = UI.appScale || 1; const R0 = e => { const r = e.getBoundingClientRect(); return { top: r.top / k, bottom: r.bottom / k }; }; const app = R0($('#app')), top = R0($('#top'));
  const tid = (b.querySelector('.who') || {}).textContent || ''; const grid = document.querySelector('.acts-grid');
  let y; if (/T8|R1/.test(tid) || !grid) y = top.bottom - app.top + 6; // 지도 노드가 대상이면 상단 바 바로 아래
  else { const g = R0(grid); y = g.top - app.top - b.offsetHeight - 6; if (y < top.bottom - app.top + 4) y = top.bottom - app.top + 4; }
  b.style.top = y + 'px'; }
function bubble0() {
  const s = S(), b = $('#bubble');
  if (UI.replay) { const st = UI.replay.list[UI.replay.i]; b.classList.remove('hidden');
    b.innerHTML = '<div class="who">취팔 노개 <span class="muted">(다시 보기 ' + (UI.replay.i + 1) + '/' + UI.replay.list.length + ')</span></div>' + esc(st.t) + '<div class="bb"><button id="rpN">다음</button><button id="rpX">닫기</button></div>';
    on('rpN', () => { UI.replay.i++; if (UI.replay.i >= UI.replay.list.length) UI.replay = null; render(); }); on('rpX', () => { UI.replay = null; render(); }); return; }
  if (UI.tab !== 'map') { b.classList.add('hidden'); return; }
  const P = s.tut.path;
  if (s.route === 3 && P && !P.skipped && P.step < 5) { const r = D.RTUT[P.step]; b.classList.remove('hidden');
    b.innerHTML = '<div class="who">취팔 노개 · ' + r.id + '</div>' + esc(r.t) + '<div class="bb">' + (P.step === 0 ? '<button id="r1n">다음</button>' : '') + '<button id="tSkip">건너뛰기</button><button id="tHide">접기</button></div>';
    on('r1n', () => { P.r1 = true; G.after(); refresh(); }); on('tSkip', async () => { if (await confirmP('낭인 튜토리얼을 건너뛸까요? 남은 보상은 즉시 지급됩니다.')) { G.skipPathTut(); refresh(); } }); on('tHide', () => b.classList.add('hidden')); return; }
  const t = s.route ? null : G.tutCurrent();
  if (!t || UI.hideBubble === t.id) { b.classList.add('hidden'); return; }
  b.classList.remove('hidden');
  b.innerHTML = '<div class="who">취팔 노개 · ' + t.id + '</div>' + esc(t.t) + '<div class="bb"><button id="tHide">접기</button><button id="tSkip">건너뛰기</button></div>';
  on('tHide', () => { UI.hideBubble = t.id; b.classList.add('hidden'); });
  on('tSkip', async () => { if (await confirmP('튜토리얼을 건너뛸까요? 남은 단계 보상은 즉시 지급됩니다.')) { G.skipTutorial(); refresh(); } });
}
// ---------- 도움말·설정 ----------
function helpCards() {
  const H = { map: ['지도', '빛나는 이웃 지역을 눌러 이동. 노드 숫자 = 위험도, 테두리 초록(내 경지 이하)·주황(+1)·빨강(+2↑).\n행동은 턴마다 3개(●●●). 타통은 3개 전부.\n돌파 = 수련치 + 경맥(정경) 둘 다 필요.'],
    char: ['인물', '주인공: 경지·무공·명성·별호·파훼율.\n경맥: 정경 12 + 임독양맥. 일류 2·절정 8·초절정 12+임독.\n수배첩: 두목을 모으면 5·10·15명 보상.'],
    base: ['거점', '객잔 의뢰판: 토벌·배달·정탐. 받는 건 무료, 조건을 채우면 즉시 보상.\n잠정 규칙: 처치 1명은 토벌 의뢰 1건에만 인정.\n약방: 금창약·소환단·비급. 명물: 그 고장의 영약·병기(5턴~).'] };
  const [t, x] = H[UI.tab]; modal({ title: '[?] ' + t, text: x + '\n\n폐관(🕯️): 앱을 닫아 둔 실제 시간만큼 수련(상한 10시간, 하루 그릇 6.4).' });
}
function settings() {
  const s = S();
  const op = s.opt || (s.opt = G.optDefault()); const tg = (k, on, t) => '<button class="sm ' + (on ? 'pri' : '') + '" data-op="' + k + '">' + t + '</button>';
  const optRows = '<div class="row">화면 흔들림 ' + tg('shake', op.shake, op.shake ? '켬' : '끔') + '</div><div class="row">연출 수준 ' + ['높음', '보통', '낮음'].map(v => '<button class="sm ' + (op.fx === v ? 'pri' : '') + '" data-fx="' + v + '">' + v + '</button>').join('') + '</div>' +
    '<div class="row">번쩍임 줄이기 ' + tg('flash', op.flash, op.flash ? '켬' : '끔') + '</div><div class="row">진동 ' + tg('vib', op.vib, op.vib ? '켬' : '끔') + '</div>';
  modal({ title: '설정', after0: 1, html: optRows + '<div class="row">화면 <button class="sm" id="narrowOn" onclick="localStorage.removeItem(\'murim_narrow_ack\');UI.applyScreen()">좁은 화면 경고 다시 켜기</button></div>' + '<div class="row">속도 <button class="sm ' + (s.speed === 1 ? 'pri' : '') + '" data-sp="1">1×</button><button class="sm ' + (s.speed === 2 ? 'pri' : '') + '" data-sp="2">2×</button></div>',
    buttons: [{ t: '튜토리얼 다시 보기 · 개인 성장', fn: () => { UI.replay = { list: D.TUT, i: 0 }; UI.tab = 'map'; render(); } },
      { t: '튜토리얼 다시 보기 · 내 진로', disabled: !s.route, fn: () => { UI.replay = { list: D.RTUT, i: 0 }; UI.tab = 'map'; render(); } },
      { t: '새 게임(저장 삭제)', cls: 'red', fn: async () => { if (await confirmP('정말 저장을 지우고 처음부터?')) { localStorage.removeItem(G.SAVE_KEY); location.reload(); } } },
      { t: '닫기' }],
    after: m => { m.querySelectorAll('[data-op]').forEach(b => b.onclick = () => { const k = b.dataset.op; op[k] = !op[k]; b.classList.toggle('pri', op[k]); b.textContent = op[k] ? '켬' : '끔'; G.save(); });
      m.querySelectorAll('[data-fx]').forEach(b => b.onclick = () => { op.fx = b.dataset.fx; m.querySelectorAll('[data-fx]').forEach(x => x.classList.toggle('pri', x === b)); G.save(); });
      m.querySelectorAll('[data-sp]').forEach(b => b.onclick = () => { s.speed = +b.dataset.sp; G.save(); m.querySelectorAll('[data-sp]').forEach(x => x.classList.toggle('pri', x === b)); }); } });
}
// ---------- 디버그 (?debug=1) ----------
let dbgOpen = false;
function debugPanel() {
  let btn = document.querySelector('.dbgbtn'); if (!btn) { btn = document.createElement('button'); btn.className = 'dbgbtn'; btn.textContent = '🐞'; btn.onclick = () => { dbgOpen = !dbgOpen; debugPanel(); }; $('#app').appendChild(btn); }
  const p = $('#dbg'); if (!dbgOpen) { p.classList.add('hidden'); return; } p.classList.remove('hidden');
  const s = S(), O = s.off;
  p.innerHTML = '<b>디버그</b> 턴 ' + s.turn + ' · 파훼 ' + Math.round(G.parryRate() * 100) + '%<br>' +
    '폐관 경과(분) <input id="dMin" type="number" value="600"><button id="dApply">적용</button><br>' +
    [5, 60, 120, 360, 600, 840].map(m => '<button data-pm="' + m + '">' + (m < 60 ? m + '분' : m / 60 + '시간') + '</button>').join('') + '<button data-pm="-60">−60분(되돌림)</button><button id="dFut">미래 저장 시각</button><button id="dFill">그릇 가득</button><br>' +
    '<pre>그릇 ' + O.bucket.toFixed(2) + '/6.4 · 회차 ' + O.sessH.toFixed(2) + 'h E ' + O.sessE.toFixed(2) + ' · acted ' + O.acted + '\n잔여 기운 ' + Math.round(O.reserve) + ' · 숙련 ' + JSON.stringify(O.suk) + ' · 온양 ' + s.warm + '\n' + (UI.lastOff || '') + '</pre>' +
    '<button id="dTurn">턴 넘기기</button><button id="dXp">수련치+500</button><button id="dSil">은자+500</button><button id="dMer">정경+2</button><button id="dRealm">경지+1(즉시)</button><button id="dHeal">부상 회복</button><button id="dT24">23턴 끝으로</button><br>' +
    '<label><input type="checkbox" id="dInst" ' + (UI.instant ? 'checked' : '') + '>즉시 전투</label> <label><input type="checkbox" id="dAuto" ' + (UI.autoParry ? 'checked' : '') + '>자동 파훼(확률)</label><br>' +
    '순간이동 <select id="dTp">' + Object.keys(D.REGIONS).map(k => '<option value="' + k + '"' + (k === s.loc ? ' selected' : '') + '>' + G.rname(k) + '</option>').join('') + '</select><button id="dTpGo">이동</button>' +
    '<pre>일기토 로그: ' + (s.lastDuel ? s.lastDuel.nm + ' ' + (s.lastDuel.win ? '승' : '패') + ' ' + s.lastDuel.t + '초 기세 ' + s.lastDuel.gise + ' 파훼 ' + s.lastDuel.ok + '\n' + s.lastDuel.log.slice(-14).join('\n') : '-') + '</pre>';
  const offApply = async (min) => { s.timeShift += min * 60000; G.save(); const r = G.processOffline(); UI.lastOff = '마지막: ' + min + '분 → ' + (r.rollback ? '되돌림 0' : 'h ' + (r.h || 0).toFixed(2) + ' E0 ' + (r.E0 || 0).toFixed(2) + ' E ' + (r.E || 0).toFixed(2) + ' 수련치 +' + Math.round(r.put || 0) + ' 잔여 +' + Math.round(r.reserveAdd || 0) + (r.warm ? ' 온양' : '')); await outUI(r); refresh(); drain(); };
  on('dApply', () => offApply(+$('#dMin').value || 0));
  p.querySelectorAll('[data-pm]').forEach(b => b.onclick = () => offApply(+b.dataset.pm));
  on('dFut', async () => { s.off.lastSeen = G.clock() + 86400000; s.off.maxSeen = s.off.lastSeen; G.save(); const r = G.processOffline(); UI.lastOff = '미래 저장 시각 → ' + (r.rollback ? '0 처리' : '?'); await outUI(r); refresh(); });
  on('dFill', () => { s.off.bucket = 6.4; G.save(); refresh(); });
  on('dTurn', () => { G.endTurn(); afterAct(); });
  on('dXp', () => { s.xp += 500; G.save(); refresh(); }); on('dSil', () => { s.silver += 500; G.save(); refresh(); });
  on('dMer', () => { const n = Math.min(2, 12 - s.mer); s.mer += n; s.mu += n; s.ne += 2 * n; G.save(); refresh(); });
  on('dRealm', () => { if (s.realm < 5) { s.realm++; s.mu += 3; s.ne += 3; if (s.realm === 5) s.imdok = true; s.mer = Math.max(s.mer, D.MERID[s.realm]); G.save(); refresh(); } });
  on('dHeal', () => { s.injured = false; G.save(); refresh(); });
  on('dT24', () => { s.turn = 23; s.acts = 0; G.save(); refresh(); });
  on('dInst', () => { UI.instant = $('#dInst').checked; }); on('dAuto', () => { UI.autoParry = $('#dAuto').checked; });
  on('dTpGo', () => { s.loc = $('#dTp').value; if (s.visited.indexOf(s.loc) < 0) s.visited.push(s.loc); G.save(); refresh(); });
}
// ---------- 생명주기 ----------
setInterval(() => { if (G.S && document.visibilityState === 'visible' && $('#main') && !$('#main').classList.contains('hidden')) G.heartbeat(); }, 5000);
let hiddenAt = 0;
document.addEventListener('visibilitychange', async () => {
  if (!G.S) return;
  if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); G.heartbeat(); }
  else if (hiddenAt && Date.now() - hiddenAt >= 600000 && !G.S.off.resting) { hiddenAt = 0; await outUI(G.processOffline()); refresh(); drain(); }
});
window.addEventListener('pagehide', () => { if (G.S) G.heartbeat(); });
window.addEventListener('error', e => { console.error('murim error', e.message); });
startScreen();
})();



// ---------- 지도 확대 (2-24-3): 핀치 0.75~2×, 드래그 이동, 빈 곳 더블탭 리셋, ＋－, 탭 판정 ----------
const Z_MIN = 0.75, Z_MAX = 2;
function zClamp() { const z = UI.zoom; z.k = Math.min(Z_MAX, Math.max(Z_MIN, Math.round(z.k * 1000) / 1000));
  const m = 60; // 지도 그림이 최소 60단위는 화면 안에 남게
  z.tx = Math.min(390 - m, Math.max(m - 390 * z.k, z.tx)); z.ty = Math.min(560 - m, Math.max(m - 560 * z.k, z.ty)); }
function zApply() { zClamp(); const g = document.getElementById('mz'); if (!g) return; const z = UI.zoom;
  g.setAttribute('transform', 'translate(' + z.tx.toFixed(1) + ' ' + z.ty.toFixed(1) + ') scale(' + z.k + ')');
  const l = document.getElementById('zLbl'); if (l) l.textContent = String(+z.k.toFixed(2)) + '×'; fitNodes(); }
function zoomAt(k, cx, cy) { const z = UI.zoom; const k0 = z.k; const k1 = Math.min(Z_MAX, Math.max(Z_MIN, k)); const c = [(cx - z.tx) / k0, (cy - z.ty) / k0]; z.k = k1; z.tx = cx - c[0] * k1; z.ty = cy - c[1] * k1; zApply(); }
function zoomBy(d) { zoomAt(Math.round((UI.zoom.k + d) * 4) / 4, 195, 280); }
UI.zoomBy = zoomBy;
function zReset() { UI.zoom = { k: 1, tx: 0, ty: 0 }; zApply(); }
function toVB(svg, x, y) { const p = svg.createSVGPoint(); p.x = x; p.y = y; const r = p.matrixTransform(svg.getScreenCTM().inverse()); return [r.x, r.y]; }
function mapGestures() {
  const svg = document.querySelector('svg.map'); if (!svg) return; const P = new Map(); let g = null; UI.lastPinchEnd = UI.lastPinchEnd || 0;
  const pick = (x, y) => { const el = document.elementFromPoint(x, y); const n = el && el.closest && el.closest('.node'); return n ? n.dataset.id : null; };
  svg.addEventListener('pointerdown', e => { svg.setPointerCapture && svg.setPointerCapture(e.pointerId); P.set(e.pointerId, [e.clientX, e.clientY]);
    if (P.size === 1) g = { t0: performance.now(), x0: e.clientX, y0: e.clientY, moved: 0, pinch: false, drag: false, last: [e.clientX, e.clientY] };
    if (P.size === 2 && g) { g.pinch = true; const [a, b] = [...P.values()]; g.d0 = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1; g.k0 = UI.zoom.k; g.tx0 = UI.zoom.tx; g.ty0 = UI.zoom.ty; g.m0 = toVB(svg, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); } });
  svg.addEventListener('pointermove', e => { if (!P.has(e.pointerId) || !g) return; P.set(e.pointerId, [e.clientX, e.clientY]);
    if (g.pinch && P.size >= 2) { const [a, b] = [...P.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); const m = toVB(svg, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      const k = Math.min(Z_MAX, Math.max(Z_MIN, g.k0 * d / g.d0)); const c = [(g.m0[0] - g.tx0) / g.k0, (g.m0[1] - g.ty0) / g.k0]; UI.zoom.k = k; UI.zoom.tx = m[0] - c[0] * k; UI.zoom.ty = m[1] - c[1] * k; zApply(); return; }
    if (P.size === 1 && !g.pinch) { g.moved = Math.max(g.moved, Math.hypot(e.clientX - g.x0, e.clientY - g.y0)); if (g.moved >= 10) g.drag = true;
      if (g.drag) { const a = toVB(svg, g.last[0], g.last[1]), b = toVB(svg, e.clientX, e.clientY); UI.zoom.tx += b[0] - a[0]; UI.zoom.ty += b[1] - a[1]; zApply(); } g.last = [e.clientX, e.clientY]; } });
  const up = e => { if (!P.has(e.pointerId)) return; P.delete(e.pointerId); if (!g) return; const now = performance.now();
    if (g.pinch) { if (P.size === 0) { UI.lastPinchEnd = now; g = null; } return; }
    if (P.size > 0) return; const gg = g; g = null; if (e.type === 'pointercancel') return;
    const isTap = !gg.drag && gg.moved < 10 && now - gg.t0 < 300 && now - UI.lastPinchEnd > 300; if (!isTap) return;
    const id = pick(e.clientX, e.clientY); UI.tapLog.push(id || '-');
    if (id) { UI.lastEmptyTap = 0; UI.sel = id === G.S.loc ? null : id; if (UI.sel) G.tutUse('T8'); UI.refresh(); return; } // 노드 위 더블탭은 선택만
    if (UI.lastEmptyTap && now - UI.lastEmptyTap < 300) { UI.lastEmptyTap = 0; zReset(); } else UI.lastEmptyTap = now; };
  svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
}
function fitNodes() { const svg = document.querySelector('svg.map'); if (!svg) return; const z = UI.zoom ? UI.zoom.k : 1;
  const sc = (Math.min(svg.clientWidth / 390, svg.clientHeight / 560) || 1) * z * (UI.appScale || 1); const r = Math.max(33 / z, 23 / sc);

  svg.querySelectorAll('.node circle[fill="transparent"]').forEach(c => c.setAttribute('r', r.toFixed(1)));
  // 지명은 화면 기준 13px 이상(외곽선 유지), 위험도 숫자는 12px 이상
  const fs = Math.max(18 / Math.max(1, z), 13 / sc), rs = Math.max(17 / Math.max(1, z), 12 / sc);
  svg.querySelectorAll('.node text').forEach(t => { if (/[가-힣]/.test(t.textContent)) { t.setAttribute('font-size', fs.toFixed(1)); t.setAttribute('y', (+t.closest('.node').querySelector('circle').getAttribute('cy') + 18 + fs).toFixed(1)); } else t.setAttribute('font-size', rs.toFixed(1)); });
  }
