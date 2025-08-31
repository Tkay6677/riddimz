-- Enable RLS on karaoke_rooms table
alter table karaoke_rooms enable row level security;

-- Create policies for karaoke_rooms
create policy "Allow authenticated users to create rooms"
on karaoke_rooms for insert
to authenticated
with check (auth.uid() = host_id);

create policy "Allow public to view active rooms"
on karaoke_rooms for select
to public
using (status = 'active');

create policy "Allow room host to update their rooms"
on karaoke_rooms for update
to authenticated
using (auth.uid() = host_id);

create policy "Allow room host to delete their rooms"
on karaoke_rooms for delete
to authenticated
using (auth.uid() = host_id);

-- Enable RLS on room_participants table
alter table room_participants enable row level security;

-- Create policies for room_participants
create policy "Allow authenticated users to join rooms"
on room_participants for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Allow users to view room participants"
on room_participants for select
to public
using (true);

create policy "Allow users to leave rooms"
on room_participants for delete
to authenticated
using (auth.uid() = user_id); 