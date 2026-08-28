const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body } = require('express-validator');
const { createClient } = require('@supabase/supabase-js');
const validate = require('../middleware/validate');
const { sendEmail } = require('../utils/email');

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// REGISTER
router.post('/register', [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('email').trim().isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], validate, async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const { data, error } = await supabase
      .from('users')
      .insert([{ name, email, password_hash }])
      .select('id, name, email, role, bio, avatar_url, created_at');

    if (error) return res.status(400).json({ error: error.message });

    res.status(201).json({ message: 'User registered successfully', user: data[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// LOGIN
router.post('/login', [
  body('email').trim().isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required')
], validate, async (req, res) => {
  const { email, password } = req.body;

  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !data) return res.status(400).json({ error: 'Invalid credentials' });

    if (!data.is_active) return res.status(403).json({ error: 'Account is deactivated' });

    const isMatch = await bcrypt.compare(password, data.password_hash);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: data.id, role: data.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ message: 'Login successful', token, user: { id: data.id, name: data.name, email: data.email, role: data.role } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// FORGOT PASSWORD — always responds the same way, whether or not the email exists
router.post('/forgot-password', [
  body('email').trim().isEmail().withMessage('A valid email is required').normalizeEmail()
], validate, async (req, res) => {
  const { email } = req.body;
  const genericResponse = { message: 'If an account with that email exists, a reset link has been sent' };

  try {
    const { data: user } = await supabase
      .from('users')
      .select('id, name, email, is_active')
      .eq('email', email)
      .single();

    if (!user || !user.is_active) {
      return res.json(genericResponse);
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();

    const { error: insertError } = await supabase
      .from('password_resets')
      .insert([{ user_id: user.id, token_hash: hashToken(rawToken), expires_at: expiresAt }]);

    if (insertError) return res.status(400).json({ error: insertError.message });

    await sendEmail({
      to: user.email,
      toName: user.name,
      subject: 'Reset your Quiet Wins password',
      htmlContent: `<p>Use this code to reset your password (valid for 1 hour):</p><p style="font-size:18px;font-weight:bold;">${rawToken}</p><p>If you didn't request this, you can ignore this email.</p>`
    });

    res.json(genericResponse);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// RESET PASSWORD
router.post('/reset-password', [
  body('token').trim().isLength({ min: 64, max: 64 }).withMessage('A valid reset token is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], validate, async (req, res) => {
  const { token, password } = req.body;

  try {
    const { data: resetRow, error: resetError } = await supabase
      .from('password_resets')
      .select('id, user_id, expires_at, used')
      .eq('token_hash', hashToken(token))
      .single();

    if (resetError || !resetRow || resetRow.used || new Date(resetRow.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Reset token is invalid or expired' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash })
      .eq('id', resetRow.user_id);

    if (updateError) return res.status(400).json({ error: updateError.message });

    await supabase.from('password_resets').update({ used: true }).eq('id', resetRow.id);

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;