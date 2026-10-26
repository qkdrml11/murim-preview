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

const fresh = (o = {}) => { const g = createGame({ headless: true, seed: 5, allOpen: true, ...o }); g.endIntro(); return g; };

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
test('살림: 첫해 생활비 절반(30·5냥 단위), 시작 320 → 첫 달 끝 95(주막200·머물기10·의뢰30)', () => {
  const g = fresh(); const s = g.state;
  assert.equal(Math.round(s.people.reduce((a, p) => a + livingCost(s, p, 1), 0)), 30);
  assert.equal(Math.round(s.people.reduce((a, p) => a + livingCost(s, p, 13), 0)), 60);
  g.assign('openJumak', ['p2'], '청석'); g.assign('stay', ['p3'], '청석'); g.assign('request', ['p4'], '청석', { label: '우물 의뢰' }); g.assign('train', ['p1'], 'p1');
  g.advanceMonths(1);
  assert.equal(s.silver, 95);
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
test('자동 해금(v7.5): 6달째 시작에 순서표대로, 직접 3번이면 다음 달 맨 앞으로', () => {
  const g2 = createGame({ headless: true, seed: 5, answer: s => s.choices[s.choices.length - 1].id }); g2.endIntro(); g2.advanceMonths(5);
  assert.equal(g2.state.duels.unlocked, true); assert.equal(g2.state.duels.unlockedAt, 6); assert.ok(g2.state.log.some(l => l.t === UNLOCK_TEXT));
  const g = createGame({ headless: true, seed: 5, duelMode: () => 'manual', manualResult: () => true }); g.endIntro(); g.advanceMonths(1); // 2달째: biz_inn 열림
  for (let i = 0; i < 3; i++) g.requestDuel({ ally: g.person('p0'), foe: F(2), onResult() {} });
  assert.equal(g.isOpen('auto'), false, '같은 달엔 안 열림');
  g.advanceMonths(1); assert.equal(g.isOpen('auto'), true); assert.equal(g.isOpen('duel'), false, '그달 다른 해금은 한 달 밀림');
  g.advanceMonths(1); assert.equal(g.isOpen('duel'), true);
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
test('v7.4.1: 충성 70 이상 식객은 1년 떠남 굴림 없음', () => {
  const mk = (id, loyalty) => ({ id, name: id, role: 'sikgaek', realm: 2, meridians: 4, arts: {}, talent: { geun: 1, oseong: 1, sangjae: 0 }, reveal: {}, hints: {}, tp: 0, task: null, injured: 0, discontent: 0, loyalty, joined: 0 });
  const g = fresh(); const s = g.state; s.people.push(mk('hi', 70), mk('lo', 69)); s.month = 12; g.rng.chance = () => true;
  g._ev.monthEnd();
  assert.ok(s.people.some(p => p.id === 'hi')); assert.ok(!s.people.some(p => p.id === 'lo'));
});
test('v7.4.1/v7.5 §5-7 ②-1: 반대 진영 낭인만 경고 한 줄, 받으면 S.lean +2, 사파면 악명도 +2', () => {
  const run = (camp, pick, my = '정파') => { const bodies = []; const g = fresh({ answer: sp => { bodies.push(sp.body); return /어떤 자리/.test(sp.title) ? 'sikgaek' : pick; } }); g.state.camp = my; g.rng.chance = () => true;
    g._ev.roninStayRoll({ name: '갑', byeolho: '검', camp }, { realm: 2, meridians: 4, arts: {}, simbeop: null }, true); return { s: g.state, b: bodies[0] }; };
  const a = run('사파', 'yes'); assert.ok(a.b.includes('받으면 진영이 사파 쪽으로 +2 기울어요')); assert.equal(a.s.lean.sa, 2); assert.equal(a.s.infamy, 2);
  const m = run('마교', 'yes'); assert.equal(m.s.lean.ma, 2); assert.equal(m.s.infamy, 0);
  const r = run('사파', 'no'); assert.equal(r.s.lean.sa, 0); assert.equal(r.s.infamy, 0);
  for (const c of ['정파', '중립', '세외']) { const x = run(c, 'yes'); assert.ok(!x.b.includes('기울어요')); assert.deepEqual(x.s.lean, { jeong: 0, sa: 0, ma: 0 }); }
  const sa = run('정파', 'yes', '사파'); assert.ok(sa.b.includes('정파 쪽으로')); assert.equal(sa.s.lean.jeong, 2);
});
test('해금(v7.5 §9): 새 게임은 수련·주막 돌보기만, 첫 달 중간 의뢰, 한 달에 하나, 운봉만 보임', () => {
  const g = createGame({ headless: true, seed: 5 }); g.endIntro(); const s = g.state; const p2 = g.person('p2');
  assert.deepEqual(Object.keys(s.unlock.open), ['train', 'inn']); assert.equal(s.unlock.v, 1); assert.deepEqual(s.unlock.queue, []);
  assert.equal(g.canDo(p2, 'openJumak'), false); assert.equal(g.canDo(p2, 'request'), false); assert.equal(g.canDo(p2, 'train'), true); assert.equal(g.canDo(p2, 'manage'), true);
  assert.equal(g.visible('운봉'), true); assert.equal(g.visible('청석'), false);
  g.setSpeed(1); g.tick(SEC_PER_MONTH * 0.55); assert.equal(g.isOpen('quest'), true); assert.equal(s.unlock.last, 1);
  assert.ok(g.targets('request', p2).every(t => g.visible(String(t.id).split('#')[0])));
  g.advanceMonths(1); assert.equal(s.month, 2); assert.equal(g.isOpen('biz_inn'), true); assert.equal(g.visible('청석'), true);
  assert.ok(g.targets('openJumak', p2).some(t => t.id === '청석')); assert.ok(!g.targets('openJumak', p2).some(t => t.id === '여울'));
  const before = Object.keys(s.unlock.open).length; s.unlock.queue.push('ledger'); g._ev.monthEnd(); assert.equal(Object.keys(s.unlock.open).length, before + 1, '한 달에 하나만');
  assert.equal(g.isOpen('duel'), true); assert.deepEqual(s.unlock.queue, ['ledger']);
  g.unlocks.openAll(); assert.equal(g.visible('여울'), true);
});
test('해금 migrate: 옛 세이브(S.unlock 없음)는 지금 달까지 + 쓴 기능 한꺼번에, 한 줄 알림', () => {
  const g0 = createGame({ headless: true, seed: 5, allOpen: true }); g0.endIntro(); g0.advanceMonths(3);
  const old = JSON.parse(g0.serialize()); delete old.unlock; delete old.pending; delete old.lean; old.v = 1; delete old.fmt;
  old.tasks.push({ id: 99, type: 'recruit', people: [], target: '운봉', remaining: 1 });
  const g = createGame({ headless: true, state: old }); const o = g.state.unlock.open;
  assert.equal(g.migrateNotice, '새 안내 방식이 생겼어요');
  for (const k of ['train', 'inn', 'quest', 'biz_inn', 'duel', 'recruit']) assert.ok(k in o, k);
  assert.ok(!('ledger' in o)); assert.equal(g.state.v, 2); assert.deepEqual(g.state.lean, { jeong: 0, sa: 0, ma: 0 });
  const again = createGame({ headless: true, state: JSON.parse(g.serialize()) }); assert.equal(again.migrateNotice, null);
});
test('보류 질문: 고르기 전 새로고침해도 저장에 남아 다시 뜨고, 고르면 이어서 처리', () => {
  const asks = []; let answerNow = false;
  const g = createGame({ seed: 5, allOpen: true }); g.endIntro(); // 화면 모드(headless 아님): 창만 띄우고 기다려요
  g.bus.on('ask', sp => asks.push(sp));
  g._ev.roninEvent(RONIN[1], 2, false); assert.equal(asks.length, 1); assert.equal(g.state.pending.length, 1);
  const json = g.serialize();
  const g2 = createGame({ state: JSON.parse(json) }); const asks2 = []; g2.bus.on('ask', sp => asks2.push(sp)); const duels = []; g2.bus.on('duel:request', f => duels.push(f));
  g2.resumePending(); assert.equal(asks2.length, 1); assert.equal(asks2[0].title, '떠돌이 낭인의 비무');
  asks2[0].cb(asks2[0].choices[0].id); assert.equal(g2.state.pending.length, 0); assert.equal(duels.length, 1); assert.ok(g2.state.pendingDuel, '일기토도 저장에 남음');
  const g3 = createGame({ state: JSON.parse(g2.serialize()) }); const d3 = []; g3.bus.on('duel:request', f => d3.push(f)); g3.resumePending(); assert.equal(d3.length, 1);
  const fame = g3.state.fame; g3.finishDuel(d3[0], true, true); assert.equal(g3.state.pendingDuel, null); assert.ok(g3.state.fame > fame);
  const g4 = createGame({ seed: 5, allOpen: true }); g4.endIntro(); const a4 = []; g4.bus.on('ask', sp => a4.push(sp)); g4._ev.roninEvent(RONIN[1], 2, false); a4[0].cb('refuse');
  assert.equal(g4.state.pending.length, 0); assert.equal(g4.resolveDecision(1, 'refuse'), false, '두 번 처리 안 됨');
});
test('옛 v0.5.2 세이브(같은 키 murim_save_v5, v:5)는 우리 형식이 아님', async () => {
  const { isOurSave } = await import('../js/game.js');
  assert.equal(isOurSave({ v: 5, turn: 3, player: {} }), false); assert.equal(isOurSave(null), false);
  const g = createGame({ headless: true }); assert.equal(isOurSave(JSON.parse(g.serialize())), true);
});

import { CONFIG } from '../js/data/config.js';
import { bizIncome } from '../js/systems/economy.js';
test('v7.6.2 은자: 고정값 5냥 단위 · 계산값 1냥(Math.round) · 9달 알림', () => {
  const g = createGame({ headless: true, seed: 7 }); const s = g.state;
  assert.equal(s.silver, 320); assert.equal(CONFIG.startSilver, 320); assert.equal(g.BUILDINGS.suryeondong.cost, 100);
  assert.equal(monthLedger(s, 1).lines.find(l => l.kind === 'out').v, -30);
  assert.equal(monthLedger(s, 10).lines.find(l => l.kind === 'out').v, -60);
  const ub = s.towns['운봉'].biz.find(b => b.owner === 'cw');
  ub.stage = 2; const v2 = bizIncome(s, s.towns['운봉'], ub); assert.equal(v2, 68, '운봉 객잔 68(계산값)');
  ub.stage = 3; ub.startOwned = false; ub.manager = null; assert.equal(bizIncome(s, s.towns['운봉'], ub), Math.round(65 * 1.5 * 0.7));
  ub.stage = 1; ub.startOwned = true;
  const sk = { role: 'sikgaek', realm: 2 }; assert.equal(livingCost(s, sk, 1), 8, '식객 이류 절반 7.5 → 8');
  s.month = 9; assert.match(g.benefitEndText(), /^다음 달부터 옛 의리 혜택이 끝나요 → 수지 [+−]\d+ → [+−]\d+$/);
  assert.equal(monthLedger(s, 9).net - monthLedger(s, 10).net, 30);
});
