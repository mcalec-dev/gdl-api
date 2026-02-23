const router = require('express').Router()
const path = require('path')
const { requireRole } = require('../../utils/authUtils')
const fs = require('fs').promises
const log = require('../../utils/logHandler')
const sendResponse = require('../../utils/resUtils')
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
  isSwfFile,
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
const { resizeImage, applyMetadata } = require('../../utils/imageUtils')
if (AUTO_SCAN === true) initializeDatabaseSync()
else if (!AUTO_SCAN || AUTO_SCAN === false)
  log.debug('Skipping full database sync')
router.get('/', requireRole('user'), async (req, res) => {
  if (!req.user) {
    return sendResponse(res, 401)
  }
  try {
    const normalizedDir = path.resolve(BASE_DIR)
    const stats = await fs.stat(normalizedDir)
    if (!stats.isDirectory()) {
      log.debug(normalizedDir, 'is not a directory')
      return sendResponse(res, 500)
    }
    let entries = []
    try {
      entries = await fs.readdir(normalizedDir, { withFileTypes: true })
      log.debug(`Found ${entries.length} entries in root directory`)
      await maybeUpsertAccessed(normalizedDir, true)
    } catch (error) {
      log.error('Failed to read root directory:', error)
      return sendResponse(res, 500)
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
    const entriesToSync = req.user ? filteredResults : sortedFiles
    try {
      await createDbEntriesForContents(entriesToSync, '')
      const fileRelativePaths = entriesToSync
        .filter((entry) => entry.type === 'file')
        .map((entry) => entry.name)
      const updatedMetadataMap =
        fileRelativePaths.length > 0
          ? await batchFetchFileMetadata(fileRelativePaths)
          : {}
      const updateEntriesWithDbValues = (entries) => {
        return entries.map((entry) => {
          if (entry.type === 'file') {
            const dbMeta = updatedMetadataMap[entry.name]
            return {
              ...entry,
              uuid: dbMeta?.uuid || null,
              hash: dbMeta?.hash || null,
            }
          }
          return entry
        })
      }
      const updatedPaginatedFiltered =
        updateEntriesWithDbValues(paginatedFiltered)
      const updatedPaginatedFiles = updateEntriesWithDbValues(paginatedFiles)
      if (req.user) {
        res.json(updatedPaginatedFiltered)
      } else {
        res.json(updatedPaginatedFiles)
      }
    } catch (syncError) {
      log.error('Error syncing entries to database:', syncError)
      if (req.user) {
        res.json(paginatedFiltered)
      } else {
        res.json(paginatedFiles)
      }
    }
  } catch (error) {
    log.error('Error in root directory listing:', error)
    return sendResponse(res, 500)
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
      log.debug('Invalid path parameters provided:', req.params)
      return sendResponse(res, 400, 'Invalid path parameters')
    }
    const { collection, author, additionalPath } = validatedParams
    const normalizedDir = path.resolve(BASE_DIR)
    const pathComponents = [collection, author, additionalPath]
      .filter(Boolean)
      .map((component) => {
        try {
          return decodeURIComponent(component)
        } catch (error) {
          log.error('Failed to decode URI component:', component, error)
          return component
        }
      })
    let realPath = safePath(normalizedDir, ...pathComponents)
    if (!realPath) {
      log.debug(
        'Path construction resulted in unsafe path for components:',
        pathComponents
      )
      return sendResponse(res, 400, 'Invalid path parameters')
    }
    if (!isSubPath(realPath, normalizedDir)) {
      log.error(
        `Path safety check failed: ${realPath} not within ${normalizedDir}`
      )
      return sendResponse(res, 400, 'Invalid path parameters')
    }
    const relativePath = path
      .relative(normalizedDir, realPath)
      .replace(/\\/g, '/')
    if (await isExcluded(relativePath)) {
      log.debug(`Access denied to: ${relativePath}`)
      return sendResponse(res, 404)
    }
    try {
      await fs.access(realPath)
    } catch (error) {
      log.error(error)
      return sendResponse(res, 404)
    }
    const stats = await fs.stat(realPath)
    if (stats.isDirectory()) {
      if (!req.user) {
        return sendResponse(res, 401)
      }
      let entries = []
      try {
        entries = await fs.readdir(realPath, { withFileTypes: true })
        log.debug(`Found ${entries.length} entries in directory`)
        if (UPSERT_ON_ACCESS !== 'file') {
          await maybeUpsertAccessed(realPath, true)
        }
      } catch (error) {
        log.error(error)
        return sendResponse(res, 500)
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
      let paginated = sorted
      if (!isNaN(limitRawDir) && limitRawDir > 0) {
        const limit = Math.min(limitRawDir, PAGINATION_LIMIT)
        const pageRaw = parseInt(req.query.page, 10)
        const page = isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw
        const start = (page - 1) * limit
        paginated = sorted.slice(start, start + limit)
      }
      try {
        if (validContents.length && UPSERT_ON_ACCESS !== 'file') {
          await createDbEntriesForContents(validContents, relativePath)
          const fileRelativePaths = validContents
            .filter((entry) => entry.type === 'file')
            .map((entry) => {
              return `${relativePath}/${entry.name}`.replace(/^\/?/, '')
            })
          const updatedMetadataMap =
            fileRelativePaths.length > 0
              ? await batchFetchFileMetadata(fileRelativePaths)
              : {}
          paginated = paginated.map((entry) => {
            const entryRelPath = `${relativePath}/${entry.name}`.replace(
              /^\/?/,
              ''
            )
            if (entry.type === 'file') {
              const dbMeta = updatedMetadataMap[entryRelPath]
              return {
                ...entry,
                uuid: dbMeta?.uuid || null,
                hash: dbMeta?.hash || null,
              }
            }
            return entry
          })
        }
      } catch (syncError) {
        log.error('Error syncing directory entries to database:', syncError)
      }
      res.json(paginated)
    } else {
      if (
        !hasAllowedExtension(realPath) ||
        DISALLOWED_FILES.includes(path.basename(realPath)) ||
        isDisallowedExtension(path.basename(realPath))
      ) {
        log.debug(`Access denied to file: ${realPath}`)
        return sendResponse(res, 404)
      }
      if (isImageFile(realPath) === true) {
        try {
          const kernel =
            typeof req.query.kernel === 'string' ? req.query.kernel : undefined
          const scaleParam = req.query.scale || req.query.x
          const scale =
            typeof scaleParam === 'string' ? parseFloat(scaleParam) : undefined
          const rawParam = req.query.raw === 'true' || req.query.raw === ''
          if (rawParam && (scale || kernel)) {
            log.debug('Raw parameter cannot be used with scale or kernel')
            return sendResponse(
              res,
              400,
              'raw cannot be used with scale or kernel'
            )
          }
          if (rawParam) {
            log.debug('Returning raw file without modifications')
            await maybeUpsertAccessed(realPath, false)
            return res.sendFile(realPath)
          }
          const resizeOptions = {}
          if (!kernel && req.query.kernel) {
            log.debug('Invalid kernel parameter provided:', req.query.kernel)
            return sendResponse(res, 400, 'Invalid kernel parameter')
          }
          if (!scale && scaleParam) {
            log.debug('Invalid scale parameter provided:', scaleParam)
            return sendResponse(res, 400, 'Invalid scale parameter')
          }
          if (scale) resizeOptions.scale = scale
          if (kernel) resizeOptions.kernel = kernel
          if (!isNaN(scale) && scale > 0 && scale !== 100) {
            log.debug('Resizing image with scale:', scale)
          }
          if (scale) {
            const transformer = await resizeImage(realPath, resizeOptions)
            if (transformer === undefined) {
              log.debug(
                'No resizing needed, applying metadata to original file'
              )
              const metadataTransformer = await applyMetadata(realPath)
              if (metadataTransformer) {
                res.type(path.extname(realPath).slice(1))
                await maybeUpsertAccessed(realPath, false)
                metadataTransformer.pipe(res)
                return
              } else {
                await maybeUpsertAccessed(realPath, false)
                return res.sendFile(realPath)
              }
            }
            if (transformer) {
              res.type(path.extname(realPath).slice(1))
              await maybeUpsertAccessed(realPath, false)
              transformer.pipe(res)
              return
            }
            if (transformer === null) {
              log.debug('Failure resizing image')
              return sendResponse(res, 500, 'Failed to resize image')
            }
          } else {
            log.debug('No scale parameter, applying metadata to original file')
            const metadataTransformer = await applyMetadata(realPath)
            if (metadataTransformer) {
              res.type(path.extname(realPath).slice(1))
              await maybeUpsertAccessed(realPath, false)
              metadataTransformer.pipe(res)
              return
            } else {
              await maybeUpsertAccessed(realPath, false)
              return res.sendFile(realPath)
            }
          }
        } catch (error) {
          log.error(error)
          return sendResponse(res, 500)
        }
      }
      if (isVideoFile(realPath) || isAudioFile(realPath)) {
        if (!req.headers.range) {
          log.debug(
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
          log.error('Error streaming media file:', error)
          return sendResponse(res, 500)
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
          log.error('Error in mammoth doc conversion:', error)
          return sendResponse(res, 500)
        }
      }
      if (isSwfFile(realPath)) {
        return sendResponse(res, 501, 'SWF file handling not implemented')
      }
      try {
        await maybeUpsertAccessed(realPath, false)
        res.sendFile(realPath)
      } catch (error) {
        log.error('Error in sending file:', error)
        return sendResponse(res, 500)
      }
    }
  }
)
module.exports = router