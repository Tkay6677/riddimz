"use client"

import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { 
  ChevronLeft, ChevronRight, Mic, MicOff, Video, VideoOff, Users, Send, 
  Heart, Star, ThumbsUp, Hand, Sparkles, Music, Volume2, VolumeX,
  MessageSquare, Settings, Crown, Trophy, Gift, PartyPopper, Play, Pause, X, Bug
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { Toaster } from '@/components/ui/toaster'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useKaraokeRoom } from '@/hooks/useKaraokeRoom'
import { useAuth } from '@/hooks/useAuth'
import { useWebRTC } from '@/hooks/useWebRTC'
import { useKaraokePlaybackSync } from '@/hooks/useKaraokePlaybackSync'
import { supabase } from '@/lib/supabase'
import io, { Socket } from 'socket.io-client'
import { 
  StreamVideo, 
  StreamVideoClient, 
  StreamCall, 
  CallControls, 
  SpeakerLayout, 
  useCall, 
  useCallStateHooks, 
  OwnCapability,
  PermissionRequestEvent 
} from '@stream-io/video-react-sdk'
import '@stream-io/video-react-sdk/dist/css/styles.css'
import { JoinStreamModal } from '@/components/JoinStreamModal'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import SongPicker from '@/components/karaoke/song-picker'
import GiftHost from '@/components/GiftHost'

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

export const dynamic = 'force-dynamic'

export default function KaraokeRoom() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const roomId = params.roomId as string
  const { room, loading: roomLoading, error: roomError, currentTime, currentLyric, nextLyrics, lyrics, joinRoom, leaveRoom, togglePlayback, audio, fetchRoom, subscribeToRoomUpdates } = useKaraokeRoom()
  const { user, loading: authLoading } = useAuth()
  const [selectedSongId, setSelectedSongId] = useState<string | undefined>(undefined)
  const [selectedSong, setSelectedSong] = useState<any | null>(null)
  const [songQueue, setSongQueue] = useState<any[]>([])
  
  // Dedupe room participants by normalized display name with fallback to id
  const dedupedRoomParticipants = useMemo(() => {
    const byIdentity = new Map<string, any>();
    const list = (room as any)?.participants || [];
    for (const p of list) {
      const nameKey = String(p?.user?.username || p?.user?.name || "").trim().toLowerCase();
      const idKey = String(p?.user?.id ?? p?.user_id ?? p?.id ?? "").toLowerCase();
      const key = nameKey || idKey;
      if (!byIdentity.has(key)) byIdentity.set(key, p);
    }
    return Array.from(byIdentity.values());
  }, [room?.participants])
  
  // Volume state for host controls
  const [musicVolume, setMusicVolume] = useState(0.6)
  const [localMicVolume, setLocalMicVolume] = useState(0.8)
  
  // Handle volume events from host
  const handleVolumeEvent = (volumeType: 'music' | 'mic', volume: number) => {
    if (volumeType === 'music') {
      setMusicVolume(volume);
    } else if (volumeType === 'mic') {
      setLocalMicVolume(volume);
    }
  };

  const handleSongSelect = (song: any) => {
    setSelectedSongId(song._id || song.id)
    setSelectedSong(song)
    updateActivity()
  }

  const addSelectedToQueue = () => {
    if (!selectedSong) return
    setSongQueue(prev => [...prev, selectedSong])
    toast({ title: 'Added to queue', description: selectedSong.title })
    updateActivity()
  }

  const removeFromQueue = (index: number) => {
    setSongQueue(prev => prev.filter((_, i) => i !== index))
    updateActivity()
  }

  const addSongToQueue = (song: any) => {
    setSongQueue(prev => [...prev, song])
    toast({ title: 'Added to queue', description: song.title })
    updateActivity()
  }

  // Subscribe to room updates so participants receive song_url changes
  useEffect(() => {
    if (!roomId) return
    const unsubscribe = subscribeToRoomUpdates(roomId)
    // Ensure local state is fresh
    fetchRoom(roomId)
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [roomId])

  const playSongNow = async (song: any) => {
    updateActivity()
    if (user?.id !== room?.host_id) {
      toast({ title: 'Only the host can play now' })
      return
    }
    try {
      // Pause any currently playing track before switching
      try {
        hostPause()
        audio?.pause()
      } catch {}

      const audioUrl = song.audioUrl || song.audio_url
      const lyricsUrl = song.lyricsUrl || song.lyrics_url || song?.lyrics_data?.content || null
      if (!audioUrl) {
        toast({ title: 'No audio available for this song' })
        return
      }
      // Update room with current song URL (supports full http URLs)
      if (room?.id) {
        await supabase
          .from('karaoke_rooms')
          .update({ song_url: audioUrl, lyrics_url: lyricsUrl })
          .eq('id', room.id)
        await fetchRoom(room.id)
      }
      // Broadcast direct song change so participants switch immediately without waiting for DB realtime
      try {
        const fullSongUrl = audioUrl?.startsWith('http')
          ? audioUrl
          : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/karaoke-songs/${audioUrl}`
        hostSongChange(fullSongUrl, lyricsUrl)
        hostRefreshRoom()
      } catch (e) {
        console.warn('Failed to broadcast song change:', e)
      }
      // Allow the hook to reinitialize the audio element based on updated room state,
      // then trigger play as host.
      setTimeout(() => {
        // Sync first so participants align on the new track time
        hostSync()
        hostPlay()
      }, 400)
      toast({ title: 'Playing now', description: song.title })
    } catch (err) {
      console.error('Error playing song now:', err)
      toast({ title: 'Error', description: 'Could not play the selected song' })
    }
  }

  // Host-controlled playback sync
  const { songChange: hostSongChange, refreshRoom: hostRefreshRoom, play: hostPlay, pause: hostPause, seek: hostSeek, sync: hostSync, syncLyrics: hostSyncLyrics, setMusicVolume: hostSetMusicVolume, setMicVolume: hostSetMicVolume } = useKaraokePlaybackSync({
    roomId,
    isHost: user?.id === room?.host_id,
    audio,
    userId: user?.id || '',
    currentLyric,
    lyrics,
    onVolumeChange: handleVolumeEvent,
    // Soft refresh: re-fetch room so UI/audio/lyrics update without page reload
    onRefresh: () => {
      if (room?.id) fetchRoom(room.id)
    }
  })

  // Volume change handlers
  const handleMusicVolumeChange = (volume: number) => {
    setMusicVolume(volume)
    setKaraokeVolume(volume)
    if (user?.id === room?.host_id) {
      hostSetMusicVolume(volume)
    }
  }

  const handleMicVolumeChange = (volume: number) => {
    setLocalMicVolume(volume)
    setWebRTCMicVolume(volume)
    if (user?.id === room?.host_id) {
      hostSetMicVolume(volume)
    }
  }

  // Activity tracking for auto-close functionality
  const updateActivity = () => {
    setLastActivityTime(Date.now())
  }

  const closeRoomDueToInactivity = async () => {
    if (user?.id === room?.host_id) {
      try {
        // Broadcast room closure to all participants
        if (socket && room?.id) {
          socket.emit('host-end-room', {
            roomId: room.id,
            hostId: user?.id,
            reason: 'inactivity'
          })
        }
        
        await stopStreaming()
        if (room?.id) {
          await leaveRoom(room.id)
        }
        toast({
          title: "Room Closed",
          description: "Room was closed due to 7 minutes of inactivity"
        })
        router.push('/karaoke')
      } catch (error) {
        console.error('Error closing room due to inactivity:', error)
      }
    }
  }
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
    isSongPlaying,
    toggleSong,
    setKaraokeAudio,
    setKaraokeVolume,
    setMicVolume: setWebRTCMicVolume,
    // Monitoring features
    participantAudioLevels,
    hostAudioLevel,
    isHostAudioDetected,
    participantConnectionStatus,
    debugAudioInfo,
    hostWalletAddress,
  } = useWebRTC(roomId, user?.id || '', user?.id === room?.host_id, room?.song_url ?? undefined)
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
  const [showGift, setShowGift] = useState(false)
  const [streakCount, setStreakCount] = useState(0)
  const [showStreak, setShowStreak] = useState(false)
  // Removed debug panel state for cleaner interface
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  
  // Auto-close room after 7 minutes of inactivity
  const [lastActivityTime, setLastActivityTime] = useState(Date.now())
  const [inactivityTimer, setInactivityTimer] = useState<NodeJS.Timeout | null>(null)
  
  // Add a ref for the karaoke audio element
  const karaokeAudioDomRef = useRef<HTMLAudioElement | null>(null);

  // Connect karaoke audio to WebRTC mixing when available
  useEffect(() => {
    if (audio && user?.id === room?.host_id) {
      console.log('Connecting karaoke audio to WebRTC mixing');
      setKaraokeAudio(audio);
    }
  }, [audio, user?.id, room?.host_id, setKaraokeAudio]);

  // Note: Participant auto-play removed - music is now host-controlled only

  // Note: Karaoke playback sync is now handled by useKaraokePlaybackSync hook using Supabase Realtime

  // Track audio playing state
  useEffect(() => {
    if (!audio) return;

    const handlePlay = () => setIsAudioPlaying(true);
    const handlePause = () => setIsAudioPlaying(false);

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, [audio]);

  // Sync lyrics when host's current lyric changes
  useEffect(() => {
    if (user?.id === room?.host_id && currentLyric) {
      hostSyncLyrics();
    }
  }, [currentLyric, user?.id, room?.host_id, hostSyncLyrics]);

  // Update karaoke audio volume when music volume changes
  useEffect(() => {
    if (karaokeAudioDomRef.current) {
      karaokeAudioDomRef.current.volume = musicVolume;
    }
  }, [musicVolume]);

  // Handle volume changes from host (for participants)
  useEffect(() => {
    if (user?.id !== room?.host_id && audio) {
      // Participants should also update their audio volume when host changes it
      audio.volume = musicVolume;
    }
  }, [musicVolume, user?.id, room?.host_id, audio]);

  // Auto-close room after 7 minutes of inactivity
  useEffect(() => {
    if (user?.id === room?.host_id) {
      // Clear existing timer
      if (inactivityTimer) {
        clearTimeout(inactivityTimer)
      }

      // Set new timer for 7 minutes (420000 ms)
      const timer = setTimeout(() => {
        const timeSinceLastActivity = Date.now() - lastActivityTime
        if (timeSinceLastActivity >= 420000) { // 7 minutes
          closeRoomDueToInactivity()
        }
      }, 420000)

      setInactivityTimer(timer)

      // Cleanup timer on unmount
      return () => {
        if (timer) {
          clearTimeout(timer)
        }
      }
    }
  }, [lastActivityTime, user?.id, room?.host_id])
  
  // Reaction handling
  const handleReaction = (type: string) => {
    // update local count
    setReactions(prev => ({
      ...prev,
      [type]: (prev[type] || 0) + 1,
    }));
    // broadcast to room
    socket?.emit('reaction', roomId, type);
    updateActivity(); // Track activity
  };
  
  // Check for mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Note: User interaction handler removed - music is now host-controlled only

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
      
      // Automatic redirect to maintenance page
      //router.push('/karaoke/maintenance')
      //return
      
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

    chatSocket.on('connect', async () => {
      console.log('Chat socket connected:', chatSocket.id);
      chatSocket.emit('join-room', roomId, user.id, user.id === room?.host_id);
      
      // Add participant to database when joining
      if (user?.id && user.id !== room?.host_id) {
        // Guard: ensure room still exists before inserting participant
        const { data: existingRoom, error: roomCheckError } = await supabase
          .from('karaoke_rooms')
          .select('id')
          .eq('id', roomId)
          .maybeSingle();

        if (roomCheckError) {
          console.error('Room existence check failed:', roomCheckError);
        }

        if (!existingRoom) {
          console.warn('Room no longer exists; skipping participant insert');
          // Disconnect socket and redirect to lobby
          chatSocket.disconnect();
          router.push('/karaoke');
          return;
        }

        supabase
          .from('room_participants')
          .insert({
            room_id: roomId,
            user_id: user.id,
            role: 'participant'
          })
          .then(({ error }) => {
            if (error) console.error('Error adding participant:', error);
          });
      }
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
      // Show toast for new messages
      if (message.user.id !== user.id) {
        toast({
          title: `New message from ${message.user.username}`,
          description: message.content,
        });
      }
    });

    chatSocket.on('host-ended-room', (data: { roomId: string, hostId: string }) => {
      if (data.roomId === room?.id && user?.id !== data.hostId) {
        // Stop reconnecting and close socket to prevent stale inserts
        chatSocket.disconnect();
        toast({
          title: "Room Ended",
          description: "The host has ended this karaoke room"
        })
        router.push('/karaoke')
      }
    });


        // Listen for reaction events
    chatSocket.on('reaction', (rId: string, type: string) => {
      if (rId === roomId) {
        setReactions(prev => ({
          ...prev,
          [type]: (prev[type] || 0) + 1,
        }));
      }
    });

        // Listen for user joins
    chatSocket.on('user-joined', (joinedUserId: string, isHost: boolean) => {
      toast({
        title: 'User Joined',
        description: `${joinedUserId} ${isHost ? '(Host)' : ''} joined the room`,
      });
    });

    chatSocket.on('user-left', (leftUserId: string, isHost: boolean) => {
      toast({
        title: 'User Left',
        description: `${leftUserId} ${isHost ? '(Host)' : ''} left the room`,
      });
      
      // If host left, redirect all participants to karaoke lobby
      if (isHost && leftUserId !== user.id) {
        toast({
          title: 'Room Closed',
          description: 'The host has ended the session',
          duration: 5000,
        });
        setTimeout(() => {
          router.push('/karaoke');
        }, 2000);
      }
    });

    chatSocket.on('room-deleted', () => {
      toast({
        title: 'Room Closed',
        description: 'This karaoke room has been closed by the host',
        duration: 5000,
      });
      setTimeout(() => {
        router.push('/karaoke');
      }, 2000);
    });

    setSocket(chatSocket);

    return () => {
      // Clean up participant when component unmounts
      if (user?.id && user.id !== room?.host_id) {
        supabase
          .from('room_participants')
          .delete()
          .eq('room_id', roomId)
          .eq('user_id', user.id)
          .then(({ error }) => {
            if (error) console.error('Error removing participant on unmount:', error);
          });
      }
      
      if (chatSocket) {
        chatSocket.off('chat-message');
        chatSocket.off('reaction');
        chatSocket.off('connect');
        chatSocket.off('connect_error');
        chatSocket.off('disconnect');
        chatSocket.off('error');
        chatSocket.off('user-joined');
        chatSocket.off('user-left');
        chatSocket.off('room-deleted');
        chatSocket.disconnect();
      }
    };
  }, [user, roomId, room?.host_id, router, toast]);

  // Add streaming state effect
  useEffect(() => {
    let isMounted = true;

    const setupStreamingState = async () => {
      if (!isMounted || !call) return;
      
      // Check if we've had user interaction yet
      if (!hasUserInteracted) {
        // Don't auto-start streaming, wait for user interaction via the JoinStreamModal
        return;
      }
      
      // For host, we initialize streaming when they have interaction
      if (user?.id === room?.host_id && !isStreaming) {
        try {
          console.log('Host initializing streaming after user interaction');
          await startStreaming();
        } catch (err: any) {
          console.error('Host streaming initialization error:', err);
          if (isMounted) {
            toast({
              variant: "destructive",
              title: "Streaming Error",
              description: err?.message || "Failed to initialize streaming",
              duration: 5000,
            });
          }
        }
      } 
      // For participants, we ensure they can receive audio after interaction
      else if (user?.id !== room?.host_id) {
        try {
          console.log('Participant preparing to receive audio after user interaction');
          await startStreaming(); // This will put them in receive-only mode
        } catch (err: any) {
          console.error('Participant streaming initialization error:', err);
          if (isMounted) {
            toast({
              variant: "destructive",
              title: "Streaming Error",
              description: err?.message || "Failed to initialize audio reception",
              duration: 5000,
            });
          }
        }
      }
    };

    setupStreamingState();

    return () => {
      isMounted = false;
    };
  }, [user?.id, room?.host_id, isStreaming, startStreaming, toast, call, hasUserInteracted]);

  const handleLeaveRoom = async () => {
    try {
      // If user is the host, delete the room from database
      if (user?.id === room?.host_id) {
        const { error } = await supabase
          .from('karaoke_rooms')
          .delete()
          .eq('id', roomId);
        
        if (error) {
          console.error('Error deleting room:', error);
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to delete room",
            duration: 3000,
          });
        } else {
          toast({
            title: "Room Deleted",
            description: "The karaoke room has been closed",
            duration: 3000,
          });
        }
      }
      
      await leaveRoom(roomId);
      if (call) {
        await call.leave();
      }
      
      // Remove participant from database when leaving
      if (user?.id && user.id !== room?.host_id) {
        await supabase
          .from('room_participants')
          .delete()
          .eq('room_id', roomId)
          .eq('user_id', user.id);
      }
      
      // Emit leave event to socket for participant count tracking
      if (socket) {
        socket.emit('leave-room', roomId, user?.id);
      }
      
    } catch (error) {
      console.error('Error leaving room:', error);
    } finally {
      router.push('/karaoke');
    }
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
      updateActivity() // Track activity
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
    if (user?.id !== room?.host_id) return null;

    return (
      <div className="flex flex-col md:flex-row items-center justify-center space-y-2 md:space-y-0 md:space-x-4">
        {/* Main Controls Row */}
        <div className="flex items-center justify-center space-x-2 md:space-x-4">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-white/10 hover:bg-white/20"
              onClick={() => {
                if (isAudioPlaying) {
                  hostPause();
                  updateActivity(); // Track activity
                } else {
                  hostPlay();
                  updateActivity(); // Track activity
                }
              }}
            >
              {isAudioPlaying ? (
                <Pause className="h-5 w-5 md:h-6 md:w-6 text-white" />
              ) : (
                <Play className="h-5 w-5 md:h-6 md:w-6 text-white" />
              )}
            </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isSongPlaying ? 'Pause' : 'Play'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Sync Button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost" 
                  size="icon" 
                  className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-white/10 hover:bg-white/20"
                  onClick={() => hostSync()}
                >
                  <Music className="h-5 w-5 md:h-6 md:w-6 text-white" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Sync All Participants</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Lyrics Sync Button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost" 
                  size="icon" 
                  className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-white/10 hover:bg-white/20"
                  onClick={() => {
                    hostSyncLyrics();
                    toast({
                      title: "Lyrics Synced",
                      description: "All participants' lyrics have been synchronized.",
                    });
                  }}
                >
                  <MessageSquare className="h-5 w-5 md:h-6 md:w-6 text-white" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Sync Lyrics</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Removed debug button for cleaner interface */}
        </div>

        {/* Simplified volume controls - removed detailed sliders for cleaner interface */}
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



  // Add streak counter
  useEffect(() => {
    if (currentLyric) {
      setStreakCount(prev => prev + 1);
      setShowStreak(true);
      setTimeout(() => setShowStreak(false), 2000);
    }
  }, [currentLyric]);
  
  // Attach the audio element to the DOM and connect to mixing logic
  useEffect(() => {
    if (karaokeAudioDomRef.current) {
      setKaraokeAudio(karaokeAudioDomRef.current);
      console.log('[KaraokeRoom] Karaoke audio element attached:', karaokeAudioDomRef.current.src);
    }
  }, [setKaraokeAudio, room?.song_url]);

  // Debug logs for lyrics
  useEffect(() => {
    console.log('[KaraokeRoom] currentLyric:', currentLyric);
    console.log('[KaraokeRoom] nextLyrics:', nextLyrics);
  }, [currentLyric, nextLyrics]);

  // Log the karaoke song URL for debugging
  useEffect(() => {
    if (room?.song_url) {
      console.log('[KaraokeRoom] Karaoke song URL:', room.song_url);
    }
  }, [room?.song_url]);
  
  // Removed debug panel for cleaner interface
  
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

  // Show loading screen until room data and video call are ready
  if (roomLoading || !videoClient || !call) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold mb-4">Loading room...</h1>
      </div>
    );
  }

  // If loading has finished and no room was found, show not-found message
  if (!room) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold mb-4">Room Not Found</h1>
        <Button asChild>
          <Link href="/karaoke">Back to Rooms</Link>
        </Button>
      </div>
    );
  }
  
  return (
    <StreamVideo client={videoClient}>
      <Toaster />
      <StreamCall call={call}>
        {/* Ensure karaoke audio element is in the DOM, hidden */}
        {room?.song_url && (
          <audio
            ref={karaokeAudioDomRef}
            src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/karaoke-songs/${room.song_url}`}
            style={{ display: 'none' }}
            preload="auto"
            onLoadedData={() => console.log('[KaraokeRoom] Karaoke audio loaded')}
            onError={e => console.error('[KaraokeRoom] Audio error', e)}
          />
        )}
        <div className="hidden">
          <SpeakerLayout />
        </div>
        <div className="flex flex-col h-screen bg-background">
          {!hasUserInteracted && (
            <JoinStreamModal 
              onJoin={handleJoinStream}
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
                <div className="flex items-center space-x-4">
                  <p className="text-sm text-muted-foreground">
                    Hosted by {room.host?.username}
                  </p>
                  <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{room.participants?.length || 0} participants</span>
                  </div>
                </div>
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
                  onClick={async () => {
                    try {
                      // Broadcast room closure to all participants
                      if (socket && room?.id) {
                        socket.emit('host-end-room', {
                          roomId: room.id,
                          hostId: user?.id
                        })
                      }
                      
                      await stopStreaming()
                      if (room?.id) {
                        await leaveRoom(room.id)
                      }
                      router.push('/karaoke')
                    } catch (error) {
                      console.error('Error ending stream:', error)
                      toast({
                        variant: "destructive",
                        title: "Error",
                        description: "Failed to end stream properly"
                      })
                    }
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

              {/* Add reaction & gift buttons */}
              <div className="absolute top-4 right-4 z-30 flex items-center space-x-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 rounded-full border bg-muted hover:bg-muted/80 text-foreground shadow-sm"
                      aria-label="Open reactions"
                    >
                      <Sparkles className="h-5 w-5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2 flex space-x-2" align="end" side="bottom">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleReaction('heart')}
                      aria-label="Send heart reaction"
                    >
                      <Heart className="h-4 w-4 text-red-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleReaction('star')}
                      aria-label="Send star reaction"
                    >
                      <Star className="h-4 w-4 text-yellow-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleReaction('thumbsUp')}
                      aria-label="Send thumbs up reaction"
                    >
                      <ThumbsUp className="h-4 w-4 text-blue-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleReaction('clap')}
                      aria-label="Send clap reaction"
                    >
                      <Hand className="h-4 w-4 text-green-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleReaction('sparkles')}
                      aria-label="Send sparkles reaction"
                    >
                      <Sparkles className="h-4 w-4 text-purple-500" />
                    </Button>
                  </PopoverContent>
                </Popover>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full border bg-muted hover:bg-muted/80 text-foreground shadow-sm"
                  onClick={() => setShowGift(true)}
                  aria-label="Send gift to host"
                >
                  <Gift className="h-5 w-5" />
                </Button>
              </div>

              {/* Gift panel */}
              {showGift && (
                <div className="absolute top-16 right-4 z-50">
                  <GiftHost
                    recipientAddress={hostWalletAddress || (((call?.state as any)?.custom?.hostWalletAddress as string) || null)}
                    recipientName={'Host'}
                    onClose={() => setShowGift(false)}
                    onSuccess={() => setShowGift(false)}
                  />
                </div>
              )}

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
                      {user?.id !== room.host_id && (
                        <div className="text-sm text-white/60 mt-2 flex items-center justify-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white/60 mr-2"></div>
                          Synced with Host
                        </div>
                      )}
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white text-sm min-w-[40px]">{formatTime(currentTime)}</span>
                    <div 
                      className={`flex-1 h-2 bg-white/20 rounded-full overflow-hidden ${user?.id === room.host_id ? 'cursor-pointer' : 'cursor-default'}`}
                      onClick={(e) => {
                        if (user?.id === room.host_id) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const clickX = e.clientX - rect.left;
                          const percentage = clickX / rect.width;
                          const newTime = percentage * (room.current_song?.duration || 1);
                          hostSeek(newTime);
                          updateActivity(); // Track activity
                        }
                      }}
                    >
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
                      {renderPlaybackControls()}
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 md:gap-4">
                      <Badge variant="secondary" className="text-xs sm:text-sm px-2 py-1 flex items-center space-x-1">
                        <Music className="h-4 w-4" />
                        <span className="truncate">{isAudioPlaying ? 'Playing' : 'Paused'}</span>
                      </Badge>
                      <Badge variant="outline" className="text-xs sm:text-sm px-2 py-1 flex items-center space-x-1">
                        <Crown className="h-4 w-4" />
                        <span className="truncate">Host Controlled</span>
                      </Badge>
                      <Badge variant="default" className="text-xs sm:text-sm px-2 py-1 flex items-center space-x-1 bg-green-600">
                        <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-white mr-1"></div>
                        <span className="truncate">Synced</span>
                      </Badge>
                      {/* <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2 text-xs md:text-sm min-w-0 px-2 py-1 sm:px-3 sm:py-2"
                        onClick={handleRequestSingPermission}
                      >
                        <Mic className="h-3 w-3 md:h-4 md:w-4" />
                        <span className="truncate">Request to Sing</span>
                      </Button> */}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {isMobile && !isSidebarOpen && (
  <>
    <Button
      variant="ghost"
      size="icon"
      className="fixed bottom-24 sm:bottom-20 right-4 h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 z-50"
      onClick={() => setIsSidebarOpen(true)}
    >
      <MessageSquare className="h-6 w-6 text-white" />
    </Button>
  </>
)}
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
                {/* <div className="flex space-x-2">
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
                </div> */}
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
                      <TabsTrigger value="songs" className="flex items-center space-x-2">
                        <Music className="h-4 w-4" />
                        <span>Songs</span>
                      </TabsTrigger>
                    )}
                    {/* {user?.id === room.host_id && (
                      <TabsTrigger value="permissions" className="flex items-center space-x-2">
                        <Crown className="h-4 w-4" />
                        <span>Permissions</span>
                      </TabsTrigger>
                    )} */}
                  </TabsList>

                  {/* Only show Songs tab content to host */}
                  {user?.id === room.host_id && (
                    <TabsContent value="songs" className="h-[calc(100vh-8rem)]">
                      <div className="p-4 space-y-3">
                        <SongPicker 
                          onSongSelect={handleSongSelect} 
                          selectedSongId={selectedSongId}
                          showActions
                          onPlayNow={playSongNow}
                          onAddToQueue={addSongToQueue}
                        />
                      </div>
                    </TabsContent>
                  )}
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
                      {dedupedRoomParticipants?.map((participant: any) => (
                        <div key={participant.user.id} className="flex items-center space-x-3">
                          <Avatar>
                            <AvatarImage src={participant.user.avatar_url} alt={participant.user.username} />
                            <AvatarFallback>{participant.user.username?.slice(0, 2) || 'U'}</AvatarFallback>
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
                </Tabs>
              </ScrollArea>
            </div>
          </div>
        </div>
      </StreamCall>
    </StreamVideo>
  )
}