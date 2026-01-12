const router = require('express').Router()
const debug = require('debug')('gdl-api:api:auth:check')
/**
 * @swagger
 * /api/auth/check/:
 *   get:
 *     summary: Check user authentication status
 *     description: Check if the current user is authenticated and retrieve their authentication details
 *     responses:
 *       200:
 *         description: Authentication status and user information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 authenticated:
 *                   type: boolean
 *                 user:
 *                   type: object
 *                 roles:
 *                   type: array
 *                 oauth:
 *                   type: object
 *       500:
 *         description: Internal server error
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
