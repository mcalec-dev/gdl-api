const router = require('express').Router()
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
router.get(['/', ''], requireRole('user'), async (req, res) => {
  try {
    debug('Getting dashboard for:', req.user.username || 'user')
    res.json({
      message: 'Welcome ' + req.user.username + '!' || 'Welcome to dashboard!',
      username: req.user.username,
      email: req.user.email,
      roles: req.user.roles,
      id: req.user._id,
      uuid: req.user.uuid,
      created: req.user.created,
      modified: req.user.modified,
      oauth: req.user.oauth,
      sessions: req.user.sessions,
      debug: req.user,
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
