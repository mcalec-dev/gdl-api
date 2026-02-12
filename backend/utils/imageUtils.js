const sharp = require('sharp')
const debug = require('debug')('gdl-api:utils:image')
const {
  HOST,
  NAME,
  MAX_PIXELS,
  MAX_SCALE,
  MAX_BUFFER_SIZE,
} = require('../config')
const fs = require('fs').promises
sharp.simd(true)
sharp.cache(false)
sharp.concurrency(5)
const validKernels = [
  'nearest',
  'linear',
  'cubic',
  'mitchell',
  'lanczos2',
  'lanczos3',
  'mks2013',
  'mks2021',
]
async function getImageMeta(imagePath) {
  try {
    return await sharp(imagePath, {
      failOnError: false,
      useOriginalDate: true,
      limitInputPixels: false,
    }).metadata()
  } catch (error) {
    debug('Failed to read image metadata', error)
    return null
  }
}
async function resizeImage(imagePath, { width, height, scale, kernel }) {
  if (!imagePath) {
    debug('No image path provided for resizing')
    return null
  }
  if (!width && !height && !scale) {
    debug('No resize parameters provided')
    return undefined
  }
  if (scale === 100) {
    debug('Scale is 100%, no resize needed')
    return undefined
  }
  if (kernel && !validKernels.includes(kernel)) {
    debug('Invalid kernel provided:', kernel)
    kernel = scale > 100 ? 'lanczos3' : 'mitchell'
  }
  let mtime = new Date()
  try {
    const stat = await fs.stat(imagePath)
    mtime = stat.mtime
    if (stat.size > MAX_BUFFER_SIZE) {
      debug('File size exceeds maximum allowed buffer size')
      return null
    }
  } catch (error) {
    debug('Failed to read file stats:', error)
    return null
  }
  if (scale > MAX_SCALE) return null
  if (height > MAX_PIXELS || width > MAX_PIXELS) return null
  let resizeOptions = {}
  let metadata
  try {
    metadata = await sharp(imagePath, {
      failOnError: false,
      useOriginalDate: true,
      limitInputPixels: false,
    }).metadata()
    if (!metadata) {
      debug('Invalid or missing image metadata')
      return null
    }
  } catch (error) {
    debug('Failed to read image metadata:', error)
    return null
  }
  if (scale) {
    width = Math.round(metadata.width * (scale / 100))
    height = Math.round(metadata.height * (scale / 100))
    resizeOptions = {
      width,
      height,
      kernel: kernel || (scale > 100 ? 'lanczos3' : 'mitchell'),
      fastShrink: scale < 100,
    }
  } else {
    if (width) resizeOptions.width = width
    if (height) resizeOptions.height = height
    const isUpscaling =
      (width && width > metadata.width) || (height && height > metadata.height)
    if (!kernel) {
      kernel = isUpscaling ? 'lanczos3' : 'mitchell'
    }
    resizeOptions.kernel = kernel || (isUpscaling ? 'lanczos3' : 'mitchell')
    resizeOptions.fastShrink = !isUpscaling
  }
  try {
    const transformer = sharp(imagePath, {
      failOnError: false,
      useOriginalDate: true,
      limitInputPixels: false,
    })
      .resize(resizeOptions)
      .withMetadata()
    function formatExifDateTime(date) {
      const d = new Date(date)
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      const hours = String(d.getHours()).padStart(2, '0')
      const minutes = String(d.getMinutes()).padStart(2, '0')
      const seconds = String(d.getSeconds()).padStart(2, '0')
      return `${year}:${month}:${day} ${hours}:${minutes}:${seconds}`
    }
    transformer.withMetadata({
      exif: {
        IFD0: {
          Software: 'sharp',
          ProcessingSoftware: 'sharp',
          Description: `Downloaded from: ${NAME} on ${await HOST}\nDate Processed: ${new Date().toISOString()}`,
          ImageDescription: `Downloaded from: ${NAME} on ${await HOST}\nDate Processed: ${new Date().toISOString()}`,
          XPComment: `Downloaded from: ${NAME} on ${await HOST}\nDate Processed: ${new Date().toISOString()}`,
          UserComment: `Downloaded from: ${NAME} on ${await HOST}\nDate Processed: ${new Date().toISOString()}`,
          Copyright: 'All Rights Reserved',
          DateTime: formatExifDateTime(mtime),
          DateTimeOriginal: formatExifDateTime(mtime),
          DateTimeDigitized: formatExifDateTime(mtime),
          ModifyDate: formatExifDateTime(mtime),
        },
        ExifIFD: {
          Software: 'sharp',
          ProcessingSoftware: 'sharp',
          Description: `Downloaded from: ${NAME} on ${await HOST}\nDate Processed: ${new Date().toISOString()}`,
          ImageDescription: `Downloaded from: ${NAME} on ${await HOST}\nDate Processed: ${new Date().toISOString()}`,
          XPComment: `Downloaded from: ${NAME} on ${await HOST}\nDate Processed: ${new Date().toISOString()}`,
          UserComment: `Downloaded from: ${NAME} on ${await HOST}\nDate Processed: ${new Date().toISOString()}`,
          Copyright: 'All Rights Reserved',
          DateTimeOriginal: formatExifDateTime(mtime),
          DateTimeDigitized: formatExifDateTime(mtime),
          ModifyDate: formatExifDateTime(mtime),
        },
      },
    })
    return transformer
  } catch (error) {
    debug('Sharp resize error:', error)
    return null
  }
}
async function convertImage(imagePath, format, { quality }) {
  let transformer
  try {
    transformer = sharp(imagePath, {
      failOnError: false,
      useOriginalDate: true,
      limitInputPixels: false,
    })
    switch (format.toLowerCase()) {
      case 'jpeg':
      case 'jpg':
        transformer = transformer.jpeg({
          quality: quality,
          mozjpeg: true,
        })
        break
      case 'png':
        transformer = transformer.png({
          compressionLevel: 9,
        })
        break
      case 'webp':
        transformer = transformer.webp({
          quality: quality,
        })
        break
      case 'tiff':
        transformer = transformer.tiff({
          quality: quality,
        })
        break
      case 'avif':
        transformer = transformer.avif({
          quality: quality,
        })
        break
      default:
        return null
    }
    return transformer
  } catch (error) {
    debug('Sharp convert error:', error)
    return null
  }
}
module.exports = {
  resizeImage,
  getImageMeta,
  convertImage,
}