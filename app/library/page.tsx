"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Search, Music, Plus, Clock, ChevronLeft, Grid, List, 
  BarChart, Filter, Download, Play
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { useSongs } from '@/hooks/useSongs'
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
  const { user, loading: authLoading } = useAuth()
  const {
    getTrendingSongs,
    getUserSongs,
    getUserFavorites,
    getUserRecentlyPlayed,
    toggleFavorite,
    recordPlay,
    loading: songsLoading
  } = useSongs()
  const [songs, setSongs] = useState<Song[]>([])
  const [uploadedSongs, setUploadedSongs] = useState<Song[]>([])
  const [favoriteSongs, setFavoriteSongs] = useState<Song[]>([])
  const [recentlyPlayedSongs, setRecentlyPlayedSongs] = useState<Song[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'alphabetical'>('recent')

  useEffect(() => {
    if (user) {
      loadSongs()
    }
  }, [user])

  const loadSongs = async () => {
    if (!user) return
    
    try {
      // Load all songs (trending)
      const allSongs = await getTrendingSongs(100) // Get more for library
      
      // Load user uploaded songs
      const userSongs = await getUserSongs(user.id, 50)
      
      // Load favorite songs
      const favSongs = await getUserFavorites(50)
      
      // Load recently played songs
      const recentSongs = await getUserRecentlyPlayed(20)
      
      setSongs(allSongs as Song[])
      setUploadedSongs(userSongs as Song[])
      setFavoriteSongs(favSongs as Song[])
      setRecentlyPlayedSongs(recentSongs as Song[])
      
    } catch (error) {
      console.error('Error loading songs:', error)
    }
  }

  const handleToggleFavorite = async (songId: string) => {
    if (!user) return
    
    const song = songs.find(s => s._id === songId)
    if (!song) return
    
    const isFavorite = song.is_favorite
    
    // Optimistically update UI
    setSongs(songs.map(s => s._id === songId ? { ...s, is_favorite: !isFavorite } : s))
    
    const success = await toggleFavorite(songId)
    
    if (success) {
      if (isFavorite) {
        // Remove from favorites list
        setFavoriteSongs(favoriteSongs.filter(s => s._id !== songId))
      } else {
        // Add to favorites list
        const songToAdd = songs.find(s => s._id === songId)
        if (songToAdd) {
          setFavoriteSongs([...favoriteSongs, { ...songToAdd, is_favorite: true }])
        }
      }
    } else {
      // Revert optimistic update on failure
      setSongs(songs.map(s => s._id === songId ? { ...s, is_favorite: isFavorite } : s))
    }
  }

  const playSong = async (songId: string) => {
    if (!user) return
    
    // Record play interaction
    await recordPlay(songId, {
      deviceType: 'web',
      playDuration: 0
    })
    
    // Navigate to quick karaoke with song
    router.push(`/karaoke/quick?songId=${songId}`)
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
            variant="secondary" 
            className="rounded-full"
            onClick={() => playSong(song._id)}
          >
            <Play className="h-5 w-5" />
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
            <DropdownMenuItem onClick={() => playSong(song._id)}>
              <Play className="mr-2 h-4 w-4" />
              <span>Play Song</span>
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
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      } else if (sortBy === 'popular') {
        return (b.playCount || 0) - (a.playCount || 0)
      } else {
        return a.title.localeCompare(b.title)
      }
    })
  }

  if (authLoading || songsLoading) {
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
            <p className="text-muted-foreground">Browse and manage your songs</p>
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
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Songs</TabsTrigger>
          <TabsTrigger value="uploaded">Your Uploads</TabsTrigger>
          <TabsTrigger value="favorites">Favorites</TabsTrigger>
          <TabsTrigger value="recent">Recently Played</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="mt-6">
          {songsLoading ? (
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
          {songsLoading ? (
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
          {songsLoading ? (
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
              <h3 className="text-lg font-semibold mb-2">No favorites yet</h3>
              <p className="text-muted-foreground mb-4">
                Mark songs as favorites to find them quickly here
              </p>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="recent" className="mt-6">
          {songsLoading ? (
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
