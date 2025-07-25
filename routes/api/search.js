const express = require('express')
const path = require('path')
const router = express.Router()
const { walkAndSearchFiles } = require('../../utils/searchUtils')
const { BASE_DIR } = require('../../config')
const debug = require('debug')('gdl-api:api:search')
const { normalizeUrl } = require('../../utils/urlUtils')
const { normalizePath } = require('../../utils/pathUtils')
const MAX_SEARCH_RESULTS = 2000
/**
 * @swagger
 * /api/search:
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
 *       - in: query
 *         name: files
 *         required: false
 *         schema:
 *           type: boolean
 *         description: Include files in search results
 *       - in: query
 *         name: directories
 *         required: false
 *         schema:
 *           type: boolean
 *         description: Include directories in search results
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
 *                         description: Name of the file or directory
 *                       type:
 *                         type: string
 *                         description: Type of the item (file or directory)
 *                       collection:
 *                         type: string
 *                         description: Collection name from the first part of the path
 *                       author:
 *                         type: string
 *                         description: Author name from the second part of the path
 *                       path:
 *                         type: string
 *                         description: Normalized path to the item
 *                       url:
 *                         type: string
 *                         description: Complete URL to access the item
 *                       relevancy:
 *                         type: number
 *                         description: Search result relevancy score
 */
router.get(['/', ''], async (req, res) => {
  const { q, type, files, directories } = req.query
  debug('Starting search for: "%s" with filter(s): %o', q, { type })
  if (!q || q.length === 0) {
    debug('Search query is empty')
    return res.status(400).json({
      message: 'Bad Request',
      status: 400,
    })
  }
  const searchPattern = `*${q}*`
  try {
    const filters = {
      type: type || 'all',
      files: files ? files === 'true' : undefined,
      directories: directories ? directories === 'true' : undefined,
    }
    const results = []
    for await (const result of walkAndSearchFiles(
      BASE_DIR,
      searchPattern,
      filters,
      MAX_SEARCH_RESULTS
    )) {
      results.push(result)
      if (results.length >= MAX_SEARCH_RESULTS) break
    }
    results.sort((a, b) => b.relevancy - a.relevancy)
    const simplifiedResults = results.map((result) => {
      const relativePath = path.relative(BASE_DIR, result.path)
      const pathParts = relativePath.split(path.sep)
      const collection = pathParts[0] || ''
      const author = pathParts[1] || ''
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
        author: author,
        path: normalizedPath,
        url: url,
        relevancy: result.relevancy,
      }
    })
    debug('Found %s entries', results.length)
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
