const mongoose = require('mongoose')
const log = require('../logHandler')
const { redisGet, redisSet, redisDel } = require('./redisClient')
const {
  getDbCacheSettings,
  getCacheKey,
  extractCacheId,
  toPlainDocument,
  invalidateFromFilter,
  writeDocToCache,
  hydrateCachedResult,
  shouldUseReadThroughCache,
  shouldHandleWriteInvalidation,
  shouldHandleDeleteInvalidation,
} = require('./cacheHelpers')
function initDbCacheLayer() {
  const settings = getDbCacheSettings()
  const mongoosePatched = /** @type {any} */ (mongoose)
  if (mongoosePatched[settings.patchFlag]) {
    log.debug('DB cache layer already initialized')
    return
  }
  mongoosePatched[settings.patchFlag] = true
  if (!settings.redisUrl) {
    log.info('Initializing DB cache layer with Redis disabled')
  } else {
    log.info('Initializing DB cache layer', {
      redisUrl: settings.redisUrl,
      cacheTtlSeconds: settings.cacheTtlSeconds,
    })
  }
  const originalExec = mongoose.Query.prototype.exec
  const originalExecAny = /** @type {any} */ (originalExec)
  /** @param {...any} args */
  mongoose.Query.prototype.exec = async function patchedExec(...args) {
    const query = /** @type {any} */ (this)
    const op = query.op
    const model = query.model
    const collection = model?.collection?.collectionName
    const filter = query.getFilter ? query.getFilter() : {}
    const cacheId = extractCacheId(filter)
    const lean = Boolean(query.mongooseOptions && query.mongooseOptions().lean)
    if (collection && shouldUseReadThroughCache(op) && cacheId) {
      const cacheKey = getCacheKey(collection, cacheId)
      const cachedValue = await redisGet(cacheKey, settings.redisUrl)
      if (cachedValue) {
        try {
          const parsed = JSON.parse(cachedValue)
          return hydrateCachedResult(model, parsed, lean)
        } catch {
          log.warn('Failed to parse cached value for key:', cacheKey)
        }
      }
      const result = await originalExecAny.apply(query, args)
      if (result) {
        await redisSet(
          cacheKey,
          toPlainDocument(result),
          settings.redisUrl,
          settings.cacheTtlSeconds
        )
      }
      return result
    }
    const result = await originalExecAny.apply(query, args)
    if (!collection) {
      return result
    }
    if (shouldHandleWriteInvalidation(op)) {
      if (op === 'findOneAndUpdate' && result) {
        await writeDocToCache(
          collection,
          result,
          settings.redisUrl,
          settings.cacheTtlSeconds
        )
      } else {
        await invalidateFromFilter(collection, filter, settings.redisUrl)
      }
    }
    if (shouldHandleDeleteInvalidation(op)) {
      if (op === 'findOneAndDelete' && result) {
        const deletedId = result._id || result.id || result.uuid
        if (deletedId) {
          await redisDel(getCacheKey(collection, deletedId), settings.redisUrl)
        } else {
          await invalidateFromFilter(collection, filter, settings.redisUrl)
        }
      } else {
        await invalidateFromFilter(collection, filter, settings.redisUrl)
      }
    }
    return result
  }
  const modelAny = /** @type {any} */ (mongoose.Model)
  const originalCreate = modelAny.create
  /** @param {...any} args */
  modelAny.create = async function patchedCreate(...args) {
    const model = /** @type {any} */ (this)
    const created = await originalCreate.apply(model, args)
    const collection = model?.collection?.collectionName
    if (!collection) {
      return created
    }
    if (Array.isArray(created)) {
      for (const doc of created) {
        await writeDocToCache(
          collection,
          doc,
          settings.redisUrl,
          settings.cacheTtlSeconds
        )
      }
    } else {
      await writeDocToCache(
        collection,
        created,
        settings.redisUrl,
        settings.cacheTtlSeconds
      )
    }
    return created
  }
  const modelPrototypeAny = /** @type {any} */ (mongoose.Model.prototype)
  const originalSave = modelPrototypeAny.save
  /** @param {...any} args */
  modelPrototypeAny.save = async function patchedSave(...args) {
    const doc = /** @type {any} */ (this)
    const saved = await originalSave.apply(doc, args)
    const collection = doc?.collection?.collectionName
    if (collection) {
      await writeDocToCache(
        collection,
        saved,
        settings.redisUrl,
        settings.cacheTtlSeconds
      )
    }
    return saved
  }
}
module.exports = {
  initDbCacheLayer,
}
