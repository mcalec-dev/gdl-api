const router = require('express').Router()
const { requireRole } = require('../../../utils/authUtils')
const log = require('../../../utils/logHandler')
const sendResponse = require('../../../utils/resUtils')
router.get('/', requireRole('user'), async (req, res) => {
  try {
    log.debug('Getting sessions for:', req.user.username || 'user')
    return res.json(req.user.sessions)
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
    req.user.sessions = (req.user.sessions || []).filter((s) => s.uuid !== uuid)
    await req.user.save()
    log.debug('Deleted session', uuid, 'for user:', req.user.username || 'user')
    return sendResponse(res, 204, 'Session deleted successfully')
  } catch (error) {
    log.error('Failed to delete session for user:', error)
    return sendResponse(res, 500)
  }
})
module.exports = router
