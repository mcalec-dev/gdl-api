import Stats from '../models/Stats.js'
import snapshot from '../utils/stats/snapshot.js'
import log from '../utils/logHandler.js'

const { generateStatsSnapshot } = snapshot

export default async function persistStatsSnapshot() {
  const snapshot = await generateStatsSnapshot()
  await Stats.findOneAndUpdate(
    {},
    { $set: snapshot },
    { upsert: true, returnDocument: 'after' }
  )
  log.info('Stats snapshot persisted')
}