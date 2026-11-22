-- D.06.6 보안/부하 패치 — 기존 데이터는 삭제하지 않습니다.
-- 운영 중 DB에는 이 파일만 SQL Editor에서 한 번 실행하면 됩니다.
-- 신규 설치용 전체 supabase/schema.sql 말미에도 같은 패치가 포함됩니다.

-- 미인증 데이터 직접 쓰기/계정별 투표 유출 차단.
-- 기존 계정/비밀번호를 사용하는 bry_* 세션을 통해서만 쓰기 가능.
revoke all on table public.story_choices, public.story_contrib, public.story_progress, public.cloud_saves from public, anon, authenticated;
-- 집계만 익명 조회: VIEW 소유자 권한으로 기초 테이블 집계(원본 레코드 미노출).
alter view public.story_tally set (security_invoker = off);
alter view public.story_contrib_totals set (security_invoker = off);
grant select on public.story_tally, public.story_contrib_totals to anon, authenticated;

-- 계정별 중복 투표의 경합조건(동시 INSERT)도 제약조건으로 방지.
delete from public.story_choices c using public.story_choices d
  where c.account <> '' and c.account=d.account and c.branch=d.branch
    and (c.updated_at>d.updated_at or (c.updated_at=d.updated_at and c.player_id>d.player_id));
create unique index if not exists story_choice_once_account_branch on public.story_choices(account, branch) where account <> '';

-- 부하를 많이 발생시키던 1 요청 1 로그 기반 제한을 시간창별 카운터로 바꿈.
create table if not exists biryeong_private.throttle_windows (
  key text not null, window_start timestamptz not null, calls int not null default 1,
  primary key (key, window_start)
);
alter table biryeong_private.throttle_windows enable row level security;
revoke all on biryeong_private.throttle_windows from public, anon, authenticated;

create sequence if not exists biryeong_private.throttle_maintenance_sequence;
revoke all on sequence biryeong_private.throttle_maintenance_sequence from public, anon, authenticated;

create or replace function biryeong_private.throttle_do(p_key text, p_max int, p_secs int) returns void
  language plpgsql security definer set search_path = biryeong_private as $$
declare bucket timestamptz; updated int;
begin
  if p_max < 1 or p_secs < 1 or length(p_key) > 200 then raise exception 'invalid_throttle'; end if;
  bucket := to_timestamp(floor(extract(epoch from clock_timestamp()) / p_secs) * p_secs);
  insert into throttle_windows(key, window_start, calls) values (p_key, bucket, 1)
    on conflict(key, window_start) do update set calls = throttle_windows.calls + 1
    where throttle_windows.calls < p_max returning calls into updated;
  if updated is null then raise exception 'too_many_requests'; end if;
  -- 임시 DB·무료 플랜에서 pg_cron이 없어도 수 시간 내 오래된 창 정리.
  if nextval('biryeong_private.throttle_maintenance_sequence') % 2048 = 0 then
    delete from throttle_windows where window_start < now() - interval '2 days';
  end if;
end $$;

-- Supabase 프록시가 추가한 마지막 유효 X-Forwarded-For 주소를 기준으로 제한(첫 항목 사용자 조작 방지).
create or replace function biryeong_private.ip() returns text language sql stable as $$
  select coalesce(nullif(btrim(regexp_replace(
    coalesce(nullif(current_setting('request.headers', true),'')::json ->> 'x-forwarded-for', ''),
    '^.*,', '')), ''), 'unknown')
$$;

-- 실패 로그인을 IP별로도 제한(틀린 비밀번호의 기록은 되돌리지 않음).
create or replace function public.bry_login(p_username text, p_password text) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare u text := lower(btrim(coalesce(p_username, ''))); a biryeong_private.accounts; client text := ip();
begin
  if length(u) > 40 or length(coalesce(p_password,'')) > 128 then return jsonb_build_object('error','invalid_credentials'); end if;
  if hits('login:' || u, 600) >= 10 or hits('loginip:' || client, 600) >= 40 then
    return jsonb_build_object('error','too_many_requests');
  end if;
  select * into a from accounts where username = u;
  if not found or a.pw_hash <> crypt(coalesce(p_password, ''), a.pw_hash) then
    insert into throttle(key) values ('login:' || u),('loginip:' || client);
    return jsonb_build_object('error','invalid_credentials');
  end if;
  if a.banned_until is not null and a.banned_until > now() then return jsonb_build_object('error','banned','until',a.banned_until); end if;
  update accounts set last_seen=now() where id=a.id;
  return jsonb_build_object('token', new_session(a.id), 'user', user_json(a));
end $$;

-- 스토리 선택 · 진행도는 클라이언트가 보낸 account/player_id를 신뢰하지 않음.
create or replace function public.bry_story_choice(p_token text, p_branch text, p_option smallint) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token);
begin
  if coalesce(p_branch,'') !~ '^[A-Za-z0-9_-]{1,48}$' or p_option not between 1 and 12 then raise exception 'invalid_value'; end if;
  perform throttle_do('choice:' || a.id, 30, 60);
  insert into public.story_choices(player_id, account, branch, option)
    values (md5('biryeong-choice:' || a.id)::uuid, a.username, p_branch, p_option)
    on conflict do nothing;
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.bry_story_progress(p_token text, p_scenes int) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token);
begin
  if p_scenes not between 0 and 1000 then raise exception 'invalid_value'; end if;
  perform throttle_do('story-progress:' || a.id, 20, 60);
  insert into public.story_progress(player_id, account, scenes)
    values (md5('biryeong-progress:' || a.id)::uuid, a.username, p_scenes)
    on conflict(player_id) do update set scenes=greatest(public.story_progress.scenes,excluded.scenes),updated_at=now();
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.bry_story_contrib(p_token text, p_event text, p_amount int) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token);
begin
  if p_event not in ('B7-2','erased-map','B12-1','final') or p_amount not between 1 and 100 then raise exception 'invalid_value'; end if;
  perform throttle_do('story-contrib:' || a.id, 20, 3600);
  insert into public.story_contrib(player_id, account, event, amount)
    values (md5('biryeong-contrib:' || a.id)::uuid, a.username, p_event, p_amount);
  return jsonb_build_object('ok',true);
end $$;

-- 원본 선택 기록은 관리자 코드 검증을 거친 경우에만 반환(최대 2000줄).
create or replace function public.story_admin_choices(p_code text) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
begin
  if not public.story_admin_ok(p_code) then raise exception 'admin code mismatch'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(c) order by c.updated_at desc), '[]'::jsonb)
    from (select account, branch, option, updated_at, player_id from public.story_choices order by updated_at desc limit 2000) c);
end $$;

-- 현재의 우편함을 최근 미수령 100건으로 제한(이전 것부터 나누어 전달).
create or replace function public.bry_inbox(p_token text) returns jsonb
  language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token);
begin
  perform throttle_do('inbox:' || a.id, 12, 60);
  return jsonb_build_object('role', a.role, 'chat_title', a.chat_title,
    'grants', (select coalesce(jsonb_agg(jsonb_build_object('id', g.id,'payload',g.payload,'note',g.note,'created_at',g.created_at,'gift_from',g.gift_from) order by g.id), '[]'::jsonb)
      from (select g.id,g.payload,g.note,g.created_at,g.gift_from from grants g
        where (g.target=a.id or g.target is null) and g.created_at > now()-interval '30 days'
        and not exists (select 1 from grant_claims c where c.grant_id=g.id and c.account_id=a.id)
        order by g.id limit 100) g),
    'notice',(select jsonb_build_object('body',n.body,'updated_at',n.updated_at) from notice n where n.id=1 and n.body<>''),
    'unread',(select count(*) from dm_threads t where a.id in (t.user_low,t.user_high)
      and t.last_by is not null and t.last_by<>a.id and t.last_at > case when t.user_low=a.id then t.seen_low else t.seen_high end));
end $$;

-- 기본 함수 실행권한 PUBLIC 상속 제거. 외부에 노출하는 RPC만 명시적으로 허용.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and (p.proname like 'story_admin_%' or p.proname like 'bry\_%') loop
    execute format('revoke all on function %s from public, anon, authenticated',f.sig);
  end loop;
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='biryeong_private' loop
    execute format('revoke all on function %s from public, anon, authenticated',f.sig);
  end loop;
end $$;

do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'bry\_%' loop
    execute format('grant execute on function %s to anon, authenticated',f.sig);
  end loop;
end $$;
grant execute on function public.story_admin_list(text), public.story_admin_set(text,smallint,text,jsonb,timestamptz,text),
  public.story_admin_routes(text), public.story_admin_route(text,text,smallint,timestamptz),
  public.story_admin_names(text), public.story_admin_choices(text) to anon, authenticated;

create or replace function public.bry_status() returns jsonb language sql stable security definer set search_path = biryeong_private as $$
  select jsonb_build_object('ok', true, 'version', 'D.06.6', 'admin_code_set', exists (select 1 from admin_secret),
    'wiped_at', (select wiped_at from maint where id = 1)) $$;
revoke all on function public.bry_status() from public;
grant execute on function public.bry_status() to anon, authenticated;
notify pgrst, 'reload schema';
