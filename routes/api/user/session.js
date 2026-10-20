const router = require('express').Router()
const log = require('../../../utils/logHandler')
const User = require('../../../models/User')
const { requireRole } = require('../../../utils/authUtils')
const sendResponse = require('../../../utils/resUtils')
const { cacheControl } = require('../../../utils/cacheControl')

router.get(
  '/',
  cacheControl('noStore'),
  requireRole('user'),
  async (req, res) => {
    try {
      const user = /** @type {any} */ (req.user)
      const record = await User.collection.findOne(
        { uuid: user.uuid },
        { projection: { sessions: 1 } },
      )
      if (!record) {
        return sendResponse.error(res, 404, 'User not found')
      }
      return res.status(200).json(record.sessions || [])
    } catch (error) {
      log.error('Failed to get user sessions:', error)
      return sendResponse.error(res, 500, 'Failed to retrieve sessions')
    }
  },
)

router.delete(
  ['/:uuid', '/:uuid/'],
  cacheControl('noStore'),
  requireRole('user'),
  async (req, res) => {
    const sessionUuid = req.params.uuid
    const user = /** @type {any} */ (req.user)
    if (!sessionUuid) {
      return sendResponse.error(res, 400, 'Session UUID is required')
    }
    try {
      const result = await User.collection.updateOne(
        {
          uuid: user.uuid,
          'sessions.uuid': sessionUuid,
        },
        {
          $pull: {
            sessions: { uuid: sessionUuid },
          },
        },
      )
      if (result.modifiedCount === 0) {
        return sendResponse.error(res, 404, 'Session not found')
      }
      log.info('Revoked session:', sessionUuid, 'for user:', user.username)
      if (req.session?.uuid === sessionUuid) {
        return req.session.destroy((error) => {
          if (error) {
            log.error('Failed to destroy session:', error)
            return sendResponse.error(res, 500, 'Failed to destroy session')
          }
          res.clearCookie('connect.sid', { path: '/' })
          return res.sendStatus(204)
        })
      }
      return res.sendStatus(204)
    } catch (error) {
      log.error('Failed to revoke session:', error)
      return sendResponse.error(res, 500, 'Failed to revoke session')
    }
  },
)

module.exports = router
