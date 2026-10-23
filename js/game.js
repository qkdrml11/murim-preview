// murim 1단계 게임 규칙 (DOM 없음). 기획서 v0.5.1.
'use strict';
(function (root) {
const D = root.D, DL = root.DuelLib;
const Q = new URLSearchParams((root.location && root.location.search) || '');
const LOC = root.location ? String(root.location.hostname || '') + String(root.location.pathname || '') : '';
const PREVIEW = LOC.indexOf('murim-preview') >= 0 || Q.get('preview') === '1';
// v0.7.8 [1a] 저장 v6. 미리보기(murim-preview)는 본판(같은 github.io 출처)과 저장이 섞이지 않게 키를 따로 쓰고 v5를 읽지 않는다
const SAVE_KEY = PREVIEW ? 'murim_preview_save_v6' : 'murim_save_v6', OLD_KEYS = PREVIEW ? [] : ['murim_save_v5'];
const G = {};
G.SAVE_KEY = SAVE_KEY; G.PREVIEW = PREVIEW;
G.debug = Q.get('debug') === '1';
G.S = null;
// ---------- 기본 ----------
G.clock = () => Date.now() + ((G.S && G.S.timeShift) || 0);
G.rand = function () { const S = G.S; S.ra = (S.ra + 0x6D2B79F5) | 0; let t = S.ra; t = Math.imul(t ^ t >>> 15, 1 | t); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
G.pick = a => a[Math.floor(G.rand() * a.length)];
G.R = id => D.REGIONS[id];
G.rname = id => D.REGIONS[id][0];
G.risk = id => D.REGIONS[id][4];
G.kind = id => D.REGIONS[id][3];
G.has = (id, c) => D.REGIONS[id][5].indexOf(c) >= 0;
G.tatongSpot = id => G.has(id, '객') || G.kind(id) === '산';
G.closed = id => !!D.CLOSED[id] && G.S.turn < 25;
G.pres = () => G.S.fame + D.PRES[G.S.realm];
G.pmult = () => { const v = G.pres(); if (G.S.turn <= 24) return v < 100 ? 1.0 : v < 300 ? 1.2 : 1.4;
  return v < 100 ? 1.0 : v < 300 ? 1.2 : v < 600 ? 1.4 : v < 1000 ? 1.7 : v < 2000 ? 2.0 : 2.5; };
G.hasTitle = t => G.S.titles.indexOf(t) >= 0;
G.trainAmt = (noRegion) => { const S = G.S; return (20 + S.ne / 2) * 1.2 * 1.5 * (!noRegion && G.kind(S.loc) === '산' ? 1.2 : 1) * (G.hasTitle('청운객') ? 1.1 : 1); };
G.gateMer = () => D.MERID[Math.min(5, G.S.realm + 1)] || 12;
G.needXp = () => D.NEED[G.S.realm] || 999999;
G.parryRate = () => { const h = G.S.parryHist; if (!h.length) return 0.5; const r = h.reduce((a, b) => a + b, 0) / h.length; return Math.max(0.2, Math.min(0.9, r)); };
G.dateStr = t => { t = t || G.S.turn; return ((t - 1) / 12 | 0) + 1 + '년 ' + ((t - 1) % 12 + 1) + '월'; };
G.log = [];
G.msgs = []; // UI가 읽어 가는 토스트
G.toast = m => G.msgs.push(m);
G.queue = []; // UI 사건 큐
G.push = ev => G.queue.push(ev);
G.mark = () => { G.S.off.acted = true; };
G.capStats = () => { const S = G.S; S.mu = Math.min(100, S.mu); S.ne = Math.min(100, S.ne); };

// 저장 이전(v5 키 그대로): 없으면 빈 값
G.subInit = () => ({ cur: null, base: 0, q: [], done: [], last: 0, gotTurn: 0, n: 0, silver: 0, goalsSeen: 0 });
G.cntInit = () => ({ win: 0, train: 0, set: { nok: 0, suro: 0, hao: 0 }, adv: 0, r4: 0, duel: 0 });
G.optDefault = function () { let rm = false; try { rm = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}
  return rm ? { shake: false, fx: '낮음', flash: true, vib: false } : { shake: true, fx: '보통', flash: false, vib: false }; };
G.migrate = function (S) { if (!S.sub) S.sub = G.subInit(); if (!S.cnt) S.cnt = G.cntInit(); if (S.cnt.duel == null) S.cnt.duel = 0; if (S.tut && S.tut.personal && !S.tut.personal.used) S.tut.personal.used = {};
  if (!S.opt) S.opt = G.optDefault(); if (!S.fxSeen) S.fxSeen = []; if (!S.skUse) S.skUse = {};
  if (G.mgMigrate) G.mgMigrate(S); };
G.newGame = function (name, skipTut) {
  const now = Date.now();
  const seed = parseInt(Q.get('seed')) || (now % 100000);
  G.S = {
    v: 6, name: name || '한무결', seed, ra: seed, turn: 1, acts: 3, silver: 100, xp: 40, realm: 1, mu: 55, ne: 50, ji: 60, grade: 0, gsk: 0,
    fame: 0, mer: 0, imdok: false, loc: 'guizhou', visited: ['guizhou'], explored: {}, injured: false,
    dead: {}, resp: {}, bossesKilled: {}, bossLoss: {}, bossRevenge: 0, lostBossOnce: {}, kills: 0, sweep: {}, quests: [], board: null,
    items: { '금창약': 0, '소환단': 0 }, onceBuy: {}, turnBuy: {}, titles: [], equipped: null, hyeop: 0, ak: 0, parryHist: [],
    cdRed: 0, extraJung: 0, yak: 0, kyOnce: {}, lastky: null, lastTat: -9, hintIgnore: 0, merChange: 1, merPrev: 0, gaeTeach: false, gaeTeach2: false, saengWait: 0,
    warm: false, freeTat: false, juSa: false, cha: false, dokcho: false, haomun: false, firstAtk: false, lostLast: false, cliff: false, qhBonus: false, qhUsed: false,
    ynPaid: false, sohwanTurn: 0, yeonhwaHerb: false, letter: false, tobeolDone: 0, wantedRw: {}, chaos: {}, merchant: null, extraQuestSlot: false,
    ev: { tourney6: null, tourney18: null, omen: 0, rival23: null, act1done: false, branched: false, rivalRumor: false, notice17: false },
    goals: { claimed: [], mainIdx: 0, mainSince: 1 }, pendingRw: [],
    tut: { personal: { step: 0, skipped: !!skipTut, seen: {}, used: {} }, path: null }, sub: G.subInit(), cnt: G.cntInit(),
    rumor: '귀주의 산골 마을. 취팔 노개가 객잔 구석에서 졸고 있다.', aiLog: [], owners: {}, route: null, settle: null,
    bounties: [], bountyOffer: [], escort: null, escortOffer: null, bountyDone: 0, escortDone: 0, myPathSeen: false, r3pair: false,
    stats: { fights: 0, losses: 0 },
    off: { type: 'ne', lastSeen: now, maxSeen: now, bucket: 0, bucketTs: now, sessH: 0, sessE: 0, acted: true, lastWarm: -1e15,
      suk: { ne: 0, mu: 0, gy: 0 }, sukNe: 0, sukMu: 0, steps: 0, reserve: 0, chosen: false, firstOut: false, pendingTat: null, resting: false },
    timeShift: 0, speed: 1,
  };
  for (const k in D.OWNER) G.S.owners[k] = D.OWNER[k].slice();
  if (skipTut) G.skipTutorial(true);
  G.save();
  return G.S;
};
G.save = function () { if (!G.S) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify(G.S)); } catch (e) {} };
G.load = function () { try { let s = localStorage.getItem(SAVE_KEY); for (let i = 0; !s && i < OLD_KEYS.length; i++) s = localStorage.getItem(OLD_KEYS[i]); if (!s) return null;
  const S = JSON.parse(s); if (S.v !== 5 && S.v !== 6) return null; G.S = S;
  if (S.v === 5) { if (G.mgUpgrade5) G.mgUpgrade5(S); S.v = 6; } // v5 → v6 변환이 끝난 뒤 migrate(핫키 기본 편성은 그 안에서)
  G.migrate(S); return S; } catch (e) { return null; } };
G.fillBucket = function () { const O = G.S.off, n = G.clock(); const bh = Math.max(0, (n - O.bucketTs) / 3600000); O.bucket = Math.min(6.4, O.bucket + 6.4 * bh / 24); O.bucketTs = Math.max(O.bucketTs, n); };
G.heartbeat = function () { const S = G.S; if (!S || S.off.resting) return; const n = G.clock(); G.fillBucket(); S.off.lastSeen = n; S.off.maxSeen = Math.max(S.off.maxSeen, n); G.save(); };

// ---------- 상대 ----------
G.enemyOf = (id) => { const r = G.risk(id), e = D.EN[r], L = D.LOCAL[id]; return [e[0], e[1], e[2], e[3], D.EG[r], L[2], 'n', L[0]]; };
G.bossOf = (id) => { const r = G.risk(id), L = D.LOCAL[id];
  if (r >= 5) return [5, 93, 93, 73, 3, L[2], 'b', L[1]];
  const e = D.EN[r + 1]; return [e[0], e[1], e[2], e[3], Math.min(D.EG[r] + 1, 3), L[2], 'b', L[1]]; };
G.bossAlive = id => !(id in G.S.dead);
G.me = function (extra) {
  const S = G.S; extra = extra || {};
  return { realm: S.realm, mu: S.mu, ne: S.ne, ji: S.ji, grade: S.grade, mer: S.mer + (S.imdok ? 0 : 0), gsk: S.gsk, cdRed: S.cdRed,
    atkMul: (S.lostLast && G.hasTitle('백절불굴')) ? 1.1 : 1, firstMul: S.firstAtk ? 1.5 : 0 };
};
G.duelOpts = function (kind, id) { // 두목 체력 보정
  const S = G.S; let m = 1;
  if (kind === 'boss') { const n = Math.min(2, S.bossLoss[id] || 0); m *= (1 - 0.15 * n); if (S.haomun) m *= 0.8; if (S.dokcho) m *= 0.9; }
  return { eHpMul: m };
};
G.predict = function (e, kind, id) { return DL.winProb(G.me(), e.slice(0, 7), G.duelOpts(kind, id), Math.round(G.parryRate() * 10) / 10); };

// ---------- 돌파 ----------
G.canBreak = function () { const S = G.S; if (S.realm >= 5) return false; return S.xp >= G.needXp() && S.mer >= D.MERID[S.realm + 1] && (S.realm < 4 || S.imdok); };
G.breakLock = function () { const S = G.S; if (S.realm >= 5) return null; if (S.xp < G.needXp()) return null;
  if (S.mer < D.MERID[S.realm + 1]) return '정경 ' + S.mer + '/' + D.MERID[S.realm + 1];
  if (S.realm === 4 && !S.imdok) return '임독양맥 필요(생사현관)'; return null; };
G.gup = function (n) { const S = G.S; S.grade += n; if (S.turn <= 24 && S.grade > 2) { S.gsk = Math.min(2, S.gsk + S.grade - 2); S.grade = 2; } S.grade = Math.min(3, S.grade); };
G.doBreak = function () {
  const S = G.S; if (!G.canBreak()) return false;
  S.xp -= G.needXp(); S.realm++; S.mu += 3; S.ne += 3; G.capStats();
  if (S.off.reserve > 0) { S.xp += S.off.reserve; G.toast('잔여 기운 +' + Math.round(S.off.reserve) + ' 이월'); S.off.reserve = 0; }
  if (S.realm === 2 || S.realm === 4) G.gup(1);
  if (S.realm === 4 && S.turn <= 12 && !G.hasTitle('청운객')) G.addTitle('청운객');
  S.fame += D.BFAME[S.realm];
  G.mark(); G.after(); return true;
};
G.addTitle = function (t) { const S = G.S; if (G.hasTitle(t)) return; S.titles.push(t); if (!S.equipped) S.equipped = t; G.push({ type: 'info', title: '별호 획득', text: "별호 '" + t + "'" + (S.equipped === t ? ' (자동 장착)' : '') }); };

// ---------- 행동 ----------
G.useAct = function (n) { const S = G.S; S.acts -= n; G.mark(); };
G.canAct = function (what) {
  const S = G.S;
  if (S.ev.branched === 'choosing') return '진로를 먼저 정하라';
  if (what === 'tatong') return G.tatongBlock();
  if (S.acts <= 0 && what !== 'end') return '이번 턴 행동을 다 썼다';
  if (what === 'explore' && S.turn < 2) return '2턴부터';
  if (what === 'fight' && S.injured) return '부상: 이번 턴 싸울 수 없다';
  return null;
};
G.train = function () { const S = G.S; if (G.canAct('train')) return; let x = G.trainAmt() * (S.cliff ? 2 : 1); G.useAct(1); S.xp += x; S.cnt.train++; G.tutUse('T2'); G.toast('수련 +' + Math.round(x) + ' 수련치'); G.after(); };
G.moveTargets = function () { // 이동 가능 지역 {id: 칸수}
  const S = G.S; let steps = 1; if (S.realm >= 4) steps = 2; if (S.onceBuy['saeoe']) steps = Math.max(steps, 2);
  const out = {}; let front = [S.loc], seen = { [S.loc]: 0 };
  for (let s = 1; s <= steps; s++) { const nf = []; for (const a of front) for (const b of D.ADJ[a]) if (!(b in seen) && !G.closed(b)) { seen[b] = s; out[b] = s; nf.push(b); } front = nf; }
  return out;
};
G.move = function (id) {
  const S = G.S; const t = G.moveTargets(); if (!(id in t)) return false;
  const free = S.off.steps > 0; if (!free && G.canAct('move')) return false;
  if (free) { S.off.steps--; G.mark(); G.toast('날랜 걸음: 행동 소모 없음'); } else G.useAct(1);
  const via = t[id] === 2 ? D.ADJ[S.loc].find(x => D.ADJ[x].indexOf(id) >= 0 && !G.closed(x)) : null;
  if (via && S.visited.indexOf(via) < 0) S.visited.push(via);
  S.loc = id; S.cliff = false;
  if (S.visited.indexOf(id) < 0) { S.visited.push(id); G.push({ type: 'info', title: G.rname(id) + ' 도착', text: '취팔 노개의 소문: "' + D.LOCAL[id][4] + '."' }); }
  for (const q of S.quests) if (q.kind === '배달' && (q.tgt === id || q.tgt === via)) q.left = 0;
  G.settleQuests();
  if (S.escort) G.escortStep(id);
  G.after(); return true;
};
G.fightTargets = function () {
  const S = G.S, id = S.loc, out = [];
  out.push({ kind: 'enemy', id, e: G.enemyOf(id), label: '출몰 적 · ' + D.LOCAL[id][0] });
  if (G.bossAlive(id)) out.push({ kind: 'boss', id, e: G.bossOf(id), label: '두목 · ' + D.LOCAL[id][1] + (S.resp[id] ? ' (재등장)' : '') });
  return out;
};
G.sweepMul = function (id) { const S = G.S, dd = S.realm - G.risk(id); const m1 = dd <= 0 ? 1 : dd === 1 ? 0.5 : 0.25; const k = S.sweep[id] || 0; const m2 = k === 0 ? 1 : k <= 2 ? 0.5 : 0.25; return m1 * m2; };
// 싸움 결과 적용 (UI가 일기토를 끝낸 뒤 호출)
G.fightResult = function (tgt, win, w) {
  const S = G.S, id = tgt.id; S.stats.fights++;
  S.firstAtk = false;
  if (tgt.kind === 'boss') { S.haomun = false; S.dokcho = false; }
  const lostBefore = S.lostLast; S.lostLast = !win;
  if (win) { S.cnt.win++; if (S.realm >= 4 && G.risk(S.loc) >= 4) S.cnt.r4++; }
  if (!win) { S.stats.losses++; S.injured = true; if (tgt.kind === 'boss') { S.bossLoss[id] = (S.bossLoss[id] || 0) + 1; S.lostBossOnce[id] = true; }
    G.push({ type: 'info', title: '패배 — 실패 없는 후퇴', text: '부상: 이번 턴 끝까지 싸울 수 없다. 잃은 것은 없다.\n취팔 노개: "권장: 정경 ' + G.gateMer() + ' / ' + D.REALM[Math.min(5, S.realm + 1)] + '"' }); G.after(); return; }
  const r = G.risk(id), base = D.REW[r]; let s, x, f;
  const ttl = G.hasTitle(G.rname(id) + '검객') ? 1.2 : 1;
  if (tgt.kind === 'boss') {
    const resp = !!S.resp[id];
    s = base[0] * 1.5 * (resp ? 0.5 : 1); x = base[1] * 2; f = (base[2] * 2 + 5 * r) * (resp ? 0.5 : 1);
    s *= ttl; x *= ttl; f *= ttl; if (G.hasTitle('흑도사냥꾼')) s *= 1.2;
    if (w >= 0.2 && w < 0.9) f *= 1.5;
    S.dead[id] = S.turn; S.bossLoss[id] = 0;
    const first = !S.bossesKilled[id]; S.bossesKilled[id] = (S.bossesKilled[id] || 0) + 1;
    if (S.lostBossOnce[id]) { S.lostBossOnce[id] = false; S.bossRevenge++; if (S.bossRevenge >= 3) G.addTitle('백절불굴'); }
    if (first && Object.keys(S.bossesKilled).length === 1) G.addTitle(G.rname(id) + '검객');
    if (id === 'guizhou' && S.letter === 'open') { x += 150; S.letter = 'done'; G.push({ type: 'info', title: '석두의 부탁', text: '산채를 다시 쓸어 냈다. 석두가 고개를 숙인다. 수련치 +150' }); }
    G.creditKill(id, true);
    // 현상금
    const bi = S.bounties.findIndex(b => b.tgt === id);
    if (bi >= 0) { const b = S.bounties.splice(bi, 1)[0]; S.silver += 60 * r; S.fame += 10 * r; S.bountyDone++; G.toast('현상금 완료: 은자 +' + 60 * r + ' 명성 +' + 10 * r); }
  } else {
    s = base[0]; x = base[1]; f = base[2];
    s *= ttl; x *= ttl; f *= ttl;
    const m = G.sweepMul(id); s *= m; x *= m; f *= m; S.sweep[id] = (S.sweep[id] || 0) + 1;
    if (w >= 0.2 && w < 0.9) f *= 1.5;
    S.kills++; if ([10, 20, 30, 40, 55, 70].indexOf(S.kills) >= 0) { S.fame += 5; G.push({ type: 'info', title: '토벌록', text: '일반 적 ' + S.kills + '명 처치. 토벌록에 도장이 찍혔다. 명성 +5' }); }
    G.creditKill(id, false);
  }
  s = Math.round(s); f = Math.round(f);
  S.silver += s; S.xp += x; S.fame += f;
  G.toast('승리! 은자 +' + s + ' 수련치 +' + Math.round(x) + ' 명성 +' + f);
  G.after();
};
// 잠정 규칙(기획 결정 전): 처치 1명은 토벌 의뢰 1건에만 인정
// v0.5.2 ①: 처치 1명(두목 포함)은 토벌 의뢰 1건에만. 남은 기한 짧은 것 → 먼저 받은 것
G.creditKill = function (id) { const S = G.S; let best = null;
  for (const q of S.quests) if (q.kind === '토벌' && q.tgt === id && q.left > 0 && (!best || q.ttl < best.ttl || (q.ttl === best.ttl && (q.seq || 0) < (best.seq || 0)))) best = q;
  if (best) best.left--; G.settleQuests(); };
G.settleQuests = function () {
  const S = G.S; const done = S.quests.filter(q => q.left <= 0); if (!done.length) return;
  S.quests = S.quests.filter(q => q.left > 0);
  for (const q of done) {
    const v = q.fixed || Math.round(30 * G.risk(q.tgt) * q.mul * G.pmult() * (G.hasTitle('협객') ? 1.1 : 1));
    const fm = q.fixedFame || q.fm * G.risk(q.tgt);
    S.silver += v; S.fame += fm; S.questsDone = (S.questsDone || 0) + 1;
    G.toast('의뢰 완료(' + q.kind + ' · ' + G.rname(q.tgt) + '): 은자 +' + v + ' 명성 +' + fm);
  }
};
// ---------- 탐색 ----------
// 싸움 결과 토스트는 한 줄로 합친다
{ const fr = G.fightResult; G.fightResult = function () { const n = G.msgs.length; const r = fr.apply(this, arguments);
  if (G.msgs.length - n > 1) { const m = G.msgs.splice(n); G.msgs.push(m.join(' · ')); } return r; }; }
G.explore = function () {
  const S = G.S; if (G.canAct('explore')) return; G.useAct(1); S.explores = (S.explores || 0) + 1;
  const id = S.loc;
  for (const q of S.quests) if (q.kind === '정탐' && q.tgt === id) q.left = 0;
  G.settleQuests();
  if (!S.explored[id]) { G.landmark(id); G.after(); return; }
  const r = G.rand() * 100, mt = G.kind(id) === '산';
  const ky = mt ? 60 : 50, en = mt ? 25 : 30;
  if (r < ky) G.kiyeon(id);
  else if (r < ky + en) { if (S.injured) G.toast('적을 만났지만 부상 중이라 피했다'); else G.push({ type: 'encounter', id }); }
  else if (G.rand() < 0.5) G.merchantEvent(id);
  else { if (S.quests.length >= 3 || S.turn < 2) { S.silver += 30; G.toast('급한 의뢰: 이미 의뢰가 많다. 은자 +30'); }
    else { { const q = G.makeQuest(id, true); q.seq = (S.qseq = (S.qseq || 0) + 1); S.quests.push(q); } G.push({ type: 'info', title: '급한 의뢰', text: '길에서 급한 의뢰를 받았다. (의뢰 칸 +1)' }); } }
  G.after();
};
G.merchantEvent = function (id) {
  const S = G.S; const opts = D.SHOP.filter(x => !x.city).map(x => ({ kind: 'shop', id: x.id, name: x.name, price: x.price }));
  for (const k in D.MYEONGMUL) if (S.turn >= 5) opts.push({ kind: 'mm', id: k, name: D.MYEONGMUL[k].name, price: D.MYEONGMUL[k].price });
  const o = G.pick(opts); S.merchant = { turn: S.turn, kind: o.kind, id: o.id, loc: id };
  G.push({ type: 'info', title: '떠돌이 약장수', text: "'" + o.name + "'을(를) 이번 턴만 20% 싸게 판다. (거점 > 약방/명물에서 구매)" });
};
G.price = function (kind, id, base) { const S = G.S; return (S.merchant && S.merchant.turn === S.turn && S.merchant.kind === kind && S.merchant.id === id) ? Math.round(base * 0.8) : base; };
G.jungOk = () => G.S.turn > 24 || G.S.extraJung < 3;
G.addJung = function (n, why) {
  const S = G.S; n = Math.min(n, 12 - S.mer); if (S.turn <= 24) n = Math.min(n, 3 - S.extraJung); if (n <= 0) return 0;
  S.mer += n; S.mu += n; S.ne += 2 * n; S.extraJung += n; G.capStats(); G.toast('경맥 개통 +' + n + ' (' + why + ')'); return n;
};
G.kiyeonPool = function (id) {
  const S = G.S, k = G.kind(id), pool = [];
  const chaos = (S.chaos[id] || 0) >= S.turn;
  if (S.yak < 3) pool.push(['영약', 15]);
  if ((k === '산' || id === 'guangxi') && !S.kyOnce['유골']) pool.push(['유골', 10]);
  if (G.has(id, '객')) pool.push(['떠돌이 무사', 15]);
  if (k === '강' || chaos) pool.push(['이재민', chaos ? 20 : 10]);
  if (k === '도시') pool.push(['하오문', 8]);
  if (k === '산') pool.push(['산채 도전장', 10]);
  if ((k === '변방' || k === '산') && G.pres() >= 600 && !S.kyOnce['깨달음']) pool.push(['깨달음', 4]);
  if (k === '도시' || k === '강') pool.push(['상인 습격', 10]);
  if (chaos) pool.push(['패잔병', 15]);
  if (G.has(id, '비')) pool.push(['비무 초청', 8]);
  pool.push(['소문', 10]);
  const p2 = pool.filter(x => x[0] !== S.lastky); return p2.length ? p2 : [['소문', 10]];
};
G.kiyeon = function (id, forced) {
  const S = G.S; let nm = forced;
  if (!nm) { const pool = G.kiyeonPool(id); let tot = pool.reduce((a, b) => a + b[1], 0), x = G.rand() * tot; for (const [n, w] of pool) { x -= w; nm = n; if (x <= 0) break; } }
  S.lastky = nm; S.kyCount = (S.kyCount || 0) + 1;
  G.push({ type: 'kiyeon', name: nm, id });
};
// 기연 선택지 정의 (UI가 표시, choose로 적용)
G.kiyeonDef = function (nm, id) {
  const S = G.S, jfull = S.mer >= 12 || !G.jungOk();
  const D_ = {
    '영약': { t: '기연 · 영약', d: '바위틈에서 기이한 약초를 찾았다.', a: '먹는다: 수련치 +150', b: jfull ? '달여 먹는다: 수련치 +150 (정경 추가원 상한)' : '혈에 바른다: 정경 1 개통' },
    '유골': { t: '기연 · 동굴 속 유골', d: '동굴 깊은 곳, 무인의 유골 곁에 낡은 책.', a: '비급을 챙긴다: 무공 등급 +1', b: '정중히 묻는다: 명성 +20, 협행 +1' },
    '떠돌이 무사': { t: '기연 · 객잔의 떠돌이 무사', d: '술 취한 무사가 손을 까딱인다.', a: '술값(은자 −30) + 대련: 다음 일기토 첫 공격 +50%', b: '정보: 은자 +60, 근처 두목 위치 공개' },
    '이재민': { t: '기연 · 이재민 행렬', d: '굶주린 피란민이 길가에 앉아 있다.', a: '곡식(은자 −50): 명성 +15, 협행 +1', b: '길 안내: 명성 +5' },
    '하오문': { t: '기연 · 하오문 정보', d: '뒷골목 사내가 두목의 약점을 판다.', a: '산다(은자 −50): 다음 두목전 적 체력 −20%', b: '개방에 넘긴다: 명성 +20' },
    '산채 도전장': { t: '기연 · 산채 도전장', d: '산채에서 도전장이 날아왔다.', a: '받는다: 일기토(한 경지 아래), 승리 명성 +20', b: '거절하고 수련: 수련치 +60' },
    '깨달음': { t: '기연 · 깨달음', d: '바람 소리에 문득 막혔던 초식이 풀린다.', a: '수련치 +300', b: jfull ? '초식 쿨 −1초 영구 + 수련치 +150' : '초식 쿨 −1초 영구 + 정경 1' },
    '상인 습격': { t: '기연 · 상인 습격 현장', d: '산적이 상인 수레를 털고 있다.', a: '구한다: 일기토 → 은자 +80, 협행 +1', b: '짐을 챙긴다: 은자 +150 · 악행 +1 · 협객들이 당신을 꺼리게 됩니다' },
    '패잔병': { t: '기연 · 전란의 패잔병', d: '난리 끝에 흩어진 병사들이 길을 막는다.', a: '싸운다: 위험도 +1 적, 보상 ×1.5', b: '숨겨 준다: 명성 +10, 협행 +1' },
    '비무 초청': { t: '기연 · 비무 초청', d: '비무대에서 초청장이 왔다.', a: '3연전(같은 경지): 승리마다 명성 +10', b: '관전: 수련치 +50' },
    '소문': { t: '기연 · 소문', d: '객잔에서 귀를 기울였다.', a: '푼돈을 줍는다: 은자 10~30', b: '강호 소문을 듣는다' },
    '은거 고수': { t: '은거 고수의 낚싯대', d: '낚싯대를 드리운 노인이 웃는다. "자네, 막힌 데가 많구먼."', a: '가르침: 초식 쿨 −0.5초 영구 + 수련치 +200', b: (S.turn <= 24 && 3 - S.extraJung <= 0) || S.mer >= 12 ? '대련: 수련치 +300' : (S.turn <= 24 && 3 - S.extraJung === 1) ? '대련: 정경 1 + 수련치 +150' : '대련: 정경 2 개통' },
  };
  return D_[nm];
};
G.hyeopUp = function () { const S = G.S; if (S.ak > 0) S.ak--; else S.hyeop = Math.min(5, S.hyeop + 1); };
G.chooseKiyeon = function (nm, id, b) {
  const S = G.S;
  switch (nm) {
    case '영약': S.yak++; if (b && S.mer < 12 && G.jungOk()) G.addJung(1, '영약'); else { S.xp += 150; G.toast('수련치 +150'); } break;
    case '유골': S.kyOnce['유골'] = 1; if (!b) { if (G.learnSkill) G.learnSkill('cmy', '기연'); else { G.gup(1); G.toast('무공 등급 +1'); } } else { S.fame += 20; G.hyeopUp(); } break;
    case '떠돌이 무사': if (!b) { if (S.silver >= 30) { S.silver -= 30; S.firstAtk = true; G.toast('다음 일기토 첫 공격 +50%'); if (G.learnSkill) G.learnSkill('yhg', '기연'); } else G.toast('은자가 모자라 대련을 못 했다'); } else { S.silver += 60; G.toast('은자 +60'); } break;
    case '이재민': if (!b && S.silver >= 50) { S.silver -= 50; S.fame += 15; G.hyeopUp(); if (G.learnSkill) G.learnSkill('yht', '기연'); } else S.fame += 5; break;
    case '하오문': if (!b && S.silver >= 50) { S.silver -= 50; S.haomun = true; G.toast('다음 두목전 적 체력 −20%'); } else S.fame += 20; break;
    case '산채 도전장': if (!b) { if (S.injured) { G.toast('부상 중이라 사양했다'); break; } const tr = S.realm - 1 >= 2 ? D.TRIAL[S.realm - 1] : G.enemyOf(id); return { duel: tr.slice(0, 7).concat([S.realm - 1 >= 2 ? '산채 채주' : '산채 졸개']), reward: { fame: 20, mg: 'yhs' } }; } else S.xp += 60; break;
    case '깨달음': S.kyOnce['깨달음'] = 1; if (!b) S.xp += 300; else { S.cdRed += 10; if (S.mer < 12 && G.jungOk()) G.addJung(1, '깨달음'); else S.xp += 150; } break;
    case '상인 습격': if (!b) { if (S.injured) { G.toast('부상 중이라 지켜볼 수밖에 없었다'); break; } return { duel: G.enemyOf(id), reward: { silver: 80, hyeop: 1 } }; } else { S.silver += 150; S.ak = Math.min(5, S.ak + 1); } break;
    case '패잔병': if (!b) { if (S.injured) break; const r = Math.min(5, G.risk(id) + 1), e = D.EN[r]; return { duel: [e[0], e[1], e[2], e[3], D.EG[r], null, 'n', '패잔병'], reward: { silver: Math.round(D.REW[r][0] * 1.5), xp: D.REW[r][1] * 1.5, fame: Math.round(D.REW[r][2] * 1.5) } }; } else { S.fame += 10; G.hyeopUp(); } break;
    case '비무 초청': if (!b) { const tr = D.TRIAL[Math.max(2, S.realm)] || D.TRIAL[2]; return { duel: tr, series: 3, reward: { fame: 10 } }; } else S.xp += 50; break;
    case '소문': if (!b) { const v = 10 + Math.floor(G.rand() * 21); S.silver += v; G.toast('은자 +' + v); } else G.push({ type: 'info', title: '강호 소문', text: G.pick(D.RUMORS) }); break;
    case '은거 고수': S.kyOnce['은거 고수'] = 1; if (!b) { S.cdRed += 5; S.xp += 200; G.push({ type: 'info', title: '은거 고수', text: '"언젠가 다시 보세." 초식 쿨 −0.5초, 수련치 +200' }); if (G.learnSkill) G.learnSkill('hgd', '기연'); }
      else { const room = S.turn <= 24 ? 3 - S.extraJung : 9; if (room <= 0 || S.mer >= 12) S.xp += 300; else if (room === 1) { G.addJung(1, '은거 고수'); S.xp += 150; } else G.addJung(2, '은거 고수'); } break;
  }
  G.after(); return null;
};
G.landmark = function (id) {
  const S = G.S; S.explored[id] = true; const nm = D.LOCAL[id][3];
  const say = (t) => G.push({ type: 'info', title: '대표 사건 · ' + nm, text: t });
  switch (id) {
    case 'guizhou': G.kiyeon(id, '영약'); break;
    case 'guangxi': G.kiyeon(id, '유골'); break;
    case 'jiangxi': G.kiyeon(id, '이재민'); break;
    case 'fujian': G.kiyeon(id, '하오문'); break;
    case 'anhui': case 'hebei': G.kiyeon(id, '비무 초청'); break;
    case 'hunan': if (S.injured) { S.explored[id] = false; G.toast('부상 중이라 지켜볼 수밖에 없었다(다시 탐색)'); break; }
      G.push({ type: 'story', title: '대표 사건 · 소연화 구출', text: '수적이 약초꾼의 딸을 배에 태우려 한다. 두목 물귀신 염칠이 막아선다.', duel: G.bossOf('hunan').slice(0, 6).concat(['b', '물귀신 염칠']), onWin: 'yeonhwa', onLose: 'relm' }); break;
    case 'yunnan': if (G.pres() >= 300) G.kiyeon(id, '은거 고수');
      else { S.explored[id] = false; if (!S.ynPaid) { S.ynPaid = true; S.silver += 30; say('노인이 낚싯대를 거두며 은자 30냥을 던져 준다. "이름이 좀 나면 다시 오게."'); } else say('노인은 고개를 젓는다. "아직이야." (개인 위신 300 이상 필요)'); } break;
    case 'sichuan': S.xp += 100; say('약초꾼이 영약 한 뿌리를 나눠 준다. "당가 약방에 넘기면 값을 쳐 주지만, 자네가 먼저 쓰게." 수련치 +100'); break;
    case 'hubei': case 'henan': case 'gansu': G.trialEvent(id, 3, 20); break;
    case 'xizang': case 'nanman': case 'saeoe': G.trialEvent(id, 4, 30); break;
    case 'bukhae': G.trialEvent(id, 5, 50); break;
    case 'guangdong': S.quests.push({ kind: '배달', tgt: G.pick(D.ADJ[id].filter(x => !G.closed(x))), mul: 1.05, fm: 3, left: 1, ttl: 3 }); say('향료 상단의 배달 의뢰를 받았다. (보수 ×1.5)'); break;
    case 'jiangnan': S.quests.push({ kind: '토벌', tgt: id, mul: 2.0, fm: 5, left: 2, ttl: 3 }); say('큰 상인의 토벌 의뢰를 받았다. (보수 ×2)'); break;
    case 'shanxi': S.quests.push({ kind: '토벌', tgt: id, mul: 1.0, fm: 5, left: 2, ttl: 3 }); say('표국 객방에서 토벌 의뢰를 받았다.'); if (G.learnSkill) G.learnSkill('sjd', '사건'); break;
    case 'shaanxi': S.cliff = true; say('바람 센 절벽. 이번 턴 남은 수련은 두 배다.'); break;
    case 'shandong': S.silver += 80; say('녹림 채주가 술잔을 내민다. "낭인 양반, 칼이 좋구먼." 은자 +80'); if (G.learnSkill) G.learnSkill('cps', '사건'); break;
    case 'liaodong': S.ne += 3; G.capStats(); say('백년 인삼을 먹었다. 내공 +3'); break;
    case 'qinghai': S.qhBonus = true; say('곤륜 설산의 타통 터. 이곳에서 타통하면 정경 +1 추가(1회).'); break;
    case 'xinjiang': say('붉은 옷의 사내들이 말없이 지켜본다. 정마의 기운이 짙다.'); break;
  }
};
G.trialEvent = function (id, lv, fame) {
  const S = G.S, tr = D.TRIAL[lv]; const w = G.predict(tr, 'trial', id).w;
  G.push({ type: 'story', title: '대표 사건 · ' + D.LOCAL[id][3], text: tr[7] + '이(가) 비무를 청한다. 예상: ' + DL.band(w)[0] + (w < 0.2 ? '\n(무모하면 [다음에 오겠다]가 기본)' : ''),
    duel: tr, trial: true, reckless: w < 0.2, onWin: 'fame:' + fame, onLose: 'relm', onSkip: 'relm' });
};
// ---------- 타통 ----------
G.saengReady = function () { const S = G.S; return S.realm === 4 && S.mer >= 12 && !S.imdok && S.xp >= D.NEED[4]; };
G.tatongBlock = function () {
  const S = G.S;
  if (S.turn < 3) return '3턴부터';
  if (S.acts < 3) return '행동 3개가 모두 남아야 한다';
  if (S.lastTat === S.turn - 1) return '연속 타통 불가(한 턴은 강호 활동)';
  if (!G.tatongSpot(S.loc)) return '객잔이나 산에서만';
  if (S.mer >= 12) { if (S.imdok) return '정경 모두 개통(기경은 2막)'; if (!G.saengReady()) return S.realm < 4 ? '절정이 되어야 생사현관' : '생사현관: 수련치 2,000 필요'; if (S.turn < 16) return '아직 몸이 받아들이지 못한다 — 16턴부터'; }
  if (G.tatongCost() > S.silver) return '은자 부족(' + G.tatongCost() + ')';
  return null;
};
G.tatongCost = function () {
  const S = G.S; if (S.mer >= 12) return 300;
  if (S.warm || S.freeTat) return 0;
  let c = 50 * S.realm; if (G.kind(S.loc) === '산') c *= 0.5; else if (S.juSa) c *= 0.5; return Math.round(c);
};
G.tatongGlow = function () { const S = G.S; return !G.tatongBlock() && S.mer < G.gateMer() && S.xp >= G.needXp() * 0.5; };
G.tatongAuto = () => G.S.warm || G.S.freeTat || G.S.cha;
// perfect: 운기행공 모두 맞힘
G.doTatong = function (perfect) { G.tutUse('T6'); G.tutUse('T7');
  const S = G.S; if (G.tatongBlock()) return null;
  const cost = G.tatongCost(); S.silver -= cost; S.acts = 0; G.mark(); S.lastTat = S.turn; S.tatongs = (S.tatongs || 0) + 1;
  if (G.tatongAuto()) perfect = true;
  const res = { cost, perfect, opened: [] };
  if (S.mer >= 12) { S.imdok = true; S.mu += 5; S.ne += 10; G.capStats(); res.opened = ['임맥', '독맥']; res.saeng = true; }
  else {
    if (S.mer < 12 && S.warm === false && S.freeTat === false && G.kind(S.loc) !== '산' && S.juSa) S.juSa = false;
    const n = Math.min(2, 12 - S.mer); for (let i = 0; i < n; i++) res.opened.push(D.JUNG[S.mer + i]);
    S.mer += n; S.mu += n; S.ne += 2 * n;
    if (S.loc === 'qinghai' && S.qhBonus && !S.qhUsed && S.mer < 12 && G.jungOk()) { S.qhUsed = true; S.extraJung++; res.opened.push(D.JUNG[S.mer]); S.mer++; S.mu++; S.ne += 2; }
    G.capStats();
  }
  let x = G.trainAmt() * 2 * (perfect ? 1.2 : 1) * (S.yeonhwaHerb ? 1.3 : 1); S.xp += x; res.xp = Math.round(x);
  S.yeonhwaHerb = false; S.warm = false; S.freeTat = false; S.cha = false; S.juSa = false; S.hintIgnore = 0;
  res.rumors = [G.pick(D.RUMORS), G.pick(D.RUMORS), G.pick(D.RUMORS)];
  G.after(); return res;
};
// ---------- 상점 ----------
G.buy = function (kind, id) {
  const S = G.S;
  if (kind === 'shop') {
    const it = D.SHOP.find(x => x.id === id); const p = G.price('shop', id, it.price);
    if (!G.has(S.loc, '상')) return '약방이 없다'; if (S.silver < p) return '은자 부족';
    if (id === 'sohwan' && S.sohwanTurn === S.turn) return '턴당 1개';
    if (id === 'bigeup' && (S.onceBuy.bigeup || S.turn < 3 || G.kind(S.loc) !== '도시')) return S.onceBuy.bigeup ? '이미 샀다' : '도시·3턴부터';
    if (id === 'sbigeup' && (S.onceBuy.sbigeup || S.realm < 4 || G.kind(S.loc) !== '도시')) return S.onceBuy.sbigeup ? '이미 샀다' : '도시·절정 이상';
    S.silver -= p;
    if (id === 'geum') S.items['금창약']++;
    if (id === 'sohwan') { S.sohwanTurn = S.turn; S.xp += 100; }
    if (id === 'bigeup') { S.onceBuy[id] = 1; if (G.mgBigeup) G.mgBigeup(); else G.gup(1); }
    if (id === 'sbigeup') { S.onceBuy[id] = 1; if (G.mgMrcy) G.mgMrcy(); else G.gup(1); }
    G.toast(it.name + ' 구매'); G.after(); return null;
  }
  const mm = D.MYEONGMUL[id]; const p = G.price('mm', id, mm.price);
  if (S.turn < 5) return '5턴부터'; if (S.loc !== id && !(S.merchant && S.merchant.turn === S.turn && S.merchant.id === id)) return '그 고장에서만';
  if (S.silver < p) return '은자 부족';
  if (mm.lim === 'once' && S.onceBuy[id]) return '이미 샀다'; if (mm.lim === 'turn' && S.turnBuy[id] === S.turn) return '턴당 1';
  if (id === 'qinghai' && S.turn <= 24 && (!G.jungOk() || S.mer >= 12)) return '25턴부터';
  S.silver -= p; if (mm.lim === 'once') S.onceBuy[id] = 1; else S.turnBuy[id] = S.turn;
  switch (id) {
    case 'guizhou': S.juSa = true; break; case 'sichuan': S.injured = false; S.xp += 150; break; case 'yunnan': S.cha = true; break;
    case 'shanxi': S.mu += 2; break; case 'liaodong': S.ne += 3; break; case 'nanman': S.dokcho = true; break;
    case 'qinghai': G.addJung(1, '설련'); break; case 'saeoe': break;
  }
  G.capStats(); G.toast(mm.name + ' 구매'); G.after(); return null;
};
G.useItem = function (nm) { const S = G.S; if (!S.items[nm]) return; if (nm === '금창약') { if (!S.injured) return '부상이 없다'; S.items[nm]--; S.injured = false; G.toast('부상 회복'); }
  else if (nm === '소환단') { S.items[nm]--; S.xp += 100; G.toast('수련치 +100'); } G.after(); };
// ---------- 의뢰 ----------
G.questTargets = function (loc) { const S = G.S; return [loc].concat(D.ADJ[loc]).filter(x => G.risk(x) <= S.realm && !G.closed(x)); };
G.QUEST_LOC_P = 0.6;
G.qseq = 0;
G.makeQuest = function (loc, urgent) {
  // v0.5.2 ②: 대상 = 현재 지역 자격이면 60% 현재, 아니면 자격 지역 균등 / 종류 토벌2:배달1(+도시 정탐1) / 배달이 현재 지역이면 다시 뽑기
  const S = G.S; const opts = G.questTargets(loc); if (!opts.length) opts.push(loc);
  const kinds = ['토벌', '토벌', '배달']; if (G.kind(loc) === '도시') kinds.push('정탐');
  let kd = G.pick(kinds); const locOk = opts.indexOf(loc) >= 0;
  let tgt = (locOk && G.rand() < G.QUEST_LOC_P) ? loc : G.pick(opts);
  if (kd === '배달' && tgt === loc) { const o2 = opts.filter(x => x !== loc); tgt = o2.length ? G.pick(o2) : loc; }
  const [mul, fm, left] = { '토벌': [1.0, 5, 2], '배달': [0.7, 3, 1], '정탐': [0.8, 3, 1] }[kd];
  return { kind: kd, tgt, mul, fm, left, ttl: 3, urgent: !!urgent };
};
G.getBoard = function () {
  const S = G.S, loc = S.loc; if (!G.has(loc, '객') || S.turn < 2) return null;
  if (!S.board || S.board.turn !== S.turn || S.board.loc !== loc) {
    const list = [];
    if (S.turn === 2 && loc === 'guizhou' && !S.tutQuestGiven) list.push({ kind: '토벌', tgt: 'guizhou', mul: 1, fm: 5, left: 1, ttl: 3, fixed: 30, fixedFame: 5, tut: true });
    const n = G.kind(loc) === '도시' ? 3 : 2; while (list.length < n) list.push(G.makeQuest(loc));
    S.board = { turn: S.turn, loc, list };
    // 진로 ③: 호위
    if (S.route === 3) { S.escortOffer = (G.kind(loc) === '도시' || G.kind(loc) === '강') ? G.makeEscort(loc) : null; }
  }
  return S.board;
};
G.acceptQuest = function (i) {
  const S = G.S, b = G.getBoard(); if (!b) return '객잔이 없다'; const q = b.list[i]; if (!q) return;
  const cap = 2 + (S.quests.some(x => x.urgent) ? 1 : 0); if (S.quests.length >= cap) return '동시에 최대 2개';
  b.list.splice(i, 1); q.seq = (S.qseq = (S.qseq || 0) + 1); S.quests.push(q); if (q.tut) S.tutQuestGiven = true; G.mark(); G.toast('의뢰 수락: ' + q.kind + ' · ' + G.rname(q.tgt)); G.after(); return null;
};
// 진로 ③: 현상금·호위
G.makeEscort = function (loc) {
  const S = G.S; const c1 = D.ADJ[loc].filter(x => !G.closed(x) && G.risk(x) <= S.realm);
  let c2 = []; for (const a of c1) for (const b of D.ADJ[a]) if (b !== loc && c1.indexOf(b) < 0 && !G.closed(b) && G.risk(b) <= S.realm && c2.indexOf(b) < 0) c2.push(b);
  const tgt = (c2.length && G.rand() < 0.5) ? G.pick(c2) : G.pick(c1.length ? c1 : [loc]);
  return { tgt, from: loc, river: G.kind(tgt) === '강' };
};
G.acceptEscort = function () { const S = G.S; if (!S.escortOffer) return '호위 의뢰가 없다'; if (S.escort) return '이미 호위 중'; S.escort = Object.assign({ ttl: 4 }, S.escortOffer); S.escortOffer = null; G.mark(); G.toast('호위 수락: ' + G.rname(S.escort.tgt) + '까지'); G.after(); return null; };
G.escortStep = function (id) {
  const S = G.S, es = S.escort; if (!es) return;
  if (G.rand() < 0.3 && !S.injured) { const r = G.risk(es.tgt), e = D.EN[r]; G.push({ type: 'story', title: '호위 · 습격', text: '길목에서 칼을 든 무리가 튀어나왔다!', duel: [e[0], e[1], e[2], e[3], D.EG[r], null, 'n', '습격자'], onWin: 'none', onLose: 'relm' }); }
  if (id === es.tgt) { const r = G.risk(es.tgt); const v = Math.round(30 * r * (es.river ? 1.8 : 1.5) * G.pmult()); S.silver += v; S.fame += 5 * r; S.escort = null; S.escortDone++; G.push({ type: 'info', title: '호위 완료', text: '상인이 무사히 도착했다. 은자 +' + v + ', 명성 +' + 5 * r }); }
};
G.acceptBounty = function (i) { const S = G.S; const b = S.bountyOffer[i]; if (!b) return; if (S.bounties.length >= 2) return '현상금은 동시에 2건까지'; S.bountyOffer.splice(i, 1); S.bounties.push(b); if (S.bounties.length >= 2) S.r3pair = true; G.mark(); G.toast('현상금 수락: ' + D.LOCAL[b.tgt][1]); G.after(); return null; };
// ---------- 목표 바 ----------
G.goalCond = function (i) {
  const S = G.S, wanted = Object.keys(S.bossesKilled).length, bk = r => Object.keys(S.bossesKilled).some(b => G.risk(b) === r);
  switch (i) {
    case 0: return S.kills >= 1; case 1: return S.realm >= 2; case 2: return !!S.bossesKilled.guizhou; case 3: return (S.explores || 0) >= 1;
    case 4: return (S.questsDone || 0) >= 1; case 5: return (S.tatongs || 0) >= 1; case 6: return S.realm >= 3; case 7: return S.visited.length >= 2;
    case 8: return bk(2); case 9: return S.ev.tourney6 !== null; case 10: return S.mer >= 4; case 11: return wanted >= 5; case 12: return S.realm >= 4;
    case 13: return bk(3); case 14: return S.visited.length >= 10; case 15: return S.mer >= 12; case 16: return S.realm >= 5; case 17: return S.ev.tourney18 !== null;
    case 18: return wanted >= 10; case 19: return S.ev.omen >= 2; case 20: return S.ev.rival23 !== null; case 21: return S.ev.act1done; case 22: return !!S.ev.branched && S.ev.branched !== 'choosing';
  }
  return false;
};
G.goalProg = function (i) { const S = G.S, w = Object.keys(S.bossesKilled).length;
  return { 10: [S.mer, 4], 11: [w, 5], 12: [S.mer, 8], 14: [S.visited.length, 10], 15: [S.mer, 12], 18: [w, 10], 19: [S.ev.omen, 2] }[i] || null; };
G.goalLines = function () {
  const S = G.S, cl = S.goals.claimed; let m = -1;
  for (let i = 0; i < D.GOALS.length; i++) if (cl.indexOf(i) < 0 && !D.GOALS[i][2]) { m = i; break; }
  if (m < 0) for (let i = 0; i < D.GOALS.length; i++) if (cl.indexOf(i) < 0) { m = i; break; }
  if (m < 0) return [];
  if (S.goals.mainIdx !== m) { S.goals.mainIdx = m; S.goals.mainSince = S.turn; S.todo = false; }
  // 사건형 목표는 순서상 주 목표가 되면(시점 도래) 앞에 표시
  const evNow = []; for (let i = 0; i < D.GOALS.length; i++) if (D.GOALS[i][2] && cl.indexOf(i) < 0 && (G.goalCond(i) || G.eventGoalDue(i))) evNow.push(i);
  const extra = Math.min(2, Math.floor((S.turn - S.goals.mainSince) / 3));
  const nx = []; for (let i = m + 1; i < D.GOALS.length && nx.length < extra; i++) if (cl.indexOf(i) < 0 && !D.GOALS[i][2]) nx.push(i);
  let lines = evNow.filter(i => i < m || G.goalCond(i)).concat([m]).concat(nx);
  if (m >= 0 && D.GOALS[m][2]) lines = [m].concat(evNow.filter(i => i !== m));
  return Array.from(new Set(lines)).slice(0, 4);
};
G.eventGoalDue = function (i) { const t = G.S.turn; return (i === 9 && t >= 5 && t <= 6) || (i === 17 && t >= 17 && t <= 18) || (i === 19 && t >= 20 && t <= 22) || (i === 20 && t === 23) || (i === 21 && t === 24) || (i === 22 && G.S.ev.branched === 'choosing'); };
G.claimable = function () { const S = G.S; const vis = G.goalLines(); const out = [];
  for (let i = 0; i < D.GOALS.length; i++) { if (S.goals.claimed.indexOf(i) >= 0 || !G.goalCond(i)) continue; if (vis.indexOf(i) >= 0 || D.GOALS[i][2]) out.push(i); }
  return out; };
G.claim = function () {
  const S = G.S; let any = false, txt = [];
  for (let guard = 0; guard < 30; guard++) { const c = G.claimable(); if (!c.length) break;
    for (const i of c) { S.goals.claimed.push(i); any = true; const rw = D.GOALS[i][1]; txt.push('✔ ' + D.GOALS[i][0] + G.giveText(rw)); G.give(rw); } }
  if (any) { G.toast(txt.join('\n')); G.after(); }
  return any;
};
G.give = function (rw) { const S = G.S; if (rw.mg && G.learnSkill) G.learnSkill(rw.mg, '사건'); if (rw.silver) S.silver += rw.silver; if (rw.fame) S.fame += rw.fame; if (rw.xp) S.xp += rw.xp; if (rw.item) S.items[rw.item] = (S.items[rw.item] || 0) + (rw.n || 1); if (rw.hyeop) G.hyeopUp(); };
G.giveText = function (rw) { const a = []; if (rw.silver) a.push('은자 ' + rw.silver); if (rw.fame) a.push('명성 ' + rw.fame); if (rw.xp) a.push('수련치 ' + rw.xp); if (rw.item) a.push(rw.item + ' ' + (rw.n || 1)); return a.length ? ' (' + a.join(', ') + ')' : ''; };
G.bfsFirstStep = function (pred) { const S = G.S; const prev = { [S.loc]: null }; let front = [S.loc];
  while (front.length) { const nf = []; for (const a of front.slice().sort()) for (const b of D.ADJ[a].slice().sort()) { if (b in prev || G.closed(b)) continue; prev[b] = a; nf.push(b); }
    const hits = nf.filter(pred).sort(); if (hits.length) { let g = hits[0], c = g; while (prev[c] !== S.loc) c = prev[c]; return { goal: g, step: c }; } front = nf; }
  return null; };
// [어디로?] 대상
G.unvisitedOk = function () { const S = G.S; return Object.keys(D.REGIONS).filter(id => S.visited.indexOf(id) < 0 && !G.closed(id) && G.risk(id) <= S.realm).sort(); };
G.whereTo = function () {
  const S = G.S; const out = new Set(); const adj = Object.keys(G.moveTargets());
  const lock = G.breakLock();
  if (lock && !G.tatongSpot(S.loc)) { for (const a of adj) if (G.tatongSpot(a)) out.add(a); if (out.size) return { ids: [...out], why: '타통하려면 객잔이나 산으로' }; }
  const m = S.goals.mainIdx;
  if (m === 14) { const un = adj.filter(a => S.visited.indexOf(a) < 0 && G.risk(a) <= S.realm); if (un.length) return { ids: un, why: '미방문: ' + un.map(G.rname).join('·') };
    const st = G.bfsFirstStep(id => S.visited.indexOf(id) < 0 && G.risk(id) <= S.realm); if (st) return { ids: [st.step], why: '미방문 ' + G.rname(st.goal) + '(으)로 가는 길' + (S.visited.length >= 8 ? ' (남은 곳: ' + G.unvisitedOk().map(G.rname).join('·') + ')' : '') }; }
  for (const a of adj) {
    if (S.visited.indexOf(a) < 0 && G.risk(a) <= S.realm + 1) out.add(a);
    if (G.bossAlive(a) && G.risk(a) <= S.realm) { const w = G.predict(G.bossOf(a), 'boss', a).w; if (w >= 0.6) out.add(a); }
  }
  // v0.5.2 ④: 이웃에 첫 처치 두목(쉬움·해볼 만함)이 없으면 가장 가까운 그런 지역으로 가는 첫 칸(BFS, 봉쇄 제외, 같은 거리면 id 순)
  const fk = id => !S.bossesKilled[id] && G.bossAlive(id) && !G.closed(id) && G.predict(G.bossOf(id), 'boss', id).w >= 0.6;
  if (!D.ADJ[S.loc].some(fk)) { const st = G.bfsFirstStep(fk); if (st) { out.clear(); out.add(st.step); return { ids: [st.step], why: '두목(' + G.rname(st.goal) + ')으로 가는 길' }; } }
  if (!out.size) for (const a of adj) if (G.risk(a) <= S.realm) out.add(a);
  return { ids: [...out], why: m >= 0 ? D.GOALS[m][0] : '' };
};
// ---------- 턴 종료 ----------
G.endTurn = function () {
  const S = G.S; if (S.ev.branched === 'choosing') return;
  G.mark(); S.todo = false;
  S.xp += 5 + S.ne / 10; // ①
  S.injured = false; // ②
  for (const q of S.quests) q.ttl--; S.quests = S.quests.filter(q => q.ttl > 0); // ③
  for (const b of S.bounties) b.ttl--; S.bounties = S.bounties.filter(b => b.ttl > 0);
  for (const id in S.dead) if (S.turn - S.dead[id] >= 6) { delete S.dead[id]; S.resp[id] = true; } // ④ 재등장
  for (const id in S.sweep) S.sweep[id] = Math.max(0, S.sweep[id] - 1);
  let rumor = G.pick(D.RUMORS);
  if (S.turn >= 4) { const r = G.hiddenAI(); if (r) rumor = r; } // ⑤
  S.rumor = rumor;
  const t = S.turn; // ⑦ 예정 사건
  if (t === 1) { S.items['금창약']++; G.push({ type: 'info', title: '인연 · 석두 구출', text: '산적에게 쫓기던 나무꾼 석두가 고개를 숙인다.\n"이 은혜는 꼭 갚겠소." — 금창약 1\n\n취팔 노개: "탐색과 객잔 의뢰가 열렸다. 약방도 들러 봐."' }); }
  if (t === 6) G.push({ type: 'tourney', t: 6 });
  if (t === 17) { S.ev.notice17 = true; G.push({ type: 'info', title: '대회 공고 · 윤서각의 전갈', text: '"내년 유월 하남, 무림대회에서 다시 보자. 이번엔 끝까지 간다." — 화산 윤서각' }); }
  if (t === 18) G.push({ type: 'tourney', t: 18 });
  if (t === 21) G.push({ type: 'omen', n: 1 });
  if (t === 22) G.push({ type: 'omen', n: 2 });
  if (t === 23) G.push({ type: 'rival23' });
  if (t === 24) { S.ev.act1done = true; }
  if (t >= 24 && !S.ev.branched && S.realm >= 4) G.push({ type: 'branch' }); // ⑧
  else if (t === 24 && S.realm < 4) G.push({ type: 'info', title: '1막 결산', text: '아직 절정에 이르지 못했다. 절정으로 돌파하는 달이 끝나면 길이 열린다.' });
  if (t === 30 && S.route === 3) G.push({ type: 'info', title: '1단계 프로토타입', text: '25~30턴 낭인 플레이까지가 1단계 범위입니다. 계속 진행할 수는 있지만 이후 콘텐츠는 2단계·2차에서 열립니다.' });
  S.turn++; S.acts = 3; S.cliff = false; S.merchant = null; S.board = null;
  G.turnStart();
  G.after(); G.save();
};
G.hiddenAI = function () { // 9-1 간이판 (화면에는 소문 1줄만)
  const S = G.S; const ids = Object.keys(D.REGIONS); let line = null;
  const pr = { '정파': 0.15, '사파': 0.30, '마교': S.turn >= 21 ? 0.4 : 0, '세외': 0.20 };
  for (let k = 0; k < 2; k++) {
    const a = G.pick(ids), [own, camp] = S.owners[a]; if (camp === '중립') continue; if (a === 'guizhou') continue;
    if (G.rand() > (pr[camp] || 0)) continue;
    const cands = D.ADJ[a].filter(b => b !== 'guizhou' && S.owners[b][1] !== camp && (S.owners[b][1] === '중립' ? true : camp !== '세외') && !(S.turn <= 20 && D.OWNER[b][0] === S.owners[b][0] && (D.OWNER[b][1] !== '중립' || b === 'jiangnan')));
    if (!cands.length) continue; const b = G.pick(cands);
    const taken = G.rand() < 0.5;
    S.aiLog.push({ turn: S.turn, a: own, b, prev: S.owners[b][0], taken });
    if (taken) S.owners[b] = [own, camp];
    S.chaos[b] = S.turn + 2; line = G.rname(b) + ' 쪽에서 큰 싸움이 났다더라.';
  }
  return line;
};
G.turnStart = function () {
  const S = G.S, t = S.turn; G.subStall();
  G.goalLines(); { const st = t - S.goals.mainSince; if (st >= 2 && st % 2 === 0 && S.turn <= 24 && !S.route) S.todo = true; } // v0.5.2 ③ 2턴 정체
  if (S.mer !== S.merPrev) { S.merPrev = S.mer; S.merChange = t; }
  if (t === 3 && !S.ev.rivalRumor) { S.ev.rivalRumor = true; G.push({ type: 'info', title: '강호 소문', text: '"화산의 대제자가 검 한 자루 낭인을 찾는다더군." — 취팔 노개' }); }
  if (t === 12 && !S.letter) { S.letter = 'open'; if (S.dead.guizhou !== undefined) { delete S.dead.guizhou; S.resp.guizhou = true; }
    G.push({ type: 'info', title: '석두의 편지', text: '"산채가 다시 생겼소." 귀주로 가서 두목을 쓰러뜨리면 수련치 +150.' }); }
  if (t === 16 && !S.yeonhwaHerb && S.yeonhwaMet !== 'herb') { S.yeonhwaHerb = true; S.yeonhwaMet = 'herb'; G.push({ type: 'info', title: '소연화의 약재', text: '"막힌 혈에 좋다더군요." 다음 타통 수련치 +30%' }); }
  // 노개의 가르침
  if (!S.gaeTeach && S.turn <= 24 && S.mer < G.gateMer() && t - S.merChange >= 4 && t >= 4) { S.gaeTeach = true; S.freeTat = true;
    G.push({ type: 'info', title: '노개의 가르침', text: '"막힌 혈은 혼자 뚫는 게 아니야." 다음 타통 무료 + 운기행공 자동 완벽.' }); }
  if (S.realm === 4 && S.mer >= 12 && !S.imdok && S.xp >= 2000 && S.turn >= 16) { S.saengWait++; if (S.saengWait >= 3 && !S.gaeTeach2) { S.gaeTeach2 = true; G.push({ type: 'info', title: '노개의 가르침', text: '"생사현관은 객잔이나 산에서 앉아야 넘는다." [어디로?]를 눌러 봐라.' }); } }
  // 타통 안내 팝업
  if (S.turn <= 24 && G.tatongGlow()) G.push({ type: 'tatongHint' });
  if (S.route === 3) G.refreshBounty();
};
G.refreshBounty = function () { const S = G.S; const ks = Object.keys(S.resp).filter(id => G.bossAlive(id) && !S.bounties.some(b => b.tgt === id));
  S.bountyOffer = ks.slice(0, 3).map(id => ({ tgt: id, ttl: 4 })); };
// ---------- 사건 결과 ----------
G.tourneyResult = function (t, res) {
  const S = G.S; let fame = { 0: 10, 1: 30, 2: 60, 3: 150 }[res], silver = { 0: 0, 1: 50, 2: 150, 3: 300 }[res];
  if (G.hasTitle('화산의 벽')) fame = Math.round(fame * 1.2);
  S.fame += fame; S.silver += silver; if (res === 3) { G.addTitle('군웅제일'); S.fame += 50; }
  S.ev['tourney' + t] = res; G.after();
  return { fame, silver };
};
G.omenText = n => n === 1 ? ['정마 전조 · 피의 장강', '장강 나루에서 정파 표사들이 몰살당했다. 시신마다 붉은 손바닥 자국.'] : ['정마 전조 · 무림맹 긴급 소집', '무림맹 총단에 구파일방 장문인들이 모였다. 30년 휴전이 끝나 간다.'];
G.omen = function (n) { const S = G.S; S.ev.omen = Math.max(S.ev.omen, n); G.after(); };
G.rivalResult = function (accepted, win) { const S = G.S; S.ev.rival23 = accepted ? (win ? 'win' : 'lose') : 'decline'; if (win) { G.addTitle('화산의 벽'); S.fame += 30; } G.after(); };
G.settlement = function () {
  const S = G.S; const p = Math.round(G.pres() * 0.3), r = S.realm * 150, ti = S.titles.length * 50;
  const tb = res => res === 3 ? 300 : res === 2 ? 150 : res === 1 ? 100 : 0;
  const to = tb(S.ev.tourney6 || 0) + tb(S.ev.tourney18 || 0), wa = Object.keys(S.bossesKilled).length * 20, rv = S.ev.rival23 === 'win' ? 100 : 0;
  const tot = p + r + ti + to + wa + rv; const grade = tot >= 2000 ? '천하의 기재' : tot >= 1300 ? '강호의 신성' : '떠오르는 무인';
  S.settle = { p, r, ti, to, wa, rv, tot, grade }; return S.settle;
};
// 분기 뒤에도 채운 1막 목표 보상은 자동 지급(받을 곳이 사라지지 않게)
G.grantRemaining = function () { const S = G.S; const t = [];
  for (let i = 0; i < D.GOALS.length; i++) if (S.goals.claimed.indexOf(i) < 0 && G.goalCond(i)) { S.goals.claimed.push(i); G.give(D.GOALS[i][1]); t.push('✔ ' + D.GOALS[i][0] + G.giveText(D.GOALS[i][1])); }
  t.forEach(x => G.toast(x)); };
G.chooseRoute = function (n) {
  const S = G.S; if (n !== 3) return false;
  S.route = 3; S.ev.branched = 'ronin'; G.grantRemaining();
  S.route = 3; S.ev.branched = 'ronin'; S.tut.path = { route: 3, step: 0, skipped: false };
  // 수배첩 두목 중 3명을 재등장(현상금)
  const killed = Object.keys(S.bossesKilled);
  if (!killed.length) killed.push('guizhou');
  for (const id of killed.slice(0, 3)) { delete S.dead[id]; S.resp[id] = true; }
  // 현재 지역 두목이 수배첩에 있으면 우선
  G.refreshBounty();
  if (S.bountyOffer.length === 0) { delete S.dead[S.loc]; S.resp[S.loc] = true; G.refreshBounty(); }
  G.after(); return true;
};
G.pathTutCheck = function () {
  const S = G.S, P = S.tut.path; if (!P || P.skipped || P.step >= 5) return;
  const c = [() => P.r1, () => S.bountyDone >= 1, () => S.r3pair || S.bountyDone >= 2, () => S.escortDone >= 1, () => S.myPathSeen][P.step];
  if (c && c()) { const rw = D.RTUT[P.step].rw; G.give(rw); G.toast('✔ ' + D.RTUT[P.step].goal + G.giveText(rw)); P.step++; G.pathTutCheck(); }
};
G.skipPathTut = function () { const S = G.S, P = S.tut.path; if (!P) return; for (let i = P.step; i < 5; i++) G.give(D.RTUT[i].rw); P.skipped = true; P.step = 5; G.toast('낭인 튜토리얼 건너뛰기: 남은 보상 일괄 지급'); G.after(); };
// ---------- 튜토리얼 ----------
// ---------- 중간 목표 (2-24-1) ----------
G.SUBG_STALL = 3;
G.subMetric = function (k) { const S = G.S;
  if (k === 'mer') return S.mer < 12 && S.realm >= 2 ? [S.mer, Math.min(12, S.mer + 2)] : null;
  if (k === 'risk4') return S.realm >= 4 ? [S.cnt.r4, null] : null;
  if (k === 'any') return [S.cnt.win + S.cnt.train + (S.tatongs || 0) + (S.imdok ? 1 : 0), null];
  return null; }; // move·learn·set_nok·set_other·sin·adv: 무공 체계(1a) 전에는 채울 수 없음 → 건너뜀
G.subNeed = (k, b) => (k === 'mer' ? b[1] : b[0] + (k === 'set_nok' ? 2 : 1));
G.subRow = id => D.SUBG.find(x => x[0] === id);
G.subActive = () => { const S = G.S; return !S.route && S.turn >= 4 && S.turn <= 24; };
G.subPick = function () { const S = G.S, sg = S.sub, t = S.turn;
  for (const x of D.SUBG) if (x[0] !== 'SG00' && x[1] <= t && t <= x[2] && sg.done.indexOf(x[0]) < 0 && sg.q.indexOf(x[0]) < 0) sg.q.push(x[0]);
  sg.q = sg.q.filter(i => { const x = G.subRow(i); return x[1] <= t && t <= x[2]; });
  while (sg.q.length) { const i = sg.q.shift(), x = G.subRow(i), b = G.subMetric(x[3]); if (!b) continue; sg.cur = i; sg.base = G.subNeed(x[3], b); return; }
  sg.cur = null; };
G.subVal = function () { const S = G.S, sg = S.sub; if (!sg.cur) return null; const b = G.subMetric(G.subRow(sg.cur)[3]); return b ? b[0] : null; };
G.subNoteReward = function () { const S = G.S; if (S.sub) S.sub.last = S.turn; };
// 목표(주·사건·성장) 완료 감지: 채워진 목표 수가 늘면 보상 시점으로 친다
G.subGoalsWatch = function () { const S = G.S; let n = 0; for (let i = 0; i < D.GOALS.length; i++) if (S.goals.claimed.indexOf(i) >= 0 || G.goalCond(i)) n++;
  if (n > (S.sub.goalsSeen || 0)) { S.sub.goalsSeen = n; S.sub.last = S.turn; } };
G.subTick = function () { const S = G.S; if (!S || !S.sub) return; G.subGoalsWatch(); if (!G.subActive()) return; const sg = S.sub;
  if (!sg.cur) G.subPick(); if (!sg.cur) return;
  const v = G.subVal(); if (v === null) { sg.cur = null; G.subPick(); return; }
  if (v >= sg.base && sg.gotTurn !== S.turn) { // 한 턴에 1개까지
    const x = G.subRow(sg.cur), rw = x[5]; if (rw.xp) S.xp += rw.xp; if (rw.silver) { S.silver += rw.silver; sg.silver += rw.silver; }
    if (x[0] !== 'SG00') sg.done.push(x[0]); sg.n++; sg.gotTurn = S.turn; sg.last = S.turn; (sg.log = sg.log || []).push([S.turn, x[0]]);
    G.toast('✔ 중간 목표 — ' + (rw.xp ? '수련치 +' + rw.xp : '') + (rw.silver ? '은자 +' + rw.silver : '') + (rw.mgx ? '성 경험 +' + rw.mgx : ''));
    sg.cur = null; G.subPick(); } };
G.subStall = function () { const S = G.S; if (!S.sub || !G.subActive()) return; const sg = S.sub; G.subGoalsWatch();
  if (sg.last === 0) sg.last = Math.max(sg.last, 3); // 4턴 시작 기준
  if (sg.cur !== 'SG00' && S.turn - sg.last >= G.SUBG_STALL) { if (sg.cur) sg.q.push(sg.cur); sg.cur = 'SG00'; sg.base = G.subMetric('any')[0] + 1; }
  G.subTick(); };
G.subText = function () { const S = G.S, sg = S.sub; if (!sg || !sg.cur || !G.subActive()) return null; const x = G.subRow(sg.cur), b = G.subMetric(x[3]);
  const t = x[4].replace('{need}', sg.base); const rw = x[5];
  let prog = ''; if (b) { const from = x[3] === 'mer' ? b[0] : b[0] - (sg.base - (x[3] === 'set_nok' ? 2 : 1)); prog = x[3] === 'mer' ? '' : ' (' + Math.max(0, from) + '/' + (x[3] === 'set_nok' ? 2 : 1) + ')'; }
  return { t: t + prog, rw: rw.xp ? '수련치 +' + rw.xp : rw.silver ? '은자 +' + rw.silver : '성 경험 +' + rw.mgx }; };
// ---------- 튜토리얼 ----------
// 2-24-2: 관련 UI를 열거나 쓰면 즉시 넘어간다. T3은 그 두목전 첫 기세 뒤, T10은 출관 화면 1번(t10Done)
G.tutUse = function (id) { const S = G.S; if (!S || !S.tut || !S.tut.personal) return; const pt = S.tut.personal; pt.used = pt.used || {};
  const i = D.TUT.findIndex(x => x.id === id); if (i < 0 || i >= 9) return; if (S.turn < G.tutUnlock(i)) return; pt.used[i] = 1; };
G.tutCond = function (i) {
  const S = G.S, pt = S.tut.personal;
  // 실제 행동으로도 넘어간다(경맥 화면을 안 봐도 타통·일류면 T6 완료)
  return [() => S.kills >= 1, () => S.realm >= 2, () => !!S.bossesKilled.guizhou, () => (S.explores || 0) >= 1, () => (S.questsDone || 0) >= 1,
    () => pt.seen.meridian || (S.tatongs || 0) >= 1 || S.realm >= 3, () => (S.tatongs || 0) >= 1 && S.realm >= 3, () => S.visited.length >= 2, () => pt.seen.wanted || Object.keys(S.bossesKilled).length >= 2, () => S.off.chosen][i]();
};
G.tutUnlock = i => [1, 1, 1, 2, 2, 2, 3, 4, 4, 1][i];
// 고착 방지: ① 조건을 채운 단계는 순서와 상관없이 완료 ② 해금 뒤 3턴이 지나면 그 단계는 자동으로 넘어감
G.TUT_STALL = 3;
G.tutCurrent = function () { const S = G.S, pt = S.tut.personal; if (pt.skipped) return null;
  pt.done = pt.done || {}; pt.shown = pt.shown || {};
  pt.used = pt.used || {};
  for (let i = 0; i < 9; i++) if (!pt.done[i] && (G.tutCond(i) || pt.used[i])) pt.done[i] = pt.used[i] && !G.tutCond(i) ? 'used' : 1;
  for (let i = 0; i < 9; i++) { if (pt.done[i]) continue; if (S.turn < G.tutUnlock(i)) return null;
    if (i === 5 && !(S.xp >= 300 || S.turn >= 3)) return null; // 경맥은 막혔을 때
    if (pt.shown[i] === undefined) pt.shown[i] = S.turn;
    if (S.turn - pt.shown[i] >= G.TUT_STALL) { pt.done[i] = 'timeout'; continue; }
    pt.step = i; return D.TUT[i]; }
  pt.step = 9; return null; };
G.skipTutorial = function (silent) { const S = G.S, pt = S.tut.personal; pt.skipped = true;
  if (!pt.t10) { pt.t10 = true; S.items['금창약']++; } if (!silent) G.toast('튜토리얼 건너뛰기: 남은 보상 일괄 지급(목표 바 보상은 목표 바에서). 금창약 +1'); G.save(); };
G.t10Done = function () { const S = G.S, pt = S.tut.personal; if (!pt.t10) { pt.t10 = true; S.items['금창약']++; G.toast('튜토리얼 T10 완료: 금창약 +1'); } };
// 공통 사후 처리
G.after = function () { const S = G.S; G.subTick(); if (S.route) G.grantRemaining(); G.pathTutCheck(); G.save(); };

// ---------- 실시간 폐관 (2-23, F14) ----------
G.E0 = h => Math.min(h, 2) + 0.7 * Math.max(0, Math.min(h, 6) - 2) + 0.4 * Math.max(0, Math.min(h, 10) - 6);
G.OFF_RATE = { ne: 0.42, mu: 0.28, gy: 0.21 };
G.OFF_NAME = { ne: '내공(심법)', mu: '외공(초식)', gy: '경공(신법)' };
// 앱을 다시 열었을 때(또는 10분+ 백그라운드 복귀) 호출. 결과 객체 반환.
G.processOffline = function () {
  const S = G.S, O = S.off, now = G.clock();
  const res = { now, type: O.type, pendingTat: O.pendingTat };
  O.pendingTat = null; O.resting = false;
  if (now < O.maxSeen - 5000 || O.lastSeen > now + 5000) { // 시계 되돌림 / 미래 저장 시각
    res.rollback = true; res.future = O.lastSeen > now + 5000; O.lastSeen = now; O.maxSeen = now; O.bucketTs = now; O.sessH = 0; O.sessE = 0; O.acted = true; G.save(); return res;
  }
  const h = Math.max(0, (now - O.lastSeen) / 3600000); res.h = h;
  // 그릇: 실제 경과(접속 중 포함) 만큼 채움
  G.fillBucket(); // v0.5.2 ⑥: 마지막으로 그릇을 계산한 시각부터 지금까지
  if (O.acted) { O.sessH = 0; O.sessE = 0; }
  const prevH = Math.min(10, O.sessH), totH = Math.min(10, O.sessH + h);
  const incE0 = G.E0(totH) - G.E0(prevH); const E = Math.min(incE0, O.bucket); O.bucket -= E;
  res.prevH = prevH; res.totH = O.sessH + h; res.capped = O.sessH + h > 10; res.E0 = incE0; res.E = E; res.bucketAfter = O.bucket;
  res.seg = [Math.max(0, Math.min(totH, 2) - Math.min(prevH, 2)), Math.max(0, Math.min(totH, 6) - Math.max(2, Math.min(prevH, 6))) * (totH > 2 ? 1 : 0), Math.max(0, Math.min(totH, 10) - Math.max(6, prevH)) * (totH > 6 ? 1 : 0)];
  O.sessH += h; O.sessE += E; O.acted = false;
  const q = G.trainAmt(true) / (G.kind(S.loc) === '산' ? 1 : 1);
  const qq = (20 + S.ne / 2) * 1.8; // 지역 보정 없음, 별호 없음
  const gain = G.OFF_RATE[O.type] * qq * E; const need = G.needXp();
  const room = Math.max(0, need - 1 - S.xp); const put = Math.min(gain, room); S.xp += put;
  const r0 = O.reserve; O.reserve = Math.min(O.reserve + gain - put, 0.5 * need);
  res.gain = gain; res.put = put; res.reserveAdd = O.reserve - r0; res.waste = gain - put - (O.reserve - r0);
  // 숙련
  O.suk[O.type] += E; res.suk = [];
  while (O.suk[O.type] >= 6.4) { O.suk[O.type] -= 6.4;
    if (O.type === 'ne') { if (O.sukNe < 10) { O.sukNe++; S.ne++; res.suk.push('내공 +1'); } }
    else if (O.type === 'mu') { if (O.sukMu < 10) { O.sukMu++; S.mu++; res.suk.push('무력 +1'); } }
    else { if (O.steps < 2) { O.steps++; res.suk.push("'날랜 걸음' 1개"); } } }
  G.capStats(); res.sukProg = O.suk[O.type] / 6.4;
  if (O.sessE >= 2 && now - O.lastWarm >= 20 * 3600000 && !S.warm) { S.warm = true; O.lastWarm = now; res.warm = true; }
  else if (O.sessE >= 2 && now - O.lastWarm < 20 * 3600000) res.warmWait = true;
  if (h >= 1 / 6) { S.injured = false; }
  O.lastSeen = now; O.maxSeen = Math.max(O.maxSeen, now);
  if (h >= 1 / 6 && !O.firstOut) { O.firstOut = true; res.firstOut = true; }
  G.save(); return res;
};
G.startRest = function (type, withTat) {
  const S = G.S, O = S.off; O.type = type; O.chosen = true; let tat = null;
  if (withTat && !G.tatongBlock()) { tat = G.doTatong(false); if (tat) { S.lastTat = S.turn; G.endTurnSilent(); } }
  O.pendingTat = tat; O.resting = true; O.lastSeen = G.clock(); O.maxSeen = Math.max(O.maxSeen, O.lastSeen); O.acted = true; // 새 회차
  O.sessH = 0; O.sessE = 0; O.actedAfterRest = false;
  G.save(); return tat;
};
G.endTurnSilent = function () { G.endTurn(); };
G.nowTodo = function () {
  const S = G.S; if (S.warm) return S.turn < 3 ? '온양 상태(3턴부터 타통 무료).' : '온양 상태다. 이번 달 타통은 무료.';
  if (S.turn >= 3 && G.breakLock() && G.tatongCost() > S.silver) return '타통 은자가 모자란다(' + G.tatongCost() + '). 두목·의뢰로 은자를 벌자.';
  const lk = G.breakLock(); if (lk) return G.tatongSpot(S.loc) ? '경맥이 막혔다. 이번 달은 타통하라.' : '타통하려면 객잔이나 산으로.';
  if (G.canBreak()) return '돌파할 수 있다!';
  const m = S.goals.mainIdx; return m >= 0 && D.GOALS[m] ? '목표: ' + D.GOALS[m][0] : '강호로 나가자.';
};
if (typeof module !== 'undefined') module.exports = G; else root.G = G;
})(typeof window !== 'undefined' ? window : globalThis);
