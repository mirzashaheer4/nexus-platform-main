const { Server } = require('socket.io');
const cookie = require('cookie');
const jwt = require('jsonwebtoken');

/**
 * initVideoSignaling
 * Attaches Socket.IO to the provided HTTP server and sets up
 * all WebRTC signaling event handlers for video calls.
 * @param {http.Server} httpServer
 */
const initVideoSignaling = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL,
      credentials: true
    }
  });

  const videoNamespace = io.of('/video');

  videoNamespace.use((socket, next) => {
    try {
      // Primary: read from handshake.auth.token (client passes _st cookie value here)
      let token = socket.handshake.auth && socket.handshake.auth.token;

      // Fallback: parse from raw cookie header (withCredentials path)
      if (!token) {
        const rawCookies = socket.handshake.headers.cookie || '';
        const parsed = cookie.parse(rawCookies);
        token = parsed._st || parsed.accessToken;
      }

      if (!token) return next(new Error('Authentication error: no token'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error('Authentication error: invalid token'));
    }
  });

  // Track active rooms in memory: Map<roomId, Set<socketId>>
  const rooms = new Map();

  videoNamespace.on('connection', (socket) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Socket] Authenticated client connected to /video: ${socket.id} (User: ${socket.user.id || socket.user._id})`);
    }

    // Join room
    socket.on('join-room', (roomId, userId) => {
      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
      }
      const participants = rooms.get(roomId);

      if (participants.size >= 2) {
        socket.emit('room-full');
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[Socket] Room ${roomId} full. Socket ${socket.id} rejected.`);
        }
        return;
      }

      socket.join(roomId);
      participants.add(socket.id);

      if (process.env.NODE_ENV !== 'production') {
        console.log(`[Socket] User ${userId} joined room ${roomId}. Active in room: ${participants.size}`);
      }

      // Notify other peer in the room
      socket.to(roomId).emit('user-connected', socket.id);
    });

    // Forward SDP offer
    socket.on('offer', (offer, roomId) => {
      socket.to(roomId).emit('offer', offer, socket.id);
    });

    // Forward SDP answer
    socket.on('answer', (answer, roomId) => {
      socket.to(roomId).emit('answer', answer, socket.id);
    });

    // Forward ICE candidate
    socket.on('ice-candidate', (candidate, roomId) => {
      socket.to(roomId).emit('ice-candidate', candidate, socket.id);
    });

    // Leave room
    socket.on('leave-room', (roomId) => {
      socket.leave(roomId);
      const participants = rooms.get(roomId);
      if (participants) {
        participants.delete(socket.id);
        if (participants.size === 0) {
          rooms.delete(roomId);
        }
      }
      socket.to(roomId).emit('peer-disconnected', socket.id);
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[Socket] Socket ${socket.id} left room ${roomId}`);
      }
    });

    // Disconnect handler
    socket.on('disconnect', () => {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[Socket] Client disconnected: ${socket.id}`);
      }
      for (const [roomId, participants] of rooms.entries()) {
        if (participants.has(socket.id)) {
          participants.delete(socket.id);
          socket.to(roomId).emit('peer-disconnected', socket.id);
          if (participants.size === 0) {
            rooms.delete(roomId);
          }
          if (process.env.NODE_ENV !== 'production') {
            console.log(`[Socket] Cleaned up socket ${socket.id} from room ${roomId}`);
          }
        }
      }
    });
  });

  return io;
};

module.exports = { initVideoSignaling };
