-- Fix delete_inactive_karaoke_rooms to avoid relying on non-existent current_participants
-- Use NOT EXISTS on room_participants to determine zero participants

-- Safely create pg_cron extension if not present
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Replace function: delete rooms idle > 10 minutes with zero participants
CREATE OR REPLACE FUNCTION public.delete_inactive_karaoke_rooms()
RETURNS void AS $$
BEGIN
  DELETE FROM public.karaoke_rooms kr
  WHERE kr.status <> 'ended'
    AND NOT EXISTS (
      SELECT 1 FROM public.room_participants rp WHERE rp.room_id = kr.id
    )
    AND (now() - kr.last_activity_at) > INTERVAL '10 minutes';
END;
$$ LANGUAGE plpgsql;

-- Ensure cron job exists and uses the updated function
DO $$
BEGIN
  -- Unschedule older close job if present
  IF EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'close_inactive_karaoke_rooms_every_minute'
  ) THEN
    PERFORM cron.unschedule('close_inactive_karaoke_rooms_every_minute');
  END IF;

  -- Unschedule previous delete job to avoid duplicates
  IF EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'delete_inactive_karaoke_rooms_every_minute'
  ) THEN
    PERFORM cron.unschedule('delete_inactive_karaoke_rooms_every_minute');
  END IF;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

SELECT cron.schedule(
  'delete_inactive_karaoke_rooms_every_minute',
  '*/1 * * * *',
  $$SELECT public.delete_inactive_karaoke_rooms();$$
);

GRANT EXECUTE ON FUNCTION public.delete_inactive_karaoke_rooms() TO PUBLIC;