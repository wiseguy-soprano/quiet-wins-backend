const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// GET search content by title or body, optionally filtered by type (public)
router.get('/', async (req, res) => {
  const q = (req.query.q || '').trim();
  const { type } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    const pattern = `%${q}%`;

    let titleQuery = supabase.from('content').select('*').ilike('title', pattern);
    let bodyQuery = supabase.from('content').select('*').ilike('body', pattern);

    if (type) {
      titleQuery = titleQuery.eq('type', type);
      bodyQuery = bodyQuery.eq('type', type);
    }

    const [titleResult, bodyResult] = await Promise.all([titleQuery, bodyQuery]);

    if (titleResult.error) return res.status(400).json({ error: titleResult.error.message });
    if (bodyResult.error) return res.status(400).json({ error: bodyResult.error.message });

    const merged = new Map();
    [...titleResult.data, ...bodyResult.data].forEach((item) => merged.set(item.id, item));

    const results = Array.from(merged.values()).sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );

    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
