const router = require('express').Router()
const User = require('../../../models/User')
const bcrypt = require('bcrypt')
const log = require('../../../utils/logHandler')
const validator = require('validator')
const { COOKIE_MAX_AGE } = /** @type {any} */ (require('../../../config'))
const sendResponse = require('../../../utils/resUtils')
const { getRequestIp, getRequestUserAgent } = require('../../../utils/requestUtils')
router.post('/', async (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    log.debug('User already logged in:', req.user.username || '')
    return sendResponse.error(res, 403, 'Already logged in')
  }
  const { username, email, password } = req.body
  if ((!username && !email) || !password) {
    log.debug('Username/email or password was not provided')
    return sendResponse.error(
      res,
      400,
      'Username/email and password are required'
    )
  }
  if (email && !validator.isEmail(email)) {
    log.debug('Invalid email format:', email)
    return sendResponse.error(res, 400, 'Invalid email format')
  }
  let user
  if (email) {
    user = await User.findOne({ email: { $eq: email } })
  } else {
    user = await User.findOne({ username: { $eq: username } })
  }
  if (!user) {
    log.debug('User not found:', username, email)
    return sendResponse.error(res, 400, 'User not found')
  }
  if (!user.password) {
    log.debug('No password set for user:', username, email)
    return sendResponse.error(res, 400, 'No password set for this account')
  }
  const match = await bcrypt.compare(password, user.password)
  if (!match) {
    log.debug('Password mismatch:', username, email)
    return sendResponse.error(res, 400, 'Invalid password')
  }
  try {
    const uuid = require('uuid').v4()
    req.login(user, async (err) => {
      if (err) {
        log.error('Error during req.login:', err)
        return sendResponse.error(res, 500, 'Failed to login')
      }
      try {
        user.sessions = user.sessions || []
        const now = new Date()
        user.sessions.push({
          uuid,
          created: now,
          modified: now,
          expires: new Date(now.getTime() + COOKIE_MAX_AGE),
          ip: String(getRequestIp(req)),
          useragent: String(getRequestUserAgent(req)),
        })
        await user.save()
        req.session.uuid = uuid
        req.session.save((saveErr) => {
          if (saveErr) {
            log.error('Error saving session after login:', saveErr)
            return sendResponse.error(res, 500, 'Failed to save session')
          }
          log.info('User logged in:', user.username)
          return sendResponse(res, 204)
        })
      } catch (error) {
        log.error('Failed to login a user (post-login):', error)
        return sendResponse.error(res, 500, 'Failed to login')
      }
    })
  } catch (error) {
    log.error('Failed to login a user:', error)
    return sendResponse.error(res, 500, 'Failed to login')
  }
})
module.exports = router
