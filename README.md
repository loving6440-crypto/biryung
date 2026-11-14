# 秘靈 · 비령 v0.9 — 한 사이트로 잇기 · 세계관 개변 · 스토리 퀘스트

## v0.9 변경

- **창 대신 페이지.** 구역 · 프로필 · 도감 · 실행 화면이 모두 주소(`#/…`)로 바뀌는 페이지다. 머리글 · 배너 · 오른쪽 '나의 상태'는 어느 페이지에서나 그대로 있고, 모든 페이지에 [뒤로가기]가 있다.
- **그 자리에서 바로 실행.** 공작소 · 조리실 · 수업 · 매점 · 퇴마 실습 · 추가전투 · 개척 · 무구보관소 · 텃밭 · 수련 · 잠 · 양호실이 구역 페이지 안에서 바로 열린다. 실행 화면은 별도 페이지가 아니라 메인 화면에 끼우는 부품이고(`systems/play`), 색을 비령에 맞췄다.
- **육조 스탯**은 '나의 상태'의 [+] 로 바로 올린다(영력 = 지금 수치 × 10).
- **세계관 개변**(`systems/biryeong`): 아이템 312종 · 상대 57종 · 영능력 13종의 이름과 설명을 2046년 비령판으로. 아이템마다 도트 아이콘 데이터.
- **업적 60 · 칭호 64**(`titles.js`): 둘러보기 5 · 하루 5 · 며칠 10 · 꾸준히 20 · 한 달 10 · 극 10.
- **스토리 퀘스트**(`story.js`): 산문에서 제1장 「사라진 자들의 아이들」 10절.
- `npm run build` = 개변 데이터 → 구역 데이터 → 실행 화면.

---

## v0.8 — 전투 · 개척 · 제작 · 수업 바로 실행

## v0.8 변경

- **실행 화면(`play/`)**: 초록동색 화면 코드를 묶어 전투(퇴마 실습 7종 · 추가전투 50종 · 튜토리얼) · 개척 23곳 · 공작소 · 조리실 · 수업 미니게임 6종 · 매점 · 무구 강화 · 텃밭 · 수련 · 잠 · 양호실 · 스탯 올리기 · 소지품이 실제로 동작한다.
- 구역 창의 **▶ 버튼**(122곳)으로 창 안에서 열고, `play/index.html#주소` 로 바로 열 수도 있다. 주소 목록 · 새 화면 붙이는 법은 [`systems/play/README.md`](systems/play/README.md).
- 실행 화면에서 얻은 체력 · 영력 · 의지력 · 육조 스탯 · 소지금이 오른쪽 '나의 상태'에 반영되고, 전투 · 수업 · 제작 · 개척 · 소지금 업적이 열린다.
- `npm run build` = 구역 데이터 + 실행 화면 다시 만들기 (개발용 패키지는 `npm install`).

---

## v0.7 — 내 프로필 · 구역 데이터 · 칭호와 업적

## v0.7 변경

- **내 프로필**: 이름 · 나이 · 성별(자유 기재) · 한줄소개 · 사진. 육조 스탯은 모두 1에서 시작해 처음에 10점을 나눠 준다. 오른쪽 위 [나의 기록]을 누르면 열린다. 이 브라우저(localStorage)에만 보관.
- **오른쪽 패널 = 나의 상태**: 체력 · 영력 · 의지력, 육조 스탯, 그 아래 소지품 · 적응 퀘스트 · 업적/도감 · 소지금 · (관리자 자리 비움) · 업데이트 노트.
- **구역에 들어가기**: 산문(비어 있음) / 강학당(본관 · 별관) / 생활관(기숙사) / 비령산 금역(뒷산). 데이터는 `game-data.js` — `npm run site:data` 로 `systems/vault` 에서 다시 만든다. 탐사 글은 읽고 고를 수 있고, 전투 · 수업 · 제작 · 개척 같은 놀이 화면은 아직 연결하지 않았다.
- **메인 배너 다섯 쪽**(청 · 적 · 황 · 백 · 흑): 아래 색 막대, 좌우 화살표 버튼, 키보드 ← →, 옆으로 밀기. 적 · 황 · 백 · 흑은 빈 쪽.
- **칭호 50개 · 업적 30개**(`titles.js`): 칭호는 프로필에서 고르고, 얻은 칭호는 업적/도감에서 본다.
- 글꼴은 갈무리9 · KoPub 돋움 · KoPub 바탕만 남김. 구역 그림 네 장에서 달을 지움.

---

## v0.6 — 초록동색 C.01 콘텐츠 보관고

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

## v1.0 (2026-11-14)

| 무엇 | 어디 |
|---|---|
| 로그인(이 브라우저에만 저장) · 로그인 화면 · 관리자 코드 | `auth.js`, `config.js` — 로고 자리의 「비령」을 다섯 번 누르면 관리자 코드 칸이 나온다 |
| 관리자 코드 확인(서버) | `server/index.mjs` 의 `POST /api/admin/verify` — Render 환경변수 `ADMIN_CODE` 와 비교. 서버를 붙이면 `config.js` 의 `api`(또는 `sameOrigin: true`)를 채우고 `adminCodeHash` 는 비운다 |
| 관리자 도구 | `#/admin` (app.js `renderAdmin`) · 실행 화면의 `admin` 값(usePlayHost) |
| 접속을 끊은 동안의 영력 회복 | usePlayHost 가 저장할 때 `game.savedAt` 을 남기고, 다시 열면 그 사이를 한꺼번에 계산 |
| 구역 → 곳 → 할 일 | `systems/site-data/build.mjs`(zones) · 실행 주소 `at/<곳>/<할 일>` (systems/play/src/App.jsx) — 초록동색의 장소 화면을 그대로 쓴다 |
| 추가전투 | 퇴마 실습장(`at/gym/battle`)의 [추가전투] 단추. 둘레길의 칸은 뺐다(systems/play/src/reskin.js) |
| 오방 지도 · 내부 지도 | index.html `.zone-grid.obang` · app.js `renderMap` · 자료는 game-data.js 의 `maps` |
| 칭호 50개 추가 · 모든 칭호의 기능 | `titles2.js` (표와 설명이 파일 머리에 있다) · 처리: usePlayHost 의 `perkV` |
| 제작법 113개 추가 · 1~3단계 | `systems/biryeong/recipes-new.txt` → `npm run reskin:build` (재료 조합이 겹치면 빌드가 멈춘다) |
| 표(엑셀) | `npm run sheets` → `biryeong_tables.xlsx` (systems/sheets) — 아이템 도트 그림 포함 |
| 아이템 도트(v1.1) | `systems/biryeong/pixels.txt`(아이템 id|틀|색) · `pixel-templates.txt` · `pixel-templates-2.txt` — 같은 도트를 두 아이템이 쓰면 빌드가 멈춘다 |

임시 관리자 코드는 `biryeong-admin-2046` 이다(`config.js`). 서버에 `ADMIN_CODE` 를 넣은 뒤에는 `adminCodeHash` 를 비워 임시 코드를 없앤다.
