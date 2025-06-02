'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import LRCParser from 'lrc-parser';

interface LyricLine {
  time: number;
  text: string;
}

export function useKaraokeRoom() {
  const [room, setRoom] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentLyric, setCurrentLyric] = useState<string | null>(null);
  const [nextLyrics, setNextLyrics] = useState<string[]>([]);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const { user } = useAuth();

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

  // Initialize audio and lyrics
  useEffect(() => {
    if (!room?.song_url || !room?.lyrics_url) return;

    // Initialize audio
    const audioElement = new Audio();
    audioElement.src = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/karaoke-songs/${room.song_url}`;
    audioElement.addEventListener('timeupdate', () => {
      setCurrentTime(audioElement.currentTime);
    });
    setAudio(audioElement);

    // Load lyrics
    const loadLyrics = async () => {
      try {
        const { data: lyricsData, error: lyricsError } = await supabase.storage
          .from('karaoke-songs')
          .download(room.lyrics_url);

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
      const currentIndex = lyrics.indexOf(currentLyricObj);
      const nextLyricsList = lyrics
        .slice(currentIndex + 1, currentIndex + 3)
        .map(l => l.text);
      setNextLyrics(nextLyricsList);
    }
  }, [currentTime, lyrics]);

  const createRoom = async (name: string, description?: string, songFile?: File, lyricsFile?: File) => {
    try {
      setLoading(true);
      setError(null);

      if (!user) {
        throw new Error('Not authenticated');
      }

      // Upload files if provided
      let songUrl = null;
      let lyricsUrl = null;

      if (songFile) {
        const { data: songData, error: songError } = await supabase.storage
          .from('karaoke-songs')
          .upload(`${user.id}/${Date.now()}_${songFile.name}`, songFile);
        
        if (songError) throw songError;
        songUrl = songData.path;
      }

      if (lyricsFile) {
        const { data: lyricsData, error: lyricsError } = await supabase.storage
          .from('karaoke-tracks')
          .upload(`${user.id}/${Date.now()}_${lyricsFile.name}`, lyricsFile);
        
        if (lyricsError) throw lyricsError;
        lyricsUrl = lyricsData.path;
      }

      // Create room with only required fields
      const roomData = {
        name,
        host_id: user.id
      };

      // Add optional fields if provided
      if (description) {
        Object.assign(roomData, { description });
      }
      if (songUrl) {
        Object.assign(roomData, { song_url: songUrl });
      }
      if (lyricsUrl) {
        Object.assign(roomData, { lyrics_url: lyricsUrl });
      }

      const { data, error: createError } = await supabase
        .from('karaoke_rooms')
        .insert([roomData])
        .select()
        .single();

      if (createError) throw createError;

      // Add host to participants
      const { error: participantError } = await supabase
        .from('room_participants')
        .insert([
          {
            room_id: data.id,
            user_id: user.id
          }
        ]);

      if (participantError) throw participantError;

      setRoom(data);
      return data;
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
    } else {
      audio.pause();
    }
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
    togglePlayback
  };
} 