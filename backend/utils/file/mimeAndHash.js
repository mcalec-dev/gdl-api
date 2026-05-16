const path = require('path')
const fs = require('fs').promises
const crypto = require('crypto')
const log = require('../logHandler')
const { HASH_ALGORITHM } = /** @type {any} */ (require('../../config'))
/** @type {((buffer: Uint8Array) => Promise<{mime: string, ext: string} | undefined>) | null} */
let fileTypeFromBufferResolver = null

/** @param {string | null | undefined} type */
function normalizeMimeType(type) {
  if (!type) return null
  return type.replace('application/mp4', 'video/mp4')
}
/** @param {string} file */
async function getFileMime(file) {
  if (!file) return null
  const ext = path.extname(file).toLowerCase()
  const fallbackType = require('mime-types').lookup(ext)
  let fileTypeFn = fileTypeFromBufferResolver
  if (!fileTypeFn) {
    try {
      const fileTypeModule = await import('file-type')
      fileTypeFromBufferResolver = fileTypeModule.fileTypeFromBuffer
      fileTypeFn = fileTypeFromBufferResolver
    } catch {
      log.warn(
        'Unable to load file-type module, falling back to extension mime'
      )
      fileTypeFn = null
    }
  }
  if (fileTypeFn) {
    let header = null
    let handle
    try {
      handle = await fs.open(file, 'r')
      const buffer = Buffer.alloc(4100)
      const { bytesRead } = await handle.read(buffer, 0, 4100, 0)
      header = bytesRead > 0 ? buffer.subarray(0, bytesRead) : null
    } catch {
      header = null
    } finally {
      if (handle) {
        await handle.close()
      }
    }
    if (header) {
      try {
        const detectedType = await fileTypeFn(header)
        if (detectedType?.mime) {
          return normalizeMimeType(detectedType.mime)
        }
      } catch (/** @type {any} */ error) {
        log.warn('Magic number mime detection failed, using fallback:', {
          path: file,
          error: error.message,
        })
      }
    }
  }
  if (fallbackType === false || !fallbackType) return null
  return normalizeMimeType(fallbackType)
}
/** @param {string} filePath */
async function calculateFileHash(filePath) {
  if (!filePath || !HASH_ALGORITHM) return null
  try {
    const fileStream = require('fs').createReadStream(filePath)
    const hash = crypto.createHash(HASH_ALGORITHM)
    for await (const chunk of fileStream) {
      hash.update(chunk)
    }
    return hash.digest('hex')
  } catch (/** @type {any} */ error) {
    log.error('Error calculating file hash:', {
      path: filePath,
      error: error.message,
    })
    return null
  }
}
module.exports = {
  normalizeMimeType,
  getFileMime,
  calculateFileHash,
}
