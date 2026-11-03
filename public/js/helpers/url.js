/**
 * @typedef {Window & {
 *   BASE_PATH?: string,
 *   appUrl?: (path: string) => string,
 * }} AppWindow
 */

/**
 * Gets the configured application base path without a trailing slash.
 *
 * @returns {string} Normalized deployment base path.
 */
export function getBasePath() {
  const appWindow = /** @type {AppWindow} */ (window)
  let basePath = appWindow.BASE_PATH || ''
  while (basePath.endsWith('/')) basePath = basePath.slice(0, -1)
  return basePath
}

/**
 * Resolves an application-relative path through the configured base path.
 *
 * @param {string} path Application-relative path.
 * @returns {string} Path suitable for navigation or fetch.
 */
export function getAppUrl(path) {
  const appWindow = /** @type {AppWindow} */ (window)
  if (typeof appWindow.appUrl === 'function') return appWindow.appUrl(path)

  const basePath = getBasePath()
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  if (
    !basePath ||
    normalizedPath === basePath ||
    normalizedPath.startsWith(`${basePath}/`)
  ) {
    return normalizedPath
  }
  return `${basePath}${normalizedPath}`
}

/**
 * Resolves a path against the current origin.
 *
 * @param {string} path Application-relative path.
 * @returns {string} Absolute application URL.
 */
export function getAbsoluteAppUrl(path) {
  return new URL(getAppUrl(path), window.location.origin).toString()
}

/**
 * Builds a URL and applies a set of query parameters.
 *
 * @param {string | URL} url Base URL.
 * @param {Record<string, unknown>} [params] Query parameters.
 * @returns {string | null} Complete URL, or null when the input is invalid.
 */
export function constructURL(url, params = {}) {
  if (!url) return null

  try {
    const target = new URL(String(url), window.location.origin)
    for (const [key, value] of Object.entries(params)) {
      if (!key) continue

      if (Array.isArray(value)) {
        const joined = value
          .filter((item) => item !== null && item !== undefined)
          .map((item) => String(item).trim())
          .filter(Boolean)
          .join(',')
        if (joined) target.searchParams.set(key, joined)
        else target.searchParams.delete(key)
      } else if (value === null || value === undefined || value === '') {
        target.searchParams.delete(key)
      } else {
        target.searchParams.set(key, String(value))
      }
    }
    return target.toString()
  } catch {
    return null
  }
}
