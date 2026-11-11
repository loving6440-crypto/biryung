# 비령 커뮤니티 서버 v0.5

`node server/index.mjs` — 단일 origin으로 정적 사이트와 커뮤니티 API를 제공하는 Node.js HTTP 서버입니다.
게임 규칙은 비령 복사본에서만 참조하며 초록동색 서버와 연동하지 않습니다.

- `GET /health` (인증 불필요)
- `GET /api/v1/meta` (스냅샷 규모)
- `/api/community/register`, `/login`, `/logout`, `/me`, `/profile`
- `/api/community/posts`, `/posts/:id/replies`, `/users/:username/posts`: 지신성
- `/api/community/memos`, `/memos/:id/comments`: 메모 및 댓글/대댓글
- `/api/community/users?q=`, `/dm/threads`, `/dm/threads/:id/messages`: 계정별 비밀 대화
- `/api/community/admin/dm/threads`, `/admin/dm/threads/:id/messages`: **운영자 전용 읽기 API**, 조회 시 `biryeong_admin_dm_audit`에 기록

PostgreSQL 설정 시 부팅 중 `CREATE TABLE IF NOT EXISTS`로 테이블을 생성합니다.
인증은 scrypt 암호 해시 및 데이터베이스 저장 세션(해시된 토큰), HttpOnly SameSite 쿠키입니다.
비밀 대화는 **서버에 평문으로 저장**되므로 **종단 간 암호화가 아닙니다**. 서버/DB 관리자에게는 기술적으로 접근 권한이 있습니다.
관리자 권한은 가입 요청으로 지정할 수 없고 서버 환경변수로만 생성됩니다. 환경변수의 비밀번호가 변경되면 재시작 시 관리자 해시를 갱신하고 이전 세션을 폐기합니다. 운영자 계정이 이미 일반 계정으로 선점된 경우 서버가 시작 실패합니다.
프로필, 게시글, 메모, DM은 로그인한 이용자만 요청할 수 있으며, DM은 서버에서 참가자 ID를 검증합니다.

운영을 시작하기 전: 서버와 DB 접근 권한 제한, PostgreSQL 백업 정책, 로그 확인, 서비스별 비밀키 관리 및 이용 약관/운영 정책을 설정하세요.
