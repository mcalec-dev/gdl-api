const express = require('express')
const router = express.Router()
const { getAPIUrl } = require('../../utils/urlUtils')
const { NAME, BASE_PATH } = require('../../config')
require('dotenv').config()
const debug = require('debug')('gdl-api:api:routes')
const pathUtils = require('../../utils/pathUtils')
const authRouter = require('./auth')
const downloadRouter = require('./download')
const filesRouter = require('./files')
const randomRouter = require('./random')
const searchRouter = require('./search')
const statsRouter = require('./stats')
debug('Initializing API routes')
router.use((req, res, next) => {
  req.utils = {
    ...req.utils,
    pathUtils,
  }
  next()
})
debug('Mounting auth routes')
router.use('/auth', authRouter)
debug('Mounting files routes')
router.use('/files', filesRouter)
debug('Mounting download routes')
router.use('/download', downloadRouter)
debug('Mounting random routes')
router.use('/random', randomRouter)
debug('Mounting search routes')
router.use('/search', searchRouter)
debug('Mounting stats routes')
router.use('/stats', statsRouter)
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
router.get('/', (req, res) => {
  debug('Handling request for API root')
  const baseURL = getAPIUrl(req)
  debug(`Base URL for API: ${baseURL}`)
  res.json({
    api: 'v2',
    name: NAME,
    version: process.env.npm_package_version,
    description: process.env.npm_package_description,
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
debug('All routes mounted successfully')
module.exports = router
