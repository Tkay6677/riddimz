import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IUserInteraction extends Document {
  userId: string // Supabase user ID
  songId: string // MongoDB song ID
  type: 'play' | 'like' | 'favorite' | 'share' | 'download'
  timestamp: Date
  metadata?: {
    playDuration?: number // For play events
    deviceType?: string
    location?: string
  }
}

const UserInteractionSchema = new Schema<IUserInteraction>({
  userId: { type: String, required: true, index: true },
  songId: { type: String, required: true, index: true },
  type: { 
    type: String, 
    required: true, 
    enum: ['play', 'like', 'favorite', 'share', 'download'],
    index: true 
  },
  timestamp: { type: Date, default: Date.now, index: true },
  metadata: {
    playDuration: Number,
    deviceType: String,
    location: String
  }
}, {
  collection: 'user_interactions'
})

// Compound indexes for efficient queries
UserInteractionSchema.index({ userId: 1, type: 1, timestamp: -1 })
UserInteractionSchema.index({ songId: 1, type: 1, timestamp: -1 })
UserInteractionSchema.index({ type: 1, timestamp: -1 })

const UserInteraction: Model<IUserInteraction> = mongoose.models?.UserInteraction || 
  mongoose.model<IUserInteraction>('UserInteraction', UserInteractionSchema)

export default UserInteraction
