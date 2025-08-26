document.addEventListener('DOMContentLoaded', () => {
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
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password,
        }),
      })
      const data = await response.json()
      if (response.ok) {
        window.location.href = '/dashboard'
      } else {
        showError(data.error || 'Login failed')
      }
    } catch {
      showError('An error occurred while trying to log in')
    } finally {
      showLoading(false)
    }
  }
  function showError(message) {
    errorDiv.textContent = message
    errorDiv.style.display = 'block'
  }
  function hideError() {
    errorDiv.style.display = 'none'
  }
  function showLoading(show) {
    if (loadingDiv) {
      loadingDiv.style.display = show ? 'block' : 'none'
    }
  }
  document.getElementById('password').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleLogin(e)
    }
  })
  loginForm.addEventListener('submit', handleLogin)
})
