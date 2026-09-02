const path = require('path')
const log = require('./logHandler')
const filenameReservedRegexModule = /** @type {any} */ (
  require('filename-reserved-regex')
)
const filenameReservedRegex =
  filenameReservedRegexModule.default || filenameReservedRegexModule
const windowsReservedNameRegex =
  filenameReservedRegexModule.windowsReservedNameRegex ||
  filenameReservedRegexModule.default?.windowsReservedNameRegex
const normalizePath = require('normalize-path')
const resolvePath = require('resolve-path')

/** @param {string} filePath */
const pathExists = async (filePath) => {
  try {
    await require('fs').promises.access(filePath)
    return true
  } catch (/** @type {any} */ error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return false
    throw error
  }
}

/**
 * @param {string} s
 * @returns {string}
 */
const normalizeString = (s) => s.trim().normalize('NFC')

/**
 * @param {string | null | undefined} input
 * @returns {string | null}
 */
const sanitizePathComponent = (input) => {
  if (!input) return null
  const normalizedInput = normalizeString(String(input))
  if (!normalizedInput || /^[.\s]+$/.test(normalizedInput)) {
    log.info('Rejected path component:', input)
    return null
  }
  let sanitized = normalizedInput
  sanitized = sanitized.replace(/[<>:"/\\|?*\u0000-\u001F\u0080-\u009F]/g, '_')
  sanitized = sanitized.replace(/^\.+/, '_')
  sanitized = sanitized.replace(/\.+$/, '')
  sanitized = sanitized.replace(/_+/g, '_')
  sanitized = sanitized.trim()
  if (!sanitized || sanitized.startsWith('.')) {
    log.info('Rejected path component:', input)
    return null
  }
  if (
    filenameReservedRegex().test(sanitized) ||
    windowsReservedNameRegex().test(sanitized)
  ) {
    sanitized = `${sanitized}_`
  }
  return sanitized
}

/**
 * @param {string | null | undefined} rawPath
 * @returns {string[] | null}
 */
const sanitizePathSegments = (rawPath) => {
  if (!rawPath) return null
  const parts = String(rawPath).split('/').filter(Boolean)
  const sanitized = parts.map(sanitizePathComponent)
  if (sanitized.some((component) => component == null)) return null
  return /** @type {string[]} */ (sanitized)
}

/**
 * @param {string} baseDir
 * @param {...(string | null | undefined)} pathComponents
 * @returns {string | null}
 */
const safePath = (baseDir, ...pathComponents) => {
  try {
    const segments = pathComponents
      .filter((c) => c != null && c !== '')
      .flatMap((c) => {
        const str = String(c)
        return str
          .split(/[\/,]+/)
          .map((s) => s.trim())
          .filter(Boolean)
      })
      .map(sanitizePathComponent)
      .filter(Boolean)
    if (segments.length === 0) return path.resolve(baseDir)
    return resolvePath(baseDir, segments.join('/'))
  } catch (error) {
    log.info('safePath rejected:', error)
    return null
  }
}

/**
 * @param {string} targetPath
 * @param {string} baseDir
 * @returns {boolean}
 */
const isPathSafe = (targetPath, baseDir) => {
  if (
    !targetPath ||
    !baseDir ||
    typeof targetPath !== 'string' ||
    typeof baseDir !== 'string'
  ) {
    return false
  }
  try {
    const rel = path.relative(path.resolve(baseDir), path.resolve(targetPath))
    resolvePath(baseDir, rel)
    return true
  } catch {
    return false
  }
}

/**
 * @param {string} pathStr
 * @returns {string}
 */
const normalizeAndEncodePath = (pathStr) => {
  const normalized = normalizePath(pathStr)
  log.debug('Normalized path:', normalized)
  return normalized
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/')
}

/**
 * @param {{collection?: string, author?: string, splat?: string}} params
 * @returns {{
 *   collection: string | null,
 *   author: string | null,
 *   splat: string | null,
 *   isValid: boolean
 * }}
 */
const validateRequestParams = (params) => {
  if (!params || typeof params !== 'object') {
    return { collection: null, author: null, splat: null, isValid: false }
  }
  const collection = sanitizePathComponent(params.collection)
  const author = sanitizePathComponent(params.author)
  const splatParts = params.splat ? sanitizePathSegments(params.splat) : null
  return {
    collection,
    author,
    splat: splatParts ? splatParts.join('/') : null,
    isValid: collection !== null,
  }
}

/**
 * @param {string} baseApiPath
 * @param {string} relativePath
 * @returns {string}
 */
const safeApiPath = (baseApiPath, relativePath) => {
  if (!relativePath) return baseApiPath
  const encoded = normalizePath(relativePath)
    .split('/')
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join('/')
  const result = `${baseApiPath}/${encoded}`.replace(/\/+/g, '/')
  return result.endsWith('/') ? result : result + '/'
}

/**
 * @param {string} filename
 * @param {string[]} [allowedExtensions=[]]
 * @returns {boolean}
 */
const hasAllowedFileExtension = (filename, allowedExtensions = []) => {
  if (!filename || typeof filename !== 'string') return false
  if (!allowedExtensions.length) return true
  const ext = path.extname(filename).toLowerCase()
  return allowedExtensions.some(
    (e) => (e.startsWith('.') ? e : `.${e}`).toLowerCase() === ext
  )
}

/**
 * @param {string} localBase
 * @param {string} [relativePath='']
 * @param {string} [baseApiPath='']
 * @returns {{
 *   local: string,
 *   relative: string,
 *   remote: string
 * } | null}
 */
const buildPaths = (localBase, relativePath, baseApiPath = '') => {
  try {
    if (!localBase || typeof localBase !== 'string') {
      log.warn('Invalid localBase in buildPaths')
      return null
    }
    const rel = relativePath ? normalizePath(relativePath) : ''
    if (rel && !sanitizePathSegments(rel)) {
      log.warn('Invalid path segments in buildPaths:', rel)
      return null
    }
    const local = normalizePath(path.join(localBase, rel))
    let remote = safeApiPath(`${baseApiPath}/api/files`, rel)
    if (remote) {
      remote = remote.replace(/([^:])\/\//g, '$1/')
      if (/\.[a-zA-Z0-9]+\/$/.test(remote))
        remote = remote.replace(/(\.[a-zA-Z0-9]+)\/$/, '$1')
    }
    return { local, relative: rel, remote }
  } catch (error) {
    log.error('Error in buildPaths:', error)
    return null
  }
}

/**
 * @param {string} relativePath
 * @returns {{ collection: string | null, author: string | null }}
 */
const deriveCollectionAuthor = (relativePath) => {
  try {
    if (!relativePath || typeof relativePath !== 'string')
      return { collection: null, author: null }
    const parts = normalizePath(relativePath).split('/').filter(Boolean)
    return {
      collection: parts[0] ? sanitizePathComponent(parts[0]) : null,
      author: parts[1] ? sanitizePathComponent(parts[1]) : null,
    }
  } catch (error) {
    log.error('Error in deriveCollectionAuthor:', error)
    return { collection: null, author: null }
  }
}

module.exports = {
  normalizeString,
  normalizePath,
  normalizeAndEncodePath,
  sanitizePathComponent,
  sanitizePathSegments,
  safePath,
  isPathSafe,
  validateRequestParams,
  safeApiPath,
  pathExists,
  hasAllowedFileExtension,
  buildPaths,
  deriveCollectionAuthor,
}
