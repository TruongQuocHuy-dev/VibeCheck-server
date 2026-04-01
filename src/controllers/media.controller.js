/**
 * Simple Media Controller to simulate S3/Cloudinary upload
 */
const uploadMedia = async (req, res) => {
  try {
    // In a real app, we would use multer and an upload service here.
    // For now, we simulate a successful upload and return a placeholder URL.
    
    // const file = req.file;
    // if (!file) return res.status(400).json({ status: 'fail', message: 'No file uploaded.' });
    
    // Placeholder image URL
    const placeholderUrl = 'https://picsum.photos/800/1200';
    
    return res.status(200).json({
      status: 'success',
      data: {
        url: placeholderUrl,
        type: req.body.type || 'image',
      }
    });
  } catch (error) {
    console.error('uploadMedia error:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};

module.exports = { uploadMedia };
