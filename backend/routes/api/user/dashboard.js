const router = require('express').Router()
const User = require('../../../models/User')
const { requireRole } = require('../../../utils/authUtils')
const log = require('../../../utils/logHandler')
const sendResponse = require('../../../utils/resUtils')
router.get('/', requireRole('user'), async (req, res) => {
  try {
    log.debug('Getting dashboard for:', req.user.username || 'user')
    const userEntry = await User.findById(req.user._id)
    if (!userEntry) {
      log.debug('User not found for dashboard:', req.user._id)
      return sendResponse(res, 404)
    }
    return res.status(200).json({
      message: 'Welcome ' + userEntry.username + '!' || 'Welcome to dashboard!',
      username: userEntry.username,
      email: userEntry.email,
      roles: userEntry.roles,
      uuid: userEntry.uuid,
      created: userEntry.created,
      modified: userEntry.modified,
      oauth: userEntry.oauth,
      sessions: userEntry.sessions,
      debug: userEntry.user,
    })
  } catch (error) {
    log.error('Failed to send dashboard for user:', error)
    return sendResponse(res, 500)
  }
})
module.exports = router
