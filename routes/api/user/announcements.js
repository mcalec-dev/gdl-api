const express = require('express')
const router = express.Router()
const debug = require('debug')('gdl-api:api:user:announcements')
const { requireRole } = require('../../../utils/authUtils')
const Announcement = require('../../../models/Announcement')
/**
 * @swagger
 * /api/user/announcements:
 *   get:
 *     summary: Get all announcements
 */
router.get(['/', ''], requireRole('user'), async (req, res) => {
  if (!req.user || !req.user.isAuthenticated() || !req.user.hasRole('user')) {
    debug('Unauthorized access attempt')
    return res.status(401).json({
      message: 'Unauthorized',
      status: 401,
    })
  }
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
