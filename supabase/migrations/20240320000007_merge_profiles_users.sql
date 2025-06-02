-- First, ensure all necessary columns exist in the users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;

-- Copy any missing data from profiles to users
INSERT INTO users (id, username, avatar_url, created_at, updated_at)
SELECT 
    p.id,
    p.username,
    p.avatar_url,
    p.created_at,
    p.updated_at
FROM profiles p
ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    avatar_url = EXCLUDED.avatar_url,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at;

-- Update foreign key references in songs table
ALTER TABLE songs
DROP CONSTRAINT IF EXISTS songs_user_id_fkey;

ALTER TABLE songs
ADD CONSTRAINT songs_user_id_fkey
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Update foreign key references in karaoke_rooms table
ALTER TABLE karaoke_rooms
DROP CONSTRAINT IF EXISTS karaoke_rooms_host_id_fkey;

ALTER TABLE karaoke_rooms
ADD CONSTRAINT karaoke_rooms_host_id_fkey
FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE CASCADE;

-- Update foreign key references in room_participants table
ALTER TABLE room_participants
DROP CONSTRAINT IF EXISTS room_participants_user_id_fkey;

ALTER TABLE room_participants
ADD CONSTRAINT room_participants_user_id_fkey
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Update foreign key references in queue_items table
ALTER TABLE queue_items
DROP CONSTRAINT IF EXISTS queue_items_user_id_fkey;

ALTER TABLE queue_items
ADD CONSTRAINT queue_items_user_id_fkey
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Drop the profiles table
DROP TABLE IF EXISTS profiles;

-- Update the handle_new_user trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, username, avatar_url, created_at, updated_at)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'username',
        NEW.raw_user_meta_data->>'avatar_url',
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        username = EXCLUDED.username,
        avatar_url = EXCLUDED.avatar_url,
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 