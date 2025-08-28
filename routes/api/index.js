const express = require('express')
const router = express.Router()
require('dotenv').config({ quiet: true })
const { NAME, BASE_PATH, HOST } = require('../../config')
const debug = require('debug')('gdl-api:api')
const pathUtils = require('../../utils/pathUtils')
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate')
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
} catch (error) {
  debug('Error mounting routes:', error)
}
/**
 * @swagger
 * /api/:
 *   get:
 *     summary: Get API information
 */
router.get(['/', ''], async (req, res) => {
  const baseURL = req.protocol + '://' + req.hostname + BASE_PATH + '/api'
  res.json({
    api: 'v2',
    name: NAME,
    version: process.env.npm_package_version,
    description: process.env.npm_package_description,
    author: process.env.npm_package_author,
    keywords: process.env.npm_package_keywords,
    license: process.env.npm_package_license,
    host: HOST,
    basePath: BASE_PATH,
    urls: {
      auth: baseURL + '/auth',
      files: baseURL + '/files',
      random: baseURL + '/random',
      search: baseURL + '/search',
      stats: baseURL + '/stats',
    },
  })
})
module.exports = router
