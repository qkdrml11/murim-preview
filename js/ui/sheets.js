// 아래 시트: 인물 카드 · 고을 카드 · 일 맡기기 흐름(사람 → 일 → 대상 → 확인 카드 → [맡기기]).
import { el, esc, haptic, portrait, fmtSilver } from './util.js';
import { REALM, TALENT, ROLE_NAME } from '../data/people.js';
import { ARTS } from '../data/mugong.js';
import { SIZES } from '../data/map.js';
import { FACTIONS } from '../data/factions.js';
import { fullLabel } from '../systems/names.js';
import { modal } from './modal.js';
import { toast } from './toast.js';

export function createSheets(game, ui) {
  const sheet = document.getElementById('sheet'), body = document.getElementById('sheetBody'), scrim = document.getElementById('scrim');
  let onClose = null; let current = null;
  function open(html, ctx) { body.innerHTML = html; sheet.classList.add('open'); sheet.setAttribute('aria-hidden', 'false'); scrim.classList.add('on'); current = ctx; body.scrollTop = 0; }
  function close() { sheet.classList.remove('open'); sheet.setAttribute('aria-hidden', 'true'); scrim.classList.remove('on'); current = null; ui.map?.clearSel(); if (onClose) { const f = onClose; onClose = null; f(); } }
  scrim.addEventListener('click', () => { close(); ui.closePanel?.(); });
  // 끌어내려 닫기
  let sy = null; sheet.querySelector('.grab').addEventListener('pointerdown', e => { sy = e.clientY; });
  sheet.addEventListener('pointerup', e => { if (sy != null && e.clientY - sy > 60) close(); sy = null; });
  body.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (!b || b.disabled || b.classList.contains('dis')) return; haptic(8); act(b.dataset.act, b.dataset); });

  const st = () => game.state;
  const talentText = (p, k) => p.reveal[k] >= 2 ? TALENT[p.talent[k]] : p.hints?.[k] ? `"${p.hints[k]}"` : '아직 몰라요';
  const statusOf = p => { if (p.injured > 0) return `부상 · ${p.injured}달`; const t = game.taskOf(p); if (!t) return '쉬는 중'; return t.remaining == null ? `${t.short} · 계속` : `${t.short} · ${t.remaining}달`; };

  function person(pid) {
    const p = game.person(pid); if (!p) return;
    const t = game.taskOf(p);
    const arts = Object.entries(p.arts).map(([a, s]) => { const c = game.artCost(p, a); const can = p.tp >= c && s < 10 && !(p.role === 'sikgaek' && false);
      return `<div class="item"><div>${esc(ARTS[a]?.name || a)} <b>${s}성</b><small>${ARTS[a]?.moves.filter(m => s >= m.unlock).map(m => m.name).join(' · ') || ''}</small></div><button class="btn" data-act="art" data-p="${p.id}" data-a="${a}" ${can ? '' : 'disabled'}>올리기 ${c}</button></div>`; }).join('');
    const mc = game.meridianCost(p);
    const tasks = Object.keys(game.TASKS).filter(k => game.canDo(p, k) || (!game.isBusy(p) && false));
    open(`<div class="row">${portrait(p, 64)}<div><h3 style="margin:0">${esc(game.name(p))}</h3><div class="muted">${esc(fullLabel(p))}</div><div><span class="tag">${ROLE_NAME[p.role]}</span><span class="tag">${REALM[p.realm]}</span><span class="tag">경맥 ${p.meridians}</span>${p.age ? `<span class="tag">${p.age}세</span>` : ''}</div></div></div>
      <h4>재능</h4><div class="muted">근골 <b>${talentText(p, 'geun')}</b> · 오성 <b>${talentText(p, 'oseong')}</b> · 상재 <b>${talentText(p, 'sangjae')}</b></div>
      ${p.role === 'sikgaek' ? '<p class="muted">식객: 문파에 입문하지 않은 손님 무인 — 생활비 절반, 본문 무공은 못 배워요. 머물기·의뢰·습격만 거들어요.</p>' : ''}
      <h4>지금</h4><div class="item"><div>${esc(statusOf(p))}${t ? `<small>${esc(t.label)}</small>` : ''}</div>${t && t.cancellable !== false && t.type !== 'quest' ? `<button class="btn" data-act="cancel" data-t="${t.id}">그만두기</button>` : ''}</div>
      ${!game.isBusy(p) ? `<h4>일 맡기기</h4><div class="list">${tasks.map(k => taskItem(p, k)).join('') || '<div class="muted">지금 맡길 수 있는 일이 없어요.</div>'}</div>` : ''}
      <h4>수련치 <span style="color:var(--gold)">${p.tp}</span></h4>
      ${game.isOpen('path') ? `<div class="item"><div>경맥 열기 <small>${p.meridians}개 → ${p.meridians + 1}개 · 경지가 오르면 내력·위력이 커져요</small></div><button class="btn" data-act="mer" data-p="${p.id}" ${p.tp >= mc ? '' : 'disabled'}>열기 ${mc}</button></div>
      ${arts}` : `<div class="muted">달이 넘어갈 때 경맥과 무공에 고르게 쓰여요. 경맥 ${p.meridians}개 · ${Object.entries(p.arts).map(([a, s]) => `${esc(ARTS[a]?.name || a)} ${s}성`).join(' · ')}</div>`}`, { kind: 'person', id: pid });
  }
  function taskItem(p, k) {
    const T = game.TASKS[k]; const tg = game.targets(k, p); const none = !tg.length;
    return `<button class="item ${none ? 'dis' : ''}" data-act="task" data-p="${p.id}" data-k="${k}"><div>${game.taskName(k)}<small>${esc(T.desc)}${none ? ' · 대상 없음' : ''}</small></div><span class="r">${T.cost ? fmtSilver(T.cost) + '냥' : ''}${T.months ? ` · ${T.months}달` : T.months === null ? ' · 계속' : ''}</span></button>`;
  }
  function targets(pid, k, presetTarget) {
    const p = game.person(pid); const T = game.TASKS[k];
    let tg = game.targets(k, p);
    if (presetTarget) { const m = tg.filter(t => String(t.id).split('#')[0] === presetTarget); if (m.length === 1) return team(pid, k, m[0].id); tg = m.length ? m : tg; }
    if (T.target === 'self') return team(pid, k, p.id);
    const rows = tg.slice(0, 40).map(t => {
      const pl = game.place(String(t.id).split('#')[0]);
      const sub = t.lockedText ? t.lockedText : pl ? `${game.PROVINCES.find(x => x.id === pl.prov)?.name} · ${SIZES[pl.size].name} · 우리 세력 ${pl.inf.cw || 0}${pl.owner ? ' · ' + FACTIONS[pl.owner].name + ' 땅' : ''}` : t.effect || '';
      const dis = !!t.lockedText || (t.busy && k === 'build');
      return `<button class="item ${dis ? 'dis' : ''}" data-act="target" data-p="${pid}" data-k="${k}" data-t="${esc(t.id)}"><div>${esc(t.name)}<small>${esc(sub)}</small></div><span class="r">${t.cost ? t.cost + '냥' : ''}</span></button>`; }).join('');
    open(`<h3>${esc(game.name(p))} — ${T.name}</h3><div class="muted">어디로 보낼까요?</div><div class="list" style="margin-top:8px">${rows || '<div class="muted">대상이 없어요.</div>'}</div><div class="btns"><button class="btn" data-act="back" data-p="${pid}">← 돌아가기</button></div>`, { kind: 'targets' });
  }
  function team(pid, k, targetId, chosen) {
    const T = game.TASKS[k];
    if (!T.team) return confirmCard(k, [pid], targetId);
    chosen = chosen || [pid];
    const idle = st().people.filter(x => !game.isBusy(x) && game.canDo(x, k));
    const rate = game.raidRate(chosen, targetId);
    open(`<h3>${T.name} — 함께 갈 사람</h3><div class="muted">${T.team[0]}~${T.team[1]}명 · 지금 성공 확률 약 ${Math.round(rate * 100)}%</div>
      ${idle.map(x => `<button class="cand ${chosen.includes(x.id) ? 'sel' : ''}" data-act="teamToggle" data-p="${pid}" data-k="${k}" data-t="${esc(targetId)}" data-x="${x.id}" data-c="${chosen.join(',')}"><span class="ck">${chosen.includes(x.id) ? '✓' : ''}</span>${portrait(x, 40)}<div><b>${esc(game.name(x))}</b><div class="muted">${REALM[x.realm]}</div></div></button>`).join('')}
      <div class="btns"><button class="btn pri" data-act="teamOk" data-k="${k}" data-t="${esc(targetId)}" data-c="${chosen.join(',')}" ${chosen.length >= T.team[0] && chosen.length <= T.team[1] ? '' : 'disabled'}>다음</button></div>`, { kind: 'team' });
  }
  function confirmCard(k, ids, targetId) {
    const T = game.TASKS[k]; const pv = game.preview(k, targetId, ids);
    const pl = game.place(String(targetId).split('#')[0]);
    const tName = k === 'build' ? game.BUILDINGS[targetId].name : k === 'manage' ? game.targets(k).find(t => t.id === targetId)?.name : k === 'coach' ? game.name(game.person(targetId)) : pl ? pl.name : '본산';
    open(`<div class="confirm"><h3 style="margin-top:0">${T.name}</h3><div class="muted">${ids.map(i => esc(game.name(game.person(i)))).join(' · ')} → ${esc(tName)}</div>
      <dl><dt>은자</dt><dd>${pv.cost ? fmtSilver(pv.cost) + '냥' : '없음'} <span class="muted">(지금 ${fmtSilver(st().silver)})</span></dd><dt>기간</dt><dd>${pv.months ? pv.months + '달' : pv.months === 0 ? '바로' : '그만둘 때까지'}</dd>
      ${pv.monthly ? `<dt>매달</dt><dd>${pv.monthly}냥</dd>` : ''}<dt>결과</dt><dd>${esc(pv.result)}</dd></dl>
      ${pv.ok ? '' : `<div class="neg">${esc(pv.why)}</div>`}
      <div class="btns"><button class="btn pri wide" data-act="go" data-k="${k}" data-t="${esc(targetId)}" data-c="${ids.join(',')}" ${pv.ok ? '' : 'disabled'}>맡기기</button><button class="btn" data-act="back" data-p="${ids[0]}">취소</button></div></div>`, { kind: 'confirm' });
  }
  function place(id) {
    const pl = game.place(id); if (!pl) return;
    const rk = Object.entries(pl.inf).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const biz = pl.biz.map(b => `<div class="item"><div>${esc(b.name || game.BIZ[b.type]?.names?.[(b.stage || 1) - 1] || b.type)}<small>${FACTIONS[b.owner]?.name || ''}${b.owner === 'cw' ? ` · 매달 ${game.bizIncome(pl, b)}냥 · 관리인 ${b.manager ? esc(game.name(game.person(b.manager))) : '없음(×0.7)'}` : ''}</small></div></div>`).join('');
    const here = st().tasks.filter(t => String(t.target).split('#')[0] === id || t.place === id);
    const idle = st().people.filter(p => !game.isBusy(p));
    open(`<h3>${esc(pl.name)} ${pl.hanja ? `<small class="muted">${esc(pl.hanja)}</small>` : ''}</h3>
      <div class="muted">${game.PROVINCES.find(x => x.id === pl.prov)?.name} · ${SIZES[pl.size].name}${pl.home ? ' · 본산' : ''}${pl.holy ? ' · 성지' : ''} · ${pl.owner ? FACTIONS[pl.owner].name + ' 땅' : pl.contested ? '다툼 중' : '주인 없음'}</div>
      ${game.isOpen('stay') ? `<h4>세력</h4>${rk.map(([f, v]) => `<div class="inf-row"><span>${FACTIONS[f]?.name || f}</span><div class="bar"><i style="width:${v}%;background:${FACTIONS[f]?.color}"></i></div><b>${v}</b></div>`).join('') || '<div class="muted">아직 아무도 없어요.</div>'}
      <div class="muted" style="font-size:13px">1위 · 30 이상 · 2위보다 10 앞서면 그 문파 색이 돼요.</div>` : ''}
      ${biz ? `<h4>사업</h4>${biz}` : ''}
      ${here.length ? `<h4>여기서 하는 일</h4>${here.map(t => `<div class="item"><div>${esc(t.label)}<small>${t.people.map(i => esc(game.name(game.person(i)))).join(' · ')} · ${t.remaining == null ? '계속' : t.remaining + '달 남음'}</small></div></div>`).join('')}` : ''}
      <h4>일 맡기기</h4>${idle.length ? `<div class="list">${idle.map(p => `<button class="item" data-act="placePerson" data-p="${p.id}" data-pl="${id}"><div class="row">${portrait(p, 36)}<div>${esc(game.name(p))}<small>${REALM[p.realm]} · ${ROLE_NAME[p.role]}</small></div></div><span class="r">▸</span></button>`).join('')}</div>` : '<div class="muted">쉬는 사람이 없어요.</div>'}`, { kind: 'place', id });
  }
  function placeTasks(pid, plId) {
    const p = game.person(pid);
    const ks = Object.keys(game.TASKS).filter(k => game.canDo(p, k) && game.targets(k, p).some(t => String(t.id).split('#')[0] === plId));
    open(`<h3>${esc(game.name(p))} → ${esc(game.place(plId).name)}</h3><div class="list">${ks.map(k => `<button class="item" data-act="placeTask" data-p="${pid}" data-k="${k}" data-pl="${plId}"><div>${game.TASKS[k].name}<small>${esc(game.TASKS[k].desc)}</small></div><span class="r">${game.TASKS[k].cost ? game.TASKS[k].cost + '냥' : ''}</span></button>`).join('') || '<div class="muted">이 사람은 여기서 할 일이 없어요.</div>'}</div><div class="btns"><button class="btn" data-act="openPlace" data-pl="${plId}">← 돌아가기</button></div>`, { kind: 'placeTasks' });
  }
  async function act(a, d) {
    if (a === 'task') return targets(d.p, d.k);
    if (a === 'target') return team(d.p, d.k, d.t);
    if (a === 'back') return person(d.p);
    if (a === 'placePerson') return placeTasks(d.p, d.pl);
    if (a === 'placeTask') return targets(d.p, d.k, d.pl);
    if (a === 'openPlace') return place(d.pl);
    if (a === 'teamToggle') { let c = d.c.split(',').filter(Boolean); c = c.includes(d.x) ? c.filter(x => x !== d.x) : [...c, d.x]; return team(d.p, d.k, d.t, c); }
    if (a === 'teamOk') return confirmCard(d.k, d.c.split(','), d.t);
    if (a === 'go') { const r = game.assign(d.k, d.c.split(','), d.t); if (!r.ok) { toast(r.why, 'alert'); haptic([30, 30]); return; } haptic([10, 30, 15]); ui.bumpSilver(); toast(`${r.task.label} — 맡겼어요`, 'big', 2200); close(); ui.afterAssign?.(); return; }
    if (a === 'cancel') { const ok = await modal({ title: '그만둘까요?', body: '쓴 은자는 돌려받지 못해요.', horizontal: true, choices: [{ id: 'no', label: '계속' }, { id: 'yes', label: '그만두기', danger: true }] }); if (ok === 'yes') { game.cancelTask(+d.t); } return current?.kind === 'person' ? person(current.id) : null; }
    if (a === 'mer') { if (game.openMeridian(d.p)) { haptic([10, 20, 40]); toast('경맥이 열렸어요', 'big'); } return person(d.p); }
    if (a === 'art') { if (game.upgradeArt(d.p, d.a)) { haptic([10, 20, 40]); toast('무공이 한 성 올랐어요', 'big'); } return person(d.p); }
  }
  // 모집 후보 고르기(§5-4 ①): 고를 때마다 다음 달 수지가 바로 바뀌어요.
  function recruit(pr) {
    const sel = new Set();
    const draw = () => {
      const pv = game.recruitPreview([...sel]);
      open(`<h3>제자 후보 — ${esc(game.place(pr.place).name)}</h3><div class="muted">받고 싶은 만큼 고르세요. 안 받은 후보는 떠나요.</div>
        ${pr.cands.map(c => `<button class="cand ${sel.has(c.id) ? 'sel' : ''}" data-rc="${c.id}"><span class="ck">${sel.has(c.id) ? '✓' : ''}</span>${portrait(c, 44)}<div><b>${esc(c.name)}</b> <span class="muted">${c.age}세 · ${esc(c.origin)}</span><div style="font-size:14px">근골 "${esc(c.hints.geun)}" · 오성 "${esc(c.hints.oseong)}"<br>상재 "${esc(c.hints.sangjae)}"</div></div></button>`).join('')}
        <div class="confirm" style="margin-top:6px">다음 달 수지 <b class="${pv.now >= 0 ? 'pos' : 'neg'}">${pv.now >= 0 ? '+' : ''}${pv.now}</b> → <b class="${pv.after >= 0 ? 'pos' : 'neg'}">${pv.after >= 0 ? '+' : ''}${pv.after}</b> <span class="muted">(한 명당 생활비 8)</span></div>
        <div class="btns"><button class="btn pri wide" id="rcOk">${sel.size ? sel.size + '명 받기' : '아무도 안 받기'}</button></div>`, { kind: 'recruit' });
      body.querySelectorAll('[data-rc]').forEach(b => b.onclick = () => { haptic(8); sel.has(b.dataset.rc) ? sel.delete(b.dataset.rc) : sel.add(b.dataset.rc); draw(); });
      body.querySelector('#rcOk').onclick = () => { game.acceptRecruits([...sel]); onClose = null; close(); haptic([10, 30, 15]); };
    };
    draw();
    onClose = () => { if (st().pendingRecruit) game.acceptRecruits([]); };
  }
  // 사건 C: 함께 갈 2~3명 고르기
  function pickTeam(spec) {
    const sel = new Set();
    const draw = () => {
      const idle = st().people.filter(p => !game.isBusy(p) && p.role !== 'master');
      open(`<h3>${esc(spec.label)} — 보낼 사람</h3><div class="muted">${spec.min}~${spec.max}명 · ${spec.cost}냥 · 1달</div>
        ${idle.map(p => `<button class="cand ${sel.has(p.id) ? 'sel' : ''}" data-pk="${p.id}"><span class="ck">${sel.has(p.id) ? '✓' : ''}</span>${portrait(p, 40)}<div><b>${esc(game.name(p))}</b><div class="muted">${REALM[p.realm]}</div></div></button>`).join('') || '<div class="muted">쉬는 사람이 없어요. 하던 일을 그만두게 하면 보낼 수 있어요.</div>'}
        <div class="btns"><button class="btn pri wide" id="pkOk" ${sel.size >= spec.min && sel.size <= spec.max && st().silver >= spec.cost ? '' : 'disabled'}>보내기</button><button class="btn" id="pkNo">나중에</button></div>`, { kind: 'pick' });
      body.querySelectorAll('[data-pk]').forEach(b => b.onclick = () => { haptic(8); sel.has(b.dataset.pk) ? sel.delete(b.dataset.pk) : sel.add(b.dataset.pk); draw(); });
      body.querySelector('#pkOk').onclick = () => { if (game.startQuest(spec.quest, [...sel], spec.target, { cost: spec.cost, label: spec.label, asRaid: true })) { game.state.flags.sweepPending = false; toast(`${spec.label} — 보냈어요`, 'big'); } close(); };
      body.querySelector('#pkNo').onclick = () => { toast('강호소식에서 다시 보낼 수 있어요'); close(); };
    };
    draw();
  }
  return { person, place, close, recruit, pickTeam, get open() { return !!current; }, refresh() { if (current?.kind === 'person') person(current.id); else if (current?.kind === 'place') place(current.id); } };
}
