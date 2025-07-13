const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const debug = require('debug')('gdl-api:api:stats');
const { isExcluded, hasAllowedExtension } = require('../../utils/fileUtils');
const { GALLERY_DL_DIR } = require('../../config');
async function aggregateStats(dirPath, stats = null) {
  if (!stats) {
    stats = {
      files: 0,
      size: 0,
      lastModified: null,
      fileTypes: {}
    };
  }
  try {
    const entries = await fs.readdir(dirPath, {
      withFileTypes: true
    });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const entryRelativePath = path.relative(GALLERY_DL_DIR, fullPath);
      if (entry.isDirectory()) {
        if (!(await isExcluded(entryRelativePath))) {
          const subStats = await aggregateStats(fullPath);
          stats.files += subStats.files;
          stats.size += subStats.size;
          if (!stats.lastModified || (subStats.lastModified && subStats.lastModified > stats.lastModified)) {
            stats.lastModified = subStats.lastModified;
          }
          for (const [ext, data] of Object.entries(subStats.fileTypes)) {
            if (!stats.fileTypes[ext]) stats.fileTypes[ext] = {
              count: 0,
              size: 0
            };
            stats.fileTypes[ext].count += data.count;
            stats.fileTypes[ext].size += data.size;
          }
        }
      } else if (entry.isFile() && hasAllowedExtension(entry.name)) {
        if (!(await isExcluded(entryRelativePath))) {
          const fileStats = await fs.stat(fullPath);
          const ext = path.extname(entry.name).toLowerCase();
          stats.files++;
          stats.size += fileStats.size;
          if (!stats.lastModified || fileStats.mtime > stats.lastModified) {
            stats.lastModified = fileStats.mtime;
          }
          if (!stats.fileTypes[ext]) stats.fileTypes[ext] = {
            count: 0,
            size: 0
          };
          stats.fileTypes[ext].count++;
          stats.fileTypes[ext].size += fileStats.size;
        }
      }
    }
  } catch (error) {
    debug('Error aggregating stats for', dirPath, error);
  }
  return stats;
}
async function getApiStats() {
  return {
    version: process.env.npm_package_version,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
    node: process.version
  };
}
/* 
 * @swagger
 * /api/stats:
 *   get:
 *     summary: Show API statistics
 *     responses:
 *       200:
 *         description: Statistics showing information about the API
 *         content:
 *           application/json:
 */
router.get('/', async (req, res) => {
  try {
    const stats = {
      api: await getApiStats(),
      collections: {
        total: 0,
        totalSize: 0,
        totalFiles: 0,
        totalDirectories: 0,
        averageFileSize: 0,
        fileTypes: {},
        details: {},
      }
    };
    const collections = await fs.readdir(GALLERY_DL_DIR);
    await Promise.all(collections.map(async collection => {
      const collectionPath = path.join(GALLERY_DL_DIR, collection);
      const dirStats = await fs.stat(collectionPath);
      if (dirStats.isDirectory() && !(await isExcluded(collection))) {
        stats.collections.totalDirectories++;
        const summary = await aggregateStats(collectionPath);
        stats.collections.details[collection] = {
          files: summary.files,
          size: summary.size,
          lastModified: summary.lastModified,
          fileTypes: summary.fileTypes,
        };
        stats.collections.totalFiles += summary.files;
        stats.collections.totalSize += summary.size;
        for (const [ext, data] of Object.entries(summary.fileTypes)) {
          if (!stats.collections.fileTypes[ext]) stats.collections.fileTypes[ext] = {
            count: 0,
            size: 0
          };
          stats.collections.fileTypes[ext].count += data.count;
          stats.collections.fileTypes[ext].size += data.size;
        }
      }
    }));
    stats.collections.total = Object.keys(stats.collections.details).length;
    if (stats.collections.totalFiles > 0) {
      stats.collections.averageFileSize = stats.collections.totalSize / stats.collections.totalFiles;
    }
    stats.collections.fileTypes = sortFileTypes(stats.collections.fileTypes);
    stats.api.memory.formatted = {
      heapUsed: stats.api.memory.heapUsed,
      rss: stats.api.memory.rss,
    };
    debug('Stats refresh complete:', {
      collections: stats.collections.total,
      files: stats.collections.totalFiles,
      size: stats.collections.size
    });
    res.json(stats);
  } catch (error) {
    debug('Error generating stats:', error);
    res.status(500).json({
      message: 'Internal Server Error',
      status: 500
    });
  }
});
function sortFileTypes(fileTypes) {
  return Object.fromEntries(
    Object.entries(fileTypes)
    .sort(([, a], [, b]) => b.count - a.count)
    .map(([ext, data]) => [
      ext,
      {
        ...data,
      }
    ])
  );
}
module.exports = router;