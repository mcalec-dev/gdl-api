const router = require('express').Router()
const log = require('../../utils/logHandler')
const File = require('../../models/File')
const { requireRole } = require('../../utils/authUtils')
const { getHostUrl } = require('../../utils/urlUtils')
const sendResponse = require('../../utils/resUtils')
router.get('/', requireRole('user'), async (req, res) => {
  try {
    const getRandomImage = await File.aggregate([{ $sample: { size: 1 } }])
    if (!getRandomImage || getRandomImage.length === 0) {
      log.debug('No random file found in database')
      return sendResponse(res, 404)
    }
    const randomImage = getRandomImage[0]
    return res.json({
      file: String(randomImage.name),
      path: String(randomImage.paths.remote),
      collection: String(randomImage.collection),
      author: String(randomImage.author),
      size: Number(randomImage.size),
      url: String((await getHostUrl(req)) + randomImage.paths.remote),
      created: randomImage.created,
      modified: randomImage.modified,
      type: String(randomImage.type),
      hash: String(randomImage.hash),
      uuid: String(randomImage.uuid),
    })
  } catch (error) {
    log.error('Error in random route:', error)
    return sendResponse(res, 500)
  }
})
module.exports = router
