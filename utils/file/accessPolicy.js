const fs = require('node:fs/promises')
const path = require('node:path')
const config = require('../../config')
const { isExcluded } = require('./listing')
const { hasAllowedExtension, isDisallowedExtension } = require('./typeGuards')
const { isSidecarFile, normalizeSidecarExtension } = require('./sidecar')
const disallowedFiles = Array.isArray(config.DISALLOWED_FILES)
  ? config.DISALLOWED_FILES.map((name) => String(name).toLowerCase())
  : []

/**
 * @param {string} root
 * @param {string} target
 * @returns {string | null}
 */
function relativeWithin(root, target) {
  const relative = path.relative(root, target)
  if (
    !relative ||
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    return null
  }
  return relative.split(path.sep).join('/')
}

/**
 * @param {string} root
 * @param {string} target
 */
async function canonicalRelative(root, target) {
  const realTarget = await fs.realpath(target)
  return relativeWithin(root, realTarget)
}

/**
 * @param {string} filePath
 * @param {string} baseDir
 * @returns {Promise<boolean>}
 */
async function isAllowedFilesystemEntry(filePath, baseDir) {
  const root = await fs.realpath(baseDir)
  const requestedRelative = relativeWithin(
    path.resolve(baseDir),
    path.resolve(filePath)
  )
  const actualRelative = await canonicalRelative(root, filePath)
  if (!requestedRelative || !actualRelative) {
    return false
  }
  if (
    (await isExcluded(requestedRelative)) ||
    (await isExcluded(actualRelative))
  ) {
    return false
  }
  const filename = path.basename(filePath).toLowerCase()
  if (disallowedFiles.includes(filename)) {
    return false
  }
  if (isDisallowedExtension(filePath)) {
    return false
  }
  const stats = await fs.stat(filePath)
  if (stats.isDirectory()) {
    return true
  }
  if (!stats.isFile()) {
    return false
  }
  if (!isSidecarFile(filePath)) {
    return hasAllowedExtension(filePath)
  }
  const extension = normalizeSidecarExtension(config.SIDECAR_FILE_EXTENSION)
  const originalPath = filePath.slice(0, -extension.length)
  const originalRequestedRelative = relativeWithin(
    path.resolve(baseDir),
    path.resolve(originalPath)
  )
  let originalActualRelative
  try {
    originalActualRelative = await canonicalRelative(root, originalPath)
  } catch (error) {
    const err = /** @type {any} */ (error)
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') {
      return false
    }
    throw error
  }
  if (!originalRequestedRelative || !originalActualRelative) {
    return false
  }
  if (
    (await isExcluded(originalRequestedRelative)) ||
    (await isExcluded(originalActualRelative))
  ) {
    return false
  }
  const originalName = path.basename(originalPath).toLowerCase()
  if (
    disallowedFiles.includes(originalName) ||
    isDisallowedExtension(originalPath) ||
    !hasAllowedExtension(originalPath)
  ) {
    return false
  }
  const originalStats = await fs.stat(originalPath)
  return originalStats.isFile()
}

module.exports = {
  isAllowedFilesystemEntry,
}
