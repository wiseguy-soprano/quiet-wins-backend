const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { createClient } = require('@supabase/supabase-js');
const authMiddleware = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// POST a comment (protected)
router.post('/', authMiddleware, [
  body('content_id').isUUID().withMessage('A valid content_id is required'),
  body('body').trim().notEmpty().withMessage('Comment body is required').isLength({ max: 2000 })
], validate, async (req, res) => {
  const { content_id, body } = req.body;

  try {
    const { data, error } = await supabase
      .from('comments')
      .insert([{ user_id: req.user.id, content_id, body }])
      .select();

    if (error) return res.status(400).json({ error: error.message });

    const comment = data[0];

    // Auto-trigger a notification for the content owner
    const { data: contentItem } = await supabase
      .from('content')
      .select('user_id, title')
      .eq('id', content_id)
      .single();

    if (contentItem && contentItem.user_id !== req.user.id) {
      await supabase.from('notifications').insert([{
        user_id: contentItem.user_id,
        type: 'comment',
        message: `Someone commented on your post "${contentItem.title}"`,
        is_read: false
      }]);
    }

    res.status(201).json({ message: 'Comment posted successfully', comment });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET all comments for a content item (public)
router.get('/:contentId', [
  param('contentId').isUUID().withMessage('A valid contentId is required')
], validate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('comments')
      .select('*, author:users(name, avatar_hue)')
      .eq('content_id', req.params.contentId)
      .order('created_at', { ascending: true });

    if (error) return res.status(400).json({ error: error.message });

    res.json({ comments: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// UPDATE own comment (protected)
router.put('/:id', authMiddleware, [
  param('id').isUUID().withMessage('A valid comment id is required'),
  body('body').trim().notEmpty().withMessage('Comment body is required').isLength({ max: 2000 })
], validate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('comments')
      .update({ body: req.body.body })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select();

    if (error) return res.status(400).json({ error: error.message });
    if (!data.length) return res.status(404).json({ error: 'Comment not found' });

    res.json({ message: 'Comment updated successfully', comment: data[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE own comment (protected)
router.delete('/:id', authMiddleware, [
  param('id').isUUID().withMessage('A valid comment id is required')
], validate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('comments')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select();

    if (error) return res.status(400).json({ error: error.message });
    if (!data.length) return res.status(404).json({ error: 'Comment not found' });

    res.json({ message: 'Comment deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
