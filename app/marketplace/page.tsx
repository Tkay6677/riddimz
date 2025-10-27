"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface SongRow {
  id: string;
  title: string;
  artist: string;
  is_nft: boolean | null;
  audio_url: string | null;
  cover_url?: string | null;
  cover_art_url?: string | null;
  nft_metadata_uri?: string | null;
  created_at?: string | null;
}

function useNftSongs() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [songs, setSongs] = useState<SongRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 12;
  const pageRef = useRef(0);

  const loadPage = async (page: number) => {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("songs")
      .select(
        "id, title, artist, is_nft, audio_url, cover_url, cover_art_url, nft_metadata_uri, created_at"
      )
      .eq("is_nft", true)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) throw error;
    return (data || []) as SongRow[];
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const firstPage = await loadPage(0);
        if (!mounted) return;
        setSongs(firstPage);
        setHasMore(firstPage.length === pageSize);
        pageRef.current = 1;
      } catch (e: any) {
        if (!mounted) return;
        setError(e.message || "Failed to load marketplace");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const nextPage = await loadPage(pageRef.current);
      setSongs((prev) => [...prev, ...nextPage]);
      setHasMore(nextPage.length === pageSize);
      pageRef.current += 1;
    } catch (e: any) {
      setError(e.message || "Failed to load more");
    } finally {
      setLoadingMore(false);
    }
  };

  return { songs, loading, error, hasMore, loadingMore, loadMore };
}

function buildPublicUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  // If path is already an absolute URL, return as-is
  if (/^https?:\/\//i.test(path)) return path;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  // Detect bucket from path prefix; default to `karaoke-songs`
  const bucket = path.startsWith('profiles/') ? 'profiles' : 'karaoke-songs';
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}

export default function MarketplacePage() {
  const { songs, loading, error, hasMore, loadingMore, loadMore } = useNftSongs();
  const [metadataImages, setMetadataImages] = useState<Record<string, string>>({});
  const metadataCacheRef = useRef<Map<string, string>>(new Map());

  // Fetch NFT metadata JSON to extract image for each song; cache by URI
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const toFetch = songs
        .filter((s) => !!s.nft_metadata_uri)
        .filter((s) => !metadataCacheRef.current.has(s.nft_metadata_uri as string));

      const entries = await Promise.all(
        toFetch.map(async (s) => {
          const uri = s.nft_metadata_uri as string;
          try {
            const res = await fetch(uri);
            if (!res.ok) return [uri, undefined] as const;
            const json = await res.json();
            const img = typeof json?.image === 'string' ? json.image : undefined;
            return [uri, img] as const;
          } catch {
            return [uri, undefined] as const;
          }
        })
      );

      if (!cancelled) {
        const next: Record<string, string> = { ...metadataImages };
        for (const [uri, img] of entries) {
          if (img) {
            metadataCacheRef.current.set(uri, img);
          }
        }
        // Map cache to song IDs
        for (const s of songs) {
          const uri = s.nft_metadata_uri as string | undefined;
          if (uri && metadataCacheRef.current.has(uri)) {
            next[s.id] = metadataCacheRef.current.get(uri)!;
          }
        }
        setMetadataImages(next);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songs]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Marketplace</h1>
        <p className="text-sm text-muted-foreground">
          Discover and preview NFT songs minted by creators.
        </p>
      </div>

      {error && (
        <div className="mb-4 text-red-500">Error loading songs: {error}</div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 12 }).map((_, i) => (
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
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {songs.map((song) => {
              const coverUrl =
                metadataImages[song.id] ||
                buildPublicUrl(song.cover_url) ||
                buildPublicUrl(song.cover_art_url) ||
                "/riddimz-logo.jpg";
              const audioUrl = buildPublicUrl(song.audio_url);
              return (
                <Card key={song.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="truncate" title={song.title}>{song.title}</span>
                      <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">NFT</span>
                    </CardTitle>
                    <div className="text-sm text-muted-foreground">
                      {song.artist}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="relative w-full h-48 overflow-hidden rounded">
                      <Image
                        src={coverUrl}
                        alt={`${song.title} cover`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    </div>

                    <div className="mt-4">
                      {audioUrl ? (
                        <audio controls preload="none" className="w-full">
                          <source src={audioUrl} />
                          Your browser does not support the audio element.
                        </audio>
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          No audio preview available.
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                      <Button disabled variant="secondary" title="Checkout coming soon">
                        Buy
                      </Button>
                      <Link href="/music" className="text-sm underline">
                        Details
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="mt-6 flex justify-center">
            {hasMore ? (
              <Button onClick={loadMore} disabled={loadingMore} variant="outline">
                {loadingMore ? "Loading..." : "Load More"}
              </Button>
            ) : (
              <div className="text-sm text-muted-foreground">No more items</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}