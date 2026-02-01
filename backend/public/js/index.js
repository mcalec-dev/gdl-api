'use strict'
import prettyBytes from 'https://cdn.jsdelivr.net/npm/pretty-bytes/+esm'
import prettyMs from 'https://cdn.jsdelivr.net/npm/pretty-ms/+esm'
import { BYTES_BITS } from '../min/settings.min.js'
/**
 * Global scroll lock state tracking
 * @private
 */
let _scrollLockCount = 0
let _prevBodyOverflow = null
/**
 * Controls body scrolling with reference counting for multiple modules
 * Supports multiple input formats: boolean, strings, or defaults to toggle
 * @param {boolean|string} [action='toggle'] - true/false for enable/disable, 'lock'/'unlock', 'on'/'off', or omit to toggle
 * @returns {boolean} Current scroll state (true = enabled, false = disabled)
 * @function
 * @example
 * scroll(true)        // Enable scroll
 * scroll(false)       // Disable scroll
 * scroll('unlock')    // Enable scroll
 * scroll('lock')      // Disable scroll
 * scroll()            // Toggle scroll state
 */
export function scroll(action = 'toggle') {
  try {
    let shouldEnable
    if (typeof action === 'boolean') {
      shouldEnable = action
    } else if (typeof action === 'string') {
      shouldEnable = action === 'unlock' || action === 'off' || action === '0'
    } else {
      shouldEnable = _scrollLockCount > 0
    }
    if (shouldEnable) {
      if (_scrollLockCount > 0) {
        _scrollLockCount--
        if (_scrollLockCount === 0) {
          if (_prevBodyOverflow === null || _prevBodyOverflow === undefined) {
            document.body.style.removeProperty('overflow')
          } else {
            document.body.style.overflow = _prevBodyOverflow
          }
          _prevBodyOverflow = null
        }
      }
      return true
    } else {
      if (_scrollLockCount === 0) {
        _prevBodyOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
      }
      _scrollLockCount++
      return false
    }
  } catch (error) {
    handleError(error)
    return _scrollLockCount === 0
  }
}
/**
 * Formats bytes into a human-readable file size string
 * Respects the BYTES_BITS setting to show sizes in bits or bytes
 * @param {number} bytes - The number of bytes to format
 * @param {Object} [options] - Formatting options
 * @param {number} [options.minDecimalPlaces=0] - Minimum decimal places to show
 * @param {number} [options.maxDecimalPlaces=2] - Maximum decimal places to show
 * @returns {string|null} Formatted size string or null if invalid input
 */
export function formatSize(
  bytes,
  { minDecimalPlaces, maxDecimalPlaces } = {
    minDecimalPlaces: 0,
    maxDecimalPlaces: 2,
  }
) {
  if (typeof bytes !== 'number' || isNaN(bytes) || bytes < 0) {
    return null
  }
  try {
    if (BYTES_BITS) {
      return prettyBytes(bytes, {
        signed: false,
        bits: false,
        binary: false,
        locale: true,
        minimumFractionDigits: minDecimalPlaces,
        maximumFractionDigits: maxDecimalPlaces,
        space: true,
        nonBreakingSpace: true,
        //fixedWidth: undefined,
      })
    }
    if (!BYTES_BITS) {
      return prettyBytes(bytes, {
        signed: false,
        bits: false,
        binary: true,
        locale: true,
        minimumFractionDigits: minDecimalPlaces,
        maximumFractionDigits: maxDecimalPlaces,
        space: true,
        nonBreakingSpace: true,
        //fixedWidth: undefined,
      })
    }
  } catch (error) {
    handleError(error)
    return null
  }
}
/**
 * Formats milliseconds into a human-readable time duration string
 * @param {number} ms - The number of milliseconds to format
 * @returns {string|null} Formatted duration string or null if invalid input
 */
export function formatMilliseconds(ms) {
  if (typeof ms !== 'number' || isNaN(ms) || ms < 0) {
    return null
  }
  try {
    /*return prettyMs(ms, {
      secondsDecimalDigits: 0,
      millisecondsDecimalDigits: 0,
      keepDecimalsOnWholeSeconds: false,
      compact: false, // add settings option for this
      //unitCount: Infinity, // add settings option for this
      verbose: false, // add settings option for this too
      separateMilliseconds: false,
      formatSubMilliseconds: false,
      colonNotation: false,
      hideYears: false,
      hideYearAndDays: false,
      hideSeconds: true, // add settings option for this
      subSecondsAsDecimals: false, // add settings option for this
    })*/
    return prettyMs(ms)
  } catch (error) {
    handleError(error)
    return null
  }
}
/**
 * Formats a timestamp into a localized date and time string
 * Uses America/New_York timezone
 * @param {string|number|Date} timestamp - The timestamp to format
 * @returns {string} Formatted date string in 'long' format with time
 */
export function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString(
    Intl.DateTimeFormat().resolvedOptions().locale,
    {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      timeZone: 'America/New_York',
      hour12: true,
    }
  )
}
/**
 * Fetches the API name from the server
 * Makes a request to /api to retrieve server information
 * @async
 * @returns {Promise<string|undefined>} The server name or undefined if fetch fails
 */
export async function getName() {
  let name
  try {
    const host = document.location.origin + '/api'
    if (!host) throw new Error('No API host available')
    const res = await fetch(host)
    if (res && typeof res.json === 'function') {
      const data = await res.json()
      name = data && data.name
    } else if (res && res.name) {
      name = res.name
    }
  } catch (error) {
    console.error('Failed to fetch name:', error)
    name = undefined
  }
  return name
}
/**
 * Parses emoji shortcodes in text and replaces them with icon SVGs
 * Looks for patterns like :emoji_name: and replaces with corresponding icons
 * @async
 * @param {string} text - Text containing emoji shortcodes
 * @returns {Promise<string>} Text with emoji shortcodes replaced by icons
 */
export async function parseEmojis(text) {
  return text.replace(/:([a-zA-Z0-9_+-]+):/g, async (match, key) => {
    const icons = await getIcons()
    return icons[key] || match
  })
}
/**
 * Fetches the icons JSON file from the server (fallback)
 * @async
 * @returns {Promise<Object>} Icon object containing SVG icon definitions
 */
export async function getIcons() {
  return await fetch('/icons.json')
    .then((response) => response.json())
    .catch((error) => {
      handleError(error)
      return {}
    })
}
/**
 * Handles and logs errors to the console
 * Logs both error message and stack trace
 * @param {Error} error - The error object to handle
 */
export function handleError(error) {
  console.error(error)
  console.log('An error occurred. Please try again later.')
}
