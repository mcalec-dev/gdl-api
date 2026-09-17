const router = require('express').Router()
const log = require('../../../utils/logHandler')
const Announcement = require('../../../models/Announcement')
const sendResponse = require('../../../utils/resUtils')
const cache = require('../../../utils/cache')
const { cacheControl } = require('../../../utils/cacheControl')

router.get('/', cacheControl('publicShort'), async (req, res) => {
  try {
    const announcements = await cache.wrap('announcements:public', 120, () =>
      Announcement.find().sort({ created: -1 }).lean(),
    )
    return sendResponse(res, 200).json(announcements)
  } catch (error) {
    log.error('Error fetching announcements:', error)
    return sendResponse(res, 500, 'Error fetching announcements')
  }
})

module.exports = router
