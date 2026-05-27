const router = require('express').Router()
const User = require('../../../models/User')
const { requireRole } = require('../../../utils/authUtils')
const log = require('../../../utils/logHandler')
const sendResponse = require('../../../utils/resUtils')
/**
 * @typedef {object} UserSession
 * @property {string} uuid
 * @property {Date} created
 * @property {Date} modified
 * @property {Date} expires
 * @property {string} ip
 * @property {string} useragent
 */
/**
 * @typedef {object} AuthenticatedUser
 * @property {string} uuid
 * @property {string} [username]
 * @property {UserSession[]} [sessions]
 */
router.get('/', requireRole('user'), async (req, res) => {
  try {
    const requestUser = /** @type {AuthenticatedUser} */ (req.user)
    log.debug('Getting sessions for:', requestUser.username || 'user')
    return sendResponse.json(res, 200, requestUser.sessions || [])
  } catch (error) {
    log.error('Failed to get sessions for user:', error)
    return sendResponse(res, 500)
  }
})
router.delete(['/:uuid', '/:uuid/'], requireRole('user'), async (req, res) => {
  const { uuid } = req.params
  if (!uuid) {
    log.debug('No UUID provided for session deletion')
    return sendResponse(res, 400, 'UUID parameter is required')
  }
  try {
    const requestUser = /** @type {AuthenticatedUser} */ (req.user)
    const result = await User.updateOne(
      { uuid: requestUser.uuid },
      { $pull: { sessions: { uuid } } }
    )
    if (result.matchedCount === 0) {
      log.debug('User not found for session deletion:', requestUser.uuid)
      return sendResponse(res, 404)
    }
    log.info('Deleted session', uuid, 'for user:', requestUser.username)
    return sendResponse(res, 204)
  } catch (error) {
    log.error('Failed to delete session for user:', error)
    return sendResponse(res, 500, 'Failed to delete session')
  }
})
module.exports = router
