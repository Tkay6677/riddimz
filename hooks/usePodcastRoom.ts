"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase-client";
import type { RealtimeChannel } from "@supabase/realtime-js";

interface PodcastRoom {
  id: string;
  name: string;
  description?: string | null;
  host_id: string;
  is_live?: boolean | null;
  created_at?: string | null;
}

interface PodcastParticipant {
  user_id: string;
  username?: string | null;
  avatar_url?: string | null;
}

interface UsePodcastRoomReturn {
  room: PodcastRoom | null;
  participants: PodcastParticipant[];
  loading: boolean;
  error: string | null;
  isHost: boolean;
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: (roomId: string) => Promise<void>;
  refreshRoom: (roomId: string) => Promise<PodcastRoom | null>;
}

export function usePodcastRoom(): UsePodcastRoomReturn {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [room, setRoom] = useState<PodcastRoom | null>(null);
  const [participants, setParticipants] = useState<PodcastParticipant[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isHost, setIsHost] = useState<boolean>(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const refreshRoom = useCallback(async (roomId: string) => {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from("podcast_rooms")
        .select("id, name, description, host_id, is_live, created_at")
        .eq("id", roomId)
        .single();
      if (error) throw error;
      setRoom(data as PodcastRoom);
      const { data: { user } } = await supabase.auth.getUser();
      setIsHost(user?.id === (data as PodcastRoom)?.host_id);
      return data as PodcastRoom;
    } catch (e: any) {
      setError(e.message || "Failed to fetch podcast room");
      return null;
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const joinRoom = useCallback(async (roomId: string) => {
    try {
      setLoading(true);
      setError(null);
      await refreshRoom(roomId);

      // Create realtime channel with presence
      const channel = supabase.channel(`podcast:${roomId}`, {
        config: { presence: { key: "user_id" } },
      });
      channelRef.current = channel;

      channel.on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const present = Object.values(state).flat() as any[];
        const mapped: PodcastParticipant[] = present.map((p: any) => ({
          user_id: p.user_id,
          username: p.username,
          avatar_url: p.avatar_url,
        }));
        setParticipants(mapped);
      });

      const { data: { user } } = await supabase.auth.getUser();
      await channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: user?.id,
            username: user?.user_metadata?.username || null,
            avatar_url: user?.user_metadata?.avatar_url || null,
          });
        }
      });
    } catch (e: any) {
      setError(e.message || "Failed to join podcast room");
    } finally {
      setLoading(false);
    }
  }, [supabase, refreshRoom]);

  const leaveRoom = useCallback(async (roomId: string) => {
    try {
      if (channelRef.current) {
        await channelRef.current.untrack();
        await channelRef.current.unsubscribe();
        channelRef.current = null;
      }
      setParticipants([]);
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
    };
  }, []);

  return {
    room,
    participants,
    loading,
    error,
    isHost,
    joinRoom,
    leaveRoom,
    refreshRoom,
  };
}