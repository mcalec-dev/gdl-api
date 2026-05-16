const fs = require('fs').promises
const path = require('path')
const { isExcluded } = require('../file/listing.js')
const { hasAllowedExtension } = require('../file/typeGuards.js')
const config = /** @type {any} */ (require('../../config.js'))
const log = require('../logHandler.js')
const BASE_DIR = typeof config.BASE_DIR === 'string' ? config.BASE_DIR : ''
/** @typedef {{ count: number, size: number }} FileTypeEntry */
/**
 * @typedef {{
 *   files: number,
 *   size: number,
 *   lastModified: Date | null,
 *   fileTypes: Record<string, FileTypeEntry>,
 *   largestFileSize: number,
 *   smallestFileSize: number | null,
 * }} AggregationStats
 */
/**
 * @typedef {{
 *   files: number,
 *   size: number,
 *   lastModified: Date | null,
 *   fileTypes: Record<string, FileTypeEntry>,
 *   largestFileSize: number,
 *   smallestFileSize: number | null,
 * }} CollectionDetail
 */
/**
 * @typedef {{
 *   total: number,
 *   totalSize: number,
 *   totalFiles: number,
 *   totalDirectories: number,
 *   averageFileSize: number,
 *   largestFileSize: number,
 *   smallestFileSize: number | null,
 *   fileTypes: Record<string, FileTypeEntry>,
 *   details: Record<string, CollectionDetail>,
 * }} CollectionsSnapshot
 */
/**
 * @typedef {{
 *   version: string | undefined,
 *   uptime: number,
 *   memory: NodeJS.MemoryUsage & { formatted?: { heapUsed: number, rss: number } },
 *   timestamp: string,
 *   node: string,
 * }} ApiStatsSnapshot
 */
/**
 * @typedef {{
 *   api: ApiStatsSnapshot,
 *   collections: CollectionsSnapshot,
 * }} StatsSnapshot
 */
/** @returns {AggregationStats} */
function createEmptyStats() {
  return {
    files: 0,
    size: 0,
    lastModified: null,
    fileTypes: /** @type {Record<string, FileTypeEntry>} */ ({}),
    largestFileSize: 0,
    smallestFileSize: null,
  }
}
/** @param {AggregationStats} stats @param {Date | null | undefined} candidate */
function setMostRecent(stats, candidate) {
  if (!candidate) return
  if (!stats.lastModified || candidate > stats.lastModified) {
    stats.lastModified = candidate
  }
}
/** @param {AggregationStats} stats @param {string} ext @param {number} size */
function addFileType(stats, ext, size) {
  if (!stats.fileTypes[ext]) {
    stats.fileTypes[ext] = { count: 0, size: 0 }
  }
  stats.fileTypes[ext].count += 1
  stats.fileTypes[ext].size += size
}
/** @param {AggregationStats} target @param {AggregationStats} source */
function mergeStats(target, source) {
  target.files += source.files
  target.size += source.size
  setMostRecent(target, source.lastModified)
  if (source.largestFileSize > target.largestFileSize) {
    target.largestFileSize = source.largestFileSize
  }
  if (
    source.smallestFileSize !== null &&
    (target.smallestFileSize === null ||
      source.smallestFileSize < target.smallestFileSize)
  ) {
    target.smallestFileSize = source.smallestFileSize
  }
  for (const [ext, data] of Object.entries(source.fileTypes)) {
    if (!target.fileTypes[ext]) {
      target.fileTypes[ext] = { count: 0, size: 0 }
    }
    target.fileTypes[ext].count += data.count
    target.fileTypes[ext].size += data.size
  }
}
/** @param {AggregationStats} stats @param {import('fs').Stats} fileStats @param {string} ext */
function addFileStats(stats, fileStats, ext) {
  const fileSize = fileStats.size
  stats.files += 1
  stats.size += fileSize
  setMostRecent(stats, fileStats.mtime)
  if (fileSize > stats.largestFileSize) {
    stats.largestFileSize = fileSize
  }
  if (stats.smallestFileSize === null || fileSize < stats.smallestFileSize) {
    stats.smallestFileSize = fileSize
  }
  addFileType(stats, ext, fileSize)
}
/** @param {string} dirPath @param {AggregationStats} [stats] */
async function aggregateStats(dirPath, stats) {
  if (!stats) {
    stats = createEmptyStats()
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
          mergeStats(stats, subStats)
        }
      } else if (entry.isFile() && hasAllowedExtension(entry.name)) {
        if (!(await isExcluded(entryRelativePath))) {
          const fileStats = await fs.stat(fullPath)
          const ext = path.extname(entry.name).toLowerCase()
          addFileStats(stats, fileStats, ext)
        }
      }
    }
  } catch (error) {
    log.error('Error aggregating stats for', dirPath, error)
  }
  return stats
}
/** @param {{ [key: string]: FileTypeEntry }} fileTypes */
function sortFileTypes(fileTypes) {
  return Object.fromEntries(
    Object.entries(fileTypes)
      .sort(([, a], [, b]) => b.count - a.count)
      .map(([ext, data]) => [
        ext,
        {
          ...data,
        },
      ])
  )
}
/** @returns {Promise<ApiStatsSnapshot>} */
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
/** @returns {Promise<StatsSnapshot>} */
async function generateStatsSnapshot() {
  if (!BASE_DIR) {
    throw new Error('BASE_DIR must be configured')
  }
  /** @type {StatsSnapshot} */
  const stats = {
    api: await getApiStats(),
    collections: {
      total: 0,
      totalSize: 0,
      totalFiles: 0,
      totalDirectories: 0,
      averageFileSize: 0,
      largestFileSize: 0,
      smallestFileSize: null,
      fileTypes: /** @type {Record<string, FileTypeEntry>} */ ({}),
      details: /** @type {Record<string, CollectionDetail>} */ ({}),
    },
  }
  const collections = await fs.readdir(BASE_DIR)
  await Promise.all(
    collections.map(async (collection) => {
      const collectionPath = path.join(BASE_DIR, collection)
      const dirStats = await fs.stat(collectionPath)
      if (dirStats.isDirectory() && !(await isExcluded(collection))) {
        stats.collections.totalDirectories++
        const summary = await aggregateStats(collectionPath)
        stats.collections.details[collection] = {
          files: summary.files,
          size: summary.size,
          lastModified: summary.lastModified,
          fileTypes: summary.fileTypes,
          largestFileSize: summary.largestFileSize,
          smallestFileSize: summary.smallestFileSize,
        }
        stats.collections.totalFiles += summary.files
        stats.collections.totalSize += summary.size
        if (summary.largestFileSize > stats.collections.largestFileSize) {
          stats.collections.largestFileSize = summary.largestFileSize
        }
        if (summary.smallestFileSize !== null) {
          if (
            stats.collections.smallestFileSize === null ||
            summary.smallestFileSize < stats.collections.smallestFileSize
          ) {
            stats.collections.smallestFileSize = summary.smallestFileSize
          }
        }
        for (const [ext, data] of Object.entries(summary.fileTypes)) {
          if (!stats.collections.fileTypes[ext]) {
            stats.collections.fileTypes[ext] = {
              count: 0,
              size: 0,
            }
          }
          stats.collections.fileTypes[ext].count += data.count
          stats.collections.fileTypes[ext].size += data.size
        }
      }
    })
  )
  stats.collections.total = Object.keys(stats.collections.details).length
  if (stats.collections.totalFiles > 0) {
    stats.collections.averageFileSize =
      stats.collections.totalSize / stats.collections.totalFiles
  }
  stats.collections.fileTypes = sortFileTypes(stats.collections.fileTypes)
  const apiMemory = /** @type {any} */ (stats.api.memory)
  apiMemory.formatted = {
    heapUsed: stats.api.memory.heapUsed,
    rss: stats.api.memory.rss,
  }
  return stats
}
module.exports = {
  generateStatsSnapshot,
}
