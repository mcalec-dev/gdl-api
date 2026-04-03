const router = require('express').Router()
const log = require('../../../utils/logHandler')
const { requireRole } = require('../../../utils/authUtils')
const Announcement = require('../../../models/Announcement')
const sendResponse = require('../../../utils/resUtils')
router.get('/', requireRole('admin'), async (req, res) => {
  try {
    const announcements = await Announcement.find().sort({ created: -1 }).lean()
    return res.json(announcements)
  } catch (error) {
    log.error('Error fetching announcements:', error)
    return sendResponse(res, 500)
  }
})
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const uuid = require('uuid').v4()
    const { title, message, severity } = req.body
    if (!title) {
      return sendResponse(res, 400, 'Title is required')
    }
    const createdAnncouncement = new Announcement({
      title,
      message,
      severity,
      author: req.user.username,
      created: Date.now(),
      modified: Date.now(),
      uuid,
    })
    await createdAnncouncement.save()
    log.debug('Announcement created:', createdAnncouncement)
    return sendResponse(res, 201, 'Announcement created successfully')
  } catch (error) {
    log.error('Error creating announcement:', error)
    return sendResponse(res, 500, 'Internal Server Error')
  }
})
router.put(['/:uuid', '/:uuid/'], requireRole('admin'), async (req, res) => {
  const { uuid } = req.params
  const { title, message, severity } = req.body
  if (!uuid || typeof uuid !== 'string') {
    log.debug('Invalid UUID parameter:', uuid)
    return sendResponse(res, 400, 'Invalid UUID parameter')
  }
  if (!severity) {
    log.debug('Severity not provided')
    return sendResponse(res, 400, 'Severity is required')
  }
  try {
    const updatedAnnouncement = await Announcement.findOneAndUpdate(
      { uuid: { $eq: req.params.uuid } },
      {
        title: String(title),
        message: String(message),
        severity: String(severity),
        author: req.user.username,
        modified: Date.now(),
      },
      { returnDocument: 'after' }
    )
    if (!updatedAnnouncement) {
      return sendResponse(res, 404, 'Announcement not found')
    }
    log.debug('Announcement updated:', updatedAnnouncement)
    return sendResponse(res, 204, 'Announcement updated successfully')
  } catch (error) {
    log.error('Error updating announcement:', error)
    return sendResponse(res, 500)
  }
})
router.delete(['/:uuid', '/:uuid/'], requireRole('admin'), async (req, res) => {
  const { uuid } = req.params
  if (!uuid || typeof uuid !== 'string') {
    log.debug('Invalid UUID parameter:', uuid)
    return sendResponse(res, 400, 'Invalid UUID parameter')
  }
  if (!req.user || !req.user.roles.includes('admin')) {
    log.debug('Unauthorized access attempt')
    return sendResponse(res, 401)
  }
  try {
    const deletedAnnouncement = await Announcement.findOneAndDelete({
      uuid: { $eq: req.params.uuid },
    })
    if (!deletedAnnouncement) {
      log.debug('Announcement not found for deletion:', uuid)
      return sendResponse(res, 404)
    }
    log.debug('Announcement deleted:', deletedAnnouncement)
    return sendResponse(res, 204, 'Announcement deleted successfully')
  } catch (error) {
    log.error('Error deleting announcement:', error)
    return sendResponse(res, 500)
  }
})
module.exports = router
