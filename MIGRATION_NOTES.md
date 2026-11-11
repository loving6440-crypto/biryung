# 비령 v0.4 분리 내역

- v0.3 의 `systems/chorokdongsaek-C01/` 폴더 전체를 제거했습니다. 해당 폴더에 존재하던 서버·인증·원본 React 앱은 비령 ZIP에 없습니다.
- 그중 서버 의존성 없이 계산 가능한 순수 규칙 **29개**만 `systems/rules/`로 독립 복제했습니다.
- `systems/core.mjs`, `systems/data/index.mjs`, `systems/data/build-catalogs.mjs`의 참조를 비령 자체 `systems/rules/`로 변경했습니다.
- JSON 카탈로그는 이전 v0.3 원본 파일과 SHA-256 비교하여 내용 변경 없이 유지합니다.
- 새 `server/index.mjs`는 다른 프로젝트 API를 사용하지 않는 비령 전용 서버 틀입니다.
- **이식 범위:** 데이터와 순수 규칙 코드. **아직 하지 않은 일:** 계정·DB·멀티플레이·실제 서버 판정·인게임 UI 연결.

# 비령 v0.6 보관고 추가 내역

- `systems/vault/` 에 초록동색 C.01 콘텐츠를 보관했습니다(215개 파일 + 데이터 카탈로그 73개). 비령 화면 · 서버와는 아직 연결하지 않았습니다.
- 제외: NPC 7명(이름 · 초상화 · 대사 · 선물 반응 · 도감), 퀘스트 전부, 초록동색 서버 · 로그인 · 앱 뼈대(App · Game · main), 패치 노트.
- 바뀐 파일 33개는 NPC · 퀘스트를 빼면서 고친 것이고, 70개는 폴더 구조에 맞춰 import 경로만 바뀌었습니다. 나머지 109개는 C.01 과 같습니다.
- `systems/data/`, `systems/rules/`, `server/`, `site/` 는 손대지 않았습니다.
- 화면 파일을 `site/` 에서 저장소 맨 위로 옮겼습니다(GitHub Pages 용). 서버는 맨 위의 화면 파일 목록과 `assets/` · `fonts/` 만 내보내고, `server/` · `systems/` · `tests/` · 설정 파일 요청에는 404 를 돌려줍니다. 커뮤니티 API 주소는 상대 경로(`api/community/…`, `health`)로 바꿨습니다.
- `.nojekyll`, `.github/workflows/pages.yml`(화면 파일만 Pages 로 배포) 추가.
