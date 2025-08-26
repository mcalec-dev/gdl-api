const express = require('express')
const router = express.Router()
const path = require('path')
const fs = require('fs').promises
const debug = require('debug')('gdl-api:api:random')
const {
  BASE_DIR,
  DISALLOWED_DIRS,
  DISALLOWED_FILES,
  DISALLOWED_EXTENSIONS,
  BASE_PATH,
} = require('../../config')
const { hasAllowedExtension, isExcluded } = require('../../utils/fileUtils')
const { requireRole } = require('../../utils/authUtils')
const NodeCache = require('node-cache')
const fileListCache = new NodeCache({
  stdTTL: 3600 * 24,
  checkperiod: 3600,
  maxKeys: 1000000,
})
const DISALLOWED_EXTENSIONS_SET = new Set(
  DISALLOWED_EXTENSIONS.map((ext) =>
    ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`
  )
)
const DISALLOWED_DIRS_SET = new Set(DISALLOWED_DIRS)
const DISALLOWED_FILES_SET = new Set(DISALLOWED_FILES)
const isDisallowedExtension = (filename) => {
  const ext = path.extname(filename).toLowerCase()
  return DISALLOWED_EXTENSIONS_SET.has(ext)
}
let fsWatchers = new Map()
function setupFileWatcher(dirPath) {
  if (fsWatchers.has(dirPath)) return
  try {
    const watcher = fs.watch(
      dirPath,
      { recursive: false },
      (eventType, filename) => {
        if (filename && (eventType === 'rename' || eventType === 'change')) {
          debug(`File system change detected in ${dirPath}: ${filename}`)
          debouncedCacheRefresh()
        }
      }
    )
    fsWatchers.set(dirPath, watcher)
  } catch (error) {
    debug(`Could not watch directory ${dirPath}:`, error.message)
  }
}
let refreshTimeout = null
const debouncedCacheRefresh = () => {
  if (refreshTimeout) clearTimeout(refreshTimeout)
  refreshTimeout = setTimeout(() => {
    refreshCache().catch((error) =>
      debug('Debounced cache refresh error:', error)
    )
  }, 5000)
}
async function refreshCache() {
  debug('Refreshing file list cache')
  const startTime = Date.now()
  try {
    const files = await getAllImagesInDirectory(BASE_DIR)
    const cacheKey = 'randomFileListCache'
    fileListCache.set(cacheKey, files)
    const duration = Date.now() - startTime
    debug(`File list cache refreshed: ${files.length} files in ${duration}ms`)
  } catch (error) {
    debug('Error refreshing file list cache:', error)
  }
}
async function initializeCache() {
  try {
    await refreshCache()
    debug('Initial cache population completed')
  } catch (error) {
    debug('Error during initial cache population:', error)
    fileListCache.set('randomFileListCache', [])
  }
}
initializeCache()
setInterval(refreshCache, 30 * 60 * 1000)
async function getCachedFileList() {
  const cacheKey = 'randomFileListCache'
  let files = fileListCache.get(cacheKey)
  if (files === undefined) {
    debug('Cache miss, attempting to rebuild')
    try {
      await refreshCache()
      files = fileListCache.get(cacheKey) || []
    } catch (error) {
      debug('Cache rebuild failed:', error)
      return []
    }
  }
  return files
}
async function getRandomImagePath() {
  const files = await getCachedFileList()
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
router.get(['/', ''], requireRole('user'), async (req, res) => {
  if (!req.user) {
    debug('Unauthorized access attempt')
    return res.status(401).json({
      message: 'Unauthorized',
      status: 401,
    })
  }
  debug('Random image request received')
  try {
    const randomImage = await getRandomImagePath()
    let stats = { size: randomImage.size }
    if (typeof randomImage.size !== 'number') {
      try {
        const statResult = await fs.stat(randomImage.path)
        stats.size = statResult.size
        randomImage.size = statResult.size
      } catch {
        stats.size = null
      }
    }
    const relativePath = path
      .relative(BASE_DIR, randomImage.path)
      .replace(/\\/g, '/')
    const pathParts = relativePath.split('/')
    const baseUrl = `${req.protocol}://${req.get('host')}`
    const collection = pathParts[0]
    const author = pathParts[1] || ''
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.json({
      file: path.basename(randomImage.path),
      path: `/api/files/${relativePath}`,
      collection: collection,
      author: author,
      size: stats.size,
      url: `${baseUrl}${BASE_PATH}/api/files/${relativePath}`,
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
async function getAllImagesInDirectory(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    const BATCH_SIZE = 500
    let results = []
    setupFileWatcher(dir)
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE)
      const batchResults = await Promise.all(
        batch.map(async (entry) => {
          const fullPath = path.join(dir, entry.name)
          const relativePath = path.relative(BASE_DIR, fullPath)
          if (
            DISALLOWED_DIRS_SET.has(entry.name) ||
            (entry.isFile() &&
              (DISALLOWED_FILES_SET.has(entry.name) ||
                isDisallowedExtension(entry.name) ||
                !hasAllowedExtension(fullPath)))
          ) {
            return null
          }
          if (await isExcluded(relativePath)) {
            return null
          }
          if (entry.isDirectory()) {
            return await getAllImagesInDirectory(fullPath)
          }
          if (entry.isFile()) {
            return {
              path: fullPath,
              size: null,
              type: path.extname(fullPath).slice(1).toLowerCase() || 'other',
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