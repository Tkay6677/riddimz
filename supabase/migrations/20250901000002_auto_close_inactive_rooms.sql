-- Automatically close inactive karaoke rooms after 10 minutes with no participants
-- Enables pg_cron, defines cleanup function, and schedules it to run every minute

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Function to end inactive rooms
CREATE OR REPLACE FUNCTION public.close_inactive_karaoke_rooms()
RETURNS void AS $$
BEGIN
  -- End rooms that have no participants and have been inactive for > 10 minutes
  UPDATE public.karaoke_rooms
  SET status = 'ended',
      is_live = false
  WHERE status <> 'ended'
    AND COALESCE(current_participants, 0) = 0
    AND (now() - last_activity_at) > INTERVAL '10 minutes';
END;
$$ LANGUAGE plpgsql;

-- Schedule the cleanup to run every minute
-- Note: This requires pg_cron to be available on the database
SELECT cron.schedule(
  'close_inactive_karaoke_rooms_every_minute',
  '*/1 * * * *',
  $$SELECT public.close_inactive_karaoke_rooms();$$
);

-- Optional: make sure function is callable
GRANT EXECUTE ON FUNCTION public.close_inactive_karaoke_rooms() TO PUBLIC;