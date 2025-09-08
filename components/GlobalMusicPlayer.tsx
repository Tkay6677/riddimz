"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { 
  Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, X, Maximize2, Minimize2
} from 'lucide-react'
import { useAudio } from '@/contexts/AudioContext'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export const GlobalMusicPlayer: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false)
  
  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    volume,
    pauseSong,
    resumeSong,
    stopSong,
    setVolume,
    seekTo
  } = useAudio()

  if (!currentSong) return null

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0

  const handleProgressChange = (value: number[]) => {
    const newTime = (value[0] / 100) * duration
    seekTo(newTime)
  }

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0] / 100)
  }

  return (
    <Card className={`fixed bg-background/95 backdrop-blur-sm border shadow-lg z-50 transition-all duration-300 ${
      isMaximized 
        ? "inset-4 w-auto h-auto" 
        : "bottom-4 right-4 w-80"
    }`}>
      <CardContent className={`${isMaximized ? "p-8" : "p-4"}`}>
        {/* Header with close button */}
        <div className="flex items-center justify-between mb-3">
          <h4 className={`font-medium text-muted-foreground ${isMaximized ? "text-lg" : "text-sm"}`}>
            Now Playing
          </h4>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsMaximized(!isMaximized)}
            >
              {isMaximized ? (
                <Minimize2 className="h-3 w-3" />
              ) : (
                <Maximize2 className="h-3 w-3" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={stopSong}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Song info */}
        <div className={`flex items-center gap-3 mb-3 ${isMaximized ? "justify-center" : ""}`}>
          <Avatar className={`${isMaximized ? "h-32 w-32" : "h-12 w-12"}`}>
            <AvatarImage src={currentSong.coverArtUrl} />
            <AvatarFallback>
              <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <span className={`text-white font-bold ${isMaximized ? "text-2xl" : "text-xs"}`}>
                  {currentSong.title.slice(0, 2).toUpperCase()}
                </span>
              </div>
            </AvatarFallback>
          </Avatar>
          <div className={`flex-1 min-w-0 ${isMaximized ? "text-center ml-0" : ""}`}>
            <h3 className={`font-semibold truncate ${isMaximized ? "text-2xl mb-2" : "text-sm"}`}>
              {currentSong.title}
            </h3>
            <p className={`text-muted-foreground truncate ${isMaximized ? "text-lg mb-1" : "text-xs"}`}>
              {currentSong.artist}
            </p>
            <p className={`text-muted-foreground truncate ${isMaximized ? "text-base" : "text-xs"}`}>
              by {currentSong.uploaderUsername || 'Unknown'}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className={`space-y-2 mb-3 ${isMaximized ? "mb-8" : ""}`}>
          <Slider
            value={[progressPercent]}
            onValueChange={handleProgressChange}
            max={100}
            step={0.1}
            className="w-full"
          />
          <div className={`flex justify-between text-muted-foreground ${isMaximized ? "text-base" : "text-xs"}`}>
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className={`flex items-center ${isMaximized ? "justify-center flex-col gap-6" : "justify-between"}`}>
          <div className={`flex items-center gap-1 ${isMaximized ? "gap-4" : ""}`}>
            <Button
              variant="ghost"
              size="icon"
              className={`${isMaximized ? "h-12 w-12" : "h-8 w-8"}`}
              disabled
            >
              <SkipBack className={`${isMaximized ? "h-6 w-6" : "h-4 w-4"}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={`bg-primary text-primary-foreground hover:bg-primary/90 ${isMaximized ? "h-16 w-16" : "h-10 w-10"}`}
              onClick={isPlaying ? pauseSong : resumeSong}
            >
              {isPlaying ? (
                <Pause className={`${isMaximized ? "h-8 w-8" : "h-5 w-5"}`} />
              ) : (
                <Play className={`${isMaximized ? "h-8 w-8" : "h-5 w-5"}`} />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={`${isMaximized ? "h-12 w-12" : "h-8 w-8"}`}
              disabled
            >
              <SkipForward className={`${isMaximized ? "h-6 w-6" : "h-4 w-4"}`} />
            </Button>
          </div>

          {/* Volume control */}
          <div className={`flex items-center gap-2 ${isMaximized ? "justify-center" : ""}`}>
            <Button
              variant="ghost"
              size="icon"
              className={`${isMaximized ? "h-8 w-8" : "h-6 w-6"}`}
              onClick={() => setVolume(volume > 0 ? 0 : 1)}
            >
              {volume > 0 ? (
                <Volume2 className={`${isMaximized ? "h-5 w-5" : "h-3 w-3"}`} />
              ) : (
                <VolumeX className={`${isMaximized ? "h-5 w-5" : "h-3 w-3"}`} />
              )}
            </Button>
            <Slider
              value={[volume * 100]}
              onValueChange={handleVolumeChange}
              max={100}
              step={1}
              className={`${isMaximized ? "w-32" : "w-16"}`}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
