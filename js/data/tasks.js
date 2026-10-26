import { CONFIG } from './config.js';
// §2 일 목록 중 1단계에 넣은 일. who: 맡을 수 있는 사람, target: 대상 종류.
// 새 일(속가 열기·출정·외교 …)은 이 표에 한 줄 + game.js의 complete 처리만 붙이면 돼요.
export const TASKS = {
  openJumak:  { name: '주막 열기', who: 'disciple', target: 'town', cost: 200, months: 1, biz: 'jumak', desc: '사업 시작 · 세력 +2/달' },
  openPyoguk: { name: '표국 열기', who: 'realm3', target: 'town', cost: 200, months: 2, biz: 'pyoguk', desc: '사업 시작 · 세력 +2/달' },
  openSadeul: { name: '사들이기', who: 'disciple', target: 'village', cost: 100, months: 1, biz: 'sadeul', desc: '화전민촌 전용 · 분기마다 물건 1개 · 세력 +4/달' },
  stay:       { name: '고을에 머물기', who: 'disciple', target: 'place', cost: 0, months: null, monthly: 'stay', desc: '매달 세력 +1(일류 +2)' },
  request:    { name: '의뢰·구휼', who: 'disciple', target: 'place', cost: 30, months: 1, desc: '세력 +6 · 명성 +2' },
  recruit:    { name: '제자 모집', who: 'master', target: 'recruitTown', cost: 150, months: 1, desc: '후보 중 원하는 만큼 받기' },
  train:      { name: '수련', who: 'any', target: 'self', cost: 0, months: null, desc: '매달 수련치 30' },
  manage:     { name: '사업 관리', who: 'disciple', target: 'myBiz', cost: 0, months: null, desc: '상재 배율로 수입 ×0.8~×1.6' },
  coach:      { name: '수련 지도', who: 'realm3', target: 'trainee', cost: 0, months: null, monthly: 20, desc: '제자 수련치 +15/달' },
  raid:       { name: '습격', who: 'disciple', target: 'raidTown', cost: 50, months: 1, team: [2, 3], desc: '성공하면 우리 +5 · 상대 −10' },
  build:      { name: '본산 짓기', who: 'any', target: 'building', cost: 0, months: 0, desc: '건물 1채(동시에 1채)' },
};
export const REQUEST_NAMES = ['우물 의뢰', '다리 고치기', '약초 나누기', '도적 쫓기', '곡식 나눔', '길 닦기'];
export const BUILDINGS = { // §5-3 (1단계: 수련동·망루를 지을 수 있고, 나머지는 조건만 보여 줘요)
  suryeondong: { name: '수련동', cost: CONFIG.suryeondongCost, months: 2, effect: '본산에서 수련하는 사람 수련치 +10% · 거처 +3' },
  mangru: { name: '망루', cost: 200, months: 2, effect: '본산 고을 습격을 1달 먼저 알림 · 습격 성공률 −10%' },
  gaekbang: { name: '객방', cost: 250, months: 2, effect: '객경 1명(다음 업데이트)', locked: '명성 30 · 객경 시스템은 다음 단계' },
  yeonmu: { name: '연무장', cost: 300, months: 3, effect: '모집 후보 +1, 수련 지도 +10%', locked: '수련동 필요 · 다음 단계' },
};
