const fs = require('fs').promises
const path = require('path')
const { minify } = require('terser')
const CleanCSS = require('clean-css')
const glob = require('fast-glob')
const log = require('./logHandler')
const PUBLIC_DIR = path.join(__dirname, '..', 'public')

/** @param {string} filePath */
async function minifyJS(filePath) {
  try {
    const code = await fs.readFile(filePath, 'utf8')
    const minified = await minify(code)
    if (minified.code === undefined) {
      log.error('Terser minification failed for file:', filePath)
      return
    }
    const jsDir = path.join(PUBLIC_DIR, 'js')
    const relativePath = path.relative(jsDir, filePath)
    const fileName = path.basename(relativePath, '.js') + '.min.js'
    const subDir = path.dirname(relativePath)
    const outputDir = path.join(PUBLIC_DIR, 'js', 'min', subDir)
    const outputPath = path.join(outputDir, fileName)
    await fs.mkdir(outputDir, { recursive: true })
    await fs.writeFile(outputPath, minified.code)
  } catch (error) {
    log.error('Error minifying JS file:', filePath, error)
  }
}

/** @param {string} filePath */
async function minifyCSS(filePath) {
  try {
    const code = await fs.readFile(filePath, 'utf8')
    const minified = new CleanCSS().minify(code)
    if (!minified.styles) {
      log.error('CleanCSS minification failed for file:', filePath)
      return
    }
    const cssDir = path.join(PUBLIC_DIR, 'css')
    const relativePath = path.relative(cssDir, filePath)
    const fileName = path.basename(relativePath, '.css') + '.min.css'
    const subDir = path.dirname(relativePath)
    const outputDir = path.join(PUBLIC_DIR, 'css', 'min', subDir)
    const outputPath = path.join(outputDir, fileName)
    await fs.mkdir(outputDir, { recursive: true })
    await fs.writeFile(outputPath, minified.styles)
  } catch (error) {
    log.error('Error minifying CSS file:', filePath, error)
  }
}

/** @returns {Promise<void>} */
async function processFiles() {
  try {
    const jsFiles = await glob(
      path.join(PUBLIC_DIR, 'js', '**', '*.js').replace(/\\/g, '/'),
      { ignore: ['**/*.min.js'] }
    )
    const cssFiles = await glob(
      path.join(PUBLIC_DIR, 'css', '**', '*.css').replace(/\\/g, '/'),
      { ignore: ['**/*.min.css'] }
    )
    log.info(`Processing ${jsFiles.length} JS files`)
    await Promise.all(jsFiles.map(minifyJS))
    log.info(`Processing ${cssFiles.length} CSS files`)
    await Promise.all(cssFiles.map(minifyCSS))
    log.info('File processing complete')
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
