const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const { getDb } = require('./db/database');

const authRoutes = require('./routes/auth');
const videoRoutes = require('./routes/videos');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Initialize database
getDb();

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/videos', videoRoutes);

// Serve frontend in production
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Mirror Backend running on http://localhost:${PORT}`);
});
