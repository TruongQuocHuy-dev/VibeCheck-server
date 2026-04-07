const { Server } = require('socket.io');
const { User, Conversation } = require('../models');

let io;
const activeConnections = new Map(); // userId -> Set of socketIds

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
    
    if (userId) {
      console.log(`🔌 Socket connected: ${socket.id} (userId: ${userId})`);
      
      // Each user joins a room identified by their userId
      socket.join(`user:${userId}`);
      
      // Track connections for this user
      if (!activeConnections.has(userId)) {
        activeConnections.set(userId, new Set());
      }
      activeConnections.get(userId).add(socket.id);

      // Only set online if this is the first connection
      if (activeConnections.get(userId).size === 1) {
        setImmediate(async () => {
          try {
            await User.findByIdAndUpdate(userId, { isOnline: true });
            notifyMatchesStatus(userId, true, new Date());
          } catch (error) {
            console.error('Socket init error:', error);
          }
        });
      }
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
      if (userId) {
        console.log(`❌ Socket disconnected: ${socket.id} (userId: ${userId})`);
        
        const connections = activeConnections.get(userId);
        if (connections) {
          connections.delete(socket.id);
          
          // Only set offline if no more active connections
          if (connections.size === 0) {
            activeConnections.delete(userId);
            try {
              const now = new Date();
              await User.findByIdAndUpdate(userId, { isOnline: false, lastActive: now });
              notifyMatchesStatus(userId, false, now);
            } catch (error) {
              console.error('Socket disconnect error:', error);
            }
          } else {
            console.log(`ℹ️ User ${userId} still has ${connections.size} active connection(s).`);
          }
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

/**
 * Notifies all users who have matched with `userId` about their new status.
 */
const notifyMatchesStatus = async (userId, isOnline, lastActive) => {
  if (!io) return;
  try {
    // 1. Fetch user data (blocked list and privacy)
    const user = await User.findById(userId).select('blockedUsers privacySettings');
    if (!user) return;

    // Privacy Check: If showOnlineStatus is disabled, we don't broadcast "Active"
    // EXCEPT if we are manually triggerring a hide (isOnline === undefined)
    const isPrivacyEnabled = user.privacySettings?.showOnlineStatus === false;
    
    if (isPrivacyEnabled && isOnline !== undefined) {
      // If privacy is on, we don't send regular "online/offline" updates
      return; 
    }

    const conversations = await Conversation.find({ participants: userId }).select('participants');
    
    // Get unique participant IDs (excluding the user themselves)
    const matchIds = new Set();
    conversations.forEach((conv) => {
      conv.participants.forEach((pId) => {
        if (pId && pId.toString() !== userId.toString()) {
          matchIds.add(pId.toString());
        }
      });
    });

    const myBlocked = new Set(user.blockedUsers?.map(id => id.toString()) || []);
    const matchIdArray = Array.from(matchIds);
    if (matchIdArray.length === 0) return;

    // Batch fetch all matches to check blocked status
    const matchesData = await User.find({ _id: { $in: matchIdArray } })
      .select('_id blockedUsers')
      .lean();

    for (const targetUser of matchesData) {
      if (!targetUser) continue;

      const amIBlocked = targetUser.blockedUsers?.some((id) => id.toString() === userId.toString());
      if (amIBlocked) continue;

      io.to(`user:${targetUser._id}`).emit('status_update', {
        userId,
        isOnline: isPrivacyEnabled ? undefined : isOnline,
        lastActive: isPrivacyEnabled ? undefined : lastActive,
      });
    }
  } catch (error) {
    console.error('notifyMatchesStatus error:', error);
  }
};

module.exports = { initSocket, getIO, notifyMatchesStatus };
