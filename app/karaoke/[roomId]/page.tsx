"use client"

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Mic, MicOff, Video, VideoOff, Users, Send, Heart, Volume2, Volume as VolumeMute, X, PlusCircle, DollarSign, Share2, Play, Pause, ListMusic } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useKaraokeRoom } from '@/hooks/useKaraokeRoom'
import { useAuth } from '@/hooks/useAuth'

interface ChatMessage {
  id: string;
  content: string;
  timestamp: string;
  user: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
}

export const dynamic = 'force-dynamic'

export default function KaraokeRoom() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const roomId = params.roomId as string
  const { room, loading: roomLoading, error, currentTime, currentLyric, nextLyrics, joinRoom, leaveRoom, togglePlayback, sendMessage, messages = [] } = useKaraokeRoom()
  const { user, loading: authLoading } = useAuth()
  const chatRef = useRef<HTMLDivElement>(null)
  
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOn, setIsVideoOn] = useState(true)
  const [chatMessage, setChatMessage] = useState('')
  const [activePanel, setActivePanel] = useState<'participants' | 'chat' | 'queue'>('chat')
  const [isMobile, setIsMobile] = useState(false)
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([])
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  
  // Check for mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [messages])

  // Update local messages when messages prop changes
  useEffect(() => {
    if (messages) {
      setLocalMessages(messages)
    }
  }, [messages])

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

  useEffect(() => {
    if (isInitialLoad) {
      loadRoomData()
      setIsInitialLoad(false)
    }
  }, [isInitialLoad])

  const loadRoomData = async () => {
    try {
      setIsLoading(true)
      // ... existing loading logic ...
    } catch (error) {
      // ... error handling ...
    } finally {
      setIsLoading(false)
    }
  }

  const handleLeaveRoom = async () => {
    await leaveRoom(roomId)
    router.push('/karaoke')
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatMessage.trim()) return

    try {
      await sendMessage(chatMessage)
      setChatMessage('')
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error sending message",
        description: error.message || "Failed to send message. Please try again.",
        duration: 5000,
      })
    }
  }
  
  // Format time from seconds to MM:SS
  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60)
    const seconds = Math.floor(timeInSeconds % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }
  
  if (isLoading && isInitialLoad) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (authLoading || roomLoading) {
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
      {/* Header - Make it more compact on mobile */}
      <div className="flex items-center justify-between p-2 md:p-4 border-b">
        <div className="flex items-center space-x-2 md:space-x-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/karaoke">
              <ChevronLeft className="h-4 w-4 md:h-5 md:w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-base md:text-xl font-semibold truncate max-w-[150px] md:max-w-none">{room.name}</h1>
            <p className="text-xs md:text-sm text-muted-foreground truncate">
              Hosted by {room.host?.username}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-1 md:space-x-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 md:h-10 md:w-10" onClick={() => setIsMuted(!isMuted)}>
            {isMuted ? <VolumeMute className="h-4 w-4 md:h-5 md:w-5" /> : <Volume2 className="h-4 w-4 md:h-5 md:w-5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 md:h-10 md:w-10" onClick={() => setIsVideoOn(!isVideoOn)}>
            {isVideoOn ? <Video className="h-4 w-4 md:h-5 md:w-5" /> : <VideoOff className="h-4 w-4 md:h-5 md:w-5" />}
          </Button>
          {!isMobile && (
            <>
              <Button variant="ghost" size="icon" onClick={() => setActivePanel(activePanel === 'participants' ? 'chat' : 'participants')}>
                <Users className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setActivePanel(activePanel === 'queue' ? 'chat' : 'queue')}>
                <ListMusic className="h-5 w-5" />
              </Button>
            </>
          )}
          <Button variant="destructive" size="sm" className="h-8 md:h-10" onClick={handleLeaveRoom}>
            Leave
          </Button>
        </div>
      </div>
      
      <div className="flex flex-1 overflow-hidden">
        {/* Karaoke display - Adjust for mobile */}
        <div className="flex-1 flex flex-col h-full relative animated-bg">
          {/* Current singer - Make it more compact on mobile */}
          <div className="absolute top-2 md:top-4 left-2 md:left-4 flex items-center bg-black/50 backdrop-blur-sm rounded-full px-2 md:px-3 py-1 md:py-1.5">
            <Avatar className="h-5 w-5 md:h-6 md:w-6 mr-1 md:mr-2">
              <AvatarImage src={room.host?.avatar_url} alt={room.host?.username} />
              <AvatarFallback>{room.host?.username?.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <span className="text-white text-xs md:text-sm">{room.host?.username}</span>
            <Badge variant="outline" className="ml-1 md:ml-2 border-white/20 text-white bg-red-500/20 text-[10px] md:text-xs">
              <Mic className="h-2 w-2 md:h-3 md:w-3 mr-0.5 md:mr-1" />
              Singing
            </Badge>
          </div>
          
          {/* Lyrics display - Adjust text sizes for mobile */}
          <div className="flex-1 flex flex-col items-center justify-center p-2 md:p-4">
            <div className="text-center">
              <h2 className="text-white text-lg md:text-2xl font-bold mb-0.5 md:mb-1">{room.current_song?.title}</h2>
              <p className="text-white/80 text-sm md:text-base mb-4 md:mb-6">{room.current_song?.artist}</p>
              
              {/* Current lyric (highlighted) */}
              {currentLyric && (
                <div className="lyrics-line active text-xl md:text-4xl font-bold mb-3 md:mb-4 text-white bg-black/30 px-3 md:px-6 py-2 md:py-3 rounded-lg">
                  {currentLyric}
                </div>
              )}
              
              {/* Next lyrics */}
              <div className="space-y-1 md:space-y-2">
                {nextLyrics.map((lyric, index) => (
                  <div 
                    key={index} 
                    className="lyrics-line text-base md:text-2xl text-white/70"
                  >
                    {lyric}
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Progress bar and controls - Enhanced for mobile */}
          <div className="absolute bottom-0 left-0 right-0 p-3 md:p-4 bg-gradient-to-t from-black/90 to-transparent">
            <div className="flex flex-col space-y-2 pb-16 md:pb-0">
              {/* Time and progress slider */}
              <div className="flex items-center space-x-2">
                <span className="text-white text-xs md:text-sm min-w-[40px]">{formatTime(currentTime)}</span>
                <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-100"
                    style={{ width: `${(currentTime / (room.current_song?.duration || 1)) * 100}%` }}
                  />
                </div>
                <span className="text-white text-xs md:text-sm min-w-[40px] text-right">
                  {formatTime(room.current_song?.duration || 0)}
                </span>
              </div>

              {/* Playback controls */}
              <div className="flex items-center justify-center">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-12 w-12 rounded-full bg-white/10 hover:bg-white/20"
                  onClick={togglePlayback}
                >
                  {room.current_song?.is_playing ? (
                    <Pause className="h-6 w-6 text-white" />
                  ) : (
                    <Play className="h-6 w-6 text-white" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Side panel - Make it collapsible */}
        <div className={cn(
          "border-l bg-card transition-all duration-300 ease-in-out",
          isMobile ? "fixed inset-y-0 right-0 z-50 transform" : "relative",
          isSidebarOpen ? "translate-x-0" : "translate-x-full",
          isMobile ? "w-[85vw] md:w-[320px]" : "w-[280px] md:w-80"
        )}>
          {/* Toggle button - Only show on desktop */}
          {!isMobile && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute -left-10 top-1/2 -translate-y-1/2 bg-card border border-l-0 rounded-r-lg hover:bg-accent"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              <ChevronRight className={cn(
                "h-4 w-4 transition-transform duration-300",
                isSidebarOpen ? "rotate-180" : ""
              )} />
            </Button>
          )}

          <div className={cn(
            "p-2 md:p-4 border-b flex items-center justify-between",
            !isSidebarOpen && "hidden"
          )}>
            <h2 className="font-semibold text-sm md:text-base">
              {activePanel === 'participants' ? 'Participants' : 
               activePanel === 'chat' ? 'Chat' : 'Queue'}
            </h2>
            {isMobile && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsSidebarOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          <ScrollArea className={cn(
            "transition-all duration-300",
            !isSidebarOpen && "hidden",
            "h-[calc(100vh-7rem)] md:h-[calc(100vh-8rem)]"
          )}>
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
                <div ref={chatRef} className="flex-1 p-4 space-y-4 overflow-y-auto">
                  {localMessages.map((message, index) => (
                    <div key={message.id || index} className="flex items-start space-x-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={message.user.avatar_url || undefined} alt={message.user.username} />
                        <AvatarFallback>{message.user.username.slice(0, 2)}</AvatarFallback>
                        </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{message.user.username}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(message.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-sm">{message.content}</p>
                        </div>
                      </div>
                    ))}
                  {localMessages.length === 0 && (
                    <div className="text-center text-muted-foreground py-4">
                      No messages yet. Start the conversation!
                    </div>
                  )}
                  </div>
                <form onSubmit={handleSendMessage} className="p-4 border-t">
                  <div className="flex space-x-2">
                    <Input 
                      placeholder="Type a message..."
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                    />
                    <Button type="submit" size="icon">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                  </form>
              </div>
            )}
            
            {activePanel === 'queue' && (
                  <div className="p-4 space-y-4">
                {room.queue?.map((item: any, index: number) => (
                  <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <span className="text-muted-foreground">{index + 1}</span>
                        <div>
                        <p className="font-medium">{item.song.title}</p>
                        <p className="text-sm text-muted-foreground">{item.song.artist}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={item.user.avatar_url} alt={item.user.username} />
                        <AvatarFallback>{item.user.username.slice(0, 2)}</AvatarFallback>
                            </Avatar>
                      <span className="text-sm text-muted-foreground">{item.user.username}</span>
                    </div>
                  </div>
                ))}
                {(!room.queue || room.queue.length === 0) && (
                  <p className="text-center text-muted-foreground">No songs in queue</p>
                )}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Mobile bottom navigation */}
        {isMobile && (
          <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-1.5 md:p-2 flex justify-around z-50">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-10 w-10" 
              onClick={() => {
                setActivePanel('participants')
                setIsSidebarOpen(true)
              }}
            >
              <Users className="h-5 w-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-10 w-10" 
              onClick={() => {
                setActivePanel('chat')
                setIsSidebarOpen(true)
              }}
            >
              <Send className="h-5 w-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-10 w-10" 
              onClick={() => {
                setActivePanel('queue')
                setIsSidebarOpen(true)
              }}
            >
              <ListMusic className="h-5 w-5" />
            </Button>
          </div>
        )}

        {/* Mobile overlay when sidebar is open */}
        {isMobile && isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
      </div>
    </div>
  )
}