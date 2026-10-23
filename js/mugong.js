// v0.7.8 [1a] 무공 · 초식 칸 · 핫키 · 저장 v6 (패치노트 v0.7.8 통합 §2-1 · §2-4 · §2-6 · §5, 기획서 13장 · 16-10)
// game.js 함수를 감싸서 붙인다(DOM 없음). 데이터는 mugong_data.js(D.MG · D.DANCHO · D.ESET …), 전투는 duel.js F20 경로.
'use strict';
(function (root) {
const D = root.D, G = root.G || require('./game.js');
const S_ = () => G.S;
const NEED_SUM = r => { let n = 0; for (let i = 1; i < r; i++) n += D.NEED[i] || 0; return n; };
const KKAE0 = { 1: 0, 2: 0, 3: 3, 4: 6, 5: 12, 6: 50, 7: 135 };
G.mgP = (g, s) => D.MGBASE[g] * (1 + 0.1 * (s - 1));
G.mgCap = function (id) { const S = S_(), m = S.mg[id]; return Math.min(10, (D.MCAP[S.realm] || 10) + (m && m.capx || 0)); };
G.mgSealed = function (id) { return id === 'cmy' && G.S.realm < 3; }; // 추수검법: 일류 전엔 봉인
G.mgNeed = (id, s) => (D.NEED_S[s] || 999) * D.GMUL[D.MG[id].grade];
// 성 경험 주기. 상한에 막히면 다음 1성치까지만 보관(무리총요 규칙과 같은 뜻으로 전 무공에 적용)
G.mgGain = function (id, x) {
  const S = S_(), m = S.mg[id]; if (!m || !(x > 0)) return 0; const s0 = m.s; m.x += x;
  while (m.s < 10 && m.x >= G.mgNeed(id, m.s)) { if (m.s >= G.mgCap(id)) { m.x = Math.min(m.x, G.mgNeed(id, m.s)); break; } m.x -= G.mgNeed(id, m.s); m.s++; G.mgMilestone(id, m.s); }
  if (m.s > s0) { const mg = D.MG[id]; G.toast(mg.name + ' ' + m.s + '성'); const un = (mg.moves || []).filter(v => v.seong > s0 && v.seong <= m.s); for (const v of un) G.toast('새 초식 「' + v.name + '」'); if (un.length) G.hotFillNew(); }
  return m.s - s0;
};
G.mgMilestone = function (id, s) { const mil = D.MG[id].mil; if (!mil || !mil[s]) return; const [k, v] = mil[s], S = S_(); S[k] += v; G.capStats(); G.toast(D.MG[id].name + ' ' + s + '성: ' + (k === 'ne' ? '내공' : '무력') + ' +' + v); };
G.mgOf = cat => Object.keys(G.S.mg).filter(id => D.MG[id] && D.MG[id].cat === cat);
G.mgBestSim = () => G.mgOf('심법').reduce((a, id) => Math.max(a, G.S.mg[id].s), 0);
// 모든 습득은 여기 하나로 (§2-4)
G.learnSkill = function (id, src) {
  const S = S_(); if (!S.mg) return false;
  const isD = !!D.DANCHO[id], mg = D.MG[id]; if (!isD && !mg) return false;
  if (isD) { if (S.mgDan.indexOf(id) >= 0) return false; S.mgDan.push(id); G.push({ type: 'info', title: '단초 · ' + D.DANCHO[id].name, text: D.DANCHO[id].mg + ' — 「' + D.DANCHO[id].name + '」 한 수를 몸에 익혔다. ' + D.DANCHO[id].desc + '. (주 외공의 위력을 따른다)' }); G.hotFillNew(); return true; }
  if (S.mg[id]) return false;
  if (S.route === 3 && mg.grade >= 2 && src !== '비급') { G.toast('스승의 상승 무공은 낭인에게 전하지 않는다'); return false; }
  if (mg.cat === '심법' && G.mgOf('심법').length >= 3) S.mgKkCap = true; // 성 깨달음은 심법 3개까지만 센다(2단계 kk_add에서 사용)
  S.mg[id] = { s: 1, x: 0 }; if (mg.grade >= 2) { S.cnt.hiBought = S.cnt.hiBought || []; S.cnt.hiBought.push(id); }
  let tx = mg.desc + (G.mgSealed(id) ? '\n(일류가 되기 전엔 봉인 — 일류부터 펼칠 수 있다)' : '');
  if (mg.cat === '신법' && !S.mgSin) S.mgSin = id;
  if (mg.cat === '심법' && (!S.mgSim || mg.grade > D.MG[S.mgSim].grade)) S.mgSim = id;
  G.push({ type: 'info', title: '무공 습득 · ' + mg.name + (mg.hanja ? ' (' + mg.hanja + ')' : ''), text: D.GNAME[mg.grade] + ' ' + mg.cat + (mg.wpn ? '·' + mg.wpn : '') + ' · 성향 ' + mg.tend + '\n' + tx });
  if (mg.cat === '외공' && mg.wpn !== '호신' && mg.grade > D.MG[S.mgMain].grade) G.push({ type: 'choice', title: '주 외공을 바꿀까?', text: mg.name + '(' + D.GNAME[mg.grade] + ')을 주 외공으로 삼으면 초식 칸이 바뀐다. 바꾼 뒤 3싸움 동안은 손에 익을 때까지 +2성으로 친다.', opts: ['바꾼다', '그대로 둔다'], cb: 'mgSwapPick', arg: id });
  G.hotFillNew(); return true;
};
G.mgSwapPick = function (i, id) { if (i !== 0) return; G.mgSetMain(id); };
G.mgSetMain = function (id) { const S = S_(); if (!S.mg[id] || D.MG[id].cat !== '외공' || S.mgMain === id) return false; S.mgMain = id; S.mgAdapt = D.ADAPT_N; G.toast('주 외공: ' + D.MG[id].name); G.hotFillNew(); G.save(); return true; };
G.mgBigeup = function () { G.push({ type: 'choice', title: '비급 필사본', text: '중승 외공 1권을 골라 1성으로 익힌다.', opts: ['단월검법(검·쾌)', '열산도법(도·중)', '벽파장(장·유)'], cb: 'mgBigeupPick' }); };
G.mgBigeupPick = function (i) { G.learnSkill(['swg', 'bsd', 'crj'][i] || 'swg', '비급'); G.after(); };
G.mgMrcy = function () { const S = S_(), id = S.mgMain, m = S.mg[id]; m.capx = 1; let need = 0; for (let k = 0; k < 2 && m.s + k < 10; k++) need += G.mgNeed(id, m.s + k); need -= m.x; G.mgGain(id, Math.max(0, need)); G.toast('무리총요: ' + D.MG[id].name + ' 성 상한 +1'); };
// ---------- 초식 칸 (13-3) ----------
G.mgPool = function () {
  const S = S_(); if (!S || !S.mg) return [];
  const mid = S.mgMain, M = D.MG[mid], ms = S.mg[mid].s, ps = Math.min(10, ms + (S.mgAdapt > 0 ? D.ADAPT_S : 0)), pw = G.mgP(M.grade, ps);
  const slots = D.MSLOTS[S.realm] || 4, ent = (v, P, kind, src) => ({ id: v.id, name: v.name, pw: Math.round(P * v.coef * 100) / 100, coef: v.coef, hits: v.hits, eff: v.eff, kind, qi: v.qi, sn: v.seong, mg: src, tend: src && D.MG[src] ? D.MG[src].tend : null });
  const un = M.moves.filter(v => v.seong <= ms), g = un.find(v => v.kind === '기수식') || M.moves[0];
  const pool = [ent(g, pw, '기수식', mid)];
  const rest = un.filter(v => v !== g);
  const pick = rest.slice().sort((a, b) => (b.kind === '절초') - (a.kind === '절초') || b.seong - a.seong).slice(0, Math.max(0, Math.min(2, slots - 1))).sort((a, b) => a.seong - b.seong);
  for (const v of pick) pool.push(ent(v, pw, v.kind, mid));
  const sc = e => e.pw + 0.4 * e.eff.length; // 13-3 점수: 위력×계수 + 0.4×효과 수
  const others = []; for (const id of Object.keys(S.mg)) { const m = D.MG[id]; if (id === mid || m.cat !== '외공' || G.mgSealed(id)) continue; for (const v of m.moves) if (v.seong <= S.mg[id].s) others.push(ent(v, G.mgP(m.grade, S.mg[id].s), v.kind, id)); }
  const dan = S.mgDan.map(k => { const d = D.DANCHO[k]; return { id: k, name: d.name, pw: Math.round(pw * d.coef * 100) / 100, coef: d.coef, hits: d.hits, eff: d.eff, kind: '단초', qi: d.qi, mg: null, tend: null }; });
  if (slots >= 4) { const c = others.concat(dan).sort((a, b) => sc(b) - sc(a))[0]; if (c) pool.push(c); }
  const used = new Set(pool.map(e => e.id));
  const res = rest.filter(v => !used.has(v.id)).map(v => ent(v, pw, v.kind, mid)).concat(dan.filter(e => !used.has(e.id))).sort((a, b) => sc(b) - sc(a));
  for (const e of res) { if (pool.length >= D.DUEL.POOL_MAX) break; pool.push(e); }
  return pool;
};
// 핫키 후보 = 칸 1~4 + 주 외공 해금 초식 + 단초(중복 없음). inPool=false → '자동 칸 밖'
G.hotCands = function () {
  const S = S_(), pool = G.mgPool(), ids = new Set(pool.map(e => e.id)), out = pool.map((e, i) => Object.assign({ inPool: true, pi: i }, e));
  const M = D.MG[S.mgMain], ms = S.mg[S.mgMain].s, P = G.mgP(M.grade, ms);
  for (const v of M.moves) if (v.seong <= ms && !ids.has(v.id)) { ids.add(v.id); out.push({ id: v.id, sn: v.seong, mg: S.mgMain, name: v.name, pw: P * v.coef, coef: v.coef, hits: v.hits, eff: v.eff, kind: v.kind, qi: v.qi, inPool: false }); }
  for (const k of S.mgDan) if (!ids.has(k)) { const d = D.DANCHO[k]; ids.add(k); out.push({ id: k, name: d.name, pw: P * d.coef, coef: d.coef, hits: d.hits, eff: d.eff, kind: '단초', qi: d.qi, inPool: false }); }
  return out;
};
G.hotN = () => D.DUEL.HOT_N(G.S.realm);
G.hotLocked = c => c.kind === '절초' && G.S.realm <= 4; // 절정 이하 절초 = 자물쇠(넣기는 가능)
G.hotScore = c => c.coef * (1 + 0.3 * (c.hits - 1)) / Math.sqrt(c.qi / 50);
// §2-6 기본 편성 — 검토 메모 3 해석 A(+6.1): 기수식은 기수식 아닌 후보가 모자랄 때만, 같은 점수는 칸·후보 순서
G.hotDefault = function () {
  const S = S_(); if (!S || !S.mg) return; const n = G.hotN(); if (!Array.isArray(S.hot)) S.hot = [];
  while (S.hot.length < n) S.hot.push(null); S.hot.length = n;
  const empty = S.hot.map((x, i) => x == null ? i : -1).filter(i => i >= 0); if (!empty.length) return;
  const have = new Set(S.hot.filter(x => x != null));
  const cs = G.hotCands().map((c, k) => Object.assign({ k }, c)).filter(c => !have.has(c.id) && !(S.realm <= 4 && c.kind === '절초'));
  const byS = (a, b) => G.hotScore(b) - G.hotScore(a) || (a.sn != null && b.sn != null && a.mg === b.mg ? a.sn - b.sn : 0) || a.k - b.k; // 같은 점수: 같은 무공이면 초식 순서, 아니면 칸·후보 순서
  const non = cs.filter(c => c.kind !== '기수식').sort(byS), gi = cs.filter(c => c.kind === '기수식').sort(byS);
  let pick = non.slice(0, empty.length);
  if (S.realm >= 5 && !S.hot.concat(pick.map(c => c.id)).some(id => { const c = G.hotCands().find(x => x.id === id); return c && c.kind === '절초'; })) {
    const j = non.find(c => c.kind === '절초'); if (j) { if (pick.length >= empty.length) pick.pop(); pick.push(j); pick.sort(byS); }
  }
  pick = pick.concat(gi.slice(0, empty.length - pick.length)); // 기수식은 마지막 칸에만
  empty.forEach((slot, i) => { S.hot[slot] = pick[i] ? pick[i].id : null; });
};
G.hotFillNew = function () { const S = S_(); if (!S || !S.mg) return; if (!S.hot || S.hot.length !== G.hotN() || S.hot.some(x => x == null)) G.hotDefault(); };
G.setHot = function (ids) {
  const S = S_(); if (G.inDuel) return '전투 중에는 바꿀 수 없다'; const n = G.hotN(); if (!Array.isArray(ids)) return '잘못된 편성';
  const ok = new Set(G.hotCands().map(c => c.id)), seen = new Set(), out = [];
  for (let i = 0; i < n; i++) { const id = ids[i] == null ? null : ids[i]; if (id != null && (!ok.has(id) || seen.has(id))) return '쓸 수 없는 초식'; if (id != null) seen.add(id); out.push(id); }
  S.hot = out; G.save(); return null;
};
G.hotIdx = function (pool) { const S = S_(); pool = pool || G.mgPool(); return (S.hot || []).map(id => id == null ? -1 : pool.findIndex(e => e.id === id)).filter(i => i >= 0); };
// ---------- 전투 입력 ----------
const me0 = G.me;
G.me = function (extra) {
  const p = me0.apply(this, arguments), S = S_(); if (!S || !S.mg) return p;
  p.pool = G.mgPool().map(e => G.hotLocked(e) ? Object.assign({ lock: true }, e) : e); p.ptend = D.MG[S.mgMain].tend;
  const sim = S.mgSim && D.MG[S.mgSim], sp = sim ? sim.pas : null;
  if (sp) { p.hadd = sp.heal || 0; p.pb = sp.parry || 0; p.firstm = sp.first || 0; }
  const sin = S.mgSin && D.MG[S.mgSin]; if (sin) { p.dodge = Math.round((sin.pas.dodge0 + sin.pas.dodge_k * S.mg[S.mgSin].s) * 1000) / 1000; p.roll = !!sin.pas.roll; }
  return p;
};
G.esetFor = function (loc) { const k = D.REG_SET[loc]; if (k) return { eset: k }; const g = D.GENERIC[loc]; return g ? { etend: g[1] } : {}; };
G.mgOpts = function (cfg) { const S = S_(); if (!S || !S.mg) return {}; const o = Object.assign({ hot: G.hotIdx() }, G.esetFor(S.loc)); if (cfg && cfg.eset) { o.eset = cfg.eset; delete o.etend; } return o; };
const do0 = G.duelOpts; G.duelOpts = function () { return Object.assign(G.mgOpts(), do0.apply(this, arguments)); };
const pr0 = G.predict; G.predict = function (e, kind, id) { return root.DuelLib.winProb(G.me(), e.slice(0, 7), G.duelOpts(kind, id), Math.round(G.parryRate() * 10) / 10); };
G.duelSeed = function () { const S = S_(); const sd = root.DuelLib.hash32(S.turn, S.cnt.duel, S.ra); S.cnt.duel++; return sd; };
// 싸움 하나 끝(duelUI가 부름): 성 경험 (13-5) · 신법 · 적응 · 초식 사용 기록
G.mgDuelEnd = function (win, w, info) {
  const S = S_(); if (!S || !S.mg) return; const Gn = D.MGAIN;
  G.mgGain(S.mgMain, win ? Gn.win * (w >= 0.9 ? Gn.easy : 1) : Gn.loss);
  if (S.mgSin) G.mgGain(S.mgSin, Gn.sin_fight);
  if (S.mgAdapt > 0) S.mgAdapt--;
  if (info && info.used) for (const id of info.used) S.skUse[id] = (S.skUse[id] || 0) + 1;
  if (!win && !S.mg.nrt && !S.mgNrtOffered) { S.mgNrtOffered = true; G.mgNrt(); }
};
G.mgNrt = function () { const S = S_(); if (S.mg.nrt) return; G.push({ type: 'info', title: '취팔 노개', text: '"넘어질 줄 알아야 안 죽는 법이지." 노개가 땅을 구르는 걸음을 보여 준다.' }); G.learnSkill('nrt', '인연'); };
// 수련 · 수련치 → 성 경험 (심법 = 얻은 수련치 ÷ 25, 주 외공 = 수련 1회 +5)
const tr0 = G.train; G.train = function () { const S = S_(), c0 = S && S.cnt.train; const r = tr0.apply(this, arguments); if (S && S.mg && S.cnt.train > c0) G.mgGain(S.mgMain, D.MGAIN.train); return r; };
G.mgXpWatch = function () { const S = S_(); if (!S || !S.mg) return; if (S.mgXp == null) S.mgXp = S.xp; const dx = S.xp - S.mgXp; S.mgXp = S.xp; if (dx > 0 && S.mgSim) { S.mgSimAcc = (S.mgSimAcc || 0) + dx / D.MGAIN.sim_xp; const n = Math.floor(S.mgSimAcc); if (n > 0) { S.mgSimAcc -= n; G.mgGain(S.mgSim, n); } } };
const af0 = G.after; G.after = function () { G.mgXpWatch(); return af0.apply(this, arguments); };
// 돌파: 필요 심법 성(13-4, 익힌 심법 중 최고) · 돌파 +1성 · 초절정 넷째 칸
const REQ_SIM = { 2: 1, 3: 2, 4: 4, 5: 6 };
const cb0 = G.canBreak; G.canBreak = function () { const S = S_(); if (!cb0.apply(this, arguments)) return false; return !(S.mg && G.mgBestSim() < (REQ_SIM[S.realm + 1] || 0)); };
const bl0 = G.breakLock; G.breakLock = function () { const r = bl0.apply(this, arguments); if (r) return r; const S = S_(); if (S.mg && S.realm < 5 && S.xp >= G.needXp() && G.mgBestSim() < (REQ_SIM[S.realm + 1] || 0)) return '심법 ' + G.mgBestSim() + '/' + REQ_SIM[S.realm + 1] + '성'; return null; };
const db0 = G.doBreak; G.doBreak = function () {
  const S = S_(), r0 = S.realm; G.mgXpWatch(); const ok = db0.apply(this, arguments); S.mgXp = S.xp; if (!ok || !S.mg) return ok;
  const m = S.mg[S.mgMain]; if (m.s < G.mgCap(S.mgMain)) G.mgGain(S.mgMain, Math.max(0, G.mgNeed(S.mgMain, m.s) - m.x));
  if (S.realm >= 5 && r0 < 5) { const had = (S.hot || []).length; G.hotDefault(); if (had < G.hotN()) G.push({ type: 'info', title: '초절정', text: '넷째 칸이 열렸다. 절초 하나를 핫키에 올렸다.' }); G.toast('넷째 칸이 열렸다'); }
  else G.hotFillNew();
  G.save(); return ok;
};
// 승리 보상 훅: 대표 비무(소림·무당) · 두목 낙하 5%
G.mgTrialWin = function (loc) { if (loc === 'henan') G.learnSkill('wtj', '비무'); if (loc === 'hubei') G.learnSkill('wd1', '비무'); };
const fr0 = G.fightResult; G.fightResult = function (tgt, win, w) {
  const S = S_(), first = tgt && tgt.kind === 'boss' && !(S.bossesKilled && S.bossesKilled[tgt.id]); const r = fr0.apply(this, arguments);
  if (S && S.mg && win && first && G.rand() < 0.05) { const c = ['swg', 'bsd', 'crj'].filter(k => !S.mg[k]); if (c.length) { G.toast('두목의 품에서 비급이 떨어졌다'); G.learnSkill(G.pick(c), '두목'); } }
  return r;
};
// 턴 이벤트: 3턴 취팔 노개 · 단초 소식(12 붕석세 · 16 불엽수 · 18 비조삼점 · 20 송풍일점 · 22 열운섬)
const DAN_T = { 12: 'ss1', 16: 'sy1', 18: 'bys', 20: 'sg1', 22: 'jm1' };
const ts0 = G.turnStart; G.turnStart = function () { const r = ts0.apply(this, arguments); const S = S_(); if (S && S.mg) { if (S.turn >= 3 && !S.mg.nrt && !S.mgNrtOffered) { S.mgNrtOffered = true; G.mgNrt(); } if (DAN_T[S.turn]) G.learnSkill(DAN_T[S.turn], '인연'); } return r; };
// ---------- 저장 ----------
G.mgInit = function (S) { S.mg = { sjs: { s: 1, x: 0 }, sjg: { s: 1, x: 0 } }; S.mgMain = 'sjg'; S.mgSim = 'sjs'; S.mgSin = null; S.mgDan = []; S.mgAdapt = 0; S.mgXp = S.xp; S.hot = null; };
const ng0 = G.newGame; G.newGame = function () { const S = ng0.apply(this, arguments); G.mgInit(S); S.opt = G.optDefault(); S.fxSeen = []; S.skUse = {}; S.naegong = 0; S.kkae = 0; S.kkSeen = []; G.hotDefault(); G.save(); return S; };
// v5 → v6: 무공 상태를 경지에 맞춰 추정(가정: 유성검법·정기심법 성 = 그 경지에서 보통 닿는 값, 상한 안)
G.mgUpgrade5 = function (S) {
  S.naegong = Math.round((NEED_SUM(S.realm) + (S.xp || 0) + ((S.off && S.off.reserve) || 0)) / 100 * 10) / 10;
  S.kkae = Math.max(S.kkae || 0, KKAE0[S.realm] || 0); S.kkSeen = S.kkSeen || [];
  if (!S.mg) { const est = { 1: 1, 2: 3, 3: 5, 4: 7, 5: 9 }[S.realm] || 1, sim = { 1: 1, 2: 2, 3: 3, 4: 5, 5: 6 }[S.realm] || 1;
    S.mg = { sjs: { s: sim, x: 0 }, sjg: { s: est, x: 0 } }; S.mgMain = 'sjg'; S.mgSim = 'sjs'; S.mgSin = null; S.mgDan = []; S.mgAdapt = 0; S.mgXp = S.xp;
    if ((S.stats && S.stats.losses > 0) || S.turn >= 3) { S.mg.nrt = { s: 1, x: 0 }; S.mgSin = 'nrt'; S.mgNrtOffered = true; }
    for (const t in DAN_T) if (S.turn >= +t) S.mgDan.push(DAN_T[t]);
    if (S.kyOnce && S.kyOnce['유골'] && S.grade >= 1) S.mg.cmy = { s: 1, x: 0 }; }
};
// §2-1 S.hot: 잃은 id → null → 길이 HOT_N → hotDefault (검토 메모 2 순서)
G.mgMigrate = function (S) {
  if (!S.mg) G.mgUpgrade5(S); if (!S.mgDan) S.mgDan = []; if (S.naegong == null) S.naegong = 0; if (S.kkae == null) S.kkae = KKAE0[S.realm] || 0; if (!S.kkSeen) S.kkSeen = [];
  const prev = G.S; G.S = S;
  try { const ok = new Set(G.hotCands().map(c => c.id)); if (!Array.isArray(S.hot)) S.hot = [];
    S.hot = S.hot.map(id => (id != null && ok.has(id)) ? id : null); const n = G.hotN(); while (S.hot.length < n) S.hot.push(null); S.hot.length = n; G.hotDefault(); }
  finally { G.S = prev; }
};
if (typeof module !== 'undefined') module.exports = G;
})(typeof window !== 'undefined' ? window : globalThis);
