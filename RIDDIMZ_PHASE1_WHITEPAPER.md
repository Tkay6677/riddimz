# Riddimz: Web3 Karaoke App – Phase 1 Whitepaper

## 1. Introduction

**Riddimz** is a decentralized, community-driven karaoke platform leveraging Web3 technologies. Phase 1 focuses on core karaoke experiences, real-time collaboration, and user-generated content, with a foundation for future blockchain integrations.

---

## 2. System Overview

### 2.1. Core Features

- **User Authentication & Profiles**
  - Email/password and OAuth login via Supabase Auth.
  - User profiles with avatars, usernames, and performance history.
  - Profile management: update username, avatar, and view stats (followers, following, performances).

- **Karaoke Rooms**
  - Users can create, join, and manage karaoke rooms.
  - Room types: public, private (with password), and quick karaoke (solo/practice).
  - Host/participant roles with real-time status (waiting, active, ended).
  - Room metadata: name, description, host, participants, current song, and status.

- **Song Management**
  - Upload original or karaoke tracks (audio + LRC lyrics).
  - Songs stored in Supabase Storage buckets (`karaoke-songs`, `karaoke-tracks`).
  - Song metadata: title, artist, duration, cover art, uploader.
  - Lyrics synchronization using LRC format.

- **Real-Time Karaoke Experience**
  - WebRTC-based audio streaming (host streams mixed mic + karaoke audio).
  - Participants receive synchronized audio and lyrics.
  - Real-time chat, reactions, and permission requests (e.g., request to sing).
  - Audio mixing: host's mic and karaoke track combined in-browser.

- **Quick Karaoke Mode**
  - Solo practice mode with recording and playback.
  - Local audio mixing and recording using MediaRecorder API.

---

## 3. Technical Architecture

### 3.1. Frontend

- **Framework:** Next.js (React)
- **State Management:** React hooks, context providers
- **UI:** Tailwind CSS, custom and reusable UI components

### 3.2. Backend

- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **Storage:** Supabase Storage (audio, lyrics, cover art)
- **APIs:** RESTful endpoints for room, song, and profile management

### 3.3. Real-Time & Streaming

- **WebRTC:** Audio streaming via `@stream-io/video-react-sdk`
- **Socket.IO:** Real-time chat, reactions, and playback synchronization
- **Audio Mixing:** Web Audio API for combining mic and karaoke track

---

## 4. Data Model

### 4.1. Users & Profiles

- `profiles`: id, username, avatar_url, created_at, updated_at
- `users`: (Supabase Auth) id, email, password, metadata

### 4.2. Songs & Tracks

- `songs`: id, title, artist, duration, audio_url, cover_art_url, user_id, created_at
- `karaoke_tracks`: id, song_id, instrumental_url, lyrics_data, created_at

### 4.3. Karaoke Rooms

- `karaoke_rooms`: id, name, host_id, is_private, password, max_participants, current_track_id, status, created_at
- `room_participants`: room_id, user_id, joined_at, role

### 4.4. Queue & Performances

- `queue_items`: id, room_id, track_id, user_id, position, status, created_at
- `karaoke_performances`: id, user_id, song_id, room_id, duration, created_at

---

## 5. Security & Access Control

- **Row Level Security (RLS):** Enforced on all tables (profiles, songs, rooms, participants, queue).
- **Storage Policies:** Only authenticated users can upload; public can read songs/tracks.
- **Protected Routes:** Middleware redirects unauthenticated users from protected pages.

---

## 6. Web3/Blockchain Integration (Phase 1)

- **Foundational Hooks:** Placeholder for Solana wallet connection and tipping (not yet fully implemented).
- **Future-Ready:** Data model and UI prepared for on-chain tipping, NFT rewards, and decentralized identity.

---

## 7. User Flows

### 7.1. Onboarding

1. User signs up/logs in.
2. Sets up profile (username, avatar).

### 7.2. Song Upload

1. User uploads audio, cover art, and lyrics.
2. Song stored in Supabase; metadata saved in DB.

### 7.3. Room Creation & Participation

1. User creates or joins a room.
2. Host starts streaming; participants join in listen-only mode.
3. Real-time lyrics, chat, and reactions.
4. Option to request permission to sing.

### 7.4. Quick Karaoke

1. User selects a song from the public bucket.
2. Practices and records performance locally.

---

## 8. Limitations & Future Work

- **Web3 Features:** Tipping, NFT rewards, and on-chain room management are planned for future phases.
- **Video Streaming:** Currently audio-only; video support is a future enhancement.
- **Moderation:** Basic; advanced moderation and reporting to be added.
- **Mobile Optimization:** Responsive, but further mobile UX improvements are planned.

---

## 9. Conclusion

Phase 1 of Riddimz delivers a robust, real-time karaoke experience with decentralized storage and authentication. The architecture is designed for extensibility, enabling seamless integration of advanced Web3 features in future phases.

---

## 10. Appendix

- **Tech Stack:** Next.js, Supabase, WebRTC, Socket.IO, Tailwind CSS
- **Key Dependencies:** `@stream-io/video-react-sdk`, `supabase-js`, `socket.io-client`
- **Storage Buckets:** `karaoke-songs`, `karaoke-tracks`, `covers`, `lyrics`

---

**Prepared by:**  
Riddimz Development Team  
*For internal and partner use. Not for public distribution without consent.* 