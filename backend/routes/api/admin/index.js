const router = require('express').Router()
const log = require('../../../utils/logHandler')
const { requireRole } = require('../../../utils/authUtils')
const { getHostUrl } = require('../../../utils/urlUtils')
const sendResponse = require('../../../utils/resUtils')
try {
  log.debug('Mounting announcements route')
  router.use('/announcements', require('./announcements'))
} catch (error) {
  log.error('Error initializing admin routes:', error)
}
const User = require('../../../models/User')
const Directory = require('../../../models/Directory')
const File = require('../../../models/File')
const uptimeStart = Date.now()
const { countActiveSessions } = require('../../../utils/authUtils')
router.get('/', requireRole('admin'), async (req, res) => {
  const baseURL = (await getHostUrl(req)) + '/api'
  if (!req.user || !req.user.roles.includes('admin')) {
    log.debug('Unauthorized access attempt to admin dashboard')
    return sendResponse(res, 401)
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
    log.error('Error loading admin dashboard:', error)
    return sendResponse(res, 500)
  }
})
// User actions: ban, mute, suspend, IP actions
router.post('/user/:id/action', requireRole('admin'), (req, res) => {
  // { action: 'ban'|'mute'|'suspend', ip: optional }
  return sendResponse(res, 501, 'User actions not implemented yet')
})
// User management: view, edit, role change, reset password/email/username
router.get('/users', requireRole('admin'), (req, res) => {
  // TODO: list users
  return sendResponse(res, 501, 'User listing not implemented yet')
})
router.get('/user/:id', requireRole('admin'), (req, res) => {
  // TODO: get user info
  return sendResponse(res, 501, 'Get user info not implemented yet')
})
router.put('/user/:id', requireRole('admin'), (req, res) => {
  // TODO: update user info
  return sendResponse(res, 501, 'Update user info not implemented yet')
})
// Role permissions management
router.get('/roles', requireRole('admin'), (req, res) => {
  return sendResponse(res, 200, [
    'admin',
    'moderator',
    'user',
    'visitor',
    'banned',
  ])
})
// Tag management
router.get(['/tags', '/tags/'], requireRole('admin'), (req, res) => {
  // TODO: list tags
  return sendResponse(res, 501, 'Tag listing not implemented yet')
})
router.post('/tags/:id', requireRole('admin'), (req, res) => {
  // TODO: create tag
  return sendResponse(res, 201, 'Tag created successfully')
})
router.put('/tags/:id', requireRole('admin'), (req, res) => {
  // TODO: update tag
  return sendResponse(res, 501, 'Tag update not implemented yet')
})
router.delete('/tags/:id', requireRole('admin'), (req, res) => {
  // TODO: delete tag
  return sendResponse(res, 501, 'Tag deletion not implemented yet')
})
// DMCA/takedown system
router.get('/dmca', requireRole('admin'), (req, res) => {
  // TODO: list takedown requests
  return sendResponse(res, 501, 'DMCA/takedown listing not implemented yet')
})
router.post('/dmca', requireRole('admin'), (req, res) => {
  // TODO: create takedown request
  return sendResponse(res, 201, 'Takedown request created successfully')
})
router.put('/dmca/:id', requireRole('admin'), (req, res) => {
  // TODO: update takedown request
  return sendResponse(res, 501, 'Takedown request update not implemented yet')
})
// File duplicate checks
router.get('/file/duplicates', requireRole('admin'), (req, res) => {
  // TODO: check for duplicate files
  return sendResponse(res, 501, 'File duplicate check not implemented yet')
})
// Filename/URI checks
router.get('/file/uri-check', requireRole('admin'), (req, res) => {
  // TODO: check file URIs
  return sendResponse(res, 501, 'File URI check not implemented yet')
})
// Cache tools
router.post('/cache/purge', requireRole('admin'), (req, res) => {
  // TODO: purge caches
  return sendResponse(res, 201, 'Cache purged successfully')
})
module.exports = router
