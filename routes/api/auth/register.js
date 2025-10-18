const router = require('express').Router()
const User = require('../../../models/User')
const bcrypt = require('bcrypt')
const debug = require('debug')('gdl-api:api:auth:register')
/**
 * @swagger
 * /api/auth/register/:
 *   post:
 *    summary: User registration
 *    description: Register a new user with username, email, and password.
 *   parameters:
 *   - in: body
 *     name: user
 *     description: User information for registration.
 *    schema:
 *     type: object
 *     properties:
 *      username:
 *        type: string
 *      email:
 *        type: string
 *      password:
 *        type: string
 *   required:
 *     - username
 *     - email
 *     - password
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
    req.login(user, async () => {
      user.sessions = user.sessions || []
      user.sessions.push({
        uuid,
        modified: new Date(),
        ip: req.ip || '',
        useragent: req.headers['user-agent'] || req.get('User-Agent') || '',
      })
      await user.save()
      req.session.uuid = uuid
      debug('Login after registration succeeded:', user)
      return res.status(200).json({
        success: true,
        status: 200,
        user,
      })
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
