import { normalizeIdentifier, toDisplayText } from './strings.js'
import { getAppUrl } from './url.js'

/**
 * @typedef {Record<string, unknown>} JsonRecord
 */

/**
 * Error returned when an API response has a non-success HTTP status.
 */
export class ApiError extends Error {
  /**
   * @param {string} message Display-safe error message.
   * @param {number} status HTTP status code.
   * @param {unknown} [payload=null] Parsed response body.
   */
  constructor(message, status, payload = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

/**
 * Checks whether a value is an object-shaped JSON response.
 *
 * @param {unknown} value Candidate value.
 * @returns {value is JsonRecord} Whether value is a JSON object.
 */
function isRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

/** @type {Promise<JsonRecord> | null} */
let iconsRequest = null

/**
 * Retrieves the first usable error message from a response body.
 *
 * @param {unknown} payload Parsed response body.
 * @param {number} status HTTP status code.
 * @returns {string} Display-safe error message.
 */
function getResponseErrorMessage(payload, status) {
  if (isRecord(payload)) {
    const message = toDisplayText(payload.message || payload.error)
    if (message) return message
  }
  if (typeof payload === 'string' && payload.trim()) return payload.trim()
  return `Request failed (HTTP ${status})`
}

/**
 * Parses an API response body safely, including HTTP 204 and empty responses.
 *
 * @param {Response} response Fetch response.
 * @returns {Promise<unknown>} Parsed JSON, response text, or null for an empty body.
 */
export async function parseResponseBody(response) {
  if (
    response.status === 204 ||
    response.headers.get('content-length') === '0'
  ) {
    return null
  }

  const text = await response.text()
  if (!text.trim()) return null

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/**
 * Performs a fetch request and raises a typed error for unsuccessful responses.
 *
 * @param {RequestInfo | URL} input Request URL or Request object.
 * @param {RequestInit} [init] Fetch options.
 * @returns {Promise<unknown>} Parsed response body, including null for HTTP 204.
 * @throws {ApiError} When the server responds with a non-success status.
 */
export async function requestJson(input, init = {}) {
  const response = await fetch(input, init)
  const payload = await parseResponseBody(response)

  if (!response.ok) {
    throw new ApiError(
      getResponseErrorMessage(payload, response.status),
      response.status,
      payload
    )
  }

  return payload
}

/**
 * Fetches the API root metadata and returns a usable display name.
 *
 * @returns {Promise<string>} Site name, or an empty string when unavailable.
 */
export async function getName() {
  try {
    const payload = await requestJson(getAppUrl('/api'), {
      credentials: 'same-origin',
    })
    return isRecord(payload) ? toDisplayText(payload.name) : ''
  } catch {
    return ''
  }
}

/**
 * Fetches the icon catalog used by frontend pages.
 *
 * @returns {Promise<JsonRecord>} Icon catalog, or an empty object when unavailable.
 */
export async function getIcons() {
  if (!iconsRequest) {
    iconsRequest = requestJson(getAppUrl('/icons.json'), {
      credentials: 'same-origin',
    })
      .then((payload) => (isRecord(payload) ? payload : {}))
      .catch(() => ({}))
  }
  return iconsRequest
}

/**
 * Resolves an icon alias from either a top-level catalog key or a dot-delimited
 * nested key such as `nav.copy`.
 *
 * @param {JsonRecord} icons Icon catalog.
 * @param {string} alias Colon-delimited alias without its colons.
 * @returns {string} SVG markup, or an empty string when unavailable.
 */
function getIconAlias(icons, alias) {
  /** @type {unknown} */
  let value = icons
  for (const part of alias.split('.')) {
    if (!isRecord(value) || !(part in value)) return ''
    value = value[part]
  }
  return typeof value === 'string' ? value : ''
}

/**
 * Replaces known colon-delimited emoji aliases with their icon markup.
 *
 * @param {string} text Escaped text containing optional aliases.
 * @returns {Promise<string>} Text with available aliases replaced.
 */
export async function parseEmojis(text) {
  const icons = await getIcons()
  const safeText = toDisplayText(text)
  return safeText.replace(/:([a-zA-Z0-9_.+-]+):/g, (match, key) => {
    return getIconAlias(icons, key) || match
  })
}

/**
 * Fetches one resource by UUID while validating its public API type.
 *
 * @param {unknown} uuid Resource UUID.
 * @param {'file' | 'directory'} [type='file'] Resource type.
 * @returns {Promise<unknown | null>} Resource payload, or null when unavailable.
 */
export async function getByUUID(uuid, type = 'file') {
  const normalizedUuid = normalizeIdentifier(uuid)
  if (!normalizedUuid || !['file', 'directory'].includes(type)) return null

  try {
    return await requestJson(
      getAppUrl(`/api/uuid/${encodeURIComponent(normalizedUuid)}/${type}`),
      { credentials: 'same-origin' }
    )
  } catch {
    return null
  }
}

/**
 * Checks whether the current browser session is authenticated.
 *
 * @returns {Promise<boolean>} True for an authenticated session.
 */
export async function isAuthenticated() {
  try {
    const payload = await requestJson(getAppUrl('/api/auth/check'), {
      credentials: 'same-origin',
    })
    return Boolean(isRecord(payload) && payload.authenticated === true)
  } catch {
    return false
  }
}
