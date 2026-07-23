const router = require('express').Router()
const User = require('../../../models/User')
const { requireRole } = require('../../../utils/authUtils')
const log = require('../../../utils/logHandler')
const sendResponse = require('../../../utils/resUtils')
const { getUserColor, updateColor } = require('../../../utils/colorUtils')

/**
 * @typedef {object} UserColorObject
 * @property {number|null} [hue]
 * @property {number|null} [lightness]
 * @property {boolean|null} [enabled]
 */

router.get('/', requireRole('user'), async (req, res) => {
  try {
    log.debug('Getting color for user:', req.user.username)
    const user = await User.findOne({ uuid: req.user.uuid })
    if (!user) {
      log.debug('User not found:', req.user.uuid)
      return sendResponse.error(res, 404, 'User not found')
    }
    const color = getUserColor(user.color, user.uuid)
    await User.findOneAndUpdate(
      { uuid: req.user.uuid },
      { color },
      { new: true }
    )
    log.debug('Ensured color is saved for user:', req.user.username)
    return sendResponse(res, 200).json({
      color,
    })
  } catch (error) {
    log.error('Failed to get user color:', error)
    return sendResponse.error(res, 500, 'Failed to retrieve color settings')
  }
})

router.put('/', requireRole('user'), async (req, res) => {
  try {
    const { lightness, enabled } = req.body
    if (
      lightness !== undefined &&
      (typeof lightness !== 'number' || lightness < 0 || lightness > 100)
    ) {
      return sendResponse.error(
        res,
        400,
        'Lightness must be a number between 0 and 100'
      )
    }
    if (enabled !== undefined && typeof enabled !== 'boolean') {
      return sendResponse.error(res, 400, 'Enabled must be a boolean')
    }
    if (lightness === undefined && enabled === undefined) {
      return sendResponse.error(
        res,
        400,
        'At least one of lightness or enabled must be provided'
      )
    }
    log.debug('Updating color for user:', req.user.username, {
      lightness,
      enabled,
    })
    const user = await User.findOne({ uuid: req.user.uuid })
    if (!user) {
      log.debug('User not found:', req.user.uuid)
      return sendResponse.error(res, 404, 'User not found')
    }
    const currentColor = getUserColor(user.color, user.uuid)
    const updatedColor = updateColor(currentColor, { lightness, enabled })
    user.color = updatedColor
    await user.save()
    log.info('Updated color for user:', req.user.username, updatedColor)
    return sendResponse(res, 200).json({
      color: updatedColor,
    })
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    log.error('Failed to update user color:', error)
    return sendResponse.error(res, 500, 'Failed to update color settings')
  }
})

router.post('/reset', requireRole('user'), async (req, res) => {
  try {
    log.debug('Resetting color for user:', req.user.username)
    const user = await User.findOne({ uuid: req.user.uuid })
    if (!user) {
      log.debug('User not found:', req.user.uuid)
      return sendResponse.error(res, 404, 'User not found')
    }
    const resetColor = getUserColor(undefined, user.uuid)
    user.color = resetColor
    await user.save()
    log.info('Reset color for user:', req.user.username)
    return sendResponse(res, 200).json({
      color: resetColor,
    })
  } catch (error) {
    log.error('Failed to reset user color:', error)
    return sendResponse.error(res, 500, 'Failed to reset color settings')
  }
})

module.exports = router
