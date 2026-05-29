const router = require('express').Router()
const log = require('../../../utils/logHandler')
const sendResponse = require('../../../utils/resUtils')
router.get('/', (req, res) => {
  try {
    return sendResponse(res, 200).json({
      authenticated: Boolean(req.user && req.isAuthenticated()),
      user: req.user,
    })
  } catch (error) {
    log.error('Error checking auth status:', error)
    return sendResponse.error(res, 500, 'Failed to check auth status')
  }
})
module.exports = router
