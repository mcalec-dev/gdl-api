const router = require('express').Router()
const { requireRole } = require('../../utils/authUtils')
const File = require('../../models/File')
const Directory = require('../../models/Directory')
const debug = require('debug')('gdl-api:api:uuid')
router.get(
  ['/:uuid/:type', '/:uuid/:type/'],
  requireRole('user'),
  async (req, res) => {
    const { uuid, type } = req.params
    if (!uuid || typeof uuid !== 'string') {
      debug('Invalid UUID parameter:', uuid)
      return res.status(400).json({
        message: 'Bad Request',
        status: 400,
      })
    }
    if (!type || typeof type !== 'string') {
      debug('Invalid type parameter:', type)
      return res.status(400).json({
        message: 'Bad Request',
        status: 400,
      })
    }
    try {
      const directoryEntry = await Directory.findOne({ uuid: { $eq: uuid } })
      const fileEntry = await File.findOne({ uuid: { $eq: uuid } })
      if (type === 'file') {
        if (!fileEntry) {
          debug('File not found for UUID:', uuid)
          return res.status(404).json({
            message: 'Not Found',
            status: 404,
          })
        }
        return res.json(fileEntry)
      } else if (type === 'directory') {
        if (!directoryEntry) {
          debug('Directory not found for UUID:', uuid)
          return res.status(404).json({
            message: 'Not Found',
            status: 404,
          })
        }
        return res.json(directoryEntry)
      } else {
        debug('Invalid type parameter value:', type)
        return res.status(400).json({
          message: 'Bad Request',
          status: 400,
        })
      }
    } catch (error) {
      debug('Error retrieving file by UUID:', error)
      return res.status(500).json({
        message: 'Internal Server Error',
        status: 500,
      })
    }
  }
)
module.exports = router
