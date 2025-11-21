-- Allow anonymous (non-auth) users to persist chat messages
-- Make user_id nullable and update INSERT policy so:
--  - Auth users must insert their own user_id
--  - Anonymous users must insert user_id = NULL

-- Make user_id nullable if currently NOT NULL
ALTER TABLE public.podcast_chat_messages
  ALTER COLUMN user_id DROP NOT NULL;

-- Update INSERT policy to support both auth and anon users
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'podcast_chat_messages'
      AND policyname = 'podcast_chat_messages_insert_self'
  ) THEN
    EXECUTE 'DROP POLICY podcast_chat_messages_insert_self ON public.podcast_chat_messages';
  END IF;
END$$;

CREATE POLICY podcast_chat_messages_insert_auth_or_anon
  ON public.podcast_chat_messages FOR INSERT
  WITH CHECK (
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR (auth.uid() IS NULL AND user_id IS NULL)
  );