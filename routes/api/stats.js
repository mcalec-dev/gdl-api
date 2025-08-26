const express = require('express')
const router = express.Router()
const fs = require('fs').promises
const path = require('path')
const { isExcluded } = require('../../utils/fileUtils')
const { BASE_DIR } = require('../../config')
const { aggregateStats, getApiStats } = require('../../utils/statsUtils')
const debug = require('debug')('gdl-api:api:stats')
const { requireRole } = require('../../utils/authUtils')
/**
 * @swagger
 * /api/stats/:
 *   get:
 *     summary: Get API statistics
 */
router.get(['/', ''], requireRole('user'), async (req, res) => {
  if (!req.user) {
    debug('Unauthorized access attempt')
    return res.status(401).json({
      message: 'Unauthorized',
      status: 401,
    })
  }
  try {
    const stats = {
      api: await getApiStats(),
      collections: {
        total: 0,
        totalSize: 0,
        totalFiles: 0,
        totalDirectories: 0,
        averageFileSize: 0,
        largestFileSize: 0,
        smallestFileSize: null,
        fileTypes: {},
        details: {},
      },
    }
    const collections = await fs.readdir(BASE_DIR)
    await Promise.all(
      collections.map(async (collection) => {
        const collectionPath = path.join(BASE_DIR, collection)
        const dirStats = await fs.stat(collectionPath)
        if (dirStats.isDirectory() && !(await isExcluded(collection))) {
          stats.collections.totalDirectories++
          const summary = await aggregateStats(collectionPath)
          stats.collections.details[collection] = {
            files: summary.files,
            size: summary.size,
            lastModified: summary.lastModified,
            fileTypes: summary.fileTypes,
            largestFileSize: summary.largestFileSize,
            smallestFileSize: summary.smallestFileSize,
          }
          stats.collections.totalFiles += summary.files
          stats.collections.totalSize += summary.size
          if (summary.largestFileSize > stats.collections.largestFileSize) {
            stats.collections.largestFileSize = summary.largestFileSize
          }
          if (summary.smallestFileSize !== null) {
            if (
              stats.collections.smallestFileSize === null ||
              summary.smallestFileSize < stats.collections.smallestFileSize
            ) {
              stats.collections.smallestFileSize = summary.smallestFileSize
            }
          }
          for (const [ext, data] of Object.entries(summary.fileTypes)) {
            if (!stats.collections.fileTypes[ext])
              stats.collections.fileTypes[ext] = {
                count: 0,
                size: 0,
              }
            stats.collections.fileTypes[ext].count += data.count
            stats.collections.fileTypes[ext].size += data.size
          }
        }
      })
    )
    stats.collections.total = Object.keys(stats.collections.details).length
    if (stats.collections.totalFiles > 0) {
      stats.collections.averageFileSize =
        stats.collections.totalSize / stats.collections.totalFiles
    }
    stats.collections.fileTypes = sortFileTypes(stats.collections.fileTypes)
    stats.api.memory.formatted = {
      heapUsed: stats.api.memory.heapUsed,
      rss: stats.api.memory.rss,
    }
    debug('Stats refresh complete:', {
      collections: stats.collections.total,
      files: stats.collections.totalFiles,
      size: stats.collections.size,
      largestFileSize: stats.collections.largestFileSize,
      smallestFileSize: stats.collections.smallestFileSize,
    })
    res.json(stats)
  } catch (error) {
    debug('Error generating stats:', error)
    res.status(500).json({
      message: 'Internal Server Error',
      status: 500,
    })
  }
})
function sortFileTypes(fileTypes) {
  return Object.fromEntries(
    Object.entries(fileTypes)
      .sort(([, a], [, b]) => b.count - a.count)
      .map(([ext, data]) => [
        ext,
        {
          ...data,
        },
      ])
  )
}
module.exports = router
