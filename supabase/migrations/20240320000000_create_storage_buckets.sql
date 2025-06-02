-- Create storage buckets if they don't exist
insert into storage.buckets (id, name, public)
values ('karaoke-songs', 'karaoke-songs', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('karaoke-tracks', 'karaoke-tracks', true)
on conflict (id) do nothing;

-- Drop existing policies if they exist
drop policy if exists "Allow authenticated users to upload songs" on storage.objects;
drop policy if exists "Allow public to read songs" on storage.objects;
drop policy if exists "Allow users to delete their own songs" on storage.objects;
drop policy if exists "Allow authenticated users to upload tracks" on storage.objects;
drop policy if exists "Allow public to read tracks" on storage.objects;
drop policy if exists "Allow users to delete their own tracks" on storage.objects;

-- Set up RLS policies for karaoke-songs bucket
create policy "Allow authenticated users to upload songs"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'karaoke-songs'
);

create policy "Allow public to read songs"
on storage.objects for select
to public
using (bucket_id = 'karaoke-songs');

create policy "Allow users to delete their own songs"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'karaoke-songs' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Set up RLS policies for karaoke-tracks bucket
create policy "Allow authenticated users to upload tracks"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'karaoke-tracks'
);

create policy "Allow public to read tracks"
on storage.objects for select
to public
using (bucket_id = 'karaoke-tracks');

create policy "Allow users to delete their own tracks"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'karaoke-tracks' AND
  (storage.foldername(name))[1] = auth.uid()::text
); 