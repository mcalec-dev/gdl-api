const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs').promises;
const { PORT, BASE_PATH, GALLERY_DL_DIR } = require('./config');
const { clearCaches } = require('./utils/cacheUtils');
const { logMemoryUsage } = require('./utils/memoryUtils');

// Load environment variables
dotenv.config();

const app = express();

// Trust proxy - required for Cloudflare and rate limiting
app.set('trust proxy', true);

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));

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

// Add this near your other static routes
app.use(`${BASE_PATH}/thumbnails`, express.static(path.join(__dirname, 'public', 'thumbnails')));

// Import routes
const collectionsRouter = require('./routes/collections');

// Use routes with BASE_PATH
app.use(BASE_PATH, collectionsRouter);

// Basic route
app.get('/', (req, res) => {
    res.json({ message: 'API is working' });
});

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

// Add after your existing memory management section
setInterval(() => {
  try {
    if (global.gc) {
      global.gc();
      console.log('Manual garbage collection triggered');
    }
  } catch (e) {
    console.log('Garbage collection not exposed');
  }
}, 1800000); // Run every 30 minutes

// Add after your existing memory management section
setInterval(() => {
  logMemoryUsage();
}, 900000); // Log every 15 minutes

// Add graceful shutdown
process.on('SIGTERM', () => {
  clearCaches();
  server.close(() => {
    console.log('Process terminated');
  });
});

// Add this before app.listen
async function verifyConfiguration() {
  try {
    await fs.access(GALLERY_DL_DIR);
    console.log(`Gallery-DL directory verified: ${GALLERY_DL_DIR}`);
  } catch (error) {
    console.error(`ERROR: Gallery-DL directory not accessible: ${GALLERY_DL_DIR}`);
    console.error('Please check your GALLERY_DL_DIR configuration');
    process.exit(1);
  }
}

// Update the server startup
async function startServer() {
  await verifyConfiguration();
  
  app.listen(PORT, '127.0.0.1', () => {
    console.log(`Gallery-DL API server running at http://127.0.0.1:${PORT}${BASE_PATH}`);
    console.log(`Using Cloudflare tunnel at https://api.mcalec.dev${BASE_PATH}`);
  });
}

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});