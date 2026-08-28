require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const contentRoutes = require('./routes/content');
const commentRoutes = require('./routes/comments');
const notificationRoutes = require('./routes/notifications');
const likeRoutes = require('./routes/likes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/likes', likeRoutes);

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'Quiet Wins API is running!' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});