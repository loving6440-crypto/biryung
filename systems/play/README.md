# 실행 화면 (`systems/play` → `play/`)

전투 · 개척 · 제작 · 수업 같은 **놀이 화면**은 보관고(`systems/vault/modules`)의 초록동색 화면 코드를 그대로 묶어서 돌립니다.
빌드 결과는 저장소 맨 위의 `play/` 폴더이고, GitHub Pages 에서도 그대로 열립니다.

## 여는 방법

- 메인 화면의 구역 창에서 **▶ 버튼**을 누르면 실행 화면이 창으로 뜹니다. 닫으면 오른쪽 '나의 상태'가 바로 갱신됩니다.
- 주소로 바로 열기: `play/index.html#주소` (새 탭 · 링크 · 북마크 모두 가능)

| 주소 | 화면 |
|---|---|
| `#` | 바로 실행 목록 |
| `#battle` · `#battle/<적 id>` | 퇴마 실습(튜토리얼 포함) · 그 상대와 바로 전투 (추가전투 50종의 id 도 됨) |
| `#extra/<1~10>` | 추가전투 단계별 |
| `#pioneer` · `#pioneer/<터 id>` | 개척 · 그 터로 바로 들어가기 (`left-trail-1` … `lake` 등) |
| `#workshop` · `#kitchen` | 공작소 · 조리실 |
| `#lesson` · `#lesson/<과목 id>` | 수업 · 그 미니게임 바로 (`talisman-2048` `spell-typing` `ward-tetris` `folklore-spot` `divination-fortune` `exorcism-space`) |
| `#store` `#armory` `#garden` `#train` `#sleep` `#rest` `#stats` `#inventory` | 매점 · 무구 강화 · 텃밭 · 수련 · 잠 · 양호실 · 스탯 올리기 · 소지품 |

## 저장

메인 화면과 같은 `localStorage['biryeong-save-v1']` 를 나눠 씁니다. 실행 화면은 `game`(플레이어 상태) · `counts`(업적 횟수) · `playLog` 만,
메인 화면은 나머지(프로필 · 업적 · 칭호 …)만 적습니다. 실행 화면의 캐릭터는 처음 열 때 내 프로필(이름 · 육조 스탯)로 만들어집니다.

## 새 화면 붙이기

1. `src/routes.js` 의 `ROUTE_GROUPS` 에 한 줄 (`path`, `label`, `note`)
2. `src/App.jsx` 의 `switch (route.screen)` 에 한 줄 — 보관고 화면을 import 해서 `player` 와 `H.(처리 함수)` 를 넘긴다
3. 처리 함수가 없으면 `src/usePlayHost.js` 의 `handlers` 에 더한다 (규칙 계산은 `@vault/game/*` 를 쓴다)
4. 구역 화면에 버튼을 달려면 `systems/site-data/build.mjs` 에서 `run('주소', '버튼 글')` 을 붙이고 `npm run site:data`
5. `npm run play:build`

## 빌드

```bash
npm install          # esbuild · react · react-dom · tailwindcss (개발용)
npm run build        # game-data.js + play/ 를 다시 만든다
```

- `lucide-react` 는 설치하지 않습니다. `src/shims/lucide-react.jsx` 가 같은 이름의 아이콘을 그립니다(새 아이콘은 거기에 한 줄).
- 서버가 필요한 기능(채팅 · 다인 전투 · 판놀이 · 랭킹 공유)은 실행 화면에 넣지 않았습니다.
