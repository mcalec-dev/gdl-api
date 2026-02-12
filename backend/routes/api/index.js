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
router.get('/', async (req, res) => {
  const baseURL = (await getHostUrl(req)) + '/api'
  return res.json({
    api: String('v2'),
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
