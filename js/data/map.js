// §4 지도: 성 16 · 고을 80 · 화전민촌 40. 좌표는 세로 1000×1300 가상 화폭(북=위).
export const W = 1000, H = 1300;
export const SIZES = {
  village: { name: '화전민촌', slots: 1, incomeMul: 0, recruit: 0, infMul: 2, base: 0 },
  small:   { name: '작은마을', slots: 1, incomeMul: 0.6, recruit: 2, infMul: 1.5, base: 0 },
  large:   { name: '큰마을', slots: 2, incomeMul: 1, recruit: 3, infMul: 1, base: 1, baseVal: 10 },
  town:    { name: '소도시', slots: 3, incomeMul: 1.5, recruit: 3, infMul: 1, base: 1, baseVal: 15 },
  mid:     { name: '중도시', slots: 4, incomeMul: 2, recruit: 4, infMul: 0.75, base: 2, baseVal: 15 },
  city:    { name: '대도시', slots: 5, incomeMul: 3, recruit: 5, infMul: 0.5, base: 3, baseVal: 15 },
};
export const SIZE_ORDER = ['village', 'small', 'large', 'town', 'mid', 'city'];
export const PROVINCES = [
  { id: 'hebei', name: '하북', x: 600, y: 150 }, { id: 'shandong', name: '산동', x: 840, y: 210 },
  { id: 'henan', name: '하남', x: 620, y: 360 }, { id: 'shaanxi', name: '섬서', x: 420, y: 330 },
  { id: 'liang', name: '량주', x: 190, y: 190 }, { id: 'xuhuai', name: '서주·회남', x: 840, y: 420 },
  { id: 'jiangnan', name: '강남', x: 860, y: 640 }, { id: 'hubei', name: '호북', x: 600, y: 560 },
  { id: 'hunan', name: '호남', x: 640, y: 800 }, { id: 'jiangxi', name: '강서', x: 830, y: 860 },
  { id: 'sichuan', name: '사천', x: 360, y: 610 }, { id: 'yunnan', name: '운남', x: 230, y: 1010 },
  { id: 'guizhou', name: '귀주', x: 440, y: 880 }, { id: 'lingnan', name: '영남', x: 620, y: 1120 },
  { id: 'qinghai', name: '청해', x: 120, y: 450, outer: true }, { id: 'tibet', name: '서장', x: 110, y: 800, outer: true },
];
export const ADJ = {
  hebei: ['shandong', 'henan', 'shaanxi', 'liang'], shandong: ['hebei', 'henan', 'xuhuai'],
  henan: ['hebei', 'shandong', 'shaanxi', 'xuhuai', 'hubei'], shaanxi: ['hebei', 'henan', 'liang', 'sichuan', 'hubei', 'qinghai'],
  liang: ['hebei', 'shaanxi', 'qinghai'], xuhuai: ['shandong', 'henan', 'hubei', 'jiangnan'],
  jiangnan: ['xuhuai', 'hubei', 'jiangxi'], hubei: ['henan', 'shaanxi', 'sichuan', 'hunan', 'jiangxi', 'jiangnan', 'xuhuai'],
  hunan: ['hubei', 'jiangxi', 'guizhou', 'lingnan', 'sichuan'], jiangxi: ['hunan', 'hubei', 'jiangnan', 'lingnan'],
  sichuan: ['shaanxi', 'hubei', 'hunan', 'guizhou', 'yunnan', 'qinghai', 'tibet'], yunnan: ['sichuan', 'guizhou', 'lingnan', 'tibet'],
  guizhou: ['sichuan', 'yunnan', 'hunan', 'lingnan'], lingnan: ['guizhou', 'hunan', 'jiangxi', 'yunnan'],
  qinghai: ['liang', 'shaanxi', 'sichuan', 'tibet'], tibet: ['qinghai', 'sichuan', 'yunnan'],
};
// [성, 이름, 한자, 크기, 성지 주인, 메모]
const T = `hebei 업 鄴 city;hebei 계 薊 mid;hebei 북평 北平 town;hebei 남피 南皮 town;hebei 진양 晉陽 town;hebei 상당 上黨 large;hebei 양평 襄平 large;hebei 팽가장 彭家莊 large pg
shandong 평원 平原 town;shandong 북해 北海 town;shandong 제남 濟南 large
henan 낙양 洛陽 city;henan 허창 許昌 mid;henan 완 宛 mid;henan 개봉 開封 mid;henan 진류 陳留 town;henan 여남 汝南 town;henan 하내 河內 town;henan 복양 濮陽 large;henan 등봉 登封 large;henan 숭산 嵩山 small sl
shaanxi 장안 長安 city;shaanxi 한중 漢中 mid;shaanxi 상용 上庸 large;shaanxi 화음 華陰 large;shaanxi 화산 華山 small hw
liang 무위 武威 town;liang 서량 西涼 town;liang 천수 天水 town;liang 안정 安定 large;liang 공동산 崆峒山 small kd
xuhuai 하비 下邳 mid;xuhuai 수춘 壽春 mid;xuhuai 소패 小沛 large;xuhuai 여강 廬江 town;xuhuai 남궁가 南宮家 large ng
jiangnan 건업 建業 city;jiangnan 오 吳 mid;jiangnan 항주 杭州 mid;jiangnan 회계 會稽 town;jiangnan 소주 蘇州 town
hubei 양양 襄陽 city;hubei 강릉 江陵 mid;hubei 강하 江夏 town;hubei 신야 新野 large;hubei 균주 均州 large;hubei 무당산 武當山 small wd
hunan 장사 長沙 mid;hunan 무릉 武陵 town;hunan 영릉 零陵 town;hunan 계양 桂陽 large;hunan 악양 岳陽 town;hunan 군산 君山 small gb;hunan 여울 - large;hunan 검은골 - small
jiangxi 남창 南昌 mid;jiangxi 시상 柴桑 town;jiangxi 여산 廬山 large sd
sichuan 성도 成都 city;sichuan 강주 江州 mid;sichuan 재동 梓潼 town;sichuan 영안 永安 town;sichuan 낙산 樂山 large;sichuan 당가타 唐家沱 large dg
yunnan 운남 雲南 town;yunnan 건녕 建寧 town;yunnan 대리 大理 large;yunnan 점창산 點蒼山 small jc
guizhou 귀양 貴陽 mid;guizhou 운봉 - town;guizhou 청석 - large;guizhou 솔뫼 - small;guizhou 돌다리 - small
lingnan 남해 南海 mid;lingnan 교지 交趾 town;lingnan 계림 桂林 large
qinghai 서녕 西寧 small;qinghai 십만대산 十萬大山 small cm
tibet 포달랍 布達拉 small pd;tibet 시가체 日喀則 small`;
// 귀주·호남 주변은 시안(v4.1 성 보기)대로 손으로 놓아요.
const FIXED = { 귀양: [418, 838], 운봉: [462, 905], 청석: [532, 862], 솔뫼: [392, 912], 돌다리: [428, 975], 여울: [590, 880], 검은골: [612, 940], 장사: [668, 770] };
const VILLAGE_COUNT = { hebei: 3, shandong: 2, henan: 2, shaanxi: 3, liang: 3, xuhuai: 2, jiangnan: 1, hubei: 3, hunan: 3, jiangxi: 2, sichuan: 3, yunnan: 3, guizhou: 4, lingnan: 3, qinghai: 2, tibet: 1 };
const GZ_VILLAGES = [['안개골', 372, 860], ['숯막골', 560, 828], ['까치재', 500, 960], ['도토리재', 372, 990]];

function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }
export function provinceAt(x, y) {
  // 가장 가까운 성 중심(조금 일렁이게) — 경계 그리기와 탭 판정에 같이 써요.
  let best = null, bd = 1e18;
  for (const p of PROVINCES) {
    const wob = 1 + 0.06 * Math.sin(x * 0.021 + p.x * 0.01) * Math.cos(y * 0.017 + p.y * 0.013);
    const d = ((x - p.x) ** 2 + (y - p.y) ** 2) * wob;
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}
export function buildMap() {
  const towns = [], villages = [];
  const byProv = {};
  for (const line of T.split('\n')) for (const e of line.split(';')) {
    const [prov, name, hanja, size, holy] = e.trim().split(/\s+/);
    (byProv[prov] = byProv[prov] || []).push({ prov, name, hanja: hanja === '-' ? '' : hanja, size, holy: holy || null });
  }
  for (const p of PROVINCES) {
    const list = byProv[p.id] || [];
    list.forEach((t, i) => {
      let x, y;
      if (FIXED[t.name]) [x, y] = FIXED[t.name];
      else {
        // 성 중심 둘레에 해시로 흩뿌리되 그 성 안에 머물게.
        for (let k = 0; k < 40; k++) {
          const a = hash(t.name + k) * Math.PI * 2, r = (i === 0 ? 0 : 38 + 64 * hash(t.name + 'r' + k));
          x = p.x + Math.cos(a) * r; y = p.y + Math.sin(a) * r * 0.85;
          if (provinceAt(x, y) === p && x > 30 && x < W - 30 && y > 40 && y < H - 40 && !towns.some(o => (o.x - x) ** 2 + (o.y - y) ** 2 < 34 * 34)) break;
        }
      }
      towns.push({ id: t.name, ...t, x: Math.round(x), y: Math.round(y) });
    });
  }
  for (const p of PROVINCES) {
    const n = VILLAGE_COUNT[p.id];
    if (p.id === 'guizhou') { for (const [name, x, y] of GZ_VILLAGES) villages.push({ id: name, name, prov: p.id, size: 'village', x, y, near: '' }); continue; }
    const host = towns.filter(t => t.prov === p.id);
    for (let i = 0; i < n; i++) {
      const t = host[(i * 2 + 1) % host.length];
      const suf = ['골', '재', '막'][i % 3];
      const a = hash(t.name + 'v' + i) * Math.PI * 2;
      let x = t.x + Math.cos(a) * 30, y = t.y + Math.sin(a) * 26;
      villages.push({ id: t.name + suf + (i >= 3 ? i : ''), name: t.name + suf, prov: p.id, size: 'village', x: Math.round(x), y: Math.round(y), near: t.name });
    }
  }
  return { towns, villages };
}
export function provDist(a, b) {
  if (a === b) return 0;
  const seen = { [a]: 0 }, q = [a];
  while (q.length) { const c = q.shift(); for (const n of ADJ[c]) if (seen[n] === undefined) { seen[n] = seen[c] + 1; if (n === b) return seen[n]; q.push(n); } }
  return 9;
}
// 시작 세력(§4 귀주 표 + 호남 + 성지 하한 60 + 도시 기본 세력)
export function initialInfluence(t) {
  const inf = {};
  const S = SIZES[t.size];
  const pool = { hunan: ['hs', 'gb', 'sh'], jiangxi: ['sd', 'sh', 'gw'], sichuan: ['dg', 'sh', 'gw'], yunnan: ['jc', 'od', 'sh'], qinghai: ['cm'], tibet: ['pd'],
    hebei: ['pg', 'sh', 'gw'], henan: ['sl', 'sh', 'gw'], shaanxi: ['hw', 'sh', 'gw'], liang: ['kd', 'sh', 'gw'], xuhuai: ['ng', 'sh', 'gw'], hubei: ['wd', 'sh', 'gw'], jiangnan: ['sh', 'gw', 'ch'], shandong: ['sh', 'gw', 'ch'], lingnan: ['sh', 'gw', 'ch'], guizhou: ['sh', 'gw'] }[t.prov];
  if (S.base) for (let i = 0; i < S.base; i++) inf[pool[i % pool.length]] = S.baseVal;
  if (t.holy) inf[t.holy] = 60;
  const special = { 운봉: { cw: 60 }, 청석: { cw: 30, hd: 34 }, 솔뫼: { cw: 32 }, 여울: { hs: 48 }, 검은골: { hs: 72 }, 장사: { hs: 70, sh: 15 }, 귀양: { sh: 15, gw: 15 } }[t.id];
  if (special) Object.assign(inf, special);
  // 지도에 강호 색이 보이도록, 본거지 성의 1등 문파를 조금 세게(1단계 가정)
  const homes = { qinghai: 'cm', tibet: 'pd', jiangxi: 'sd', sichuan: 'dg', yunnan: 'jc', hunan: 'hs' };
  if (!special && !t.holy && homes[t.prov]) inf[homes[t.prov]] = Math.max(inf[homes[t.prov]] || 0, 42);
  return inf;
}
