-- 비령 D.06.18: 공개 집계와 관리자 「누가 무엇을 골랐나」 일원화 + 탈퇴계정 정리
-- 적용 전 public.story_choices를 백업하세요. 무관한 스토리/계정 데이터는 변경하지 않습니다.
begin;
-- 탈퇴 계정의 남아 있는 투표는 초기 청소; 계정이 없는 구버전 익명 투표는 정상 계정으로 확인할 수 없어 제외.
delete from public.story_choices c
where not exists (select 1 from biryeong_private.accounts a where a.username = c.account);

-- 관리자 삭제 기록이 구버전 클라이언트의 재동기화로 되살아나지 않도록 차단.
create table if not exists biryeong_private.story_choice_exclusions (
  account text not null, branch text not null,
  deleted_at timestamptz not null default now(),
  primary key (account, branch)
);
revoke all on biryeong_private.story_choice_exclusions from public, anon, authenticated;

-- 탈퇴 계정의 삭제 금지 기록도 정리해 재가입(동일 ID)을 방해하지 않음.
delete from biryeong_private.story_choice_exclusions x
where not exists (select 1 from biryeong_private.accounts a where a.username=x.account);

-- 새로 계정을 삭제하면 해당 계정의 선택도 즉시 제거.
create or replace function biryeong_private.story_choices_on_account_delete()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, biryeong_private as $$
begin
  delete from public.story_choices where account = old.username;
  delete from biryeong_private.story_choice_exclusions where account=old.username;
  return old;
end $$;
drop trigger if exists bry_cleanup_story_votes_on_delete on biryeong_private.accounts;
create trigger bry_cleanup_story_votes_on_delete after delete on biryeong_private.accounts
for each row execute function biryeong_private.story_choices_on_account_delete();
revoke all on function biryeong_private.story_choices_on_account_delete() from public, anon, authenticated;

-- 집계 자체도 살아 있는 계정의 현재 선택만 계산. 수정 전 행은 별도 누적하지 않음.
create or replace view public.story_tally with (security_invoker = off) as
select c.branch, c.option, count(*)::int as votes
from public.story_choices c
join biryeong_private.accounts a on a.username = c.account
group by c.branch, c.option;
grant select on public.story_tally to anon, authenticated;

-- 관리자 투표 목록은 집계와 동일한 유효 계정/투표를 사용하고 캐릭터명을 서버에서 제공.
create or replace function public.story_admin_choices(p_code text) returns jsonb
language plpgsql security definer set search_path = pg_catalog, biryeong_private, public as $$
begin
  if not public.story_admin_ok(p_code) then raise exception 'admin code mismatch'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(c) order by c.updated_at desc), '[]'::jsonb)
    from (select v.account, a.display_name as name, v.branch, v.option, v.updated_at, v.player_id, v.edit_count
      from public.story_choices v join biryeong_private.accounts a on a.username=v.account
      order by v.updated_at desc limit 10000) c);
end $$;

-- 관리자만 표 한 건 삭제. 회원이나 다른 분기의 선택까지 지우지 않음.
create or replace function public.story_admin_choice_delete(p_code text, p_account text, p_branch text)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, biryeong_private as $$
declare n int;
begin
  if not public.story_admin_ok(p_code) then raise exception 'admin code mismatch'; end if;
  if coalesce(p_account,'') = '' or length(p_account)>80 or coalesce(p_branch,'') !~ '^[A-Za-z0-9_-]{1,48}$' then
    raise exception 'invalid_value';
  end if;
  insert into biryeong_private.story_choice_exclusions(account, branch) values(p_account,p_branch)
    on conflict(account,branch) do update set deleted_at=now();
  delete from public.story_choices where account=p_account and branch=p_branch;
  get diagnostics n = row_count;
  return jsonb_build_object('ok',true,'deleted',n);
end $$;
-- 이전 버전에서 로컬 기록을 다시 올려도 관리자 삭제 표를 복구하지 못하게 함.
create or replace function public.bry_story_choice(p_token text,p_branch text,p_option smallint)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := biryeong_private.who(p_token); c public.story_choices;
begin
  if coalesce(p_branch,'') !~ '^[A-Za-z0-9_-]{1,48}$' or p_option not between 1 and 12 then
    raise exception 'invalid_value';
  end if;
  perform biryeong_private.throttle_do('choice:'||a.id,30,60);
  if exists (select 1 from biryeong_private.story_choice_exclusions
             where account=a.username and branch=p_branch) then
    return jsonb_build_object('ok',true,'option',p_option,'edit_count',1,'removed_by_admin',true);
  end if;
  insert into public.story_choices(player_id,account,branch,option)
  values(md5('biryeong-choice:'||a.id)::uuid,a.username,p_branch,p_option)
  on conflict do nothing;
  select * into c from public.story_choices where account=a.username and branch=p_branch;
  if not found then raise exception 'choice_not_recorded'; end if;
  return jsonb_build_object('ok',true,'option',c.option,'edit_count',c.edit_count);
end $$;
revoke all on function public.bry_story_choice(text,text,smallint) from public, anon, authenticated;
grant execute on function public.bry_story_choice(text,text,smallint) to anon,authenticated;

revoke all on function public.story_admin_choices(text) from public, anon, authenticated;
revoke all on function public.story_admin_choice_delete(text,text,text) from public, anon, authenticated;
grant execute on function public.story_admin_choices(text), public.story_admin_choice_delete(text,text,text) to anon, authenticated;
commit;
notify pgrst, 'reload schema';
