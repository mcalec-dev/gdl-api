const router = require('express').Router()
const debug = require('debug')('gdl-api:api:auth:logout')
const User = require('../../../models/User')
/**
 * @swagger
 * /api/auth/logout/:
 *   post:
 *    summary: User logout
 *    description: Log out the authenticated user and destroy their session.
 */
router.post(['/', ''], async (req, res) => {
  if (!req.user || !req.isAuthenticated()) {
    debug('User is not logged in')
    return res.status(400).json({
      message: 'Bad Request',
      status: 400,
    })
  }
  debug('Logging out user:', req.user.username)
  if (req.session) {
    debug('req.session:', req.session)
    const findUserAgent = await User.findOne({
      username: req.user.username,
      'sessions.uuid': req.session.uuid,
    })
    if (findUserAgent) {
      await User.updateOne(
        { username: req.user.username },
        { $pull: { sessions: { uuid: req.session.uuid } } }
      )
      debug('Removed session from user:', req.user.username)
    } else {
      debug('User uuid does not match session uuid:', req.user.username)
    }
  }
  if (req.session) {
    req.logout((error) => {
      if (error) {
        debug('Failed to logout a user:', error)
        return res.status(500).json({
          message: 'Internal Server Error',
          status: 500,
        })
      }
      req.session.destroy((error) => {
        if (error) {
          debug('Failed to destroy session:', error)
          return res.status(500).json({
            message: 'Internal Server Error',
            status: 500,
          })
        }
        res.clearCookie('connect.sid')
        return res.json({
          success: true,
          status: 200,
        })
      })
    })
  }
})
module.exports = router
