"use client"

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { 
  Play, Pause, Heart, MoreHorizontal, SkipBack, SkipForward, 
  Volume2, VolumeX, Shuffle, Repeat, Maximize2, Minimize2,
  Share2, ListMusic, Clock
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { supabase } from '@/lib/supabase'
import { useMediaQuery } from '@/hooks/use-media-query'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useAudio } from '@/contexts/AudioContext'

interface Track {
  id: string
  title: string
  artist: string
  cover_url?: string
  is_nft: boolean
  genre?: string
  play_count: number
  likes_count: number
  audio_url: string
  is_favorite?: boolean
}

interface MusicCardProps {
  track: Track
  isPlaying: boolean
  onPlay: (track: Track) => void
  onToggleFavorite: (trackId: string) => void
}

function MusicCard({ track, isPlaying, onPlay, onToggleFavorite }: MusicCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  
  return (
    <div 
      className={cn(
        "group relative rounded-md overflow-hidden card-hover-effect",
        isHovered ? "shadow-lg" : "shadow"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/*<Link href={`/music/${track.id}`}>*/}
        <div className="aspect-square w-full relative">
          <Image
            src={track.cover_url ? 
              `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/karaoke-songs/${track.cover_url}` :
              'https://images.pexels.com/photos/167092/pexels-photo-167092.jpeg'
            }
            alt={track.title}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-110"
          />
          <div className={cn(
            "absolute inset-0 bg-black/0 transition-all duration-300",
            isHovered ? "bg-black/40" : ""
          )} />
        </div>
      {/*</Link>*/}
      
      {/* Play/Pause button */}
      <button
        className={cn(
          "absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2",
          "bg-white/90 hover:bg-white text-black rounded-full p-3",
          "transition-all duration-300",
          isHovered ? "opacity-100 scale-100" : "opacity-0 scale-75"
        )}
        onClick={() => onPlay(track)}
      >
        {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
      </button>
      
      {/* NFT badge */}
      {track.is_nft && (
        <span className="absolute top-2 left-2 nft-badge">
          NFT
        </span>
      )}
      
      {/* Like and options */}
      <div className={cn(
        "absolute top-2 right-2 flex space-x-1",
        isHovered ? "opacity-100" : "opacity-0"
      )}>
        <Button 
          variant="ghost" 
          size="icon" 
          className={cn(
            "h-8 w-8 rounded-full bg-black/50 text-white hover:bg-black/70",
            track.is_favorite && "text-red-500"
          )}
          onClick={(e) => {
            e.stopPropagation()
            onToggleFavorite(track.id)
          }}
        >
          <Heart className={cn("h-4 w-4", track.is_favorite && "fill-current")} />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-black/50 text-white hover:bg-black/70">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Add to playlist</DropdownMenuItem>
            <DropdownMenuItem>Share</DropdownMenuItem>
            <DropdownMenuItem>View artist</DropdownMenuItem>
            {track.is_nft && <DropdownMenuItem>View NFT details</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      {/* Track info */}
      <div className="p-4">
        <h3 className="font-semibold text-foreground truncate">{track.title}</h3>
        <p className="text-sm text-muted-foreground truncate">{track.artist}</p>
        <p className="text-xs text-muted-foreground mt-1">{track.genre}</p>
      </div>
    </div>
  )
}

interface MusicGridProps {
  limit?: number
  filter?: string
}

export function MusicGrid({ limit = 8, filter }: MusicGridProps) {
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const router = useRouter()
  const { currentSong, isPlaying: globalIsPlaying, playSong, pauseSong, resumeSong } = useAudio()

  useEffect(() => {
    loadTracks()
  }, [filter])

  const handlePlay = async (track: Track) => {
    const song = {
      _id: track.id,
      title: track.title,
      artist: track.artist,
      coverArtUrl: track.cover_url ? 
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/karaoke-songs/${track.cover_url}` :
        undefined,
      audioUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/karaoke-songs/${track.audio_url}`,
      duration: 0, // Will be set by audio context
      uploaderUsername: 'User'
    }

    if (currentSong?._id === track.id) {
      if (globalIsPlaying) {
        pauseSong()
      } else {
        resumeSong()
      }
    } else {
      await playSong(song)
    }
  }


  const loadTracks = async () => {
    try {
      setLoading(true)
      let query = supabase
        .from('songs')
        .select('*')
        .order('created_at', { ascending: false })

      // Apply filters
      switch (filter) {
        case 'trending':
          query = query.order('trending_score', { ascending: false })
          break
        case 'new':
          query = query.order('created_at', { ascending: false })
          break
        case 'nft':
          query = query.eq('is_nft', true)
          break
      }

      const { data, error } = await query

      if (error) throw error

      // Filter out karaoke songs (songs that have associated karaoke tracks)
      let filteredData = data || []
      if (data) {
        const { data: karaokeTrackIds } = await supabase
          .from('karaoke_tracks')
          .select('song_id')
        
        const karaokeTrackSongIds = new Set(karaokeTrackIds?.map(track => track.song_id) || [])
        filteredData = data.filter(song => !karaokeTrackSongIds.has(song.id))
      }

      // Get user's liked songs if logged in
      let likedSongIds = new Set()
      if (user) {
        const { data: likedSongs } = await supabase
          .from('user_interactions')
          .select('song_id')
          .eq('user_id', user.id)
          .eq('interaction_type', 'like')
        
        likedSongIds = new Set(likedSongs?.map(like => like.song_id) || [])
      }

      // Add is_favorite property to tracks
      const tracksWithFavorites = filteredData.map(track => ({
        ...track,
        is_favorite: likedSongIds.has(track.id)
      }))

      setTracks(tracksWithFavorites)
    } catch (error) {
      console.error('Error loading tracks:', error)
    } finally {
      setLoading(false)
    }
  }

  const limitedTracks = tracks.slice(0, limit)
  
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-6">
        {Array.from({ length: limit }).map((_, i) => (
          <div key={i} className="aspect-square rounded-md bg-secondary animate-pulse" />
        ))}
      </div>
    )
  }
  

  const handleToggleFavorite = async (trackId: string) => {
    if (!user) {
      router.push('/auth/login')
      return
    }
    
    const track = tracks.find(t => t.id === trackId)
    if (!track) return
    
    const isFavorite = track.is_favorite
    
    // Optimistically update UI
    setTracks(tracks.map(t => t.id === trackId ? { ...t, is_favorite: !isFavorite } : t))
    
    try {
      if (isFavorite) {
        // Remove like
        const { error } = await supabase
          .from('user_interactions')
          .delete()
          .eq('user_id', user.id)
          .eq('song_id', trackId)
          .eq('interaction_type', 'like')

        if (error) throw error
      } else {
        // Add like
        const { error } = await supabase
          .from('user_interactions')
          .insert({
            user_id: user.id,
            song_id: trackId,
            interaction_type: 'like'
          })

        if (error) throw error
      }
    } catch (error) {
      console.error('Error toggling favorite:', error)
      // Revert optimistic update on error
      setTracks(tracks.map(t => t.id === trackId ? { ...t, is_favorite: isFavorite } : t))
    }
  }
  
  return (
    <div className="space-y-4">
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-6">
      {limitedTracks.map(track => (
          <MusicCard 
            key={track.id} 
            track={track} 
            isPlaying={currentSong?._id === track.id && globalIsPlaying}
            onPlay={handlePlay}
            onToggleFavorite={handleToggleFavorite}
          />
        ))}
      </div>

    </div>
  )
}