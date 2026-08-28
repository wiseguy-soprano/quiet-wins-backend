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

// SEND a direct message
router.post('/', [
  body('recipient_id').isUUID().withMessage('A valid recipient_id is required'),
  body('body').trim().notEmpty().withMessage('Message body is required').isLength({ max: 2000 })
], validate, async (req, res) => {
  const { recipient_id, body: messageBody } = req.body;

  if (recipient_id === req.user.id) {
    return res.status(400).json({ error: 'Cannot send a message to yourself' });
  }

  try {
    const { data, error } = await supabase
      .from('messages')
      .insert([{ sender_id: req.user.id, recipient_id, body: messageBody }])
      .select();

    if (error) return res.status(400).json({ error: error.message });

    res.status(201).json({ message: 'Message sent successfully', data: data[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET inbox: latest message per conversation partner
router.get('/conversations', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${req.user.id},recipient_id.eq.${req.user.id}`)
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });

    const conversations = new Map();
    for (const msg of data) {
      const otherId = msg.sender_id === req.user.id ? msg.recipient_id : msg.sender_id;
      if (!conversations.has(otherId)) {
        conversations.set(otherId, msg);
      }
    }

    res.json({ conversations: Array.from(conversations.values()) });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET full conversation with a specific user; marks their unread messages to me as read
router.get('/:userId', [
  param('userId').isUUID().withMessage('A valid userId is required')
], validate, async (req, res) => {
  const otherId = req.params.userId;

  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${req.user.id},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${req.user.id})`)
      .order('created_at', { ascending: true });

    if (error) return res.status(400).json({ error: error.message });

    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('sender_id', otherId)
      .eq('recipient_id', req.user.id)
      .eq('is_read', false);

    res.json({ messages: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
