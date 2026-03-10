const path = require('path')
const fs = require('fs').promises
const crypto = require('crypto')
const log = require('./logHandler')
const {
  normalizeString,
  safeApiPath,
  safePath,
  isSubPath,
  normalizeLocalPath,
  buildPaths,
  deriveCollectionAuthor,
} = require('./pathUtils')
const { getHostUrl } = require('./urlUtils')
const {
  DISALLOWED_DIRS,
  DISALLOWED_FILES,
  DISALLOWED_EXTENSIONS,
  BASE_DIR,
  BASE_PATH,
  AUTO_SCAN,
  UPSERT_ON_ACCESS,
  HASH_ALGORITHM,
} = require('../config')
const { getImageMeta } = require('./imageUtils')
const Directory = require('../models/Directory')
const File = require('../models/File')
const uuid = require('uuid')
function hasAllowedExtension(filePath) {
  if (!filePath) return false
  const ext = path.extname(filePath).toLowerCase()
  const extNoDot = ext.startsWith('.') ? ext.slice(1) : ext
  const isDisallowed = Array.isArray(DISALLOWED_EXTENSIONS)
    ? DISALLOWED_EXTENSIONS.some((pattern) => {
        if (!pattern) return false
        const p = pattern.toString().toLowerCase().trim()
        let patternNoDot = p
        if (p.startsWith('*.')) patternNoDot = p.slice(2)
        else if (p.startsWith('.')) patternNoDot = p.slice(1)
        return extNoDot === patternNoDot
      })
    : false
  return !isDisallowed
}
function allowedQualityParams(param) {
  if (!param) return null
  const ALLOWED_PARAMS = {
    undefined: undefined,
    0: 'default',
    1: 'low',
    2: 'medium',
    3: 'high',
  }
  if (param === undefined) return undefined
  if (param.includes(ALLOWED_PARAMS)) {
    return param
  } else {
    log.warn('quality parameter doesnt include set params')
    return null
  }
}
const safeDisallowedDirs = Array.isArray(DISALLOWED_DIRS) ? DISALLOWED_DIRS : []
const safeDisallowedFiles = Array.isArray(DISALLOWED_FILES)
  ? DISALLOWED_FILES
  : []
async function isExcluded(dirName, isRoot = false) {
  if (!dirName) return true
  const normalizeForDir = (s) =>
    normalizeString(s)
      .replace(/^\.*|\.*$|^\/|\/$/g, '')
      .toLowerCase()
  const normalizedName = normalizeForDir(dirName)
  const segments = normalizedName.split(/[\\/]/)
  if (
    safeDisallowedDirs.some((pattern) => {
      const normalizedPattern = normalizeForDir(pattern)
      return isRoot
        ? normalizedName === normalizedPattern
        : segments.includes(normalizedPattern)
    })
  )
    return true
  if (
    safeDisallowedFiles.some((pattern) => {
      if (pattern.startsWith('*.')) {
        return normalizedName.endsWith(pattern.slice(1))
      }
      return (
        normalizedName === pattern.toLowerCase() ||
        normalizedName.includes(pattern.toLowerCase())
      )
    })
  )
    return true
  return false
}
function isDocFile(filename) {
  if (!filename) return false
  const ext = ['.doc', '.docx']
  return ext.some((e) => filename.toLowerCase().endsWith(e))
}
function isImageFile(filename) {
  if (!filename) return false
  const ext = ['.jpg', '.jpeg', '.png', '.webp', '.avif']
  if (ext.some((e) => filename.toLowerCase().endsWith(e))) return true
  else return false
}
function isVideoFile(filename) {
  if (!filename) return false
  const ext = ['.mp4', '.mkv', '.webm', '.avi', '.mov']
  if (ext.some((e) => filename.toLowerCase().endsWith(e))) return true
  else return false
}
function isAudioFile(filename) {
  if (!filename) return false
  const ext = ['.mp3', '.wav', '.flac', '.aac', '.ogg']
  if (ext.some((e) => filename.toLowerCase().endsWith(e))) return true
  else return false
}
function isSwfFile(filename) {
  if (!filename) return false
  const ext = ['.swf']
  if (ext.some((e) => filename.toLowerCase().endsWith(e))) return true
  else return false
}
function isDisallowedExtension(filename) {
  if (!filename) return false
  const ext = path.extname(filename).toLowerCase()
  return DISALLOWED_EXTENSIONS.some(
    (disallowedExt) =>
      ext === disallowedExt.toLowerCase() ||
      ext === `.${disallowedExt.toLowerCase()}`
  )
}
function getFileMime(file) {
  if (!file) return null
  const ext = path.extname(file).toLowerCase()
  let type = require('mime-types').lookup(ext)
  if (type === false) return null
  if (type) {
    type = type.replace('application/mp4', 'video/mp4')
    return type
  }
  return null
}
async function calculateFileHash(filePath) {
  if (!filePath || !HASH_ALGORITHM) return null
  try {
    const fileStream = require('fs').createReadStream(filePath)
    const hash = crypto.createHash(HASH_ALGORITHM)
    for await (const chunk of fileStream) {
      hash.update(chunk)
    }
    return hash.digest('hex')
  } catch (error) {
    log.error('Error calculating file hash:', {
      path: filePath,
      error: error.message,
    })
    return null
  }
}
async function upsertDirectoryEntry(dirObj) {
  if (!dirObj || !dirObj.paths || !dirObj.paths.relative) {
    log.debug('Invalid directory object for upsert:', dirObj)
    return { result: null, isNew: false }
  }
  try {
    const filter = { 'paths.relative': dirObj.paths.relative }
    let existing = await Directory.findOne(filter)
    if (!existing) {
      const newDirectory = new Directory({
        ...dirObj,
        paths: {
          local: dirObj.paths.local || null,
          relative: dirObj.paths.relative || null,
          remote: dirObj.paths.remote || null,
        },
        uuid: uuid.v4() || null,
        size: dirObj.size || 0,
        created: dirObj.created || new Date(),
        modified: dirObj.modified || new Date(),
      })
      await newDirectory.save()
      return { result: newDirectory, isNew: true }
    } else {
      existing = await Directory.findOneAndUpdate(
        filter,
        {
          $set: {
            ...dirObj,
            paths: {
              local: dirObj.paths.local || existing.paths.local || null,
              relative:
                dirObj.paths.relative || existing.paths.relative || null,
              remote: dirObj.paths.remote || existing.paths.remote || null,
            },
            uuid: existing.uuid || uuid.v4() || null,
            size: dirObj.size || existing.size || 0,
            modified: dirObj.modified || existing.modified || new Date(),
          },
        },
        { new: true }
      )
      return { result: existing, isNew: false }
    }
  } catch (error) {
    log.error('Error upserting directory entry:', {
      path: dirObj.paths?.relative,
      error: error.message,
    })
    return { result: null, isNew: false }
  }
}
async function upsertFileEntry(fileObj) {
  if (!fileObj || !fileObj.paths || !fileObj.paths.relative) {
    log.debug('Invalid file object for upsert:', fileObj)
    return null
  }
  try {
    const filter = { 'paths.relative': fileObj.paths.relative }
    let existing = await File.findOne(filter)
    let hash = fileObj.hash
    if (!hash) {
      try {
        hash = await calculateFileHash(fileObj.paths.local)
      } catch (error) {
        log.error('Failed to generate hash for file:', {
          path: fileObj.paths?.relative,
          error: error.message,
        })
        hash = null
      }
    }
    if (!existing) {
      log.debug('Creating new file entry:', fileObj.paths.relative)
      const newFile = new File({
        ...fileObj,
        paths: {
          local: fileObj.paths.local || null,
          relative: fileObj.paths.relative || null,
          remote: fileObj.paths.remote || null,
        },
        uuid: uuid.v4() || null,
        size: fileObj.size || 0,
        type: fileObj.type || null,
        collection: fileObj.collection || null,
        mime: fileObj.mime || null,
        hash: hash || null,
        created: fileObj.created || null,
        modified: fileObj.modified || null,
        meta: { ...fileObj.meta },
      })
      log.debug('Upserted new file entry:', fileObj.paths.relative)
      await newFile.save()
      return newFile
    } else {
      existing = await File.findOneAndUpdate(
        filter,
        {
          $set: {
            ...fileObj,
            paths: {
              local: fileObj.paths.local || existing.paths.local || null,
              relative:
                fileObj.paths.relative || existing.paths.relative || null,
              remote: fileObj.paths.remote || existing.paths.remote || null,
            },
            uuid: existing.uuid || uuid.v4() || null,
            size: fileObj.size || existing.size || 0,
            type: fileObj.type || existing.type || null,
            collection: fileObj.collection || existing.collection || null,
            mime: fileObj.mime || existing.mime || null,
            hash: hash || existing.hash || null,
            modified: fileObj.modified || existing.modified || null,
            meta: { ...fileObj.meta, ...existing.meta },
          },
        },
        { new: true }
      )
      log.debug('Updated existing file entry:', fileObj.paths.relative)
      return existing
    }
  } catch (error) {
    log.error('Error upserting file entry:', {
      path: fileObj.paths?.relative,
      error: error.message,
    })
  }
}
async function upsertAccessedItem(realPath) {
  if (!realPath) {
    log.debug('No path provided for upsert')
    return null
  }
  try {
    const stats = await fs.stat(realPath)
    let name = path.basename(realPath)
    const relative = path
      .relative(path.resolve(BASE_DIR), realPath)
      .replace(/\\/g, '/')
    const paths = buildPaths(BASE_DIR, relative, BASE_PATH)
    let remote = paths.remote
    let local = paths.local || normalizeLocalPath(realPath)
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
          size: stats.size,
          type: 'directory',
          collection,
          author,
          tags: [],
          created: stats.birthtime,
          modified: stats.mtime,
        })
      } catch (error) {
        log.error('Failed to upsert directory:', {
          path: relative,
          error: error.message,
        })
      }
    }
    if (stats.isFile()) {
      let meta = {}
      if (isImageFile(realPath) === true) {
        try {
          meta = await getImageMeta(realPath)
        } catch (error) {
          log.error('Error getting image meta for upsert:', {
            path: relative,
            error: error.message,
          })
        }
      }
      let hash = null
      try {
        hash = await calculateFileHash(realPath)
      } catch (error) {
        log.error('Error calculating file hash for upsert:', {
          path: relative,
          error: error.message,
        })
      }
      try {
        const pathParts = relative ? relative.split('/').filter(Boolean) : []
        const collection = pathParts.length > 0 ? pathParts[0] : ''
        const author = pathParts.length > 1 ? pathParts[1] : ''
        result = await upsertFileEntry({
          name,
          paths: {
            local,
            relative,
            remote,
          },
          size: stats.size,
          type: 'file',
          collection: collection,
          author: author,
          mime: getFileMime(name),
          created: stats.birthtime,
          modified: stats.mtime,
          hash,
          meta,
        })
      } catch (error) {
        log.error('Failed to upsert file:', {
          path: relative,
          error: error.message,
        })
      }
    }
    return result
  } catch (error) {
    log.error('Error accessing or upserting item:', {
      path: realPath,
      error: error.message,
    })
  }
}
async function maybeUpsertAccessed(realPath, isDirectory = false) {
  if (!UPSERT_ON_ACCESS) return
  if (UPSERT_ON_ACCESS === 'file' && isDirectory) return
  if (UPSERT_ON_ACCESS === 'dir' && !isDirectory) return
  if (AUTO_SCAN === false) {
    try {
      await upsertAccessedItem(realPath)
    } catch (err) {
      log.error('Background upsertAccessedItem failed:', err)
    }
  }
}
function sortContents(contents, sortBy = 'name', direction = 'none') {
  if (!Array.isArray(contents)) return []
  if (!direction || direction === 'none') {
    return [...contents].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name, undefined, { numeric: true })
    })
  }
  return [...contents].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    let comparison = 0
    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name, undefined, { numeric: true })
        break
      case 'modified':
        comparison = new Date(a.modified || 0) - new Date(b.modified || 0)
        break
      case 'type': {
        const extA = (a.name.split('.').pop() || '').toLowerCase()
        const extB = (b.name.split('.').pop() || '').toLowerCase()
        comparison = extA.localeCompare(extB)
        break
      }
      case 'size':
        comparison = (a.size || 0) - (b.size || 0)
        break
      case 'created':
        comparison = new Date(a.created || 0) - new Date(b.created || 0)
        break
      default:
        comparison = a.name.localeCompare(b.name, undefined, { numeric: true })
    }
    return direction === 'asc' ? comparison : -comparison
  })
}
function parseSortQuery(query) {
  const allowed = ['name', 'modified', 'type', 'size', 'created']
  if (!query) return { sortBy: 'name', direction: 'none' }
  for (const key of Object.keys(query)) {
    if (allowed.includes(key)) {
      const dir = (query[key] || '').toString().toLowerCase()
      if (dir === 'asc' || dir === 'desc')
        return { sortBy: key, direction: dir }
    }
  }
  return { sortBy: 'name', direction: 'none' }
}
async function scanAndSyncDirectory(dirPath, relativePath = '') {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    let dirStats = { created: 0, updated: 0 }
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
        log.debug(`Skipping excluded item: ${entryRelativePath}`)
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
          size = null
        } else {
          size = stats.size
        }
      } catch (statError) {
        log.error(`Error getting stats for ${entryPath}:`, statError)
        continue
      }
      const paths = buildPaths(dirPath, entryRelativePath, BASE_PATH)
      if (entry.isDirectory()) {
        const { collection, author } = deriveCollectionAuthor(entryRelativePath)
        const upsertResult = await upsertDirectoryEntry({
          name: entry.name,
          paths,
          size: size,
          collection,
          author,
          tags: [],
          created: ctime,
          modified: mtime,
        })
        if (upsertResult.isNew) dirStats.created++
        else dirStats.updated++
        const nestedStats = await scanAndSyncDirectory(
          entryPath,
          entryRelativePath
        )
        dirStats.created += nestedStats.created
        dirStats.updated += nestedStats.updated
      }
      if (entry.isFile()) {
        if (!hasAllowedExtension(entryPath)) {
          log.debug(
            `Skipping file with disallowed extension: ${entryRelativePath}`
          )
          continue
        }
        let metadata = {}
        if (isImageFile(entryPath)) {
          metadata = await getImageMeta(entryPath)
        } else {
          metadata = {}
        }
        let hash = null
        try {
          hash = await calculateFileHash(entryPath)
        } catch (error) {
          log.error('Error calculating file hash in scanAndSyncDirectory:', {
            path: entryRelativePath,
            error: error.message,
          })
        }
        const { collection, author } = deriveCollectionAuthor(entryRelativePath)
        const mime = await getFileMime(entry.name)
        await upsertFileEntry({
          name: entry.name,
          paths,
          author,
          collection,
          size,
          type: 'file',
          created: ctime,
          modified: mtime,
          mime,
          meta: metadata,
          hash,
        })
      }
    }
    return dirStats
  } catch (error) {
    log.error(`Error scanning directory ${dirPath}:`, error)
    throw error
  }
}
async function syncAllFilesToDatabase() {
  try {
    log.debug('Starting comprehensive database sync...')
    const stats = await fs.stat(BASE_DIR)
    if (!stats.isDirectory()) {
      throw new Error(`${BASE_DIR} is not a directory`)
    }
    const dirStats = await scanAndSyncDirectory(BASE_DIR, '')
    log.debug(
      `Database sync completed: Created ${dirStats.created} directories, Updated ${dirStats.updated} directories`
    )
    return {
      success: true,
      message: 'All files and directories synced to database',
      stats: dirStats,
    }
  } catch (error) {
    log.error('Error during database sync:', error)
    return {
      success: false,
      message: `Database sync failed: ${error.message}`,
    }
  }
}
async function initializeDatabaseSync() {
  try {
    log.debug('Initializing database sync...')
    await syncAllFilesToDatabase()
  } catch (error) {
    log.error('Failed to initialize database sync:', error)
  }
}
async function formatListingEntry(
  entry,
  baseDir,
  normalizedDir,
  req,
  includeMime = false,
  fileMetadataMap = null
) {
  if (!entry) return null
  try {
    if (
      (await isExcluded(entry.name)) ||
      DISALLOWED_DIRS.includes(entry.name) ||
      (entry.isFile() &&
        (DISALLOWED_FILES.includes(entry.name) ||
          isDisallowedExtension(entry.name)))
    ) {
      log.debug(`Excluded entry: ${entry.name}`)
      return null
    }
    const entryPath = safePath(baseDir, entry.name)
    if (!entryPath || !isSubPath(entryPath, normalizedDir)) return null
    let stats
    try {
      stats = await fs.stat(entryPath)
    } catch {
      return null
    }
    const size = entry.isDirectory() ? null : stats.size
    const mtime = stats.mtime
    const ctime = stats.birthtime
    const relativePath = path
      .relative(normalizedDir, entryPath)
      .replace(/\\/g, '/')
    const { collection, author } = deriveCollectionAuthor(relativePath)
    const paths = buildPaths(baseDir, relativePath, BASE_PATH) || {}
    let fullPath =
      paths.remote || safeApiPath(`${BASE_PATH}/api/files`, relativePath)
    const url = (await getHostUrl(req)) + fullPath
    let fileUuid = null
    let fileHash = null
    if (!entry.isDirectory() && fileMetadataMap) {
      fileUuid = fileMetadataMap[relativePath]?.uuid || null
      fileHash = fileMetadataMap[relativePath]?.hash || null
    }
    const result = {
      name: entry.name,
      type: entry.isDirectory() ? 'directory' : 'file',
      size,
      modified: mtime,
      created: ctime,
      path: fullPath,
      url,
      collection,
      author,
      ...(entry.isDirectory() ? {} : { uuid: fileUuid, hash: fileHash }),
    }
    if (includeMime && !entry.isDirectory()) {
      result.mime = await getFileMime(entry.name)
    }
    return result
  } catch (error) {
    log.error('Error formatting listing entry:', error)
    return null
  }
}
async function batchFetchFileMetadata(relativePaths) {
  if (!Array.isArray(relativePaths) || relativePaths.length === 0) {
    return {}
  }
  try {
    log.debug('Batch fetching file metadata for paths:', relativePaths)
    const files = await File.find(
      { 'paths.relative': { $in: relativePaths } },
      { 'paths.relative': 1, uuid: 1, hash: 1 }
    ).lean()
    const metadataMap = {}
    files.forEach((file) => {
      if (file.paths.relative) {
        metadataMap[file.paths.relative] = {
          uuid: file.uuid,
          hash: file.hash,
        }
      }
    })
    return metadataMap
  } catch (error) {
    log.error('Error batch fetching file metadata:', error)
    return {}
  }
}
async function createDbEntriesForContents(items, parentPath = '') {
  try {
    let dirStats = { created: 0, updated: 0 }
    for (const item of items) {
      const relPath = parentPath ? `${parentPath}/${item.name}` : item.name
      const paths = buildPaths(BASE_DIR, relPath, BASE_PATH)
      const localPath = paths.local
      let metadata = {}
      if (isImageFile(localPath)) {
        metadata = await getImageMeta(localPath)
      } else {
        metadata = {}
      }
      if (item.type === 'directory') {
        const { collection, author } = deriveCollectionAuthor(relPath)
        const upsertResult = await upsertDirectoryEntry({
          name: item.name,
          paths,
          size: item.size || 0,
          collection: item.collection || collection,
          author: item.author || author,
          tags: item.tags || [],
          created: item.created || null,
          modified: item.modified || null,
        })
        if (upsertResult.isNew) dirStats.created++
        else dirStats.updated++
        if (item.contents) {
          const nestedStats = await createDbEntriesForContents(
            item.contents,
            relPath
          )
          dirStats.created += nestedStats.created
          dirStats.updated += nestedStats.updated
        }
      }
      if (item.type === 'file') {
        let hash = null
        try {
          hash = await calculateFileHash(localPath)
        } catch (error) {
          log.error(
            'Error calculating file hash in createDbEntriesForContents:',
            {
              path: relPath,
              error: error.message,
            }
          )
        }
        await upsertFileEntry({
          name: item.name,
          paths,
          mime: item.mime || null,
          size: item.size || 0,
          type: item.type || null,
          collection: item.collection || null,
          author: item.author || null,
          created: item.created || null,
          modified: item.modified || null,
          hash,
          meta: { ...metadata },
        })
      }
    }
    return dirStats
  } catch (error) {
    log.error('Error creating DB entries for contents:', error)
    return { created: 0, updated: 0 }
  }
}
module.exports = {
  isExcluded,
  hasAllowedExtension,
  isDocFile,
  isImageFile,
  isVideoFile,
  isAudioFile,
  isSwfFile,
  isDisallowedExtension,
  getFileMime,
  calculateFileHash,
  maybeUpsertAccessed,
  sortContents,
  parseSortQuery,
  formatListingEntry,
  createDbEntriesForContents,
  initializeDatabaseSync,
  batchFetchFileMetadata,
  allowedQualityParams,
}
