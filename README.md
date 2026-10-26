# 청운문 (새 방향 1단계 · 기획 v7.4)
모바일 세로 한 손 플레이 수묵 문파 경영 + 수읽기 일기토. 기획: `design/방향전환_핵심루프.md` §9 '첫 30분'.

- 실행: 이 폴더를 아무 정적 서버로(`python3 -m http.server 8820`) 열기.
- 테스트: `node --test tests/` · `NODE_PATH=/tmp/pw/node_modules node tests/e2e.cjs http://localhost:8820/`
- 구조: [ARCHITECTURE.md](ARCHITECTURE.md)

## 디버그
- `?debug=1&unlock=all&speed=30` — 모든 기능 열기 + 배속. 해금 구조는 ARCHITECTURE.md 참고.
