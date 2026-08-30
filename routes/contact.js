const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { createClient } = require('@supabase/supabase-js');
const validate = require('../middleware/validate');
const { sendEmail } = require('../utils/email');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// SEND a contact/enquiry message (public, no auth required)
router.post('/', [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('email').trim().isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('subject').optional({ checkFalsy: true }).trim().isLength({ max: 150 }),
  body('message').trim().notEmpty().withMessage('Message is required').isLength({ max: 2000 })
], validate, async (req, res) => {
  const { name, email, subject, message } = req.body;

  try {
    const { data, error } = await supabase
      .from('contact_messages')
      .insert([{ name, email, subject: subject || null, message }])
      .select();

    if (error) return res.status(400).json({ error: error.message });

    if (process.env.CONTACT_NOTIFY_EMAIL) {
      await sendEmail({
        to: process.env.CONTACT_NOTIFY_EMAIL,
        toName: 'Quiet Wins',
        subject: `New contact message: ${subject || 'General enquiry'}`,
        htmlContent: `<p><strong>${name}</strong> (${email}) wrote:</p><p>${message.replace(/\n/g, '<br>')}</p>`
      });
    }

    res.status(201).json({ message: 'Message sent successfully', contact: data[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
