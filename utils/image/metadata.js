const sharp = require('sharp')
const fs = require('fs').promises
const log = require('../logHandler')
const { MAX_BUFFER_SIZE } = /** @type {any} */ (require('../../config'))
const { buildExifPayload } = require('./exif')

/** @param {string} imagePath */
async function getSafeMtime(imagePath) {
  const stat = await fs.stat(imagePath)
  if (Number.isFinite(MAX_BUFFER_SIZE) && stat.size > MAX_BUFFER_SIZE) {
    log.debug(
      'Cannot process image:',
      imagePath,
      'file size exceeds the maximum allowed buffer size'
    )
    return null
  }
  return stat.mtime
}

/** @param {string} imagePath */
async function getImageMeta(imagePath) {
  try {
    return await sharp(imagePath, {
      limitInputPixels: false,
    }).metadata()
  } catch (error) {
    log.error('Failed to read image metadata for:', imagePath, error)
    return null
  }
}

/** @param {string} imagePath */
async function applyMetadata(imagePath) {
  if (!imagePath) {
    log.debug(
      'Cannot apply image metadata:',
      imagePath,
      'no image path was provided'
    )
    return null
  }
  let mtime
  try {
    mtime = await getSafeMtime(imagePath)
    if (!mtime) {
      log.debug(
        'Cannot apply image metadata to:',
        imagePath,
        'file is too large'
      )
      return null
    }
  } catch (error) {
    log.error('Failed to read file stats for:', imagePath, error)
    return null
  }
  try {
    const exif = await buildExifPayload(mtime)
    const transformer = sharp(imagePath, {
      limitInputPixels: false,
    }).withMetadata({
      exif,
    })
    return transformer
  } catch (error) {
    log.error('Failed to apply image metadata to:', imagePath, error)
    return null
  }
}

module.exports = {
  getSafeMtime,
  getImageMeta,
  applyMetadata,
}
