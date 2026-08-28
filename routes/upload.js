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

const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/ogg'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_AUDIO_TYPES.includes(file.mimetype)) {
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
      const extension = path.extname(req.file.originalname) || '';
      const filename = `${crypto.randomUUID()}${extension}`;

      const { error: uploadError } = await supabase.storage
        .from('music')
        .upload(filename, req.file.buffer, { contentType: req.file.mimetype });

      if (uploadError) return res.status(400).json({ error: uploadError.message });

      const { data } = supabase.storage.from('music').getPublicUrl(filename);

      res.status(201).json({ message: 'File uploaded successfully', url: data.publicUrl });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });
});

module.exports = router;
