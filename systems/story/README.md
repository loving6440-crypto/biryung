# 본편 스토리 원고 (3권 15장)

| 파일 | 내용 |
|---|---|
| `script_vol1~3.txt` | 장면 스크립트 — `유형|화자|대사 · 지문|연출|조건|결과` |
| `quests_vol1~3.txt` | 장면 퀘스트 단계 — 장소 · 할 일 · 완료 판정(설계) |
| `export_game.py` | 원고 → `story-data.js`(게임 데이터). 단계별 실제 판정(`O` 표), 바깥 지역(`REGIONS`), 이야기 전투 상대(`FOES`)가 여기 있다 |
| `design.py` · `chapters.py` · `impl.py` · `build.py` | 인물 · 변수 · 엔딩 · 진행표 → 엑셀(`python3 build.py out.xlsx`) |

대사나 단계를 고친 뒤: `npm run story:build` → `story-data.js` 가 다시 만들어진다. 조건 · 효과 글귀를 읽지 못하면 멈추고 어디인지 알려 준다.
돌리는 쪽은 저장소 맨 위의 `quest.js`(퀘스트 엔진 · 대사 창 · 산문 너머 화면)다.
