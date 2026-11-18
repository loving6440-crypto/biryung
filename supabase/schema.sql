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

-- vB.03 최초 1회만: 한 계정은 분기마다 처음 고른 한 표만 남는다(다시 보기 · 다른 기기 · 기록 재시작에도 바뀌거나 늘지 않는다).
--   · 이미 같은 계정의 표가 여럿이면 가장 이른 것만 남긴다. · 덮어쓰기(update)는 막는다. · 같은 계정의 두 번째 표는 조용히 버린다.
delete from public.story_choices c using public.story_choices d
  where c.account <> '' and c.account = d.account and c.branch = d.branch
    and (c.updated_at > d.updated_at or (c.updated_at = d.updated_at and c.player_id > d.player_id));
drop policy if exists choices_update on public.story_choices;
revoke update on public.story_choices from anon;
create or replace function public.story_choice_first() returns trigger language plpgsql as $$
begin
  if new.account <> '' and exists (select 1 from public.story_choices where account = new.account and branch = new.branch) then return null; end if;
  return new;
end $$;
drop trigger if exists story_choice_first on public.story_choices;
create trigger story_choice_first before insert on public.story_choices for each row execute function public.story_choice_first();

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

-- ═════════ v1.9 계정 · 기록 · 소통 공간(지신성 · 낮새들의 터 · 밤쥐들의 터) · 관리자 ═════════
-- 표는 모두 biryeong_private 에 두고(공개 키로는 직접 읽고 쓸 수 없다), 아래 bry_* 함수로만 드나든다.
-- 로그인하면 서버가 내주는 표(token)를 함수마다 함께 보낸다. 비밀번호는 bcrypt 해시로만 남는다.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists biryeong_private.accounts (
  id            bigint generated always as identity primary key,
  username      text        not null unique,
  pw_hash       text        not null,
  display_name  text        not null,
  bio           text        not null default '',
  avatar_symbol text        not null default '✦',
  accent        text        not null default '#d4b078',
  chat_title    text        not null default '',          -- 관리자가 달아 주는 칭호(이름 옆에 보인다)
  role          text        not null default 'user' check (role in ('user', 'admin')),
  banned_until  timestamptz,
  muted_until   timestamptz,
  created_at    timestamptz not null default now(),
  last_seen     timestamptz not null default now()
);
create table if not exists biryeong_private.sessions (
  token_hash text primary key,
  account_id bigint      not null references biryeong_private.accounts on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '60 days'
);
create table if not exists biryeong_private.saves (
  account_id bigint primary key references biryeong_private.accounts on delete cascade,
  data       jsonb       not null,
  updated_at timestamptz not null default now()
);
create table if not exists biryeong_private.posts (                 -- 지신성
  id         bigint generated always as identity primary key,
  author     bigint      not null references biryeong_private.accounts on delete cascade,
  parent_id  bigint      references biryeong_private.posts on delete cascade,
  body       text        not null,
  created_at timestamptz not null default now()
);
create index if not exists posts_parent on biryeong_private.posts (parent_id);
create table if not exists biryeong_private.memos (                 -- 낮새들의 터
  id         bigint generated always as identity primary key,
  author     bigint      not null references biryeong_private.accounts on delete cascade,
  title      text        not null,
  body       text        not null,
  created_at timestamptz not null default now()
);
create table if not exists biryeong_private.memo_comments (
  id         bigint generated always as identity primary key,
  memo_id    bigint      not null references biryeong_private.memos on delete cascade,
  author     bigint      not null references biryeong_private.accounts on delete cascade,
  parent_id  bigint      references biryeong_private.memo_comments on delete cascade,
  body       text        not null,
  created_at timestamptz not null default now()
);
create index if not exists memo_comments_memo on biryeong_private.memo_comments (memo_id);
create table if not exists biryeong_private.dm_threads (            -- 밤쥐들의 터
  id         bigint generated always as identity primary key,
  user_low   bigint      not null references biryeong_private.accounts on delete cascade,
  user_high  bigint      not null references biryeong_private.accounts on delete cascade,
  last_at    timestamptz not null default now(),
  last_by    bigint,
  seen_low   timestamptz not null default now(),
  seen_high  timestamptz not null default now(),
  unique (user_low, user_high), check (user_low < user_high)
);
create table if not exists biryeong_private.dm_messages (
  id         bigint generated always as identity primary key,
  thread_id  bigint      not null references biryeong_private.dm_threads on delete cascade,
  sender     bigint      not null references biryeong_private.accounts on delete cascade,
  body       text        not null,
  created_at timestamptz not null default now()
);
create index if not exists dm_messages_thread on biryeong_private.dm_messages (thread_id, id);
create table if not exists biryeong_private.grants (                -- 하사(관리자가 보내는 냥 · 영력 · 아이템). target 이 비면 모두에게
  id         bigint generated always as identity primary key,
  target     bigint      references biryeong_private.accounts on delete cascade,
  payload    jsonb       not null,
  note       text        not null default '',
  by_admin   text        not null default '',
  created_at timestamptz not null default now()
);
create table if not exists biryeong_private.grant_claims (
  grant_id   bigint not null references biryeong_private.grants on delete cascade,
  account_id bigint not null references biryeong_private.accounts on delete cascade,
  claimed_at timestamptz not null default now(),
  primary key (grant_id, account_id)
);
create table if not exists biryeong_private.notice (id smallint primary key default 1 check (id = 1), body text not null default '', updated_at timestamptz not null default now());
create table if not exists biryeong_private.audit (
  id bigint generated always as identity primary key, admin text not null, action text not null, target text not null default '', detail text not null default '', at timestamptz not null default now()
);
create table if not exists biryeong_private.throttle (key text not null, at timestamptz not null default now());
create index if not exists throttle_key on biryeong_private.throttle (key, at);
revoke all on all tables in schema biryeong_private from anon, authenticated;

-- 예전 판의 기록 백업 표는 누구나 읽을 수 있었다. 이제 기록은 계정에 묶어 biryeong_private.saves 에 둔다.
revoke all on public.cloud_saves from anon;

-- ── 안에서만 쓰는 함수 ──
create or replace function biryeong_private.h(p text) returns text language sql immutable as $$ select encode(sha256(convert_to(coalesce(p, ''), 'UTF8')), 'hex') $$;

create or replace function biryeong_private.who(p_token text) returns biryeong_private.accounts
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts;
begin
  select ac.* into a from sessions s join accounts ac on ac.id = s.account_id where s.token_hash = h(p_token) and s.expires_at > now();
  if not found then raise exception 'login_required'; end if;
  if a.banned_until is not null and a.banned_until > now() then raise exception 'banned'; end if;
  if a.last_seen < now() - interval '1 minute' then update accounts set last_seen = now() where id = a.id; end if;
  return a;
end $$;

create or replace function biryeong_private.adm(p_token text) returns biryeong_private.accounts
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts;
begin
  a := who(p_token);
  if a.role <> 'admin' then raise exception 'forbidden'; end if;
  return a;
end $$;

create or replace function biryeong_private.hits(p_key text, p_secs int) returns int
  language sql security definer set search_path = biryeong_private as $$
  select count(*)::int from throttle where key = p_key and at > now() - make_interval(secs => p_secs) $$;

create or replace function biryeong_private.throttle_do(p_key text, p_max int, p_secs int) returns void
  language plpgsql security definer set search_path = biryeong_private as $$
begin
  if hits(p_key, p_secs) >= p_max then raise exception 'too_many_requests'; end if;
  delete from throttle where key = p_key and at < now() - interval '1 day';
  insert into throttle (key) values (p_key);
end $$;

create or replace function biryeong_private.ip() returns text language sql stable as $$
  select coalesce(split_part(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ',', 1), '') $$;

create or replace function biryeong_private.card(a biryeong_private.accounts) returns jsonb language sql stable as $$
  select jsonb_build_object('username', a.username, 'display_name', a.display_name, 'avatar_symbol', a.avatar_symbol, 'accent', a.accent, 'chat_title', a.chat_title, 'role', a.role) $$;

create or replace function biryeong_private.user_json(a biryeong_private.accounts) returns jsonb language sql stable as $$
  select biryeong_private.card(a) || jsonb_build_object('id', a.id, 'bio', a.bio, 'created_at', a.created_at) $$;

create or replace function biryeong_private.new_session(p_id bigint) returns text
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare t text := encode(gen_random_bytes(24), 'hex');
begin
  delete from sessions where account_id = p_id and expires_at < now();
  -- vC.01 청소: 들어올 때마다 오래된 흔적을 조금씩 지운다(표가 끝없이 불어나지 않게).
  delete from throttle where at < now() - interval '2 days';
  delete from parties where updated_at < now() - interval '12 hours';
  insert into sessions (token_hash, account_id) values (h(t), p_id);
  return t;
end $$;

create or replace function biryeong_private.can_write(a biryeong_private.accounts, p_kind text) returns void
  language plpgsql security definer set search_path = biryeong_private as $$
begin
  if a.muted_until is not null and a.muted_until > now() then raise exception 'muted'; end if;
  perform throttle_do('w:' || p_kind || ':' || a.id, case when p_kind in ('dm', 'room') then 30 else 8 end, 60);
end $$;

create or replace function biryeong_private.log(a biryeong_private.accounts, p_action text, p_target text, p_detail text) returns void
  language sql security definer set search_path = biryeong_private as $$
  insert into audit (admin, action, target, detail) values (a.username, p_action, coalesce(p_target, ''), coalesce(p_detail, '')) $$;

-- ── 계정 ──
create or replace function public.bry_register(p_username text, p_password text) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare u text := lower(btrim(coalesce(p_username, ''))); a biryeong_private.accounts;
begin
  if u !~ '^[a-z0-9_가-힣]{2,16}$' then raise exception 'invalid_username'; end if;
  if length(coalesce(p_password, '')) < 4 or length(p_password) > 128 then raise exception 'invalid_password'; end if;
  if exists (select 1 from accounts where username = u) then raise exception 'username_taken'; end if;
  perform throttle_do('reg:' || ip(), 10, 3600);
  insert into accounts (username, pw_hash, display_name) values (u, crypt(p_password, gen_salt('bf', 8)), u) returning * into a;
  return jsonb_build_object('token', new_session(a.id), 'user', user_json(a));
end $$;

-- 틀린 로그인은 횟수를 남겨야 해서(예외를 던지면 기록이 되돌려진다) error 를 값으로 돌려준다.
create or replace function public.bry_login(p_username text, p_password text) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare u text := lower(btrim(coalesce(p_username, ''))); a biryeong_private.accounts;
begin
  if hits('login:' || u, 600) >= 10 then return jsonb_build_object('error', 'too_many_requests'); end if;
  select * into a from accounts where username = u;
  if not found then return jsonb_build_object('error', 'user_not_found'); end if;
  if a.pw_hash <> crypt(coalesce(p_password, ''), a.pw_hash) then
    insert into throttle (key) values ('login:' || u);
    return jsonb_build_object('error', 'invalid_credentials');
  end if;
  if a.banned_until is not null and a.banned_until > now() then return jsonb_build_object('error', 'banned', 'until', a.banned_until); end if;
  update accounts set last_seen = now() where id = a.id;
  return jsonb_build_object('token', new_session(a.id), 'user', user_json(a));
end $$;

create or replace function public.bry_me(p_token text) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
begin return jsonb_build_object('user', user_json(who(p_token))); end $$;

create or replace function public.bry_logout(p_token text) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
begin delete from sessions where token_hash = h(p_token); return jsonb_build_object('ok', true); end $$;

-- 관리자 코드(admin_secret)를 맞히면 그 계정이 관리자가 된다.
create or replace function public.bry_claim_admin(p_token text, p_code text) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token);
begin
  if hits('adm:' || a.id, 600) >= 5 then return jsonb_build_object('ok', false, 'error', 'too_many_requests'); end if;
  if not exists (select 1 from admin_secret where code_hash = h(p_code)) then
    insert into throttle (key) values ('adm:' || a.id);
    return jsonb_build_object('ok', false);
  end if;
  update accounts set role = 'admin' where id = a.id;
  perform log(a, 'claim_admin', a.username, '');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.bry_profile(p_token text, p_display text, p_bio text, p_symbol text, p_accent text) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token);
begin
  if length(btrim(coalesce(p_display, ''))) not between 1 and 40 or length(coalesce(p_bio, '')) > 300 or length(coalesce(p_symbol, '')) not between 1 and 8
     or coalesce(p_accent, '') !~ '^#[0-9a-fA-F]{6}$' then raise exception 'invalid_profile'; end if;
  update accounts set display_name = btrim(p_display), bio = coalesce(p_bio, ''), avatar_symbol = p_symbol, accent = p_accent where id = a.id returning * into a;
  return jsonb_build_object('user', user_json(a));
end $$;

create or replace function public.bry_password(p_token text, p_old text, p_new text) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token);
begin
  if hits('pw:' || a.id, 600) >= 5 then return jsonb_build_object('ok', false, 'error', 'too_many_requests'); end if;
  if a.pw_hash <> crypt(coalesce(p_old, ''), a.pw_hash) then insert into throttle (key) values ('pw:' || a.id); return jsonb_build_object('ok', false, 'error', 'invalid_credentials'); end if;
  if length(coalesce(p_new, '')) < 4 or length(p_new) > 128 then return jsonb_build_object('ok', false, 'error', 'invalid_password'); end if;
  update accounts set pw_hash = crypt(p_new, gen_salt('bf', 8)) where id = a.id;
  delete from sessions where account_id = a.id and token_hash <> h(p_token);
  return jsonb_build_object('ok', true);
end $$;

-- ── 기록(어느 기기에서 들어와도 이어진다) ──
create or replace function public.bry_save_put(p_token text, p_data jsonb) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token); t timestamptz; nm text;
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'invalid_save'; end if;
  if octet_length(p_data::text) > 1000000 then raise exception 'save_too_large'; end if; -- vC.01: 4MB → 1MB (보통 기록은 수십 KB)
  insert into saves (account_id, data) values (a.id, p_data)
    on conflict (account_id) do update set data = excluded.data, updated_at = now() returning updated_at into t;
  -- 처음 정한 캐릭터 이름을 서버 표시 이름으로 맞춘다(관리자 도구 · 밤쥐들의 터 등에 그 이름이 뜬다).
  nm := left(btrim(coalesce(p_data #>> '{profile,name}', '')), 40);
  if nm <> '' and nm is distinct from a.display_name then update accounts set display_name = nm where id = a.id; end if;
  return jsonb_build_object('updated_at', t);
end $$;

create or replace function public.bry_save_get(p_token text, p_meta boolean default false) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token); r jsonb;
begin
  select case when p_meta then jsonb_build_object('updated_at', s.updated_at) else jsonb_build_object('updated_at', s.updated_at, 'data', s.data) end into r from saves s where s.account_id = a.id;
  return coalesce(r, jsonb_build_object('updated_at', null));
end $$;

-- 이미 있는 계정도 기록 속 캐릭터 이름으로 한 번 맞춘다(여러 번 실행해도 같다).
update biryeong_private.accounts a set display_name = left(btrim(s.data #>> '{profile,name}'), 40)
  from biryeong_private.saves s
  where s.account_id = a.id and btrim(coalesce(s.data #>> '{profile,name}', '')) <> '' and a.display_name is distinct from left(btrim(s.data #>> '{profile,name}'), 40);

-- ── 지신성 ──
create or replace function biryeong_private.post_json(p biryeong_private.posts, me bigint) returns jsonb language sql stable as $$
  select biryeong_private.card(a) || jsonb_build_object('id', p.id, 'body', p.body, 'created_at', p.created_at, 'parent_id', p.parent_id, 'mine', p.author = me,
    'reply_count', (select count(*) from biryeong_private.posts r where r.parent_id = p.id))
  from biryeong_private.accounts a where a.id = p.author $$;

create or replace function public.bry_posts(p_token text, p_before bigint default null, p_username text default null) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token); t biryeong_private.accounts; rows jsonb;
begin
  if p_username is not null then
    select * into t from accounts where username = lower(p_username);
    if not found then raise exception 'user_not_found'; end if;
  end if;
  select coalesce(jsonb_agg(post_json(p, a.id) order by p.id desc), '[]'::jsonb) into rows from (
    select * from posts x where x.parent_id is null and (p_before is null or x.id < p_before) and (t.id is null or x.author = t.id) order by x.id desc limit 25) p;
  if t.id is not null then return jsonb_build_object('profile', user_json(t), 'posts', rows); end if;
  return jsonb_build_object('posts', rows);
end $$;

create or replace function public.bry_post(p_token text, p_body text, p_parent bigint default null) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token); n bigint;
begin
  if length(btrim(coalesce(p_body, ''))) not between 1 and 500 then raise exception 'invalid_post'; end if;
  if p_parent is not null and not exists (select 1 from posts where id = p_parent and parent_id is null) then raise exception 'not_found'; end if;
  perform can_write(a, 'post');
  insert into posts (author, parent_id, body) values (a.id, p_parent, btrim(p_body)) returning id into n;
  return jsonb_build_object('id', n);
end $$;

create or replace function public.bry_replies(p_token text, p_id bigint) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token); p biryeong_private.posts;
begin
  select * into p from posts where id = p_id and parent_id is null;
  if not found then raise exception 'not_found'; end if;
  return jsonb_build_object('post', post_json(p, a.id), 'replies',
    (select coalesce(jsonb_agg(post_json(r, a.id) order by r.id), '[]'::jsonb) from (select * from posts where parent_id = p_id order by id limit 300) r));
end $$;

-- ── 낮새들의 터 ──
create or replace function biryeong_private.memo_json(m biryeong_private.memos, me bigint) returns jsonb language sql stable as $$
  select biryeong_private.card(a) || jsonb_build_object('id', m.id, 'title', m.title, 'body', m.body, 'created_at', m.created_at, 'mine', m.author = me,
    'comment_count', (select count(*) from biryeong_private.memo_comments c where c.memo_id = m.id))
  from biryeong_private.accounts a where a.id = m.author $$;

create or replace function public.bry_memos(p_token text, p_before bigint default null) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token);
begin
  return jsonb_build_object('memos', (select coalesce(jsonb_agg(memo_json(m, a.id) order by m.id desc), '[]'::jsonb)
    from (select * from memos x where p_before is null or x.id < p_before order by x.id desc limit 20) m));
end $$;

create or replace function public.bry_memo(p_token text, p_title text, p_body text) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token); n bigint;
begin
  if length(btrim(coalesce(p_title, ''))) not between 1 and 100 or length(btrim(coalesce(p_body, ''))) not between 1 and 3000 then raise exception 'invalid_memo'; end if;
  perform can_write(a, 'memo');
  insert into memos (author, title, body) values (a.id, btrim(p_title), btrim(p_body)) returning id into n;
  return jsonb_build_object('id', n);
end $$;

create or replace function public.bry_memo_comments(p_token text, p_id bigint) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token); m biryeong_private.memos;
begin
  select * into m from memos where id = p_id;
  if not found then raise exception 'not_found'; end if;
  return jsonb_build_object('memo', memo_json(m, a.id), 'comments', (select coalesce(jsonb_agg(card(u) || jsonb_build_object('id', c.id, 'parent_id', c.parent_id, 'body', c.body, 'created_at', c.created_at, 'mine', c.author = a.id) order by c.id), '[]'::jsonb)
    from memo_comments c join accounts u on u.id = c.author where c.memo_id = p_id));
end $$;

create or replace function public.bry_memo_comment(p_token text, p_memo bigint, p_body text, p_parent bigint default null) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token); n bigint;
begin
  if length(btrim(coalesce(p_body, ''))) not between 1 and 1200 then raise exception 'invalid_comment'; end if;
  if not exists (select 1 from memos where id = p_memo) then raise exception 'not_found'; end if;
  if p_parent is not null and not exists (select 1 from memo_comments where id = p_parent and memo_id = p_memo) then raise exception 'not_found'; end if;
  perform can_write(a, 'comment');
  insert into memo_comments (memo_id, author, parent_id, body) values (p_memo, a.id, p_parent, btrim(p_body)) returning id into n;
  return jsonb_build_object('id', n);
end $$;

-- ── 급식실 익명 사연(v1.9.1): 검토 없이 바로 그날의 교내 신문에 실리고, 쓴 사람은 누구에게도(관리자에게도) 보이지 않는다. 쓴 본인과 관리자가 지울 수 있다. ──
create table if not exists biryeong_private.cafeteria_stories (
  id         bigint generated always as identity primary key,
  author     bigint      not null references biryeong_private.accounts on delete cascade,
  body       text        not null,
  created_at timestamptz not null default now()
);
revoke all on biryeong_private.cafeteria_stories from anon, authenticated;

drop function if exists public.bry_stories(text, bigint);
-- 그날(한국 시각)의 교내 신문: 붙은 순서대로 #1, #2 … 번호가 붙는다.
create or replace function public.bry_stories(p_token text, p_date text default null) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token); d date := case when p_date ~ '^\d{4}-\d{2}-\d{2}$' then p_date::date else (now() at time zone 'Asia/Seoul')::date end;
begin
  return jsonb_build_object('date', d, 'stories',
    (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'no', s.no, 'body', s.body, 'created_at', s.created_at, 'mine', s.author = a.id) order by s.id), '[]'::jsonb)
     from (select x.*, row_number() over (order by x.id) as no from cafeteria_stories x where (x.created_at at time zone 'Asia/Seoul')::date = d order by x.id limit 300) s));
end $$;

create or replace function public.bry_story(p_token text, p_body text) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token); n bigint;
begin
  if length(btrim(coalesce(p_body, ''))) not between 1 and 500 then raise exception 'invalid_post'; end if;
  perform can_write(a, 'story');
  perform throttle_do('story-day:' || a.id, 30, 86400);
  insert into cafeteria_stories (author, body) values (a.id, btrim(p_body)) returning id into n;
  return jsonb_build_object('id', n);
end $$;

-- 글 지우기: 쓴 사람 본인 또는 관리자. p_kind: post · memo · comment · story
create or replace function public.bry_delete(p_token text, p_kind text, p_id bigint) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token); owner bigint; txt text;
begin
  if p_kind = 'post' then select author, body into owner, txt from posts where id = p_id;
  elsif p_kind = 'memo' then select author, title into owner, txt from memos where id = p_id;
  elsif p_kind = 'comment' then select author, body into owner, txt from memo_comments where id = p_id;
  elsif p_kind = 'story' then select author, body into owner, txt from cafeteria_stories where id = p_id;
  else raise exception 'not_found'; end if;
  if owner is null then raise exception 'not_found'; end if;
  if owner <> a.id and a.role <> 'admin' then raise exception 'forbidden'; end if;
  if owner <> a.id then perform log(a, 'delete_' || p_kind, case when p_kind = 'story' then '(익명)' else (select username from accounts where id = owner) end, left(txt, 200)); end if;
  if p_kind = 'post' then delete from posts where id = p_id;
  elsif p_kind = 'memo' then delete from memos where id = p_id;
  elsif p_kind = 'story' then delete from cafeteria_stories where id = p_id;
  else delete from memo_comments where id = p_id; end if;
  return jsonb_build_object('ok', true);
end $$;

-- ── 밤쥐들의 터 ──
create or replace function public.bry_users(p_token text, p_q text) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token); q text := lower(btrim(coalesce(p_q, '')));
begin
  if q = '' then return jsonb_build_object('users', '[]'::jsonb); end if;
  return jsonb_build_object('users', (select coalesce(jsonb_agg(jsonb_build_object('username', u.username, 'display_name', u.display_name)), '[]'::jsonb)
    from (select * from accounts x where x.id <> a.id and (x.username like replace(replace(q, '%', ''), '_', '\_') || '%' or lower(x.display_name) like '%' || replace(replace(q, '%', ''), '_', '\_') || '%') order by x.username limit 12) u));
end $$;

create or replace function public.bry_dm_threads(p_token text) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token);
begin
  return jsonb_build_object('threads', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'other_username', o.username, 'other_display_name', o.display_name, 'other_avatar_symbol', o.avatar_symbol, 'other_accent', o.accent,
      'last_body', (select left(m.body, 60) from dm_messages m where m.thread_id = t.id order by m.id desc limit 1),
      'unread', t.last_by is not null and t.last_by <> a.id and t.last_at > case when t.user_low = a.id then t.seen_low else t.seen_high end) order by t.last_at desc), '[]'::jsonb)
    from dm_threads t join accounts o on o.id = case when t.user_low = a.id then t.user_high else t.user_low end where a.id in (t.user_low, t.user_high)));
end $$;

create or replace function public.bry_dm_open(p_token text, p_username text) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token); o bigint; n bigint;
begin
  select id into o from accounts where username = lower(coalesce(p_username, '')) and id <> a.id;
  if o is null then raise exception 'user_not_found'; end if;
  insert into dm_threads (user_low, user_high) values (least(a.id, o), greatest(a.id, o)) on conflict (user_low, user_high) do update set user_low = excluded.user_low returning id into n;
  return jsonb_build_object('threadId', n);
end $$;

create or replace function biryeong_private.dm_page(p_thread bigint, p_before bigint, p_after bigint) returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'sender_id', m.sender, 'sender_username', u.username, 'sender_name', u.display_name, 'body', m.body, 'created_at', m.created_at) order by m.id), '[]'::jsonb)
  from (select * from biryeong_private.dm_messages x where x.thread_id = p_thread and (p_before is null or x.id < p_before) and (p_after is null or x.id > p_after)
        order by case when p_after is null then x.id end desc, case when p_after is not null then x.id end asc limit 50) m
  join biryeong_private.accounts u on u.id = m.sender $$;

create or replace function public.bry_dm_messages(p_token text, p_thread bigint, p_before bigint default null, p_after bigint default null) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token); t biryeong_private.dm_threads;
begin
  select * into t from dm_threads where id = p_thread and a.id in (user_low, user_high);
  if not found then raise exception 'not_found'; end if;
  if t.user_low = a.id then update dm_threads set seen_low = now() where id = t.id; else update dm_threads set seen_high = now() where id = t.id; end if;
  return jsonb_build_object('messages', dm_page(p_thread, p_before, p_after));
end $$;

create or replace function public.bry_dm_send(p_token text, p_thread bigint, p_body text) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token); n bigint;
begin
  if length(btrim(coalesce(p_body, ''))) not between 1 and 2000 then raise exception 'invalid_dm'; end if;
  if not exists (select 1 from dm_threads where id = p_thread and a.id in (user_low, user_high)) then raise exception 'not_found'; end if;
  perform can_write(a, 'dm');
  insert into dm_messages (thread_id, sender, body) values (p_thread, a.id, btrim(p_body)) returning id into n;
  update dm_threads set last_at = now(), last_by = a.id where id = p_thread;
  return jsonb_build_object('id', n);
end $$;

-- ── 우편함: 하사 · 공지 · 안 읽은 밀담 수(접속 표시도 겸한다) ──
create or replace function public.bry_inbox(p_token text) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token);
begin
  return jsonb_build_object('role', a.role, 'chat_title', a.chat_title,
    'grants', (select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'payload', g.payload, 'note', g.note, 'created_at', g.created_at) order by g.id), '[]'::jsonb)
      from grants g where (g.target = a.id or g.target is null) and not exists (select 1 from grant_claims c where c.grant_id = g.id and c.account_id = a.id)),
    'notice', (select jsonb_build_object('body', n.body, 'updated_at', n.updated_at) from notice n where n.id = 1 and n.body <> ''),
    'unread', (select count(*) from dm_threads t where a.id in (t.user_low, t.user_high) and t.last_by is not null and t.last_by <> a.id and t.last_at > case when t.user_low = a.id then t.seen_low else t.seen_high end));
end $$;

create or replace function public.bry_inbox_claim(p_token text, p_id bigint) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token); n int;
begin
  if not exists (select 1 from grants g where g.id = p_id and (g.target = a.id or g.target is null)) then raise exception 'not_found'; end if;
  insert into grant_claims (grant_id, account_id) values (p_id, a.id) on conflict do nothing;
  get diagnostics n = row_count;
  return jsonb_build_object('ok', n = 1);
end $$;

-- ── 관리자 ──
create or replace function public.bry_admin_users(p_token text) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := adm(p_token);
begin
  return jsonb_build_object('users', (select coalesce(jsonb_agg(user_json(u) || jsonb_build_object('last_seen', u.last_seen, 'online', u.last_seen > now() - interval '5 minutes',
      'banned_until', u.banned_until, 'muted_until', u.muted_until, 'save_at', s.updated_at, 'name', s.data #>> '{profile,name}', 'scenes', (select count(*) from jsonb_object_keys(case when jsonb_typeof(s.data #> '{story,q,done}') = 'object' then s.data #> '{story,q,done}' else '{}'::jsonb end)),
      'writes', (select count(*) from posts p where p.author = u.id) + (select count(*) from memos m where m.author = u.id)) order by u.last_seen desc), '[]'::jsonb)
    from accounts u left join saves s on s.account_id = u.id));
end $$;

-- p_action: role(admin|user) · ban(일수, 0 이면 해제) · mute(일수, 0 이면 해제) · password(새 비밀번호) · chat_title(칭호) · delete
create or replace function public.bry_admin_user_set(p_token text, p_username text, p_action text, p_value text default '') returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := adm(p_token); t biryeong_private.accounts; d numeric;
begin
  select * into t from accounts where username = lower(coalesce(p_username, ''));
  if not found then raise exception 'user_not_found'; end if;
  if p_action in ('role', 'ban', 'delete') and t.id = a.id then raise exception 'not_self'; end if;
  if p_action = 'role' then
    if p_value not in ('admin', 'user') then raise exception 'invalid_value'; end if;
    update accounts set role = p_value where id = t.id;
  elsif p_action in ('ban', 'mute') then
    d := case when p_value ~ '^[0-9]+(\.[0-9]+)?$' then p_value::numeric else null end;
    if d is null or d > 36500 then raise exception 'invalid_value'; end if;
    if p_action = 'ban' then
      update accounts set banned_until = case when d = 0 then null else now() + make_interval(secs => (d * 86400)::double precision) end where id = t.id;
      if d > 0 then delete from sessions where account_id = t.id; end if;
    else update accounts set muted_until = case when d = 0 then null else now() + make_interval(secs => (d * 86400)::double precision) end where id = t.id; end if;
  elsif p_action = 'password' then
    if length(coalesce(p_value, '')) < 4 or length(p_value) > 128 then raise exception 'invalid_password'; end if;
    update accounts set pw_hash = crypt(p_value, gen_salt('bf', 8)) where id = t.id;
    delete from sessions where account_id = t.id and token_hash <> h(p_token);
  elsif p_action = 'chat_title' then
    if length(coalesce(p_value, '')) > 20 then raise exception 'invalid_value'; end if;
    update accounts set chat_title = btrim(coalesce(p_value, '')) where id = t.id;
  elsif p_action = 'delete' then
    delete from accounts where id = t.id;
  else raise exception 'invalid_value'; end if;
  perform log(a, 'user_' || p_action, t.username, case when p_action = 'password' then '' else coalesce(p_value, '') end);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.bry_admin_dm_threads(p_token text) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := adm(p_token);
begin
  return jsonb_build_object('threads', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'user_low', l.username, 'user_high', hi.username, 'name_low', l.display_name, 'name_high', hi.display_name,
      'message_count', (select count(*) from dm_messages m where m.thread_id = t.id)) order by t.last_at desc), '[]'::jsonb)
    from dm_threads t join accounts l on l.id = t.user_low join accounts hi on hi.id = t.user_high));
end $$;

create or replace function public.bry_admin_dm_messages(p_token text, p_thread bigint, p_before bigint default null, p_after bigint default null) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := adm(p_token); who_txt text;
begin
  select l.username || ' ↔ ' || hi.username into who_txt from dm_threads t join accounts l on l.id = t.user_low join accounts hi on hi.id = t.user_high where t.id = p_thread;
  if who_txt is null then raise exception 'not_found'; end if;
  if p_before is null and p_after is null then perform log(a, 'read_dm', who_txt, ''); end if;
  return jsonb_build_object('messages', dm_page(p_thread, p_before, p_after));
end $$;

-- 하사: p_username 이 비면 모두에게. p_payload = {"money": 100, "spirit": 5, "items": {"아이템ID": 1}}
create or replace function public.bry_admin_grant(p_token text, p_username text, p_payload jsonb, p_note text default '') returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := adm(p_token); t bigint; n bigint;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 4000 or length(coalesce(p_note, '')) > 200 then raise exception 'invalid_value'; end if;
  if coalesce(btrim(p_username), '') <> '' then
    select id into t from accounts where username = lower(btrim(p_username));
    if t is null then raise exception 'user_not_found'; end if;
  end if;
  insert into grants (target, payload, note, by_admin) values (t, p_payload, coalesce(p_note, ''), a.username) returning id into n;
  perform log(a, 'grant', coalesce(nullif(btrim(coalesce(p_username, '')), ''), '(모두)'), p_payload::text);
  return jsonb_build_object('id', n);
end $$;

create or replace function public.bry_admin_grants(p_token text) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := adm(p_token);
begin
  return jsonb_build_object('grants', (select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'target', u.username, 'payload', g.payload, 'note', g.note, 'by', g.by_admin, 'created_at', g.created_at,
      'claimed', (select count(*) from grant_claims c where c.grant_id = g.id)) order by g.id desc), '[]'::jsonb)
    from (select * from grants order by id desc limit 50) g left join accounts u on u.id = g.target));
end $$;

create or replace function public.bry_admin_grant_cancel(p_token text, p_id bigint) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := adm(p_token);
begin
  delete from grants where id = p_id;
  perform log(a, 'grant_cancel', p_id::text, '');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.bry_admin_notice(p_token text, p_body text) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := adm(p_token);
begin
  if length(coalesce(p_body, '')) > 300 then raise exception 'invalid_value'; end if;
  insert into notice (id, body) values (1, btrim(coalesce(p_body, ''))) on conflict (id) do update set body = excluded.body, updated_at = now();
  perform log(a, 'notice', '', left(coalesce(p_body, ''), 200));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.bry_admin_audit(p_token text) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := adm(p_token);
begin
  return jsonb_build_object('rows', (select coalesce(jsonb_agg(to_jsonb(x) order by x.id desc), '[]'::jsonb) from (select * from audit order by id desc limit 150) x));
end $$;

-- 한 학생의 기록 열람(프로필 사진은 빼고 보낸다)
create or replace function public.bry_admin_save(p_token text, p_username text) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := adm(p_token); r jsonb;
begin
  select jsonb_build_object('updated_at', s.updated_at, 'profile', (s.data -> 'profile') - 'photo', 'game', s.data -> 'game', 'titles', s.data -> 'titles', 'achievements', s.data -> 'achievements')
    into r from saves s join accounts u on u.id = s.account_id where u.username = lower(coalesce(p_username, ''));
  if r is null then raise exception 'not_found'; end if;
  perform log(a, 'read_save', lower(p_username), '');
  return r;
end $$;

-- 스토리 관리: 관리자 코드 대신 관리자 계정의 표('token:…')로도 통과한다.
create or replace function public.story_admin_ok(p_code text) returns boolean
  language sql security definer set search_path = public, biryeong_private as $$
  select exists (select 1 from biryeong_private.admin_secret where code_hash = encode(sha256(convert_to(coalesce(p_code, ''), 'UTF8')), 'hex'))
      or (coalesce(p_code, '') like 'token:%' and exists (select 1 from biryeong_private.sessions s join biryeong_private.accounts a on a.id = s.account_id
            where s.token_hash = biryeong_private.h(substr(p_code, 7)) and s.expires_at > now() and a.role = 'admin'));
$$;
revoke all on function public.story_admin_ok(text) from anon;

-- ── 공지사항 게시판(v1.9.4): 첫 화면 왼쪽 [공지사항]. 관리자만 쓰고 지운다. 최신이 맨 위. ──
create table if not exists biryeong_private.board (
  id         bigint generated always as identity primary key,
  title      text        not null,
  body       text        not null,
  author     text        not null default '',
  created_at timestamptz not null default now()
);
revoke all on biryeong_private.board from anon, authenticated;

create or replace function public.bry_board(p_token text) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token);
begin
  return jsonb_build_object('posts', (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'title', b.title, 'body', b.body, 'author', b.author, 'created_at', b.created_at) order by b.id desc), '[]'::jsonb)
    from (select * from board order by id desc limit 50) b));
end $$;

create or replace function public.bry_admin_board_post(p_token text, p_title text, p_body text) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := adm(p_token); n bigint;
begin
  if length(btrim(coalesce(p_title, ''))) not between 1 and 80 or length(btrim(coalesce(p_body, ''))) not between 1 and 3000 then raise exception 'invalid_value'; end if;
  insert into board (title, body, author) values (btrim(p_title), btrim(p_body), a.username) returning id into n;
  perform log(a, 'board_post', '', left(p_title, 80));
  return jsonb_build_object('id', n);
end $$;

create or replace function public.bry_admin_board_delete(p_token text, p_id bigint) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := adm(p_token); t text;
begin
  delete from board where id = p_id returning title into t;
  if t is null then raise exception 'not_found'; end if;
  perform log(a, 'board_delete', '', left(t, 80));
  return jsonb_build_object('ok', true);
end $$;

-- ── 본편 파티 전투(v1.9.5): 같은 진도(같은 장면 · 같은 전투)의 학생끼리 3인까지 모인다. ──
-- 판은 방장의 브라우저가 돌리고(전투 엔진), 서버는 모집 · 판의 모습(view) · 일행이 보낸 행동만 맡는다.
create table if not exists biryeong_private.parties (
  id         bigint generated always as identity primary key,
  stage      text        not null,                 -- 장면.단계 (예: 1-3.2) — 같은 진도끼리만 보인다
  foe        text        not null,
  host       bigint      not null references biryeong_private.accounts on delete cascade,
  status     text        not null default 'open' check (status in ('open', 'battle', 'over', 'closed')),
  members    jsonb       not null default '[]',    -- [{ u: 아이디, name, m: 전투 엔진에 넣을 수치 }]
  view       jsonb,                                -- 방장이 올리는 판의 모습
  acts       jsonb       not null default '[]',    -- [{ n, u, a }] 일행이 보낸 행동(방장이 읽고 지운다)
  act_seq    integer     not null default 0,
  seq        integer     not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists parties_stage on biryeong_private.parties (stage, status);
revoke all on biryeong_private.parties from anon, authenticated;

create or replace function biryeong_private.party_json(p biryeong_private.parties) returns jsonb language sql stable as $$
  select jsonb_build_object('id', p.id, 'stage', p.stage, 'foe', p.foe, 'status', p.status, 'host', (select username from biryeong_private.accounts where id = p.host),
    'members', (select coalesce(jsonb_agg(jsonb_build_object('u', x->>'u', 'name', x->>'name', 'helper', coalesce((x->'m'->>'helper')::boolean, false))), '[]'::jsonb) from jsonb_array_elements(p.members) x),
    'seq', p.seq, 'updated_at', p.updated_at) $$;

-- vC.06 돕는 선배: 이미 깬 상대(p_foes)의 파티 중, 처음 싸우는 학생(방장)이 모집 중이고 자리가 남은 것
drop function if exists public.bry_party_help_list(text, text[]);
create or replace function public.bry_party_help_list(p_token text, p_foes jsonb) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token);
begin
  if jsonb_typeof(coalesce(p_foes, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_foes, '[]'::jsonb)) > 40 then raise exception 'invalid_value'; end if;
  perform throttle_do('helplist:' || a.id, 30, 60);
  update parties set status = 'closed' where status in ('open', 'battle') and updated_at < now() - interval '15 minutes';
  return jsonb_build_object('parties', (select coalesce(jsonb_agg(party_json(p) order by p.id desc), '[]'::jsonb)
    from parties p where p.foe in (select jsonb_array_elements_text(coalesce(p_foes, '[]'::jsonb))) and p.status = 'open' and p.host <> a.id and jsonb_array_length(p.members) < 3
      and not exists (select 1 from jsonb_array_elements(p.members) x where x->>'u' = a.username)));
end $$;

create or replace function public.bry_party_list(p_token text, p_stage text) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token);
begin
  update parties set status = 'closed' where status in ('open', 'battle') and updated_at < now() - interval '15 minutes';
  return jsonb_build_object('parties', (select coalesce(jsonb_agg(party_json(p) order by p.id desc), '[]'::jsonb)
    from parties p where p.stage = p_stage and p.status = 'open' and jsonb_array_length(p.members) < 3));
end $$;

create or replace function public.bry_party_create(p_token text, p_stage text, p_foe text, p_member jsonb) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token); n bigint;
begin
  if coalesce(p_stage, '') = '' or length(p_stage) > 40 or coalesce(p_foe, '') = '' or octet_length(coalesce(p_member::text, '')) > 6000 then raise exception 'invalid_value'; end if;
  perform throttle_do('party:' || a.id, 20, 600);
  update parties set status = 'closed', updated_at = now() where host = a.id and status = 'open';
  insert into parties (stage, foe, host, members) values (p_stage, p_foe, a.id, jsonb_build_array(jsonb_build_object('u', a.username, 'name', coalesce(p_member->>'name', a.display_name), 'm', p_member)))
    returning id into n;
  return jsonb_build_object('id', n);
end $$;

create or replace function public.bry_party_join(p_token text, p_id bigint, p_member jsonb) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token); p biryeong_private.parties;
begin
  if octet_length(coalesce(p_member::text, '')) > 6000 then raise exception 'invalid_value'; end if;
  select * into p from parties where id = p_id for update;
  if not found or p.status <> 'open' then raise exception 'not_found'; end if;
  if exists (select 1 from jsonb_array_elements(p.members) x where x->>'u' = a.username) then return jsonb_build_object('party', party_json(p)); end if;
  if jsonb_array_length(p.members) >= 3 then raise exception 'party_full'; end if;
  update parties set members = members || jsonb_build_array(jsonb_build_object('u', a.username, 'name', coalesce(p_member->>'name', a.display_name), 'm', p_member)), updated_at = now(), seq = seq + 1
    where id = p_id returning * into p;
  return jsonb_build_object('party', party_json(p));
end $$;

create or replace function public.bry_party_leave(p_token text, p_id bigint) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token); p biryeong_private.parties;
begin
  select * into p from parties where id = p_id for update;
  if not found then return jsonb_build_object('ok', true); end if;
  if p.host = a.id and p.status = 'open' then update parties set status = 'closed', updated_at = now(), seq = seq + 1 where id = p_id;
  elsif p.status = 'open' then
    update parties set members = (select coalesce(jsonb_agg(x), '[]'::jsonb) from jsonb_array_elements(members) x where x->>'u' <> a.username), updated_at = now(), seq = seq + 1 where id = p_id;
  elsif p.status = 'battle' and p.host <> a.id then
    -- 싸우는 중에 나가면 방장에게 '이탈'을 알린다
    update parties set act_seq = act_seq + 1, acts = acts || jsonb_build_array(jsonb_build_object('n', act_seq + 1, 'u', a.username, 'a', jsonb_build_object('flee', true))), updated_at = now() where id = p_id;
  elsif p.host = a.id then update parties set status = 'closed', updated_at = now(), seq = seq + 1 where id = p_id;
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- 일행이면 판 전체를, 방장이면 행동 목록과 일행의 수치까지 받는다.
-- vC.01 부하 줄이기: p_seq 로 「내가 이미 가진 판 번호」를 알려 주면, 판이 그대로일 때는 큰 전투 화면(view)을 다시 보내지 않는다.
--   (전투 중에는 1~2초마다 묻기 때문에, 바뀐 것이 없을 때의 응답을 수십 KB 에서 수백 바이트로 줄인다. 방장은 -1 을 보내 view 를 아예 받지 않는다.)
drop function if exists public.bry_party_get(text, bigint);
create or replace function public.bry_party_get(p_token text, p_id bigint, p_seq integer default null) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token); p biryeong_private.parties;
begin
  select * into p from parties where id = p_id;
  if not found or not exists (select 1 from jsonb_array_elements(p.members) x where x->>'u' = a.username) then raise exception 'not_found'; end if;
  return party_json(p) || jsonb_build_object('view', case when p_seq is not null and (p_seq = -1 or p_seq = p.seq) then null else p.view end, 'is_host', p.host = a.id) ||
    case when p.host = a.id then jsonb_build_object('acts', p.acts, 'raw', p.members) else '{}'::jsonb end;
end $$;

create or replace function public.bry_party_start(p_token text, p_id bigint, p_view jsonb) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token);
begin
  if octet_length(coalesce(p_view::text, '')) > 200000 then raise exception 'invalid_value'; end if;
  update parties set status = 'battle', view = p_view, acts = '[]', updated_at = now(), seq = seq + 1 where id = p_id and host = a.id and status = 'open';
  if not found then raise exception 'not_found'; end if;
  return jsonb_build_object('ok', true);
end $$;

-- 방장: 판의 모습을 올리고, 처리한 행동(n 이하)을 지운다. p_status 'over' 로 끝낸다.
create or replace function public.bry_party_push(p_token text, p_id bigint, p_view jsonb, p_done integer, p_status text default 'battle') returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token);
begin
  if octet_length(coalesce(p_view::text, '')) > 200000 or p_status not in ('battle', 'over') then raise exception 'invalid_value'; end if;
  update parties set view = p_view, status = p_status, seq = seq + 1, updated_at = now(),
    acts = (select coalesce(jsonb_agg(x), '[]'::jsonb) from jsonb_array_elements(acts) x where (x->>'n')::int > coalesce(p_done, 0))
    where id = p_id and host = a.id and status = 'battle';
  if not found then raise exception 'not_found'; end if;
  return jsonb_build_object('ok', true);
end $$;

-- 일행: 자기 행동을 보낸다(방장이 다음 읽을 때 처리한다).
create or replace function public.bry_party_act(p_token text, p_id bigint, p_act jsonb) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token);
begin
  if octet_length(coalesce(p_act::text, '')) > 2000 then raise exception 'invalid_value'; end if;
  update parties set act_seq = act_seq + 1, acts = acts || jsonb_build_array(jsonb_build_object('n', act_seq + 1, 'u', a.username, 'a', p_act)), updated_at = now()
    where id = p_id and status = 'battle' and exists (select 1 from jsonb_array_elements(members) x where x->>'u' = a.username);
  if not found then raise exception 'not_found'; end if;
  return jsonb_build_object('ok', true);
end $$;

-- ── 투표 루트 공개(v1.9.6): 모두의 선택(예: C2-3)을 지켜본 뒤 관리자가 어느 루트로 이야기를 이어 갈지 공개한다. 공개 전에는 아무도 그 뒤로 가지 못한다. ──
create table if not exists public.story_routes (
  flag       text        primary key,
  option     smallint    check (option between 1 and 12),
  open_at    timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.story_routes enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'routes_read_open') then
    create policy routes_read_open on public.story_routes for select to anon using (option is not null and open_at is not null and open_at <= now());
  end if;
end $$;
grant select on public.story_routes to anon;

create or replace function public.story_admin_routes(p_code text) returns setof public.story_routes
  language plpgsql security definer set search_path = public, biryeong_private as $$
begin
  if not public.story_admin_ok(p_code) then raise exception 'admin code mismatch'; end if;
  return query select * from public.story_routes order by flag;
end $$;

create or replace function public.story_admin_route(p_code text, p_flag text, p_option smallint, p_open_at timestamptz) returns void
  language plpgsql security definer set search_path = public, biryeong_private as $$
begin
  if not public.story_admin_ok(p_code) then raise exception 'admin code mismatch'; end if;
  insert into public.story_routes (flag, option, open_at, updated_at) values (p_flag, p_option, case when p_option is null then null else p_open_at end, now())
    on conflict (flag) do update set option = excluded.option, open_at = excluded.open_at, updated_at = now();
end $$;
grant execute on function public.story_admin_routes(text) to anon;
grant execute on function public.story_admin_route(text, text, smallint, timestamptz) to anon;

-- vC.01 선택 집계에 아이디 대신 캐릭터 이름을 보이기 위한 이름표(관리자만).
create or replace function public.story_admin_names(p_code text) returns table (username text, display_name text)
  language plpgsql security definer set search_path = public, biryeong_private as $$
begin
  if not public.story_admin_ok(p_code) then raise exception 'admin code mismatch'; end if;
  return query select a.username::text, a.display_name::text from biryeong_private.accounts a;
end $$;
grant execute on function public.story_admin_names(text) to anon;
-- vC.01 추가전투 단계 공개는 story_routes 의 'EXTRA_TIER' 줄을 쓴다(option = 열린 가장 높은 단계. 없으면 1단계만).

-- ── 수업 랭킹(vB.01): 과목마다 이번 주(월요일 0시, 한국 시각) 각자의 최고 기록. (vB.03부터 관리자 기록도 올린다) ──
create table if not exists biryeong_private.scores (
  account_id bigint      not null references biryeong_private.accounts on delete cascade,
  course     text        not null,
  week_start date        not null,
  score      integer     not null,
  name       text        not null default '',
  updated_at timestamptz not null default now(),
  primary key (account_id, course, week_start)
);
create index if not exists scores_rank on biryeong_private.scores (course, week_start, score desc);
-- vC.01 부하 줄이기: 자주 묻는 길에 색인을 더한다(받은 편지함 · 밀담 목록 · 타임라인 · 급식실 사연).
create index if not exists dm_threads_high on biryeong_private.dm_threads (user_high);
create index if not exists grants_target on biryeong_private.grants (target);
create index if not exists posts_top on biryeong_private.posts (id desc) where parent_id is null;
create index if not exists posts_author on biryeong_private.posts (author, id desc);
create index if not exists sessions_account on biryeong_private.sessions (account_id);
create index if not exists story_choices_account on public.story_choices (account, branch);
revoke all on biryeong_private.scores from anon, authenticated;

create or replace function biryeong_private.week0(p_offset int default 0) returns date language sql stable as $$
  select (date_trunc('week', now() at time zone 'Asia/Seoul') - make_interval(weeks => p_offset))::date $$;

create or replace function public.bry_rank_submit(p_token text, p_course text, p_score integer, p_name text) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token); w date := week0(); prev integer;
begin
  if coalesce(p_course, '') !~ '^[a-z0-9-]{2,40}$' or p_score is null or p_score < 1 or p_score > 100000000 then raise exception 'invalid_value'; end if;
  -- vB.03: 관리자 계정의 기록도 올린다(시험 삼아 한 판도 랭킹에 보인다).
  perform throttle_do('rank:' || a.id, 60, 600);
  select score into prev from scores where account_id = a.id and course = p_course and week_start = w;
  if prev is not null and prev >= p_score then return jsonb_build_object('ok', true, 'recorded', false, 'score', prev); end if;
  insert into scores (account_id, course, week_start, score, name) values (a.id, p_course, w, p_score, left(coalesce(nullif(btrim(p_name), ''), a.display_name), 40))
    on conflict (account_id, course, week_start) do update set score = excluded.score, name = excluded.name, updated_at = now();
  return jsonb_build_object('ok', true, 'recorded', true, 'score', p_score);
end $$;

-- p_week: 'this'(이번 주 — 20위까지와 내 순위) · 'last'(지난주 5위까지)
create or replace function public.bry_rank(p_token text, p_course text, p_week text default 'this') returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token); w date := week0(case when p_week = 'last' then 1 else 0 end); lim int := case when p_week = 'last' then 5 else 20 end;
begin
  return jsonb_build_object(
    'weekLabel', to_char(week0(), 'YYYY-MM-DD'), 'lastLabel', to_char(week0(1), 'YYYY-MM-DD'), 'lastEndLabel', to_char(week0() - 1, 'YYYY-MM-DD'),
    'total', (select count(*) from scores where course = p_course and week_start = w),
    'top', (select coalesce(jsonb_agg(jsonb_build_object('id', u.username, 'name', s.name, 'score', s.score) order by s.score desc, s.updated_at), '[]'::jsonb)
      from (select * from scores where course = p_course and week_start = w order by score desc, updated_at limit lim) s join accounts u on u.id = s.account_id),
    'me', (select jsonb_build_object('rank', 1 + (select count(*) from scores o where o.course = p_course and o.week_start = w and o.score > s.score), 'score', s.score)
      from scores s where s.account_id = a.id and s.course = p_course and s.week_start = w));
end $$;

-- ── 업데이트 노트(vB.01): 관리자가 직접 쓴다. 최신이 맨 위. ──
create table if not exists biryeong_private.patch_notes (
  id         bigint generated always as identity primary key,
  version    text        not null,
  body       text        not null,
  author     text        not null default '',
  created_at timestamptz not null default now()
);
revoke all on biryeong_private.patch_notes from anon, authenticated;
-- vC.01: 지금까지의 업데이트 노트를 비운다(vC.01 이전에 쓴 것만 — 여러 번 실행해도 그 뒤에 쓴 노트는 남는다).
delete from biryeong_private.patch_notes where created_at < timestamptz '2026-11-17 09:00:00+09';

create or replace function public.bry_notes(p_token text) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token);
begin
  return jsonb_build_object('notes', (select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'version', n.version, 'body', n.body, 'created_at', n.created_at) order by n.id desc), '[]'::jsonb) from (select * from patch_notes order by id desc limit 100) n));
end $$;
create or replace function public.bry_admin_note_post(p_token text, p_version text, p_body text) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := adm(p_token); n bigint;
begin
  if length(btrim(coalesce(p_version, ''))) not between 1 and 20 or length(btrim(coalesce(p_body, ''))) not between 1 and 3000 then raise exception 'invalid_value'; end if;
  insert into patch_notes (version, body, author) values (btrim(p_version), btrim(p_body), a.username) returning id into n;
  perform log(a, 'note_post', '', p_version);
  return jsonb_build_object('id', n);
end $$;
create or replace function public.bry_admin_note_delete(p_token text, p_id bigint) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := adm(p_token); v text;
begin
  delete from patch_notes where id = p_id returning version into v;
  if v is null then raise exception 'not_found'; end if;
  perform log(a, 'note_delete', '', v);
  return jsonb_build_object('ok', true);
end $$;

-- ── vC.06 접속자 · 초대 · 선물 · 도깨비들의 터(일행 대화) ──
-- 접속자: 최근 3분 안에 서버에 닿은 계정(who() 가 1분마다 last_seen 을 고친다. 화면은 25초마다 bry_presence 를 부른다).
-- 일행(room): 초대를 받아들이면 생기고(또는 초대한 사람의 일행에 들어가고), 본편 파티 전투가 모이면 그 파티에도 하나 붙는다.
--   일행이 끝나면(한 사람만 남거나 · 파티 전투가 끝나면) 대화는 그대로 남고, 누구나 날짜별로 읽을 수 있다.
alter table biryeong_private.grants add column if not exists gift_from text not null default '';
create table if not exists biryeong_private.rooms (
  id         bigint generated always as identity primary key,
  kind       text        not null default 'invite' check (kind in ('invite', 'battle')),
  party_id   bigint      unique,
  members    jsonb       not null default '[]',   -- [{ u, name }] 지금 남아 있는 사람
  everyone   jsonb       not null default '[]',   -- [{ u, name }] 한 번이라도 들어온 사람(끝난 뒤 목록에 보인다)
  status     text        not null default 'open' check (status in ('open', 'ended')),
  created_at timestamptz not null default now(),
  ended_at   timestamptz
);
create index if not exists rooms_status on biryeong_private.rooms (status, ended_at);
create table if not exists biryeong_private.room_msgs (
  id       bigint generated always as identity primary key,
  room_id  bigint      not null references biryeong_private.rooms on delete cascade,
  sender   text        not null default '',       -- 아이디(빈 칸 = 안내)
  name     text        not null default '',
  body     text        not null,
  at       timestamptz not null default now()
);
create index if not exists room_msgs_room on biryeong_private.room_msgs (room_id, id);
create table if not exists biryeong_private.invites (
  id         bigint generated always as identity primary key,
  from_id    bigint      not null references biryeong_private.accounts on delete cascade,
  to_id      bigint      not null references biryeong_private.accounts on delete cascade,
  status     text        not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired')),
  created_at timestamptz not null default now()
);
create index if not exists invites_to on biryeong_private.invites (to_id, status);
revoke all on biryeong_private.rooms, biryeong_private.room_msgs, biryeong_private.invites from anon, authenticated;

create or replace function biryeong_private.room_open_notice(p_room bigint, p_battle boolean) returns void
  language sql security definer set search_path = biryeong_private as $$
  insert into room_msgs (room_id, body) values
    (p_room, '[일행이 생성되었습니다. 자유롭게 대화를 나눌 수 있습니다.]'),
    (p_room, '[파티 채팅은 캐릭터 이입이며(단, 전투 목적의 파티인 경우 전투와 관련된 메타 발언을 다소 허용합니다. ex : 왠지 내 체력이 100으로 치면 한 20정도 남은 기분이야!!) 파티 종료 후 채팅 내역을 모두가 확인할 수 있게 됩니다. 종단 간 암호화 대화는 아닙니다.]') $$;
create or replace function biryeong_private.room_json(r biryeong_private.rooms) returns jsonb language sql stable as $$
  select jsonb_build_object('id', r.id, 'kind', r.kind, 'status', r.status, 'members', r.members, 'everyone', r.everyone, 'created_at', r.created_at, 'ended_at', r.ended_at) $$;
create or replace function biryeong_private.room_end(p_room bigint) returns void
  language sql security definer set search_path = biryeong_private as $$
  with u as (update rooms set status = 'ended', ended_at = now() where id = p_room and status = 'open' returning id)
  insert into room_msgs (room_id, body) select id, '[일행이 끝났습니다. 이제 이 대화는 모두가 「다른 일행들의 대화 보기」에서 읽을 수 있습니다.]' from u $$;
create or replace function biryeong_private.my_room(a biryeong_private.accounts) returns biryeong_private.rooms
  language plpgsql security definer set search_path = biryeong_private as $$
declare r biryeong_private.rooms;
begin
  -- 파티 전투가 끝났거나 사라진 일행은 여기서 닫는다
  for r in select * from rooms where status = 'open' and kind = 'battle' and exists (select 1 from jsonb_array_elements(members) x where x->>'u' = a.username) loop
    if not exists (select 1 from parties p where p.id = r.party_id and p.status in ('open', 'battle') and p.updated_at > now() - interval '15 minutes') then perform room_end(r.id); end if;
  end loop;
  select * into r from rooms where status = 'open' and exists (select 1 from jsonb_array_elements(members) x where x->>'u' = a.username) order by id desc limit 1;
  return r;
end $$;

-- 접속 표시 + 받은 초대 + 내 일행(안 읽은 말 수는 화면이 마지막으로 본 번호로 센다)
create or replace function public.bry_presence(p_token text, p_seen bigint default 0) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token); r biryeong_private.rooms;
begin
  update invites set status = 'expired' where status = 'pending' and created_at < now() - interval '10 minutes';
  r := my_room(a);
  return jsonb_build_object(
    'invites', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'from', card(f), 'at', i.created_at) order by i.id), '[]'::jsonb)
      from invites i join accounts f on f.id = i.from_id where i.to_id = a.id and i.status = 'pending'),
    'room', case when r.id is null then null else room_json(r) || jsonb_build_object('last', (select coalesce(max(id), 0) from room_msgs where room_id = r.id),
      'unread', (select count(*) from room_msgs m where m.room_id = r.id and m.id > coalesce(p_seen, 0) and m.sender <> a.username)) end,
    -- vC.07.5 아직 받지 않은 우편(하사 · 선물 · 관리자의 상태 고침)이 있으면 화면이 곧바로 우편함을 연다
    'mail', (select count(*) from grants g where (g.target = a.id or g.target is null) and g.created_at > now() - interval '30 days' and not exists (select 1 from grant_claims c where c.grant_id = g.id and c.account_id = a.id)),
    -- vC.07.3 일행 전투: 같은 일행의 누군가가 추가전투 · 실습 파티를 열었다
    'fight', case when r.id is null then null else (select party_json(p) || jsonb_build_object('host_name', (select x->>'name' from jsonb_array_elements(p.members) x limit 1))
      from parties p where p.stage = 'room:' || r.id and p.status = 'open' and p.host <> a.id and p.updated_at > now() - interval '15 minutes' and jsonb_array_length(p.members) < 3
        and not exists (select 1 from jsonb_array_elements(p.members) x where x->>'u' = a.username) order by p.id desc limit 1) end);
end $$;

create or replace function public.bry_online(p_token text) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token);
begin
  perform throttle_do('online:' || a.id, 30, 60);
  update accounts set last_seen = now() where id = a.id; -- 나는 언제나 목록에 있다(맨 위)
  return jsonb_build_object('users', (select coalesce(jsonb_agg(card(x) || jsonb_build_object('me', x.id = a.id, 'seen', x.last_seen,
      'in_room', exists (select 1 from rooms r where r.status = 'open' and exists (select 1 from jsonb_array_elements(r.members) m where m->>'u' = x.username))) order by (x.id = a.id) desc, x.last_seen desc), '[]'::jsonb)
    from accounts x where x.last_seen > now() - interval '3 minutes' and (x.banned_until is null or x.banned_until < now())));
end $$;

create or replace function public.bry_invite(p_token text, p_username text) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token); t biryeong_private.accounts; r biryeong_private.rooms;
begin
  select * into t from accounts where username = lower(btrim(coalesce(p_username, '')));
  if not found or t.id = a.id then raise exception 'not_found'; end if;
  perform throttle_do('invite:' || a.id, 12, 600);
  r := my_room(a);
  if r.id is not null and jsonb_array_length(r.members) >= 6 then raise exception 'party_full'; end if;
  if r.id is not null and exists (select 1 from jsonb_array_elements(r.members) x where x->>'u' = t.username) then raise exception 'already_member'; end if;
  update invites set status = 'expired' where from_id = a.id and to_id = t.id and status = 'pending';
  insert into invites (from_id, to_id) values (a.id, t.id);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.bry_invite_answer(p_token text, p_id bigint, p_accept boolean) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token); i biryeong_private.invites; f biryeong_private.accounts; r biryeong_private.rooms; me jsonb;
begin
  select * into i from invites where id = p_id and to_id = a.id for update;
  if not found or i.status <> 'pending' or i.created_at < now() - interval '10 minutes' then raise exception 'not_found'; end if;
  if not p_accept then update invites set status = 'declined' where id = i.id; return jsonb_build_object('ok', true); end if;
  update invites set status = 'accepted' where id = i.id;
  select * into f from accounts where id = i.from_id;
  me := jsonb_build_object('u', a.username, 'name', a.display_name);
  r := my_room(f);
  if r.id is null then
    insert into rooms (kind, members, everyone) values ('invite', jsonb_build_array(jsonb_build_object('u', f.username, 'name', f.display_name)), jsonb_build_array(jsonb_build_object('u', f.username, 'name', f.display_name))) returning * into r;
    perform room_open_notice(r.id, false);
  end if;
  if jsonb_array_length(r.members) >= 6 then raise exception 'party_full'; end if;
  -- 다른 일행에 있었다면 그 일행에서는 나온다
  perform public.bry_room_leave(p_token, x.id) from rooms x where x.status = 'open' and x.id <> r.id and x.kind = 'invite' and exists (select 1 from jsonb_array_elements(x.members) m where m->>'u' = a.username);
  if not exists (select 1 from jsonb_array_elements(r.members) x where x->>'u' = a.username) then
    update rooms set members = members || jsonb_build_array(me),
      everyone = case when exists (select 1 from jsonb_array_elements(everyone) x where x->>'u' = a.username) then everyone else everyone || jsonb_build_array(me) end where id = r.id;
    insert into room_msgs (room_id, body) values (r.id, format('[%s 님이 일행에 들어왔습니다.]', a.display_name));
  end if;
  return jsonb_build_object('ok', true, 'room', r.id);
end $$;

-- 본편 파티 전투: 일행이 둘 이상 모이면 그 파티에 일행 대화를 붙인다(전투 목적의 일행)
create or replace function public.bry_room_battle(p_token text, p_party bigint) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token); p biryeong_private.parties; r biryeong_private.rooms; mem jsonb;
begin
  select * into p from parties where id = p_party;
  if not found or p.status not in ('open', 'battle') or not exists (select 1 from jsonb_array_elements(p.members) x where x->>'u' = a.username) then raise exception 'not_found'; end if;
  mem := (select coalesce(jsonb_agg(jsonb_build_object('u', x->>'u', 'name', x->>'name')), '[]'::jsonb) from jsonb_array_elements(p.members) x);
  if jsonb_array_length(mem) < 2 then return jsonb_build_object('room', null); end if;
  select * into r from rooms where party_id = p.id;
  if not found then
    insert into rooms (kind, party_id, members, everyone) values ('battle', p.id, mem, mem) returning * into r;
    perform room_open_notice(r.id, true);
  elsif r.status = 'open' then
    update rooms set members = mem, everyone = (select jsonb_agg(distinct e) from (select jsonb_array_elements(r.everyone || mem) e) z) where id = r.id;
  end if;
  return jsonb_build_object('room', r.id);
end $$;

create or replace function public.bry_room_msgs(p_token text, p_room bigint, p_after bigint default 0) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token); r biryeong_private.rooms;
begin
  select * into r from rooms where id = p_room;
  if not found then raise exception 'not_found'; end if;
  if r.status = 'open' and not exists (select 1 from jsonb_array_elements(r.members) x where x->>'u' = a.username) then raise exception 'forbidden'; end if;
  return jsonb_build_object('room', room_json(r), 'msgs', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'u', m.sender, 'name', m.name, 'body', m.body, 'at', m.at) order by m.id), '[]'::jsonb)
    from (select * from room_msgs where room_id = r.id and id > coalesce(p_after, 0) order by id limit 300) m));
end $$;

create or replace function public.bry_room_send(p_token text, p_room bigint, p_body text) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token); n bigint;
begin
  if length(btrim(coalesce(p_body, ''))) not between 1 and 500 then raise exception 'invalid_post'; end if;
  if not exists (select 1 from rooms r where r.id = p_room and r.status = 'open' and exists (select 1 from jsonb_array_elements(r.members) x where x->>'u' = a.username)) then raise exception 'not_found'; end if;
  perform can_write(a, 'room');
  insert into room_msgs (room_id, sender, name, body) values (p_room, a.username, a.display_name, btrim(p_body)) returning id into n;
  return jsonb_build_object('id', n);
end $$;

create or replace function public.bry_room_leave(p_token text, p_room bigint) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token); r biryeong_private.rooms;
begin
  select * into r from rooms where id = p_room for update;
  if not found or r.status <> 'open' or not exists (select 1 from jsonb_array_elements(r.members) x where x->>'u' = a.username) then return jsonb_build_object('ok', true); end if;
  update rooms set members = (select coalesce(jsonb_agg(x), '[]'::jsonb) from jsonb_array_elements(members) x where x->>'u' <> a.username) where id = r.id returning * into r;
  insert into room_msgs (room_id, body) values (r.id, format('[%s 님이 일행에서 나갔습니다.]', a.display_name));
  if jsonb_array_length(r.members) <= 1 then perform room_end(r.id); end if;
  return jsonb_build_object('ok', true);
end $$;

-- 다른 일행들의 대화: 끝난 일행을 날짜(서울 시각)별로. p_date 가 비면 날짜 목록만.
create or replace function public.bry_rooms_ended(p_token text, p_date text default null) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token);
begin
  if p_date is null or p_date = '' then
    return jsonb_build_object('dates', (select coalesce(jsonb_agg(d order by d desc), '[]'::jsonb) from (select distinct to_char(ended_at at time zone 'Asia/Seoul', 'YYYY-MM-DD') d from rooms where status = 'ended' and ended_at > now() - interval '60 days') z));
  end if;
  if p_date !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'invalid_value'; end if;
  return jsonb_build_object('rooms', (select coalesce(jsonb_agg(room_json(r) || jsonb_build_object('count', (select count(*) from room_msgs m where m.room_id = r.id and m.sender <> '')) order by r.ended_at desc), '[]'::jsonb)
    from rooms r where r.status = 'ended' and to_char(r.ended_at at time zone 'Asia/Seoul', 'YYYY-MM-DD') = p_date));
end $$;

-- vC.07.5 관리자: 학생의 육조 스탯 · 체력 · 의지력 · 영력 · 쇠약 · 몸의 이상을 고친다.
--   기록은 학생 화면이 들고 있으므로, 우편함(grants)으로 「고칠 내용」을 보내고 그 학생이 접속해 있으면 25초 안에 화면이 적용한다.
create or replace function public.bry_admin_edit(p_token text, p_username text, p_edit jsonb, p_note text default '') returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := adm(p_token); t biryeong_private.accounts; n bigint;
begin
  if p_edit is null or jsonb_typeof(p_edit) <> 'object' or octet_length(p_edit::text) > 4000 then raise exception 'invalid_value'; end if;
  select * into t from accounts where username = lower(btrim(coalesce(p_username, '')));
  if not found then raise exception 'user_not_found'; end if;
  insert into grants (target, payload, note, by_admin) values (t.id, jsonb_build_object('edit', p_edit), left(coalesce(p_note, ''), 200), a.username) returning id into n;
  perform log(a, 'edit', t.username, p_edit::text);
  return jsonb_build_object('id', n);
end $$;

-- vC.06 접속자 목록에서 이름을 누르면: 그 사람의 프로필(프사 · 이름 · 나이 · 성별 · 한줄소개 · 칭호). 육조 스탯 · 소지품은 주지 않는다.
create or replace function public.bry_player_card(p_token text, p_username text) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token); t biryeong_private.accounts; pr jsonb;
begin
  select * into t from accounts where username = lower(btrim(coalesce(p_username, '')));
  if not found then raise exception 'not_found'; end if;
  perform throttle_do('pcard:' || a.id, 40, 60);
  select s.data -> 'profile' into pr from saves s where s.account_id = t.id;
  return card(t) || jsonb_build_object('me', t.id = a.id, 'seen', t.last_seen,
    'profile', case when pr is null then null else jsonb_build_object('name', pr->>'name', 'age', pr->>'age', 'gender', pr->>'gender', 'intro', pr->>'intro', 'title', pr->>'title',
      'photo', case when octet_length(coalesce(pr->>'photo', '')) <= 400000 then pr->>'photo' else null end) end);
end $$;

-- 선물: 보내는 사람의 화면이 먼저 소지품에서 덜어 낸 뒤 부른다. 받는 사람은 우편함(bry_inbox)으로 받는다.
create or replace function public.bry_gift(p_token text, p_username text, p_payload jsonb, p_note text default '') returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token); t biryeong_private.accounts; n bigint;
begin
  select * into t from accounts where username = lower(btrim(coalesce(p_username, '')));
  if not found or t.id = a.id then raise exception 'not_found'; end if;
  if jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 2000 or coalesce((p_payload->>'money')::int, 0) not between 0 and 100000
     or coalesce((p_payload->>'spirit')::int, 0) <> 0 or (select count(*) from jsonb_object_keys(coalesce(p_payload->'items', '{}'::jsonb))) > 10 then raise exception 'invalid_value'; end if;
  perform throttle_do('gift:' || a.id, 20, 3600);
  insert into grants (target, payload, note, by_admin, gift_from) values (t.id, p_payload, left(coalesce(p_note, ''), 200), '', a.display_name) returning id into n;
  return jsonb_build_object('ok', true, 'id', n);
end $$;

-- 우편함은 선물이면 보낸 사람 이름도 준다
create or replace function public.bry_inbox(p_token text) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token);
begin
  return jsonb_build_object('role', a.role, 'chat_title', a.chat_title,
    'grants', (select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'payload', g.payload, 'note', g.note, 'created_at', g.created_at, 'gift_from', g.gift_from) order by g.id), '[]'::jsonb)
      from grants g where (g.target = a.id or g.target is null) and not exists (select 1 from grant_claims c where c.grant_id = g.id and c.account_id = a.id)),
    'notice', (select jsonb_build_object('body', n.body, 'updated_at', n.updated_at) from notice n where n.id = 1 and n.body <> ''),
    'unread', (select count(*) from dm_threads t where a.id in (t.user_low, t.user_high) and t.last_by is not null and t.last_by <> a.id and t.last_at > case when t.user_low = a.id then t.seen_low else t.seen_high end));
end $$;

-- ════════ vD.01 서버 부하 줄이기 ════════
-- ① 정리 작업(만료 초대 · 오래된 파티 · 끝난 전투 일행 · 오래된 요청 기록)은 조회마다 하지 않고 1분에 한 번만(먼저 온 한 사람만, 기다리지 않고)
-- ② 일행 · 파티 구성원 찾기는 JSONB 포함(@>) + GIN 색인으로
-- ③ 파티 행동은 40개까지만 쌓인다 · 방장의 판은 60KB까지 · 방장이 행동을 읽을 때 구성원 자료(raw)는 시작할 때만
-- ④ 접속 확인(25~30초) 하나로 받은 초대 · 우편 · 밀담 알림까지 한 번에 — 우편함(공지) 조회는 드물게
create index if not exists rooms_members_gin on biryeong_private.rooms using gin (members jsonb_path_ops) where status = 'open';
create index if not exists parties_members_gin on biryeong_private.parties using gin (members jsonb_path_ops) where status in ('open', 'battle');
create index if not exists parties_live on biryeong_private.parties (status, updated_at) where status in ('open', 'battle');
create index if not exists accounts_last_seen on biryeong_private.accounts (last_seen desc);
create index if not exists grants_target_at on biryeong_private.grants (target, created_at desc);
create index if not exists grants_broadcast on biryeong_private.grants (created_at desc) where target is null;
create index if not exists dm_threads_low on biryeong_private.dm_threads (user_low);
create index if not exists invites_pending on biryeong_private.invites (created_at) where status = 'pending';
create index if not exists throttle_at on biryeong_private.throttle (at);

create table if not exists biryeong_private.maint (id smallint primary key default 1 check (id = 1), ran_at timestamptz not null default 'epoch');
insert into biryeong_private.maint (id) values (1) on conflict do nothing;
revoke all on biryeong_private.maint from anon, authenticated;
create or replace function biryeong_private.maint_tick() returns void
  language plpgsql security definer set search_path = biryeong_private as $$
declare r biryeong_private.rooms;
begin
  perform 1 from maint where id = 1 and ran_at < now() - interval '60 seconds' for update skip locked;
  if not found then return; end if;
  update maint set ran_at = now() where id = 1;
  update invites set status = 'expired' where status = 'pending' and created_at < now() - interval '10 minutes';
  update parties set status = 'closed', acts = '[]' where status in ('open', 'battle') and updated_at < now() - interval '15 minutes';
  update parties set view = null, acts = '[]' where status in ('over', 'closed') and view is not null and updated_at < now() - interval '1 hour'; -- 끝난 판의 큰 자료는 비운다
  for r in select * from rooms where status = 'open' and kind = 'battle' and not exists (select 1 from parties p where p.id = rooms.party_id and p.status in ('open', 'battle') and p.updated_at > now() - interval '15 minutes') loop
    perform room_end(r.id);
  end loop;
  delete from throttle where at < now() - interval '1 day';
end $$;
-- Supabase 에서 pg_cron 을 켜 두었다면 1분마다 따로 돌린다(없으면 위처럼 접속 확인이 1분에 한 번 대신 돌린다)
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'biryeong_maint';
    perform cron.schedule('biryeong_maint', '* * * * *', 'select biryeong_private.maint_tick()');
  end if;
exception when others then null;
end $$;

create or replace function biryeong_private.is_member(m jsonb, u text) returns boolean language sql immutable as $$ select m @> jsonb_build_array(jsonb_build_object('u', u)) $$;

create or replace function biryeong_private.my_room(a biryeong_private.accounts) returns biryeong_private.rooms
  language plpgsql security definer set search_path = biryeong_private as $$
declare r biryeong_private.rooms;
begin
  select * into r from rooms where status = 'open' and members @> jsonb_build_array(jsonb_build_object('u', a.username)) order by id desc limit 1;
  if r.id is not null and r.kind = 'battle' and not exists (select 1 from parties p where p.id = r.party_id and p.status in ('open', 'battle') and p.updated_at > now() - interval '15 minutes') then
    perform room_end(r.id); r := null;
    select * into r from rooms where status = 'open' and members @> jsonb_build_array(jsonb_build_object('u', a.username)) order by id desc limit 1;
  end if;
  return r;
end $$;

create or replace function public.bry_presence(p_token text, p_seen bigint default 0) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token); r biryeong_private.rooms;
begin
  perform maint_tick();
  r := my_room(a);
  return jsonb_build_object(
    'invites', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'from', card(f), 'at', i.created_at) order by i.id), '[]'::jsonb)
      from invites i join accounts f on f.id = i.from_id where i.to_id = a.id and i.status = 'pending' and i.created_at > now() - interval '10 minutes'),
    'room', case when r.id is null then null else room_json(r) || jsonb_build_object('last', (select coalesce(max(id), 0) from room_msgs where room_id = r.id),
      'unread', (select count(*) from room_msgs m where m.room_id = r.id and m.id > coalesce(p_seen, 0) and m.sender <> a.username)) end,
    'mail', (select count(*) from grants g where (g.target = a.id or g.target is null) and g.created_at > now() - interval '30 days' and not exists (select 1 from grant_claims c where c.grant_id = g.id and c.account_id = a.id)),
    -- vD.01 안 읽은 밀담 수도 여기서 — 밀담 알림(띠링)이 25~30초 안에 온다
    'dm', (select count(*) from dm_threads t where a.id in (t.user_low, t.user_high) and t.last_by is not null and t.last_by <> a.id and t.last_at > case when t.user_low = a.id then t.seen_low else t.seen_high end),
    'fight', case when r.id is null then null else (select party_json(p) || jsonb_build_object('host_name', (select x->>'name' from jsonb_array_elements(p.members) x limit 1))
      from parties p where p.stage = 'room:' || r.id and p.status = 'open' and p.host <> a.id and p.updated_at > now() - interval '15 minutes' and jsonb_array_length(p.members) < 3
        and not (p.members @> jsonb_build_array(jsonb_build_object('u', a.username))) order by p.id desc limit 1) end);
end $$;

create or replace function public.bry_online(p_token text) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token);
begin
  perform throttle_do('online:' || a.id, 30, 60);
  if a.last_seen < now() - interval '20 seconds' then update accounts set last_seen = now() where id = a.id; end if;
  return jsonb_build_object('users', (select coalesce(jsonb_agg(card(x) || jsonb_build_object('me', x.id = a.id, 'seen', x.last_seen,
      'in_room', exists (select 1 from rooms r where r.status = 'open' and r.members @> jsonb_build_array(jsonb_build_object('u', x.username)))) order by (x.id = a.id) desc, x.last_seen desc), '[]'::jsonb)
    from (select * from accounts where (last_seen > now() - interval '3 minutes' or id = a.id) and (banned_until is null or banned_until < now()) order by last_seen desc limit 200) x));
end $$;

create or replace function public.bry_party_list(p_token text, p_stage text) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token);
begin
  return jsonb_build_object('parties', (select coalesce(jsonb_agg(party_json(p) order by p.id desc), '[]'::jsonb)
    from parties p where p.stage = p_stage and p.status = 'open' and p.updated_at > now() - interval '15 minutes' and jsonb_array_length(p.members) < 3));
end $$;

create or replace function public.bry_party_help_list(p_token text, p_foes jsonb) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token);
begin
  if jsonb_typeof(coalesce(p_foes, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_foes, '[]'::jsonb)) > 40 then raise exception 'invalid_value'; end if;
  perform throttle_do('helplist:' || a.id, 30, 60);
  return jsonb_build_object('parties', (select coalesce(jsonb_agg(party_json(p) order by p.id desc), '[]'::jsonb)
    from parties p where p.foe in (select jsonb_array_elements_text(coalesce(p_foes, '[]'::jsonb))) and p.status = 'open' and p.updated_at > now() - interval '15 minutes' and p.host <> a.id and jsonb_array_length(p.members) < 3
      and not (p.members @> jsonb_build_array(jsonb_build_object('u', a.username)))));
end $$;

drop function if exists public.bry_party_get(text, bigint, integer);
create or replace function public.bry_party_get(p_token text, p_id bigint, p_seq integer default null, p_raw boolean default false) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token); p biryeong_private.parties;
begin
  select * into p from parties where id = p_id;
  if not found or not (p.members @> jsonb_build_array(jsonb_build_object('u', a.username))) then raise exception 'not_found'; end if;
  return party_json(p) || jsonb_build_object('view', case when p_seq is not null and (p_seq = -1 or p_seq = p.seq) then null else p.view end, 'is_host', p.host = a.id) ||
    case when p.host = a.id then jsonb_build_object('acts', p.acts) || case when p_raw then jsonb_build_object('raw', p.members) else '{}'::jsonb end else '{}'::jsonb end;
end $$;

create or replace function public.bry_party_start(p_token text, p_id bigint, p_view jsonb) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token);
begin
  if octet_length(coalesce(p_view::text, '')) > 60000 then raise exception 'invalid_value'; end if;
  update parties set status = 'battle', view = p_view, acts = '[]', updated_at = now(), seq = seq + 1 where id = p_id and host = a.id and status = 'open';
  if not found then raise exception 'not_found'; end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.bry_party_push(p_token text, p_id bigint, p_view jsonb, p_done integer, p_status text default 'battle') returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token);
begin
  if octet_length(coalesce(p_view::text, '')) > 60000 or p_status not in ('battle', 'over') then raise exception 'invalid_value'; end if;
  update parties set view = p_view, status = p_status, seq = seq + 1, updated_at = now(),
    acts = case when jsonb_array_length(acts) = 0 then acts else (select coalesce(jsonb_agg(x), '[]'::jsonb) from jsonb_array_elements(acts) x where (x->>'n')::int > coalesce(p_done, 0)) end
    where id = p_id and host = a.id and status = 'battle';
  if not found then raise exception 'not_found'; end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.bry_party_act(p_token text, p_id bigint, p_act jsonb) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token);
begin
  if octet_length(coalesce(p_act::text, '')) > 2000 then raise exception 'invalid_value'; end if;
  update parties set act_seq = act_seq + 1, acts = acts || jsonb_build_array(jsonb_build_object('n', act_seq + 1, 'u', a.username, 'a', p_act)), updated_at = now()
    where id = p_id and status = 'battle' and jsonb_array_length(acts) < 40 and members @> jsonb_build_array(jsonb_build_object('u', a.username));
  if not found then raise exception 'not_found'; end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.bry_room_msgs(p_token text, p_room bigint, p_after bigint default 0) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token); r biryeong_private.rooms;
begin
  select * into r from rooms where id = p_room;
  if not found then raise exception 'not_found'; end if;
  if r.status = 'open' and not (r.members @> jsonb_build_array(jsonb_build_object('u', a.username))) then raise exception 'forbidden'; end if;
  -- 새 말이 없으면 방 정보만 짧게
  if coalesce(p_after, 0) > 0 and not exists (select 1 from room_msgs where room_id = r.id and id > p_after) then
    return jsonb_build_object('room', jsonb_build_object('id', r.id, 'status', r.status), 'msgs', '[]'::jsonb);
  end if;
  return jsonb_build_object('room', room_json(r), 'msgs', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'u', m.sender, 'name', m.name, 'body', m.body, 'at', m.at) order by m.id), '[]'::jsonb)
    from (select * from room_msgs where room_id = r.id and id > coalesce(p_after, 0) order by id limit 300) m));
end $$;

-- 우편함(받은 공지는 속보 띠 · 밀담 수는 접속 확인이 맡는다 — 이 조회는 드물게)
create or replace function public.bry_inbox(p_token text) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token);
begin
  return jsonb_build_object('role', a.role, 'chat_title', a.chat_title,
    'grants', (select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'payload', g.payload, 'note', g.note, 'created_at', g.created_at, 'gift_from', g.gift_from) order by g.id), '[]'::jsonb)
      from grants g where (g.target = a.id or g.target is null) and g.created_at > now() - interval '30 days' and not exists (select 1 from grant_claims c where c.grant_id = g.id and c.account_id = a.id)),
    'notice', (select jsonb_build_object('body', n.body, 'updated_at', n.updated_at) from notice n where n.id = 1 and n.body <> ''),
    'unread', (select count(*) from dm_threads t where a.id in (t.user_low, t.user_high) and t.last_by is not null and t.last_by <> a.id and t.last_at > case when t.user_low = a.id then t.seen_low else t.seen_high end));
end $$;

-- vD.01 우편함: 지금까지 받은 서신(하사 · 선물 · 상태 고침) — 최근 90일, 200통
create or replace function public.bry_mail_list(p_token text) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token);
begin
  perform throttle_do('mail:' || a.id, 20, 60);
  return jsonb_build_object('mail', (select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'payload', g.payload, 'note', g.note, 'gift_from', g.gift_from, 'admin', g.gift_from is null, 'everyone', g.target is null,
      'created_at', g.created_at, 'claimed_at', c.claimed_at) order by g.id desc), '[]'::jsonb)
    from (select * from grants where (target = a.id or target is null) and created_at > now() - interval '90 days' order by id desc limit 200) g
      left join grant_claims c on c.grant_id = g.id and c.account_id = a.id
    where g.target is not null or c.claimed_at is not null));
end $$;

-- ════════ vD.02 일행: 파티장(맨 앞 사람)만 더 초대하고 전투를 연다 · 세 명까지 ════════
create or replace function biryeong_private.room_json(r biryeong_private.rooms) returns jsonb language sql stable as $$
  select jsonb_build_object('id', r.id, 'kind', r.kind, 'status', r.status, 'members', r.members, 'everyone', r.everyone, 'created_at', r.created_at, 'ended_at', r.ended_at,
    'leader', r.members->0->>'u') $$;

create or replace function public.bry_invite(p_token text, p_username text) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token); t biryeong_private.accounts; r biryeong_private.rooms;
begin
  select * into t from accounts where username = lower(btrim(coalesce(p_username, '')));
  if not found or t.id = a.id then raise exception 'not_found'; end if;
  perform throttle_do('invite:' || a.id, 12, 600);
  r := my_room(a);
  if r.id is not null and r.members->0->>'u' <> a.username then raise exception 'not_leader'; end if;
  if r.id is not null and jsonb_array_length(r.members) >= 3 then raise exception 'party_full'; end if;
  if r.id is not null and r.members @> jsonb_build_array(jsonb_build_object('u', t.username)) then raise exception 'already_member'; end if;
  update invites set status = 'expired' where from_id = a.id and to_id = t.id and status = 'pending';
  insert into invites (from_id, to_id) values (a.id, t.id);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.bry_invite_answer(p_token text, p_id bigint, p_accept boolean) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token); i biryeong_private.invites; f biryeong_private.accounts; r biryeong_private.rooms; me jsonb;
begin
  select * into i from invites where id = p_id and to_id = a.id for update;
  if not found or i.status <> 'pending' or i.created_at < now() - interval '10 minutes' then raise exception 'not_found'; end if;
  if not p_accept then update invites set status = 'declined' where id = i.id; return jsonb_build_object('ok', true); end if;
  select * into f from accounts where id = i.from_id;
  me := jsonb_build_object('u', a.username, 'name', a.display_name);
  r := my_room(f);
  if r.id is not null and r.members->0->>'u' <> f.username then update invites set status = 'expired' where id = i.id; raise exception 'not_leader'; end if;
  if r.id is not null and jsonb_array_length(r.members) >= 3 and not (r.members @> jsonb_build_array(jsonb_build_object('u', a.username))) then update invites set status = 'expired' where id = i.id; raise exception 'party_full'; end if;
  update invites set status = 'accepted' where id = i.id;
  if r.id is null then
    insert into rooms (kind, members, everyone) values ('invite', jsonb_build_array(jsonb_build_object('u', f.username, 'name', f.display_name)), jsonb_build_array(jsonb_build_object('u', f.username, 'name', f.display_name))) returning * into r;
    perform room_open_notice(r.id, false);
  end if;
  perform public.bry_room_leave(p_token, x.id) from rooms x where x.status = 'open' and x.id <> r.id and x.kind = 'invite' and x.members @> jsonb_build_array(jsonb_build_object('u', a.username));
  if not (r.members @> jsonb_build_array(jsonb_build_object('u', a.username))) then
    update rooms set members = members || jsonb_build_array(me),
      everyone = case when everyone @> jsonb_build_array(jsonb_build_object('u', a.username)) then everyone else everyone || jsonb_build_array(me) end where id = r.id;
    insert into room_msgs (room_id, body) values (r.id, format('[%s 님이 일행에 들어왔습니다.]', a.display_name));
  end if;
  return jsonb_build_object('ok', true, 'room', r.id);
end $$;

-- 일행 전투(stage 'room:<일행>')는 파티장만 연다
create or replace function public.bry_party_create(p_token text, p_stage text, p_foe text, p_member jsonb) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token); n bigint; r biryeong_private.rooms;
begin
  if coalesce(p_stage, '') = '' or length(p_stage) > 40 or coalesce(p_foe, '') = '' or octet_length(coalesce(p_member::text, '')) > 6000 then raise exception 'invalid_value'; end if;
  if p_stage like 'room:%' then
    select * into r from rooms where id = nullif(substr(p_stage, 6), '')::bigint and status = 'open';
    if not found or not (r.members @> jsonb_build_array(jsonb_build_object('u', a.username))) then raise exception 'not_found'; end if;
    if r.members->0->>'u' <> a.username then raise exception 'not_leader'; end if;
  end if;
  perform throttle_do('party:' || a.id, 20, 600);
  update parties set status = 'closed', updated_at = now() where host = a.id and status = 'open';
  insert into parties (stage, foe, host, members) values (p_stage, p_foe, a.id, jsonb_build_array(jsonb_build_object('u', a.username, 'name', coalesce(p_member->>'name', a.display_name), 'm', p_member)))
    returning id into n;
  return jsonb_build_object('id', n);
end $$;

-- ── vD.02.1 학생기록부(본관 3층) · 동아리 멤버(별관 부실): 각자의 서버 저장 기록에서 읽는다 ──
--   학년: 저장 기록의 game.grade(1~3) → 없으면 나이(game.age, 없으면 profile.age)로 17세 1학년 · 18세 2학년 · 19세 3학년
--   동아리: 저장 기록의 counts.club = { id, name, grade, age, hope, joinedAt }
create or replace function biryeong_private.save_grade(d jsonb) returns int language sql immutable as $$
  select case
    when (d #>> '{game,grade}') ~ '^[1-3]$' then (d #>> '{game,grade}')::int
    else least(3, greatest(1, coalesce(nullif(regexp_replace(coalesce(d #>> '{game,age}', d #>> '{profile,age}', ''), '\D', '', 'g'), '')::int, 17) - 16))
  end $$;

create or replace function public.bry_students(p_token text, p_grade int) returns jsonb
  language plpgsql stable security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token);
begin
  if p_grade not between 1 and 3 then raise exception 'invalid_grade'; end if;
  return jsonb_build_object('ok', true, 'names', coalesce((
    select jsonb_agg(nm order by nm) from (
      select left(coalesce(nullif(btrim(s.data #>> '{profile,name}'), ''), x.display_name), 40) as nm
        from saves s join accounts x on x.id = s.account_id
       where (x.banned_until is null or x.banned_until < now())
         and s.data ? 'profile' and s.data -> 'profile' <> 'null'::jsonb
         and biryeong_private.save_grade(s.data) = p_grade
       limit 500) q), '[]'::jsonb));
end $$;

create or replace function public.bry_club_members(p_token text, p_club text) returns jsonb
  language plpgsql stable security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token);
begin
  return jsonb_build_object('ok', true, 'members', coalesce((
    select jsonb_agg(m order by (m ->> 'joinedAt')) from (
      select jsonb_build_object('id', x.username, 'me', x.id = a.id,
               'name', left(coalesce(nullif(btrim(s.data #>> '{counts,club,name}'), ''), x.display_name), 40),
               'grade', s.data #> '{counts,club,grade}', 'age', s.data #> '{counts,club,age}',
               'hope', left(coalesce(s.data #>> '{counts,club,hope}', ''), 200), 'joinedAt', s.data #> '{counts,club,joinedAt}') as m
        from saves s join accounts x on x.id = s.account_id
       where (x.banned_until is null or x.banned_until < now())
         and s.data #>> '{counts,club,id}' = p_club
       limit 300) q), '[]'::jsonb));
end $$;

-- ── vD.02.3 학년은 프로필에서 고른 학년(profile.grade)이 먼저 — 나이와 따로(빠른년생 · 한 해 쉰 사람). 고른 적 없으면 예전처럼 나이로 ──
create or replace function biryeong_private.save_grade(d jsonb) returns int language sql immutable as $$
  select case
    when (d #>> '{profile,grade}') ~ '^[1-3]$' then (d #>> '{profile,grade}')::int
    when (d #>> '{game,grade}') ~ '^[1-3]$' then (d #>> '{game,grade}')::int
    else least(3, greatest(1, coalesce(nullif(regexp_replace(coalesce(d #>> '{game,age}', d #>> '{profile,age}', ''), '\D', '', 'g'), '')::int, 17) - 16))
  end $$;

create or replace function public.bry_club_members(p_token text, p_club text) returns jsonb
  language plpgsql stable security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token);
begin
  return jsonb_build_object('ok', true, 'members', coalesce((
    select jsonb_agg(m order by (m ->> 'joinedAt')) from (
      select jsonb_build_object('id', x.username, 'me', x.id = a.id,
               'name', left(coalesce(nullif(btrim(s.data #>> '{counts,club,name}'), ''), x.display_name), 40),
               'grade', biryeong_private.save_grade(s.data), 'age', s.data #> '{counts,club,age}',
               'hope', left(coalesce(s.data #>> '{counts,club,hope}', ''), 200), 'joinedAt', s.data #> '{counts,club,joinedAt}') as m
        from saves s join accounts x on x.id = s.account_id
       where (x.banned_until is null or x.banned_until < now())
         and s.data #>> '{counts,club,id}' = p_club
       limit 300) q), '[]'::jsonb));
end $$;

-- ── vD.02.3 팝업 공지: 관리자가 올리면, 정해 둔 시간(기본 30분) 안에 접속해 있는 사람의 화면에 한 번 뜬다(「단장했으니 새로고침 해 주세요!」) ──
create table if not exists biryeong_private.popups (
  id bigserial primary key,
  body text not null,
  reload boolean not null default true,
  created_at timestamptz not null default now(),
  until timestamptz not null
);
create index if not exists popups_until on biryeong_private.popups (until desc);

create or replace function public.bry_admin_popup(p_token text, p_body text, p_reload boolean default true, p_minutes int default 30) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := adm(p_token); v_id bigint;
begin
  if length(btrim(coalesce(p_body, ''))) = 0 then
    update popups set until = now() where until > now(); -- 비우고 보내면 떠 있는 팝업을 거둔다
    perform log(a, 'popup', '', '(거둠)');
    return jsonb_build_object('ok', true, 'cleared', true);
  end if;
  if length(p_body) > 400 or coalesce(p_minutes, 30) not between 1 and 1440 then raise exception 'invalid_value'; end if;
  insert into popups (body, reload, until) values (btrim(p_body), coalesce(p_reload, true), now() + make_interval(mins => coalesce(p_minutes, 30))) returning id into v_id;
  delete from popups where until < now() - interval '7 days';
  perform log(a, 'popup', '', left(p_body, 200));
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.bry_presence(p_token text, p_seen bigint default 0) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token); r biryeong_private.rooms;
begin
  perform maint_tick();
  r := my_room(a);
  return jsonb_build_object(
    'invites', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'from', card(f), 'at', i.created_at) order by i.id), '[]'::jsonb)
      from invites i join accounts f on f.id = i.from_id where i.to_id = a.id and i.status = 'pending' and i.created_at > now() - interval '10 minutes'),
    'room', case when r.id is null then null else room_json(r) || jsonb_build_object('last', (select coalesce(max(id), 0) from room_msgs where room_id = r.id),
      'unread', (select count(*) from room_msgs m where m.room_id = r.id and m.id > coalesce(p_seen, 0) and m.sender <> a.username)) end,
    'mail', (select count(*) from grants g where (g.target = a.id or g.target is null) and g.created_at > now() - interval '30 days' and not exists (select 1 from grant_claims c where c.grant_id = g.id and c.account_id = a.id)),
    -- vD.01 안 읽은 밀담 수도 여기서 — 밀담 알림(띠링)이 25~30초 안에 온다
    'dm', (select count(*) from dm_threads t where a.id in (t.user_low, t.user_high) and t.last_by is not null and t.last_by <> a.id and t.last_at > case when t.user_low = a.id then t.seen_low else t.seen_high end),
    'fight', case when r.id is null then null else (select party_json(p) || jsonb_build_object('host_name', (select x->>'name' from jsonb_array_elements(p.members) x limit 1))
      from parties p where p.stage = 'room:' || r.id and p.status = 'open' and p.host <> a.id and p.updated_at > now() - interval '15 minutes' and jsonb_array_length(p.members) < 3
        and not (p.members @> jsonb_build_array(jsonb_build_object('u', a.username))) order by p.id desc limit 1) end,
    -- vD.02.3 관리자의 팝업 공지(정해 둔 시간 안에 접속해 있는 사람에게 한 번 뜬다)
    'popup', (select jsonb_build_object('id', pp.id, 'body', pp.body, 'reload', pp.reload, 'at', pp.created_at) from popups pp where pp.until > now() order by pp.id desc limit 1));
end $$;

-- 연결 확인(사이트가 서버에 닿는지 · 이 판의 표가 깔렸는지)
create or replace function public.bry_status() returns jsonb language sql stable security definer set search_path = biryeong_private as $$
  select jsonb_build_object('ok', true, 'version', 'D.02.3', 'admin_code_set', exists (select 1 from admin_secret)) $$;

do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'bry\_%' loop
    execute format('revoke all on function %s from public; grant execute on function %s to anon, authenticated;', f.sig, f.sig);
  end loop;
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'biryeong_private' loop
    execute format('revoke all on function %s from public, anon, authenticated;', f.sig);
  end loop;
end $$;
notify pgrst, 'reload schema';
