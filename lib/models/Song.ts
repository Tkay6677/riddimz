import mongoose, { Schema, Document, Model } from 'mongoose'

export interface ISong extends Document {
  _id: string
  title: string
  artist: string
  duration: number
  genre?: string
  
  // Supabase file references
  audioFileId: string // Reference to Supabase storage file
  lyricsFileId?: string // Reference to Supabase storage file
  coverArtFileId?: string // Reference to Supabase storage file
  
  // User and metadata
  uploaderId: string // Supabase user ID
  uploaderUsername: string
  
  // Engagement metrics
  playCount: number
  likesCount: number
  favoritesCount: number
  trendingScore: number
  
  // Timestamps
  createdAt: Date
  updatedAt: Date
  
  // Additional metadata
  isNft: boolean
  tags: string[]
  description?: string
  language?: string
  mood?: string
  tempo?: 'slow' | 'medium' | 'fast'
  difficulty?: 'easy' | 'medium' | 'hard'
}

const SongSchema = new Schema<ISong>({
  title: { type: String, required: true, index: true },
  artist: { type: String, required: true, index: true },
  duration: { type: Number, required: true },
  genre: { type: String, index: true },
  
  // Supabase file references
  audioFileId: { type: String, required: true },
  lyricsFileId: { type: String },
  coverArtFileId: { type: String },
  
  // User and metadata
  uploaderId: { type: String, required: true, index: true },
  uploaderUsername: { type: String, required: true },
  
  // Engagement metrics
  playCount: { type: Number, default: 0, index: true },
  likesCount: { type: Number, default: 0, index: true },
  favoritesCount: { type: Number, default: 0 },
  trendingScore: { type: Number, default: 0, index: true },
  
  // Additional metadata
  isNft: { type: Boolean, default: false },
  tags: [{ type: String, index: true }],
  description: { type: String },
  language: { type: String, default: 'en' },
  mood: { type: String },
  tempo: { type: String, enum: ['slow', 'medium', 'fast'] },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'] }
}, {
  timestamps: true,
  collection: 'songs'
})

// Indexes for better query performance
SongSchema.index({ title: 'text', artist: 'text', tags: 'text' })
SongSchema.index({ createdAt: -1 })
SongSchema.index({ trendingScore: -1, createdAt: -1 })
SongSchema.index({ genre: 1, trendingScore: -1 })
SongSchema.index({ uploaderId: 1, createdAt: -1 })

// Update trending score before save
SongSchema.pre('save', function(next) {
  if (this.isModified('playCount') || this.isModified('likesCount') || this.isNew) {
    const daysSinceCreation = (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    const recencyFactor = Math.max(0, 1 - (daysSinceCreation / 30)) // Decay over 30 days
    
    this.trendingScore = (
      this.playCount * 0.5 + 
      this.likesCount * 0.3 + 
      this.favoritesCount * 0.2
    ) * recencyFactor
  }
  next()
})

// Prevent model re-compilation during development
const Song: Model<ISong> = mongoose.models?.Song || mongoose.model<ISong>('Song', SongSchema)

export default Song
