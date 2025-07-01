import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase admin client with service role key
// Initialize Supabase admin client with service role key, favor SUPABASE_URL on server
const serviceUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ;
console.log('DEBUG [storage-songs]: Admin URL:', serviceUrl, 'Key loaded:', !!serviceKey);
if (!serviceUrl || !serviceKey) {
  console.error('Missing Supabase service URL or service role key');
}
const supabaseAdmin = createClient(
  serviceUrl as string,
  serviceKey as string
);

export async function GET() {
  console.log('DEBUG [storage-songs API] GET invoked');
  try {
    // List all files in the 'songs' bucket
    const { data: audioFiles, error: audioErr } = await supabaseAdmin.storage.from('karaoke-songs').list('', { limit: 100 });
    console.log('DEBUG [storage-songs API] audio files:', audioFiles, audioErr);
    if (audioErr) throw audioErr;
    const { data: lyricFiles, error: lyricErr } = await supabaseAdmin.storage.from('lyrics').list('', { limit: 100 });
    console.log('DEBUG [storage-songs API] lyric files:', lyricFiles, lyricErr);

    // Map audio and lyric files into entries
    const map: Record<string, { audio?: string; lyrics?: string }> = {};
    audioFiles?.forEach((file) => {
      const [id, ext] = file.name.split('.') as [string, string];
      if (['mp3', 'wav', 'm4a'].includes(ext)) {
        map[id] = map[id] ?? {};
        map[id].audio = file.name;
      }
    });
    lyricFiles?.forEach((file) => {
      const [id, ext] = file.name.split('.') as [string, string];
      if (['lrc', 'txt'].includes(ext)) {
        map[id] = map[id] ?? {};
        map[id].lyrics = file.name;
      }
    });

    const songs: any[] = [];
    for (const id in map) {
      const entry = map[id];
      if (!entry.audio) continue;
      const audioUrl = supabaseAdmin.storage.from('karaoke-songs').getPublicUrl(entry.audio).data.publicUrl;
      let lyrics = '';
      if (entry.lyrics) {
        try {
          const { data: lrcBlob, error: lrcErr } = await supabaseAdmin.storage.from('lyrics').download(entry.lyrics);
          if (!lrcErr && lrcBlob) lyrics = await lrcBlob.text();
        } catch {}
      }
      songs.push({ id, title: id, artist: '', audioUrl, lyrics });
    }

    return NextResponse.json(songs);
  } catch (err: any) {
    console.error('Error listing songs:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
