const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const authMiddleware = require('../middleware/authMiddleware');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// GET my profile (protected)
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, role, bio, avatar_url, created_at')
      .eq('id', req.user.id)
      .single();

    if (error) return res.status(404).json({ error: 'User not found' });

    res.json({ user: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// UPDATE my profile (protected)
router.put('/me', authMiddleware, async (req, res) => {
  const { name, bio, avatar_url } = req.body;

  try {
    const { data, error } = await supabase
      .from('users')
      .update({ name, bio, avatar_url })
      .eq('id', req.user.id)
      .select();

    if (error) return res.status(400).json({ error: error.message });

    res.json({ message: 'Profile updated successfully', user: data[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;