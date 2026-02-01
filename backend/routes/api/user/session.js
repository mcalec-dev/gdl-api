const router = require('express').Router()
const { requireRole } = require('../../../utils/authUtils')
const debug = require('debug')('gdl-api:api:user:session')
router.get('/', requireRole('user'), async (req, res) => {
  try {
    debug('Getting sessions for:', req.user.username || 'user')
    return res.json(req.user.sessions)
  } catch (error) {
    debug('Failed to get sessions for user:', error)
    return res.status(500).json({
      message: 'Internal Server Error',
      status: 500,
    })
  }
})
router.delete(['/:uuid', '/:uuid/'], requireRole('user'), async (req, res) => {
  const { uuid } = req.params
  if (!uuid) {
    debug('No UUID provided for session deletion')
    return res.status(400).json({
      message: 'Bad Request',
      status: 400,
    })
  }
  try {
    req.user.sessions = (req.user.sessions || []).filter((s) => s.uuid !== uuid)
    await req.user.save()
    debug('Deleted session', uuid, 'for user:', req.user.username || 'user')
    return res.status(204).send()
  } catch (error) {
    debug('Failed to delete session for user:', error)
    return res.status(500).json({
      message: 'Internal Server Error',
      status: 500,
    })
  }
})
module.exports = router
