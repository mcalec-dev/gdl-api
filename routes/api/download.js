const router = require('express').Router()
const debug = require('debug')('gdl-api:api:download')
const { HOST } = require('../../config')
const { requireRole } = require('../../utils/authUtils')
const BLOCKED_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/,
  /^fe80:/,
]
async function isHostAllowed(hostname) {
  const cfgHost = await HOST
  if (!cfgHost || hostname.toLowerCase() !== cfgHost.toLowerCase()) {
    debug('Host mismatch:', { hostname, cfgHost })
    return false
  }
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(hostname)) {
      debug('Blocked hostname pattern match:', hostname)
      return false
    }
  }
  return true
}
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
  let parsedUrl
  try {
    parsedUrl = new URL(url)
  } catch (error) {
    debug('Malformed URL:', error.message)
    return res.status(400).json({
      message: 'Bad Request: Invalid URL format',
      status: 400,
    })
  }
  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
    debug('Invalid protocol:', parsedUrl.protocol)
    return res.status(400).json({
      message: 'Bad Request: Only HTTP/HTTPS protocols allowed',
      status: 400,
    })
  }
  if (!(await isHostAllowed(parsedUrl.hostname))) {
    debug('Host not allowed:', parsedUrl.hostname)
    return res.status(403).json({
      message: 'Forbidden',
      status: 403,
    })
  }
  try {
    parsedUrl.pathname = (parsedUrl.pathname || '/download')
      .replace(/\.\./g, '')
      .replace(/\/+/g, '/')
      .replace(/^\/+/, '/')
  } catch (error) {
    debug('Path validation failed:', error.message)
    return res.status(400).json({
      message: 'Bad Request: Invalid file path',
      status: 400,
    })
  }
  const cleanUrl = parsedUrl.toString()
  const https = require('https')
  const http = require('http')
  const protocol = parsedUrl.protocol === 'https:' ? https : http
  const request = protocol.get(cleanUrl, (fileRes) => {
    if (fileRes.statusCode !== 200) {
      debug('HTTP error:', fileRes.statusCode)
      return res.status(502).json({
        message: 'Bad Gateway: Unable to fetch file',
        status: 502,
      })
    }
    const filename = decodeURIComponent(
      (parsedUrl.pathname || '').split('/').pop() || 'download'
    ).replace(/[^a-zA-Z0-9.-]/g, '_')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader(
      'Content-Type',
      fileRes.headers['content-type'] || 'application/octet-stream'
    )
    fileRes.pipe(res)
  })
  request.on('timeout', () => {
    debug('Request timeout')
    request.destroy()
    return res.status(408).json({
      message: 'Request Timeout',
      status: 408,
    })
  })
  request.on('error', (error) => {
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
 *     summary: Download file from allowed hosts only
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
module.exports = router
