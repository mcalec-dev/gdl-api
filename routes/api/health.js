/* future health endpoint */
const express = require('express')
const router = express.Router()
router.get(['/', ''], (req, res, next) => {
  next()
})
module.exports = router
