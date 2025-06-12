-- Drop the problematic policy
drop policy if exists "Public rooms are viewable by everyone" on karaoke_rooms;

-- Create a simpler policy that doesn't cause recursion
create policy "Public rooms are viewable by everyone"
on karaoke_rooms for select
using (
  not is_private or 
  host_id = auth.uid()
); 