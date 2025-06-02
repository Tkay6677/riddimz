-- Create a public users table
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    username TEXT,
    avatar_url TEXT
);

-- Populate public.users with existing auth.users
INSERT INTO public.users (id, email, username, avatar_url)
SELECT 
    id,
    email,
    raw_user_meta_data->>'username',
    raw_user_meta_data->>'avatar_url'
FROM auth.users
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    username = EXCLUDED.username,
    avatar_url = EXCLUDED.avatar_url;

-- Create a trigger to keep the public users table in sync with auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, username, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'username',
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        username = EXCLUDED.username,
        avatar_url = EXCLUDED.avatar_url;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Fix foreign key relationships
ALTER TABLE karaoke_rooms
DROP CONSTRAINT IF EXISTS karaoke_rooms_host_id_fkey,
DROP CONSTRAINT IF EXISTS karaoke_rooms_current_song_id_fkey;

-- Add current_song_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'karaoke_rooms' 
        AND column_name = 'current_song_id'
    ) THEN
        ALTER TABLE karaoke_rooms ADD COLUMN current_song_id UUID;
    END IF;
END $$;

ALTER TABLE karaoke_rooms
ADD CONSTRAINT karaoke_rooms_host_id_fkey 
FOREIGN KEY (host_id) 
REFERENCES public.users(id) 
ON DELETE CASCADE;

ALTER TABLE karaoke_rooms
ADD CONSTRAINT karaoke_rooms_current_song_id_fkey 
FOREIGN KEY (current_song_id) 
REFERENCES songs(id) 
ON DELETE SET NULL;

-- Fix room_participants foreign keys
ALTER TABLE room_participants
DROP CONSTRAINT IF EXISTS room_participants_room_id_fkey,
DROP CONSTRAINT IF EXISTS room_participants_user_id_fkey;

ALTER TABLE room_participants
ADD CONSTRAINT room_participants_room_id_fkey 
FOREIGN KEY (room_id) 
REFERENCES karaoke_rooms(id) 
ON DELETE CASCADE;

ALTER TABLE room_participants
ADD CONSTRAINT room_participants_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.users(id) 
ON DELETE CASCADE;

-- Drop existing policies
DROP POLICY IF EXISTS "Room participants are viewable by room members" ON room_participants;
DROP POLICY IF EXISTS "Users can join rooms" ON room_participants;
DROP POLICY IF EXISTS "Users can leave rooms" ON room_participants;

-- Add RLS policies for room_participants
ALTER TABLE room_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Room participants are viewable by room members"
ON room_participants
FOR SELECT
USING (true);

CREATE POLICY "Users can join rooms"
ON room_participants
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave rooms"
ON room_participants
FOR DELETE
USING (auth.uid() = user_id); 