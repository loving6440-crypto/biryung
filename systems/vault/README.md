# 초록동색 C.01 콘텐츠 보관고 (`systems/vault`)

초록동색 **C.01(package 80.0.18)** 의 콘텐츠를 비령 안에 **데이터로 보관**해 둔 곳입니다.
비령 화면 · 서버에는 아직 연결하지 않았고, 필요할 때 명령으로 꺼내 씁니다. 초록동색 서버 · DB · 로그인과는 아무 연결이 없습니다.

## 들어 있는 것 (215개 파일)

| 폴더 | 내용 |
|---|---|
| `modules/game/` | 게임 규칙 · 데이터 84개 — 아이템 312종, 적 57종(전투 데이터 50종 포함), 영능력, 개척 터 · 산길, 제작 · 조리 · 제작법, 텃밭, 매점 · 판매, 급식, 탐사 장면(본관 · 별관 · 산 · 사당), 인트로, 도감 · 업적, 이동 사건, 동아리 소개, 판놀이 규칙, 미니게임 엔진(2048 · 테트리스 · 타자 · 러너 · 화투 · 운세), 효과음 · 배경음악 설정 |
| `modules/ui/` | 화면 코드(React) 98개 + 아이템 아이콘 11개 + 훅 5개 + 스타일시트 |
| `modules/ui/adapters/online.js` | 초록동색 `net/online.js` 자리의 **연결 안 됨 어댑터**. 함수 이름은 같고 네트워크는 쓰지 않음 |
| `assets/` | 배경 · 로고 · 파비콘 · 배경음악 2곡 · 테마 스크립트 |
| `catalog/` | 게임 모듈이 내보내는 데이터를 JSON 으로 떠 둔 것 (73개 파일, 295개 값) |
| `docs/`, `tools/` | 전투 데이터 시트(CSV) · 시트 동기화 보고서 · 적 밸런스 보고서 · 밸런스 시뮬레이터 |
| `tests/c01/` | C.01 테스트를 보관고 경로로 옮긴 것 (204개 통과, 옛 앱 뼈대 · 서버 · NPC · 퀘스트를 읽는 24개는 건너뜀) |

## 넣지 않은 것

- **NPC** — 초록동색 NPC 7명의 이름 · 초상화(15장) · 대사 · 선물 반응 · 도감 설명, NPC 가 주인공인 이동 글.
- **퀘스트** — `quests` · `questData` · `questLevels` · `clubQuests`(퀘스트 부분) · `firstDayQuest`, 퀘스트 화면 5개, [의뢰] 메뉴, 도깨비 퀘스트.
- **옛 앱 뼈대 · 서버** — `server/*`, 로그인(`auth.js` 와 로그인 · 비밀번호 · 관리자 화면), `App.jsx` · `Game.jsx` · `main.jsx`, 배포 설정. 비령은 자체 서버 · 계정을 씁니다.
- 패치 노트 문서, 폰트 파일(원래 zip 에도 없음).

## NPC 자리 (`modules/game/npcSlots.js`)

NPC 가 있던 곳은 **역할 단위의 빈 자리 7칸**으로 남겼습니다. 자리가 비어 있으면 그 NPC 의 대화창 · 말 걸기 선택지 · 도감 칸은 나오지 않고, 게임의 나머지는 그대로 돕니다.

| 자리 id | 하던 일 |
|---|---|
| `outskirtsGuide` | 교외 · 뒷산 캠핑장 안내, 전투 튜토리얼 진행 |
| `storeKeeper` | 기숙사 매점 |
| `seedKeeper` | 뒷산 텃밭 씨앗 상점 |
| `armorySmith` | 무구보관소 무구 강화 |
| `shrineKeeper` | 사당 문지기 |
| `kitchenKeeper` | 별관 2층 조리실 |
| `infirmaryKeeper` | 본관 2층 양호실 |

- 장소 묘사처럼 NPC 가 잠깐 등장하는 글은 `{{npc:자리|조사}}` 로 바꿔 두었습니다. 새 이름이 들어가면 받침에 맞춰 조사가 붙습니다(하람**이** / 무지**가**). 자리가 비어 있으면 역할 이름(예: "사당 문지기가")이 대신 보입니다.
- NPC 대사는 모두 뺐습니다. 사당 봉인각처럼 대사가 이야기 흐름을 잇던 곳에는 `NPC_LINE_PLACEHOLDER` 한 장만 남겼습니다.
- 전투 튜토리얼은 진행 설명을 남기고 말하는 사람만 `outskirtsGuide` 로 바꿨습니다. 새 NPC 말투에 맞게 다시 쓰면 됩니다.
- 영능력 [원숭이 손] · [업인과보] 의 `owner` 는 `armorySmith` · `storeKeeper` 자리로 바꿨습니다.
- NPC 틀(대사 고르기 `npcLines.js`, 대화창 `NpcDialog`, 선물 `NpcGift`, 도감 NPC 장)은 그대로 남아 있습니다.

## 꺼내기

```bash
npm run vault -- bundles                          # 꺼내기 묶음 33개
npm run vault -- list battle                      # 묶음에 딸려 나가는 파일
npm run vault -- json game/items ITEMS            # 데이터 보기
npm run vault -- search 그슨대                     # 어디에 있는지 찾기
npm run vault -- export minigame-2048 --to ./out/2048
npm run vault -- export explore battle-tutorial --to ./out/explore --layout app \
    --npc shrineKeeper=하람 --npc outskirtsGuide=무진
npm run vault -- verify                           # 보관고가 manifest 와 같은지 확인
```

- 고른 것이 import 하는 파일 · 그림 · 소리까지 함께 나갑니다. 결과 폴더의 `VAULT_EXPORT.json` 에 필요한 패키지(react · lucide-react 등)와 서버 어댑터 필요 여부가 적힙니다.
- `--layout app` 은 초록동색과 같은 `src/game` · `src/components` · `public` 배치로 꺼내고 import 경로를 맞춰 줍니다.
- `--npc 자리=이름` 은 꺼낸 글의 `{{npc:…}}` 를 채우고, 꺼낸 `npcSlots.js` 에 그 이름을 넣어 자리를 엽니다.
- 코드에서는 `import * as Vault from './systems/vault/index.mjs'` → `Vault.catalog('game/items').ITEMS`, `await Vault.load('game/battle')`.

## 호환 메모

- 게임 모듈은 Node 에서도 바로 import 되도록 상대 import 에 `.js` 를 붙였습니다(동작은 같음). react · lucide-react 가 필요한 3개(`activities` · `lessonContext` · `useTurnPing`)는 화면 쪽에서만 씁니다.
- 화면 코드의 서버 기능(채팅 · 파티 · 장터 · 우편 · 랭킹 · 다인 전투 초대 · 판놀이 등)은 어댑터가 `not-connected` 를 돌려줍니다. 비령 서버에 붙일 때는 `adapters/online.js` 만 비령 API 로 다시 쓰면 됩니다.
- 각 파일이 C.01 과 얼마나 다른지는 manifest 의 `flags.changeKind` 에 있습니다: `same` 109 · `import-paths` 70(경로만) · `content` 33(NPC · 퀘스트 빼기) · `new` 3.
- 보관고 파일을 고쳤다면 `npm run vault:build` 로 manifest · 카탈로그를 다시 만드세요(C.01 원본 폴더가 있으면 `-- --c01 <폴더>` 로 비교 표시도 다시 계산).
- 기존 `systems/data` · `systems/rules`(v0.4 스냅샷)는 그대로 두었습니다. 그쪽 `rules/hike.js` · `rules/constants.js` 에는 예전처럼 NPC 이름이 일부 남아 있습니다.
