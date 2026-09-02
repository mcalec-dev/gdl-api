const config = /** @type {any} */ (require('../../config'))
const REDIS_URL = config.REDIS_URL
const REDIS_CACHE_TTL_SECONDS = config.REDIS_CACHE_TTL_SECONDS
const log = require('../logHandler')
const { withRedisClient } = require('./redisClient')

/**
 * @param {string[]} keys
 * @param {string | null | undefined} [redisUrl]
 */
async function cacheGetManyJson(keys, redisUrl = REDIS_URL) {
  if (!Array.isArray(keys) || keys.length === 0) return {}
  try {
    const values = await withRedisClient(redisUrl, (client) => client.mGet(keys), [])
    const results = /** @type {Record<string, any>} */ ({})
    values.forEach((value, index) => {
      if (!value) return
      const key = keys[index]
      try {
        const parsed = JSON.parse(value)
        if (parsed && typeof parsed === 'object') {
          results[key] = parsed
        }
      } catch {
        log.debug('Failed to parse cached JSON value for key:', key)
      }
    })
    return results
  } catch (/** @type {any} */ error) {
    log.debug('Redis MGET failed, using MongoDB fallback:', error?.message)
    return {}
  }
}

/**
 * @param {Record<string, any>} entries
 * @param {number | null | undefined} [ttlSeconds]
 * @param {string | null | undefined} [redisUrl]
 */
async function cacheSetManyJson(
  entries,
  ttlSeconds = REDIS_CACHE_TTL_SECONDS,
  redisUrl = REDIS_URL
) {
  if (!entries || typeof entries !== 'object') return
  const records = Object.entries(entries)
  if (records.length === 0) return
  try {
    const ttl = typeof ttlSeconds === 'number' && ttlSeconds > 0 ? ttlSeconds : 300
    await withRedisClient(
      redisUrl,
      (client) =>
        Promise.all(
          records.map(([key, value]) => client.setEx(key, ttl, JSON.stringify(value)))
        ),
      undefined
    )
  } catch (/** @type {any} */ error) {
    log.debug('Redis MSET(setEx) failed, continuing with MongoDB truth:', error?.message)
  }
}

module.exports = {
  cacheGetManyJson,
  cacheSetManyJson,
}
