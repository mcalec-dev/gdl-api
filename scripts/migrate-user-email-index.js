// Run once before deploying this version, with writes to the users collection paused.
const mongoose = require('mongoose')
const { MONGODB_URL } = require('../config')
const User = require('../models/User')

const emailIndexOptions = {
  name: 'email_nonempty_unique',
  unique: true,
  partialFilterExpression: { email: { $type: 'string', $gt: '' } },
}

function isEmailIndex(index) {
  const keys = Object.keys(index.key || {})
  return keys.length === 1 && keys[0] === 'email' && index.key.email === 1
}

function isExpectedEmailIndex(index) {
  const emailFilter = index.partialFilterExpression?.email
  return (
    index.name === emailIndexOptions.name &&
    index.unique === true &&
    emailFilter?.$type === 'string' &&
    emailFilter?.$gt === ''
  )
}

async function migrateUserEmailIndex() {
  await mongoose.connect(String(MONGODB_URL))
  const database = mongoose.connection.db
  if (!database) throw new Error('MongoDB connection did not select a database')
  const collectionName = User.collection.name
  const collection = database.collection(collectionName)
  const exists =
    (
      await database
        .listCollections({ name: collectionName }, { nameOnly: true })
        .toArray()
    ).length > 0

  if (!exists) {
    await collection.createIndex({ email: 1 }, emailIndexOptions)
    console.info('Created the optional-email unique index')
    return
  }

  const duplicates = await collection
    .aggregate([
      { $match: { email: { $type: 'string', $gt: '' } } },
      { $group: { _id: '$email', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $limit: 1 },
      { $project: { _id: 0, count: 1 } },
    ])
    .toArray()
  if (duplicates.length) {
    throw new Error(
      'Duplicate non-empty emails exist; resolve them before changing the unique index'
    )
  }

  const indexes = await collection.indexes()
  const emailIndexes = indexes.filter(isEmailIndex)
  if (emailIndexes.length === 1 && isExpectedEmailIndex(emailIndexes[0])) {
    console.info('The optional-email unique index is already current')
    return
  }

  for (const index of emailIndexes) {
    await collection.dropIndex(index.name)
  }
  await collection.createIndex({ email: 1 }, emailIndexOptions)
  console.info(
    'Replaced the legacy email index with the optional-email unique index'
  )
}

migrateUserEmailIndex()
  .catch((error) => {
    console.error('Failed to migrate the optional-email unique index:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })
