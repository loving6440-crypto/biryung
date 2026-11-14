# Supabase 연결 (본편 퀘스트의 서버 부분)

1. Supabase 에서 새 프로젝트를 만든다.
2. **SQL Editor** 에 `supabase/schema.sql` 을 통째로 붙여 넣고 실행한다.
3. **Settings › API** 에서 `Project URL` 과 `anon public` 키를 복사해 `config.js` 에 넣는다.

   ```js
   supabaseUrl: 'https://xxxx.supabase.co',
   supabaseAnonKey: 'eyJ...',
   ```
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
