const sharp = require('sharp')
const fs = require('fs').promises
const log = require('../logHandler')
const { MAX_BUFFER_SIZE } = /** @type {any} */ (require('../../config'))
const { buildExifPayload } = require('./exif')
/** @param {string} imagePath */
async function getSafeMtime(imagePath) {
  const stat = await fs.stat(imagePath)
  if (Number.isFinite(MAX_BUFFER_SIZE) && stat.size > MAX_BUFFER_SIZE) {
    log.debug('File size exceeds maximum allowed buffer size')
    return null
  }
  return stat.mtime
}
/** @param {string} imagePath */
async function getImageMeta(imagePath) {
  try {
    return await sharp(imagePath, {
      failOnError: false,
      limitInputPixels: false,
    }).metadata()
  } catch (error) {
    log.error('Failed to read image metadata', error)
    return null
  }
}
/** @param {string} imagePath */
async function applyMetadata(imagePath) {
  if (!imagePath) {
    log.debug('No image path provided for metadata')
    return null
  }
  let mtime
  try {
    mtime = await getSafeMtime(imagePath)
    if (!mtime) {
      return null
    }
  } catch (error) {
    log.error('Failed to read file stats:', error)
    return null
  }
  try {
    const exif = await buildExifPayload(mtime)
    const transformer = sharp(imagePath, {
      failOnError: false,
      limitInputPixels: false,
    }).withMetadata({
      exif,
    })
    return transformer
  } catch (error) {
    log.error('Sharp metadata error:', error)
    return null
  }
}
module.exports = {
  getSafeMtime,
  getImageMeta,
  applyMetadata,
}
