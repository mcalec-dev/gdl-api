const router = require('express').Router()
const log = require('../../../utils/logHandler')
const { getHostUrl } = require('../../../utils/urlUtils')
try {
  log.debug('Mounting announcements route')
  router.use('/announcements', require('./announcements'))
  log.debug('Mounting dashboard route')
  router.use('/dashboard', require('./dashboard'))
  log.debug('Mounting session route')
  router.use('/session', require('./session'))
} catch (error) {
  log.error('Error initializing user routes:', error)
}
router.get('/', async (req, res) => {
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
