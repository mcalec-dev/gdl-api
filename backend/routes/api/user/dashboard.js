const router = require('express').Router()
const User = require('../../../models/User')
const { requireRole } = require('../../../utils/authUtils')
const debug = require('debug')('gdl-api:api:user:dashboard')
/**
 * @swagger
 * /api/user/dashboard/:
 *   get:
 *     summary: Retrieve user dashboard information
 *     description: Retrieve dashboard information for the authenticated user including profile and sessions
 *     responses:
 *       200:
 *         description: User dashboard data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 username:
 *                   type: string
 *                 email:
 *                   type: string
 *                 roles:
 *                   type: array
 *                 id:
 *                   type: string
 *                 uuid:
 *                   type: string
 *                 created:
 *                   type: string
 *                   format: date-time
 *                 modified:
 *                   type: string
 *                   format: date-time
 *                 oauth:
 *                   type: object
 *                 sessions:
 *                   type: array
 *       401:
 *         description: User not authenticated
 *       500:
 *         description: Internal server error
 */
router.get('', requireRole('user'), async (req, res) => {
  try {
    debug('Getting dashboard for:', req.user.username || 'user')
    const userEntry = await User.findById(req.user._id)
    if (!userEntry) {
      debug('User not found for dashboard:', req.user._id)
      return res.status(404).json({
        message: 'User Not Found',
        status: 404,
      })
    }
    return res.status(200).json({
      message: 'Welcome ' + userEntry.username + '!' || 'Welcome to dashboard!',
      username: userEntry.username,
      email: userEntry.email,
      roles: userEntry.roles,
      uuid: userEntry.uuid,
      created: userEntry.created,
      modified: userEntry.modified,
      oauth: userEntry.oauth,
      sessions: userEntry.sessions,
      debug: userEntry.user,
    })
  } catch (error) {
    debug('Failed to send dashboard for user:', error)
    return res.status(500).json({
      message: 'Internal Server Error',
      status: 500,
    })
  }
})
module.exports = router
