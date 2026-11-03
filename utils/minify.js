const fs = require('fs').promises
const path = require('path')
const { minify } = require('terser')
const CleanCSS = require('clean-css')
const glob = require('fast-glob')
const bytes = require('bytes')
const log = require('./logHandler')
const PUBLIC_DIR = path.join(__dirname, '..', 'public')

/** @param {string} filePath */
async function minifyJS(filePath) {
  try {
    const originalCode = await fs.readFile(filePath, 'utf8')
    const originalSize = Buffer.byteLength(originalCode, 'utf8')
    const minified = await minify(originalCode, {
      module: true,
      compress: {
        passes: 2,
        drop_console: false,
      },
      mangle: true,
    })
    if (minified.code === undefined) {
      throw new Error('Terser minification returned no output for ' + filePath)
    }
    const jsDir = path.join(PUBLIC_DIR, 'js')
    const relativePath = path.relative(jsDir, filePath)
    const fileName = path.basename(relativePath)
    const subDir = path.dirname(relativePath)
    const outputDir = path.join(PUBLIC_DIR, 'js', 'min', subDir)
    const outputPath = path.join(outputDir, fileName)
    await fs.mkdir(outputDir, { recursive: true })
    await fs.writeFile(outputPath, minified.code)
    const minifiedSize = Buffer.byteLength(minified.code, 'utf8')
    const savings = ((1 - minifiedSize / originalSize) * 100).toFixed(1)
    log.info(
      `[JS] ${relativePath} -> min/${relativePath} (${bytes(originalSize)} → ${bytes(minifiedSize)}, -${savings}%)`
    )
  } catch (error) {
    log.error('Error minifying JS file:', filePath, error)
    throw error
  }
}

/** @param {string} filePath */
async function minifyCSS(filePath) {
  try {
    const originalCode = await fs.readFile(filePath, 'utf8')
    const originalSize = Buffer.byteLength(originalCode, 'utf8')
    const minified = new CleanCSS({ level: 2 }).minify(originalCode)
    const diagnostics = [...minified.errors, ...minified.warnings]
    if (diagnostics.length > 0) {
      throw new Error(
        'CleanCSS minification reported diagnostics for ' +
          filePath +
          ': ' +
          diagnostics.join('; ')
      )
    }
    const cssDir = path.join(PUBLIC_DIR, 'css')
    const relativePath = path.relative(cssDir, filePath)
    const fileName = path.basename(relativePath)
    const subDir = path.dirname(relativePath)
    const outputDir = path.join(PUBLIC_DIR, 'css', 'min', subDir)
    const outputPath = path.join(outputDir, fileName)
    await fs.mkdir(outputDir, { recursive: true })
    await fs.writeFile(outputPath, minified.styles)
    const minifiedSize = Buffer.byteLength(minified.styles, 'utf8')
    const savings = ((1 - minifiedSize / originalSize) * 100).toFixed(1)
    log.info(
      `[CSS] ${relativePath} -> min/${relativePath} (${bytes(originalSize)} → ${bytes(minifiedSize)}, -${savings}%)`
    )
  } catch (error) {
    log.error('Error minifying CSS file:', filePath, error)
    throw error
  }
}

/** @returns {Promise<void>} */
async function processFiles() {
  try {
    const startTime = Date.now()
    const jsFiles = await glob(
      path.join(PUBLIC_DIR, 'js', '**', '*.js').replace(/\\/g, '/'),
      { ignore: ['**/min/**'] }
    )
    const cssFiles = await glob(
      path.join(PUBLIC_DIR, 'css', '**', '*.css').replace(/\\/g, '/'),
      { ignore: ['**/min/**'] }
    )
    log.info(
      `Processing ${jsFiles.length} JS and ${cssFiles.length} CSS files...`
    )
    await Promise.all([...jsFiles.map(minifyJS), ...cssFiles.map(minifyCSS)])
    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    log.info('File processing took:', `${duration}s`)
  } catch (error) {
    log.error('Error in file processing:', error)
    throw error
  }
}

if (require.main === module) {
  processFiles().catch((err) => {
    log.error(err)
    process.exit(1)
  })
}

module.exports = {
  processFiles,
  minifyJS,
  minifyCSS,
}
