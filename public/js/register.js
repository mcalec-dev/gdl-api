'use strict'
import * as utils from '../min/index.min.js'

async function init() {
  const registerForm = document.getElementById('registerForm')
  const errorDiv = document.getElementById('error')
  const loadingDiv = document.getElementById('loading')
  async function handleRegister(e) {
    e.preventDefault()
    const username = document.getElementById('username').value
    const email = document.getElementById('email').value
    const password = document.getElementById('password').value
    const confirm = document.getElementById('confirm').value
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
      const response = await fetch(utils.getAppUrl('/api/auth/register'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          username,
          email,
          password,
        }),
      })
      if (response.ok) {
        window.location.href = utils.getAppUrl('/dashboard/')
        return
      }
      const data = await response.json().catch(() => null)
      showError(
        data?.message || `Registration failed (HTTP ${response.status})`
      )
    } catch (error) {
      utils.handleError(error)
      showError(error)
    } finally {
      showLoading(false)
    }
  }
  function showError(error) {
    errorDiv.textContent =
      typeof error === 'string' ? error : error?.message || 'An error occurred'
    errorDiv.hidden = false
  }
  function hideError() {
    errorDiv.hidden = true
  }
  function showLoading(show) {
    if (loadingDiv) {
      loadingDiv.hidden = !show
    }
  }
  registerForm.addEventListener('submit', async (e) => {
    await handleRegister(e)
  })
}

document.addEventListener('DOMContentLoaded', init)
