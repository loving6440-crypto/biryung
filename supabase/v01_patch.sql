-- ═══════════════════════════════════════════════════════════════════
--  비령 V.01 서버 패치 (운영 DB에 그대로 붙여 넣고 [Run] — 여러 번 실행해도 안전하다)
--
--  schema.sql 맨 끝에도 같은 내용이 들어 있다. 새 DB는 schema.sql 하나만 실행하면 된다.
--  이미 D.06.6 ~ D.06.18 중 일부를 적용한 운영 DB도 이 파일 하나만 실행하면 V.01 상태가 된다.
--  (D.06.15 · D.06.16 · D.06.18 파일을 따로 다시 실행할 필요 없다. 그 파일들은 기록으로만 남긴다.)
--
--  하는 일
--   1) 선택 수정 1회(edit_count) · 내 선택 조회/수정 함수 (D.06.15에서 「복구」 부분만 뺀 것)
--   2) 관리자 삭제 표 차단(story_choice_exclusions) · 탈퇴 계정 표 정리 · 집계 일원화 (D.06.18)
--   3) 본편 분기(C숫자-숫자)가 아닌 줄(EV-* 이벤트 선택 등)이 집계에 섞여 있으면 지운다
--   4) 관리자 코드: 같은 곳(IP)에서 서로 다른 틀린 코드 5번 → 1시간 동안 코드 확인 자체를 막는다
--      (관리자 계정으로 로그인해 쓰는 token: 경로는 세지 않는다)
--   5) 접속 주소(ip) 판별을 Cloudflare 실제 주소 → X-Forwarded-For 첫 항목 순으로 바꾼다
--   6) 대화 로그 내려받기 전용 함수(1000건씩 · 분당 60쪽 제한, 방 정보는 첫 쪽에만)
--   7) bry_status 버전 'V.01'
--   8) 모바일 · 컴퓨터 기록 맞추기: 다른 기기가 그 사이 올린 기록을 덮어쓰지 않는다(bry_save_put 에 p_base)
--   9) 한 주를 일요일 ~ 토요일로(랭킹 주차) — 이번 주 기록은 그대로 이어진다
--  10) 비밀번호 잊었을 때 임시 비밀번호(로그인 화면 → 관리자가 전해 준다)
--  지우는 데이터: 3)의 비본편 줄, 탈퇴 계정의 표, 관리자가 지운 표가 남아 있던 경우 그 줄. 그 밖에는 건드리지 않는다.
-- ═══════════════════════════════════════════════════════════════════
begin;

-- ── 1) 선택 수정 1회 ─────────────────────────────────────────────
alter table public.story_choices add column if not exists edit_count smallint not null default 0;
alter table public.story_choices drop constraint if exists story_choices_edit_count_check;
alter table public.story_choices add constraint story_choices_edit_count_check check (edit_count between 0 and 1);
revoke insert, update, delete on public.story_choices from anon, authenticated;
drop policy if exists choices_insert on public.story_choices;
drop policy if exists choices_update on public.story_choices;

-- 본편 분기 이름 규칙(story-data.js 의 D.choices: C0-1 … C4-6, 앞으로 늘어날 장도 같은 꼴)
create or replace function biryeong_private.story_branch_ok(p_branch text) returns boolean
  language sql immutable as $$ select coalesce(p_branch, '') ~ '^C[0-9]{1,2}-[0-9]{1,2}$' $$;

create or replace function public.bry_story_choice_mine(p_token text) returns jsonb
language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token);
begin
  perform throttle_do('choice-read:'||a.id, 30, 60);
  return (select coalesce(jsonb_agg(jsonb_build_object('branch',branch,'option',option,'edit_count',edit_count)), '[]'::jsonb)
    from public.story_choices where account=a.username);
end $$;

create or replace function public.bry_story_choice_edit(p_token text,p_branch text,p_option smallint) returns jsonb
language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token); c public.story_choices;
begin
  if not story_branch_ok(p_branch) or p_option not between 1 and 12 then raise exception 'invalid_value'; end if;
  perform throttle_do('choice-edit:'||a.id, 8, 60);
  select * into c from public.story_choices where account=a.username and branch=p_branch for update;
  if not found then return jsonb_build_object('ok',false,'error','선택 기록이 없습니다. 집계 새로고침 후 시도하세요.'); end if;
  if c.edit_count >= 1 then return jsonb_build_object('ok',false,'error','이미 1회 수정했습니다.','option',c.option,'edit_count',1); end if;
  if c.option = p_option then return jsonb_build_object('ok',false,'error','기존 선택과 다른 항목을 골라야 합니다.','option',c.option,'edit_count',0); end if;
  update public.story_choices set option=p_option, edit_count=1, updated_at=now()
    where player_id=c.player_id and branch=c.branch;
  return jsonb_build_object('ok',true,'option',p_option,'edit_count',1);
end $$;
revoke all on function public.bry_story_choice_mine(text) from public;
revoke all on function public.bry_story_choice_edit(text,text,smallint) from public;
grant execute on function public.bry_story_choice_mine(text), public.bry_story_choice_edit(text,text,smallint) to anon, authenticated;

-- ── 2) 관리자 삭제 표 차단 · 탈퇴 계정 정리 · 집계 일원화 ─────────────
create table if not exists biryeong_private.story_choice_exclusions (
  account text not null, branch text not null,
  deleted_at timestamptz not null default now(),
  primary key (account, branch)
);
alter table biryeong_private.story_choice_exclusions enable row level security;
revoke all on biryeong_private.story_choice_exclusions from public, anon, authenticated;

delete from public.story_choices c
  where not exists (select 1 from biryeong_private.accounts a where a.username = c.account);
delete from biryeong_private.story_choice_exclusions x
  where not exists (select 1 from biryeong_private.accounts a where a.username = x.account);
-- 관리자가 지운 표가 (D.06.15 복구 재실행 등으로) 되살아나 있으면 다시 지운다
delete from public.story_choices c using biryeong_private.story_choice_exclusions x
  where x.account = c.account and x.branch = c.branch;

-- ── 3) 본편 분기가 아닌 줄 · 선택지 수를 넘는 줄 정리 ────────────────
delete from public.story_choices where not biryeong_private.story_branch_ok(branch);
delete from public.story_choices c using (values
  ('C0-1',10),('C0-2',2),('C1-1',3),('C1-2',3),('C2-1',3),('C2-2',3),('C2-3',3),('C3-1',3),('C3-2',2),
  ('C3-3',4),('C3-4',2),('C4-1',3),('C4-2',3),('C4-3',3),('C4-4',2),('C4-5',3),('C4-6',2)) k(branch, n)
  where c.branch = k.branch and c.option > k.n;

create or replace function biryeong_private.story_choices_on_account_delete()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, biryeong_private as $$
begin
  delete from public.story_choices where account = old.username;
  delete from biryeong_private.story_choice_exclusions where account = old.username;
  return old;
end $$;
drop trigger if exists bry_cleanup_story_votes_on_delete on biryeong_private.accounts;
create trigger bry_cleanup_story_votes_on_delete after delete on biryeong_private.accounts
  for each row execute function biryeong_private.story_choices_on_account_delete();
revoke all on function biryeong_private.story_choices_on_account_delete() from public, anon, authenticated;

create or replace view public.story_tally with (security_invoker = off) as
  select c.branch, c.option, count(*)::int as votes
  from public.story_choices c
  join biryeong_private.accounts a on a.username = c.account
  group by c.branch, c.option;
grant select on public.story_tally to anon, authenticated;

create or replace function public.bry_story_choice(p_token text, p_branch text, p_option smallint)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := biryeong_private.who(p_token); c public.story_choices;
begin
  if not biryeong_private.story_branch_ok(p_branch) or p_option not between 1 and 12 then raise exception 'invalid_value'; end if;
  perform biryeong_private.throttle_do('choice:'||a.id, 30, 60);
  if exists (select 1 from biryeong_private.story_choice_exclusions where account = a.username and branch = p_branch) then
    return jsonb_build_object('ok', true, 'option', p_option, 'edit_count', 1, 'removed_by_admin', true);
  end if;
  insert into public.story_choices(player_id, account, branch, option)
    values (md5('biryeong-choice:'||a.id)::uuid, a.username, p_branch, p_option)
    on conflict do nothing;
  select * into c from public.story_choices where account = a.username and branch = p_branch;
  if not found then raise exception 'choice_not_recorded'; end if;
  return jsonb_build_object('ok', true, 'option', c.option, 'edit_count', c.edit_count);
end $$;
revoke all on function public.bry_story_choice(text,text,smallint) from public, anon, authenticated;
grant execute on function public.bry_story_choice(text,text,smallint) to anon, authenticated;

-- ── 5) 접속 주소 ──────────────────────────────────────────────────
-- Supabase 앞단(Cloudflare)이 넣는 cf-connecting-ip 는 사용자가 바꿀 수 없다.
-- 없으면 Supabase 안내대로 X-Forwarded-For 의 첫 항목. (D.06.6 은 마지막 항목 = 중계 서버 주소라
-- 모든 학생이 한 주소로 묶여, 로그인 실패 40번이면 모두가 막힐 수 있었다)
create or replace function biryeong_private.ip() returns text language sql stable as $$
  with h as (select coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json as j)
  select coalesce(
    nullif(btrim(j ->> 'cf-connecting-ip'), ''),
    nullif(btrim(split_part(coalesce(j ->> 'x-forwarded-for', ''), ',', 1)), ''),
    'unknown') from h
$$;

-- ── 4) 관리자 코드 5번 실패 → 1시간 잠금 ─────────────────────────────
create table if not exists biryeong_private.admin_code_fails (
  subject text not null, code_hash text not null, at timestamptz not null default now(),
  primary key (subject, code_hash)
);
create table if not exists biryeong_private.admin_code_locks (
  subject text primary key, until timestamptz not null
);
alter table biryeong_private.admin_code_fails enable row level security;
alter table biryeong_private.admin_code_locks enable row level security;
revoke all on biryeong_private.admin_code_fails, biryeong_private.admin_code_locks from public, anon, authenticated;

-- 'ok' | 'bad' | 'locked'.  같은 틀린 코드를 여러 번(화면이 한꺼번에 부르는 여러 함수) 보내도 1번으로 센다.
-- 잠금 대상: 'ip:주소'(5번) · 'acct:계정'(5번, 로그인 때 관리자 되기) · 'all'(어디서든 100번 — 여러 주소를 돌려 쓰는 공격 막기)
create or replace function biryeong_private.admin_code_check(p_code text, p_subjects text[]) returns text
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare s text; hc text := h(coalesce(p_code, '')); n int;
begin
  delete from admin_code_locks where until <= now();
  delete from admin_code_fails where at < now() - interval '1 hour';
  if exists (select 1 from admin_code_locks where subject = any(p_subjects)) then return 'locked'; end if;
  if exists (select 1 from admin_secret where code_hash = hc) then return 'ok'; end if;
  if coalesce(p_code, '') = '' then return 'bad'; end if;
  foreach s in array p_subjects loop
    insert into admin_code_fails (subject, code_hash) values (s, hc)
      on conflict (subject, code_hash) do update set at = now();
    select count(*) into n from admin_code_fails where subject = s;
    if n >= (case when s = 'all' then 100 else 5 end) then
      insert into admin_code_locks (subject, until) values (s, now() + interval '1 hour')
        on conflict (subject) do update set until = excluded.until;
      delete from admin_code_fails where subject = s;
    end if;
  end loop;
  if exists (select 1 from admin_code_locks where subject = any(p_subjects)) then return 'locked'; end if;
  return 'bad';
end $$;
revoke all on function biryeong_private.admin_code_check(text, text[]) from public, anon, authenticated;

-- 실패해도 예외를 던지지 않는다(던지면 실패 기록까지 되돌아간다). 대신 응답 상태를 403/429 로 바꾼다.
create or replace function public.story_admin_ok(p_code text) returns boolean
  language plpgsql security definer set search_path = public, biryeong_private as $$
declare r text;
begin
  if coalesce(p_code, '') like 'token:%' then
    if exists (select 1 from biryeong_private.sessions s join biryeong_private.accounts a on a.id = s.account_id
               where s.token_hash = biryeong_private.h(substr(p_code, 7)) and s.expires_at > now() and a.role = 'admin') then
      return true;
    end if;
    perform set_config('response.status', '403', true);
    return false;
  end if;
  r := biryeong_private.admin_code_check(p_code, array['ip:' || biryeong_private.ip(), 'all']);
  if r = 'ok' then return true; end if;
  perform set_config('response.status', case when r = 'locked' then '429' else '403' end, true);
  return false;
end $$;
revoke all on function public.story_admin_ok(text) from public, anon, authenticated;

create or replace function public.story_admin_list(p_code text)
returns table(ch smallint, title text, open_at timestamptz, has_content boolean, updated_at timestamptz)
language plpgsql security definer set search_path = public, biryeong_private as $$
begin
  if not public.story_admin_ok(p_code) then return; end if;
  return query select c.ch, c.title, c.open_at, c.content is not null, c.updated_at from public.story_chapters c order by c.ch;
end $$;

create or replace function public.story_admin_set(p_code text, p_ch smallint, p_title text, p_content jsonb, p_open_at timestamptz, p_mode text)
returns void language plpgsql security definer set search_path = public, biryeong_private as $$
begin
  if not public.story_admin_ok(p_code) then return; end if;
  if p_ch is null or p_ch not between 1 and 30 then raise exception 'invalid chapter'; end if;
  if p_mode = 'content' then
    if p_content is null or jsonb_typeof(p_content) <> 'object' then raise exception 'invalid content'; end if;
    insert into public.story_chapters(ch, title, content, updated_at) values (p_ch, coalesce(p_title, ''), p_content, now())
      on conflict (ch) do update set title = excluded.title, content = excluded.content, updated_at = now();
  elsif p_mode = 'open' then
    if not exists (select 1 from public.story_chapters where ch = p_ch and content is not null) then raise exception 'chapter file missing'; end if;
    update public.story_chapters set open_at = p_open_at, updated_at = now() where ch = p_ch;
  else raise exception 'unknown mode'; end if;
end $$;

create or replace function public.story_admin_routes(p_code text)
returns setof public.story_routes language plpgsql security definer set search_path = public, biryeong_private as $$
begin
  if not public.story_admin_ok(p_code) then return; end if;
  return query select * from public.story_routes order by flag;
end $$;

create or replace function public.story_admin_route(p_code text, p_flag text, p_option smallint, p_open_at timestamptz)
returns void language plpgsql security definer set search_path = public, biryeong_private as $$
begin
  if not public.story_admin_ok(p_code) then return; end if;
  if length(coalesce(p_flag, '')) not between 1 and 100 or (p_option is not null and p_option not between 1 and 12) then raise exception 'invalid route'; end if;
  insert into public.story_routes(flag, option, open_at, updated_at)
    values (p_flag, p_option, case when p_option is null then null else p_open_at end, now())
    on conflict (flag) do update set option = excluded.option, open_at = excluded.open_at, updated_at = now();
end $$;

create or replace function public.story_admin_names(p_code text)
returns table(username text, display_name text) language plpgsql security definer set search_path = public, biryeong_private as $$
begin
  if not public.story_admin_ok(p_code) then return; end if;
  return query select a.username::text, a.display_name::text from biryeong_private.accounts a;
end $$;

create or replace function public.story_admin_choices(p_code text) returns jsonb
language plpgsql security definer set search_path = pg_catalog, biryeong_private, public as $$
begin
  if not public.story_admin_ok(p_code) then return jsonb_build_object('ok', false, 'error', 'admin_code'); end if;
  return (select coalesce(jsonb_agg(to_jsonb(c) order by c.updated_at desc), '[]'::jsonb)
    from (select v.account, a.display_name as name, v.branch, v.option, v.updated_at, v.player_id, v.edit_count
      from public.story_choices v join biryeong_private.accounts a on a.username = v.account
      order by v.updated_at desc limit 10000) c);
end $$;

create or replace function public.story_admin_choice_delete(p_code text, p_account text, p_branch text)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, biryeong_private as $$
declare n int;
begin
  if not public.story_admin_ok(p_code) then return jsonb_build_object('ok', false, 'error', 'admin_code'); end if;
  if coalesce(p_account, '') = '' or length(p_account) > 80 or coalesce(p_branch, '') !~ '^[A-Za-z0-9_-]{1,48}$' then
    raise exception 'invalid_value';
  end if;
  insert into biryeong_private.story_choice_exclusions(account, branch) values (p_account, p_branch)
    on conflict (account, branch) do update set deleted_at = now();
  delete from public.story_choices where account = p_account and branch = p_branch;
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'deleted', n);
end $$;

revoke all on function public.story_admin_list(text), public.story_admin_set(text,smallint,text,jsonb,timestamptz,text),
  public.story_admin_routes(text), public.story_admin_route(text,text,smallint,timestamptz), public.story_admin_names(text),
  public.story_admin_choices(text), public.story_admin_choice_delete(text,text,text) from public;
grant execute on function public.story_admin_list(text), public.story_admin_set(text,smallint,text,jsonb,timestamptz,text),
  public.story_admin_routes(text), public.story_admin_route(text,text,smallint,timestamptz), public.story_admin_names(text),
  public.story_admin_choices(text), public.story_admin_choice_delete(text,text,text) to anon, authenticated;

-- 로그인 때 관리자 코드로 관리자 되기: 계정 · 주소 · 전체 모두 같은 잠금을 쓴다.
create or replace function public.bry_claim_admin(p_token text, p_code text) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token); r text;
begin
  r := admin_code_check(p_code, array['acct:' || a.id, 'ip:' || ip(), 'all']);
  if r = 'locked' then return jsonb_build_object('ok', false, 'error', 'admin_locked'); end if;
  if r <> 'ok' then return jsonb_build_object('ok', false, 'error', 'admin_code'); end if;
  update accounts set role = 'admin' where id = a.id;
  perform log(a, 'claim_admin', a.username, '');
  return jsonb_build_object('ok', true);
end $$;

-- ── 6) 대화 로그 내려받기 ──────────────────────────────────────────
-- 화면용 bry_room_msgs 는 300건마다 방 정보(room_json)를 다시 만든다. 내려받기는 1000건씩, 방 정보는 첫 쪽에만.
-- 한 계정이 1분에 60쪽(=6만 건)까지. 넘으면 too_many_requests → 화면이 잠시 쉬었다 이어 받는다.
create or replace function public.bry_room_msgs_export(p_token text, p_room bigint, p_after bigint default 0) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token); r biryeong_private.rooms; ms jsonb; n int;
begin
  perform throttle_do('roomexport:' || a.id, 60, 60);
  select * into r from rooms where id = p_room;
  if not found then raise exception 'not_found'; end if;
  if r.status = 'open' and not (r.members @> jsonb_build_array(jsonb_build_object('u', a.username))) then raise exception 'forbidden'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'u', m.sender, 'name', m.name, 'body', m.body, 'at', m.at) order by m.id), '[]'::jsonb), count(*)
    into ms, n
    from (select * from room_msgs where room_id = r.id and id > coalesce(p_after, 0) order by id limit 1000) m;
  return jsonb_build_object('room', case when coalesce(p_after, 0) = 0 then room_json(r) else jsonb_build_object('id', r.id, 'status', r.status) end,
    'msgs', ms, 'more', n = 1000);
end $$;
revoke all on function public.bry_room_msgs_export(text, bigint, bigint) from public;
grant execute on function public.bry_room_msgs_export(text, bigint, bigint) to anon, authenticated;

-- ── 8) 모바일 · 컴퓨터 기록 맞추기(V.01) ──────────────────────────────
-- 예전: 두 기기가 서로의 기록을 모른 채 「내 것」을 올려 다른 기기에서 한 것을 덮어썼다.
-- 이제: 기기는 「내가 마지막으로 맞춘 서버 기록 시각(p_base)」을 함께 보낸다. 그 사이 다른 기기가 올렸으면
--       덮어쓰지 않고 conflict 를 돌려준다 → 화면이 다른 기기 기록을 받아 오거나(이 기기에서 한 것이 없을 때),
--       어느 쪽을 남길지 묻는다. p_base 없이 부르면(예전 화면) 예전처럼 그냥 쓴다.
drop function if exists public.bry_save_put(text, jsonb);
create or replace function public.bry_save_put(p_token text, p_data jsonb, p_base timestamptz default null) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token); t timestamptz; nm text; ph text; cur biryeong_private.saves;
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'invalid_save'; end if;
  if octet_length(p_data::text) > 1000000 then raise exception 'save_too_large'; end if;
  if p_base is not null then
    select * into cur from saves where account_id = a.id for update;
    if found and cur.updated_at is distinct from p_base then
      return jsonb_build_object('ok', false, 'conflict', true, 'updated_at', cur.updated_at, 'device', cur.data ->> 'syncDevice');
    end if;
  end if;
  if jsonb_typeof(p_data -> 'profile') = 'object' and (p_data -> 'profile') ? 'photo' then
    ph := p_data #>> '{profile,photo}';
    if coalesce(ph, '') = '' then delete from photos where account_id = a.id;
    elsif ph like 'data:image/%' and octet_length(ph) <= 400000 then
      insert into photos (account_id, photo) values (a.id, ph) on conflict (account_id) do update set photo = excluded.photo, updated_at = now() where photos.photo is distinct from excluded.photo;
    end if;
    p_data := jsonb_set(p_data, '{profile}', (p_data -> 'profile') - 'photo');
  end if;
  insert into saves (account_id, data) values (a.id, p_data)
    on conflict (account_id) do update set data = excluded.data, updated_at = clock_timestamp() returning updated_at into t;
  nm := left(btrim(coalesce(p_data #>> '{profile,name}', '')), 40);
  if nm <> '' and nm is distinct from a.display_name then update accounts set display_name = nm where id = a.id; end if;
  return jsonb_build_object('ok', true, 'updated_at', t);
end $$;
revoke all on function public.bry_save_put(text, jsonb, timestamptz) from public;
grant execute on function public.bry_save_put(text, jsonb, timestamptz) to anon, authenticated;

create or replace function public.bry_save_get(p_token text, p_meta boolean default false) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token); r jsonb;
begin
  select case when p_meta then jsonb_build_object('updated_at', s.updated_at, 'device', s.data ->> 'syncDevice')
    else jsonb_build_object('updated_at', s.updated_at, 'device', s.data ->> 'syncDevice', 'data', case when ph.photo is not null and jsonb_typeof(s.data -> 'profile') = 'object' then jsonb_set(s.data, '{profile,photo}', to_jsonb(ph.photo)) else s.data end) end
    into r from saves s left join photos ph on ph.account_id = s.account_id where s.account_id = a.id;
  return coalesce(r, jsonb_build_object('updated_at', null));
end $$;
revoke all on function public.bry_save_get(text, boolean) from public;
grant execute on function public.bry_save_get(text, boolean) to anon, authenticated;

-- ── 9) 한 주는 일요일 ~ 토요일(V.01) ────────────────────────────────
-- 랭킹 주차를 일요일 0시(한국 시각)부터로. 예전 월요일로 적힌 기록은 그 주의 일요일로 옮긴다(여러 번 실행해도 같다).
create or replace function biryeong_private.week0(p_offset int default 0) returns date language sql stable as $$
  select ((date_trunc('week', (now() at time zone 'Asia/Seoul') + interval '1 day') - interval '1 day') - make_interval(weeks => p_offset))::date $$;
update biryeong_private.scores s set week_start = s.week_start - 1
  where extract(isodow from s.week_start) = 1
    and not exists (select 1 from biryeong_private.scores o where o.account_id = s.account_id and o.course = s.course and o.week_start = s.week_start - 1);

-- ── 10) 비밀번호 잊었을 때: 임시 비밀번호(V.01) ─────────────────────────
-- 로그인 화면에서 아이디를 적으면 임시 비밀번호가 만들어진다(본인에게는 보이지 않는다).
-- 관리자가 [서버 관리 → 비밀번호 재설정 요청]에서 확인해 전해 준다 → 그것으로 로그인 → 곧바로 새 비밀번호를 정한다.
-- 예전 비밀번호도 그대로 쓸 수 있다(남이 요청해도 잠기지 않는다). 임시 비밀번호는 3일이 지나면 쓸 수 없다.
create table if not exists biryeong_private.pw_resets (
  account_id   bigint primary key references biryeong_private.accounts(id) on delete cascade,
  temp_pw      text not null,
  temp_hash    text not null,
  requested_at timestamptz not null default now(),
  used_at      timestamptz
);
alter table biryeong_private.pw_resets enable row level security;
revoke all on biryeong_private.pw_resets from public, anon, authenticated;

create or replace function public.bry_pw_reset_request(p_username text) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare u text := lower(btrim(coalesce(p_username, ''))); a biryeong_private.accounts; client text := ip(); tmp text;
  al constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
begin
  if u = '' or length(u) > 40 then return jsonb_build_object('error', 'invalid_username'); end if;
  if hits('pwreq:' || u, 86400) >= 3 or hits('pwreqip:' || client, 3600) >= 10 then return jsonb_build_object('error', 'too_many_requests'); end if;
  insert into throttle(key) values ('pwreq:' || u), ('pwreqip:' || client);
  select * into a from accounts where username = u;
  if found then
    select string_agg(substr(al, 1 + (get_byte(x.r, i) % length(al)), 1), '' order by i) into tmp
      from (select gen_random_bytes(8) as r) x, generate_series(0, 7) i;
    insert into pw_resets(account_id, temp_pw, temp_hash, requested_at, used_at)
      values (a.id, tmp, crypt(tmp, gen_salt('bf', 8)), now(), null)
      on conflict (account_id) do update set temp_pw = excluded.temp_pw, temp_hash = excluded.temp_hash, requested_at = now(), used_at = null;
  end if;
  return jsonb_build_object('ok', true); -- 아이디가 있는지는 알려 주지 않는다
end $$;

create or replace function public.bry_login(p_username text, p_password text) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare u text := lower(btrim(coalesce(p_username, ''))); a biryeong_private.accounts; client text := ip(); r biryeong_private.pw_resets; temp boolean := false;
begin
  if length(u) > 40 or length(coalesce(p_password,'')) > 128 then return jsonb_build_object('error','invalid_credentials'); end if;
  if hits('login:' || u, 600) >= 10 or hits('loginip:' || client, 600) >= 40 then
    return jsonb_build_object('error','too_many_requests');
  end if;
  select * into a from accounts where username = u;
  if not found then
    insert into throttle(key) values ('login:' || u),('loginip:' || client);
    return jsonb_build_object('error','invalid_credentials');
  end if;
  if a.pw_hash <> crypt(coalesce(p_password, ''), a.pw_hash) then
    select * into r from pw_resets where account_id = a.id and requested_at > now() - interval '3 days';
    if found and r.temp_hash = crypt(coalesce(p_password, ''), r.temp_hash) then temp := true;
    else
      insert into throttle(key) values ('login:' || u),('loginip:' || client);
      return jsonb_build_object('error','invalid_credentials');
    end if;
  end if;
  if a.banned_until is not null and a.banned_until > now() then return jsonb_build_object('error','banned','until',a.banned_until); end if;
  if temp then update pw_resets set used_at = now() where account_id = a.id;
  else delete from pw_resets where account_id = a.id and used_at is null; end if; -- 예전 비밀번호를 기억해 냈다 → 요청은 지운다
  update accounts set last_seen=now() where id=a.id;
  return jsonb_build_object('token', new_session(a.id), 'user', user_json(a), 'must_change', temp);
end $$;

-- 임시 비밀번호로 들어온 계정인가(새 비밀번호를 정해야 하는가)
create or replace function public.bry_pw_reset_state(p_token text) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token);
begin
  return jsonb_build_object('must_change', exists(select 1 from pw_resets where account_id = a.id and used_at is not null));
end $$;

create or replace function public.bry_pw_reset_finish(p_token text, p_new text) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token);
begin
  if not exists(select 1 from pw_resets where account_id = a.id and used_at is not null) then return jsonb_build_object('ok', false, 'error', 'no_reset'); end if;
  if length(coalesce(p_new, '')) < 4 or length(p_new) > 128 then return jsonb_build_object('ok', false, 'error', 'invalid_password'); end if;
  update accounts set pw_hash = crypt(p_new, gen_salt('bf', 8)) where id = a.id;
  delete from pw_resets where account_id = a.id;
  delete from sessions where account_id = a.id and token_hash <> h(p_token);
  return jsonb_build_object('ok', true);
end $$;

-- 관리자: 요청 목록(임시 비밀번호가 보인다) · 지우기
create or replace function public.bry_admin_pw_resets(p_token text) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := adm(p_token);
begin
  delete from pw_resets where requested_at < now() - interval '3 days';
  return jsonb_build_object('resets', (select coalesce(jsonb_agg(jsonb_build_object('username', u.username, 'display_name', u.display_name, 'name', s.data #>> '{profile,name}',
      'temp_pw', r.temp_pw, 'requested_at', r.requested_at, 'used_at', r.used_at, 'expires_at', r.requested_at + interval '3 days') order by r.requested_at desc), '[]'::jsonb)
    from pw_resets r join accounts u on u.id = r.account_id left join saves s on s.account_id = u.id));
end $$;

create or replace function public.bry_admin_pw_reset_clear(p_token text, p_username text) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := adm(p_token);
begin
  delete from pw_resets r using accounts u where u.id = r.account_id and u.username = lower(btrim(coalesce(p_username, '')));
  perform log(a, 'pw_reset_clear', lower(btrim(coalesce(p_username, ''))), '');
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.bry_pw_reset_request(text), public.bry_pw_reset_state(text), public.bry_pw_reset_finish(text, text),
  public.bry_admin_pw_resets(text), public.bry_admin_pw_reset_clear(text, text) from public;
grant execute on function public.bry_pw_reset_request(text), public.bry_pw_reset_state(text), public.bry_pw_reset_finish(text, text),
  public.bry_admin_pw_resets(text), public.bry_admin_pw_reset_clear(text, text), public.bry_login(text, text) to anon, authenticated;

-- ── 7) 버전 ───────────────────────────────────────────────────────
create or replace function public.bry_status() returns jsonb language sql stable security definer set search_path = biryeong_private as $$
  select jsonb_build_object('ok', true, 'version', 'V.01', 'admin_code_set', exists (select 1 from admin_secret),
    'wiped_at', (select wiped_at from maint where id = 1)) $$;
revoke all on function public.bry_status() from public;
grant execute on function public.bry_status() to anon, authenticated;

commit;
notify pgrst, 'reload schema';
