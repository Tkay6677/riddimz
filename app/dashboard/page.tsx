"use client";

import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import { 
  Music, Mic, Upload, Users, Clock, Heart, 
  PlayCircle, Plus, Trash2, Edit2, Settings,
  FileAudio, FileText, Star, Award, TrendingUp,
  Filter, Sparkles, Lock
} from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useToast } from '@/components/ui/use-toast';

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

interface KaraokeTrack {
  id: string;
  song_id: string;
  instrumental_url: string;
  lyrics_data: any;
  created_at: string;
  song: Song;
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
  'Jazz', 'Classical', 'Country', 'Gospel', 'Afro','Folk', 'Metal',
  'Blues', 'Reggae', 'Latin', 'World', 'Other'
];

// Disable automatic revalidation and use client-side data fetching
// This prevents the page from refreshing when it loses focus
export const dynamic = 'force-static';
export const revalidate = false;

export default function DashboardPage() {
  console.log('DashboardPage rendered');
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile(user);
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClientComponentClient();
  const [songs, setSongs] = useState<Song[]>([]);
  const [karaokeTracks, setKaraokeTracks] = useState<KaraokeTrack[]>([]);
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
  
  // Password protection states
  const [uploadPasswordVerified, setUploadPasswordVerified] = useState(false);
  const [uploadPasswordInput, setUploadPasswordInput] = useState('');
  const [uploadPasswordError, setUploadPasswordError] = useState('');
  
  // Karaoke track upload states
  const [karaokeUploading, setKaraokeUploading] = useState(false);
  const [karaokeInstrumentalFile, setKaraokeInstrumentalFile] = useState<File | null>(null);
  const [karaokeLyricsFile, setKaraokeLyricsFile] = useState<File | null>(null);
  const [karaokeCoverFile, setKaraokeCoverFile] = useState<File | null>(null);
  const [karaokeTitle, setKaraokeTitle] = useState('');
  const [karaokeArtist, setKaraokeArtist] = useState('');
  const [karaokeGenre, setKaraokeGenre] = useState<string>('');
  const [karaokeIsNft, setKaraokeIsNft] = useState(false);

  // Upload password - in production, this should be stored securely
  const UPLOAD_PASSWORD = "riddimz2024";

  const audioRef = useRef<HTMLAudioElement>(null);

  const handleUploadPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadPasswordInput === UPLOAD_PASSWORD) {
      setUploadPasswordVerified(true);
      setUploadPasswordError('');
    } else {
      setUploadPasswordError('Incorrect password. Please try again.');
    }
  };

  // SSR-safe: set initial to true, update in useEffect
  const [isVisible, setIsVisible] = useState(true);
  const [isMounted, setIsMounted] = useState(true);
  
  // Set isMounted to true when component mounts and false when it unmounts
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);
  
  // Function to load songs
  const loadSongs = useCallback(async () => {
    console.log('loadSongs called', { userId: user?.id, isMounted, isVisible });
    if (!user?.id || !isMounted || !isVisible) return;
    
    try {
      let query = supabase
        .from('songs')
        .select('*')
        .eq('user_id', user.id)
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

      const { data: songsData, error: songsError } = await query;

      if (songsError) throw songsError;

      if (songsData) {
        // Transform cover_url to use Supabase storage URL
        const songsWithUrls = songsData.map(song => ({
          ...song,
          cover_url: song.cover_url ? supabase.storage.from('karaoke-songs').getPublicUrl(song.cover_url).data.publicUrl : null
        }));
        setSongs(songsWithUrls);
        
        // Cache the songs in sessionStorage
        try {
          sessionStorage.setItem('dashboard_songs', JSON.stringify(songsWithUrls));
        } catch (e) {
          console.error('Error caching songs:', e);
        }
      }
    } catch (error: any) {
      console.error('Error loading songs:', error);
      toast({
        variant: "destructive",
        title: "Error loading songs",
        description: error.message || "Failed to load your songs. Please try again.",
        duration: 5000,
      });
    } finally {
     // setLoading(false);
    }
  }, [user?.id, filter, selectedGenre, supabase, toast, isMounted]);

  // Function to load karaoke tracks
  const loadKaraokeTracks = useCallback(async () => {
    console.log('loadKaraokeTracks called', { userId: user?.id, isMounted, isVisible });
    if (!user?.id || !isMounted || !isVisible) return;
    
    try {
      const { data: karaokeData, error: karaokeError } = await supabase
        .from('karaoke_tracks')
        .select(`
          id,
          song_id,
          instrumental_url,
          lyrics_data,
          created_at,
          song:songs(
            id,
            title,
            artist,
            duration,
            cover_url,
            genre,
            is_nft,
            play_count,
            likes_count,
            trending_score
          )
        `)
        .eq('song.user_id', user.id)
        .order('created_at', { ascending: false });

      if (karaokeError) throw karaokeError;

      if (karaokeData) {
        const tracksWithUrls = karaokeData.map((track: any) => ({
          ...track,
          song: {
            ...track.song,
            cover_url: track.song?.cover_url ? supabase.storage.from('karaoke-songs').getPublicUrl(track.song.cover_url).data.publicUrl : null
          }
        }));
        setKaraokeTracks(tracksWithUrls);
        
        // Cache the karaoke tracks in sessionStorage
        try {
          sessionStorage.setItem('dashboard_karaoke_tracks', JSON.stringify(tracksWithUrls));
        } catch (e) {
          console.error('Error caching karaoke tracks:', e);
        }
      }
    } catch (error: any) {
      console.error('Error loading karaoke tracks:', error);
      toast({
        variant: "destructive",
        title: "Error loading karaoke tracks",
        description: error.message || "Failed to load your karaoke tracks. Please try again.",
        duration: 5000,
      });
    }
  }, [user?.id, supabase, toast, isMounted, isVisible]);

  // Function to load rooms
  const loadRooms = useCallback(async () => {
    console.log('loadRooms called', { userId: user?.id, isMounted, isVisible });
    if (!user?.id || !isMounted || !isVisible) return;
    
    try {
     // setLoading(true);
      const { data: roomsData, error: roomsError } = await supabase
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

      if (roomsError) throw roomsError;

      if (roomsData) {
        const transformedRooms = roomsData.map(room => ({
          ...room,
          participants_count: room.participants?.[0]?.count || 0
        }));
        
        setRooms(transformedRooms);
        
        // Cache the rooms in sessionStorage
        try {
          sessionStorage.setItem('dashboard_rooms', JSON.stringify(transformedRooms));
        } catch (e) {
          console.error('Error caching rooms:', e);
        }
      }
    } catch (error: any) {
      console.error('Error loading rooms:', error);
      toast({
        variant: "destructive",
        title: "Error loading rooms",
        description: error.message || "Failed to load your rooms. Please try again.",
        duration: 5000,
      });
    } finally {
   //   setLoading(false);
    }
  }, [user?.id, supabase, toast]);

  // Main effect for data loading and caching
  useEffect(() => {
    if (!user) return;

    // Try to load from cache
    const cachedSongs = sessionStorage.getItem('dashboard_songs');
    const cachedKaraokeTracks = sessionStorage.getItem('dashboard_karaoke_tracks');
    const cachedRooms = sessionStorage.getItem('dashboard_rooms');

    if (cachedSongs) {
      setSongs(JSON.parse(cachedSongs));
    } else {
      loadSongs();
    }

    if (cachedKaraokeTracks) {
      setKaraokeTracks(JSON.parse(cachedKaraokeTracks));
    } else {
      loadKaraokeTracks();
    }

    if (cachedRooms) {
      setRooms(JSON.parse(cachedRooms));
    } else {
      loadRooms();
    }

    // removed setLoading(false)
  }, [user]);

  const handleSongUpload = async () => {
    if (!user || !songFile || !songTitle || !songArtist) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please provide a song file, title, and artist name.",
        duration: 5000,
      });
      return;
    }

    try {
      //setUploading(true);

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
      
      toast({
        title: "Song uploaded successfully!",
        description: `${songTitle} by ${songArtist} has been added to your collection.`,
        duration: 5000,
      });

      loadSongs();
    } catch (error: any) {
      console.error('Error uploading song:', error);
      toast({
        variant: "destructive",
        title: "Error uploading song",
        description: error.message || "Failed to upload song. Please try again.",
        duration: 5000,
      });
    } finally {
      setUploading(false);
    }
  };

  const handleKaraokeTrackUpload = async () => {
    if (!user || !karaokeInstrumentalFile || !karaokeLyricsFile || !karaokeTitle || !karaokeArtist) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please provide an instrumental file, lyrics file (LRC), title, and artist name.",
        duration: 5000,
      });
      return;
    }

    try {
      setKaraokeUploading(true);

      // Get audio duration
      const audio = new Audio();
      audio.src = URL.createObjectURL(karaokeInstrumentalFile);
      let audioDuration = 0;
      await new Promise((resolve) => {
        audio.addEventListener('loadedmetadata', () => {
          audioDuration = Math.round(audio.duration);
          resolve(null);
        });
      });

      // Upload instrumental file
      const instrumentalFileName = `${user.id}/${Date.now()}_${karaokeInstrumentalFile.name}`;
      const { error: instrumentalError } = await supabase.storage
        .from('karaoke-songs')
        .upload(instrumentalFileName, karaokeInstrumentalFile);

      if (instrumentalError) throw instrumentalError;

      // Upload lyrics file (now mandatory)
      const lyricsFileName = `${user.id}/${Date.now()}_${karaokeLyricsFile.name}`;
      const { error: lyricsError } = await supabase.storage
        .from('karaoke-songs')
        .upload(lyricsFileName, karaokeLyricsFile);

      if (lyricsError) throw lyricsError;

      // Read lyrics file content for parsing
      let lyricsData: any = null;
      try {
        const lyricsText = await karaokeLyricsFile.text();
        lyricsData = { content: lyricsText, format: 'lrc' };
      } catch (e) {
        console.warn('Could not read lyrics file content:', e);
        lyricsData = { content: '', format: 'lrc' };
      }

      let coverFileName: string | undefined;
      if (karaokeCoverFile) {
        coverFileName = `${user.id}/${Date.now()}_${karaokeCoverFile.name}`;
        const { error: coverError } = await supabase.storage
          .from('karaoke-songs')
          .upload(coverFileName, karaokeCoverFile);

        if (coverError) throw coverError;
      }

      // First create the song record
      const { data: songData, error: songError } = await supabase
        .from('songs')
        .insert([{
          title: karaokeTitle,
          artist: karaokeArtist,
          user_id: user.id,
          audio_url: instrumentalFileName, // Use instrumental as the main audio
          lyrics_url: lyricsFileName,
          cover_url: coverFileName,
          duration: audioDuration,
          genre: karaokeGenre || null,
          is_nft: karaokeIsNft
        }])
        .select()
        .single();

      if (songError) throw songError;

      // Then create the karaoke track record
      const { error: karaokeError } = await supabase
        .from('karaoke_tracks')
        .insert([{
          song_id: songData.id,
          instrumental_url: instrumentalFileName,
          lyrics_data: lyricsData
        }]);

      if (karaokeError) throw karaokeError;

      // Reset form and reload content
      setKaraokeInstrumentalFile(null);
      setKaraokeLyricsFile(null);
      setKaraokeCoverFile(null);
      setKaraokeTitle('');
      setKaraokeArtist('');
      setKaraokeGenre('');
      setKaraokeIsNft(false);
      
      toast({
        title: "Karaoke track uploaded successfully!",
        description: `${karaokeTitle} by ${karaokeArtist} has been added to your karaoke collection.`,
        duration: 5000,
      });

      loadKaraokeTracks();
      loadSongs(); // Also reload songs since we created a new song
    } catch (error: any) {
      console.error('Error uploading karaoke track:', error);
      toast({
        variant: "destructive",
        title: "Error uploading karaoke track",
        description: error.message || "Failed to upload karaoke track. Please try again.",
        duration: 5000,
      });
    } finally {
      setKaraokeUploading(false);
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

      toast({
        title: "Song deleted",
        description: "The song has been removed from your collection.",
        duration: 3000,
      });

      loadSongs();
    } catch (error: any) {
      console.error('Error deleting song:', error);
      toast({
        variant: "destructive",
        title: "Error deleting song",
        description: error.message || "Failed to delete song. Please try again.",
        duration: 5000,
      });
    }
  };



  return (
    <div className="w-full max-w-none px-4 py-4 sm:py-8 sm:max-w-7xl sm:mx-auto">
      <div className="grid gap-4 sm:gap-6">
        {/* User Profile Card */}
        <Card>
          <CardHeader>
            <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
              <div className="flex items-center gap-3 sm:gap-4">
                <Avatar className="h-12 w-12 sm:h-16 sm:w-16 flex-shrink-0">
                  <AvatarImage src={profile?.avatar_url} />
                  <AvatarFallback>{profile?.username?.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="text-lg sm:text-xl font-semibold truncate">{profile?.username}</div>
                  <div className="text-sm text-muted-foreground truncate">{profile?.email}</div>
                </div>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button variant="outline" onClick={async () => {
                  await Promise.all([loadSongs(), loadRooms()]);
                  toast({ title: 'Dashboard refreshed!' });
                }} className="flex-1 sm:flex-none">
                  Refresh
                </Button>
                {/* Settings, Edit, etc. buttons here */}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-1 sm:gap-4 text-center">
              <div className="p-2">
                <div className="text-base sm:text-2xl font-bold">{songs.length}</div>
                <div className="text-xs sm:text-sm text-muted-foreground">Songs</div>
              </div>
              <div className="p-2">
                <div className="text-base sm:text-2xl font-bold">{rooms.length}</div>
                <div className="text-xs sm:text-sm text-muted-foreground">Rooms</div>
              </div>
              <div className="p-2">
                <div className="text-base sm:text-2xl font-bold">
                  {rooms.reduce((acc, room) => acc + room.participants_count, 0)}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground leading-tight">Participants</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content Tabs */}
        <Tabs defaultValue="songs" className="space-y-4">
          <div className="overflow-x-auto">
            <TabsList className="inline-flex w-max min-w-full">
              <TabsTrigger value="songs" className="whitespace-nowrap">
                <Music className="h-4 w-4 mr-2" />
                My Songs
              </TabsTrigger>
              <TabsTrigger value="karaoke" className="whitespace-nowrap">
                <Mic className="h-4 w-4 mr-2" />
                Karaoke Tracks
              </TabsTrigger>
              <TabsTrigger value="rooms" className="whitespace-nowrap">
                <Users className="h-4 w-4 mr-2" />
                My Rooms
              </TabsTrigger>
              <TabsTrigger value="upload" className="whitespace-nowrap">
                <Upload className="h-4 w-4 mr-2" />
                Upload Song
              </TabsTrigger>
              <TabsTrigger value="upload-karaoke" className="whitespace-nowrap">
                <FileAudio className="h-4 w-4 mr-2" />
                Upload Karaoke
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Songs Tab */}
          <TabsContent value="songs">
            <Card>
              <CardHeader>
                <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                  <div>
                    <CardTitle>My Songs</CardTitle>
                    <CardDescription>Manage your uploaded songs</CardDescription>
                  </div>
                  <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-2">
                    <Select value={filter} onValueChange={(value) => setFilter(value as FilterType)}>
                      <SelectTrigger className="w-full sm:w-[180px]">
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
                        <SelectTrigger className="w-full sm:w-[180px]">
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
                <ScrollArea className="h-[300px] sm:h-[400px]">
                  <div className="space-y-3 sm:space-y-4">
                    {songs.map((song) => (
                      <div key={song.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 border rounded-lg space-y-3 sm:space-y-0">
                        <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
                          {song.cover_url ? (
                            <img 
                              src={song.cover_url}
                              alt={song.title}
                              className="h-10 w-10 sm:h-12 sm:w-12 rounded-md object-cover flex-shrink-0"
                            />
                          ) : (
                            <FileAudio className="h-10 w-10 sm:h-12 sm:w-12 text-primary flex-shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate text-sm sm:text-base">{song.title}</div>
                            <div className="text-xs sm:text-sm text-muted-foreground truncate">{song.artist}</div>
                            <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-xs text-muted-foreground">
                              {song.genre && <span className="truncate">{song.genre}</span>}
                              {song.is_nft && <Sparkles className="h-3 w-3 flex-shrink-0" />}
                              <span>{song.play_count} plays</span>
                              <span>{song.likes_count} likes</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-end space-x-1 sm:space-x-2 flex-shrink-0">
                          <Button variant="ghost" size="sm" onClick={() => router.push(`/karaoke/create?song=${song.id}`)}>
                            <PlayCircle className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteSong(song.id)}>
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

          {/* Karaoke Tracks Tab */}
          <TabsContent value="karaoke">
            <Card>
              <CardHeader>
                <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                  <div>
                    <CardTitle>My Karaoke Tracks</CardTitle>
                    <CardDescription>Manage your uploaded karaoke tracks</CardDescription>
                  </div>
                  <Button onClick={() => (document.querySelector('[value="upload-karaoke"]') as HTMLElement)?.click()} className="w-full sm:w-auto">
                    <Plus className="h-4 w-4 mr-2" />
                    Upload Karaoke Track
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px] sm:h-[400px]">
                  <div className="space-y-3 sm:space-y-4">
                    {karaokeTracks.map((track) => (
                      <div key={track.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 border rounded-lg space-y-3 sm:space-y-0">
                        <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
                          {track.song.cover_url ? (
                            <img 
                              src={track.song.cover_url}
                              alt={track.song.title}
                              className="h-10 w-10 sm:h-12 sm:w-12 rounded-md object-cover flex-shrink-0"
                            />
                          ) : (
                            <Mic className="h-10 w-10 sm:h-12 sm:w-12 text-primary flex-shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="font-medium flex flex-wrap items-center gap-2">
                              <span className="truncate text-sm sm:text-base">{track.song.title}</span>
                              <Badge variant="secondary" className="text-xs flex-shrink-0">Karaoke</Badge>
                            </div>
                            <div className="text-xs sm:text-sm text-muted-foreground truncate">{track.song.artist}</div>
                            <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-xs text-muted-foreground">
                              {track.song.genre && <span className="truncate">{track.song.genre}</span>}
                              {track.song.is_nft && <Sparkles className="h-3 w-3 flex-shrink-0" />}
                              {track.lyrics_data && <FileText className="h-3 w-3 flex-shrink-0" />}
                              <span>{track.song.play_count} plays</span>
                              <span>{track.song.likes_count} likes</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-end space-x-1 sm:space-x-2 flex-shrink-0">
                          <Button variant="ghost" size="sm" onClick={() => router.push(`/karaoke/create?track=${track.id}`)}>
                            <PlayCircle className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteSong(track.song_id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {karaokeTracks.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Mic className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No karaoke tracks uploaded yet</p>
                        <p className="text-sm">Upload your first karaoke track to get started</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rooms Tab */}
          <TabsContent value="rooms">
            <Card>
              <CardHeader>
                <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                  <div>
                    <CardTitle>My Rooms</CardTitle>
                    <CardDescription>View and manage your karaoke rooms</CardDescription>
                  </div>
                  <Button onClick={() => router.push('/karaoke/create')} className="w-full sm:w-auto">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Room
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px] sm:h-[400px]">
                  <div className="space-y-3 sm:space-y-4">
                    {rooms.map((room) => (
                      <div key={room.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 border rounded-lg space-y-3 sm:space-y-0">
                        <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
                          <Mic className="h-6 w-6 sm:h-8 sm:w-8 text-primary flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate text-sm sm:text-base">{room.name}</div>
                            <div className="text-xs sm:text-sm text-muted-foreground">
                              Created {new Date(room.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-end space-x-2 flex-shrink-0">
                          <div className="flex items-center text-xs sm:text-sm text-muted-foreground">
                            <Users className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                            {room.participants_count}
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => router.push(`/karaoke/${room.id}`)}>
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
            {!uploadPasswordVerified ? (
              <Card>
                <CardHeader className="text-center">
                  <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                    <Lock className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Upload Access Required</CardTitle>
                  <CardDescription>
                    Enter the upload password to access song upload functionality
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleUploadPasswordSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="upload-password">Upload Password</Label>
                      <Input
                        id="upload-password"
                        type="password"
                        value={uploadPasswordInput}
                        onChange={(e) => setUploadPasswordInput(e.target.value)}
                        placeholder="Enter password"
                        required
                      />
                    </div>
                    
                    {uploadPasswordError && (
                      <div className="text-sm text-red-500">{uploadPasswordError}</div>
                    )}
                    
                    <Button type="submit" className="w-full">
                      <Lock className="mr-2 h-4 w-4" />
                      Verify Access
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                    <div>
                      <CardTitle>Upload Song</CardTitle>
                      <CardDescription>Add a new song to your collection</CardDescription>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setUploadPasswordVerified(false)}
                      className="w-full sm:w-auto"
                    >
                      <Lock className="mr-2 h-4 w-4" />
                      Lock
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2 sm:col-span-1">
                      <Label htmlFor="title">Song Title</Label>
                      <Input
                        id="title"
                        value={songTitle}
                        onChange={(e) => setSongTitle(e.target.value)}
                        placeholder="Enter song title"
                      />
                    </div>
                    <div className="grid gap-2 sm:col-span-1">
                      <Label htmlFor="artist">Artist</Label>
                      <Input
                        id="artist"
                        value={songArtist}
                        onChange={(e) => setSongArtist(e.target.value)}
                        placeholder="Enter artist name"
                      />
                    </div>
                    <div className="grid gap-2 sm:col-span-1">
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
                    <div className="grid gap-2 sm:col-span-1">
                      <Label htmlFor="song">Song File (MP3)</Label>
                      <Input
                        id="song"
                        type="file"
                        accept=".mp3"
                        onChange={(e) => setSongFile(e.target.files?.[0] || null)}
                      />
                    </div>
                    <div className="grid gap-2 sm:col-span-1">
                      <Label htmlFor="lyrics">Lyrics File (LRC) - Optional</Label>
                      <Input
                        id="lyrics"
                        type="file"
                        accept=".lrc"
                        onChange={(e) => setLyricsFile(e.target.files?.[0] || null)}
                      />
                    </div>
                    <div className="grid gap-2 sm:col-span-1">
                      <Label htmlFor="image">Cover Image - Optional</Label>
                      <Input
                        id="image"
                        type="file"
                        accept="image/*"
                        onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                      />
                    </div>
                    <div className="flex items-center space-x-2 sm:col-span-2">
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
            )}
          </TabsContent>

          {/* Upload Karaoke Tab */}
          <TabsContent value="upload-karaoke">
            {!uploadPasswordVerified ? (
              <Card>
                <CardHeader className="text-center">
                  <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                    <Lock className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Upload Access Required</CardTitle>
                  <CardDescription>
                    Enter the upload password to access karaoke upload functionality
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleUploadPasswordSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="karaoke-password">Upload Password</Label>
                      <Input
                        id="karaoke-password"
                        type="password"
                        value={uploadPasswordInput}
                        onChange={(e) => setUploadPasswordInput(e.target.value)}
                        placeholder="Enter password"
                        required
                      />
                    </div>
                    
                    {uploadPasswordError && (
                      <div className="text-sm text-red-500">{uploadPasswordError}</div>
                    )}
                    
                    <Button type="submit" className="w-full">
                      <Lock className="mr-2 h-4 w-4" />
                      Verify Access
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                    <div>
                      <CardTitle>Upload Karaoke Track</CardTitle>
                      <CardDescription>Add a new karaoke track with instrumental and lyrics</CardDescription>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setUploadPasswordVerified(false)}
                      className="w-full sm:w-auto"
                    >
                      <Lock className="mr-2 h-4 w-4" />
                      Lock
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="karaoke-title">Song Title</Label>
                      <Input
                        id="karaoke-title"
                        value={karaokeTitle}
                        onChange={(e) => setKaraokeTitle(e.target.value)}
                        placeholder="Enter song title"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="karaoke-artist">Artist</Label>
                      <Input
                        id="karaoke-artist"
                        value={karaokeArtist}
                        onChange={(e) => setKaraokeArtist(e.target.value)}
                        placeholder="Enter artist name"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="karaoke-genre">Genre</Label>
                      <Select value={karaokeGenre} onValueChange={setKaraokeGenre}>
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
                      <Label htmlFor="karaoke-instrumental">Instrumental File (MP3) *</Label>
                      <Input
                        id="karaoke-instrumental"
                        type="file"
                        accept=".mp3,.wav,.m4a"
                        onChange={(e) => setKaraokeInstrumentalFile(e.target.files?.[0] || null)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Upload the instrumental/backing track version of the song
                      </p>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="karaoke-lyrics">Lyrics File (LRC) *</Label>
                      <Input
                        id="karaoke-lyrics"
                        type="file"
                        accept=".lrc,.txt"
                        onChange={(e) => setKaraokeLyricsFile(e.target.files?.[0] || null)}
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        Upload synchronized lyrics in LRC format for karaoke display (required)
                      </p>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="karaoke-cover">Cover Image - Optional</Label>
                      <Input
                        id="karaoke-cover"
                        type="file"
                        accept="image/*"
                        onChange={(e) => setKaraokeCoverFile(e.target.files?.[0] || null)}
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="karaokeIsNft"
                        checked={karaokeIsNft}
                        onChange={(e) => setKaraokeIsNft(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <Label htmlFor="karaokeIsNft">NFT Exclusive</Label>
                    </div>
                  </div>
                  <Button 
                    onClick={handleKaraokeTrackUpload} 
                    disabled={!karaokeInstrumentalFile || !karaokeLyricsFile || !karaokeTitle || !karaokeArtist || karaokeUploading}
                    className="w-full"
                  >
                    {karaokeUploading ? 'Uploading...' : 'Upload Karaoke Track'}
                  </Button>
                </div>
              </CardContent>
            </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
} 