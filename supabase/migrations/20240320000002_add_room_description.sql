-- Add missing columns to karaoke_rooms table
alter table karaoke_rooms
add column if not exists description text,
add column if not exists is_live boolean default true,
add column if not exists is_nft_only boolean default false,
add column if not exists song_url text,
add column if not exists lyrics_url text; 