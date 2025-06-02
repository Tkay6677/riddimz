import { Server } from 'socket.io';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const io = new Server({
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL,
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Join room
  socket.on('join_room', (roomId) => {
    socket.join(roomId);
    socket.to(roomId).emit('user_joined', socket.id);
  });

  // Leave room
  socket.on('leave_room', (roomId) => {
    socket.leave(roomId);
    socket.to(roomId).emit('user_left', socket.id);
  });

  // Start song
  socket.on('start_song', ({ roomId, trackId, startTime }) => {
    socket.to(roomId).emit('song_started', { trackId, startTime });
  });

  // Pause song
  socket.on('pause_song', ({ roomId, currentTime }) => {
    socket.to(roomId).emit('song_paused', { currentTime });
  });

  // Resume song
  socket.on('resume_song', ({ roomId, currentTime }) => {
    socket.to(roomId).emit('song_resumed', { currentTime });
  });

  // End song
  socket.on('end_song', (roomId) => {
    socket.to(roomId).emit('song_ended');
  });

  // Queue updated
  socket.on('queue_updated', (roomId) => {
    socket.to(roomId).emit('refresh_queue');
  });

  // Chat message
  socket.on('send_message', ({ roomId, message }) => {
    socket.to(roomId).emit('new_message', message);
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

export async function GET(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Attach the socket.io server to the HTTP server
    const res = new NextResponse();
    // @ts-ignore
    io.attach(res.socket.server);

    return res;
  } catch (error) {
    console.error('WebSocket error:', error);
    return NextResponse.json({ error: 'WebSocket connection failed' }, { status: 500 });
  }
}

export const runtime = 'nodejs'; 