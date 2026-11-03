import { requestJson } from './api.js'
import { getErrorMessage } from './ui.js'

/**
 * Shows a form-level message without rendering unknown values as `undefined`.
 *
 * @param {HTMLElement | null} element Error message element.
 * @param {unknown} error Error-like value to display.
 * @param {string} [fallback='An error occurred'] Fallback display text.
 * @returns {void}
 */
export function showFormError(element, error, fallback = 'An error occurred') {
  if (!element) return
  element.textContent = getErrorMessage(error, fallback)
  element.hidden = false
}

/**
 * Hides a form-level error when the user begins another submission.
 *
 * @param {HTMLElement | null} element Error message element.
 * @returns {void}
 */
export function hideFormError(element) {
  if (element) element.hidden = true
}

/**
 * Toggles an optional loading indicator for a form submission.
 *
 * @param {HTMLElement | null} element Loading indicator element.
 * @param {boolean} isLoading Whether the submission is in progress.
 * @returns {void}
 */
export function setFormLoading(element, isLoading) {
  if (element) element.hidden = !isLoading
}

/**
 * Sends a same-origin JSON form request and treats every non-2xx response as
 * a structured failure.
 *
 * @param {string} url Same-origin API endpoint.
 * @param {Record<string, unknown>} payload JSON request payload.
 * @returns {Promise<unknown>} Parsed API response, including null for 204.
 */
export function submitJsonForm(url, payload) {
  return requestJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(payload),
  })
}
