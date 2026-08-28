const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const { createClient } = require('@supabase/supabase-js');
const validate = require('../middleware/validate');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// LOG a page view (public — frontend calls this on every page load; attributes
// it to a user if a valid token is present, otherwise logs it as anonymous)
router.post('/pageview', [
  body('path').trim().notEmpty().withMessage('path is required').isLength({ max: 300 })
], validate, async (req, res) => {
  let userId = null;
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.id;
    } catch (err) {
      // invalid/expired token on a public route — ignore, log as anonymous
    }
  }

  try {
    const { error } = await supabase
      .from('page_views')
      .insert([{ path: req.body.path, user_id: userId }]);

    if (error) return res.status(400).json({ error: error.message });

    res.status(201).json({ message: 'Page view logged' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
