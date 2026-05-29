const router = require('express').Router()
const log = require('../../../utils/logHandler')
const Announcement = require('../../../models/Announcement')
const sendResponse = require('../../../utils/resUtils')
router.get('/', async (req, res) => {
  try {
    const announcements = await Announcement.find().sort({ created: -1 }).lean()
    return sendResponse(res, 200).json(announcements)
  } catch (error) {
    log.error('Error fetching announcements:', error)
    return sendResponse(res, 500)
  }
})
module.exports = router
