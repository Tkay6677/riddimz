-- Atomic purchase function for marketplace listings
-- App verifies on-chain payment separately, then calls this function to append buyer address
-- and deactivate when supply is exhausted.

CREATE OR REPLACE FUNCTION public.marketplace_purchase(listing_id uuid, buyer_address text)
RETURNS TABLE(updated boolean, sold_count integer, is_active boolean) AS $$
DECLARE current_count integer;
DECLARE total_supply integer;
BEGIN
  -- Lock the listing row to prevent race conditions
  SELECT COALESCE(array_length(minted_addresses, 1), 0), supply
    INTO current_count, total_supply
  FROM public.marketplace_listings
  WHERE id = listing_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, false;
    RETURN;
  END IF;

  -- If already sold out, do not update
  IF current_count >= total_supply THEN
    RETURN QUERY SELECT false, current_count, false;
    RETURN;
  END IF;

  -- Append buyer address and update active flag when sold out
  UPDATE public.marketplace_listings
    SET minted_addresses = array_append(minted_addresses, buyer_address),
        updated_at = now(),
        active = CASE WHEN (COALESCE(array_length(minted_addresses, 1), 0) + 1) >= supply THEN false ELSE active END
    WHERE id = listing_id;

  SELECT COALESCE(array_length(minted_addresses, 1), 0), active
    INTO current_count, is_active
  FROM public.marketplace_listings
  WHERE id = listing_id;

  RETURN QUERY SELECT true, current_count, is_active;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Allow anon/auth roles to execute the function (logic inside guards state)
GRANT EXECUTE ON FUNCTION public.marketplace_purchase(uuid, text) TO anon, authenticated;