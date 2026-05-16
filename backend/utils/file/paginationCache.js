const log = require('../logHandler')
const { cacheGetManyJson, cacheSetManyJson } = require('../db/bulkCache.js')
/**
 * Generate a cache key for a paginated listing result
 * @param {string} dirPath - The directory path
 * @param {number} page - Page number (1-indexed)
 * @param {number} limit - Results per page
 * @param {string} sortBy - Sort field
 * @param {string} direction - Sort direction
 * @param {boolean} includeMetadata - Whether metadata was included
 */
function getPaginationCacheKey(
  dirPath,
  page,
  limit,
  sortBy,
  direction,
  includeMetadata
) {
  const normalized = dirPath.replace(/\\/g, '/').toLowerCase()
  const metaFlag = includeMetadata ? '1' : '0'
  return `listing:${normalized}:p${page}:l${limit}:${sortBy}:${direction}:m${metaFlag}`
}
/**
 * Get cached pagination result
 * @param {string} dirPath
 * @param {number} page
 * @param {number} limit
 * @param {string} sortBy
 * @param {string} direction
 * @param {boolean} includeMetadata
 */
async function getCachedPaginationResult(
  dirPath,
  page,
  limit,
  sortBy,
  direction,
  includeMetadata
) {
  try {
    const key = getPaginationCacheKey(
      dirPath,
      page,
      limit,
      sortBy,
      direction,
      includeMetadata
    )
    const cached = await cacheGetManyJson([key])
    const result = cached[key]

    if (result && Array.isArray(result.items)) {
      log.debug('Cache hit for pagination:', { dirPath, page, limit })
      return { items: result.items, totalCount: result.totalCount || 0 }
    }
    return null
  } catch (/** @type {any} */ error) {
    log.debug('Pagination cache read failed:', error?.message)
    return null
  }
}
/**
 * Set cached pagination result
 * @param {string} dirPath
 * @param {number} page
 * @param {number} limit
 * @param {string} sortBy
 * @param {string} direction
 * @param {boolean} includeMetadata
 * @param {any[]} items
 * @param {number} totalCount
 */
async function setCachedPaginationResult(
  dirPath,
  page,
  limit,
  sortBy,
  direction,
  includeMetadata,
  items,
  totalCount
) {
  try {
    const key = getPaginationCacheKey(
      dirPath,
      page,
      limit,
      sortBy,
      direction,
      includeMetadata
    )
    const cacheEntries = {
      [key]: {
        items: items,
        totalCount: totalCount,
      },
    }
    await cacheSetManyJson(cacheEntries)
  } catch (/** @type {any} */ error) {
    log.debug('Pagination cache write failed:', error?.message)
  }
}
/**
 * Invalidate pagination cache for a directory
 * (Called when directory contents change)
 * @param {string} dirPath
 */
async function invalidatePaginationCache(dirPath) {
  try {
    log.debug('Pagination cache will expire via TTL for:', dirPath)
  } catch (/** @type {any} */ error) {
    log.debug('Pagination cache invalidation failed:', error?.message)
  }
}
module.exports = {
  getPaginationCacheKey,
  getCachedPaginationResult,
  setCachedPaginationResult,
  invalidatePaginationCache,
}
