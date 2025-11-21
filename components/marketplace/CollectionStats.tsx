"use client";

import React, { useState, useEffect } from "react";
import { TrendingUp, Users, Music, DollarSign, Activity, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  description?: string;
}

function StatCard({ title, value, change, icon, description }: StatCardProps) {
  return (
    <Card className="transition-all duration-200 hover:shadow-md">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              {icon}
            </div>
            {change !== undefined && (
              <Badge 
                variant={change >= 0 ? "default" : "destructive"}
                className="text-xs"
              >
                {change >= 0 ? "+" : ""}{change}%
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface TrendingItemProps {
  rank: number;
  title: string;
  artist: string;
  volume: string;
  change: number;
}

function TrendingItem({ rank, title, artist, volume, change }: TrendingItemProps) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-xs font-bold">
          {rank}
        </div>
        <div>
          <p className="font-medium text-sm">{title}</p>
          <p className="text-xs text-muted-foreground">{artist}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium">{volume}</p>
        <Badge 
          variant={change >= 0 ? "default" : "destructive"}
          className="text-xs"
        >
          {change >= 0 ? "+" : ""}{change}%
        </Badge>
      </div>
    </div>
  );
}

interface TrendingSong {
  id: string;
  title: string;
  artist: string;
  trending_score: number;
  play_count: number;
}

interface CollectionStatsProps {
  totalItems?: number;
  totalVolume?: number;
  activeListings?: number;
  totalCreators?: number;
  floorPrice?: number;
  avgPrice?: number;
}

export function CollectionStats({
  totalItems = 0,
  totalVolume = 0,
  activeListings = 0,
  totalCreators = 0,
  floorPrice = 0,
  avgPrice = 0
}: CollectionStatsProps) {
  const [trendingSongs, setTrendingSongs] = useState<TrendingSong[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);

  // Fetch trending songs from the database
  useEffect(() => {
    const fetchTrendingSongs = async () => {
      try {
        const response = await fetch('/api/songs/trending?limit=5');
        if (response.ok) {
          const data = await response.json();
          setTrendingSongs(data.songs || []);
        }
      } catch (error) {
        console.error('Failed to fetch trending songs:', error);
      } finally {
        setTrendingLoading(false);
      }
    };

    fetchTrendingSongs();
  }, []);

  const stats = [
    {
      title: "Total Items",
      value: totalItems.toLocaleString(),
      icon: <Music className="h-4 w-4 text-primary" />,
      description: "Music NFTs"
    },
    {
      title: "Total Volume",
      value: `${totalVolume.toFixed(1)} SOL`,
      icon: <DollarSign className="h-4 w-4 text-primary" />,
      description: "All time"
    },
    {
      title: "Active Listings",
      value: activeListings.toLocaleString(),
      icon: <Activity className="h-4 w-4 text-primary" />,
      description: "Currently listed"
    },
    {
      title: "Creators",
      value: totalCreators.toLocaleString(),
      icon: <Users className="h-4 w-4 text-primary" />,
      description: "Active artists"
    }
  ];

  // Convert trending songs to trending items format
  const trendingItems = trendingSongs.map((song, index) => ({
    rank: index + 1,
    title: song.title,
    artist: song.artist,
    volume: `${song.play_count} plays`,
    change: song.trending_score > 50 ? Math.floor(song.trending_score / 10) : 0 // Calculate change based on trending score
  }));

  return (
    <div className="space-y-6">
      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>

      {/* Additional Info Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Price Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <DollarSign className="h-5 w-5" />
              Price Analytics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Floor Price</span>
              <span className="font-semibold">{floorPrice} SOL</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Average Price</span>
              <span className="font-semibold">{avgPrice} SOL</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Market Activity</span>
                <span>{totalItems > 0 ? Math.round((activeListings / totalItems) * 100) : 0}%</span>
              </div>
              <Progress value={totalItems > 0 ? (activeListings / totalItems) * 100 : 0} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Trending Collections */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5" />
              Trending This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {trendingLoading ? (
                <div className="text-center py-4 text-muted-foreground">
                  Loading trending songs...
                </div>
              ) : trendingItems.length > 0 ? (
                trendingItems.map((item) => (
                  <TrendingItem key={item.rank} {...item} />
                ))
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  No trending data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Eye className="h-5 w-5" />
            Market Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                +{totalItems > 0 ? ((activeListings / totalItems) * 100).toFixed(1) : '0.0'}%
              </div>
              <div className="text-sm text-muted-foreground">Listing Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {totalItems > 0 ? (totalVolume / totalItems).toFixed(2) : '0.00'} SOL
              </div>
              <div className="text-sm text-muted-foreground">Avg. Volume per Item</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {totalCreators > 0 ? (totalItems / totalCreators).toFixed(1) : '0.0'}
              </div>
              <div className="text-sm text-muted-foreground">Items per Creator</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}