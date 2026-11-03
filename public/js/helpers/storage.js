/**
 * @typedef {{days?: number, path?: string, sameSite?: 'Lax' | 'Strict' | 'None'}} CookieOptions
 */

/**
 * Reads a cookie value safely.
 *
 * @param {string} name Cookie name.
 * @returns {string | null} The decoded cookie value, or null when absent.
 */
export function getCookie(name) {
  if (!name || typeof document === 'undefined') return null

  const prefix = `${encodeURIComponent(name)}=`
  const match = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))

  if (!match) return null

  try {
    return decodeURIComponent(match.slice(prefix.length))
  } catch {
    return null
  }
}

/**
 * Stores a cookie value using a consistent default lifetime and scope.
 *
 * @param {string} name Cookie name.
 * @param {string} value Cookie value.
 * @param {CookieOptions} [options] Cookie configuration.
 * @returns {boolean} True when the browser accepted the assignment.
 */
export function setCookie(name, value, options = {}) {
  if (!name || typeof document === 'undefined') return false

  const { days = 365, path = '/', sameSite = 'Lax' } = options
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(
    value
  )};expires=${expires.toUTCString()};path=${path};SameSite=${sameSite}`
  return true
}

/**
 * Reads JSON stored in a cookie without allowing a malformed cookie to break a page.
 *
 * @template T
 * @param {string} name Cookie name.
 * @param {T} fallback Value returned when the cookie is absent or invalid.
 * @returns {T} Parsed cookie data or the fallback.
 */
export function readJsonCookie(name, fallback) {
  const value = getCookie(name)
  if (!value) return fallback

  try {
    return /** @type {T} */ (JSON.parse(value))
  } catch {
    return fallback
  }
}

/**
 * Serializes a value into a cookie.
 *
 * @param {string} name Cookie name.
 * @param {unknown} value JSON-serializable value.
 * @param {CookieOptions} [options] Cookie configuration.
 * @returns {boolean} False when serialization fails.
 */
export function writeJsonCookie(name, value, options = {}) {
  try {
    return setCookie(name, JSON.stringify(value), options)
  } catch {
    return false
  }
}

/**
 * Reads JSON from localStorage without allowing unavailable storage or malformed JSON to break a page.
 *
 * @template T
 * @param {string} key Storage key.
 * @param {T} fallback Value returned when no usable value exists.
 * @returns {T} Parsed storage data or the fallback.
 */
export function readLocalJson(key, fallback) {
  try {
    const value = localStorage.getItem(key)
    return value ? /** @type {T} */ (JSON.parse(value)) : fallback
  } catch {
    return fallback
  }
}

/**
 * Writes JSON to localStorage safely.
 *
 * @param {string} key Storage key.
 * @param {unknown} value JSON-serializable value.
 * @returns {boolean} True when storage succeeds.
 */
export function writeLocalJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}
