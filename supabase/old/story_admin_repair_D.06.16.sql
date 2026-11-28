-- 비령 D.06.16: 관리자 스토리 RPC 복구 (기존 챕터/투표 삭제·초기화 없음)
-- SQL Editor에서 관리자 권한으로 실행. 실행 전 DB 백업 권장.
begin;
create extension if not exists pgcrypto;
create schema if not exists biryeong_private;
create table if not exists biryeong_private.admin_secret (
 id smallint primary key default 1 check (id=1), code_hash text not null
);
create table if not exists public.story_chapters (
 ch smallint primary key, title text not null default '', content jsonb,
 open_at timestamptz, updated_at timestamptz not null default now()
);
create table if not exists public.story_routes (
 flag text primary key, option smallint check(option between 1 and 12),
 open_at timestamptz, updated_at timestamptz not null default now()
);
alter table public.story_chapters enable row level security;
alter table public.story_routes enable row level security;
do $$ begin
 if not exists (select 1 from pg_policies where schemaname='public' and tablename='story_chapters' and policyname='chapters_read_open') then
  create policy chapters_read_open on public.story_chapters for select to anon using(open_at is not null and open_at <= now() and content is not null);
 end if;
 if not exists (select 1 from pg_policies where schemaname='public' and tablename='story_routes' and policyname='routes_read_open') then
  create policy routes_read_open on public.story_routes for select to anon using(option is not null and open_at is not null and open_at <= now());
 end if;
end $$;
grant select on public.story_chapters, public.story_routes to anon, authenticated;

-- 기존 관리자 코드 해시는 보존. 서버에 존재하는 로그인 토큰도 관리자 여부를 검증하여 허용.
create or replace function public.story_admin_ok(p_code text) returns boolean
language sql security definer set search_path=public,biryeong_private as $$
 select exists(select 1 from biryeong_private.admin_secret where code_hash=encode(sha256(convert_to(coalesce(p_code,''),'UTF8')),'hex'))
 or (coalesce(p_code,'') like 'token:%' and exists(
    select 1 from biryeong_private.sessions s join biryeong_private.accounts a on a.id=s.account_id
    where s.token_hash=biryeong_private.h(substr(p_code,7)) and s.expires_at>now() and a.role='admin'));
$$;
revoke all on function public.story_admin_ok(text) from public, anon, authenticated;

create or replace function public.story_admin_list(p_code text)
returns table(ch smallint,title text,open_at timestamptz,has_content boolean,updated_at timestamptz)
language plpgsql security definer set search_path=public,biryeong_private as $$
begin
 if not public.story_admin_ok(p_code) then raise exception 'admin code mismatch'; end if;
 return query select c.ch,c.title,c.open_at,c.content is not null,c.updated_at from public.story_chapters c order by c.ch;
end $$;

create or replace function public.story_admin_set(p_code text,p_ch smallint,p_title text,p_content jsonb,p_open_at timestamptz,p_mode text)
returns void language plpgsql security definer set search_path=public,biryeong_private as $$
begin
 if not public.story_admin_ok(p_code) then raise exception 'admin code mismatch'; end if;
 if p_ch is null or p_ch not between 1 and 30 then raise exception 'invalid chapter'; end if;
 if p_mode='content' then
  if p_content is null or jsonb_typeof(p_content)<>'object' then raise exception 'invalid content'; end if;
  insert into public.story_chapters(ch,title,content,updated_at) values(p_ch,coalesce(p_title,''),p_content,now())
  on conflict(ch) do update set title=excluded.title,content=excluded.content,updated_at=now();
 elsif p_mode='open' then
  if not exists(select 1 from public.story_chapters where ch=p_ch and content is not null) then raise exception 'chapter file missing'; end if;
  update public.story_chapters set open_at=p_open_at,updated_at=now() where ch=p_ch;
 else raise exception 'unknown mode'; end if;
end $$;

create or replace function public.story_admin_routes(p_code text)
returns setof public.story_routes language plpgsql security definer set search_path=public,biryeong_private as $$
begin
 if not public.story_admin_ok(p_code) then raise exception 'admin code mismatch'; end if;
 return query select * from public.story_routes order by flag;
end $$;

create or replace function public.story_admin_route(p_code text,p_flag text,p_option smallint,p_open_at timestamptz)
returns void language plpgsql security definer set search_path=public,biryeong_private as $$
begin
 if not public.story_admin_ok(p_code) then raise exception 'admin code mismatch'; end if;
 if length(coalesce(p_flag,'')) not between 1 and 100 or (p_option is not null and p_option not between 1 and 12) then raise exception 'invalid route'; end if;
 insert into public.story_routes(flag,option,open_at,updated_at) values(p_flag,p_option,case when p_option is null then null else p_open_at end,now())
 on conflict(flag) do update set option=excluded.option,open_at=excluded.open_at,updated_at=now();
end $$;

create or replace function public.story_admin_names(p_code text)
returns table(username text,display_name text) language plpgsql security definer set search_path=public,biryeong_private as $$
begin
 if not public.story_admin_ok(p_code) then raise exception 'admin code mismatch'; end if;
 return query select a.username::text,a.display_name::text from biryeong_private.accounts a;
end $$;

grant execute on function public.story_admin_list(text),public.story_admin_set(text,smallint,text,jsonb,timestamptz,text),
 public.story_admin_routes(text),public.story_admin_route(text,text,smallint,timestamptz),
 public.story_admin_names(text) to anon,authenticated;
commit;
notify pgrst, 'reload schema';
-- 조회 검증: 아래 쿼리로 함수 5개 존재 여부 확인.
-- select proname from pg_proc join pg_namespace n on n.oid=pronamespace where n.nspname='public' and proname like 'story_admin_%';
