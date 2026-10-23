// v0.7.8 [1] 일기토 연출 (패치노트 §4-2, 간이판). 판정·난수에 손대지 않는다 — 화면만.
// FX.play(kind, payload) · FX.frame(dt) · FX.clear() · FX.full(text, ms) · FX.queue(kind) · FX.guard(dt) · FX.opt
'use strict';
(function (root) {
const FX = { opt: { shake: true, fx: '보통', flash: false, vib: false }, el: null, cv: null, ctx: null, pops: [], parts: [], flashT: [], stop: 0, hitBudget: [], slow: [], lowered: false };
// 16-1-2 H1~H11 간이 상수: [히트스톱 ms, 흔들림 px, 팝업 색, 팝업 크기, 진동 ms]
FX.H = { phit: [0, 0, '#e7e5e4', 14, 0], pcrit: [40, 2, '#fde047', 17, 0], pskill: [60, 3, '#fbbf24', 18, 0], manual: [90, 4, '#facc15', 20, 30], eskill: [60, 4, '#f87171', 17, 0],
  ehit: [0, 0, '#fca5a5', 13, 0], parryok: [120, 5, '#86efac', 20, 40], parryfail: [80, 6, '#ef4444', 19, 20], pheal: [0, 0, '#60a5fa', 15, 0], eheal: [0, 0, '#c084fc', 15, 0], pdodge: [0, 0, '#a5f3fc', 14, 0], ctr: [60, 3, '#34d399', 17, 0], roll: [0, 2, '#a5f3fc', 16, 0] };
const PMAX = () => FX.opt.fx === '낮음' ? 60 : 150, POPMAX = 8;
FX.attach = function (stage, canvas) { FX.el = stage; FX.cv = canvas; FX.ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null; FX.resize(); };
FX.resize = function () { const c = FX.cv; if (!c || !FX.el) return; const dpr = Math.min(2, root.devicePixelRatio || 1); c.width = Math.max(1, FX.el.clientWidth * dpr); c.height = Math.max(1, FX.el.clientHeight * dpr); if (FX.ctx) FX.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
// 번쩍임 1초 창 ≤ 3회
FX.queue = function () { const n = performance.now(); FX.flashT = FX.flashT.filter(t => n - t < 1000); if (FX.flashT.length >= 3 || FX.opt.flash) return false; FX.flashT.push(n); return true; };
// 히트스톱 1초 합 ≤ 200ms (2×면 ÷2, 즉시·자동 파훼면 0) — 반환 = 이번 정지 ms
FX.hitstop = function (ms, speed, instant) { if (instant || !ms) return 0; ms = ms / (speed >= 2 ? 2 : 1); const n = performance.now(); FX.hitBudget = FX.hitBudget.filter(x => n - x[0] < 1000); const used = FX.hitBudget.reduce((a, x) => a + x[1], 0); ms = Math.max(0, Math.min(ms, 200 - used)); if (ms) FX.hitBudget.push([n, ms]); return ms; };
FX.play = function (kind, p) {
  p = p || {}; const H = FX.H[kind] || FX.H.phit, el = FX.el; if (!el) return 0;
  if (p.text != null) { while (FX.pops.length >= POPMAX) { const o = FX.pops.shift(); o.remove(); }
    const d = document.createElement('div'); d.className = 'dmg' + (kind === 'manual' ? ' big' : ''); d.style.color = H[2]; d.style.fontSize = H[3] + 'px'; d.style.left = (p.side === 'e' ? 50 + Math.random() * 30 : 15 + Math.random() * 30) + '%'; d.textContent = p.text;
    el.appendChild(d); FX.pops.push(d); const life = kind === 'manual' || kind === 'pskill' ? 900 : 700; setTimeout(() => { d.remove(); const i = FX.pops.indexOf(d); if (i >= 0) FX.pops.splice(i, 1); }, life); }
  if (FX.opt.shake && H[1] && FX.opt.fx !== '낮음') { const a = el.closest('.duel') ? el : el; a.style.transform = 'translate(' + (Math.random() < 0.5 ? -H[1] : H[1]) + 'px,0)'; setTimeout(() => { a.style.transform = ''; }, 90); }
  if (FX.opt.vib && H[4] && root.navigator && navigator.vibrate) try { navigator.vibrate(H[4]); } catch (e) {}
  if (FX.ctx && FX.opt.fx !== '낮음' && (kind === 'pskill' || kind === 'manual' || kind === 'parryok' || kind === 'ctr')) { const w = FX.el.clientWidth, h = FX.el.clientHeight, n = kind === 'manual' ? 18 : 10;
    for (let i = 0; i < n && FX.parts.length < PMAX(); i++) FX.parts.push({ x: w * (p.side === 'e' ? 0.3 : 0.7), y: h * 0.5, vx: (Math.random() - 0.5) * 220, vy: (Math.random() - 0.7) * 220, life: 0.5, c: H[2] }); }
  if ((kind === 'parryok' || kind === 'manual') && FX.queue()) { el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 120); }
  return H[0];
};
FX.frame = function (dt) { const c = FX.ctx; if (!c || !FX.el) return; const w = FX.el.clientWidth, h = FX.el.clientHeight; c.clearRect(0, 0, w, h);
  FX.parts = FX.parts.filter(q => (q.life -= dt) > 0); for (const q of FX.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 300 * dt; c.globalAlpha = Math.max(0, q.life * 2); c.fillStyle = q.c; c.fillRect(q.x, q.y, 3, 3); } c.globalAlpha = 1; };
// 배너 B1 800ms · B2 1,200ms
FX.banner = function (text, ms, cls) { const el = FX.el; if (!el) return; const b = document.createElement('div'); b.className = 'banner ' + (cls || ''); b.textContent = text; el.appendChild(b); setTimeout(() => b.remove(), ms || 800); };
// B3 전화면(처음 1,600ms, 본 뒤 600ms, 낮음이면 600ms) — 탭하면 0.4초로 줄인다
FX.full = function (text, seen) { return new Promise(res => { const ov = document.createElement('div'); ov.className = 'fxfull'; ov.textContent = text; const ms = (seen || FX.opt.fx === '낮음') ? 600 : 1600; let done = false;
  const end = () => { if (done) return; done = true; ov.remove(); setTimeout(res, 250); }; ov.onclick = () => setTimeout(end, 400); (FX.el && FX.el.closest('.duel') || document.body).appendChild(ov); setTimeout(end, ms); }); };
FX.clear = function () { for (const p of FX.pops) p.remove(); FX.pops = []; FX.parts = []; if (FX.ctx && FX.el) FX.ctx.clearRect(0, 0, FX.el.clientWidth, FX.el.clientHeight); FX.el = null; FX.cv = null; FX.ctx = null; };
// 1초 평균 프레임 24ms 넘으면 한 단계 낮춤 + 토스트 1회
FX.guard = function (dtMs, onLower) { FX.slow.push(dtMs); if (FX.slow.length < 60) return; const avg = FX.slow.reduce((a, b) => a + b, 0) / FX.slow.length; FX.slow = [];
  if (avg > 24 && !FX.lowered && FX.opt.fx !== '낮음') { FX.lowered = true; FX.opt.fx = FX.opt.fx === '높음' ? '보통' : '낮음'; if (onLower) onLower(FX.opt.fx); } };
root.FX = FX;
})(typeof window !== 'undefined' ? window : globalThis);
