const router = require('express').Router()
const pkg = require('../../package.json')
const { NAME, BASE_PATH, HOST } = require('../../config')
const log = require('../../utils/logHandler')
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
  log.debug('Mounting admin route')
  router.use('/admin', require('./admin/index'))
  log.debug('Mounting auth route')
  router.use('/auth', require('./auth/index'))
  log.debug('Mounting user route')
  router.use('/user', require('./user/index'))
  log.debug('Mounting download route')
  router.use('/download', require('./download'))
  log.debug('Mounting files route')
  router.use('/files', require('./files'))
  log.debug('Mounting health route')
  router.use('/health', require('./health'))
  log.debug('Mounting random route')
  router.use('/random', require('./random'))
  log.debug('Mounting search route')
  router.use('/search', require('./search'))
  log.debug('Mounting stats route')
  router.use('/stats', require('./stats'))
  log.debug('Mounting upload route')
  router.use('/upload', require('./upload'))
  log.debug('Mounting uuid route')
  router.use('/uuid', require('./uuid'))
} catch (error) {
  log.error('Error mounting routes:', error)
}
router.get('/', async (req, res) => {
  const baseURL = (await getHostUrl(req)) + '/api'
  return res.json({
    name: String(NAME),
    version: String(pkg.version),
    description: String(pkg.description),
    author: String(pkg.author),
    keywords: pkg.keywords,
    license: String(pkg.license),
    host: String(await HOST),
    basePath: String(BASE_PATH),
    urls: {
      admin: String(baseURL + '/admin'),
      auth: String(baseURL + '/auth'),
      user: String(baseURL + '/user'),
      download: String(baseURL + '/download'),
      files: String(baseURL + '/files'),
      health: String(baseURL + '/health'),
      random: String(baseURL + '/random'),
      search: String(baseURL + '/search'),
      stats: String(baseURL + '/stats'),
    },
  })
})
module.exports = router
