import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { user_id, content } = body;

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        room_id: params.id,
        user_id,
        content
      })
      .select(`
        *,
        user:users (
          username,
          avatar_url
        )
      `)
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}