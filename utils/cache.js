const { ensureRedisClient } = require('./db/redisClient')
const { REDIS_URL } = /** @type {any} */ (require('../config'))
const log = require('./logHandler')

/**
 * @template T
 * @param {string} key
 * @param {number} ttlSeconds
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function wrap(key, ttlSeconds, fn) {
  const client = await ensureRedisClient(REDIS_URL)
  if (client) {
    try {
      const cached = await client.get(key)
      if (cached !== null) return JSON.parse(cached)
    } catch (error) {
      log.warn(`[cache] read failed for ${key}:`, error)
    }
  }
  const value = await fn()
  if (client) {
    try {
      await client.setEx(key, ttlSeconds, JSON.stringify(value))
    } catch (error) {
      log.warn(`[cache] write failed for ${key}:`, error)
    }
  }
  return value
}

/** @param {string} key */
async function del(key) {
  const client = await ensureRedisClient(REDIS_URL)
  if (!client) return
  try {
    await client.del(key)
  } catch (error) {
    log.warn(`[cache] delete failed for ${key}:`, error)
  }
}

/** @param {string} prefix */
async function delPattern(prefix) {
  const client = await ensureRedisClient(REDIS_URL)
  if (!client) return
  try {
    const keys = []
    for await (const key of client.scanIterator({ MATCH: `${prefix}*` })) {
      if (Array.isArray(key)) keys.push(...key)
      else if (key) keys.push(key)
    }
    if (keys.length) await client.del(keys)
  } catch (error) {
    log.warn(`[cache] pattern delete failed for ${prefix}:`, error)
  }
}

/** @returns {Promise<void>} */
async function purge() {
  const client = await ensureRedisClient(REDIS_URL)
  if (!client) return
  try {
    await client.flushDb()
  } catch (error) {
    log.warn('[cache] purge failed:', error)
  }
}

module.exports = { wrap, del, delPattern, purge }
