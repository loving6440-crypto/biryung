# 비령 v0.4 분리 내역

- v0.3 의 `systems/chorokdongsaek-C01/` 폴더 전체를 제거했습니다. 해당 폴더에 존재하던 서버·인증·원본 React 앱은 비령 ZIP에 없습니다.
- 그중 서버 의존성 없이 계산 가능한 순수 규칙 **29개**만 `systems/rules/`로 독립 복제했습니다.
- `systems/core.mjs`, `systems/data/index.mjs`, `systems/data/build-catalogs.mjs`의 참조를 비령 자체 `systems/rules/`로 변경했습니다.
- JSON 카탈로그는 이전 v0.3 원본 파일과 SHA-256 비교하여 내용 변경 없이 유지합니다.
- 새 `server/index.mjs`는 다른 프로젝트 API를 사용하지 않는 비령 전용 서버 틀입니다.
- **이식 범위:** 데이터와 순수 규칙 코드. **아직 하지 않은 일:** 계정·DB·멀티플레이·실제 서버 판정·인게임 UI 연결.
