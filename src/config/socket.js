const { Server } = require('socket.io');

let io;

/**
 * Initialize Socket.io and attach to HTTP server.
 * @param {import('http').Server} httpServer
 */
const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    const userId = socket.handshake.query.userId;
    console.log(`🔌 Socket connected: ${socket.id} (userId: ${userId})`);

    if (userId) {
      // Each user joins a room identified by their userId
      socket.join(`user:${userId}`);
    }

    // Join a specific conversation room
    socket.on('join_conversation', (conversationId) => {
      socket.join(`conversation:${conversationId}`);
      console.log(`📥 ${userId} joined conversation:${conversationId}`);
    });

    // Leave a conversation room
    socket.on('leave_conversation', (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
    });

    socket.on('disconnect', () => {
      console.log(`❌ Socket disconnected: ${socket.id} (userId: ${userId})`);
    });
  });

  return io;
};

/**
 * Get the initialized Socket.io instance.
 */
const getIO = () => {
  if (!io) throw new Error('Socket.io not initialized.');
  return io;
};

module.exports = { initSocket, getIO };
