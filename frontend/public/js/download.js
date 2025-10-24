'use strict'
import * as utils from './index.js'
document.addEventListener('DOMContentLoaded', () => {
  const urlInput = document.getElementById('urlInput')
  const downloadButton = document.getElementById('downloadButton')
  const statusMessage = document.getElementById('statusMessage')
  const API_URL = '/api/download'
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
      a.href = `${API_URL}?url="${encodeURIComponent(url)}"`
      a.download = ''
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      setTimeout(() => {
        document.body.removeChild(a)
        statusMessage.textContent = ''
        statusMessage.style.display = 'none'
      }, 1200)
    } catch (error) {
      utils.handleError(error)
      statusMessage.textContent = error.message
      statusMessage.style.display = 'block'
    }
  }
  downloadButton.addEventListener('click', () => {
    const url = urlInput.value.trim()
    if (url) performDownload(url)
  })
})
async function initDownload(url) {
  if (!url) return console.error('No URL provided for download')
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = ''
    a.hidden = true
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } catch (error) {
    utils.handleError(error)
    console.error('Error initializing download:', error)
  }
}
const VERSION = '1.0.1'
document
  .getElementById('windows-exe-download')
  .addEventListener('click', async () => {
    await initDownload(
      `https://github.com/mcalec-dev/gdl-api/releases/download/${VERSION}/gdl-api-client_win-x64_${VERSION}.exe`
    )
  })
document
  .getElementById('windows-msi-download')
  .addEventListener('click', async () => {
    await initDownload(
      `https://github.com/mcalec-dev/gdl-api/releases/download/${VERSION}/gdl-api-client_win-x64_${VERSION}.msi`
    )
  })
document
  .getElementById('windows-zip-download')
  .addEventListener('click', async () => {
    await initDownload(
      `https://github.com/mcalec-dev/gdl-api/releases/download/${VERSION}/gdl-api-client_win-x64_${VERSION}.zip`
    )
  })
document
  .getElementById('windows-7z-download')
  .addEventListener('click', async () => {
    await initDownload(
      `https://github.com/mcalec-dev/gdl-api/releases/download/${VERSION}/gdl-api-client_win-x64_${VERSION}.7z`
    )
  })
