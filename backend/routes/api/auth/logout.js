const router = require('express').Router()
const log = require('../../../utils/logHandler')
const User = require('../../../models/User')
const sendResponse = require('../../../utils/resUtils')
router.post('/', async (req, res) => {
  if (!req.user || !req.isAuthenticated()) {
    log.debug('User is not logged in')
    return sendResponse(res, 401, 'Not logged in')
  }
  const user = /** @type {any} */ (req.user)
  const sessionUuid = /** @type {any} */ (req.session)?.uuid
  log.debug('Logging out user:', user.username)
  try {
    if (sessionUuid) {
      const result = await User.updateOne(
        { _id: user._id },
        { $pull: { sessions: { uuid: sessionUuid } } }
      )
      if (result.modifiedCount > 0) {
        log.debug('Removed current session from user:', user.username)
      } else {
        log.debug('Current session was not found on user:', user.username)
      }
    } else {
      log.debug('No current session UUID found during logout')
    }
  } catch (error) {
    log.error('Failed to remove current session from user:', error)
    return sendResponse(res, 500)
  }
  req.logout((error) => {
    if (error) {
      log.error('Failed to logout a user:', error)
      return sendResponse(res, 500)
    }
    if (!req.session) {
      res.clearCookie('connect.sid')
      return sendResponse(res, 201, 'Logged out successfully')
    }
    req.session.destroy((destroyError) => {
      if (destroyError) {
        log.error('Failed to destroy session:', destroyError)
        return sendResponse(res, 500)
      }
      res.clearCookie('connect.sid')
      return sendResponse(res, 201, 'Logged out successfully')
    })
  })
})
module.exports = router
