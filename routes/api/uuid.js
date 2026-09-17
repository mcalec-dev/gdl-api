const router = require('express').Router()
const { requireRole } = require('../../utils/authUtils')
const File = require('../../models/File')
const Directory = require('../../models/Directory')
const log = require('../../utils/logHandler')
const sendResponse = require('../../utils/resUtils')
const cache = require('../../utils/cache')
const { cacheControl } = require('../../utils/cacheControl')
const { checkETag } = require('../../utils/etag')

router.get(
  ['/:uuid/:type', '/:uuid/:type/'],
  requireRole('user'),
  cacheControl('privateMedium'),
  async (req, res) => {
    const { uuid, type } = req.params
    if (!uuid || typeof uuid !== 'string') {
      log.debug('Invalid UUID parameter:', uuid)
      return sendResponse.error(res, 400, 'Invalid UUID parameter')
    }
    if (!type || typeof type !== 'string') {
      log.debug('Invalid type parameter:', type)
      return sendResponse.error(res, 400, 'Invalid type parameter')
    }
    try {
      const entry = await cache.wrap(`uuid:${uuid}:${type}`, 300, async () => {
        const directoryEntry = await Directory.findOne({
          uuid: { $eq: uuid },
        }).lean()
        const fileEntry = await File.findOne({ uuid: { $eq: uuid } }).lean()
        if (type === 'file')
          return fileEntry ? { kind: 'file', data: fileEntry } : null
        if (type === 'directory')
          return directoryEntry
            ? { kind: 'directory', data: directoryEntry }
            : null
        return null
      })
      if (type === 'file') {
        if (!entry) {
          log.debug('File not found for UUID:', uuid)
          return sendResponse.error(res, 404, 'File not found')
        }
        if (checkETag(req, res, entry.data.hash)) return
        return sendResponse(res, 200).json(entry.data)
      } else if (type === 'directory') {
        if (!entry) {
          log.debug('Directory not found for UUID:', uuid)
          return sendResponse.error(res, 404, 'Directory not found')
        }
        if (checkETag(req, res, entry.data.modified)) return
        return sendResponse(res, 200).json(entry.data)
      } else {
        log.debug('Invalid type parameter value:', type)
        return sendResponse.error(res, 400, 'Invalid type parameter value')
      }
    } catch (error) {
      log.error('Error retrieving file by UUID:', error)
      return sendResponse.error(res, 500, 'Internal Server Error')
    }
  },
)

module.exports = router
