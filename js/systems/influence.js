// §3 세력 · §4-1 크기 배율 · 색칠 규칙
import { SIZES } from '../data/map.js';
export const ME = 'cw';
export function ranking(inf) { return Object.entries(inf).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]); }
export function colorOf(place, prevOwner) {
  const r = ranking(place.inf);
  if (!r.length) return { owner: null, contested: false };
  const [f1, v1] = r[0], v2 = r[1] ? r[1][1] : 0;
  if (r[1] && v1 === v2) return { owner: prevOwner ?? null, contested: true, pair: [r[0][0], r[1][0]] };
  if (v1 >= 30 && v1 - v2 >= 10) return { owner: f1, contested: false, monopoly: v1 >= 70 && r.slice(1).every(([, v]) => v <= 10) };
  if (r[1] && v1 - v2 < 10) return { owner: null, contested: true, pair: [r[0][0], r[1][0]] };
  return { owner: null, contested: false };
}
export function addInf(place, fac, delta, { raw = false } = {}) {
  const mul = raw ? 1 : SIZES[place.size].infMul;
  const d = Math.trunc(delta * mul); // 끝수는 버려요
  let v = (place.inf[fac] || 0) + d;
  if (place.holy && fac !== place.holy) v = Math.min(v, 55);
  if (place.holy && fac === place.holy) v = Math.max(v, 60);
  if (place.home && fac === ME) v = Math.max(v, 50); // 본산 하한
  const S = SIZES[place.size];
  if (place.size === 'city' && fac !== ME && place.baseFacs?.includes(fac)) v = Math.max(v, 15);
  place.inf[fac] = Math.max(0, Math.min(100, v));
  return d;
}
export const BIZ_INF = [0, 2, 3, 4]; // 단계별 매달 세력
export function monthlyInfluence(state) {
  const changes = [];
  const places = [...Object.values(state.towns), ...Object.values(state.villages)];
  for (const pl of places) {
    let gain = 0;
    for (const b of pl.biz) if (b.owner === ME && !b.building) gain += BIZ_INF[b.stage || 1];
    const stayers = state.tasks.filter(t => t.type === 'stay' && t.target === pl.id);
    let sc = 0;
    for (const t of stayers) for (const pid of t.people) { if (sc >= 2) break; const p = state.people.find(x => x.id === pid); if (p) { gain += p.realm >= 4 ? 3 : p.realm >= 3 ? 2 : 1; sc++; } }
    const before = pl.inf[ME] || 0;
    if (gain > 0) addInf(pl, ME, gain);
    else if (before > 30 && !pl.home) { addInf(pl, ME, -2); if ((pl.inf[ME] || 0) < 30) pl.inf[ME] = 30; }
    const prev = pl.owner;
    const c = colorOf(pl, prev);
    pl.owner = c.owner; pl.contested = c.contested; pl.monopoly = !!c.monopoly;
    if (prev !== c.owner) changes.push({ place: pl, from: prev, to: c.owner });
  }
  return changes;
}
export function recolor(pl) { const prev = pl.owner; const c = colorOf(pl, prev); pl.owner = c.owner; pl.contested = c.contested; pl.monopoly = !!c.monopoly; return prev !== c.owner ? { place: pl, from: prev, to: c.owner } : null; }
