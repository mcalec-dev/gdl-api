const fs = require('fs').promises
const path = require('path')
const debug = require('debug')('gdl-api:utils:search')
const {
  MAX_DEPTH,
  BASE_DIR,
  DISALLOWED_DIRS,
  DISALLOWED_FILES,
  DISALLOWED_EXTENSIONS,
} = require('../config')
const { isExcluded, hasAllowedExtension } = require('./fileUtils')
const minimatch = require('minimatch')
const isDisallowedExtension = (filename) => {
  const ext = path.extname(filename).toLowerCase()
  return DISALLOWED_EXTENSIONS.some(
    (disallowedExt) =>
      ext === disallowedExt.toLowerCase() ||
      ext === `.${disallowedExt.toLowerCase()}`
  )
}
function calculateRelevancy(name, relativePath, query, type, filters = {}) {
  if (filters.type && filters.type !== 'all' && type !== filters.type) {
    return -1
  }
  const includeFiles = filters.files !== false
  const includeDirectories = filters.directories !== false
  if (
    (type === 'file' && !includeFiles) ||
    (type === 'directory' && !includeDirectories)
  ) {
    return -1
  }
  let score = 0
  if (minimatch(name, query, { nocase: true })) {
    score +=
      name.toLowerCase() === query.replace(/\*/g, '').toLowerCase() ? 100 : 60
  }
  if (minimatch(relativePath, query, { nocase: true })) {
    score +=
      relativePath.toLowerCase() === query.replace(/\*/g, '').toLowerCase()
        ? 90
        : 40
  }
  if (score === 0) return -1
  return score
}
async function* walkAndSearchFiles(
  dir,
  query,
  filters = {},
  limit = 2000,
  depth = 0
) {
  if (depth === 0) {
    debug('Starting dir:', dir)
  }
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
      if (await isExcluded(relativePath)) {
        debug('Excluded entry:', relativePath)
        continue
      }
      if (DISALLOWED_DIRS.includes(entry.name)) {
        continue
      }
      if (entry.isFile() && DISALLOWED_FILES.includes(entry.name)) {
        continue
      }
      if (entry.isFile() && isDisallowedExtension(entry.name)) {
        continue
      }
      if (entry.isFile() && !hasAllowedExtension(fullPath)) {
        continue
      }
      const type = entry.isDirectory() ? 'directory' : 'file'
      const relevancy = calculateRelevancy(
        entry.name,
        relativePath,
        query,
        type,
        filters
      )
      if (type === 'file') {
        if (relevancy <= 0) {
          continue
        }
        const stats = await fs.stat(fullPath)
        yield {
          path: fullPath,
          name: entry.name,
          size: stats.size,
          modified: stats.mtime,
          type: type,
          relevancy: relevancy,
        }
        count++
        if (count >= limit) return
      } else if (type === 'directory') {
        if (relevancy > 0) {
          const stats = await fs.stat(fullPath)
          yield {
            path: fullPath,
            name: entry.name,
            size: 0,
            modified: stats.mtime,
            type: type,
            relevancy: relevancy,
          }
          count++
          if (count >= limit) return
        }
        for await (const result of walkAndSearchFiles(
          fullPath,
          query,
          filters,
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
