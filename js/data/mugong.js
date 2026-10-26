// 무공·초식(§11 이름표 먼저, 빈 칸은 1단계 가정). type: atk 공 / def 수 / evade 변.
// power: 체력 대비 %. big: 큰 초식. unlock: 그 무공이 몇 성일 때 카드로 오는지(1단계 가정).
export const BASIC = {
  jjireugi: { id: 'jjireugi', name: '찌르기', hanja: '刺', type: 'atk', power: 8, cost: 0, basic: true },
  makgi:    { id: 'makgi', name: '막기', hanja: '守', type: 'def', power: 8, cost: 0, basic: true },
  heulligi: { id: 'heulligi', name: '흘리기', hanja: '流', type: 'evade', power: 8, cost: 0, basic: true },
};
export const ARTS = {
  chungun: { name: '청운적하검 상권', kind: '검법', moves: [
    { id: 'cw1', name: '청운출수', hanja: '靑雲出手', type: 'def', power: 12, cost: 1, unlock: 1 },
    { id: 'cw2', name: '청운비하', hanja: '靑雲飛霞', type: 'atk', power: 18, cost: 2, unlock: 3 },
    { id: 'cw3', name: '청운낙일', hanja: '靑雲落日', type: 'evade', power: 20, cost: 3, unlock: 5 },
    { id: 'cw4', name: '청운만리', hanja: '靑雲萬里', type: 'atk', power: 30, cost: 4, big: true, unlock: 7 } ] },
  yukhap: { name: '육합검', kind: '검법', moves: [
    { id: 'yh1', name: '육합일검', hanja: '六合一劍', type: 'atk', power: 12, cost: 1, unlock: 1 },
    { id: 'yh2', name: '육합회선', hanja: '六合回旋', type: 'evade', power: 16, cost: 2, unlock: 3 },
    { id: 'yh3', name: '육합진산', hanja: '六合鎭山', type: 'def', power: 18, cost: 2, unlock: 5 },
    { id: 'yh4', name: '육합귀원', hanja: '六合歸元', type: 'atk', power: 25, cost: 3, unlock: 8 } ] },
  heukpung: { name: '흑풍도', kind: '도법', moves: [
    { id: 'hp1', name: '흑풍난무', hanja: '黑風亂舞', type: 'atk', power: 16, cost: 2, unlock: 1 },
    { id: 'hp2', name: '흑풍파산', hanja: '黑風破山', type: 'atk', power: 30, cost: 4, big: true, unlock: 4 } ] },
  jeoksu: { name: '적수마공', kind: '장법', moves: [
    { id: 'js1', name: '망월참', hanja: '望月斬', type: 'atk', power: 12, cost: 1, unlock: 1 },
    { id: 'js2', name: '귀영참', hanja: '鬼影斬', type: 'atk', power: 18, cost: 2, unlock: 3 },
    { id: 'js3', name: '절혼참', hanja: '絶魂斬', type: 'atk', power: 25, cost: 3, unlock: 6 } ] },
  nangin: { name: '낭인검', kind: '검법', moves: [
    { id: 'ni1', name: '낭인일섬', hanja: '浪人一閃', type: 'atk', power: 12, cost: 1, unlock: 1 },
    { id: 'ni2', name: '철벽세', hanja: '鐵壁勢', type: 'def', power: 14, cost: 1, unlock: 1 },
    { id: 'ni3', name: '회선보', hanja: '廻旋步', type: 'evade', power: 16, cost: 2, unlock: 2 },
    { id: 'ni4', name: '낙엽참', hanja: '落葉斬', type: 'atk', power: 22, cost: 3, unlock: 5 },
    { id: 'ni5', name: '일도양단', hanja: '一刀兩斷', type: 'atk', power: 30, cost: 4, big: true, unlock: 7 } ] },
};
export const SINBEOP = { unyoung: '운영보', deungpyeong: '등평도수' };
export const SIMBEOP = { // 합마다 내력 회복 (§5-8 ④)
  하승: { regen: 1, first: 1 }, 중승: { regen: 1, first: 2 }, 상승: { regen: 2, first: 2 }, 절세: { regen: 2, first: 3 },
};
export const TYPE_NAME = { atk: '공', def: '수', evade: '변' };
export const TYPE_HANJA = { atk: '攻', def: '守', evade: '變' };
