const sharp = require('sharp')
const log = require('../logHandler')
const { MAX_PIXELS, MAX_SCALE } = /** @type {any} */ (require('../../config'))
const { getSafeMtime } = require('./metadata')
const { buildExifPayload } = require('./exif')
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
/** @typedef {{ width?: number, height?: number, scale?: number, kernel?: keyof import('sharp').KernelEnum, quality?: number }} ResizeInput */
/** @param {ResizeInput} options */
function normalizeResizeOptions(options) {
  const { width, height, scale, kernel, quality } = options
  return {
    width,
    height,
    scale,
    kernel,
    quality,
  }
}
/** @param {keyof import('sharp').KernelEnum | undefined} kernel @param {number | undefined} scale */
function resolveKernel(kernel, scale) {
  if (kernel && !validKernels.includes(kernel)) {
    log.warn('Invalid kernel provided:', kernel)
    return typeof scale === 'number' && scale > 100 ? 'lanczos3' : 'mitchell'
  }
  return kernel
}
/** @param {string} imagePath @param {ResizeInput} input */
async function resizeImage(imagePath, input) {
  let { width, height, scale, kernel, quality } = normalizeResizeOptions(input)
  if (!imagePath) {
    log.warn('No image path provided for resizing')
    return null
  }
  if (!width && !height && !scale) {
    log.warn('No resize parameters provided')
    return undefined
  }
  if (scale === 100) {
    log.info('Scale is 100, no resizing needed')
    return undefined
  }
  kernel = resolveKernel(kernel, scale)
  if (!quality || quality === undefined || quality === null) {
    log.debug('Quality is doesnt exist or is not defined', quality)
    quality = 0
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
  if (
    Number.isFinite(MAX_SCALE) &&
    typeof scale === 'number' &&
    scale > MAX_SCALE
  )
    return null
  if (
    Number.isFinite(MAX_PIXELS) &&
    typeof height === 'number' &&
    height > MAX_PIXELS
  )
    return null
  if (
    Number.isFinite(MAX_PIXELS) &&
    typeof width === 'number' &&
    width > MAX_PIXELS
  )
    return null
  /** @type {import('sharp').ResizeOptions} */
  let resizeOptions = {}
  let metadata
  try {
    metadata = await sharp(imagePath, {
      failOnError: false,
      limitInputPixels: false,
    }).metadata()
    if (!metadata) {
      log.debug('Invalid or missing image metadata')
      return null
    }
  } catch (error) {
    log.error('Failed to read image metadata:', error)
    return null
  }
  if (scale) {
    width = Math.round(metadata.width * (scale / 100))
    height = Math.round(metadata.height * (scale / 100))
    resizeOptions = {
      width,
      height,
      kernel: kernel || (scale > 100 ? 'lanczos3' : 'mitchell'),
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
  }
  try {
    const transformer = sharp(imagePath, {
      failOnError: false,
      limitInputPixels: false,
    })
      .resize(resizeOptions)
      .withMetadata()
    const exif = await buildExifPayload(mtime)
    transformer.withMetadata({
      exif,
    })
    return transformer
  } catch (error) {
    log.error('Sharp resize error:', error)
    return null
  }
}
module.exports = {
  resizeImage,
  validKernels,
}
