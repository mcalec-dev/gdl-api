import mongoose from 'mongoose'
import User from '../models/User.js'
import sessionStore from '../utils/sessionStore.js'
import log from '../utils/logHandler.js'

const {
  getCookieMaxAgeMs,
  getSessionStoreKind,
} = sessionStore

export default async function cleanupOrphanedSessions() {
  const cutoffDate = new Date(Date.now() - getCookieMaxAgeMs())
  let removedSessions = 0
  if (getSessionStoreKind() === 'mongo') {
    const db = mongoose.connection.db
    if (!db) throw new Error('Database connection unavailable')
    const sessions = db.collection('sessions')
    try {
      await sessions.createIndex({ expires: 1 }, { expireAfterSeconds: 0 })
    } catch (error) {
      log.debug(
        'Session TTL index already exists or creation failed:',
        error instanceof Error ? error.message : String(error)
      )
    }
    const result = await sessions.deleteMany({
      $or: [
        { expires: { $lt: cutoffDate } },
        { 'expires.$date': { $lt: cutoffDate } },
      ],
    })
    removedSessions = result.deletedCount
  }
  const userResult = await User.updateMany(
    {},
    {
      $pull: {
        sessions: {
          expires: { $lt: cutoffDate },
        },
      },
    }
  )
  log.info(
    `Session cleanup completed (${removedSessions} store sessions removed, ${userResult.modifiedCount} users updated)`
  )
}
