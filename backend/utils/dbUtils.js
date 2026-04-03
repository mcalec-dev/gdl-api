const mongoose = require('mongoose')
const { createClient } = require('redis')
const {
  REDIS_URL,
  REDIS_CACHE_TTL_SECONDS,
  REDIS_CACHE_PATCH_FLAG,
} = require('../config')
const log = require('./logHandler')
function getDbCacheSettings() {
  return {
    redisUrl: REDIS_URL,
    cacheTtlSeconds: REDIS_CACHE_TTL_SECONDS,
    patchFlag: Symbol.for(REDIS_CACHE_PATCH_FLAG),
  }
}
let redisClient
let connectPromise
function getCacheKey(collection, id) {
  return `${collection}:${String(id)}`
}
function extractValue(value) {
  if (value === null || value === undefined) return null
  if (typeof value === 'object' && value.$eq !== undefined) {
    return value.$eq
  }
  return value
}
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
async function ensureRedisClient(redisUrl) {
  try {
    if (!redisUrl) return null
    if (!redisClient) {
      redisClient = createClient({ url: redisUrl })
      redisClient.on('error', (error) => {
        log.warn('Redis client error, falling back to MongoDB:', error?.message)
        if (!redisClient?.isOpen) {
          redisClient = null
          connectPromise = null
        }
      })
    }
    if (redisClient.isOpen) {
      return redisClient
    }
    if (!connectPromise) {
      connectPromise = redisClient.connect().catch(() => null)
    }
    await connectPromise
    connectPromise = null
    return redisClient.isOpen ? redisClient : null
  } catch (error) {
    log.warn(
      'Redis unavailable in ensureRedisClient, using MongoDB fallback:',
      error?.message
    )
    return null
  }
}
async function redisGet(key, redisUrl) {
  try {
    const client = await ensureRedisClient(redisUrl)
    if (!client) return null
    return await client.get(key)
  } catch (error) {
    log.debug(
      `Redis GET failed for key ${key}, using MongoDB fallback:`,
      error?.message
    )
    return null
  }
}
async function redisSet(key, value, redisUrl, ttlSeconds) {
  try {
    const client = await ensureRedisClient(redisUrl)
    if (!client) return
    await client.setEx(key, ttlSeconds, JSON.stringify(value))
  } catch (error) {
    log.warn(
      `Redis SET failed for key ${key}, continuing with MongoDB truth:`,
      error?.message
    )
    return
  }
}
async function redisDel(key, redisUrl) {
  try {
    const client = await ensureRedisClient(redisUrl)
    if (!client || !key) return
    await client.del(key)
  } catch (error) {
    log.warn(`Redis DEL failed for key ${key}:`, error?.message)
    return
  }
}
async function redisDeleteCollectionKeys(collection, redisUrl) {
  try {
    const client = await ensureRedisClient(redisUrl)
    if (!client) return
    for await (const scanPage of client.scanIterator({
      MATCH: `${collection}:*`,
    })) {
      if (Array.isArray(scanPage)) {
        if (scanPage.length > 0) {
          await client.del(scanPage)
        }
        continue
      }
      if (scanPage) {
        await client.del(scanPage)
      }
    }
  } catch (error) {
    log.warn(
      `Redis collection invalidation failed for ${collection}:`,
      error?.message
    )
    return
  }
}
async function invalidateFromFilter(collection, filter, redisUrl) {
  const id = extractCacheId(filter)
  if (id) {
    await redisDel(getCacheKey(collection, id), redisUrl)
    return
  }
  await redisDeleteCollectionKeys(collection, redisUrl)
}
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
function hydrateCachedResult(model, payload, isLean) {
  if (payload === null || payload === undefined) return null
  if (isLean) return payload
  if (Array.isArray(payload)) {
    return payload.map((entry) => model.hydrate(entry))
  }
  return model.hydrate(payload)
}
function shouldUseReadThroughCache(op) {
  return op === 'findOne' || op === 'findById'
}
function shouldHandleWriteInvalidation(op) {
  return (
    op === 'updateOne' ||
    op === 'updateMany' ||
    op === 'replaceOne' ||
    op === 'findOneAndUpdate'
  )
}
function shouldHandleDeleteInvalidation(op) {
  return (
    op === 'deleteOne' ||
    op === 'deleteMany' ||
    op === 'findOneAndDelete' ||
    op === 'findByIdAndDelete'
  )
}
function initDbCacheLayer() {
  const settings = getDbCacheSettings()
  if (mongoose[settings.patchFlag]) {
    log.debug('DB cache layer already initialized')
    return
  }
  mongoose[settings.patchFlag] = true
  if (!settings.redisUrl) {
    log.info('Initializing DB cache layer with Redis disabled')
  } else {
    log.info('Initializing DB cache layer', {
      redisUrl: settings.redisUrl,
      cacheTtlSeconds: settings.cacheTtlSeconds,
    })
  }
  const originalExec = mongoose.Query.prototype.exec
  mongoose.Query.prototype.exec = async function patchedExec(...args) {
    const op = this.op
    const model = this.model
    const collection = model?.collection?.collectionName
    const filter = this.getFilter ? this.getFilter() : {}
    const cacheId = extractCacheId(filter)
    const lean = Boolean(this.mongooseOptions && this.mongooseOptions().lean)
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
      const result = await originalExec.apply(this, args)
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
    const result = await originalExec.apply(this, args)
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
  const originalCreate = mongoose.Model.create
  mongoose.Model.create = async function patchedCreate(...args) {
    const created = await originalCreate.apply(this, args)
    const collection = this?.collection?.collectionName
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
  const originalSave = mongoose.Model.prototype.save
  mongoose.Model.prototype.save = async function patchedSave(...args) {
    const saved = await originalSave.apply(this, args)
    const collection = this?.collection?.collectionName
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
