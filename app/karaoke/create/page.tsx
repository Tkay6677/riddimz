"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mic, Music, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function CreateKaraokeRoom() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [roomData, setRoomData] = useState({
    name: '',
    description: '',
    songFile: null as File | null,
    lyricsFile: null as File | null,
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'song' | 'lyrics') => {
    if (e.target.files && e.target.files[0]) {
      setRoomData({
        ...roomData,
        [`${type}File`]: e.target.files[0],
      });
    }
  };

  const createRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomData.name || !roomData.songFile || !roomData.lyricsFile) return;

    setIsCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Upload song file
      const songPath = `karaoke-songs/${Date.now()}_${roomData.songFile.name}`;
      const { error: songError } = await supabase.storage
        .from('karaoke-songs')
        .upload(songPath, roomData.songFile);
      if (songError) throw songError;

      // Upload lyrics file
      const lyricsPath = `lyrics/${Date.now()}_${roomData.lyricsFile.name}`;
      const { error: lyricsError } = await supabase.storage
        .from('karaoke-songs')
        .upload(lyricsPath, roomData.lyricsFile);
      if (lyricsError) throw lyricsError;

      // Create room
      const { data: room, error: roomError } = await supabase
        .from('karaoke_rooms')
        .insert({
          name: roomData.name,
          description: roomData.description,
          host_id: user.id,
          song_url: songPath,
          lyrics_url: lyricsPath,
          is_live: true,
        })
        .select()
        .single();

      if (roomError) throw roomError;

      router.push(`/karaoke/${room.id}`);
    } catch (error) {
      console.error('Error creating room:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="container max-w-2xl py-8">
      <Card>
        <CardHeader>
          <CardTitle>Create Karaoke Room</CardTitle>
          <CardDescription>Set up your karaoke room and start singing!</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={createRoom} className="space-y-6">
            <div>
              <Label htmlFor="name">Room Name</Label>
              <Input
                id="name"
                value={roomData.name}
                onChange={(e) => setRoomData({ ...roomData, name: e.target.value })}
                placeholder="Enter room name"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={roomData.description}
                onChange={(e) => setRoomData({ ...roomData, description: e.target.value })}
                placeholder="Describe your room"
              />
            </div>

            <div>
              <Label htmlFor="song">Karaoke Track</Label>
              <div className="mt-1">
                <Input
                  id="song"
                  type="file"
                  accept="audio/*"
                  onChange={(e) => handleFileChange(e, 'song')}
                  required
                />
              </div>
              <p className="text-sm text-muted-foreground mt-1">Upload your karaoke track (MP3)</p>
            </div>

            <div>
              <Label htmlFor="lyrics">Lyrics File</Label>
              <div className="mt-1">
                <Input
                  id="lyrics"
                  type="file"
                  accept=".lrc"
                  onChange={(e) => handleFileChange(e, 'lyrics')}
                  required
                />
              </div>
              <p className="text-sm text-muted-foreground mt-1">Upload synchronized lyrics file (LRC format)</p>
            </div>

            <Button type="submit" className="w-full" disabled={isCreating}>
              {isCreating ? (
                'Creating Room...'
              ) : (
                <>
                  <Mic className="mr-2 h-4 w-4" />
                  Create Room
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}