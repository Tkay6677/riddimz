"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mic, Music, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

export const dynamic = 'force-dynamic'

export default function CreateKaraokeRoom() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [roomData, setRoomData] = useState({
    name: '',
    description: '',
    songFile: null as File | null,
    lyricsFile: null as File | null,
    isPrivate: false,
    password: '',
    maxParticipants: 10,
    theme: '',
    language: '',
    difficultyLevel: 'intermediate' as 'beginner' | 'intermediate' | 'advanced',
    settings: {
      enableChat: true,
      enableVoice: true,
      enableVideo: false,
      enableScreenSharing: false,
      enableLyrics: true,
      enableScoring: true,
      minScoreToJoin: 0
    }
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
          is_private: roomData.isPrivate,
          password: roomData.isPrivate ? roomData.password : null,
          max_participants: roomData.maxParticipants,
          theme: roomData.theme,
          language: roomData.language,
          difficulty_level: roomData.difficultyLevel,
          status: 'waiting'
        })
        .select()
        .single();

      if (roomError) throw roomError;

      // Update room settings
      const { error: settingsError } = await supabase
        .from('room_settings')
        .update({
          enable_chat: roomData.settings.enableChat,
          enable_voice: roomData.settings.enableVoice,
          enable_video: roomData.settings.enableVideo,
          enable_screen_sharing: roomData.settings.enableScreenSharing,
          enable_lyrics: roomData.settings.enableLyrics,
          enable_scoring: roomData.settings.enableScoring,
          min_score_to_join: roomData.settings.minScoreToJoin
        })
        .eq('room_id', room.id);

      if (settingsError) throw settingsError;

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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="theme">Theme</Label>
                <Input
                  id="theme"
                  value={roomData.theme}
                  onChange={(e) => setRoomData({ ...roomData, theme: e.target.value })}
                  placeholder="Room theme (optional)"
                />
              </div>
              <div>
                <Label htmlFor="language">Language</Label>
                <Input
                  id="language"
                  value={roomData.language}
                  onChange={(e) => setRoomData({ ...roomData, language: e.target.value })}
                  placeholder="Room language (optional)"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="maxParticipants">Max Participants</Label>
                <Input
                  id="maxParticipants"
                  type="number"
                  min="1"
                  max="50"
                  value={roomData.maxParticipants}
                  onChange={(e) => setRoomData({ ...roomData, maxParticipants: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="difficultyLevel">Difficulty Level</Label>
                <Select
                  value={roomData.difficultyLevel}
                  onValueChange={(value: 'beginner' | 'intermediate' | 'advanced') => 
                    setRoomData({ ...roomData, difficultyLevel: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isPrivate"
                  checked={roomData.isPrivate}
                  onCheckedChange={(checked) => 
                    setRoomData({ ...roomData, isPrivate: checked as boolean })}
                />
                <Label htmlFor="isPrivate">Private Room</Label>
              </div>

              {roomData.isPrivate && (
                <div>
                  <Label htmlFor="password">Room Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={roomData.password}
                    onChange={(e) => setRoomData({ ...roomData, password: e.target.value })}
                    placeholder="Enter room password"
                    required={roomData.isPrivate}
                  />
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Room Settings</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="enableChat"
                    checked={roomData.settings.enableChat}
                    onCheckedChange={(checked) => 
                      setRoomData({
                        ...roomData,
                        settings: { ...roomData.settings, enableChat: checked as boolean }
                      })}
                  />
                  <Label htmlFor="enableChat">Enable Chat</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="enableVoice"
                    checked={roomData.settings.enableVoice}
                    onCheckedChange={(checked) => 
                      setRoomData({
                        ...roomData,
                        settings: { ...roomData.settings, enableVoice: checked as boolean }
                      })}
                  />
                  <Label htmlFor="enableVoice">Enable Voice</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="enableVideo"
                    checked={roomData.settings.enableVideo}
                    onCheckedChange={(checked) => 
                      setRoomData({
                        ...roomData,
                        settings: { ...roomData.settings, enableVideo: checked as boolean }
                      })}
                  />
                  <Label htmlFor="enableVideo">Enable Video</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="enableScreenSharing"
                    checked={roomData.settings.enableScreenSharing}
                    onCheckedChange={(checked) => 
                      setRoomData({
                        ...roomData,
                        settings: { ...roomData.settings, enableScreenSharing: checked as boolean }
                      })}
                  />
                  <Label htmlFor="enableScreenSharing">Enable Screen Sharing</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="enableLyrics"
                    checked={roomData.settings.enableLyrics}
                    onCheckedChange={(checked) => 
                      setRoomData({
                        ...roomData,
                        settings: { ...roomData.settings, enableLyrics: checked as boolean }
                      })}
                  />
                  <Label htmlFor="enableLyrics">Show Lyrics</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="enableScoring"
                    checked={roomData.settings.enableScoring}
                    onCheckedChange={(checked) => 
                      setRoomData({
                        ...roomData,
                        settings: { ...roomData.settings, enableScoring: checked as boolean }
                      })}
                  />
                  <Label htmlFor="enableScoring">Enable Scoring</Label>
                </div>
              </div>
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
                  accept=".lrc,.txt"
                  onChange={(e) => handleFileChange(e, 'lyrics')}
                  required
                />
              </div>
              <p className="text-sm text-muted-foreground mt-1">Upload your lyrics file (LRC or TXT)</p>
            </div>

            <Button type="submit" className="w-full" disabled={isCreating}>
              {isCreating ? 'Creating Room...' : 'Create Room'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}