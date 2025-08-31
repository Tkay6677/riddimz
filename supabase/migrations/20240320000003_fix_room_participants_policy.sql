-- Drop the problematic policy
drop policy if exists "Room participants are viewable by room members" on room_participants;

-- Create a simpler policy that doesn't cause recursion
create policy "Room participants are viewable by room members"
on room_participants for select
using (
  exists (
    select 1 from karaoke_rooms
    where id = room_participants.room_id
    and (host_id = auth.uid() or not is_private)
  )
); 