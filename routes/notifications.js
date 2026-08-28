const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const authMiddleware = require('../middleware/authMiddleware');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// GET all notifications for logged in user (protected)
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, type, message, is_read, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });

    res.json({ notifications: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// MARK notification as read (protected)
router.put('/:id/read', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select();

    if (error) return res.status(400).json({ error: error.message });

    res.json({ message: 'Notification marked as read', notification: data[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;