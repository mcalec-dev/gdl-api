document.addEventListener('DOMContentLoaded', () => {
  const urlInput = document.getElementById('urlInput')
  const downloadButton = document.getElementById('downloadButton')
  const statusMessage = document.getElementById('statusMessage')
  const API_URL = '/gdl/api/download'
  async function performDownload(url) {
    if (!url.length) {
      statusMessage.textContent = 'Please enter a URL.'
      statusMessage.style.display = 'block'
      return
    }
    statusMessage.textContent = ''
    statusMessage.style.display = 'none'
    statusMessage.textContent = 'Downloading...'
    statusMessage.style.display = 'block'
    try {
      const a = document.createElement('a')
      a.href = `${API_URL}?q="${encodeURIComponent(url)}"`
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
  }
  downloadButton.addEventListener('click', () => {
    const url = urlInput.value.trim()
    if (url) performDownload(url)
  })
})
