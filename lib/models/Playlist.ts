import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IPlaylist extends Document {
  _id: string
  name: string
  description?: string
  creatorId: string // Supabase user ID
  creatorUsername: string
  songIds: string[] // Array of MongoDB song IDs
  isPublic: boolean
  tags: string[]
  coverImageFileId?: string // Reference to Supabase storage
  
  // Engagement metrics
  followersCount: number
  playsCount: number
  
  // Timestamps
  createdAt: Date
  updatedAt: Date
}

const PlaylistSchema = new Schema<IPlaylist>({
  name: { type: String, required: true, index: true },
  description: { type: String },
  creatorId: { type: String, required: true, index: true },
  creatorUsername: { type: String, required: true },
  songIds: [{ type: String, index: true }],
  isPublic: { type: Boolean, default: true, index: true },
  tags: [{ type: String, index: true }],
  coverImageFileId: { type: String },
  
  // Engagement metrics
  followersCount: { type: Number, default: 0 },
  playsCount: { type: Number, default: 0 },
}, {
  timestamps: true,
  collection: 'playlists'
})

// Indexes for better query performance
PlaylistSchema.index({ name: 'text', description: 'text', tags: 'text' })
PlaylistSchema.index({ createdAt: -1 })
PlaylistSchema.index({ isPublic: 1, followersCount: -1 })
PlaylistSchema.index({ creatorId: 1, createdAt: -1 })

const Playlist: Model<IPlaylist> = mongoose.models?.Playlist || 
  mongoose.model<IPlaylist>('Playlist', PlaylistSchema)

export default Playlist
