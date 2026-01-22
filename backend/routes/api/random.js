const router = require('express').Router()
const debug = require('debug')('gdl-api:api:random')
const File = require('../../models/File')
const { requireRole } = require('../../utils/authUtils')
const { getHostUrl } = require('../../utils/urlUtils')
/**
 * @swagger
 * /api/random:
 *   get:
 *     summary: Retrieve a random file
 *     description: Retrieve a random file from the database with metadata
 *     responses:
 *       200:
 *         description: Random file metadata
 *       500:
 *         description: Internal server error
 * /api/random/:
 *   get:
 *     summary: Retrieve a random file (with trailing slash)
 *     description: Retrieve a random file from the database with metadata
 *     responses:
 *       200:
 *         description: Random file metadata
 *       500:
 *         description: Internal server error
 * /api/random/image:
 *   get:
 *     summary: Retrieve a random image file
 *     description: Retrieve a random image file and stream it as a file download
 *     responses:
 *       200:
 *         description: Image file binary content
 *       500:
 *         description: Internal server error
 * /api/random/image/:
 *   get:
 *     summary: Retrieve a random image file (with trailing slash)
 *     description: Retrieve a random image file and stream it as a file download
 *     responses:
 *       200:
 *         description: Image file binary content
 *       500:
 *         description: Internal server error
 */
router.get('', requireRole('user'), async (req, res) => {
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
    const url = (await getHostUrl(req)) + randomImage.paths.remote
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
      hash: randomImage.hash,
      uuid: randomImage.uuid,
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
