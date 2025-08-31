"use client"

import { useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Play, Mic, Heart, Share2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function FeaturedSection() {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div 
      className={cn(
        "relative w-full h-[300px] md:h-[400px] rounded-xl overflow-hidden transition-all duration-500",
        isHovered ? "shadow-2xl transform scale-[1.01]" : "shadow-xl"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background image with overlay */}
      <div className="absolute inset-0 w-full h-full bg-black">
        <Image
          src="https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg"
          alt="Featured artist"
          layout="fill"
          objectFit="cover"
          className="opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative h-full flex flex-col justify-end p-6 md:p-8">
        <div className="flex items-center space-x-2 mb-2">
          <span className="bg-gradient-to-r from-red-500 to-purple-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
            FEATURED
          </span>
          <span className="nft-badge">NFT EXCLUSIVE</span>
        </div>
        
        <h1 className="text-2xl md:text-4xl font-bold text-white mb-2">
          Cosmic Harmony
        </h1>
        
        <p className="text-white/80 text-sm md:text-base mb-4 md:max-w-2xl">
          Experience the blend of electronic beats and soulful vocals in this NFT-backed exclusive track. 
          Join the karaoke room to sing along or collect the NFT for exclusive access.
        </p>
        
        <div className="flex flex-wrap gap-3">
          <Button className="bg-primary hover:bg-primary/90 gap-2">
            <Play className="h-4 w-4" /> Play Now
          </Button>
          <Button variant="secondary" className="gap-2">
            <Mic className="h-4 w-4" /> Join Karaoke
          </Button>
          <Button variant="outline" size="icon" className="bg-background/30 backdrop-blur-sm">
            <Heart className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="bg-background/30 backdrop-blur-sm">
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Audio visualizer (decorative) */}
        <div className="absolute top-1/2 right-8 transform -translate-y-1/2 hidden md:flex items-end h-12 space-x-1">
          <div className="audio-bar"></div>
          <div className="audio-bar"></div>
          <div className="audio-bar"></div>
          <div className="audio-bar"></div>
          <div className="audio-bar"></div>
        </div>
      </div>
    </div>
  )
}