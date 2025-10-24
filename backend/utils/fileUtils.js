const path = require('path')
const fs = require('fs').promises
const debug = require('debug')('gdl-api:utils:file')
const { normalizeString, normalizePath, safeApiPath } = require('./pathUtils')
const {
  DISALLOWED_DIRS,
  DISALLOWED_FILES,
  DISALLOWED_EXTENSIONS,
  MAX_DEPTH,
  BASE_DIR,
  BASE_PATH,
} = require('../config')
const { getImageMeta } = require('./imageUtils')
const Directory = require('../models/Directory')
const File = require('../models/File')
const uuid = require('uuid')
async function safeReadJson(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    debug(`Error reading file ${filePath}:`, error)
    return null
  }
}
function hasAllowedExtension(filePath) {
  if (!filePath) return false
  const ext = path.extname(filePath).toLowerCase()
  const isDisallowed = DISALLOWED_EXTENSIONS?.some((pattern) => {
    if (pattern.startsWith('*.')) return ext === pattern.slice(1)
    return ext === pattern
  })
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
function isFileExcluded(fileName) {
  if (!fileName) return true
  const normalized = normalizeString(fileName).toLowerCase()
  if (
    safeDisallowedFiles.some((pattern) => {
      if (pattern.startsWith('*.')) {
        return normalized.endsWith(pattern.slice(1))
      }
      return (
        normalized === pattern.toLowerCase() ||
        normalized.includes(pattern.toLowerCase())
      )
    })
  )
    return true
  return DISALLOWED_FILES.some((pattern) => {
    if (pattern instanceof RegExp) {
      return pattern.test(normalized)
    }
    return normalized.includes(pattern.toLowerCase())
  })
}
async function getAllDirectories(dirPath, relativePath = '', depth = 0) {
  if (depth >= MAX_DEPTH) return []
  try {
    const entries = await fs.readdir(dirPath, {
      withFileTypes: true,
    })
    const dirs = entries.filter(
      (entry) => entry.isDirectory() && !isExcluded(entry.name)
    )
    let results = dirs.map((dir) => {
      const dirRelativePath = relativePath
        ? `${relativePath}/${dir.name}`
        : dir.name
      return {
        name: dir.name,
        path: dirRelativePath,
        fullPath: path.join(dirPath, dir.name),
      }
    })
    for (const dir of results) {
      const subDirs = await getAllDirectories(dir.fullPath, dir.path, depth + 1)
      results = results.concat(subDirs)
    }
    return results
  } catch (error) {
    debug('Error reading directory:', dirPath, error)
    return []
  }
}
async function getAllDirectoriesAndFiles(
  dirPath,
  relativePath = '',
  depth = 0,
  topLevelOnly = false
) {
  if (depth >= MAX_DEPTH)
    return {
      items: [],
      total: 0,
    }
  try {
    const entries = await fs.readdir(dirPath, {
      withFileTypes: true,
    })
    const results = []
    for (let i = 0; i < entries.length; i) {
      const batch = entries.slice(i, i)
      const batchPromises = batch.map(async (entry) => {
        const fullPath = path.join(dirPath, entry.name)
        const relPath = path.join(relativePath, entry.name)
        if (await isExcluded(relPath)) {
          return null
        }
        try {
          const stats = await fs.stat(fullPath)
          if (entry.isDirectory()) {
            if (!topLevelOnly) {
              const subDirContents = await getAllDirectoriesAndFiles(
                fullPath,
                relPath,
                depth + 1,
                false
              )
              if (subDirContents.items.length > 0) {
                return {
                  type: 'directory',
                  fullPath,
                  name: entry.name,
                  size: 0,
                  modified: stats.mtime,
                  contents: subDirContents.items,
                }
              }
              return null
            }
            return {
              type: 'directory',
              fullPath,
              name: entry.name,
              size: 0,
              modified: stats.mtime,
            }
          } else if (!topLevelOnly && hasAllowedExtension(entry.names)) {
            return {
              type: 'file',
              fullPath,
              name: entry.name,
              size: stats.size,
              modified: stats.mtime,
            }
          }
        } catch (error) {
          debug('Error processing entry:', {
            entry: entry.name,
            error: error.message,
          })
          return null
        }
      })
      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults.filter(Boolean))
    }
    const sortedResults = results.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    return {
      items: sortedResults,
      total: sortedResults.length,
    }
  } catch (error) {
    debug('Error scanning directory:', {
      dirPath,
      relativePath,
      error: error.message,
    })
    return {
      items: [],
      total: 0,
    }
  }
}
async function getCollections(basePath) {
  try {
    const dirs = await fs.readdir(basePath, {
      withFileTypes: true,
    })
    return dirs
      .filter((dirent) => dirent.isDirectory() && !isExcluded(dirent.name))
      .map((dirent) => dirent.name)
      .sort()
  } catch (error) {
    debug('Error reading collections directory:', error)
  }
}
function isDocFile(filename) {
  if (!filename) return false
  const ext = ['.doc', '.docx']
  return ext.some((e) => filename.toLowerCase().endsWith(e))
}
function isImageFile(filename) {
  if (!filename) return false
  const ext = ['.jpg', '.jpeg', '.png', '.webp', '.avif']
  return ext.some((e) => filename.toLowerCase().endsWith(e))
}
function isVideoFile(filename) {
  if (!filename) return false
  const ext = ['.mp4', '.mkv', '.webm', '.avi', '.mov']
  return ext.some((e) => filename.toLowerCase().endsWith(e))
}
function isAudioFile(filename) {
  if (!filename) return false
  const ext = ['.mp3', '.wav', '.flac', '.aac', '.ogg']
  return ext.some((e) => filename.toLowerCase().endsWith(e))
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
function isPathExcluded(pathStr) {
  if (!pathStr) return true
  const normalizedPath = normalizePath(pathStr).toLowerCase()
  const segments = normalizedPath.split('/').filter(Boolean)
  for (const segment of segments) {
    const normalizedSegment = normalizeString(segment)
    for (const pattern of DISALLOWED_DIRS) {
      const normalizedPattern = pattern.toLowerCase().trim()
      if (normalizedPattern.includes('*')) {
        const regexPattern = normalizedPattern
          .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
          .replace(/\*/g, '.*')
        const regex = new RegExp(`^${regexPattern}$`)
        if (regex.test(normalizedSegment)) {
          debug('Path excluded due to wildcard match:', {
            segment,
            pattern: normalizedPattern,
            fullPath: pathStr,
          })
          return true
        }
      } else if (
        normalizedSegment === normalizedPattern ||
        normalizedSegment.includes(normalizedPattern)
      ) {
        debug('Path excluded due to exact/partial match:', {
          segment,
          pattern: normalizedPattern,
          fullPath: pathStr,
        })
        return true
      }
    }
  }
  return false
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
      if (isImageFile(realPath)) {
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
        result = await upsertFileEntry({
          name,
          paths,
          size: stats.size,
          type: 'file',
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
module.exports = {
  safeReadJson,
  isExcluded,
  hasAllowedExtension,
  isFileExcluded,
  getAllDirectories,
  getAllDirectoriesAndFiles,
  getCollections,
  isPathExcluded,
  isDocFile,
  isImageFile,
  isVideoFile,
  isAudioFile,
  isDisallowedExtension,
  getFileMime,
  upsertAccessedItem,
  upsertDirectoryEntry,
  upsertFileEntry,
}
