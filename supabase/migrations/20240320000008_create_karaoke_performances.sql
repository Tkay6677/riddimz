-- Create karaoke_performances table
CREATE TABLE IF NOT EXISTS karaoke_performances (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    song_id UUID REFERENCES songs(id) ON DELETE CASCADE NOT NULL,
    room_id UUID REFERENCES karaoke_rooms(id) ON DELETE CASCADE NOT NULL,
    duration INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE karaoke_performances ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own performances"
    ON karaoke_performances FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own performances"
    ON karaoke_performances FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_karaoke_performances_user_id ON karaoke_performances(user_id);
CREATE INDEX IF NOT EXISTS idx_karaoke_performances_created_at ON karaoke_performances(created_at DESC); 