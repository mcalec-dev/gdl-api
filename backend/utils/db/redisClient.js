const { createClient } = require('redis')
const log = require('../logHandler')
/** @typedef {import('redis').RedisClientType} RedisClient */
/** @type {RedisClient | null} */
let redisClient = null
/** @type {Promise<RedisClient | null> | null} */
let connectPromise = null
/** @param {string | null | undefined} redisUrl */
async function ensureRedisClient(redisUrl) {
  try {
    if (!redisUrl) return null
    if (!redisClient) {
      redisClient = createClient({ url: redisUrl })
      redisClient.on('error', (/** @type {any} */ error) => {
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
  } catch (/** @type {any} */ error) {
    log.warn(
      'Redis unavailable in ensureRedisClient, using MongoDB fallback:',
      error?.message
    )
    return null
  }
}
async function closeRedisClient() {
  const client = redisClient
  redisClient = null
  connectPromise = null
  if (!client) {
    return
  }
  try {
    if (client.isOpen && typeof client.quit === 'function') {
      await client.quit()
      return
    }
    if (typeof client.destroy === 'function') {
      client.destroy()
      return
    }
    if (typeof client.disconnect === 'function') {
      client.disconnect()
    }
  } catch (/** @type {any} */ error) {
    log.warn('Redis client shutdown failed:', error?.message)
  }
}
/**
 * @template T
 * @param {string | null | undefined} redisUrl
 * @param {(client: import('redis').RedisClientType) => Promise<T>} operation
 * @param {T} fallback
 */
async function withRedisClient(redisUrl, operation, fallback) {
  const client = await ensureRedisClient(redisUrl)
  if (!client) return fallback
  return operation(client)
}
/** @param {string} key @param {string | null | undefined} redisUrl */
async function redisGet(key, redisUrl) {
  try {
    return await withRedisClient(redisUrl, (client) => client.get(key), null)
  } catch (/** @type {any} */ error) {
    log.debug(
      `Redis GET failed for key ${key}, using MongoDB fallback:`,
      error?.message
    )
    return null
  }
}
/** @param {string} key @param {any} value @param {string | null | undefined} redisUrl @param {number | null | undefined} ttlSeconds */
async function redisSet(key, value, redisUrl, ttlSeconds) {
  try {
    const ttl =
      typeof ttlSeconds === 'number' && ttlSeconds > 0 ? ttlSeconds : 300
    await withRedisClient(
      redisUrl,
      (client) => client.setEx(key, ttl, JSON.stringify(value)),
      undefined
    )
  } catch (/** @type {any} */ error) {
    log.warn(
      `Redis SET failed for key ${key}, continuing with MongoDB truth:`,
      error?.message
    )
    return
  }
}
/** @param {string} key @param {string | null | undefined} redisUrl */
async function redisDel(key, redisUrl) {
  try {
    if (!key) return
    await withRedisClient(redisUrl, (client) => client.del(key), undefined)
  } catch (/** @type {any} */ error) {
    log.warn(`Redis DEL failed for key ${key}:`, error?.message)
    return
  }
}
/** @param {string} collection @param {string | null | undefined} redisUrl */
async function redisDeleteCollectionKeys(collection, redisUrl) {
  try {
    await withRedisClient(
      redisUrl,
      async (client) => {
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
      },
      undefined
    )
  } catch (/** @type {any} */ error) {
    log.warn(
      `Redis collection invalidation failed for ${collection}:`,
      error?.message
    )
    return
  }
}
module.exports = {
  ensureRedisClient,
  closeRedisClient,
  withRedisClient,
  redisGet,
  redisSet,
  redisDel,
  redisDeleteCollectionKeys,
}
