const MongoStore = require('connect-mongo')
const { MONGODB_URL, COOKIE_MAX_AGE } = require('../config')
const ms = require('ms')
module.exports = () =>
  MongoStore.create({
    mongoUrl: MONGODB_URL,
    collectionName: 'sessions',
    ttl: ms(COOKIE_MAX_AGE),
    autoRemove: 'native',
  })
