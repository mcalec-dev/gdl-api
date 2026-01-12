const router = require('express').Router()
const debug = require('debug')('gdl-api:api:auth')
const { getHostUrl } = require('../../../utils/urlUtils')
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-cache')
  req.utils = {
    ...req.utils,
  }
  next()
})
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
/**
 * @swagger
 * /api/auth/:
 *   get:
 *     summary: Get auth API information
 *     description: Get available authentication endpoints
 *     responses:
 *       200:
 *         description: Auth endpoints
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 urls:
 *                   type: object
 *                   properties:
 *                     check:
 *                       type: string
 *                     login:
 *                       type: string
 *                     logout:
 *                       type: string
 *                     provider:
 *                       type: string
 *                     register:
 *                       type: string
 */
router.get(['/', ''], async (req, res) => {
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
