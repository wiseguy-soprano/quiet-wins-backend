const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// LIST all FAQs, in display order (public, no auth required)
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('faqs')
      .select('id, question, answer, sort_order')
      .order('sort_order', { ascending: true });

    if (error) return res.status(400).json({ error: error.message });

    res.json({ faqs: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
