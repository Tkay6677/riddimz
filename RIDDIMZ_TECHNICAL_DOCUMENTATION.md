# Riddimz: Technical Documentation

## Executive Summary

Riddimz is a modern web application that combines music streaming with interactive karaoke features. Built on Next.js and leveraging Supabase for backend services, the platform offers users a seamless experience for discovering music, participating in karaoke sessions, and building community around shared musical interests.

## System Architecture

### Frontend Architecture
- **Framework**: Next.js with React
- **Styling**: Tailwind CSS with shadcn/ui component library
- **State Management**: React Context API and custom hooks
- **Routing**: Next.js App Router

### Backend Services
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage for audio files and images
- **Real-time Features**: WebRTC for karaoke sessions

### API Structure
The application uses a combination of:
- Server-side API routes for secure operations
- Client-side Supabase queries for real-time data
- WebRTC for peer-to-peer audio streaming

## Core Features

### Authentication & User Management

The authentication system provides secure user registration and login:

```typescript
// Authentication hook example
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, loading };
}
```

### Music Discovery & Playback

Users can discover music through:
- Curated playlists
- Genre-based browsing
- Trending and popular tracks
- Search functionality

The music player supports:
- Continuous playback across page navigation
- Queue management
- Basic playback controls (play, pause, skip, volume)

### Karaoke Feature

The karaoke system is a standout feature with several components:

1. **Room Management**:
   - Creation of public and private rooms
   - Room discovery and joining
   - Host controls for managing participants

2. **Song Selection**:
   - Browsing available karaoke tracks
   - Queue management for performances
   - Support for lyrics in LRC format

3. **Real-time Audio Processing**:
   - Microphone input capture and processing
   - Audio mixing of vocals with backing tracks
   - Synchronized playback across participants

4. **Performance Tracking**:
   - Recording of performances
   - Scoring system based on pitch and timing
   - Performance history and statistics

## Database Schema

The application uses a relational database with the following key tables:

1. **users**: Core user information and authentication
2. **user_profile**: Extended user profile data
3. **songs**: Music track metadata and storage references
4. **karaoke_rooms**: Information about active and past karaoke sessions
5. **room_participants**: Junction table tracking users in rooms
6. **karaoke_tracks**: Karaoke-specific track information including lyrics
7. **user_interactions**: Tracks user engagement with content

## Technical Implementation Details

### Authentication Flow

The application implements a standard authentication flow:
1. User enters credentials or uses OAuth provider
2. On successful authentication, user is redirected to the discovery page
3. Protected routes check authentication status and redirect accordingly

### Karaoke Room Implementation

Karaoke rooms leverage WebRTC for real-time audio streaming:

```typescript
// Simplified example of WebRTC connection setup
function useWebRTC(roomId: string) {
  const [peers, setPeers] = useState<Record<string, RTCPeerConnection>>({});
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    // Initialize local media stream
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        setLocalStream(stream);
        // Join room and set up peer connections
        joinRoom(roomId, stream);
      })
      .catch((error) => {
        console.error("Error accessing microphone:", error);
      });

    return () => {
      // Clean up connections when leaving
      Object.values(peers).forEach((peer) => peer.close());
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [roomId]);

  // Additional WebRTC logic...
}
```

### Audio Processing

The application handles audio mixing for karaoke:

```typescript
// Audio mixing hook (simplified)
function useAudioMixing(microphoneStream: MediaStream | null, backingTrackUrl: string | null) {
  const [mixedOutput, setMixedOutput] = useState<MediaStream | null>(null);
  
  useEffect(() => {
    if (!microphoneStream || !backingTrackUrl) return;
    
    const audioContext = new AudioContext();
    const micSource = audioContext.createMediaStreamSource(microphoneStream);
    
    // Set up audio graph for mixing
    // ...

    return () => {
      audioContext.close();
    };
  }, [microphoneStream, backingTrackUrl]);

  return mixedOutput;
}
```

## User Interface

The application features a modern, responsive UI with:

1. **Navigation**: Sidebar for main navigation and header for context-specific actions
2. **Music Player**: Global player accessible throughout the application
3. **Karaoke Interface**: Specialized UI for karaoke sessions with lyrics display
4. **Responsive Design**: Adapts to different screen sizes and devices

## Security Considerations

1. **Authentication**: Secure token-based authentication via Supabase
2. **Data Access**: Row-level security policies in Supabase
3. **Content Storage**: Secure access controls for uploaded content
4. **API Protection**: Server-side validation for all operations

## Performance Optimizations

1. **Code Splitting**: Next.js automatic code splitting for faster page loads
2. **Image Optimization**: Next.js image optimization for efficient delivery
3. **Caching**: Strategic caching of API responses and static assets
4. **Lazy Loading**: Components and routes loaded on demand

## Future Development Roadmap

1. **Enhanced Social Features**: Following artists, sharing playlists
2. **Advanced Karaoke Features**: More sophisticated scoring, effects
3. **Mobile Applications**: Native mobile apps for iOS and Android
4. **Content Recommendations**: AI-powered music and karaoke recommendations
5. **Monetization**: Premium subscription features and virtual goods

## Conclusion

Riddimz represents a modern approach to music consumption and interaction, combining streaming with social and interactive elements. The karaoke feature in particular offers a unique selling proposition that differentiates the platform from traditional music streaming services.

The technical architecture provides a solid foundation for scaling and extending functionality while maintaining performance and security.