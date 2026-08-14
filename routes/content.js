const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const authMiddleware = require('../middleware/authMiddleware');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// GET all content (public)
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('content')
      .select('*')
      .order('created_at', { ascending: false });

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

    res.json({ content: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// CREATE content (protected)
router.post('/', authMiddleware, async (req, res) => {
  const { title, type, body, media_url } = req.body;

  if (!title || !type) {
    return res.status(400).json({ error: 'Title and type are required' });
  }

  try {
    const { data, error } = await supabase
      .from('content')
      .insert([{ title, type, body, media_url, user_id: req.user.id }])
      .select();

    if (error) return res.status(400).json({ error: error.message });

    res.status(201).json({ message: 'Content created successfully', content: data[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// UPDATE content (protected)
router.put('/:id', authMiddleware, async (req, res) => {
  const { title, body, media_url, status } = req.body;

  try {
    const { data, error } = await supabase
      .from('content')
      .update({ title, body, media_url, status })
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