const path = require('path')
const fs = require('fs').promises
const log = require('../logHandler')
const {
  normalizeString,
  safeApiPath,
  safePath,
  isPathSafe,
  buildPaths,
  deriveCollectionAuthor,
} = require('../pathUtils')
const { getHostUrl } = require('../urlUtils')
const {
  DISALLOWED_DIRS,
  DISALLOWED_FILES,
  STAT_DIRECTORY_SIZE,
  STAT_FILE_SIZE,
  BASE_PATH,
} = /** @type {any} */ (require('../../config'))
const { isSidecarFile } = require('./sidecar')
const { isDisallowedExtension } = require('./typeGuards')
const { getFileMime } = require('./mimeAndHash')
const safeDisallowedDirs = Array.isArray(DISALLOWED_DIRS) ? DISALLOWED_DIRS : []
const safeDisallowedFiles = Array.isArray(DISALLOWED_FILES)
  ? DISALLOWED_FILES
  : []

/**
 * @param {boolean} isDirectory
 * @returns
 */
function shouldIncludeSize(isDirectory = false) {
  return isDirectory ? STAT_DIRECTORY_SIZE === true : STAT_FILE_SIZE === true
}

/**
 * @param {import('fs').Stats | null | undefined} stats
 * @param {boolean} [isDirectory]
 */
function getDisplaySize(stats, isDirectory = false) {
  if (!shouldIncludeSize(isDirectory)) return null
  const size = stats?.size
  return Number.isFinite(size) ? size : null
}

/**
 * @param {import('fs').Stats | null | undefined} stats
 * @param {boolean} [isDirectory]
 */
function getStoredSize(stats, isDirectory = false) {
  const size = getDisplaySize(stats, isDirectory)
  return Number.isFinite(size) ? size : 0
}

/**
 * @param {{ size?: number } | null | undefined} item
 * @param {boolean} [isDirectory]
 */
function getStoredItemSize(item, isDirectory = false) {
  if (!shouldIncludeSize(isDirectory)) return 0
  const size = item?.size
  return Number.isFinite(size) ? size : 0
}

/** @param {string} dirName @param {boolean} [isRoot] */
async function isExcluded(dirName, isRoot = false) {
  if (!dirName) return true
  const normalizeForDir = (/** @type {string} */ s) =>
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

/**
 * @param {any[]} contents
 * @param {string} [sortBy]
 * @param {string} [direction]
 */
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
        comparison =
          new Date(a.modified || 0).getTime() -
          new Date(b.modified || 0).getTime()
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
        comparison =
          new Date(a.created || 0).getTime() -
          new Date(b.created || 0).getTime()
        break
      default:
        comparison = a.name.localeCompare(b.name, undefined, { numeric: true })
    }
    return direction === 'asc' ? comparison : -comparison
  })
}

/** @param {any} query */
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

/**
 * @param {import('fs').Dirent} entry
 * @param {string} baseDir
 * @param {string} normalizedDir
 * @param {import('express').Request} req
 * @param {boolean} [includeMime]
 * @param {Record<string, any> | null} [fileMetadataMap]
 */
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
      (entry.isFile() && isSidecarFile(entry.name)) ||
      DISALLOWED_DIRS.includes(entry.name) ||
      (entry.isFile() &&
        (DISALLOWED_FILES.includes(entry.name) ||
          isDisallowedExtension(entry.name)))
    ) {
      log.info(`Excluded entry: ${entry.name}`)
      return null
    }
    const entryPath = safePath(baseDir, entry.name)
    if (!entryPath || !isPathSafe(entryPath, normalizedDir)) return null
    let stats
    try {
      stats = await fs.stat(entryPath)
    } catch {
      return null
    }
    const size = getDisplaySize(stats, entry.isDirectory())
    const mtime = stats.mtime
    const ctime = stats.birthtime
    const relativePath = path
      .relative(normalizedDir, entryPath)
      .replace(/\\/g, '/')
    const { collection, author } = deriveCollectionAuthor(relativePath)
    const paths = /** @type {any} */ (
      buildPaths(baseDir, relativePath, BASE_PATH) || {}
    )
    const fullPath =
      paths.remote || safeApiPath(`${BASE_PATH}/api/files`, relativePath)
    const url = (await getHostUrl(req)) + fullPath
    let fileUuid = null
    let fileHash = null
    let fileSidecar = null
    if (!entry.isDirectory() && fileMetadataMap) {
      fileUuid = fileMetadataMap[relativePath]?.uuid || null
      fileHash = fileMetadataMap[relativePath]?.hash || null
      fileSidecar = fileMetadataMap[relativePath]?.sidecar || null
    }
    const result = /** @type {{
      name: string,
      type: string,
      size: number | null,
      modified: Date,
      created: Date,
      path: string,
      url: string,
      collection: string | null,
      author: string | null,
      uuid?: string | null,
      hash?: string | null,
      sidecar?: Record<string, any> | null,
      mime?: string | null,
    }} */ ({
      name: entry.name,
      type: entry.isDirectory() ? 'directory' : 'file',
      size,
      modified: mtime,
      created: ctime,
      path: fullPath,
      url,
      collection,
      author,
      ...(entry.isDirectory()
        ? {}
        : { uuid: fileUuid, hash: fileHash, sidecar: fileSidecar }),
    })
    if (includeMime && !entry.isDirectory()) {
      result.mime = await getFileMime(entryPath)
    }
    return result
  } catch (error) {
    log.error('Error formatting listing entry:', error)
    return null
  }
}

module.exports = {
  shouldIncludeSize,
  getDisplaySize,
  getStoredSize,
  getStoredItemSize,
  sortContents,
  parseSortQuery,
  formatListingEntry,
  isExcluded,
}
