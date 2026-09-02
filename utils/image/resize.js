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

/** @param {keyof import('sharp').KernelEnum | undefined} kernel @param {number | undefined} scale @param {string} imagePath */
function resolveKernel(kernel, scale, imagePath) {
  if (kernel && !validKernels.includes(kernel)) {
    log.warn(
      'Invalid kernel:',
      kernel,
      'for image:',
      imagePath,
      ': using a scale-based default'
    )
    return typeof scale === 'number' && scale > 100 ? 'lanczos3' : 'mitchell'
  }
  return kernel
}

/** @param {string} imagePath @param {ResizeInput} input */
async function resizeImage(imagePath, input) {
  let { width, height, scale, kernel, quality } = normalizeResizeOptions(input)
  if (!imagePath) {
    log.warn('Cannot resize image:', imagePath, 'no image path was provided')
    return null
  }
  if (!width && !height && !scale) {
    log.warn(
      'Cannot resize image:',
      imagePath,
      'no resize parameters were provided'
    )
    return undefined
  }
  if (scale === 100) {
    log.info('Skipping resize for:', imagePath, 'scale is 100%')
    return undefined
  }
  kernel = resolveKernel(kernel, scale, imagePath)
  if (!quality || quality === undefined || quality === null) {
    log.debug(
      'Using default quality for:',
      imagePath,
      'no quality was provided'
    )
    quality = 0
  }
  let mtime
  try {
    mtime = await getSafeMtime(imagePath)
    if (!mtime) {
      log.warn('Cannot resize image:', imagePath, 'file is too large')
      return null
    }
  } catch (error) {
    log.error('Failed to read file stats for:', imagePath, error)
    return null
  }
  if (
    Number.isFinite(MAX_SCALE) &&
    typeof scale === 'number' &&
    scale > MAX_SCALE
  ) {
    log.warn(
      'Cannot resize image:',
      imagePath,
      'scale exceeds the maximum allowed scale'
    )
    return null
  }
  if (
    Number.isFinite(MAX_PIXELS) &&
    typeof height === 'number' &&
    height > MAX_PIXELS
  ) {
    log.warn(
      'Cannot resize image:',
      imagePath,
      'height exceeds the maximum allowed pixel size'
    )
    return null
  }
  if (
    Number.isFinite(MAX_PIXELS) &&
    typeof width === 'number' &&
    width > MAX_PIXELS
  ) {
    log.warn(
      'Cannot resize image:',
      imagePath,
      'width exceeds the maximum allowed pixel size'
    )
    return null
  }
  /** @type {import('sharp').ResizeOptions} */
  let resizeOptions = {}
  let metadata
  try {
    metadata = await sharp(imagePath, {
      limitInputPixels: false,
    }).metadata()
    if (!metadata) {
      log.debug(
        'Cannot resize image:',
        imagePath,
        'image metadata is missing or invalid'
      )
      return null
    }
  } catch (error) {
    log.error('Failed to read image metadata for:', imagePath, error)
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
    log.error('Failed to create resize transformer for:', imagePath, error)
    return null
  }
}

module.exports = {
  resizeImage,
  validKernels,
}
