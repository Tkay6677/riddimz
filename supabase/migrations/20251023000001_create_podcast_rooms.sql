-- Create podcast_rooms table if it doesn't exist
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.podcast_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NULL,
  host_id uuid NULL,
  cover_image text NULL,
  is_live boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Basic index for ordering
CREATE INDEX IF NOT EXISTS idx_podcast_rooms_created_at ON public.podcast_rooms (created_at DESC);

-- Optional host index
CREATE INDEX IF NOT EXISTS idx_podcast_rooms_host_id ON public.podcast_rooms (host_id);

-- Note: Add foreign key constraint to users if applicable in your schema
-- ALTER TABLE public.podcast_rooms
--   ADD CONSTRAINT podcast_rooms_host_fkey FOREIGN KEY (host_id)
--   REFERENCES public.users(id) ON DELETE SET NULL;