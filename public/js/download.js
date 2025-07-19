document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('downloadForm')
  const urlInput = document.getElementById('urlInput')
  const statusMessage = document.getElementById('statusMessage')
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    statusMessage.textContent = ''
    statusMessage.style.display = 'none'
    const url = urlInput.value.trim()
    if (!url) {
      statusMessage.textContent = 'Please enter a URL.'
      statusMessage.style.display = 'block'
      return
    }
    try {
      statusMessage.textContent = 'Downloading...'
      statusMessage.style.display = 'block'
      const a = document.createElement('a')
      a.href = `/gdl/api/download?q="${encodeURIComponent(url)}"`
      a.download = ''
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      setTimeout(() => {
        document.body.removeChild(a)
        statusMessage.textContent = ''
        statusMessage.style.display = 'none'
      }, 1200)
    } catch (err) {
      statusMessage.textContent = 'Failed to start download.'
      statusMessage.style.display = 'block'
      console.error('Download error:', err)
    }
  })
})
