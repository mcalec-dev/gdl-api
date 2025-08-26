const express = require('express')
const router = express.Router()
const User = require('../../../models/User')
const bcrypt = require('bcrypt')
const debug = require('debug')('gdl-api:api:auth:login')
/**
 * @swagger
 * /api/auth/login/:
 *   post:
 *     summary: Login user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 */
router.post(['/', ''], async (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    debug('User already logged in:', req.user.username || '')
    return res.status(403).json({
      success: false,
      message: 'Forbidden',
      status: 403,
      user: req.user,
    })
  }
  const { username, email, password } = req.body
  if ((!username && !email) || !password) {
    debug('Username/email or password was not provided')
    return res.status(400).json({
      message: 'Bad request',
      status: 400,
    })
  }
  let user
  if (email) {
    user = await User.findOne({ email })
  } else {
    user = await User.findOne({ username })
  }
  if (!user) {
    debug('User not found:', username, email)
    return res.status(401).json({
      message: 'Unauthorized',
      status: 401,
    })
  }
  const match = await bcrypt.compare(password, user.password)
  if (!match) {
    debug('Password mismatch:', username, email)
    return res.status(401).json({
      message: 'Unauthorized',
      status: 401,
    })
  }
  try {
    req.login(user, async () => {
      user.sessions = user.sessions || []
      user.sessions.push({
        modified: new Date(),
        ip: req.ip || '',
        useragent: req.headers['user-agent'] || req.get('User-Agent') || '',
      })
      await user.save()
      debug('User logged in:', user.username)
      return res.status(200).json({
        success: true,
        status: 200,
        user,
        session: user.sessions[user.sessions.length - 1],
      })
    })
  } catch (error) {
    debug('Failed to login a user:', error)
    return res.status(500).json({
      message: 'Internal Server Error',
      status: 500,
    })
  }
})
module.exports = router
