-- Create marketplace_listings table to store song sale listings
CREATE TABLE IF NOT EXISTS public.marketplace_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  title text NOT NULL,
  artist text NOT NULL,
  metadata_uri text,
  price_sol numeric NOT NULL CHECK (price_sol > 0),
  supply integer NOT NULL CHECK (supply >= 1),
  minted_addresses text[] NOT NULL DEFAULT '{}',
  seller_wallet_address text NOT NULL,
  seller_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_active_created_at ON public.marketplace_listings (active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_song_id ON public.marketplace_listings (song_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_seller_user_id ON public.marketplace_listings (seller_user_id);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_marketplace_listings_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_marketplace_listings_updated_at ON public.marketplace_listings;
CREATE TRIGGER trg_set_marketplace_listings_updated_at
BEFORE UPDATE ON public.marketplace_listings
FOR EACH ROW EXECUTE FUNCTION public.set_marketplace_listings_updated_at();

-- Enable RLS and basic policies
ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read active listings
CREATE POLICY marketplace_listings_select_active
  ON public.marketplace_listings FOR SELECT
  USING (active = true);

-- Allow authenticated users to insert their own listings
CREATE POLICY marketplace_listings_insert_owner
  ON public.marketplace_listings FOR INSERT
  WITH CHECK (seller_user_id = auth.uid());

-- Allow owners to update their listings
CREATE POLICY marketplace_listings_update_owner
  ON public.marketplace_listings FOR UPDATE
  USING (seller_user_id = auth.uid())
  WITH CHECK (seller_user_id = auth.uid());