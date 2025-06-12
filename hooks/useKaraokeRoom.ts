'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import LRCParser from 'lrc-parser';
import { useUpload } from './useUpload';
import { io, Socket } from 'socket.io-client';

interface LyricLine {
  time: number;
  text: string;
}

interface RoomSettings {
  enable_chat: boolean;
  enable_voice: boolean;
  enable_video: boolean;
  enable_screen_sharing: boolean;
  enable_lyrics: boolean;
  enable_scoring: boolean;
  min_score_to_join: number;
}

interface RoomParticipant {
  user_id: string;
  username: string;
  avatar_url: string | null;
  is_muted: boolean;
  is_speaking: boolean;
  last_speak_at: string | null;
}

interface Room {
  id: string;
  name: string;
  description: string | null;
  host_id: string;
  host: {
    username: string;
    avatar_url: string | null;
  };
  current_song: {
    title: string;
    artist: string;
    duration: number;
    is_playing: boolean;
  } | null;
  is_private: boolean;
  password: string | null;
  max_participants: number;
  theme: string | null;
  language: string | null;
  difficulty_level: 'beginner' | 'intermediate' | 'advanced';
  status: 'waiting' | 'active' | 'ended';
  last_activity_at: string;
  settings: RoomSettings;
  participants: RoomParticipant[];
  song_url: string | null;
  lyrics_url: string | null;
  is_live: boolean;
  is_nft_only: boolean;
  current_song_id: string | null;
  created_at: string;
  queue?: Array<{
    id: string;
    song: {
      title: string;
      artist: string;
    };
    user: {
      username: string;
      avatar_url: string | null;
    };
  }>;
}

export function useKaraokeRoom() {
  const { user } = useAuth();
  const { uploadFile, error: uploadError } = useUpload();
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentLyric, setCurrentLyric] = useState<string | null>(null);
  const [nextLyrics, setNextLyrics] = useState<string[]>([]);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const socketRef = useRef<Socket | null>(null);

  // Parse time string to seconds
  const parseTime = (timeStr: string): number => {
    const match = timeStr.match(/\[(\d{2}):(\d{2})\.(\d{2})\]/);
    if (!match) return 0;
    const [, minutes, seconds, centiseconds] = match;
    return parseInt(minutes) * 60 + parseInt(seconds) + parseInt(centiseconds) / 100;
  };

  // Parse LRC text
  const parseLyrics = (text: string): LyricLine[] => {
    const lines = text.split('\n');
    const parsedLyrics: LyricLine[] = [];

    lines.forEach(line => {
      const timeMatch = line.match(/\[(\d{2}:\d{2}\.\d{2})\]/);
      if (timeMatch) {
        const time = parseTime(timeMatch[0]);
        const text = line.replace(/\[\d{2}:\d{2}\.\d{2}\]/, '').trim();
        if (text) {
          parsedLyrics.push({ time, text });
        }
      }
    });

    return parsedLyrics.sort((a, b) => a.time - b.time);
  };

  // Initialize Socket.IO connection
  useEffect(() => {
    if (!user) return;

    socketRef.current = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001');

    socketRef.current.on('sync-time', (time: number) => {
      if (audio) {
        audio.currentTime = time;
      }
    });

    socketRef.current.on('sync-lyrics', (lyric: string) => {
      setCurrentLyric(lyric);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [user]);

  // Initialize audio and lyrics
  useEffect(() => {
    if (!room?.song_url || !room?.lyrics_url) return;

    // Initialize audio
    const audioElement = new Audio();
    audioElement.src = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/karaoke-songs/${room.song_url}`;
    audioElement.addEventListener('timeupdate', () => {
      setCurrentTime(audioElement.currentTime);
      // Sync time with other participants
      socketRef.current?.emit('sync-time', room.id, audioElement.currentTime);
    });
    setAudio(audioElement);

    // Load lyrics
    const loadLyrics = async () => {
      try {
        const { data: lyricsData, error: lyricsError } = await supabase.storage
          .from('karaoke-songs')
          .download(room.lyrics_url!);

        if (lyricsError) throw lyricsError;

        const text = await lyricsData.text();
        if (!text) {
          console.warn('No lyrics content found');
          return;
        }

        const parsedLyrics = parseLyrics(text);
        if (parsedLyrics.length > 0) {
          setLyrics(parsedLyrics);
        } else {
          console.warn('No valid lyrics found after parsing');
          setLyrics([]);
        }
      } catch (err) {
        console.error('Error loading lyrics:', err);
        setLyrics([]);
      }
    };

    loadLyrics();

    return () => {
      audioElement.pause();
      audioElement.removeEventListener('timeupdate', () => {});
    };
  }, [room?.song_url, room?.lyrics_url]);

  // Update lyrics based on current time
  useEffect(() => {
    if (!lyrics.length) return;

    const currentLyricObj = lyrics.find((lyric, index) => {
      const nextLyric = lyrics[index + 1];
      return currentTime >= lyric.time && (!nextLyric || currentTime < nextLyric.time);
    });

    if (currentLyricObj) {
      setCurrentLyric(currentLyricObj.text);
      // Sync lyrics with other participants
      socketRef.current?.emit('sync-lyrics', room?.id, currentLyricObj.text);
      const currentIndex = lyrics.indexOf(currentLyricObj);
      const nextLyricsList = lyrics
        .slice(currentIndex + 1, currentIndex + 3)
        .map(l => l.text);
      setNextLyrics(nextLyricsList);
    }
  }, [currentTime, lyrics, room?.id]);

  const createRoom = async (name: string, description?: string, songFile?: File, lyricsFile?: File) => {
    try {
      setLoading(true);
      setError(null);

      if (!user) {
        throw new Error('Not authenticated');
      }

      // Upload files if provided
      let songUrl: string | null = null;
      let lyricsUrl: string | null = null;

      if (songFile) {
        try {
          const songPath = `${user.id}/${Date.now()}_${songFile.name}`;
          const uploadedSongUrl = await uploadFile(songFile, 'karaoke-songs', songPath);
          if (uploadedSongUrl) {
            songUrl = uploadedSongUrl;
          }
        } catch (err) {
          console.error('Error uploading song file:', err);
          throw new Error('Failed to upload song file');
        }
      }

      if (lyricsFile) {
        try {
          const lyricsPath = `${user.id}/${Date.now()}_${lyricsFile.name}`;
          const uploadedLyricsUrl = await uploadFile(lyricsFile, 'karaoke-tracks', lyricsPath);
          if (uploadedLyricsUrl) {
            lyricsUrl = uploadedLyricsUrl;
          }
        } catch (err) {
          console.error('Error uploading lyrics file:', err);
          throw new Error('Failed to upload lyrics file');
        }
      }

      // Create room with only required fields
      const roomData = {
        name,
        host_id: user.id,
        status: 'waiting',
        is_live: true,
        description: description || null,
        song_url: songUrl,
        lyrics_url: lyricsUrl
      };

      // Start a transaction
      const { data: room, error: createError } = await supabase
        .from('karaoke_rooms')
        .insert([roomData])
        .select()
        .single();

      if (createError) throw createError;

      // Create room settings
      const { error: settingsError } = await supabase
        .from('room_settings')
        .insert([{
          room_id: room.id,
          enable_chat: true,
          enable_voice: true,
          enable_video: false,
          enable_screen_sharing: false,
          enable_lyrics: true,
          enable_scoring: true,
          min_score_to_join: 0
        }]);

      if (settingsError) throw settingsError;

      // Add host to participants
      const { error: participantError } = await supabase
        .from('room_participants')
        .insert([{
          room_id: room.id,
          user_id: user.id,
          role: 'host'
        }]);

      if (participantError) throw participantError;

      // Fetch the complete room data
      const { data: completeRoom, error: fetchError } = await supabase
        .from('karaoke_rooms')
        .select(`
          *,
          host:users!karaoke_rooms_host_id_fkey (
            username,
            avatar_url
          ),
          current_song:songs!karaoke_rooms_current_song_id_fkey (
            title,
            artist
          ),
          participants:room_participants (
            user:users (
              username,
              avatar_url
            ),
            is_muted,
            is_speaking,
            last_speak_at
          ),
          settings:room_settings (*)
        `)
        .eq('id', room.id)
        .single();

      if (fetchError) throw fetchError;

      setRoom(completeRoom);
      return completeRoom;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async (roomId: string) => {
    try {
      setLoading(true);
      setError(null);

      if (!user) {
        throw new Error('Not authenticated');
      }

      // Get room details
      const { data: roomData, error: roomError } = await supabase
        .from('karaoke_rooms')
        .select(`
          *,
          host:users!karaoke_rooms_host_id_fkey (
            username,
            avatar_url
          ),
          current_song:songs!karaoke_rooms_current_song_id_fkey (
            title,
            artist
          ),
          participants:room_participants (
            user:users (
              username,
              avatar_url
            )
          )
        `)
        .eq('id', roomId)
        .single();

      if (roomError) throw roomError;

      // Add user to participants using upsert
      const { error: participantError } = await supabase
        .from('room_participants')
        .upsert([
          {
            room_id: roomId,
            user_id: user.id
          }
        ], {
          onConflict: 'room_id,user_id'
        });

      if (participantError) throw participantError;

      // Join Socket.IO room
      socketRef.current?.emit('join-room', roomId, user.id, user.id === roomData.host_id);

      setRoom(roomData);
      return roomData;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const leaveRoom = async (roomId: string) => {
    try {
      setLoading(true);
      setError(null);

      if (!user) {
        throw new Error('Not authenticated');
      }

      // Remove user from participants
      const { error: participantError } = await supabase
        .from('room_participants')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', user.id);

      if (participantError) throw participantError;

      // Leave Socket.IO room
      socketRef.current?.emit('leave-room', roomId, user.id);

      // If user was host, delete the room
      const { data: roomData } = await supabase
        .from('karaoke_rooms')
        .select('host_id')
        .eq('id', roomId)
        .single();

      if (roomData?.host_id === user.id) {
        const { error: deleteError } = await supabase
          .from('karaoke_rooms')
          .delete()
          .eq('id', roomId);

        if (deleteError) throw deleteError;
      }

      setRoom(null);
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getRoom = async (roomId: string) => {
    try {
      setLoading(true);
      setError(null);

      if (!user) {
        throw new Error('Not authenticated');
      }

      const { data, error: roomError } = await supabase
        .from('karaoke_rooms')
        .select(`
          *,
          host:users!karaoke_rooms_host_id_fkey (
            username,
            avatar_url
          ),
          current_song:songs!karaoke_rooms_current_song_id_fkey (
            title,
            artist
          ),
          participants:room_participants (
            user:users (
              username,
              avatar_url
            )
          )
        `)
        .eq('id', roomId)
        .single();

      if (roomError) throw roomError;

      setRoom(data);
      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const togglePlayback = () => {
    if (!audio) return;
    if (audio.paused) {
      audio.play();
      socketRef.current?.emit('sync-time', room?.id, audio.currentTime);
    } else {
      audio.pause();
    }
  };

  const fetchRoom = async (roomId: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('karaoke_rooms')
        .select(`
          *,
          host:users!karaoke_rooms_host_id_fkey (
            username,
            avatar_url
          ),
          current_song:songs!karaoke_rooms_current_song_id_fkey (
            title,
            artist
          ),
          participants:room_participants (
            user:users (
              username,
              avatar_url
            ),
            is_muted,
            is_speaking,
            last_speak_at
          ),
          settings:room_settings (*)
        `)
        .eq('id', roomId)
        .single();

      if (fetchError) throw fetchError;

      setRoom(data);
      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateRoomStatus = async (roomId: string, status: 'waiting' | 'active' | 'ended') => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: updateError } = await supabase
        .from('karaoke_rooms')
        .update({ status })
        .eq('id', roomId)
        .select()
        .single();

      if (updateError) throw updateError;

      setRoom(prev => prev ? { ...prev, status } : null);
      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateRoomSettings = async (roomId: string, settings: Partial<RoomSettings>) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: updateError } = await supabase
        .from('room_settings')
        .update(settings)
        .eq('room_id', roomId)
        .select()
        .single();

      if (updateError) throw updateError;

      setRoom(prev => prev ? { ...prev, settings: { ...prev.settings, ...settings } } : null);
      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateParticipantStatus = async (
    roomId: string,
    userId: string,
    updates: { is_muted?: boolean; is_speaking?: boolean }
  ) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: updateError } = await supabase
        .from('room_participants')
        .update(updates)
        .match({ room_id: roomId, user_id: userId })
        .select()
        .single();

      if (updateError) throw updateError;

      setRoom(prev => {
        if (!prev) return null;
        const updatedParticipants = prev.participants.map(p =>
          p.user_id === userId ? { ...p, ...updates } : p
        );
        return { ...prev, participants: updatedParticipants };
      });

      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const subscribeToRoomUpdates = (roomId: string) => {
    const roomSubscription = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'karaoke_rooms',
          filter: `id=eq.${roomId}`
        },
        payload => {
          if (payload.eventType === 'UPDATE') {
            setRoom(prev => prev ? { ...prev, ...payload.new } : null);
          }
        }
      )
      .subscribe();

    const participantsSubscription = supabase
      .channel(`room_participants:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_participants',
          filter: `room_id=eq.${roomId}`
        },
        payload => {
          if (payload.eventType === 'INSERT') {
            setRoom(prev => {
              if (!prev) return null;
              return {
                ...prev,
                participants: [...prev.participants, payload.new as RoomParticipant]
              };
            });
          } else if (payload.eventType === 'DELETE') {
            setRoom(prev => {
              if (!prev) return null;
              return {
                ...prev,
                participants: prev.participants.filter(p => p.user_id !== payload.old.user_id)
              };
            });
          } else if (payload.eventType === 'UPDATE') {
            setRoom(prev => {
              if (!prev) return null;
              const updatedParticipants = prev.participants.map(p =>
                p.user_id === payload.new.user_id ? { ...p, ...payload.new } : p
              );
              return { ...prev, participants: updatedParticipants };
            });
          }
        }
      )
      .subscribe();

    const settingsSubscription = supabase
      .channel(`room_settings:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_settings',
          filter: `room_id=eq.${roomId}`
        },
        payload => {
          if (payload.eventType === 'UPDATE') {
            setRoom(prev => {
              if (!prev) return null;
              return {
                ...prev,
                settings: { ...prev.settings, ...payload.new }
              };
            });
          }
        }
      )
      .subscribe();

    return () => {
      roomSubscription.unsubscribe();
      participantsSubscription.unsubscribe();
      settingsSubscription.unsubscribe();
    };
  };

  const loadAudio = async () => {
    if (!room?.song_url) return;
    
    const audio = new Audio();
    audio.src = room.song_url;
    setAudio(audio);
    
    audio.addEventListener('timeupdate', () => {
      setCurrentTime(audio.currentTime);
    });
  };

  return {
    room,
    loading,
    error,
    currentTime,
    currentLyric,
    nextLyrics,
    joinRoom,
    leaveRoom,
    getRoom,
    togglePlayback,
    sendMessage: async (content: string) => {
      if (!user || !room) throw new Error('Not authenticated or no room selected');
      const { error } = await supabase
        .from('chat_messages')
        .insert([{
          room_id: room.id,
          user_id: user.id,
          content
        }]);
      if (error) throw error;
    },
    messages: [], // Initialize empty messages array
    fetchRoom,
    updateRoomStatus,
    updateRoomSettings,
    updateParticipantStatus,
    subscribeToRoomUpdates
  };
} 