const fs = require('fs').promises
const path = require('path')
const { isExcluded, hasAllowedExtension } = require('./fileUtils')
const { BASE_DIR } = require('../config')
const debug = require('debug')('gdl-api:utils:stats')
async function aggregateStats(dirPath, stats = null) {
  if (!stats) {
    stats = {
      files: 0,
      size: 0,
      lastModified: null,
      fileTypes: {},
      largestFileSize: 0,
      smallestFileSize: null,
    }
  }
  try {
    const entries = await fs.readdir(dirPath, {
      withFileTypes: true,
    })
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      const entryRelativePath = path.relative(BASE_DIR, fullPath)
      if (entry.isDirectory()) {
        if (!(await isExcluded(entryRelativePath))) {
          const subStats = await aggregateStats(fullPath)
          stats.files += subStats.files
          stats.size += subStats.size
          if (
            !stats.lastModified ||
            (subStats.lastModified &&
              subStats.lastModified > stats.lastModified)
          ) {
            stats.lastModified = subStats.lastModified
          }
          if (subStats.largestFileSize > stats.largestFileSize) {
            stats.largestFileSize = subStats.largestFileSize
          }
          if (subStats.smallestFileSize !== null) {
            if (
              stats.smallestFileSize === null ||
              subStats.smallestFileSize < stats.smallestFileSize
            ) {
              stats.smallestFileSize = subStats.smallestFileSize
            }
          }
          for (const [ext, data] of Object.entries(subStats.fileTypes)) {
            if (!stats.fileTypes[ext])
              stats.fileTypes[ext] = {
                count: 0,
                size: 0,
              }
            stats.fileTypes[ext].count += data.count
            stats.fileTypes[ext].size += data.size
          }
        }
      } else if (entry.isFile() && hasAllowedExtension(entry.name)) {
        if (!(await isExcluded(entryRelativePath))) {
          const fileStats = await fs.stat(fullPath)
          const ext = path.extname(entry.name).toLowerCase()
          const fileSize = fileStats.size
          stats.files++
          stats.size += fileSize
          if (!stats.lastModified || fileStats.mtime > stats.lastModified) {
            stats.lastModified = fileStats.mtime
          }
          if (fileSize > stats.largestFileSize) {
            stats.largestFileSize = fileSize
          }
          if (
            stats.smallestFileSize === null ||
            fileSize < stats.smallestFileSize
          ) {
            stats.smallestFileSize = fileSize
          }
          if (!stats.fileTypes[ext])
            stats.fileTypes[ext] = {
              count: 0,
              size: 0,
            }
          stats.fileTypes[ext].count++
          stats.fileTypes[ext].size += fileSize
        }
      }
    }
  } catch (error) {
    debug('Error aggregating stats for', dirPath, error)
  }
  return stats
}
async function getApiStats() {
  await Promise.resolve()
  return {
    version: process.env.npm_package_version,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
    node: process.version,
  }
}
module.exports = {
  aggregateStats,
  getApiStats,
}
