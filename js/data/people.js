// 시작 인물(§1·§11). realm: 1 삼류 2 이류 3 일류 4 절정 5 초절정 6 화경 7 현경
export const REALM = ['', '삼류', '이류', '일류', '절정', '초절정', '화경', '현경'];
export const REALM_BY_MERIDIAN = [[0, 1], [4, 2], [6, 3], [9, 4], [12, 5]]; // 경맥 수 → 경지(1단계 가정)
export const TALENT = ['하', '중', '상', '기재'];
export const TALENT_MUL = [0.8, 1.0, 1.25, 1.6];
export const LIVING = { 1: 8, 2: 12, 3: 20, 4: 30, 5: 30, 6: 30, 7: 30 }; // §5-4 ②
export function startPeople() {
  // costOverride: §9의 '생활비 54(첫해 절반 27)'에 맞춘 시작 5명 몫(1단계 가정, 표대로면 60이라 §9 숫자를 따름).
  return [
    { id: 'p0', name: '단청우', doho: '현오', byeolho: '', nick: '', role: 'master', realm: 3, meridians: 7, arts: { chungun: 7 }, simbeop: '상승', sinbeop: 'unyoung',
      talent: { geun: 2, oseong: 2, sangjae: 1 }, reveal: { geun: 2, oseong: 2, sangjae: 2 }, age: 35 },
    { id: 'p1', name: '윤서하', doho: '하연', byeolho: '청하검', nick: '', role: 'naeje', realm: 3, meridians: 6, arts: { chungun: 5, yukhap: 6 }, simbeop: '중승', sinbeop: 'unyoung',
      talent: { geun: 2, oseong: 1, sangjae: 1 }, reveal: { geun: 2, oseong: 2, sangjae: 2 }, costOverride: 20, age: 24 },
    { id: 'p2', name: '마동철', doho: '하봉', byeolho: '', nick: '철두', role: 'naeje', realm: 2, meridians: 4, arts: { yukhap: 4 }, simbeop: '하승',
      talent: { geun: 2, oseong: 0, sangjae: 1 }, reveal: { geun: 2, oseong: 2, sangjae: 2 }, costOverride: 12, age: 22 },
    { id: 'p3', name: '한서율', doho: '하율', byeolho: '', nick: '조용한 칼', role: 'naeje', realm: 2, meridians: 4, arts: { yukhap: 4 }, simbeop: '하승',
      talent: { geun: 1, oseong: 1, sangjae: 0 }, reveal: { geun: 2, oseong: 2, sangjae: 2 }, costOverride: 10, age: 21 },
    { id: 'p4', name: '임아린', doho: '하린', byeolho: '', nick: '소약선', role: 'naeje', realm: 1, meridians: 2, arts: { yukhap: 2 }, simbeop: '하승',
      talent: { geun: 0, oseong: 2, sangjae: 1 }, reveal: { geun: 2, oseong: 2, sangjae: 2 }, costOverride: 6, age: 17 },
    { id: 'p5', name: '백도정', doho: '하정', byeolho: '', nick: '목검동자', role: 'naeje', realm: 1, meridians: 1, arts: { yukhap: 1 }, simbeop: '하승',
      talent: { geun: 1, oseong: 1, sangjae: 1 }, reveal: { geun: 2, oseong: 2, sangjae: 2 }, costOverride: 6, age: 14 },
  ].map(p => ({ tp: 0, task: null, injured: 0, discontent: 0, loyalty: 70, trainMonths: 0, bizMonths: 0, founder: true, hints: {}, ...p }));
}
// 적·낭인(§11, §5-6 ③-1). style: 'sapa'|'jeongpa'|'ronin'
export const FOES = {
  janggwidol: { name: '장귀돌', byeolho: '흑면호', realm: 3, meridians: 6, arts: { heukpung: 5 }, simbeop: '중승', style: 'sapa', hpMul: 1.0, fake: 0.3 },
  guchil:     { name: '구칠', byeolho: '외눈', realm: 2, meridians: 4, arts: { heukpung: 3 }, simbeop: '하승', style: 'sapa', fake: 0.3 },
};
export const RONIN = [ // 이름, 별호, 최소~최대 경지, 버릇
  { name: '노삼', byeolho: '철검', realms: [2, 2], fake: 0.1, habit: 'none' },
  { name: '허진', byeolho: '외팔 도객', realms: [2, 3], fake: 0.3, habit: 'def' },
  { name: '곽소매', byeolho: '쌍비수', realms: [3, 3], fake: 0.3, habit: 'evade' },
  { name: '묵장', byeolho: '흑창', realms: [3, 4], fake: 0.3, habit: 'atk' },
  { name: '연사구', byeolho: '취검', realms: [4, 4], fake: 0.5, habit: 'random' },
  { name: '단목휘', byeolho: '백의 서생검', realms: [4, 4], fake: 0.3, habit: 'big' },
];
export const RECRUIT_SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '송', '류'];
export const RECRUIT_GIVEN = ['도윤', '서진', '하람', '지후', '민재', '태오', '수아', '연우', '은호', '재희', '시율', '가온', '로운', '이준', '다온', '유찬'];
export const DOHO_SECOND = ['운', '경', '진', '명', '산', '월', '성', '송', '청', '휘', '담', '현'];
export const HINTS = {
  geun: ['몸이 여려 보인다', '평범한 체격이다', '몸이 단단해 보인다', '뼈마디가 범상치 않다… 넘어져도 멍 하나 없다'],
  oseong: ['말을 알아듣는 데 오래 걸린다', '가르치면 따라 한다', '눈빛이 맑다', '한 번 본 초식을 흉내 낸다'],
  sangjae: ['셈이 서툴다', '장터 물정을 안다', '흥정에 능하다', '주판알보다 사람 마음을 먼저 읽는다'],
};
// v7.4 자리(role): master 장문인 · naeje 내제자 · sokga 속가제자 · sikgaek 식객 · gaekgyeong 객경
export const ROLE_NAME = { master: '장문인', naeje: '내제자', sokga: '속가제자', sikgaek: '식객', gaekgyeong: '객경' };
// 식객 규칙(§5-6 ③-1 v7.4). 떠날 조건·진영 경고 문구는 아직 확정 전이라 값만 여기 모아 둬요(바꾸기 쉽게).
export const SIKGAEK = {
  costMul: 0.5, tasks: ['stay', 'request', 'raid'], canLearnSectArts: false, lastDiscipleProtection: false,
  leaveDiscontent: 70, yearlyLeaveChance: 0.2, joinOfferAfterMonths: 12, joinOfferLoyalty: 70, hintBonus: 0.1,
  pending: true, campWarningText: '(진영 경고 문구 — 기획 확정 전)',
};
export const RONIN_STAY = { winChance: 0.15, loseChance: 0.03, perYear: 1 };
