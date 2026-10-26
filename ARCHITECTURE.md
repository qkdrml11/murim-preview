# 청운문 — 새 방향 1단계 구조

빌드 없음. 순수 HTML/CSS/JS(ES 모듈). 같은 규칙 코드가 브라우저와 Node 테스트에서 돌아요.

```
index.html, style.css      화면 뼈대 · 수묵 스타일(종이 결은 SVG feTurbulence, 외부 그림 없음)
js/core/   bus.js          이벤트 버스 + 시스템 등록소(registerSystem)
           rng.js          시드 난수(mulberry32) — 저장에 상태 포함
js/data/   factions, map, mugong, people, tasks, achievements   — 표(기획 §번호 주석)
js/systems/time, economy, influence, duel, names                — 순수 규칙(화면 모름)
js/game.js                 상태 + 일 맡기기 + 사건 대본(§9) + 달 넘김 순서 + 저장
js/ui/     map.js          캔버스 지도(바탕 1회 렌더 · 세력 물감 층 · 3단계 확대/핀치)
           sheets.js       인물/고을 시트 · 일 맡기기 흐름 · 모집 · 팀 고르기
           tabs.js         문파·살림·무공·강호소식(업적·설정)
           duel.js         일기토 화면
           modal.js        창 줄 세우기(250ms 잘못 누름 방지) · toast.js 알림(최대 2)
           util.js         진동(설정) · 초상/힌트 SVG
js/main.js                 연결 · 저장 · 디버그 매개변수
tests/logic.test.js        node --test (시간·살림·세력·일기토·해금·낭인·식객)
tests/e2e.cjs              Playwright(360×640 · 390×844 · 320×568, 터치)
```

## 흐름
- `game.bus` 이벤트: `notify, ask, duel:request, recruit, pickTeam, speed, changed, month, colors, autosave, unlock, achievement`.
- 규칙은 이벤트만 내고, 화면(`js/ui`)이 받아 그려요. 화면 없는 모드(`createGame({headless:true, answer, duelMode, manualResult})`)로 테스트.
- 달 넘김 순서(`monthEnd`): 살림 → 밀린 생활비/불만 → 이탈(식객 포함) → 수련치 → 세력 → 일 완료 → 부상 → 화전민촌(분기) → 해금 → 업적 → 달+1 → 낭인/습격 굴림.

## 새 시스템 붙이기(속가·출정·외교·진영·무림대회·대 잇기)
1. `js/data/`에 표 추가(예: `TASKS`에 한 줄 — `openSokga`).
2. `js/systems/xxx.js`에 순수 규칙 + `game.reg.register({ id:'sokga', on:{ month: fn } })`.
3. 필요하면 `js/ui/`에 화면, `main.js`에서 버스 이벤트 연결.
- 사람 `role`: `master | naeje | sokga | sikgaek | gaekgyeong` (v7.4). 식객 규칙 값은 `data/people.js`의 `SIKGAEK`(떠날 조건·진영 경고 문구는 기획 미정 → 자리표시).

## 저장
- `localStorage['murim_nd1_save']` (미리보기 주소에선 `murim_nd1_preview_save`). 예전 `murim_*` 저장과 섞이지 않아요. 달 끝·앱 숨김 때 자동 저장.

## 디버그
- `?debug=1` → `window.ND`, `?debug=1&speed=30` → 시간 30배(기본 꺼짐).

## 해금(기능 열기) — 기획 §9 ⑤ (v7.5~v7.6.2)

- **상태:** `state.unlock = { v:1, open:{key:달}, queue:[], last, countThisMonth, seen }` — 세이브 안에 함께 저장(별도 키 없음).
- **순서표:** `js/data/unlocks.js` `UNLOCK_STEPS` (키·달·안내 한 줄·이야기·드러나는 고을). 새 게임은 `train, inn`만 열림, 지도는 운봉만.
- **여는 규칙:** `js/systems/unlocks.js` `onMonthStart()` — 달이 넘어갈 때 queue 맨 앞 하나만(`CONFIG.unlocksPerMonth`). 예외: 1달은 달 넘김이 없어 의뢰(quest)를 1달 절반에 열어요. `auto`는 직접 일기토 3번이면 queue 맨 앞으로.
- **화면:** 버튼·탭·범례는 `game.isOpen(key)`가 참일 때만. HTML은 `data-feature="키"` 붙이면 `applyFeatures()`가 숨김/표시(잠금 아이콘 없음, 일기토 [자동] 자물쇠만 예외). 지도는 `game.visible(id)`가 거짓인 곳을 먹안개로 덮고 탭·이름표 없음.
- **열릴 때:** `feature:open` → 토스트/이야기 창 + 해당 요소 반짝(`.feat-pop`).
- **기능 추가하는 법:** ① `UNLOCK_STEPS`에 한 줄 ② 일이면 `TASK_FEATURE`, 건물이면 `BUILD_FEATURE`에 매핑 ③ UI 요소에 `data-feature` 또는 `game.isOpen()` 검사.
- **디버그:** `?debug=1&unlock=all` → 전부 열기(`unlocks.openAll()`), `&speed=N` 배속.
- **기존 세이브:** `migrateState` — `unlock`이 없으면 달 ≤ 지금 달인 것 + 이미 쓴 기능을 한꺼번에, 이야기 없이 `CONFIG.oldSaveNotice` 한 줄만.

## 저장 키·옛 형식
- 본 사이트 `murim_save_v5`(기획), 미리보기 `murim_nd1_preview_save`. 옛 v0.5.2(5b62ce4)도 `murim_save_v5`를 썼고 형식이 달라(`{v:5, turn, player…}`) `isOurSave()`로 가려내요 → `murim_save_v5_old052`로 백업 후 "예전 버전 저장" 창 → 새로 시작. 충돌 안 함.

## 묻는 창 저장(새로고침 버그)
- `g.decide(kind, ctx, spec)` → `state.pending`에 저장, 처리기는 `DECIDE[kind]`(ctx는 직렬화 가능 값만). 일기토 대기는 `state.pendingDuel` + `DUEL_RESULT[rk]`. 불러온 뒤 `game.resumePending()`이 다시 띄워요.

## 지도 이름표 겹침
- `map.drawLabels`: 우선순위(본산 > 우리 땅 > 알림 > 선택 > 초점 > 크기) 순으로 자리 잡고, 겹치면 아래→위→오른쪽→왼쪽, 그래도 겹치면 생략. 글자 13px 이상.

## 조정값·숫자 규칙
- `js/data/config.js` `CONFIG`: 시작 은자 320, 수련동 100, 해금 달마다 1, 첫해 절반 9달, 옛 세이브 한 줄 문구 — 모두 v7.6.2 확정, 한곳에서 고쳐요.
- 숫자(v7.6.2): 고정 숫자(직급 생활비 5/15/20/30, 시작 60·절반 30, 표 값 대객잔 65·천리표국 90)는 5냥 단위, 계산값(합·배율·%·절반)은 `Math.round` 1냥(예: 운봉 객잔 68).
- 9달째 살림 알림: `g.benefitEndText()` = "다음 달부터 옛 의리 혜택이 끝나요 → 수지 +X → +Y"(실제 장부로 계산).
