import mongoose from 'mongoose'
import { getDatabase } from './mongodb'
import Song, { ISong } from './models/Song'
import UserInteraction, { IUserInteraction } from './models/UserInteraction'
import Playlist, { IPlaylist } from './models/Playlist'
import { supabase } from './supabase'

// MongoDB connection
let isConnected = false

export async function connectToMongoDB() {
  if (isConnected) return

  try {
    await mongoose.connect(process.env.MONGODB_URI!)
    isConnected = true
    console.log('Connected to MongoDB')
  } catch (error) {
    console.error('MongoDB connection error:', error)
    throw error
  }
}

// Song operations
export class SongService {
  static async createSong(songData: Partial<ISong>): Promise<ISong> {
    await connectToMongoDB()
    const song = new Song(songData)
    return await song.save()
  }

  static async getSongById(id: string): Promise<ISong | null> {
    await connectToMongoDB()
    return await Song.findById(id)
  }

  static async getSongsByUser(userId: string, limit = 20, offset = 0): Promise<ISong[]> {
    await connectToMongoDB()
    return await Song.find({ uploaderId: userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset)
  }

  static async getTrendingSongs(limit = 20): Promise<ISong[]> {
    await connectToMongoDB()
    return await Song.find()
      .sort({ trendingScore: -1, createdAt: -1 })
      .limit(limit)
  }

  static async getNewReleases(limit = 20): Promise<ISong[]> {
    await connectToMongoDB()
    return await Song.find()
      .sort({ createdAt: -1 })
      .limit(limit)
  }

  static async searchSongs(query: string, filters?: {
    genre?: string
    mood?: string
    tempo?: string
    difficulty?: string
  }, limit = 20): Promise<ISong[]> {
    await connectToMongoDB()
    
    const searchQuery: any = {
      $text: { $search: query }
    }

    if (filters) {
      if (filters.genre) searchQuery.genre = filters.genre
      if (filters.mood) searchQuery.mood = filters.mood
      if (filters.tempo) searchQuery.tempo = filters.tempo
      if (filters.difficulty) searchQuery.difficulty = filters.difficulty
    }

    return await Song.find(searchQuery)
      .sort({ score: { $meta: 'textScore' }, trendingScore: -1 })
      .limit(limit)
  }

  static async updateSongMetrics(songId: string, updates: {
    playCount?: number
    likesCount?: number
    favoritesCount?: number
  }): Promise<ISong | null> {
    await connectToMongoDB()
    return await Song.findByIdAndUpdate(
      songId,
      { $inc: updates },
      { new: true }
    )
  }

  static async deleteSong(songId: string, userId: string): Promise<boolean> {
    await connectToMongoDB()
    const result = await Song.deleteOne({ _id: songId, uploaderId: userId })
    return result.deletedCount > 0
  }

  static async getSongsByGenre(genre: string, limit = 20): Promise<ISong[]> {
    await connectToMongoDB()
    return await Song.find({ genre })
      .sort({ trendingScore: -1 })
      .limit(limit)
  }

  static async getPopularGenres(): Promise<Array<{ genre: string; count: number }>> {
    await connectToMongoDB()
    return await Song.aggregate([
      { $match: { genre: { $exists: true, $ne: null } } },
      { $group: { _id: '$genre', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $project: { genre: '$_id', count: 1, _id: 0 } }
    ])
  }
}

// User interaction operations
export class UserInteractionService {
  static async recordInteraction(interaction: Partial<IUserInteraction>): Promise<IUserInteraction> {
    await connectToMongoDB()
    const userInteraction = new UserInteraction(interaction)
    const saved = await userInteraction.save()

    // Update song metrics based on interaction type
    if (interaction.type === 'play') {
      await SongService.updateSongMetrics(interaction.songId!, { playCount: 1 })
    } else if (interaction.type === 'like') {
      await SongService.updateSongMetrics(interaction.songId!, { likesCount: 1 })
    } else if (interaction.type === 'favorite') {
      await SongService.updateSongMetrics(interaction.songId!, { favoritesCount: 1 })
    }

    return saved
  }

  static async getUserFavorites(userId: string, limit = 20): Promise<ISong[]> {
    await connectToMongoDB()
    
    const favoriteInteractions = await UserInteraction.find({
      userId,
      type: 'favorite'
    }).sort({ timestamp: -1 }).limit(limit)

    const songIds = favoriteInteractions.map(interaction => interaction.songId)
    return await Song.find({ _id: { $in: songIds } })
  }

  static async getUserRecentlyPlayed(userId: string, limit = 20): Promise<ISong[]> {
    await connectToMongoDB()
    
    const playInteractions = await UserInteraction.find({
      userId,
      type: 'play'
    }).sort({ timestamp: -1 }).limit(limit)

    const songIds = [...new Set(playInteractions.map(interaction => interaction.songId))]
    const songs = await Song.find({ _id: { $in: songIds } })
    
    // Sort songs by most recent play
    return songs.sort((a, b) => {
      const aIndex = songIds.indexOf(a._id.toString())
      const bIndex = songIds.indexOf(b._id.toString())
      return aIndex - bIndex
    })
  }

  static async removeFavorite(userId: string, songId: string): Promise<boolean> {
    await connectToMongoDB()
    const result = await UserInteraction.deleteOne({
      userId,
      songId,
      type: 'favorite'
    })
    
    if (result.deletedCount > 0) {
      await SongService.updateSongMetrics(songId, { favoritesCount: -1 })
      return true
    }
    return false
  }

  static async isUserFavorite(userId: string, songId: string): Promise<boolean> {
    await connectToMongoDB()
    const interaction = await UserInteraction.findOne({
      userId,
      songId,
      type: 'favorite'
    })
    return !!interaction
  }
}

// Playlist operations
export class PlaylistService {
  static async createPlaylist(playlistData: Partial<IPlaylist>): Promise<IPlaylist> {
    await connectToMongoDB()
    const playlist = new Playlist(playlistData)
    return await playlist.save()
  }

  static async getPlaylistById(id: string): Promise<IPlaylist | null> {
    await connectToMongoDB()
    return await Playlist.findById(id)
  }

  static async getUserPlaylists(userId: string): Promise<IPlaylist[]> {
    await connectToMongoDB()
    return await Playlist.find({ creatorId: userId })
      .sort({ createdAt: -1 })
  }

  static async getPublicPlaylists(limit = 20): Promise<IPlaylist[]> {
    await connectToMongoDB()
    return await Playlist.find({ isPublic: true })
      .sort({ followersCount: -1, createdAt: -1 })
      .limit(limit)
  }

  static async addSongToPlaylist(playlistId: string, songId: string, userId: string): Promise<IPlaylist | null> {
    await connectToMongoDB()
    return await Playlist.findOneAndUpdate(
      { _id: playlistId, creatorId: userId },
      { $addToSet: { songIds: songId } },
      { new: true }
    )
  }

  static async removeSongFromPlaylist(playlistId: string, songId: string, userId: string): Promise<IPlaylist | null> {
    await connectToMongoDB()
    return await Playlist.findOneAndUpdate(
      { _id: playlistId, creatorId: userId },
      { $pull: { songIds: songId } },
      { new: true }
    )
  }
}

// Hybrid operations that combine MongoDB and Supabase
export class HybridService {
  // Get song with file URLs from Supabase
  static async getSongWithUrls(songId: string): Promise<(ISong & { audioUrl?: string; lyricsUrl?: string; coverArtUrl?: string }) | null> {
    const song = await SongService.getSongById(songId)
    if (!song) return null

    const songWithUrls = song.toObject() as any

    // Get file URLs from Supabase storage
    if (song.audioFileId) {
      const { data } = supabase.storage
        .from('karaoke-songs')
        .getPublicUrl(song.audioFileId)
      songWithUrls.audioUrl = data.publicUrl
    }

    if (song.lyricsFileId) {
      const { data } = supabase.storage
        .from('karaoke-songs')
        .getPublicUrl(song.lyricsFileId)
      songWithUrls.lyricsUrl = data.publicUrl
    }

    if (song.coverArtFileId) {
      const { data } = supabase.storage
        .from('karaoke-songs')
        .getPublicUrl(song.coverArtFileId)
      songWithUrls.coverArtUrl = data.publicUrl
    }

    return songWithUrls
  }

  // Get multiple songs with URLs
  static async getSongsWithUrls(songs: ISong[]): Promise<Array<ISong & { audioUrl?: string; lyricsUrl?: string; coverArtUrl?: string }>> {
    return Promise.all(
      songs.map(async (song) => {
        const songWithUrls = song.toObject() as any

        if (song.audioFileId) {
          const { data } = supabase.storage
            .from('karaoke-songs')
            .getPublicUrl(song.audioFileId)
          songWithUrls.audioUrl = data.publicUrl
        }

        if (song.lyricsFileId) {
          const { data } = supabase.storage
            .from('karaoke-songs')
            .getPublicUrl(song.lyricsFileId)
          songWithUrls.lyricsUrl = data.publicUrl
        }

        if (song.coverArtFileId) {
          const { data } = supabase.storage
            .from('karaoke-songs')
            .getPublicUrl(song.coverArtFileId)
          songWithUrls.coverArtUrl = data.publicUrl
        }

        return songWithUrls
      })
    )
  }
}
