const express = require('express')
const router = express.Router()
const debug = require('debug')('gdl-api:api:auth:logout')
router.get(['/', ''], (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(400).json({
      message: 'Bad Request',
      status: 400,
    })
  } else {
    try {
      debug('Logging out user:', req.user.username)
      req.logout(() => {
        return res.status(200).json({
          success: true,
          status: 200,
        })
      })
    } catch (error) {
      debug('Failed to logout a user:', error)
      return res.status(500).json({
        message: 'Internal Server Error',
        status: 500,
      })
    }
  }
})
module.exports = router
