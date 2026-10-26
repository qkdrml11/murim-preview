// §5-8 일기토 — 수읽기. 화면과 분리된 순수 규칙 엔진(노드 테스트 가능).
import { ARTS, BASIC, SIMBEOP } from '../data/mugong.js';
import { makeRng } from '../core/rng.js';

export const BEATS = { atk: 'evade', evade: 'def', def: 'atk' }; // 공>변, 변>수, 수>공
export const MAX_ROUNDS = 10, GAUGE = 5, TIMER_MS = 4000;
const masteryMul = sung => 1 + 0.11 * (Math.max(1, Math.min(10, sung)) - 1);

export function buildFighter(src, side) {
  const moves = [];
  for (const [artId, sung] of Object.entries(src.arts || {})) {
    const art = ARTS[artId]; if (!art) continue;
    for (const m of art.moves) if (sung >= m.unlock) moves.push({ ...m, art: artId, mul: masteryMul(sung) });
  }
  return {
    side, id: src.id || src.name, name: src.name, byeolho: src.byeolho || '', label: src.label || src.name,
    realm: src.realm, nMax: 3 + Math.floor((src.meridians || 0) / 2), simbeop: src.simbeop || '하승',
    sinbeop: !!src.sinbeop, oseongHigh: (src.talent?.oseong ?? 1) >= 2, style: src.style || 'jeongpa',
    fake: src.fake ?? 0.3, habit: src.habit || 'none', moves, isMaster: src.role === 'master',
  };
}
const realmFactor = d => d >= 1 ? 1.25 : d <= -1 ? 0.8 : 1; // 한 단계 위 ×1.25, 아래 ×0.8

export function createDuel(A, B, opts = {}) {
  const rng = opts.rng || makeRng(opts.seed ?? 1);
  const d = { A, B, rng, hp: { A: 1, B: 1 }, n: { A: 0, B: 0 }, round: 0, g: 0, seal: { A: 0, B: 0 }, over: { A: false, B: false },
    bigPending: false, unggiUsed: false, log: [], done: null, hand: null, enemy: null, hint: null, hintFake: false };
  const gap = A.realm - B.realm;
  if (Math.abs(gap) >= 2) d.done = { win: gap > 0, auto: true, reason: '경지가 두 단계 넘게 달라 겨루지 않고 판정했어요.' };
  return d;
}
function drawHand(d, f, sealN) {
  const rng = d.rng;
  const basics = Object.values(BASIC);
  const hand = [{ ...rng.pick(basics), mul: 1 }];
  const pool = [...f.moves];
  for (let i = 0; i < 2 && pool.length; i++) hand.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0]);
  while (hand.length < 3) { const b = basics.find(x => !hand.some(h => h.id === x.id)); hand.push({ ...b, mul: 1 }); }
  for (let i = 0; i < sealN; i++) { const c = hand.filter(h => !h.basic && !h.sealed); if (c.length) c[Math.floor(rng.next() * c.length)].sealed = true; }
  return hand;
}
function enemyPick(d) {
  const B = d.B, rng = d.rng;
  if (d.hp.B < 0.3 && !d.unggiUsed && rng.chance(0.6)) { d.unggiUsed = true; return { id: 'unggi', name: '운기조식', hanja: '調息', type: 'none', power: 0, cost: 0 }; }
  if (d.bigPending) { d.bigPending = false; const big = B.moves.find(m => m.big && m.cost <= d.n.B); if (big) return big; }
  const hand = drawHand(d, B, d.seal.B).filter(c => !c.sealed && c.cost <= d.n.B && !c.big);
  const w = { sapa: { atk: 5, def: 2.5, evade: 2.5 }, jeongpa: { atk: 3, def: 3.5, evade: 3.5 }, ronin: { atk: 1, def: 1, evade: 1 } }[B.style] || { atk: 1, def: 1, evade: 1 };
  const hw = { atk: { atk: 3 }, def: { def: 3 }, evade: { evade: 3 } }[B.habit] || {};
  return rng.weighted(hand.map(c => [c, (w[c.type] || 1) * (hw[c.type] || 1) * (c.basic ? 0.7 : 1)]));
}
export function hintAccuracy(d) { return Math.min(0.95, 1 - d.B.fake + (d.A.oseongHigh ? 0.1 : 0)); }

export function startRound(d) {
  if (d.done) return null;
  d.round++;
  for (const s of ['A', 'B']) { const f = d[s], sb = SIMBEOP[f.simbeop] || SIMBEOP['하승']; d.n[s] = Math.min(f.nMax, d.n[s] + (d.round === 1 ? sb.first : sb.regen)); }
  d.hand = drawHand(d, d.A, d.seal.A); d.seal.A = 0;
  const bigTelegraphed = d.bigPending;
  d.enemy = enemyPick(d); d.seal.B = 0;
  if (d.enemy.type === 'none') { d.hint = 'breath'; d.hintFake = false; }
  else if (d.enemy.big) { d.hint = 'atk'; d.hintFake = false; }
  else if (d.rng.chance(hintAccuracy(d))) { d.hint = d.enemy.type; d.hintFake = false; }
  else { const o = ['atk', 'def', 'evade'].filter(t => t !== d.enemy.type); d.hint = d.rng.pick(o); d.hintFake = true; }
  return { round: d.round, hand: d.hand, hint: d.hint, big: !!d.enemy.big, bigTelegraphed, n: { ...d.n } };
}
export function canPlay(d, card) { return !card.sealed && card.cost <= d.n.A; }
const eff = (d, atk, def, card, circle) => card.power / 100 * (card.mul || 1) * realmFactor(d[atk].realm - d[def].realm) * (circle ? 1.2 : 1);

export function resolve(d, idx, circle = false) {
  let my = d.hand[idx];
  if (idx == null || !my || !canPlay(d, my)) my = { ...BASIC.makgi, mul: 1 }; // 4초를 넘기면 기본 '막기'
  const en = d.enemy;
  d.n.A -= my.cost; d.n.B = Math.max(0, d.n.B - (en.cost || 0));
  const inMul = { A: d.over.B ? 1.5 : 1, B: d.over.A ? 1.5 : 1 };
  d.over.A = d.over.B = false;
  const r = { round: d.round, my, en, circle: circle && !!my.big, dmg: { A: 0, B: 0 }, winner: null, reason: '', fooled: d.hintFake, gBefore: d.g, sealed: null, overwhelm: null, telegraph: false };
  const TN = { atk: '공', def: '수', evade: '변' };
  if (en.type === 'none') {
    d.n.B += 3;
    if (my.type === 'def') r.reason = '상대가 운기조식 — 막기만 해서 놓쳤어요';
    else { r.dmg.B = eff(d, 'A', 'B', my, r.circle) * 1.5 * inMul.B; r.winner = 'A'; r.reason = '운기조식 중에 적중 → 피해 ×1.5'; }
  } else if (my.type === en.type) {
    const pa = eff(d, 'A', 'B', my, r.circle), pb = eff(d, 'B', 'A', en, false);
    if (Math.abs(pa - pb) < 1e-9) r.reason = `같은 ${TN[my.type]}끼리 — 위력이 같아 비겼어요`;
    else if (pa > pb) { r.dmg.B = (pa - pb) * inMul.B; r.reason = `같은 ${TN[my.type]}끼리 — 내 위력이 높아 차이만큼 피해`; }
    else { r.dmg.A = (pb - pa) * inMul.A; r.reason = `같은 ${TN[my.type]}끼리 — 상대 위력이 높아 차이만큼 피해`; }
  } else {
    const aWins = BEATS[my.type] === en.type;
    const W = aWins ? 'A' : 'B', L = aWins ? 'B' : 'A', wc = aWins ? my : en, lc = aWins ? en : my;
    r.winner = W;
    const p = eff(d, W, L, wc, aWins && r.circle);
    const sin = (lc.type === 'evade' && d[L].sinbeop) ? 0.7 : 1;
    if (wc.type === 'atk') { r.dmg[L] = p * inMul[L] * sin; r.reason = `공이 변을 이김 → 위력만큼 피해${sin < 1 ? ' (신법으로 −30%)' : ''}`; }
    else if (wc.type === 'evade') { r.dmg[L] = p * 0.5 * inMul[L]; d.seal[L] = 1; r.sealed = L; r.reason = '변이 수를 이김 → 피해 50% + 다음 합 상대 카드 1장 봉인'; }
    else { r.dmg[L] = 0.05 * inMul[L]; d.g += aWins ? 1 : -1; r.reason = '수가 공을 막음 → 피해 0, 반격 5% + 기세 1칸 더'; }
  }
  if (r.winner === 'A') d.g += 1; else if (r.winner === 'B') d.g -= 1;
  d.hp.A = Math.max(0, d.hp.A - r.dmg.A); d.hp.B = Math.max(0, d.hp.B - r.dmg.B);
  if (d.g >= GAUGE) { d.over.A = true; d.seal.B = Math.max(d.seal.B, 1); r.overwhelm = 'A'; d.g = 0; r.reason += ' · 기세 압도!'; }
  if (d.g <= -GAUGE) { d.over.B = true; d.seal.A = Math.max(d.seal.A, 1); r.overwhelm = 'B'; d.g = 0; r.reason += ' · 상대 기세 압도!'; }
  if (d.g <= -4 && !d.bigPending && d.B.moves.some(m => m.big)) { d.bigPending = true; r.telegraph = true; }
  r.gAfter = d.g; r.hp = { ...d.hp }; r.n = { ...d.n };
  d.log.push(r);
  if (d.hp.A <= 0 || d.hp.B <= 0 || d.round >= MAX_ROUNDS) d.done = { win: d.hp.B <= 0 ? true : d.hp.A <= 0 ? false : d.hp.A >= d.hp.B, rounds: d.round };
  return r;
}
// '보통 실력' 자동: 힌트를 그대로 믿고 큰 초식 원은 안 눌러요(§5-8 ⑥).
export function autoChoose(d) {
  const ok = d.hand.map((c, i) => [c, i]).filter(([c]) => canPlay(d, c));
  if (d.hint === 'breath') { const atk = ok.filter(([c]) => c.type !== 'def').sort((a, b) => b[0].power - a[0].power); return atk.length ? atk[0][1] : ok[0]?.[1] ?? 0; }
  const want = Object.keys(BEATS).find(t => BEATS[t] === d.hint);
  const beat = ok.filter(([c]) => c.type === want).sort((a, b) => b[0].power - a[0].power);
  if (beat.length) return beat[0][1];
  const same = ok.filter(([c]) => c.type === d.hint).sort((a, b) => b[0].power - a[0].power);
  return (same[0] || ok[0] || [null, 0])[1];
}
export function runAuto(d) {
  while (!d.done) { startRound(d); resolve(d, autoChoose(d), false); }
  return d.done;
}
export function highlights(log) {
  if (!log.length) return [];
  const big = log.reduce((a, b) => (Math.max(b.dmg.A, b.dmg.B) > Math.max(a.dmg.A, a.dmg.B) ? b : a));
  const flip = log.find(r => Math.sign(r.gBefore) !== Math.sign(r.gAfter) && r.gBefore !== 0) || log[Math.floor(log.length / 2)];
  const last = log[log.length - 1];
  const out = []; for (const r of [big, flip, last]) if (r && !out.includes(r)) out.push(r);
  return out.sort((a, b) => a.round - b.round);
}
export function estimate(Asrc, Bsrc, n = 240, seed = 7) {
  const A = buildFighter(Asrc, 'A'), B = buildFighter(Bsrc, 'B');
  if (Math.abs(A.realm - B.realm) >= 2) return A.realm > B.realm ? 1 : 0;
  let w = 0;
  for (let i = 0; i < n; i++) { const d = createDuel(A, B, { seed: seed * 7919 + i }); if (runAuto(d).win) w++; }
  return w / n;
}
export function rateLabel(p) { return p >= 0.75 ? '쉬움' : p >= 0.5 ? '해볼 만함' : p >= 0.25 ? '위험' : '무모'; }
// 자동 결과 = 예상 승률 − 5%p(§5-8 ⑥). 하이라이트는 같은 결과가 나온 자동 판에서 뽑아요.
export function resolveAuto(Asrc, Bsrc, rng, expected) {
  const p = Math.max(0, (expected ?? estimate(Asrc, Bsrc)) - 0.05);
  const win = rng.next() < p;
  const A = buildFighter(Asrc, 'A'), B = buildFighter(Bsrc, 'B');
  let d;
  for (let k = 0; k < 60; k++) { d = createDuel(A, B, { seed: Math.floor(rng.next() * 1e9) }); runAuto(d); if (d.done.win === win) break; }
  return { win, p, log: d.log, highlights: highlights(d.log), duel: d };
}
