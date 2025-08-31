"use client";

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/realtime-js';
import LRCParser from 'lrc-parser';

interface KaraokeRoomState {
  room: any;
  participants: any[];
  messages: any[];
  currentLyric: string;
  nextLyrics: string[];
  isHost: boolean;
  isConnected: boolean;
  audioTime: number;
  audioDuration: number;
}

export function useKaraokeRoom() {
  const params = useParams();
  const roomId = params.id as string;
  
  const [state, setState] = useState<KaraokeRoomState>({
    room: null,
    participants: [],
    messages: [],
    currentLyric: '',
    nextLyrics: [],
    isHost: false,
    isConnected: false,
    audioTime: 0,
    audioDuration: 0,
  });
  
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [lyrics, setLyrics] = useState<any[]>([]);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

  // Initialize room and real-time connection
  useEffect(() => {
    const initRoom = async () => {
      try {
        // Get room data
        const { data: room } = await supabase
          .from('karaoke_rooms')
          .select(`
            *,
            host:users!karaoke_rooms_host_id_fkey (
              username,
              avatar_url
            )
          `)
          .eq('id', roomId)
          .single();

        if (!room) throw new Error('Room not found');

        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        const isHost = user?.id === room.host_id;

        // Initialize audio
        const audio = new Audio(room.song_url);
        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('loadedmetadata', () => {
          setState(prev => ({ ...prev, audioDuration: audio.duration }));
        });
        setAudio(audio);

        // Load lyrics
        const { data: lyricsData } = await supabase.storage
          .from('media')
          .download(room.lyrics_url);
        
        if (lyricsData) {
          const text = await lyricsData.text();
          const parser = new LRCParser();
          parser.parse(text);
          setLyrics(parser.scripts);
        }

        // Subscribe to real-time updates
        const channel = supabase.channel(`room:${roomId}`)
          .on('presence', { event: 'sync' }, () => {
            const presenceState = channel.presenceState();
            const participants = Object.values(presenceState).flat();
            setState(prev => ({ ...prev, participants }));
          })
          .on('broadcast', { event: 'message' }, ({ payload }) => {
            setState(prev => ({
              ...prev,
              messages: [...prev.messages, payload]
            }));
          })
          .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
              await channel.track({
                user_id: user?.id,
                username: user?.user_metadata?.username,
                avatar_url: user?.user_metadata?.avatar_url,
              });
            }
          });

        setChannel(channel);
        setState(prev => ({
          ...prev,
          room,
          isHost,
          isConnected: true,
        }));
      } catch (error) {
        console.error('Error initializing room:', error);
      }
    };

    initRoom();

    return () => {
      audio?.removeEventListener('timeupdate', handleTimeUpdate);
      audio?.pause();
      channel?.unsubscribe();
    };
  }, [roomId]);

  const handleTimeUpdate = useCallback(() => {
    if (!audio) return;

    const currentTime = audio.currentTime;
    setState(prev => ({ ...prev, audioTime: currentTime }));

    // Update lyrics
    const currentLyric = lyrics.find((lyric, index) => {
      const nextLyric = lyrics[index + 1];
      return currentTime >= lyric.time && (!nextLyric || currentTime < nextLyric.time);
    });

    if (currentLyric) {
      const currentIndex = lyrics.indexOf(currentLyric);
      const nextLyrics = lyrics.slice(currentIndex + 1, currentIndex + 3);

      setState(prev => ({
        ...prev,
        currentLyric: currentLyric.text,
        nextLyrics: nextLyrics.map(l => l.text),
      }));
    }
  }, [audio, lyrics]);

  const sendMessage = async (content: string) => {
    if (!channel) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const message = {
      user_id: user.id,
      username: user.user_metadata.username,
      avatar_url: user.user_metadata.avatar_url,
      content,
      timestamp: new Date().toISOString(),
    };

    await channel.send({
      type: 'broadcast',
      event: 'message',
      payload: message,
    });
  };

  const sendReaction = async (reaction: string) => {
    if (!channel) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await channel.send({
      type: 'broadcast',
      event: 'reaction',
      payload: {
        user_id: user.id,
        reaction,
        timestamp: new Date().toISOString(),
      },
    });
  };

  const sendTip = async (amount: number) => {
    if (!state.room?.host_id) return;

    // Implement Solana transfer here
    console.log('Sending tip:', amount, 'SOL');
  };

  const togglePlayback = () => {
    if (!audio) return;
    if (audio.paused) {
      audio.play();
    } else {
      audio.pause();
    }
  };

  return {
    ...state,
    sendMessage,
    sendReaction,
    sendTip,
    togglePlayback,
  };
}