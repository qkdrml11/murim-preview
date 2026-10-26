import { createGame } from '../js/game.js';
const g = createGame({ headless: true, seed: 5 });
g.endIntro(); const s = g.state;
const show = () => console.log('달', s.month, '은자', s.silver, '명성', s.fame, '청석', JSON.stringify(s.towns['청석'].inf), s.towns['청석'].owner, 'unlock', s.duels.unlocked);
console.log(g.assign('openJumak', ['p2'], '청석'), g.assign('stay', ['p3'], '청석'), g.assign('request', ['p4'], '청석', { label: '우물 의뢰' }), g.assign('train', ['p1'], 'p1'), g.assign('train', ['p5'], 'p5'));
g.advanceMonths(1); show();
for (let i = 0; i < 12; i++) { if (s.month === 4 && s.flags.counterHint && !s.tasks.some(t=>t.type==='raid')) console.log('raid', g.assign('raid', ['p0','p4'].filter(id=>!g.isBusy(g.person(id))).concat(['p0']).slice(0,2), '청석').ok); if (s.month === 7) console.log('pyoguk', g.assign('openPyoguk', ['p0'], '청석').ok); if (s.month===10) console.log('rec', g.assign('recruit',['p0'],'운봉').ok); if (s.month===12) console.log('build', g.assign('build',['p0'],'suryeondong').ok); g.advanceMonths(1); show(); }
console.log(s.log.slice(0, 40).map(l => l.m + ' ' + l.t).reverse().join('\n'));
