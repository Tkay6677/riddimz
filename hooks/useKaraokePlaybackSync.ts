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
  onVolumeChange?: (volumeType: 'music' | 'mic', volume: number) => void;
  onRefresh?: () => void; // Soft refresh callback from parent
}

interface PlaybackEvent {
  type: 'play' | 'pause' | 'seek' | 'sync' | 'lyrics' | 'volume' | 'song' | 'refresh';
  time: number;
  userId: string;
  timestamp: number;
  lyric?: string;
  volumeType?: 'music' | 'mic';
  volume?: number;
  songUrl?: string;
  lyricsUrl?: string | null;
}

export function useKaraokePlaybackSync({ roomId, isHost, audio, userId, currentLyric, lyrics, onVolumeChange, onRefresh }: UseKaraokePlaybackSyncProps) {
  const channelRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Keep a ref to the latest audio element so broadcast handlers don't capture a stale one
  useEffect(() => {
    audioRef.current = audio || null;
  }, [audio]);

  // Ensure the audio element is ready before applying playback actions
  const waitForAudioReady = (el: HTMLAudioElement) => {
    return new Promise<void>((resolve) => {
      if (!el) return resolve();
      // HAVE_CURRENT_DATA (2) or higher indicates we can safely set currentTime
      if (el.readyState >= 2) {
        resolve();
        return;
      }
      const onCanPlay = () => {
        el.removeEventListener('canplay', onCanPlay);
        resolve();
      };
      el.addEventListener('canplay', onCanPlay);
      // Fallback resolve in case canplay doesn't fire quickly
      setTimeout(() => {
        try { el.removeEventListener('canplay', onCanPlay); } catch {}
        resolve();
      }, 1500);
    });
  };

  // Join Supabase Realtime channel for this room
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase.channel(`karaoke-playback:${roomId}`);
    channelRef.current = channel;
    channel.subscribe();

    // Listen for playback events from host
    channel.on('broadcast', { event: 'karaoke-playback' }, ({ payload }: { payload: PlaybackEvent }) => {
      const el = audioRef.current;
      if (!el || payload.userId === userId) return; // Don't react to own events

      console.log('[KaraokePlaybackSync] Received playback event:', payload);

      switch (payload.type) {
        case 'refresh':
          // Host requested participants to soft refresh the room (no page reload)
          if (!isHost && typeof onRefresh === 'function') {
            try {
              onRefresh();
            } catch (err) {
              console.error('[KaraokePlaybackSync] Error soft refreshing participant:', err);
            }
          }
          break;
        case 'song':
          // In listen-only design, participants do NOT auto-play local audio.
          // We still update the src so metadata/lyrics loaders can reference it.
          if (!isHost && payload.songUrl) {
            try {
              // Do not auto-play; just prepare the element.
              el.pause();
              el.src = payload.songUrl;
              el.load();
              waitForAudioReady(el).then(() => {
                el.currentTime = 0;
              });
            } catch (err) {
              console.error('[KaraokePlaybackSync] Error switching song src (participant):', err);
            }
          }
          break;
        case 'play':
          // Participants no longer play local audio; they receive the host stream.
          if (isHost) {
            // Defensive: host never receives own event due to userId check above
            // but keep branch for clarity.
            setTimeout(() => {
              const a = audioRef.current;
              if (a) {
                waitForAudioReady(a).then(() => {
                  a.currentTime = payload.time;
                  a.play().catch(err => {
                    console.error('[KaraokePlaybackSync] Error playing audio (host):', err);
                  });
                });
              }
            }, 50);
          }
          break;
        case 'pause':
          // Participants do not control local audio playback.
          if (isHost) {
            setTimeout(() => {
              const a = audioRef.current;
              if (a) {
                waitForAudioReady(a).then(() => {
                  a.currentTime = payload.time;
                  a.pause();
                });
              }
            }, 50);
          }
          break;
        case 'seek':
          // Participants do not seek local audio.
          if (isHost) {
            setTimeout(() => {
              const a = audioRef.current;
              if (a) {
                waitForAudioReady(a).then(() => {
                  a.currentTime = payload.time;
                });
              }
            }, 50);
          }
          break;
        case 'sync':
          // Participants ignore time sync for local audio in listen-only mode.
          if (isHost && audioRef.current && Math.abs(audioRef.current.currentTime - payload.time) > 1.0) {
            console.log('[KaraokePlaybackSync] Syncing host audio time:', audioRef.current?.currentTime ?? 0, '->', payload.time);
            setTimeout(() => {
              const a = audioRef.current;
              if (a) {
                waitForAudioReady(a).then(() => {
                  a.currentTime = payload.time;
                });
              }
            }, 50);
          }
          break;
        case 'lyrics':
          // Lyrics sync - handled by parent; participants rely on this for lyric progression.
          console.log('[KaraokePlaybackSync] Received lyrics sync:', payload.lyric);
          break;
        case 'volume':
          // Volume control - handled by parent UI/state.
          console.log('[KaraokePlaybackSync] Received volume change:', payload.volumeType, payload.volume);
          if (onVolumeChange) {
            onVolumeChange(payload.volumeType!, payload.volume!);
          }
          break;
      }
    });

    return () => {
      channel.unsubscribe();
    };
  }, [roomId, audio, userId, onVolumeChange]);

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
  const refreshRoom = () => {
    if (!isHost || !channelRef.current) return;
    const event: PlaybackEvent = {
      type: 'refresh',
      time: 0,
      userId,
      timestamp: Date.now()
    };
    console.log('[KaraokePlaybackSync] Emitting room refresh:', event);
    channelRef.current.send({
      type: 'broadcast',
      event: 'karaoke-playback',
      payload: event
    });
  };
  const songChange = (songUrl: string, lyricsUrl?: string | null) => {
    if (!isHost || !channelRef.current) return;
    const event: PlaybackEvent = {
      type: 'song',
      time: 0,
      userId,
      timestamp: Date.now(),
      songUrl,
      lyricsUrl: lyricsUrl ?? null
    };
    console.log('[KaraokePlaybackSync] Emitting song change:', event);
    channelRef.current.send({
      type: 'broadcast',
      event: 'karaoke-playback',
      payload: event
    });
  };
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
    songChange,
    refreshRoom,
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