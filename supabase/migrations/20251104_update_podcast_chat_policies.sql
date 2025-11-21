-- Update policies to allow public read access for podcast chat history
-- This ensures anonymous listeners can see messages sent by authenticated users

-- Drop prior authenticated-only SELECT policy if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'podcast_chat_messages'
      AND policyname = 'podcast_chat_messages_select_authenticated'
  ) THEN
    EXECUTE 'DROP POLICY podcast_chat_messages_select_authenticated ON public.podcast_chat_messages';
  END IF;
END$$;

-- Create a public SELECT policy so anyone can read chat messages
CREATE POLICY podcast_chat_messages_select_public
  ON public.podcast_chat_messages FOR SELECT
  USING (true);

-- Keep insert restricted to the message author (already defined in previous migration)
-- No changes to INSERT policy here