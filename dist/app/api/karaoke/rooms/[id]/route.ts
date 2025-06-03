import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { data: room, error } = await supabase
      .from('karaoke_rooms')
      .select(`
        *,
        host:users!karaoke_rooms_host_id_fkey (
          username,
          avatar_url
        ),
        current_song:songs!karaoke_rooms_current_song_id_fkey (
          title,
          artist
        ),
        participants:room_participants (
          user:users (
            username,
            avatar_url
          )
        ),
        chat_messages (
          id,
          content,
          created_at,
          user:users (
            username,
            avatar_url
          )
        )
      `)
      .eq('id', params.id)
      .single();

    if (error) throw error;

    return NextResponse.json(room);
  } catch (error) {
    console.error('Error fetching room:', error);
    return NextResponse.json({ error: 'Failed to fetch room' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { current_song_id, is_live } = body;

    const { data, error } = await supabase
      .from('karaoke_rooms')
      .update({ current_song_id, is_live })
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating room:', error);
    return NextResponse.json({ error: 'Failed to update room' }, { status: 500 });
  }
}