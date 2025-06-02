-- Add new columns to songs table
ALTER TABLE songs
ADD COLUMN IF NOT EXISTS genre TEXT,
ADD COLUMN IF NOT EXISTS is_nft BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS play_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS trending_score FLOAT DEFAULT 0;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_songs_genre ON songs(genre);
CREATE INDEX IF NOT EXISTS idx_songs_trending ON songs(trending_score DESC);
CREATE INDEX IF NOT EXISTS idx_songs_created_at ON songs(created_at DESC);

-- Create function to update trending score
CREATE OR REPLACE FUNCTION update_trending_score()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate trending score based on play count, likes, and recency
    NEW.trending_score = (
        NEW.play_count * 0.5 + 
        NEW.likes_count * 0.3 + 
        EXTRACT(EPOCH FROM (now() - NEW.created_at)) * 0.2
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update trending score
DROP TRIGGER IF EXISTS update_song_trending ON songs;
CREATE TRIGGER update_song_trending
    BEFORE INSERT OR UPDATE OF play_count, likes_count
    ON songs
    FOR EACH ROW
    EXECUTE FUNCTION update_trending_score(); 