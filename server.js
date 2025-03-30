const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs').promises;
const logger = require('morgan');
const debug = require('debug')('gdl-api:server');
const { PORT, HOST, CORS_ORIGIN, BASE_PATH, GALLERY_DL_DIR } = require('./config');
const { clearCaches } = require('./utils/cacheUtils');
const { logMemoryUsage } = require('./utils/memoryUtils');

// Load environment variables
dotenv.config();

const app = express();

// Configure trust proxy before other middleware
app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);

// Middleware setup
app.use(logger('dev'));
app.use(cors({
  origin: CORS_ORIGIN,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));
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
const routes = require('./routes');

// Mount all routes under BASE_PATH
app.use(BASE_PATH, routes);

// Add debug middleware to log all registered routes
app.use((req, res, next) => {
  debug(`${req.method} ${req.url}`);
  next();
});

// Add after routes are mounted
app._router.stack.forEach(middleware => {
    if (middleware.route) {
        console.log(`Route: ${middleware.route.path}`);
    } else if (middleware.name === 'router') {
        middleware.handle.stack.forEach(handler => {
            if (handler.route) {
                console.log(`${BASE_PATH}${handler.route.path}`);
            }
        });
    }
});

// Add after routes are mounted
app._router.stack.forEach((middleware) => {
  if (middleware.route) {
    console.log(middleware.route.path);
  } else if (middleware.name === 'router') {
    middleware.handle.stack.forEach((handler) => {
      if (handler.route) {
        console.log(`${BASE_PATH}${handler.route.path}`);
      }
    });
  }
});

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
  debug(err.stack);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error'
  });
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
  
  app.listen(PORT, HOST, () => {
    console.log(`Gallery-DL API server running at http://${HOST}:${PORT}${BASE_PATH}`);
    console.log(`Using Cloudflare tunnel at https://api.mcalec.dev${BASE_PATH}`);
    debug(`Server is running in ${process.env.NODE_ENV} mode`);
  });
}

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

module.exports = app;

// Debug helper to print routes
function printRoutes(app) {
  function print(path, layer) {
    if (layer.route) {
      layer.route.stack.forEach(r => {
        const method = Object.keys(r.route.methods)[0].toUpperCase();
        debug(`${method} ${path}${r.route.path}`);
      });
    } else if (layer.name === 'router' && layer.handle.stack) {
      layer.handle.stack.forEach(stackItem => print(path + layer.regexp.source.slice(2, -2), stackItem));
    }
  }
  app._router.stack.forEach(layer => print('', layer));
}