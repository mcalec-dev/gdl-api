/**
 * Produces a safe display message for an unknown error value.
 *
 * @param {unknown} error Error-like value.
 * @param {string} [fallback='An error occurred'] Message used when no detail is available.
 * @returns {string} Display-safe error message.
 */
export function getErrorMessage(error, fallback = 'An error occurred') {
  if (typeof error === 'string' && error.trim()) return error.trim()
  if (error instanceof Error && error.message) return error.message
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.trim()
  ) {
    return error.message.trim()
  }
  return fallback
}

/**
 * Logs a frontend failure consistently and returns its display message.
 *
 * @param {unknown} error Error-like value.
 * @param {string} [context='Frontend error'] Context for the console.
 * @returns {string} Display-safe error message.
 */
export function handleError(error, context = 'Frontend error') {
  console.error(context, error)
  return getErrorMessage(error)
}

/**
 * Shows or hides an element using its semantic hidden state.
 *
 * @param {HTMLElement | null | undefined} element Target element.
 * @param {boolean} hidden Whether the element should be hidden.
 * @returns {void}
 */
export function setHidden(element, hidden) {
  if (element) element.hidden = hidden
}

/**
 * Updates the shared status message when the current page provides one.
 *
 * @param {string} message Status text.
 * @param {boolean} [isError=false] Whether the message represents an error.
 * @returns {void}
 */
export function statusMessage(message, isError = false) {
  const element = document.getElementById('statusMessage')
  if (!element) return

  element.textContent = message
  element.hidden = false
  element.style.display = 'block'
  element.style.color = isError ? 'red' : 'black'
}
