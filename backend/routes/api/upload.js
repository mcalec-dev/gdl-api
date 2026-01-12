const express = require('express')
const multer = require('multer')
const bytes = require('bytes')
const { uploadFile } = require('../../utils/gridfsUtils')
const { requireRole } = require('../../utils/authUtils')
const { FILE_UPLOAD_LIMIT } = require('../../config')
const router = express.Router()
const debug = require('debug')('gdl-api:upload')
const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: {
    fileSize: bytes(FILE_UPLOAD_LIMIT),
  },
})
/**
 * @swagger
 * /api/upload/:
 *   post:
 *     summary: Upload a file to the server
 *     description: Upload a single file to GridFS storage with size limits
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: The file to upload
 *             required:
 *               - file
 *     responses:
 *       201:
 *         description: File uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 fileId:
 *                   type: string
 *                   description: The GridFS file ID
 *                 filename:
 *                   type: string
 *                 size:
 *                   type: number
 *                 uploadDate:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: No file provided or file too large
 *       500:
 *         description: File upload failed
 */
router.post(
  ['/', ''],
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
