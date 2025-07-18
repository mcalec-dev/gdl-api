document.addEventListener('DOMContentLoaded', () => {
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
      const payload = { username, password }
      if (email) payload.email = email
      const response = await fetch('/gdl/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (response.ok) {
        window.location.href = '/dashboard'
      } else {
        showError(data.error || 'Registration failed')
      }
    } catch {
      showError('An error occurred while trying to register')
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
  document.getElementById('confirm').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleRegister(e)
    }
  })
  registerForm.addEventListener('submit', handleRegister)
})
