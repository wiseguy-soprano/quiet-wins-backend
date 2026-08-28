const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { createClient } = require('@supabase/supabase-js');
const authMiddleware = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const TARGET_TYPES = ['content', 'comment'];

// REPORT a piece of content or a comment (protected)
router.post('/', authMiddleware, [
  body('target_type').isIn(TARGET_TYPES).withMessage(`target_type must be one of: ${TARGET_TYPES.join(', ')}`),
  body('target_id').isUUID().withMessage('A valid target_id is required'),
  body('reason').trim().notEmpty().withMessage('Reason is required').isLength({ max: 500 })
], validate, async (req, res) => {
  const { target_type, target_id, reason } = req.body;

  try {
    const { data, error } = await supabase
      .from('reports')
      .insert([{ reporter_id: req.user.id, target_type, target_id, reason }])
      .select();

    if (error) return res.status(400).json({ error: error.message });

    res.status(201).json({ message: 'Report submitted successfully', report: data[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
