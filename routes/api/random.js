const router = require('express').Router()
const debug = require('debug')('gdl-api:api:random')
const File = require('../../models/File')
const { requireRole } = require('../../utils/authUtils')
/**
 * @swagger
 * /api/random:
 *   get:
 *     summary: Get a random file
 *     responses:
 *       200:
 *         description: Show a random file
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 file:
 *                   type: string
 *                 path:
 *                   type: string
 *                 collection:
 *                   type: string
 *                 author:
 *                   type: string
 *                 size:
 *                   type: integer
 *                 url:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 type:
 *                   type: string
 */
router.get(['/', ''], requireRole('user'), async (req, res) => {
  if (!req.user) {
    debug('Unauthorized access attempt')
    return res.status(401).json({
      message: 'Unauthorized',
      status: 401,
    })
  }
  try {
    const getRandomImage = await File.aggregate([
      { $sample: { size: 1 } },
    ]).catch((error) => {
      debug('Error getting random file from database:', error)
      return res.status(500).json({
        message: 'Internal Server Error',
        status: 500,
      })
    })
    const randomImage = getRandomImage[0]
    const url = req.protocol + '://' + req.hostname + randomImage.paths.remote
    return res.json({
      file: randomImage.name,
      path: randomImage.paths.remote,
      collection: randomImage.collection,
      author: randomImage.author,
      size: randomImage.size,
      url,
      created: randomImage.created,
      modified: randomImage.modified,
      type: randomImage.type,
    })
  } catch (error) {
    debug('Error in random route:', error)
    return res.status(500).json({
      message: 'Internal Server Error',
      status: 500,
    })
  }
})
module.exports = router
