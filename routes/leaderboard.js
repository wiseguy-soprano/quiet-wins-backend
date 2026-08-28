const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// GET leaderboard (public) - top users ranked by points
router.get('/', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);

  try {
    const { data, error } = await supabase
      .from('leaderboard')
      .select('*')
      .order('points', { ascending: false })
      .limit(limit);

    if (error) return res.status(400).json({ error: error.message });

    const ranked = data.map((row, index) => ({ rank: index + 1, ...row }));

    res.json({ leaderboard: ranked });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
