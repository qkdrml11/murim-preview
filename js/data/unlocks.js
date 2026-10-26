// §9 ① 해금 순서표 (확정, v7.5). 한 줄 = 기능 키 하나. 화면·규칙은 G.isOpen(key)만 봐요.
// month: 이 달(state.month)이 시작될 때 queue에 들어가요. 한 달에 하나만 열려요(§9 ⑤).
// line: 알림 한 줄, story: 계기 사건 대사(이야기 창). reveal: 안개가 걷히는 고을.
export const UNLOCK_V = 1;
export const START_OPEN = ['train', 'inn'];
export const UNLOCK_STEPS = [
  { key: 'train', step: 1, month: 0, name: '수련', line: '할 수 있는 일: 수련, 주막 돌보기', story: '하연: "사형제 다섯이 남았습니다. 우선 칼부터 다시 잡지요."' },
  { key: 'inn', step: 1, month: 0, name: '주막 돌보기' },
  { key: 'quest', step: 2, month: 1, name: '의뢰', line: '새로 열렸어요: 의뢰', story: '주막 손님: "우물이 막혀 마을이 난리요."' },
  { key: 'biz_inn', step: 3, month: 2, name: '사업 열기', line: '새로 열렸어요: 사업 열기 · 청석이 지도에 보여요', story: '하봉: "청석에도 주막을 내면 어떨까요?"', reveal: ['청석'] },
  { key: 'duel', step: 4, month: 3, name: '일기토', line: '새로 열렸어요: 일기토', story: '흑담채 장귀돌이 청석 주막을 노려요. 하연: "제가 막겠습니다."' },
  { key: 'stay', step: 5, month: 4, name: '머물기 · 고을 세력', line: '새로 열렸어요: 머물기 · 고을 세력', story: '청석 주민: "청운문 분들이 계시면 든든하겠소."' },
  { key: 'ronin', step: 6, month: 5, name: '낭인 비무', line: '떠돌이 낭인이 찾아왔어요', story: null },
  { key: 'auto', step: 7, month: 6, name: '일기토 자동 설정', line: '자동 설정이 열렸어요', story: null, cond: 'autoDuel' },
  { key: 'biz_pyo', step: 8, month: 7, name: '표국', line: '새로 열렸어요: 표국', story: '약초상: "짐 지키는 표국이 있으면 좋겠소."' },
  { key: 'raid', step: 9, month: 8, name: '습격', line: '새로 열렸어요: 습격', story: '주막 소문: "숯막골 옆 산에 흑담채 잔당이…"', reveal: ['숯막골'] },
  { key: 'ledger', step: 10, month: 9, name: '살림', line: '새로 열렸어요: 살림', story: '백도정이 장부를 펼쳐요: "사형, 쌀독을 한번 보시지요."' },
  { key: 'recruit', step: 11, month: 10, name: '제자 모집', line: '새로 열렸어요: 제자 모집', story: '운봉 아이들이 산문 앞에 줄을 서요.' },
  { key: 'path', step: 12, month: 11, name: '수련 방향', line: '새로 열렸어요: 수련 방향', story: '새 제자 첫 수련. 하연: "무엇부터 가르칠까요?"' },
  { key: 'build', step: 13, month: 12, name: '본산 짓기', line: '새로 열렸어요: 본산 짓기', story: '하봉: "사람이 늘어 거처가 좁습니다."' },
  { key: 'tourney', step: 14, month: 13, name: '무림대회 공고', line: '다음 목표: 무림대회', story: '귀주에 방이 붙어요: "3년마다 열리는 무림대회."' },
  // §9 ③ 30분 뒤(간단히). 1단계엔 기능이 없어 '열림'만 기록하고, biz_all은 안개를 전부 걷어요.
  { key: 'diplo', step: 15, month: 14, name: '외교', line: '새로 열렸어요: 외교(다음 업데이트)', later: true },
  { key: 'challenge', step: 16, month: 15, name: '비무 청하기', line: '새로 열렸어요: 비무 청하기(다음 업데이트)', later: true },
  { key: 'faction', step: 17, month: 16, name: '진영 · 악명', line: '새로 열렸어요: 진영 · 악명(다음 업데이트)', later: true },
  { key: 'march', step: 18, month: 17, name: '출정', line: '새로 열렸어요: 출정(다음 업데이트)', later: true },
  { key: 'biz_all', step: 19, month: 18, name: '사업 전부 · 지도 전부', line: '지도의 안개가 모두 걷혔어요 · 사들이기 열림', later: true, revealAll: true },
  { key: 'build_all', step: 20, month: 20, name: '건물 전부', line: '새로 열렸어요: 본산 건물 전부', later: true },
  { key: 'tourney_join', step: 21, month: 36, name: '무림대회 참가', line: '무림대회 참가(다음 업데이트)', later: true },
];
export const UNLOCK_KEYS = UNLOCK_STEPS.map(s => s.key);
export const STEP = Object.fromEntries(UNLOCK_STEPS.map(s => [s.key, s]));
// 일(TASKS) → 필요한 기능 키. 표에 없으면 늘 열림.
export const TASK_FEATURE = { train: 'train', manage: 'inn', request: 'quest', openJumak: 'biz_inn', stay: 'stay', openPyoguk: 'biz_pyo', raid: 'raid', recruit: 'recruit', build: 'build', openSadeul: 'biz_all', coach: 'path' };
// 건물 → 키(수련동만 먼저, 나머지는 build_all)
export const BUILD_FEATURE = { suryeondong: 'build', mangru: 'build_all', gaekbang: 'build_all', yeonmu: 'build_all' };
// 시작부터 보이는 곳(나머지는 안개). reveal로 하나씩 걷혀요.
export const START_VISIBLE = ['운봉'];
