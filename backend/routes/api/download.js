const router = require('express').Router()
const log = require('../../utils/logHandler')
const { requireRole } = require('../../utils/authUtils')
const File = require('../../models/File')
const fs = require('fs').promises
const sendResponse = require('../../utils/resUtils')
async function handleDownload(req, res) {
  let uuid = req.query.uuid || req.body?.uuid
  if (!uuid) {
    log.debug('Missing uuid parameter')
    return sendResponse(res, 400, 'Missing uuid parameter')
  }
  uuid = uuid.trim()
  try {
    const file = await File.findOne({ uuid }).lean()
    if (!file) {
      log.debug('File not found for uuid:', uuid)
      return sendResponse(res, 404)
    }
    const filename = decodeURIComponent(
      (file.name || '').replace(/[^a-zA-Z0-9.-]/g, '_')
    )
    const filePath = file.paths.local
    try {
      await fs.access(filePath)
    } catch (error) {
      log.error('File not accessible:', filePath, error)
      return sendResponse(res, 404)
    }
    const stat = await fs.stat(filePath)
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Type', file.mime || 'application/octet-stream')
    res.setHeader('Content-Length', stat.size)
    const fileStream = require('fs').createReadStream(filePath)
    fileStream.pipe(res)
    fileStream.on('error', (error) => {
      log.error('File streaming error:', error)
      if (!res.headersSent) {
        return sendResponse(res, 500)
      }
    })
  } catch (error) {
    log.error('Download error:', error)
    return sendResponse(res, 500)
  }
}
router.get('/', requireRole('user'), async (req, res) => {
  await handleDownload(req, res)
})
router.post('/', requireRole('user'), async (req, res) => {
  await handleDownload(req, res)
})
module.exports = router
