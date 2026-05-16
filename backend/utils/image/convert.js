const sharp = require('sharp')
const log = require('../logHandler')
/** @typedef {{ width?: number, height?: number, scale?: number, kernel?: keyof import('sharp').KernelEnum, quality?: number }} ResizeInput */
/** @param {string} imagePath @param {string} format @param {ResizeInput} [options={}] */
async function convertImage(
  imagePath,
  format,
  { quality, width, height, scale, kernel } = {}
) {
  let transformer
  try {
    transformer = sharp(imagePath, {
      failOnError: false,
      limitInputPixels: true,
    })
    if (scale || width || height) {
      /** @type {import('sharp').ResizeOptions} */
      let resizeOptions = {}
      if (scale) {
        const metadata = await sharp(imagePath, {
          failOnError: false,
          limitInputPixels: false,
        }).metadata()
        if (!metadata || !metadata.width || !metadata.height) {
          log.warn('Could not read metadata for scaled conversion')
          return null
        }
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
        if (kernel) resizeOptions.kernel = kernel
      }
      transformer = transformer.resize(resizeOptions)
    }
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
      case 'gif':
        transformer = transformer.gif({
          effort: 3,
        })
        break
      default:
        return null
    }
    return transformer
  } catch (error) {
    log.error('Sharp convert error:', error)
    return null
  }
}
module.exports = {
  convertImage,
}
