const express = require('express')
const router = express.Router()
const { requireAnyRole } = require('../../../utils/authUtils')
const debug = require('debug')('gdl-api:api:auth:dashboard')
/**
 * @swagger
 * /api/auth/dashboard/:
 *   get:
 *     summary: User dashboard
 */
router.get(['/', ''], requireAnyRole(), (req, res) => {
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
