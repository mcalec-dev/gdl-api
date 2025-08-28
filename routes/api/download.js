const express = require('express')
const router = express.Router()
const debug = require('debug')('gdl-api:api:download')
const { HOST } = require('../../config')
const { requireRole } = require('../../utils/authUtils')
async function handleDownload(req, res) {
  let url = req.query.url || req.body?.url
  if (!url) {
    debug('Missing url parameter')
    return res.status(400).json({
      message: 'Bad Request',
      status: 400,
    })
  }
  url = url.trim()
  if (
    (url.startsWith('"') && url.endsWith('"')) ||
    (url.startsWith("'") && url.endsWith("'"))
  ) {
    url = url.slice(1, -1)
  }
  let allowedHosts = []
  const outHost = await HOST
  allowedHosts.push(outHost)
  let parsedUrl
  try {
    parsedUrl = new URL(url)
  } catch (error) {
    debug('Malformed URL:', error.message)
    return res.status(400).json({
      message: 'Bad Request',
      status: 400,
    })
  }
  if (!allowedHosts) {
    debug('Host not allowed:', req.hostname)
    return res.status(403).json({
      message: 'Forbidden',
      status: 403,
    })
  }
  const https = require('https')
  const http = require('http')
  const protocol = parsedUrl.protocol === 'https:' ? https : http
  protocol
    .get(url, (fileRes) => {
      const filename = decodeURIComponent(
        (parsedUrl.pathname || '').split('/').pop() || 'download'
      )
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      res.setHeader(
        'Content-Type',
        fileRes.headers['content-type'] || 'application/octet-stream'
      )
      fileRes.pipe(res)
    })
    .on('error', (error) => {
      debug('Download error:', error)
      return res.status(500).json({
        message: 'Internal Server Error',
        status: 500,
      })
    })
}
/**
 * @swagger
 * /api/download/:
 *   get:
 *     summary: Download file
 *     parameters:
 *       - in: query
 *         name: url
 *         required: true
 *         schema:
 *           type: string
 */
router.get(['/', ''], requireRole('user'), async (req, res) => {
  if (!req.user) {
    debug('Unauthorized access attempt')
    return res.status(401).json({
      message: 'Unauthorized',
      status: 401,
    })
  }
  await handleDownload(req, res)
})
/**
 * @swagger
 * /api/download/:
 *   post:
 *     summary: Download file
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               q:
 *                 type: string
 *     responses:
 *       200:
 *         description: File downloaded successfully
 */
router.post(
  ['/', ''],
  express.json(),
  requireRole('user'),
  async (req, res) => {
    if (!req.user) {
      debug('Unauthorized access attempt')
      return res.status(401).json({
        message: 'Unauthorized',
        status: 401,
      })
    }
    await handleDownload(req, res)
  }
)
module.exports = router
