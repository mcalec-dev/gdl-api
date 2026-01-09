'use strict'
import * as utils from '../min/index.min.js'
document.addEventListener('DOMContentLoaded', async () => {
  const registerForm = document.getElementById('registerForm')
  const errorDiv = document.getElementById('error')
  const loadingDiv = document.getElementById('loading')
  async function handleRegister(e) {
    e.preventDefault()
    const username = document.getElementById('username').value
    const email = document.getElementById('email')
      ? document.getElementById('email').value
      : ''
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
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          email,
          password,
        }),
      }).catch((error) => {
        utils.handleError(error)
        showError(error)
      })
      const data = await response.json()
      if (response.ok) {
        window.location.href = '/dashboard'
      } else {
        utils.handleError(data.error)
        showError(data.error)
      }
    } catch (error) {
      utils.handleError(error)
      showError(error)
    } finally {
      showLoading(false)
    }
  }
  function showError(error) {
    errorDiv.textContent = error.message
    errorDiv.hidden = false
  }
  function hideError() {
    errorDiv.hidden = true
  }
  function showLoading(show) {
    if (loadingDiv) {
      loadingDiv.hidden = show ? true : false
    }
  }
  registerForm.addEventListener('submit', async (e) => {
    await handleRegister(e)
  })
})
