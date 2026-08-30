require('dotenv').config();

const REQUIRED_ENV_VARS = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'JWT_SECRET'];
const missingEnvVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

if (missingEnvVars.length) {
  console.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createClient } = require('@supabase/supabase-js');
const { apiLimiter, authLimiter, contactLimiter } = require('./middleware/rateLimit');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const contentRoutes = require('./routes/content');
const commentRoutes = require('./routes/comments');
const notificationRoutes = require('./routes/notifications');
const likeRoutes = require('./routes/likes');
const badgeRoutes = require('./routes/badges');
const leaderboardRoutes = require('./routes/leaderboard');
const searchRoutes = require('./routes/search');
const adminRoutes = require('./routes/admin');
const uploadRoutes = require('./routes/upload');
const reportRoutes = require('./routes/reports');
const messageRoutes = require('./routes/messages');
const noteRoutes = require('./routes/notes');
const analyticsRoutes = require('./routes/analytics');
const contactRoutes = require('./routes/contact');

const app = express();
const PORT = process.env.PORT || 3000;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Render sits behind a proxy; needed for express-rate-limit to see the real client IP
app.set('trust proxy', 1);

// script-src 'unsafe-inline' is needed because the frontend uses small inline
// <script> blocks throughout; XSS protection instead relies on the frontend
// rendering all user content via textContent, never innerHTML (see community.js)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'script-src': ["'self'", "'unsafe-inline'"],
      'script-src-attr': null
    }
  }
}));
app.use(morgan('combined'));
app.use(cors(process.env.FRONTEND_ORIGIN ? { origin: process.env.FRONTEND_ORIGIN } : {}));
app.use(express.json({ limit: '1mb' }));
app.use('/api', apiLimiter);

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/likes', likeRoutes);
app.use('/api/badges', badgeRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/contact', contactLimiter, contactRoutes);

// Serves the frontend (index.html, css, js, images)
app.use(express.static(path.join(__dirname, 'public')));

// Health check: also confirms the database is actually reachable
app.get('/api/health', async (req, res) => {
  try {
    const { error } = await supabase.from('users').select('id', { count: 'exact', head: true });

    if (error) {
      return res.status(503).json({ message: 'Quiet Wins API is running!', database: 'unreachable' });
    }

    res.json({ message: 'Quiet Wins API is running!', database: 'connected' });
  } catch (err) {
    res.status(503).json({ message: 'Quiet Wins API is running!', database: 'unreachable' });
  }
});

// Anything not matched above is an unknown route
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Safety net: catches anything an individual route's try/catch missed
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] Unhandled error on ${req.method} ${req.originalUrl}:`, err);

  if (err.status === 413 || err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body too large' });
  }

  res.status(500).json({ error: 'Server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});