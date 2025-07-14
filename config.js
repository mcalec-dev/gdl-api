const dotenv = require('dotenv')
const debug = require('debug')('gdl-api:config')
const https = require('https')
const http = require('http')
dotenv.config()
const parseJsonEnv = (envVar) => {
  return JSON.parse(envVar)
}
const checkHostOnline = async (host) => {
  return new Promise((resolve) => {
    if (!host) return resolve(false)
    const protocol = host.startsWith('https') ? https : http
    const req = protocol.get(host, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 500)
    })
    req.on('error', () => resolve(false))
    req.setTimeout(3000, () => {
      req.destroy()
      resolve(false)
    })
  })
}
async function getHost() {
  const host = `https://${process.env.HOST}`
  const altHost = `https://${process.env.ALT_HOST}`
  debug('Checking primary host:', host)
  if (await checkHostOnline(host)) {
    debug('Primary host is online:', host)
    return host
  }
  debug('Primary host offline, checking alternate host:', altHost)
  if (await checkHostOnline(altHost)) {
    debug('Alternate host is online:', altHost)
    return altHost
  }
  debug('Both hosts are offline!')
}
const NODE_ENV = process.env.NODE_ENV
debug('Node environment:', NODE_ENV)
const PORT = process.env.PORT
debug('Port:', PORT)
const HOST = getHost()
debug('Host:', HOST)
const BASE_PATH = process.env.BASE_PATH
debug('Base path:', BASE_PATH)
const GALLERY_DL_DIR = process.env.GALLERY_DL_DIR
debug('Gallery-dl directory:', GALLERY_DL_DIR)
const DISALLOWED_DIRS = parseJsonEnv(process.env.DISALLOWED_DIRS)
debug('Disallowed directories:', DISALLOWED_DIRS)
const DISALLOWED_FILES = parseJsonEnv(process.env.DISALLOWED_FILES)
debug('Disallowed files:', DISALLOWED_FILES)
const DISALLOWED_EXTENSIONS = parseJsonEnv(process.env.DISALLOWED_EXTENSIONS)
debug('Disallowed extensions:', DISALLOWED_EXTENSIONS)
const DB_DIR = process.env.DB_DIR
debug('Database directory:', DB_DIR)
const SESSION_SECRET = process.env.SESSION_SECRET
debug('Session secret:', SESSION_SECRET)
module.exports = {
  NODE_ENV,
  PORT,
  BASE_PATH,
  HOST,
  GALLERY_DL_DIR,
  DISALLOWED_DIRS,
  DISALLOWED_FILES,
  DISALLOWED_EXTENSIONS,
  SESSION_SECRET,
  debug,
}
