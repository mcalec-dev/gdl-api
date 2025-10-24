const router = require('express').Router()
const debug = require('debug')('gdl-api:api:user:announcements')
const Announcement = require('../../../models/Announcement')
/**
 * @swagger
 * /api/user/announcements:
 *   get:
 *    summary: Retrieve announcements
 *    description: Retrieve a list of announcements for users.
 *
 */
router.get(['/', ''], async (req, res) => {
  try {
    const announcements = await Announcement.find().sort({ created: -1 }).lean()
    return res.json(announcements)
  } catch (error) {
    debug('Error fetching announcements:', error)
    return res.status(500).json({
      error: 'Internal Server Error',
      status: 500,
    })
  }
})
module.exports = router
