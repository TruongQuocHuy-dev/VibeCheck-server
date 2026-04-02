const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary from environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Storage to stream uploads directly to Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'vibecheck_profiles',
    allowed_formats: ['jpg', 'png', 'jpeg'],
  },
});

const upload = multer({ storage: storage });

// Storage for chat media (supports images and audio via 'auto' resource type)
const chatStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'vibecheck_chat',
    resource_type: 'auto', // Important for audio/video support
  },
});

const chatUpload = multer({ 
  storage: chatStorage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

module.exports = { upload, chatUpload, cloudinary };
