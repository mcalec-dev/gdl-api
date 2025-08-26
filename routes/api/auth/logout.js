const express = require('express')
const router = express.Router()
const debug = require('debug')('gdl-api:api:auth:logout')
const User = require('../../../models/User')
/**
 * @swagger
 * /api/auth/logout/:
 *   post:
 *     summary: Logout user
 */
router.post(['/', ''], async (req, res) => {
  if (!req.isAuthenticated()) {
    debug('User is not authenticated')
    return res.status(400).json({
      message: 'Bad Request',
      status: 400,
    })
  }
  try {
    debug('Logging out user:', req.user.username)
    if (req.session) {
      try {
        await User.updateOne(
          { uuid: req.user.uuid },
          { $pull: { sessions: { uuid: req.user.sessions.uuid } } }
        )
        debug('Removed session from user.sessions:', req.user.sessions.uuid)
      } catch (error) {
        debug('Failed to remove session from user.sessions:', error)
      }
    } else {
      debug('No session uuid found to remove from user.sessions', {
        userUuid: req.user.uuid,
        session: req.session,
      })
    }
    req.logout((error) => {
      if (error) {
        debug('Failed to logout a user:', error)
        return res.status(500).json({
          message: 'Internal Server Error',
          status: 500,
        })
      }
      if (req.session) {
        req.session.destroy((error) => {
          if (error) {
            debug('Failed to destroy session:', error)
            return res.status(500).json({
              message: 'Internal Server Error',
              status: 500,
            })
          }
          res.clearCookie('connect.sid')
          return res.status(200).json({
            success: true,
            status: 200,
          })
        })
      } else {
        debug('No session found to destroy')
        res.clearCookie('connect.sid')
        return res.status(200).json({
          success: true,
          status: 200,
        })
      }
    })
  } catch (error) {
    debug('Failed to logout a user:', error)
    return res.status(500).json({
      message: 'Internal Server Error',
      status: 500,
    })
  }
})
module.exports = router
