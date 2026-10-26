// 수묵 지도(§4): 바탕(종이·산·강·성 경계)을 한 번 그려 두고, 세력 물감 층만 바뀔 때 다시 그려요.
// 확대 3단계(천하·성·고을): 핀치, 두 번 탭, 아래 단추. 프레임마다는 drawImage + 이름표만.
import { W, H, PROVINCES, provinceAt, SIZES } from '../data/map.js';
import { FACTIONS } from '../data/factions.js';
import { haptic } from './util.js';

const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const RIVERS = [
  [[60, 330], [190, 300], [320, 270], [430, 230], [520, 250], [580, 320], [660, 300], [760, 270], [880, 280], [985, 300]],
  [[40, 720], [180, 700], [300, 690], [400, 660], [500, 600], [600, 640], [700, 650], [800, 630], [900, 610], [990, 590]],
  [[420, 1040], [520, 1090], [610, 1110], [700, 1150], [800, 1190], [920, 1200]],
  [[640, 700], [650, 780], [640, 860], [600, 940]],
];
export function createMap(canvas, game, ui) {
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  let vw = 0, vh = 0;
  const base = document.createElement('canvas'), Q = 1.4; base.width = W * Q; base.height = H * Q;
  const wash = document.createElement('canvas'), WQ = 0.5; wash.width = W * WQ; wash.height = H * WQ;
  const provWash = document.createElement('canvas'); provWash.width = W * WQ; provWash.height = H * WQ;
  let level = 0, focus = { prov: 'guizhou', town: '운봉' };
  const cam = { x: W / 2, y: H / 2, s: 0.3 }, target = { ...cam };
  let dirty = true, washDirty = true, pulseT = 0, selected = null;

  function drawBase() {
    const c = base.getContext('2d'); c.save(); c.scale(Q, Q);
    c.fillStyle = '#efe6d2'; c.fillRect(0, 0, W, H);
    // 종이 결
    for (let i = 0; i < 2600; i++) { c.fillStyle = `rgba(90,75,50,${0.02 + hash(i) * 0.05})`; c.fillRect(hash(i * 3) * W, hash(i * 7) * H, 1 + hash(i * 11) * 2.5, 0.6); }
    for (let i = 0; i < 26; i++) { const g = c.createRadialGradient(hash(i * 5) * W, hash(i * 9) * H, 0, hash(i * 5) * W, hash(i * 9) * H, 60 + hash(i) * 120);
      g.addColorStop(0, 'rgba(160,140,100,.07)'); g.addColorStop(1, 'rgba(160,140,100,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H); }
    // 바깥 바다(동쪽 끝) 옅게
    const sea = c.createLinearGradient(W - 70, 0, W, 0); sea.addColorStop(0, 'rgba(80,100,110,0)'); sea.addColorStop(1, 'rgba(80,100,110,.12)'); c.fillStyle = sea; c.fillRect(W - 70, 0, 70, H);
    // 산: 서쪽·서남쪽은 빽빽하게, 나머지는 드문드문
    const peaks = [];
    for (let i = 0; i < 260; i++) {
      const x = hash(i * 13.1) * W, y = 60 + hash(i * 17.3) * (H - 120);
      const west = x < 330 || (y > 800 && x < 560) || (y < 260 && x < 460);
      if (!west && hash(i * 5.7) > 0.25) continue;
      peaks.push([x, y, (west ? 16 : 10) + hash(i * 3.3) * (west ? 22 : 12)]);
    }
    peaks.sort((a, b) => a[1] - b[1]);
    for (const [x, y, s] of peaks) mountain(c, x, y, s);
    // 강: 붓 굵기 변화 + 번짐
    for (const r of RIVERS) for (let pass = 0; pass < 2; pass++) {
      c.beginPath(); c.moveTo(r[0][0], r[0][1]);
      for (let i = 1; i < r.length - 1; i++) { const mx = (r[i][0] + r[i + 1][0]) / 2, my = (r[i][1] + r[i + 1][1]) / 2; c.quadraticCurveTo(r[i][0], r[i][1], mx, my); }
      c.lineTo(r[r.length - 1][0], r[r.length - 1][1]);
      c.strokeStyle = pass ? 'rgba(60,85,95,.55)' : 'rgba(90,120,130,.16)'; c.lineWidth = pass ? 2.2 : 9; c.lineCap = 'round'; c.stroke();
    }
    // 성 경계: 붓점선
    const step = 5; let k = 0;
    for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) {
      const p = provinceAt(x, y), pr = provinceAt(x + step, y), pd = provinceAt(x, y + step);
      if (p !== pr || p !== pd) { k++; if (k % 3 === 0) continue; c.fillStyle = `rgba(40,32,24,${0.25 + hash(k) * 0.25})`; c.beginPath(); c.arc(x + step / 2, y + step / 2, 0.9 + hash(k * 2) * 0.9, 0, 7); c.fill(); }
    }
    // 화폭 테두리
    c.strokeStyle = 'rgba(29,26,22,.6)'; c.lineWidth = 3; c.strokeRect(6, 6, W - 12, H - 12);
    c.restore();
  }
  function mountain(c, x, y, s) {
    const g = c.createLinearGradient(0, y - s, 0, y + s * 0.3);
    g.addColorStop(0, 'rgba(35,30,25,.55)'); g.addColorStop(0.55, 'rgba(70,62,52,.18)'); g.addColorStop(1, 'rgba(70,62,52,0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(x - s * 1.3, y + s * 0.3);
    c.quadraticCurveTo(x - s * 0.5, y - s * 0.3, x - s * 0.1, y - s); c.quadraticCurveTo(x + s * 0.2, y - s * 0.5, x + s * 0.45, y - s * 0.62);
    c.quadraticCurveTo(x + s * 0.9, y - s * 0.1, x + s * 1.4, y + s * 0.3); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(29,26,22,.5)'; c.lineWidth = 1.1; c.beginPath(); c.moveTo(x - s * 1.1, y + s * 0.15);
    c.quadraticCurveTo(x - s * 0.5, y - s * 0.3, x - s * 0.1, y - s); c.quadraticCurveTo(x + s * 0.2, y - s * 0.5, x + s * 0.45, y - s * 0.62); c.stroke();
  }
  function drawWash() {
    const st = game.state;
    for (const [cv, prov] of [[wash, false], [provWash, true]]) {
      const c = cv.getContext('2d'); c.setTransform(WQ, 0, 0, WQ, 0, 0); c.clearRect(0, 0, W, H);
      if (!prov) {
        for (const pl of [...Object.values(st.towns), ...Object.values(st.villages)]) {
          const own = pl.owner; if (!own && !pl.contested) continue;
          const col = own ? FACTIONS[own].color : '#8a7f6c';
          const r = pl.size === 'village' ? 26 : 30 + SIZE_RANK[pl.size] * 7;
          blot(c, pl.x, pl.y, r, col, own ? (own === 'cw' ? 0.42 : 0.3) : 0.14, pl.id);
        }
      } else {
        for (const P of PROVINCES) {
          const cnt = {}; for (const t of Object.values(st.towns)) if (t.prov === P.id && t.owner) cnt[t.owner] = (cnt[t.owner] || 0) + 1;
          const top = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0]; if (!top) continue;
          blot(c, P.x, P.y, 85 + top[1] * 8, FACTIONS[top[0]].color, top[0] === 'cw' ? 0.38 : 0.24, P.id);
        }
      }
    }
    washDirty = false; dirty = true;
  }
  function blot(c, x, y, r, col, a, seed) {
    const sd = [...String(seed)].reduce((s, ch) => s + ch.charCodeAt(0), 0);
    for (let i = 0; i < 4; i++) {
      const ox = (hash(sd + i) - 0.5) * r * 0.5, oy = (hash(sd * 3 + i) - 0.5) * r * 0.5, rr = r * (0.6 + hash(sd * 7 + i) * 0.45);
      const g = c.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rr);
      g.addColorStop(0, hexA(col, a)); g.addColorStop(0.7, hexA(col, a * 0.55)); g.addColorStop(1, hexA(col, 0));
      c.fillStyle = g; c.beginPath(); c.arc(x + ox, y + oy, rr, 0, 7); c.fill();
    }
  }
  const hexA = (h, a) => { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a.toFixed(3)})`; };
  const SIZE_RANK = { village: 0, small: 0, large: 1, town: 2, mid: 3, city: 4 };

  function resize() {
    const r = canvas.getBoundingClientRect(); vw = r.width; vh = r.height;
    canvas.width = Math.round(vw * DPR); canvas.height = Math.round(vh * DPR);
    setLevel(level, true); dirty = true;
  }
  function camFor(l) {
    const pad = 10;
    if (l === 0) { const s = Math.min((vw - pad) / W, (vh - 60) / H); return { x: W / 2, y: H / 2 + 10 / s, s }; }
    const ts = [...Object.values(game.state.towns), ...Object.values(game.state.villages)].filter(t => t.prov === focus.prov);
    let x0 = Math.min(...ts.map(t => t.x)) - 50, x1 = Math.max(...ts.map(t => t.x)) + 50, y0 = Math.min(...ts.map(t => t.y)) - 50, y1 = Math.max(...ts.map(t => t.y)) + 60;
    const s1 = Math.min(vw / (x1 - x0), (vh - 70) / (y1 - y0));
    if (l === 1) return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 + 20 / s1, s: s1 };
    const t = game.place(focus.town) || ts[0];
    return { x: t.x, y: t.y + 30 / (s1 * 2.4), s: Math.max(s1 * 2.4, 2.2) };
  }
  function setLevel(l, instant) {
    level = Math.max(0, Math.min(2, l)); Object.assign(target, camFor(level));
    if (instant) Object.assign(cam, target);
    ui.onLevel?.(level); dirty = true;
  }
  const toWorld = (sx, sy) => ({ x: cam.x + (sx - vw / 2) / cam.s, y: cam.y + (sy - vh / 2) / cam.s });
  const toScreen = (x, y) => ({ x: (x - cam.x) * cam.s + vw / 2, y: (y - cam.y) * cam.s + vh / 2 });

  function frame(dt) {
    const k = 1 - Math.pow(0.0008, dt);
    for (const key of ['x', 'y', 's']) { const d = target[key] - cam[key]; if (Math.abs(d) > (key === 's' ? 1e-4 : 0.05)) { cam[key] += d * k; dirty = true; } else cam[key] = target[key]; }
    pulseT += dt;
    if (washDirty) drawWash();
    const st = game.state; const hasAlert = Object.keys(ui.alerts || {}).length > 0;
    if (!dirty && !hasAlert && !selected && !st.tasks.length) return;
    if (!dirty && pulseT % 0.1 > dt) return; // 깜빡임만 있을 땐 10fps로 아끼기
    dirty = false;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = '#e7dcc3'; ctx.fillRect(0, 0, vw, vh);
    ctx.setTransform(DPR * cam.s, 0, 0, DPR * cam.s, DPR * (vw / 2 - cam.x * cam.s), DPR * (vh / 2 - cam.y * cam.s));
    ctx.drawImage(base, 0, 0, W, H);
    const pz = Math.max(0, Math.min(1, (0.55 - cam.s) / 0.25)); // 멀리 볼수록 성 단위 물감
    if (pz < 1) { ctx.globalAlpha = 1 - pz; ctx.drawImage(wash, 0, 0, W, H); }
    if (pz > 0) { ctx.globalAlpha = pz; ctx.drawImage(provWash, 0, 0, W, H); }
    ctx.globalAlpha = 1;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawLabels(st, pz);
  }
  function drawLabels(st, pz) {
    const s = cam.s;
    // 성 이름
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (s < 0.9) for (const P of PROVINCES) {
      const p = toScreen(P.x, P.y); const big = level === 0;
      ctx.font = `700 ${big ? 15 : 17}px "Noto Serif KR",serif`; ctx.fillStyle = P.id === st.homeProv ? '#2E6E73' : 'rgba(29,26,22,.78)';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(239,230,210,.85)'; ctx.strokeText(P.name, p.x, p.y - (big ? 0 : 0)); ctx.fillText(P.name, p.x, p.y);
      const n = ui.alertsByProv?.[P.id]; if (n && big) badge(p.x + 22, p.y - 12, n);
    }
    if (s < 0.45) { // 천하: 본산 깃발만
      const h = game.place(st.home), p = toScreen(h.x, h.y); flag(p.x, p.y - 18); return;
    }
    const places = [...Object.values(st.towns), ...Object.values(st.villages)];
    for (const pl of places) {
      const p = toScreen(pl.x, pl.y); if (p.x < -40 || p.x > vw + 40 || p.y < -40 || p.y > vh + 40) continue;
      const isV = pl.size === 'village'; const rk = SIZE_RANK[pl.size];
      const r = (isV ? 4 : 5 + rk * 1.6) * Math.min(1.8, Math.max(1, s * 0.9));
      if (isV && s < 0.8) { ctx.fillStyle = 'rgba(29,26,22,.45)'; ctx.beginPath(); ctx.arc(p.x, p.y, 2.4, 0, 7); ctx.fill(); continue; }
      icon(p.x, p.y, r, pl, isV);
      const showName = !isV || s > 1.1;
      if (showName) {
        const fs = Math.max(13, Math.min(17, 11 + s * 2.2)) | 0;
        ctx.font = `${pl.owner === 'cw' || pl.home ? 700 : 600} ${fs}px "Noto Serif KR",serif`;
        ctx.lineWidth = 3.2; ctx.strokeStyle = 'rgba(239,230,210,.9)';
        const ny = p.y + r + fs * 0.75;
        ctx.strokeText(pl.name, p.x, ny); ctx.fillStyle = pl.owner === 'cw' ? '#1f5256' : '#1d1a16'; ctx.fillText(pl.name, p.x, ny);
      }
      if (pl.home) flag(p.x, p.y - r - 8);
      if (pl.holy) { ctx.font = '700 13px serif'; ctx.fillStyle = '#b8893a'; ctx.fillText('聖', p.x + r + 7, p.y - r); }
      if (selected === pl.id) { ctx.strokeStyle = '#C2402F'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(p.x, p.y, r + 7 + Math.sin(pulseT * 5) * 1.5, 0, 7); ctx.stroke(); }
      const a = ui.alerts?.[pl.id]; if (a) badge(p.x + r + 4, p.y - r - 4, '!');
      if (pl.biz.some(b => b.owner === 'hd' && b.type === 'sanchae') && s > 0.7) { ctx.font = '700 13px serif'; ctx.fillStyle = '#4b4038'; ctx.fillText('寨', p.x - r - 8, p.y - r); }
    }
    // 일하는 사람 표시
    const at = {};
    for (const t of st.tasks) { const id = String(t.target).split('#')[0]; const pl = game.place(id) || (t.place && game.place(t.place)); const where = pl ? pl.id : st.home; (at[where] = at[where] || []).push(...t.people); }
    for (const [pid, ids] of Object.entries(at)) {
      const pl = game.place(pid); if (!pl) continue; const p = toScreen(pl.x, pl.y);
      ids.slice(0, 4).forEach((id, i) => { const pp = game.person(id); if (!pp) return; const x = p.x - 14 + i * 13, y = p.y - 24 - (pl.home ? 16 : 0);
        ctx.fillStyle = '#2E6E73'; ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fill(); ctx.strokeStyle = '#f4ecd9'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = '700 9px sans-serif'; ctx.fillText(game.name(pp)[0], x, y + 0.5); });
    }
  }
  function icon(x, y, r, pl, isV) {
    const col = pl.owner ? FACTIONS[pl.owner].color : '#3a342c';
    ctx.fillStyle = pl.owner === 'cw' ? '#2E6E73' : 'rgba(244,236,217,.95)'; ctx.strokeStyle = col === '#3a342c' ? '#1d1a16' : col; ctx.lineWidth = 1.8;
    if (isV) { ctx.beginPath(); ctx.moveTo(x - r, y + r * 0.6); ctx.lineTo(x, y - r * 0.8); ctx.lineTo(x + r, y + r * 0.6); ctx.closePath(); ctx.fill(); ctx.stroke(); return; }
    // 지붕 + 몸채(크기만큼 층)
    ctx.beginPath(); ctx.rect(x - r * 0.75, y - r * 0.2, r * 1.5, r * 0.95); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - r * 1.15, y - r * 0.15); ctx.quadraticCurveTo(x, y - r * 1.35, x + r * 1.15, y - r * 0.15); ctx.closePath();
    ctx.fillStyle = pl.owner === 'cw' ? '#1f5256' : pl.owner ? col : '#3a342c'; ctx.fill();
    if (pl.contested) { ctx.setLineDash([3, 3]); ctx.strokeStyle = '#C2402F'; ctx.beginPath(); ctx.arc(x, y, r * 1.6, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
  }
  function flag(x, y) { ctx.strokeStyle = '#1d1a16'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x, y + 10); ctx.lineTo(x, y - 8); ctx.stroke(); ctx.fillStyle = '#2E6E73'; ctx.beginPath(); ctx.moveTo(x, y - 8); ctx.quadraticCurveTo(x + 9, y - 9, x + 14, y - 4); ctx.lineTo(x, y - 1); ctx.fill(); }
  function badge(x, y, t) { const a = 0.75 + Math.sin(pulseT * 6) * 0.25; ctx.fillStyle = `rgba(194,64,47,${a})`; ctx.beginPath(); ctx.arc(x, y, 8, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '700 11px sans-serif'; ctx.fillText(String(t), x, y + 0.5); }

  // ── 손가락 ──
  const pts = new Map(); let pinch = null, drag = null, lastTap = 0, lastTapXY = null;
  canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.offsetX, y: e.offsetY, x0: e.offsetX, y0: e.offsetY, t: performance.now() });
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y), s0: cam.s, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }; drag = null; }
    else if (pts.size === 1) drag = { x: e.offsetX, y: e.offsetY, cx: cam.x, cy: cam.y, moved: false }; });
  canvas.addEventListener('pointermove', e => { const p = pts.get(e.pointerId); if (!p) return; p.x = e.offsetX; p.y = e.offsetY;
    if (pinch && pts.size >= 2) { const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); pinch.ratio = d / pinch.d0; cam.s = target.s = pinch.s0 * pinch.ratio; dirty = true; }
    else if (drag) { const dx = e.offsetX - drag.x, dy = e.offsetY - drag.y; if (Math.hypot(dx, dy) > 8) drag.moved = true;
      if (drag.moved && level > 0) { cam.x = target.x = drag.cx - dx / cam.s; cam.y = target.y = drag.cy - dy / cam.s; clampCam(); dirty = true; } } });
  const up = e => { const p = pts.get(e.pointerId); pts.delete(e.pointerId);
    if (pinch) { if (pts.size === 0) { const r = pinch.ratio || 1; const w = toWorld(pinch.mid.x, pinch.mid.y);
        if (r > 1.18 && level < 2) { focusAt(w, level + 1); setLevel(level + 1); haptic(8); } else if (r < 0.85 && level > 0) { setLevel(level - 1); haptic(8); } else setLevel(level); pinch = null; } return; }
    if (!p || !drag) return; const moved = drag.moved; drag = null; if (moved) return;
    const now = performance.now(); const dbl = now - lastTap < 300 && lastTapXY && Math.hypot(lastTapXY.x - p.x, lastTapXY.y - p.y) < 30;
    lastTap = now; lastTapXY = { x: p.x, y: p.y };
    if (dbl && level < 2) { focusAt(toWorld(p.x, p.y), level + 1); setLevel(level + 1); haptic(8); return; }
    tap(p.x, p.y); };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', e => { pts.delete(e.pointerId); pinch = null; drag = null; });
  canvas.addEventListener('wheel', e => { e.preventDefault(); const w = toWorld(e.offsetX, e.offsetY); if (e.deltaY < 0 && level < 2) { focusAt(w, level + 1); setLevel(level + 1); } else if (e.deltaY > 0 && level > 0) setLevel(level - 1); }, { passive: false });
  function clampCam() { const m = 80; cam.x = target.x = Math.max(m, Math.min(W - m, cam.x)); cam.y = target.y = Math.max(m, Math.min(H - m, cam.y)); }
  function nearest(w, maxPx) { let best = null, bd = 1e9; const s = cam.s;
    for (const pl of [...Object.values(game.state.towns), ...Object.values(game.state.villages)]) { if (pl.size === 'village' && s < 0.8) continue; const d = Math.hypot(pl.x - w.x, pl.y - w.y) * s; if (d < bd) { bd = d; best = pl; } }
    return bd <= maxPx ? best : null; }
  function focusAt(w, toLevel) { const P = provinceAt(w.x, w.y); if (toLevel >= 1 && P) focus.prov = P.id; if (toLevel === 2) { const t = nearest(w, 9999); if (t) { focus.town = t.id; focus.prov = t.prov; } } }
  function tap(x, y) {
    const w = toWorld(x, y);
    if (level === 0) { const P = provinceAt(w.x, w.y); if (P) { focus.prov = P.id; setLevel(1); haptic(8); } return; }
    const pl = nearest(w, 30);
    if (pl) { selected = pl.id; focus.town = pl.id; dirty = true; haptic(10); ui.openPlace(pl.id); } else { selected = null; dirty = true; }
  }
  return {
    resize, frame, setLevel, get level() { return level; },
    goHome() { focus.prov = game.state.homeProv; focus.town = game.state.home; setLevel(Math.max(1, level === 0 ? 1 : level)); },
    focusPlace(id, l = 2) { const pl = game.place(id); if (!pl) return; focus.prov = pl.prov; focus.town = id; selected = id; setLevel(l); },
    setLevelFromSeg(l) { if (l >= 1 && !focus.prov) focus.prov = game.state.homeProv; setLevel(l); },
    clearSel() { selected = null; dirty = true; },
    redrawWash() { washDirty = true; }, redraw() { dirty = true; },
    init() { drawBase(); resize(); setLevel(1, true); },
    debug: () => ({ level, cam: { ...cam } }),
  };
}
