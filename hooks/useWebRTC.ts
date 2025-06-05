import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import SimplePeer from 'simple-peer';

interface UseWebRTCReturn {
  startStreaming: () => Promise<void>;
  stopStreaming: () => void;
  isStreaming: boolean;
  error: string | null;
  toggleMic: () => void;
}

export function useWebRTC(roomId: string, userId: string, isHost: boolean): UseWebRTCReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<SimplePeer.Instance | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Initialize Socket.IO connection with reconnection options
    socketRef.current = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001', {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000
    });

    // Join room
    socketRef.current.emit('join-room', roomId, userId, isHost);

    // Handle WebRTC signaling
    socketRef.current.on('offer', async (fromUserId: string, offer: any) => {
      if (!isHost) {
        try {
          const peer = new SimplePeer({
            initiator: false,
            trickle: false,
            stream: undefined, // Participants don't send stream
            config: {
              iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' }
              ]
            }
          });

          peer.on('signal', (data) => {
            socketRef.current?.emit('answer', roomId, userId, data);
          });

          peer.on('stream', (stream) => {
            // Create or update audio element
            if (!audioElementRef.current) {
              audioElementRef.current = document.createElement('audio');
              audioElementRef.current.autoplay = true;
              document.body.appendChild(audioElementRef.current);
            }
            audioElementRef.current.srcObject = stream;
          });

          peer.on('error', (err) => {
            console.error('Peer error:', err);
            setError('Peer connection error');
          });

          peer.signal(offer);
          peerRef.current = peer;
        } catch (err) {
          console.error('Error handling offer:', err);
          setError('Failed to establish peer connection');
        }
      }
    });

    socketRef.current.on('answer', (fromUserId: string, answer: any) => {
      if (isHost && peerRef.current) {
        peerRef.current.signal(answer);
      }
    });

    socketRef.current.on('ice-candidate', (fromUserId: string, candidate: any) => {
      if (peerRef.current) {
        peerRef.current.signal(candidate);
      }
    });

    socketRef.current.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setError('Failed to connect to server');
    });

    return () => {
      stopStreaming();
      socketRef.current?.disconnect();
      if (audioElementRef.current) {
        audioElementRef.current.remove();
        audioElementRef.current = null;
      }
    };
  }, [roomId, userId, isHost]);

  const startStreaming = async () => {
    try {
      if (!isHost) {
        setError('Only the host can start streaming');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      streamRef.current = stream;

      const peer = new SimplePeer({
        initiator: true,
        trickle: false,
        stream,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' }
          ]
        }
      });

      peer.on('signal', (data) => {
        socketRef.current?.emit('offer', roomId, userId, data);
      });

      peer.on('error', (err) => {
        console.error('Peer error:', err);
        setError('Peer connection error');
      });

      peerRef.current = peer;
      setIsStreaming(true);
      setError(null);
    } catch (err) {
      console.error('Error starting stream:', err);
      setError('Failed to access microphone');
    }
  };

  const stopStreaming = () => {
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (audioElementRef.current) {
      audioElementRef.current.remove();
      audioElementRef.current = null;
    }

    setIsStreaming(false);
  };

  const toggleMic = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
      }
    }
  };

  return {
    startStreaming,
    stopStreaming,
    isStreaming,
    error,
    toggleMic
  };
} 