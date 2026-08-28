const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const authMiddleware = require('../middleware/authMiddleware');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// GET all badge definitions (public)
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('badges')
      .select('*')
      .order('criteria_value', { ascending: true });

    if (error) return res.status(400).json({ error: error.message });

    res.json({ badges: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET logged-in user's badges, marked earned/locked against their live stats (protected)
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const { data: badges, error: badgesError } = await supabase
      .from('badges')
      .select('*')
      .order('criteria_value', { ascending: true });

    if (badgesError) return res.status(400).json({ error: badgesError.message });

    const { data: stats, error: statsError } = await supabase
      .from('leaderboard')
      .select('*')
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (statsError) return res.status(400).json({ error: statsError.message });

    const userStats = stats || { content_count: 0, comment_count: 0, likes_received: 0, points: 0 };

    const result = badges.map((badge) => ({
      ...badge,
      earned: userStats[badge.criteria_type] >= badge.criteria_value
    }));

    res.json({ badges: result, stats: userStats });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
