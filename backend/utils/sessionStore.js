const MongoStore = require('connect-mongo')
const { MONGODB_URL, COOKIE_MAX_AGE } = require('../config')
const ms = require('ms')
module.exports = () => {
  const cookieMaxAgeMs =
    typeof COOKIE_MAX_AGE === 'string' ? ms(COOKIE_MAX_AGE) : COOKIE_MAX_AGE
  const ttlSeconds = Math.floor(cookieMaxAgeMs / 1000)
  return MongoStore.create({
    mongoUrl: MONGODB_URL,
    collectionName: 'sessions',
    ttl: ttlSeconds,
    touchAfter: 24 * 3600,
    autoRemove: 'native',
  })
}
