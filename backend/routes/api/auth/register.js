const router = require('express').Router()
const User = require('../../../models/User')
const bcrypt = require('bcrypt')
const log = require('../../../utils/logHandler')
const validator = require('validator')
const sendResponse = require('../../../utils/resUtils')
router.post('/', async (req, res) => {
  const { username, email, password } = req.body
  if (!username || !password) {
    log.debug('Username or password not provided')
    return sendResponse(res, 400, 'Username and password are required')
  }
  if (email && !validator.isEmail(email)) {
    log.debug('Invalid email format:', email)
    return sendResponse(res, 400, 'Invalid email format')
  }
  const existingUser = await User.findOne({ $or: [{ username }, { email }] })
  if (existingUser) {
    log.debug('Username or email already exists:', existingUser)
    return sendResponse(res, 409, 'Username or email already exists')
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
        return res
          .status(500)
          .json({ message: 'Internal Server Error', status: 500 })
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
          ip: String(req.ip),
          useragent: String(req.useragent),
        })
        await user.save()
        req.session.uuid = sessionUuid
        req.session.save((saveErr) => {
          if (saveErr) {
            log.error('Error saving session after registration login:', saveErr)
            return sendResponse(res, 500)
          }
          log.debug('Login after registration succeeded:', user)
          return sendResponse(
            res,
            201,
            'User registered and logged in successfully'
          )
        })
      } catch (error) {
        log.error(
          'Failed to login user after registration (post-login):',
          error
        )
        return sendResponse(res, 500)
      }
    })
  } catch (error) {
    log.error('Failed to login user after registration:', error)
    return sendResponse(res, 500)
  }
})
module.exports = router
