/* future health endpoint */
const express = require('express')
const router = express.Router()
const debug = require('debug')('gdl-api:api:health')
router.get(['', '/'], (req, res) => {
  debug('Health endpoint is not implemented yet.')
  return res.status(501).json({
    message: 'Not Implemented',
    status: 501,
  })
})
module.exports = router
