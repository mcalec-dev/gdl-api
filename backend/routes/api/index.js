const router = require('express').Router()
const pkg = require('../../package.json')
const { NAME, BASE_PATH, HOST } = require('../../config')
const debug = require('debug')('gdl-api:api')
const pathUtils = require('../../utils/pathUtils')
const { getHostUrl } = require('../../utils/urlUtils')
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-cache')
  req.utils = {
    ...req.utils,
    pathUtils,
  }
  next()
})
try {
  debug('Mounting admin route')
  router.use('/admin', require('./admin/index'))
  debug('Mounting auth route')
  router.use('/auth', require('./auth/index'))
  debug('Mounting user route')
  router.use('/user', require('./user/index'))
  debug('Mounting download route')
  router.use('/download', require('./download'))
  debug('Mounting files route')
  router.use('/files', require('./files'))
  debug('Mounting health route')
  router.use('/health', require('./health'))
  debug('Mounting random route')
  router.use('/random', require('./random'))
  debug('Mounting search route')
  router.use('/search', require('./search'))
  debug('Mounting stats route')
  router.use('/stats', require('./stats'))
  debug('Mounting upload route')
  router.use('/upload', require('./upload'))
  debug('Mounting uuid route')
  router.use('/uuid', require('./uuid'))
} catch (error) {
  debug('Error mounting routes:', error)
}
/**
 * @swagger
 * /api/:
 *   get:
 *     summary: Get API information and available endpoints
 *     description: Retrieve general API information, version, and list of available endpoints
 *     responses:
 *       200:
 *         description: API information with available endpoint URLs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 api:
 *                   type: string
 *                 name:
 *                   type: string
 *                 version:
 *                   type: string
 *                 description:
 *                   type: string
 *                 author:
 *                   type: string
 *                 keywords:
 *                   type: array
 *                 license:
 *                   type: string
 *                 host:
 *                   type: string
 *                 basePath:
 *                   type: string
 *                 urls:
 *                   type: object
 *                   properties:
 *                     admin:
 *                       type: string
 *                     auth:
 *                       type: string
 *                     user:
 *                       type: string
 *                     download:
 *                       type: string
 *                     files:
 *                       type: string
 *                     health:
 *                       type: string
 *                     random:
 *                       type: string
 *                     search:
 *                       type: string
 *                     stats:
 *                       type: string
 */
router.get(['/', ''], async (req, res) => {
  const baseURL = (await getHostUrl(req)) + '/api'
  return res.json({
    api: 'v2',
    name: String(NAME),
    version: String(pkg.version),
    description: String(pkg.description),
    author: String(pkg.author),
    keywords: pkg.keywords,
    license: String(pkg.license),
    host: String(await HOST),
    basePath: String(BASE_PATH),
    urls: {
      admin: baseURL + '/admin',
      auth: baseURL + '/auth',
      user: baseURL + '/user',
      download: baseURL + '/download',
      files: baseURL + '/files',
      health: baseURL + '/health',
      random: baseURL + '/random',
      search: baseURL + '/search',
      stats: baseURL + '/stats',
    },
  })
})
module.exports = router
