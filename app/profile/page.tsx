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
  MessageSquare, PlayCircle, Crown
} from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { useToast, toast as globalToast } from '@/components/ui/use-toast'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useCreatorUpgrade } from '@/hooks/useCreatorUpgrade'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { Metaplex } from '@metaplex-foundation/js'
import Link from 'next/link'

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

  // Creator upgrade hooks and state
  const { mintCreatorNft, checkIsCreator, minting, lastMintAddress } = useCreatorUpgrade()
  const { connected, publicKey } = useWallet()
  const { connection } = useConnection()
  const [isCreator, setIsCreator] = useState(false)

  // My NFTs tab state
  const [activeTab, setActiveTab] = useState<string>('history')
  type WalletNft = { mintAddress: string; name?: string; symbol?: string; uri?: string; image?: string }
  const [walletNfts, setWalletNfts] = useState<WalletNft[]>([])
  const [nftLoading, setNftLoading] = useState<boolean>(false)
  const [nftError, setNftError] = useState<string | null>(null)
  const [myListingsByUri, setMyListingsByUri] = useState<Record<string, { id: string; active: boolean; priceSol: number }>>({})

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

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const creator = await checkIsCreator()
        setIsCreator(creator)
      } catch (e) {
        console.warn('Creator status check failed', e)
      }
    }
    checkStatus()
  }, [checkIsCreator])

  const handleMintCreator = async () => {
    try {
      if (!connected) {
        globalToast({ title: 'Connect Wallet', description: 'Please connect your Solana wallet first.' })
        return
      }
      const mintAddr = await mintCreatorNft()
      setIsCreator(true)
      globalToast({ title: 'Creator NFT Minted', description: `Mint address: ${mintAddr}` })
    } catch (e: any) {
      globalToast({ variant: 'destructive', title: 'Mint failed', description: e?.message || 'Could not mint NFT' })
    }
  }

  // Load wallet NFTs for My NFTs tab
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!connected || !publicKey) return
      setNftLoading(true)
      setNftError(null)
      try {
        const metaplex = Metaplex.make(connection)
        const all = await metaplex.nfts().findAllByOwner({ owner: publicKey })
        const items: WalletNft[] = []
        for (const n of all) {
          const uri = (n as any).uri as string | undefined
          let image: string | undefined
          if (uri) {
            try {
              const res = await fetch(uri)
              if (res.ok) {
                const j = await res.json().catch(() => null)
                if (j && typeof j.image === 'string') image = j.image
              }
            } catch {}
          }
          items.push({ mintAddress: (n as any).address?.toBase58?.() || (n as any).mintAddress?.toBase58?.() || '', name: (n as any).name, symbol: (n as any).symbol, uri, image })
        }
        if (!cancelled) setWalletNfts(items)
      } catch (e: any) {
        if (!cancelled) setNftError(e?.message || 'Failed to load NFTs')
      } finally {
        if (!cancelled) setNftLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [connected, publicKey, connection])

  // Map my active listings by metadata URI for quick lookup
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/marketplace/listings')
        if (!res.ok) return
        const j = await res.json()
        const mine = (j.listings || []).filter((l: any) => l.sellerWalletAddress && publicKey && l.sellerWalletAddress === publicKey.toBase58())
        const map: Record<string, { id: string; active: boolean; priceSol: number }> = {}
        for (const l of mine) {
          if (l.metadataUri) map[l.metadataUri] = { id: l.id, active: true, priceSol: l.priceSol }
        }
        if (!cancelled) setMyListingsByUri(map)
      } catch {}
    })()
    return () => { cancelled = true }
  }, [publicKey])

  const handleUnlist = async (listingId: string) => {
    try {
      const res = await fetch(`/api/marketplace/listings/${listingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: false })
      })
      const j = await res.json()
      if (!res.ok || !j?.success) {
        throw new Error(j?.error || 'Failed to unlist')
      }
      setMyListingsByUri(prev => {
        const next = { ...prev }
        for (const [uri, info] of Object.entries(next)) {
          if (info.id === listingId) {
            delete next[uri]
            break
          }
        }
        return next
      })
      toast({ title: 'Unlisted', description: 'Your listing is now inactive.' })
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Unlist failed', description: e?.message || 'Could not unlist' })
    }
  }

  const loadUserProfile = async () => {
    try {
      setLoading(true)
      const { data: profile, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user?.id)
        .single()

      if (error) throw error

      let followersCount = 0
      let followingCount = 0
      try {
        const { count: fCount } = await supabase
          .from('user_follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', user?.id)
        followersCount = fCount ?? 0
      } catch {}
      try {
        const { count: gCount } = await supabase
          .from('user_follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', user?.id)
        followingCount = gCount ?? 0
      } catch {}

      if (profile) {
        setUserProfile({
          username: profile.username || '',
          avatar_url: profile.avatar_url || '',
          email: profile.email || '',
          created_at: new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          followers: followersCount,
          following: followingCount,
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
      // Always compute user's total performances regardless of hosting
      const { data: userPerformanceData, error: userPerformanceError } = await supabase
        .from('karaoke_performances')
        .select('id')
        .eq('user_id', user?.id)

      if (userPerformanceError) throw userPerformanceError

      const userPerformanceCount = userPerformanceData?.length ?? 0

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

        // Get performance counts for each room (hosted rooms)
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

        // Calculate total stats (for hosted rooms)
        const hostedTotals = stats.reduce((acc, room) => ({
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

        // Override songs performed with the user's actual performances across all rooms
        setTotalStats({
          ...hostedTotals,
          totalSongsPerformed: userPerformanceCount,
        })
      } else {
        // No hosted rooms, still show user's performance count
        setRoomStats([])
        setTotalStats({
          totalRoomsHosted: 0,
          totalParticipants: 0,
          totalChatMessages: 0,
          totalSessionTime: 0,
          totalSongsPerformed: userPerformanceCount,
        })
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

          {/* Creator Upgrade */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-yellow-500" />
                Creator Upgrade
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Mint the Riddimz Creator NFT to unlock creator features.
              </p>
              {isCreator ? (
                <div className="text-sm">
                  <span className="inline-flex items-center rounded-full bg-green-600/15 text-green-700 px-2 py-1">
                    Creator enabled
                  </span>
                  {lastMintAddress && (
                    <div className="mt-2 text-xs break-all">NFT: {lastMintAddress}</div>
                  )}
                  <div className="mt-3 flex items-center justify-center">
                    <Image src="/riddimz-logo.jpg" alt="Creator NFT" width={64} height={64} className="rounded" />
                  </div>
                </div>
              ) : connected ? (
                <Button className="w-full" onClick={handleMintCreator} disabled={minting}>
                  {minting ? 'Minting…' : 'Mint Creator NFT'}
                </Button>
              ) : (
                <div className="space-y-2">
                  <WalletMultiButton className="w-full" />
                  <p className="text-xs text-muted-foreground">Connect your wallet to mint the Creator NFT.</p>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Navigation */}
          <Card>
            <CardContent className="p-4">
              <nav className="space-y-1">
                <Button variant="ghost" className="w-full justify-start" onClick={() => setActiveTab('nfts')}>
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
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
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
                <TabsTrigger value="nfts" className="whitespace-nowrap">
                  <Award className="h-4 w-4 mr-2" />
                  My NFTs
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
                              <MessageSquare className="h-3 w-3" />
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

            <TabsContent value="nfts" className="space-y-4">
              {!connected ? (
                <Card>
                  <CardContent className="p-4">
                    <div className="mb-2 text-sm text-muted-foreground">Connect your wallet to view your NFTs.</div>
                    <WalletMultiButton />
                  </CardContent>
                </Card>
              ) : nftLoading ? (
                <Card>
                  <CardContent className="p-4">Loading NFTs…</CardContent>
                </Card>
              ) : nftError ? (
                <Card>
                  <CardContent className="p-4 text-red-500">{nftError}</CardContent>
                </Card>
              ) : walletNfts.length === 0 ? (
                <Card>
                  <CardContent className="p-4 text-muted-foreground">No NFTs found in your wallet.</CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {walletNfts.map((nft, idx) => {
                    const listing = nft.uri ? myListingsByUri[nft.uri] : undefined
                    return (
                      <Card key={`wallet-nft-${idx}`}>
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-3">
                            <div className="h-16 w-16 relative rounded-md overflow-hidden">
                              {nft.image ? (
                                <Image src={nft.image} alt={nft.name || 'NFT'} fill className="object-cover" unoptimized />
                              ) : (
                                <div className="w-full h-full bg-muted flex items-center justify-center">
                                  <Award className="h-8 w-8 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold">{nft.name || 'Unnamed NFT'}</h3>
                              <p className="text-xs text-muted-foreground break-all">{nft.mintAddress}</p>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center justify-between">
                            {listing ? (
                              <Button variant="outline" onClick={() => handleUnlist(listing.id)}>Unlist</Button>
                            ) : (
                              nft.uri ? (
                                <Link href={`/marketplace/create?metadataUri=${encodeURIComponent(nft.uri)}`}>
                                  <Button>List</Button>
                                </Link>
                              ) : (
                                <Button disabled>List</Button>
                              )
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}