import { NextRequest, NextResponse } from 'next/server'
import { SongService, HybridService } from '@/lib/database'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()
    
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'trending'
    const limit = parseInt(searchParams.get('limit') || '20')
    const genre = searchParams.get('genre')
    const query = searchParams.get('q')
    const userId = searchParams.get('userId')

    let songs: any[] = []

    switch (type) {
      case 'trending':
        songs = await SongService.getTrendingSongs(limit)
        break
      case 'new':
        songs = await SongService.getNewReleases(limit)
        break
      case 'genre':
        if (genre) {
          songs = await SongService.getSongsByGenre(genre, limit)
        }
        break
      case 'search':
        if (query) {
          const filters = {
            genre: searchParams.get('filterGenre') || undefined,
            mood: searchParams.get('filterMood') || undefined,
            tempo: searchParams.get('filterTempo') || undefined,
            difficulty: searchParams.get('filterDifficulty') || undefined
          }
          songs = await SongService.searchSongs(query, filters, limit)
        }
        break
      case 'user':
        if (userId) {
          songs = await SongService.getSongsByUser(userId, limit)
        }
        break
      default:
        songs = await SongService.getTrendingSongs(limit)
    }

    // Add file URLs from Supabase
    const songsWithUrls = await HybridService.getSongsWithUrls(songs)

    return NextResponse.json({
      success: true,
      data: songsWithUrls
    })
  } catch (error) {
    console.error('Error fetching songs:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch songs' },
      { status: 500 }
    )
  }
}

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
    const {
      title,
      artist,
      duration,
      genre,
      audioFileId,
      lyricsFileId,
      coverArtFileId,
      tags,
      description,
      language,
      mood,
      tempo,
      difficulty
    } = body

    // Get user profile from Supabase
    const { data: profile } = await supabase
      .from('users')
      .select('username')
      .eq('id', user.id)
      .single()

    const songData = {
      title,
      artist,
      duration,
      genre,
      audioFileId,
      lyricsFileId,
      coverArtFileId,
      uploaderId: user.id,
      uploaderUsername: profile?.username || 'Unknown',
      tags: tags || [],
      description,
      language: language || 'en',
      mood,
      tempo,
      difficulty
    }

    const song = await SongService.createSong(songData)
    const songWithUrls = await HybridService.getSongWithUrls(song._id)

    return NextResponse.json({
      success: true,
      data: songWithUrls
    })
  } catch (error) {
    console.error('Error creating song:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create song' },
      { status: 500 }
    )
  }
}
