const path = require('path')
const log = require('../logHandler')
const { DISALLOWED_EXTENSIONS } = /** @type {any} */ (require('../../config'))
const { isSidecarFile } = require('./sidecar')

/** @param {string} filePath */
function hasAllowedExtension(filePath) {
  if (!filePath) return false
  if (isSidecarFile(filePath)) return false
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

/** @param {string} filename @param {string[]} extensions */
function hasAnyExtension(filename, extensions) {
  if (!filename || !Array.isArray(extensions) || extensions.length === 0) {
    return false
  }
  const normalized = filename.toLowerCase()
  return extensions.some((ext) => normalized.endsWith(ext))
}

/** @param {string | null | undefined} param */
function allowedQualityParams(param) {
  const ALLOWED_PARAMS = {
    0: 'default',
    1: 'low',
    2: 'medium',
    3: 'high',
  }
  if (param === undefined) return undefined
  const normalized = String(param).trim()
  if (!normalized) return null
  if (Object.prototype.hasOwnProperty.call(ALLOWED_PARAMS, normalized)) {
    return normalized
  }
  log.warn('Invalid quality parameter:', param)
  return null
}

/** @param {string} param */
function isValidKernel(param) {
  const VAILD_KERNELS = [
    'nearest',
    'cubic',
    'linear',
    'mitchell',
    'lanczos2',
    'lanczos3',
    'mks2013',
    'mks2021',
  ]
  return (
    typeof param === 'string' && VAILD_KERNELS.includes(param.toLowerCase())
  )
}

/** @param {string} filename */
function isDocFile(filename) {
  return hasAnyExtension(filename, ['.doc', '.docx'])
}

/** @param {string} filename */
function isImageFile(filename) {
  return hasAnyExtension(filename, ['.jpg', '.jpeg', '.png', '.webp', '.avif'])
}

/** @param {string} filename */
function isVideoFile(filename) {
  return hasAnyExtension(filename, ['.mp4', '.mkv', '.webm', '.avi', '.mov'])
}

/** @param {string} filename */
function isAudioFile(filename) {
  return hasAnyExtension(filename, ['.mp3', '.wav', '.flac', '.aac', '.ogg'])
}

/** @param {string} filename */
function isSwfFile(filename) {
  return hasAnyExtension(filename, ['.swf'])
}

/** @param {string} filename */
function isDisallowedExtension(filename) {
  if (!filename) return false
  const ext = path.extname(filename).toLowerCase()
  return DISALLOWED_EXTENSIONS.some(
    (/** @type {string} */ disallowedExt) =>
      ext === disallowedExt.toLowerCase() ||
      ext === `.${disallowedExt.toLowerCase()}`
  )
}

module.exports = {
  hasAllowedExtension,
  hasAnyExtension,
  isDocFile,
  isImageFile,
  isVideoFile,
  isAudioFile,
  isSwfFile,
  isDisallowedExtension,
  allowedQualityParams,
  isValidKernel,
}
