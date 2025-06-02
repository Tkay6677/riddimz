"use client"

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ChevronLeft, Mic, MicOff, Video, VideoOff, Users, Send, Heart, Volume2, Volume as VolumeMute, X, PlusCircle, DollarSign, Share2, Play, Pause } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useKaraokeRoom } from '@/hooks/useKaraokeRoom'
import { useAuth } from '@/hooks/useAuth'

export default function KaraokeRoom() {
  const params = useParams()
  const router = useRouter()
  const roomId = params.roomId as string
  const { room, loading, error, currentTime, currentLyric, nextLyrics, joinRoom, leaveRoom, togglePlayback } = useKaraokeRoom()
  const { user, loading: authLoading } = useAuth()
  
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOn, setIsVideoOn] = useState(true)
  const [chatMessage, setChatMessage] = useState('')
  const [activePanel, setActivePanel] = useState<'participants' | 'chat' | 'queue'>('chat')
  
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login?redirect=' + encodeURIComponent(`/karaoke/${roomId}`))
        return
      }
      
      if (roomId) {
        joinRoom(roomId).catch((err) => {
          console.error('Error joining room:', err)
          if (err.message === 'Not authenticated') {
            router.push('/login?redirect=' + encodeURIComponent(`/karaoke/${roomId}`))
          }
        })
      }
    }
  }, [roomId, user, authLoading])

  const handleLeaveRoom = async () => {
    await leaveRoom(roomId)
    router.push('/karaoke')
  }

  // Format time from seconds to MM:SS
  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60)
    const seconds = Math.floor(timeInSeconds % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold mb-4">Please Sign In</h1>
        <p className="text-muted-foreground mb-4">You need to be signed in to join a karaoke room.</p>
        <Button asChild>
          <Link href="/login?redirect=' + encodeURIComponent(`/karaoke/${roomId}`)">Sign In</Link>
        </Button>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold mb-4">Error</h1>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button asChild>
          <Link href="/karaoke">Back to Rooms</Link>
        </Button>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold mb-4">Room Not Found</h1>
        <Button asChild>
          <Link href="/karaoke">Back to Rooms</Link>
        </Button>
      </div>
    )
  }
  
  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/karaoke">
              <ChevronLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{room.name}</h1>
            <p className="text-sm text-muted-foreground">
              Hosted by {room.host?.username}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon" onClick={() => setIsMuted(!isMuted)}>
            {isMuted ? <VolumeMute className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setIsVideoOn(!isVideoOn)}>
            {isVideoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setActivePanel(activePanel === 'participants' ? 'chat' : 'participants')}>
            <Users className="h-5 w-5" />
          </Button>
          <Button variant="destructive" onClick={handleLeaveRoom}>
            Leave Room
          </Button>
        </div>
      </div>
      
      <div className="flex flex-1 overflow-hidden">
        {/* Karaoke display */}
        <div className="flex-1 flex flex-col h-full relative animated-bg">
          {/* Current singer */}
          <div className="absolute top-4 left-4 flex items-center bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5">
            <Avatar className="h-6 w-6 mr-2">
              <AvatarImage src={room.host?.avatar_url} alt={room.host?.username} />
              <AvatarFallback>{room.host?.username?.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <span className="text-white text-sm">{room.host?.username}</span>
            <Badge variant="outline" className="ml-2 border-white/20 text-white bg-red-500/20">
              <Mic className="h-3 w-3 mr-1" />
              Singing
            </Badge>
          </div>
          
          {/* Lyrics display */}
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <div className="text-center">
              <h2 className="text-white text-2xl font-bold mb-1">{room.current_song?.title}</h2>
              <p className="text-white/80 mb-6">{room.current_song?.artist}</p>
              
              {/* Current lyric (highlighted) */}
              {currentLyric && (
                <div className="lyrics-line active text-3xl md:text-4xl font-bold mb-4 text-white bg-black/30 px-6 py-3 rounded-lg">
                  {currentLyric}
                </div>
              )}
              
              {/* Next lyrics */}
              <div className="space-y-2">
                {nextLyrics.map((lyric, index) => (
                  <div 
                    key={index} 
                    className="lyrics-line text-xl md:text-2xl text-white/70"
                  >
                    {lyric}
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Progress bar and controls */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
            <div className="flex items-center space-x-4">
              <span className="text-white text-sm">{formatTime(currentTime)}</span>
              <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary"
                  style={{ width: `${(currentTime / (room.current_song?.duration || 1)) * 100}%` }}
                />
              </div>
              <span className="text-white text-sm">{formatTime(room.current_song?.duration || 0)}</span>
              <Button variant="ghost" size="icon" onClick={togglePlayback}>
                {room.current_song?.is_playing ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
        </div>
        
        {/* Side panel */}
        <div className={cn(
          "w-80 border-l bg-card transition-transform duration-300",
          activePanel ? "translate-x-0" : "translate-x-full"
        )}>
          <div className="p-4 border-b">
            <h2 className="font-semibold">
              {activePanel === 'participants' ? 'Participants' : 
               activePanel === 'chat' ? 'Chat' : 'Queue'}
            </h2>
          </div>
          
          <ScrollArea className="h-[calc(100vh-8rem)]">
            {activePanel === 'participants' && (
              <div className="p-4 space-y-4">
                {room.participants?.map((participant: any) => (
                  <div key={participant.user.id} className="flex items-center space-x-3">
                    <Avatar>
                      <AvatarImage src={participant.user.avatar_url} alt={participant.user.username} />
                      <AvatarFallback>{participant.user.username.slice(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{participant.user.username}</p>
                      {participant.user.id === room.host_id && (
                        <Badge variant="secondary" className="text-xs">Host</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {activePanel === 'chat' && (
              <div className="flex flex-col h-full">
                <div className="flex-1 p-4 space-y-4">
                  {/* Chat messages will go here */}
                </div>
                <div className="p-4 border-t">
                  <div className="flex space-x-2">
                    <Input
                      placeholder="Type a message..."
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                    />
                    <Button size="icon">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}