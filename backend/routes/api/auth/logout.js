const router = require('express').Router()
const log = require('../../../utils/logHandler')
const User = require('../../../models/User')
const sendResponse = require('../../../utils/resUtils')
router.post('/', async (req, res) => {
  if (!req.user || !req.isAuthenticated()) {
    log.debug('User is not logged in')
    return sendResponse(res, 401, 'Not logged in')
  }
  log.debug('Logging out user:', req.user.username)
  if (req.session) {
    log.debug('req.session:', req.session)
    const findUserAgent = await User.findOne({
      username: req.user.username,
      'sessions.uuid': req.session.uuid,
    })
    if (findUserAgent) {
      await User.updateOne(
        { username: req.user.username },
        { $pull: { sessions: { uuid: req.session.uuid } } }
      )
      log.debug('Removed session from user:', req.user.username)
    } else {
      log.debug('User uuid does not match session uuid:', req.user.username)
    }
  }
  if (req.session) {
    req.logout((error) => {
      if (error) {
        log.error('Failed to logout a user:', error)
        return sendResponse(res, 500)
      }
      req.session.destroy((error) => {
        if (error) {
          log.error('Failed to destroy session:', error)
          return sendResponse(res, 500)
        }
        res.clearCookie('connect.sid')
        return sendResponse(res, 201, 'Logged out successfully')
      })
    })
  }
})
module.exports = router
