const express = require('express')
const router = express.Router()
const { requireAnyRole } = require('../../../utils/authUtils')
/**
 * @swagger
 * /api/auth/dashboard:
 *   get:
 *     summary: User dashboard
 *     responses:
 *       200:
 *         description: User dashboard data
 */
router.get(['/', ''], requireAnyRole(['user', 'admin']), (req, res) => {
  res.json({
    message: 'Welcome ' + req.user.username + '!' || 'Welcome to dashboard!',
    username: req.user.username,
    email: req.user.email,
    roles: req.user.roles,
    id: req.user._id,
    uuid: req.user.uuid,
    created: req.user.created,
    oauth: req.user.oauth,
    debug: req.user,
  })
})
module.exports = router
