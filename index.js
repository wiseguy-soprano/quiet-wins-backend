require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { apiLimiter, authLimiter } = require('./middleware/rateLimit');
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

const app = express();
const PORT = process.env.PORT || 3000;

// Render sits behind a proxy; needed for express-rate-limit to see the real client IP
app.set('trust proxy', 1);

app.use(helmet());
app.use(morgan('combined'));
app.use(cors(process.env.FRONTEND_ORIGIN ? { origin: process.env.FRONTEND_ORIGIN } : {}));
app.use(express.json());
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

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'Quiet Wins API is running!' });
});

// Safety net: catches anything an individual route's try/catch missed
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] Unhandled error on ${req.method} ${req.originalUrl}:`, err);
  res.status(500).json({ error: 'Server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});