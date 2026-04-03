const router = require('express').Router()
const { BASE_PATH } = require('../../config')
const { searchDatabase } = require('../../utils/searchUtils')
const log = require('../../utils/logHandler')
const { requireRole } = require('../../utils/authUtils')
const sendResponse = require('../../utils/resUtils')
router.get('/', requireRole('user'), async (req, res) => {
  if (!req.user) {
    log.warn('Unauthorized access attempt')
    return sendResponse(res, 401)
  }
  const { q, type } = req.query
  log.debug('Starting DB search for: "%s" with filter(s): %o', q, {
    type,
  })
  if (!q || q.length === 0) {
    log.debug('Search query is empty')
    return sendResponse(res, 400, 'Search query cannot be empty')
  }
  try {
    const simplifiedResults = await searchDatabase({
      q,
      type,
      basePath: BASE_PATH,
      protocol: req.protocol,
      hostname: req.hostname,
    })
    log.info('Found %s entries (DB)', simplifiedResults.length)
    return res.json({
      query: q,
      count: simplifiedResults.length,
      results: simplifiedResults,
    })
  } catch (error) {
    log.error('Search error:', error.stack)
    return sendResponse(res, 500)
  }
})
module.exports = router
