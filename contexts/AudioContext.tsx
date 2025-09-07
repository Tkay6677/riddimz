"use client"

import React, { createContext, useContext, useState, useRef, useCallback, ReactNode } from 'react'

interface Song {
  _id: string
  title: string
  artist: string
  coverArtUrl?: string
  audioUrl?: string
  duration: number
  uploaderUsername?: string
}

interface AudioContextType {
  currentSong: Song | null
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  playSong: (song: Song) => Promise<void>
  pauseSong: () => void
  resumeSong: () => void
  stopSong: () => void
  setVolume: (volume: number) => void
  seekTo: (time: number) => void
  audio: HTMLAudioElement | null
}

const AudioContext = createContext<AudioContextType | undefined>(undefined)

export const useAudio = () => {
  const context = useContext(AudioContext)
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider')
  }
  return context
}

interface AudioProviderProps {
  children: ReactNode
}

export const AudioProvider: React.FC<AudioProviderProps> = ({ children }) => {
  const [currentSong, setCurrentSong] = useState<Song | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(1)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const playSong = useCallback(async (song: Song) => {
    try {
      // Stop current audio if playing
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
      }

      // Create new audio element
      const audio = new Audio()
      
      // Set audio source
      if (song.audioUrl) {
        audio.src = song.audioUrl
      } else {
        const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/songs/${song._id}`
        audio.src = publicUrl
      }

      // Set up event listeners
      audio.addEventListener('loadedmetadata', () => {
        setDuration(audio.duration)
      })

      audio.addEventListener('timeupdate', () => {
        setCurrentTime(audio.currentTime)
      })

      audio.addEventListener('ended', () => {
        setIsPlaying(false)
        setCurrentTime(0)
      })

      audio.addEventListener('error', (e) => {
        console.error('Audio error:', e)
        setIsPlaying(false)
        setCurrentSong(null)
      })

      audio.volume = volume
      await audio.play()
      
      audioRef.current = audio
      setCurrentSong(song)
      setIsPlaying(true)

    } catch (error) {
      console.error('Error playing song:', error)
      setIsPlaying(false)
    }
  }, [volume])

  const pauseSong = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause()
      setIsPlaying(false)
    }
  }, [])

  const resumeSong = useCallback(() => {
    if (audioRef.current && audioRef.current.paused) {
      audioRef.current.play()
      setIsPlaying(true)
    }
  }, [])

  const stopSong = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      setIsPlaying(false)
      setCurrentSong(null)
      setCurrentTime(0)
      setDuration(0)
    }
  }, [])

  const setVolume = useCallback((newVolume: number) => {
    setVolumeState(newVolume)
    if (audioRef.current) {
      audioRef.current.volume = newVolume
    }
  }, [])

  const seekTo = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time
      setCurrentTime(time)
    }
  }, [])

  const value: AudioContextType = {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    volume,
    playSong,
    pauseSong,
    resumeSong,
    stopSong,
    setVolume,
    seekTo,
    audio: audioRef.current
  }

  return (
    <AudioContext.Provider value={value}>
      {children}
    </AudioContext.Provider>
  )
}
