const router = require('express').Router()
const debug = require('debug')('gdl-api:api:user')
const { getHostUrl } = require('../../../utils/urlUtils')
/**
 * @swagger
 * /api/user/:
 *   get:
 *     summary: Get user API information
 *     description: Get current authenticated user information and available user endpoints
 *     responses:
 *       200:
 *         description: User information and available endpoints
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                 urls:
 *                   type: object
 *                   properties:
 *                     announcements:
 *                       type: string
 *                     dashboard:
 *                       type: string
 */
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
