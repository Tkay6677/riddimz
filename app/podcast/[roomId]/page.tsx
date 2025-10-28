"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useWebRTC } from "@/hooks/useWebRTC";
import { usePodcastRoom } from "@/hooks/usePodcastRoom";
import { StreamVideo, StreamCall, SpeakerLayout, OwnCapability } from "@stream-io/video-react-sdk";
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
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase-client";
import GiftHost from "@/components/GiftHost";

export default function PodcastRoomPage() {
  const { roomId } = useParams();
  const { user } = useAuth();
  const { room, loading, error, isHost, joinRoom, leaveRoom } = usePodcastRoom();

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
  const canSendAudio = !!call?.state?.ownCapabilities?.includes(OwnCapability.SEND_AUDIO);
  const localParticipant = call?.state?.participants?.find((p: any) => p.userId === effectiveUserId);
  const isMicOn = !!(localParticipant && (localParticipant.publishedTracks?.length || 0) > 0);

  // Fetch and cache profile names/images for participants and requests
  useEffect(() => {
    const idSet = new Set<string>();
    uniqueParticipants.forEach(p => idSet.add(p.userId));
    (permissionRequests || []).forEach(r => idSet.add(r.user.id));
    const idsToFetch = Array.from(idSet).filter(
      (id) => !profiles[id] && !id.startsWith('anon-') && !fetchedProfileIdsRef.current.has(id)
    );
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
        });
      } else if (error) {
        console.warn('[Podcast] profile fetch error', error);
      }
      // Ensure all requested IDs are marked to avoid refetch loops
      idsToFetch.forEach((id) => {
        fetchedProfileIdsRef.current.add(id);
        if (!map[id]) {
          map[id] = { name: id, image: undefined };
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
      const canSendAudio = !!call.state.ownCapabilities?.includes(OwnCapability.SEND_AUDIO);
      if (canSendAudio) stageIds.add(effectiveUserId);
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
      const canSendAudio = !!call.state.ownCapabilities?.includes(OwnCapability.SEND_AUDIO);
      if (canSendAudio) stageIds.add(effectiveUserId);
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
  const handleReaction = (emoji: string) => {
    setLocalReactions((prev) => ({ ...prev, [emoji]: (prev[emoji] || 0) + 1 }));
  };

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {}
  };

  if (loading) {
    return <div className="container mx-auto p-4">Loading...</div>;
  }

  if (error || streamError) {
    return <div className="container mx-auto p-4">Error: {error || streamError}</div>;
  }

  if (!room) {
    return <div className="container mx-auto p-4">Room not found</div>;
  }

  // Show call loader until client and call are ready
  if (!videoClient || !call) {
    return <div className="container mx-auto p-4">Initializing audio...</div>;
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
        <div className="container mx-auto p-4 space-y-4">
          {/* Header: title, live status, listener count, timer, invite */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Radio className="h-5 w-5 text-primary" />
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-xl font-semibold truncate" title={room.name}>{room.name}</CardTitle>
                    {room.is_live ? (
                      <Badge className="bg-red-500/15 text-red-600">LIVE</Badge>
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
          <Card className="p-6">
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
          <Card className="p-6">
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
            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
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
             </div>

            {/* Reaction panel */}
            {showReactions && (
              <div className="mt-4 flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => handleReaction("heart")}>
                  <Heart className="h-4 w-4 mr-1 text-red-500" />
                  Heart
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleReaction("star")}>
                  <Star className="h-4 w-4 mr-1 text-yellow-500" />
                  Star
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleReaction("thumbsUp")}>
                  <ThumbsUp className="h-4 w-4 mr-1 text-blue-500" />
                  Like
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleReaction("sparkles")}>
                  <Sparkles className="h-4 w-4 mr-1 text-purple-500" />
                  Hype
                </Button>
              </div>
            )}
          </Card>

          {/* Bottom controls / join CTA */}
          <Card className="p-4">
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
      </StreamCall>
    </StreamVideo>
  );
}