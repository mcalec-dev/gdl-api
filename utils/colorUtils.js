const { hash: h64 } = require('@intrnl/xxhash64')
const log = require('./logHandler')

/**
 * @typedef {object} UserColorObject
 * @property {number|null} [hue]
 * @property {number|null} [lightness]
 * @property {boolean|null} [enabled]
 */

/**
 * @param {string} id
 * @param {number} [lightness=75]
 * @returns {string}
 */
function generateColor(id, lightness = 75) {
  const hue = Number(h64(id) % BigInt(360))
  return `hsl(${hue}, 100%, ${lightness}%)`
}

/**
 * @param {UserColorObject|null} [colorObj]
 * @param {string} [userId]
 * @returns {UserColorObject}
 */
function getUserColor(colorObj, userId) {
  let defaultHue = null
  if (userId && typeof userId === 'string') {
    defaultHue = Number(h64(userId) % BigInt(360))
  }
  const defaults = {
    hue: defaultHue,
    lightness: 75,
    enabled: true,
  }
  if (!colorObj) {
    return defaults
  }
  return {
    hue:
      colorObj.hue !== null && colorObj.hue !== undefined
        ? colorObj.hue
        : defaults.hue,
    lightness:
      colorObj.lightness !== undefined
        ? colorObj.lightness
        : defaults.lightness,
    enabled:
      colorObj.enabled !== undefined ? colorObj.enabled : defaults.enabled,
  }
}

/**
 * @param {UserColorObject} colorObj
 * @param {object} updates
 * @param {number} [updates.lightness]
 * @param {boolean} [updates.enabled]
 * @returns {UserColorObject|null}
 */
function updateColor(colorObj, updates) {
  if (!colorObj || typeof colorObj !== 'object') {
    log.error('Invalid color object provided')
    return null
  }
  const color = { ...colorObj }
  if (updates.lightness !== undefined) {
    if (typeof updates.lightness !== 'number') {
      log.error('lightness must be a number')
      return null
    }
    const lightness = Math.max(0, Math.min(100, updates.lightness))
    color.lightness = lightness
  }
  if (updates.enabled !== undefined) {
    if (typeof updates.enabled !== 'boolean') {
      log.error('enabled must be a boolean')
      return null
    }
    color.enabled = updates.enabled
  }
  return color
}

module.exports = {
  generateColor,
  getUserColor,
  updateColor,
}
