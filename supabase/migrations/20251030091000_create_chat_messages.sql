-- Create chat_messages table for karaoke room chats
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.karaoke_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id ON public.chat_messages (room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id_created_at ON public.chat_messages (room_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Policies
-- Allow authenticated users to read chat messages
CREATE POLICY chat_messages_select_authenticated
  ON public.chat_messages FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Allow authenticated users to insert messages for themselves
CREATE POLICY chat_messages_insert_self
  ON public.chat_messages FOR INSERT
  WITH CHECK (user_id = auth.uid());