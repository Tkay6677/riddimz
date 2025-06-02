"use client";

import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { 
  Music, Mic, Upload, Users, Clock, Heart, 
  PlayCircle, Plus, Trash2, Edit2, Settings,
  FileAudio, FileText, Star, Award, TrendingUp,
  Filter, Sparkles
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Song {
  id: string;
  title: string;
  artist: string;
  duration: number;
  created_at: string;
  lyrics_url?: string;
  audio_url: string;
  cover_url?: string;
  genre?: string;
  is_nft: boolean;
  play_count: number;
  likes_count: number;
  trending_score: number;
}

interface Room {
  id: string;
  name: string;
  created_at: string;
  participants_count: number;
  is_private: boolean;
}

type FilterType = 'all' | 'trending' | 'new' | 'nft' | 'genre';

const GENRES = [
  'Pop', 'Rock', 'Hip Hop', 'R&B', 'Electronic',
  'Jazz', 'Classical', 'Country', 'Folk', 'Metal',
  'Blues', 'Reggae', 'Latin', 'World', 'Other'
];

export default function DashboardPage() {
  const { user, signOut } = useAuth();
  const { profile, loading } = useProfile();
  const router = useRouter();
  const [songs, setSongs] = useState<Song[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [uploading, setUploading] = useState(false);
  const [songFile, setSongFile] = useState<File | null>(null);
  const [lyricsFile, setLyricsFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [songTitle, setSongTitle] = useState('');
  const [songArtist, setSongArtist] = useState('');
  const [duration, setDuration] = useState<number>(0);
  const [genre, setGenre] = useState<string>('');
  const [isNft, setIsNft] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedGenre, setSelectedGenre] = useState<string>('');

  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    loadUserContent();
  }, [user, router, filter, selectedGenre]);

  const loadUserContent = async () => {
    if (!user) return;

    let query = supabase
      .from('songs')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply filters
    switch (filter) {
      case 'trending':
        query = query.order('trending_score', { ascending: false });
        break;
      case 'new':
        query = query.order('created_at', { ascending: false });
        break;
      case 'nft':
        query = query.eq('is_nft', true);
        break;
      case 'genre':
        if (selectedGenre) {
          query = query.eq('genre', selectedGenre);
        }
        break;
    }

    const { data: songsData } = await query;

    if (songsData) {
      setSongs(songsData);
    }

    // Load user's rooms
    const { data: roomsData } = await supabase
      .from('karaoke_rooms')
      .select(`
        id,
        name,
        created_at,
        is_private,
        participants:room_participants(count)
      `)
      .eq('host_id', user.id)
      .order('created_at', { ascending: false });

    if (roomsData) {
      setRooms(roomsData.map(room => ({
        ...room,
        participants_count: room.participants?.[0]?.count || 0
      })));
    }
  };

  const handleSongUpload = async () => {
    if (!user || !songFile || !songTitle || !songArtist) return;

    try {
      setUploading(true);

      // Get audio duration
      const audio = new Audio();
      audio.src = URL.createObjectURL(songFile);
      await new Promise((resolve) => {
        audio.addEventListener('loadedmetadata', () => {
          setDuration(Math.round(audio.duration));
          resolve(null);
        });
      });

      // Upload song file
      const songFileName = `${user.id}/${Date.now()}_${songFile.name}`;
      const { error: songError } = await supabase.storage
        .from('karaoke-songs')
        .upload(songFileName, songFile);

      if (songError) throw songError;

      let lyricsFileName: string | undefined;
      if (lyricsFile) {
        lyricsFileName = `${user.id}/${Date.now()}_${lyricsFile.name}`;
        const { error: lyricsError } = await supabase.storage
          .from('karaoke-songs')
          .upload(lyricsFileName, lyricsFile);

        if (lyricsError) throw lyricsError;
      }

      let coverFileName: string | undefined;
      if (imageFile) {
        coverFileName = `${user.id}/${Date.now()}_${imageFile.name}`;
        const { error: coverError } = await supabase.storage
          .from('karaoke-songs')
          .upload(coverFileName, imageFile);

        if (coverError) throw coverError;
      }

      // Create song record
      const { error: dbError } = await supabase
        .from('songs')
        .insert([{
          title: songTitle,
          artist: songArtist,
          user_id: user.id,
          audio_url: songFileName,
          lyrics_url: lyricsFileName,
          cover_url: coverFileName,
          duration: Math.round(audio.duration),
          genre: genre || null,
          is_nft: isNft
        }]);

      if (dbError) throw dbError;

      // Reset form and reload content
      setSongFile(null);
      setLyricsFile(null);
      setImageFile(null);
      setSongTitle('');
      setSongArtist('');
      setDuration(0);
      setGenre('');
      setIsNft(false);
      loadUserContent();
    } catch (error) {
      console.error('Error uploading song:', error);
    } finally {
      setUploading(false);
    }
  };

  const deleteSong = async (songId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('songs')
        .delete()
        .eq('id', songId)
        .eq('user_id', user.id);

      if (error) throw error;
      loadUserContent();
    } catch (error) {
      console.error('Error deleting song:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="grid gap-6">
        {/* User Profile Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={profile?.avatar_url} />
                <AvatarFallback>{profile?.username?.slice(0, 2)}</AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-2xl">{profile?.username}</CardTitle>
                <CardDescription>Member since {new Date(profile?.created_at).toLocaleDateString()}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">{songs.length}</div>
                <div className="text-sm text-muted-foreground">Songs</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{rooms.length}</div>
                <div className="text-sm text-muted-foreground">Rooms</div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {rooms.reduce((acc, room) => acc + room.participants_count, 0)}
                </div>
                <div className="text-sm text-muted-foreground">Total Participants</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content Tabs */}
        <Tabs defaultValue="songs" className="space-y-4">
          <TabsList>
            <TabsTrigger value="songs">
              <Music className="h-4 w-4 mr-2" />
              My Songs
            </TabsTrigger>
            <TabsTrigger value="rooms">
              <Mic className="h-4 w-4 mr-2" />
              My Rooms
            </TabsTrigger>
            <TabsTrigger value="upload">
              <Upload className="h-4 w-4 mr-2" />
              Upload Song
            </TabsTrigger>
          </TabsList>

          {/* Songs Tab */}
          <TabsContent value="songs">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>My Songs</CardTitle>
                    <CardDescription>Manage your uploaded songs</CardDescription>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Select value={filter} onValueChange={(value) => setFilter(value as FilterType)}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filter songs" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Songs</SelectItem>
                        <SelectItem value="trending">Trending</SelectItem>
                        <SelectItem value="new">New Releases</SelectItem>
                        <SelectItem value="nft">NFT Exclusives</SelectItem>
                        <SelectItem value="genre">By Genre</SelectItem>
                      </SelectContent>
                    </Select>
                    {filter === 'genre' && (
                      <Select value={selectedGenre} onValueChange={setSelectedGenre}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Select genre" />
                        </SelectTrigger>
                        <SelectContent>
                          {GENRES.map((g) => (
                            <SelectItem key={g} value={g}>{g}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {songs.map((song) => (
                      <div key={song.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-4">
                          {song.cover_url ? (
                            <img 
                              src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/karaoke-songs/${song.cover_url}`}
                              alt={song.title}
                              className="h-12 w-12 rounded-md object-cover"
                            />
                          ) : (
                            <FileAudio className="h-12 w-12 text-primary" />
                          )}
                          <div>
                            <div className="font-medium">{song.title}</div>
                            <div className="text-sm text-muted-foreground">{song.artist}</div>
                            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                              {song.genre && <span>{song.genre}</span>}
                              {song.is_nft && <Sparkles className="h-3 w-3" />}
                              <span>{song.play_count} plays</span>
                              <span>{song.likes_count} likes</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button variant="ghost" size="icon" onClick={() => router.push(`/karaoke/create?song=${song.id}`)}>
                            <PlayCircle className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteSong(song.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rooms Tab */}
          <TabsContent value="rooms">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>My Rooms</CardTitle>
                    <CardDescription>View and manage your karaoke rooms</CardDescription>
                  </div>
                  <Button onClick={() => router.push('/karaoke/create')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Room
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {rooms.map((room) => (
                      <div key={room.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-4">
                          <Mic className="h-8 w-8 text-primary" />
                          <div>
                            <div className="font-medium">{room.name}</div>
                            <div className="text-sm text-muted-foreground">
                              Created {new Date(room.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Users className="h-4 w-4 mr-1" />
                            {room.participants_count}
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => router.push(`/karaoke/${room.id}`)}>
                            <PlayCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Upload Tab */}
          <TabsContent value="upload">
            <Card>
              <CardHeader>
                <CardTitle>Upload Song</CardTitle>
                <CardDescription>Add a new song to your collection</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="title">Song Title</Label>
                      <Input
                        id="title"
                        value={songTitle}
                        onChange={(e) => setSongTitle(e.target.value)}
                        placeholder="Enter song title"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="artist">Artist</Label>
                      <Input
                        id="artist"
                        value={songArtist}
                        onChange={(e) => setSongArtist(e.target.value)}
                        placeholder="Enter artist name"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="genre">Genre</Label>
                      <Select value={genre} onValueChange={setGenre}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select genre" />
                        </SelectTrigger>
                        <SelectContent>
                          {GENRES.map((g) => (
                            <SelectItem key={g} value={g}>{g}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="song">Song File (MP3)</Label>
                      <Input
                        id="song"
                        type="file"
                        accept=".mp3"
                        onChange={(e) => setSongFile(e.target.files?.[0] || null)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="lyrics">Lyrics File (LRC) - Optional</Label>
                      <Input
                        id="lyrics"
                        type="file"
                        accept=".lrc"
                        onChange={(e) => setLyricsFile(e.target.files?.[0] || null)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="image">Cover Image - Optional</Label>
                      <Input
                        id="image"
                        type="file"
                        accept="image/*"
                        onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="isNft"
                        checked={isNft}
                        onChange={(e) => setIsNft(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <Label htmlFor="isNft">NFT Exclusive</Label>
                    </div>
                  </div>
                  <Button 
                    onClick={handleSongUpload} 
                    disabled={!songFile || !songTitle || !songArtist || uploading}
                    className="w-full"
                  >
                    {uploading ? 'Uploading...' : 'Upload Song'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
} 