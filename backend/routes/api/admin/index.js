const router = require('express').Router()
const debug = require('debug')('gdl-api:api:admin')
const { requireRole } = require('../../../utils/authUtils')
const { getHostUrl } = require('../../../utils/urlUtils')
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-cache')
  req.utils = {
    ...req.utils,
  }
  next()
})
try {
  debug('Mounting announcements route')
  router.use('/announcements', require('./announcements'))
} catch (error) {
  debug('Error initializing admin routes:', error)
}
const User = require('../../../models/User')
const Directory = require('../../../models/Directory')
const File = require('../../../models/File')
const uptimeStart = Date.now()
const { countActiveSessions } = require('../../../utils/authUtils')
router.get('/', requireRole('admin'), async (req, res) => {
  const baseURL = (await getHostUrl(req)) + '/api'
  if (!req.user || !req.user.roles.includes('admin')) {
    debug('Unauthorized access attempt')
    return res.status(401).json({
      message: 'Unauthorized',
      status: 401,
    })
  }
  try {
    const uptime = Math.floor(Date.now() - uptimeStart)
    const totalUsers = await User.countDocuments()
    const loggedInUsers = await countActiveSessions()
    // Top tags
    const topTags = []
    const fileStorage = await File.aggregate([
      { $group: { _id: null, total: { $sum: '$size' } } },
    ])
    const dirStorage = await Directory.aggregate([
      { $group: { _id: null, total: { $sum: '$size' } } },
    ])
    const storageUsage =
      (fileStorage[0]?.total || 0) + (dirStorage[0]?.total || 0)
    // Flags
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
      urls: {
        announcements: baseURL + '/admin/announcements',
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
  res.status(201).json({ success: true })
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
  res.status(204).send()
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
  res.status(201).json({ success: true })
})
router.put('/tags/:id', requireRole('admin'), (req, res) => {
  // TODO: update tag
  res.status(204).send()
})
router.delete('/tags/:id', requireRole('admin'), (req, res) => {
  // TODO: delete tag
  res.status(204).send()
})

// DMCA/takedown system
router.get('/dmca', requireRole('admin'), (req, res) => {
  // TODO: list takedown requests
  res.json([])
})
router.post('/dmca', requireRole('admin'), (req, res) => {
  // TODO: create takedown request
  res.status(201).json({ success: true })
})
router.put('/dmca/:id', requireRole('admin'), (req, res) => {
  // TODO: update takedown request
  res.status(204).send()
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
  res.status(201).json({ success: true })
})
module.exports = router
