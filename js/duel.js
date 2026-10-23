// F8 v0.5.1 일기토 (sim_v051.py duel() 이식). 0.1초 단위 스텝, 기세 때 파훼 판정을 외부(손/확률)에서 받는다.
'use strict';
(function (root) {
const D = root.D || require('./data.js');
if (!D.MG && typeof require !== 'undefined') require('./mugong_data.js');
// FNV-1a (패치노트 4-1 ①): 입력 순서대로 각 값 >>>0 → 4바이트(낮은 바이트부터)
function hash32() { let h = 0x811c9dc5; for (let i = 0; i < arguments.length; i++) { const v = arguments[i] >>> 0; for (let k = 0; k < 4; k++) { h ^= (v >>> (8 * k)) & 255; h = Math.imul(h, 0x01000193); } } return h >>> 0; }
const KD = { 기수식: 'g', 초식: 'c', 절초: 'j', 단초: 'c' };
function mulberry(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const F8 = { hpk:45, boss_hp:1.2, p_skill0:20, e_skill0:50, skill_cd:70, gise0:30, gise_cd:60, heal_at:0.4, heal:0.25, heal_j4:0.35, m_heal:0.25, tlim:900, assist:0.15 };
// p = {realm, mu, ne, ji, grade, mer, gsk, cdRed(0.1s), atkMul, firstMul}
// e = [경지, 무, 내, 지, 등급, 특기, 종류(n/b/m), 이름], opts = {eHpMul, window(초)}
class Duel {
  constructor(p, e, opts, rng, seed) {
    opts = opts || {}; this.rng = rng || Math.random; this.p = p; this.e = e; this.log = [];
    this.f20 = !!(p.pool && p.pool.length);
    const [er, em, en, ej, eg, tr, ek] = e; this.tr = tr; this.ek = ek;
    this.auto = null;
    if (p.realm - er >= 2) this.auto = true; else if (er - p.realm >= 2) this.auto = false;
    this.pa = p.mu * D.MULT[p.realm] * (p.atkMul || 1);
    this.php = p.ne * F8.hpk * D.MULT[p.realm] * (p.mer >= 12 ? 1.1 : 1);
    this.ea = em * D.MULT[er];
    this.ehp = en * F8.hpk * D.MULT[er] * (ek === 'b' ? F8.boss_hp : 1) * (opts.eHpMul || 1);
    this.hp = this.php; this.he = this.ehp;
    this.pcd = Math.max(20, (p.mer >= 8 ? 60 : F8.skill_cd) - (p.cdRed || 0));
    this.heal = p.mer >= 4 ? F8.heal_j4 : F8.heal;
    this.ppct = D.GPCT[p.grade] * (1 + 0.1 * (p.gsk || 0));
    this.ns = F8.p_skill0; this.es = F8.e_skill0; this.nextg = F8.gise0;
    this.stun = 0; this.t = 0; this.nh = 0; this.neh = 0; this.gise = 0; this.okp = 0;
    this.eint = tr === '쾌검' ? 10 / 1.2 : 10; this.nextea = this.eint; this.first = true; this.pfirst = true;
    this.dmgIn = tr === '철벽' ? 0.85 : 1; this.stunLen = tr === '고수' ? 15 : 20;
    this.poison = 0; this.fails2 = 0; this.done = null; this.waiting = false;
    this.baseWindow = opts.window || 1.2; this.pskillReadyAt = this.ns;
    if (this.f20) this.init20(p, opts, seed);
  }
  // ---------- F20 (1a 무공) — sim_v073_duel.duel + v0.7.7/0.7.8 예약 ----------
  init20(p, opts, seed) {
    const DU = D.DUEL; this.pool = p.pool; this.n = p.pool.length;
    this.rngPick = mulberry(((seed >>> 0) ^ 0x5eed) >>> 0);
    this.qmax = DU.QI_MAX(D.QI_NY[p.realm]); this.qi = this.qmax; this.nhs = 0;
    this.hot = (opts.hot || []).filter(i => i != null && i >= 0 && i < this.n);
    this.cdu = {}; this.hist = []; this.deck = new Set(); this.reserve = null; this.man = 0; this.lastInfo = null;
    const es = opts.eset && D.ESET[opts.eset]; this.eset = es || null;
    this.etend = es ? es.tend : (opts.etend || null); this.mode = es ? es.mode : null;
    const B = D.BEATS; this.padj = (p.ptend && B[p.ptend] === this.etend) ? D.ADV : (this.etend && B[this.etend] === p.ptend) ? -D.ADV : 0;
    this.ecd = this.mode === '중' ? 85 : F8.skill_cd;
    this.emul = { 강: 1.2, 쾌: 1.1, 중: 1.25, 유: 0.8, 독: 0.8 }[this.mode] || 1.0;
    this.heal += p.hadd || 0; this.dodge = p.dodge || 0; this.roll = !!p.roll; this.rolled = false; this.firstm = p.firstm || 0; this.pb = p.pb || 0;
    this.brkV = 0; this.brkU = -1; this.bldV = 0; this.bldU = -1; this.dazeU = -1; this.grdV = 0; this.grdU = -1; this.winB = 0; this.ctr = 0;
    this.eturn = 0; this.manPow = D.DUEL.MAN_POW[p.realm >= 6 ? 'high' : 'low'];
  }
  cdOf(i, manual) { const k = this.pool[i].kind; return (D.DUEL.CDM[k === '단초' ? '초식' : k] || 100) + (manual ? D.DUEL.MAN_CD : 0); }
  sitw(i) { // sim_v073 sitw (W1~W6)
    const s = this.pool[i], t = this.t; let w = D.DUEL.BASEW[s.kind] || 1;
    const hpr = this.hp / this.php, her = this.he / this.ehp, estop = this.stun > 0 || t < this.dazeU, burst = this.stun > 0 || t < this.brkU;
    for (const [k, v] of s.eff) {
      if ((k === 'int' || k === 'daze') && !estop && this.es - t >= 0 && this.es - t <= 20) w *= 3.0;
      if (k === 'heal') w *= this.nhs < D.DUEL.HEAL_MAX ? (hpr < 0.5 ? 3.0 : 0.5) : 0.3;
      if (k === 'grd' && hpr < 0.5) w *= 2.5;
      if ((k === 'win' || k === 'ctr') && this.nextg - t >= 0 && this.nextg - t <= 30) w *= 2.5;
      if (k === 'bld') w *= (this.ek === 'b' || her > 0.6) ? 1.5 : her < 0.3 ? 0.5 : 1.0;
      if (k === 'brk' && burst) w *= 0.5;
    }
    return w;
  }
  wheel() { if (this.deck.size >= this.n) this.deck.clear(); }
  pickAuto() {
    const t = this.t; this.wheel(); if (!this.hist.length) return 0;
    const ready = []; for (let i = 0; i < this.n; i++) if ((this.cdu[i] == null ? -1 : this.cdu[i]) <= t && !this.deck.has(i)) ready.push(i);
    let cand = ready; if (!cand.length) { cand = []; for (let i = 0; i < this.n; i++) if (!this.deck.has(i)) cand.push(i); } if (!cand.length) cand = this.pool.map((_, i) => i);
    const last = this.hist[this.hist.length - 1];
    const ws = cand.map(i => this.sitw(i) * (last === i ? D.DUEL.PREV_W : 1)); let r = this.rngPick() * ws.reduce((a, b) => a + b, 0);
    for (let k = 0; k < cand.length; k++) { r -= ws[k]; if (r <= 0) return cand[k]; }
    return cand[cand.length - 1];
  }
  cdLeft(i) { return Math.max(0, (this.cdu[i] == null ? -1 : this.cdu[i]) - this.t); }
  canReserve(i) {
    if (!this.f20 || this.waiting || this.done || !this.hist.length) return false;
    if (this.hot.indexOf(i) < 0) return false; const s = this.pool[i]; if (!s || s.sasin || s.lock) return false;
    this.wheel(); return this.qi >= s.qi && this.cdLeft(i) <= 0 && !this.deck.has(i);
  }
  reserveSkill(i) { if (this.reserve === i) { this.reserve = null; return true; } if (!this.canReserve(i)) return false; this.reserve = i; return true; }
  cast(i, manual) {
    const s = this.pool[i], t = this.t; this.cdu[i] = t + this.cdOf(i, manual); this.hist.push(i); this.deck.add(i);
    const d = this.pa * s.pw * this.b * (manual ? this.manPow : 1); this.he -= d;
    const tags = [];
    for (const [k, v, dd] of s.eff) {
      if (k === 'win') this.winB += v;
      else if (k === 'brk') { this.brkV = v / 100; this.brkU = t + Math.trunc(dd * 10); }
      else if (k === 'bld' || k === 'psn') { this.bldV = v / 100; this.bldU = t + Math.trunc(dd * 10); }
      else if (k === 'daze') this.dazeU = Math.max(this.dazeU, t + Math.trunc(v * 10));
      else if (k === 'int') { if (this.es > t) this.es += Math.trunc(v * 10); }
      else if (k === 'ctr') this.ctr = v;
      else if (k === 'heal') { if (this.nhs < D.DUEL.HEAL_MAX) { this.hp = Math.min(this.php, this.hp + this.php * v / 100); this.nhs++; } }
      else if (k === 'grd') { this.grdV = v / 100; this.grdU = t + Math.trunc(dd * 10); }
      tags.push(k);
    }
    if (manual) { this.man++; this.qi -= s.qi; }
    this.ev.push(['pskill', d, s.id, s.hits, !!manual, tags]); this.L((manual ? '✋ ' : '') + s.name + ' ' + Math.round(d));
  }
  stepA20() {
    const r = this.rng, t = this.t, DU = D.DUEL;
    this.b = (this.stun > 0 ? 1.5 : 1) * this.dmgIn * (t < this.brkU ? 1 + this.brkV : 1); this.hp0 = this.hp;
    this.gin = t < this.grdU ? 1 - this.grdV : 1; const estop = this.stun > 0 || t < this.dazeU;
    this.ev = [];
    this.qi = Math.min(this.qmax, this.qi + DU.QI_REG / 10);
    if (t > 0 && t % 10 === 0) {
      let d = this.pa * (r() < this.p.ji / 400 ? 1.5 : 1) * this.b;
      if (this.pfirst && this.firstm) d *= 1 + this.firstm;
      if (this.pfirst && this.p.firstMul) d *= this.p.firstMul;
      this.pfirst = false; this.he -= d; this.ev.push(['phit', d, false]);
    }
    if (t >= this.ns) {
      let i = null, manual = false;
      if (this.hist.length && this.reserve != null) {
        const ri = this.reserve; this.reserve = null; this.wheel();
        if (this.cdLeft(ri) <= 0 && !this.deck.has(ri)) {
          if (this.qi < this.pool[ri].qi) this.ev.push(['resfail', ri]); else { i = ri; manual = true; }
        }
      }
      if (i == null) i = this.pickAuto();
      this.cast(i, manual); this.ns = t + (manual ? Math.round(this.pcd * DU.MAN_LAG) : this.pcd); this.lastCastT = t; this.lastLag = this.ns - t;
    }
    if (t < this.bldU && t % 10 === 5) this.he -= this.ehp * this.bldV;
    if (this.gise === 0 && this.he < 1) this.he = 1;
    if (this.ek === 'm' && this.he < this.ehp * F8.heal_at && this.neh < 1 && this.he > 0) { this.he += this.ehp * F8.m_heal; this.neh++; this.ev.push(['eheal']); this.L('적 운기조식'); }
    if (this.he <= 0) { this.done = { win: true, t: t / 10 }; this.L('승리'); return; }
    if (t >= this.es && !estop) {
      const d = this.ea * D.GPCT[this.e[4]] * this.emul * this.gin; this.hp -= d; this.es = t + this.ecd;
      const nm = this.eset ? this.eset.moves[this.eturn++ % 2] : null; this.ev.push(['eskill', d, nm]); this.L((nm ? '「' + nm + '」 ' : '적 초식 ') + Math.round(d));
      if (this.tr === '독공' || this.mode === '독') this.poison = 30;
      if (this.mode === '유') this.he = Math.min(this.ehp, this.he + this.ehp * 0.03);
    }
    if (t === this.nextg) { this.gise++; this.nextg += F8.gise_cd; this.waiting = true; this.L('기세 #' + this.gise + (this.eset ? ' 「' + this.eset.kill[0] + '」' : '')); return; }
    if (t >= this.nextea - 1e-9) {
      if (!estop) {
        let d = this.ea * (r() < this.e[3] / 400 ? 1.5 : 1);
        if (this.first && this.tr === '돌격') d *= 2;
        if (this.dodge && r() < this.dodge) { d = 0; this.ev.push(['pdodge']); }
        this.first = false; this.hp -= d * this.gin; if (d) this.ev.push(['ehit', d * this.gin]);
      }
      this.nextea += this.eint;
    }
    this.stepB();
  }
  parryBonus() { return this.f20 ? this.padj + this.pb + this.winB * D.WIN_K : 0; }
  window() { const w = this.baseWindow + (this.fails2 >= 2 ? 0.5 : 0); if (!this.f20) return w; return Math.max(0.9, w + this.winB + (this.padj > 0 ? 0.3 : this.padj < 0 ? -0.3 : 0) + this.pb / D.WIN_K); }
  L(s) { this.log.push((this.t / 10).toFixed(1) + '초 ' + s); }
  // 한 스텝 앞부분. 기세가 오면 waiting=true로 멈춘다.
  stepA() {
    if (this.done) return;
    if (this.auto !== null) { this.done = { win: this.auto, t: 1, auto: true }; this.L(this.auto ? '경지 차 2 이상: 자동 승리' : '경지 차 2 이상: 자동 패배'); return; }
    if (this.t >= F8.tlim) { this.done = { win: this.he / this.ehp < this.hp / this.php, t: 90, timeout: true }; return; }
    if (this.f20) return this.stepA20();
    const r = this.rng, t = this.t, b = (this.stun > 0 ? 1.5 : 1) * this.dmgIn;
    this.ev = [];
    if (t > 0 && t % 10 === 0) {
      let d = this.pa * (r() < this.p.ji / 400 ? 1.5 : 1) * b;
      if (this.pfirst && this.p.firstMul) { d *= this.p.firstMul; }
      this.pfirst = false; this.he -= d; this.ev.push(['phit', d]);
    }
    if (t >= this.ns) { const d = this.pa * this.ppct * b; this.he -= d; this.ns = t + this.pcd; this.ev.push(['pskill', d]); this.L('내 초식 ' + Math.round(d)); }
    if (this.gise === 0 && this.he < 1) this.he = 1; // 첫 기세 보장
    if (this.ek === 'm' && this.he < this.ehp * F8.heal_at && this.neh < 1 && this.he > 0) { this.he += this.ehp * F8.m_heal; this.neh++; this.ev.push(['eheal']); this.L('적 운기조식'); }
    if (this.he <= 0) { this.done = { win: true, t: t / 10 }; this.L('승리'); return; }
    if (t >= this.es && this.stun <= 0) {
      const d = this.ea * D.GPCT[this.e[4]]; this.hp -= d; this.es = t + F8.skill_cd; this.ev.push(['eskill', d]); this.L('적 초식 ' + Math.round(d));
      if (this.tr === '독공') this.poison = 30;
    }
    if (t === this.nextg) { this.gise++; this.nextg += F8.gise_cd; this.waiting = true; this.L('기세 #' + this.gise); return; }
    if (t >= this.nextea - 1e-9) {
      if (this.stun <= 0) {
        let d = this.ea * (r() < this.e[3] / 400 ? 1.5 : 1);
        if (this.first && this.tr === '돌격') d *= 2;
        this.first = false; this.hp -= d; this.ev.push(['ehit', d]);
      }
      this.nextea += this.eint;
    }
    this.stepB();
  }
  parry(ok) {
    if (!this.waiting) return;
    this.waiting = false;
    if (ok) { this.stun = this.stunLen; this.okp++; this.fails2 = 0; this.ev.push(['parryok']); this.L('파훼 성공');
      if (this.f20) { this.qi = Math.min(this.qmax, this.qi + D.DUEL.QI_PARRY); if (this.ctr) { const c = this.pa * this.ctr * this.dmgIn; this.he -= c; this.ctr = 0; this.ev.push(['ctr', c]); this.L('반격 ' + Math.round(c)); } } }
    else { const d = this.ea * 3 * (this.f20 ? this.gin : 1); this.hp -= d; this.fails2++; this.ev.push(['parryfail', d]); this.L('파훼 실패 강타 ' + Math.round(d)); }
    if (this.f20) this.winB = 0;
    this.stepB();
  }
  stepB() {
    if (this.poison > 0) { if (this.poison % 10 === 0) this.hp -= this.php * 0.01; this.poison--; }
    if (this.hp < this.php * F8.heal_at && this.nh < 1 && this.hp > 0) { this.hp = Math.min(this.php, this.hp + this.php * this.heal); this.nh++; this.ev.push(['pheal']); this.L('운기조식 자동'); }
    if (this.hp <= 0) {
      if (this.f20 && this.roll && !this.rolled && this.hp0 >= this.php * 0.3) { this.hp = 1; this.rolled = true; this.ev.push(['roll']); this.L('미종보 — 땅을 굴러 피했다'); }
      else { this.done = { win: false, t: this.t / 10 }; this.L('패배'); return; }
    }
    this.stun--; this.t++;
  }
  // 확률 파훼로 끝까지 (예상 승률·디버그용)
  runSim(parryRate) {
    let guard = 0;
    while (!this.done && guard++ < 5000) {
      this.stepA();
      if (this.waiting) this.parry(this.rng() < Math.min(0.95, parryRate + (this.fails2 >= 2 ? F8.assist : 0) + this.parryBonus()));
    }
    return { win: this.done.win, t: this.done.t, gise: this.gise, ok: this.okp };
  }
}
const cache = {};
function winProb(p, e, opts, parry, n) {
  n = n || 100; const key = JSON.stringify([p, e, opts, Math.round(parry * 100)]);
  if (cache[key]) return cache[key];
  const rng = mulberry(7); let w = 0, len = 0, g = 0;
  for (let i = 0; i < n; i++) { const r = new Duel(p, e, opts, rng, i).runSim(parry); if (r.win) w++; len += r.t; g += r.gise; }
  return (cache[key] = { w: w / n, len: len / n, gise: g / n });
}
function band(w) { return w >= 0.9 ? ['쉬움','g'] : w >= 0.6 ? ['해볼 만함','y'] : w >= 0.2 ? ['위험','o'] : ['무모','r']; }
const api = { Duel, winProb, band, mulberry, hash32, F8, KD };
if (typeof module !== 'undefined') module.exports = api; else root.DuelLib = api;
})(typeof window !== 'undefined' ? window : globalThis);
