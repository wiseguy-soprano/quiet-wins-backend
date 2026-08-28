const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { createClient } = require('@supabase/supabase-js');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const validate = require('../middleware/validate');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

router.use(authMiddleware, adminMiddleware);

const VALID_ROLES = ['user', 'admin'];
const REPORT_STATUSES = ['pending', 'reviewed', 'dismissed'];

// GET all users
router.get('/users', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, role, bio, avatar_url, is_active, created_at')
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });

    res.json({ users: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET single user
router.get('/users/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, role, bio, avatar_url, is_active, created_at')
      .eq('id', req.params.id)
      .single();

    if (error) return res.status(404).json({ error: 'User not found' });

    res.json({ user: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// UPDATE a user's role
router.put('/users/:id/role', async (req, res) => {
  const { role } = req.body;

  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: `Role must be one of: ${VALID_ROLES.join(', ')}` });
  }

  try {
    const { data, error } = await supabase
      .from('users')
      .update({ role })
      .eq('id', req.params.id)
      .select('id, name, email, role, bio, avatar_url, is_active, created_at');

    if (error) return res.status(400).json({ error: error.message });
    if (!data.length) return res.status(404).json({ error: 'User not found' });

    res.json({ message: 'Role updated successfully', user: data[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DEACTIVATE a user
router.put('/users/:id/deactivate', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({ is_active: false })
      .eq('id', req.params.id)
      .select('id, name, email, role, bio, avatar_url, is_active, created_at');

    if (error) return res.status(400).json({ error: error.message });
    if (!data.length) return res.status(404).json({ error: 'User not found' });

    res.json({ message: 'User deactivated', user: data[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// REACTIVATE a user
router.put('/users/:id/activate', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({ is_active: true })
      .eq('id', req.params.id)
      .select('id, name, email, role, bio, avatar_url, is_active, created_at');

    if (error) return res.status(400).json({ error: error.message });
    if (!data.length) return res.status(404).json({ error: 'User not found' });

    res.json({ message: 'User reactivated', user: data[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET all content, for moderation (any status)
router.get('/content', async (req, res) => {
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

// DELETE any content item, regardless of owner
router.delete('/content/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('content')
      .delete()
      .eq('id', req.params.id)
      .select();

    if (error) return res.status(400).json({ error: error.message });
    if (!data.length) return res.status(404).json({ error: 'Content not found' });

    res.json({ message: 'Content deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE any comment, regardless of owner
router.delete('/comments/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('comments')
      .delete()
      .eq('id', req.params.id)
      .select();

    if (error) return res.status(400).json({ error: error.message });
    if (!data.length) return res.status(404).json({ error: 'Comment not found' });

    res.json({ message: 'Comment deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET platform analytics
router.get('/analytics', async (req, res) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [
      userCount,
      contentCount,
      commentCount,
      likeCount,
      newUsers,
      newContent
    ] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('content').select('id', { count: 'exact', head: true }),
      supabase.from('comments').select('id', { count: 'exact', head: true }),
      supabase.from('likes').select('id', { count: 'exact', head: true }),
      supabase.from('users').select('id', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
      supabase.from('content').select('id', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo)
    ]);

    const firstError = [userCount, contentCount, commentCount, likeCount, newUsers, newContent]
      .find((r) => r.error);

    if (firstError) return res.status(400).json({ error: firstError.error.message });

    res.json({
      totals: {
        users: userCount.count || 0,
        content: contentCount.count || 0,
        comments: commentCount.count || 0,
        likes: likeCount.count || 0
      },
      last_7_days: {
        new_users: newUsers.count || 0,
        new_content: newContent.count || 0
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET reports, optionally filtered by status
router.get('/reports', async (req, res) => {
  const { status } = req.query;

  try {
    let query = supabase.from('reports').select('*').order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) return res.status(400).json({ error: error.message });

    res.json({ reports: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// UPDATE a report's status (reviewed/dismissed) after moderation
router.put('/reports/:id', [
  body('status').isIn(REPORT_STATUSES).withMessage(`status must be one of: ${REPORT_STATUSES.join(', ')}`)
], validate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('reports')
      .update({ status: req.body.status })
      .eq('id', req.params.id)
      .select();

    if (error) return res.status(400).json({ error: error.message });
    if (!data.length) return res.status(404).json({ error: 'Report not found' });

    res.json({ message: 'Report updated successfully', report: data[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
