const fs = require('fs').promises
const path = require('path')
const { minify } = require('terser')
const CleanCSS = require('clean-css')
const glob = require('fast-glob')
const chalk = require('chalk')
const log = require('./utils/logHandler')
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
  } catch (error) {
    log.error(chalk.redBright('Error minifying JS file:', filePath, error))
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
  } catch (error) {
    log.error(chalk.redBright('Error minifying CSS file:', filePath, error))
  }
}
async function processFiles() {
  try {
    const jsPattern = path
      .join(publicDir, 'js', '**', '*.js')
      .replace(/\\/g, '/')
    const jsFiles = glob.sync(jsPattern, { ignore: [`**/*.min.js`] })
    const cssPattern = path
      .join(publicDir, 'css', '**', '*.css')
      .replace(/\\/g, '/')
    const cssFiles = glob.sync(cssPattern, { ignore: [`**/*.min.css`] })
    log.debug(`Processing ${jsFiles.length} .js files`)
    for (const file of jsFiles) {
      await minifyJS(file)
    }
    log.debug(`Processing ${cssFiles.length} .css files`)
    for (const file of cssFiles) {
      await minifyCSS(file)
    }
    log.info(chalk.green('File processing complete.'))
  } catch (error) {
    log.error('Error in file processing:', error)
  }
}
module.exports = { processFiles }
