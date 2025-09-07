"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Music, Clock, User, Mic } from 'lucide-react';
import { useSongs } from '@/hooks/useSongs';
import { supabase } from '@/lib/supabase';

interface Song {
  _id?: string;
  id?: string;
  title: string;
  artist: string;
  genre?: string;
  duration: number;
  audioUrl?: string;
  audio_url?: string;
  lyricsUrl?: string;
  lyrics_url?: string;
  coverUrl?: string;
  cover_url?: string;
  cover_art_url?: string;
  is_karaoke?: boolean;
  user_id?: string;
}

interface SongPickerProps {
  onSongSelect: (song: Song) => void;
  selectedSongId?: string;
}

export default function SongPicker({ onSongSelect, selectedSongId }: SongPickerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [songs, setSongs] = useState<any[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const { loading, getTrendingSongs, getPopularGenres } = useSongs();

  useEffect(() => {
    const loadSongs = async () => {
      try {
        // Load MongoDB songs
        const mongoSongs = await getTrendingSongs(100);
        
        // Load karaoke tracks from database with joined song data
        const { data: karaokeData, error } = await supabase
          .from('karaoke_tracks')
          .select(`
            id,
            instrumental_url,
            lyrics_data,
            song:songs(
              id,
              title,
              artist,
              duration,
              cover_url,
              genre,
              is_nft
            )
          `)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error loading karaoke tracks:', error);
        }

        // Transform karaoke tracks to match interface
        const transformedKaraokeSongs = (karaokeData || []).map(track => {
          if (!track.song) return null;
          
          const audioUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/karaoke-songs/${track.instrumental_url}`;
          let lyricsText = '';
          if (track.lyrics_data && track.lyrics_data.content) {
            lyricsText = track.lyrics_data.content;
          }

          return {
            _id: track.id,
            id: track.id,
            songId: (track as any).song.id, // Add the actual song table ID
            title: (track as any).song.title,
            artist: (track as any).song.artist,
            duration: (track as any).song.duration,
            audioUrl: audioUrl,
            audio_url: audioUrl,
            lyricsUrl: lyricsText,
            lyrics_url: lyricsText,
            coverUrl: (track as any).song.cover_url,
            cover_url: (track as any).song.cover_url,
            cover_art_url: (track as any).song.cover_url,
            is_karaoke: true,
            genre: (track as any).song.genre
          };
        }).filter(Boolean);

        // Combine both sources
        const allSongs = [...mongoSongs, ...transformedKaraokeSongs];
        setSongs(allSongs);
        
        // Extract genres from all songs (both MongoDB and karaoke tracks)
        const allGenres = new Set<string>();
        allSongs.forEach(song => {
          if (song && song.genre) {
            allGenres.add(song.genre);
          }
        });
        
        // Also get genres from MongoDB
        try {
          const genresData = await getPopularGenres();
          genresData.forEach(g => allGenres.add(g.genre));
        } catch (e) {
          console.warn('Could not load MongoDB genres:', e);
        }
        
        setGenres(Array.from(allGenres).sort());
      } catch (error) {
        console.error('Error loading songs:', error);
      }
    };
    
    loadSongs();
  }, [getTrendingSongs, getPopularGenres]);

  const filteredSongs = songs.filter((song: Song) => {
    const matchesSearch = searchTerm === '' || 
      song.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      song.artist.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesGenre = selectedGenre === '' || song.genre === selectedGenre;
    
    return matchesSearch && matchesGenre;
  });

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Select a Song</CardTitle>
          <CardDescription>Choose from available songs in the database</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2">Loading songs...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Select a Song</CardTitle>
        <CardDescription>Choose from {songs?.length || 0} available songs in the database</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and Filter */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="search">Search Songs</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search by title or artist..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="genre">Filter by Genre</Label>
            <select
              id="genre"
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">All Genres</option>
              {genres.map((genre: string) => (
                <option key={genre} value={genre}>{genre}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Songs List */}
        <ScrollArea className="h-96 w-full rounded-md border">
          <div className="p-4 space-y-3">
            {filteredSongs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No songs found matching your criteria</p>
                <p className="text-sm">Try adjusting your search or filter</p>
              </div>
            ) : (
              filteredSongs.map((song: Song) => (
                <Card
                  key={song._id || song.id}
                  className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                    selectedSongId === (song._id || song.id) ? 'ring-2 ring-primary bg-muted' : ''
                  }`}
                  onClick={() => onSongSelect(song)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{song.title}</h4>
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span className="truncate">{song.artist}</span>
                        </div>
                        <div className="flex items-center gap-4 mt-2">
                          <Badge variant="secondary" className="text-xs">
                            {song.genre}
                          </Badge>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatDuration(song.duration)}
                          </div>
                        </div>
                      </div>
                      
                      {(song.coverUrl || song.cover_url || song.cover_art_url) && (
                        <img
                          src={
                            song.coverUrl?.startsWith('http') 
                              ? song.coverUrl 
                              : song.cover_url?.startsWith('http')
                              ? song.cover_url
                              : song.cover_art_url?.startsWith('http')
                              ? song.cover_art_url
                              : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/karaoke-songs/${song.coverUrl || song.cover_url || song.cover_art_url}`
                          }
                          alt={`${song.title} cover`}
                          className="w-12 h-12 rounded-md object-cover ml-4 flex-shrink-0"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                      {(song.audioUrl || song.audio_url) && (
                        <Badge variant="outline" className="text-xs">
                          <Music className="h-3 w-3 mr-1" />
                          Audio
                        </Badge>
                      )}
                      {(song.lyricsUrl || song.lyrics_url) && (
                        <Badge variant="outline" className="text-xs">
                          Lyrics
                        </Badge>
                      )}
                      {song.is_karaoke && (
                        <Badge variant="outline" className="text-xs bg-purple-100 text-purple-800">
                          <Music className="h-3 w-3 mr-1" />
                          Karaoke
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>

        {selectedSongId && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-800">
              ✓ Song selected! You can now create your karaoke room.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
