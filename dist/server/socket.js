import { Server } from 'socket.io';
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
// Load environment variables
config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Get the project root directory (two levels up from the server directory)
const projectRoot = join(__dirname, '..');
const dev = process.env.NODE_ENV !== 'production';
const app = next({
    dev,
    dir: projectRoot,
    conf: {
        distDir: join(projectRoot, '.next'),
        experimental: {
            serverComponentsExternalPackages: ['socket.io']
        }
    }
});
const handle = app.getRequestHandler();
// Initialize Next.js app
app.prepare().then(() => {
    const server = createServer((req, res) => {
        const parsedUrl = parse(req.url, true);
        handle(req, res, parsedUrl);
    });
    const io = new Server(server, {
        cors: {
            origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
            methods: ['GET', 'POST']
        }
    });
    // Store active rooms and their participants
    const rooms = new Map();
    io.on('connection', (socket) => {
        console.log('Client connected:', socket.id);
        // Join room
        socket.on('join-room', (roomId, userId, isHost) => {
            socket.join(roomId);
            if (!rooms.has(roomId)) {
                rooms.set(roomId, new Set());
            }
            rooms.get(roomId).add({ userId, isHost });
            // Notify others in the room
            socket.to(roomId).emit('user-joined', userId, isHost);
            // Send list of current participants to the new user
            const participants = Array.from(rooms.get(roomId))
                .filter(p => p.userId !== userId)
                .map(p => p.userId);
            socket.emit('room-participants', participants);
        });
        // WebRTC signaling
        socket.on('offer', (roomId, userId, offer) => {
            socket.to(roomId).emit('offer', userId, offer);
        });
        socket.on('answer', (roomId, userId, answer) => {
            socket.to(roomId).emit('answer', userId, answer);
        });
        socket.on('ice-candidate', (roomId, userId, candidate) => {
            socket.to(roomId).emit('ice-candidate', userId, candidate);
        });
        // Room synchronization
        socket.on('sync-time', (roomId, currentTime) => {
            socket.to(roomId).emit('sync-time', currentTime);
        });
        socket.on('sync-lyrics', (roomId, currentLyric) => {
            socket.to(roomId).emit('sync-lyrics', currentLyric);
        });
        // Leave room
        socket.on('leave-room', (roomId, userId) => {
            socket.leave(roomId);
            const roomParticipants = rooms.get(roomId);
            if (roomParticipants) {
                roomParticipants.forEach(participant => {
                    if (participant.userId === userId) {
                        roomParticipants.delete(participant);
                    }
                });
            }
            socket.to(roomId).emit('user-left', userId);
        });
        // Disconnect
        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
            // Clean up rooms
            rooms.forEach((participants, roomId) => {
                participants.forEach(participant => {
                    if (participant.userId === socket.id) {
                        participants.delete(participant);
                        socket.to(roomId).emit('user-left', socket.id);
                    }
                });
            });
        });
    });
    const PORT = process.env.PORT || 3001;
    server.listen(PORT, () => {
        console.log(`> Ready on http://localhost:${PORT}`);
    });
});
