const { cloudinary } = require('../config/upload.config');

/**
 * Helper to get Cloudinary public_id from URL
 */
const getPublicIdFromUrl = (url) => {
  if (!url) return null;
  const parts = url.split('/');
  const uploadIndex = parts.indexOf('upload');
  if (uploadIndex === -1) return null;

  const pathParts = parts.slice(uploadIndex + 2);
  const fullPath = pathParts.join('/');
  return fullPath.split('.')[0];
};

/**
 * Delete media from Cloudinary
 * @param {string} url - Cloudinary URL
 */
const deleteMedia = async (url) => {
  if (!url) return;
  const publicId = getPublicIdFromUrl(url);
  if (publicId) {
    try {
      await cloudinary.uploader.destroy(publicId);
      console.log(`[Cloudinary] Deleted: ${publicId}`);
    } catch (err) {
      console.error(`[Cloudinary] Delete error for ${publicId}:`, err);
    }
  }
};

module.exports = { deleteMedia, getPublicIdFromUrl };
