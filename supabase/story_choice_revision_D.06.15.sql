-- 비령 D.06.15: 과거 선택 복구 + 분기당 선택 변경 딱 1회.
-- SQL Editor에서 운영 DB에 1회 적용. 재실행 시에도 수정 횟수는 초기화되지 않음.
begin;
alter table public.story_choices add column if not exists edit_count smallint not null default 0;
alter table public.story_choices drop constraint if exists story_choices_edit_count_check;
alter table public.story_choices add constraint story_choices_edit_count_check check (edit_count between 0 and 1);
-- 기존 공개 집계는 story_choices의 현재 행만 집계하기 때문에 수정 전 표가 누적되지 않음.
-- 보안 처리: 누구나 테이블에 직접 수정할 수 없고 인증 RPC만 허용.
revoke insert, update, delete on public.story_choices from anon, authenticated;
drop policy if exists choices_insert on public.story_choices;
drop policy if exists choices_update on public.story_choices;

-- 복구: 실존하는 계정의 저장본에서만 읽음. sent 우선, q.flags 차선.
-- 기존 서버 기록은 덮어쓰지 않고, 분기당 누락된 항목만 보충.
-- 클라이언트의 과거 버전에서 story.q가 교체된 경우에도 story.sent는 남아 있음.
with recovered as (
  select a.id, a.username, b.key as branch, b.value as raw_option,
    row_number() over(partition by a.id,b.key order by b.priority asc) as rn
  from biryeong_private.saves s
  join biryeong_private.accounts a on a.id=s.account_id
  cross join lateral (
    select k as key, v as value, 0 as priority
      from jsonb_each_text(case when jsonb_typeof(s.data #> '{story,sent}')='object' then s.data #> '{story,sent}' else '{}'::jsonb end) x(k,v)
    union all
    select k,v,1 from jsonb_each_text(case when jsonb_typeof(s.data #> '{story,q,flags}')='object' then s.data #> '{story,q,flags}' else '{}'::jsonb end) x(k,v)
  ) b
  where b.key ~ '^[A-Za-z0-9_-]{1,48}$'
    and b.value ~ '^([1-9]|1[0-2])$'
)
insert into public.story_choices(player_id, account, branch, option)
select md5('biryeong-choice:'||id)::uuid, username, branch, raw_option::smallint
from recovered where rn=1
on conflict do nothing;

-- 초기 버전 public.cloud_saves에만 남아 있던 계정별 기록도 가능한 범위에서 추가 복구.
-- 계정명이 일치하는 실존 저장본만 사용하며 기존 집계 행은 건드리지 않음.
with recovered as (
 select a.id,a.username,x.key,x.value, row_number() over(partition by a.id,x.key order by x.priority) as rn
 from public.cloud_saves cs join biryeong_private.accounts a on cs.account=a.username
 cross join lateral (
   select k as key,v as value,0 as priority
   from jsonb_each_text(case when jsonb_typeof(cs.data #> '{story,sent}')='object' then cs.data #> '{story,sent}' else '{}'::jsonb end) e(k,v)
   union all
   select k,v,1 from jsonb_each_text(case when jsonb_typeof(cs.data #> '{story,q,flags}')='object' then cs.data #> '{story,q,flags}' else '{}'::jsonb end) e(k,v)
 ) x
 where x.key ~ '^[A-Za-z0-9_-]{1,48}$' and x.value ~ '^([1-9]|1[0-2])$'
)
insert into public.story_choices(player_id,account,branch,option)
select md5('biryeong-choice:'||id)::uuid,username,key,value::smallint from recovered where rn=1
on conflict do nothing;

create or replace function public.bry_story_choice(p_token text, p_branch text, p_option smallint) returns jsonb
language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token); c public.story_choices;
begin
  if coalesce(p_branch,'') !~ '^[A-Za-z0-9_-]{1,48}$' or p_option not between 1 and 12 then raise exception 'invalid_value'; end if;
  perform throttle_do('choice:'||a.id, 30, 60);
  insert into public.story_choices(player_id,account,branch,option)
  values(md5('biryeong-choice:'||a.id)::uuid,a.username,p_branch,p_option)
  on conflict do nothing;
  select * into c from public.story_choices where account=a.username and branch=p_branch;
  if not found then raise exception 'choice_not_recorded'; end if;
  return jsonb_build_object('ok',true,'option',c.option,'edit_count',c.edit_count);
end $$;

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
  if coalesce(p_branch,'') !~ '^[A-Za-z0-9_-]{1,48}$' or p_option not between 1 and 12 then raise exception 'invalid_value'; end if;
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
grant execute on function public.bry_story_choice_mine(text), public.bry_story_choice_edit(text,text,smallint) to anon,authenticated;
commit;
