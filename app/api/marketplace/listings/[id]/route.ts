import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

// Allow owners to update their listing's active state (e.g., unlist)
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const id = params.id
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const body = await request.json().catch(() => ({}))
    const nextActive: boolean | undefined = body?.active
    if (typeof nextActive !== 'boolean') {
      return NextResponse.json({ error: 'Missing active boolean' }, { status: 400 })
    }

    // Verify ownership: only the seller_user_id can toggle
    const { data: listing, error: listErr } = await supabase
      .from('marketplace_listings')
      .select('id, seller_user_id, active')
      .eq('id', id)
      .maybeSingle()
    if (listErr) throw listErr
    if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    if (listing.seller_user_id !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: update, error: updErr } = await supabase
      .from('marketplace_listings')
      .update({ active: nextActive })
      .eq('id', id)
      .select('id, active')
      .maybeSingle()
    if (updErr) throw updErr

    return NextResponse.json({ success: true, id: update?.id, active: update?.active })
  } catch (error) {
    console.error('Listing PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update listing' }, { status: 500 })
  }
}