-- Add current_participants column to karaoke_rooms table
ALTER TABLE karaoke_rooms 
ADD COLUMN current_participants integer DEFAULT 0;

-- Create function to update participant count
CREATE OR REPLACE FUNCTION update_participant_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment participant count when someone joins
    UPDATE karaoke_rooms 
    SET current_participants = current_participants + 1
    WHERE id = NEW.room_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement participant count when someone leaves
    UPDATE karaoke_rooms 
    SET current_participants = GREATEST(0, current_participants - 1)
    WHERE id = OLD.room_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update participant count
CREATE TRIGGER update_participant_count_on_join
  AFTER INSERT ON room_participants
  FOR EACH ROW
  EXECUTE FUNCTION update_participant_count();

CREATE TRIGGER update_participant_count_on_leave
  AFTER DELETE ON room_participants
  FOR EACH ROW
  EXECUTE FUNCTION update_participant_count();

-- Update existing rooms to have correct participant counts
UPDATE karaoke_rooms 
SET current_participants = (
  SELECT COUNT(*) 
  FROM room_participants 
  WHERE room_participants.room_id = karaoke_rooms.id
);

-- Create function to handle room cleanup when host leaves
CREATE OR REPLACE FUNCTION cleanup_room_on_host_leave()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the leaving participant is the host
  IF EXISTS (
    SELECT 1 FROM karaoke_rooms 
    WHERE id = OLD.room_id 
    AND host_id = OLD.user_id
  ) THEN
    -- Delete the room if host leaves
    DELETE FROM karaoke_rooms WHERE id = OLD.room_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for host leave cleanup
CREATE TRIGGER cleanup_room_on_host_leave_trigger
  AFTER DELETE ON room_participants
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_room_on_host_leave();
