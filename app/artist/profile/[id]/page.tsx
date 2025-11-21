'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  Play, 
  Pause, 
  Heart, 
  Share2, 
  Music, 
  Users, 
  Calendar,
  MapPin,
  ExternalLink,
  Mic,
  Trophy,
  Clock
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/use-toast'

interface Profile {
  id: string
  username: string
  avatar_url?: string
  bio?: string
  location?: string
  website?: string
  created_at: string
}

interface Song {
  id: string
  title: string
  artist: string
  duration: number
  audio_url: string
  cover_art_url?: string
  genre?: string
  play_count?: number
  created_at: string
  user_id: string
}

interface ArtistStats {
  totalSongs: number
  totalPlays: number
  totalKaraokeTracks: number
  followers: number
  joinedDate: string
}

export default function ArtistProfilePage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = createClientComponentClient()
  
  const artistId = params.id as string
  
  const [profile, setProfile] = useState<Profile | null>(null)
  const [songs, setSongs] = useState<Song[]>([])
  const [karaokeTracks, setKaraokeTracks] = useState<Song[]>([])
  const [stats, setStats] = useState<ArtistStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followBusy, setFollowBusy] = useState(false)
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null)
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (artistId) {
      loadArtistProfile()
    }
  }, [artistId])

  useEffect(() => {
    return () => {
      if (audio) {
        audio.pause()
        audio.src = ''
      }
    }
  }, [audio])

  const loadArtistProfile = useCallback(async () => {
    try {
      setLoading(true)

      // Load artist profile (base info from public.users)
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', artistId)
        .single()

      if (profileError) throw profileError

      // Load extended profile details from user_profile (bio, location, website, display_name)
      let mergedProfile = profileData
      try {
        const { data: extProfile } = await supabase
          .from('user_profile')
          .select('display_name, bio, location, website')
          .eq('user_id', artistId)
          .single()

        if (extProfile) {
          mergedProfile = {
            ...profileData,
            username: extProfile.display_name || profileData.username,
            bio: extProfile.bio || undefined,
            location: extProfile.location || undefined,
            website: extProfile.website || undefined,
          }
        }
      } catch {}

      setProfile(mergedProfile)

      // Load artist's songs
      const { data: songsData, error: songsError } = await supabase
        .from('songs')
        .select('*')
        .eq('user_id', artistId)
        .order('created_at', { ascending: false })

      if (songsError) throw songsError

      // Filter out karaoke songs and regular songs
      const karaokeTrackIds = new Set()
      const { data: karaokeData } = await supabase
        .from('karaoke_tracks')
        .select('song_id')
        .in('song_id', songsData.map(song => song.id))

      if (karaokeData) {
        karaokeData.forEach(track => karaokeTrackIds.add(track.song_id))
      }

      const regularSongs = songsData.filter(song => !karaokeTrackIds.has(song.id))
      const karaokeSongs = songsData.filter(song => karaokeTrackIds.has(song.id))

      setSongs(regularSongs)
      setKaraokeTracks(karaokeSongs)

      // Calculate stats
      const totalPlays = songsData.reduce((sum, song) => sum + (song.play_count || 0), 0)

      // Load follower count for this artist
      let followersCount = 0
      try {
        const { count, error: countError } = await supabase
          .from('user_follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', artistId)

        if (countError) throw countError
        followersCount = count ?? 0
      } catch (e) {
        console.warn('Failed to load followers count', e)
      }

      // Load whether current user follows this artist
      try {
        if (user?.id) {
          const { count: iCount, error: iErr } = await supabase
            .from('user_follows')
            .select('*', { count: 'exact', head: true })
            .eq('follower_id', user.id)
            .eq('following_id', artistId)
          if (iErr) throw iErr
          setIsFollowing((iCount ?? 0) > 0)
        } else {
          setIsFollowing(false)
        }
      } catch (e) {
        console.warn('Failed to determine follow state', e)
      }

      const nextStats: ArtistStats = {
        totalSongs: regularSongs.length,
        totalPlays,
        totalKaraokeTracks: karaokeSongs.length,
        followers: followersCount,
        joinedDate: profileData.created_at
      }
      setStats(nextStats)

    } catch (error) {
      console.error('Error loading artist profile:', error)
      toast({
        title: "Error",
        description: "Failed to load artist profile",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }, [artistId])


  const playSong = async (song: Song) => {
    try {
      if (currentlyPlaying === song.id) {
        // Pause current song
        if (audio) {
          audio.pause()
          setCurrentlyPlaying(null)
        }
        return
      }

      // Stop current audio if playing
      if (audio) {
        audio.pause()
        audio.src = ''
      }

      // Create new audio element
      const newAudio = new Audio()
      
      // Construct the public URL for the audio file
      const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/songs/${song.audio_url}`
      newAudio.src = publicUrl
      
      newAudio.addEventListener('ended', () => {
        setCurrentlyPlaying(null)
      })
      
      newAudio.addEventListener('error', (e) => {
        console.error('Audio error:', e)
        toast({
          title: "Playback Error",
          description: "Failed to play this song",
          variant: "destructive"
        })
        setCurrentlyPlaying(null)
      })

      await newAudio.play()
      setAudio(newAudio)
      setCurrentlyPlaying(song.id)

      // Record play interaction
      await supabase
        .from('user_interactions')
        .insert({
          user_id: user?.id,
          song_id: song.id,
          interaction_type: 'play',
          metadata: { source: 'artist_profile' }
        })

    } catch (error) {
      console.error('Error playing song:', error)
      toast({
        title: "Playback Error",
        description: "Failed to play this song",
        variant: "destructive"
      })
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long'
    })
  }

  const renderSongCard = (song: Song, isKaraoke = false) => (
    <Card key={song.id} className="group hover:shadow-md transition-all duration-200">
      <CardContent className="p-4">
        <div className="flex items-center space-x-4">
          {/* Cover Art */}
          <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gradient-to-br from-purple-500 to-pink-500 flex-shrink-0">
            {song.cover_art_url ? (
              <img 
                src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/songs/${song.cover_art_url}`}
                alt={song.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                {isKaraoke ? (
                  <Mic className="h-6 w-6 text-white" />
                ) : (
                  <Music className="h-6 w-6 text-white" />
                )}
              </div>
            )}
            
            {/* Play Button Overlay */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 rounded-full bg-white/20 hover:bg-white/30"
                onClick={() => playSong(song)}
              >
                {currentlyPlaying === song.id ? (
                  <Pause className="h-4 w-4 text-white" />
                ) : (
                  <Play className="h-4 w-4 text-white ml-0.5" />
                )}
              </Button>
            </div>
          </div>

          {/* Song Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <h3 className="font-semibold text-sm truncate">{song.title}</h3>
              {isKaraoke && (
                <Badge variant="secondary" className="text-xs">
                  <Mic className="h-3 w-3 mr-1" />
                  Karaoke
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground truncate">{song.artist}</p>
            <div className="flex items-center space-x-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center">
                <Clock className="h-3 w-3 mr-1" />
                {formatDuration(song.duration)}
              </span>
              {song.genre && (
                <Badge variant="outline" className="text-xs">
                  {song.genre}
                </Badge>
              )}
              {song.play_count && (
                <span className="flex items-center">
                  <Play className="h-3 w-3 mr-1" />
                  {song.play_count.toLocaleString()}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2">
            {isKaraoke && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push(`/karaoke/create?track=${song.id}`)}
              >
                <Mic className="h-4 w-4 mr-1" />
                Sing
              </Button>
            )}
            <Button size="sm" variant="ghost">
              <Heart className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="flex items-start space-x-6 mb-8">
            <div className="w-32 h-32 bg-secondary rounded-full" />
            <div className="flex-1">
              <div className="h-8 bg-secondary rounded mb-2" />
              <div className="h-4 bg-secondary rounded w-1/3 mb-4" />
              <div className="h-4 bg-secondary rounded w-2/3" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Artist Not Found</h1>
          <p className="text-muted-foreground mb-4">The artist profile you&apos;re looking for doesn&apos;t exist.</p>
          <Button onClick={() => router.push('/discover')}>
            Back to Discover
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Artist Header */}
      <div className="flex flex-col md:flex-row items-start space-y-6 md:space-y-0 md:space-x-8 mb-8">
        {/* Avatar */}
        <Avatar className="w-32 h-32 mx-auto md:mx-0">
          <AvatarImage src={profile.avatar_url} alt={profile.username} />
          <AvatarFallback className="text-2xl">
            {profile.username.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        {/* Artist Info */}
        <div className="flex-1 text-center md:text-left">
          <h1 className="text-3xl font-bold mb-2">{profile.username}</h1>
          
          {/* Stats */}
          {stats && (
            <div className="flex flex-wrap justify-center md:justify-start gap-6 mb-4 text-sm text-muted-foreground">
              <span className="flex items-center">
                <Music className="h-4 w-4 mr-1" />
                {stats.totalSongs} songs
              </span>
              <span className="flex items-center">
                <Mic className="h-4 w-4 mr-1" />
                {stats.totalKaraokeTracks} karaoke tracks
              </span>
              <span className="flex items-center">
                <Users className="h-4 w-4 mr-1" />
                {stats.followers} followers
              </span>
              <span className="flex items-center">
                <Play className="h-4 w-4 mr-1" />
                {stats.totalPlays.toLocaleString()} plays
              </span>
              <span className="flex items-center">
                <Calendar className="h-4 w-4 mr-1" />
                Joined {formatDate(stats.joinedDate)}
              </span>
            </div>
          )}

          {/* Bio */}
          {profile.bio && (
            <p className="text-muted-foreground mb-4 max-w-2xl">{profile.bio}</p>
          )}

          {/* Location & Website */}
          <div className="flex flex-wrap justify-center md:justify-start gap-4 mb-6 text-sm text-muted-foreground">
            {profile.location && (
              <span className="flex items-center">
                <MapPin className="h-4 w-4 mr-1" />
                {profile.location}
              </span>
            )}
            {profile.website && (
              <a 
                href={profile.website} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center hover:text-primary transition-colors"
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Website
              </a>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap justify-center md:justify-start gap-3">
            {user?.id !== artistId && (
              <Button
                disabled={followBusy}
                onClick={async () => {
                  try {
                    if (!user?.id) {
                      toast({ title: 'Login required', description: 'Please sign in to follow artists.' })
                      return
                    }
                    setFollowBusy(true)
                    if (isFollowing) {
                      const { error } = await supabase
                        .from('user_follows')
                        .delete()
                        .eq('follower_id', user.id)
                        .eq('following_id', artistId)
                      if (error) throw error
                      setIsFollowing(false)
                      setStats(prev => prev ? { ...prev, followers: Math.max(0, prev.followers - 1) } : prev)
                      toast({ title: 'Unfollowed', description: `You unfollowed ${profile?.username || 'artist'}.` })
                    } else {
                      const { error } = await supabase
                        .from('user_follows')
                        .insert({ follower_id: user.id, following_id: artistId })
                      if (error) throw error
                      setIsFollowing(true)
                      setStats(prev => prev ? { ...prev, followers: (prev.followers + 1) } : prev)
                      toast({ title: 'Following', description: `You’re now following ${profile?.username || 'artist'}.` })
                    }
                  } catch (e: any) {
                    console.error('Follow toggle failed', e)
                    const msg =
                      e?.code === '42P01' || (typeof e?.message === 'string' && e.message.includes('relation'))
                        ? 'Follow feature setup incomplete: missing user_follows table.'
                        : e?.message || 'Could not update follow'
                    toast({ variant: 'destructive', title: 'Action failed', description: msg })
                  } finally {
                    setFollowBusy(false)
                  }
                }}
              >
                <Heart className="h-4 w-4 mr-2" />
                {isFollowing ? 'Following' : (followBusy ? '...' : 'Follow')}
              </Button>
            )}
            <Button variant="outline">
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          </div>
        </div>
      </div>

      {/* Content Tabs */}
      <Tabs defaultValue="songs" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="songs">
            Songs ({stats?.totalSongs || 0})
          </TabsTrigger>
          <TabsTrigger value="karaoke">
            Karaoke ({stats?.totalKaraokeTracks || 0})
          </TabsTrigger>
        </TabsList>

        {/* Songs Tab */}
        <TabsContent value="songs" className="mt-6">
          {songs.length > 0 ? (
            <div className="space-y-3">
              {songs.map(song => renderSongCard(song, false))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Music className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No songs yet</h3>
              <p className="text-muted-foreground">
                {user?.id === artistId 
                  ? "Upload your first song to get started" 
                  : `${profile.username} hasn't uploaded any songs yet`
                }
              </p>
              {user?.id === artistId && (
                <Button className="mt-4" onClick={() => router.push('/dashboard')}>
                  Upload Song
                </Button>
              )}
            </div>
          )}
        </TabsContent>

        {/* Karaoke Tab */}
        <TabsContent value="karaoke" className="mt-6">
          {karaokeTracks.length > 0 ? (
            <div className="space-y-3">
              {karaokeTracks.map(song => renderSongCard(song, true))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Mic className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No karaoke tracks yet</h3>
              <p className="text-muted-foreground">
                {user?.id === artistId 
                  ? "Upload your first karaoke track to get started" 
                  : `${profile.username} hasn't uploaded any karaoke tracks yet`
                }
              </p>
              {user?.id === artistId && (
                <Button className="mt-4" onClick={() => router.push('/dashboard')}>
                  Upload Karaoke Track
                </Button>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
