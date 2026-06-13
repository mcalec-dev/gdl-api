const router = require('express').Router()
const User = require('../../../models/User')
const bcrypt = require('bcrypt')
const log = require('../../../utils/logHandler')
const validator = require('validator')
const sendResponse = require('../../../utils/resUtils')
const { getRequestIp, getRequestUserAgent } = require('../../../utils/requestUtils')
router.post('/', async (req, res) => {
  const { username, email, password } = req.body
  if (!username || !password) {
    log.debug('Username or password not provided')
    return sendResponse.error(res, 400, 'Username and password are required')
  }
  if (email && !validator.isEmail(email)) {
    log.debug('Invalid email format:', email)
    return sendResponse.error(res, 400, 'Invalid email format')
  }
  const existingUser = await User.findOne({ $or: [{ username }, { email }] })
  if (existingUser) {
    log.debug('Username or email already exists:', existingUser)
    return sendResponse.error(res, 409, 'Username or email already exists')
  }
  const hash = await bcrypt.hash(password, 10)
  const uuid = require('uuid').v4()
  const user = await User.create({
    username,
    email,
    password: hash,
    uuid,
    created: new Date(),
    roles: ['user'],
  })
  try {
    const sessionUuid = require('uuid').v4()
    req.login(user, async (err) => {
      if (err) {
        log.error('Error during req.login after registration:', err)
        return sendResponse.error(res, 500, 'Internal Server Error')
      }
      try {
        user.sessions = user.sessions || []
        const now = new Date()
        const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days
        user.sessions.push({
          uuid: String(sessionUuid),
          created: now,
          modified: now,
          expires: expiresAt,
          ip: String(getRequestIp(req)),
          useragent: String(getRequestUserAgent(req)),
        })
        await user.save()
        req.session.uuid = sessionUuid
        req.session.save((saveErr) => {
          if (saveErr) {
            log.error('Error saving session after registration login:', saveErr)
            return sendResponse(
              res,
              500,
              'Error saving session after registration login'
            )
          }
          log.info('Login after registration succeeded:', user.username)
          return sendResponse(res, 204)
        })
      } catch (error) {
        log.error(
          'Failed to login user after registration (post-login):',
          error
        )
        return sendResponse.error(
          res,
          500,
          'Error during post-login session handling'
        )
      }
    })
  } catch (error) {
    log.error('Failed to login user after registration:', error)
    return sendResponse.error(res, 500, 'Error during registration login')
  }
})
module.exports = router
