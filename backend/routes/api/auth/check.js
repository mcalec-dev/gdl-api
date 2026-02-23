const router = require('express').Router()
const log = require('../../../utils/logHandler')
const sendResponse = require('../../../utils/resUtils')
router.get('/', (req, res) => {
  try {
    return res.json({
      authenticated: req.isAuthenticated(),
      user: req.user,
      roles: req.user?.roles,
      oauth: req.user?.oauth,
    })
  } catch (error) {
    log.error('Error checking auth status:', error)
    return sendResponse(res, 500)
  }
})
module.exports = router
