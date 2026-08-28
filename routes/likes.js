const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const authMiddleware = require('../middleware/authMiddleware');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// TOGGLE like on content (protected) — likes if not yet liked, unlikes if already liked
router.post('/:contentId', authMiddleware, async (req, res) => {
  const { contentId } = req.params;

  try {
    const { data: existing, error: findError } = await supabase
      .from('likes')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('content_id', contentId)
      .maybeSingle();

    if (findError) return res.status(400).json({ error: findError.message });

    if (existing) {
      const { error: deleteError } = await supabase
        .from('likes')
        .delete()
        .eq('id', existing.id);

      if (deleteError) return res.status(400).json({ error: deleteError.message });

      return res.json({ message: 'Content unliked', liked: false });
    }

    const { error: insertError } = await supabase
      .from('likes')
      .insert([{ user_id: req.user.id, content_id: contentId }]);

    if (insertError) return res.status(400).json({ error: insertError.message });

    res.status(201).json({ message: 'Content liked', liked: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET like count for content, and whether the logged-in user (if any) has liked it
router.get('/:contentId', async (req, res) => {
  const { contentId } = req.params;

  try {
    const { count, error: countError } = await supabase
      .from('likes')
      .select('id', { count: 'exact', head: true })
      .eq('content_id', contentId);

    if (countError) return res.status(400).json({ error: countError.message });

    let liked = false;
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const { data: existing } = await supabase
          .from('likes')
          .select('id')
          .eq('user_id', decoded.id)
          .eq('content_id', contentId)
          .maybeSingle();

        liked = !!existing;
      } catch (err) {
        // invalid/expired token on a public route — ignore, treat as anonymous
      }
    }

    res.json({ count: count || 0, liked });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
