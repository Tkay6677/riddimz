import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const coverArt = formData.get('coverArt') as File;
    const title = formData.get('title') as string;
    const artist = formData.get('artist') as string;
    const duration = parseInt(formData.get('duration') as string);
    const type = formData.get('type') as 'song' | 'karaoke';
    const songId = formData.get('songId') as string;
    const lyricsData = formData.get('lyricsData') as string;

    if (type === 'song') {
      // Upload song audio
      const { data: audioData, error: audioError } = await supabase.storage
        .from('songs')
        .upload(`${session.user.id}/${Date.now()}-${audioFile.name}`, audioFile);

      if (audioError) throw audioError;

      // Upload cover art if provided
      let coverArtUrl = null;
      if (coverArt) {
        const { data: coverData, error: coverError } = await supabase.storage
          .from('covers')
          .upload(`${session.user.id}/${Date.now()}-${coverArt.name}`, coverArt);

        if (coverError) throw coverError;
        coverArtUrl = supabase.storage.from('covers').getPublicUrl(coverData.path).data.publicUrl;
      }

      // Create song record
      const { data: song, error: songError } = await supabase
        .from('songs')
        .insert({
          title,
          artist,
          duration,
          audio_url: supabase.storage.from('songs').getPublicUrl(audioData.path).data.publicUrl,
          cover_art_url: coverArtUrl,
          user_id: session.user.id
        })
        .select()
        .single();

      if (songError) throw songError;

      return NextResponse.json({ song });
    } else if (type === 'karaoke') {
      // Upload karaoke instrumental
      const { data: instrumentalData, error: instrumentalError } = await supabase.storage
        .from('karaoke')
        .upload(`${session.user.id}/${Date.now()}-${audioFile.name}`, audioFile);

      if (instrumentalError) throw instrumentalError;

      // Create karaoke track record
      const { data: track, error: trackError } = await supabase
        .from('karaoke_tracks')
        .insert({
          song_id: songId,
          instrumental_url: supabase.storage.from('karaoke').getPublicUrl(instrumentalData.path).data.publicUrl,
          lyrics_data: lyricsData ? JSON.parse(lyricsData) : null
        })
        .select()
        .single();

      if (trackError) throw trackError;

      return NextResponse.json({ track });
    }

    return NextResponse.json({ error: 'Invalid upload type' }, { status: 400 });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

export const runtime = 'nodejs'; 