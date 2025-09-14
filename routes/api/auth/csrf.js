const router = require('express').Router()
const debug = require('debug')('gdl-api:api:auth:csrf')
/**
 * @swagger
 * /api/auth/check/:
 *   get:
 *     summary: Check user authentication status
 */
router.get(['/', ''], (req, res) => {
  try {
    return res.json({
      csrf: req.csrfToken(),
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
