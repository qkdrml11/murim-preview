// 노드 규칙 테스트: 시간 · 살림 · 세력 · 일기토 · 자동 해금 · 낭인(v7.3) · 식객/남는 낭인(v7.4)
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, UNLOCK_TEXT } from '../js/game.js';
import { calendar, SEC_PER_MONTH } from '../js/systems/time.js';
import { colorOf, addInf } from '../js/systems/influence.js';
import { livingCost, monthLedger } from '../js/systems/economy.js';
import { buildFighter, createDuel, startRound, resolve, estimate, resolveAuto, GAUGE } from '../js/systems/duel.js';
import { RONIN } from '../js/data/people.js';
import { makeRng } from '../js/core/rng.js';

const fresh = (o = {}) => { const g = createGame({ headless: true, seed: 5, ...o }); g.endIntro(); return g; };

test('시간: 1달 = 120초(1배), 강호력 1년 봄 3월 시작', () => {
  assert.equal(SEC_PER_MONTH, 120);
  assert.equal(calendar(1).text, '강호력 1년 봄 3월');
  assert.equal(calendar(11).text, '강호력 2년 겨울 1월');
  const g = fresh(); g.setSpeed(1);
  for (let i = 0; i < 119; i++) g.tick(1);
  assert.equal(g.state.month, 1);
  g.tick(1.01); assert.equal(g.state.month, 2);
  g.setSpeed(4); g.tick(30.01); assert.equal(g.state.month, 3);
  g.setSpeed(0); g.tick(999); assert.equal(g.state.month, 3);
});
test('살림: 첫해 생활비 절반(27), §9 첫 달 끝 은자 178', () => {
  const g = fresh(); const s = g.state;
  assert.equal(Math.round(s.people.reduce((a, p) => a + livingCost(s, p, 1), 0)), 27);
  assert.equal(Math.round(s.people.reduce((a, p) => a + livingCost(s, p, 13), 0)), 54);
  g.assign('openJumak', ['p2'], '청석'); g.assign('stay', ['p3'], '청석'); g.assign('request', ['p4'], '청석', { label: '우물 의뢰' }); g.assign('train', ['p1'], 'p1');
  g.advanceMonths(1);
  assert.equal(s.silver, 178);
});
test('세력: 1위·30 이상·10 앞서야 색, 본산 하한 50, 성지 55 상한', () => {
  assert.equal(colorOf({ inf: { cw: 30, hd: 20 } }).owner, 'cw');
  assert.equal(colorOf({ inf: { cw: 29, hd: 10 } }).owner, null);
  assert.equal(colorOf({ inf: { cw: 35, hd: 28 } }).contested, true);
  const home = { size: 'small', home: true, inf: { cw: 52 } }; addInf(home, 'cw', -20, { raw: true }); assert.equal(home.inf.cw, 50);
  const holy = { size: 'large', holy: 'sl', inf: { cw: 50, sl: 60 } }; addInf(holy, 'cw', 20); assert.equal(holy.inf.cw, 55);
  addInf(holy, 'sl', -30); assert.equal(holy.inf.sl, 60);
  const small = { size: 'small', inf: {} }; addInf(small, 'cw', 3); assert.equal(small.inf.cw, 4); // ×1.5 끝수 버림
});
const F = (realm, extra = {}) => ({ name: 'x', realm, meridians: 6, arts: { chungun: 7 }, simbeop: '상승', ...extra });
test('일기토: 공>변, 변>수(50%+봉인), 수>공(0+반격 5%+기세 2)', () => {
  const d = createDuel(buildFighter(F(3)), buildFighter(F(3, { fake: 0 })), { seed: 1 }); startRound(d);
  d.hand = [{ id: 'a', name: 'a', type: 'atk', power: 20, cost: 0 }, { id: 'b', name: 'b', type: 'evade', power: 20, cost: 0 }, { id: 'c', name: 'c', type: 'def', power: 20, cost: 0 }];
  d.enemy = { name: 'e', type: 'evade', power: 10, cost: 0 }; let r = resolve(d, 0); assert.equal(r.winner, 'A'); assert.ok(Math.abs(r.dmg.B - 0.2) < 1e-9);
  startRound(d); d.hand = [{ id: 'b', name: 'b', type: 'evade', power: 20, cost: 0 }]; d.enemy = { name: 'e', type: 'def', power: 10, cost: 0 }; r = resolve(d, 0);
  assert.ok(Math.abs(r.dmg.B - 0.1) < 1e-9); assert.equal(r.sealed, 'B');
  startRound(d); const g0 = d.g; d.hand = [{ id: 'c', name: 'c', type: 'def', power: 20, cost: 0 }]; d.enemy = { name: 'e', type: 'atk', power: 30, cost: 0 }; r = resolve(d, 0);
  assert.ok(Math.abs(r.dmg.B - 0.05) < 1e-9); assert.equal(d.g - g0, 2);
});
test('일기토: 같은 계열은 차이만큼, 두 단계 차이는 겨루지 않음, 기세 압도 뒤 0', () => {
  const d = createDuel(buildFighter(F(3)), buildFighter(F(3)), { seed: 2 }); startRound(d);
  d.hand = [{ id: 'a', name: 'a', type: 'atk', power: 20, cost: 0 }]; d.enemy = { name: 'e', type: 'atk', power: 12, cost: 0 }; const r = resolve(d, 0);
  assert.ok(Math.abs(r.dmg.B - 0.08) < 1e-9);
  assert.equal(createDuel(buildFighter(F(4)), buildFighter(F(2))).done.win, true);
  const d2 = createDuel(buildFighter(F(3)), buildFighter(F(3)), { seed: 3 }); d2.g = GAUGE - 1; startRound(d2);
  d2.hand = [{ id: 'a', name: 'a', type: 'atk', power: 1, cost: 0 }]; d2.enemy = { name: 'e', type: 'evade', power: 1, cost: 0 }; const r2 = resolve(d2, 0);
  assert.equal(r2.overwhelm, 'A'); assert.equal(d2.g, 0);
});
test('일기토: 4초 넘김 = 막기, 예상 승률·자동 −5%p', () => {
  const d = createDuel(buildFighter(F(3)), buildFighter(F(3)), { seed: 4 }); startRound(d); d.enemy = { name: 'e', type: 'atk', power: 10, cost: 0 };
  const r = resolve(d, null); assert.equal(r.my.id, 'makgi');
  const p = estimate(F(3), F(3), 100); assert.ok(p > 0.2 && p < 0.9);
  const a = resolveAuto(F(3), F(3), makeRng(9), 0.6); assert.ok(Math.abs(a.p - 0.55) < 1e-9); assert.ok(a.highlights.length >= 1 && a.highlights.length <= 3);
});
test('자동 해금: 직접 3번 또는 6달 끝', () => {
  const g = fresh({ duelMode: () => 'manual', manualResult: () => true });
  for (let i = 0; i < 3; i++) g.requestDuel({ ally: g.person('p0'), foe: F(2), onResult() {} });
  assert.equal(g.state.duels.unlocked, true);
  assert.ok(g.state.log.some(l => l.t === UNLOCK_TEXT));
  const g2 = fresh({ answer: s => s.choices[s.choices.length - 1].id }); g2.advanceMonths(6);
  assert.equal(g2.state.duels.unlocked, true); assert.equal(g2.state.duels.unlockedAt, 6);
});
test('낭인(v7.3): 명성 20~299·절정 이하일 때만, 3달 안엔 안 옴, 문지기는 약한 내제자 이하를 돌려보냄', () => {
  const g = fresh(); const s = g.state; s.flags.eventA = true; s.ronin.last = -99;
  s.fame = 10; assert.equal(g.roninEligible(), false);
  s.fame = 20; assert.equal(g.roninEligible(), true);
  s.fame = 300; assert.equal(g.roninEligible(), false); s.fame = 50;
  s.ronin.last = s.month - 2; assert.equal(g.roninEligible(), false); s.ronin.last = -99;
  g.rng.chance = () => true; g.rng.weighted = () => -1; // 한 단계 아래 낭인 → 일류-1 = 이류
  const before = s.log.length; g._ev.rollRonin();
  // 가장 약한 내제자 = 삼류(1) 이니 이류 낭인은 안 막힘. 내제자 모두 이류 이상이면 막힘:
  const g2 = fresh(); const s2 = g2.state; s2.flags.eventA = true; s2.fame = 50; s2.people = s2.people.filter(p => p.realm >= 2);
  g2.rng.chance = () => true; g2.rng.weighted = () => -1; g2._ev.rollRonin();
  assert.ok(s2.log[0].t.includes('문지기'));
  assert.ok(s.log.length > before);
});
test('낭인 거절: 30%로 명성 −1, 같은 해 두 번째부턴 소문만', () => {
  const g = fresh({ answer: () => 'refuse' }); const s = g.state; s.fame = 50; g.rng.chance = () => true;
  g._ev.roninEvent(RONIN[1], 2, false); assert.equal(s.fame, 49);
  g._ev.roninEvent(RONIN[1], 2, false); assert.equal(s.fame, 49);
});
test('남는 낭인(v7.4): 이기면 고른 자리로(식객), 한 해 1명, 거절이면 굴림 없음', () => {
  const answer = sp => /어떤 자리/.test(sp.title) ? 'sikgaek' : /남고 싶어/.test(sp.title) ? 'yes' : 'p1';
  const g = fresh({ answer, duelMode: () => 'manual', manualResult: () => true }); const s = g.state; s.fame = 50;
  const n0 = s.people.length; g.rng.chance = () => true;
  g._ev.roninEvent(RONIN[1], 2, false);
  assert.equal(s.people.length, n0 + 1); const sk = s.people[s.people.length - 1];
  assert.equal(sk.role, 'sikgaek');
  g._ev.roninEvent(RONIN[2], 2, false); assert.equal(s.people.length, n0 + 1, '한 해 최대 1명');
  const g2 = fresh({ answer: () => 'refuse' }); g2.rng.chance = () => true; const m0 = g2.state.people.length; g2._ev.roninEvent(RONIN[1], 2, false); assert.equal(g2.state.people.length, m0);
});
test('남는 낭인(v7.4): 지면 3% 객경 — 객방 없으면 "다시 오겠소"', () => {
  const g = fresh({ answer: sp => /남고 싶어/.test(sp.title) ? 'yes' : 'p1', duelMode: () => 'manual', manualResult: () => false }); const s = g.state; s.fame = 50;
  const calls = []; g.rng.chance = p => { calls.push(p); return true; };
  const n0 = s.people.length; g._ev.roninEvent(RONIN[1], 2, false);
  assert.ok(calls.includes(0.03)); assert.equal(s.people.length, n0); assert.ok(s.ronin.revisit); assert.ok(s.log.some(l => l.t.includes('객방이 생기면')));
  const g3 = fresh({ answer: sp => 'p1', duelMode: () => 'manual', manualResult: () => true }); const c3 = []; g3.rng.chance = p => { c3.push(p); return false; }; g3._ev.roninEvent(RONIN[1], 2, false); assert.ok(c3.includes(0.15));
});
test('식객(v7.4): 생활비 절반, 본문 무공 못 배움, 할 수 있는 일 제한, 마지막 제자 보호 없음', () => {
  const g = fresh(); const s = g.state;
  const sk = { id: 'sx', name: '허진', role: 'sikgaek', realm: 3, meridians: 6, arts: { nangin: 4 }, talent: { geun: 1, oseong: 1, sangjae: 0 }, reveal: { geun: 1, oseong: 1, sangjae: 0 }, hints: {}, tp: 999, task: null, injured: 0, discontent: 0, loyalty: 50, joined: 1 };
  s.people.push(sk);
  assert.equal(livingCost(s, sk, 1), 10);
  assert.equal(g.upgradeArt('sx', 'chungun'), false); assert.equal(g.upgradeArt('sx', 'nangin'), true);
  assert.equal(g.canDo(sk, 'openJumak'), false); assert.equal(g.canDo(sk, 'stay'), true); assert.equal(g.canDo(sk, 'train'), false); assert.equal(g.canDo(sk, 'request'), true);
  s.people = s.people.filter(p => p.role === 'master' || p.id === 'sx'); sk.discontent = 80; g._ev.monthEnd();
  assert.equal(s.people.some(p => p.id === 'sx'), false);
});
