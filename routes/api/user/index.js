const express = require('express')
const router = express.Router()
const debug = require('debug')('gdl-api:api:user')
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate')
  req.utils = {
    ...req.utils,
  }
  next()
})
try {
  debug('Mounting announcements route')
  router.use('/announcements', require('./announcements'))
  debug('Mounting dashboard route')
  router.use('/dashboard', require('./dashboard'))
} catch (error) {
  debug('Error initializing user routes:', error)
}
module.exports = router
