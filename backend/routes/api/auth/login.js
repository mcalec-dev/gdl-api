const router = require('express').Router()
const User = require('../../../models/User')
const bcrypt = require('bcrypt')
const debug = require('debug')('gdl-api:api:auth:login')
const validator = require('validator')
const { COOKIE_MAX_AGE } = require('../../../config')
router.post('/', async (req, res) => {
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
    return res.status(400).json({
      message: 'Bad request',
      status: 400,
    })
  }
  const match = await bcrypt.compare(password, user.password)
  if (!match) {
    debug('Password mismatch:', username, email)
    return res.status(400).json({
      message: 'Bad request',
      status: 400,
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
        const now = new Date()
        user.sessions.push({
          uuid,
          created: now,
          modified: now,
          expires: new Date(now.getTime() + COOKIE_MAX_AGE),
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
