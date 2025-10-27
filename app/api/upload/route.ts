import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

function sanitizeFileName(name: string) {
  return name
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_');
}

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
      // Upload song audio to karaoke-songs bucket
      const audioSafe = sanitizeFileName(audioFile.name);
      const audioPath = `${session.user.id}/${Date.now()}_${audioSafe}`;
      const { error: audioError } = await supabase.storage
        .from('karaoke-songs')
        .upload(audioPath, audioFile);

      if (audioError) throw audioError;

      // Upload cover art if provided to karaoke-songs bucket
      let coverPath: string | null = null;
      if (coverArt) {
        const coverSafe = sanitizeFileName(coverArt.name);
        coverPath = `${session.user.id}/${Date.now()}_${coverSafe}`;
        const { error: coverError } = await supabase.storage
          .from('karaoke-songs')
          .upload(coverPath, coverArt);

        if (coverError) throw coverError;
      }

      // Create song record storing storage paths
      const { data: song, error: songError } = await supabase
        .from('songs')
        .insert({
          title,
          artist,
          duration,
          audio_url: audioPath,
          cover_url: coverPath,
          user_id: session.user.id
        })
        .select()
        .single();

      if (songError) throw songError;

      return NextResponse.json({ song });
    } else if (type === 'karaoke') {
      // Upload karaoke instrumental to karaoke-songs
      const instrumentalSafe = sanitizeFileName(audioFile.name);
      const instrumentalPath = `${session.user.id}/${Date.now()}_${instrumentalSafe}`;
      const { error: instrumentalError } = await supabase.storage
        .from('karaoke-songs')
        .upload(instrumentalPath, audioFile);

      if (instrumentalError) throw instrumentalError;

      // Create karaoke track record storing storage path
      const { data: track, error: trackError } = await supabase
        .from('karaoke_tracks')
        .insert({
          song_id: songId,
          instrumental_url: instrumentalPath,
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