const MongoStore = require('connect-mongo')
const { MONGODB_URL } = require('../config')
const ms = require('ms')
module.exports = () =>
  MongoStore.create({
    mongoUrl: MONGODB_URL,
    collectionName: 'sessions',
    ttl: ms('30d'),
    autoRemove: 'native',
  })
