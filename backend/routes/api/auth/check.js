const router = require('express').Router()
const debug = require('debug')('gdl-api:api:auth:check')
/**
 * @swagger
 * /api/auth/check/:
 *   get:
 *     summary: Check user authentication status
 */
router.get(['/', ''], (req, res) => {
  try {
    return res.json({
      authenticated: req.isAuthenticated(),
      user: req.user,
      roles: req.user?.roles,
      oauth: req.user?.oauth,
    })
  } catch (error) {
    debug('Error checking auth status:', error)
    return res.status(500).json({
      message: 'Internal server error',
      status: 500,
    })
  }
})
module.exports = router
