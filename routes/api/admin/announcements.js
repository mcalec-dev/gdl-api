const express = require('express')
const router = express.Router()
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
  if (!req.user || !req.user.isAuthenticated() || !req.user.hasRole('admin')) {
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
  if (!req.user) {
    debug('Unauthorized access attempt')
    return res.status(401).json({
      message: 'Unauthorized',
      status: 401,
    })
  }
  if (!req.user.roles.includes('admin')) {
    debug('Unauthorized access attempt')
    return res.status(403).json({
      message: 'Forbidden',
      status: 403,
    })
  }
  try {
    const { title, message, severity } = req.body
    if (!message) {
      return res.status(400).json({
        error: 'Message required',
        status: 400,
      })
    }
    const announcement = new Announcement({
      title,
      message,
      severity,
      createdBy: req.user.username,
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
router.put(['/:id', '/:id/'], requireRole('admin'), async (req, res) => {
  if (!req.user) {
    debug('Unauthorized access attempt')
    return res.status(401).json({
      message: 'Unauthorized',
      status: 401,
    })
  }
  if (!req.user.roles.includes('admin')) {
    debug('Unauthorized access attempt')
    return res.status(403).json({
      message: 'Forbidden',
      status: 403,
    })
  }
  try {
    const { title, message, severity } = req.body
    if (!message) {
      return res.status(400).json({
        error: 'Message required',
        status: 400,
      })
    }
    const updatedAnnouncement = await Announcement.findByIdAndUpdate(
      req.params.id,
      {
        title,
        message,
        severity,
        updatedBy: req.user.username,
        updatedAt: new Date(),
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
router.delete(['/:id', '/:id/'], requireRole('admin'), async (req, res) => {
  if (!req.user) {
    debug('Unauthorized access attempt')
    return res.status(401).json({
      message: 'Unauthorized',
      status: 401,
    })
  }
  if (!req.user.roles.includes('admin')) {
    debug('Unauthorized access attempt')
    return res.status(403).json({
      message: 'Forbidden',
      status: 403,
    })
  }
  try {
    const deletedAnnouncement = await Announcement.findByIdAndDelete(
      req.params.id
    )
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
