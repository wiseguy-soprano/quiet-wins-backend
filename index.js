require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'Quiet Wins API is running!' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});