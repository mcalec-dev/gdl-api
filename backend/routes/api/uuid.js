const router = require('express').Router()
const { requireRole } = require('../../utils/authUtils')
const File = require('../../models/File')
const Directory = require('../../models/Directory')
const log = require('../../utils/logHandler')
const sendResponse = require('../../utils/resUtils')
router.get(
  ['/:uuid/:type', '/:uuid/:type/'],
  requireRole('user'),
  async (req, res) => {
    const { uuid, type } = req.params
    if (!uuid || typeof uuid !== 'string') {
      log.debug('Invalid UUID parameter:', uuid)
      return sendResponse(res, 400, 'Invalid UUID parameter')
    }
    if (!type || typeof type !== 'string') {
      log.debug('Invalid type parameter:', type)
      return sendResponse(res, 400, 'Invalid type parameter')
    }
    try {
      const directoryEntry = await Directory.findOne({ uuid: { $eq: uuid } })
      const fileEntry = await File.findOne({ uuid: { $eq: uuid } })
      if (type === 'file') {
        if (!fileEntry) {
          log.debug('File not found for UUID:', uuid)
          return sendResponse(res, 404)
        }
        return res.json(fileEntry)
      } else if (type === 'directory') {
        if (!directoryEntry) {
          log.debug('Directory not found for UUID:', uuid)
          return sendResponse(res, 404)
        }
        return res.json(directoryEntry)
      } else {
        log.debug('Invalid type parameter value:', type)
        return sendResponse(res, 400, 'Invalid type parameter value')
      }
    } catch (error) {
      log.error('Error retrieving file by UUID:', error)
      return sendResponse(res, 500)
    }
  }
)
module.exports = router
