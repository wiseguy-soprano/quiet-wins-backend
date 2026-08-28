const express = require('express');
const router = express.Router();
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Browsers/OSes report inconsistent MIME strings for the same audio format
// (audio/wav vs audio/wave vs audio/x-wav, etc), so validate by extension
// instead and use a canonical content-type for the Supabase upload.
const ALLOWED_EXTENSIONS = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg'
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS[extension]) {
      return cb(new Error('Only audio files (mp3, wav, m4a, ogg) are allowed'));
    }
    cb(null, true);
  }
});

// UPLOAD a music file to Supabase Storage, returns its public URL (admin only)
router.post('/music', authMiddleware, adminMiddleware, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
      const extension = path.extname(req.file.originalname).toLowerCase();
      const filename = `${crypto.randomUUID()}${extension}`;

      const { error: uploadError } = await supabase.storage
        .from('music')
        .upload(filename, req.file.buffer, { contentType: ALLOWED_EXTENSIONS[extension] });

      if (uploadError) return res.status(400).json({ error: uploadError.message });

      const { data } = supabase.storage.from('music').getPublicUrl(filename);

      res.status(201).json({ message: 'File uploaded successfully', url: data.publicUrl });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });
});

module.exports = router;
