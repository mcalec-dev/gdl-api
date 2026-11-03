import * as utils from './index.js'
import {
  hideFormError,
  setFormLoading,
  showFormError,
  submitJsonForm,
} from './helpers/forms.js'

/**
 * Binds the login form to the shared JSON form and feedback helpers.
 *
 * @returns {Promise<void>} Resolves after form listeners are registered.
 */
async function init() {
  const loginForm = document.getElementById('loginForm')
  const errorDiv = document.getElementById('error')
  const loadingDiv = document.getElementById('loading')
  const usernameInput = document.getElementById('username')
  const passwordInput = document.getElementById('password')
  if (
    !(loginForm instanceof HTMLFormElement) ||
    !(usernameInput instanceof HTMLInputElement) ||
    !(passwordInput instanceof HTMLInputElement)
  ) {
    return
  }
  const usernameField = /** @type {HTMLInputElement} */ (usernameInput)
  const passwordField = /** @type {HTMLInputElement} */ (passwordInput)

  /** @param {SubmitEvent} e @returns {Promise<void>} */
  async function handleLogin(e) {
    e.preventDefault()
    const username = usernameField.value.trim()
    const password = passwordField.value
    if (!username || !password) {
      showError('Username and password are required')
      return
    }
    showLoading(true)
    hideError()
    try {
      await submitJsonForm(utils.getAppUrl('/api/auth/login'), {
        username,
        password,
      })
      window.location.href = utils.getAppUrl('/dashboard/')
    } catch (error) {
      utils.handleError(error, 'Login failed')
      showError(error)
    } finally {
      showLoading(false)
    }
  }
  /** @param {unknown} error @returns {void} */
  function showError(error) {
    showFormError(errorDiv, error, 'Login failed')
  }
  /**
   * Hides the inline authentication error.
   *
   * @returns {void}
   */
  function hideError() {
    hideFormError(errorDiv)
  }
  /** @param {boolean} show @returns {void} */
  function showLoading(show) {
    setFormLoading(loadingDiv, show)
  }
  loginForm.addEventListener('submit', async (e) => {
    await handleLogin(/** @type {SubmitEvent} */ (e))
  })
}

document.addEventListener('DOMContentLoaded', init)
