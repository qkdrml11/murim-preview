// §5-5 수입 = 기본 × 단계 × 고을 크기 × 관리인 상재 × 경쟁. §5-4 생활비, 첫해 절반.
import { SIZES, provDist } from '../data/map.js';
import { LIVING, TALENT_MUL } from '../data/people.js';
export const BIZ = {
  jumak: { name: '주막', names: ['주막', '객잔', '대객잔'], base: 30, open: 200, months: 1, minSize: 'small' },
  pyoguk: { name: '표국', names: ['표국', '대표국', '천리표국'], base: 40, open: 200, months: 2, minSize: 'large' },
  sadeul: { name: '사들이기', names: ['사들이기'], base: 0, open: 100, months: 1, minSize: 'village' },
};
export const STAGE_MUL = [0, 1, 1.5, 2.2];
export const FIRST_YEAR_MONTHS = 12;
export function managerMul(state, b) {
  if (b.startOwned && !b.manager) return 1; // 시작 주막: 옛 주인이 남아 ×1(v6.7.1)
  if (!b.manager) return 0.7;
  const p = state.people.find(x => x.id === b.manager);
  return p ? TALENT_MUL[p.talent.sangjae] : 0.7;
}
export function bizIncome(state, place, b) {
  if (b.owner !== 'cw' || b.type === 'sadeul') return 0;
  if (b.zeroMonths > 0) return 0;
  const def = BIZ[b.type];
  let compete = 1;
  const rivals = place.biz.filter(o => o !== b && o.type === b.type && o.owner !== 'cw');
  if (rivals.length) { const top = Object.entries(place.inf).sort((a, c) => c[1] - a[1])[0]; compete = top && top[0] === 'cw' ? 1 : 0.8; }
  return Math.round(def.base * STAGE_MUL[b.stage || 1] * SIZES[place.size].incomeMul * managerMul(state, b) * compete);
}
export function livingCost(state, p, month) {
  if (p.role === 'master') return 0;
  const full = p.founder && p.costOverride != null ? p.costOverride : LIVING[p.realm];
  if (p.role === 'sikgaek') return full * 0.5; // 식객 생활비 절반(v7.4)
  if (p.role === 'gaekgyeong') return full + 10; // 객경 예우비
  return p.founder && month <= FIRST_YEAR_MONTHS ? full / 2 : full;
}
export function stayCost(state, placeId) {
  const pl = state.towns[placeId] || state.villages[placeId];
  const d = provDist(state.homeProv, pl.prov);
  return d <= 1 ? 10 : d === 2 ? 15 : d === 3 ? 20 : 25;
}
export function monthLedger(state, month = state.month) {
  const lines = [];
  for (const pl of [...Object.values(state.towns), ...Object.values(state.villages)])
    for (const b of pl.biz) { const v = bizIncome(state, pl, b); if (v) lines.push({ kind: 'in', label: `${pl.name} ${BIZ[b.type].names[(b.stage || 1) - 1]}`, v }); }
  let living = 0; for (const p of state.people) living += livingCost(state, p, month);
  living = Math.round(living);
  if (living) lines.push({ kind: 'out', label: month <= FIRST_YEAR_MONTHS ? '생활비(첫해 절반)' : '생활비', v: -living });
  for (const t of state.tasks) if (t.monthly) lines.push({ kind: 'out', label: t.label, v: -t.monthly });
  const net = lines.reduce((s, l) => s + l.v, 0);
  return { lines, net };
}
export function applyMonth(state) {
  const L = monthLedger(state);
  state.silver += L.net;
  let shortfall = 0;
  if (state.silver < 0) { shortfall = -state.silver; state.arrears += shortfall; state.silver = 0; }
  for (const pl of [...Object.values(state.towns), ...Object.values(state.villages)]) for (const b of pl.biz) if (b.zeroMonths > 0) b.zeroMonths--;
  state.lastLedger = { month: state.month, ...L };
  return { ...L, shortfall };
}
