const { app, BrowserWindow } = require('electron')
const path = require('path')
const https = require('https')
const http = require('http')
const SITES = ['https://gdl.mcalec.dev/', 'https://alt.gdl.mcalec.dev/']
function checkSite(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http
    const req = mod.request(
      url,
      {
        method: 'GET',
        timeout: 4000,
      },
      (res) => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          resolve(url)
        } else {
          reject(new Error('Bad status: ' + res.statusCode))
        }
      }
    )
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Timeout'))
    })
    req.end()
  })
}
async function findWorkingSite() {
  for (const site of SITES) {
    try {
      await checkSite(site)
      return site
    } catch (error) {
      console.error('Site check failed:', error)
    }
  }
  return null
}
async function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: false,
    },
    icon: path.join(__dirname, 'public', 'favicon.svg'),
    title: 'Gallery-DL API Client',
    titleBarStyle: '',
    titleBarOverlay: {
      color: '#000000',
      symbolColor: '#eeeeee',
      height: 20,
    },
    autoHideMenuBar: false,
    backgroundColor: '#ecf0f1',
  })
  const site = await findWorkingSite()
  if (site) {
    win.loadURL(site)
    win.webContents.on('did-finish-load', () => {
      win.webContents.setZoomFactor(0.95)
      /**
      * Uncomment to customize title bar
      win.webContents.insertCSS(`
        .titlebar {
          height: 20px;
          background: #000000;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
        }
      `);
      */
    })
    win.webContents.on('context-menu', (params) => {
      win.webContents.executeJavaScript(`
        document.dispatchEvent(
          new MouseEvent('contextmenu', {
            bubbles:true, clientX:${params.x}, clientY:${params.y}
          })
        );
      `)
    })
  } else {
    win.loadURL('data:text/plain,No sites are available.')
  }
}
app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
