'use strict'
import * as utils from '../min/index.min.js'
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
    return utils.handleError(error)
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
