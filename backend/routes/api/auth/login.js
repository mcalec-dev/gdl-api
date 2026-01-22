const router = require('express').Router()
const User = require('../../../models/User')
const bcrypt = require('bcrypt')
const debug = require('debug')('gdl-api:api:auth:login')
const validator = require('validator')
/**
 * @swagger
 * /api/auth/login/:
 *   post:
 *     summary: User login with username/email and password
 *     description: Authenticate a user with their credentials (username or email and password)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 description: Username or email of the user
 *               email:
 *                 type: string
 *                 description: Email address of the user (alternative to username)
 *               password:
 *                 type: string
 *                 description: User password
 *             required:
 *               - password
 *     responses:
 *       200:
 *         description: User successfully logged in
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: User already logged in
 *       500:
 *         description: Internal server error
 */
router.post('', async (req, res) => {
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
  if (email && !validator.isEmail(email)) {
    debug('Invalid email format:', email)
    return res.status(400).json({
      message: 'Bad request',
      status: 400,
    })
  }
  let user
  if (email) {
    user = await User.findOne({ email: { $eq: email } })
  } else {
    user = await User.findOne({ username: { $eq: username } })
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
    const uuid = require('uuid').v4()
    req.login(user, async (err) => {
      if (err) {
        debug('Error during req.login:', err)
        return res.status(500).json({
          message: 'Internal Server Error',
          status: 500,
        })
      }
      try {
        user.sessions = user.sessions || []
        user.sessions.push({
          uuid,
          modified: new Date(),
          ip: String(req.ip),
          useragent: String(req.useragent),
        })
        await user.save()
        req.session.uuid = uuid
        req.session.save((saveErr) => {
          if (saveErr) {
            debug('Error saving session after login:', saveErr)
            return res.status(500).json({
              message: 'Internal Server Error',
              status: 500,
            })
          }
          debug('User logged in:', user.username)
          return res.status(201).json({
            success: true,
            user,
            session: user.sessions[user.sessions.length - 1],
          })
        })
      } catch (error) {
        debug('Failed to login a user (post-login):', error)
        return res.status(500).json({
          message: 'Internal Server Error',
          status: 500,
        })
      }
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
