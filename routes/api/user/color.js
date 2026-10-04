const router = require('express').Router()
const User = require('../../../models/User')
const { requireRole } = require('../../../utils/authUtils')
const log = require('../../../utils/logHandler')
const sendResponse = require('../../../utils/resUtils')
const { getUserColor, updateColor } = require('../../../utils/colorUtils')
const cache = require('../../../utils/cache')
const { cacheControl } = require('../../../utils/cacheControl')

/**
 * @typedef {object} AuthenticatedUser
 * @property {string} uuid
 * @property {string} username
 */

/**
 * @typedef {object} UserColorObject
 * @property {number|null} [hue]
 * @property {number|null} [lightness]
 * @property {boolean|null} [enabled]
 */

router.get(
  '/',
  cacheControl('privateShort'),
  requireRole('user'),
  async (req, res) => {
    try {
      const currentUser = /** @type {AuthenticatedUser} */ (
        /** @type {unknown} */ (req.user)
      )
      log.debug('Getting color for user:', currentUser.username)
      const userId = currentUser.uuid
      const color = await cache
        .wrap(`user:color:${userId}`, 60, async () => {
          const user = await User.findOne({ uuid: currentUser.uuid })
          if (!user) throw new Error('User not found')
          const value = getUserColor(user.color, user.uuid)
          await User.findOneAndUpdate(
            { uuid: currentUser.uuid },
            { color: value },
            { new: true },
          )
          return value
        })
        .catch((error) => {
          if (error.message === 'User not found') return null
          throw error
        })
      if (color === null) return sendResponse.error(res, 404, 'User not found')
        log.debug('Ensured color is saved for user:', currentUser.username)
      return sendResponse(res, 200).json({
        color,
      })
    } catch (error) {
      log.error('Failed to get user color:', error)
      return sendResponse.error(res, 500, 'Failed to retrieve color settings')
    }
  },
)

router.put(
  '/',
  cacheControl('noStore'),
  requireRole('user'),
  async (req, res) => {
    try {
      const currentUser = /** @type {AuthenticatedUser} */ (
        /** @type {unknown} */ (req.user)
      )
      const { lightness, enabled } = req.body
      if (
        lightness !== undefined &&
        (typeof lightness !== 'number' || lightness < 0 || lightness > 100)
      ) {
        return sendResponse.error(
          res,
          400,
          'Lightness must be a number between 0 and 100',
        )
      }
      if (enabled !== undefined && typeof enabled !== 'boolean') {
        return sendResponse.error(res, 400, 'Enabled must be a boolean')
      }
      if (lightness === undefined && enabled === undefined) {
        return sendResponse.error(
          res,
          400,
          'At least one of lightness or enabled must be provided',
        )
      }
      log.debug('Updating color for user:', currentUser.username, {
        lightness,
        enabled,
      })
      const user = await User.findOne({ uuid: currentUser.uuid })
      if (!user) {
        log.debug('User not found:', currentUser.uuid)
        return sendResponse.error(res, 404, 'User not found')
      }
      const currentColor = getUserColor(user.color, user.uuid)
      const updatedColor = updateColor(currentColor, { lightness, enabled })
      user.color = updatedColor
      await user.save()
      await cache.del(`user:color:${currentUser.uuid}`)
      log.info('Updated color for user:', currentUser.username, updatedColor)
      return sendResponse(res, 200).json({
        color: updatedColor,
      })
    } catch (error) {
      log.error('Failed to update user color:', error)
      return sendResponse.error(res, 500, 'Failed to update color settings')
    }
  },
)

router.post(
  '/reset',
  cacheControl('noStore'),
  requireRole('user'),
  async (req, res) => {
    try {
      const currentUser = /** @type {AuthenticatedUser} */ (
        /** @type {unknown} */ (req.user)
      )
      log.debug('Resetting color for user:', currentUser.username)
      const user = await User.findOne({ uuid: currentUser.uuid })
      if (!user) {
        log.debug('User not found:', currentUser.uuid)
        return sendResponse.error(res, 404, 'User not found')
      }
      const resetColor = getUserColor(undefined, user.uuid)
      user.color = resetColor
      await user.save()
      await cache.del(`user:color:${currentUser.uuid}`)
      log.info('Reset color for user:', currentUser.username)
      return sendResponse(res, 200).json({
        color: resetColor,
      })
    } catch (error) {
      log.error('Failed to reset user color:', error)
      return sendResponse.error(res, 500, 'Failed to reset color settings')
    }
  },
)

module.exports = router
