-- Add collection support to marketplace_listings table
-- This migration adds a column to store the collection mint address for multi-supply NFT listings

DO $$
BEGIN
  -- Add collection_mint_address column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'marketplace_listings' AND column_name = 'collection_mint_address'
  ) THEN
    ALTER TABLE public.marketplace_listings ADD COLUMN collection_mint_address text;
  END IF;
END
$$;

-- Add comment to explain the column
COMMENT ON COLUMN public.marketplace_listings.collection_mint_address IS 'The mint address of the collection NFT for multi-supply listings (supply > 1)';