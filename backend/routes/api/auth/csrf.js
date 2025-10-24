const router = require('express').Router()
const debug = require('debug')('gdl-api:api:auth:csrf')
/**
 * @swagger
 * /api/auth/csrf:
 *   get:
 *     summary: Retrieve CSRF token
 *     description: Retrieve a CSRF token for the current session.
 */
router.get(['/', ''], (req, res) => {
  try {
    return res.json({
      csrf: req.csrfToken,
    })
  } catch (error) {
    debug('Error sending CSRF token:', error)
    return res.status(500).json({
      message: 'Internal server error',
      status: 500,
    })
  }
})
module.exports = router
