-- 秘靈 · 비령 — Supabase 표. SQL Editor 에 통째로 붙여 넣고 한 번 실행한다. (다시 실행해도 안전하다)
-- 본편 퀘스트의 "서버가 필요한 부분": 모든 학생의 선택 집계(세계 결정) · 공동 사건 기여 · 진행도 · 기록 백업.

create table if not exists public.story_choices (
  player_id  uuid        not null,
  account    text        not null default '',
  branch     text        not null,               -- B1-1 … B15-2 (선택 분기 시트의 분기 ID)
  option     smallint    not null check (option between 1 and 6),
  updated_at timestamptz not null default now(),
  primary key (player_id, branch)
);

create table if not exists public.story_contrib (
  id         bigint generated always as identity primary key,
  player_id  uuid        not null,
  account    text        not null default '',
  event      text        not null,               -- B7-2(쌍응수) · erased-map(지워진 지도) · B12-1(신격 레이드) · final(오방 결전)
  amount     integer     not null default 1 check (amount between 1 and 100),
  created_at timestamptz not null default now()
);
create index if not exists story_contrib_event on public.story_contrib (event);

create table if not exists public.story_progress (
  player_id  uuid primary key,
  account    text        not null default '',
  scenes     integer     not null default 0,     -- 끝낸 장면 퀘스트 수
  updated_at timestamptz not null default now()
);

create table if not exists public.cloud_saves (
  player_id  uuid primary key,
  account    text        not null default '',
  data       jsonb       not null,               -- 기록 전체(프로필 · 진행)
  updated_at timestamptz not null default now()
);

-- 집계 보기(세계 탭이 읽는다)
create or replace view public.story_tally with (security_invoker = on) as
  select branch, option, count(*)::int as votes from public.story_choices group by branch, option;
create or replace view public.story_contrib_totals with (security_invoker = on) as
  select event, sum(amount)::int as total, count(distinct player_id)::int as players from public.story_contrib group by event;

-- 권한: 지금은 로그인이 이 브라우저에만 있어, 공개 키(anon)로 읽고 쓴다.
--   · 누구나 집계를 읽을 수 있다. · 자기 player_id(무작위 uuid) 줄을 넣고 고칠 수 있다. · 지우기는 막는다.
--   · cloud_saves 는 player_id 를 아는 사람만 읽을 수 있게, 반드시 player_id 조건으로만 조회한다(전체 목록은 막을 수 없으니 민감한 것은 넣지 않는다).
-- 정식 로그인(Supabase Auth)으로 바꾸면 아래 using (true) 를 using (auth.uid() = player_id) 로 좁힌다.
alter table public.story_choices  enable row level security;
alter table public.story_contrib  enable row level security;
alter table public.story_progress enable row level security;
alter table public.cloud_saves    enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'choices_read')   then create policy choices_read   on public.story_choices  for select to anon using (true); end if;
  if not exists (select 1 from pg_policies where policyname = 'choices_insert') then create policy choices_insert on public.story_choices  for insert to anon with check (true); end if;
  if not exists (select 1 from pg_policies where policyname = 'choices_update') then create policy choices_update on public.story_choices  for update to anon using (true) with check (true); end if;
  if not exists (select 1 from pg_policies where policyname = 'contrib_read')   then create policy contrib_read   on public.story_contrib  for select to anon using (true); end if;
  if not exists (select 1 from pg_policies where policyname = 'contrib_insert') then create policy contrib_insert on public.story_contrib  for insert to anon with check (true); end if;
  if not exists (select 1 from pg_policies where policyname = 'progress_read')  then create policy progress_read  on public.story_progress for select to anon using (true); end if;
  if not exists (select 1 from pg_policies where policyname = 'progress_insert')then create policy progress_insert on public.story_progress for insert to anon with check (true); end if;
  if not exists (select 1 from pg_policies where policyname = 'progress_update')then create policy progress_update on public.story_progress for update to anon using (true) with check (true); end if;
  if not exists (select 1 from pg_policies where policyname = 'saves_read')     then create policy saves_read     on public.cloud_saves    for select to anon using (true); end if;
  if not exists (select 1 from pg_policies where policyname = 'saves_insert')   then create policy saves_insert   on public.cloud_saves    for insert to anon with check (true); end if;
  if not exists (select 1 from pg_policies where policyname = 'saves_update')   then create policy saves_update   on public.cloud_saves    for update to anon using (true) with check (true); end if;
end $$;

grant select, insert, update on public.story_choices, public.story_progress, public.cloud_saves to anon;
grant select, insert on public.story_contrib to anon;
grant select on public.story_tally, public.story_contrib_totals to anon;

-- ───────── v1.8 본편 장 공개 · 선택 열람 ─────────
-- 선택지가 10개인 선택(유품 고르기)이 있어 option 범위를 넓힌다.
alter table public.story_choices drop constraint if exists story_choices_option_check;
alter table public.story_choices add constraint story_choices_option_check check (option between 1 and 12);

-- 장 파일(story-chapters/chN.json). 공개 시각(open_at)이 지난 장만 학생이 읽을 수 있다 — 공개 전 내용은 서버가 내주지 않는다.
create table if not exists public.story_chapters (
  ch         smallint    primary key,
  title      text        not null default '',
  content    jsonb,
  open_at    timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.story_chapters enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'chapters_read_open') then
    create policy chapters_read_open on public.story_chapters for select to anon using (open_at is not null and open_at <= now() and content is not null);
  end if;
end $$;
grant select on public.story_chapters to anon;

-- 관리자 코드: 아래 한 줄의 '여기에 관리자 코드' 를 실제 코드로 바꿔 한 번 실행한다(코드 자체는 저장하지 않고 SHA-256 만 남는다).
--   insert into biryeong_private.admin_secret (id, code_hash) values (1, encode(sha256(convert_to('여기에 관리자 코드', 'UTF8')), 'hex'))
--     on conflict (id) do update set code_hash = excluded.code_hash;
create schema if not exists biryeong_private;
create table if not exists biryeong_private.admin_secret (id smallint primary key default 1 check (id = 1), code_hash text not null);
revoke all on schema biryeong_private from anon, authenticated;

create or replace function public.story_admin_ok(p_code text) returns boolean
  language sql security definer set search_path = public, biryeong_private as $$
  select exists (select 1 from biryeong_private.admin_secret where code_hash = encode(sha256(convert_to(coalesce(p_code, ''), 'UTF8')), 'hex'));
$$;

-- 장 목록(관리자): 공개 여부 · 시각 · 파일 유무
create or replace function public.story_admin_list(p_code text)
  returns table (ch smallint, title text, open_at timestamptz, has_content boolean, updated_at timestamptz)
  language plpgsql security definer set search_path = public, biryeong_private as $$
begin
  if not public.story_admin_ok(p_code) then raise exception 'admin code mismatch'; end if;
  return query select c.ch, c.title, c.open_at, c.content is not null, c.updated_at from public.story_chapters c order by c.ch;
end $$;

-- 장 올리기 · 공개 시각 정하기 · 닫기(관리자). p_mode: 'content'(파일만 바꾼다) · 'open'(공개 시각만 바꾼다, null 이면 닫기)
create or replace function public.story_admin_set(p_code text, p_ch smallint, p_title text, p_content jsonb, p_open_at timestamptz, p_mode text)
  returns void language plpgsql security definer set search_path = public, biryeong_private as $$
begin
  if not public.story_admin_ok(p_code) then raise exception 'admin code mismatch'; end if;
  if p_mode = 'content' then
    insert into public.story_chapters (ch, title, content, updated_at) values (p_ch, coalesce(p_title, ''), p_content, now())
      on conflict (ch) do update set title = excluded.title, content = excluded.content, updated_at = now();
  elsif p_mode = 'open' then
    insert into public.story_chapters (ch, title, open_at, updated_at) values (p_ch, coalesce(p_title, ''), p_open_at, now())
      on conflict (ch) do update set open_at = excluded.open_at, updated_at = now();
  else raise exception 'unknown mode'; end if;
end $$;
revoke all on function public.story_admin_ok(text) from anon;
grant execute on function public.story_admin_list(text) to anon;
grant execute on function public.story_admin_set(text, smallint, text, jsonb, timestamptz, text) to anon;
