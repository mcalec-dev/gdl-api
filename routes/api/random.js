const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const debug = require('debug')('gdl-api:random');
const { GALLERY_DL_DIR } = require('../../config');
const { hasAllowedExtension, isExcluded } = require('../../utils/fileUtils');
const { getUserPermission } = require('../../utils/authUtils');
const NodeCache = require('node-cache');

const fileListCache = new NodeCache({ stdTTL: 3600 * 24, checkperiod: 3600 }); // 24 hours TTL, check every hour

// Function to refresh the cache periodically
async function refreshCache() {
  debug('Refreshing file list cache');
  const permissions = []; // Add all possible permissions
  for (const permission of permissions) {
    const cacheKey = `fileList_${permission}`;
    try {
      const files = await getAllImagesInDirectory(GALLERY_DL_DIR, [], 0, permission); // Reset depth to 0
      fileListCache.set(cacheKey, files);
      debug(`Cache refreshed for ${cacheKey}`);
    } catch (error) {
      debug(`Error refreshing cache for ${cacheKey}:`, error);
    }
  }
}

refreshCache().then(() => {
  debug('Initial cache population completed');
}).catch(error => {
  debug('Error during initial cache population:', error);
});
setInterval(refreshCache, 30 * 60 * 1000);

async function getCachedFileList(isAuthenticated, permission) {
  const cacheKey = `fileList_${isAuthenticated}_${permission}`;
  let files = fileListCache.get(cacheKey);
  if (files === undefined) {
    try {
      files = await getAllImagesInDirectory(GALLERY_DL_DIR, [], 0, isAuthenticated, permission); // Reset depth to 0
      fileListCache.set(cacheKey, files);
      debug(`Cache created for ${cacheKey}`);
    } catch (error) {
      debug(`Error creating cache for ${cacheKey}:`, error);
      files = [];
    }
  }
  return files;
}

async function getRandomImagePath(isAuthenticated, permission) {
  const files = await getCachedFileList(isAuthenticated, permission);
  if (files.length === 0) {
    throw new Error('No files available');
  }
  const randomIndex = Math.floor(Math.random() * files.length);
  return files[randomIndex];
}

router.get('/', async (req, res) => {
  const isAuthenticated = req.session && req.session.authenticated;
  try {
    const permission = await getUserPermission(req);
    const randomImage = await getRandomImagePath(isAuthenticated, permission);

    // Get file stats only for the selected random image
    const stats = await fs.stat(randomImage.path);

    const relativePath = path.relative(GALLERY_DL_DIR, randomImage.path).replace(/\\/g, '/');
    const pathParts = relativePath.split('/');
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const collection = pathParts[0];
    const author = pathParts[1] || '';
    res.json({
      file: path.basename(randomImage.path),
      path: `/gdl/api/files/${relativePath}`,
      collection: collection,
      author: author,
      size: stats.size,
      url: `${baseUrl}/gdl/api/files/${relativePath}`,
      timestamp: new Date().toISOString(),
      type: path.extname(randomImage.path).slice(1).toLowerCase() || 'unknown'
    });
    debug('Random image request completed');
  } catch (error) {
    debug('Error getting random image:', error);
    res.status(500).json({
      error: 'Failed to get random image',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

async function getAllImagesInDirectory(dir, results = [], depth = 0, isAuthenticated = false, permission = 'default') {
  if (depth >= 10) return results; // Increase the depth limit to 10
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    const BATCH_SIZE = 10; // Adjust as needed
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);

      // Use Promise.all to parallelize the processing of each entry in the batch
      const batchResults = await Promise.all(batch.map(async (entry) => {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(GALLERY_DL_DIR, fullPath);

        if (await isExcluded(relativePath, isAuthenticated, permission)) {
          return null; // Skip excluded entries
        }

        if (entry.isDirectory()) {
          // If it's a directory, recursively call this function
          return getAllImagesInDirectory(fullPath, results, depth + 1, isAuthenticated, permission);
        }

        if (entry.isFile() && hasAllowedExtension(fullPath, isAuthenticated)) {
          try {
            const stats = await fs.stat(fullPath);
            // If it's a file and has an allowed extension, return the file info
            return {
              path: fullPath,
              size: stats.size,
              type: path.extname(fullPath).slice(1).toLowerCase() || 'unknown'
            };
          } catch (statError) {
            debug(`Error getting stats for ${fullPath}:`, statError);
            return null; // Skip if stat fails
          }
        }
        return null; // Skip if not a file or doesn't have allowed extension
      }));

      // Process the results of the batch
      batchResults.forEach(result => {
        if (result && Array.isArray(result)) {
          // If the result is an array (from a directory), concat the results
          results.push(...result);
        } else if (result) {
          // If the result is a single file, push it to the results
          results.push(result);
        }
      });
    }

    return results;
  } catch (error) {
    debug('Error scanning directory:', dir, error);
    return results;
  }
}

module.exports = router;