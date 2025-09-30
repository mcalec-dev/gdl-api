// only supports uuids for now
// full uuid search soon
const router = require('express').Router()
const { requireRole } = require('../../utils/authUtils')
const File = require('../../models/File')
const debug = require('debug')('gdl-api:api:uuid')
router.get(['/:uuid', '/:uuid/'], requireRole('user'), async (req, res) => {
  const { uuid } = req.params
  if (!uuid || typeof uuid !== 'string') {
    debug('Invalid UUID parameter:', uuid)
    return res.status(400).json({
      message: 'Bad Request',
      status: 400,
    })
  }
  try {
    let fileEntry = await File.findOne({ uuid: uuid })
    if (!fileEntry) {
      debug('File not found for UUID:', uuid)
      return res.status(404).json({
        message: 'Not Found',
        status: 404,
      })
    }
    return res.json({
      file: fileEntry,
    })
  } catch (error) {
    debug('Error retrieving file by UUID:', error)
    return res.status(500).json({
      message: 'Internal Server Error',
      status: 500,
    })
  }
})
module.exports = router
