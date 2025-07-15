const fs = require('fs').promises
const path = require('path')
const debug = require('debug')('gdl-api:utils:search')
const { MAX_DEPTH, BASE_DIR } = require('../config')
const { isExcluded } = require('./fileUtils')
async function* walkAndSearchFiles(
  dir,
  query,
  permission,
  limit = 1000,
  depth = 0
) {
  if (depth >= (typeof MAX_DEPTH !== 'undefined' ? MAX_DEPTH : 10)) return
  let count = 0
  try {
    const entries = await fs.readdir(dir, {
      withFileTypes: true,
    })
    for (const entry of entries) {
      if (count >= limit) return
      const fullPath = path.join(dir, entry.name)
      const relativePath = path.relative(BASE_DIR, fullPath)
      if (await isExcluded(relativePath, permission)) continue
      const lowerCaseQuery = query.toLowerCase()
      const lowerCaseName = entry.name.toLowerCase()
      const lowerCaseRelativePath = relativePath.toLowerCase()
      if (
        lowerCaseName.includes(lowerCaseQuery) ||
        lowerCaseRelativePath.includes(lowerCaseQuery)
      ) {
        const stats = await fs.stat(fullPath)
        yield {
          path: fullPath,
          name: entry.name,
          size: entry.isDirectory() ? 0 : stats.size,
          modified: stats.mtime,
          type: entry.isDirectory() ? 'directory' : 'file',
        }
        count++
        if (count >= limit) return
      }

      if (entry.isDirectory()) {
        for await (const result of walkAndSearchFiles(
          fullPath,
          query,
          permission,
          limit - count,
          depth + 1
        )) {
          yield result
          count++
          if (count >= limit) return
        }
      }
    }
  } catch (error) {
    debug('Error during search:', error)
  }
}
module.exports = {
  walkAndSearchFiles,
}
