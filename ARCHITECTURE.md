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
