const router = require('express').Router()
const log = require('../../../utils/logHandler')
const { getHostUrl } = require('../../../utils/urlUtils')
try {
  log.debug('Mounting check route')
  router.use('/check', require('./check'))
  log.debug('Mounting logout route')
  router.use('/logout', require('./logout'))
  log.debug('Mounting login route')
  router.use('/login', require('./login'))
  log.debug('Mounting register route')
  router.use('/provider', require('./provider'))
  log.debug('Mounting provider route')
  router.use('/register', require('./register'))
} catch (error) {
  log.error('Error mounting auth routes:', error)
}
router.get('/', async (req, res) => {
  const baseURL = (await getHostUrl(req)) + '/api'
  return res.json({
    urls: {
      check: baseURL + '/auth/check',
      login: baseURL + '/auth/login',
      logout: baseURL + '/auth/logout',
      provider: baseURL + '/auth/provider',
      register: baseURL + '/auth/register',
    },
  })
})
module.exports = router
