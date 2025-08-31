'use client'

import { useState, useEffect, useCallback } from 'react'
import { SongService, UserInteractionService, HybridService } from '@/lib/database'
import { ISong } from '@/lib/models/Song'
import { useAuth } from './useAuth'

export interface SongWithUrls {
  _id: string
  title: string
  artist: string
  duration: number
  genre?: string
  audioFileId: string
  lyricsFileId?: string
  coverArtFileId?: string
  uploaderId: string
  uploaderUsername: string
  playCount: number
  likesCount: number
  favoritesCount: number
  trendingScore: number
  createdAt: Date
  updatedAt: Date
  isNft: boolean
  tags: string[]
  description?: string
  language?: string
  mood?: string
  tempo?: 'slow' | 'medium' | 'fast'
  difficulty?: 'easy' | 'medium' | 'hard'
  audioUrl?: string
  lyricsUrl?: string
  coverArtUrl?: string
  is_favorite?: boolean
}

export function useSongs() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleError = useCallback((err: any, action: string) => {
    console.error(`Error ${action}:`, err)
    setError(`Failed to ${action}`)
  }, [])

  const getTrendingSongs = useCallback(async (limit = 20): Promise<SongWithUrls[]> => {
    try {
      setLoading(true)
      setError(null)
      const songs = await SongService.getTrendingSongs(limit)
      const songsWithUrls = await HybridService.getSongsWithUrls(songs)
      
      // Add favorite status if user is logged in
      if (user) {
        const songsWithFavorites = await Promise.all(
          songsWithUrls.map(async (song) => ({
            ...(song.toObject ? song.toObject() : song),
            is_favorite: await UserInteractionService.isUserFavorite(user.id, song._id)
          }))
        )
        return songsWithFavorites as SongWithUrls[]
      }
      
      return songsWithUrls.map(song => ({ ...(song.toObject ? song.toObject() : song), is_favorite: false })) as SongWithUrls[]
    } catch (err) {
      handleError(err, 'fetch trending songs')
      return []
    } finally {
      setLoading(false)
    }
  }, [user, handleError])

  const getNewReleases = useCallback(async (limit = 20): Promise<SongWithUrls[]> => {
    try {
      setLoading(true)
      setError(null)
      const songs = await SongService.getNewReleases(limit)
      const songsWithUrls = await HybridService.getSongsWithUrls(songs)
      
      if (user) {
        const songsWithFavorites = await Promise.all(
          songsWithUrls.map(async (song) => ({
            ...(song.toObject ? song.toObject() : song),
            is_favorite: await UserInteractionService.isUserFavorite(user.id, song._id)
          }))
        )
        return songsWithFavorites as SongWithUrls[]
      }
      
      return songsWithUrls.map(song => ({ ...(song.toObject ? song.toObject() : song), is_favorite: false })) as SongWithUrls[]
    } catch (err) {
      handleError(err, 'fetch new releases')
      return []
    } finally {
      setLoading(false)
    }
  }, [user, handleError])

  const getUserSongs = useCallback(async (userId: string, limit = 20): Promise<SongWithUrls[]> => {
    try {
      setLoading(true)
      setError(null)
      const songs = await SongService.getSongsByUser(userId, limit)
      const songsWithUrls = await HybridService.getSongsWithUrls(songs)
      
      if (user) {
        const songsWithFavorites = await Promise.all(
          songsWithUrls.map(async (song) => ({
            ...(song.toObject ? song.toObject() : song),
            is_favorite: await UserInteractionService.isUserFavorite(user.id, song._id)
          }))
        )
        return songsWithFavorites as SongWithUrls[]
      }
      
      return songsWithUrls.map(song => ({ ...(song.toObject ? song.toObject() : song), is_favorite: false })) as SongWithUrls[]
    } catch (err) {
      handleError(err, 'fetch user songs')
      return []
    } finally {
      setLoading(false)
    }
  }, [user, handleError])

  const searchSongs = useCallback(async (
    query: string, 
    filters?: {
      genre?: string
      mood?: string
      tempo?: string
      difficulty?: string
    },
    limit = 20
  ): Promise<SongWithUrls[]> => {
    try {
      setLoading(true)
      setError(null)
      const songs = await SongService.searchSongs(query, filters, limit)
      const songsWithUrls = await HybridService.getSongsWithUrls(songs)
      
      if (user) {
        const songsWithFavorites = await Promise.all(
          songsWithUrls.map(async (song) => ({
            ...(song.toObject ? song.toObject() : song),
            is_favorite: await UserInteractionService.isUserFavorite(user.id, song._id)
          }))
        )
        return songsWithFavorites as SongWithUrls[]
      }
      
      return songsWithUrls.map(song => ({ ...(song.toObject ? song.toObject() : song), is_favorite: false })) as SongWithUrls[]
    } catch (err) {
      handleError(err, 'search songs')
      return []
    } finally {
      setLoading(false)
    }
  }, [user, handleError])

  const getSongsByGenre = useCallback(async (genre: string, limit = 20): Promise<SongWithUrls[]> => {
    try {
      setLoading(true)
      setError(null)
      const songs = await SongService.getSongsByGenre(genre, limit)
      const songsWithUrls = await HybridService.getSongsWithUrls(songs)
      
      if (user) {
        const songsWithFavorites = await Promise.all(
          songsWithUrls.map(async (song) => ({
            ...(song.toObject ? song.toObject() : song),
            is_favorite: await UserInteractionService.isUserFavorite(user.id, song._id)
          }))
        )
        return songsWithFavorites as SongWithUrls[]
      }
      
      return songsWithUrls.map(song => ({ ...(song.toObject ? song.toObject() : song), is_favorite: false })) as SongWithUrls[]
    } catch (err) {
      handleError(err, 'fetch songs by genre')
      return []
    } finally {
      setLoading(false)
    }
  }, [user, handleError])

  const getSongById = useCallback(async (songId: string): Promise<SongWithUrls | null> => {
    try {
      setLoading(true)
      setError(null)
      const songWithUrls = await HybridService.getSongWithUrls(songId)
      
      if (songWithUrls && user) {
        const is_favorite = await UserInteractionService.isUserFavorite(user.id, songId)
        return { ...(songWithUrls.toObject ? songWithUrls.toObject() : songWithUrls), is_favorite } as SongWithUrls
      }
      
      return songWithUrls ? { ...(songWithUrls.toObject ? songWithUrls.toObject() : songWithUrls), is_favorite: false } as SongWithUrls : null
    } catch (err) {
      handleError(err, 'fetch song')
      return null
    } finally {
      setLoading(false)
    }
  }, [user, handleError])

  const getUserFavorites = useCallback(async (limit = 20): Promise<SongWithUrls[]> => {
    if (!user) return []
    
    try {
      setLoading(true)
      setError(null)
      const songs = await UserInteractionService.getUserFavorites(user.id, limit)
      const songsWithUrls = await HybridService.getSongsWithUrls(songs)
      return songsWithUrls.map(song => ({ ...(song.toObject ? song.toObject() : song), is_favorite: true })) as SongWithUrls[]
    } catch (err) {
      handleError(err, 'fetch user favorites')
      return []
    } finally {
      setLoading(false)
    }
  }, [user, handleError])

  const getUserRecentlyPlayed = useCallback(async (limit = 20): Promise<SongWithUrls[]> => {
    if (!user) return []
    
    try {
      setLoading(true)
      setError(null)
      const songs = await UserInteractionService.getUserRecentlyPlayed(user.id, limit)
      const songsWithUrls = await HybridService.getSongsWithUrls(songs)
      
      const songsWithFavorites = await Promise.all(
        songsWithUrls.map(async (song) => ({
          ...(song.toObject ? song.toObject() : song),
          is_favorite: await UserInteractionService.isUserFavorite(user.id, song._id)
        }))
      )
      return songsWithFavorites as SongWithUrls[]
    } catch (err) {
      handleError(err, 'fetch recently played songs')
      return []
    } finally {
      setLoading(false)
    }
  }, [user, handleError])

  const getPopularGenres = useCallback(async (): Promise<Array<{ genre: string; count: number }>> => {
    try {
      setLoading(true)
      setError(null)
      return await SongService.getPopularGenres()
    } catch (err) {
      handleError(err, 'fetch popular genres')
      return []
    } finally {
      setLoading(false)
    }
  }, [handleError])

  const toggleFavorite = useCallback(async (songId: string): Promise<boolean> => {
    if (!user) return false
    
    try {
      const isFavorite = await UserInteractionService.isUserFavorite(user.id, songId)
      
      if (isFavorite) {
        return await UserInteractionService.removeFavorite(user.id, songId)
      } else {
        await UserInteractionService.recordInteraction({
          userId: user.id,
          songId,
          type: 'favorite'
        })
        return true
      }
    } catch (err) {
      handleError(err, 'toggle favorite')
      return false
    }
  }, [user, handleError])

  const recordPlay = useCallback(async (songId: string, metadata?: { playDuration?: number; deviceType?: string }): Promise<void> => {
    if (!user) return
    
    try {
      await UserInteractionService.recordInteraction({
        userId: user.id,
        songId,
        type: 'play',
        metadata
      })
    } catch (err) {
      handleError(err, 'record play')
    }
  }, [user, handleError])

  const recordLike = useCallback(async (songId: string): Promise<void> => {
    if (!user) return
    
    try {
      await UserInteractionService.recordInteraction({
        userId: user.id,
        songId,
        type: 'like'
      })
    } catch (err) {
      handleError(err, 'record like')
    }
  }, [user, handleError])

  return {
    loading,
    error,
    getTrendingSongs,
    getNewReleases,
    getUserSongs,
    searchSongs,
    getSongsByGenre,
    getSongById,
    getUserFavorites,
    getUserRecentlyPlayed,
    getPopularGenres,
    toggleFavorite,
    recordPlay,
    recordLike
  }
}
