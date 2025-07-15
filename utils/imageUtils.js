const sharp = require('sharp')
const debug = require('debug')('gdl-api:utils:image')
const { HOST, NAME } = require('../config')
sharp.cache(true)
sharp.simd(true)
sharp.concurrency(5)
async function resizeImage(imagePath, { width, height, scale }) {
  let resizeOptions = {}
  let metadata
  try {
    metadata = await sharp(imagePath, {
      failOnError: true,
      useOriginalDate: true,
    }).metadata()
    if (
      !metadata ||
      typeof metadata.width !== 'number' ||
      typeof metadata.height !== 'number'
    ) {
      debug('Invalid or missing image metadata')
    }
  } catch (error) {
    debug('Failed to read image metadata:', error)
  }
  if (scale) {
    width = Math.round(metadata.width * (scale / 100))
    height = Math.round(metadata.height * (scale / 100))
    resizeOptions = {
      width,
      height,
      kernel: scale > 100 ? 'lanczos3' : 'mitchell',
      fastShrink: scale < 100,
    }
  } else {
    if (width) resizeOptions.width = width
    if (height) resizeOptions.height = height
    const isUpscaling = width > metadata.width || height > metadata.height
    resizeOptions.kernel = isUpscaling ? 'lanczos3' : 'mitchell'
    resizeOptions.fastShrink = !isUpscaling
  }
  let mtime
  try {
    const stat = await require('fs').promises.stat(imagePath)
    mtime = stat.mtime
  } catch {
    mtime = new Date()
  }
  const transformer = sharp(imagePath, {
    failOnError: false,
    useOriginalDate: true,
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
  const metaIFD0 = {
    Software: 'Gallery-DL API',
    ProcessingSoftware: 'Sharp',
    Description: `Downloaded from ${HOST}`,
    ImageDescription: `Downloaded from ${HOST}`,
    Copyright: 'All Rights Reserved',
    DateTime: formatExifDateTime(mtime),
    DateTimeOriginal: formatExifDateTime(mtime),
    DateTimeDigitized: formatExifDateTime(mtime),
    ModifyDate: formatExifDateTime(new Date()),
    Artist: NAME,
    XPComment: `Processed by ${NAME}`,
    UserComment: `Processed on ${new Date().toISOString()}`,
    ColorSpace: 'sRGB',
    YCbCrPositioning: 'centered',
  }
  const metaExifIFD = {
    Software: NAME,
    ProcessingSoftware: 'Sharp',
    Description: `Downloaded from ${HOST}`,
    ImageDescription: `Downloaded from ${HOST}`,
    Copyright: 'All Rights Reserved',
    DateTimeOriginal: formatExifDateTime(mtime),
    DateTimeDigitized: formatExifDateTime(mtime),
    Artist: NAME,
    XPComment: `Processed by ${NAME}`,
    UserComment: `Processed on ${new Date().toISOString()}`,
    ColorSpace: 'sRGB',
    YCbCrPositioning: 'centered',
  }
  transformer.withMetadata({
    exif: {
      IFD0: metaIFD0,
      ExifIFD: metaExifIFD,
    },
  })
  return transformer
}
module.exports = {
  resizeImage,
}
