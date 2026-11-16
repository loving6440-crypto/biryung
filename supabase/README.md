# Supabase 연결 (본편 퀘스트의 서버 부분)

1. Supabase 에서 새 프로젝트를 만든다.
2. **SQL Editor** 에 `supabase/schema.sql` 을 통째로 붙여 넣고 실행한다.
3. **Project Settings › Data API** 의 `Project URL`, **Project Settings › API Keys** 의 `Publishable key`(`sb_publishable_…`)를 복사한다.
   (예전 프로젝트라면 Legacy API Keys 탭의 `anon` 키 `eyJ…` 도 된다. `secret` 키 · `service_role` 키는 절대 넣지 않는다.)
   - GitHub 로 배포할 때: 저장소 **Settings › Secrets and variables › Actions › Variables** 에
     `SUPABASE_URL`, `SUPABASE_KEY` 두 개를 만든다. 다음 배포부터 자동으로 `config.js` 에 들어간다.
   - 직접 넣을 때: `config.js` 의 `supabaseUrl` · `supabaseAnonKey` 를 채운다.
4. 사이트를 새로 고친다. 산문 › 산문 너머 › **세계** 탭의 안내가 "서버에 모인 모든 학생의 선택"으로 바뀌면 연결된 것이다.

| 표 · 보기 | 쓰임 |
|---|---|
| `story_choices` | 본편의 주요 선택(B1-1 … B15-2). 한 사람당 분기마다 한 줄 |
| `story_tally` (보기) | 분기별 선택 집계 → 세계 탭 "세계 결정" |
| `story_contrib` · `story_contrib_totals` | 공동 사건 기여(쌍응수 · 지워진 지도 · 신격 레이드 · 오방 결전) |
| `story_progress` | 끝낸 장면 수 |
| `cloud_saves` | 기록 백업(`BiryeongSync.saveCloud` · `loadCloud` — 화면 단추는 아직 없다) |

지금 연결하면 되는 것은 **선택 집계 · 기여 올리기 · 진행도**까지다. 아래는 표만 준비되어 있고 게임 규칙에는 아직 반영하지 않았다.

- 서버 집계로 세계 값(W_)과 엔딩을 정하는 것 — 지금 엔딩은 각자의 브라우저 값으로 정한다.
- 레이드를 여럿이 동시에 치르는 것 — 지금은 각자 싸우고 기여만 올린다.
- 계정 로그인을 Supabase Auth 로 옮기는 것 — 지금 로그인은 브라우저에만 있고, 서버에서는 무작위 `player_id` 로 구분한다. 그래서 `schema.sql` 의 권한은 공개 키로 읽고 쓰게 열려 있다(지우기만 막음). 정식 로그인을 붙일 때 정책을 `auth.uid() = player_id` 로 좁힌다.


## v1.8 — 본편 장 공개 · 선택 열람

1. `schema.sql` 을 다시 통째로 실행한다(다시 실행해도 안전하다). `story_chapters` 표와 관리자 함수가 생기고, 선택지 범위가 1~12로 넓어진다.
2. 관리자 코드를 서버에 한 번 넣는다. SQL Editor 에서 '여기에 관리자 코드' 를 실제 코드로 바꿔 실행:
   ```sql
   insert into biryeong_private.admin_secret (id, code_hash) values (1, encode(sha256(convert_to('여기에 관리자 코드', 'UTF8')), 'hex'))
     on conflict (id) do update set code_hash = excluded.code_hash;
   ```
3. 사이트에서 관리자 › 스토리 관리 → 관리자 코드를 한 번 넣고 [코드 기억] → 장마다 [파일 올리기](`story-chapters/chN.json`) → [지금 공개] 또는 [이 시각에 공개].
4. 공개 전 장은 서버가 학생에게 내주지 않는다(행 수준 보안: `open_at <= now()` 인 줄만 읽힌다). 선택은 `story_choices` 에 계정 이름과 함께 모이고, 스토리 관리 아래쪽에 선택지별 인원 · 투표자가 보인다.
