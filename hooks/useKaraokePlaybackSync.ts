'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface UseKaraokePlaybackSyncProps {
  roomId: string;
  isHost: boolean;
  audio: HTMLAudioElement | null;
  userId: string;
  currentLyric?: string | null;
  lyrics?: Array<{ time: number; text: string }>;
}

interface PlaybackEvent {
  type: 'play' | 'pause' | 'seek' | 'sync' | 'lyrics' | 'volume';
  time: number;
  userId: string;
  timestamp: number;
  lyric?: string;
  volumeType?: 'music' | 'mic';
  volume?: number;
}

export function useKaraokePlaybackSync({ roomId, isHost, audio, userId, currentLyric, lyrics }: UseKaraokePlaybackSyncProps) {
  const channelRef = useRef<any>(null);

  // Join Supabase Realtime channel for this room
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase.channel(`karaoke-playback:${roomId}`);
    channelRef.current = channel;
    channel.subscribe();

    // Listen for playback events from host
    channel.on('broadcast', { event: 'karaoke-playback' }, ({ payload }: { payload: PlaybackEvent }) => {
      if (!audio || payload.userId === userId) return; // Don't react to own events

      console.log('[KaraokePlaybackSync] Received playback event:', payload);

      switch (payload.type) {
        case 'play':
          console.log('[KaraokePlaybackSync] Playing audio at time:', payload.time);
          // Small delay to prevent audio interruption
          setTimeout(() => {
            if (audio) {
              audio.currentTime = payload.time;
              audio.play().catch(err => {
                console.error('[KaraokePlaybackSync] Error playing audio:', err);
              });
            }
          }, 50);
          break;
        case 'pause':
          console.log('[KaraokePlaybackSync] Pausing audio at time:', payload.time);
          // Small delay to prevent audio interruption
          setTimeout(() => {
            if (audio) {
              audio.currentTime = payload.time;
              audio.pause();
            }
          }, 50);
          break;
        case 'seek':
          console.log('[KaraokePlaybackSync] Seeking to time:', payload.time);
          // Small delay to prevent audio interruption
          setTimeout(() => {
            if (audio) {
              audio.currentTime = payload.time;
            }
          }, 50);
          break;
        case 'sync':
          // Less aggressive sync - only sync if there's a significant difference (more than 1 second)
          if (Math.abs(audio.currentTime - payload.time) > 1.0) {
            console.log('[KaraokePlaybackSync] Syncing audio time:', audio.currentTime, '->', payload.time);
            // Small delay to prevent audio interruption
            setTimeout(() => {
              if (audio) {
                audio.currentTime = payload.time;
              }
            }, 50);
          }
          break;
        case 'lyrics':
          // Lyrics sync - this will be handled by the parent component
          console.log('[KaraokePlaybackSync] Received lyrics sync:', payload.lyric);
          break;
        case 'volume':
          // Volume control - this will be handled by the parent component
          console.log('[KaraokePlaybackSync] Received volume change:', payload.volumeType, payload.volume);
          break;
      }
    });

    return () => {
      channel.unsubscribe();
    };
  }, [roomId, audio, userId]);

  // Host: Emit playback events
  const emitPlaybackEvent = (type: PlaybackEvent['type'], time?: number, lyric?: string, volumeType?: 'music' | 'mic', volume?: number) => {
    if (!isHost || !channelRef.current || !audio) return;

    const event: PlaybackEvent = {
      type,
      time: time ?? audio.currentTime,
      userId,
      timestamp: Date.now(),
      lyric,
      volumeType,
      volume
    };

    console.log('[KaraokePlaybackSync] Emitting playback event:', event);

    channelRef.current.send({
      type: 'broadcast',
      event: 'karaoke-playback',
      payload: event
    });
  };

  // Host: Control functions
  const play = () => {
    if (!isHost || !audio) return;
    console.log('[KaraokePlaybackSync] Host playing audio');
    audio.play().catch(err => {
      console.error('[KaraokePlaybackSync] Error playing audio:', err);
    });
    emitPlaybackEvent('play');
  };

  const pause = () => {
    if (!isHost || !audio) return;
    console.log('[KaraokePlaybackSync] Host pausing audio');
    audio.pause();
    emitPlaybackEvent('pause');
  };

  const seek = (time: number) => {
    if (!isHost || !audio) return;
    console.log('[KaraokePlaybackSync] Host seeking to:', time);
    audio.currentTime = time;
    emitPlaybackEvent('seek', time);
  };

  const sync = () => {
    if (!isHost || !audio) return;
    emitPlaybackEvent('sync');
  };

  const syncLyrics = () => {
    if (!isHost || !currentLyric) return;
    console.log('[KaraokePlaybackSync] Syncing lyrics:', currentLyric);
    emitPlaybackEvent('lyrics', undefined, currentLyric);
  };

  const setMusicVolume = (volume: number) => {
    if (!isHost) return;
    console.log('[KaraokePlaybackSync] Setting music volume:', volume);
    emitPlaybackEvent('volume', undefined, undefined, 'music', volume);
  };

  const setMicVolume = (volume: number) => {
    if (!isHost) return;
    console.log('[KaraokePlaybackSync] Setting mic volume:', volume);
    emitPlaybackEvent('volume', undefined, undefined, 'mic', volume);
  };

  // Host: Periodic sync (every 5 seconds for smoother sync)
  useEffect(() => {
    if (!isHost || !audio) return;

    const interval = setInterval(() => {
      sync();
    }, 5000);

    return () => clearInterval(interval);
  }, [isHost, audio]);

  // Host: Periodic lyrics sync (every 10 seconds)
  useEffect(() => {
    if (!isHost || !currentLyric) return;

    const interval = setInterval(() => {
      syncLyrics();
    }, 10000);

    return () => clearInterval(interval);
  }, [isHost, currentLyric, syncLyrics]);

  return {
    // Host controls
    play,
    pause,
    seek,
    sync,
    syncLyrics,
    setMusicVolume,
    setMicVolume,
    // Utility function to emit custom events
    emitPlaybackEvent
  };
} 