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
}

export function useWebRTC(roomId: string, userId: string, isHost: boolean, songUrl?: string): UseWebRTCReturn {
  // Note: signature updated to include optional songUrl.
  const [videoClient, setVideoClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<Call | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionRequests, setPermissionRequests] = useState<PermissionRequestEvent[]>([]);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [isSongPlaying, setIsSongPlaying] = useState(false);
  const karaokeAudioRef = useRef<HTMLAudioElement | null>(null);

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
            console.log('Host permissions granted');
            
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
      };
      cleanup();
    };
  }, [userId, roomId, isHost]);

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

  // Add call state listener
  useEffect(() => {
    if (!call) return;

    const handleCallUpdated = (event: any) => {
      console.log('Call updated event:', event);
      const { custom } = event;
      if (custom?.isStreaming !== undefined) {
        console.log('Host streaming status changed:', custom.isStreaming);
        setIsStreaming(custom.isStreaming);
      }
      
      // Log participants and their audio states
      console.log('Current participants:', call.state.participants.map(p => ({
        id: p.userId,
        isSpeaking: p.isSpeaking,
        publishedTracks: p.publishedTracks,
        audioLevel: p.audioLevel,
        hasAudio: p.publishedTracks.length > 0,
        hasVideo: p.publishedTracks.length > 0
      })));

      // Handle audio subscription for participants
      if (!isHost) {
        const hostParticipant = call.state.participants.find(p => 
          p.userId === call.state.createdBy?.id
        );
        
        if (hostParticipant) {
          console.log('Host participant audio status:', {
            isSpeaking: hostParticipant.isSpeaking,
            publishedTracks: hostParticipant.publishedTracks,
            audioLevel: hostParticipant.audioLevel,
            hasAudio: hostParticipant.publishedTracks.length > 0
          });

          // Test audio feedback
          if (hostParticipant.isSpeaking) {
            console.log('🎤 Host is speaking! Audio level:', hostParticipant.audioLevel);
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

  const startStreaming = async () => {
    if (!call) {
      setError('Call not initialized');
      return;
    }

    try {
      if (isHost) {
        // Host: publish microphone only
        await call.microphone.enable();
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
        await audioEl.play();
      } else {
        audioEl.pause();
      }
    } catch (err) {
      console.error('Error toggling karaoke audio:', err);
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
    setHasUserInteracted,
  };
} 