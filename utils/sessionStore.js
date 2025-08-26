const MongoStore = require('connect-mongo')
const { MONGODB_URL } = require('../config')
module.exports = () =>
  MongoStore.create({
    mongoUrl: MONGODB_URL,
    collectionName: 'sessions',
    ttl: 30 * 24 * 60 * 60, // 30 days
    autoRemove: 'native',
  })
