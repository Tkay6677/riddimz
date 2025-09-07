-- Add play_count field to songs table for artist stats
ALTER TABLE songs 
ADD COLUMN play_count integer DEFAULT 0;
