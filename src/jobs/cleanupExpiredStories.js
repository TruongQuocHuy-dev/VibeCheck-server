const cron = require('node-cron');
const { VibeStory } = require('../models');
const { deleteMedia } = require('../utils/deleteMedia');

/**
 * Cleanup expired stories every 5 minutes
 */
const initCleanupJob = (io) => {
  // Runs every 5 minutes: */5 * * * *
  cron.schedule('*/5 * * * *', async () => {
    console.log('[Cron] Checking for expired stories...');
    try {
      const now = new Date();
      
      // Find active stories that have expired
      const expiredStories = await VibeStory.find({
        expiresAt: { $lte: now },
        status: 'active'
      });

      if (expiredStories.length === 0) return;

      console.log(`[Cron] Found ${expiredStories.length} expired stories. Cleaning up...`);

      for (const story of expiredStories) {
        story.status = 'expired';
        await story.save();

        if (story.imageUrl) {
          await deleteMedia(story.imageUrl);
        }

        if (io) {
          io.emit('story:expired', story._id);
        }
      }

      console.log(`[Cron] Successfully cleaned up ${expiredStories.length} stories.`);
    } catch (err) {
      console.error('[Cron] Cleanup job error:', err);
    }
  });
};

module.exports = { initCleanupJob };
