// §6 업적(1단계에 들어간 것). 보상: 칭호 + 작은 보너스(설정 '칭호만'이면 칭호만).
export const ACHIEVEMENTS = {
  firstTown: { tier: '동', name: '첫 고을 물들이기', title: '물들이는 자', bonus: { silver: 20 }, bonusText: '은자 +20' },
  disciples10: { tier: '동', name: '제자 10명', title: '스승의 그릇', bonus: { recruit: 1 }, bonusText: '다음 모집 후보 +1' },
  biz5: { tier: '동', name: '사업 5곳', title: '장터의 이름', bonus: { silver: 30 }, bonusText: '은자 +30' },
  firstBuilding: { tier: '동', name: '첫 본산 건물', title: '다시 세우는 자', bonus: { fame: 2 }, bonusText: '명성 +2' },
  hiddenDragon: { tier: '동', name: '숨은 용', title: '눈 밝은 스승', bonus: { fame: 10 }, bonusText: '명성 +10' },
  firstDuel: { tier: '동', name: '첫 일기토 승리', title: '검을 다시 든 문파', bonus: { silver: 10 }, bonusText: '은자 +10' },
};
