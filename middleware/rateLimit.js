const rateLimit = require('express-rate-limit');

// Applies to all /api routes: guards the free-tier Render instance from abuse.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' }
});

// Stricter limit on login/register to blunt brute-force / spam-account attempts.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later' }
});

// Public, unauthenticated contact form — keep it tight to blunt spam.
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many messages sent, please try again later' }
});

module.exports = { apiLimiter, authLimiter, contactLimiter };
