"use client"

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { 
  ChevronLeft, ChevronRight, Mic, MicOff, Video, VideoOff, Users, Send, 
  Heart, Star, ThumbsUp, Hand, Sparkles, Music, Volume2, VolumeX,
  MessageSquare, Settings, Crown, Trophy, Gift, PartyPopper, Play, Pause, X
} from 'lucide-react'
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
import { useWebRTC } from '@/hooks/useWebRTC'
import io, { Socket } from 'socket.io-client'
import { StreamVideo, StreamVideoClient, StreamCall, CallControls, SpeakerLayout, useCall, useCallStateHooks, OwnCapability } from '@stream-io/video-react-sdk'
import '@stream-io/video-react-sdk/dist/css/styles.css'
import { JoinStreamModal } from '@/components/JoinStreamModal'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface User {
  id: string;
  user_metadata?: {
    username?: string;
    avatar_url?: string | null;
  };
  email?: string;
  name?: string;
}

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

interface PermissionRequest {
  userId: string;
  username: string;
  avatar_url?: string | null;
  permissions: string[];
}

export const dynamic = 'force-dynamic'

export default function KaraokeRoom() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const roomId = params.roomId as string
  const { room, loading: roomLoading, error: roomError, currentTime, currentLyric, nextLyrics, joinRoom, leaveRoom, togglePlayback } = useKaraokeRoom()
  const { user, loading: authLoading } = useAuth()
  const {
    startStreaming,
    stopStreaming,
    isStreaming,
    error: streamError,
    toggleMic,
    videoClient,
    call,
    requestSingPermission,
    permissionRequests,
    grantPermission,
    revokePermission,
    hasUserInteracted,
    setHasUserInteracted,
  } = useWebRTC(roomId, user?.id || '', user?.id === room?.host_id)
  const chatRef = useRef<HTMLDivElement>(null)
  
  const [chatMessage, setChatMessage] = useState('')
  const [activePanel, setActivePanel] = useState<'participants' | 'chat' | 'permissions'>('chat')
  const [isMobile, setIsMobile] = useState(false)
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([])
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isHost, setIsHost] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reactions, setReactions] = useState<{[key: string]: number}>({
    heart: 0,
    star: 0,
    thumbsUp: 0,
    clap: 0,
    sparkles: 0
  })
  const [showReactions, setShowReactions] = useState(false)
  const [streakCount, setStreakCount] = useState(0)
  const [showStreak, setShowStreak] = useState(false)
  
  // Check for mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [localMessages])

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login?redirect=' + encodeURIComponent(`/karaoke/${roomId}`))
        return
      }
      
      if (roomId && !room) {
        joinRoom(roomId).catch((err) => {
          console.error('Error joining room:', err)
          if (err.message === 'Not authenticated') {
            router.push('/login?redirect=' + encodeURIComponent(`/karaoke/${roomId}`))
          }
        })
      }
    }
  }, [roomId, user, authLoading, room, joinRoom, router])

  useEffect(() => {
    if (isInitialLoad) {
      setIsLoading(false)
      setIsInitialLoad(false)
    }
  }, [isInitialLoad])

  // Initialize chat socket connection
  useEffect(() => {
    if (!user || !roomId) return;

    const chatSocket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001', {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
      query: { type: 'chat' }
    });

    chatSocket.on('connect', () => {
      console.log('Chat socket connected:', chatSocket.id);
      chatSocket.emit('join-room', roomId, user.id, user.id === room?.host_id);
    });

    chatSocket.on('connect_error', (error) => {
      console.error('Chat socket connection error:', error);
    });

    chatSocket.on('disconnect', (reason) => {
      console.log('Chat socket disconnected:', reason);
      if (reason === 'io server disconnect') {
        chatSocket.connect();
      }
    });

    chatSocket.on('error', (error) => {
      console.error('Chat socket error:', error);
    });

    chatSocket.on('chat-message', (message: ChatMessage) => {
      console.log('Received chat message:', message);
      setLocalMessages(prev => {
        if (prev.some(m => m.id === message.id)) {
          return prev;
        }
        return [...prev, message];
      });
    });

    setSocket(chatSocket);

    return () => {
      if (chatSocket) {
        chatSocket.off('chat-message');
        chatSocket.off('connect');
        chatSocket.off('connect_error');
        chatSocket.off('disconnect');
        chatSocket.off('error');
        chatSocket.disconnect();
      }
    };
  }, [user, roomId, room?.host_id]);

  // Add streaming state effect
  useEffect(() => {
    let isMounted = true;

    const startHostStream = async () => {
      if (!isMounted) return;
      
      if (user?.id === room?.host_id && !isStreaming && !streamError && call) {
        // Don't auto-start streaming, wait for user interaction
        if (!hasUserInteracted) {
          return;
        }
        
        try {
          console.log('Starting streaming');
          await startStreaming();
        } catch (err: any) {
          console.error('Streaming error:', err);
          if (isMounted) {
            toast({
              variant: "destructive",
              title: "Streaming Error",
              description: err?.message || "Failed to start streaming",
              duration: 5000,
            });
          }
        }
      }
    };

    startHostStream();

    return () => {
      isMounted = false;
    };
  }, [user?.id, room?.host_id, isStreaming, streamError, startStreaming, toast, call, hasUserInteracted]);

  const handleLeaveRoom = async () => {
    await leaveRoom(roomId)
    if (call) {
      await call.leave();
    }
    router.push('/karaoke')
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatMessage.trim() || !user || !socket || !roomId) return

    try {
      const message: ChatMessage = {
        id: crypto.randomUUID(),
        content: chatMessage,
        timestamp: new Date().toISOString(),
        user: {
          id: user.id,
          username: user.user_metadata?.username || 'Anonymous',
          avatar_url: user.user_metadata?.avatar_url || null
        }
      }
      socket.emit('chat-message', roomId, message)
      setLocalMessages(prev => [...prev, message])
      setChatMessage('')
    } catch (error: any) {
      console.error('Error sending message:', error)
      toast({
        variant: "destructive",
        title: "Error sending message",
        description: error.message || "Failed to send message",
        duration: 5000,
      })
    }
  }
  
  const handleRequestSingPermission = async () => {
    try {
      await requestSingPermission()
      toast({
        title: "Permission Requested",
        description: "Your request to sing has been sent to the host.",
        duration: 5000,
      })
    } catch (error: any) {
      console.error('Error requesting permission:', error)
      toast({
        variant: "destructive",
        title: "Permission Request Error",
        description: error.message || "Failed to request singing permission.",
        duration: 5000,
      })
    }
  }
  
  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60)
    const seconds = Math.floor(timeInSeconds % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }
  
  const renderHostBadge = () => {
    if (!room) return null;
    return (
      <div className="absolute top-2 md:top-4 left-2 md:left-4 flex items-center bg-black/50 backdrop-blur-sm rounded-full px-2 md:px-3 py-1 md:py-1.5">
        <Avatar className="h-5 w-5 md:h-6 md:w-6 mr-1 md:mr-2">
          <AvatarImage src={room.host?.avatar_url || undefined} alt={room.host?.username || ''} />
          <AvatarFallback>{room.host?.username?.slice(0, 2)}</AvatarFallback>
        </Avatar>
        <span className="text-white text-xs md:text-sm">{room.host?.username}</span>
        <Badge variant="outline" className="ml-1 md:ml-2 border-white/20 text-white bg-red-500/20 text-[10px] md:text-xs">
          {isStreaming ? (
            <>
              <Mic className="h-2 w-2 md:h-3 md:w-3 mr-0.5 md:mr-1" />
              Streaming
            </>
          ) : (
            <>
              <MicOff className="h-2 w-2 md:h-3 md:w-3 mr-0.5 md:mr-1" />
              Offline
            </>
          )}
        </Badge>
      </div>
    );
  };

  const renderPlaybackControls = () => {
    if (!room) return null;
    return (
      <div className="flex items-center justify-center space-x-4">
        {user?.id === room.host_id && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-12 w-12 rounded-full bg-white/10 hover:bg-white/20"
            onClick={() => {
              toggleMic();
              setIsMicMuted(!isMicMuted);
            }}
          >
            {isMicMuted ? (
              <VolumeX className="h-6 w-6 text-white" />
            ) : (
              <Volume2 className="h-6 w-6 text-white" />
            )}
          </Button>
        )}
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
        {user?.id === room.host_id && (
          <Button
            variant="destructive"
            size="sm"
            className="h-10"
            onClick={() => {
              stopStreaming();
              router.push('/');
            }}
          >
            End Stream
          </Button>
        )}
      </div>
    );
  };
  
  const handleJoinStream = async () => {
    try {
      setHasUserInteracted(true);
      await startStreaming();
    } catch (error: any) {
      console.error('Error starting stream:', error);
      toast({
        variant: "destructive",
        title: "Streaming Error",
        description: error.message || "Failed to start streaming",
        duration: 5000,
      });
    }
  };

  // Add reaction handler
  const handleReaction = (type: string) => {
    setReactions(prev => ({
      ...prev,
      [type]: (prev[type] || 0) + 1
    }));
  };

  // Add streak counter
  useEffect(() => {
    if (currentLyric) {
      setStreakCount(prev => prev + 1);
      setShowStreak(true);
      setTimeout(() => setShowStreak(false), 2000);
    }
  }, [currentLyric]);
  
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
  
  if (roomError || streamError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold mb-4">Error</h1>
        <p className="text-muted-foreground mb-4">{roomError || streamError}</p>
        <Button asChild>
          <Link href="/karaoke">Back to Rooms</Link>
        </Button>
      </div>
    )
  }

  if (!room || !videoClient || !call) {
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
    <StreamVideo client={videoClient}>
      <StreamCall call={call}>
    <div className="flex flex-col h-screen bg-background">
          {!hasUserInteracted && (
            <JoinStreamModal 
              onJoin={startStreaming}
              isHost={user?.id === room?.host_id}
            />
          )}
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
        
            {user?.id === room.host_id && (
              <div className="flex items-center space-x-2">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => {
                    toggleMic()
                    setIsMicMuted(!isMicMuted)
                  }}
                >
                  {isMicMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    stopStreaming()
                    router.push('/karaoke')
                  }}
                >
                  End Stream
          </Button>
        </div>
            )}
      </div>
      
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col h-full relative animated-bg">
          {renderHostBadge()}
          
              
              {/* Add streak counter */}
              {showStreak && (
                <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-primary/80 text-white px-4 py-2 rounded-full animate-bounce">
                  <Trophy className="h-5 w-5 inline-block mr-2" />
                  {streakCount} Lyrics Streak!
                </div>
              )}

              {/* Add reaction buttons */}
              <div className="absolute top-4 right-4 flex space-x-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20"
                  onClick={() => setShowReactions(!showReactions)}
                >
                  <Gift className="h-5 w-5 text-white" />
                </Button>
              </div>

              {/* Reaction panel */}
              {showReactions && (
                <div className="absolute top-16 right-4 bg-black/80 p-2 rounded-lg flex space-x-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleReaction('heart')}
                  >
                    <Heart className="h-4 w-4 text-red-500" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleReaction('star')}
                  >
                    <Star className="h-4 w-4 text-yellow-500" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleReaction('thumbsUp')}
                  >
                    <ThumbsUp className="h-4 w-4 text-blue-500" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleReaction('clap')}
                  >
                    <Hand className="h-4 w-4 text-green-500" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleReaction('sparkles')}
                  >
                    <Sparkles className="h-4 w-4 text-purple-500" />
                  </Button>
                </div>
              )}
              
              {/* Reaction counts */}
              <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 flex space-x-4">
                {Object.entries(reactions).map(([type, count]) => (
                  count > 0 && (
                    <Badge key={type} variant="secondary" className="flex items-center space-x-1">
                      {type === 'heart' && '❤️'}
                      {type === 'star' && '⭐'}
                      {type === 'thumbsUp' && '👍'}
                      {type === 'clap' && '👏'}
                      {type === 'sparkles' && '✨'}
                      <span>{count}</span>
                    </Badge>
                  )
                ))}
              </div>

              <div className="flex-1 flex flex-col items-center justify-center p-4">
                <div className="text-center">
                  <h2 className="text-white text-2xl font-bold mb-1">{room.current_song?.title}</h2>
                  <p className="text-white/80 text-base mb-6">{room.current_song?.artist}</p>
                  
                  {currentLyric && (
                    <div className="lyrics-line active text-4xl font-bold mb-4 text-white bg-black/30 px-6 py-3 rounded-lg">
                      {currentLyric}
                    </div>
                  )}
                  
                  <div className="space-y-2">
                {nextLyrics.map((lyric, index) => (
                  <div 
                    key={index} 
                        className="lyrics-line text-2xl text-white/70"
                  >
                    {lyric}
                  </div>
                ))}
              </div>
            </div>
          </div>
          
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent">
                <div className="flex flex-col space-y-2">
              <div className="flex items-center space-x-2">
                    <span className="text-white text-sm min-w-[40px]">{formatTime(currentTime)}</span>
                <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-100"
                    style={{ width: `${(currentTime / (room.current_song?.duration || 1)) * 100}%` }}
                  />
                </div>
                    <span className="text-white text-sm min-w-[40px] text-right">
                  {formatTime(room.current_song?.duration || 0)}
                </span>
              </div>
            
              {user?.id === room.host_id ? (
                    <div className="flex items-center justify-center space-x-4">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-12 w-12 rounded-full bg-white/10 hover:bg-white/20"
                              onClick={() => {
                                toggleMic();
                                setIsMicMuted(!isMicMuted);
                              }}
                            >
                              {isMicMuted ? (
                                <VolumeX className="h-6 w-6 text-white" />
                              ) : (
                                <Volume2 className="h-6 w-6 text-white" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{isMicMuted ? 'Unmute' : 'Mute'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
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
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{room.current_song?.is_playing ? 'Pause' : 'Play'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center space-x-4">
                      <Badge variant="secondary" className="text-sm flex items-center space-x-1">
                        <Music className="h-4 w-4" />
                        <span>{room.current_song?.is_playing ? 'Playing' : 'Paused'}</span>
                  </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center space-x-2"
                        onClick={handleRequestSingPermission}
                      >
                        <Mic className="h-4 w-4" />
                        <span>Request to Sing</span>
                      </Button>
              </div>
              )}
            </div>
          </div>
        </div>
        
        <div className={cn(
          "border-l bg-card transition-all duration-300 ease-in-out",
          isMobile ? "fixed inset-y-0 right-0 z-50 transform" : "relative",
          isSidebarOpen ? "translate-x-0" : "translate-x-full",
          isMobile ? "w-[85vw] md:w-[320px]" : "w-[280px] md:w-80"
        )}>
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

              <div className="p-4 border-b flex items-center justify-between">
                <div className="flex space-x-2">
                  <Button
                    variant={activePanel === 'chat' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setActivePanel('chat')}
                  >
                    Chat
                  </Button>
                  <Button
                    variant={activePanel === 'participants' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setActivePanel('participants')}
                  >
                    Participants
                  </Button>
                  {user?.id === room.host_id && (
                    <Button
                      variant={activePanel === 'permissions' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setActivePanel('permissions')}
                    >
                      Permissions
                    </Button>
                  )}
                </div>
            {isMobile && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsSidebarOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          
              <ScrollArea className="h-[calc(100vh-8rem)]">
                <Tabs defaultValue="chat" className="w-full">
                  <TabsList className="w-full justify-start p-2">
                    <TabsTrigger value="chat" className="flex items-center space-x-2">
                      <MessageSquare className="h-4 w-4" />
                      <span>Chat</span>
                    </TabsTrigger>
                    <TabsTrigger value="participants" className="flex items-center space-x-2">
                      <Users className="h-4 w-4" />
                      <span>Participants</span>
                    </TabsTrigger>
                    {user?.id === room.host_id && (
                      <TabsTrigger value="permissions" className="flex items-center space-x-2">
                        <Crown className="h-4 w-4" />
                        <span>Permissions</span>
                      </TabsTrigger>
                    )}
                  </TabsList>

                  <TabsContent value="chat" className="h-[calc(100vh-8rem)]">
                    <div className="flex flex-col h-full">
                      <div className="flex-1 p-4 space-y-4">
                        {localMessages.map((message) => (
                          <div key={message.id} className="flex items-start space-x-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={message.user.avatar_url || undefined} alt={message.user.username} />
                              <AvatarFallback>{message.user.username.slice(0, 2)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm">{message.user.username}</p>
                              <p className="text-sm">{message.content}</p>
                            </div>
                          </div>
                        ))}
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
                  </TabsContent>
                  
                  <TabsContent value="participants" className="h-[calc(100vh-8rem)]">
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
                  </TabsContent>
                  
                  <TabsContent value="permissions" className="h-[calc(100vh-8rem)]">
                    {user?.id === room.host_id && (
                      <div className="p-4 space-y-4">
                        {permissionRequests.length > 0 ? (
                          permissionRequests.map((request: PermissionRequest) => (
                            <div key={request.userId} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex items-center space-x-3">
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={request.avatar_url || undefined} alt={request.username} />
                                  <AvatarFallback>{request.username.slice(0, 2)}</AvatarFallback>
                        </Avatar>
                                <span className="text-sm">{request.username}</span>
                          </div>
                              <div className="flex space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => grantPermission(request.userId, request.permissions)}
                                >
                                  Accept
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => revokePermission(request.userId, request.permissions)}
                                >
                                  Reject
                                </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                          <p className="text-center text-muted-foreground">No pending requests</p>
                        )}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
          </ScrollArea>
        </div>
          </div>
      </div>
      </StreamCall>
    </StreamVideo>
  )
}