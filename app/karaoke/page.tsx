"use client"

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Search, Mic, Users, Music, Plus, 
  Crown, Clock, TrendingUp, Star 
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

interface Room {
  id: string
  name: string
  host: {
    id: string
    username: string
    avatar_url: string | null
  }
  current_song?: {
    title: string
    artist: string
  } | null
  participants_count: number
  current_participants: number
  is_live: boolean
  created_at: string
}

export default function KaraokePage() {
  const router = useRouter()
  const { user } = useAuth()
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'live' | 'trending'>('all')

  const loadRooms = useCallback(async () => {
    try {
      setLoading(true)
      let query = supabase
        .from('karaoke_rooms')
        .select(`
          *,
          host:users!karaoke_rooms_host_id_fkey (
            username,
            avatar_url
          ),
          participants:room_participants (
            user_id
          )
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (activeFilter === 'live') {
        query = query.eq('is_live', true)
      } else if (activeFilter === 'trending') {
        // We'll sort by participant count on the client after fetching
      }

      const { data, error } = await query

      if (error) throw error

      if (data) {
        // Prefer server-tracked current_participants; fallback to visible participants length (may be restricted by RLS)
        const transformedRooms = data.map((room: any) => {
          const count = typeof room.current_participants === 'number'
            ? room.current_participants
            : (Array.isArray(room.participants) ? room.participants.length : 0)
          return {
            ...room,
            participants_count: count,
            current_participants: count,
          } as Room
        })

        const sortedRooms = activeFilter === 'trending'
          ? transformedRooms.sort((a, b) => b.participants_count - a.participants_count)
          : transformedRooms
        
        setRooms(sortedRooms)
      }
    } catch (error) {
      console.error('Error loading rooms:', error)
    } finally {
      setLoading(false)
    }
  }, [activeFilter])

  useEffect(() => {
    loadRooms()
  }, [activeFilter, loadRooms])

  const filteredRooms = rooms.filter(room => 
    room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    room.host.username.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleCreateRoom = () => {
    if (!user) {
      router.push('/login?redirect=/karaoke')
      return
    }
    router.push('/karaoke/create')
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffInSeconds < 60) return 'just now'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
    return `${Math.floor(diffInSeconds / 86400)}d ago`
  }

  return (
    <div className="container max-w-7xl mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
        <div>
          <h1 className="text-3xl font-bold">Karaoke Rooms</h1>
          <p className="text-muted-foreground">Join a room or create your own</p>
        </div>
        <div className="flex w-full md:w-auto gap-2">
          <Button 
            size="lg" 
            onClick={handleCreateRoom}
            className="w-full md:w-auto"
          >
            <Plus className="mr-2 h-5 w-5" />
            Create Room
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => router.push('/karaoke/quick')}
            className="w-full md:w-auto"
          >
            <Music className="mr-2 h-5 w-5" />
            Quick Karaoke
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search rooms or hosts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={activeFilter === 'all' ? 'default' : 'outline'}
            onClick={() => setActiveFilter('all')}
          >
            All
          </Button>
          <Button
            variant={activeFilter === 'live' ? 'default' : 'outline'}
            onClick={() => setActiveFilter('live')}
          >
            <Mic className="mr-2 h-4 w-4" />
            Live
          </Button>
          <Button
            variant={activeFilter === 'trending' ? 'default' : 'outline'}
            onClick={() => setActiveFilter('trending')}
          >
            <TrendingUp className="mr-2 h-4 w-4" />
            Trending
          </Button>
        </div>
      </div>

      {/* Rooms Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 rounded-lg bg-secondary animate-pulse" />
          ))}
        </div>
      ) : filteredRooms.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div key="quick" className="group relative rounded-lg border bg-card p-4 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push('/karaoke/quick')}>
            <div className="flex items-center justify-center h-full">
              <Music className="h-6 w-6 text-primary mr-2" />
              <span className="font-semibold">Quick Karaoke</span>
            </div>
          </div>
          {filteredRooms.map((room) => (
            <div
              key={room.id}
              className="group relative rounded-lg border bg-card p-4 hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => router.push(`/karaoke/${room.id}`)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <Avatar>
                    <AvatarImage src={room.host.avatar_url || undefined} />
                    <AvatarFallback>{room.host.username?.slice(0, 2) || 'U'}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold">{room.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      Hosted by {room.host.username}
                    </p>
                  </div>
                </div>
                <Badge variant={room.is_live ? "destructive" : "secondary"}>
                  {room.is_live ? "LIVE" : "Offline"}
                </Badge>
              </div>

              {room.current_song && (
                <div className="mb-4 p-3 rounded-md bg-secondary/50">
                  <div className="flex items-center space-x-2 text-sm">
                    <Music className="h-4 w-4 text-primary" />
                    <span className="font-medium">{room.current_song.title}</span>
                  </div>
                  <p className="text-sm text-muted-foreground ml-6">
                    {room.current_song.artist}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center">
                    <Users className="h-4 w-4 mr-1" />
                    {room.participants_count}
                  </div>
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    {formatTimeAgo(room.created_at)}
                  </div>
                </div>
                {room.participants_count > 10 && (
                  <div className="flex items-center text-yellow-500">
                    <Star className="h-4 w-4 mr-1" />
                    Trending
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Music className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No rooms found</h3>
          <Button onClick={handleCreateRoom}>
            <Plus className="mr-2 h-4 w-4" />
            Create Room
          </Button>
          <Button 
            size="lg"
            variant="outline"
            onClick={() => router.push('/karaoke/quick')}
            className="w-full md:w-auto"
          >
            <Music className="mr-2 h-5 w-5" />
            Quick Karaoke
          </Button>
        </div>
      )}
    </div>
  )
}