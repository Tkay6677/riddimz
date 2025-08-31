-- Create profiles table
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create songs table
create table songs (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  artist text not null,
  duration integer not null,
  audio_url text not null,
  cover_art_url text,
  user_id uuid references profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create karaoke_tracks table
create table karaoke_tracks (
  id uuid default uuid_generate_v4() primary key,
  song_id uuid references songs(id) on delete cascade not null,
  instrumental_url text not null,
  lyrics_data jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create karaoke_rooms table
create table karaoke_rooms (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  host_id uuid references profiles(id) on delete cascade not null,
  is_private boolean default false,
  password text,
  max_participants integer default 10,
  current_track_id uuid references karaoke_tracks(id),
  status text check (status in ('waiting', 'active', 'ended')) default 'waiting',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create room_participants table
create table room_participants (
  room_id uuid references karaoke_rooms(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  role text check (role in ('host', 'participant')) default 'participant',
  primary key (room_id, user_id)
);

-- Create queue table
create table queue_items (
  id uuid default uuid_generate_v4() primary key,
  room_id uuid references karaoke_rooms(id) on delete cascade,
  track_id uuid references karaoke_tracks(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  position integer not null,
  status text check (status in ('pending', 'current', 'completed')) default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (room_id, position)
);

-- Create RLS policies
alter table profiles enable row level security;
alter table songs enable row level security;
alter table karaoke_tracks enable row level security;
alter table karaoke_rooms enable row level security;
alter table room_participants enable row level security;
alter table queue_items enable row level security;

-- Profiles policies
create policy "Public profiles are viewable by everyone"
  on profiles for select
  using (true);

create policy "Users can insert their own profile"
  on profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- Songs policies
create policy "Songs are viewable by everyone"
  on songs for select
  using (true);

create policy "Users can upload songs"
  on songs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own songs"
  on songs for update
  using (auth.uid() = user_id);

create policy "Users can delete own songs"
  on songs for delete
  using (auth.uid() = user_id);

-- Karaoke tracks policies
create policy "Karaoke tracks are viewable by everyone"
  on karaoke_tracks for select
  using (true);

create policy "Users can create karaoke tracks for their songs"
  on karaoke_tracks for insert
  with check (exists (
    select 1 from songs
    where id = karaoke_tracks.song_id
    and user_id = auth.uid()
  ));

-- Karaoke rooms policies
create policy "Public rooms are viewable by everyone"
  on karaoke_rooms for select
  using (not is_private or host_id = auth.uid() or exists (
    select 1 from room_participants
    where room_id = karaoke_rooms.id
    and user_id = auth.uid()
  ));

create policy "Users can create rooms"
  on karaoke_rooms for insert
  with check (auth.uid() = host_id);

create policy "Hosts can update their rooms"
  on karaoke_rooms for update
  using (auth.uid() = host_id);

-- Room participants policies
create policy "Room participants are viewable by room members"
  on room_participants for select
  using (exists (
    select 1 from karaoke_rooms
    where id = room_participants.room_id
    and (host_id = auth.uid() or exists (
      select 1 from room_participants rp
      where rp.room_id = room_participants.room_id
      and rp.user_id = auth.uid()
    ))
  ));

create policy "Users can join rooms"
  on room_participants for insert
  with check (auth.uid() = user_id);

-- Queue items policies
create policy "Queue items are viewable by room members"
  on queue_items for select
  using (exists (
    select 1 from karaoke_rooms
    where id = queue_items.room_id
    and (host_id = auth.uid() or exists (
      select 1 from room_participants
      where room_id = queue_items.room_id
      and user_id = auth.uid()
    ))
  ));

create policy "Room members can add to queue"
  on queue_items for insert
  with check (exists (
    select 1 from room_participants
    where room_id = queue_items.room_id
    and user_id = auth.uid()
  ));

-- Functions
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data->>'username');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user creation
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user(); 