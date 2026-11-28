-- D.06.12: 도깨비들의 터 일행 호출 종. 기존 데이터 변경/초기화 없음.
create table if not exists biryeong_private.room_bells (
  id bigint generated always as identity primary key,
  room_id bigint not null references biryeong_private.rooms(id) on delete cascade,
  sender text not null,
  name text not null,
  at timestamptz not null default now()
);
create index if not exists room_bells_recent on biryeong_private.room_bells (room_id,id desc);
alter table biryeong_private.room_bells enable row level security;
revoke all on table biryeong_private.room_bells from public, anon, authenticated;
revoke all on sequence biryeong_private.room_bells_id_seq from public, anon, authenticated;

create or replace function public.bry_room_bell(p_token text, p_room bigint) returns jsonb
 language plpgsql security definer set search_path = biryeong_private, public, extensions as $$
declare a biryeong_private.accounts := who(p_token); v_id bigint; v_prev timestamptz;
begin
  if not exists (select 1 from rooms r where r.id = p_room and r.status = 'open'
    and r.members @> jsonb_build_array(jsonb_build_object('u', a.username))) then
    raise exception 'not_found';
  end if;
  perform can_write(a, 'room');
  -- 한 일행에서 동시에 누를 때에도 호출 폭주를 제한한다.
  perform pg_advisory_xact_lock(918, hashtext('room-bell:' || p_room::text));
  select max(at) into v_prev from room_bells where room_id = p_room;
  if v_prev is not null and v_prev > now() - interval '12 seconds' then
    raise exception 'too_many_requests';
  end if;
  if exists (select 1 from room_bells where sender = a.username and at > now() - interval '45 seconds') then
    raise exception 'too_many_requests';
  end if;
  insert into room_bells(room_id, sender, name) values (p_room, a.username, a.display_name) returning id into v_id;
  return jsonb_build_object('ok',true,'id',v_id);
end $$;
revoke all on function public.bry_room_bell(text,bigint) from public;
grant execute on function public.bry_room_bell(text,bigint) to anon, authenticated;

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
    'popup', (select jsonb_build_object('id', pp.id, 'body', pp.body, 'reload', pp.reload, 'at', pp.created_at) from popups pp where pp.until > now() order by pp.id desc limit 1),
    'bell', case when r.id is null then null else
      (select jsonb_build_object('id',b.id,'room',b.room_id,'sender',b.sender,'name',b.name,'at',b.at)
       from room_bells b where b.room_id = r.id order by b.id desc limit 1) end);
end $$;
revoke all on function public.bry_presence(text,bigint) from public;
grant execute on function public.bry_presence(text,bigint) to anon, authenticated;
notify pgrst, 'reload schema';
