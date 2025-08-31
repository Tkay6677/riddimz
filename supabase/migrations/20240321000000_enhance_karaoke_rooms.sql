-- Add new columns to karaoke_rooms table
ALTER TABLE karaoke_rooms
ADD COLUMN IF NOT EXISTS max_participants integer DEFAULT 10,
ADD COLUMN IF NOT EXISTS status text CHECK (status IN ('waiting', 'active', 'ended')) DEFAULT 'waiting',
ADD COLUMN IF NOT EXISTS theme text,
ADD COLUMN IF NOT EXISTS language text,
ADD COLUMN IF NOT EXISTS difficulty_level text CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')) DEFAULT 'intermediate',
ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS password text,
ADD COLUMN IF NOT EXISTS last_activity_at timestamptz DEFAULT now();

-- Create a function to update last_activity_at
CREATE OR REPLACE FUNCTION update_room_last_activity()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_activity_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update last_activity_at
CREATE TRIGGER update_room_last_activity
    BEFORE UPDATE ON karaoke_rooms
    FOR EACH ROW
    EXECUTE FUNCTION update_room_last_activity();

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_karaoke_rooms_status ON karaoke_rooms(status);
CREATE INDEX IF NOT EXISTS idx_karaoke_rooms_last_activity ON karaoke_rooms(last_activity_at DESC);

-- Add new columns to room_participants table
ALTER TABLE room_participants
ADD COLUMN IF NOT EXISTS is_muted boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_speaking boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS last_speak_at timestamptz;

-- Create a function to update last_speak_at
CREATE OR REPLACE FUNCTION update_participant_last_speak()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_speaking = true THEN
        NEW.last_speak_at = now();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update last_speak_at
CREATE TRIGGER update_participant_last_speak
    BEFORE UPDATE ON room_participants
    FOR EACH ROW
    EXECUTE FUNCTION update_participant_last_speak();

-- Add new table for room settings
CREATE TABLE IF NOT EXISTS room_settings (
    room_id uuid PRIMARY KEY REFERENCES karaoke_rooms(id) ON DELETE CASCADE,
    enable_chat boolean DEFAULT true,
    enable_voice boolean DEFAULT true,
    enable_video boolean DEFAULT false,
    enable_screen_sharing boolean DEFAULT false,
    enable_lyrics boolean DEFAULT true,
    enable_scoring boolean DEFAULT true,
    min_score_to_join integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS on room_settings
ALTER TABLE room_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for room_settings
CREATE POLICY "Room settings are viewable by room members"
    ON room_settings FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM karaoke_rooms
        WHERE id = room_settings.room_id
        AND (host_id = auth.uid() OR EXISTS (
            SELECT 1 FROM room_participants
            WHERE room_id = room_settings.room_id
            AND user_id = auth.uid()
        ))
    ));

CREATE POLICY "Only room host can update settings"
    ON room_settings FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM karaoke_rooms
        WHERE id = room_settings.room_id
        AND host_id = auth.uid()
    ));

-- Create function to initialize room settings
CREATE OR REPLACE FUNCTION initialize_room_settings()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO room_settings (room_id)
    VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to initialize room settings
CREATE TRIGGER initialize_room_settings
    AFTER INSERT ON karaoke_rooms
    FOR EACH ROW
    EXECUTE FUNCTION initialize_room_settings(); 