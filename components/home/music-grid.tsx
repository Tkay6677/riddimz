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
}

interface MusicCardProps {
  track: Track
  isPlaying: boolean
  onPlay: (track: Track) => void
}

function MusicCard({ track, isPlaying, onPlay }: MusicCardProps) {
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
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-black/50 text-white hover:bg-black/70">
          <Heart className="h-4 w-4" />
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
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isShuffled, setIsShuffled] = useState(false)
  const [repeatMode, setRepeatMode] = useState<'off' | 'track' | 'all'>('off')
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [isTextScrolling, setIsTextScrolling] = useState(false)
  const textRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadTracks()
  }, [filter])

  useEffect(() => {
    // Initialize audio element
    if (typeof window !== 'undefined') {
      audioRef.current = new Audio()
      const audio = audioRef.current

      // Set up audio event listeners
      audio.addEventListener('timeupdate', handleTimeUpdate)
      audio.addEventListener('loadedmetadata', handleLoadedMetadata)
      audio.addEventListener('ended', handleEnded)
      audio.addEventListener('play', () => setIsPlaying(true))
      audio.addEventListener('pause', () => setIsPlaying(false))

      return () => {
        audio.removeEventListener('timeupdate', handleTimeUpdate)
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
        audio.removeEventListener('ended', handleEnded)
        audio.removeEventListener('play', () => setIsPlaying(true))
        audio.removeEventListener('pause', () => setIsPlaying(false))
        audio.pause()
        audio.src = ''
      }
    }
  }, [])

  useEffect(() => {
    if (currentTrack && textRef.current) {
      const textWidth = textRef.current.scrollWidth
      const containerWidth = textRef.current.parentElement?.offsetWidth || 0
      
      if (textWidth > containerWidth) {
        setIsTextScrolling(true)
      } else {
        setIsTextScrolling(false)
      }
    }
  }, [currentTrack])

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
    }
  }

  const handleEnded = () => {
    // Play next track or stop
    const currentIndex = tracks.findIndex(track => track.id === currentTrack?.id)
    if (currentIndex < tracks.length - 1) {
      handlePlay(tracks[currentIndex + 1])
    } else {
      setIsPlaying(false)
      setCurrentTrack(null)
    }
  }

  const handlePlay = (track: Track) => {
    if (!audioRef.current) return

    if (currentTrack?.id === track.id) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
    } else {
      setCurrentTrack(track)
      audioRef.current.src = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/karaoke-songs/${track.audio_url}`
      audioRef.current.play()
    }
  }

  const handleSeek = (value: number[]) => {
    if (!audioRef.current) return
    const newTime = value[0]
    audioRef.current.currentTime = newTime
    setCurrentTime(newTime)
  }

  const handleVolumeChange = (value: number[]) => {
    if (!audioRef.current) return
    const newVolume = value[0]
    audioRef.current.volume = newVolume
    setVolume(newVolume)
    setIsMuted(newVolume === 0)
  }

  const toggleMute = () => {
    if (!audioRef.current) return
    if (isMuted) {
      audioRef.current.volume = volume
      setIsMuted(false)
    } else {
      audioRef.current.volume = 0
      setIsMuted(true)
    }
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
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

      if (data) {
        setTracks(data)
      }
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
  
  const toggleExpand = () => {
    setIsExpanded(!isExpanded)
  }

  const toggleShuffle = () => {
    setIsShuffled(!isShuffled)
  }

  const toggleRepeat = () => {
    setRepeatMode(
      repeatMode === 'off' ? 'all' :
      repeatMode === 'all' ? 'track' : 'off'
    )
  }
  
  return (
    <div className="space-y-4">
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-6">
      {limitedTracks.map(track => (
          <MusicCard 
            key={track.id} 
            track={track} 
            isPlaying={currentTrack?.id === track.id && isPlaying}
            onPlay={handlePlay}
          />
        ))}
      </div>

      {/* Mobile-friendly player */}
      {currentTrack && (
        <>
          {/* Mini player */}
          <div 
            className={cn(
              "fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
              "border-t p-2 md:p-4",
              isMobile ? "h-16" : "h-20",
              isExpanded ? "hidden" : "block"
            )}
            onClick={() => setIsExpanded(true)}
          >
            <div className="container max-w-7xl mx-auto">
              <div className="flex items-center justify-between">
                {/* Track info with scrolling text */}
                <div className="flex-1 min-w-0 mr-4">
                  <div className="relative overflow-hidden">
                    <div 
                      ref={textRef}
                      className={cn(
                        "whitespace-nowrap",
                        isTextScrolling && "animate-scroll-text"
                      )}
                    >
                      <span className="font-medium">{currentTrack.title}</span>
                      <span className="text-muted-foreground mx-2">•</span>
                      <span className="text-muted-foreground">{currentTrack.artist}</span>
                    </div>
                </div>
              </div>

                {/* Controls */}
                <div className="flex items-center space-x-2 md:space-x-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-8 w-8 md:h-10 md:w-10",
                      isMobile && "h-7 w-7"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlay(currentTrack);
                    }}
                  >
                    {isPlaying ? (
                      <Pause className={cn("h-4 w-4 md:h-5 md:w-5", isMobile && "h-3 w-3")} />
                    ) : (
                      <Play className={cn("h-4 w-4 md:h-5 md:w-5", isMobile && "h-3 w-3")} />
                    )}
                  </Button>

                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={cn(
                      "h-8 w-8 md:h-10 md:w-10",
                      isMobile && "h-7 w-7"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMute();
                    }}
                  >
                    {isMuted ? (
                      <VolumeX className={cn("h-4 w-4 md:h-5 md:w-5", isMobile && "h-3 w-3")} />
                    ) : (
                      <Volume2 className={cn("h-4 w-4 md:h-5 md:w-5", isMobile && "h-3 w-3")} />
                    )}
                  </Button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="flex items-center space-x-2 mt-2">
                <span className="text-xs text-muted-foreground">
                  {formatTime(currentTime)}
                </span>
                  <Slider
                    value={[currentTime]}
                    max={duration}
                    step={1}
                    onValueChange={handleSeek}
                  className="flex-1"
                  />
                <span className="text-xs text-muted-foreground">
                  {formatTime(duration)}
                </span>
              </div>
            </div>
          </div>

          {/* Expanded player */}
          <div className={cn(
            "fixed inset-0 bg-background z-50 transition-all duration-300",
            isExpanded ? "opacity-100" : "opacity-0 pointer-events-none"
          )}>
            <div className="container max-w-7xl mx-auto h-full flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b">
                <Button variant="ghost" size="icon" onClick={() => setIsExpanded(false)}>
                  <Minimize2 className="h-5 w-5" />
                </Button>
                <div className="flex items-center space-x-4">
                  <Button variant="ghost" size="icon">
                    <Share2 className="h-5 w-5" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <ListMusic className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Main content */}
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="max-w-2xl w-full space-y-8">
                  {/* Cover art */}
                  <div className="aspect-square w-full max-w-md mx-auto relative">
                    <Image
                      src={currentTrack.cover_url ? 
                        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/karaoke-songs/${currentTrack.cover_url}` :
                        'https://images.pexels.com/photos/167092/pexels-photo-167092.jpeg'
                      }
                      alt={currentTrack.title}
                      fill
                      className="object-cover rounded-lg shadow-2xl"
                    />
                  </div>

                  {/* Track info */}
                  <div className="text-center">
                    <h2 className="text-2xl font-bold">{currentTrack.title}</h2>
                    <p className="text-lg text-muted-foreground">{currentTrack.artist}</p>
                    {currentTrack.genre && (
                      <p className="text-sm text-muted-foreground mt-2">{currentTrack.genre}</p>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-2">
                    <Slider
                      value={[currentTime]}
                      max={duration}
                      step={1}
                      onValueChange={handleSeek}
                      className="w-full"
                    />
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className={cn(isShuffled && "text-primary")}
                        onClick={toggleShuffle}
                      >
                        <Shuffle className="h-5 w-5" />
                      </Button>
                      <Button variant="ghost" size="icon">
                        <SkipBack className="h-5 w-5" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-12 w-12 rounded-full"
                        onClick={() => handlePlay(currentTrack)}
                      >
                        {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                      </Button>
                      <Button variant="ghost" size="icon">
                        <SkipForward className="h-5 w-5" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className={cn(
                          repeatMode !== 'off' && "text-primary",
                          repeatMode === 'track' && "text-primary"
                        )}
                        onClick={toggleRepeat}
                      >
                        <Repeat className="h-5 w-5" />
                      </Button>
                    </div>
                    <div className="flex items-center space-x-4">
                      <Button variant="ghost" size="icon">
                        <Heart className="h-5 w-5" />
                      </Button>
                      <div className="flex items-center space-x-2">
                        <Volume2 className="h-5 w-5" />
                        <Slider
                          value={[isMuted ? 0 : volume]}
                          max={1}
                          step={0.01}
                          onValueChange={handleVolumeChange}
                          className="w-24"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}