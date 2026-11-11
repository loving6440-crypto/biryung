# 秘靈 · 비령 v0.6 — 초록동색 C.01 콘텐츠 보관고

## v0.6 변경

- **화면 파일을 저장소 맨 위로 옮김** (`site/` 폴더 없음): `index.html` · `app.js` · `styles.css` · `community.js` · `community.css` · `assets/` · `fonts/`. GitHub에 올리면 Pages에서 바로 열린다.
- **`systems/vault/`** 추가: 초록동색 C.01의 콘텐츠(게임 규칙 · 데이터 84개, 화면 코드 115개, 그림 · 소리, 시트 자료)를 비령 안에 데이터로 보관. 화면 · 서버에는 아직 연결하지 않음.
- **NPC와 퀘스트는 넣지 않음.** NPC가 있던 곳은 빈 NPC 자리 7칸(`systems/vault/modules/game/npcSlots.js`)으로 남겨, 새 NPC로 갈아끼울 수 있음.
- 초록동색 서버 · 로그인 · 앱 뼈대도 넣지 않음. 서버를 쓰던 화면은 네트워크 없는 '연결 안 됨' 어댑터를 거침.
- 꺼내기 명령: `npm run vault -- bundles` / `export <묶음> --to <폴더> [--layout app] [--npc 자리=이름]`. 자세한 내용은 [`systems/vault/README.md`](systems/vault/README.md).
- `npm run check`에 보관고 검사와 C.01 테스트(보관고 경로판)가 함께 돈다.

---

## v0.5 — 사방 지도 + 비령 소통망

비령은 **초록동색과 독립된 프로젝트**입니다. `systems/data/`, `systems/rules/`의 C.01 게임 데이터/규칙 복사본은 수정하지 않았습니다. 기존 전투·영능력 플레이 연결은 아직 없습니다.

- 지도 중앙의 `中` 삭제, 노란색 마름모로 교체. 구역 선택 시 위로 이동하지 않도록 정렬 고정, 오방색 범례 5칸 균등 정렬.
- 구역 지도 아래 여백에 **지신성 / 낮새들의 터 / 밤쥐들의 터** 버튼 3개.
- **지신성**: 가입·로그인, 표시 이름·자기소개·상징·색상 편집, 타임라인 글·답글 작성·조회, 작성자 프로필 팝업 및 글 목록.
- **낮새들의 터**: 메모 작성·조회, 메모 아래 공개 댓글·대댓글(다단계 답글), 제목/본문·작성자 정보.
- **밤쥐들의 터**: 다른 계정 검색, 각 사용자별 1:1 대화 목록·대화 내역·전송·12초 간격 새 메시지만 갱신(증분 조회), 지난 대화 추가 로딩. 대화 참가자만 읽기/쓰기 가능하며 **총괄 운영자만 전체 대화 열람** 가능(읽기 전용, 열람 감사 기록).
- 서버는 비령 독립 Node.js + PostgreSQL로, 다른 서버의 로그인·인증·채팅·DB와 공유하지 않음.

## 실행 전 필수 설정

Node.js 20 이상과 **비령 전용 PostgreSQL** 데이터베이스가 필요합니다.

```bash
npm install
# bash 예시. Windows PowerShell: $env:DATABASE_URL="postgresql://..."
export DATABASE_URL="postgresql://biryeong_user:YOUR_SECRET@YOUR_DB_HOST:5432/biryeong?sslmode=require"
export BIRYEONG_ADMIN_USERNAME="biryeong_admin"
export BIRYEONG_ADMIN_PASSWORD="12자 이상의 안전한 비밀번호"
npm start
```

`http://localhost:10000`에서 화면과 계정/게시글/DM을 이용합니다. `/health` 응답의 `database`가 `configured`여야 커뮤니티가 동작합니다.
**DB 없이 실행해도 UI·기존 지도는 볼 수 있지만 커뮤니티 가입/글/DM은 동작하지 않습니다.** HTML 파일을 직접 더블클릭해도 API는 동작하지 않습니다.
관리자 환경변수는 반드시 최초 구동 **전에** 지정하세요. 최초 실행에 운영자 계정을 생성하고, 이후 Render의 관리자 비밀번호 환경변수를 변경해 재배포하면 비밀번호가 갱신되며 기존 관리자 세션이 만료됩니다. 일반 이용자는 '새 계정 만들기'를 사용합니다.

## GitHub Pages (화면만)

1. 이 폴더 그대로 GitHub 저장소에 올린다(`index.html` 이 맨 위에 있어야 한다).
2. 저장소 **Settings → Pages → Build and deployment → Source** 에서 둘 중 하나를 고른다.
   - **GitHub Actions** (권장): `.github/workflows/pages.yml` 이 main 에 올릴 때마다 화면 파일만 모아 배포한다. `server/` · `systems/` 는 올라가지 않는다.
   - **Deploy from a branch** → `main` / `(root)`: 저장소 전체가 그대로 공개되고 `index.html` 이 열린다. (`.nojekyll` 이 있어 Jekyll 처리 없이 그대로 나간다)
3. 주소는 `https://<계정>.github.io/<저장소 이름>/`.

Pages 는 정적 호스팅이라 **지도 · 화면은 보이지만 가입 · 글 · DM(지신성 · 낮새들의 터 · 밤쥐들의 터)은 동작하지 않는다.** 화면 상단에는 '학당 통신 · 서버 미연결'로 표시된다. 커뮤니티까지 쓰려면 아래 Render Web Service 로 띄운다(같은 파일을 서버가 함께 내보낸다).

## Render 배포 (초록동색과 분리)

1. GitHub에 비령 프로젝트 **별도 저장소**로 업로드합니다. 기존 초록동색 저장소에 합치지 마세요.
2. 비령 전용 **새 PostgreSQL DB**를 생성합니다. Render Postgres나 기존 프로젝트와 분리된 Supabase 프로젝트의 **Postgres 접속 URL**을 사용할 수 있습니다. Supabase의 public/anon 키가 아니라 **DB 접속 문자열**을 서버 환경변수로만 사용합니다.
3. Render에서 **새 Web Service (Node)** 를 만듭니다. 기존 `Static Site`는 DB 인증/DM API를 실행할 수 없습니다. `render.yaml` Blueprint를 사용해도 됩니다.
4. Build Command: `npm install --omit=dev` / Start Command: `npm start` / Health Check: `/health`.
5. 서비스의 Environment에 `DATABASE_URL`, `BIRYEONG_ADMIN_USERNAME`, `BIRYEONG_ADMIN_PASSWORD`, `NODE_ENV=production`을 설정합니다. 비밀번호는 강력하게 설정하고 리포지터리에 넣지 마세요. 관리자가 필요 없으면 두 ADMIN 환경변수를 모두 생략할 수 있습니다.
6. 배포 후 `/health`에서 `database: "configured"`를 확인하고 일반 계정을 두 개 만들어 각 계정의 DM 권한을 검증하세요.
7. 기존 Static Site에 사용자 지정 도메인이 있다면 **새 Web Service** 쪽으로 이전하거나 새 주소를 안내하세요. 둘을 같은 주소로 자동 합칠 수는 없습니다.

`DATABASE_URL`은 Postgres URI이며, URL의 비밀번호에 특수기호가 있으면 URL 인코딩해야 합니다. Supabase 사용 시 연결 유형/IPv4 지원 여부에 따라 Session Pooler URL이 필요할 수 있습니다.

## 보안·프라이버시

- 비밀번호는 scrypt 해시로 저장하며 세션 쿠키는 HttpOnly, SameSite=Lax, HTTPS 환경의 Secure 쿠키입니다. 게시글/댓글은 서버 DB에 저장합니다.
- 메시지 조회와 전송에서 참여자 권한을 확인합니다. **다른 일반 회원은 타인의 대화를 API로도 읽을 수 없습니다.** 운영자는 별도 모니터링 화면에서 읽기 전용으로 확인 가능하며 열람 기록이 DB에 남습니다.
- 메시지는 **종단 간 암호화되지 않습니다**. 서버와 DB에서 처리할 수 있고, 관리 권한이 있는 인프라 운영자의 직접 DB 접근도 막을 수는 없습니다. 가입 화면에 운영자 열람 가능성을 안내합니다.
- 부정 로그인 방어를 위해 간단한 IP 요청 제한을 적용했습니다. 서비스 규모가 커지면 모니터링, 관리자 2FA, 계정 복구, 신고/삭제 정책, 콘텐츠 보존/백업 정책, 법적 개인정보 고지를 추가하세요.
- `fonts/`의 실제 폰트 바이너리는 현재 제공되지 않습니다. 본인 사용권에 따라 넣으세요.

## 개발 및 검증

`npm run check` — 기존 C.01 복사본 데이터·격리 테스트, 인증 단위 테스트, 보관고 검사, C.01 테스트(보관고 경로판).
`npm run vault -- help` — 보관고 꺼내기 도구 사용법. `npm run vault:verify` — 보관고 파일 무결성 확인.
`npm run rebuild:data` — 비령 복사본 데이터 재생성. 현재 작업에서는 실행하지 않았습니다.
