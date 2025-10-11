-- Prevent rooms from being deleted when the host leaves

-- Drop the existing cleanup trigger and function if they exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'cleanup_room_on_host_leave_trigger'
  ) THEN
    DROP TRIGGER cleanup_room_on_host_leave_trigger ON public.room_participants;
  END IF;
EXCEPTION WHEN undefined_table THEN
  -- room_participants might not exist in some environments
  NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'cleanup_room_on_host_leave'
  ) THEN
    DROP FUNCTION IF EXISTS public.cleanup_room_on_host_leave();
  END IF;
END $$;

-- Optional: We rely on the scheduled job to end rooms after 10 minutes
-- No new trigger is needed. Rooms will remain visible until auto-closed.