import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data, error } = await supabase
      .from('marketplace_listings')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(60)
    if (error) throw error

    const listings = (data || []).map((d: any) => ({
      id: d.id,
      songId: d.song_id,
      title: d.title,
      artist: d.artist,
      metadataUri: d.metadata_uri,
      priceSol: d.price_sol,
      supply: d.supply,
      mintedAddresses: d.minted_addresses || [],
      collectionMintAddress: d.collection_mint_address || null,
      sellerWalletAddress: d.seller_wallet_address,
      sellerUserId: d.seller_user_id,
      active: d.active,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
      soldCount: (d.minted_addresses || []).length,
      available: Math.max(0, d.supply - ((d.minted_addresses || []).length)),
    }))

    return NextResponse.json({ listings })
  } catch (error) {
    console.error('Listings GET error:', error)
    const code = (error as any)?.code
    const message = (error as any)?.message || String(error)
    if (code === '42P01' || /relation .* does not exist/i.test(message)) {
      // Table not created yet — return empty to avoid breaking UI
      return NextResponse.json({ listings: [], warning: 'marketplace_listings table not found' })
    }
    if (code === '42501' || /permission denied/i.test(message) || /row level security/i.test(message)) {
      // RLS blocking read — return empty with warning
      return NextResponse.json({ listings: [], warning: 'RLS denies SELECT on marketplace_listings' })
    }
    return NextResponse.json({ error: 'Failed to fetch listings' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      songId,
      priceSol,
      supply,
      mintedAddresses = [],
      inventoryMintAddresses = [],
      collectionMintAddress,
      metadataUri,
      title,
      artist,
      sellerWalletAddress,
    } = body || {}

    if (!songId || !title || !artist || !sellerWalletAddress) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (typeof priceSol !== 'number' || priceSol <= 0) {
      return NextResponse.json({ error: 'Invalid price' }, { status: 400 })
    }
    if (typeof supply !== 'number' || supply < 1) {
      return NextResponse.json({ error: 'Invalid supply' }, { status: 400 })
    }

    // Verify the song belongs to the current user
    const { data: song, error: songErr } = await supabase
      .from('songs')
      .select('id, user_id')
      .eq('id', songId)
      .single()
    if (songErr) {
      return NextResponse.json({ error: 'Song validation failed' }, { status: 400 })
    }
    if (!song || song.user_id !== session.user.id) {
      return NextResponse.json({ error: 'You can only list your own song' }, { status: 403 })
    }

    // Check if the schema has 'inventory_mints' and 'collection_mint_address' and fall back gracefully if not
    const { error: invColErr } = await supabase
      .from('marketplace_listings')
      .select('inventory_mints')
      .limit(1)
      .maybeSingle()

    const { error: collColErr } = await supabase
      .from('marketplace_listings')
      .select('collection_mint_address')
      .limit(1)
      .maybeSingle()

    const supportsInventory = !invColErr || invColErr.code !== 'PGRST204'
    const supportsCollection = !collColErr || collColErr.code !== 'PGRST204'

    const insertPayload: any = {
      song_id: songId,
      title,
      artist,
      metadata_uri: metadataUri || null,
      price_sol: priceSol,
      supply,
      minted_addresses: mintedAddresses,
      seller_wallet_address: sellerWalletAddress,
      seller_user_id: session.user.id,
      active: true,
    }
    if (supportsInventory) {
      insertPayload.inventory_mints = inventoryMintAddresses
    }
    if (supportsCollection && collectionMintAddress) {
      insertPayload.collection_mint_address = collectionMintAddress
    }

    const { data: insert, error: insertErr } = await supabase
      .from('marketplace_listings')
      .insert(insertPayload)
      .select('id')
      .single()
    if (insertErr) throw insertErr

    return NextResponse.json({ id: insert.id })
  } catch (error) {
    console.error('Listings POST error:', error)
    return NextResponse.json({ error: 'Failed to create listing' }, { status: 500 })
  }
}