'use strict'
import prettyBytes from 'https://cdn.jsdelivr.net/npm/pretty-bytes/+esm'
import prettyMs from 'https://cdn.jsdelivr.net/npm/pretty-ms/+esm'
import { BYTES_BITS } from '../min/settings.min.js'
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
  { minDecimalPlaces = 0, maxDecimalPlaces = 2 } = {}
) {
  if (!bytes) return null
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
  if (!ms) return null
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
/**
 * Displays a status message in the UI
 * @param {string} mesg
 * @param {boolean} isError
 */
export function statusMessage(mesg, isError = false) {
  const statusMessageElement = document.getElementById('statusMessage')
  if (statusMessageElement) {
    statusMessageElement.textContent = mesg
    statusMessageElement.style.display = 'block'
    statusMessageElement.style.color = isError ? 'red' : 'black'
  }
}
export function upscaleImage(url, scale = '100', kernel = 'lanczos3') {
  if (!url || !scale) return null
  try {
    const urlObj = new URL(url)
    urlObj.searchParams.set('scale', scale)
    if (kernel) urlObj.searchParams.set('kernel', kernel)
    return urlObj.toString()
  } catch (error) {
    handleError(error)
    return null
  }
}
export function getByUUID(uuid, type = 'file') {
  if (!uuid || !type) return null
  const typeEnum = ['file', 'directory']
  if (!typeEnum.includes(type)) {
    handleError('Invalid type parameter: ' + type)
    return null
  }
  return fetch(`/api/uuid/${uuid}/${type}`)
    .then((response) => {
      if (!response.ok) {
        handleError('Failed to fetch info: ' + response.statusText)
        return null
      }
      return response.json()
    })
    .catch((error) => {
      handleError(error)
      return null
    })
}
export async function copyImage(url) {
  if (!url) return
  try {
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error('Failed to fetch image: ' + res.statusText)
    }
    const blob = await res.blob()
    const type = blob.type
    if (!navigator.clipboard) {
      throw new Error('Clipboard API not supported in this browser')
    }
    if (navigator.clipboard.write) {
      try {
        await navigator.clipboard.write([new ClipboardItem({ [type]: blob })])
        return
      } catch (err) {
        console.warn('Clipboard write failed, trying alternative methods:', err)
      }
    }
    if (navigator.clipboard.writeBlob) {
      await navigator.clipboard.writeBlob(blob)
      return
    }
    throw new Error('No compatible clipboard method available')
  } catch (error) {
    handleError(`Failed to copy image: ${error.message}`)
  }
}
export function escapeHtml(text) {
  if (typeof text !== 'string') return ''
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
export default {
  formatSize,
  formatMilliseconds,
  formatDate,
  getName,
  parseEmojis,
  getIcons,
  handleError,
  statusMessage,
  upscaleImage,
  getByUUID,
  copyImage,
  escapeHtml,
}
