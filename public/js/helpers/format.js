import { readJsonCookie } from './storage.js'

/**
 * @typedef {{minDecimalPlaces?: number, maxDecimalPlaces?: number, binary?: boolean}} FormatSizeOptions
 */

/**
 * Reads the persisted byte-unit preference without importing the settings UI module.
 *
 * @returns {boolean} Whether decimal units should be used.
 */
function useDecimalByteUnits() {
  const saved = readJsonCookie(
    'settings',
    /** @type {Record<string, unknown> | null} */ (null)
  )
  return Boolean(
    saved &&
    typeof saved === 'object' &&
    'bytesBits' in saved &&
    saved.bytesBits === true
  )
}

/**
 * Formats a byte count for display, including valid zero-byte values.
 *
 * @param {unknown} value Byte count.
 * @param {FormatSizeOptions} [options] Formatting options.
 * @returns {string} Formatted size, or an empty string for an invalid value.
 */
export function formatSize(value, options = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return ''
  }

  const {
    minDecimalPlaces = 0,
    maxDecimalPlaces = 2,
    binary = !useDecimalByteUnits(),
  } = options
  const base = binary ? 1024 : 1000
  const units = binary
    ? ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB']
    : ['B', 'KB', 'MB', 'GB', 'TB', 'PB']

  if (value === 0) return '0 B'

  const exponent = Math.min(
    Math.floor(Math.log(value) / Math.log(base)),
    units.length - 1
  )
  const amount = value / base ** exponent
  return `${amount.toLocaleString(undefined, {
    minimumFractionDigits: minDecimalPlaces,
    maximumFractionDigits: maxDecimalPlaces,
  })} ${units[exponent]}`
}

/**
 * Formats milliseconds as a concise duration, including a valid zero duration.
 *
 * @param {unknown} value Duration in milliseconds.
 * @returns {string} Formatted duration, or an empty string for an invalid value.
 */
export function formatMilliseconds(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return ''
  }
  if (value === 0) return '0 ms'

  const wholeMilliseconds = Math.round(value)
  /** @type {Array<[string, number]>} */
  const units = [
    ['d', 24 * 60 * 60 * 1000],
    ['h', 60 * 60 * 1000],
    ['m', 60 * 1000],
    ['s', 1000],
  ]
  let remaining = wholeMilliseconds
  const parts = []

  for (const [label, size] of units) {
    const amount = Math.floor(remaining / size)
    if (amount > 0) parts.push(`${amount}${label}`)
    remaining %= size
    if (parts.length === 2) break
  }

  return parts.length > 0 ? parts.join(' ') : `${remaining} ms`
}

/**
 * Formats a date value without rendering Invalid Date or undefined in the UI.
 *
 * @param {string | number | Date | null | undefined} value Date-like value.
 * @returns {string} Localized date, or an empty string for an invalid value.
 */
export function formatDate(value) {
  if (value === null || value === undefined || value === '') return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return date.toLocaleString(Intl.DateTimeFormat().resolvedOptions().locale, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  })
}
