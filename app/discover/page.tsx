"use client"

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Search, Music, Music2, Play, Pause, ChevronRight, ChevronLeft, Filter, 
  TrendingUp, Clock, Users, Headphones, Mic, Star, Calendar, Heart
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/hooks/useAuth'
import { useSongs } from '@/hooks/useSongs'
import { useAudio } from '@/contexts/AudioContext'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

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
        uploaderUsername: 'User', // Would need to join with profiles table for actual username
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
        uploaderUsername: 'User', // Would need to join with profiles table for actual username
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
        uploaderUsername: 'User',
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
          src={song.coverArtUrl || '/images/default-cover.jpg'} 
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
          <h3 className="font-semibold truncate">{song.title}</h3>
          <Badge variant="outline" className="text-xs">
            {formatDuration(song.duration)}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{song.artist}</p>
      </CardContent>
      <CardFooter className="p-4 pt-0 flex items-center justify-between">
        <div className="flex items-center space-x-1">
          <Avatar className="h-4 w-4">
            <AvatarFallback>{song.uploaderUsername?.slice(0, 1) || 'U'}</AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground">{song.uploaderUsername}</span>
        </div>
        <div className="flex items-center space-x-1 text-xs text-muted-foreground">
          <Play className="h-3 w-3" />
          <span>{song.playCount || 0}</span>
        </div>
      </CardFooter>
    </Card>
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
    <div className="container max-w-7xl mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Discover</h1>
          <p className="text-muted-foreground">Find trending songs, artists, and more</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search for songs, artists, or genres..."
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="trending">
        <div className="overflow-x-auto">
          <TabsList className="inline-flex w-max min-w-full">
            <TabsTrigger value="trending" className="whitespace-nowrap">Trending</TabsTrigger>
            <TabsTrigger value="new" className="whitespace-nowrap">New Releases</TabsTrigger>
            <TabsTrigger value="artists" className="whitespace-nowrap">Artists</TabsTrigger>
            <TabsTrigger value="genres" className="whitespace-nowrap">Genres</TabsTrigger>
          </TabsList>
        </div>
        
        {/* Trending Songs Tab */}
        <TabsContent value="trending" className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              Trending Songs
            </h2>
            <Button variant="link" onClick={() => toggleSection('trending')}>
              {expandedSections.trending ? 'Show Less' : 'View All'}
            </Button>
          </div>
          
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-lg bg-secondary animate-pulse" />
              ))}
            </div>
          ) : filteredTrending.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {getDisplayItems(filteredTrending, 'trending').map((song, i) => renderSongCard(song, i))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Music className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {searchQuery ? `No trending songs found for "${searchQuery}"` : 'No trending songs yet'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery ? 'Try a different search term' : 'Check back soon for trending content'}
              </p>
            </div>
          )}
        </TabsContent>
        
        {/* New Releases Tab */}
        <TabsContent value="new" className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold flex items-center">
              <Star className="h-5 w-5 mr-2" />
              New Releases
            </h2>
            <Button variant="link" onClick={() => toggleSection('newReleases')}>
              {expandedSections.newReleases ? 'Show Less' : 'View All'}
            </Button>
          </div>
          
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-lg bg-secondary animate-pulse" />
              ))}
            </div>
          ) : filteredNewReleases.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {getDisplayItems(filteredNewReleases, 'newReleases').map(song => renderSongCard(song))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Music className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {searchQuery ? `No new releases found for "${searchQuery}"` : 'No new releases yet'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery ? 'Try a different search term' : 'Be the first to upload new songs'}
              </p>
              <Button onClick={() => router.push('/upload')}>
                Upload Song
              </Button>
            </div>
          )}
        </TabsContent>
        
        {/* Artists Tab */}
        <TabsContent value="artists" className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Popular Artists
            </h2>
            <Button variant="link" onClick={() => toggleSection('artists')}>
              {expandedSections.artists ? 'Show Less' : 'View All'}
            </Button>
          </div>
          
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center space-y-2">
                  <div className="h-20 w-20 rounded-full bg-secondary animate-pulse" />
                  <div className="h-4 w-24 bg-secondary animate-pulse rounded" />
                  <div className="h-3 w-16 bg-secondary animate-pulse rounded" />
                </div>
              ))}
            </div>
          ) : filteredArtists.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {getDisplayItems(filteredArtists, 'artists').map(artist => renderArtistCard(artist))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {searchQuery ? `No artists found for "${searchQuery}"` : 'No artists found'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery ? 'Try a different search term' : 'Complete your profile to be featured here'}
              </p>
              <Button onClick={() => router.push('/profile')}>
                Update Profile
              </Button>
            </div>
          )}
        </TabsContent>
        
        {/* Genres Tab */}
        <TabsContent value="genres" className="mt-6">
          {selectedGenre && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setSelectedGenre(null)}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Back to Genres
                  </Button>
                  <h3 className="text-xl font-semibold">{selectedGenre} Songs</h3>
                </div>
              </div>
              
              {loadingGenreSongs ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="aspect-square rounded-lg bg-secondary animate-pulse" />
                  ))}
                </div>
              ) : genreSongs.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {genreSongs.map(song => renderSongCard(song))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Music className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No songs found in {selectedGenre}</h3>
                  <p className="text-muted-foreground">This genre doesn&apos;t have any songs yet.</p>
                </div>
              )}
            </div>
          )}
          
          {!selectedGenre && (
            <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold flex items-center">
              <Music2 className="h-5 w-5 mr-2" />
              Popular Genres
            </h2>
            <Button variant="link" onClick={() => toggleSection('genres')}>
              {expandedSections.genres ? 'Show Less' : 'View All'}
            </Button>
          </div>
          
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-24 rounded-lg bg-secondary animate-pulse" />
              ))}
            </div>
          ) : filteredGenres.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {getDisplayItems(filteredGenres, 'genres', 10).map((genre, i) => (
                <Button
                  key={genre.genre}
                  variant="outline"
                  className="h-24 flex flex-col items-center justify-center space-y-2 hover:bg-primary/10"
                  onClick={() => loadGenreSongs(genre.genre)}
                >
                  <span className="text-lg font-semibold">{genre.genre}</span>
                  <Badge variant="secondary">{genre.count} songs</Badge>
                </Button>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Music2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {searchQuery ? `No genres found for "${searchQuery}"` : 'No genres found'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery ? 'Try a different search term' : 'Add genre tags when uploading songs'}
              </p>
            </div>
          )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Weekly Picks */}
      <section className="mt-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold flex items-center">
            <Star className="h-5 w-5 mr-2" />
            Weekly Picks
          </h2>
        </div>
        
        <Card className="bg-gradient-to-r from-primary/20 to-secondary/20 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Badge variant="secondary" className="mb-2">Featured</Badge>
              <h3 className="text-3xl font-bold">Discover the Best Karaoke Songs This Week</h3>
              <p className="text-muted-foreground">
                Our curated selection of the best karaoke tracks to try this week. 
                Perfect for beginners and experienced singers alike.
              </p>
              <Button onClick={() => router.push('/playlists/weekly-picks')}>
                Explore Weekly Picks
              </Button>
            </div>
            <div className="relative aspect-video rounded-lg overflow-hidden hidden md:block">
              <Image 
                src="/images/weekly-picks-cover.jpg" 
                alt="Weekly Picks" 
                fill
                className="object-cover"
                onError={(e) => {
                  e.currentTarget.src = 'https://placehold.co/600x400/3a3a3c/FFFFFF?text=Weekly+Picks'
                }}
              />
            </div>
          </div>
        </Card>
      </section>
    </div>
  )
}
