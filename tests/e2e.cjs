// Playwright e2e: 첫 30분 빠른 진행(디버그 배속) · 콘솔 오류 0 · 핀치 3단계 · 직접 일기토 · 자동 해금 창 · 저장/불러오기.
// 실행: NODE_PATH=/tmp/pw/node_modules node tests/e2e.cjs [base_url]
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:8820/';
const OUT = '/workspace/projects/murim/review/nd1_screens/';
const VIEWS = process.env.VIEW ? [process.env.VIEW.split('x').map(Number)] : [[360, 640], [390, 844], [320, 568]];
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };

async function pinch(p, cdp, cx, cy, from, to) {
  const pts = d => [{ x: cx - d, y: cy, id: 1 }, { x: cx + d, y: cy, id: 2 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(from) });
  for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(from + (to - from) * i / 8) }); await sleep(16); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(500);
}
// 떠 있는 창·시트·일기토를 '§9 흐름대로' 처리
async function handle(p, log, opt = {}) {
  // 일기토
  if (await p.locator('#duel.open').count()) {
    if (await p.locator('#duel .result button').count()) { await sleep(300); await p.locator('#duel .result button').click({ timeout: 2000 }).catch(() => {}); log.push('duel-end'); return true; }
    const cards = p.locator('#duel .card:not(.no):not(.sealed)');
    if (await cards.count()) { const hint = await p.locator('#duel .hint span').textContent().catch(() => '');
      const want = /칼끝/.test(hint) ? 'def' : /낮춘/.test(hint) ? 'atk' : /손바닥/.test(hint) ? 'evade' : 'atk';
      const c = p.locator(`#duel .card.${want}:not(.no):not(.sealed)`); await ((await c.count()) ? c.first() : cards.first()).click({ timeout: 1500 }).catch(() => {});
      if (await p.locator('.circleWrap').count()) { await sleep(900); await p.locator('.circleWrap').click().catch(() => {}); }
      await sleep(400); return true; }
    await sleep(200); return true;
  }
  // 창
  const m = p.locator('.modal-bg .modal');
  if (await m.count()) {
    const title = (await m.locator('h3').textContent().catch(() => '')) || '';
    const btns = m.locator('.btn:not([disabled])');
    let target = btns.first();
    if (/자동으로 진행/.test(title)) { log.push('auto-dialog'); if (opt.shot) await p.screenshot({ path: OUT + opt.shot + '_auto_dialog.png' }); target = m.locator('.btn', { hasText: log.filter(x => x === 'auto-dialog').length === 1 ? '직접' : '자동' }).first(); }
    if (/자동 겨루기가 열렸/.test(title)) { log.push('unlock'); if (opt.shot) await p.screenshot({ path: OUT + opt.shot + '_unlock.png' }); }
    if (/일기토|낭인|비무/.test(title) && opt.shot && !log.includes('duelstart')) { log.push('duelstart'); await p.screenshot({ path: OUT + opt.shot + '_duel_start.png' }); }
    if (/화전민촌 소문/.test(title)) target = m.locator('.btn').first();
    if (/관리인/.test(title)) target = m.locator('.btn.pri').first().or(btns.first()).first();
    await sleep(270); await target.click({ timeout: 2000 }).catch(() => {}); log.push('modal:' + title.slice(0, 14)); await sleep(120); return true;
  }
  // 시트(모집·사건 C 팀)
  if (await p.locator('#sheet.open #rcOk').count()) { const c = p.locator('#sheet [data-rc]'); for (let i = 0; i < Math.min(2, await c.count()); i++) await c.nth(i).click(); await p.locator('#rcOk').click(); log.push('recruit'); return true; }
  if (await p.locator('#sheet.open #pkOk').count()) { const c = p.locator('#sheet [data-pk]'); for (let i = 0; i < Math.min(2, await c.count()); i++) await c.nth(i).click();
    if (await p.locator('#pkOk:not([disabled])').count()) await p.locator('#pkOk').click(); else await p.locator('#pkNo').click(); log.push('pickTeam'); return true; }
  return false;
}
async function assign(p, who, taskName, targetName) {
  await p.locator('.pp', { hasText: who }).first().click(); await sleep(350);
  await p.locator('#sheet .item', { hasText: taskName }).first().click(); await sleep(250);
  if (targetName) { await p.locator('#sheet .item', { hasText: targetName }).first().click(); await sleep(250); }
  await p.locator('#sheet [data-act=go]').click(); await sleep(250);
}
// 새 게임: 운봉·일 2개만, 탭·범례 숨김, 안개 / 옛 v0.5.2 세이브는 백업 뒤 새로 시작
async function fresh(b, w, h, tag, errs) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push(String(e)));
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('inj')) { sessionStorage.setItem('inj', '1'); localStorage.setItem('murim_save_v5', JSON.stringify({ v: 5, turn: 3, player: { name: 'old' } })); } });
  await p.goto(BASE + '?debug=1'); await sleep(900);
  const t = await p.evaluate(() => document.body.innerText);
  for (let i = 0; i < 6 && await p.locator('.modal .btn').count(); i++) { await sleep(270); await p.locator('.modal .btn').first().click(); }
  ok(t.includes('예전 버전 저장은 그대로 두었어요'), '옛 세이브 알림 한 줄');
  const ks = await p.evaluate(() => ({ v5: localStorage.getItem('murim_save_v5'), bk: localStorage.getItem('murim_save_v5_old052'), key: ND.SAVE_KEY, f: ND.game.state.flags.oldSaveNoticed }));
  ok(ks.v5 && JSON.parse(ks.v5).v === 5 && !ks.bk && ks.key === 'murim_save_v7' && ks.f, 'v5 예전 저장 그대로 · 백업 없음 · 새 키 ' + ks.key);
  const vis = await p.evaluate(() => ({ biz: !document.querySelector('#tabs [data-tab=biz]').offsetParent, mg: !document.querySelector('#tabs [data-tab=mugong]').offsetParent, lg: document.querySelector('#legend').hidden, v: Object.keys(ND.game.state.towns).filter(id => ND.game.visible(id)) }));
  ok(vis.biz && vis.mg && vis.lg, '살림·무공 탭·범례 숨김'); ok(vis.v.join() === '운봉', '보이는 고을 운봉만: ' + vis.v.join());
  await p.locator('.pp', { hasText: '마동철' }).first().click(); await sleep(400);
  const tasks = await p.locator('#sheet [data-act=task]').allTextContents(); ok(tasks.length === 2, '맡길 일 2개: ' + tasks.map(x => x.slice(0, 6)).join('/'));
  await p.screenshot({ path: OUT + tag + '_11_fresh_start.png' });
  await ctx.close();
}
async function run([w, h]) {
  const tag = `${w}x${h}`; console.log(`\n■ ${tag}`);
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); const errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push(String(e)));
  await p.goto(BASE + '?debug=1&unlock=all&speed=30'); await sleep(700);
  await p.screenshot({ path: OUT + tag + '_01_intro.png' });
  for (let i = 0; i < 4; i++) { await sleep(270); await p.locator('.modal .btn').first().click(); }
  await sleep(400); await p.screenshot({ path: OUT + tag + '_02_main.png' });
  // 작은 글씨·누름 영역 검사
  const small = await p.evaluate(() => [...document.querySelectorAll('#app *')].filter(e => e.childNodes.length && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && e.offsetParent && parseFloat(getComputedStyle(e).fontSize) < 13).map(e => e.className + ':' + e.textContent.slice(0, 10)));
  ok(small.length === 0, '13px 미만 글씨 없음 ' + (small.length ? JSON.stringify(small.slice(0, 5)) : ''));
  await sleep(800); // 애니메이션(반짝·토스트) 끝난 뒤 재기
  const tiny = await p.evaluate(() => [...document.querySelectorAll('#app button')].filter(e => e.offsetParent && !e.closest('#peopleRow')).map(e => e.getBoundingClientRect()).filter(r => r.height < 44 || r.width < 44).length);
  if (tiny) console.log(await p.evaluate(() => [...document.querySelectorAll('#app button')].filter(e => e.offsetParent && !e.closest('#peopleRow')).filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).map(e => e.id + '.' + e.className + ':' + e.textContent.slice(0, 8) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height)).join(' | ')));
  ok(tiny === 0, '버튼 44px 이상 (작은 것 ' + tiny + ')');
  // 핀치 3단계
  const cdp = await ctx.newCDPSession(p); const box = await p.locator('#map').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const lvl = () => p.evaluate(() => ND.map.level);
  await pinch(p, cdp, cx, cy, 90, 30); ok(await lvl() === 0, '핀치 아웃 → 천하'); await p.screenshot({ path: OUT + tag + '_03_cheonha.png' });
  await pinch(p, cdp, cx, cy, 30, 100); ok(await lvl() === 1, '핀치 인 → 성');
  await pinch(p, cdp, cx, cy, 30, 100); ok(await lvl() === 2, '핀치 인 → 고을'); await p.screenshot({ path: OUT + tag + '_04_town.png' });
  await p.locator('#levelSeg button[data-l="1"]').click(); await sleep(900);
  await p.screenshot({ path: OUT + tag + '_10_prov_labels.png' });
  const ls = await p.evaluate(() => ND.map.labelStats()); ok(ls && ls.shown > 0, '성 단계 이름표 겹침 없이 ' + JSON.stringify(ls));
  // §9 첫 달: 하봉 청석 주막, 하율 청석 머물기, 청하검 수련
  await assign(p, '마동철', '주막 열기', '청석'); await sleep(200);
  if (await p.locator('.modal').count()) await handle(p, []);
  await assign(p, '한서율', '고을에 머물기', '청석');
  await assign(p, '청하검', '수련');
  await p.screenshot({ path: OUT + tag + '_05_assigned.png' });
  await p.locator('.sp[data-s="4"]').click();
  // 빠르게 15달
  const log = []; const t0 = Date.now(); let shotLedger = false, shotDuel = false;
  while (Date.now() - t0 < 150000) {
    const m = await p.evaluate(() => ND.game.state.month);
    if (m > 14) break;
    if (await p.locator('#duel.open .card').count() && !shotDuel) { shotDuel = true; await p.screenshot({ path: OUT + tag + '_06_duel.png' }); }
    const did = await handle(p, log, { shot: tag });
    if (!did) { const sp = await p.evaluate(() => ND.game.state.speed); if (sp === 0) { await p.locator('.sp[data-s="4"]').click().catch(() => {}); } await sleep(150); }
    if (m === 7 && !shotLedger) { shotLedger = true; await p.locator('#tabs [data-tab=biz]').click(); await sleep(300); await p.screenshot({ path: OUT + tag + '_07_ledger.png' }); await p.locator('#tabs [data-tab=map]').click(); }
  }
  const st = await p.evaluate(() => { const s = ND.game.state; return { m: s.month, silver: s.silver, fame: s.fame, manual: s.duels.manual, unlocked: s.duels.unlocked, cs: s.towns['청석'].owner, ppl: s.people.length }; });
  console.log('  상태', JSON.stringify(st), log.filter(x => !x.startsWith('modal')).join(','));
  ok(st.m > 14, '15달 넘게 진행(' + st.m + ')'); ok(st.manual >= 1, '직접 일기토 ' + st.manual + '번'); ok(st.unlocked, '자동 설정 열림(unlock=all)');
  ok(log.includes('auto-dialog'), '"자동으로 진행하시겠습니까?" 창'); ok(st.cs === 'cw', '청석 청록');
  await p.evaluate(() => ND.game.setSpeed(0)); for (let i = 0; i < 20 && await handle(p, log); i++);
  await p.screenshot({ path: OUT + tag + '_08_late.png' });
  await p.locator('#tabs [data-tab=news]').click(); await sleep(300); await p.screenshot({ path: OUT + tag + '_09_news.png' }); await p.locator('#tabs [data-tab=map]').click();
  // 저장/불러오기
  await p.evaluate(() => { ND.game.setSpeed(0); ND.save(); });
  const before = await p.evaluate(() => JSON.stringify({ m: ND.game.state.month, s: ND.game.state.silver, n: ND.game.state.people.length, k: ND.SAVE_KEY }));
  await p.reload(); await sleep(900);
  const after = await p.evaluate(() => JSON.stringify({ m: ND.game.state.month, s: ND.game.state.silver, n: ND.game.state.people.length, k: ND.SAVE_KEY }));
  ok(before === after, '저장/불러오기 ' + after);
  ok(!(await p.locator('.story').count()), '다시 열면 이야기 건너뜀');
  // 묻는 창 띄운 채 새로고침 → 다시 떠야 함(버그 2)
  await p.evaluate(() => ND.game._ev.roninEvent({ name: '노삼', byeolho: '철검', camp: '중립' }, 2, true)); await sleep(500);
  const q1 = await p.locator('.modal-bg .modal h3').first().textContent().catch(() => '');
  await p.reload(); await sleep(1400);
  const q2 = await p.locator('.modal-bg .modal h3').allTextContents().catch(() => []);
  ok(q1 && q2.some(t => t === q1), `새로고침 뒤 묻는 창 다시 뜸 (${q1})`);
  await fresh(b, w, h, tag, errs);
  ok(errs.length === 0, '콘솔 오류 0 ' + (errs.length ? JSON.stringify(errs.slice(0, 3)) : ''));
  await b.close();
}
(async () => { for (const v of VIEWS) await run(v); console.log(fails ? `\n실패 ${fails}` : '\n모두 통과'); process.exit(fails ? 1 : 0); })();
