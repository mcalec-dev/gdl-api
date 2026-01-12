const router = require('express').Router()
const debug = require('debug')('gdl-api:api:download')
const { requireRole } = require('../../utils/authUtils')
const File = require('../../models/File')
const fs = require('fs').promises
async function handleDownload(req, res) {
  let uuid = req.query.uuid || req.body?.uuid
  if (!uuid) {
    debug('Missing uuid parameter')
    return res.status(400).json({
      message: 'Bad Request: Missing uuid parameter',
      status: 400,
    })
  }
  uuid = uuid.trim()
  try {
    const file = await File.findOne({ uuid }).lean()
    if (!file) {
      debug('File not found for uuid:', uuid)
      return res.status(404).json({
        message: 'Not Found: File not found',
        status: 404,
      })
    }
    const filename = decodeURIComponent(
      (file.name || '').replace(/[^a-zA-Z0-9.-]/g, '_')
    )
    const filePath = file.paths.local
    try {
      await fs.access(filePath)
    } catch (error) {
      debug('File not accessible:', filePath, error)
      return res.status(404).json({
        message: 'Not Found: File not accessible',
        status: 404,
      })
    }
    const stat = await fs.stat(filePath)
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Type', file.mime || 'application/octet-stream')
    res.setHeader('Content-Length', stat.size)
    const fileStream = require('fs').createReadStream(filePath)
    fileStream.pipe(res)
    fileStream.on('error', (error) => {
      debug('File streaming error:', error)
      if (!res.headersSent) {
        return res.status(500).json({
          message: 'Internal Server Error',
          status: 500,
        })
      }
    })
  } catch (error) {
    debug('Download error:', error)
    return res.status(500).json({
      message: 'Internal Server Error',
      status: 500,
    })
  }
}
/**
 * @swagger
 * /api/download/:
 *   get:
 *     summary: Download a file using its UUID
 *     description: Downloads a file from the server using the provided UUID. Supports both GET and POST methods.
 *     parameters:
 *       - in: query
 *         name: uuid
 *         required: true
 *         schema:
 *           type: string
 *         description: The UUID of the file to download
 *     responses:
 *       200:
 *         description: File content as binary data
 *       400:
 *         description: Missing or invalid uuid parameter
 *       404:
 *         description: File not found or not accessible
 *       500:
 *         description: Internal server error
 *   post:
 *     summary: Download a file using its UUID (POST method)
 *     description: Downloads a file from the server using the provided UUID via POST body.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               uuid:
 *                 type: string
 *                 description: The UUID of the file to download
 *             required:
 *               - uuid
 *     responses:
 *       200:
 *         description: File content as binary data
 *       400:
 *         description: Missing or invalid uuid parameter
 *       404:
 *         description: File not found or not accessible
 *       500:
 *         description: Internal server error
 */
router.get(['/', ''], requireRole('user'), async (req, res) => {
  await handleDownload(req, res)
})
router.post(['/', ''], requireRole('user'), async (req, res) => {
  await handleDownload(req, res)
})
module.exports = router
