const express = require('express')
const router = express.Router()
const path = require('path')
const fs = require('fs').promises
const debug = require('debug')('gdl-api:api:random')
const {
  GALLERY_DL_DIR,
  DISALLOWED_DIRS,
  DISALLOWED_FILES,
  DISALLOWED_EXTENSIONS,
} = require('../../config')
const { hasAllowedExtension, isExcluded } = require('../../utils/fileUtils')
const { getUserPermission } = require('../../utils/authUtils')
const NodeCache = require('node-cache')
const fileListCache = new NodeCache({ stdTTL: 3600 * 24, checkperiod: 3600 }) // 24 hours TTL, check every hour
const isDisallowedExtension = (filename) => {
  const ext = path.extname(filename).toLowerCase()
  return DISALLOWED_EXTENSIONS.some(
    (disallowedExt) =>
      ext === disallowedExt.toLowerCase() ||
      ext === `.${disallowedExt.toLowerCase()}`
  )
}

// Function to refresh the cache periodically
async function refreshCache() {
  debug('Refreshing file list cache')
  const permissions = ['default', 'admin', 'all'] // Add all possible permissions
  for (const permission of permissions) {
    const cacheKey = `fileList_${permission}`
    try {
      const files = await getAllImagesInDirectory(GALLERY_DL_DIR, permission, 0)
      fileListCache.set(cacheKey, files)
      debug(`File list cache refreshed for ${cacheKey}`)
    } catch (error) {
      debug(`Error refreshing file list cache for ${cacheKey}:`, error)
    }
  }
}
refreshCache()
  .then(() => {
    debug('Initial cache population completed')
  })
  .catch((error) => {
    debug('Error during initial cache population:', error)
  })
setInterval(refreshCache, 30 * 60 * 1000)
async function getCachedFileList(permission) {
  const cacheKey = `fileList_${permission}`
  let files = fileListCache.get(cacheKey)
  if (files === undefined) {
    return []
  }
  return files
}
async function getRandomImagePath(permission) {
  const files = await getCachedFileList(permission)
  if (files.length === 0) {
    throw new Error('No files available')
  }
  const randomIndex = Math.floor(Math.random() * files.length)
  return files[randomIndex]
}
/**
 * @swagger
 * /api/random:
 *   get:
 *     summary: Get a random file
 *     responses:
 *       200:
 *         description: Show a random file
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 file:
 *                   type: string
 *                 path:
 *                   type: string
 *                 collection:
 *                   type: string
 *                 author:
 *                   type: string
 *                 size:
 *                   type: integer
 *                 url:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 type:
 *                   type: string
 */
router.get('/', async (req, res) => {
  debug('Random image request received')
  try {
    const permission = await getUserPermission(req)
    const randomImage = await getRandomImagePath(permission)
    let stats = { size: randomImage.size }
    // Only call fs.stat if size is missing
    if (typeof randomImage.size !== 'number') {
      try {
        const statResult = await fs.stat(randomImage.path)
        stats.size = statResult.size
      } catch {
        stats.size = null
      }
    }

    const relativePath = path
      .relative(GALLERY_DL_DIR, randomImage.path)
      .replace(/\\/g, '/')
    const pathParts = relativePath.split('/')
    const baseUrl = `${req.protocol}://${req.get('host')}`
    const collection = pathParts[0]
    const author = pathParts[1] || ''
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.json({
      file: path.basename(randomImage.path),
      path: `/gdl/api/files/${relativePath}`,
      collection: collection,
      author: author,
      size: stats.size,
      url: `${baseUrl}/gdl/api/files/${relativePath}`,
      timestamp: new Date().toISOString(),
      type:
        randomImage.type ||
        path.extname(randomImage.path).slice(1).toLowerCase() ||
        'unknown',
    })
    debug('Random image request completed')
  } catch (error) {
    debug('Error getting random image:', error)
    res.status(500).json({
      message: 'Internal Server Error',
      status: 500,
    })
  }
})
async function getAllImagesInDirectory(dir, permission = 'default', depth = 0) {
  if (depth >= 10) return []
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    const BATCH_SIZE = 10
    let results = []
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE)
      const batchResults = await Promise.all(
        batch.map(async (entry) => {
          const fullPath = path.join(dir, entry.name)
          const relativePath = path.relative(GALLERY_DL_DIR, fullPath)
          if (
            (await isExcluded(relativePath, permission)) ||
            DISALLOWED_DIRS.includes(entry.name) ||
            (entry.isFile() &&
              (DISALLOWED_FILES.includes(entry.name) ||
                isDisallowedExtension(entry.name)))
          ) {
            return null
          }
          if (entry.isDirectory()) {
            return await getAllImagesInDirectory(
              fullPath,
              permission,
              depth + 1
            )
          }
          if (entry.isFile() && hasAllowedExtension(fullPath, permission)) {
            try {
              const stats = await fs.stat(fullPath)
              return {
                path: fullPath,
                size: stats.size,
                type:
                  path.extname(fullPath).slice(1).toLowerCase() || 'unknown',
              }
            } catch {
              return null
            }
          }
          return null
        })
      )
      for (const result of batchResults) {
        if (Array.isArray(result)) {
          results.push(...result)
        } else if (result) {
          results.push(result)
        }
      }
    }
    return results
  } catch (error) {
    debug('Error scanning directory:', dir, error)
    return []
  }
}

module.exports = router
