-- ═══════════════════════════════════════════════════════════════════
--  비령 — 서버의 모든 기록 지우기 (V.01)
--  Supabase › SQL Editor 에 통째로 붙여 넣고 [Run].  되돌릴 수 없다.
--
--  먼저 schema.sql 또는 v01_patch.sql(V.01)을 한 번 실행해 두어야 한다 — 그래야
--  학생들의 브라우저에 남은 옛 계정 · 기록도 다음 접속 때 함께 지워진다.
--  (그러지 않으면 같은 아이디 · 비밀번호로 들어올 때 브라우저의 옛 기록이 서버로 다시 올라간다.)
--
--  지우는 것: 계정 · 접속 · 저장 기록 · 프로필 사진 · 친구 · 하사(선물) · 받은 기록 · 벼룩시장 ·
--            카페 정산 · 지신성/낮새들의 터/밤쥐들의 터 글 · 급식실 사연 · 일행/파티 · 초대 ·
--            수업 랭킹 · 이야기 선택/진도 · 관리자가 지운 표 기록 · 일행 호출 종 · 감사 기록 ·
--            요청 제한 기록 · 관리자 코드 실패/잠금 기록
--  남기는 것: 관리자 코드 · 올려 둔 장(1~4장) · 공개 설정(루트 · 추가전투 단계 · 퀘스트 공개 · 이벤트 공개) ·
--            공지사항 게시판 · 업데이트 노트 · 팝업 공지 · 첫 화면 속보 띠
--            → 이것들까지 지우려면 맨 아래 [선택] 부분의 -- 를 지우고 함께 실행한다.
-- ═══════════════════════════════════════════════════════════════════
begin;

truncate table
  biryeong_private.accounts,
  biryeong_private.sessions,
  biryeong_private.saves,
  biryeong_private.photos,
  biryeong_private.friends,
  biryeong_private.grants,
  biryeong_private.grant_claims,
  biryeong_private.market,
  biryeong_private.cafe_claims,
  biryeong_private.posts,
  biryeong_private.memos,
  biryeong_private.memo_comments,
  biryeong_private.dm_threads,
  biryeong_private.dm_messages,
  biryeong_private.cafeteria_stories,
  biryeong_private.parties,
  biryeong_private.rooms,
  biryeong_private.room_msgs,
  biryeong_private.invites,
  biryeong_private.scores,
  biryeong_private.audit,
  biryeong_private.throttle,
  biryeong_private.throttle_windows,
  biryeong_private.admin_code_fails,
  biryeong_private.admin_code_locks,
  biryeong_private.story_choice_exclusions,
  biryeong_private.room_bells,
  public.cloud_saves,
  public.story_choices,
  public.story_contrib,
  public.story_progress
restart identity cascade;

-- 브라우저 쪽 옛 기록도 지우라는 표시(다음 접속 때 저마다 확인한다)
insert into biryeong_private.maint (id) values (1) on conflict do nothing;
update biryeong_private.maint set wiped_at = now(), ran_at = 'epoch' where id = 1;

-- ── [선택] 관리자가 만든 것까지 처음으로 ─────────────────────────────
-- truncate table biryeong_private.board, biryeong_private.patch_notes, biryeong_private.popups restart identity;
-- update biryeong_private.notice set body = '', updated_at = now() where id = 1;
-- truncate table public.story_routes;      -- 루트 · 추가전투 단계 · 퀘스트 공개 · 이벤트 공개가 모두 닫힌다
-- truncate table public.story_chapters;    -- 올려 둔 1~4장이 사라진다(다시 올려야 한다)

commit;

-- 확인: 모두 0 이면 끝
select
  (select count(*) from biryeong_private.accounts) as accounts,
  (select count(*) from biryeong_private.saves)    as saves,
  (select count(*) from public.story_progress)     as story_progress,
  (select count(*) from public.story_choices)      as story_choices,
  (select count(*) from biryeong_private.story_choice_exclusions) as exclusions,
  (select wiped_at from biryeong_private.maint where id = 1) as wiped_at;
