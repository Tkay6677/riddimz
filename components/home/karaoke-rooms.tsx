"use client"

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Users, Mic, ChevronRight, Crown, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { supabase } from '@/lib/supabase'

interface Room {
  id: string
  name: string
  host: {
    username: string
    avatar_url: string | null
  }
  cover_image: string | null
  participants_count: number
  is_live: boolean
  is_nft_only: boolean
  category: string
  created_at: string
}

interface KaraokeRoomCardProps {
  room: Room
}

function KaraokeRoomCard({ room }: KaraokeRoomCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  
  return (
    <div 
      className={cn(
        "group relative rounded-lg overflow-hidden card-hover-effect",
        isHovered ? "shadow-lg" : "shadow"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link href={`/karaoke/${room.id}`}>
        <div className="relative aspect-video w-full">
          <Image
            src={room.cover_image ? 
              `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/karaoke-rooms/${room.cover_image}` :
              'https://images.pexels.com/photos/2078076/pexels-photo-2078076.jpeg'
            }
            alt={room.name}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-110"
          />
          <div className={cn(
            "absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10",
            isHovered ? "opacity-100" : "opacity-90"
          )} />
        </div>

        {/* Room status indicators */}
        <div className="absolute top-3 left-3 flex space-x-2">
          {room.is_live && (
            <div className="flex items-center space-x-1 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
              <span className="h-2 w-2 rounded-full bg-white animate-pulse"></span>
              <span>LIVE</span>
            </div>
          )}
          {room.is_nft_only && (
            <div className="nft-badge">
              <Crown className="h-3 w-3 mr-1" /> NFT ONLY
            </div>
          )}
        </div>

        {/* Participants count */}
        <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full flex items-center">
          <Users className="h-3 w-3 mr-1" />
          <span>{room.participants_count}</span>
        </div>
        
        {/* Host info */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="text-white font-bold text-lg truncate">{room.name}</h3>
          
          <div className="flex items-center mt-2">
            <Avatar className="h-6 w-6 mr-2 border border-white/50">
              <AvatarImage src={room.host.avatar_url || undefined} alt={room.host.username} />
              <AvatarFallback>{room.host.username.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <span className="text-white/90 text-sm">{room.host.username}</span>
            
            {/* Category */}
            <Badge variant="outline" className="ml-auto text-xs bg-black/30 text-white border-white/20">
              {room.category}
            </Badge>
          </div>
          
          {/* Call to action button */}
          <div className={cn(
            "mt-3 transition-opacity duration-300",
            isHovered ? "opacity-100" : "opacity-0"
          )}>
            <Button className="w-full bg-primary hover:bg-primary/90">
              {room.is_live ? "Join Room" : "View Details"}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </Link>
    </div>
  )
}

interface KaraokeRoomsProps {
  limit?: number
  filter?: string
}

export function KaraokeRooms({ limit = 6, filter }: KaraokeRoomsProps) {
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRooms()
  }, [filter])

  const loadRooms = async () => {
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
        .order('created_at', { ascending: false })

      // Apply filters
      switch (filter) {
        case 'live':
          query = query.eq('is_live', true)
          break
        case 'popular':
          // We'll sort by participant count on the client after fetching
          break
        case 'featured':
          query = query.eq('is_featured', true)
          break
      }

      const { data, error } = await query

      if (error) throw error

      if (data) {
        // Prefer server-tracked current_participants; fallback to visible participants length (may be restricted by RLS)
        const transformedRooms = data.map(room => {
          const currentParticipants = typeof room.current_participants === 'number'
            ? room.current_participants
            : (Array.isArray(room.participants) ? room.participants.length : 0)
          return {
            ...room,
            participants_count: currentParticipants,
          }
        })

        // Client-side sort for popularity
        const sortedRooms = filter === 'popular'
          ? transformedRooms.sort((a, b) => b.participants_count - a.participants_count)
          : transformedRooms

        setRooms(sortedRooms)
      }
    } catch (error) {
      console.error('Error loading rooms:', error)
    } finally {
      setLoading(false)
    }
  }

  const limitedRooms = rooms.slice(0, limit)
  
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
        {Array.from({ length: limit }).map((_, i) => (
          <div key={i} className="aspect-video rounded-lg bg-secondary animate-pulse" />
        ))}
      </div>
    )
  }
  
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
      {limitedRooms.map(room => (
        <KaraokeRoomCard key={room.id} room={room} />
      ))}
    </div>
  )
}