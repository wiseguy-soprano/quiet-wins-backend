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
router.put('/me', authMiddleware, [
  body('name').optional({ checkFalsy: true }).trim().notEmpty().isLength({ max: 100 }),
  body('bio').optional({ checkFalsy: true }).isLength({ max: 500 }),
  body('avatar_url').optional({ checkFalsy: true }).isURL().withMessage('avatar_url must be a valid URL')
], validate, async (req, res) => {
  const { name, bio, avatar_url } = req.body;

  try {
    const { data, error } = await supabase
      .from('users')
      .update({ name, bio, avatar_url })
      .eq('id', req.user.id)
      .select('id, name, email, role, bio, avatar_url, created_at');

    if (error) return res.status(400).json({ error: error.message });

    res.json({ message: 'Profile updated successfully', user: data[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET my login history (protected)
router.get('/me/login-history', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('login_history')
      .select('id, ip_address, user_agent, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return res.status(400).json({ error: error.message });

    res.json({ login_history: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;