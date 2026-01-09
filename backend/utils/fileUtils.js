const path = require('path')
const fs = require('fs').promises
const debug = require('debug')('gdl-api:utils:file')
const {
  normalizeString,
  safeApiPath,
  safePath,
  isSubPath,
} = require('./pathUtils')
const { getHostUrl } = require('./urlUtils')
const {
  DISALLOWED_DIRS,
  DISALLOWED_FILES,
  DISALLOWED_EXTENSIONS,
  BASE_DIR,
  BASE_PATH,
  AUTO_SCAN,
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
  const ext = path.extname(file)
  let type = require('mime-types').lookup(ext) || 'n/a'
  type = type.replace('application/mp4', 'video/mp4')
  return type
}
async function upsertDirectoryEntry(dirObj) {
  try {
    const filter = { 'paths.relative': dirObj.paths.relative }
    let existing = await Directory.findOne(filter)
    if (!existing) {
      debug('Creating new directory entry:', dirObj.paths.relative)
      const newDirectory = new Directory({
        ...dirObj,
        uuid: uuid.v4(),
        created: dirObj.created || new Date(),
        modified: dirObj.modified || new Date(),
      })
      await newDirectory.save()
      return newDirectory
    } else {
      debug('Updating existing directory entry:', dirObj.paths.relative)
      existing = await Directory.findOneAndUpdate(
        filter,
        {
          $set: {
            ...dirObj,
            uuid: existing.uuid,
            modified: dirObj.modified || new Date(),
          },
        },
        { new: true }
      )
      return existing
    }
  } catch (error) {
    debug('Error upserting directory entry:', {
      path: dirObj.paths?.relative,
      error: error.message,
    })
  }
}
async function upsertFileEntry(fileObj) {
  try {
    const filter = { 'paths.relative': fileObj.paths.relative }
    let existing = await File.findOne(filter)
    if (!existing) {
      debug('Creating new file entry:', fileObj.paths.relative)
      const newFile = new File({
        ...fileObj,
        uuid: uuid.v4(),
        created: fileObj.created || new Date(),
        modified: fileObj.modified || new Date(),
      })
      await newFile.save()
      return newFile
    } else {
      debug('Updating existing file entry:', fileObj.paths.relative)
      existing = await File.findOneAndUpdate(
        filter,
        {
          $set: {
            ...fileObj,
            uuid: existing.uuid,
            modified: fileObj.modified || new Date(),
          },
        },
        { new: true }
      )
      return existing
    }
  } catch (error) {
    debug('Error upserting file entry:', {
      path: fileObj.paths?.relative,
      error: error.message,
    })
  }
}
async function upsertAccessedItem(realPath) {
  if (!realPath) {
    debug('No path provided for upsert')
    return null
  }
  try {
    const stats = await fs.stat(realPath)
    let name = path.basename(realPath)
    const relative = path
      .relative(path.resolve(BASE_DIR), realPath)
      .replace(/\\/g, '/')
    let remote = safeApiPath(`${BASE_PATH}/api/files`, relative)
    let local = realPath.replace(/\\\\/g, '/')
    remote = remote.replace(/([^:])\/\//g, '$1/')
    if (/\.[a-zA-Z0-9]+\/$/.test(remote)) {
      remote = remote.replace(/(\.[a-zA-Z0-9]+)\/$/, '$1')
    }
    const paths = {
      local,
      relative,
      remote,
    }
    let result = null
    if (stats.isDirectory()) {
      try {
        result = await upsertDirectoryEntry({
          name,
          paths,
          size: stats.size,
          type: 'directory',
          created: stats.birthtime,
          modified: stats.mtime,
        })
        debug('Successfully upserted directory:', relative)
      } catch (error) {
        debug('Failed to upsert directory:', {
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
          debug('Error getting image meta for upsert:', {
            path: relative,
            error: error.message,
          })
        }
      }
      try {
        const pathParts = relative ? relative.split('/').filter(Boolean) : []
        const collection = pathParts.length > 0 ? pathParts[0] : ''
        const author = pathParts.length > 1 ? pathParts[1] : ''
        const mime = getFileMime(name) || 'n/a'
        result = await upsertFileEntry({
          name,
          paths,
          size: stats.size || 0,
          type: 'file',
          collection: collection,
          author: author,
          mime: mime,
          created: stats.birthtime,
          modified: stats.mtime,
          meta,
        })
        debug('Successfully upserted file:', relative)
      } catch (error) {
        debug('Failed to upsert file:', {
          path: relative,
          error: error.message,
        })
      }
    }
    return result
  } catch (error) {
    debug('Error accessing or upserting item:', {
      path: realPath,
      error: error.message,
    })
  }
}
function normalizeLocalPath(p) {
  if (!p) return ''
  return p.replace(/\\/g, '/')
}
function buildPaths(localBase, relative) {
  const rel = relative || ''
  const local = normalizeLocalPath(path.join(localBase, rel))
  let remote = safeApiPath(`${BASE_PATH}/api/files`, rel)
  remote = remote.replace(/([^:])\/\//g, '$1/')
  if (/\.[a-zA-Z0-9]+\/$/.test(remote)) {
    remote = remote.replace(/(\.[a-zA-Z0-9]+)\/$/, '$1')
  }
  return {
    local,
    relative: rel,
    remote,
  }
}
function deriveCollectionAuthor(relative) {
  const parts = relative ? relative.split('/').filter(Boolean) : []
  return {
    collection: parts.length > 0 ? parts[0] : null,
    author: parts.length > 1 ? parts[1] : null,
  }
}
async function maybeUpsertAccessed(realPath) {
  if (AUTO_SCAN === false) {
    try {
      debug('Upserting accessed path:', realPath)
      await upsertAccessedItem(realPath)
    } catch (err) {
      debug('Background upsertAccessedItem failed:', err)
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
          size = null
        } else {
          size = stats.size
        }
      } catch (statError) {
        debug(`Error getting stats for ${entryPath}:`, statError)
        continue
      }
      const paths = buildPaths(dirPath, entryRelativePath)
      if (entry.isDirectory()) {
        await upsertDirectoryEntry({
          name: entry.name,
          paths,
          size: size,
          created: ctime,
          modified: mtime,
        })
        await scanAndSyncDirectory(entryPath, entryRelativePath)
      }
      if (entry.isFile()) {
        if (!hasAllowedExtension(entryPath)) {
          debug(`Skipping file with disallowed extension: ${entryRelativePath}`)
          continue
        }
        let metadata = {}
        if (isImageFile(entryPath)) {
          metadata = await getImageMeta(entryPath)
        } else {
          metadata = {}
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
        })
      }
    }
  } catch (error) {
    debug(`Error scanning directory ${dirPath}:`, error)
    throw error
  }
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
async function initializeDatabaseSync() {
  try {
    debug('Initializing database sync...')
    await syncAllFilesToDatabase()
  } catch (error) {
    debug('Failed to initialize database sync:', error)
  }
}
async function formatListingEntry(
  entry,
  baseDir,
  normalizedDir,
  req,
  includeMime = false
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
      debug(`Excluded entry: ${entry.name}`)
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
    let fullPath = safeApiPath(`${BASE_PATH}/api/files`, relativePath)
    fullPath = fullPath.replace(/([^:])\/\//g, '$1/')
    if (/\.[a-zA-Z0-9]+\/$/.test(fullPath)) {
      fullPath = fullPath.replace(/(\.[a-zA-Z0-9]+)\/$/, '$1')
    }
    const url = (await getHostUrl(req)) + fullPath
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
    }
    if (includeMime && !entry.isDirectory()) {
      result.mime = await getFileMime(entry.name)
    }
    return result
  } catch (error) {
    debug('Error formatting listing entry:', error)
    return null
  }
}
async function createDbEntriesForContents(items, parentPath = '') {
  try {
    for (const item of items) {
      const relPath = parentPath ? `${parentPath}/${item.name}` : item.name
      const paths = buildPaths(BASE_DIR, relPath)
      const localPath = paths.local
      let metadata = {}
      if (isImageFile(localPath)) {
        metadata = await getImageMeta(localPath)
      } else {
        metadata = {}
      }
      if (item.type === 'directory') {
        await upsertDirectoryEntry({
          name: item.name,
          paths,
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
          paths,
          size: item.size || 0,
          type: item.type || null,
          collection: item.collection || null,
          author: item.author || null,
          created: item.created || null,
          modified: item.modified || null,
          meta: { ...metadata },
        })
      }
    }
  } catch (error) {
    debug('Error creating DB entries for contents:', error)
  }
}
module.exports = {
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
}
