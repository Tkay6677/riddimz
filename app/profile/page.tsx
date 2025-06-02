"use client"

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { 
  Edit2, User, Music, Mic, Award, Settings, 
  Save, X, Upload, Calendar, Users, Clock, 
  Heart, PlayCircle
} from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/use-toast'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

// Mock data
const nfts = [
  {
    id: '1',
    name: 'Golden Microphone',
    image: 'https://images.pexels.com/photos/164829/pexels-photo-164829.jpeg',
    creator: 'Riddimz Official',
    type: 'Badge',
    description: 'Awarded for hosting 10+ karaoke rooms'
  },
  {
    id: '2',
    name: 'Cosmic Harmony',
    image: 'https://images.pexels.com/photos/1762851/pexels-photo-1762851.jpeg',
    creator: 'Luna Echo',
    type: 'Song',
    description: 'Exclusive song with unlimited karaoke access'
  },
  {
    id: '3',
    name: 'Virtual Stage - Neon City',
    image: 'https://images.pexels.com/photos/1484516/pexels-photo-1484516.jpeg',
    creator: 'Riddimz Official',
    type: 'Room Theme',
    description: 'Special karaoke room background theme'
  }
]

interface Song {
  id: string;
  title: string;
  artist: string;
  cover_url: string | null;
  created_at: string;
}

interface Room {
  id: string;
  name: string;
  description: string | null;
  is_live: boolean;
  created_at: string;
}

interface DatabasePerformance {
  id: string;
  created_at: string;
  duration: number;
  songs: Song[];
  karaoke_rooms: Room[];
}

interface FormattedPerformance {
  id: string;
  song: string;
  artist: string;
  date: string;
  roomName: string;
  duration: number;
}

export const dynamic = 'force-dynamic'

export default function Profile() {
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [userProfile, setUserProfile] = useState({
    username: '',
    fullName: '',
    bio: '',
    avatar_url: '',
    email: '',
    created_at: '',
    followers: 0,
    following: 0,
    performances: 0
  })
  const [karaokeHistory, setKaraokeHistory] = useState<FormattedPerformance[]>([])
  const [userSongs, setUserSongs] = useState<Song[]>([])
  const [userRooms, setUserRooms] = useState<Room[]>([])
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = createClientComponentClient()
  const [isInitialLoad, setIsInitialLoad] = useState(true)

  useEffect(() => {
    if (user && isInitialLoad) {
      loadUserProfile()
      loadKaraokeHistory()
      loadUserSongs()
      loadUserRooms()
      setIsInitialLoad(false)
    }
  }, [user, isInitialLoad])

  const loadUserProfile = async () => {
    try {
      setLoading(true)
      const { data: profile, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user?.id)
        .single()

      if (error) throw error

      if (profile) {
        setUserProfile({
          username: profile.username || '',
          fullName: profile.full_name || '',
          bio: profile.bio || '',
          avatar_url: profile.avatar_url || '',
          email: profile.email || '',
          created_at: new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          followers: profile.followers_count || 0,
          following: profile.following_count || 0,
          performances: profile.performances_count || 0
        })
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error loading profile",
        description: error.message
      })
    } finally {
      setLoading(false)
    }
  }

  const loadKaraokeHistory = async () => {
    try {
      // First get the performances
      const { data: performances, error: performancesError } = await supabase
        .from('karaoke_performances')
        .select('id, created_at, duration, song_id, room_id')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (performancesError) throw performancesError

      if (performances) {
        // Then get the songs and rooms data
        const songIds = performances.map(p => p.song_id)
        const roomIds = performances.map(p => p.room_id)

        const { data: songs, error: songsError } = await supabase
          .from('songs')
          .select('id, title, artist')
          .in('id', songIds)

        if (songsError) throw songsError

        const { data: rooms, error: roomsError } = await supabase
          .from('karaoke_rooms')
          .select('id, name')
          .in('id', roomIds)

        if (roomsError) throw roomsError

        // Combine the data
        const formattedHistory: FormattedPerformance[] = performances.map(performance => {
          const song = songs?.find(s => s.id === performance.song_id)
          const room = rooms?.find(r => r.id === performance.room_id)

          return {
            id: performance.id,
            song: song?.title || 'Unknown Song',
            artist: song?.artist || 'Unknown Artist',
            date: new Date(performance.created_at).toLocaleDateString(),
            roomName: room?.name || 'Unknown Room',
            duration: performance.duration
          }
        })

        setKaraokeHistory(formattedHistory)
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error loading history",
        description: error.message
      })
    }
  }

  const loadUserSongs = async () => {
    try {
      const { data: songs, error } = await supabase
        .from('songs')
        .select('id, title, artist, cover_url, created_at')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      if (songs) {
        // Transform the cover_url to use Supabase storage URL
        const songsWithUrls = songs.map(song => ({
          ...song,
          cover_url: song.cover_url ? supabase.storage.from('karaoke-songs').getPublicUrl(song.cover_url).data.publicUrl : null
        }))
        setUserSongs(songsWithUrls)
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error loading songs",
        description: error.message
      })
    }
  }

  const loadUserRooms = async () => {
    try {
      const { data: rooms, error } = await supabase
        .from('karaoke_rooms')
        .select('id, name, description, is_live, created_at')
        .eq('host_id', user?.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      if (rooms) {
        setUserRooms(rooms)
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error loading rooms",
        description: error.message
      })
    }
  }

  const handleProfileUpdate = async () => {
    try {
      const { error } = await supabase
        .from('users')
        .update({
          username: userProfile.username,
          full_name: userProfile.fullName,
          bio: userProfile.bio,
          updated_at: new Date().toISOString()
        })
        .eq('id', user?.id)

      if (error) throw error

      toast({
        title: "Profile updated successfully",
        duration: 3000
      })
      setIsEditing(false)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error updating profile",
        description: error.message
      })
    }
  }

  if (loading && isInitialLoad) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="container px-4 max-w-7xl mx-auto py-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sidebar */}
        <div className="space-y-6">
          {/* Profile card */}
          <Card>
            <CardHeader className="relative p-0">
              {/* Cover image */}
              <div className="h-32 overflow-hidden rounded-t-lg">
                <div className="w-full h-full animated-bg"></div>
              </div>
              
              {/* Avatar */}
              <div className="flex justify-center">
                <Avatar className="h-24 w-24 border-4 border-background mt-[-3rem] rounded-full">
                  <AvatarImage src={userProfile.avatar_url} alt={userProfile.username} />
                  <AvatarFallback>{userProfile.username.slice(0, 2)}</AvatarFallback>
                </Avatar>
              </div>
              
              <div className="text-center p-6 pt-2">
                <h2 className="text-2xl font-bold">{userProfile.username}</h2>
                <p className="text-muted-foreground">{userProfile.fullName}</p>
                
                <div className="flex justify-center space-x-6 mt-4">
                  <div className="text-center">
                    <p className="font-bold">{userProfile.followers}</p>
                    <p className="text-xs text-muted-foreground">Followers</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold">{userProfile.following}</p>
                    <p className="text-xs text-muted-foreground">Following</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold">{userProfile.performances}</p>
                    <p className="text-xs text-muted-foreground">Performances</p>
                  </div>
                </div>
                
                <div className="mt-4">
                  {!isEditing ? (
                    <Button 
                      variant="outline" 
                      className="w-full gap-2"
                      onClick={() => setIsEditing(true)}
                    >
                      <Edit2 className="h-4 w-4" />
                      Edit Profile
                    </Button>
                  ) : (
                    <div className="flex space-x-2">
                      <Button 
                        variant="default" 
                        className="flex-1 gap-2"
                        onClick={handleProfileUpdate}
                      >
                        <Save className="h-4 w-4" />
                        Save
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => setIsEditing(false)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              {!isEditing ? (
                <div>
                  <p className="text-sm mb-4">{userProfile.bio}</p>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center text-muted-foreground">
                      <Calendar className="h-4 w-4 mr-2" />
                      Joined {userProfile.created_at}
                    </div>
                    <div className="flex items-center text-muted-foreground">
                      <User className="h-4 w-4 mr-2" />
                      {userProfile.email}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="username">Username</Label>
                    <Input 
                      id="username"
                      value={userProfile.username}
                      onChange={(e) => setUserProfile({...userProfile, username: e.target.value})}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input 
                      id="fullName"
                      value={userProfile.fullName}
                      onChange={(e) => setUserProfile({...userProfile, fullName: e.target.value})}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea 
                      id="bio"
                      value={userProfile.bio}
                      onChange={(e) => setUserProfile({...userProfile, bio: e.target.value})}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Navigation */}
          <Card>
            <CardContent className="p-4">
              <nav className="space-y-1">
                <Button variant="ghost" className="w-full justify-start">
                  <User className="h-4 w-4 mr-2" />
                  Profile
                </Button>
                <Button variant="ghost" className="w-full justify-start">
                  <Music className="h-4 w-4 mr-2" />
                  My Music
                </Button>
                <Button variant="ghost" className="w-full justify-start">
                  <Mic className="h-4 w-4 mr-2" />
                  My Karaoke
                </Button>
                <Button variant="ghost" className="w-full justify-start">
                  <Award className="h-4 w-4 mr-2" />
                  My NFTs
                </Button>
                <Button variant="ghost" className="w-full justify-start">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Button>
              </nav>
            </CardContent>
          </Card>
        </div>
        
        {/* Main content */}
        <div className="md:col-span-2">
          <Tabs defaultValue="history" className="space-y-4">
            <TabsList>
              <TabsTrigger value="history">
                <Mic className="h-4 w-4 mr-2" />
                Performance History
              </TabsTrigger>
              <TabsTrigger value="songs">
                <Music className="h-4 w-4 mr-2" />
                My Songs
              </TabsTrigger>
              <TabsTrigger value="rooms">
                <Users className="h-4 w-4 mr-2" />
                My Rooms
              </TabsTrigger>
            </TabsList>

            <TabsContent value="history" className="space-y-4">
              {karaokeHistory.map((performance) => (
                <Card key={performance.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{performance.song}</h3>
                        <p className="text-sm text-muted-foreground">{performance.artist}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">{performance.date}</p>
                        <p className="text-sm text-muted-foreground">{performance.roomName}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {karaokeHistory.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No performance history yet
                </div>
              )}
            </TabsContent>

            <TabsContent value="songs" className="space-y-4">
              {userSongs.map((song) => (
                <Card key={song.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-4">
                      <div className="h-16 w-16 relative rounded-md overflow-hidden">
                        {song.cover_url ? (
                          <Image
                            src={song.cover_url}
                            alt={song.title}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="w-full h-full bg-muted flex items-center justify-center">
                            <Music className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold">{song.title}</h3>
                        <p className="text-sm text-muted-foreground">{song.artist}</p>
                        <p className="text-xs text-muted-foreground">
                          Added {new Date(song.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon">
                        <PlayCircle className="h-5 w-5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {userSongs.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No songs uploaded yet
                </div>
              )}
            </TabsContent>

            <TabsContent value="rooms" className="space-y-4">
              {userRooms.map((room) => (
                <Card key={room.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{room.name}</h3>
                        <p className="text-sm text-muted-foreground">{room.description}</p>
                        <p className="text-xs text-muted-foreground">
                          Created {new Date(room.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className={`h-2 w-2 rounded-full ${room.is_live ? 'bg-green-500' : 'bg-gray-500'}`} />
                        <span className="text-sm text-muted-foreground">
                          {room.is_live ? 'Live' : 'Offline'}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {userRooms.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No rooms created yet
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}