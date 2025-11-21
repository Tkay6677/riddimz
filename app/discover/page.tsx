"use client"

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Search, Music, Play, Pause, ChevronRight, ChevronLeft, TrendingUp, Users, Mic, Star, Heart
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { useSongs } from '@/hooks/useSongs'
import { useAudio } from '@/contexts/AudioContext'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { KaraokeRooms } from '@/components/home/karaoke-rooms'

interface Song {
  _id: string
  title: string
  artist: string
  coverArtUrl?: string
  audioUrl?: string
  uploaderId: string
  uploaderUsername: string
  createdAt: Date
  playCount: number
  duration: number
  genre?: string
  is_favorite?: boolean
}

interface Artist {
  id: string
  username: string
  avatar_url: string | null
  song_count: number
  follower_count: number
}

interface Genre {
  genre: string
  count: number
}

export default function DiscoverPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { playSong: playGlobalSong, currentSong, isPlaying } = useAudio()
  const {
    getTrendingSongs,
    getNewReleases,
    getPopularGenres,
    recordPlay,
    toggleFavorite,
    loading
  } = useSongs()
  const [searchQuery, setSearchQuery] = useState('')
  
  const [trendingSongs, setTrendingSongs] = useState<Song[]>([])
  const [newReleases, setNewReleases] = useState<Song[]>([])
  const [popularArtists, setPopularArtists] = useState<Artist[]>([])
  const [genres, setGenres] = useState<Genre[]>([])
  
  // Filtered data based on search
  const [filteredTrending, setFilteredTrending] = useState<Song[]>([])
  const [filteredNewReleases, setFilteredNewReleases] = useState<Song[]>([])
  const [filteredArtists, setFilteredArtists] = useState<Artist[]>([])
  const [filteredGenres, setFilteredGenres] = useState<Genre[]>([])
  
  // Genre songs state
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null)
  const [genreSongs, setGenreSongs] = useState<Song[]>([])
  const [loadingGenreSongs, setLoadingGenreSongs] = useState(false)
  
  // Expanded sections state
  const [expandedSections, setExpandedSections] = useState({
    trending: false,
    newReleases: false,
    artists: false,
    genres: false
  })

  // Podcast rooms lightweight state for Discover sections
  interface PodcastRoom {
    id: string
    name: string
    description?: string | null
    host_id: string
    cover_image?: string | null
    is_live?: boolean | null
    created_at?: string | null
  }
  const [podcastRooms, setPodcastRooms] = useState<PodcastRoom[]>([])
  const [loadingPodcasts, setLoadingPodcasts] = useState<boolean>(true)

  const loadData = useCallback(async () => {
    try {
      // Fetch trending songs from Supabase
      const { data: trendingData, error: trendingError } = await supabase
        .from('songs')
        .select('*')
        .order('play_count', { ascending: false })
        .limit(50) // Increased limit to support expand functionality

      if (trendingError) throw trendingError

      // Fetch new releases from Supabase
      const { data: newData, error: newError } = await supabase
        .from('songs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50) // Increased limit to support expand functionality

      if (newError) throw newError

      // Filter out karaoke songs from both trending and new releases
      const { data: karaokeTrackIds } = await supabase
        .from('karaoke_tracks')
        .select('song_id')
      
      const karaokeTrackSongIds = new Set(karaokeTrackIds?.map(track => track.song_id) || [])
      
      const filteredTrending = (trendingData || []).filter(song => !karaokeTrackSongIds.has(song.id))
      const filteredNew = (newData || []).filter(song => !karaokeTrackSongIds.has(song.id))

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

      // Transform Supabase data to match Song interface
      // Load uploader profiles for trending and new releases
      const trendingAndNewUserIds = Array.from(new Set([
        ...filteredTrending.map(s => s.user_id),
        ...filteredNew.map(s => s.user_id),
      ].filter(Boolean)))

      let profileById = new Map<string, { id: string; username: string | null; avatar_url: string | null }>()
      let displayNameById = new Map<string, string | null>()
      if (trendingAndNewUserIds.length > 0) {
        const { data: uploaderProfiles } = await supabase
          .from('users')
          .select('id, username, avatar_url')
          .in('id', trendingAndNewUserIds)

        if (uploaderProfiles) {
          profileById = new Map(uploaderProfiles.map(p => [p.id, p]))
        }

        const { data: uploaderUserProfiles } = await supabase
          .from('user_profile')
          .select('user_id, display_name')
          .in('user_id', trendingAndNewUserIds)

        if (uploaderUserProfiles) {
          displayNameById = new Map(
            uploaderUserProfiles.map(p => [p.user_id as string, (p.display_name as string) || null])
          )
        }
      }

      const transformedTrending = filteredTrending.map(song => ({
        _id: song.id,
        title: song.title,
        artist: song.artist,
        coverArtUrl: song.cover_url ? 
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/karaoke-songs/${song.cover_url}` : 
          undefined,
        audioUrl: song.audio_url ? 
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/karaoke-songs/${song.audio_url}` : 
          undefined,
        uploaderId: song.user_id,
        uploaderUsername: displayNameById.get(song.user_id || '') || profileById.get(song.user_id || '')?.username || 'Unknown',
        createdAt: new Date(song.created_at),
        playCount: song.play_count || 0,
        duration: song.duration,
        genre: song.genre,
        is_favorite: likedSongIds.has(song.id)
      }))

      const transformedNew = filteredNew.map(song => ({
        _id: song.id,
        title: song.title,
        artist: song.artist,
        coverArtUrl: song.cover_url ? 
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/karaoke-songs/${song.cover_url}` : 
          undefined,
        audioUrl: song.audio_url ? 
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/karaoke-songs/${song.audio_url}` : 
          undefined,
        uploaderId: song.user_id,
        uploaderUsername: displayNameById.get(song.user_id || '') || profileById.get(song.user_id || '')?.username || 'Unknown',
        createdAt: new Date(song.created_at),
        playCount: song.play_count || 0,
        duration: song.duration,
        genre: song.genre,
        is_favorite: likedSongIds.has(song.id)
      }))

      // Fetch popular artists from Supabase
      const { data: artistsData, error: artistsError } = await supabase
        .from('songs')
        .select('user_id, artist')
        .not('user_id', 'is', null)

      if (artistsError) throw artistsError

      // Group by artist and count songs
      const artistCounts = (artistsData || []).reduce((acc: any, song) => {
        const key = `${song.user_id}-${song.artist}`
        if (!acc[key]) {
          acc[key] = {
            id: song.user_id,
            username: song.artist,
            avatar_url: null,
            song_count: 0,
            follower_count: 0
          }
        }
        acc[key].song_count++
        return acc
      }, {})

      const formattedArtists = Object.values(artistCounts)
        .sort((a: any, b: any) => b.song_count - a.song_count)
        .slice(0, 50) as Artist[]

      // Get accurate genre counts from all non-karaoke songs in database
      const { data: allSongsForGenres, error: genreError } = await supabase
        .from('songs')
        .select('genre')
        .not('genre', 'is', null)
        .not('id', 'in', `(${Array.from(karaokeTrackSongIds).join(',') || 'null'})`)

      if (genreError) throw genreError

      const genreCounts = (allSongsForGenres || []).reduce((acc: any, song) => {
        if (song.genre) {
          acc[song.genre] = (acc[song.genre] || 0) + 1
        }
        return acc
      }, {})

      const genresData = Object.entries(genreCounts)
        .map(([genre, count]) => ({ genre, count: count as number }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 50)
      
      setTrendingSongs(transformedTrending)
      setNewReleases(transformedNew)
      setPopularArtists(formattedArtists)
      setGenres(genresData)
      
      // Initialize filtered data
      setFilteredTrending(transformedTrending)
      setFilteredNewReleases(transformedNew)
      setFilteredArtists(formattedArtists)
      setFilteredGenres(genresData)
    } catch (error) {
      console.error('Error loading discover data:', error)
    }
  }, [user])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Load podcast rooms for Discover highlights
  const loadPodcastRooms = useCallback(async () => {
    try {
      setLoadingPodcasts(true)
      const { data, error } = await supabase
        .from('podcast_rooms')
        .select('id, name, description, host_id, cover_image, is_live, created_at')
        .order('created_at', { ascending: false })
      if (error) throw error
      setPodcastRooms((data || []) as PodcastRoom[])
    } catch (e) {
      console.error('Error loading podcast rooms:', e)
    } finally {
      setLoadingPodcasts(false)
    }
  }, [])

  useEffect(() => {
    loadPodcastRooms()
  }, [loadPodcastRooms])

  const buildPodcastCoverUrl = (path?: string | null): string | null => {
    if (!path) return null
    if (/^https?:\/\//i.test(path)) return path
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!base) return null
    return `${base}/storage/v1/object/public/podcast-rooms/${path}`
  }


  // Filter data based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredTrending(trendingSongs)
      setFilteredNewReleases(newReleases)
      setFilteredArtists(popularArtists)
      setFilteredGenres(genres)
    } else {
      const query = searchQuery.toLowerCase()
      
      // Filter songs
      const filteredTrendingSongs = trendingSongs.filter(song =>
        song.title.toLowerCase().includes(query) ||
        song.artist.toLowerCase().includes(query) ||
        song.genre?.toLowerCase().includes(query)
      )
      
      const filteredNewSongs = newReleases.filter(song =>
        song.title.toLowerCase().includes(query) ||
        song.artist.toLowerCase().includes(query) ||
        song.genre?.toLowerCase().includes(query)
      )
      
      // Filter artists
      const filteredArtistsList = popularArtists.filter(artist =>
        artist.username.toLowerCase().includes(query)
      )
      
      // Filter genres
      const filteredGenresList = genres.filter(genre =>
        genre.genre.toLowerCase().includes(query)
      )
      
      setFilteredTrending(filteredTrendingSongs)
      setFilteredNewReleases(filteredNewSongs)
      setFilteredArtists(filteredArtistsList)
      setFilteredGenres(filteredGenresList)
    }
  }, [searchQuery, trendingSongs, newReleases, popularArtists, genres])

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const getDisplayItems = (items: any[], section: keyof typeof expandedSections, defaultLimit = 8) => {
    return expandedSections[section] ? items : items.slice(0, defaultLimit)
  }


  const playSong = async (song: Song) => {
    try {
      // Use global audio player
      await playGlobalSong({
        _id: song._id,
        title: song.title,
        artist: song.artist,
        coverArtUrl: song.coverArtUrl,
        audioUrl: song.audioUrl,
        duration: song.duration,
        uploaderUsername: song.uploaderUsername
      })

      // Record the play interaction directly in Supabase (same method as like interactions)
      if (user) {
        try {
          const { error } = await supabase
            .from('user_interactions')
            .insert({
              user_id: user.id,
              song_id: song._id,
              interaction_type: 'play',
              metadata: {
                deviceType: 'web',
                playDuration: 0
              }
            })

          if (error) {
            console.error('Error recording play interaction:', error)
          }
        } catch (error) {
          console.error('Error recording play:', error)
        }
      }

    } catch (error) {
      console.error('Error playing song:', error)
    }
  }

  const viewArtistProfile = (userId: string) => {
    router.push(`/artist/profile/${userId}`)
  }

  const loadGenreSongs = async (genre: string) => {
    setLoadingGenreSongs(true)
    setSelectedGenre(genre)
    
    try {
      // Get karaoke track IDs to exclude
      const { data: karaokeTrackIds } = await supabase
        .from('karaoke_tracks')
        .select('song_id')
      
      const karaokeTrackSongIds = new Set(karaokeTrackIds?.map(track => track.song_id) || [])
      
      // Fetch all songs for the selected genre
      const { data: songsData, error } = await supabase
        .from('songs')
        .select('*')
        .eq('genre', genre)
        .order('play_count', { ascending: false })
      
      if (error) throw error
      
      // Filter out karaoke tracks
      const filteredSongs = (songsData || []).filter(song => !karaokeTrackSongIds.has(song.id))
      
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
      
      // Load uploader profiles for these genre songs
      const genreUserIds = Array.from(new Set(filteredSongs.map(s => s.user_id).filter(Boolean)))
      let genreProfileById = new Map<string, { id: string; username: string | null; avatar_url: string | null }>()
      let genreDisplayNameById = new Map<string, string | null>()
      if (genreUserIds.length > 0) {
        const { data: uploaderProfiles } = await supabase
          .from('users')
          .select('id, username, avatar_url')
          .in('id', genreUserIds)

        if (uploaderProfiles) {
          genreProfileById = new Map(uploaderProfiles.map(p => [p.id, p]))
        }

        const { data: uploaderUserProfiles } = await supabase
          .from('user_profile')
          .select('user_id, display_name')
          .in('user_id', genreUserIds)

        if (uploaderUserProfiles) {
          genreDisplayNameById = new Map(
            uploaderUserProfiles.map(p => [p.user_id as string, (p.display_name as string) || null])
          )
        }
      }

      // Transform to Song interface
      const transformedSongs = filteredSongs.map(song => ({
        _id: song.id,
        title: song.title,
        artist: song.artist,
        coverArtUrl: song.cover_url ? 
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/karaoke-songs/${song.cover_url}` : 
          undefined,
        audioUrl: song.audio_url ? 
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/karaoke-songs/${song.audio_url}` : 
          undefined,
        uploaderId: song.user_id,
        uploaderUsername: genreDisplayNameById.get(song.user_id || '') || genreProfileById.get(song.user_id || '')?.username || 'Unknown',
        createdAt: new Date(song.created_at),
        playCount: song.play_count || 0,
        duration: song.duration,
        genre: song.genre,
        is_favorite: likedSongIds.has(song.id)
      }))
      
      setGenreSongs(transformedSongs)
    } catch (error) {
      console.error('Error loading genre songs:', error)
    } finally {
      setLoadingGenreSongs(false)
    }
  }

  const handleToggleLike = async (songId: string) => {
    if (!user) {
      router.push('/auth/login')
      return
    }

    // Find the song in both arrays and update optimistically
    const updateSongInArray = (songs: Song[]) => 
      songs.map(song => 
        song._id === songId 
          ? { ...song, is_favorite: !song.is_favorite }
          : song
      )

    const originalTrending = [...trendingSongs]
    const originalNewReleases = [...newReleases]
    const originalFilteredTrending = [...filteredTrending]
    const originalFilteredNewReleases = [...filteredNewReleases]

    // Get current like status
    const currentSong = trendingSongs.find(s => s._id === songId) || newReleases.find(s => s._id === songId)
    const isCurrentlyLiked = currentSong?.is_favorite || false

    // Optimistically update UI
    setTrendingSongs(updateSongInArray(trendingSongs))
    setNewReleases(updateSongInArray(newReleases))
    setFilteredTrending(updateSongInArray(filteredTrending))
    setFilteredNewReleases(updateSongInArray(filteredNewReleases))

    try {
      if (isCurrentlyLiked) {
        // Remove like
        const { error } = await supabase
          .from('user_interactions')
          .delete()
          .eq('user_id', user.id)
          .eq('song_id', songId)
          .eq('interaction_type', 'like')

        if (error) throw error
      } else {
        // Add like
        const { error } = await supabase
          .from('user_interactions')
          .insert({
            user_id: user.id,
            song_id: songId,
            interaction_type: 'like',
            metadata: {}
          })

        if (error) throw error
      }
    } catch (error) {
      console.error('Error toggling like:', error)
      // Revert optimistic updates on error
      setTrendingSongs(originalTrending)
      setNewReleases(originalNewReleases)
      setFilteredTrending(originalFilteredTrending)
      setFilteredNewReleases(originalFilteredNewReleases)
    }
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const renderSongCard = (song: Song, index?: number) => (
    <Card key={song._id} className="overflow-hidden">
      <div className="aspect-square relative group">
        {index !== undefined && (
          <div className="absolute top-2 left-2 bg-background/80 rounded-md px-2 py-1 text-sm font-semibold">
            #{index + 1}
          </div>
        )}
        <Image 
          src={song.coverArtUrl || '/riddimz-logo.jpg'} 
          alt={song.title}
          fill
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <Button 
            size="icon" 
            variant="secondary" 
            className="rounded-full"
            onClick={() => playSong(song)}
          >
            {currentSong?._id === song._id && isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5" />
            )}
          </Button>
          <Button 
            size="icon" 
            variant="secondary" 
            className={cn(
              "rounded-full",
              song.is_favorite && "bg-red-500 hover:bg-red-600 text-white"
            )}
            onClick={(e) => {
              e.stopPropagation()
              handleToggleLike(song._id)
            }}
          >
            <Heart className={cn("h-4 w-4", song.is_favorite && "fill-current")} />
          </Button>
        </div>
      </div>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold line-clamp-1 break-words">{song.title}</h3>
          <Badge variant="outline" className="text-xs">
            {formatDuration(song.duration)}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-1 break-words">{song.artist}</p>
      </CardContent>
      <CardFooter className="p-4 pt-0 flex items-center justify-between">
        <div 
          className="flex items-center space-x-1 cursor-pointer group"
          onClick={(e) => { e.stopPropagation(); viewArtistProfile(song.uploaderId) }}
          aria-label={`View ${song.uploaderUsername}'s profile`}
        >
          <Avatar className="h-4 w-4">
            <AvatarFallback>{song.uploaderUsername?.slice(0, 1) || 'U'}</AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground group-hover:underline">{song.uploaderUsername}</span>
        </div>
        <div className="flex items-center space-x-1 text-xs text-muted-foreground">
          <Play className="h-3 w-3" />
          <span>{song.playCount || 0}</span>
        </div>
      </CardFooter>
    </Card>
  )

  const renderPodcastCard = (room: PodcastRoom) => (
    <Link key={room.id} href={`/podcast/${room.id}`}>
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span className="line-clamp-1 break-words" title={room.name}>{room.name}</span>
            {room.is_live ? (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-red-100 text-red-700">
                <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" /> LIVE
              </span>
            ) : (
              <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">OFFLINE</span>
            )}
          </CardTitle>
          {room.description && (
            <div className="text-sm text-muted-foreground line-clamp-2 break-words" title={room.description || ''}>
              {room.description}
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            {room.created_at ? (
              <div className="text-xs text-muted-foreground">Created {new Date(room.created_at).toLocaleDateString()}</div>
            ) : (
              <div className="text-xs text-muted-foreground">Recently created</div>
            )}
            <Button size="sm" variant="secondary">Join Room</Button>
          </div>
        </CardContent>
      </Card>
    </Link>
  )

  const renderArtistCard = (artist: Artist) => (
    <div key={artist.id} className="flex flex-col items-center space-y-2">
      <Avatar className="h-20 w-20">
        <AvatarImage src={artist.avatar_url || undefined} />
        <AvatarFallback>{artist.username?.slice(0, 2) || 'AR'}</AvatarFallback>
      </Avatar>
      <h3 className="font-semibold text-sm text-center">{artist.username}</h3>
      <div className="flex items-center space-x-3 text-xs text-muted-foreground">
        <div className="flex items-center">
          <Music className="h-3 w-3 mr-1" />
          <span>{artist.song_count}</span>
        </div>
        <div className="flex items-center">
          <Users className="h-3 w-3 mr-1" />
          <span>{artist.follower_count}</span>
        </div>
      </div>
      <Button 
        variant="outline" 
        size="sm"
        onClick={() => viewArtistProfile(artist.id)}
      >
        View Profile
      </Button>
    </div>
  )

  return (
    <div className="container max-w-7xl mx-auto py-8 space-y-10">
      {/* Hero: focus on Karaoke & Podcasts */}
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-r from-blue-600 to-violet-600 text-white">
        <div className="grid gap-6 p-8 md:grid-cols-[1.3fr,1fr] items-center">
          <div>
            <div className="flex items-center gap-2 text-sm opacity-90">
              <Mic className="h-4 w-4" /> Live Audio
            </div>
            <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">Discover Karaoke & Podcasts</h1>
            <p className="mt-2 text-sm md:text-base opacity-90">Jump into live rooms or browse trending shows. Music picks below.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/karaoke">
                <Button variant="secondary" className="text-blue-700">Explore Karaoke</Button>
              </Link>
              <Link href="/podcast">
                <Button variant="ghost" className="bg-white/10 text-white hover:bg-white/20">Explore Podcasts</Button>
              </Link>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="relative mx-auto w-full max-w-sm rounded-lg bg-white/10 p-4">
              <div className="flex items-center gap-2 text-xs text-white/90">
                <TrendingUp className="h-3.5 w-3.5" /> Trending Now
              </div>
              <div className="mt-3 space-y-3">
                {podcastRooms.slice(0,3).map(room => (
                  <Link href={`/podcast/${room.id}`} key={room.id} className="block">
                    <div className="flex items-center justify-between rounded-md bg-white/10 p-3 hover:bg-white/20">
                      <div>
                        <p className="text-sm font-medium line-clamp-1 break-words" title={room.name}>{room.name}</p>
                        {room.description && (
                          <p className="text-xs text-white/80 line-clamp-1 break-words" title={room.description || ''}>{room.description}</p>
                        )}
                      </div>
                      {room.is_live ? (
                        <Badge variant="secondary" className="bg-red-500 text-white">LIVE</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-white/30 text-white">OFFLINE</Badge>
                      )}
                    </div>
                  </Link>
                ))}
                {podcastRooms.length === 0 && (
                  <div className="rounded-md bg-white/10 p-3 text-xs text-white/80">
                    No rooms yet. Create one to go live.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Karaoke Highlights */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold flex items-center"><Mic className="h-5 w-5 mr-2" /> Live Karaoke Rooms</h2>
          <Link href="/karaoke"><Button variant="link">View all</Button></Link>
        </div>
        <KaraokeRooms filter="live" limit={6} mobileCarousel />
        <div className="flex items-center justify-between mt-6">
          <h3 className="text-xl font-semibold flex items-center"><TrendingUp className="h-5 w-5 mr-2" /> Trending Karaoke</h3>
          <Link href="/karaoke"><Button variant="link">Explore</Button></Link>
        </div>
        <KaraokeRooms filter="popular" limit={6} mobileCarousel />
      </section>

      {/* Podcast Highlights */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold flex items-center"><Mic className="h-5 w-5 mr-2" /> Podcast Rooms</h2>
          <Link href="/podcast"><Button variant="link">View all</Button></Link>
        </div>
        {loadingPodcasts ? (
          <div className="flex md:grid md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-x-auto md:overflow-visible snap-x snap-mandatory -mx-4 px-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="shrink-0 snap-start w-72 sm:w-80">
                <Card>
                  <CardHeader>
                    <CardTitle>
                      <span className="inline-block h-6 w-40 bg-secondary animate-pulse rounded" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="w-full h-16 bg-secondary animate-pulse rounded" />
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex md:grid md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-x-auto md:overflow-visible snap-x snap-mandatory -mx-4 px-4">
            {podcastRooms.slice(0,6).map(room => (
              <div key={room.id} className="shrink-0 snap-start w-72 sm:w-80">
                {renderPodcastCard(room)}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Music Picks */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold flex items-center"><Music className="h-5 w-5 mr-2" /> Music Picks</h2>
          <Link href="/library"><Button variant="link">More music</Button></Link>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search songs..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold flex items-center"><TrendingUp className="h-5 w-5 mr-2" /> Trending Songs</h3>
            <Button variant="link" onClick={() => toggleSection('trending')}>{expandedSections.trending ? 'Show Less' : 'View All'}</Button>
          </div>
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-lg bg-secondary animate-pulse" />
              ))}
            </div>
          ) : filteredTrending.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {getDisplayItems(filteredTrending, 'trending', 6).map((song, i) => renderSongCard(song, i))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Music className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">{searchQuery ? `No trending songs found for "${searchQuery}"` : 'No trending songs yet'}</h3>
              <p className="text-muted-foreground mb-4">{searchQuery ? 'Try a different search term' : 'Check back soon for trending content'}</p>
            </div>
          )}
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold flex items-center"><Star className="h-5 w-5 mr-2" /> New Releases</h3>
            <Button variant="link" onClick={() => toggleSection('newReleases')}>{expandedSections.newReleases ? 'Show Less' : 'View All'}</Button>
          </div>
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-lg bg-secondary animate-pulse" />
              ))}
            </div>
          ) : filteredNewReleases.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {getDisplayItems(filteredNewReleases, 'newReleases', 6).map(song => renderSongCard(song))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Music className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">{searchQuery ? `No new releases found for "${searchQuery}"` : 'No new releases yet'}</h3>
              <p className="text-muted-foreground mb-4">{searchQuery ? 'Try a different search term' : 'Be the first to upload new songs'}</p>
              <Button onClick={() => router.push('/upload')}>Upload Song</Button>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
