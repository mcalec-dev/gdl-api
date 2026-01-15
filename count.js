import fs from "fs"
import path from "path"

const excludeDirs = ['node_modules', '.git', '.github', 'min'] // add directories to skip
const includeExts = ['.js', '.ejs'] // file extensions to include (empty = all)

function getFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir)
  for (const file of files) {
    const fullPath = path.join(dir, file)
    const stat = fs.statSync(fullPath)
    if (stat.isDirectory()) {
      if (!excludeDirs.includes(file)) {
        getFiles(fullPath, fileList)
      }
    } else {
      if (
        includeExts.length === 0 ||
        includeExts.includes(path.extname(file))
      ) {
        fileList.push(fullPath)
      }
    }
  }
  return fileList
}

function analyzeFile(filePath) {
  let lineCount = 0
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    lineCount = content.split(/\r?\n/).length
  } catch (error) {
    console.warn(`Could not read ${filePath}`, error)
  }
  return {
    path: filePath,
    lines: lineCount,
    ext: path.extname(filePath).toLowerCase(),
  }
}

const allFiles = getFiles(process.cwd())
const results = allFiles.map(analyzeFile)

const extSummary = {}
let totalFiles = 0
let totalLines = 0

results.forEach((r) => {
  extSummary[r.ext] = (extSummary[r.ext] || 0) + 1
  totalFiles++
  totalLines += r.lines
})

console.log('File stats:')
console.table(results)

console.log('File type counts:')
console.table(extSummary)

console.log('Totals:')
console.table([{ totalFiles, totalLines }])
