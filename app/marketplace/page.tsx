"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { MarketplaceHeader } from "@/components/marketplace/MarketplaceHeader";
import { NFTCard } from "@/components/marketplace/NFTCard";
import { NFTDetailModal } from "@/components/marketplace/NFTDetailModal";
import { CollectionStats } from "@/components/marketplace/CollectionStats";
import { Play, Pause } from "lucide-react";

interface SongRow {
  id: string;
  title: string;
  artist: string;
  is_nft: boolean;
  audio_url: string | null;
  cover_url: string | null;
  cover_art_url: string | null;
  nft_metadata_uri: string | null;
  created_at: string;
}

function useNftSongs() {
  const [songs, setSongs] = useState<SongRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 12;
  const pageRef = useRef(0);
  const supabase = useMemo(() => getSupabaseClient(), []);

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
  const supabase = useMemo(() => getSupabaseClient(), []);
  const { publicKey, sendTransaction, connected } = useWallet();
  const [buying, setBuying] = useState<string | null>(null);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [selectedItem, setSelectedItem] = useState<{
    id: string;
    title: string;
    artist: string;
    coverUrl: string;
    audioUrl?: string | null;
    price?: number;
    currency?: string;
    isListed?: boolean;
    metadataUri?: string | null;
    supply?: number;
    available?: number;
    soldCount?: number;
    sellerWalletAddress?: string;
  } | null>(null);

  type Listing = {
    id: string;
    songId: string;
    title: string;
    artist: string;
    metadataUri?: string;
    priceSol: number;
    supply: number;
    mintedAddresses: string[];
    sellerWalletAddress: string;
    sellerUserId: string;
    available: number;
    soldCount: number;
  };
  const [listings, setListings] = useState<Listing[]>([]);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [listingsError, setListingsError] = useState<string | null>(null);

  // Avoid showing duplicates: if a song has an active listing,
  // exclude it from the general NFT grid below.
  const listedSongIds = useMemo(() => new Set(listings.map(l => l.songId)), [listings]);
  const unlistedSongs = useMemo(() => songs.filter(s => !listedSongIds.has(s.id)), [songs, listedSongIds]);

  // Load active marketplace listings
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setListingsLoading(true);
      setListingsError(null);
      try {
        const res = await fetch('/api/marketplace/listings');
        if (!res.ok) throw new Error('Failed to load listings');
        const j = await res.json();
        if (!cancelled) setListings(j.listings || []);
      } catch (e: any) {
        if (!cancelled) setListingsError(e?.message || 'Failed to load listings');
      } finally {
        if (!cancelled) setListingsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleBuy = async (listing: Listing) => {
    if (!connected || !publicKey || !sendTransaction) {
      alert('Connect your wallet to buy');
      return;
    }
    if (listing.available <= 0) {
      alert('Sold out');
      return;
    }
    try {
      setBuying(listing.id);
      const seller = new PublicKey(listing.sellerWalletAddress);
      const lamports = Math.round(listing.priceSol * LAMPORTS_PER_SOL);
      const tx = new Transaction().add(
        SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: seller, lamports })
      );
      const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT || 'https://api.devnet.solana.com';
      const conn = new Connection(endpoint);
      const signature = await sendTransaction(tx, conn);
      try { await conn.confirmTransaction(signature, 'confirmed'); } catch {}

      const url = `/api/marketplace/listings/${listing.id}/buy`;
      const payload = { signature, buyer_wallet_address: publicKey.toBase58() };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      let j: any = null;
      try {
        j = await res.json();
      } catch {
        const text = await res.text();
        throw new Error(text || 'Purchase failed (non-JSON response)');
      }
      // If server is still waiting for parsed transaction availability, poll a few times
      if (res.status === 202 && j?.pending) {
        for (let i = 0; i < 6; i++) {
          await new Promise(r => setTimeout(r, 2000));
          const r2 = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          let j2: any = null;
          try { j2 = await r2.json(); } catch { j2 = {}; }
          if (r2.ok && j2?.success) { j = j2; break; }
          if (r2.status !== 202) {
            throw new Error(j2?.error || 'Purchase verification failed');
          }
        }
      }
      if (!res.ok || !j?.success) {
        throw new Error(j?.error || 'Purchase failed');
      }
      setListings((prev) => prev.map(l => {
        if (l.id !== listing.id) return l;
        const soldCount = (l.soldCount ?? 0) + 1;
        const available = Math.max(0, l.supply - soldCount);
        return { ...l, soldCount, available };
      }));
      alert('Purchase successful');
    } catch (e: any) {
      console.error('Buy error:', e);
      alert(e?.message || 'Purchase failed');
    } finally {
      setBuying(null);
    }
  };

  // Join song media for listings
  const [listingMedia, setListingMedia] = useState<Record<string, { audioUrl?: string | null; coverUrl?: string | null }>>({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ids = Array.from(new Set(listings.map(l => l.songId))).filter(Boolean);
        if (!ids.length) return;
        const { data, error } = await supabase
          .from('songs')
          .select('id, audio_url, cover_url, cover_art_url')
          .in('id', ids);
        if (error) throw error;
        const map: Record<string, { audioUrl?: string | null; coverUrl?: string | null }> = {};
        const rows = (data ?? []) as Array<{ id: string; audio_url: string | null; cover_url: string | null; cover_art_url: string | null }>;
        for (const s of rows) {
          const audioPath = s.audio_url || null;
          const coverPath = s.cover_url || s.cover_art_url || null;
          const audioUrl = audioPath ? supabase.storage.from('karaoke-songs').getPublicUrl(audioPath).data.publicUrl : null;
          const coverUrl = coverPath ? supabase.storage.from('karaoke-songs').getPublicUrl(coverPath).data.publicUrl : "/riddimz-logo.jpg";
          map[s.id] = { audioUrl, coverUrl };
        }
        if (!cancelled) setListingMedia(map);
      } catch (e) {
        // ignore media join errors
      }
    })();
    return () => { cancelled = true; };
  }, [supabase, listings]);

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
            let img = typeof json?.image === 'string' ? json.image : undefined;
            
            // Convert relative paths to absolute URLs
            if (img && !img.startsWith('http')) {
              const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
              img = `${supabaseUrl}/storage/v1/object/public/karaoke-songs/${img}`;
            }
            
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

  // Audio playback functions
  const handlePlay = (songId: string, audioUrl: string) => {
    if (currentlyPlaying === songId) return;
    
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    
    const newAudio = new Audio(audioUrl);
    newAudio.addEventListener('ended', () => {
      setCurrentlyPlaying(null);
      setAudio(null);
    });
    
    newAudio.play();
    setAudio(newAudio);
    setCurrentlyPlaying(songId);
  };

  const handlePause = () => {
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setCurrentlyPlaying(null);
    setAudio(null);
  };

  // Detail modal handlers
  const openListingDetail = (listing: Listing) => {
    const media = listingMedia[listing.songId] || {};
    const coverUrl = media.coverUrl || "/riddimz-logo.jpg";
    const audioUrl = media.audioUrl || null;
    setSelectedItem({
      id: listing.id,
      title: listing.title,
      artist: listing.artist,
      coverUrl,
      audioUrl,
      price: listing.priceSol,
      currency: "SOL",
      isListed: true,
      metadataUri: listing.metadataUri,
      supply: listing.supply,
      available: listing.available,
      soldCount: listing.soldCount,
      sellerWalletAddress: listing.sellerWalletAddress,
    });
    setSelectedListing(listing);
    setDetailOpen(true);
  };

  const openSongDetail = (song: SongRow) => {
    const coverUrl =
      metadataImages[song.id] ||
      buildPublicUrl(song.cover_url) ||
      buildPublicUrl(song.cover_art_url) ||
      "/riddimz-logo.jpg";
    const audioUrl = buildPublicUrl(song.audio_url) || null;
    setSelectedItem({
      id: song.id,
      title: song.title,
      artist: song.artist,
      coverUrl,
      audioUrl,
      isListed: false,
      metadataUri: song.nft_metadata_uri,
    });
    setSelectedListing(null);
    setDetailOpen(true);
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setSelectedItem(null);
    setSelectedListing(null);
  };

  // Filter and sort functions
  const filteredAndSortedListings = useMemo(() => {
    let filtered = listings;
    
    if (searchQuery) {
      filtered = filtered.filter(listing => 
        listing.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        listing.artist.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    switch (sortBy) {
      case 'price-low':
        return [...filtered].sort((a, b) => a.priceSol - b.priceSol);
      case 'price-high':
        return [...filtered].sort((a, b) => b.priceSol - a.priceSol);
      case 'alphabetical':
        return [...filtered].sort((a, b) => a.title.localeCompare(b.title));
      case 'popular':
        return [...filtered].sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0));
      default:
        return filtered;
    }
  }, [listings, searchQuery, sortBy]);

  const filteredAndSortedUnlisted = useMemo(() => {
    let filtered = unlistedSongs;
    
    if (searchQuery) {
      filtered = filtered.filter(song => 
        song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        song.artist.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    switch (sortBy) {
      case 'alphabetical':
        return [...filtered].sort((a, b) => a.title.localeCompare(b.title));
      default:
        return filtered;
    }
  }, [unlistedSongs, searchQuery, sortBy]);

  // Calculate stats
  const totalItems = songs.length;
  const totalVolume = listings.reduce((sum, listing) => sum + (listing.priceSol * (listing.soldCount || 0)), 0);
  const activeListings = listings.filter(l => l.available > 0).length;
  const totalCreators = new Set([...listings.map(l => l.sellerUserId), ...songs.map(s => s.id)]).size;
  const floorPrice = listings.length > 0 ? Math.min(...listings.map(l => l.priceSol)) : 0;
  const avgPrice = listings.length > 0 ? listings.reduce((sum, l) => sum + l.priceSol, 0) / listings.length : 0;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 space-y-8">
        {/* Header */}
        <MarketplaceHeader
          onSearch={setSearchQuery}
          onSortChange={setSortBy}
          onViewChange={setView}
          totalItems={totalItems}
          view={view}
        />

        {/* Collection Stats */}
        <CollectionStats
          totalItems={totalItems}
          totalVolume={totalVolume}
          activeListings={activeListings}
          totalCreators={totalCreators}
          floorPrice={floorPrice}
          avgPrice={avgPrice}
        />

        {/* Error Display */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <p className="text-destructive">Error loading songs: {error}</p>
          </div>
        )}

        {listingsError && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <p className="text-destructive">{listingsError}</p>
          </div>
        )}

        {/* Main Content */}
        <Tabs defaultValue="all" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
            <TabsTrigger value="all">All Items ({totalItems})</TabsTrigger>
            <TabsTrigger value="listings">Active Listings ({activeListings})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-6">
            {loading ? (
              <div className={`grid gap-6 ${view === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'}`}>
                {Array.from({ length: 12 }).map((_, i) => (
                  <Card key={i} className="overflow-hidden">
                    <div className="aspect-square">
                      <Skeleton className="w-full h-full" />
                    </div>
                    <div className="p-4 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <>
                {/* Active Listings */}
                {filteredAndSortedListings.length > 0 && (
                  <div className="space-y-4">
                    <h2 className="text-xl font-semibold">Active Listings</h2>
                    <div className={`grid gap-6 ${view === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'}`}>
                      {filteredAndSortedListings.map((listing) => {
                        const media = listingMedia[listing.songId] || {};
                        const coverUrl = media.coverUrl || "/riddimz-logo.jpg";
                        const audioUrl = media.audioUrl;
                        
                        return (
                          <NFTCard
                            key={listing.id}
                            id={listing.id}
                            title={listing.title}
                            artist={listing.artist}
                            coverUrl={coverUrl}
                            audioUrl={audioUrl || undefined}
                            price={listing.priceSol}
                            currency="SOL"
                            isListed={true}
                            onPlay={() => audioUrl && handlePlay(listing.id, audioUrl)}
                            onPause={handlePause}
                            onBuy={() => handleBuy(listing)}
                            onOpenDetails={() => openListingDetail(listing)}
                            isPlaying={currentlyPlaying === listing.id}
                            view={view}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Unlisted NFTs */}
                {filteredAndSortedUnlisted.length > 0 && (
                  <div className="space-y-4">
                    <h2 className="text-xl font-semibold">NFT Collection</h2>
                    <div className={`grid gap-6 ${view === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'}`}>
                      {filteredAndSortedUnlisted.map((song) => {
                        const coverUrl =
                          metadataImages[song.id] ||
                          buildPublicUrl(song.cover_url) ||
                          buildPublicUrl(song.cover_art_url) ||
                          "/riddimz-logo.jpg";
                        const audioUrl = buildPublicUrl(song.audio_url);
                        
                        return (
                          <NFTCard
                            key={song.id}
                            id={song.id}
                            title={song.title}
                            artist={song.artist}
                            coverUrl={coverUrl}
                            audioUrl={audioUrl || undefined}
                            isListed={false}
                            onPlay={() => audioUrl && handlePlay(song.id, audioUrl)}
                            onPause={handlePause}
                            onOpenDetails={() => openSongDetail(song)}
                            isPlaying={currentlyPlaying === song.id}
                            view={view}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Load More */}
                {hasMore && (
                  <div className="flex justify-center pt-8">
                    <Button 
                      onClick={loadMore} 
                      disabled={loadingMore} 
                      variant="outline"
                      size="lg"
                    >
                      {loadingMore ? "Loading..." : "Load More"}
                    </Button>
                  </div>
                )}

                {!loading && filteredAndSortedListings.length === 0 && filteredAndSortedUnlisted.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No items found matching your criteria.</p>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="listings" className="space-y-6">
            {listingsLoading ? (
              <div className={`grid gap-6 ${view === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'}`}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="overflow-hidden">
                    <div className="aspect-square">
                      <Skeleton className="w-full h-full" />
                    </div>
                    <div className="p-4 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  </Card>
                ))}
              </div>
            ) : filteredAndSortedListings.length > 0 ? (
              <div className={`grid gap-6 ${view === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'}`}>
                {filteredAndSortedListings.map((listing) => {
                  const media = listingMedia[listing.songId] || {};
                  const coverUrl = media.coverUrl || "/riddimz-logo.jpg";
                  const audioUrl = media.audioUrl;
                  
                  return (
                    <NFTCard
                      key={listing.id}
                      id={listing.id}
                      title={listing.title}
                      artist={listing.artist}
                      coverUrl={coverUrl}
                      audioUrl={audioUrl || undefined}
                      price={listing.priceSol}
                      currency="SOL"
                      isListed={true}
                      onPlay={() => audioUrl && handlePlay(listing.id, audioUrl)}
                      onPause={handlePause}
                      onBuy={() => handleBuy(listing)}
                      onOpenDetails={() => openListingDetail(listing)}
                      isPlaying={currentlyPlaying === listing.id}
                      view={view}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No active listings found.</p>
                <Link href="/marketplace/create" className="text-primary hover:underline mt-2 inline-block">
                  List your first item
                </Link>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
        {selectedItem && (
          <NFTDetailModal
            open={detailOpen}
            onClose={closeDetail}
            item={selectedItem}
            onBuy={selectedListing ? () => handleBuy(selectedListing) : undefined}
          />
        )}
    </div>
  );
}