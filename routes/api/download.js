const express = require('express')
const router = express.Router()
const debug = require('debug')('gdl-api:api:download')
const { HOST } = require('../../config')
async function handleDownload(req, res) {
  let q = req.query.q || req.body?.q
  if (!q) {
    debug('Missing ?q parameter')
    return res.status(400).json({
      message: 'Bad Request',
      status: 400,
    })
  }
  q = q.trim()
  if (
    (q.startsWith('"') && q.endsWith('"')) ||
    (q.startsWith("'") && q.endsWith("'"))
  ) {
    q = q.slice(1, -1)
  }
  let allowedHosts = []
  const outHost = await HOST
  allowedHosts.push(outHost.replace(/^https?:\/\//, '').replace(/\/$/, ''))
  let parsedUrl
  try {
    parsedUrl = new URL(q)
  } catch (error) {
    debug('Malformed URL:', error.message)
    return res.status(400).json({
      message: 'Bad Request',
      status: 400,
    })
  }
  const urlHostParam = parsedUrl.hostname.toLowerCase()
  const notAllowedHosts = !allowedHosts.some(
    (h) =>
      urlHostParam === h.replace(/:.*/, '') ||
      urlHostParam === 'www.' + h.replace(/:.*/, '')
  )
  if (notAllowedHosts) {
    debug('Host not allowed:', notAllowedHosts)
    return res.status(403).json({
      message: 'Forbidden',
      status: 403,
    })
  }
  const https = require('https')
  const http = require('http')
  const protocol = parsedUrl.protocol === 'https:' ? https : http
  protocol
    .get(q, (fileRes) => {
      if (fileRes.statusCode !== 200) {
        return res.status(404).json({
          message: 'Not Found',
          status: 404,
        })
      }
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
    .on('error', (err) => {
      debug('Download error:', err)
      return res.status(404).json({
        message: 'Not Found',
        status: 404,
      })
    })
}
router.get('/', handleDownload)
router.post('/', express.json(), handleDownload)
module.exports = router
