// 게임 본체: 상태 + 시스템 묶음. 화면(ui/*)은 bus 이벤트로만 이어져요. 노드에서도 돌아가요(테스트).
import { createBus, createRegistry } from './core/bus.js';
import { makeRng } from './core/rng.js';
import { buildMap, initialInfluence, SIZES, SIZE_ORDER, PROVINCES } from './data/map.js';
import { SIKGAEK, RONIN_STAY, ROLE_NAME, startPeople, FOES, RONIN, REALM, REALM_BY_MERIDIAN, TALENT_MUL, HINTS, RECRUIT_SURNAMES, RECRUIT_GIVEN, DOHO_SECOND, LIVING } from './data/people.js';
import { TASKS, REQUEST_NAMES, BUILDINGS } from './data/tasks.js';
import { ACHIEVEMENTS } from './data/achievements.js';
import { ARTS } from './data/mugong.js';
import { SEC_PER_MONTH, calendar } from './systems/time.js';
import { monthlyInfluence, addInf, recolor, ME } from './systems/influence.js';
import { BIZ, applyMonth, monthLedger, stayCost, bizIncome, livingCost } from './systems/economy.js';
import { estimate, rateLabel, resolveAuto } from './systems/duel.js';
import { displayName, BYEOLHO_POOL } from './systems/names.js';

export const SAVE_VERSION = 1;
// '이(가)' 같은 표기를 앞 글자 받침에 맞춰 골라요.
export function josa(text) {
  return text.replace(/([가-힣A-Za-z0-9」')]+)(이\(가\)|을\(를\)|은\(는\)|와\(과\)|이\)?\(라\))/g, (m, w, p) => {
    const ch = w.replace(/[」')]+$/, '').slice(-1), code = ch.charCodeAt(0);
    const bat = code >= 0xAC00 && code <= 0xD7A3 ? (code - 0xAC00) % 28 !== 0 : false;
    const pick = { '이(가)': bat ? '이' : '가', '을(를)': bat ? '을' : '를', '은(는)': bat ? '은' : '는', '와(과)': bat ? '과' : '와' }[p] ?? p;
    return w + pick;
  });
}
export const UNLOCK_DUELS = 3, UNLOCK_MONTH = 6;
export const UNLOCK_TEXT = '검을 여러 번 맞대며 제자들도 장문인의 수를 읽게 되었습니다. 이제 일기토를 맡겨 둘 수 있습니다(자동 설정 열림).';
const sizeAtLeast = (s, min) => SIZE_ORDER.indexOf(s) >= SIZE_ORDER.indexOf(min);

export function newState(seed = 20261026) {
  const { towns, villages } = buildMap();
  const T = {}, V = {};
  for (const t of towns) {
    const inf = initialInfluence(t);
    T[t.id] = { ...t, inf, biz: [], owner: null, contested: false, home: t.id === '운봉', baseFacs: Object.keys(inf).filter(f => f !== 'cw') };
  }
  for (const v of villages) V[v.id] = { ...v, inf: {}, biz: [], owner: null, banditChance: 0.05, neglect: 0, event: null };
  T['운봉'].biz.push({ type: 'jumak', stage: 1, owner: ME, manager: null, startOwned: true, zeroMonths: 0 });
  T['청석'].biz.push({ type: 'sanchae', stage: 1, owner: 'hd', name: '흑담채 산채', zeroMonths: 0 });
  T['여울'].biz.push({ type: 'jumak', stage: 1, owner: 'hs', zeroMonths: 0 });
  for (const pl of Object.values(T)) { recolor(pl); pl.startMine = pl.owner === ME; }
  return {
    v: SAVE_VERSION, seed, rngS: seed, month: 1, prog: 0, speed: 0, silver: 400, fame: 10, arrears: 0,
    homeProv: 'guizhou', home: '운봉', towns: T, villages: V, people: startPeople(), tasks: [], buildings: {}, nextTaskId: 1,
    log: [], flags: {}, duels: { manual: 0, unlocked: false }, ronin: { last: -99, rumorYear: 0, rumors: 0 },
    recruitBonus: 0, achievements: {}, titles: [], lastLedger: null, introDone: false,
    settings: { nameMode: 'byeolho', vibrate: true, circle: true, titlesOnly: false, fx: 'high' },
  };
}

export function createGame(opts = {}) {
  const bus = createBus();
  const reg = createRegistry(bus);
  let state = opts.state || newState(opts.seed);
  const rng = makeRng(0); rng.s = state.rngS;
  const g = { bus, reg, get state() { return state; }, rng, opts };
  const save = () => { state.rngS = rng.s; };

  // ── 도우미 ──
  g.person = id => state.people.find(p => p.id === id);
  g.place = id => state.towns[id] || state.villages[id];
  g.name = p => displayName(p, state.settings.nameMode);
  g.cal = () => calendar(state.month);
  g.isBusy = p => !!p.task || p.injured > 0;
  g.realmName = r => REALM[r];
  g.log = (text, kind = 'info', extra = {}) => { text = josa(text); state.log.unshift({ m: state.month, t: text, kind, ...extra }); if (state.log.length > 200) state.log.length = 200; };
  g.notify = (text, o = {}) => { text = josa(text); g.log(text, o.kind || 'info', { place: o.place }); if (o.pause) g.pause(o.reason || text); bus.emit('notify', { text, ...o }); };
  g.pause = reason => { if (state.speed !== 0) { state.lastSpeed = state.speed; state.speed = 0; bus.emit('speed', 0); } bus.emit('paused', reason); };
  g.setSpeed = s => { state.speed = s; bus.emit('speed', s); };
  // 묻기: 화면이 있으면 창을 띄우고, 없으면(테스트) opts.answer로 골라요.
  g.ask = (spec, cb) => {
    if (opts.headless) { const pick = opts.answer ? opts.answer(spec) : spec.choices[0].id; cb(pick); return; }
    g.pause('ask'); bus.emit('ask', { ...spec, cb });
  };
  g.addFame = n => { state.fame = Math.max(0, state.fame + n); };
  g.gainTp = (p, n) => { if (p) p.tp += Math.round(n); };

  // ── 경지·수련치 쓰기(§5 · §5-4 ④) ──
  g.meridianCost = p => Math.round((100 + 30 * p.meridians) / TALENT_MUL[p.talent.geun]);
  g.artCost = (p, art) => Math.round((60 + 30 * (p.arts[art] || 0)) / TALENT_MUL[p.talent.oseong]);
  g.openMeridian = pid => {
    const p = g.person(pid), c = g.meridianCost(p);
    if (p.tp < c || p.meridians >= 12) return false;
    p.tp -= c; p.meridians++;
    if (!p.reveal) p.reveal = {};
    if ((p.reveal.geun || 0) < 1) p.reveal.geun = 1;
    const nr = REALM_BY_MERIDIAN.filter(([m]) => p.meridians >= m).pop()[1];
    if (nr > p.realm) {
      p.realm = nr;
      if (p.reveal.geun < 2 && nr >= 2) p.reveal.geun = p.reveal.oseong = 2;
      g.notify(`${g.name(p)}이(가) ${REALM[nr]}에 올랐어요! 돌파`, { pause: true, kind: 'big' });
      if (nr >= 3 && !p.byeolho) { p.byeolho = BYEOLHO_POOL[state.people.filter(x => x.byeolho).length % BYEOLHO_POOL.length]; g.notify(`강호가 ${p.name}을(를) '${p.byeolho}'라 부르기 시작했어요. 이제 별호로 보여요.`, { kind: 'big' }); }
    }
    bus.emit('changed'); return true;
  };
  g.upgradeArt = (pid, art) => {
    const p = g.person(pid), c = g.artCost(p, art);
    if (p.role === 'sikgaek' && !(art in p.arts)) return false; // 식객은 본문 무공을 못 배워요
    if (p.tp < c || (p.arts[art] || 0) >= 10) return false;
    p.tp -= c; p.arts[art] = (p.arts[art] || 0) + 1;
    if ((p.reveal.oseong || 0) < 1) p.reveal.oseong = 1;
    const nm = ARTS[art].moves.find(m => m.unlock === p.arts[art]);
    g.notify(`${g.name(p)} · ${ARTS[art].name} ${p.arts[art]}성${nm ? ` — 새 초식 「${nm.name}」` : ''}`, { kind: nm ? 'big' : 'info' });
    bus.emit('changed'); return true;
  };

  // ── 일 맡기기(§2) ──
  g.canDo = (p, key) => {
    const T = TASKS[key];
    if (g.isBusy(p)) return false;
    if (T.who === 'master') return p.role === 'master';
    if (T.who === 'disciple') return p.role === 'naeje' || (p.role === 'sikgaek' && SIKGAEK.tasks.includes(key));
    if (p.role === 'sikgaek') return SIKGAEK.tasks.includes(key);
    if (T.who === 'realm3') return p.realm >= 3;
    return true;
  };
  g.targets = (key, p) => {
    const T = TASKS[key]; const all = Object.values(state.towns), vil = Object.values(state.villages);
    const near = pl => pl.prov === 'guizhou' || pl.prov === 'hunan';
    const sortNear = arr => arr.sort((a, b) => (near(b) - near(a)) || ((a.x - 462) ** 2 + (a.y - 905) ** 2) - ((b.x - 462) ** 2 + (b.y - 905) ** 2));
    const slotsFree = pl => pl.biz.filter(b => b.owner === ME || b.type !== 'sanchae').filter(b => b.owner === ME).length + state.tasks.filter(t => t.target === pl.id && TASKS[t.type].biz).length < SIZES[pl.size].slots;
    switch (T.target) {
      case 'town': return sortNear(all.filter(pl => !pl.holy && sizeAtLeast(pl.size, BIZ[T.biz].minSize) && slotsFree(pl) && !pl.biz.some(b => b.owner === ME && b.type === T.biz)));
      case 'village': return sortNear(vil.filter(v => !v.biz.length && !state.tasks.some(t => t.target === v.id && t.type === 'openSadeul')));
      case 'place': return sortNear([...all, ...vil].filter(pl => key !== 'stay' || state.tasks.filter(t => t.type === 'stay' && t.target === pl.id).length < 2));
      case 'recruitTown': return all.filter(pl => pl.home || pl.owner === ME);
      case 'myBiz': { const out = []; for (const pl of [...all, ...vil]) pl.biz.forEach((b, i) => { if (b.owner === ME && !b.manager && b.type !== 'sadeul') out.push({ id: pl.id + '#' + i, name: `${pl.name} ${BIZ[b.type].names[(b.stage || 1) - 1]}`, place: pl, idx: i }); }); return out; }
      case 'trainee': return state.tasks.filter(t => t.type === 'train' && !t.coach && t.people[0] !== p?.id).map(t => ({ id: t.people[0], name: g.name(g.person(t.people[0])) }));
      case 'raidTown': return sortNear(all.filter(pl => !pl.holy && pl.biz.some(b => b.owner && b.owner !== ME)));
      case 'building': return Object.entries(BUILDINGS).filter(([k]) => !state.buildings[k]).map(([k, b]) => ({ id: k, name: b.name, ...b, busy: state.tasks.some(t => t.type === 'build'), lockedText: b.locked }));
      case 'self': return [{ id: p?.id, name: '본산' }];
    }
    return [];
  };
  g.preview = (key, targetId, people = []) => {
    const T = TASKS[key]; const pl = g.place(String(targetId).split('#')[0]);
    let cost = T.cost, months = T.months, monthly = 0, result = T.desc;
    if (key === 'stay') { monthly = stayCost(state, targetId); result = `매달 세력 +${people.map(g.person).reduce((s, p) => s + (p.realm >= 4 ? 3 : p.realm >= 3 ? 2 : 1), 0) * (SIZES[pl.size].infMul)} (크기 배율 포함)`; }
    if (key === 'coach') monthly = 20;
    if (key === 'build') { const b = BUILDINGS[targetId]; cost = b.cost; months = b.months; result = b.effect; }
    if (T.biz && T.biz !== 'sadeul') { const v = Math.round(BIZ[T.biz].base * SIZES[pl.size].incomeMul); result = `${BIZ[T.biz].name} 매달 약 ${v}냥(관리인 상재 중 기준, 없으면 ×0.7) · 세력 +2/달`; }
    if (key === 'raid') { const r = g.raidRate(people, targetId); result = `성공 확률 약 ${Math.round(r * 100)}% · 성공하면 우리 +5 · 상대 −10`; }
    if (key === 'request') result = `세력 +${Math.trunc(6 * SIZES[pl.size].infMul)} · 명성 +2 · 수련치 +5`;
    if (key === 'manage') { const p = g.person(people[0]); result = `상재 배율 ${p ? (p.reveal.sangjae >= 2 ? '×' + TALENT_MUL[p.talent.sangjae] : '(아직 모름)') : ''} · 수련치 +2/달`; }
    if (key === 'train') { const m = state.buildings.suryeondong ? 1.1 : 1; result = `매달 수련치 ${Math.round(30 * m)}${m > 1 ? ' (수련동 +10%)' : ''}`; }
    const ok = state.silver >= cost;
    return { cost, months, monthly, result, ok, why: ok ? '' : '은자가 모자라요' };
  };
  g.raidRate = (people, targetId) => {
    let s = 0; for (const id of people) { const p = g.person(id); if (!p) continue; s += Math.max(p.talent.geun, p.talent.oseong) + 1 + (p.realm >= 4 ? 3 : p.realm >= 3 ? 2 : p.realm >= 2 ? 1 : 0); }
    return Math.max(0.1, Math.min(0.95, 0.5 + (s - 6) * 0.1));
  };
  g.assign = (key, peopleIds, targetId, extra = {}) => {
    const T = TASKS[key]; const pv = g.preview(key, targetId, peopleIds);
    if (!pv.ok) return { ok: false, why: pv.why };
    const ps = peopleIds.map(g.person);
    if (ps.some(p => !p || g.isBusy(p))) return { ok: false, why: '쉬는 사람이 아니에요' };
    if (T.team && (ps.length < T.team[0] || ps.length > T.team[1])) return { ok: false, why: `${T.team[0]}~${T.team[1]}명이 필요해요` };
    if (key === 'build' && state.tasks.some(t => t.type === 'build')) return { ok: false, why: '동시에 1채만 지어요' };
    state.silver -= pv.cost;
    const pl = g.place(String(targetId).split('#')[0]);
    const label = key === 'request' ? (extra.label || REQUEST_NAMES[Math.floor(rng.next() * REQUEST_NAMES.length)]) : key === 'build' ? `${BUILDINGS[targetId].name} 짓기` : T.name;
    const t = { id: state.nextTaskId++, type: key, people: peopleIds, target: targetId, remaining: pv.months, total: pv.months, monthly: pv.monthly, label: `${pl ? pl.name + ' ' : ''}${label}`.trim(), short: label, cost: pv.cost, ...extra };
    if (key === 'manage') { const [pid, idx] = String(targetId).split('#'); g.place(pid).biz[+idx].manager = peopleIds[0]; t.place = pid; }
    if (key === 'coach') { const tt = state.tasks.find(x => x.type === 'train' && x.people[0] === targetId); if (tt) tt.coach = peopleIds[0]; }
    state.tasks.push(t);
    for (const p of ps) p.task = t.id;
    if (T.biz) for (const p of ps) p.bizMonths = (p.bizMonths || 0);
    bus.emit('task:start', t); bus.emit('changed');
    return { ok: true, task: t };
  };
  g.cancelTask = id => {
    const t = state.tasks.find(x => x.id === id); if (!t) return;
    if (t.type === 'manage') { const [pid, idx] = String(t.target).split('#'); const b = g.place(pid).biz[+idx]; if (b) b.manager = null; }
    if (t.type === 'coach') { const tt = state.tasks.find(x => x.type === 'train' && x.coach === t.people[0]); if (tt) tt.coach = null; }
    if (t.type === 'train') { const c = state.tasks.find(x => x.type === 'coach' && x.target === t.people[0]); if (c) g.cancelTask(c.id); }
    if (t.type === 'build' && t.remaining > 0) state.silver += Math.floor(t.cost / 2); // 중간에 멈추면 절반 돌려받기(§5-3)
    state.tasks = state.tasks.filter(x => x !== t);
    for (const pid of t.people) { const p = g.person(pid); if (p && p.task === t.id) p.task = null; }
    bus.emit('changed');
  };
  g.taskOf = p => state.tasks.find(t => t.id === p.task);

  function completeTask(t) {
    const ps = t.people.map(g.person);
    const pl = g.place(String(t.target).split('#')[0]);
    const who = ps.map(g.name).join('·');
    const free = () => { state.tasks = state.tasks.filter(x => x !== t); for (const p of ps) if (p && p.task === t.id) p.task = null; };
    const T = TASKS[t.type];
    if (T && T.biz) {
      pl.biz.push({ type: T.biz, stage: 1, owner: ME, manager: null, zeroMonths: 0, opened: state.month });
      free();
      for (const p of ps) { p.bizMonths = (p.bizMonths || 0) + 1; if ((p.reveal.sangjae || 0) < 1) p.reveal.sangjae = 1; }
      const bi = pl.biz.length - 1;
      if (T.biz === 'sadeul') { g.notify(`${pl.name} 사들이기를 열었어요(${who}).`, { pause: true, place: pl.id }); }
      else g.ask({ title: `${pl.name} ${BIZ[T.biz].name} 개업`, body: `${who}이(가) ${pl.name}에 ${BIZ[T.biz].name}을(를) 열었어요.\n관리인으로 남기면 상재 배율이 붙어요(없으면 ×0.7).`, choices: ps[0].role === 'master' ? [{ id: 'back', label: '장문인은 본산으로(관리인 없음 ×0.7)', primary: true }] : [{ id: 'stay', label: `${who} 관리인으로 남기기`, primary: true }, { id: 'back', label: '본산으로 돌아오기' }] }, c => {
        if (c === 'stay' && ps[0] && ps[0].role !== 'master' && !g.isBusy(ps[0])) g.assign('manage', [ps[0].id], `${pl.id}#${bi}`);
        bus.emit('changed');
      });
      g.pause('task'); checkAchievements(); return;
    }
    if (t.type === 'request') {
      const d = addInf(pl, ME, 6); g.addFame(2); for (const p of ps) g.gainTp(p, 5); free();
      if (pl.size === 'village') pl.neglect = 0;
      g.notify(`${t.label} 끝 — ${pl.name} 세력 +${d}, 명성 +2`, { pause: true, place: pl.id });
      const ch = recolor(pl); if (ch) onColorChange(ch);
    } else if (t.type === 'recruit') { free(); openRecruit(pl); }
    else if (t.type === 'raid') { free(); resolveRaid(t, ps, pl); }
    else if (t.type === 'build') {
      state.buildings[t.target] = { built: state.month }; free();
      g.notify(`${BUILDINGS[t.target].name}이(가) 완성됐어요! ${BUILDINGS[t.target].effect}`, { pause: true, kind: 'big' }); checkAchievements();
    } else if (t.type === 'quest') { free(); t.onDone && QUESTS[t.quest].done(t, ps, pl); }
    else free();
    bus.emit('changed');
  }

  // ── 습격(§2·§3) ──
  function resolveRaid(t, ps, pl) {
    const target = pl.biz.find(b => b.owner && b.owner !== ME);
    const foe = target ? target.owner : 'hd';
    const ok = rng.next() < g.raidRate(t.people, pl.id);
    for (const p of ps) g.gainTp(p, 10);
    if (t.quest === 'sweepC') return QUESTS.sweepC.done(t, ps, pl, ok);
    if (ok) { addInf(pl, ME, 5); addInf(pl, foe, -10); if (target) target.zeroMonths = 2; g.notify(`${pl.name} 습격 성공! 우리 +5 · ${foeName(foe)} −10`, { pause: true, place: pl.id, kind: 'big' }); }
    else { g.notify(`${pl.name} 습격이 막혔어요. 다들 무사히 돌아왔어요.`, { pause: true, place: pl.id }); }
    const ch = recolor(pl); if (ch) onColorChange(ch);
  }
  const foeName = f => ({ hd: '흑담채', hs: '혈수방', sd: '사도맹' }[f] || f);

  // ── 모집(§5-4 ①) ──
  function genCandidate(pl) {
    const tier = () => rng.weighted([[0, 30], [1, 50], [2, 17], [3, 3]]);
    let geun = tier(), oseong = tier(), sangjae = tier();
    const arche = rng.weighted([['mu', 45], ['sang', 35], ['even', 20]]);
    const mu = Math.max(geun, oseong);
    if (arche === 'mu' && sangjae >= mu) sangjae = Math.max(0, mu - 1);
    if (arche === 'sang' && mu >= sangjae) { geun = Math.min(geun, Math.max(0, sangjae - 1)); oseong = Math.min(oseong, Math.max(0, sangjae - 1)); }
    if (arche === 'even') { geun = oseong = sangjae = 1; }
    const hintOf = (k, v) => { let h = v; if (!rng.chance(0.7)) h = Math.max(0, Math.min(3, v + (rng.chance(0.5) ? 1 : -1))); if (h === v && rng.chance(0) ) h = v; return HINTS[k][h]; };
    const name = rng.pick(RECRUIT_SURNAMES) + rng.pick(RECRUIT_GIVEN);
    return { id: 'p' + (state.people.length + Math.floor(rng.next() * 1e6)), name, doho: '하' + rng.pick(DOHO_SECOND), byeolho: '', nick: '', role: 'naeje', realm: 1, meridians: 0, arts: { yukhap: 1 }, simbeop: '하승',
      talent: { geun, oseong, sangjae }, reveal: { geun: 0, oseong: 0, sangjae: 0 }, hints: { geun: hintOf('geun', geun), oseong: hintOf('oseong', oseong), sangjae: hintOf('sangjae', sangjae) },
      age: rng.int(12, 18), origin: arche === 'sang' ? rng.pick(['상인 집안', '객잔 심부름꾼', '나루 뱃사공 아들']) : arche === 'mu' ? rng.pick(['무관 출신', '산골 사냥꾼 집', '무가의 막내']) : rng.pick(['농사꾼 집', '서당 아이']),
      tp: 0, task: null, injured: 0, discontent: 0, loyalty: 60, trainMonths: 0, bizMonths: 0, joined: state.month };
  }
  function openRecruit(pl) {
    let n = SIZES[pl.size].recruit + (pl.owner === ME ? 1 : 0) + (state.fame >= 100 ? 1 : 0) + (state.fame >= 300 ? 1 : 0) + state.recruitBonus;
    state.recruitBonus = 0;
    const cands = Array.from({ length: n }, () => genCandidate(pl));
    state.pendingRecruit = { place: pl.id, cands };
    g.pause('recruit'); bus.emit('recruit', state.pendingRecruit);
    if (opts.headless) g.acceptRecruits(opts.recruitPick ? opts.recruitPick(cands) : cands.slice(0, 2).map(c => c.id));
  }
  g.recruitPreview = ids => {
    const now = monthLedger(state, state.month + 1).net;
    const add = ids.length * LIVING[1];
    return { now, after: now - add };
  };
  g.acceptRecruits = ids => {
    const pr = state.pendingRecruit; if (!pr) return;
    for (const c of pr.cands) if (ids.includes(c.id)) { state.people.push(c); }
    const left = pr.cands.length - ids.length;
    g.notify(`새 제자 ${ids.length}명을 받았어요.${left ? ` 남은 ${left}명은 떠났어요.` : ''}`, { kind: 'big' });
    state.pendingRecruit = null; checkAchievements(); bus.emit('changed');
  };

  // ── 일기토 연결(§5-8 ⑥) ──
  g.duelEstimate = (ally, foe) => estimate(ally, foe, 200, state.month * 31 + 7);
  g.autoRemaining = () => Math.max(0, UNLOCK_DUELS - state.duels.manual);
  g.lockText = () => `일기토 ${g.autoRemaining()}번 더 또는 ${UNLOCK_MONTH}달이 되면 열려요`;
  g.requestDuel = spec => {
    // spec: {title, place, ally(person), foe(src), kind, onResult(win, how)}
    const ally = spec.ally, foe = spec.foe;
    const p = g.duelEstimate(ally, foe);
    const label = rateLabel(p);
    const recommendManual = ally.role === 'master' || label === '위험' || label === '무모' || spec.kind === 'public';
    const full = { ...spec, p, label, unlocked: state.duels.unlocked, lockText: g.lockText(), recommend: state.duels.unlocked ? (recommendManual ? 'manual' : 'auto') : 'manual' };
    g.pause('duel');
    if (opts.headless) { const how = opts.duelMode ? opts.duelMode(full) : 'auto'; if (how === 'auto' || !opts.manualResult) g.finishDuelAuto(full); else g.finishDuel(full, opts.manualResult(full), true); return; }
    bus.emit('duel:request', full);
  };
  g.finishDuelAuto = full => { const r = resolveAuto(full.ally, full.foe, rng, full.p); g.finishDuel(full, r.win, false); return r; };
  g.finishDuel = (full, win, manual) => {
    if (manual) { state.duels.manual++; g.log(`직접 일기토 ${state.duels.manual}번째`); }
    if (win && !state.achievements.firstDuel) unlockAch('firstDuel');
    full.onResult(win, manual ? 'manual' : 'auto');
    checkUnlock();
    bus.emit('changed');
  };
  function checkUnlock() {
    if (state.duels.unlocked) return;
    if (state.duels.manual >= UNLOCK_DUELS || state.month > UNLOCK_MONTH || (state.month === UNLOCK_MONTH && state.flags.monthEnded6)) {
      state.duels.unlocked = true; state.duels.unlockedAt = state.month;
      g.notify(UNLOCK_TEXT, { pause: true, kind: 'unlock' });
      bus.emit('unlock');
    }
  }
  g.checkUnlock = checkUnlock;
  function injure(p, months) { p.injured = Math.max(p.injured, months); if (p.task) { const t = g.taskOf(p); if (t && t.months !== null) {} } }

  // ── 사건(§9 A·B·C, 흑담채 습격, §5-6 ③-1 낭인 반복) ──
  const QUESTS = {
    herbB: { done(t, ps, pl) {
      const p = ps[0]; const useSang = t.mode === 'sang';
      const score = (useSang ? p.talent.sangjae : Math.max(p.talent.geun, p.talent.oseong)) + 1 + (p.realm >= 4 ? 3 : p.realm >= 3 ? 2 : p.realm >= 2 ? 1 : 0);
      const rate = Math.max(0.1, Math.min(0.95, 0.5 + (score - 2) * 0.1));
      if (useSang && (p.reveal.sangjae || 0) < 1) p.reveal.sangjae = 1;
      if (rng.next() < rate) { state.silver += 60; state.recruitBonus += 1; g.notify(`약초 짐을 찾았어요! 사례 60냥, 약초상 아들이 다음 모집에 오겠대요(후보 +1).`, { pause: true, kind: 'big' }); }
      else g.notify(`약초 짐은 못 찾았어요. 약초상이 그래도 고마워해요(손해 없음).`, { pause: true });
    } },
    sweepC: { done(t, ps, pl, ok) {
      const v = state.villages['숯막골'];
      const fighter = [...ps].sort((a, b) => b.realm - a.realm || b.meridians - a.meridians)[0];
      const go = () => g.requestDuel({ title: `숯막골 소탕 · 부두목 일기토`, place: '숯막골', kind: 'sweep', ally: fighter, foe: { ...FOES.guchil, label: "'외눈' 구칠" }, onResult: win => {
        if (win) { addInf(v, ME, 8); state.silver += 40; v.banditChance = 0.05; g.notify(`잔당을 흩었어요! 숯막골 세력 +${Math.trunc(8 * 2)}, 은자 +40`, { pause: true, kind: 'big', place: '숯막골' }); recolor(v); }
        else { injure(fighter, 1); g.notify(`${g.name(fighter)}이(가) 밀려났어요(가벼운 부상 1달). 잔당은 여전해요.`, { pause: true, place: '숯막골' }); }
      } });
      go();
    } },
    beastD: { done(t, ps, pl) { addInf(pl, ME, 8); state.recruitBonus += 1; g.notify(`${pl.name} 맹수를 쫓았어요. 세력 +${Math.trunc(8 * 2)}, 다음 모집 후보 +1`, { pause: true, place: pl.id }); recolor(pl); } },
  };
  g.startQuest = (quest, peopleIds, target, extra = {}) => {
    const ps = peopleIds.map(g.person); if (ps.some(p => !p || g.isBusy(p))) return false;
    const cost = extra.cost || 0; if (state.silver < cost) return false; state.silver -= cost;
    const t = { id: state.nextTaskId++, type: extra.asRaid ? 'raid' : 'quest', quest, people: peopleIds, target, remaining: 1, total: 1, monthly: 0, label: extra.label, short: extra.label, onDone: true, ...extra };
    state.tasks.push(t); for (const p of ps) p.task = t.id; bus.emit('changed'); return true;
  };

  function raidEvent(placeId) {
    const pl = state.towns[placeId];
    const b = pl.biz.find(x => x.owner === ME) || state.towns['운봉'].biz[0];
    const bpl = pl.biz.includes(b) ? pl : state.towns['운봉'];
    g.notify(`흑담채가 ${bpl.name} ${BIZ[b.type].name}을(를) 습격했어요!`, { pause: true, place: bpl.id, kind: 'alert' });
    const cands = state.people.filter(p => p.injured === 0).sort((a, c) => c.realm - a.realm);
    g.ask({ title: `! 습격 — ${bpl.name}`, body: `'흑면호' 장귀돌이 직접 왔어요. 막을 사람을 보내 일기토로 맞서요.\n못 막으면 그 사업 2달 수입 0, 세력 −5.`, place: bpl.id,
      choices: [...cands.slice(0, 4).map((p, i) => ({ id: p.id, label: `${g.name(p)} (${REALM[p.realm]})`, primary: p.id === 'p1' })), { id: 'none', label: '두기' }] }, pick => {
      const lose = () => { b.zeroMonths = 2; addInf(bpl, ME, -5); g.notify(`${bpl.name} ${BIZ[b.type].name}이(가) 털렸어요. 2달 수입 0, 세력 −5`, { place: bpl.id }); const ch = recolor(bpl); if (ch) onColorChange(ch); };
      if (pick === 'none') return lose();
      const ally = g.person(pick);
      g.requestDuel({ title: `${bpl.name} 습격 막기`, place: bpl.id, kind: 'raid', ally, foe: { ...FOES.janggwidol, label: "'흑면호' 장귀돌" }, onResult: win => {
        if (win) { g.gainTp(ally, 15); addInf(bpl, ME, 5); g.notify(`습격을 막았어요! ${bpl.name} 세력 +5, ${g.name(ally)} 수련치 +15. 이제 반격할 차례예요(청석 흑담채 산채 습격).`, { pause: true, kind: 'big', place: bpl.id }); state.flags.counterHint = true; const ch = recolor(bpl); if (ch) onColorChange(ch); }
        else { injure(ally, 1); lose(); }
      } });
    });
  }
  function roninEvent(ronin, realm, first) {
    const hint = (() => { let r = realm; if (!rng.chance(0.7)) r = Math.max(1, Math.min(5, r + (rng.chance(0.5) ? 1 : -1))); return REALM[r]; })();
    const muHint = HINTS.geun[first ? 1 : rng.int(0, 3)];
    const foe = { name: ronin.name, byeolho: ronin.byeolho, label: `'${ronin.byeolho}' ${ronin.name}`, realm, meridians: [0, 2, 4, 6, 9, 12][realm], arts: { nangin: [1, 3, 4, 6, 8][realm - 1] || 3 }, simbeop: realm >= 3 ? '중승' : '하승', style: 'ronin', fake: ronin.fake, habit: ronin.habit };
    state.ronin.last = state.month;
    const fighters = first ? ['p1', 'p2', 'p0'].map(g.person) : state.people.filter(p => p.injured === 0).sort((a, b) => b.realm - a.realm).slice(0, 3);
    const body = first ? `운봉 주막에 '철검' 노삼이라는 낭인이 와 "청운문 검이 아직 살아 있소?" 하고 비무를 청해요.\n경지 ${hint}로 보여요 · ${muHint}.\n이기면 명성 +5, 판돈 +20냥, 수련치 +10. 지면 명성 −2, 가벼운 부상 1달.`
      : `떠돌이 낭인 '${ronin.byeolho}' ${ronin.name}이(가) 비무를 청합니다.\n경지 ${hint}로 보여요 · ${muHint}.`;
    g.notify(`떠돌이 낭인 ${ronin.name}이(가) 비무를 청합니다.`, { kind: 'alert', place: '운봉' });
    g.ask({ title: '떠돌이 낭인의 비무', body, place: '운봉', choices: [...fighters.map((p, i) => ({ id: p.id, label: `${['①', '②', '③'][i]} ${g.name(p)}${p.role === 'master' ? ' (장문인 직접)' : ''} · ${REALM[p.realm]}`, primary: i === 0 })), { id: 'refuse', label: `${first ? '④ ' : ''}정중히 거절` }] }, pick => {
      if (pick === 'refuse') {
        if (rng.chance(0.3)) { const y = calendar(state.month).year; if (state.ronin.rumorYear !== y) { state.ronin.rumorYear = y; g.addFame(-1); g.notify('"청운문이 낭인 하나를 피했다더라" — 명성 −1'); } else g.notify('"청운문이 또 낭인을 피했다더라"는 소문이 돌아요.'); }
        else g.notify('낭인은 고개를 끄덕이고 떠났어요.');
        bus.emit('changed'); return;
      }
      const ally = g.person(pick);
      const top = Math.max(...state.people.map(p => p.realm));
      g.requestDuel({ title: '떠돌이 낭인의 비무', place: '운봉', kind: 'ronin', ally, foe, onResult: win => {
        const R = { 1: [3, 10, 5, -1, 0], 2: [5, 20, 10, -2, 1], 3: [8, 40, 20, -2, 1], 4: [12, 80, 30, -3, 1] }[Math.min(4, realm)];
        if (win) { const f = Math.round(R[0] * (realm > top ? 1.5 : 1)); g.addFame(f); state.silver += R[1]; g.gainTp(ally, R[2]); g.notify(`비무 승리! 명성 +${f}, 판돈 +${R[1]}냥, ${g.name(ally)} 수련치 +${R[2]}`, { pause: true, kind: 'big' }); }
        else { g.addFame(R[3]); const inj = ally.role === 'master' ? 3 : R[4]; if (inj) injure(ally, inj); g.notify(`비무에서 졌어요. 명성 ${R[3]}${inj ? `, 부상 ${inj}달` : ''}`, { pause: true }); }
        roninStayRoll(ronin, foe, win);
      } });
    });
  }
  // v7.4 낭인이 남는 장면: 이기면 15%(내제자/속가/식객), 지면 3%(객경, 객방 필요). 한 해 최대 1명.
  function roninStayRoll(ronin, foe, win) {
    const y = calendar(state.month).year;
    if (state.ronin.stayYear === y) return;
    if (!rng.chance(win ? RONIN_STAY.winChance : RONIN_STAY.loseChance)) return;
    state.ronin.stayYear = y;
    const mk = role => ({ id: 'r' + state.month + Math.floor(rng.next() * 1e5), name: ronin.name, doho: '', byeolho: foe.realm >= 3 ? ronin.byeolho : '', nick: foe.realm >= 3 ? '' : ronin.byeolho, role,
      realm: foe.realm, meridians: foe.meridians, arts: { ...foe.arts }, simbeop: foe.simbeop, talent: { geun: rng.int(1, 2), oseong: rng.int(0, 2), sangjae: rng.int(0, 1) }, reveal: { geun: role === 'gaekgyeong' ? 2 : 1, oseong: 1, sangjae: 0 }, hints: {},
      tp: 0, task: null, injured: 0, discontent: 0, loyalty: 50, trainMonths: 0, bizMonths: 0, joined: state.month, ronin: true });
    if (!win) {
      if (!state.buildings.gaekbang) { g.notify(`${ronin.name}: "이 문파가 마음에 드는군. 객방이 생기면 다시 오겠소."`, { kind: 'big' }); state.ronin.revisit = { month: state.month + rng.int(3, 12), ronin, foe }; return; }
      return g.ask({ title: `${ronin.name}이(가) 남고 싶어 합니다`, body: '"이 문파가 마음에 드는군." 객경으로 모실까요? (생활비 + 예우비 10냥)', choices: [{ id: 'yes', label: '받기', primary: true }, { id: 'no', label: '사양' }] }, c => { if (c === 'yes') { state.people.push(mk('gaekgyeong')); g.notify(`${ronin.name}이(가) 객경으로 머물러요.`, { kind: 'big' }); bus.emit('changed'); } });
    }
    g.ask({ title: `${ronin.name}이(가) 남고 싶어 합니다`, body: '"곁에 머물며 배우고 싶소."', choices: [{ id: 'yes', label: '받기', primary: true }, { id: 'no', label: '사양' }] }, c => {
      if (c !== 'yes') return;
      const hasSokga = false; // 속가(무관)는 다음 업데이트
      g.ask({ title: '어떤 자리로 받을까요?', body: `내제자: 입문례 50냥 · 생활비 ${LIVING[foe.realm]}냥 · 본문 무공을 배워요\n식객: 비용 0 · 생활비 절반 · 머물기·의뢰·습격만, 본문 무공은 못 배워요\n속가제자: 속가(무관)가 있어야 해요`,
        choices: [{ id: 'naeje', label: '내제자 (입문례 50냥)', primary: true, disabled: state.silver < 50 }, { id: 'sikgaek', label: '식객' }, { id: 'sokga', label: '속가제자 — 속가 없음', disabled: !hasSokga }] }, role => {
        if (role === 'naeje') { state.silver -= 50; const p = mk('naeje'); p.doho = '하' + rng.pick(DOHO_SECOND); state.people.push(p); }
        else if (role === 'sikgaek') state.people.push(mk('sikgaek'));
        else return;
        g.notify(`${ronin.name}이(가) ${ROLE_NAME[role]}(으)로 청운문에 머물러요.`, { kind: 'big' }); checkAchievements(); bus.emit('changed');
      });
    });
  }
  g.roninEligible = () => {
    const top = Math.max(...state.people.map(p => p.realm));
    return state.fame >= 20 && state.fame < 300 && top <= 4 && state.month - state.ronin.last > 3;
  };
  function rollRonin() {
    if (!state.flags.eventA || !g.roninEligible() || !rng.chance(0.17)) return;
    const top = Math.max(...state.people.map(p => p.realm));
    const realm = Math.max(1, top + rng.weighted([[-1, 55], [0, 35], [1, 10]]));
    const weakest = Math.min(...state.people.filter(p => p.role === 'naeje').map(p => p.realm));
    state.ronin.last = state.month;
    if (realm <= weakest) { g.notify('문지기가 떠돌이 낭인 한 명을 정중히 돌려보냈어요.'); return; }
    const pool = RONIN.filter(r => realm >= r.realms[0] && realm <= r.realms[1]);
    roninEvent(pool.length ? rng.pick(pool) : RONIN[1], realm, false);
  }
  function eventB() {
    g.notify('청석 주막 단골 약초상이 의뢰를 청해요.', { kind: 'alert', place: '청석' });
    const free = state.people.filter(p => !g.isBusy(p) && p.role !== 'master');
    const sang = [...free].sort((a, b) => b.talent.sangjae - a.talent.sangjae)[0], mu = [...free].sort((a, b) => Math.max(b.talent.geun, b.talent.oseong) + b.realm - Math.max(a.talent.geun, a.talent.oseong) - a.realm)[0];
    const ch = [];
    if (sang) ch.push({ id: 'sang:' + sang.id, label: `상재로 수소문 — ${g.name(sang)}`, primary: true });
    if (mu && mu !== sang) ch.push({ id: 'mu:' + mu.id, label: `무재로 산길 — ${g.name(mu)}` });
    ch.push({ id: 'no', label: '거절' });
    g.ask({ title: '주막 손님의 의뢰', place: '청석', body: '"숯막골 길에서 약초 짐을 잃었소. 찾아 주면 사례하리다."\n0냥 · 1달. 성공하면 60냥 + 다음 모집 후보 +1. 실패해도 손해 없음.', choices: ch }, pick => {
      if (pick === 'no') return;
      const [mode, pid] = pick.split(':');
      g.startQuest('herbB', [pid], '청석', { label: '약초 짐 찾기', mode });
    });
  }
  function eventC() {
    g.notify('주막 소문: "숯막골 옆 산에 흑담채 잔당이 모인답니다."', { kind: 'alert', place: '숯막골' });
    g.ask({ title: '화전민촌 소문', place: '숯막골', body: `부두목 '외눈' 구칠이 잔당을 모으고 있어요.\n① 소탕 습격: 제자 2~3명 · 50냥 · 1달 → 숯막골 세력 +8, 은자 +40, 부두목과 일기토\n② 두기: 숯막골 산채화 확률 +5%p`, choices: [{ id: 'sweep', label: '① 소탕 보내기', primary: true }, { id: 'leave', label: '② 두기' }] }, pick => {
      if (pick === 'leave') { state.villages['숯막골'].banditChance += 0.05; g.notify('숯막골 산채화 확률 +5%p'); return; }
      state.flags.sweepPending = true; bus.emit('pickTeam', { quest: 'sweepC', target: '숯막골', cost: 50, label: '숯막골 소탕', min: 2, max: 3 });
      if (opts.headless) { const team = state.people.filter(p => !g.isBusy(p) && p.role !== 'master').sort((a, b) => b.realm - a.realm).slice(0, 2).map(p => p.id); g.startQuest('sweepC', team, '숯막골', { cost: 50, label: '숯막골 소탕', asRaid: true }); }
    });
  }
  function eventBeast() {
    const v = state.villages['까치재'];
    g.notify('까치재에 맹수가 나타났어요.', { kind: 'alert', place: '까치재' });
    const c = state.people.filter(p => !g.isBusy(p) && p.realm >= 2 && p.role !== 'master').sort((a, b) => a.realm - b.realm)[0];
    g.ask({ title: '맹수 출몰 — 까치재', place: '까치재', body: '이류 이상 1명 · 0냥 · 1달. 쫓으면 세력 +8(화전민촌 ×2), 모집 후보 +1. 두면 이 마을 세력 −10.', choices: c ? [{ id: c.id, label: `${g.name(c)} 보내기`, primary: true }, { id: 'no', label: '두기' }] : [{ id: 'no', label: '보낼 사람이 없어요' }] }, pick => {
      if (pick === 'no') { addInf(v, ME, -10); return; }
      g.startQuest('beastD', [pick], '까치재', { label: '맹수 쫓기' });
    });
  }
  function villageRoll() { // §4-1 화전민촌 분기 이벤트(1단계: 약초 철·산불·산채화 + 방치)
    let alerts = 0;
    for (const v of Object.values(state.villages)) {
      const mine = (v.inf[ME] || 0) > 0 || v.prov === 'guizhou';
      const tended = v.biz.length || state.tasks.some(t => t.target === v.id);
      if (!tended) v.neglect++; else v.neglect = 0;
      if (!mine) continue;
      const r = rng.next();
      const bandit = Math.min(0.4, v.banditChance + (tended ? 0 : 0.05 * v.neglect)) * ((v.inf[ME] || 0) >= 30 ? 0.5 : 1);
      let ev = null;
      if (r < 0.15) ev = 'herb'; else if (r < 0.23) ev = 'fire'; else if (r < 0.23 + bandit && !v.bandit) ev = 'bandit';
      if (!ev) continue;
      const text = { herb: `${v.name}에 약초 철이 왔어요(의뢰 가능).`, fire: `${v.name}에 산불 소식!`, bandit: `${v.name}이(가) 산채로 변할 조짐이에요.` }[ev];
      if (alerts < 2) { alerts++; g.notify(text, { place: v.id, kind: ev === 'herb' ? 'info' : 'alert' }); } else g.log(text, 'news');
      if (ev === 'herb' && v.biz.length) state.silver += 100 - 47; // 사들이기: 그 분기 약초 2배
      if (ev === 'bandit') { v.inf.hd = Math.max(v.inf.hd || 0, 40); v.bandit = true; v.banditChance = 0.05; recolor(v); }
    }
  }
  function sadeulRoll() { // 사들이기 물건(분기마다)
    for (const v of Object.values(state.villages)) for (const b of v.biz) if (b.type === 'sadeul') {
      const item = rng.weighted([['짐승 가죽', 35], ['약초', 30], ['산나물', 22], ['버섯·꿀', 10], ['작은 영약', 3]]);
      const val = { '짐승 가죽': 60, '약초': 50, '산나물': 30, '버섯·꿀': 40, '작은 영약': 0 }[item];
      state.silver += val;
      if (item === '작은 영약') { const p = state.people.find(x => x.role === 'master'); g.gainTp(p, 50); g.notify(`${v.name}에서 작은 영약(소환단)! 장문인 수련치 +50`, { kind: 'big' }); }
      else g.log(`${v.name} 사들이기: ${item} ${val}냥`);
    }
  }

  // ── 업적 ──
  function unlockAch(id) {
    if (state.achievements[id]) return;
    const A = ACHIEVEMENTS[id]; state.achievements[id] = state.month; state.titles.push(A.title);
    if (!state.settings.titlesOnly) { if (A.bonus.silver) state.silver += A.bonus.silver; if (A.bonus.fame) g.addFame(A.bonus.fame); if (A.bonus.recruit) state.recruitBonus += A.bonus.recruit; }
    g.notify(`업적 [${A.tier}] '${A.name}' — 칭호 「${A.title}」${state.settings.titlesOnly ? '' : ' · ' + A.bonusText}`, { kind: 'ach' });
    bus.emit('achievement', { id, ...A });
  }
  function checkAchievements() {
    const mineTowns = Object.values(state.towns).filter(t => t.owner === ME && !t.home && !t.startMine);
    if (mineTowns.length && !state.achievements.firstTown) unlockAch('firstTown');
    if (state.people.filter(p => p.role === 'naeje').length >= 10) unlockAch('disciples10');
    let biz = 0; for (const pl of [...Object.values(state.towns), ...Object.values(state.villages)]) biz += pl.biz.filter(b => b.owner === ME).length;
    if (biz >= 5) unlockAch('biz5');
    if (Object.keys(state.buildings).length) unlockAch('firstBuilding');
  }
  g.checkAchievements = checkAchievements;
  function onColorChange(ch) {
    if (ch.to === ME) g.notify(`${ch.place.name}에 청록이 번져요 — 이제 우리 색이에요!`, { pause: true, kind: 'big', place: ch.place.id });
    else if (ch.from === ME) g.notify(`${ch.place.name}의 청록이 옅어졌어요.`, { pause: true, kind: 'alert', place: ch.place.id });
    checkAchievements(); bus.emit('colors');
  }

  // ── 달 넘김 ──
  const SCRIPT = [ // §9 첫 30분 대본: [달, 달 안 진행도, 사건]
    [3, 0.35, () => raidEvent('청석')],
    [5, 0.3, () => { state.flags.eventA = true; roninEvent(RONIN[0], 2, true); }],
    [6, 0.3, eventB],
    [8, 0.25, eventC],
    [11, 0.3, eventBeast],
    [13, 0.2, () => g.notify('무림대회 공고 — 3달 뒤 열려요. 대표 제자를 키워 보내는 게 다음 목표예요. (무림대회는 다음 업데이트)', { pause: true, kind: 'big' })],
  ];
  function fireScripts(prevProg) {
    for (const [m, at, fn] of SCRIPT) { const key = 's' + m; if (state.month === m && state.prog >= at && !state.flags[key]) { state.flags[key] = true; fn(); } }
  }
  function monthEnd() {
    const m = state.month;
    const L = applyMonth(state);
    if (L.shortfall) { for (const p of state.people) if (p.role !== 'master') p.discontent += p.loyalty < 40 ? 15 : 10; if (!state.flags.firstArrears) { state.flags.firstArrears = true; g.notify('제자들의 밥상이 줄었습니다.', { pause: true, kind: 'alert' }); } }
    else if (state.arrears > 0 && state.silver >= state.arrears) { state.silver -= state.arrears; state.arrears = 0; for (const p of state.people) p.discontent = Math.max(0, p.discontent - 30); }
    else for (const p of state.people) p.discontent = Math.max(0, p.discontent - 5);
    // 이탈(§5-4 ②-1) · 식객(v7.4: 마지막 제자 보호 없음, 불만 70 넘으면 바로)
    for (const p of [...state.people]) {
      if (p.role === 'sikgaek') {
        const leave = p.discontent > SIKGAEK.leaveDiscontent || ((state.month - p.joined) > 0 && (state.month - p.joined) % 12 === 0 && rng.chance(SIKGAEK.yearlyLeaveChance));
        if (leave) { if (p.task) g.cancelTask(p.task); state.people = state.people.filter(x => x !== p); g.notify(`식객 ${p.name}: "다시 길을 떠나겠소."`, { kind: 'alert' }); }
      } else if (p.role === 'naeje' && p.discontent >= 70) {
        const naeje = state.people.filter(x => x.role === 'naeje');
        if (naeje.length > 1 && rng.chance(p.discontent >= 90 ? 0.25 : 0.1)) { if (p.task) g.cancelTask(p.task); state.people = state.people.filter(x => x !== p); g.notify(`${g.name(p)}이(가) 하산했어요.`, { pause: true, kind: 'alert' }); }
      }
    }
    // 수련치(§5-4 ④)
    for (const t of state.tasks) {
      for (const pid of t.people) {
        const p = g.person(pid); if (!p) continue;
        const pen = p.discontent >= 60 ? 0.5 : p.discontent >= 30 ? 0.7 : 1;
        if (t.type === 'train') { let v = 30 * (state.buildings.suryeondong ? 1.1 : 1) + (t.coach ? 15 : 0); g.gainTp(p, v * pen); p.trainMonths++; }
        if (t.type === 'stay') g.gainTp(p, 3 * pen);
        if (t.type === 'manage') { g.gainTp(p, 2 * pen); p.bizMonths = (p.bizMonths || 0) + 1; if (p.bizMonths >= 3) p.reveal.sangjae = 2; else p.reveal.sangjae = Math.max(p.reveal.sangjae || 0, 1); }
      }
    }
    for (const p of state.people) { if (p.trainMonths >= 3) { p.reveal.geun = Math.max(p.reveal.geun || 0, 1); p.reveal.oseong = Math.max(p.reveal.oseong || 0, 1); } if (p.trainMonths >= 12 && p.reveal.geun < 2) { p.reveal.geun = p.reveal.oseong = 2; if (p.talent.geun === 3 || p.talent.oseong === 3) { if (!state.achievements.hiddenDragon) unlockAch('hiddenDragon'); g.addFame(10); g.notify(`숨은 기재! ${p.name}의 재능이 드러났어요.`, { pause: true, kind: 'big' }); } } }
    // 세력
    const changes = monthlyInfluence(state);
    for (const c of changes) onColorChange(c);
    // 일 진행
    for (const t of [...state.tasks]) if (t.remaining != null) { t.remaining--; if (t.remaining <= 0) completeTask(t); }
    for (const p of state.people) if (p.injured > 0) { p.injured--; if (!p.injured) g.log(`${g.name(p)} 부상이 나았어요.`); }
    if (m % 3 === 0) { villageRoll(); sadeulRoll(); }
    if (m === UNLOCK_MONTH) state.flags.monthEnded6 = true;
    checkUnlock(); checkAchievements();
    // 경고(§5-4 ②-1)
    const next = monthLedger(state, m + 1).net;
    if (next < 0 && !state.flags.warnNeg) { state.flags.warnNeg = true; g.notify(`다음 달 은자 ${next} 예상`, { kind: 'alert' }); } else if (next >= 0) state.flags.warnNeg = false;
    if (m === 12) g.notify('다음 달 첫해 혜택이 끝나요 → 생활비가 원래대로 돌아와요.', { kind: 'alert' });
    state.month++; state.prog = 0;
    bus.emit('month', state.month);
    if (state.month > 5) rollRonin();
    if (state.ronin.revisit && state.month >= state.ronin.revisit.month) { const rv = state.ronin.revisit; state.ronin.revisit = null; if (state.buildings.gaekbang) { state.ronin.stayYear = null; g.notify(`${rv.ronin.name}이(가) 다시 찾아왔어요.`); } }
    if (state.month > 9 && state.month !== 11 && rng.chance(0.06) && (state.towns['청석'].inf.hd || 0) >= 15) raidEvent('청석');
    bus.emit('changed'); bus.emit('autosave');
  }
  g.tick = sec => { // 실제 초 → 게임 진행
    if (!state.introDone || state.speed === 0) return;
    const mul = opts.debugSpeed || 1;
    let left = sec * state.speed * mul / SEC_PER_MONTH;
    while (left > 0 && state.speed !== 0) {
      const step = Math.min(left, 1 - state.prog, 0.02);
      state.prog += step; left -= step;
      fireScripts();
      if (state.prog >= 1 - 1e-9) monthEnd();
    }
  };
  g.advanceMonths = n => { const s = state.speed; state.speed = 1; const tgt = state.month + n; let guard = 0; while (state.month < tgt && guard++ < 10000) { if (state.speed === 0) state.speed = 1; g.tick(SEC_PER_MONTH / 50 / (opts.debugSpeed || 1)); } state.speed = s; };
  g.endIntro = () => { state.introDone = true; bus.emit('changed'); };
  g.serialize = () => { save(); return JSON.stringify(state); };
  g.load = json => { state = JSON.parse(json); rng.s = state.rngS; bus.emit('loaded'); bus.emit('changed'); };
  g.ledger = m => monthLedger(state, m || state.month);
  g.bizIncome = (pl, b) => bizIncome(state, pl, b);
  g.living = p => livingCost(state, p, state.month);
  g.stayCost = id => stayCost(state, id);
  g._ev = { roninEvent, rollRonin, monthEnd }; // 테스트용
  g.BUILDINGS = BUILDINGS; g.TASKS = TASKS; g.BIZ = BIZ; g.PROVINCES = PROVINCES;
  return g;
}
