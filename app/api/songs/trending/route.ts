import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    
    const supabase = getSupabaseClient();
    
    // Fetch trending songs ordered by trending_score and play_count
    const { data: songs, error } = await supabase
      .from('songs')
      .select('id, title, artist, trending_score, play_count')
      .order('trending_score', { ascending: false })
      .order('play_count', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching trending songs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch trending songs' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      songs: songs || [],
      count: songs?.length || 0
    });
  } catch (error) {
    console.error('Unexpected error in trending songs API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}