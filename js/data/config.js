// 조정값 한곳 모음(기획 v7.6.2, 모두 확정). 바뀌면 여기만 고치면 돼요.
export const CONFIG = {
  startSilver: 320,                 // 시작 은자(v7.6 확정)
  suryeondongCost: 100,             // 수련동 값(v7.6: 150 → 100)
  unlocksPerMonth: 1,               // 해금 속도: 달마다 최대 하나
  firstYearHalfMonths: 9,           // 창립 제자 생활비 절반 기간(9달까지)
  oldSaveNotice: '새 안내 방식이 생겼어요', // 기존 세이브: 이야기 창 없이 한 줄만
};
// 숫자 규칙(v7.6.2): 5냥 단위는 처음 보이는 고정 숫자(시작값·직급 생활비·표 값)에만. 계산값(합·배율·%·절반)은 Math.round 1냥 단위.
