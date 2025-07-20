const express = require('express')
const router = express.Router()
/**
 * @swagger
 * /api/auth/check:
 *   get:
 *     summary: Check user authentication status
 *     responses:
 *       200:
 *         description: User authentication status
 */
router.get(['/', ''], (req, res) => {
  res.json({
    authenticated: req.isAuthenticated(),
    user: req.user,
    roles: req.user?.roles,
    oauth: req.user?.oauth,
  })
})
module.exports = router
