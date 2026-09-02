const log = require('../logHandler')
const { cacheGetManyJson, cacheSetManyJson } = require('../db/bulkCache.js')
const File = require('../../models/File')

/** @param {string} relativePath */
function getFileMetadataCacheKey(relativePath) {
  return `filemeta:${relativePath}`
}

/**
 * @param {string[]} relativePaths
 */
async function getCachedFileMetadata(relativePaths) {
  if (relativePaths.length === 0) {
    return {
      metadataMap: /** @type {Record<string, any>} */ ({}),
      missingPaths: relativePaths,
    }
  }
  try {
    const cacheKeys = relativePaths.map((relativePath) =>
      getFileMetadataCacheKey(relativePath)
    )
    const keyValueMap = await cacheGetManyJson(cacheKeys)
    const metadataMap = /** @type {Record<string, any>} */ ({})
    const missingPaths = /** @type {string[]} */ ([])
    relativePaths.forEach((relativePath, index) => {
      const key = cacheKeys[index]
      const parsed = keyValueMap[key]
      if (!parsed || typeof parsed !== 'object') {
        missingPaths.push(relativePath)
        return
      }
      metadataMap[relativePath] = {
        uuid: parsed.uuid || null,
        hash: parsed.hash || null,
        sidecar: parsed.sidecar || null,
      }
    })
    return { metadataMap, missingPaths }
  } catch (/** @type {any} */ error) {
    log.debug(
      'Redis mGet failed for file metadata cache, using MongoDB:',
      error?.message
    )
    return {
      metadataMap: /** @type {Record<string, any>} */ ({}),
      missingPaths: relativePaths,
    }
  }
}

/** @param {Record<string, any>} metadataMap */
async function setCachedFileMetadata(metadataMap) {
  if (!metadataMap || typeof metadataMap !== 'object') return
  try {
    const entries = Object.entries(metadataMap)
    if (entries.length === 0) return
    const cacheEntries = /** @type {Record<string, any>} */ ({})
    entries.forEach(([relativePath, value]) => {
      cacheEntries[getFileMetadataCacheKey(relativePath)] = {
        uuid: value?.uuid || null,
        hash: value?.hash || null,
        sidecar: value?.sidecar || null,
      }
    })
    await cacheSetManyJson(cacheEntries)
  } catch (/** @type {any} */ error) {
    log.debug('Redis setEx failed for file metadata cache:', error?.message)
  }
}

/**
 * @param {string[]} relativePaths
 * @param {{ useCache?: boolean }} [options]
 */
async function batchFetchFileMetadata(relativePaths, options = {}) {
  if (!Array.isArray(relativePaths) || relativePaths.length === 0) {
    return {}
  }
  const useCache = options.useCache !== false
  try {
    log.debug('Batch fetching file metadata for paths:', {
      count: relativePaths.length,
      useCache,
    })
    let metadataMap = /** @type {Record<string, any>} */ ({})
    let missingPaths = relativePaths
    if (useCache) {
      const cached = await getCachedFileMetadata(relativePaths)
      metadataMap = { ...cached.metadataMap }
      missingPaths = cached.missingPaths
      if (missingPaths.length > 0) {
        log.debug('Cache hits:', {
          hits: relativePaths.length - missingPaths.length,
          misses: missingPaths.length,
        })
      }
    }
    if (missingPaths.length > 0) {
      const files = await File.find(
        { 'paths.relative': { $in: missingPaths } },
        { 'paths.relative': 1, uuid: 1, hash: 1, sidecar: 1 }
      ).lean()
      const dbMetadataMap = /** @type {Record<string, any>} */ ({})
      files.forEach((/** @type {any} */ file) => {
        if (file.paths?.relative) {
          dbMetadataMap[file.paths.relative] = {
            uuid: file.uuid,
            hash: file.hash,
            sidecar: file.sidecar || null,
          }
        }
      })
      metadataMap = { ...metadataMap, ...dbMetadataMap }
      if (useCache && Object.keys(dbMetadataMap).length > 0) {
        await setCachedFileMetadata(dbMetadataMap)
      }
      log.debug('MongoDB fetch completed:', {
        fetched: files.length,
        missing: missingPaths.length - files.length,
      })
    }
    return metadataMap
  } catch (error) {
    log.error('Error batch fetching file metadata:', error)
    return {}
  }
}

module.exports = {
  getFileMetadataCacheKey,
  getCachedFileMetadata,
  setCachedFileMetadata,
  batchFetchFileMetadata,
}
