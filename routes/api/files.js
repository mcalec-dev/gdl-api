const router = require('express').Router()
const path = require('path')
const { requireRole } = require('../../utils/authUtils')
const fs = require('fs').promises
const log = require('../../utils/logHandler')
const sendResponse = require('../../utils/resUtils')
const {
  BASE_DIR,
  DISALLOWED_FILES,
  PAGINATION_LIMIT,
  UPSERT_ON_ACCESS,
  TRANSCODE_VIDEO,
  TRANSCODE_AUDIO,
} = /** @type {any} */ (require('../../config'))
const {
  isExcluded,
  sortContents,
  parseSortQuery,
  formatListingEntry,
} = require('../../utils/file/listing.js')
const {
  hasAllowedExtension,
  isDocFile,
  isImageFile,
  isVideoFile,
  isAudioFile,
  isSwfFile,
  isDisallowedExtension,
  allowedQualityParams,
  isValidKernel,
} = require('../../utils/file/typeGuards.js')
const { isSidecarFile } = require('../../utils/file/sidecar.js')
const { getFileMime } = require('../../utils/file/mimeAndHash.js')
const {
  getTranscodeOptions,
  convertVideo,
  convertAudio,
  getMimeType: getConvertMimeType,
} = require('../../utils/video/convert.js')
const mimeTypes = require('mime-types')
const {
  maybeUpsertAccessed,
  deleteEntry,
} = require('../../utils/file/upsert.js')
const { batchFetchFileMetadata } = require('../../utils/file/metadataCache.js')
const {
  getCachedPaginationResult,
  setCachedPaginationResult,
} = require('../../utils/file/paginationCache.js')
const { createDbEntriesForContents } = require('../../utils/file/sync.js')
const { checkFileRecord } = require('../../utils/file/check.js')
const { safePath, validateRequestParams } = require('../../utils/pathUtils')
const { resizeImage } = require('../../utils/image/resize.js')
const { convertImage } = require('../../utils/image/convert.js')
const { applyMetadata } = require('../../utils/image/metadata.js')

/**
 * @param {string} realPath
 * @returns {Promise<string>}
 */
async function resolveMediaMimeType(realPath) {
  const extMime = mimeTypes.lookup(realPath)
  if (typeof extMime === 'string' && extMime) {
    return extMime
  }
  const detected = await getFileMime(realPath)
  if (typeof detected === 'string' && detected) {
    return detected
  }
  return 'application/octet-stream'
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {string} filePath
 * @param {import('../../utils/video/convert').TranscodeOptions} options
 */
function streamTranscodedMedia(req, res, filePath, options) {
  const mimeType = getConvertMimeType(options.container) || 'application/octet-stream'
  const filename = `${path.basename(filePath, path.extname(filePath))}.${options.container}`
  res.set({
    'Content-Type': mimeType,
    'Content-Disposition': `inline; filename="${filename}"`,
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  })
  const transcode =
    options.mode === 'audio'
      ? convertAudio(filePath, options.audioCodec, options.container)
      : convertVideo(
          filePath,
          options.videoCodec,
          options.mode === 'video' ? 'copy' : options.audioCodec,
          options.container
        )
  const ffmpegProcess = transcode.process
  const stream = transcode.stream
  let aborted = false
  const cleanup = () => {
    if (aborted) return
    aborted = true
    if (ffmpegProcess && !ffmpegProcess.killed) {
      log.debug('Client disconnected, killing FFmpeg process')
      ffmpegProcess.kill('SIGKILL')
    }
  }
  const removeListeners = () => {
    res.off('close', cleanup)
    req.off('close', cleanup)
    stream.off('error', onError)
    stream.off('end', removeListeners)
    stream.off('close', removeListeners)
    ffmpegProcess.off('exit', removeListeners)
  }
  /** @param {Error} error */
  const onError = (error) => {
    log.error('Error during transcoding:', error)
    if (!res.headersSent) {
      sendResponse(res, 500, 'Transcoding error')
    } else {
      res.destroy()
    }
  }
  res.on('close', cleanup)
  req.on('close', cleanup)
  stream.on('error', onError)
  stream.on('end', removeListeners)
  stream.on('close', removeListeners)
  ffmpegProcess.on('exit', removeListeners)
  stream.pipe(res)
}

/**
 * @param {unknown} cacheQuery
 */
function parseCacheQuery(cacheQuery) {
  if (cacheQuery === undefined) {
    return { isValid: true, useCache: true }
  }
  if (typeof cacheQuery !== 'string') {
    return { isValid: false, useCache: true }
  }
  const normalized = cacheQuery.trim().toLowerCase()
  if (normalized === 'true') {
    return { isValid: true, useCache: true }
  }
  if (normalized === 'false') {
    return { isValid: true, useCache: false }
  }
  return { isValid: false, useCache: true }
}

router.get('/', requireRole('user'), async (req, res) => {
  if (!req.user) {
    return sendResponse(res, 401)
  }
  const cacheMode = parseCacheQuery(req.query.cache)
  if (!cacheMode.isValid) {
    return sendResponse(res, 400, 'Invalid cache parameter')
  }
  try {
    const normalizedDir = path.resolve(BASE_DIR)
    const { sortBy, direction } = parseSortQuery(req.query)
    const limitRaw = parseInt(
      typeof req.query.limit === 'string' ? req.query.limit : '',
      10
    )
    /** @type {boolean} */
    const hasPagination = !isNaN(limitRaw) && limitRaw > 0
    /** @type {number | 0} */
    const limit = hasPagination ? Math.min(limitRaw, PAGINATION_LIMIT) : 0
    const pageRaw = hasPagination
      ? parseInt(typeof req.query.page === 'string' ? req.query.page : '', 10)
      : 1
    const page = hasPagination && !isNaN(pageRaw) && pageRaw >= 1 ? pageRaw : 1
    const shouldFetchMetadata = req.query.meta === 'true'
    if (hasPagination && cacheMode.useCache) {
      const cached = await getCachedPaginationResult(
        normalizedDir,
        page,
        limit,
        sortBy,
        direction,
        shouldFetchMetadata
      )
      if (cached) {
        log.debug('Returning cached pagination result for root directory')
        return sendResponse(res, 200).json(cached.items)
      }
    }
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
    const allFileRelativePaths = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
    let metadataMap = {}
    if (allFileRelativePaths.length > 0) {
      metadataMap = await batchFetchFileMetadata(allFileRelativePaths, {
        useCache: cacheMode.useCache,
      })
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
    const files = filteredResults.filter(
      (entry) => entry && entry.type === 'file'
    )
    const sortedFiltered = sortContents(filteredResults, sortBy, direction)
    const sortedFiles = sortContents(files, sortBy, direction)
    let paginatedFiltered = sortedFiltered
    let paginatedFiles = sortedFiles
    if (hasPagination) {
      const start = (page - 1) * limit
      paginatedFiltered = sortedFiltered.slice(start, start + limit)
      paginatedFiles = sortedFiles.slice(start, start + limit)
    }
    const entriesToSync = hasPagination
      ? req.user
        ? paginatedFiltered
        : paginatedFiles
      : req.user
        ? filteredResults
        : sortedFiles
    try {
      await createDbEntriesForContents(entriesToSync, '')
    } catch (syncError) {
      log.error('Error syncing entries to database:', syncError)
    }
    const responseData = req.user ? paginatedFiltered : paginatedFiles
    if (hasPagination && cacheMode.useCache) {
      await setCachedPaginationResult(
        normalizedDir,
        page,
        limit,
        sortBy,
        direction,
        shouldFetchMetadata,
        responseData,
        sortedFiltered.length
      )
    }
    return sendResponse(res, 200).json(responseData)
  } catch (error) {
    log.error('Error in root directory listing:', error)
    return sendResponse(res, 500)
  }
})

router.get(
  [
    '/:collection',
    '/:collection/*splat',
    '/:collection/:author',
    '/:collection/:author/*splat',
  ],
  async (req, res) => {
    const cacheMode = parseCacheQuery(req.query.cache)
    if (!cacheMode.isValid) {
      return sendResponse(res, 400, 'Invalid cache parameter')
    }
    const validatedParams = validateRequestParams(req.params)
    if (!validatedParams.isValid) {
      log.debug('Invalid path parameters provided:', req.params)
      return sendResponse(res, 400, 'Invalid path parameters')
    }
    const { collection, author, splat } = validatedParams
    const resolvedBaseDir = path.resolve(BASE_DIR)
    const pathComponents = [collection, author, splat]
      .filter(Boolean)
      .map((component) => {
        try {
          return decodeURIComponent(/** @type {string} */ (component))
        } catch (error) {
          log.error('Failed to decode URI component:', component, error)
          return component
        }
      })
    let realPath = safePath(resolvedBaseDir, ...pathComponents)
    if (!realPath) {
      log.debug(
        'Path construction resulted in unsafe path for components:',
        pathComponents
      )
      return sendResponse(res, 400, 'Invalid path parameters')
    }
    const relativePath = path
      .relative(resolvedBaseDir, realPath)
      .replace(/\\/g, '/')
    const isDirectSidecarRequest = isSidecarFile(realPath)
    if (isDirectSidecarRequest) {
      log.debug(
        'Bypassing disallowed checks for direct sidecar request:',
        relativePath
      )
    }
    if (!isDirectSidecarRequest && (await isExcluded(relativePath))) {
      log.debug(`Access denied to: ${relativePath}`)
      return sendResponse(res, 403, 'Access to this resource is forbidden')
    }
    try {
      await fs.access(realPath)
    } catch {
      log.warn(`Path not on filesystem, cleaning up DB record: ${relativePath}`)
      try {
        await deleteEntry(realPath)
      } catch (cleanupError) {
        log.error('Failed to clean up stale DB entry:', cleanupError)
      }
      return sendResponse(res, 404, 'File or directory not found')
    }
    const stats = await fs.stat(realPath)
    if (stats.isDirectory()) {
      if (!req.user) {
        return sendResponse(res, 401, 'Unauthorized')
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
      const { sortBy, direction } = parseSortQuery(req.query)
      const limitRawDir = parseInt(
        typeof req.query.limit === 'string' ? req.query.limit : '',
        10
      )
      const hasPagination = !isNaN(limitRawDir) && limitRawDir > 0
      const limit = hasPagination
        ? Math.min(limitRawDir, PAGINATION_LIMIT)
        : PAGINATION_LIMIT
      const pageRaw = hasPagination
        ? parseInt(typeof req.query.page === 'string' ? req.query.page : '', 10)
        : 1
      const page =
        hasPagination && !isNaN(pageRaw) && pageRaw >= 1 ? pageRaw : 1
      const shouldFetchMetadata = req.query.includeMetadata === 'true'
      if (hasPagination && cacheMode.useCache) {
        const cached = await getCachedPaginationResult(
          realPath,
          page,
          limit,
          sortBy,
          direction,
          shouldFetchMetadata
        )
        if (cached) {
          log.debug(
            'Returning cached pagination result for directory:',
            relativePath
          )
          return sendResponse(res, 200).json(cached.items)
        }
      }
      const allFileRelativePaths = entries
        .filter((entry) => entry.isFile())
        .map((entry) => {
          const entryRelPath = path
            .relative(resolvedBaseDir, path.join(realPath, entry.name))
            .replace(/\\/g, '/')
          return entryRelPath
        })
      let metadataMap = {}
      if (allFileRelativePaths.length > 0) {
        metadataMap = await batchFetchFileMetadata(allFileRelativePaths, {
          useCache: cacheMode.useCache,
        })
      }
      const formattedContents = await Promise.all(
        entries.map((entry) =>
          formatListingEntry(
            entry,
            realPath,
            resolvedBaseDir,
            req,
            true,
            metadataMap
          )
        )
      )
      const validContents = formattedContents.filter(Boolean)
      const sorted = sortContents(validContents, sortBy, direction)
      let paginated = sorted
      if (hasPagination) {
        const start = (page - 1) * limit
        paginated = sorted.slice(start, start + limit)
      }
      try {
        const entriesToSyncBase = hasPagination ? paginated : validContents
        if (entriesToSyncBase.length) {
          const entriesToSync =
            UPSERT_ON_ACCESS === 'file'
              ? entriesToSyncBase.filter((entry) => entry.type === 'file')
              : entriesToSyncBase
          if (entriesToSync.length) {
            await createDbEntriesForContents(entriesToSync, relativePath)
          }
        }
      } catch (syncError) {
        log.error('Error syncing directory entries to database:', syncError)
      }
      if (hasPagination && cacheMode.useCache) {
        await setCachedPaginationResult(
          realPath,
          page,
          limit,
          sortBy,
          direction,
          shouldFetchMetadata,
          paginated,
          sorted.length
        )
      }
      return sendResponse(res, 200).json(paginated)
    } else {
      try {
        await checkFileRecord(realPath)
      } catch (error) {
        log.error('Error checking file record:', error)
      }
      if (
        !isDirectSidecarRequest &&
        (!hasAllowedExtension(realPath) ||
          DISALLOWED_FILES.includes(path.basename(realPath)) ||
          isDisallowedExtension(path.basename(realPath)))
      ) {
        log.debug(`Access denied to file: ${realPath}`)
        return sendResponse(res, 403, 'Access to this resource is forbidden')
      }
      if (isImageFile(realPath) === true) {
        try {
          const gifParam = req.query.gif
          let shouldConvertToGif = false
          if (gifParam !== undefined) {
            if (typeof gifParam !== 'string') {
              log.debug('Invalid gif parameter type provided:', typeof gifParam)
              return sendResponse(res, 400, 'Invalid gif parameter')
            }
            const normalizedGifParam = gifParam.trim().toLowerCase()
            if (normalizedGifParam === 'true') {
              shouldConvertToGif = true
            } else if (normalizedGifParam === 'false') {
              shouldConvertToGif = false
            } else {
              log.debug('Invalid gif parameter value provided:', gifParam)
              return sendResponse(res, 400, 'Invalid gif parameter')
            }
          }
          const qualityParam =
            typeof req.query.quality === 'number' ||
            typeof req.query.quality === 'string'
              ? req.query.quality
              : typeof req.query.q === 'number' ||
                  typeof req.query.q === 'string'
                ? req.query.q
                : undefined
          const quality = allowedQualityParams(qualityParam)
            ? typeof qualityParam === 'string'
              ? parseFloat(qualityParam)
              : qualityParam
            : undefined
          const kernelParam = req.query.kernel
          const kernel =
            typeof kernelParam === 'string' && isValidKernel(kernelParam)
              ? kernelParam
              : undefined
          const scaleParam =
            typeof req.query.scale === 'number' ||
            typeof req.query.scale === 'string'
              ? req.query.scale
              : typeof req.query.x === 'number' ||
                  typeof req.query.x === 'string'
                ? req.query.x
                : undefined
          const scale = parseFloat(scaleParam ?? '')
          const rawParam = req.query.raw === 'true' || req.query.raw === ''
          if (rawParam && (scale || kernel || shouldConvertToGif)) {
            log.debug(
              'Raw parameter cannot be used with scale, kernel, or gif conversion'
            )
            return sendResponse.error(
              res,
              400,
              'raw cannot be used with other parameters'
            )
          }
          if (rawParam) {
            log.debug('Returning raw file without modifications')
            await maybeUpsertAccessed(realPath, false)
            return res.sendFile(realPath)
          }
          /** @type {import('../../utils/image/resize').ResizeInput} */
          let resizeOptions = {}
          if (!kernel && req.query.kernel) {
            log.debug('Invalid kernel parameter provided:', req.query.kernel)
            return sendResponse(res, 400, 'Invalid kernel parameter')
          }
          if (!scale && scaleParam) {
            log.debug('Invalid scale parameter provided:', scaleParam)
            return sendResponse(res, 400, 'Invalid scale parameter')
          }
          if (shouldConvertToGif) {
            log.debug('Converting image to gif')
            const convertedTransformer = await convertImage(realPath, 'gif', {
              q: quality,
              x: scale,
              k: kernel,
            })
            if (!convertedTransformer) {
              log.debug('Failure converting image to gif')
              return sendResponse(res, 500, 'Failed to convert image to gif')
            }
            convertedTransformer.on('error', (error) => {
              log.error('Error during image conversion:', error)
              if (!res.headersSent) {
                sendResponse(res, 500, 'Failed to convert image to gif')
              } else {
                res.destroy()
              }
            })
            const filename =
              path.basename(realPath, path.extname(realPath)) + '.gif'
            res.set({
              'Content-Type': 'image/gif',
              'Content-Disposition': `inline; filename="${filename}"`,
              'Cache-Control': 'public, max-age=31536000, immutable',
              'X-Content-Type-Options': 'nosniff',
            })
            await maybeUpsertAccessed(realPath, false)
            convertedTransformer.pipe(res)
            return
          }
          if (scale) resizeOptions.scale = scale
          if (kernel)
            resizeOptions.kernel =
              /** @type {keyof import('sharp').KernelEnum} */ (kernel)
          if (quality) resizeOptions.quality = quality
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
        const convertParam =
          typeof req.query.convert === 'string' ? req.query.convert : undefined
        const transcodeOptions = getTranscodeOptions(
          convertParam,
          isVideoFile(realPath),
          isAudioFile(realPath)
        )
        if (convertParam && !transcodeOptions) {
          return sendResponse(res, 400, 'Invalid convert parameter')
        }
        if (transcodeOptions) {
          if (
            (transcodeOptions.mode === 'video' ||
              transcodeOptions.mode === 'video_audio') &&
            !TRANSCODE_VIDEO
          ) {
            return sendResponse(res, 501, 'Video transcoding is disabled')
          }
          if (
            (transcodeOptions.mode === 'audio' ||
              transcodeOptions.mode === 'video_audio') &&
            !TRANSCODE_AUDIO
          ) {
            return sendResponse(res, 501, 'Audio transcoding is disabled')
          }
          await maybeUpsertAccessed(realPath, false)
          return streamTranscodedMedia(req, res, realPath, transcodeOptions)
        }
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
          const mimeType = await resolveMediaMimeType(realPath)
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
              res.status(200).send(html)
              await maybeUpsertAccessed(realPath, false)
            })
        } catch (error) {
          log.error('Error in mammoth doc conversion:', error)
          return sendResponse.error(res, 500, 'Error converting document')
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
