-- Delete inactive karaoke rooms after 10 minutes with no participants
-- Also ensure room status toggles appropriately on join/leave

-- Enable pg_cron (safe if already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Function: delete rooms that have been idle > 10 minutes and have zero participants
CREATE OR REPLACE FUNCTION public.delete_inactive_karaoke_rooms()
RETURNS void AS $$
BEGIN
  -- Delete rooms meeting inactivity criteria
  DELETE FROM public.karaoke_rooms kr
  WHERE kr.status <> 'ended'
    AND COALESCE(kr.current_participants, 0) = 0
    AND (now() - kr.last_activity_at) > INTERVAL '10 minutes';
END;
$$ LANGUAGE plpgsql;

-- Replace previous cron job if exists and schedule this every minute
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'close_inactive_karaoke_rooms_every_minute'
  ) THEN
    PERFORM cron.unschedule('close_inactive_karaoke_rooms_every_minute');
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; -- cron.job might not exist yet
END $$;

SELECT cron.schedule(
  'delete_inactive_karaoke_rooms_every_minute',
  '*/1 * * * *',
  $$SELECT public.delete_inactive_karaoke_rooms();$$
);

GRANT EXECUTE ON FUNCTION public.delete_inactive_karaoke_rooms() TO PUBLIC;

-- Trigger: when a participant joins, mark room active and bump last_activity
CREATE OR REPLACE FUNCTION public.on_room_participant_join()
RETURNS trigger AS $$
BEGIN
  UPDATE public.karaoke_rooms
  SET status = 'active',
      last_activity_at = now()
  WHERE id = NEW.room_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS room_participant_join_set_active ON public.room_participants;
CREATE TRIGGER room_participant_join_set_active
  AFTER INSERT ON public.room_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.on_room_participant_join();

-- Trigger: when a participant leaves, if none remain, mark waiting and bump last_activity
CREATE OR REPLACE FUNCTION public.on_room_participant_leave()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.room_participants rp WHERE rp.room_id = OLD.room_id
  ) THEN
    UPDATE public.karaoke_rooms
    SET status = 'waiting',
        last_activity_at = now()
    WHERE id = OLD.room_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS room_participant_leave_set_waiting ON public.room_participants;
CREATE TRIGGER room_participant_leave_set_waiting
  AFTER DELETE ON public.room_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.on_room_participant_leave();