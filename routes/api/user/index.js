const router = require('express').Router()
const log = require('../../../utils/logHandler')
const { getHostUrl } = require('../../../utils/urlUtils')
const sendResponse = require('../../../utils/resUtils')
try {
  log.debug('Mounting announcements route')
  router.use('/announcements', require('./announcements'))
  log.debug('Mounting dashboard route')
  router.use('/dashboard', require('./dashboard'))
  log.debug('Mounting session route')
  router.use('/session', require('./session'))
  log.debug('Mounting color route')
  router.use('/color', require('./color'))
} catch (error) {
  log.error('Error initializing user routes:', error)
}
router.get('/', async (req, res) => {
  const baseURL = (await getHostUrl(req)) + '/api'
  return sendResponse(res, 200).json({
    user: req.user,
    urls: {
      announcements: baseURL + '/user/announcements',
      dashboard: baseURL + '/user/dashboard',
      color: baseURL + '/user/color',
    },
  })
})
module.exports = router
