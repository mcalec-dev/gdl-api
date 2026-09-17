import snapshot from '../utils/stats/snapshot.js'

const { persistStatsSnapshot } = snapshot

export default async function persistStats() {
  await persistStatsSnapshot()
}
