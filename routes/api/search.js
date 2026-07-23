const router = require('express').Router()
const config = require('../../config')
const log = require('../../utils/logHandler')
const { searchDatabase } = require('../../utils/search/searchDatabase')
const { requireRole } = require('../../utils/authUtils')
const sendResponse = require('../../utils/resUtils')
const BASE_PATH = typeof config.BASE_PATH === 'string' ? config.BASE_PATH : ''
const VALID_TYPES = new Set(['file', 'directory', 'uuid', 'hash', 'all'])

function asQueryString(value) {
  return typeof value === 'string' ? value : ''
}

router.get('/', requireRole('user'), async (req, res) => {
  const q = asQueryString(req.query.q)
  const rawType = asQueryString(req.query.type).toLowerCase()
  const type = VALID_TYPES.has(rawType) ? rawType : 'all'
  log.debug('Starting DB search for: "%s" with filter(s): %o', q, {
    type,
  })
  if (!q || q.length === 0) {
    log.debug('Search query is empty')
    return sendResponse.error(res, 400, 'Search query cannot be empty')
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
    return sendResponse(res, 200).json({
      results: simplifiedResults,
      count: simplifiedResults.length,
      query: q,
    })
  } catch (error) {
    log.error('Search error:', error instanceof Error ? error.stack : error)
    return sendResponse.error(res, 500, 'Database search error')
  }
})

module.exports = router
