"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Search, Music, Plus, Clock, ChevronLeft, Grid, List, 
  BarChart, Filter, Download, Play, Pause
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
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
  lyricsUrl?: string
  duration: number
  createdAt: Date
  uploaderId: string
  uploaderUsername: string
  playCount: number
  is_favorite?: boolean
}

export default function LibraryPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { recordPlay, getTrendingSongs, getUserSongs, getUserRecentlyPlayed } = useSongs()
  const { playSong: playGlobalSong, currentSong, isPlaying } = useAudio()
  const [likedSongs, setLikedSongs] = useState<Song[]>([])
  const [songs, setSongs] = useState<Song[]>([])
  const [uploadedSongs, setUploadedSongs] = useState<Song[]>([])
  const [favoriteSongs, setFavoriteSongs] = useState<Song[]>([])
  const [recentlyPlayedSongs, setRecentlyPlayedSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'alphabetical'>('recent')

  const loadSongs = useCallback(async () => {
    if (!user) return
    
    try {
      // Load all songs (trending)
      const allSongs = await getTrendingSongs(100) // Get more for library
      
      // Load user uploaded songs
      const userSongs = await getUserSongs(user.id, 50)
      
      // Load favorite songs directly from Supabase
      const { data: likedSongs, error: likedError } = await supabase
        .from('user_interactions')
        .select(`
          song_id,
          songs (
            id,
            title,
            artist,
            duration,
            audio_url,
            cover_url,
            user_id,
            created_at,
            play_count,
            genre
          )
        `)
        .eq('user_id', user.id)
        .eq('interaction_type', 'like')
        .order('created_at', { ascending: false })

      if (likedError) {
        console.error('Error loading liked songs:', likedError)
      }

      // Get user's liked songs if logged in
      let likedSongIds = new Set()
      if (user) {
        const { data: likedSongsData } = await supabase
          .from('user_interactions')
          .select('song_id')
          .eq('user_id', user.id)
          .eq('interaction_type', 'like')
        
        likedSongIds = new Set(likedSongsData?.map(like => like.song_id) || [])
      }

      // Transform liked songs data
      const transformedLikedSongs = (likedSongs || [])
        .filter(item => item.songs) // Filter out any null songs
        .map((item: any) => ({
          _id: item.songs.id,
          title: item.songs.title,
          artist: item.songs.artist,
          coverArtUrl: item.songs.cover_url ? 
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/karaoke-songs/${item.songs.cover_url}` : 
            undefined,
          audioUrl: item.songs.audio_url ? 
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/karaoke-songs/${item.songs.audio_url}` : 
            undefined,
          uploaderId: item.songs.user_id,
          uploaderUsername: 'User',
          createdAt: new Date(item.songs.created_at),
          playCount: item.songs.play_count || 0,
          duration: item.songs.duration,
          genre: item.songs.genre,
          is_favorite: true
        }))
      
      // Load recently played songs from Supabase user_interactions (same method as liked songs)
      const { data: recentPlays, error: recentError } = await supabase
        .from('user_interactions')
        .select(`
          song_id,
          created_at,
          songs (
            id,
            title,
            artist,
            duration,
            audio_url,
            cover_url,
            user_id,
            created_at,
            play_count,
            genre
          )
        `)
        .eq('user_id', user.id)
        .eq('interaction_type', 'play')
        .order('created_at', { ascending: false })
        .limit(20)

      if (recentError) {
        console.error('Error loading recently played songs:', recentError)
      }

      // Transform recently played songs data and remove duplicates (same method as liked songs)
      const seenSongIds = new Set()
      const transformedRecentSongs = (recentPlays || [])
        .filter(item => {
          if (!item.songs || seenSongIds.has((item.songs as any).id)) {
            return false
          }
          seenSongIds.add((item.songs as any).id)
          return true
        })
        .map((item: any) => ({
          _id: (item.songs as any).id,
          title: (item.songs as any).title,
          artist: (item.songs as any).artist,
          coverArtUrl: (item.songs as any).cover_url ? 
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/karaoke-songs/${(item.songs as any).cover_url}` : 
            undefined,
          audioUrl: (item.songs as any).audio_url ? 
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/karaoke-songs/${(item.songs as any).audio_url}` : 
            undefined,
          uploaderId: (item.songs as any).user_id,
          uploaderUsername: 'User',
          createdAt: new Date((item.songs as any).created_at),
          playCount: (item.songs as any).play_count || 0,
          duration: (item.songs as any).duration,
          genre: (item.songs as any).genre,
          is_favorite: likedSongIds.has((item.songs as any).id),
          lastPlayedAt: new Date(item.created_at)
        }))
      
      setSongs(allSongs as Song[])
      setUploadedSongs(userSongs as Song[])
      setFavoriteSongs(transformedLikedSongs as Song[])
      setLikedSongs(transformedLikedSongs as Song[])
      setRecentlyPlayedSongs(transformedRecentSongs as Song[])
      
    } catch (error) {
      console.error('Error loading songs:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      loadSongs()
    }
  }, [user, loadSongs])

  const handleToggleFavorite = async (songId: string) => {
    if (!user) {
      router.push('/auth/login')
      return
    }
    
    const song = likedSongs.find(s => s._id === songId) || 
                 favoriteSongs.find(s => s._id === songId) ||
                 songs.find(s => s._id === songId)
    if (!song) return
    
    const isFavorite = song.is_favorite
    
    // Optimistically update UI
    setLikedSongs(likedSongs.map(s => s._id === songId ? { ...s, is_favorite: !isFavorite } : s))
    setFavoriteSongs(favoriteSongs.map(s => s._id === songId ? { ...s, is_favorite: !isFavorite } : s))
    setSongs(songs.map(s => s._id === songId ? { ...s, is_favorite: !isFavorite } : s))
    
    try {
      if (isFavorite) {
        // Remove like
        const { error } = await supabase
          .from('user_interactions')
          .delete()
          .eq('user_id', user.id)
          .eq('song_id', songId)
          .eq('interaction_type', 'like')

        if (error) throw error

        // Remove from favorites list
        setFavoriteSongs(favoriteSongs.filter(s => s._id !== songId))
        setLikedSongs(likedSongs.filter(s => s._id !== songId))
      } else {
        // Add like
        const { error } = await supabase
          .from('user_interactions')
          .insert({
            user_id: user.id,
            song_id: songId,
            interaction_type: 'like'
          })

        if (error) throw error

        // Add to favorites list
        if (song) {
          const updatedSong = { ...song, is_favorite: true }
          setFavoriteSongs([...favoriteSongs.filter(s => s._id !== songId), updatedSong])
          setLikedSongs([...likedSongs.filter(s => s._id !== songId), updatedSong])
        }
      }
    } catch (error) {
      console.error('Error toggling favorite:', error)
      // Revert optimistic update on failure
      setLikedSongs(likedSongs.map(s => s._id === songId ? { ...s, is_favorite: isFavorite } : s))
      setFavoriteSongs(favoriteSongs.map(s => s._id === songId ? { ...s, is_favorite: isFavorite } : s))
      setSongs(songs.map(s => s._id === songId ? { ...s, is_favorite: isFavorite } : s))
    }
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

  const handleSongUpload = () => {
    router.push('/upload')
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const renderSongCard = (song: Song) => (
    <Card key={song._id} className={cn(
      "relative group",
      viewMode === 'grid' ? "h-64" : "flex"
    )}>
      <div className={cn(
        viewMode === 'grid' 
          ? "relative h-36 overflow-hidden rounded-t-lg" 
          : "relative w-24 h-24 overflow-hidden"
      )}>
        <img 
          src={song.coverArtUrl || '/images/default-cover.jpg'} 
          alt={song.title} 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Button 
            size="icon" 
            variant="ghost" 
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => playSong(song)}
          >
            {currentSong?._id === song._id && isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
      
      <CardContent className={cn(
        "p-3 space-y-1",
        viewMode === 'list' && "flex-1"
      )}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold truncate">{song.title}</h3>
          <Badge variant="outline" className="text-xs">
            {formatDuration(song.duration)}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{song.artist}</p>
        
        {viewMode === 'list' && (
          <div className="flex items-center mt-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3 mr-1" />
            <span>{new Date(song.createdAt).toLocaleDateString()}</span>
            <Badge variant="secondary" className="ml-2 text-xs">
              {song.playCount || 0} plays
            </Badge>
          </div>
        )}
      </CardContent>
      
      <CardFooter className={cn(
        "p-3 pt-0 flex justify-between",
        viewMode === 'list' && "w-32"
      )}>
        <div className="flex items-center space-x-1 text-xs text-muted-foreground">
          <Avatar className="h-4 w-4">
            <AvatarFallback>{song.uploaderUsername?.slice(0, 1) || 'U'}</AvatarFallback>
          </Avatar>
          <span>{song.uploaderUsername || 'Unknown'}</span>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <circle cx="12" cy="12" r="1" />
                <circle cx="12" cy="5" r="1" />
                <circle cx="12" cy="19" r="1" />
              </svg>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => playSong(song)}>
              {currentSong?._id === song._id && isPlaying ? (
                <>
                  <Pause className="mr-2 h-4 w-4" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  <span>Play Song</span>
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleToggleFavorite(song._id)}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={song.is_favorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-4 w-4">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <span>{song.is_favorite ? 'Remove from Favorites' : 'Add to Favorites'}</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Download className="mr-2 h-4 w-4" />
              <span>Download</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardFooter>
    </Card>
  )

  const filteredSongs = (songsArray: Song[]) => {
    return songsArray.filter(song => 
      song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      song.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
      song.uploaderUsername?.toLowerCase().includes(searchQuery.toLowerCase())
    ).sort((a, b) => {
      if (sortBy === 'recent') {
        // For recently played songs, sort by lastPlayedAt if available, otherwise by createdAt
        const aTime = (a as any).lastPlayedAt ? new Date((a as any).lastPlayedAt).getTime() : new Date(a.createdAt).getTime()
        const bTime = (b as any).lastPlayedAt ? new Date((b as any).lastPlayedAt).getTime() : new Date(b.createdAt).getTime()
        return bTime - aTime
      } else if (sortBy === 'popular') {
        return (b.playCount || 0) - (a.playCount || 0)
      } else {
        return a.title.localeCompare(b.title)
      }
    })
  }

  if (loading) {
    return (
      <div className="container max-w-7xl mx-auto py-8">
        <div className="w-full h-64 flex items-center justify-center">
          <p className="text-lg text-muted-foreground">Loading library...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    router.push('/auth/login?redirect=/library')
    return null
  }

  return (
    <div className="container max-w-7xl mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Your Library</h1>
            <p className="text-muted-foreground">Your liked songs and music collection</p>
          </div>
        </div>
        
        <div className="flex w-full md:w-auto gap-2">
          <Button onClick={handleSongUpload}>
            <Plus className="mr-2 h-5 w-5" />
            Upload Song
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search songs, artists, or users..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSortBy('recent')}>
                <Clock className="mr-2 h-4 w-4" />
                <span>Most Recent</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('popular')}>
                <BarChart className="mr-2 h-4 w-4" />
                <span>Most Popular</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('alphabetical')}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-4 w-4">
                  <path d="m5 3 4 9-4 9" />
                  <path d="M19 3v18" />
                  <path d="M9 12h6" />
                </svg>
                <span>Alphabetical</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('grid')}
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="favorites">
        <div className="overflow-x-auto">
          <TabsList className="inline-flex w-max min-w-full">
            <TabsTrigger value="favorites" className="whitespace-nowrap">Liked Songs</TabsTrigger>
            <TabsTrigger value="uploaded" className="whitespace-nowrap">Your Uploads</TabsTrigger>
            <TabsTrigger value="recent" className="whitespace-nowrap">Recently Played</TabsTrigger>
            <TabsTrigger value="all" className="whitespace-nowrap">All Songs</TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="all" className="mt-6">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-64 rounded-lg bg-secondary animate-pulse" />
              ))}
            </div>
          ) : filteredSongs(songs).length > 0 ? (
            <div className={cn(
              viewMode === 'grid' 
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" 
                : "flex flex-col gap-3"
            )}>
              {filteredSongs(songs).map(song => renderSongCard(song))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Music className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No songs found</h3>
              <p className="text-muted-foreground mb-4">
                Try adjusting your search or upload your first song
              </p>
              <Button onClick={handleSongUpload}>
                <Plus className="mr-2 h-4 w-4" />
                Upload Song
              </Button>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="uploaded" className="mt-6">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-64 rounded-lg bg-secondary animate-pulse" />
              ))}
            </div>
          ) : filteredSongs(uploadedSongs).length > 0 ? (
            <div className={cn(
              viewMode === 'grid' 
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" 
                : "flex flex-col gap-3"
            )}>
              {filteredSongs(uploadedSongs).map(song => renderSongCard(song))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Music className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No uploads yet</h3>
              <p className="text-muted-foreground mb-4">
                Share your favorite karaoke tracks with others
              </p>
              <Button onClick={handleSongUpload}>
                <Plus className="mr-2 h-4 w-4" />
                Upload Song
              </Button>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="favorites" className="mt-6">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-64 rounded-lg bg-secondary animate-pulse" />
              ))}
            </div>
          ) : filteredSongs(favoriteSongs).length > 0 ? (
            <div className={cn(
              viewMode === 'grid' 
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" 
                : "flex flex-col gap-3"
            )}>
              {filteredSongs(favoriteSongs).map(song => renderSongCard(song))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Music className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No liked songs yet</h3>
              <p className="text-muted-foreground mb-4">
                Like songs on the discover page to build your personal collection
              </p>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="recent" className="mt-6">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-64 rounded-lg bg-secondary animate-pulse" />
              ))}
            </div>
          ) : filteredSongs(recentlyPlayedSongs).length > 0 ? (
            <div className={cn(
              viewMode === 'grid' 
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" 
                : "flex flex-col gap-3"
            )}>
              {filteredSongs(recentlyPlayedSongs).map(song => renderSongCard(song))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Music className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No recently played songs</h3>
              <p className="text-muted-foreground mb-4">
                Songs you play will appear here
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
