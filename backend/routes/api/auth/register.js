const router = require('express').Router()
const User = require('../../../models/User')
const bcrypt = require('bcrypt')
const debug = require('debug')('gdl-api:api:auth:register')
const validator = require('validator')
/**
 * @swagger
 * /api/auth/register/:
 *   post:
 *     summary: User registration
 *     description: Register a new user with username, email, and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 description: Unique username for the user
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address of the user
 *               password:
 *                 type: string
 *                 description: Password for the user account
 *             required:
 *               - username
 *               - password
 *     responses:
 *       201:
 *         description: User successfully registered and logged in
 *       400:
 *         description: Missing required fields or invalid email format
 *       409:
 *         description: Username or email already exists
 *       500:
 *         description: Internal server error
 */
router.post(['', '/'], async (req, res) => {
  const { username, email, password } = req.body
  if (!username || !password) {
    debug('Username or password not provided')
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
  const existingUser = await User.findOne({ $or: [{ username }, { email }] })
  if (existingUser) {
    debug('Username or email already exists:', existingUser)
    return res.status(409).json({
      message: 'Conflict',
      status: 409,
    })
  }
  const hash = await bcrypt.hash(password, 10)
  const user = await User.create({
    username,
    email,
    password: hash,
    roles: ['user'],
  })
  try {
    const uuid = require('uuid').v4()
    req.login(user, async (err) => {
      if (err) {
        debug('Error during req.login after registration:', err)
        return res
          .status(500)
          .json({ message: 'Internal Server Error', status: 500 })
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
            debug('Error saving session after registration login:', saveErr)
            return res.status(500).json({
              message: 'Internal Server Error',
              status: 500,
            })
          }
          debug('Login after registration succeeded:', user)
          return res.status(201).json({
            success: true,
            user,
          })
        })
      } catch (error) {
        debug('Failed to login user after registration (post-login):', error)
        return res.status(500).json({
          message: 'Internal Server Error',
          status: 500,
        })
      }
    })
  } catch (error) {
    debug('Failed to login user after registration:', error)
    return res.status(500).json({
      message: 'Internal Server Error',
      status: 500,
    })
  }
})
module.exports = router
