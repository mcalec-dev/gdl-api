const router = require('express').Router()
const debug = require('debug')('gdl-api:api:admin:announcements')
const { requireRole } = require('../../../utils/authUtils')
const Announcement = require('../../../models/Announcement')
/**
 * @swagger
 * /api/admin/announcements:
 *   get:
 *     summary: Get all announcements
 */
router.get(['/', ''], requireRole('admin'), async (req, res) => {
  if (!req.user || !req.user.roles.includes('admin')) {
    debug('Unauthorized access attempt')
    return res.status(401).json({
      message: 'Unauthorized',
      status: 401,
    })
  }
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
/**
 * @swagger
 * /api/admin/announcements:
 *   post:
 *     summary: Create a new announcement
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               message:
 *                 type: string
 *               severity:
 *                 type: string
 *                 enum: [info, warning, error]
 */
router.post(['', '/'], requireRole('admin'), async (req, res) => {
  if (!req.user || !req.user.roles.includes('admin')) {
    debug('Unauthorized access attempt')
    return res.status(401).json({
      message: 'Unauthorized',
      status: 401,
    })
  }
  try {
    const uuid = require('uuid').v4()
    const { title, message, severity } = req.body
    if (!title) {
      return res.status(400).json({
        error: 'Bad Request',
        status: 400,
      })
    }
    const announcement = new Announcement({
      title,
      message,
      severity,
      author: req.user.username,
      created: Date.now(),
      modified: Date.now(),
      uuid,
    })
    await announcement.save()
    debug('Announcement created:', announcement)
    return res.json({ success: true, announcement })
  } catch (error) {
    debug('Error creating announcement:', error)
    return res.status(500).json({
      error: 'Internal Server Error',
      status: 500,
    })
  }
})
/**
 * @swagger
 * /api/admin/announcements/{id}:
 *   put:
 *     summary: Update an announcement
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               message:
 *                 type: string
 *               severity:
 *                 type: string
 *                 enum: [info, warning, error]
 */
router.put(['/:uuid', '/:uuid/'], requireRole('admin'), async (req, res) => {
  if (!req.user || !req.user.roles.includes('admin')) {
    debug('Unauthorized access attempt')
    return res.status(401).json({
      message: 'Unauthorized',
      status: 401,
    })
  }
  try {
    const { title, message, severity } = req.body
    if (!title) {
      return res.status(400).json({
        error: 'Bad Request',
        status: 400,
      })
    }
    const updatedAnnouncement = await Announcement.findOneAndUpdate(
      { uuid: { $eq: req.params.uuid } },
      {
        title,
        message,
        severity,
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
    return res.json({ success: true, announcement: updatedAnnouncement })
  } catch (error) {
    debug('Error updating announcement:', error)
    return res.status(500).json({
      error: 'Internal Server Error',
      status: 500,
    })
  }
})
/**
 * @swagger
 * /api/admin/announcements/{id}:
 *   delete:
 *     summary: Delete an announcement
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 */
router.delete(['/:uuid', '/:uuid/'], requireRole('admin'), async (req, res) => {
  if (!req.user || !req.user.roles.includes('admin')) {
    debug('Unauthorized access attempt')
    return res.status(401).json({
      message: 'Unauthorized',
      status: 401,
    })
  }
  try {
    const deletedAnnouncement = await Announcement.findOneAndDelete({
      uuid: req.params.uuid,
    })
    if (!deletedAnnouncement) {
      return res.status(404).json({
        error: 'Announcement not found',
        status: 404,
      })
    }
    debug('Announcement deleted:', deletedAnnouncement)
    return res.json({ success: true })
  } catch (error) {
    debug('Error deleting announcement:', error)
    return res.status(500).json({
      error: 'Internal Server Error',
      status: 500,
    })
  }
})
module.exports = router
