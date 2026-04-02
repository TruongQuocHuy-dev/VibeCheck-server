/**
 * Simple Media Controller to simulate S3/Cloudinary upload
 */
const uploadMedia = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ status: 'fail', message: 'No file uploaded.' });
    }

    // req.file is populated by multer with Cloudinary information from chatUpload
    const fileUrl = req.file.path;
    const publicId = req.file.filename;

    return res.status(200).json({
      status: 'success',
      data: {
        url: fileUrl,
        publicId: publicId,
        type: req.file.mimetype.startsWith('image') ? 'image' : 
              (req.file.mimetype.startsWith('audio') ? 'audio' : 'video'),
      },
    });
  } catch (error) {
    console.error('uploadMedia error:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};

module.exports = { uploadMedia };
