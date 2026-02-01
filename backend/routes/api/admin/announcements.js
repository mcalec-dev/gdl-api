const router = require('express').Router()
const debug = require('debug')('gdl-api:api:admin:announcements')
const { requireRole } = require('../../../utils/authUtils')
const Announcement = require('../../../models/Announcement')
router.get('/', requireRole('admin'), async (req, res) => {
  try {
    const announcements = await Announcement.find().sort({ created: -1 }).lean()
    return res.json(announcements)
  } catch (error) {
    debug('Error fetching announcements:', error)
    return res.status(500).json({
      error: 'Internal Server Error',
      status: 500,
    })
  }
})
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const uuid = require('uuid').v4()
    const { title, message, severity } = req.body
    if (!title) {
      return res.status(400).json({
        error: 'Bad Request',
        status: 400,
      })
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
    debug('Announcement created:', createdAnncouncement)
    return res.status(201).json({
      success: true,
      createdAnncouncement,
    })
  } catch (error) {
    debug('Error creating announcement:', error)
    return res.status(500).json({
      error: 'Internal Server Error',
      status: 500,
    })
  }
})
router.put(['/:uuid', '/:uuid/'], requireRole('admin'), async (req, res) => {
  const { uuid } = req.params
  const { title, message, severity } = req.body
  if (!uuid || typeof uuid !== 'string') {
    debug('Invalid UUID parameter:', uuid)
    return res.status(400).json({
      error: 'Bad Request',
      status: 400,
    })
  }
  if (!severity) {
    return res.status(400).json({
      error: 'Bad Request',
      status: 400,
    })
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
      { new: true }
    )
    if (!updatedAnnouncement) {
      return res.status(404).json({
        error: 'Announcement not found',
        status: 404,
      })
    }
    debug('Announcement updated:', updatedAnnouncement)
    return res.status(204).send()
  } catch (error) {
    debug('Error updating announcement:', error)
    return res.status(500).json({
      error: 'Internal Server Error',
      status: 500,
    })
  }
})
router.delete(['/:uuid', '/:uuid/'], requireRole('admin'), async (req, res) => {
  const { uuid } = req.params
  if (!uuid || typeof uuid !== 'string') {
    debug('Invalid UUID parameter:', uuid)
    return res.status(400).json({
      error: 'Bad Request',
      status: 400,
    })
  }
  if (!req.user || !req.user.roles.includes('admin')) {
    debug('Unauthorized access attempt')
    return res.status(401).json({
      message: 'Unauthorized',
      status: 401,
    })
  }
  try {
    const deletedAnnouncement = await Announcement.findOneAndDelete({
      uuid: { $eq: req.params.uuid },
    })
    if (!deletedAnnouncement) {
      return res.status(404).json({
        error: 'Announcement not found',
        status: 404,
      })
    }
    debug('Announcement deleted:', deletedAnnouncement)
    return res.status(204).send()
  } catch (error) {
    debug('Error deleting announcement:', error)
    return res.status(500).json({
      error: 'Internal Server Error',
      status: 500,
    })
  }
})
module.exports = router
