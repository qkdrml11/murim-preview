// 아래 탭: 지도 · 문파 · 살림 · 무공 · 강호소식(업적·설정 포함).
import { esc, portrait, fmtSilver, haptic } from './util.js';
import { REALM, ROLE_NAME } from '../data/people.js';
import { ARTS, TYPE_HANJA, TYPE_NAME } from '../data/mugong.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { calendar } from '../systems/time.js';
import { modal } from './modal.js';

export function createTabs(game, ui) {
  const panel = document.getElementById('panel'), body = document.getElementById('panelBody'), title = document.getElementById('panelTitle');
  let tab = 'map';
  const st = () => game.state;
  document.getElementById('tabs').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b) { haptic(6); show(b.dataset.tab); } });
  document.getElementById('panelClose').addEventListener('click', () => show('map'));
  body.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (!b || b.disabled) return; haptic(8); act(b.dataset.act, b.dataset); });
  const TAB_FEATURE = { biz: 'ledger', mugong: 'path' };
  function show(t) {
    if (TAB_FEATURE[t] && !game.isOpen(TAB_FEATURE[t])) t = 'map';
    tab = t;
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
    if (t === 'map') { panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true'); return; }
    ui.sheets.close();
    panel.classList.add('open'); panel.setAttribute('aria-hidden', 'false');
    if (t === 'news') { ui.seenNews(); }
    render();
  }
  function render() {
    if (tab === 'map') return;
    const T = { sect: ['문파 — 청운문', sect], biz: ['살림', biz], mugong: ['무공', mugong], news: ['강호소식', news] }[tab];
    title.textContent = T[0]; const y = body.scrollTop; body.innerHTML = T[1](); body.scrollTop = y;
  }
  const statusOf = p => p.injured > 0 ? `부상 ${p.injured}달` : game.taskOf(p) ? game.taskOf(p).label : '쉬는 중';
  function sect() {
    const s = st();
    const ppl = s.people.map(p => `<button class="item" data-act="person" data-p="${p.id}"><div class="row">${portrait(p, 40)}<div><b>${esc(game.name(p))}</b> <span class="muted">${ROLE_NAME[p.role]} · ${REALM[p.realm]}</span><small>${esc(statusOf(p))}${p.discontent >= 30 ? ` · <span class="neg">불만 ${p.discontent}</span>` : ''}</small></div></div><span class="r" style="color:var(--gold)">${p.tp ? '수련치 ' + p.tp : ''}</span></button>`).join('');
    const bld = Object.entries(game.BUILDINGS).filter(([k]) => game.isOpen(game.BUILD_FEATURE[k] || 'build_all') || s.buildings[k]).map(([k, b]) => { const has = s.buildings[k]; const building = s.tasks.find(t => t.type === 'build' && t.target === k);
      return `<div class="item ${b.locked && !has ? 'dis' : ''}"><div>${b.name} ${has ? '✓' : ''}<small>${esc(b.effect)}${b.locked && !has ? ' · ' + esc(b.locked) : ''}</small></div><span class="r">${has ? '지음' : building ? `${building.remaining}달 남음` : b.locked ? '잠김' : `${b.cost}냥 · ${b.months}달`}</span></div>`; }).join('');
    const naeje = s.people.filter(p => p.role === 'naeje').length, sik = s.people.filter(p => p.role === 'sikgaek').length;
    const rooms = 6 + (s.buildings.suryeondong ? 3 : 0);
    return `<div class="muted">명성 ${s.fame} · 내제자 ${naeje}명${sik ? ` · 식객 ${sik}명` : ''} · 거처 ${naeje + sik}/${rooms}</div>
      <h4>사람</h4><div class="list">${ppl}</div>
      ${game.isOpen('build') ? `<h4>본산 건물</h4><div class="muted" style="font-size:13px">짓기는 사람을 눌러 '본산 짓기'를 맡겨요(동시에 1채).</div><div class="list">${bld}</div>` : ''}
      ${s.titles.length ? `<h4>칭호</h4><div>${s.titles.map(t => `<span class="tag">「${esc(t)}」</span>`).join(' ')}</div>` : ''}`;
  }
  function biz() {
    const s = st(); const L = game.ledger(); const last = s.lastLedger;
    const line = l => `<tr><td>${esc(l.label)}</td><td class="${l.v >= 0 ? 'pos' : 'neg'}">${l.v >= 0 ? '+' : ''}${l.v}</td></tr>`;
    const bizs = []; for (const pl of [...Object.values(s.towns), ...Object.values(s.villages)]) pl.biz.forEach(b => { if (b.owner === 'cw') bizs.push(`<div class="item"><div>${esc(pl.name)} ${esc(game.BIZ[b.type].names[(b.stage || 1) - 1])}<small>관리인 ${b.manager ? esc(game.name(game.person(b.manager))) : '없음 (수입 ×0.7)'}${b.startOwned ? ' · 본산 주막(관리인 없어도 ×1)' : ''}</small></div><span class="r">${game.bizIncome(pl, b)}냥/달</span></div>`); });
    return `${s.month === game.FIRST_YEAR_MONTHS ? `<div class="confirm neg" style="margin-bottom:8px">⚠ ${game.benefitEndText()}</div>` : ''}${s.month <= game.FIRST_YEAR_MONTHS ? `<div class="confirm" style="margin-bottom:8px">📜 첫해는 옛 의리로 버텨 줘서 <b>창립 제자 생활비가 절반</b>이에요(${game.FIRST_YEAR_MONTHS}달까지). ${game.FIRST_YEAR_MONTHS + 1}달부터는 전액이에요.</div>` : ''}
      <h4>이번 달 끝에 (예상)</h4><table class="ledger">${L.lines.map(line).join('')}<tr><td><b>합계</b></td><td class="${L.net >= 0 ? 'pos' : 'neg'}">${L.net >= 0 ? '+' : ''}${L.net}</td></tr></table>
      <div class="muted">지금 은자 ${fmtSilver(s.silver)} → 달 끝 ${fmtSilver(s.silver + L.net)}${s.arrears ? ` · <span class="neg">밀린 생활비 ${s.arrears}</span>` : ''}</div>
      ${last ? `<h4>지난달 (${calendar(last.month).text})</h4><table class="ledger">${last.lines.map(line).join('')}<tr><td><b>합계</b></td><td>${last.net >= 0 ? '+' : ''}${last.net}</td></tr></table>` : ''}
      <h4>우리 사업</h4><div class="list">${bizs.join('') || '<div class="muted">아직 없어요.</div>'}</div>`;
  }
  function mugong() {
    return st().people.map(p => `<h4>${esc(game.name(p))} <span class="muted">${REALM[p.realm]} · 내력 ${3 + Math.floor(p.meridians / 2)}</span></h4>` + Object.entries(p.arts).map(([a, s]) => {
      const art = ARTS[a]; if (!art) return '';
      return `<div class="muted">${esc(art.name)} ${s}성</div><div class="list">${art.moves.map(m => `<div class="item ${s >= m.unlock ? '' : 'dis'}"><div>${TYPE_HANJA[m.type]} ${esc(m.name)}${m.big ? ' <span class="tag">큰 초식</span>' : ''}<small>${TYPE_NAME[m.type]} · 위력 ${m.power}% · 내력 ${m.cost}${s >= m.unlock ? '' : ` · ${m.unlock}성에 열려요`}</small></div></div>`).join('')}</div>`; }).join('') + `<div class="btns"><button class="btn" data-act="person" data-p="${p.id}">수련치 쓰기</button></div>`).join('')
      + '<p class="muted">공(攻)은 변(變)을, 변은 수(守)를, 수는 공을 이겨요.</p>';
  }
  function news() {
    const s = st();
    const ach = Object.entries(ACHIEVEMENTS).map(([k, a]) => `<div class="item ${s.achievements[k] ? '' : 'dis'}"><div>[${a.tier}] ${esc(a.name)}<small>칭호 「${esc(a.title)}」 · ${esc(a.bonusText)}</small></div><span class="r">${s.achievements[k] ? '✓' : ''}</span></div>`).join('');
    const set = s.settings;
    const tg = (k, label, v) => `<div class="set"><span>${label}</span><button class="toggle ${v ? 'on' : ''}" data-act="set" data-k="${k}">${v ? '켜짐' : '꺼짐'}</button></div>`;
    return `${s.flags.sweepPending ? '<div class="btns"><button class="btn pri" data-act="sweep">숯막골 소탕 보내기 (50냥)</button></div>' : ''}
      <div class="log">${s.log.slice(0, 80).map(l => `<p class="${l.kind}"><b>${calendar(l.m).year}년 ${calendar(l.m).m}월</b>${esc(l.t)}</p>`).join('') || '<p>아직 소식이 없어요.</p>'}</div>
      <h4>업적</h4><div class="list">${ach}</div>
      <h4>설정</h4>
      ${tg('vibrate', '진동', set.vibrate)}${tg('circle', '큰 초식 원(타이밍)', set.circle)}${tg('titlesOnly', '업적 보상은 칭호만', set.titlesOnly)}
      <div class="set"><span>연출</span><button class="toggle on" data-act="fx">${set.fx === 'low' ? '가볍게' : '보통'}</button></div>
      <div class="set"><span>이름 표시</span><button class="toggle on" data-act="name">${{ byeolho: '별호', doho: '도호', sokmyeong: '속명' }[set.nameMode]}</button></div>
      <div class="btns"><button class="btn red" data-act="reset">처음부터 다시</button></div><p class="muted">자동 저장 · 저장 칸 ${esc(ui.saveKey)}</p>`;
  }
  async function act(a, d) {
    if (a === 'person') { show('map'); ui.sheets.person(d.p); }
    if (a === 'set') { st().settings[d.k] = !st().settings[d.k]; if (d.k === 'vibrate' && st().settings.vibrate) haptic(30); ui.save(); render(); }
    if (a === 'fx') { st().settings.fx = st().settings.fx === 'low' ? 'high' : 'low'; ui.save(); render(); }
    if (a === 'name') { const o = ['byeolho', 'doho', 'sokmyeong']; st().settings.nameMode = o[(o.indexOf(st().settings.nameMode) + 1) % 3]; ui.save(); ui.refresh(); }
    if (a === 'sweep') { show('map'); ui.sheets.pickTeam({ quest: 'sweepC', target: '숯막골', cost: 50, label: '숯막골 소탕', min: 2, max: 3 }); }
    if (a === 'reset') { const r = await modal({ title: '처음부터 다시?', body: '지금 저장이 지워져요.', horizontal: true, choices: [{ id: 'no', label: '아니요' }, { id: 'yes', label: '다시 시작', danger: true }] }); if (r === 'yes') ui.resetGame(); }
  }
  return { show, render, get tab() { return tab; } };
}
