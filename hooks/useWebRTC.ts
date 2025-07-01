import { useState, useEffect, useRef } from 'react';
import { 
  StreamVideoClient, 
  Call, 
  OwnCapability, 
  PermissionRequestEvent,
} from '@stream-io/video-react-sdk';

interface UseWebRTCReturn {
  startStreaming: () => Promise<void>;
  stopStreaming: () => Promise<void>;
  isStreaming: boolean;
  error: string | null;
  toggleMic: () => Promise<void>;
  isSongPlaying: boolean;
  toggleSong: () => Promise<void>;
  videoClient: StreamVideoClient | null;
  call: Call | null;
  requestSingPermission: () => Promise<void>;
  permissionRequests: PermissionRequestEvent[];
  grantPermission: (userId: string, permissions: string[]) => Promise<void>;
  revokePermission: (userId: string, permissions: string[]) => Promise<void>;
  hasUserInteracted: boolean;
  setHasUserInteracted: (value: boolean) => void;
  setKaraokeAudio: (audioElement: HTMLAudioElement | null) => void;
  setKaraokeVolume: (volume: number) => void;
  setMicVolume: (volume: number) => void;
  // New monitoring features
  participantAudioLevels: { [userId: string]: number };
  hostAudioLevel: number;
  isHostAudioDetected: boolean;
  participantConnectionStatus: { [userId: string]: 'connected' | 'disconnected' | 'connecting' };
  debugAudioInfo: () => void;
}

export function useWebRTC(roomId: string, userId: string, isHost: boolean, songUrl?: string): UseWebRTCReturn {
  const [videoClient, setVideoClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<Call | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionRequests, setPermissionRequests] = useState<PermissionRequestEvent[]>([]);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [isSongPlaying, setIsSongPlaying] = useState(false);
  
  // Audio monitoring state
  const [participantAudioLevels, setParticipantAudioLevels] = useState<{ [userId: string]: number }>({});
  const [hostAudioLevel, setHostAudioLevel] = useState(0);
  const [isHostAudioDetected, setIsHostAudioDetected] = useState(false);
  const [participantConnectionStatus, setParticipantConnectionStatus] = useState<{ [userId: string]: 'connected' | 'disconnected' | 'connecting' }>({});
  
  // Audio mixing refs
  const karaokeAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const karaokeSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const micGainRef = useRef<GainNode | null>(null);
  const karaokeGainRef = useRef<GainNode | null>(null);
  const mixerRef = useRef<GainNode | null>(null);
  const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const mixedStreamRef = useRef<MediaStream | null>(null);

  // Initialize Stream Video Client
  useEffect(() => {
    if (!userId || !roomId) return;

    const initClient = async () => {
      try {
        const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
        if (!apiKey) {
          throw new Error('Stream API key is missing');
        }

        // Fetch Stream token from server
        const response = await fetch('/api/stream-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({ userId }),
          credentials: 'include',
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('Token fetch error:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData.error,
            details: errorData.details,
          });
          throw new Error(errorData.error || `Failed to fetch Stream token: ${response.status} ${response.statusText}`);
        }

        const { token } = await response.json();

        const client = StreamVideoClient.getOrCreateInstance({
          apiKey,
          token,
          user: {
            id: userId,
            name: userId,
          },
          options: {
            locationHintUrl: 'us-east',
          }
        });

        // Create or join audio room call
        const callInstance = client.call('audio_room', roomId);
        
        // Join the call with proper cleanup
        try {
          // Join the call with specific settings
          await callInstance.join({ 
            create: isHost,
          });
          console.log('Successfully joined call:', callInstance.state);

          // Configure audio/video settings after joining
          await callInstance.camera.disable(); // Ensure video is off since this is audio-only

          // Grant host permissions
          if (isHost) {
            await callInstance.grantPermissions(userId, [
              'send-audio',
              'send-video'
            ]);
            console.log('[useWebRTC] Host permissions granted for', userId);
            console.log('[useWebRTC] Own capabilities after grant:', callInstance.state.ownCapabilities);
            // Host should enable microphone immediately with default constraints
            await callInstance.microphone.enable();
            console.log('Host microphone enabled on join');
          } else {
            // For participants, ensure they start with no permissions
            await callInstance.revokePermissions(userId, ['send-audio', 'send-video']);
            console.log('Participant permissions revoked');
            
            // Ensure participant can receive audio
            const hostParticipant = callInstance.state.participants.find(p => 
              p.userId === callInstance.state.createdBy?.id
            );
            
            if (hostParticipant) {
              console.log('Host participant found on join:', {
                isSpeaking: hostParticipant.isSpeaking,
                publishedTracks: hostParticipant.publishedTracks
              });
            }
          }

          setVideoClient(client);
          setCall(callInstance);
        } catch (err) {
          console.error('Error joining call:', err);
          // Cleanup on error
          await callInstance.leave();
          client.disconnectUser();
          throw err;
        }
      } catch (err: any) {
        console.error('Stream initialization error:', err);
        setError(err.message || 'Failed to initialize Stream client');
      }
    };

    initClient();

    return () => {
      const cleanup = async () => {
        if (call) {
          try {
            await call.leave();
            console.log('Successfully left call');
          } catch (err) {
            console.error('Error leaving call:', err);
          }
        }
        if (videoClient) {
          try {
            videoClient.disconnectUser();
            console.log('Successfully disconnected user');
          } catch (err) {
            console.error('Error disconnecting user:', err);
          }
        }
        // Cleanup audio mixing
        cleanupAudioMixing();
      };
      cleanup();
    };
  }, [userId, roomId, isHost]);

  // Audio mixing setup for host
  const setupAudioMixing = async () => {
    if (!isHost || !songUrl) return;
    
    console.log('[useWebRTC] Setting up audio mixing with songUrl:', songUrl);

    // Clean up any existing audio mixing first
    cleanupAudioMixing();

    // Construct the full Supabase URL if it's a relative path
    const fullSongUrl = songUrl.startsWith('http') 
      ? songUrl 
      : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/karaoke-songs/${songUrl}`;
    
    console.log('[useWebRTC] Full song URL for mixing:', fullSongUrl);

    // Create a new, off-DOM audio element for mixing
    const mixingAudio = new Audio(fullSongUrl);
    mixingAudio.crossOrigin = 'anonymous';
    mixingAudio.preload = 'auto';
    mixingAudio.muted = false; // Allow audio to play through speakers
    
    // Add error handling for audio loading
    mixingAudio.addEventListener('error', (e) => {
      console.error('Error loading karaoke audio for mixing:', e);
      console.error('Audio URL:', fullSongUrl);
      setError('Failed to load karaoke audio for mixing');
    });

    try {
      // Create a single AudioContext for all audio nodes
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      
      // Create karaoke source from the mixing audio element
      const karaokeSource = audioContext.createMediaElementSource(mixingAudio);
      karaokeSourceRef.current = karaokeSource;

      // Create gain nodes for volume control in the same audio context
      const karaokeGain = audioContext.createGain();
      karaokeGain.gain.value = 0.6; // Default karaoke volume
      karaokeGainRef.current = karaokeGain;

      // Connect karaoke audio to speakers (this will be picked up by the microphone)
      karaokeSource.connect(karaokeGain);
      karaokeGain.connect(audioContext.destination);

      // Store the mixing audio element for later control
      karaokeAudioRef.current = mixingAudio;

      console.log('[useWebRTC] Audio mixing setup complete - karaoke audio will play through speakers and be picked up by microphone');
    } catch (err) {
      console.error('Error setting up audio mixing:', err);
      setError('Failed to setup audio mixing');
      // Clean up on error
      cleanupAudioMixing();
    }
  };

  // Cleanup audio mixing
  const cleanupAudioMixing = () => {
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    karaokeSourceRef.current = null;
    karaokeGainRef.current = null;
    karaokeAudioRef.current = null;
  };

  // Set karaoke audio element
  const setKaraokeAudio = (audioElement: HTMLAudioElement | null) => {
    if (isHost) {
      // Host: use off-DOM audio for mixing (already set up in setupAudioMixing)
      console.log('[useWebRTC] Host: Audio mixing already configured');
    } else {
      // Participants: use DOM audio element as usual
      karaokeAudioRef.current = audioElement;
    }
  };

  // Volume control functions
  const setKaraokeVolume = (volume: number) => {
    if (karaokeGainRef.current) {
      karaokeGainRef.current.gain.value = Math.max(0, Math.min(1, volume));
      console.log('[useWebRTC] Karaoke volume set to:', volume);
    }
  };

  const setMicVolume = (volume: number) => {
    // Note: Mic volume is now controlled by the user's system microphone settings
    // This function is kept for compatibility but doesn't affect the actual mic volume
    console.log('[useWebRTC] Mic volume control not available in current setup - use system settings');
  };

  // Handle permission requests (host only)
  useEffect(() => {
    if (!call || !isHost) return;

    const handlePermissionRequest = (event: PermissionRequestEvent) => {
      console.log('Permission request received:', event);
      setPermissionRequests((prev) => [
        ...prev.filter((req) => req.user.id !== event.user.id),
        event
      ]);
    };

    call.on('call.permission_request', handlePermissionRequest);

    return () => {
      call.off('call.permission_request', handlePermissionRequest);
    };
  }, [call, isHost]);

  // Add call state listener with enhanced monitoring
  useEffect(() => {
    if (!call) return;

    const handleCallUpdated = (event: any) => {
      console.log('Call updated event:', event);
      const { custom } = event;
      if (custom?.isStreaming !== undefined) {
        console.log('Host streaming status changed:', custom.isStreaming);
        setIsStreaming(custom.isStreaming);
      }
      
      // Enhanced participant monitoring
      const participants = call.state.participants;
      const newAudioLevels: { [userId: string]: number } = {};
      const newConnectionStatus: { [userId: string]: 'connected' | 'disconnected' | 'connecting' } = {};
      
      participants.forEach(participant => {
        // Track audio levels
        newAudioLevels[participant.userId] = participant.audioLevel || 0;
        
        // Track connection status - use available properties
        if (participant.publishedTracks.length > 0) {
          newConnectionStatus[participant.userId] = 'connected';
        } else if (participant.userId === call.state.createdBy?.id) {
          // Host is always considered connected if they're the creator
          newConnectionStatus[participant.userId] = 'connected';
        } else {
          newConnectionStatus[participant.userId] = 'disconnected';
        }
        
        // Log detailed participant info
        console.log(`Participant ${participant.userId}:`, {
          isSpeaking: participant.isSpeaking,
          audioLevel: participant.audioLevel,
          publishedTracks: participant.publishedTracks,
          hasAudio: participant.publishedTracks.length > 0,
          isHost: participant.userId === call.state.createdBy?.id
        });
      });
      
      setParticipantAudioLevels(newAudioLevels);
      setParticipantConnectionStatus(newConnectionStatus);
      
      // Handle audio subscription for participants
      if (!isHost) {
        const hostParticipant = participants.find(p => 
          p.userId === call.state.createdBy?.id
        );
        
        if (hostParticipant) {
          const hostLevel = hostParticipant.audioLevel || 0;
          setHostAudioLevel(hostLevel);
          setIsHostAudioDetected(hostLevel > 0.01); // Threshold for audio detection
          
          console.log('🎤 Host audio status:', {
            isSpeaking: hostParticipant.isSpeaking,
            audioLevel: hostLevel,
            publishedTracks: hostParticipant.publishedTracks,
            hasAudio: hostParticipant.publishedTracks.length > 0,
            isAudioDetected: hostLevel > 0.01
          });

          // Test audio feedback
          if (hostParticipant.isSpeaking) {
            console.log('🎤 Host is speaking! Audio level:', hostLevel);
          }
        }
      }
    };

    call.on('call.updated', handleCallUpdated);

    // Log initial state
    console.log('Initial call state:', {
      participants: call.state.participants.map(p => ({
        id: p.userId,
        isSpeaking: p.isSpeaking,
        publishedTracks: p.publishedTracks,
        audioLevel: p.audioLevel,
        hasAudio: p.publishedTracks.length > 0
      })),
      capabilities: call.state.ownCapabilities,
      isStreaming: isStreaming
    });

    return () => {
      call.off('call.updated', handleCallUpdated);
    };
  }, [call, isStreaming, isHost]);

  // Debug function to log comprehensive audio information
  const debugAudioInfo = () => {
    console.log('=== AUDIO DEBUG INFO ===');
    console.log('Call state:', {
      isStreaming,
      isHost,
      hasUserInteracted,
      isSongPlaying
    });
    
    if (call) {
      console.log('Participants:', call.state.participants.map(p => ({
        id: p.userId,
        isHost: p.userId === call.state.createdBy?.id,
        isSpeaking: p.isSpeaking,
        audioLevel: p.audioLevel,
        publishedTracks: p.publishedTracks,
        hasAudio: p.publishedTracks.length > 0
      })));
    }
    
    console.log('Audio mixing state:', {
      hasAudioContext: !!audioContextRef.current,
      hasKaraokeSource: !!karaokeSourceRef.current,
      hasKaraokeAudio: !!karaokeAudioRef.current,
      audioContextState: audioContextRef.current?.state
    });
    
    console.log('Audio levels:', {
      participantAudioLevels,
      hostAudioLevel,
      isHostAudioDetected
    });
    
    console.log('Connection status:', participantConnectionStatus);
    
    if (karaokeAudioRef.current) {
      console.log('Karaoke audio:', {
        src: karaokeAudioRef.current.src,
        paused: karaokeAudioRef.current.paused,
        currentTime: karaokeAudioRef.current.currentTime,
        duration: karaokeAudioRef.current.duration,
        volume: karaokeAudioRef.current.volume,
        muted: karaokeAudioRef.current.muted
      });
    }
    
    console.log('=== END AUDIO DEBUG ===');
  };

  const startStreaming = async () => {
    if (!call) {
      setError('Call not initialized');
      return;
    }

    try {
      if (isHost) {
        console.log('[useWebRTC] Host starting streaming...');
        console.log('[useWebRTC] Audio mixing state:', {
          hasAudioContext: !!audioContextRef.current,
          hasKaraokeSource: !!karaokeSourceRef.current,
          hasKaraokeAudio: !!karaokeAudioRef.current,
          audioContextState: audioContextRef.current?.state
        });
        
        // Resume audio context if suspended
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
          console.log('[useWebRTC] Audio context resumed');
        }
        
        // Enable microphone - this will pick up both the host's voice and the karaoke audio from speakers
        await call.microphone.enable();
        console.log('[useWebRTC] Host microphone enabled - will pick up voice + karaoke audio from speakers');
        
        setIsStreaming(true);
        setError(null);
      } else {
        console.log('Participant joining (listen-only)');
        // Participants join in receive-only mode
        await call.microphone.disable();
        setIsStreaming(true);
        setError(null);
      }
    } catch (err: any) {
      console.error('Streaming error details:', err);
      setError(err.message || 'Failed to start streaming');
    }
  };

  const stopStreaming = async () => {
    if (!call) return;

    try {
      await call.microphone.disable();
      
      if (isHost) {
        // Update host status
        await call.update({
          custom: {
            isStreaming: false
          }
        });
      }
      
      setIsStreaming(false);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to stop streaming');
      console.error('Stop streaming error:', err);
    }
  };

  const toggleMic = async () => {
    if (!call) {
      setError('Call not initialized');
      return;
    }

    try {
      if (isStreaming) {
        await call.microphone.disable();
        setIsStreaming(false);
      } else {
        const hasAudioPermission = isHost || call.state.ownCapabilities.includes(OwnCapability.SEND_AUDIO);
        if (hasAudioPermission) {
          await call.microphone.enable();
          setIsStreaming(true);
        } else {
          setError('You need permission to enable the microphone');
        }
      }
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to toggle microphone');
      console.error('Toggle mic error:', err);
    }
  };

  const requestSingPermission = async () => {
    if (!call) {
      throw new Error('Call not initialized');
    }

    try {
      await call.requestPermissions({
        permissions: [OwnCapability.SEND_AUDIO],
      });
    } catch (err: any) {
      throw new Error(err.message || 'Failed to request singing permission');
    }
  };

  const grantPermission = async (userId: string, permissions: string[]) => {
    if (!call || !isHost) return;

    try {
      await call.grantPermissions(userId, permissions);
      setPermissionRequests((prev) => prev.filter((req) => req.user.id !== userId));
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to grant permission');
      console.error('Grant permission error:', err);
    }
  };

  const revokePermission = async (userId: string, permissions: string[]) => {
    if (!call || !isHost) return;

    try {
      await call.revokePermissions(userId, permissions);
      setPermissionRequests((prev) => prev.filter((req) => req.user.id !== userId));
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to revoke permission');
      console.error('Revoke permission error:', err);
    }
  };

  const toggleSong = async () => {
    const audioEl = karaokeAudioRef.current;
    if (!audioEl) return;
    
    try {
      if (audioEl.paused) {
        // Resume the audio context if it's suspended (required for autoplay)
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }
        
        await audioEl.play();
        setIsSongPlaying(true);
      } else {
        audioEl.pause();
        setIsSongPlaying(false);
      }
    } catch (err: any) {
      console.error('Error toggling karaoke audio:', err);
      // If autoplay fails, try to resume the audio context and try again
      if (err.name === 'AbortError' && audioContextRef.current) {
        try {
          await audioContextRef.current.resume();
          await audioEl.play();
          setIsSongPlaying(true);
        } catch (retryErr) {
          console.error('Retry failed:', retryErr);
          setError('Failed to play karaoke audio. Please interact with the page first.');
        }
      } else {
        setError('Failed to toggle karaoke audio');
      }
    }
  };

  const handleUserInteraction = (value: boolean) => {
    setHasUserInteracted(value);
    if (value && isHost && songUrl && !karaokeSourceRef.current) {
      // Set up audio mixing on first user interaction
      console.log('[useWebRTC] User interacted, setting up audio mixing');
      setupAudioMixing();
    }
  };

  return {
    startStreaming,
    stopStreaming,
    isStreaming,
    error,
    toggleMic,
    isSongPlaying,
    toggleSong,
    videoClient,
    call,
    requestSingPermission,
    permissionRequests,
    grantPermission,
    revokePermission,
    hasUserInteracted,
    setHasUserInteracted: handleUserInteraction,
    setKaraokeAudio,
    setKaraokeVolume,
    setMicVolume,
    // Monitoring features
    participantAudioLevels,
    hostAudioLevel,
    isHostAudioDetected,
    participantConnectionStatus,
    debugAudioInfo,
  };
} 