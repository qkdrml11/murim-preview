// 일기토 화면(§5-8): 두루마리 카드 3장 · 4초 · 길게 눌러 설명(시간 멈춤) · 큰 초식 원 · 기세 줄 · 서예 충돌.
import { buildFighter, createDuel, startRound, resolve, canPlay, highlights, resolveAuto, TIMER_MS, BEATS } from '../systems/duel.js';
import { TYPE_HANJA, TYPE_NAME } from '../data/mugong.js';
import { REALM } from '../data/people.js';
import { el, esc, haptic, hintIcon, HINT_TEXT, fighterSvg } from './util.js';
import { modal } from './modal.js';

const TYPE_CLS = { atk: 'atk', def: 'def', evade: 'evade' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
export function createDuelUI(game) {
  const root = document.getElementById('duel');
  let busy = false;
  const S = () => game.state.settings;
  const fast = () => (game.opts.debugSpeed > 1 ? 0.25 : 1);

  async function request(full) {
    // 열리기 전: 시작 카드(잠금 문구) / 열린 뒤: "자동으로 진행하시겠습니까?"(추천 쪽에 테두리)
    const allyName = game.name(full.ally), foeName = full.foe.label || full.foe.name;
    const pct = Math.round(full.p * 100), autoPct = Math.max(0, pct - 5);
    let how;
    if (!full.unlocked) {
      how = await modal({ title: full.title || '일기토', cls: 'duel-start', html: `<div class="vs"><div>${esc(allyName)}<br><small class="muted">${REALM[full.ally.realm]}</small></div><div class="x">對</div><div>${esc(foeName)}<br><small class="muted">${REALM[full.foe.realm]}</small></div></div>
        <div class="muted" style="text-align:center">예상: <b>${full.label}</b></div>${full.desc ? `<p>${esc(full.desc)}</p>` : ''}
        <div class="lock">🔒 <span>자동 겨루기 — ${esc(full.lockText)}</span></div>`, choices: [{ id: 'manual', label: '직접 겨루기', primary: true, focus: true }] });
    } else {
      how = await modal({ title: '자동으로 진행하시겠습니까?', html: `<div class="vs"><div>${esc(allyName)}</div><div class="x">對</div><div>${esc(foeName)}</div></div>
        <p style="text-align:center">예상 승률 <b>${full.label}</b> · 직접 ${pct}% / 자동 ${autoPct}%</p>${full.ally.role === 'master' ? '<p class="muted" style="text-align:center">장문인이 나서는 판이라 직접을 권해요.</p>' : ''}`,
        horizontal: true, choices: [{ id: 'manual', label: '직접', primary: full.recommend === 'manual', focus: full.recommend === 'manual' }, { id: 'auto', label: '자동', primary: full.recommend === 'auto', focus: full.recommend === 'auto' }] });
    }
    if (how === 'auto') return autoView(full);
    return manual(full);
  }

  function shell(full, A, B) {
    root.innerHTML = '';
    const node = el(`<div style="display:contents">
      <div class="d-top"><div class="d-names"><div><span class="by">${esc(B.byeolho ? '「' + B.byeolho + '」' : '')}</span> ${esc(B.label || B.name)} <small class="muted">${REALM[B.realm]}</small></div><div class="muted" id="dRound"></div></div>
        <div class="hp"><div><div class="bar"><i id="hpB" style="width:100%;background:#8a2f2a"></i></div></div><div><div class="bar"><i id="hpA" style="width:100%;background:#2E6E73"></i></div></div></div>
        <div class="gauge" id="gauge"><div class="me" id="gMe" style="width:50%"></div><div class="edge" id="gEdge" style="left:50%"></div><div class="ticks"></div></div>
        <div class="d-names"><div><span class="by">${esc(A.byeolho ? '「' + A.byeolho + '」' : '')}</span> ${esc(game.name(full.ally))} <small class="muted">${REALM[A.realm]}</small></div><div class="muted">기세</div></div></div>
      <div class="d-stage" id="stage"><div class="redge" id="redge"></div><div class="fig en" id="figB">${fighterSvg('#5a2420')}<div class="hint" id="hint" style="display:none"></div></div><div class="clash" id="clash"></div><div class="reason" id="reason"></div><div class="fig my" id="figA">${fighterSvg('#1f4f53')}</div></div>
      <div class="d-bottom" id="dBottom"><div class="nae" id="nae"></div><div class="cards" id="cards"></div><div class="d-tools" id="tools"></div></div></div>`);
    root.appendChild(node); root.classList.add('open'); root.setAttribute('aria-hidden', 'false');
  }
  function paint(d) {
    const q = id => root.querySelector('#' + id);
    q('hpA').style.width = (d.hp.A * 100).toFixed(1) + '%'; q('hpB').style.width = (d.hp.B * 100).toFixed(1) + '%';
    const pct = 50 + d.g * 10; q('gMe').style.width = pct + '%'; q('gEdge').style.left = pct + '%';
    q('dRound').textContent = `第${d.round}合 / 10`;
    q('nae').innerHTML = '내력 ' + Array.from({ length: d.A.nMax }, (_, i) => `<i class="${i < d.n.A ? 'f' : ''}"></i>`).join('') + `<span class="timer" id="timer"></span>`;
  }
  async function clash(d, r) {
    const q = id => root.querySelector('#' + id);
    const c = q('clash'); c.innerHTML = '';
    const my = el(`<div class="cw my">${esc(r.my.name)}</div>`), en = el(`<div class="cw en">${esc(r.en.name)}</div>`);
    c.append(en, my); haptic(15);
    await sleep(520 * fast());
    if (r.winner === 'A' || (!r.winner && r.dmg.B > r.dmg.A)) { my.classList.add('win'); en.classList.add('lose'); }
    else if (r.winner === 'B' || r.dmg.A > r.dmg.B) { en.classList.add('win'); my.classList.add('lose'); }
    if (r.dmg.B > 0.001) { dmg(q('figB'), r.dmg.B, true); q('figB').classList.remove('hit'); void q('figB').offsetWidth; q('figB').classList.add('hit'); }
    if (r.dmg.A > 0.001) { dmg(q('figA'), r.dmg.A, false); q('figA').classList.remove('hit'); void q('figA').offsetWidth; q('figA').classList.add('hit'); haptic([20, 30, 20]); if (S().fx !== 'low') { root.classList.remove('shake'); void root.offsetWidth; root.classList.add('shake'); } }
    if (r.fooled && r.winner === 'B') q('stage').appendChild(el('<div class="fooled">속았다!</div>'));
    if (r.overwhelm) { q('gauge').classList.remove('burst'); void q('gauge').offsetWidth; q('gauge').classList.add('burst'); haptic([30, 40, 60]); }
    const rs = q('reason'); rs.textContent = `${TYPE_NAME[r.my.type] || ''}「${r.my.name}」 vs ${TYPE_NAME[r.en.type] || '운기'}「${r.en.name}」 — ${r.reason}`; rs.classList.add('on');
    paint(d);
    q('redge').classList.toggle('on', !!d.bigPending);
    await sleep(1150 * fast());
  }
  function dmg(fig, v, mine) { const n = el(`<div class="dmg ${mine ? 'mine' : ''}" style="left:${40 + Math.random() * 40}px;top:20px">−${Math.round(v * 100)}</div>`); fig.appendChild(n); setTimeout(() => n.remove(), 1000); }

  // ── 직접 ──
  async function manual(full) {
    busy = true;
    const A = buildFighter(full.ally, 'A'), B = buildFighter(full.foe, 'B');
    const d = createDuel(A, B, { seed: Math.floor(game.rng.next() * 1e9) });
    shell(full, A, B); paint(d);
    if (d.done) { await sleep(400); return finish(full, d.done.win, true, d.done.reason); }
    const q = id => root.querySelector('#' + id);
    while (!d.done) {
      const st = startRound(d); paint(d);
      q('stage').appendChild(el(`<div class="seal-round">第${d.round}合</div>`)); setTimeout(() => root.querySelector('.seal-round')?.remove(), 900);
      q('reason').classList.remove('on'); q('clash').innerHTML = '';
      const h = q('hint'); h.style.display = 'flex'; h.innerHTML = hintIcon(st.hint) + `<span>${HINT_TEXT[st.hint]}${st.big ? ' — 큰 초식!' : ''}</span>`;
      q('redge').classList.toggle('on', st.big);
      const pick = await choose(d, st);
      q('hint').style.display = 'none';
      if (pick.ff) { while (!d.done) { resolve(d, autoIdx(d), false); if (!d.done) startRound(d); } paint(d); break; }
      const r = resolve(d, pick.idx, pick.circle);
      await clash(d, r);
    }
    finish(full, d.done.win, true);
  }
  const autoIdx = d => { const ok = d.hand.map((c, i) => [c, i]).filter(([c]) => canPlay(d, c)); const want = Object.keys(BEATS).find(t => BEATS[t] === d.hint); const b = ok.find(([c]) => c.type === want); return (b || ok[0] || [null, 0])[1]; };
  function choose(d, st) {
    return new Promise(res => {
      const q = id => root.querySelector('#' + id);
      const cards = q('cards'); cards.innerHTML = '';
      let left = TIMER_MS, paused = false, done = false, lpTimer = null, last = performance.now();
      st.hand.forEach((c, i) => {
        const ok = canPlay(d, c);
        const n = el(`<button class="card ${TYPE_CLS[c.type]} ${c.big ? 'big' : ''} ${ok ? '' : 'no'} ${c.sealed ? 'sealed' : ''}" data-i="${i}" aria-label="${esc(c.name)}">
          <div class="ty">${TYPE_HANJA[c.type]}</div><div class="cn">${esc(c.name)}</div><div class="cp">${TYPE_NAME[c.type]} · ${Math.round(c.power * (c.mul || 1))}%</div><div class="cp">내력 ${c.cost}</div></button>`);
        n.addEventListener('pointerdown', () => { lpTimer = setTimeout(() => { lpTimer = 'shown'; paused = true; showTip(c); }, 420); });
        const clear = () => { if (lpTimer && lpTimer !== 'shown') clearTimeout(lpTimer); };
        n.addEventListener('pointerleave', clear);
        n.addEventListener('pointerup', async () => {
          if (lpTimer === 'shown') { lpTimer = null; paused = false; hideTip(); return; } clear(); lpTimer = null;
          if (done || !ok) { if (!ok) haptic(5); return; }
          done = true; n.classList.add('picked'); haptic(12);
          let circle = false;
          if (c.big && S().circle) circle = await inkCircle();
          end({ idx: i, circle });
        });
        cards.appendChild(n);
      });
      const tools = q('tools'); tools.innerHTML = '';
      if (game.state.duels.unlocked) { const ff = el('<button class="btn">⏩ 빨리 감기</button>'); ff.onclick = () => { if (done) return; done = true; end({ ff: true }); }; tools.appendChild(ff); }
      function showTip(c) { hideTip(); root.appendChild(el(`<div class="tip" id="tip"><b>${esc(c.name)}</b> ${c.hanja ? esc(c.hanja) : ''} — ${TYPE_NAME[c.type]}(${TYPE_HANJA[c.type]}) · 위력 ${Math.round(c.power * (c.mul || 1))}% · 내력 ${c.cost}<br>공은 변을, 변은 수를, 수는 공을 이겨요.${c.big ? '<br>큰 초식: 원이 줄어들 때 맞춰 누르면 +20%' : ''}<br><small>손을 떼면 시간이 다시 가요.</small></div>`)); }
      function hideTip() { root.querySelector('#tip')?.remove(); }
      function end(v) { done = true; hideTip(); cancelAnimationFrame(raf); res(v); }
      let raf;
      const loop = t => { const dt = t - last; last = t; if (!paused && !done) left -= dt * (game.opts.debugSpeed > 1 ? 4 : 1);
        const tm = root.querySelector('#timer'); if (tm) tm.textContent = `⏳ ${Math.max(0, left / 1000).toFixed(1)}초`;
        if (left <= 0 && !done) { haptic(30); end({ idx: null, circle: false }); return; } raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
    });
  }
  function inkCircle() { // 원이 줄어들어 안쪽 원과 겹칠 때 누르면 +20%
    return new Promise(res => {
      const w = el(`<div class="circleWrap"><svg viewBox="0 0 260 260"><circle cx="130" cy="130" r="46" fill="none" stroke="#C2402F" stroke-width="10" opacity=".55"/><circle id="ring" cx="130" cy="130" r="120" fill="none" stroke="#1d1a16" stroke-width="7" filter="url(#brush)"/></svg><div class="lbl">겹칠 때 누르세요</div></div>`);
      root.querySelector('#stage').appendChild(w);
      const t0 = performance.now(), dur = 1300; let fin = false;
      const ring = w.querySelector('#ring');
      const tick = t => { if (fin) return; const k = (t - t0) / dur; const r = 120 - k * 100; ring.setAttribute('r', Math.max(8, r)); if (k >= 1) return done(false); requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      const done = ok => { if (fin) return; fin = true; w.remove(); if (ok) haptic([10, 20, 40]); res(ok); };
      w.addEventListener('pointerdown', () => { const r = +ring.getAttribute('r'); done(Math.abs(r - 46) <= 13); });
    });
  }
  // ── 자동: 하이라이트 3합 ──
  async function autoView(full) {
    busy = true;
    const r = resolveAuto(full.ally, full.foe, game.rng, full.p);
    const A = buildFighter(full.ally, 'A'), B = buildFighter(full.foe, 'B');
    shell(full, A, B);
    const q = id => root.querySelector('#' + id);
    let skip = false;
    q('tools').innerHTML = ''; const sk = el('<button class="btn">건너뛰기</button>'); sk.onclick = () => { skip = true; }; q('tools').appendChild(sk);
    q('cards').innerHTML = '<div class="muted" style="grid-column:1/4;text-align:center;padding:16px 0">자동 겨루기 — 하이라이트</div>';
    const fake = { hp: { A: 1, B: 1 }, g: 0, round: 0, n: { A: 0, B: 0 }, A, bigPending: false };
    for (const h of r.highlights) {
      if (skip) break;
      Object.assign(fake, { hp: h.hp, g: h.gAfter, round: h.round, n: h.n });
      await clash(fake, h);
    }
    finish(full, r.win, false, null, r);
  }
  async function finish(full, win, manualMode, reason, autoRes) {
    const res = el(`<div class="result"><div class="big ${win ? 'win' : 'lose'}">${win ? '勝' : '敗'}</div><div style="font:700 20px var(--serif)">${win ? '이겼어요' : '졌어요'}</div>${reason ? `<div class="muted">${esc(reason)}</div>` : ''}<button class="btn pri" style="min-width:160px">확인</button></div>`);
    root.querySelector('#cards') && (root.querySelector('#cards').innerHTML = ''); root.appendChild(res); haptic(win ? [20, 40, 80] : [60]);
    await new Promise(r => { const t0 = performance.now(); res.querySelector('button').onclick = () => { if (performance.now() - t0 > 250) r(); }; });
    root.classList.remove('open', 'shake'); root.setAttribute('aria-hidden', 'true'); root.innerHTML = ''; busy = false;
    game.finishDuel(full, win, manualMode);
  }
  return { request, get busy() { return busy; } };
}
