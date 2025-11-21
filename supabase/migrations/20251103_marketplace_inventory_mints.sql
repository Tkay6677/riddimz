-- Add inventory_mints to marketplace_listings and a SECURITY DEFINER RPC
-- to atomically append buyer, consume one inventory mint, and toggle active.

DO $$
BEGIN
  -- Add inventory_mints column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'marketplace_listings' AND column_name = 'inventory_mints'
  ) THEN
    ALTER TABLE public.marketplace_listings ADD COLUMN inventory_mints text[] DEFAULT '{}'::text[];
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.marketplace_purchase_with_inventory(
  listing_id uuid,
  buyer_address text,
  consumed_mint text
)
RETURNS TABLE(updated boolean, sold_count integer, is_active boolean, remaining_inventory integer) AS $$
DECLARE current_count integer;
DECLARE total_supply integer;
DECLARE inv_count integer;
BEGIN
  -- Lock the listing row
  SELECT COALESCE(array_length(minted_addresses, 1), 0), supply, COALESCE(array_length(inventory_mints, 1), 0)
    INTO current_count, total_supply, inv_count
  FROM public.marketplace_listings
  WHERE id = listing_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, false, 0;
    RETURN;
  END IF;

  -- If already sold out or no inventory, do not update
  IF current_count >= total_supply OR inv_count = 0 THEN
    RETURN QUERY SELECT false, current_count, false, inv_count;
    RETURN;
  END IF;

  -- Consume the provided inventory mint if present
  UPDATE public.marketplace_listings
    SET inventory_mints = CASE 
      WHEN consumed_mint IS NOT NULL THEN array_remove(inventory_mints, consumed_mint)
      ELSE inventory_mints
    END,
        minted_addresses = array_append(minted_addresses, buyer_address),
        updated_at = now(),
        active = CASE 
          WHEN (COALESCE(array_length(minted_addresses, 1), 0) + 1) >= supply OR 
               (CASE WHEN consumed_mint IS NOT NULL THEN (COALESCE(array_length(inventory_mints, 1), 0) - 1) ELSE COALESCE(array_length(inventory_mints, 1), 0) END) = 0
          THEN false ELSE active END
    WHERE id = listing_id;

  SELECT COALESCE(array_length(minted_addresses, 1), 0), active, COALESCE(array_length(inventory_mints, 1), 0)
    INTO current_count, is_active, inv_count
  FROM public.marketplace_listings
  WHERE id = listing_id;

  RETURN QUERY SELECT true, current_count, is_active, inv_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.marketplace_purchase_with_inventory(uuid, text, text) TO anon, authenticated;