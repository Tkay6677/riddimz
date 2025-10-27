"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mic, Users, Flame } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase-client";

interface PodcastRoomRow {
  id: string;
  name: string;
  description?: string | null;
  host_id: string;
  cover_image?: string | null;
  is_live?: boolean | null;
  created_at?: string | null;
}

function buildPublicUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/podcast-rooms/${path}`;
}

export default function PodcastPage() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [rooms, setRooms] = useState<PodcastRoomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [liveOnly, setLiveOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"newest" | "live" | "name">("newest");

  const loadRooms = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from("podcast_rooms")
        .select("id, name, description, host_id, cover_image, is_live, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRooms((data || []) as PodcastRoomRow[]);
    } catch (e: any) {
      setError(e.message || "Failed to load podcast rooms");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  const filteredRooms = useMemo(() => {
    let list = [...rooms];
    // filter by query
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((r) =>
        (r.name || "").toLowerCase().includes(q) || (r.description || "").toLowerCase().includes(q)
      );
    }
    // filter by live only
    if (liveOnly) {
      list = list.filter((r) => !!r.is_live);
    }
    // sort
    switch (sortBy) {
      case "live":
        list.sort((a, b) => Number(!!b.is_live) - Number(!!a.is_live));
        break;
      case "name":
        list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        break;
      default:
        list.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    }
    return list;
  }, [rooms, query, liveOnly, sortBy]);

  const trendingRooms = useMemo(() => {
    const list = [...rooms];
    list.sort((a, b) => {
      const liveDiff = Number(!!b.is_live) - Number(!!a.is_live);
      if (liveDiff !== 0) return liveDiff;
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
    return list.slice(0, 3);
  }, [rooms]);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-r from-purple-600 to-pink-600 text-white">
        <div className="grid gap-6 p-8 md:grid-cols-[1.3fr,1fr] items-center">
          <div>
            <div className="flex items-center gap-2 text-sm opacity-90">
              <Mic className="h-4 w-4" />
              Live Audio
            </div>
            <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">Discover and Host Podcast Rooms</h1>
            <p className="mt-2 text-sm md:text-base opacity-90">
              Go live with your audience, invite guests, and build a community around your voice.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="secondary" className="bg-white/20">Tech</Badge>
              <Badge variant="secondary" className="bg-white/20">Music</Badge>
              <Badge variant="secondary" className="bg-white/20">Culture</Badge>
              <Badge variant="secondary" className="bg-white/20">Sports</Badge>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/podcast/create">
                <Button variant="secondary" className="text-purple-700">Create Room</Button>
              </Link>
              <Link href="/discover">
                <Button variant="ghost" className="bg-white/10 text-white hover:bg-white/20">Explore</Button>
              </Link>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="relative mx-auto w-full max-w-sm rounded-lg bg-white/10 p-4">
              <div className="flex items-center gap-2 text-xs text-white/90">
                <Flame className="h-3.5 w-3.5" /> Trending Now
              </div>
              <div className="mt-3 space-y-3">
                {trendingRooms.length === 0 ? (
                  <div className="rounded-md bg-white/10 p-3 text-xs text-white/80">
                    No rooms yet. Create one to go live.
                  </div>
                ) : (
                  trendingRooms.map((room) => (
                    <Link href={`/podcast/${room.id}`} key={room.id} className="block">
                      <div className="flex items-center justify-between rounded-md bg-white/10 p-3 hover:bg-white/20">
                        <div>
                          <p className="text-sm font-medium truncate" title={room.name}>{room.name}</p>
                          {room.description && (
                            <p className="text-xs text-white/80 truncate" title={room.description}>{room.description}</p>
                          )}
                        </div>
                        {room.is_live ? (
                          <Badge variant="secondary" className="bg-red-500 text-white">LIVE</Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-white/30 text-white">OFFLINE</Badge>
                        )}
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mt-8 grid gap-3 md:grid-cols-[2fr,1fr,auto] items-center">
        <div className="relative">
          <Input
            placeholder="Search rooms by name or topic"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-3"
          />
        </div>
        <div className="flex items-center gap-3">
          <Switch id="live-only" checked={liveOnly} onCheckedChange={setLiveOnly} />
          <Label htmlFor="live-only" className="text-sm">Live only</Label>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sort</span>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Newest" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="live">Live first</SelectItem>
              <SelectItem value="name">A–Z</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && <div className="mb-4 text-red-500">{error}</div>}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-24 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="w-full h-48" />
                <Skeleton className="w-full h-10 mt-4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <div className="mt-6 rounded-lg border p-8 text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <Mic className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No podcast rooms yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Be the first to create one and start the conversation.</p>
          <Link href="/podcast/create" className="inline-block mt-4">
            <Button>Create Podcast Room</Button>
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRooms.map((room) => {
            const created = room.created_at ? new Date(room.created_at) : null;
            return (
              <Link key={room.id} href={`/podcast/${room.id}`}>
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-2">
                      <span className="truncate" title={room.name}>{room.name}</span>
                      {room.is_live ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-red-100 text-red-700">
                          <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" /> LIVE
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">OFFLINE</span>
                      )}
                    </CardTitle>
                    {room.description && (
                      <div className="text-sm text-muted-foreground truncate" title={room.description}>
                        {room.description}
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      {created ? (
                        <div className="text-xs text-muted-foreground">Created {created.toLocaleDateString()}</div>
                      ) : (
                        <div className="text-xs text-muted-foreground">Recently created</div>
                      )}
                      <Button size="sm" variant="secondary">Join Room</Button>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}