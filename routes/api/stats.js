const router = require('express').Router()
const { generateStatsSnapshot } = require('../../utils/stats/snapshot')
const log = require('../../utils/logHandler')
const { requireRole } = require('../../utils/authUtils')
const sendResponse = require('../../utils/resUtils')
router.get('/', requireRole('user'), async (req, res) => {
  try {
    const stats = await generateStatsSnapshot()
    log.debug('Stats refresh complete:', {
      collections: stats.collections.total,
      files: stats.collections.totalFiles,
      size: stats.collections.totalSize,
      largestFileSize: stats.collections.largestFileSize,
      smallestFileSize: stats.collections.smallestFileSize,
    })
    return sendResponse(res, 200).json(stats)
  } catch (error) {
    log.error('Error generating stats:', error)
    return sendResponse.error(res, 500, 'Internal Server Error')
  }
})

module.exports = router
