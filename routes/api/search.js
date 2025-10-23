const router = require('express').Router()
const { BASE_PATH } = require('../../config')
const { searchDatabase } = require('../../utils/searchUtils')
const debug = require('debug')('gdl-api:api:search')
const { requireRole } = require('../../utils/authUtils')
/**
 * @swagger
 * /api/search/:
 *   get:
 *     summary: Search for files and directories with relevancy ranking
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query
 *       - in: query
 *         name: type
 *         required: false
 *         schema:
 *           type: string
 *           enum: [file, directory]
 *         description: Filter by type (file or directory)
 */
router.get(['/', ''], requireRole('user'), async (req, res) => {
  if (!req.user) {
    debug('Unauthorized access attempt')
    return res.status(401).json({ message: 'Unauthorized', status: 401 })
  }
  const { q, type } = req.query
  debug('Starting DB search for: "%s" with filter(s): %o', q, {
    type,
  })
  if (!q || q.length === 0) {
    debug('Search query is empty')
    return res.status(400).json({ message: 'Bad Request', status: 400 })
  }
  try {
    const simplifiedResults = await searchDatabase({
      q,
      type,
      basePath: BASE_PATH,
      protocol: req.protocol,
      hostname: req.hostname,
    })
    debug('Found %s entries (DB)', simplifiedResults.length)
    return res.json({
      query: q,
      count: simplifiedResults.length,
      results: simplifiedResults,
    })
  } catch (error) {
    debug('Search error:', error.stack)
    return res.status(500).json({
      message: 'Internal Server Error',
      status: 500,
    })
  }
})
module.exports = router
