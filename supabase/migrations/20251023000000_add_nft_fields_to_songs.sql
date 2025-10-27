-- Add NFT metadata fields to songs table if not existing
DO $$
BEGIN
  -- Add nft_metadata_uri column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'songs' AND column_name = 'nft_metadata_uri'
  ) THEN
    ALTER TABLE public.songs ADD COLUMN nft_metadata_uri text;
  END IF;

  -- Add nft_mint_address column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'songs' AND column_name = 'nft_mint_address'
  ) THEN
    ALTER TABLE public.songs ADD COLUMN nft_mint_address text;
  END IF;
END
$$;