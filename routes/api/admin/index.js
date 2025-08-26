const express = require('express')
const router = express.Router()
const debug = require('debug')('gdl-api:api:auth:admin')
const { requireRole } = require('../../../utils/authUtils')
const Announcement = require('../../../models/Announcement')
router.use((req, res, next) => {
  req.utils = {
    ...req.utils,
  }
  next()
})
const User = require('../../../models/User')
const Directory = require('../../../models/Directory')
const Image = require('../../../models/Image')
const Video = require('../../../models/Video')
const uptimeStart = Date.now()
const { countActiveSessions } = require('../../../utils/authUtils')
/**
 * @swagger
 * /api/admin/stats:
 *   get:
 *     summary: Get admin statistics
 */
router.get(['/', ''], requireRole('admin'), async (req, res) => {
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
    const uptime = Math.floor((Date.now() - uptimeStart) / 1000)
    const totalUsers = await User.countDocuments()
    const loggedInUsers = await countActiveSessions()
    // Top tags (stub, implement real tag logic if tags exist)
    const topTags = []
    const imageStorage = await Image.aggregate([
      { $group: { _id: null, total: { $sum: '$size' } } },
    ])
    const videoStorage = await Video.aggregate([
      { $group: { _id: null, total: { $sum: '$size' } } },
    ])
    const dirStorage = await Directory.aggregate([
      { $group: { _id: null, total: { $sum: '$size' } } },
    ])
    const storageUsage =
      (imageStorage[0]?.total || 0) +
      (videoStorage[0]?.total || 0) +
      (dirStorage[0]?.total || 0)
    // Flags (stub, implement real flag logic if exists)
    const flags = 0
    return res.json({
      stats: {
        uptime,
        totalUsers,
        loggedInUsers,
        topTags,
        storageUsage,
        flags,
      },
    })
  } catch (error) {
    debug('Error loading admin dashboard:', error)
    return res.status(500).json({
      message: 'Internal Server Error',
      status: 500,
    })
  }
})

// User actions: ban, mute, suspend, IP actions
router.post('/user/:id/action', requireRole('admin'), (req, res) => {
  // { action: 'ban'|'mute'|'suspend', ip: optional }
  res.json({ success: true })
})

// User management: view, edit, role change, reset password/email/username
router.get('/users', requireRole('admin'), (req, res) => {
  // TODO: list users
  res.json([])
})
router.get('/user/:id', requireRole('admin'), (req, res) => {
  // TODO: get user info
  res.json({})
})
router.put('/user/:id', requireRole('admin'), (req, res) => {
  // TODO: update user info
  res.json({ success: true })
})

// Role permissions management
router.get('/roles', requireRole('admin'), (req, res) => {
  res.json(['admin', 'moderator', 'user', 'visitor', 'banned'])
})

// Tag management
router.get(['/tags', '/tags/'], requireRole('admin'), (req, res) => {
  // TODO: list tags
  res.json([])
})
router.post('/tags/:id', requireRole('admin'), (req, res) => {
  // TODO: create tag
  res.json({ success: true })
})
router.put('/tags/:id', requireRole('admin'), (req, res) => {
  // TODO: update tag
  res.json({ success: true })
})
router.delete('/tags/:id', requireRole('admin'), (req, res) => {
  // TODO: delete tag
  res.json({ success: true })
})

// DMCA/takedown system
router.get('/dmca', requireRole('admin'), (req, res) => {
  // TODO: list takedown requests
  res.json([])
})
router.post('/dmca', requireRole('admin'), (req, res) => {
  // TODO: create takedown request
  res.json({ success: true })
})
router.put('/dmca/:id', requireRole('admin'), (req, res) => {
  // TODO: update takedown request
  res.json({ success: true })
})

// File duplicate checks
router.get('/file/duplicates', requireRole('admin'), (req, res) => {
  // TODO: check for duplicate files
  res.json([])
})

// Filename/URI checks
router.get('/file/uri-check', requireRole('admin'), (req, res) => {
  // TODO: check file URIs
  res.json([])
})

// Cache tools
router.post('/cache/purge', requireRole('admin'), (req, res) => {
  // TODO: purge caches
  res.json({ success: true })
})
/**
 * @swagger
 * /api/admin/announcements:
 *   get:
 *     summary: Get all announcements
 */
router.get(
  ['/announcements', '/announcements/'],
  requireRole('admin'),
  async (req, res) => {
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
      const announcements = await Announcement.find()
        .sort({ created: -1 })
        .lean()
      return res.json(announcements)
    } catch (error) {
      debug('Error fetching announcements:', error)
      return res.status(500).json({
        error: 'Internal Server Error',
        status: 500,
      })
    }
  }
)
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
router.post(
  ['/announcements', '/announcements/'],
  requireRole('admin'),
  async (req, res) => {
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
  }
)
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
router.put(
  ['/announcements/:id', '/announcements/:id/'],
  requireRole('admin'),
  async (req, res) => {
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
  }
)
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
router.delete(
  ['/announcements/:id', '/announcements/:id/'],
  requireRole('admin'),
  async (req, res) => {
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
  }
)
module.exports = router
