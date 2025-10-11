"use client"

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { 
  Edit2, User, Music, Mic, Award, Settings, 
  Upload, Calendar, Users, Clock, 
  Heart, PlayCircle
} from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
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
  participantCount?: number;
  chatCount?: number;
  sessionDuration?: number;
}

interface RoomStats {
  id: string;
  name: string;
  date: string;
  participantCount: number;
  chatCount: number;
  sessionDuration: number;
  songsPerformed: number;
}

export const dynamic = 'force-dynamic'

export default function Profile() {
  const [loading, setLoading] = useState(true)
  const [userProfile, setUserProfile] = useState({
    username: '',
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
  const [roomStats, setRoomStats] = useState<RoomStats[]>([])
  const [totalStats, setTotalStats] = useState({
    totalRoomsHosted: 0,
    totalParticipants: 0,
    totalChatMessages: 0,
    totalSessionTime: 0,
    totalSongsPerformed: 0
  })
  const { user } = useAuth()
  const { profile } = useProfile(user)
  const { toast } = useToast()
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [isInitialLoad, setIsInitialLoad] = useState(true)

  useEffect(() => {
    if (user && isInitialLoad) {
      loadUserProfile()
      loadKaraokeHistory()
      loadUserSongs()
      loadUserRooms()
      loadRoomStats()
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

  const loadRoomStats = async () => {
    try {
      // Get all rooms hosted by the user
      const { data: rooms, error: roomsError } = await supabase
        .from('karaoke_rooms')
        .select('id, name, created_at, updated_at')
        .eq('host_id', user?.id)
        .order('created_at', { ascending: false })

      if (roomsError) throw roomsError

      if (rooms && rooms.length > 0) {
        const roomIds = rooms.map(room => room.id)
        
        // Get participant counts for each room
        const { data: participantData, error: participantError } = await supabase
          .from('room_participants')
          .select('room_id, user_id')
          .in('room_id', roomIds)

        if (participantError) throw participantError

        // Get chat message counts for each room
        const { data: chatData, error: chatError } = await supabase
          .from('chat_messages')
          .select('room_id, id')
          .in('room_id', roomIds)

        if (chatError) throw chatError

        // Get performance counts for each room
        const { data: performanceData, error: performanceError } = await supabase
          .from('karaoke_performances')
          .select('room_id, id')
          .in('room_id', roomIds)

        if (performanceError) throw performanceError

        // Calculate stats for each room
        const stats: RoomStats[] = rooms.map(room => {
          const participants = participantData?.filter(p => p.room_id === room.id) || []
          const chats = chatData?.filter(c => c.room_id === room.id) || []
          const performances = performanceData?.filter(p => p.room_id === room.id) || []
          
          // Calculate session duration (difference between created_at and updated_at)
          const sessionDuration = room.updated_at 
            ? Math.floor((new Date(room.updated_at).getTime() - new Date(room.created_at).getTime()) / (1000 * 60))
            : 0

          return {
            id: room.id,
            name: room.name,
            date: new Date(room.created_at).toLocaleDateString(),
            participantCount: participants.length,
            chatCount: chats.length,
            sessionDuration,
            songsPerformed: performances.length
          }
        })

        setRoomStats(stats)

        // Calculate total stats
        const totals = stats.reduce((acc, room) => ({
          totalRoomsHosted: acc.totalRoomsHosted + 1,
          totalParticipants: acc.totalParticipants + room.participantCount,
          totalChatMessages: acc.totalChatMessages + room.chatCount,
          totalSessionTime: acc.totalSessionTime + room.sessionDuration,
          totalSongsPerformed: acc.totalSongsPerformed + room.songsPerformed
        }), {
          totalRoomsHosted: 0,
          totalParticipants: 0,
          totalChatMessages: 0,
          totalSessionTime: 0,
          totalSongsPerformed: 0
        })

        setTotalStats(totals)
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error loading room statistics",
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
            <div className="relative">
              {/* Cover image */}
              <div className="h-32 overflow-hidden rounded-t-lg">
                <div className="w-full h-full animated-bg"></div>
              </div>
              
              {/* Avatar */}
              <div className="flex justify-center">
                <Avatar className="h-24 w-24 border-4 border-background mt-[-3rem] rounded-full">
                  <AvatarImage src={profile?.profile_banner_url || userProfile.avatar_url} alt={profile?.display_name || userProfile.username} />
                  <AvatarFallback>{(profile?.display_name || userProfile.username).slice(0, 2)}</AvatarFallback>
                </Avatar>
              </div>
            </div>
            
            <CardContent className="text-center p-6 pt-2">
              <h2 className="text-2xl font-bold">{profile?.display_name || userProfile.username}</h2>
              <p className="text-muted-foreground">{user?.email || userProfile.email}</p>
              
              <div className="grid grid-cols-2 gap-4 text-center mt-4">
                <div>
                  <p className="text-2xl font-bold">{userProfile.followers}</p>
                  <p className="text-sm text-muted-foreground">Followers</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{userProfile.following}</p>
                  <p className="text-sm text-muted-foreground">Following</p>
                </div>
              </div>
              
              <Separator className="my-4" />
              
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Performance Stats</h3>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div>
                    <p className="text-lg font-bold text-purple-600">{totalStats.totalRoomsHosted}</p>
                    <p className="text-xs text-muted-foreground">Rooms Hosted</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-purple-600">{totalStats.totalParticipants}</p>
                    <p className="text-xs text-muted-foreground">Total Participants</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-purple-600">{totalStats.totalSongsPerformed}</p>
                    <p className="text-xs text-muted-foreground">Songs Performed</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-purple-600">{Math.floor(totalStats.totalSessionTime / 60)}h {totalStats.totalSessionTime % 60}m</p>
                    <p className="text-xs text-muted-foreground">Total Time</p>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-purple-600">{totalStats.totalChatMessages}</p>
                  <p className="text-xs text-muted-foreground">Chat Messages</p>
                </div>
              </div>
              
              <div className="mt-4">
                <Button 
                  variant="outline" 
                  className="w-full gap-2"
                  onClick={() => router.push('/settings')}
                >
                  <Edit2 className="h-4 w-4" />
                  Edit Profile
                </Button>
              </div>
              
              <div className="space-y-2 text-sm mt-4">
                <div className="flex items-center text-muted-foreground">
                  <Calendar className="h-4 w-4 mr-2" />
                  Joined {userProfile.created_at}
                </div>
                <div className="flex items-center text-muted-foreground">
                  <User className="h-4 w-4 mr-2" />
                  {userProfile.email}
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Navigation */}
          <Card>
            <CardContent className="p-4">
              <nav className="space-y-1">
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
            <div className="overflow-x-auto">
              <TabsList className="inline-flex w-max min-w-full">
                <TabsTrigger value="history" className="whitespace-nowrap">
                  <Mic className="h-4 w-4 mr-2" />
                  Performance History
                </TabsTrigger>
                <TabsTrigger value="songs" className="whitespace-nowrap">
                  <Music className="h-4 w-4 mr-2" />
                  My Songs
                </TabsTrigger>
                <TabsTrigger value="rooms" className="whitespace-nowrap">
                  <Users className="h-4 w-4 mr-2" />
                  My Rooms
                </TabsTrigger>
                <TabsTrigger value="stats" className="whitespace-nowrap">
                  <Award className="h-4 w-4 mr-2" />
                  Statistics
                </TabsTrigger>
              </TabsList>
            </div>
            
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
            
            <TabsContent value="stats" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Room Statistics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Rooms Hosted</span>
                        <span className="font-semibold">{totalStats.totalRoomsHosted}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Participants</span>
                        <span className="font-semibold">{totalStats.totalParticipants}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Average Participants</span>
                        <span className="font-semibold">
                          {totalStats.totalRoomsHosted > 0 ? Math.round(totalStats.totalParticipants / totalStats.totalRoomsHosted) : 0}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Time & Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Session Time</span>
                        <span className="font-semibold">
                          {Math.floor(totalStats.totalSessionTime / 60)}h {totalStats.totalSessionTime % 60}m
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Chat Messages</span>
                        <span className="font-semibold">{totalStats.totalChatMessages}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Songs Performed</span>
                        <span className="font-semibold">{totalStats.totalSongsPerformed}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Room Performance Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    <div className="space-y-3">
                      {roomStats.map((room) => (
                        <div key={room.id} className="border rounded-lg p-3">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-semibold">{room.name}</h4>
                            <span className="text-xs text-muted-foreground">{room.date}</span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                            <div className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              <span>{room.participantCount}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Heart className="h-3 w-3" />
                              <span>{room.chatCount}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>{room.sessionDuration}m</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Music className="h-3 w-3" />
                              <span>{room.songsPerformed}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                      {roomStats.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          No room statistics available
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}