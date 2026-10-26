// §2 흐르는 시간: 1배에서 1달 = 2분(120초). 멈춤·1·2·4배.
export const SEC_PER_MONTH = 120;
export const SPEEDS = [0, 1, 2, 4];
export function calendar(month) { // month 1 = 강호력 1년 3월(봄)
  const idx = month - 1 + 2; // 0-based 달(3월부터)
  const year = 1 + Math.floor(idx / 12), m = (idx % 12) + 1;
  const season = m >= 3 && m <= 5 ? '봄' : m >= 6 && m <= 8 ? '여름' : m >= 9 && m <= 11 ? '가을' : '겨울';
  return { year, m, season, text: `강호력 ${year}년 ${season} ${m}월` };
}
export const timeSystem = {
  id: 'time',
  // 실제 진행은 game.tick에서(달 넘김 순서를 한 곳에서 지키려고)
};
