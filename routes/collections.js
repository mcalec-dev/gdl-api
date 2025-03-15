const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const rateLimit = require('express-rate-limit');
const { fsCache, searchCache } = require('../utils/cacheUtils');
const { buildSearchIndex, searchFiles } = require('../utils/searchUtils');
const router = express.Router();

// Update the config import to include BASE_PATH and RATE_LIMIT
const { GALLERY_DL_DIR, EXCLUDED_DIRS, EXCLUDED_FILES, ALLOWED_EXTENSIONS, MAX_DEPTH, BASE_PATH, RATE_LIMIT } = require('../config');
const { isExcluded, hasAllowedExtension, isFileExcluded, getAllDirectories, getAllDirectoriesAndFiles } = require('../utils/fileUtils');
const { normalizePath, normalizeAndEncodePath } = require('../utils/pathUtils');

// Update the rate limiter configuration
const apiLimiter = rateLimit({
  windowMs: RATE_LIMIT.windowMs,
  max: RATE_LIMIT.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const retryAfter = Math.ceil(req.rateLimit.resetTime / 1000);
    res.status(429).json({
      error: 'Too many requests, please try again later.',
      retryAfter,
      rateLimit: {
        windowMs: RATE_LIMIT.windowMs,
        maxRequests: RATE_LIMIT.maxRequests,
        remainingRequests: req.rateLimit.remaining,
        resetTime: new Date(Date.now() + req.rateLimit.resetTime).toISOString()
      }
    });
  },
  keyGenerator: (req) => {
    return req.headers['cf-connecting-ip'] || req.ip;
  }
});

// Apply rate limiting to all routes
router.use(apiLimiter);

// Update the search endpoint to use 'q' instead of 'query'
router.get('/api/search', async (req, res) => {
  const { q } = req.query;
  
  // Validate query length
  if (!q || q.length < 3) {
    return res.status(400).json({ 
      error: 'Search query must be at least 3 characters long'
    });
  }

  try {
    const searchIndex = await buildSearchIndex(GALLERY_DL_DIR);
    const results = searchFiles(q, searchIndex);

    // Only send necessary data
    const simplifiedResults = results.slice(0, 100).map(result => ({
      name: result.name,
      path: result.path,
      type: result.type,
      score: result.score,
      collection: result.collection
    }));

    res.json({
      query: q,
      count: results.length,
      results: simplifiedResults
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Optimize collections endpoint with caching
router.get('/api/collections', async (req, res) => {
  try {
    const dirs = await fs.readdir(GALLERY_DL_DIR, { withFileTypes: true });
    
    const collections = dirs
      .filter(dirent => dirent.isDirectory() && !isExcluded(dirent.name))
      .map(dirent => ({
        name: dirent.name,
        type: 'directory',
        isCollection: true
      }));

    res.json({
      collections: collections,
      count: collections.length
    });

  } catch (error) {
    console.error('Error getting collections:', error, {
      path: GALLERY_DL_DIR,
      exists: fs.existsSync(GALLERY_DL_DIR)
    });
    res.status(500).json({ 
      error: 'Failed to get collections',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.get('/api/collections/:collectionName', async (req, res) => {
  const { collectionName } = req.params;
  const collectionPath = path.join(GALLERY_DL_DIR, collectionName);
  
  try {
    const stats = await fs.stat(collectionPath);
    if (!stats.isDirectory()) {
      return res.status(404).json({ error: 'Collection not found' });
    }
    
    const entries = await fs.readdir(collectionPath, { withFileTypes: true });
    const itemsList = entries
      .filter(entry => (entry.isDirectory() && !isExcluded(entry.name)) || (entry.isFile() && hasAllowedExtension(entry.name) && !isFileExcluded(entry.name)))
      .map(entry => ({
        type: entry.isDirectory() ? 'directory' : 'file',
        name: entry.name,
        path: `${normalizeAndEncodePath(entry.name)}`
      }));
    
    res.json({
      name: collectionName,
      count: itemsList.length,
      items: itemsList
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'Collection not found' });
    }
    console.error(`Error reading collection ${collectionName}:`, error);
    res.status(500).json({ error: 'Failed to read collection' });
  }
});

router.get('/api/collections/:collectionName/:username', async (req, res) => {
  const { collectionName, username } = req.params;
  const userPath = path.join(GALLERY_DL_DIR, collectionName, username);
  
  try {
    const stats = await fs.stat(userPath);
    if (!stats.isDirectory()) {
      return res.status(404).json({ error: 'Directory not found' });
    }
    
    const entries = await fs.readdir(userPath, { withFileTypes: true });
    const itemsList = entries
      .filter(entry => (entry.isDirectory() && !isExcluded(entry.name)) || (entry.isFile() && hasAllowedExtension(entry.name) && !isFileExcluded(entry.name)))
      .map(entry => ({
        type: entry.isDirectory() ? 'directory' : 'file',
        name: entry.name,
        path: `${normalizeAndEncodePath(username)}/${normalizeAndEncodePath(entry.name)}`
      }));
    
    res.json({
      name: username,
      count: itemsList.length,
      items: itemsList
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'Directory not found' });
    }
    console.error(`Error reading directory ${userPath}:`, error);
    res.status(500).json({ error: 'Failed to read directory' });
  }
});

router.get('/api/collections/:collectionName/:username/*', async (req, res) => {
  const { collectionName, username } = req.params;
  const subPath = req.params[0] || '';
  const userPath = path.join(GALLERY_DL_DIR, collectionName, username, subPath);
  
  try {
    const stats = await fs.stat(userPath);
    if (!stats.isDirectory()) {
      return res.status(404).json({ error: 'Directory not found' });
    }
    
    const entries = await fs.readdir(userPath, { withFileTypes: true });
    const itemsList = entries
      .filter(entry => (entry.isDirectory() && !isExcluded(entry.name)) || (entry.isFile() && hasAllowedExtension(entry.name) && !isFileExcluded(entry.name)))
      .map(entry => ({
        type: entry.isDirectory() ? 'directory' : 'file',
        name: entry.name,
        path: `${normalizeAndEncodePath(username)}/${normalizeAndEncodePath(subPath)}/${normalizeAndEncodePath(entry.name)}`
      }));
    
    res.json({
      name: username,
      path: subPath,
      count: itemsList.length,
      items: itemsList
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'Directory not found' });
    }
    console.error(`Error reading directory ${userPath}:`, error);
    res.status(500).json({ error: 'Failed to read directory' });
  }
});

router.get('/api/collections/:collectionName/*', async (req, res) => {
  const { collectionName } = req.params;
  const subPath = req.params[0] || '';
  const collectionPath = path.join(GALLERY_DL_DIR, collectionName, subPath);
  
  try {
    const stats = await fs.stat(collectionPath);
    if (!stats.isDirectory()) {
      return res.status(404).json({ error: 'Collection or directory not found' });
    }
    
    const allDirsAndFiles = await getAllDirectoriesAndFiles(collectionPath);
    
    const itemsList = allDirsAndFiles.map(item => {
      const relativePath = normalizeAndEncodePath(item.path);
      return {
        type: item.type,
        name: item.name,
        path: `${relativePath}`
      };
    });
    
    res.json({
      name: collectionName,
      path: subPath,
      count: itemsList.length,
      items: itemsList
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'Collection or directory not found' });
    }
    console.error(`Error reading collection ${collectionName}:`, error);
    res.status(500).json({ error: 'Failed to read collection' });
  }
});

router.get('/api/files/:collectionName/*', async (req, res) => {
  const { collectionName } = req.params;
  const subPath = req.params[0] || '';
  const filePath = path.join(GALLERY_DL_DIR, collectionName, subPath);

  try {
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.sendFile(filePath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'File not found' });
    }
    console.error(`Error reading file ${filePath}:`, error);
    res.status(500).json({ error: 'Failed to read file' });
  }
});

const getAllImagesRecursively = async (dirPath) => {
  const results = [];
  
  async function traverse(currentPath) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      
      if (entry.isDirectory() && !isExcluded(entry.name)) {
        await traverse(fullPath);
      } else if (entry.isFile() && hasAllowedExtension(entry.name) && !isFileExcluded(entry.name)) {
        const relativePath = path.relative(GALLERY_DL_DIR, fullPath);
        results.push({
          name: entry.name,
          path: relativePath.replace(/\\/g, '/'),
          fullPath: fullPath
        });
      }
    }
  }
  
  await traverse(dirPath);
  return results;
};

// Update random endpoint response
router.get('/api/random', async (req, res) => {
  try {
    const allImages = await getAllImagesRecursively(GALLERY_DL_DIR);
    
    if (allImages.length === 0) {
      return res.status(404).json({ error: 'No images found' });
    }
    
    const randomImage = allImages[Math.floor(Math.random() * allImages.length)];
    const [collectionName, ...pathParts] = randomImage.path.split('/');
    
    // Remove BASE_PATH from the response since we're already mounted under it
    res.json({
      name: randomImage.name,
      collection: collectionName,
      path: `/api/files/${randomImage.path}`,
      fullPath: `/api/files/${collectionName}/${pathParts.join('/')}`,
      directUrl: `https://api.mcalec.dev${BASE_PATH}/api/files/${randomImage.path}`,
      metadata: {
        collection: collectionName,
        relativePath: pathParts.join('/')
      }
    });
  } catch (error) {
    console.error('Error fetching random image:', error);
    res.status(500).json({ error: 'Failed to fetch random image' });
  }
});

// Add this new route before the module.exports
router.get('/api/stats', async (req, res) => {
  try {
    const items = await getAllDirectoriesAndFiles(GALLERY_DL_DIR);
    
    const stats = {
      totalItems: items.length,
      totalDirectories: 0,
      totalFiles: 0,
      fileTypes: {},
      collections: {},
      totalSize: 0
    };

    for (const item of items) {
      // Get the collection name from path
      const pathParts = item.path.split('/').filter(Boolean);
      const collection = pathParts[0];

      // Skip items without a valid collection name
      if (!collection) {
        console.warn(`Found item without valid collection path: ${item.path}`);
        continue;
      }

      // Initialize collection if not exists
      if (!stats.collections[collection]) {
        stats.collections[collection] = {
          totalItems: 0,
          directories: 0,
          files: 0,
          size: 0
        };
      }

      if (item.type === 'directory') {
        stats.totalDirectories++;
        stats.collections[collection].directories++;
        stats.collections[collection].totalItems++;
      } else if (item.type === 'file') {
        stats.totalFiles++;
        
        const ext = path.extname(item.name).toLowerCase();
        stats.fileTypes[ext] = (stats.fileTypes[ext] || 0) + 1;
        
        try {
          const fileStats = await fs.stat(item.fullPath);
          stats.totalSize += fileStats.size;
          stats.collections[collection].size += fileStats.size;
          stats.collections[collection].files++;
          stats.collections[collection].totalItems++;
        } catch (error) {
          console.error(`Error getting file stats for ${item.fullPath}:`, error);
        }
      }
    }

    // Convert sizes to human readable format
    const convertToHumanSize = (bytes) => {
      const units = ['B', 'KB', 'MB', 'GB', 'TB'];
      let size = bytes;
      let unitIndex = 0;
      while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
      }
      return `${size.toFixed(2)} ${units[unitIndex]}`;
    };

    stats.humanReadableSize = convertToHumanSize(stats.totalSize);

    // Convert collection sizes to human readable format
    Object.keys(stats.collections).forEach(collection => {
      stats.collections[collection].humanReadableSize = 
        convertToHumanSize(stats.collections[collection].size);
    });

    stats.summary = {
      totalCollections: Object.keys(stats.collections).length,
      averageFilesPerCollection: (stats.totalFiles / Object.keys(stats.collections).length).toFixed(2),
      mostCommonFileType: Object.entries(stats.fileTypes)
        .sort((a, b) => b[1] - a[1])[0][0]
    };

    res.json({
      timestamp: new Date().toISOString(),
      stats: stats
    });
    
  } catch (error) {
    console.error('Error generating stats:', error);
    res.status(500).json({ error: 'Failed to generate statistics' });
  }
});

// Add cache cleaning endpoint (protected by rate limit)
router.post('/api/cache/clear', apiLimiter, (req, res) => {
  try {
    clearCaches();
    res.json({ message: 'Caches cleared successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear caches' });
  }
});

module.exports = router;