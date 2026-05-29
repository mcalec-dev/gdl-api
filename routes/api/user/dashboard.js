const router = require('express').Router()
const User = require('../../../models/User')
const { requireRole } = require('../../../utils/authUtils')
const log = require('../../../utils/logHandler')
const sendResponse = require('../../../utils/resUtils')
/**
 * @typedef {object} AuthenticatedUser
 * @property {string} uuid
 * @property {string} [username]
 */
router.get('/', requireRole('user'), async (req, res) => {
  try {
    const requestUser = /** @type {AuthenticatedUser} */ (req.user)
    log.debug('Getting dashboard for:', requestUser.username || 'user')
    const userEntry = await User.findOne({ uuid: requestUser.uuid })
    if (!userEntry) {
      log.debug('User not found for dashboard:', requestUser.uuid)
      return sendResponse(res, 404)
    }
    return sendResponse(res, 200).json({
      message: userEntry.username
        ? `Welcome ${userEntry.username}!`
        : 'Welcome to dashboard!',
      username: userEntry.username,
      email: userEntry.email,
      roles: userEntry.roles,
      uuid: userEntry.uuid,
      created: userEntry.created,
      oauth: userEntry.oauth,
      sessions: userEntry.sessions,
    })
  } catch (error) {
    log.error('Failed to send dashboard for user:', error)
    return sendResponse(res, 500)
  }
})
module.exports = router
