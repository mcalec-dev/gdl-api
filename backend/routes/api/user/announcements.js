const router = require('express').Router()
const debug = require('debug')('gdl-api:api:user:announcements')
const Announcement = require('../../../models/Announcement')
/**
 * @swagger
 * /api/user/announcements:
 *   get:
 *     summary: Retrieve public announcements
 *     description: Get a list of announcements for all users, sorted by creation date
 *     responses:
 *       200:
 *         description: List of announcements
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   title:
 *                     type: string
 *                   message:
 *                     type: string
 *                   severity:
 *                     type: string
 *                     enum: [info, warning, error]
 *                   author:
 *                     type: string
 *                   created:
 *                     type: string
 *                     format: date-time
 *                   modified:
 *                     type: string
 *                     format: date-time
 *                   uuid:
 *                     type: string
 *       500:
 *         description: Internal server error
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
