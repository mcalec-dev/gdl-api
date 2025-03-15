const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { BASE_PATH } = require('./config');
const { clearCaches } = require('./utils/cacheUtils');

// Load environment variables
dotenv.config();

const app = express();

// Trust proxy - required for Cloudflare and rate limiting
app.set('trust proxy', true);

const PORT = process.env.PORT || 3030;

// Middleware
app.use(cors());
app.use(express.json());

// Custom middleware to handle /random/ endpoint
app.get(`${BASE_PATH}/random`, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'random.html'));
});

app.get(`${BASE_PATH}/random/`, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'random.html'));
});

// Custom middleware to handle /stats/ endpoint
app.get(`${BASE_PATH}/stats`, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'stats.html'));
});

app.get(`${BASE_PATH}/stats/`, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'stats.html'));
});

// Custom middleware to handle /search/ endpoint
app.get(`${BASE_PATH}/search`, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'search.html'));
});

app.get(`${BASE_PATH}/search/`, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'search.html'));
});

// Handle file browser routes
app.get(`${BASE_PATH}/files`, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'files.html'));
});

app.get(`${BASE_PATH}/files/*`, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'files.html'));
});

// Serve static files from the "public" directory under BASE_PATH
app.use(BASE_PATH, express.static(path.join(__dirname, 'public')));

// Import routes
const collectionsRouter = require('./routes/collections');

// Use routes with BASE_PATH
app.use(BASE_PATH, collectionsRouter);

// Error handling middleware
app.use((req, res, next) => {
  console.log(`404 Not Found: ${req.method} ${req.originalUrl}`); 
  res.status(404).json({ 
    error: 'Endpoint not found',
    requestedPath: req.originalUrl
  });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Memory management - clear caches every hour
setInterval(() => {
  clearCaches();
  console.log('Caches cleared for memory management');
}, 3600000);

// Add graceful shutdown
process.on('SIGTERM', () => {
  clearCaches();
  server.close(() => {
    console.log('Process terminated');
  });
});

// Start the server
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Gallery-DL API server running at http://127.0.0.1:${PORT}${BASE_PATH}`);
  console.log(`Using Cloudflare tunnel at https://api.mcalec.dev${BASE_PATH}`);
});