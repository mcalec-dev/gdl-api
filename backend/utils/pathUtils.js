const path = require('path')
const debug = require('debug')('gdl-api:utils:path')
const normalizeString = (str) => {
  if (typeof str !== 'string') return ''
  return str.trim().normalize('NFC')
}
const normalizePath = (pathStr) => {
  if (typeof pathStr !== 'string') return ''
  return pathStr.replace(/\\/g, '/').replace(/\/+/g, '/').trim()
}
const normalizeAndEncodePath = (pathStr) => {
  if (typeof pathStr !== 'string') return ''
  const normalized = normalizePath(pathStr)
  debug('Normalized path:', normalized)
  return normalized
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}
const isSubPath = (childPath, parentPath) => {
  const normalizedChild = path.resolve(childPath).replace(/\\/g, '/')
  const normalizedParent = path.resolve(parentPath).replace(/\\/g, '/')
  const normalizedParentWithSlash = normalizedParent.endsWith('/')
    ? normalizedParent
    : normalizedParent + '/'
  return (
    normalizedChild.startsWith(normalizedParentWithSlash) ||
    normalizedChild === normalizedParent
  )
}
const sanitizePathComponent = (userInput) => {
  if (!userInput || typeof userInput !== 'string') {
    return null
  }
  const sanitized = userInput
    .replace(/\.\./g, '')
    .replace(/[<>"|?*]/g, '')
    .replace(/^\.+/, '')
    .trim()
  if (!sanitized || /^[.\s]*$/.test(sanitized)) {
    debug(
      'Rejected sanitized path component (empty or dots/spaces):',
      userInput
    )
    return null
  }
  const dangerousPatterns = [
    /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i,
    /^\./,
    /\s+$/,
  ]
  for (const pattern of dangerousPatterns) {
    if (pattern.test(sanitized)) {
      debug('Rejected path component due to dangerous pattern:', sanitized)
      return null
    }
  }
  return sanitized
}
const safePath = (baseDir, ...pathComponents) => {
  try {
    if (!baseDir || typeof baseDir !== 'string') {
      debug('Invalid baseDir provided to safePath')
      return null
    }
    const sanitizedComponents = pathComponents
      .filter((component) => component != null && component !== '')
      .map((component) => sanitizePathComponent(String(component)))
      .filter((component) => component !== null)
    if (sanitizedComponents.length === 0) {
      return path.resolve(baseDir)
    }
    const constructedPath = path.join(baseDir, ...sanitizedComponents)
    const resolvedPath = path.resolve(constructedPath)
    const resolvedBase = path.resolve(baseDir)
    if (!isSubPath(resolvedPath, resolvedBase)) {
      debug(
        'Path traversal attempt detected:',
        constructedPath,
        '->',
        resolvedPath
      )
      return null
    }
    return resolvedPath
  } catch (error) {
    debug('Error in safePath construction:', error)
    return null
  }
}
const isPathSafe = (targetPath, baseDir) => {
  try {
    if (
      !targetPath ||
      !baseDir ||
      typeof targetPath !== 'string' ||
      typeof baseDir !== 'string'
    ) {
      return false
    }
    const resolvedTarget = path.resolve(targetPath)
    const resolvedBase = path.resolve(baseDir)
    return isSubPath(resolvedTarget, resolvedBase)
  } catch (error) {
    debug('Error in isPathSafe:', error)
    return false
  }
}
const validateRequestParams = (params) => {
  if (!params || typeof params !== 'object') {
    return {
      collection: null,
      author: null,
      additionalPath: null,
      isValid: false,
    }
  }
  const collection = sanitizePathComponent(params.collection)
  const author = sanitizePathComponent(params.author)
  let additionalPath = null
  if (params[0]) {
    const pathParts = String(params[0]).split('/').filter(Boolean)
    const sanitizedParts = pathParts
      .map((part) => sanitizePathComponent(part))
      .filter((part) => part !== null)
    if (
      sanitizedParts.length > 0 &&
      sanitizedParts.length === pathParts.length
    ) {
      additionalPath = sanitizedParts.join('/')
    }
  }
  const result = {
    collection,
    author,
    additionalPath,
    isValid: collection !== null,
  }
  return result
}
const safeApiPath = (baseApiPath, relativePath) => {
  if (!relativePath) return baseApiPath
  const normalized = normalizePath(relativePath)
  const encoded = normalized
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/')
  const path = `${baseApiPath}/${encoded}`.replace(/\/+/g, '/')
  return path.endsWith('/') ? path : path + '/'
}
const hasAllowedFileExtension = (filename, allowedExtensions = []) => {
  if (!filename || typeof filename !== 'string') return false
  if (!Array.isArray(allowedExtensions) || allowedExtensions.length === 0)
    return true
  const ext = path.extname(filename).toLowerCase()
  return allowedExtensions.some((allowedExt) => {
    const normalizedAllowed = allowedExt.startsWith('.')
      ? allowedExt.toLowerCase()
      : `.${allowedExt.toLowerCase()}`
    return ext === normalizedAllowed
  })
}
module.exports = {
  normalizeString,
  normalizePath,
  normalizeAndEncodePath,
  isSubPath,
  sanitizePathComponent,
  safePath,
  isPathSafe,
  validateRequestParams,
  safeApiPath,
  hasAllowedFileExtension,
}
