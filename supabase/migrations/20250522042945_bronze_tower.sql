/*
  # Initial Schema Setup for Riddimz

  1. New Tables
    - users
      - id (uuid, primary key)
      - wallet_address (text, unique)
      - username (text)
      - avatar_url (text)
      - created_at (timestamp)
      
    - songs
      - id (uuid, primary key)
      - title (text)
      - artist (text)
      - cover_url (text)
      - audio_url (text)
      - is_nft (boolean)
      - created_at (timestamp)
      - user_id (uuid, foreign key)
      
    - karaoke_rooms
      - id (uuid, primary key)
      - name (text)
      - host_id (uuid, foreign key)
      - is_live (boolean)
      - is_nft_only (boolean)
      - current_song_id (uuid, foreign key)
      - created_at (timestamp)
      
    - room_participants
      - room_id (uuid, foreign key)
      - user_id (uuid, foreign key)
      - joined_at (timestamp)
      
    - chat_messages
      - id (uuid, primary key)
      - room_id (uuid, foreign key)
      - user_id (uuid, foreign key)
      - content (text)
      - created_at (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text UNIQUE,
  username text,
  avatar_url text,
  created_at timestamptz DEFAULT now()
);

-- Create songs table
CREATE TABLE IF NOT EXISTS songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  artist text NOT NULL,
  cover_url text,
  audio_url text NOT NULL,
  is_nft boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE
);

-- Create karaoke rooms table
CREATE TABLE IF NOT EXISTS karaoke_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  host_id uuid REFERENCES users(id) ON DELETE CASCADE,
  is_live boolean DEFAULT true,
  is_nft_only boolean DEFAULT false,
  current_song_id uuid REFERENCES songs(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Create room participants table
CREATE TABLE IF NOT EXISTS room_participants (
  room_id uuid REFERENCES karaoke_rooms(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);

-- Create chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES karaoke_rooms(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE karaoke_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can read all users"
  ON users FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Songs policies
CREATE POLICY "Anyone can read songs"
  ON songs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create songs"
  ON songs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own songs"
  ON songs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Karaoke rooms policies
CREATE POLICY "Anyone can read rooms"
  ON karaoke_rooms FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create rooms"
  ON karaoke_rooms FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Hosts can update their rooms"
  ON karaoke_rooms FOR UPDATE
  TO authenticated
  USING (auth.uid() = host_id);

-- Room participants policies
CREATE POLICY "Anyone can read room participants"
  ON room_participants FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can join rooms"
  ON room_participants FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave rooms"
  ON room_participants FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Chat messages policies
CREATE POLICY "Anyone can read chat messages"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create chat messages"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);