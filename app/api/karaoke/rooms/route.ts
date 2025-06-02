import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// Create a new karaoke room
export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, isPrivate, password, maxParticipants } = await request.json();

    const { data: room, error: roomError } = await supabase
      .from('karaoke_rooms')
      .insert({
        name,
        host_id: session.user.id,
        is_private: isPrivate,
        password,
        max_participants: maxParticipants
      })
      .select()
      .single();

    if (roomError) throw roomError;

    // Add host as participant
    const { error: participantError } = await supabase
      .from('room_participants')
      .insert({
        room_id: room.id,
        user_id: session.user.id,
        role: 'host'
      });

    if (participantError) throw participantError;

    return NextResponse.json({ room });
  } catch (error) {
    console.error('Error creating room:', error);
    return NextResponse.json({ error: 'Failed to create room' }, { status: 500 });
  }
}

// Get list of karaoke rooms
export async function GET(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'active';

    const { data: rooms, error } = await supabase
      .from('karaoke_rooms')
      .select(`
        *,
        host:profiles!karaoke_rooms_host_id_fkey(username),
        participants:room_participants(user_id),
        current_track:karaoke_tracks(
          *,
          song:songs(title, artist)
        )
      `)
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ rooms });
  } catch (error) {
    console.error('Error fetching rooms:', error);
    return NextResponse.json({ error: 'Failed to fetch rooms' }, { status: 500 });
  }
}