"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Search, Music, TrendingUp, ChevronLeft, 
  Users, Play, Star, Clock, Music2
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/hooks/useAuth'
import { useSongs } from '@/hooks/useSongs'
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
  const {
    getTrendingSongs,
    getNewReleases,
    getPopularGenres,
    recordPlay,
    loading
  } = useSongs()
  const [searchQuery, setSearchQuery] = useState('')
  
  const [trendingSongs, setTrendingSongs] = useState<Song[]>([])
  const [newReleases, setNewReleases] = useState<Song[]>([])
  const [popularArtists, setPopularArtists] = useState<Artist[]>([])
  const [genres, setGenres] = useState<Genre[]>([])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      // Fetch trending songs from MongoDB
      const trendingSongsData = await getTrendingSongs(8)
      
      // Fetch new releases from MongoDB
      const newReleasesData = await getNewReleases(8)
      
      // Fetch popular genres from MongoDB
      const genresData = await getPopularGenres()
      
      // TODO: Fetch popular artists from Supabase (keeping user data there)
      // For now, using empty array - this would need a separate API call
      const formattedArtists: Artist[] = []
      
      setTrendingSongs(trendingSongsData as Song[])
      setNewReleases(newReleasesData as Song[])
      setPopularArtists(formattedArtists)
      setGenres(genresData)
    } catch (error) {
      console.error('Error loading discover data:', error)
    }
  }

  const playSong = async (songId: string) => {
    // Record the play interaction
    await recordPlay(songId, {
      deviceType: 'web',
      playDuration: 0 // Will be updated when song actually plays
    })
    router.push(`/karaoke/quick?songId=${songId}`)
  }

  const viewArtistProfile = (userId: string) => {
    router.push(`/profile/${userId}`)
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
        <img 
          src={song.coverArtUrl || '/images/default-cover.jpg'} 
          alt={song.title}
          className="object-cover w-full h-full"
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
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              router.push(`/search?q=${encodeURIComponent(searchQuery)}`)
            }
          }}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="trending">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="trending">Trending</TabsTrigger>
          <TabsTrigger value="new">New Releases</TabsTrigger>
          <TabsTrigger value="artists">Artists</TabsTrigger>
          <TabsTrigger value="genres">Genres</TabsTrigger>
        </TabsList>
        
        {/* Trending Songs Tab */}
        <TabsContent value="trending" className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              Trending Songs
            </h2>
            <Button variant="link" onClick={() => router.push('/search?category=trending')}>
              View All
            </Button>
          </div>
          
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-lg bg-secondary animate-pulse" />
              ))}
            </div>
          ) : trendingSongs.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {trendingSongs.map((song, i) => renderSongCard(song, i))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Music className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No trending songs yet</h3>
              <p className="text-muted-foreground mb-4">
                Check back soon for trending content
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
            <Button variant="link" onClick={() => router.push('/search?category=new')}>
              View All
            </Button>
          </div>
          
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-lg bg-secondary animate-pulse" />
              ))}
            </div>
          ) : newReleases.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {newReleases.map(song => renderSongCard(song))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Music className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No new releases yet</h3>
              <p className="text-muted-foreground mb-4">
                Be the first to upload new songs
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
            <Button variant="link" onClick={() => router.push('/search?category=artists')}>
              View All
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
          ) : popularArtists.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {popularArtists.map(artist => renderArtistCard(artist))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No artists found</h3>
              <p className="text-muted-foreground mb-4">
                Complete your profile to be featured here
              </p>
              <Button onClick={() => router.push('/profile')}>
                Update Profile
              </Button>
            </div>
          )}
        </TabsContent>
        
        {/* Genres Tab */}
        <TabsContent value="genres" className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold flex items-center">
              <Music2 className="h-5 w-5 mr-2" />
              Popular Genres
            </h2>
          </div>
          
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-24 rounded-lg bg-secondary animate-pulse" />
              ))}
            </div>
          ) : genres.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {genres.map((genre, i) => (
                <Button
                  key={genre.genre}
                  variant="outline"
                  className="h-24 flex flex-col items-center justify-center space-y-2 hover:bg-primary/10"
                  onClick={() => router.push(`/search?genre=${encodeURIComponent(genre.genre)}`)}
                >
                  <span className="text-lg font-semibold">{genre.genre}</span>
                  <Badge variant="secondary">{genre.count} songs</Badge>
                </Button>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Music2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No genres found</h3>
              <p className="text-muted-foreground mb-4">
                Add genre tags when uploading songs
              </p>
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
              <img 
                src="/images/weekly-picks-cover.jpg" 
                alt="Weekly Picks" 
                className="object-cover w-full h-full"
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
