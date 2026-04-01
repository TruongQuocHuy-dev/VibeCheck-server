const { Server } = require('socket.io');
const { User, Conversation } = require('../models');

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
      
      // Setup online status
      setImmediate(async () => {
        try {
          await User.findByIdAndUpdate(userId, { isOnline: true });
          notifyMatchesStatus(userId, true, new Date());
        } catch (error) {
          console.error('Socket init error:', error);
        }
      });
    }

    // Join a specific conversation room
    socket.on('join_conversation', (conversationId) => {
      socket.join(`conversation:${conversationId}`);
      console.log(`📥 ${userId} joined conversation:${conversationId}`);
    });

    // Typing indicators
    socket.on('typing', (conversationId) => {
      socket.to(`conversation:${conversationId}`).emit('user_typing', {
        conversationId,
        userId,
      });
    });

    socket.on('stop_typing', (conversationId) => {
      socket.to(`conversation:${conversationId}`).emit('user_stop_typing', {
        conversationId,
        userId,
      });
    });

    // Leave a conversation room
    socket.on('leave_conversation', (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
    });

    socket.on('disconnect', async () => {
      console.log(`❌ Socket disconnected: ${socket.id} (userId: ${userId})`);
      if (userId) {
        try {
          const now = new Date();
          await User.findByIdAndUpdate(userId, { isOnline: false, lastActive: now });
          notifyMatchesStatus(userId, false, now);
        } catch (error) {
          console.error('Socket disconnect error:', error);
        }
      }
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

/**
 * Notifies all users who have matched with `userId` about their new status.
 */
const notifyMatchesStatus = async (userId, isOnline, lastActive) => {
  if (!io) return;
  try {
    const conversations = await Conversation.find({ participants: userId }).select('participants');
    
    // Get unique participant IDs (excluding the user themselves)
    const matchIds = new Set();
    conversations.forEach((conv) => {
      conv.participants.forEach((pId) => {
        if (pId.toString() !== userId) {
          matchIds.add(pId.toString());
        }
      });
    });

    matchIds.forEach((matchId) => {
      io.to(`user:${matchId}`).emit('status_update', {
        userId,
        isOnline,
        lastActive,
      });
    });
  } catch (err) {
    console.error('Notify matches status error:', err);
  }
};
