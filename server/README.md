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
Node 커뮤니티 서버의 관리자 권한은 가입 요청으로 지정할 수 없고 서버 환경변수로만 생성됩니다. 환경변수의 비밀번호가 변경되면 재시작 시 관리자 해시를 갱신하고 이전 세션을 폐기합니다. 운영자 계정이 이미 일반 계정으로 선점된 경우 서버가 시작 실패합니다.
프로필, 게시글, 메모, DM은 로그인한 이용자만 요청할 수 있으며, DM은 서버에서 참가자 ID를 검증합니다.

운영을 시작하기 전: 서버와 DB 접근 권한 제한, PostgreSQL 백업 정책, 로그 확인, 서비스별 비밀키 관리 및 이용 약관/운영 정책을 설정하세요.

## D.06.6 실행·보안
- `TRUST_PROXY=1`: Render 등 신뢰할 수 있는 리버스 프록시 뒤에서만 활성화(최종 X-Forwarded-For 주소 기준 제한). 직접 인터넷에 공개한 Node 서버에서는 사용하지 않음.
- `DB_POOL_SIZE`: 인스턴스당 기본 5(2~15로 제한), DB 질의 최대 12초, HTTP 요청·동시 처리 제한.
- `ALLOW_ORIGIN`: 외부 정적 사이트가 별도 Render 관리자 확인 API를 써야 할 경우의 정확한 HTTPS Origin 한 개. 미설정 시 동일 출처만 허용.
- API의 in-memory 요청 제한은 단일 인스턴스 기준이며, 다중 인스턴스/분산 공격은 Render/WAF/CDN에서 별도 제한 필요.
- Supabase를 사용하는 본편 데이터 보호에는 `supabase/security_patch_D.06.6.sql` 적용도 필요(별도 DB).
