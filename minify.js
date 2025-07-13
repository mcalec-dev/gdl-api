const fs = require('fs').promises
const path = require('path')
const { minify } = require('terser')
const CleanCSS = require('clean-css')
const glob = require('glob')
const debug = require('debug')('gdl-api:minify')
const publicDir = path.join(__dirname, 'public')
const minifyJS = async (filePath) => {
  try {
    const code = await fs.readFile(filePath, 'utf8')
    const minified = await minify(code)
    const jsDir = path.join(publicDir, 'js')
    const relativePath = path.relative(jsDir, filePath)
    const fileName = path.basename(relativePath, '.js') + '.min.js'
    const subDir = path.dirname(relativePath)
    const outputDir = path.join(publicDir, 'js', 'min', subDir)
    const outputPath = path.join(outputDir, fileName)
    await fs.mkdir(outputDir, { recursive: true })
    await fs.writeFile(outputPath, minified.code)
    debug('Minified JS:', outputPath)
  } catch (error) {
    debug('Error minifying JS:', filePath, error)
  }
}
const minifyCSS = async (filePath) => {
  try {
    const code = await fs.readFile(filePath, 'utf8')
    const minified = new CleanCSS().minify(code)
    const cssDir = path.join(publicDir, 'css')
    const relativePath = path.relative(cssDir, filePath)
    const fileName = path.basename(relativePath, '.css') + '.min.css'
    const subDir = path.dirname(relativePath)
    const outputDir = path.join(publicDir, 'css', 'min', subDir)
    const outputPath = path.join(outputDir, fileName)
    await fs.mkdir(outputDir, { recursive: true })
    await fs.writeFile(outputPath, minified.styles)
    debug('Minified CSS:', outputPath)
  } catch (error) {
    debug('Error minifying CSS:', filePath, error)
  }
}
async function processFiles() {
  try {
    const jsPattern = path
      .join(publicDir, 'js', '**', '*.js')
      .replace(/\\/g, '/')
    const jsFiles = glob.sync(jsPattern, { ignore: [`**/*.min.js`] })
    debug(`Found ${jsFiles.length} js files`)
    const cssPattern = path
      .join(publicDir, 'css', '**', '*.css')
      .replace(/\\/g, '/')
    const cssFiles = glob.sync(cssPattern, { ignore: [`**/*.min.css`] })
    debug(`Found ${cssFiles.length} css files`)
    for (const file of jsFiles) {
      await minifyJS(file)
    }
    for (const file of cssFiles) {
      await minifyCSS(file)
    }
    debug('File processing completed')
  } catch (error) {
    debug('Error in file processing:', error)
  }
}

processFiles()
module.exports = { processFiles }
