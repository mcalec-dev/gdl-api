/**
 * Returns a user-facing string without exposing absent values as text.
 *
 * @param {unknown} value Value received from an API response or the DOM.
 * @param {string} [fallback=''] Text to use when the value is absent.
 * @returns {string} A trimmed display value.
 */
export function toDisplayText(value, fallback = '') {
  if (value === null || value === undefined) return fallback

  const text = String(value).trim()
  return text && text !== 'null' && text !== 'undefined' ? text : fallback
}

/**
 * Normalizes an identifier received from markup or an API response.
 *
 * @param {unknown} value Candidate identifier.
 * @returns {string} A nonempty identifier, or an empty string when invalid.
 */
export function normalizeIdentifier(value) {
  return toDisplayText(value)
}

/**
 * Escapes text for use in an HTML string.
 *
 * @param {unknown} value Text to escape.
 * @returns {string} Escaped HTML text.
 */
export function escapeHtml(value) {
  const element = document.createElement('div')
  element.textContent = toDisplayText(value)
  return element.innerHTML
}

/**
 * Extracts a normalized extension from a file name or path.
 *
 * @param {unknown} value File name or path.
 * @returns {string} The extension without a leading dot.
 */
export function getFileExtension(value) {
  const text = toDisplayText(value)
  const fileName = text.split(/[\\/]/).pop() || ''
  const separator = fileName.lastIndexOf('.')

  if (separator <= 0 || separator === fileName.length - 1) return ''
  return fileName.slice(separator + 1).toLowerCase()
}

/**
 * Escapes a value for use in a CSS selector attribute value.
 *
 * @param {unknown} value Selector value.
 * @returns {string} A CSS-safe attribute value.
 */
export function escapeSelectorValue(value) {
  const text = toDisplayText(value)
  const css = globalThis.CSS
  if (css && typeof css.escape === 'function') {
    return css.escape(text)
  }
  return text.replace(/[^a-zA-Z0-9_-]/g, '\\$&')
}
