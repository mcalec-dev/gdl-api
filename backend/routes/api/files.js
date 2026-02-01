const router = require('express').Router()
const path = require('path')
const { requireRole } = require('../../utils/authUtils')
const fs = require('fs').promises
const debug = require('debug')('gdl-api:api:files')
const {
  BASE_DIR,
  AUTO_SCAN,
  DISALLOWED_FILES,
  PAGINATION_LIMIT,
  UPSERT_ON_ACCESS,
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
  maybeUpsertAccessed,
  sortContents,
  parseSortQuery,
  formatListingEntry,
  createDbEntriesForContents,
  initializeDatabaseSync,
  batchFetchFileMetadata,
} = require('../../utils/fileUtils')
const {
  safePath,
  validateRequestParams,
  isSubPath,
} = require('../../utils/pathUtils')
const { resizeImage } = require('../../utils/imageUtils')
if (AUTO_SCAN === true) initializeDatabaseSync()
else if (!AUTO_SCAN || AUTO_SCAN === false) debug('Skipping full database sync')
router.get('/', requireRole('user'), async (req, res) => {
  if (!req.user) {
    debug('User not authenticated')
    return res.status(403).json({
      message: 'Forbidden',
      status: 403,
    })
  }
  try {
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
      await maybeUpsertAccessed(normalizedDir, true)
    } catch (error) {
      debug('Failed to read root directory:', error)
      return res.status(500).json({
        message: 'Internal Server Error',
        status: 500,
      })
    }
    const shouldFetchMetadata = req.query.meta === 'true'
    let metadataMap = {}
    if (shouldFetchMetadata) {
      const fileRelativePaths = entries
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
      if (fileRelativePaths.length > 0) {
        metadataMap = await batchFetchFileMetadata(fileRelativePaths)
      }
    }
    const results = await Promise.all(
      entries.map((entry) =>
        formatListingEntry(
          entry,
          normalizedDir,
          normalizedDir,
          req,
          false,
          metadataMap
        )
      )
    )
    const filteredResults = results.filter(Boolean)
    const files = filteredResults.filter((entry) => entry.type === 'file')
    const { sortBy, direction } = parseSortQuery(req.query)
    const sortedFiltered = sortContents(filteredResults, sortBy, direction)
    const sortedFiles = sortContents(files, sortBy, direction)
    const limitRaw = parseInt(req.query.limit, 10)
    let paginatedFiltered = sortedFiltered
    let paginatedFiles = sortedFiles
    if (!isNaN(limitRaw) && limitRaw > 0) {
      const limit = Math.min(limitRaw, PAGINATION_LIMIT)
      const pageRaw = parseInt(req.query.page, 10)
      const page = isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw
      const start = (page - 1) * limit
      paginatedFiltered = sortedFiltered.slice(start, start + limit)
      paginatedFiles = sortedFiles.slice(start, start + limit)
    }
    if (req.user) {
      res.json(paginatedFiltered)
      setImmediate(() => {
        createDbEntriesForContents(filteredResults, '').catch((err) =>
          debug('Background DB sync failed:', err)
        )
      })
    } else {
      res.json(paginatedFiles)
      if (sortedFiles.length) {
        setImmediate(() => {
          createDbEntriesForContents(sortedFiles, '').catch((err) =>
            debug('Background DB sync failed:', err)
          )
        })
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
      debug(error)
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
        if (UPSERT_ON_ACCESS !== 'file') {
          await maybeUpsertAccessed(realPath, true)
        }
      } catch (error) {
        debug(error)
        return res.status(500).json({
          message: 'Internal Server Error',
          status: 500,
        })
      }
      const shouldFetchMetadata = req.query.includeMetadata === 'true'
      let metadataMap = {}
      if (shouldFetchMetadata) {
        const fileRelativePaths = entries
          .filter((entry) => entry.isFile())
          .map((entry) => {
            const entryRelPath = path
              .relative(normalizedDir, path.join(realPath, entry.name))
              .replace(/\\/g, '/')
            return entryRelPath
          })
        if (fileRelativePaths.length > 0) {
          metadataMap = await batchFetchFileMetadata(fileRelativePaths)
        }
      }
      const formattedContents = await Promise.all(
        entries.map((entry) =>
          formatListingEntry(
            entry,
            realPath,
            normalizedDir,
            req,
            true,
            metadataMap
          )
        )
      )
      const validContents = formattedContents.filter(Boolean)
      const { sortBy, direction } = parseSortQuery(req.query)
      const sorted = sortContents(validContents, sortBy, direction)
      const limitRawDir = parseInt(req.query.limit, 10)
      if (!isNaN(limitRawDir) && limitRawDir > 0) {
        const limit = Math.min(limitRawDir, PAGINATION_LIMIT)
        const pageRaw = parseInt(req.query.page, 10)
        const page = isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw
        const start = (page - 1) * limit
        const paginated = sorted.slice(start, start + limit)
        res.json(paginated)
      } else {
        res.json(sorted)
      }
      if (validContents.length && UPSERT_ON_ACCESS !== 'file') {
        setImmediate(() => {
          createDbEntriesForContents(validContents, relativePath).catch((err) =>
            debug('Background DB sync failed:', err)
          )
        })
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
      if (isImageFile(realPath) === true) {
        try {
          const kernel =
            typeof req.query.kernel === 'string' ? req.query.kernel : undefined
          const scale =
            typeof req.query.x === 'string'
              ? parseFloat(req.query.x)
              : undefined
          const resizeOptions = {}
          if (!kernel && req.query.kernel) {
            debug('Invalid kernel parameter provided:', req.query.kernel)
            res.status(400).json({
              message: 'Invalid kernel parameter',
              status: 400,
            })
            return
          }
          if (!scale && req.query.x) {
            debug('Invalid scale parameter provided:', req.query.x)
            res.status(400).json({
              message: 'Invalid scale parameter',
              status: 400,
            })
            return
          }
          if (scale) resizeOptions.scale = scale
          if (kernel) resizeOptions.kernel = kernel
          if (!isNaN(scale) && scale > 0 && scale !== 100) {
            debug('Resizing image with scale:', scale)
          }
          const transformer = await resizeImage(realPath, resizeOptions)
          if (transformer === undefined) {
            debug('No resizing needed, sending original file')
            await maybeUpsertAccessed(realPath, false)
            return res.sendFile(realPath)
          }
          if (transformer) {
            res.type(path.extname(realPath).slice(1))
            await maybeUpsertAccessed(realPath, false)
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
          debug(error)
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
          await maybeUpsertAccessed(realPath, false)
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
            await maybeUpsertAccessed(realPath, false)
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
              await maybeUpsertAccessed(realPath, false)
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
        await maybeUpsertAccessed(realPath, false)
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
