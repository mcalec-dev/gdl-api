const express = require('express')
const router = express.Router()
require('dotenv').config({ quiet: true })
const { NAME, BASE_PATH } = require('../../config')
const debug = require('debug')('gdl-api:api:routes')
const { getAPIUrl } = require('../../utils/urlUtils')
const pathUtils = require('../../utils/pathUtils')
router.use((req, res, next) => {
  req.utils = {
    ...req.utils,
    pathUtils,
  }
  next()
})
try {
  debug('Initializing routes')
  debug('Mounting auth route')
  router.use('/auth', require('./auth/index'))
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
  debug('All routes mounted successfully')
} catch (error) {
  debug('Error mounting routes:', error)
}
/**
 * @swagger
 * /api:
 *   get:
 *     summary: Get API root information
 *     responses:
 *       200:
 *         description: API root information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 auth_url:
 *                   type: string
 *                 files_url:
 *                   type: string
 *                 random_url:
 *                   type: string
 *                 search_url:
 *                   type: string
 *                 stats_url:
 *                   type: string
 */
router.get(['/', ''], (req, res) => {
  const baseURL = getAPIUrl(req)
  res.json({
    api: 'v2',
    name: NAME,
    version: process.env.npm_package_version,
    description: process.env.npm_package_description,
    author: process.env.npm_package_author,
    keywords: process.env.npm_package_keywords,
    license: process.env.npm_package_license,
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
