import { NextRequest, NextResponse } from 'next/server'
import { UserInteractionService } from '@/lib/database'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { songId, type, metadata } = body

    if (!songId || !type) {
      return NextResponse.json(
        { success: false, error: 'songId and type are required' },
        { status: 400 }
      )
    }

    const interaction = await UserInteractionService.recordInteraction({
      userId: user.id,
      songId,
      type,
      metadata
    })

    return NextResponse.json({
      success: true,
      data: interaction
    })
  } catch (error) {
    console.error('Error recording interaction:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to record interaction' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const limit = parseInt(searchParams.get('limit') || '20')

    let result: any[] = []

    if (type === 'favorites') {
      result = await UserInteractionService.getUserFavorites(user.id, limit)
    } else if (type === 'recent') {
      result = await UserInteractionService.getUserRecentlyPlayed(user.id, limit)
    }

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('Error fetching interactions:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch interactions' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const songId = searchParams.get('songId')
    const type = searchParams.get('type')

    if (!songId || type !== 'favorite') {
      return NextResponse.json(
        { success: false, error: 'Invalid parameters' },
        { status: 400 }
      )
    }

    const success = await UserInteractionService.removeFavorite(user.id, songId)

    return NextResponse.json({
      success,
      message: success ? 'Favorite removed' : 'Favorite not found'
    })
  } catch (error) {
    console.error('Error removing favorite:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to remove favorite' },
      { status: 500 }
    )
  }
}
