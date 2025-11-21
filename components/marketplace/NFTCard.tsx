"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Play, Pause, Heart, ExternalLink, Music, Clock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface NFTCardProps {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  audioUrl?: string;
  price?: number;
  currency?: string;
  duration?: string;
  isListed?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onBuy?: () => void;
  onOpenDetails?: () => void;
  isPlaying?: boolean;
  className?: string;
  view?: 'grid' | 'list';
}

export function NFTCard({
  id,
  title,
  artist,
  coverUrl,
  audioUrl,
  price,
  currency = "SOL",
  duration,
  isListed = false,
  onPlay,
  onPause,
  onBuy,
  onOpenDetails,
  isPlaying = false,
  className = "",
  view = 'grid'
}: NFTCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handlePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPlaying) {
      onPause?.();
    } else {
      onPlay?.();
    }
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLiked(!isLiked);
  };

  if (view === 'list') {
    return (
      <Card 
        className={`group cursor-pointer transition-all duration-300 hover:shadow-lg border-border/50 ${className}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => onOpenDetails?.()}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            {/* Cover Image */}
            <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
              {!imageError ? (
                <Image
                  src={coverUrl}
                  alt={title}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center">
                  <Music className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              
              {/* Play Button Overlay */}
              {audioUrl && (
                <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 w-8 rounded-full p-0 bg-white/90 hover:bg-white"
                    onClick={handlePlayPause}
                  >
                    {isPlaying ? (
                      <Pause className="h-3 w-3 text-black" />
                    ) : (
                      <Play className="h-3 w-3 text-black ml-0.5" />
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-sm truncate">{title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Avatar className="h-4 w-4">
                      <AvatarFallback className="text-xs">{artist[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground truncate">{artist}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 ml-4">
                  {duration && (
                    <Badge variant="secondary" className="text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      {duration}
                    </Badge>
                  )}
                  
                  {isListed && price && (
                    <div className="text-right">
                      <div className="font-semibold text-sm">{price} {currency}</div>
                      <Button size="sm" onClick={onBuy} className="h-6 text-xs mt-1">
                        Buy Now
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className={`group cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border-border/50 overflow-hidden ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onOpenDetails?.()}
    >
      <CardContent className="p-0">
        {/* Cover Image */}
        <div className="relative aspect-square overflow-hidden">
          {!imageError ? (
            <Image
              src={coverUrl}
              alt={title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-110"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <Music className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
          
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          
          {/* Action Buttons */}
          <div className="absolute top-3 right-3 flex gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="secondary"
                    className={`h-8 w-8 rounded-full p-0 bg-white/90 hover:bg-white transition-all duration-200 ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}
                    onClick={handleLike}
                  >
                    <Heart className={`h-3 w-3 ${isLiked ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isLiked ? 'Remove from favorites' : 'Add to favorites'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="secondary"
                    className={`h-8 w-8 rounded-full p-0 bg-white/90 hover:bg-white transition-all duration-200 ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}
                    style={{ transitionDelay: '50ms' }}
                    onClick={(e) => { e.stopPropagation(); onOpenDetails?.(); }}
                  >
                    <ExternalLink className="h-3 w-3 text-gray-600" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>View details</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Play Button */}
          {audioUrl && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Button
                size="lg"
                variant="secondary"
                className={`h-14 w-14 rounded-full p-0 bg-white/90 hover:bg-white transition-all duration-300 ${isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}
                onClick={handlePlayPause}
              >
                {isPlaying ? (
                  <Pause className="h-6 w-6 text-black" />
                ) : (
                  <Play className="h-6 w-6 text-black ml-1" />
                )}
              </Button>
            </div>
          )}

          {/* Status Badges */}
          <div className="absolute bottom-3 left-3 flex gap-2">
            {duration && (
              <Badge variant="secondary" className="bg-black/50 text-white border-white/20 text-xs">
                <Clock className="h-3 w-3 mr-1" />
                {duration}
              </Badge>
            )}
            {isListed && (
              <Badge className="bg-green-500/90 text-white text-xs">
                Listed
              </Badge>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="space-y-2">
            <h3 className="font-semibold text-base line-clamp-1 group-hover:text-primary transition-colors">
              {title}
            </h3>
            
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5">
                <AvatarFallback className="text-xs">{artist[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="text-sm text-muted-foreground truncate">{artist}</span>
            </div>

            {isListed && price && (
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <div>
                  <div className="text-xs text-muted-foreground">Price</div>
                  <div className="font-bold text-lg">{price} {currency}</div>
                </div>
                <Button size="sm" onClick={onBuy} className="px-6">
                  Buy Now
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}