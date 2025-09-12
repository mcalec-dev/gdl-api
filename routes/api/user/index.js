const router = require('express').Router()
const debug = require('debug')('gdl-api:api:user')
const { BASE_PATH } = require('../../../config')
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
router.get(['/', ''], async (req, res) => {
  const baseURL = req.protocol + '://' + req.hostname + BASE_PATH + '/api'
  return res.json({
    user: req.user,
    urls: {
      announcements: baseURL + '/user/announcements',
      dashboard: baseURL + '/user/dashboard',
    },
  })
})
module.exports = router
