import * as utils from './index.js'
import {
  hideFormError,
  setFormLoading,
  showFormError,
  submitJsonForm,
} from './helpers/forms.js'

/**
 * Binds the registration form to the shared JSON form and feedback helpers.
 *
 * @returns {Promise<void>} Resolves after form listeners are registered.
 */
async function init() {
  const registerForm = document.getElementById('registerForm')
  const errorDiv = document.getElementById('error')
  const loadingDiv = document.getElementById('loading')
  const usernameInput = document.getElementById('username')
  const emailInput = document.getElementById('email')
  const passwordInput = document.getElementById('password')
  const confirmInput = document.getElementById('confirm')
  if (
    !(registerForm instanceof HTMLFormElement) ||
    !(usernameInput instanceof HTMLInputElement) ||
    !(emailInput instanceof HTMLInputElement) ||
    !(passwordInput instanceof HTMLInputElement) ||
    !(confirmInput instanceof HTMLInputElement)
  ) {
    return
  }
  const usernameField = /** @type {HTMLInputElement} */ (usernameInput)
  const emailField = /** @type {HTMLInputElement} */ (emailInput)
  const passwordField = /** @type {HTMLInputElement} */ (passwordInput)
  const confirmField = /** @type {HTMLInputElement} */ (confirmInput)

  /** @param {SubmitEvent} e @returns {Promise<void>} */
  async function handleRegister(e) {
    e.preventDefault()
    const username = usernameField.value.trim()
    const email = emailField.value.trim()
    const password = passwordField.value
    const confirm = confirmField.value
    if (!username || !password || !confirm) {
      showError('All required fields must be filled')
      return
    }
    if (password !== confirm) {
      showError('Passwords do not match')
      return
    }
    showLoading(true)
    hideError()
    try {
      await submitJsonForm(utils.getAppUrl('/api/auth/register'), {
        username,
        email,
        password,
      })
      window.location.href = utils.getAppUrl('/dashboard/')
    } catch (error) {
      utils.handleError(error, 'Registration failed')
      showError(error)
    } finally {
      showLoading(false)
    }
  }
  /** @param {unknown} error @returns {void} */
  function showError(error) {
    showFormError(errorDiv, error, 'Registration failed')
  }
  /**
   * Hides the inline registration error.
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
  registerForm.addEventListener('submit', async (e) => {
    await handleRegister(/** @type {SubmitEvent} */ (e))
  })
}

document.addEventListener('DOMContentLoaded', init)
