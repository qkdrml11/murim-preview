import { CONFIG } from '../data/config.js';
// 해금(§9 ⑤, v7.6.3): S.unlock = { v, open:{key:연 화면 달}, queue:[], last }. 새 달이 시작될 때만 queue 맨 앞 하나(자동 설정 예외).
// 화면은 isOpen(key)만 묻고, 열리면 bus 'feature:open'을 받아 다시 그려요(알림·반짝임 훅).
import { UNLOCK_V, START_OPEN, UNLOCK_STEPS, UNLOCK_KEYS, STEP, START_VISIBLE } from '../data/unlocks.js';

export function newUnlockState(all = false) {
  const open = {}; for (const k of all ? UNLOCK_KEYS : START_OPEN) open[k] = 0;
  return { v: UNLOCK_V, open, queue: [], last: 0, seen: all ? null : [...START_VISIBLE] };
}
// 기존 세이브(§9 ⑤): 달 ≤ 지금 달인 것 전부 + 이미 쓴 기능을 한꺼번에 열어요(이야기 창 없이 한 줄).
export function migrateUnlock(st) {
  const u = newUnlockState(false);
  const used = usedFeatures(st);
  for (const s of UNLOCK_STEPS) if (s.month <= st.month - 1 || used.has(s.key)) u.open[s.key] = st.month; // 표 달 k = 화면 달 − 1
  if (st.duels?.unlocked) u.open.auto = st.duels.unlockedAt || st.month;
  u.last = st.month; u.seen = visibleFor(u, st);
  if (u.open.biz_all) u.seen = null;
  return u;
}
function usedFeatures(st) {
  const s = new Set(); const all = [...Object.values(st.towns || {}), ...Object.values(st.villages || {})];
  const mine = all.flatMap(p => p.biz.filter(b => b.owner === 'cw' && !b.startOwned).map(b => b.type));
  if (mine.includes('jumak')) s.add('biz_inn'); if (mine.includes('pyoguk')) s.add('biz_pyo'); if (mine.includes('sadeul')) s.add('biz_all');
  for (const t of st.tasks || []) s.add({ request: 'quest', stay: 'stay', raid: 'raid', recruit: 'recruit', build: 'build', openJumak: 'biz_inn', openPyoguk: 'biz_pyo' }[t.type]);
  if (Object.keys(st.buildings || {}).length) s.add('build');
  if ((st.duels?.manual || 0) > 0) s.add('duel');
  if (st.flags?.eventA) s.add('ronin');
  if ((st.people || []).some(p => !p.founder && p.role === 'naeje' && !p.ronin)) s.add('recruit');
  s.delete(undefined); return s;
}
function visibleFor(u, st) {
  const v = new Set(START_VISIBLE);
  for (const s of UNLOCK_STEPS) if (u.open[s.key] != null) for (const id of s.reveal || []) v.add(id);
  for (const pl of [...Object.values(st.towns || {}), ...Object.values(st.villages || {})]) if (pl.biz?.some(b => b.owner === 'cw') || pl.owner === 'cw') v.add(pl.id);
  for (const t of st.tasks || []) v.add(String(t.target).split('#')[0]);
  return [...v];
}

export function createUnlocks(g) {
  const U = () => g.state.unlock;
  const isOpen = key => !U() || U().open[key] != null;
  const visible = id => { const u = U(); return !u || !u.seen || u.seen.includes(id); };
  function due(month) { // 이 달에 조건이 된 것들. 표 '달 k'는 0부터(경과 달 = 화면 달 − 1 ≥ k, §9 ⑤ Q2)
    const el = month - 1, out = [];
    for (const s of UNLOCK_STEPS) {
      if (isOpen(s.key) || U().queue.includes(s.key)) continue;
      if (el >= s.month) out.push(s.key); // auto: 직접 3번이면 결과 화면에서 바로(openAutoNow), 아니면 여기서 표 달 6
    }
    return out;
  }
  function open(key, opts = {}) {
    const u = U(); if (isOpen(key)) return false;
    u.open[key] = g.state.month; u.queue = u.queue.filter(k => k !== key);
    const s = STEP[key];
    if (s.revealAll) u.seen = null; else if (s.reveal && u.seen) for (const id of s.reveal) if (!u.seen.includes(id)) u.seen.push(id);
    if (key === 'auto') { g.state.duels.unlocked = true; g.state.duels.unlockedAt = g.state.month; }
    g.bus.emit('feature:open', { key, step: s, silent: !!opts.silent });
    g.bus.emit('changed');
    return true;
  }
  // 달이 시작될 때 부름: 조건 본 뒤 queue 맨 앞 하나만. 자동 설정이 조건을 먼저 채우면 맨 앞으로(§9 ①).
  function onMonthStart() {
    const u = U(); if (!u) return null;
    const m = g.state.month;
    for (const k of due(m)) u.queue.push(k);
    u.queue.sort((a, b) => STEP[a].step - STEP[b].step);
    if (!u.queue.length) return null;
    if (u.last === m && (u.countThisMonth || 0) >= CONFIG.unlocksPerMonth) return null;
    if (u.last !== m) u.countThisMonth = 0;
    const key = u.queue[0]; u.last = m; u.countThisMonth = (u.countThisMonth || 0) + 1; open(key); return key;
  }
  // §9 ⑤ Q3: 3번째 직접 일기토가 끝나면 바로. '한 달에 하나' 예외(countThisMonth 안 셈), 다른 해금 안 밀림.
  function openAutoNow() { if (isOpen('auto') || g.state.duels.manual < g.UNLOCK_DUELS) return false; return open('auto'); }
  function openAll() { for (const k of UNLOCK_KEYS) if (!isOpen(k)) open(k, { silent: true }); U().seen = null; g.bus.emit('changed'); }
  function reveal(id) { const u = U(); if (u && u.seen && !u.seen.includes(id)) { u.seen.push(id); g.bus.emit('fog'); } }
  return { isOpen, visible, onMonthStart, open, openAll, reveal, due, openAutoNow };
}
