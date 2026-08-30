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

const logAdminAction = async (adminId, action, targetType, targetId, details) => {
  await supabase.from('admin_actions').insert([{
    admin_id: adminId,
    action,
    target_type: targetType,
    target_id: targetId,
    details: details || null
  }]);
};

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

    await logAdminAction(req.user.id, 'role_change', 'user', req.params.id, `role set to ${role}`);

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

    await logAdminAction(req.user.id, 'deactivate_user', 'user', req.params.id, null);

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

    await logAdminAction(req.user.id, 'activate_user', 'user', req.params.id, null);

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
      .select('*, author:users(name, email)')
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

    await logAdminAction(req.user.id, 'delete_content', 'content', req.params.id, null);

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

    await logAdminAction(req.user.id, 'delete_comment', 'comment', req.params.id, null);

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
    let query = supabase
      .from('reports')
      .select('*, reporter:users(name, email)')
      .order('created_at', { ascending: false });

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

    await logAdminAction(req.user.id, 'update_report_status', 'report', req.params.id, `status set to ${req.body.status}`);

    res.json({ message: 'Report updated successfully', report: data[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET contact form submissions
router.get('/contact-messages', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('contact_messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });

    res.json({ contactMessages: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// MARK a contact message read/unread
router.put('/contact-messages/:id', [
  body('is_read').isBoolean().withMessage('is_read must be a boolean')
], validate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('contact_messages')
      .update({ is_read: req.body.is_read })
      .eq('id', req.params.id)
      .select();

    if (error) return res.status(400).json({ error: error.message });
    if (!data.length) return res.status(404).json({ error: 'Message not found' });

    res.json({ message: 'Updated successfully', contactMessage: data[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET all FAQs, in display order
router.get('/faqs', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('faqs')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) return res.status(400).json({ error: error.message });

    res.json({ faqs: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// CREATE a FAQ (added to the end of the display order)
router.post('/faqs', [
  body('question').trim().notEmpty().withMessage('Question is required').isLength({ max: 300 }),
  body('answer').trim().notEmpty().withMessage('Answer is required').isLength({ max: 2000 })
], validate, async (req, res) => {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('faqs')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1);

    if (fetchError) return res.status(400).json({ error: fetchError.message });

    const nextOrder = existing.length ? existing[0].sort_order + 1 : 0;

    const { data, error } = await supabase
      .from('faqs')
      .insert([{ question: req.body.question, answer: req.body.answer, sort_order: nextOrder }])
      .select();

    if (error) return res.status(400).json({ error: error.message });

    await logAdminAction(req.user.id, 'create_faq', 'faq', data[0].id, req.body.question);

    res.status(201).json({ message: 'FAQ created successfully', faq: data[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// UPDATE a FAQ's question, answer, and/or sort_order
router.put('/faqs/:id', [
  body('question').optional().trim().notEmpty().withMessage('Question cannot be empty').isLength({ max: 300 }),
  body('answer').optional().trim().notEmpty().withMessage('Answer cannot be empty').isLength({ max: 2000 }),
  body('sort_order').optional().isInt().withMessage('sort_order must be an integer')
], validate, async (req, res) => {
  try {
    const updates = {};
    if (req.body.question !== undefined) updates.question = req.body.question;
    if (req.body.answer !== undefined) updates.answer = req.body.answer;
    if (req.body.sort_order !== undefined) updates.sort_order = req.body.sort_order;

    const { data, error } = await supabase
      .from('faqs')
      .update(updates)
      .eq('id', req.params.id)
      .select();

    if (error) return res.status(400).json({ error: error.message });
    if (!data.length) return res.status(404).json({ error: 'FAQ not found' });

    res.json({ message: 'FAQ updated successfully', faq: data[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE a FAQ
router.delete('/faqs/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('faqs')
      .delete()
      .eq('id', req.params.id)
      .select();

    if (error) return res.status(400).json({ error: error.message });
    if (!data.length) return res.status(404).json({ error: 'FAQ not found' });

    await logAdminAction(req.user.id, 'delete_faq', 'faq', req.params.id, data[0].question);

    res.json({ message: 'FAQ deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET a specific user's login history
router.get('/users/:id/login-history', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('login_history')
      .select('id, ip_address, user_agent, created_at')
      .eq('user_id', req.params.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return res.status(400).json({ error: error.message });

    res.json({ login_history: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET the admin action audit log
router.get('/audit-log', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('admin_actions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) return res.status(400).json({ error: error.message });

    res.json({ audit_log: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET page view analytics: top paths over the last 7 days
router.get('/analytics/pageviews', async (req, res) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('page_views')
      .select('path')
      .gte('created_at', sevenDaysAgo);

    if (error) return res.status(400).json({ error: error.message });

    const counts = {};
    for (const row of data) {
      counts[row.path] = (counts[row.path] || 0) + 1;
    }

    const topPages = Object.entries(counts)
      .map(([path, views]) => ({ path, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 20);

    res.json({ total_views_last_7_days: data.length, top_pages: topPages });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
