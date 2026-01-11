const router = require('express').Router()
const debug = require('debug')('gdl-api:api:user')
const { getHostUrl } = require('../../../utils/urlUtils')
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-cache')
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
  debug('Mounting session route')
  router.use('/session', require('./session'))
} catch (error) {
  debug('Error initializing user routes:', error)
}
router.get(['/', ''], async (req, res) => {
  const baseURL = (await getHostUrl(req)) + '/api'
  return res.json({
    user: req.user,
    urls: {
      announcements: baseURL + '/user/announcements',
      dashboard: baseURL + '/user/dashboard',
    },
  })
})
module.exports = router
