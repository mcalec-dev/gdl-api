const router = require('express').Router()
const debug = require('debug')('gdl-api:api:random')
const File = require('../../models/File')
const { requireRole } = require('../../utils/authUtils')
const { getHostUrl } = require('../../utils/urlUtils')
router.get('/', requireRole('user'), async (req, res) => {
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
      file: randomImage.name || null,
      path: randomImage.paths.remote || null,
      collection: randomImage.collection || null,
      author: randomImage.author || null,
      size: randomImage.size || 0,
      url: url || null,
      created: randomImage.created || null,
      modified: randomImage.modified || null,
      type: randomImage.type || 'unknown',
      hash: randomImage.hash || null,
      uuid: randomImage.uuid || null,
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
