# 실행 화면 부품 (`systems/play` → `play/`)

전투 · 개척 · 제작 · 수업 · 매점 같은 **놀이 화면**은 보관고(`systems/vault/modules`)의 화면 코드를 묶어 만든 부품입니다.
별도 사이트가 아니라, 비령 메인 화면(`index.html`)의 페이지 안(`#playRoot`)에 끼워 넣습니다. 머리글 · 뒤로가기 · 나의 상태는 메인 화면의 것입니다.

## 주소

| 주소 | 화면 |
|---|---|
| `#/zone/<구역>/<탭>/<칸>` | 구역 페이지. 칸이 실행 칸이면 그 자리에서 바로 열린다 (예: `#/zone/east/annex/workshop`) |
| `#/go/battle` · `#/go/battle/<상대 id>` | 퇴마 실습 · 그 상대와 바로 전투 |
| `#/go/extra/<1~10>` | 추가전투 단계별 |
| `#/go/pioneer` · `#/go/pioneer/<터 id>` | 개척 · 그 터로 바로 |
| `#/go/workshop` · `#/go/kitchen` | 공작소 · 조리실 |
| `#/go/lesson` · `#/go/lesson/<과목 id>` | 수업 · 그 미니게임 바로 |
| `#/go/store` `armory` `garden` `train` `sleep` `rest` | 매점 · 무구 강화 · 텃밭 · 수련 · 잠 · 양호실 |

## 메인 화면과의 연결 (`window.BiryeongPlay`)

- `mount(el)` 한 번 붙인다 · `show(주소 | null)` 그릴 화면을 고른다(null 이어도 수련 · 대기 시간은 흐른다) · `reload()` 프로필이 바뀌었을 때
- `api()` → `{ upgradeStat(key), statCost(key), openInventory(), grant({ spirit, money, items, log }), player }`
- 실행 화면 → 메인 화면: `biryeong:saved`(저장됨) · `biryeong:toast` · `biryeong:nav`(다른 화면으로 / 뒤로) 이벤트
- 저장은 `localStorage['biryeong-save-v1']` 한 칸을 나눠 쓴다. 실행 화면 몫은 `game` · `counts`(업적 횟수) · `playLog`.

## 새 화면 붙이기

1. `src/App.jsx` 의 `switch (route.screen)` 에 한 줄 — 보관고 화면을 import 해서 `player` 와 `H.(처리 함수)` 를 넘긴다
2. 처리 함수가 없으면 `src/usePlayHost.js` 에 더한다 (규칙 계산은 `@vault/game/*`, 업적 횟수는 `bump` · `peak` · `collect`)
3. 구역 페이지에 칸을 만들려면 `systems/site-data/build.mjs` 의 `zones` 에 `play('칸 id', '이름', '주소')`
4. `npm run build`

## 빌드할 때 하는 일 (`build.mjs`)

보관고 원본은 고치지 않고, 묶을 때만 바꿉니다: 아이콘 패키지 대신 `src/shims/lucide-react.jsx`, 아이템 아이콘은 `src/PixelItemIcon.jsx`(도트),
영능력 · 학교 이름과 색상값 치환, 그림 · 소리 주소(`play/…`), 그리고 **모든 스타일을 `.play-scope` 안에 가둡니다**(메인 화면 스타일과 섞이지 않게).

```bash
npm install     # esbuild · react · react-dom · tailwindcss (개발용)
npm run build   # 개변 데이터 → 구역 데이터 → 실행 화면 순서로 다시 만든다
```
