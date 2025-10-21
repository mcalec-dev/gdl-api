// there is so much filler code in the endpoints that is not needed at all
// so beware :sob:
const router = require('express').Router()
const path = require('path')
const Directory = require('../../models/Directory')
const File = require('../../models/File')
const { requireRole } = require('../../utils/authUtils')
const fs = require('fs').promises
const debug = require('debug')('gdl-api:api:files')
const uuid = require('uuid')
const {
  BASE_DIR,
  DISALLOWED_DIRS,
  DISALLOWED_FILES,
  BASE_PATH,
  AUTO_SCAN,
} = require('../../config')
const {
  isExcluded,
  hasAllowedExtension,
  isDocFile,
  isImageFile,
  isVideoFile,
  isAudioFile,
  isDisallowedExtension,
  getFileMime,
  upsertAccessedItem,
} = require('../../utils/fileUtils')
const {
  safePath,
  validateRequestParams,
  safeApiPath,
  isSubPath,
} = require('../../utils/pathUtils')
const { resizeImage, getImageMeta } = require('../../utils/imageUtils')
async function upsertDirectoryEntry(dirObj) {
  try {
    const filter = { 'paths.relative': dirObj.paths.relative }
    let existing = await Directory.findOne(filter)
    if (!existing) {
      dirObj.uuid = uuid.v4()
    } else {
      dirObj.uuid = existing.uuid
    }
    await Directory.findOneAndUpdate(
      filter,
      { $set: dirObj },
      { upsert: true, new: true }
    )
  } catch (error) {
    debug('Error upserting directory entry:', error)
  }
}
async function upsertFileEntry(fileObj) {
  try {
    const filter = { 'paths.relative': fileObj.paths.relative }
    let existing = await File.findOne(filter)
    if (!existing) {
      fileObj.uuid = uuid.v4()
    } else {
      fileObj.uuid = existing.uuid
    }
    await File.findOneAndUpdate(
      filter,
      { $set: fileObj },
      { upsert: true, new: true }
    )
  } catch (error) {
    debug('Error upserting file entry:', error)
  }
}
async function getDirectorySize(dirPath) {
  let total = 0
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        total += await getDirectorySize(entryPath)
      } else if (entry.isFile()) {
        try {
          const stats = await fs.stat(entryPath)
          total += stats.size
        } catch (error) {
          debug('Error getting file stats:', error)
        }
      }
    }
  } catch (error) {
    debug('Error reading directory:', dirPath, error)
    return 0
  }
  return total
}
async function syncAllFilesToDatabase() {
  try {
    debug('Starting comprehensive database sync...')
    const stats = await fs.stat(BASE_DIR)
    if (!stats.isDirectory()) {
      throw new Error(`${BASE_DIR} is not a directory`)
    }
    await scanAndSyncDirectory(BASE_DIR, '')
    debug('Database sync completed successfully')
    return {
      success: true,
      message: 'All files and directories synced to database',
    }
  } catch (error) {
    debug('Error during database sync:', error)
    return {
      success: false,
      message: `Database sync failed: ${error.message}`,
    }
  }
}
async function scanAndSyncDirectory(dirPath, relativePath = '') {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name)
      const entryRelativePath = relativePath
        ? `${relativePath}/${entry.name}`
        : entry.name
      if (
        (await isExcluded(entry.name)) ||
        (await isExcluded(entryRelativePath)) ||
        DISALLOWED_DIRS.includes(entry.name) ||
        (entry.isFile() &&
          (DISALLOWED_FILES.includes(entry.name) ||
            isDisallowedExtension(entry.name)))
      ) {
        debug(`Skipping excluded item: ${entryRelativePath}`)
        continue
      }
      let size = 0
      let mtime = new Date()
      let ctime = new Date()
      try {
        const stats = await fs.stat(entryPath)
        mtime = stats.mtime
        ctime = stats.birthtime
        if (entry.isDirectory()) {
          size = await getDirectorySize(entryPath)
        } else {
          size = stats.size
        }
      } catch (statError) {
        debug(`Error getting stats for ${entryPath}:`, statError)
        continue
      }
      const encodedPath = entryRelativePath
        .split('/')
        .map(encodeURIComponent)
        .join('/')
      const remotePath = `${BASE_PATH}/api/files/${encodedPath}`.replace(
        /\/+/g,
        '/'
      )
      if (entry.isDirectory()) {
        await upsertDirectoryEntry({
          name: entry.name,
          paths: {
            local: entryPath.replace(/\\/g, '/'),
            relative: entryRelativePath,
            remote: remotePath,
          },
          size: size,
          created: ctime,
          modified: mtime,
        })
        await scanAndSyncDirectory(entryPath, entryRelativePath)
      } else if (entry.isFile()) {
        if (!hasAllowedExtension(entryPath)) {
          debug(`Skipping file with disallowed extension: ${entryRelativePath}`)
          continue
        }
        let metadata = {}
        if (isImageFile(entryPath)) {
          try {
            metadata = await getImageMeta(entryPath)
          } catch (metaError) {
            debug(`Error getting image metadata for ${entryPath}:`, metaError)
          }
        }
        const pathParts = entryRelativePath.split('/')
        const collection = pathParts.length > 1 ? pathParts[0] : null
        const author = pathParts.length > 2 ? pathParts[1] : null
        await upsertFileEntry({
          name: entry.name,
          paths: {
            local: entryPath.replace(/\\/g, '/'),
            relative: entryRelativePath,
            remote: remotePath,
          },
          collection: collection,
          author: author,
          size: size,
          type: 'file',
          created: ctime,
          modified: mtime,
          meta: metadata,
        })
      }
    }
  } catch (error) {
    debug(`Error scanning directory ${dirPath}:`, error)
    throw error
  }
}
async function initializeDatabaseSync() {
  try {
    debug('Initializing database sync...')
    await syncAllFilesToDatabase()
  } catch (error) {
    debug('Failed to initialize database sync:', error)
  }
}
if (AUTO_SCAN === true) {
  debug('Starting full database sync')
  initializeDatabaseSync()
}
if (AUTO_SCAN === false) {
  debug('Skipping full database sync')
}
async function createDbEntriesForContents(items, parentPath = '') {
  try {
    for (const item of items) {
      const apiPrefix = `${BASE_PATH}/api/files`
      const relPath = parentPath ? `${parentPath}/${item.name}` : item.name
      const dbPath = `${apiPrefix}/${relPath}`.replace(/\/+/g, '/')
      const localPath = path.join(BASE_DIR, relPath)
      const getMetadata = await getImageMeta(localPath)
      if (item.type === 'directory') {
        await upsertDirectoryEntry({
          name: item.name,
          paths: {
            local: localPath,
            relative: relPath,
            remote: dbPath,
          },
          size: item.size || 0,
          created: item.created || null,
          modified: item.modified || null,
        })
        if (item.contents) {
          await createDbEntriesForContents(item.contents, relPath)
        }
      }
      if (item.type === 'file') {
        await upsertFileEntry({
          name: item.name,
          paths: {
            local: `${BASE_DIR}/${relPath}`,
            relative: relPath,
            remote: dbPath,
          },
          size: item.size || 0,
          type: item.type || null,
          collection: item.collection || null,
          author: item.author || null,
          created: item.created || null,
          modified: item.modified || null,
          meta: { ...getMetadata },
        })
      }
    }
  } catch (error) {
    debug('Error creating DB entries for contents:', error)
  }
}
/**
 * @swagger
 * /api/files/:
 *   get:
 *     summary: Get all files
 */
router.get(['', '/'], requireRole('user'), async (req, res) => {
  if (!req.user) {
    debug('User not authenticated')
    return res.status(403).json({
      message: 'Forbidden',
      status: 403,
    })
  }
  try {
    // stop using so many consts in this endpoint
    // use let instead
    const normalizedDir = path.resolve(BASE_DIR)
    const stats = await fs.stat(normalizedDir)
    if (!stats.isDirectory()) {
      debug(normalizedDir, 'is not a directory')
      return res.status(500).json({
        message: 'Internal Server Error',
        status: 500,
      })
    }
    let entries = []
    try {
      entries = await fs.readdir(normalizedDir, { withFileTypes: true })
      debug(`Found ${entries.length} entries in root directory`)
      if (AUTO_SCAN === false) {
        debug('Upserting accessed root directory')
        await upsertAccessedItem(normalizedDir)
      }
    } catch (error) {
      debug('Failed to read root directory:', error)
      return res.status(500).json({
        message: 'Internal Server Error',
        status: 500,
      })
    }
    const results = await Promise.all(
      entries.map(async (entry) => {
        if (
          (await isExcluded(entry.name)) ||
          DISALLOWED_DIRS.includes(entry.name) ||
          (entry.isFile() &&
            (DISALLOWED_FILES.includes(entry.name) ||
              isDisallowedExtension(entry.name)))
        ) {
          debug(`Excluded entry: ${entry.name}`)
          return null
        }
        const entryPath = safePath(normalizedDir, entry.name)
        if (!entryPath || !isSubPath(entryPath, normalizedDir)) {
          debug(`Skipping unsafe entry: ${entry.name}`)
          return null
        }
        let size = 0
        let mtime = new Date()
        let ctime = new Date()
        try {
          const stats = await fs.stat(entryPath)
          if (entry.isDirectory()) {
            size = await getDirectorySize(entryPath)
          } else {
            size = stats.size
          }
          mtime = stats.mtime
          ctime = stats.birthtime
        } catch {
          return null
        }
        const relativePath = path
          .relative(normalizedDir, entryPath)
          .replace(/\\/g, '/')
        const pathParts = relativePath.split('/')
        const collection = pathParts.length > 0 ? pathParts[0] : null
        const author = pathParts.length > 1 ? pathParts[1] : null
        let fullPath = safeApiPath(`${BASE_PATH}/api/files`, relativePath)
        fullPath = fullPath.replace(/([^:])\/\//g, '$1/')
        if (/\.[a-zA-Z0-9]+\/$/.test(fullPath)) {
          fullPath = fullPath.replace(/(\.[a-zA-Z0-9]+)\/$/, '$1')
        }
        const url = req.protocol + '://' + req.hostname + fullPath
        return {
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : 'file',
          size: size,
          modified: mtime,
          created: ctime,
          path: fullPath,
          url,
          collection,
          author,
        }
      })
    )
    const filteredResults = results.filter(Boolean)
    const files = filteredResults.filter((entry) => entry.type === 'file')
    if (req.user) {
      res.json(filteredResults)
      if (filteredResults.length) {
        await createDbEntriesForContents(filteredResults, '')
      }
    } else {
      res.json(files)
      if (files.length) {
        await createDbEntriesForContents(files, '')
      }
    }
  } catch (error) {
    debug('Error in root directory listing:', error)
    res.status(500).json({
      message: 'Internal Server Error',
      status: 500,
    })
  }
})
router.get(
  [
    '/:collection/',
    '/:collection/*',
    '/:collection/:author/',
    '/:collection/:author/*',
  ],
  async (req, res) => {
    // same here with having so many consts
    // const chaining i think its called
    // a normal person would use let
    const validatedParams = validateRequestParams(req.params)
    if (!validatedParams.isValid) {
      debug('Invalid path parameters provided:', req.params)
      return res.status(400).json({
        message: 'Invalid path parameters',
        status: 400,
      })
    }
    const { collection, author, additionalPath } = validatedParams
    const normalizedDir = path.resolve(BASE_DIR)
    const pathComponents = [collection, author, additionalPath]
      .filter(Boolean)
      .map((component) => {
        try {
          return decodeURIComponent(component)
        } catch (error) {
          debug('Failed to decode URI component:', component, error)
          return component
        }
      })
    let realPath = safePath(normalizedDir, ...pathComponents)
    if (!realPath) {
      debug(
        'Path construction resulted in unsafe path for components:',
        pathComponents
      )
      return res.status(403).json({
        message: 'Forbidden',
        status: 403,
      })
    }
    if (!isSubPath(realPath, normalizedDir)) {
      debug(`Path safety check failed: ${realPath} not within ${normalizedDir}`)
      return res.status(403).json({
        message: 'Forbidden',
        status: 403,
      })
    }
    const relativePath = path
      .relative(normalizedDir, realPath)
      .replace(/\\/g, '/')
    if (await isExcluded(relativePath)) {
      debug(`Access denied to: ${relativePath}`)
      return res.status(404).json({
        message: 'Not Found',
        status: 404,
      })
    }
    try {
      await fs.access(realPath)
    } catch (error) {
      debug(`Path not found: ${realPath}`, error)
      return res.status(404).json({
        message: 'Not Found',
        status: 404,
      })
    }
    const stats = await fs.stat(realPath)
    if (stats.isDirectory()) {
      if (!req.user) {
        return res.status(403).json({
          message: 'Forbidden',
          status: 403,
        })
      }
      let entries = []
      try {
        entries = await fs.readdir(realPath, { withFileTypes: true })
        debug(`Found ${entries.length} entries in directory`)
        if (AUTO_SCAN === false) {
          debug('Upserting accessed directory:', realPath)
          await upsertAccessedItem(realPath)
        }
      } catch (error) {
        debug('Failed to read directory:', error)
        return res.status(500).json({
          message: 'Internal Server Error',
          status: 500,
        })
      }
      const formattedContents = await Promise.all(
        entries.map(async (entry) => {
          const entryPath = safePath(realPath, entry.name)
          if (!entryPath || !isSubPath(entryPath, normalizedDir)) {
            debug(`Skipping unsafe entry path: ${entry.name}`)
            return null
          }
          const entryRelativePath = path
            .relative(normalizedDir, entryPath)
            .replace(/\\/g, '/')
          if (
            (await isExcluded(entryRelativePath)) ||
            DISALLOWED_DIRS.includes(entry.name) ||
            (entry.isFile() &&
              (DISALLOWED_FILES.includes(entry.name) ||
                isDisallowedExtension(entry.name)))
          ) {
            debug(`Excluded entry: ${entryRelativePath}`)
            return null
          }
          const isDir = entry.isDirectory()
          let size = 0
          let mtime = new Date()
          let ctime = new Date()
          try {
            const stats = await fs.stat(entryPath)
            if (isDir) {
              size = await getDirectorySize(entryPath)
            } else {
              size = stats.size
            }
            mtime = stats.mtime
            ctime = stats.birthtime
          } catch {
            return null
          }
          const pathParts = entryRelativePath.split('/')
          const collectionVal = pathParts.length > 0 ? pathParts[0] : null
          const authorVal = pathParts.length > 1 ? pathParts[1] : null
          let fullPath = safeApiPath(
            `${BASE_PATH}/api/files`,
            entryRelativePath
          )
          fullPath = fullPath.replace(/([^:])\/\//g, '$1/')
          if (/\.[a-zA-Z0-9]+\/$/.test(fullPath)) {
            fullPath = fullPath.replace(/(\.[a-zA-Z0-9]+)\/$/, '$1')
          }
          const url = req.protocol + '://' + req.hostname + fullPath
          const mime = isDir ? 'n/a' : await getFileMime(entry.name)
          return {
            name: entry.name,
            type: isDir ? 'directory' : 'file',
            size,
            modified: mtime,
            created: ctime,
            path: fullPath,
            collection: collectionVal,
            author: authorVal,
            mime,
            url,
          }
        })
      )
      const validContents = formattedContents.filter(Boolean)
      res.json(validContents)
      if (validContents.length) {
        await createDbEntriesForContents(validContents, relativePath)
      }
    } else {
      if (
        !hasAllowedExtension(realPath) ||
        DISALLOWED_FILES.includes(path.basename(realPath)) ||
        isDisallowedExtension(path.basename(realPath))
      ) {
        debug(`Access denied to file: ${realPath}`)
        return res.status(404).json({
          message: 'Not Found',
          status: 404,
        })
      }
      const scaleMatch = req.url.match(/\?x=(\d+)/)
      if (isImageFile(realPath)) {
        let scale = null
        if (scaleMatch) {
          scale = parseInt(scaleMatch[1])
        }
        try {
          const transformer = await resizeImage(
            realPath,
            !scaleMatch || isNaN(scale) || scale <= 0 || scale === 100
              ? {}
              : { scale }
          )
          if (transformer) {
            res.type(path.extname(realPath).slice(1))
            if (AUTO_SCAN === false) {
              debug('Upserting accessed file:', realPath)
              await upsertAccessedItem(realPath)
            }
            transformer.pipe(res)
            return
          }
          if (transformer === null) {
            debug('Failure resizing image')
            return res.status(500).json({
              message: 'Internal Server Error',
              status: 500,
            })
          }
        } catch (error) {
          debug('Error resizing image:', error)
          return res.status(500).json({
            message: 'Internal Server Error',
            status: 500,
          })
        }
      }
      if (isVideoFile(realPath) || isAudioFile(realPath)) {
        if (!req.headers.range) {
          debug(
            'Request does not have any range headers - sending file instead'
          )
          if (AUTO_SCAN === false) {
            debug('Upserting accessed file:', realPath)
            await upsertAccessedItem(realPath)
          }
          return res.sendFile(realPath)
        }
        try {
          const stat = await fs.stat(realPath)
          const fileSize = stat.size
          const range = req.headers.range
          const mimeType = await getFileMime(realPath)
          if (range) {
            const parts = range.replace(/bytes=/, '').split('-')
            const start = parseInt(parts[0], 10)
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
            const chunksize = end - start + 1
            const fileStream = require('fs').createReadStream(realPath, {
              start,
              end,
            })
            if (AUTO_SCAN === false) {
              debug('Upserting accessed file:', realPath)
              await upsertAccessedItem(realPath)
            }
            res.writeHead(206, {
              'Content-Range': `bytes ${start}-${end}/${fileSize}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': chunksize,
              'Content-Type': mimeType,
            })
            fileStream.pipe(res)
          } else {
            res.writeHead(200, {
              'Content-Length': fileSize,
              'Content-Type': mimeType,
              'Accept-Ranges': 'bytes',
            })
            require('fs').createReadStream(realPath).pipe(res)
          }
          return
        } catch (error) {
          debug('Error streaming media file:', error)
          return res.status(500).json({
            message: 'Internal Server Error',
            status: 500,
          })
        }
      }
      if (isDocFile(realPath)) {
        try {
          require('mammoth')
            .convertToHtml({
              path: realPath,
            })
            .then(async (result) => {
              const html = result.value
              res.set('Content-Type', 'text/html; charset=utf-8')
              res.send(html)
              if (AUTO_SCAN === false) {
                debug('Upserting accessed file:', realPath)
                await upsertAccessedItem(realPath)
              }
            })
        } catch (error) {
          debug('Error in mammoth doc conversion:', error)
          return res.status(500).json({
            message: 'Internal Server Error',
            status: 500,
          })
        }
      }
      try {
        if (AUTO_SCAN === false) {
          debug('Upserting accessed file:', realPath)
          await upsertAccessedItem(realPath)
        }
        res.sendFile(realPath)
      } catch (error) {
        debug('Error in sending file:', error)
        return res.status(500).json({
          message: 'Internal Server Error',
          status: 500,
        })
      }
    }
  }
)
module.exports = router
