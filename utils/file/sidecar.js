const fs = require('fs').promises
const log = require('../logHandler')
const { SIDECAR_FILE, SIDECAR_FILE_EXTENSION } = /** @type {any} */ (
  require('../../config')
)

/** @param {unknown} extension */
function normalizeSidecarExtension(extension) {
  if (typeof extension !== 'string' || !extension.trim()) return '.json'
  const normalized = extension.trim().toLowerCase()
  return normalized.startsWith('.') ? normalized : `.${normalized}`
}

/** @param {string} filePath */
function isSidecarFile(filePath) {
  if (!SIDECAR_FILE || !filePath) return false
  const sidecarExtension = normalizeSidecarExtension(SIDECAR_FILE_EXTENSION)
  return filePath.toLowerCase().endsWith(sidecarExtension.toLowerCase())
}

/** @param {string} filePath */
function getSidecarPath(filePath) {
  if (!filePath || isSidecarFile(filePath)) return null
  return `${filePath}${normalizeSidecarExtension(SIDECAR_FILE_EXTENSION)}`
}

/** @param {unknown} value */
function isSidecarObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/** @param {string} filePath */
async function readSidecarFile(filePath) {
  if (!SIDECAR_FILE || !filePath || isSidecarFile(filePath)) return null
  const sidecarPath = getSidecarPath(filePath)
  if (!sidecarPath) return null
  try {
    const sidecarData = await fs.readFile(sidecarPath, 'utf8')
    const parsed = JSON.parse(sidecarData)
    if (!isSidecarObject(parsed)) {
      log.warn('Sidecar file must contain a JSON object:', sidecarPath)
      return null
    }
    return parsed
  } catch (/** @type {any} */ error) {
    if (error?.code === 'ENOENT') {
      return null
    }
    log.warn('Failed to parse sidecar file:', {
      path: sidecarPath,
      error: error.message,
    })
    return null
  }
}

module.exports = {
  normalizeSidecarExtension,
  isSidecarFile,
  getSidecarPath,
  isSidecarObject,
  readSidecarFile,
}
