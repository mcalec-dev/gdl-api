/* future health endpoint */
const router = require('express').Router()
const debug = require('debug')('gdl-api:api:health')
const { requireRole } = require('../../utils/authUtils')
router.get(['', '/'], requireRole('user'), async (req, res) => {
  if (!req.user) {
    debug('Unauthorized access attempt')
    return res.status(401).json({
      message: 'Unauthorized',
      status: 401,
    })
  }
  debug('Health endpoint is not implemented yet.')
  return res.status(501).json({
    message: 'Not Implemented',
    status: 501,
  })
})
module.exports = router
