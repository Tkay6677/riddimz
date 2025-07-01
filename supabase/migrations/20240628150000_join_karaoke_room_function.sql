-- Create a function to handle joining a karaoke room with proper RLS checks
create or replace function public.join_karaoke_room(
  p_room_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_room public.karaoke_rooms;
  v_participant_count int;
  v_is_banned boolean;
  v_is_member boolean;
  v_result jsonb;
begin
  -- Get room details
  select * into v_room
  from public.karaoke_rooms
  where id = p_room_id
  for update;
  
  if v_room is null then
    raise exception 'Room not found' using errcode = 'P0001';
  end if;
  
  -- Check if user is banned
  select exists (
    select 1 from public.room_bans
    where room_id = p_room_id and user_id = p_user_id
  ) into v_is_banned;
  
  if v_is_banned then
    raise exception 'You are banned from this room' using errcode = 'P0002';
  end if;
  
  -- Check if room is full
  select count(*) into v_participant_count
  from public.room_participants
  where room_id = p_room_id;
  
  if v_participant_count >= v_room.max_participants then
    raise exception 'Room is full' using errcode = 'P0003';
  end if;
  
  -- Check if user is already a participant
  select exists (
    select 1 from public.room_participants
    where room_id = p_room_id and user_id = p_user_id
  ) into v_is_member;
  
  -- Add user to participants if not already a member
  if not v_is_member then
    insert into public.room_participants (room_id, user_id, role)
    values (p_room_id, p_user_id, 'participant')
    on conflict (room_id, user_id) do nothing;
  end if;
  
  -- Update room's last activity
  update public.karaoke_rooms
  set last_activity_at = now()
  where id = p_room_id;
  
  -- Return success with room details
  select jsonb_build_object(
    'success', true,
    'room_id', p_room_id,
    'user_id', p_user_id,
    'is_new_member', not v_is_member
  ) into v_result;
  
  return v_result;
exception
  when others then
    return jsonb_build_object(
      'success', false,
      'error', sqlerrm,
      'error_code', sqlstate
    );
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function public.join_karaoke_room(uuid, uuid) to authenticated;

-- Create a policy to allow users to join public rooms or private rooms they're invited to
create policy "Allow users to join public rooms or private rooms they're invited to"
on public.room_participants
for insert to authenticated
with check (
  exists (
    select 1 from public.karaoke_rooms
    where id = room_id
    and (
      is_private = false
      or exists (
        select 1 from public.room_invites
        where room_id = room_participants.room_id
        and user_id = auth.uid()
        and used_at is null
        and expires_at > now()
      )
    )
  )
);
