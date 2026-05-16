const config = /** @type {any} */ (require('../../config'))
const REDIS_URL = config.REDIS_URL
const REDIS_CACHE_TTL_SECONDS = config.REDIS_CACHE_TTL_SECONDS
const REDIS_CACHE_PATCH_FLAG = config.REDIS_CACHE_PATCH_FLAG
const { redisSet, redisDel, redisDeleteCollectionKeys } = require('./redisClient')
function getDbCacheSettings() {
  return {
    redisUrl: REDIS_URL,
    cacheTtlSeconds: REDIS_CACHE_TTL_SECONDS,
    patchFlag: Symbol.for(REDIS_CACHE_PATCH_FLAG),
  }
}
/** @param {string} collection @param {unknown} id */
function getCacheKey(collection, id) {
  return `${collection}:${String(id)}`
}
/** @param {any} value */
function extractValue(value) {
  if (value === null || value === undefined) return null
  if (typeof value === 'object' && value.$eq !== undefined) {
    return value.$eq
  }
  return value
}
/** @param {any} filter @returns {string | number | null} */
function extractCacheId(filter) {
  if (!filter || typeof filter !== 'object') return null
  if (filter.$or && Array.isArray(filter.$or)) {
    for (const clause of filter.$or) {
      const clauseId = extractCacheId(clause)
      if (clauseId) return clauseId
    }
  }
  const idCandidates = ['_id', 'id', 'uuid']
  for (const key of idCandidates) {
    const value = extractValue(filter[key])
    if (value !== null && value !== undefined && typeof value !== 'object') {
      return value
    }
  }
  return null
}
/** @param {any} doc @returns {any} */
function toPlainDocument(doc) {
  if (!doc) return null
  if (Array.isArray(doc)) {
    return doc.map((entry) => toPlainDocument(entry)).filter(Boolean)
  }
  if (typeof doc.toObject === 'function') {
    return doc.toObject()
  }
  if (typeof doc === 'object') {
    return doc
  }
  return null
}
/** @param {string} collection @param {any} filter @param {string | null | undefined} redisUrl */
async function invalidateFromFilter(collection, filter, redisUrl) {
  const id = extractCacheId(filter)
  if (id) {
    await redisDel(getCacheKey(collection, id), redisUrl)
    return
  }
  await redisDeleteCollectionKeys(collection, redisUrl)
}
/** @param {string} collection @param {any} doc @param {string | null | undefined} redisUrl @param {number | null | undefined} ttlSeconds */
async function writeDocToCache(collection, doc, redisUrl, ttlSeconds) {
  if (!doc || typeof doc !== 'object') return
  const id = doc._id || doc.id || doc.uuid
  if (!id) return
  await redisSet(
    getCacheKey(collection, id),
    toPlainDocument(doc),
    redisUrl,
    ttlSeconds
  )
}
/** @param {any} model @param {any} payload @param {boolean} isLean */
function hydrateCachedResult(model, payload, isLean) {
  if (payload === null || payload === undefined) return null
  if (isLean) return payload
  if (Array.isArray(payload)) {
    return payload.map((entry) => model.hydrate(entry))
  }
  return model.hydrate(payload)
}
/** @param {string} op */
function shouldUseReadThroughCache(op) {
  return op === 'findOne' || op === 'findById'
}
/** @param {string} op */
function shouldHandleWriteInvalidation(op) {
  return (
    op === 'updateOne' ||
    op === 'updateMany' ||
    op === 'replaceOne' ||
    op === 'findOneAndUpdate'
  )
}
/** @param {string} op */
function shouldHandleDeleteInvalidation(op) {
  return (
    op === 'deleteOne' ||
    op === 'deleteMany' ||
    op === 'findOneAndDelete' ||
    op === 'findByIdAndDelete'
  )
}
module.exports = {
  getDbCacheSettings,
  getCacheKey,
  extractValue,
  extractCacheId,
  toPlainDocument,
  invalidateFromFilter,
  writeDocToCache,
  hydrateCachedResult,
  shouldUseReadThroughCache,
  shouldHandleWriteInvalidation,
  shouldHandleDeleteInvalidation,
}
