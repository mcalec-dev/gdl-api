const express = require('express')
const path = require('path')
const router = express.Router()
const { walkAndSearchFiles } = require('../../utils/searchUtils')
const { BASE_DIR } = require('../../config')
const debug = require('debug')('gdl-api:api:search')
const { normalizeUrl } = require('../../utils/urlUtils')
const { normalizePath } = require('../../utils/pathUtils')
const MAX_SEARCH_RESULTS = 1000
/**
 * @swagger
 * /api/search:
 *   get:
 *     summary: Search for files
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 query:
 *                   type: string
 *                 count:
 *                   type: integer
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       type:
 *                         type: string
 *                       collection:
 *                         type: string
 *                       path:
 *                         type: string
 *                       url:
 *                         type: string
 */
router.get('/', async (req, res) => {
  const { q } = req.query
  debug('Searching for: %s', q)
  if (!q || q.length === 0) {
    return res.status(400).json({
      message: 'Bad Request',
      status: 400,
    })
  }
  try {
    const results = []
    for await (const result of walkAndSearchFiles(
      BASE_DIR,
      q.toLowerCase(),
      MAX_SEARCH_RESULTS
    )) {
      results.push(result)
      if (results.length >= MAX_SEARCH_RESULTS) break
    }
    const simplifiedResults = results.map((result) => {
      const relativePath = path.relative(BASE_DIR, result.path)
      const pathParts = relativePath.split(path.sep)
      const collection = pathParts[0] || ''
      const normalizedPath = normalizePath(relativePath)
      const { url } = normalizeUrl(
        req,
        relativePath,
        result.type === 'directory'
      )
      return {
        name: result.name,
        type: result.type,
        collection: collection,
        path: normalizedPath,
        url: url,
      }
    })
    res.json({
      query: q,
      count: results.length,
      results: simplifiedResults,
    })
  } catch (error) {
    debug('Search error:', error.stack)
    res.status(500).json({
      message: 'Internal Server Error',
      status: 500,
    })
  }
})
module.exports = router
