-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated users to create rooms" ON karaoke_rooms;
DROP POLICY IF EXISTS "Allow public to view active rooms" ON karaoke_rooms;
DROP POLICY IF EXISTS "Allow room host to update their rooms" ON karaoke_rooms;
DROP POLICY IF EXISTS "Allow room host to delete their rooms" ON karaoke_rooms;

-- Create new policies for karaoke_rooms
CREATE POLICY "Enable read access for authenticated users"
ON karaoke_rooms FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Enable insert for authenticated users"
ON karaoke_rooms FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Enable update for room hosts"
ON karaoke_rooms FOR UPDATE
TO authenticated
USING (auth.uid() = host_id);

CREATE POLICY "Enable delete for room hosts"
ON karaoke_rooms FOR DELETE
TO authenticated
USING (auth.uid() = host_id);

-- Drop existing policies for room_settings
DROP POLICY IF EXISTS "Room settings are viewable by room members" ON room_settings;
DROP POLICY IF EXISTS "Only room host can update settings" ON room_settings;

-- Create new policies for room_settings
CREATE POLICY "Enable read access for room members"
ON room_settings FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM karaoke_rooms
    WHERE id = room_settings.room_id
    AND (
      host_id = auth.uid() 
      OR EXISTS (
        SELECT 1 FROM room_participants
        WHERE room_id = room_settings.room_id
        AND user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Enable insert for room hosts"
ON room_settings FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM karaoke_rooms
    WHERE id = room_settings.room_id
    AND host_id = auth.uid()
  )
);

CREATE POLICY "Enable update for room hosts"
ON room_settings FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM karaoke_rooms
    WHERE id = room_settings.room_id
    AND host_id = auth.uid()
  )
);

-- Enable RLS on both tables if not already enabled
ALTER TABLE karaoke_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_settings ENABLE ROW LEVEL SECURITY; 