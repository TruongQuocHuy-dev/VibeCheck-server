const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ status: 'fail', message: 'No file uploaded.' });
    }

    // req.file is populated by multer with Cloudinary information
    const fileUrl = req.file.path;
    const publicId = req.file.filename;

    res.status(200).json({
      status: 'success',
      data: {
        url: fileUrl,
        publicId: publicId,
        format: req.file.mimetype,
      },
    });
  } catch (error) {
    console.error('uploadFile error:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error during upload.' });
  }
};

module.exports = {
  uploadFile,
};
