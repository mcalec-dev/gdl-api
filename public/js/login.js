'use strict'
import * as utils from '../min/index.min.js'

async function init() {
  const loginForm = document.getElementById('loginForm')
  const errorDiv = document.getElementById('error')
  const loadingDiv = document.getElementById('loading')
  async function handleLogin(e) {
    e.preventDefault()
    const username = document.getElementById('username').value
    const password = document.getElementById('password').value
    if (!username || !password) {
      showError('Username and password are required')
      return
    }
    showLoading(true)
    hideError()
    try {
      const response = await fetch(utils.getAppUrl('/api/auth/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          username,
          password,
        }),
      })
      if (response.ok) {
        window.location.href = utils.getAppUrl('/dashboard/')
        return
      }
      const data = await response.json().catch(() => null)
      showError(data?.message || `Login failed (HTTP ${response.status})`)
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
  loginForm.addEventListener('submit', async (e) => {
    await handleLogin(e)
  })
}

document.addEventListener('DOMContentLoaded', init)
