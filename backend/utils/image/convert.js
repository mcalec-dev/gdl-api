const sharp = require('sharp')
const log = require('../logHandler')
/** @typedef {{ q?: number, w?: number, h?: number, x?: number, k?: string }} ResizeInput */
/** @param {string} imagePath @param {string} format @param {ResizeInput} [options={}] */
async function convertImage(imagePath, format, { q, w, h, x, k } = {}) {
  let transformer
  try {
    transformer = sharp(imagePath, {
      failOnError: false,
      limitInputPixels: true,
    })
    if (x || w || h) {
      /** @type {import('sharp').ResizeOptions} */
      let resizeOptions = {}
      if (x) {
        const metadata = await sharp(imagePath, {
          failOnError: false,
          limitInputPixels: false,
        }).metadata()
        if (!metadata || !metadata.width || !metadata.height) {
          log.warn('Could not read metadata for scaled conversion')
          return null
        }
        w = Math.round(metadata.width * (x / 100))
        h = Math.round(metadata.height * (x / 100))
        resizeOptions = {
          width: w,
          height: h,
          // if kernel is not provided, use mitchell for downscaling and lanczos3 for upscaling
          kernel: k || (x < 100 ? 'mitchell' : 'lanczos3'),
        }
      } else {
        if (w) resizeOptions.width = w
        if (h) resizeOptions.height = h
        if (k) resizeOptions.kernel = k
      }
      transformer = transformer.resize(resizeOptions)
    }
    switch (format.toLowerCase()) {
      case 'jpeg':
      case 'jpg':
        transformer = transformer.jpeg({
          // integer 1-100 (default 80)
          quality: q || 80,
          // 4:4:4 when quality is greater than 90 (default 4:2:0)
          chromaSubsampling: q <= 90 ? '4:4:4' : '4:2:0',
        })
        break
      case 'png':
        transformer = transformer.png({
          // integer 0-9 (default 6)
          compressionLevel: 6,
          // integer 1-100 (default 100)
          quality: q || 100,
        })
        break
      case 'webp':
        transformer = transformer.webp({
          // integer 1-100 (default 80)
          quality: q || 80,
          // integer 0-6 (default 4)
          effort: 4,
        })
        break
      case 'tiff':
        transformer = transformer.tiff({
          // integer 1-100 (default 80)
          quality: q || 80,
        })
        break
      case 'avif':
        transformer = transformer.avif({
          // integer 1-100 (default 50)
          quality: q || 50,
          // integer 0-9 (default 4)
          effort: 4,
        })
        break
      case 'gif':
        transformer = transformer.gif({
          // Level of CPU effort to reduce file size, between 1 (fastest) and 10 (slowest) (optional, default 7)
          effort: 7,
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
