/* future admin panel */
const express = require('express')
const router = express.Router()
const { requireRole } = require('../../utils/authUtils')
router.get(['/', ''], requireRole('admin'), (req, res, next) => {
  next()
})
module.exports = router
