"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useWebRTC } from "@/hooks/useWebRTC";
import { usePodcastRoom } from "@/hooks/usePodcastRoom";
import { StreamVideo, StreamCall, SpeakerLayout } from "@stream-io/video-react-sdk";
import "@stream-io/video-react-sdk/dist/css/styles.css";
import {
  Users,
  Mic,
  MicOff,
  Share2,
  Hand,
  Heart,
  Star,
  ThumbsUp,
  Sparkles,
  Crown,
  Clock,
  Radio,
  Copy,
  MessageSquare,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase-client";
import GiftHost from "@/components/GiftHost";

export default function PodcastRoomPage() {
  const { roomId } = useParams();
  const { user } = useAuth();
  const { room, loading, error, isHost, joinRoom, leaveRoom, channel } = usePodcastRoom();

  // Stable fallback ID for anonymous participants
  const [effectiveUserId, setEffectiveUserId] = useState<string>("");
  useEffect(() => {
    if (user?.id) {
      setEffectiveUserId(user.id);
      return;
    }
    try {
      const key = "riddimz_anon_user_id";
      let anonId = typeof window !== "undefined" ? localStorage.getItem(key) || "" : "";
      if (!anonId && typeof window !== "undefined") {
        anonId = `anon-${crypto.randomUUID()}`;
        localStorage.setItem(key, anonId);
      }
      setEffectiveUserId(anonId);
    } catch {
      setEffectiveUserId(`anon-${Math.random().toString(36).slice(2)}`);
    }
  }, [user?.id]);

  const {
    startStreaming,
    stopStreaming,
    isStreaming,
    error: streamError,
    videoClient,
    call,
    hasUserInteracted,
    setHasUserInteracted,
    toggleMic,
    requestSingPermission,
    permissionRequests,
    grantPermission,
    revokePermission,
    // Monitoring
    participantAudioLevels,
    // Granted speakers propagated via call.custom
    allowedSpeakers,
  } = useWebRTC((roomId as string) || "", effectiveUserId, !!isHost);

  useEffect(() => {
    if (!roomId) return;
    joinRoom(roomId as string);
    return () => {
      leaveRoom(roomId as string);
    };
  }, [roomId, joinRoom, leaveRoom]);

  const [elapsed, setElapsed] = useState<string>("--:--");
  useEffect(() => {
    if (!call) return;
    const startedAt = call.state.createdAt ? new Date(call.state.createdAt).getTime() : Date.now();
    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      const mm = String(Math.floor(diff / 60)).padStart(2, "0");
      const ss = String(diff % 60).padStart(2, "0");
      setElapsed(`${mm}:${ss}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [call]);

  const [participants, setParticipants] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { name: string; image?: string }>>({});
  const fetchedProfileIdsRef = useRef<Set<string>>(new Set());
  const hostId = call?.state.createdBy?.id || room?.host_id;

  // Session storage cache helpers for profile/user lookups
  const PROFILE_TTL_MS = 60 * 60 * 1000; // 1 hour
  const getCache = (key: string) => {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      if (!parsed.t || (Date.now() - parsed.t) > PROFILE_TTL_MS) return null;
      return parsed.v;
    } catch {
      return null;
    }
  };
  const setCache = (key: string, value: any) => {
    try {
      sessionStorage.setItem(key, JSON.stringify({ v: value, t: Date.now() }));
    } catch {}
  };
  const profileCacheKey = (id: string) => `podcast_profile_${id}`;
  const userCacheKey = (id: string) => `podcast_user_${id}`;

  // Normalize identity by display name (lowercased) with fallback to id; dedupe
  const normalizeName = (name?: string) => (name || "").trim().toLowerCase();
  const getIdentityKey = (p: any) => {
    const byName = normalizeName((p as any).name ?? (p as any).user?.name);
    if (byName) return byName;
    const raw = ((p as any).userId ?? (p as any).user?.id ?? (p as any).id ?? "") as string;
    return String(raw).toLowerCase();
  };

  const uniqueParticipants = useMemo(() => {
    const byIdentity = new Map<string, any>();
    for (const p of participants) {
      const key = getIdentityKey(p);
      const prev = byIdentity.get(key);
      if (!prev) {
        byIdentity.set(key, p);
      } else {
        const prevScore = (prev.publishedTracks?.length ? 2 : 0) + (prev.isSpeaking ? 1 : 0);
        const currScore = (p.publishedTracks?.length ? 2 : 0) + (p.isSpeaking ? 1 : 0);
        if (currScore >= prevScore) byIdentity.set(key, p);
      }
    }
    return Array.from(byIdentity.values());
  }, [participants]);

  useEffect(() => {
    if (!call) return;
    const update = () => {
      try {
        const arr = [...call.state.participants];
        const byIdentity = new Map<string, any>();
        for (const p of arr) {
          const key = getIdentityKey(p);
          const prev = byIdentity.get(key);
          if (!prev) {
            byIdentity.set(key, p);
          } else {
            const score = ((p.publishedTracks?.length ? 2 : 0) + (p.isSpeaking ? 1 : 0));
            const prevScore = ((prev.publishedTracks?.length ? 2 : 0) + (prev.isSpeaking ? 1 : 0));
            if (score >= prevScore) byIdentity.set(key, p);
          }
        }
        setParticipants(Array.from(byIdentity.values()));
      } catch {}
    };
    call.on('call.updated', update);
    call.on('call.session_participant_joined', update);
    call.on('call.session_participant_left', update);
    update();
    return () => {
      call.off('call.updated', update);
      call.off('call.session_participant_joined', update);
      call.off('call.session_participant_left', update);
    };
  }, [call]);

  // Compute local audio permission and mic state
  const canSendAudio = !!call?.state?.ownCapabilities?.includes('send-audio');
  const localParticipant = call?.state?.participants?.find((p: any) => p.userId === effectiveUserId);
  const isMicOn = !!(localParticipant && (localParticipant.publishedTracks?.length || 0) > 0);

  // Fetch and cache profile names/images for participants and requests
  useEffect(() => {
    const idSet = new Set<string>();
    uniqueParticipants.forEach(p => idSet.add(p.userId));
    (permissionRequests || []).forEach(r => idSet.add(r.user.id));
    const ids = Array.from(idSet).filter((id) => !id.startsWith('anon-'));
    const mapFromCache: Record<string, { name: string; image?: string }> = {};
    const missing: string[] = [];
    ids.forEach((id) => {
      const cached = getCache(profileCacheKey(id));
      if (cached && cached.name) {
        mapFromCache[id] = cached;
        fetchedProfileIdsRef.current.add(id);
      } else if (!profiles[id] && !fetchedProfileIdsRef.current.has(id)) {
        missing.push(id);
      }
    });
    if (Object.keys(mapFromCache).length > 0) {
      setProfiles((prev) => ({ ...prev, ...mapFromCache }));
    }
    const idsToFetch = missing;
    if (idsToFetch.length === 0) return;

    const supabase = getSupabaseClient();
    (async () => {
      const { data, error } = await supabase
        .from('user_profile')
        .select('user_id, display_name, profile_banner_url')
        .in('user_id', idsToFetch);

      const map: Record<string, { name: string; image?: string }> = {};
      if (!error && data) {
        (data as any[]).forEach((row) => {
          map[row.user_id] = {
            name: row.display_name || row.user_id,
            image: row.profile_banner_url || undefined,
          };
          setCache(profileCacheKey(row.user_id), map[row.user_id]);
        });
      } else if (error) {
        console.warn('[Podcast] profile fetch error', error);
      }
      // Ensure all requested IDs are marked to avoid refetch loops
      idsToFetch.forEach((id) => {
        fetchedProfileIdsRef.current.add(id);
        if (!map[id]) {
          map[id] = { name: id, image: undefined };
          setCache(profileCacheKey(id), map[id]);
        }
      });
      if (Object.keys(map).length > 0) {
        setProfiles((prev) => ({ ...prev, ...map }));
      }
    })();
  }, [uniqueParticipants, permissionRequests]);

  // Consolidated into unified profile fetch effect

  const speakers = useMemo(() => {
    const stageIds = new Set<string>(
      [hostId, ...(allowedSpeakers ?? [])].filter(
        (id): id is string => typeof id === 'string'
      )
    );
    if (effectiveUserId && call) {
      const canSendAudioLocal = !!call.state.ownCapabilities?.includes('send-audio');
      if (canSendAudioLocal) stageIds.add(effectiveUserId);
    }
    return uniqueParticipants.filter((p) => {
      const isStage = stageIds.has(p.userId);
      const hasAudio = (p.publishedTracks?.length || 0) > 0;
      return isStage || hasAudio;
    });
  }, [uniqueParticipants, hostId, call, allowedSpeakers, effectiveUserId]);

  const listeners = useMemo(() => {
    const stageIds = new Set<string>(
      [hostId, ...(allowedSpeakers ?? [])].filter(
        (id): id is string => typeof id === 'string'
      )
    );
    if (effectiveUserId && call) {
      const canSendAudioLocal = !!call.state.ownCapabilities?.includes('send-audio');
      if (canSendAudioLocal) stageIds.add(effectiveUserId);
    }
    return uniqueParticipants.filter((p) => {
      const isStage = stageIds.has(p.userId);
      const hasAudio = (p.publishedTracks?.length || 0) > 0;
      return !(isStage || hasAudio);
    });
  }, [uniqueParticipants, hostId, call, allowedSpeakers, effectiveUserId]);

  const listenerCount = listeners.length;
  // Gift tipping panel visibility
  const [showGift, setShowGift] = useState(false);

  const [showReactions, setShowReactions] = useState(false);
  const [localReactions, setLocalReactions] = useState<{ [emoji: string]: number }>({});
  type FloaterEmoji = "heart" | "star" | "thumbsUp" | "sparkles";
  interface Floater { id: string; emoji: FloaterEmoji; left: number }
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const addFloater = (emoji: FloaterEmoji) => {
    const id = crypto.randomUUID();
    const left = Math.floor(10 + Math.random() * 80); // keep inside container
    setFloaters((prev) => [...prev, { id, emoji, left }]);
    setTimeout(() => {
      setFloaters((prev) => prev.filter((f) => f.id !== id));
    }, 1400);
  };
  // Offline reaction buffering
  const pendingReactionKey = useMemo(() => `podcast_pending_reactions_${roomId}`, [roomId]);
  const enqueuePendingReaction = (payload: { emoji: string; user_id?: string }) => {
    try {
      const raw = localStorage.getItem(pendingReactionKey);
      const arr: Array<{ emoji: string; user_id?: string }> = raw ? JSON.parse(raw) : [];
      arr.push(payload);
      localStorage.setItem(pendingReactionKey, JSON.stringify(arr));
    } catch {}
  };
  const flushPendingReactions = () => {
    try {
      const raw = localStorage.getItem(pendingReactionKey);
      const arr: Array<{ emoji: string; user_id?: string }> = raw ? JSON.parse(raw) : [];
      if (arr.length && channel) {
        for (const p of arr) {
          try { channel.send({ type: 'broadcast', event: 'reaction', payload: p }); } catch {}
        }
        localStorage.removeItem(pendingReactionKey);
      }
    } catch {}
  };
  const handleReaction = (emoji: string) => {
    setLocalReactions((prev) => ({ ...prev, [emoji]: (prev[emoji] || 0) + 1 }));
    // local visual feedback
    addFloater(emoji as FloaterEmoji);
    try {
      const baseUserId = (user?.id || effectiveUserId || "anon") as string;
      const payload = { emoji, user_id: baseUserId };
      if (channel && (typeof navigator === 'undefined' || navigator.onLine)) {
        channel.send({ type: "broadcast", event: "reaction", payload });
      } else {
        enqueuePendingReaction(payload);
      }
    } catch {}
  };

  // Chat state
  interface ChatMessage {
    id: string;
    content: string;
    created_at: string;
    user_id: string | null;
    username?: string | null;
    avatar_url?: string | null;
  }
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatText, setChatText] = useState("");
  const chatRef = useRef<HTMLDivElement | null>(null);
  const registeredChannelRef = useRef<any>(null);
  const chatMessageIdsRef = useRef<Set<string>>(new Set());
  // Guard and backoff for channel rejoin to avoid loops
  const rejoinInProgressRef = useRef<boolean>(false);
  const rejoinBackoffRef = useRef<number>(500);
  const rejoinAttemptsRef = useRef<number>(0);

  // Offline queue for chat messages (broadcast + DB persistence)
  const pendingChatKey = useMemo(() => `podcast_pending_chat_${roomId}`, [roomId]);
  const pendingDbKey = useMemo(() => `podcast_pending_chat_db_${roomId}`, [roomId]);
  const enqueuePendingChat = (msg: ChatMessage) => {
    try {
      const raw = localStorage.getItem(pendingChatKey);
      const arr: ChatMessage[] = raw ? JSON.parse(raw) : [];
      arr.push(msg);
      localStorage.setItem(pendingChatKey, JSON.stringify(arr));
    } catch {}
  };
  const enqueuePendingDbInsert = (content: string, userId: string | null) => {
    try {
      const raw = localStorage.getItem(pendingDbKey);
      const arr: Array<{ content: string; userId: string | null; ts: number }> = raw ? JSON.parse(raw) : [];
      arr.push({ content, userId, ts: Date.now() });
      localStorage.setItem(pendingDbKey, JSON.stringify(arr));
    } catch {}
  };
  const flushPendingChat = async () => {
    // Flush broadcast queue
    try {
      const raw = localStorage.getItem(pendingChatKey);
      const arr: ChatMessage[] = raw ? JSON.parse(raw) : [];
      if (arr.length && channel) {
        for (const m of arr) {
          try { channel.send({ type: 'broadcast', event: 'chat', payload: m }); } catch {}
          chatMessageIdsRef.current.add(m.id);
        }
        localStorage.removeItem(pendingChatKey);
      }
    } catch {}
    // Flush DB inserts queue (best-effort)
    try {
      const rawDb = localStorage.getItem(pendingDbKey);
      const dbArr: Array<{ content: string; userId: string | null; ts: number }> = rawDb ? JSON.parse(rawDb) : [];
      if (dbArr.length) {
        const supabase = getSupabaseClient();
        for (const item of dbArr) {
          try {
            await supabase
              .from('podcast_chat_messages')
              .insert({ room_id: roomId as string, user_id: item.userId, content: item.content });
          } catch {}
        }
        localStorage.removeItem(pendingDbKey);
      }
    } catch {}
    // Flush reactions
    flushPendingReactions();
  };

  // Load last N chat messages on join
  useEffect(() => {
    const loadHistory = async () => {
      try {
        if (!roomId) return;
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('podcast_chat_messages')
          .select('id, room_id, user_id, content, created_at')
          .eq('room_id', roomId as string)
          .order('created_at', { ascending: false })
          .limit(50);
        if (error) throw error;
        const rows = (data || []).reverse();
        const ids = Array.from(new Set(
          (rows.map((r: any) => r.user_id) as (string | null)[])
            .filter((id) => !!id)
        )) as string[];
        let userMap: Record<string, { username?: string | null; avatar_url?: string | null }> = {};
        // Pull from cache first
        const missingUserIds: string[] = [];
        ids.forEach((id) => {
          const cached = getCache(userCacheKey(id));
          if (cached && (cached.username || cached.avatar_url)) {
            userMap[id] = cached;
          } else {
            missingUserIds.push(id);
          }
        });
        if (missingUserIds.length > 0) {
          const { data: users } = await supabase
            .from('users')
            .select('id, username, avatar_url')
            .in('id', missingUserIds);
          (users || []).forEach((u: any) => {
            const val = { username: u.username, avatar_url: u.avatar_url };
            userMap[u.id] = val;
            setCache(userCacheKey(u.id), val);
          });
        }
        const hydrated = rows.map((r: any) => ({
          id: r.id,
          content: r.content,
          created_at: r.created_at,
          user_id: r.user_id,
          username: userMap[r.user_id]?.username || null,
          avatar_url: userMap[r.user_id]?.avatar_url || null,
        }));
        // Track IDs to dedupe incoming broadcasts
        hydrated.forEach((m: any) => chatMessageIdsRef.current.add(m.id));
        setChatMessages(hydrated);
      } catch (e) {
        console.warn('[Podcast] Failed to load chat history:', e);
      }
    };
    loadHistory();
    // Try flushing any pending offline items on mount
    flushPendingChat();
  }, [roomId]);

  // Subscribe to chat and reaction events once per channel instance
  useEffect(() => {
    if (!channel) return;
    if (registeredChannelRef.current === channel) return;
    registeredChannelRef.current = channel;

    channel.on("broadcast", { event: "chat" }, ({ payload }: { payload: ChatMessage }) => {
      const baseUserId = (user?.id || effectiveUserId || "anon") as string;
      if (payload?.user_id === baseUserId) return; // ignore our own broadcast
      if (payload?.id && chatMessageIdsRef.current.has(payload.id)) return; // ignore duplicates
      chatMessageIdsRef.current.add(payload.id);
      setChatMessages((prev) => [...prev, payload]);
    });
    channel.on("broadcast", { event: "reaction" }, ({ payload }: { payload: { emoji: string; user_id?: string } }) => {
      const { emoji, user_id } = payload || ({} as any);
      const baseUserId = (user?.id || effectiveUserId || "anon") as string;
      if (!emoji) return;
      if (user_id && user_id === baseUserId) return; // ignore our own broadcast
      setLocalReactions((prev) => ({ ...prev, [emoji]: (prev[emoji] || 0) + 1 }));
      addFloater(emoji as FloaterEmoji);
    });

    // Subscribe to channel status to trigger flush on (re)subscribe
    try {
      channel.subscribe((status: any) => {
        if (status === 'SUBSCRIBED') {
          // Reset backoff attempts on successful subscribe
          rejoinInProgressRef.current = false;
          rejoinBackoffRef.current = 500;
          rejoinAttemptsRef.current = 0;
          flushPendingChat();
          flushPendingReactions();
        } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') {
          // Backoff rejoin to avoid tight loops
          if (rejoinInProgressRef.current) return;
          rejoinInProgressRef.current = true;
          const delay = Math.min(rejoinBackoffRef.current, 8000);
          rejoinBackoffRef.current = Math.min(rejoinBackoffRef.current * 2, 8000);
          rejoinAttemptsRef.current += 1;
          try {
            if (roomId) {
              leaveRoom(roomId as string).finally(() => {
                setTimeout(() => {
                  joinRoom(roomId as string).finally(() => {
                    // Allow another attempt only after join callback completes
                    rejoinInProgressRef.current = false;
                  });
                }, delay);
              });
            }
          } catch {
            rejoinInProgressRef.current = false;
          }
        }
      });
    } catch {}
  }, [channel, user?.id, effectiveUserId]);

  // Auto-scroll chat
  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatMessages.length]);

  const sendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatText.trim();
    if (!text) return;
    const now = new Date().toISOString();
    const baseUserId = user?.id || effectiveUserId || "anon";
    const name = user?.user_metadata?.username || profiles[baseUserId]?.name || "Anonymous";
    const avatar = user?.user_metadata?.avatar_url || profiles[baseUserId]?.image || null;
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      content: text,
      created_at: now,
      user_id: baseUserId,
      username: name,
      avatar_url: avatar,
    };
    setChatMessages((prev) => [...prev, msg]);
    chatMessageIdsRef.current.add(msg.id);
    setChatText("");
    try {
      channel?.send({ type: "broadcast", event: "chat", payload: msg });
    } catch {}
    // Persist to DB (auth users store their id, anonymous store NULL)
    try {
      const supabase = getSupabaseClient();
      await supabase
        .from('podcast_chat_messages')
        .insert({ room_id: roomId as string, user_id: user?.id ?? null, content: text });
    } catch (err) {
      // non-blocking, ignore
      console.warn('[Podcast] chat insert failed:', err);
      // Queue for later retry
      enqueuePendingDbInsert(text, user?.id ?? null);
    }
    // If channel missing or offline, queue broadcast for later
    try {
      if (!channel || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        enqueuePendingChat(msg);
      }
    } catch {}
  };

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {}
  };

  // Flush pending queues on network online
  useEffect(() => {
    const handleOnline = () => { flushPendingChat(); flushPendingReactions(); };
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
      }
    };
  }, [flushPendingChat]);

  if (loading) {
    return <div className="container mx-auto p-4">Loading...</div>;
  }

  if (error || streamError) {
    return <div className="container mx-auto p-4">Error: {error || streamError}</div>;
  }

  if (!room) {
    return <div className="container mx-auto p-4">Room not found</div>;
  }

  // Show subtle skeleton UI while audio initializes
  if (!videoClient || !call) {
    return (
      <div className="container mx-auto p-4">
        <Card className="p-0 overflow-hidden border-white/10">
          <div className="relative">
            <div className="animated-bg h-16 w-full" />
            <div className="absolute inset-0 bg-black/10" />
          </div>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Radio className="h-5 w-5 text-primary" />
                <div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-48" />
                    <Badge variant="outline" className="text-muted-foreground">Initializing…</Badge>
                  </div>
                  <Skeleton className="mt-2 h-4 w-64" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <Skeleton className="h-4 w-12" />
                </div>
                <Separator orientation="vertical" className="h-6" />
                <div className="flex items-center gap-1 text-sm">
                  <Users className="h-4 w-4" />
                  <Skeleton className="h-4 w-8" />
                </div>
                <Button variant="outline" size="sm" disabled>
                  <Share2 className="h-4 w-4 mr-2" /> Invite
                </Button>
                <Button variant="default" size="sm" disabled>
                  Send Gift
                </Button>
              </div>
            </div>
          </div>
        </Card>
        <Card className="p-6 glass-effect border-white/10 mt-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-muted-foreground">Stage</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="default" size="sm" disabled>
                <Mic className="h-4 w-4 mr-2" /> Setting up
              </Button>
              <Button variant="outline" size="sm" disabled>
                <Mic className="h-4 w-4 mr-2" /> Unmute
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center">
                <Skeleton className="h-20 w-20 rounded-full" />
                <Skeleton className="mt-2 h-4 w-24" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  const renderAudioRingClass = (level: number) => {
    if (level > 0.6) return "ring-4 ring-primary/70";
    if (level > 0.3) return "ring-2 ring-primary/50";
    if (level > 0.1) return "ring-2 ring-primary/30";
    return "ring-0";
  };

  return (
    <StreamVideo client={videoClient}>
      <StreamCall call={call}>
        <div className="sr-only">
          <SpeakerLayout />
        </div>
        <div className="container mx-auto p-4">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
            <div className="space-y-4">
          {/* Header: title, live status, listener count, timer, invite */}
          <Card className="p-0 overflow-hidden border-white/10">
            <div className="relative">
              <div className="animated-bg h-16 w-full" />
              <div className="absolute inset-0 bg-black/10" />
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Radio className="h-5 w-5 text-primary" />
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-xl font-semibold truncate" title={room.name}>{room.name}</CardTitle>
                      {room.is_live ? (
                        <Badge className="bg-red-600 text-white shadow-sm animate-pulse">LIVE</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">Offline</Badge>
                      )}
                    </div>
                    {room.description && (
                      <div className="text-sm text-muted-foreground">{room.description}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{elapsed}</span>
                  </div>
                  <Separator orientation="vertical" className="h-6" />
                  <div className="flex items-center gap-1 text-sm">
                    <Users className="h-4 w-4" />
                    <span>{listenerCount + speakers.length}</span>
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" onClick={copyInviteLink}>
                          <Share2 className="h-4 w-4 mr-2" /> Invite
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Copy room link</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Button variant="default" size="sm" onClick={() => setShowGift(true)}>
                    Send Gift
                  </Button>
                </div>
              </div>
            </div>
          </Card>

        {showGift && (
          <div className="fixed top-20 right-6 z-50">
            <GiftHost
              recipientAddress={((call?.state as any)?.custom?.hostWalletAddress as string) || null}
              recipientName={profiles[hostId || ""]?.name || "Host"}
              onClose={() => setShowGift(false)}
              onSuccess={() => setShowGift(false)}
            />
          </div>
        )}

          {/* Stage: speakers */}
          <Card className="p-6 glass-effect border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-yellow-500" />
                <span className="text-sm text-muted-foreground">Stage</span>
              </div>
              {isHost ? (
                <div className="flex items-center gap-2">
                  <Button
                    variant={isStreaming ? "destructive" : "default"}
                    size="sm"
                    onClick={isStreaming ? stopStreaming : startStreaming}
                  >
                    {isStreaming ? <MicOff className="h-4 w-4 mr-2" /> : <Mic className="h-4 w-4 mr-2" />}
                    {isStreaming ? "Stop" : "Go Live"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={toggleMic}>
                    {isMicOn ? <MicOff className="h-4 w-4 mr-2" /> : <Mic className="h-4 w-4 mr-2" />}
                    {isMicOn ? "Mute" : "Unmute"}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {!canSendAudio ? (
                    <Button variant="default" size="sm" onClick={requestSingPermission}>
                      <Hand className="h-4 w-4 mr-2" /> Request Mic
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={toggleMic}>
                      {isMicOn ? <MicOff className="h-4 w-4 mr-2" /> : <Mic className="h-4 w-4 mr-2" />}
                      {isMicOn ? "Mute" : "Unmute"}
                    </Button>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {speakers.map((p) => {
                const level = participantAudioLevels[p.userId] || 0;
                const name = profiles[p.userId]?.name || p.name || p.userId;
                const image = profiles[p.userId]?.image || p.image || undefined;
                return (
                  <div key={p.userId} className="flex flex-col items-center">
                    <div className={`rounded-full p-1 ${renderAudioRingClass(level)}`}>
                      <Avatar className="h-20 w-20">
                        <AvatarImage src={image} alt={name} />
                        <AvatarFallback>{(name || '?').slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="mt-2 text-sm font-medium truncate w-24 text-center" title={name}>
                      {name}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      {p.publishedTracks.length > 0 ? (
                        <Mic className="h-3 w-3" />
                      ) : (
                        <MicOff className="h-3 w-3" />
                      )}
                      <span>{p.userId === hostId ? "Host" : "Speaker"}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Host: manage requests */}
            {isHost && permissionRequests.length > 0 && (
              <div className="mt-6">
                <Separator className="my-3" />
                <div className="flex items-center gap-2 mb-2">
                  <Hand className="h-4 w-4" />
                  <span className="text-sm">Requests to speak</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {permissionRequests.map((req) => {
                    const name = profiles[req.user.id]?.name || req.user.name || req.user.id;
                    const image = profiles[req.user.id]?.image || req.user.image || undefined;
                    return (
                      <div key={req.user.id} className="flex items-center gap-3 p-2 rounded-md border">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={image} />
                          <AvatarFallback>{(name || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{name}</span>
                        <Button variant="default" size="sm" onClick={() => grantPermission(req.user.id, ["send-audio"])}>Allow</Button>
                        <Button variant="outline" size="sm" onClick={() => revokePermission(req.user.id, ["send-audio"])}>Deny</Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>

          {/* Listeners */}
          <Card className="p-6 glass-effect border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="text-sm text-muted-foreground">Listeners ({listenerCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowReactions((v) => !v)}>
                  <Sparkles className="h-4 w-4 mr-2" /> Reactions
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 relative">
               {listeners.map((p) => {
                 const name = profiles[p.userId]?.name || p.name || p.userId;
                 const image = profiles[p.userId]?.image || p.image || undefined;
                 return (
                   <div key={p.userId} className="flex flex-col items-center">
                     <Avatar className="h-12 w-12">
                       <AvatarImage src={image} alt={name} />
                       <AvatarFallback>{(name || '?').slice(0, 2).toUpperCase()}</AvatarFallback>
                     </Avatar>
                     <div className="mt-1 text-xs truncate w-16 text-center" title={name}>
                       {name}
                     </div>
                   </div>
                 );
               })}
               {/* Floating reaction overlay */}
               <div className="pointer-events-none absolute inset-0 overflow-hidden">
                 {floaters.map((f) => (
                   <div key={f.id} className="absolute bottom-2" style={{ left: `${f.left}%` }}>
                     <div className="float-up text-2xl">
                       {f.emoji === 'heart' ? '❤️' : f.emoji === 'star' ? '⭐' : f.emoji === 'thumbsUp' ? '👍' : '✨'}
                     </div>
                   </div>
                 ))}
               </div>
             </div>

            {/* Reaction panel */}
            {showReactions && (
              <div className="mt-4 flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-red-500/15 hover:bg-red-500/25 text-red-400 border-none"
                  onClick={() => handleReaction("heart")}
                >
                  <Heart className="h-4 w-4 mr-1" />
                  Heart ({localReactions["heart"] || 0})
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-yellow-400/20 hover:bg-yellow-400/30 text-yellow-400 border-none"
                  onClick={() => handleReaction("star")}
                >
                  <Star className="h-4 w-4 mr-1" />
                  Star ({localReactions["star"] || 0})
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border-none"
                  onClick={() => handleReaction("thumbsUp")}
                >
                  <ThumbsUp className="h-4 w-4 mr-1" />
                  Like ({localReactions["thumbsUp"] || 0})
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-purple-500/15 hover:bg-purple-500/25 text-purple-400 border-none"
                  onClick={() => handleReaction("sparkles")}
                >
                  <Sparkles className="h-4 w-4 mr-1" />
                  Hype ({localReactions["sparkles"] || 0})
                </Button>
              </div>
            )}
          </Card>
          {/* Bottom controls / join CTA */}
          <Card className="p-4 glass-effect border-white/10">
            <CardContent className="p-0">
              {!hasUserInteracted && (
                <div className="mb-4">
                  <Button onClick={() => setHasUserInteracted(true)} className="w-full">
                    Join and enable audio
                  </Button>
                </div>
              )}
              <div className="flex items-center justify-center gap-3">
                {canSendAudio ? (
                  <Button variant="ghost" onClick={toggleMic}>
                    {isMicOn ? <MicOff className="h-5 w-5 mr-2" /> : <Mic className="h-5 w-5 mr-2" />}
                    {isMicOn ? "Mute" : "Unmute"}
                  </Button>
                ) : (
                  <Button variant="ghost" onClick={requestSingPermission}>
                    <Hand className="h-5 w-5 mr-2" /> Request Mic
                  </Button>
                )}
                {isHost && (
                  <Button variant="destructive" onClick={stopStreaming}>
                    End
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
          </div>
          {/* Side Chat Bar */}
          <aside className="block order-last lg:order-none lg:block">
            <Card className="p-4 h-[calc(100vh-120px)] lg:sticky lg:top-20 flex flex-col glass-effect border-white/10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  <span className="text-sm text-muted-foreground">Chat</span>
                </div>
              </div>
              <div className="h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent mb-3" />
              <div ref={chatRef} className="flex-1 overflow-y-auto rounded-md border p-3 bg-card">
                {chatMessages.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center">No messages yet. Be the first to say hi!</div>
                ) : (
                  <div className="space-y-2">
                    {chatMessages.map((m) => {
                      const userProfile = m.user_id ? profiles[m.user_id] : undefined;
                      const name = m.username ?? userProfile?.name ?? (m.user_id ?? 'Guest');
                      const image = m.avatar_url ?? userProfile?.image ?? undefined;
                      return (
                        <div key={m.id} className="flex items-start gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={image || undefined} alt={name || undefined} />
                            <AvatarFallback>{(name || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="text-xs text-muted-foreground">{name}</div>
                            <div className="mt-0.5 rounded-2xl px-3 py-2 bg-white/5 border border-white/10 text-sm text-foreground/90 break-words">
                              {m.content}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <form onSubmit={sendChatMessage} className="mt-3 flex items-center gap-2">
                <Input
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  placeholder="Type a message"
                  className="bg-background/80"
                />
                <Button type="submit" size="sm">Send</Button>
              </form>
            </Card>
          </aside>
        </div>
        </div>
        {/* Local styles for float-up animation */}
        <style jsx>{`
          @keyframes floatUp {
            0% { transform: translateY(0); opacity: 1; }
            100% { transform: translateY(-120px); opacity: 0; }
          }
          .float-up { animation: floatUp 1.2s ease-out forwards; }
        `}</style>
      </StreamCall>
    </StreamVideo>
  );
}