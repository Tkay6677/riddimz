import { NextRequest, NextResponse } from 'next/server'
import { SongService } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const genres = await SongService.getPopularGenres()

    return NextResponse.json({
      success: true,
      data: genres
    })
  } catch (error) {
    console.error('Error fetching genres:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch genres' },
      { status: 500 }
    )
  }
}
