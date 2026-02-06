const router = require('express').Router()
const debug = require('debug')('gdl-api:api:auth')
const { getHostUrl } = require('../../../utils/urlUtils')
try {
  debug('Mounting check route')
  router.use('/check', require('./check'))
  debug('Mounting logout route')
  router.use('/logout', require('./logout'))
  debug('Mounting login route')
  router.use('/login', require('./login'))
  debug('Mounting register route')
  router.use('/provider', require('./provider'))
  debug('Mounting provider route')
  router.use('/register', require('./register'))
} catch (error) {
  debug('Error mounting auth routes:', error)
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
