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

router.use(authMiddleware);

// GET all my notes
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', req.user.id)
      .order('updated_at', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });

    res.json({ notes: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET one of my notes
router.get('/:id', [
  param('id').isUUID().withMessage('A valid note id is required')
], validate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error) return res.status(404).json({ error: 'Note not found' });

    res.json({ note: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// CREATE a note
router.post('/', [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }),
  body('body').optional({ checkFalsy: true }).isLength({ max: 10000 })
], validate, async (req, res) => {
  const { title, body: noteBody } = req.body;

  try {
    const { data, error } = await supabase
      .from('notes')
      .insert([{ user_id: req.user.id, title, body: noteBody }])
      .select();

    if (error) return res.status(400).json({ error: error.message });

    res.status(201).json({ message: 'Note created successfully', note: data[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// UPDATE a note
router.put('/:id', [
  param('id').isUUID().withMessage('A valid note id is required'),
  body('title').optional({ checkFalsy: true }).trim().notEmpty().isLength({ max: 200 }),
  body('body').optional({ checkFalsy: true }).isLength({ max: 10000 })
], validate, async (req, res) => {
  const { title, body: noteBody } = req.body;

  try {
    const { data, error } = await supabase
      .from('notes')
      .update({ title, body: noteBody, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select();

    if (error) return res.status(400).json({ error: error.message });
    if (!data.length) return res.status(404).json({ error: 'Note not found' });

    res.json({ message: 'Note updated successfully', note: data[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE a note
router.delete('/:id', [
  param('id').isUUID().withMessage('A valid note id is required')
], validate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('notes')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select();

    if (error) return res.status(400).json({ error: error.message });
    if (!data.length) return res.status(404).json({ error: 'Note not found' });

    res.json({ message: 'Note deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
