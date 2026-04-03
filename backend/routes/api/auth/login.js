const router = require('express').Router()
const User = require('../../../models/User')
const bcrypt = require('bcrypt')
const log = require('../../../utils/logHandler')
const validator = require('validator')
const { COOKIE_MAX_AGE } = require('../../../config')
const sendResponse = require('../../../utils/resUtils')
router.post('/', async (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    log.debug('User already logged in:', req.user.username || '')
    return sendResponse(res, 403, 'Already logged in')
  }
  const { username, email, password } = req.body
  if ((!username && !email) || !password) {
    log.debug('Username/email or password was not provided')
    return sendResponse(res, 400, 'Username/email and password are required')
  }
  if (email && !validator.isEmail(email)) {
    log.debug('Invalid email format:', email)
    return sendResponse(res, 400, 'Invalid email format')
  }
  let user
  if (email) {
    user = await User.findOne({ email: { $eq: email } })
  } else {
    user = await User.findOne({ username: { $eq: username } })
  }
  if (!user) {
    log.debug('User not found:', username, email)
    return sendResponse(res, 400, 'User not found')
  }
  const match = await bcrypt.compare(password, user.password)
  if (!match) {
    log.debug('Password mismatch:', username, email)
    return sendResponse(res, 400, 'Invalid password')
  }
  try {
    const uuid = require('uuid').v4()
    req.login(user, async (err) => {
      if (err) {
        log.error('Error during req.login:', err)
        return sendResponse(res, 500)
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
            log.error('Error saving session after login:', saveErr)
            return sendResponse(res, 500)
          }
          log.info('User logged in:', user.username)
          return res.status(201).json({
            success: true,
            user,
          })
        })
      } catch (error) {
        log.error('Failed to login a user (post-login):', error)
        return sendResponse(res, 500)
      }
    })
  } catch (error) {
    log.error('Failed to login a user:', error)
    return sendResponse(res, 500)
  }
})
module.exports = router
