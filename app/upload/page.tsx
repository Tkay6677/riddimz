"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Music, Mic, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic'

export default function UploadPage() {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [songData, setSongData] = useState({
    title: '',
    artist: '',
    audioFile: null as File | null,
    coverFile: null as File | null,
    lyricsFile: null as File | null,
    isKaraoke: false,
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'audio' | 'cover' | 'lyrics') => {
    if (e.target.files && e.target.files[0]) {
      setSongData({
        ...songData,
        [`${type}File`]: e.target.files[0],
      });
    }
  };

  const uploadFile = async (file: File, path: string) => {
    const { data, error } = await supabase.storage
      .from('media')
      .upload(path, file);

    if (error) throw error;
    return data.path;
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!songData.audioFile || !songData.title || !songData.artist) return;

    setUploading(true);
    try {
      const timestamp = Date.now();
      const audioPath = await uploadFile(
        songData.audioFile,
        `${songData.isKaraoke ? 'karaoke' : 'songs'}/${timestamp}_${songData.audioFile.name}`
      );

      let coverPath = '';
      if (songData.coverFile) {
        coverPath = await uploadFile(
          songData.coverFile,
          `covers/${timestamp}_${songData.coverFile.name}`
        );
      }

      let lyricsPath = '';
      if (songData.lyricsFile && songData.isKaraoke) {
        lyricsPath = await uploadFile(
          songData.lyricsFile,
          `lyrics/${timestamp}_${songData.lyricsFile.name}`
        );
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase.from('songs').insert({
        title: songData.title,
        artist: songData.artist,
        audio_url: audioPath,
        cover_url: coverPath,
        lyrics_url: lyricsPath,
        is_karaoke: songData.isKaraoke,
        user_id: user.id,
      });

      if (error) throw error;
      router.push('/dashboard');
    } catch (error) {
      console.error('Error uploading song:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="container max-w-4xl py-8">
      <Tabs defaultValue="music">
        <TabsList className="grid w-full grid-cols-2 mb-8">
          <TabsTrigger value="music" className="flex items-center gap-2">
            <Music className="h-4 w-4" />
            Upload Music
          </TabsTrigger>
          <TabsTrigger value="karaoke" className="flex items-center gap-2">
            <Mic className="h-4 w-4" />
            Upload Karaoke Track
          </TabsTrigger>
        </TabsList>

        <TabsContent value="music">
          <Card>
            <CardHeader>
              <CardTitle>Upload Music</CardTitle>
              <CardDescription>Share your music with the world</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpload} className="space-y-6">
                <div>
                  <Label htmlFor="title">Song Title</Label>
                  <Input
                    id="title"
                    value={songData.title}
                    onChange={(e) => setSongData({ ...songData, title: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="artist">Artist Name</Label>
                  <Input
                    id="artist"
                    value={songData.artist}
                    onChange={(e) => setSongData({ ...songData, artist: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="audio">Audio File</Label>
                  <Input
                    id="audio"
                    type="file"
                    accept="audio/*"
                    onChange={(e) => handleFileChange(e, 'audio')}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="cover">Cover Image (Optional)</Label>
                  <Input
                    id="cover"
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, 'cover')}
                  />
                </div>

                <Button type="submit" disabled={uploading} className="w-full">
                  {uploading ? 'Uploading...' : 'Upload Song'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="karaoke">
          <Card>
            <CardHeader>
              <CardTitle>Upload Karaoke Track</CardTitle>
              <CardDescription>Share your karaoke version for others to sing</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => {
                setSongData({ ...songData, isKaraoke: true });
                handleUpload(e);
              }} className="space-y-6">
                <div>
                  <Label htmlFor="k-title">Song Title</Label>
                  <Input
                    id="k-title"
                    value={songData.title}
                    onChange={(e) => setSongData({ ...songData, title: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="k-artist">Original Artist</Label>
                  <Input
                    id="k-artist"
                    value={songData.artist}
                    onChange={(e) => setSongData({ ...songData, artist: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="k-audio">Karaoke Track</Label>
                  <Input
                    id="k-audio"
                    type="file"
                    accept="audio/*"
                    onChange={(e) => handleFileChange(e, 'audio')}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="k-lyrics">Lyrics File (LRC format)</Label>
                  <Input
                    id="k-lyrics"
                    type="file"
                    accept=".lrc"
                    onChange={(e) => handleFileChange(e, 'lyrics')}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="k-cover">Cover Image (Optional)</Label>
                  <Input
                    id="k-cover"
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, 'cover')}
                  />
                </div>

                <Button type="submit" disabled={uploading} className="w-full">
                  {uploading ? 'Uploading...' : 'Upload Karaoke Track'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}