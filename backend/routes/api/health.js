/* future health endpoint */
const router = require('express').Router()
const log = require('../../utils/logHandler')
const { requireRole } = require('../../utils/authUtils')
const sendResponse = require('../../utils/resUtils')
router.get('/', requireRole('user'), async (req, res) => {
  log.debug('Health endpoint is not implemented yet.')
  return sendResponse(res, 501, 'Health endpoint is not implemented yet.')
})
module.exports = router
