const { MongoStore } = require('connect-mongo')
const { RedisStore } = require('connect-redis')
const ms = require('ms')
const log = require('./logHandler')
const config = /** @type {any} */ (require('../config'))
const { ensureRedisClient, closeRedisClient } = require('./db/redisClient')
const MONGODB_URL = config.MONGODB_URL
const REDIS_URL = config.REDIS_URL
const COOKIE_MAX_AGE = config.COOKIE_MAX_AGE
const DEFAULT_COOKIE_MAX_AGE_MS = ms('30d')
/** @type {import('express-session').Store | null} */
let store = null
/** @type {Promise<import('express-session').Store> | null} */
let initPromise = null
/** @type {'redis' | 'mongo' | 'uninitialized'} */
let storeKind = 'uninitialized'
/**
 * @param {unknown} session
 * @returns {import('express-session').SessionData}
 */
function unserializeSession(session) {
  if (typeof session !== 'string') {
    return /** @type {import('express-session').SessionData} */ (
      /** @type {unknown} */ (session)
    )
  }
  try {
    return /** @type {import('express-session').SessionData} */ (
      JSON.parse(session)
    )
  } catch {
    return /** @type {import('express-session').SessionData} */ (
      /** @type {unknown} */ (session)
    )
  }
}
/** @returns {number} */
function getCookieMaxAgeMs() {
  if (typeof COOKIE_MAX_AGE === 'number' && Number.isFinite(COOKIE_MAX_AGE)) {
    return COOKIE_MAX_AGE
  }
  if (typeof COOKIE_MAX_AGE === 'string') {
    const parsed = ms(/** @type {any} */ (COOKIE_MAX_AGE))
    if (typeof parsed === 'number' && Number.isFinite(parsed)) {
      return parsed
    }
  }
  return DEFAULT_COOKIE_MAX_AGE_MS
}
async function initSessionStore() {
  if (store) {
    return store
  }
  if (initPromise) {
    return initPromise
  }
  initPromise = (async () => {
    const cookieMaxAgeMs = getCookieMaxAgeMs()
    const ttlSeconds = Math.max(1, Math.floor(cookieMaxAgeMs / 1000))
    const redisClient = await ensureRedisClient(REDIS_URL)
    if (redisClient) {
      const redisStore = new RedisStore({
        client: redisClient,
        prefix: 'sess:',
        ttl: ttlSeconds,
        disableTouch: false,
      })
      store = redisStore
      storeKind = 'redis'
      log.info('Session store initialized with Redis')
      return redisStore
    }
    const mongoStore = MongoStore.create({
      mongoUrl: MONGODB_URL,
      collectionName: 'sessions',
      ttl: ttlSeconds,
      touchAfter: 24 * 3600,
      autoRemove: 'native',
      unserialize: unserializeSession,
    })
    store = mongoStore
    storeKind = 'mongo'
    log.warn('Redis unavailable for sessions, falling back to MongoDB store')
    return mongoStore
  })()
  try {
    return await initPromise
  } finally {
    initPromise = null
  }
}
function getSessionStore() {
  return store
}
function getSessionStoreKind() {
  return storeKind
}
/**
 * @param {'clear' | 'length'} methodName
 * @returns {Promise<unknown | null>}
 */
async function callStoreMethod(methodName) {
  const activeStore = await initSessionStore()
  const method = activeStore?.[methodName]
  if (typeof method !== 'function') {
    return null
  }
  return new Promise((resolve, reject) => {
    let settled = false
    /**
     * @param {unknown} [error]
     * @param {unknown} [value]
     */
    const finish = (error, value) => {
      if (settled) {
        return
      }
      settled = true
      if (error) {
        reject(error)
        return
      }
      resolve(value ?? null)
    }
    try {
      method.call(activeStore, finish)
    } catch (error) {
      finish(error)
    }
  })
}
async function countActiveSessions() {
  const count = await callStoreMethod('length')
  return typeof count === 'number' ? count : 0
}
async function shutdownSessionStore() {
  await closeRedisClient()
}
module.exports = {
  initSessionStore,
  getSessionStore,
  getSessionStoreKind,
  getCookieMaxAgeMs,
  countActiveSessions,
  shutdownSessionStore,
}
