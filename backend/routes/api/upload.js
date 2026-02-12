const express = require('express')
const multer = require('multer')
const { uploadFile } = require('../../utils/gridfsUtils')
const { requireRole } = require('../../utils/authUtils')
const { FILE_UPLOAD_LIMIT } = require('../../config')
const router = express.Router()
const debug = require('debug')('gdl-api:upload')
const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: {
    fileSize: FILE_UPLOAD_LIMIT,
  },
})
router.post(
  '',
  requireRole('user'),
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded',
        })
      }
      const fileId = await uploadFile(req.file.buffer, req.file.originalname, {
        contentType: req.file.mimetype,
      })
      debug(`File uploaded: ${req.file.originalname} (ID: ${fileId})`)
      res.status(201).json({
        success: true,
        fileId: fileId.toString(),
        filename: req.file.originalname,
        size: req.file.size,
        uploadDate: new Date(),
      })
    } catch (error) {
      debug('Upload error:', error)
      res.status(500).json({
        success: false,
        error: 'File upload failed',
        details: error.message,
      })
    }
  }
)
module.exports = router
