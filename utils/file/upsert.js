const path = require('path')
const fs = require('fs').promises
const uuid = require('uuid')
const log = require('../logHandler')
const {
  normalizePath,
  buildPaths,
  deriveCollectionAuthor,
} = require('../pathUtils')
const { BASE_DIR, BASE_PATH, UPSERT_ON_ACCESS } = /** @type {any} */ (
  require('../../config')
)
const { getImageMeta } = require('../image/metadata.js')
const Directory = require('../../models/Directory')
const File = require('../../models/File')
const { getStoredSize } = require('./listing')
const { isImageFile } = require('./typeGuards')
const { getFileMime, calculateFileHash } = require('./mimeAndHash')
const { readSidecarFile, isSidecarObject } = require('./sidecar')

/** @type {Promise<void> | null} */
let fileNameIndexNormalizationPromise = null

/** @returns {Promise<void>} */
async function ensureFileNameIndexAllowsDuplicates() {
  if (fileNameIndexNormalizationPromise) {
    return fileNameIndexNormalizationPromise
  }
  fileNameIndexNormalizationPromise = (async () => {
    try {
      const collection = File.collection
      if (!collection) return
      const indexes = await collection.indexes()
      const uniqueNameIndex = indexes.find(
        (index) => index?.key?.name === 1 && index?.unique === true
      )
      if (uniqueNameIndex?.name) {
        await collection.dropIndex(uniqueNameIndex.name)
        log.warn(
          `Dropped stale unique file name index: ${uniqueNameIndex.name}`
        )
      }
      const hasNonUniqueNameIndex = indexes.some(
        (index) => index?.key?.name === 1 && index?.unique !== true
      )
      if (!hasNonUniqueNameIndex) {
        await collection.createIndex({ name: 1 }, { name: 'name_1' })
      }
    } catch (/** @type {any} */ error) {
      log.warn('Failed to normalize File.name index:', error?.message)
    }
  })()
  return fileNameIndexNormalizationPromise
}

/** @param {any} dirObj */
async function upsertDirectoryEntry(dirObj) {
  if (
    dirObj.paths.relative === '' ||
    dirObj.paths.relative === '/' ||
    dirObj.paths.local === normalizePath(BASE_DIR)
  ) {
    log.info('Excluded root directory from upsert')
    return { result: null, isNew: false }
  }
  if (!dirObj || !dirObj.paths || !dirObj.paths.relative) {
    log.warn('Invalid directory object for upsert:', dirObj)
    return { result: null, isNew: false }
  }
  try {
    const filter = { 'paths.relative': dirObj.paths.relative }
    let existing = await Directory.findOne(filter)
    if (!existing) {
      const createdDirectory = await Directory.findOneAndUpdate(
        filter,
        {
          $set: {
            ...dirObj,
            paths: {
              local: dirObj.paths.local || null,
              relative: dirObj.paths.relative || null,
              remote: dirObj.paths.remote || null,
            },
            uuid: dirObj.uuid || uuid.v4() || null,
            size: dirObj.size || 0,
            created: dirObj.created || new Date(),
            modified: dirObj.modified || new Date(),
          },
        },
        {
          upsert: true,
          returnDocument: 'after',
        }
      )
      return { result: createdDirectory, isNew: true }
    } else {
      existing = await Directory.findOneAndUpdate(
        filter,
        {
          $set: {
            ...dirObj,
            paths: {
              local: dirObj.paths.local || existing.paths?.local || null,
              relative:
                dirObj.paths.relative || existing.paths?.relative || null,
              remote: dirObj.paths.remote || existing.paths?.remote || null,
            },
            uuid: existing.uuid || uuid.v4() || null,
            size: dirObj.size || existing.size || 0,
            modified: dirObj.modified || existing.modified || new Date(),
          },
        },
        { returnDocument: 'after' }
      )
      return { result: existing, isNew: false }
    }
  } catch (/** @type {any} */ error) {
    log.error('Error upserting directory entry:', {
      path: dirObj.paths?.relative,
      error: error.message,
    })
    return { result: null, isNew: false }
  }
}

/**
 * @param {any} fileObj
 * @param {boolean} [returnStats=false]
 */
async function upsertFileEntry(fileObj, returnStats = false) {
  if (!fileObj || !fileObj.paths || !fileObj.paths.relative) {
    log.debug('Invalid file object for upsert:', fileObj)
    return null
  }
  try {
    await ensureFileNameIndexAllowsDuplicates()
    const filter = { 'paths.relative': fileObj.paths.relative }
    let existing = await File.findOne(filter)
    let hash = fileObj.hash
    if (!hash) {
      try {
        hash = await calculateFileHash(fileObj.paths.local)
      } catch (/** @type {any} */ error) {
        log.error('Failed to generate hash for file:', {
          path: fileObj.paths?.relative,
          error: error.message,
        })
        hash = null
      }
    }
    if (!existing) {
      const createdFile = await File.findOneAndUpdate(
        filter,
        {
          $set: {
            ...fileObj,
            paths: {
              local: fileObj.paths.local || null,
              relative: fileObj.paths.relative || null,
              remote: fileObj.paths.remote || null,
            },
            uuid: fileObj.uuid || uuid.v4() || null,
            size: fileObj.size || 0,
            type: fileObj.type || null,
            collection: fileObj.collection || null,
            mime: fileObj.mime || null,
            hash: hash || null,
            created: fileObj.created || null,
            modified: fileObj.modified || null,
            meta: { ...fileObj.meta },
            sidecar: isSidecarObject(fileObj.sidecar) ? fileObj.sidecar : null,
          },
        },
        {
          upsert: true,
          returnDocument: 'after',
        }
      )
      return returnStats ? { result: createdFile, isNew: true } : createdFile
    } else {
      existing = await File.findOneAndUpdate(
        filter,
        {
          $set: {
            ...fileObj,
            paths: {
              local: fileObj.paths.local || existing.paths?.local || null,
              relative:
                fileObj.paths.relative || existing.paths?.relative || null,
              remote: fileObj.paths.remote || existing.paths?.remote || null,
            },
            uuid: existing.uuid || uuid.v4() || null,
            size: fileObj.size || existing.size || 0,
            type: fileObj.type || existing.type || null,
            collection: fileObj.collection || existing.collection || null,
            mime: fileObj.mime || existing.mime || null,
            hash: hash || existing.hash || null,
            modified: fileObj.modified || existing.modified || null,
            meta: { ...fileObj.meta, ...existing.meta },
            sidecar: isSidecarObject(fileObj.sidecar)
              ? fileObj.sidecar
              : existing.sidecar || null,
          },
        },
        { returnDocument: 'after' }
      )
      return returnStats ? { result: existing, isNew: false } : existing
    }
  } catch (/** @type {any} */ error) {
    log.error('Error upserting file entry:', {
      path: fileObj.paths?.relative,
      error: error.message,
    })
  }
}

/** @param {string} realPath */
async function upsertAccessedItem(realPath) {
  if (!realPath) {
    log.debug('No path provided for upsert')
    return null
  }
  try {
    const stats = await fs.stat(realPath)
    const name = path.basename(realPath)
    const relative = path
      .relative(path.resolve(BASE_DIR), realPath)
      .replace(/\\/g, '/')
    const paths = buildPaths(BASE_DIR, relative, BASE_PATH)
    const remote = paths?.remote
    const local = paths?.local || normalizePath(realPath)
    let result = null
    if (stats.isDirectory()) {
      try {
        const { collection, author } = deriveCollectionAuthor(relative)
        result = await upsertDirectoryEntry({
          name,
          paths: {
            local,
            relative,
            remote,
          },
          size: getStoredSize(stats, true),
          type: 'directory',
          collection,
          author,
          tags: [],
          created: stats.birthtime,
          modified: stats.mtime,
        })
      } catch (/** @type {any} */ error) {
        log.error('Failed to upsert directory:', {
          path: relative,
          error: error.message,
        })
      }
    }
    if (stats.isFile()) {
      let meta = /** @type {any} */ ({})
      if (isImageFile(realPath) === true) {
        try {
          meta = await getImageMeta(realPath)
        } catch (/** @type {any} */ error) {
          log.error('Error getting image meta for upsert:', {
            path: relative,
            error: error.message,
          })
        }
      }
      let hash = null
      try {
        hash = await calculateFileHash(realPath)
      } catch (/** @type {any} */ error) {
        log.error('Error calculating file hash for upsert:', {
          path: relative,
          error: error.message,
        })
      }
      try {
        const pathParts = relative ? relative.split('/').filter(Boolean) : []
        const collection = pathParts.length > 0 ? pathParts[0] : ''
        const author = pathParts.length > 1 ? pathParts[1] : ''
        const sidecar = await readSidecarFile(realPath)
        result = await upsertFileEntry({
          name,
          paths: {
            local,
            relative,
            remote,
          },
          size: getStoredSize(stats, false),
          type: 'file',
          collection: collection,
          author: author,
          mime: await getFileMime(realPath),
          created: stats.birthtime,
          modified: stats.mtime,
          hash,
          meta,
          sidecar,
        })
      } catch (/** @type {any} */ error) {
        log.error('Failed to upsert file:', {
          path: relative,
          error: error.message,
        })
      }
    }
    return result
  } catch (/** @type {any} */ error) {
    log.error('Error accessing or upserting item:', {
      path: realPath,
      error: error.message,
    })
  }
}

/**
 * @param {string} realPath
 * @param {boolean} [isDirectory]
 */
async function maybeUpsertAccessed(realPath, isDirectory = false) {
  if (!UPSERT_ON_ACCESS) return
  if (UPSERT_ON_ACCESS === 'file' && isDirectory) return
  if (UPSERT_ON_ACCESS === 'dir' && !isDirectory) return
  try {
    await upsertAccessedItem(realPath)
  } catch (err) {
    log.error('Background upsertAccessedItem failed:', err)
  }
}
/**
 * @param {string} realPath
 * @param {boolean} [isDirectory]
 */
async function deleteEntry(realPath, isDirectory) {
  if (!realPath) return
  let pathExists = true
  try {
    await fs.access(realPath)
  } catch {
    pathExists = false
  }
  if (pathExists) return
  try {
    if (isDirectory === true) {
      await Directory.findOneAndDelete({
        'paths.local': realPath,
      })
    }
    if (isDirectory === false) {
      await File.findOneAndDelete({ 'paths.local': realPath })
    } else {
      await Promise.all([
        File.findOneAndDelete({ 'paths.local': realPath }),
        Directory.findOneAndDelete({ 'paths.local': realPath }),
      ])
    }
  } catch (error) {
    log.error('Error deleting DB entry:', error)
    return
  }
}
module.exports = {
  ensureFileNameIndexAllowsDuplicates,
  upsertDirectoryEntry,
  upsertFileEntry,
  upsertAccessedItem,
  maybeUpsertAccessed,
  deleteEntry,
}
