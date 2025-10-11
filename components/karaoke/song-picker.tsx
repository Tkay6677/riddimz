"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Music, Clock, User, Play } from 'lucide-react';
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
  onSongSelect?: (song: Song) => void;
  selectedSongId?: string;
  onPlayNow?: (song: Song) => void;
  onAddToQueue?: (song: Song) => void;
  showActions?: boolean;
  headerTitle?: string; // optional header title like playlist/queue name
}

export default function SongPicker({ onSongSelect, selectedSongId, onPlayNow, onAddToQueue, showActions = false, headerTitle }: SongPickerProps) {
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
    <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2">Loading songs...</span>
          </div>

    );
  }

  return (
    <div className="space-y-3">
      {headerTitle && (
        <p className="text-xs text-muted-foreground">Playing from {headerTitle}</p>
      )}
      {/* Search and Filter */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
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
          <select
            id="genre"
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none"
          >
            <option value="">All Genres</option>
            {genres.map((genre: string) => (
              <option key={genre} value={genre}>{genre}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Compact list */}
      <ScrollArea className="h-[60vh] md:h-96 w-full rounded-md">
        <div className="py-1">
          {filteredSongs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Music className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No songs found. Try a different search.</p>
            </div>
          ) : (
            filteredSongs.map((song: Song) => (
              <div
                key={song._id || song.id}
                className={`group flex items-center gap-3 px-2 py-2 cursor-pointer hover:bg-muted/60 ${selectedSongId === (song._id || song.id) ? 'bg-muted' : ''}`}
                onClick={() => onSongSelect && onSongSelect(song)}
              >
                {(song.coverUrl || song.cover_url || song.cover_art_url) ? (
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
                    className="w-8 h-8 rounded object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                    <Music className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{song.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{formatDuration(song.duration)}</span>
                  {song.is_karaoke && (
                    <Badge variant="outline" className="text-[10px] px-1">K</Badge>
                  )}
                  {showActions && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={(e) => { e.stopPropagation(); onPlayNow && onPlayNow(song); }}
                        title="Play Now"
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={(e) => { e.stopPropagation(); onAddToQueue && onAddToQueue(song); }}
                        title="Add to Queue"
                      >
                        +
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
