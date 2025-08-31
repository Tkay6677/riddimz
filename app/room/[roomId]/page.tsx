'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useKaraokeRoom } from '@/hooks/useKaraokeRoom';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function KaraokeRoom() {
  const { roomId } = useParams();
  const { user } = useAuth();
  const {
    room,
    loading,
    error: roomError,
    currentTime,
    currentLyric,
    nextLyrics,
    joinRoom,
    leaveRoom,
    togglePlayback
  } = useKaraokeRoom();

  const isHost = user?.id === room?.host_id;
  const {
    startStreaming,
    stopStreaming,
    isStreaming,
    error: streamError
  } = useWebRTC(roomId as string, user?.id || '', isHost);

  useEffect(() => {
    if (roomId && user) {
      joinRoom(roomId as string);
    }
    return () => {
      if (roomId) {
        leaveRoom(roomId as string);
      }
    };
  }, [roomId, user]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (roomError || streamError) {
    return <div>Error: {roomError || streamError}</div>;
  }

  if (!room) {
    return <div>Room not found</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <Card className="p-6">
        <h1 className="text-2xl font-bold mb-4">{room.name}</h1>
        
        {/* Host controls */}
        {isHost && (
          <div className="mb-4">
            <Button
              onClick={isStreaming ? stopStreaming : startStreaming}
              variant={isStreaming ? 'destructive' : 'default'}
            >
              {isStreaming ? 'Stop Streaming' : 'Start Streaming'}
            </Button>
          </div>
        )}

        {/* Lyrics display */}
        <div className="mb-4">
          <div className="text-xl font-bold mb-2">{currentLyric}</div>
          <div className="text-gray-600">
            {nextLyrics.map((lyric, index) => (
              <div key={index}>{lyric}</div>
            ))}
          </div>
        </div>

        {/* Playback controls */}
        <div className="mb-4">
          <Button onClick={togglePlayback}>
            {room.status === 'active' ? 'Pause' : 'Play'}
          </Button>
        </div>

        {/* Room info */}
        <div className="text-sm text-gray-500">
          <p>Host: {room.host.username}</p>
          <p>Participants: {room.participants.length}</p>
          <p>Status: {room.status}</p>
        </div>
      </Card>
    </div>
  );
} 