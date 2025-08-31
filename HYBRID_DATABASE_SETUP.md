# Hybrid Database Setup Guide

This guide explains how to set up and use the hybrid MongoDB + Supabase database architecture for the Riddimz Karaoke application.

## Architecture Overview

### Supabase (PostgreSQL + Storage)
- **User authentication and profiles**
- **File storage** (audio files, lyrics, cover art)
- **Real-time features** (karaoke rooms, chat, live sessions)
- **User sessions and permissions**

### MongoDB
- **Song metadata** (title, artist, duration, genre, tags, etc.)
- **User interactions** (plays, likes, favorites, shares)
- **Analytics and trending data**
- **Search and discovery data**
- **Playlists and collections**

## Setup Instructions

### 1. MongoDB Setup

#### Option A: Local MongoDB
```bash
# Install MongoDB locally
# macOS
brew install mongodb-community

# Ubuntu
sudo apt-get install mongodb

# Start MongoDB
mongod --dbpath /path/to/your/db
```

#### Option B: MongoDB Atlas (Recommended)
1. Create account at [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a new cluster
3. Get connection string
4. Add to `.env.local`

### 2. Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```env
# MongoDB
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/riddimz_karaoke

# Supabase (existing)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Other existing vars...
```

### 3. Install Dependencies

```bash
npm install mongodb mongoose
```

### 4. Database Migration

The application will automatically create MongoDB collections and indexes on first run. No manual migration needed.

## Data Flow

### Song Upload Process
1. **File Upload**: Audio/lyrics/cover → Supabase Storage
2. **Metadata Storage**: Song details → MongoDB
3. **Reference Linking**: MongoDB stores Supabase file IDs

### Song Retrieval Process
1. **Query MongoDB**: Get song metadata and file references
2. **Generate URLs**: Convert Supabase file IDs to public URLs
3. **Return Combined Data**: Metadata + file URLs

### User Interactions
1. **Play/Like/Favorite**: Recorded in MongoDB
2. **Analytics Update**: Automatic trending score calculation
3. **Real-time Updates**: Via Supabase for live features

## API Endpoints

### Songs
- `GET /api/songs/hybrid?type=trending` - Get trending songs
- `GET /api/songs/hybrid?type=new` - Get new releases
- `GET /api/songs/hybrid?type=search&q=query` - Search songs
- `POST /api/songs/hybrid` - Create new song

### Interactions
- `POST /api/interactions` - Record user interaction
- `GET /api/interactions?type=favorites` - Get user favorites
- `DELETE /api/interactions?songId=id&type=favorite` - Remove favorite

### Genres
- `GET /api/genres` - Get popular genres

## Database Models

### MongoDB Collections

#### Songs
```typescript
{
  _id: ObjectId,
  title: string,
  artist: string,
  duration: number,
  genre?: string,
  audioFileId: string, // Supabase file reference
  lyricsFileId?: string,
  coverArtFileId?: string,
  uploaderId: string, // Supabase user ID
  uploaderUsername: string,
  playCount: number,
  likesCount: number,
  trendingScore: number,
  tags: string[],
  createdAt: Date,
  updatedAt: Date
}
```

#### User Interactions
```typescript
{
  _id: ObjectId,
  userId: string, // Supabase user ID
  songId: string, // MongoDB song ID
  type: 'play' | 'like' | 'favorite' | 'share',
  timestamp: Date,
  metadata?: {
    playDuration?: number,
    deviceType?: string
  }
}
```

### Supabase Tables (Existing)
- `users` - User profiles and authentication
- `karaoke_rooms` - Live karaoke sessions
- `room_participants` - Room membership
- Storage buckets: `karaoke-songs`, `karaoke-tracks`

## Usage Examples

### Using the useSongs Hook
```typescript
const {
  getTrendingSongs,
  getUserFavorites,
  toggleFavorite,
  recordPlay,
  loading
} = useSongs()

// Get trending songs
const songs = await getTrendingSongs(20)

// Toggle favorite
await toggleFavorite(songId)

// Record play
await recordPlay(songId, { deviceType: 'web' })
```

### Direct Database Operations
```typescript
import { SongService, UserInteractionService } from '@/lib/database'

// Create song
const song = await SongService.createSong({
  title: 'My Song',
  artist: 'Artist Name',
  audioFileId: 'supabase-file-id',
  uploaderId: 'user-id'
})

// Record interaction
await UserInteractionService.recordInteraction({
  userId: 'user-id',
  songId: song._id,
  type: 'play'
})
```

## Benefits of Hybrid Architecture

1. **Scalability**: MongoDB handles high-volume analytics and search
2. **Real-time**: Supabase provides real-time features for live sessions
3. **File Management**: Supabase Storage for efficient file handling
4. **Authentication**: Supabase Auth with RLS policies
5. **Flexibility**: MongoDB for complex queries and aggregations
6. **Cost Efficiency**: Optimized data storage and retrieval

## Monitoring and Maintenance

### MongoDB Indexes
The application automatically creates these indexes:
- Text search on title, artist, tags
- Trending score + creation date
- User ID + interaction type
- Genre-based queries

### Performance Optimization
- Use MongoDB aggregation pipelines for complex analytics
- Implement caching for frequently accessed data
- Monitor query performance with MongoDB Compass
- Use Supabase Edge Functions for heavy computations

## Troubleshooting

### Common Issues

1. **Connection Errors**
   - Check MongoDB URI format
   - Verify network access (Atlas IP whitelist)
   - Ensure MongoDB service is running

2. **File URL Issues**
   - Verify Supabase storage bucket policies
   - Check file ID references in MongoDB
   - Ensure proper CORS configuration

3. **Sync Issues**
   - Monitor failed interactions
   - Implement retry mechanisms
   - Check user authentication state

### Debugging
```typescript
// Enable MongoDB debugging
mongoose.set('debug', true)

// Check connection status
import { connectToMongoDB } from '@/lib/database'
await connectToMongoDB()
```
