-- Fix RLS policy for songs table to work with users table instead of profiles
DROP POLICY IF EXISTS "Users can upload songs" ON songs;
DROP POLICY IF EXISTS "Users can update own songs" ON songs;
DROP POLICY IF EXISTS "Users can delete own songs" ON songs;

-- Create new policies that reference users table
CREATE POLICY "Users can upload songs"
  ON songs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own songs"
  ON songs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own songs"
  ON songs FOR DELETE
  USING (auth.uid() = user_id);

-- Ensure users table has proper RLS policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY IF NOT EXISTS "Public users are viewable by everyone"
  ON users FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS "Users can insert their own user record"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Users can update own user record"
  ON users FOR UPDATE
  USING (auth.uid() = id);
