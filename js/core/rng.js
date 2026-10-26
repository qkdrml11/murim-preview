// 시드 고정 난수(mulberry32). 상태를 저장할 수 있게 객체로 둬요.
export function makeRng(seed) {
  const r = { s: seed >>> 0 };
  r.next = () => { let a = (r.s = (r.s + 0x6D2B79F5) | 0); let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  r.int = (a, b) => a + Math.floor(r.next() * (b - a + 1));
  r.pick = arr => arr[Math.floor(r.next() * arr.length)];
  r.chance = p => r.next() < p;
  r.weighted = pairs => { let t = 0; for (const [, w] of pairs) t += w; let x = r.next() * t; for (const [v, w] of pairs) { if ((x -= w) < 0) return v; } return pairs[pairs.length - 1][0]; };
  return r;
}
