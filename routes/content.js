const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { createClient } = require('@supabase/supabase-js');
const authMiddleware = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');

const CONTENT_TYPES = ['blog', 'music', 'resource', 'community'];
const TOPICS = ['GENERAL', 'BOOKS', 'MUSIC', 'FILM'];

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// GET all content, optionally filtered by type (public)
router.get('/', async (req, res) => {
  try {
    let query = supabase
      .from('content')
      .select('*, author:users(name, avatar_hue)')
      .order('created_at', { ascending: false });

    if (req.query.type) {
      query = query.eq('type', req.query.type);
    }

    const { data, error } = await query;

    if (error) return res.status(400).json({ error: error.message });

    res.json({ content: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET single content item (public)
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('content')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) return res.status(404).json({ error: 'Content not found' });

    supabase
      .from('content')
      .update({ view_count: (data.view_count || 0) + 1 })
      .eq('id', req.params.id)
      .then(({ error: updateError }) => {
        if (updateError) console.error('Failed to increment view_count:', updateError.message);
      });

    res.json({ content: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// CREATE content (protected)
router.post('/', authMiddleware, [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }),
  body('type').isIn(CONTENT_TYPES).withMessage(`Type must be one of: ${CONTENT_TYPES.join(', ')}`),
  body('body').optional({ checkFalsy: true }).isLength({ max: 50000 }),
  body('media_url').optional({ checkFalsy: true }).isURL().withMessage('media_url must be a valid URL'),
  body('topic').optional({ checkFalsy: true }).isIn(TOPICS).withMessage(`Topic must be one of: ${TOPICS.join(', ')}`)
], validate, async (req, res) => {
  const { title, type, body, media_url, topic } = req.body;

  try {
    const { data, error } = await supabase
      .from('content')
      .insert([{ title, type, body, media_url, topic, user_id: req.user.id }])
      .select();

    if (error) return res.status(400).json({ error: error.message });

    res.status(201).json({ message: 'Content created successfully', content: data[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// UPDATE content (protected)
router.put('/:id', authMiddleware, [
  body('title').optional({ checkFalsy: true }).trim().notEmpty().isLength({ max: 200 }),
  body('type').optional({ checkFalsy: true }).isIn(CONTENT_TYPES).withMessage(`Type must be one of: ${CONTENT_TYPES.join(', ')}`),
  body('body').optional({ checkFalsy: true }).isLength({ max: 50000 }),
  body('media_url').optional({ checkFalsy: true }).isURL().withMessage('media_url must be a valid URL')
], validate, async (req, res) => {
  const { title, type, body, media_url, status } = req.body;

  try {
    const { data, error } = await supabase
      .from('content')
      .update({ title, type, body, media_url, status })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select();

    if (error) return res.status(400).json({ error: error.message });

    res.json({ message: 'Content updated successfully', content: data[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE content (protected)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { error } = await supabase
      .from('content')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) return res.status(400).json({ error: error.message });

    res.json({ message: 'Content deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;