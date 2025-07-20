const dotenv = require('dotenv')
const debug = require('debug')('gdl-api:config')
const https = require('https')
const http = require('http')
dotenv.config({ quiet: true })
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
  try {
    if (await checkHostOnline(host)) {
      debug('Primary host is online:', host)
      return host
    }
    if (await checkHostOnline(altHost)) {
      debug('Alternate host is online:', altHost)
      return altHost
    }
  } catch (error) {
    debug('Both hosts are offline!\n', error)
    return null
  }
}
const NODE_ENV = process.env.NODE_ENV
debug('Node environment:', NODE_ENV)
const PORT = process.env.PORT
debug('Port:', PORT)
const NAME = process.env.NAME
debug('Name:', NAME)
const HOST = getHost()
debug('Host:', HOST)
const BASE_PATH = process.env.BASE_PATH
debug('Base path:', BASE_PATH)
const BASE_DIR = process.env.BASE_DIR
debug('Base directory:', BASE_DIR)
const DISALLOWED_DIRS = JSON.parse(process.env.DISALLOWED_DIRS)
debug('Disallowed directories:', DISALLOWED_DIRS)
const DISALLOWED_FILES = JSON.parse(process.env.DISALLOWED_FILES)
debug('Disallowed files:', DISALLOWED_FILES)
const DISALLOWED_EXTENSIONS = JSON.parse(process.env.DISALLOWED_EXTENSIONS)
debug('Disallowed extensions:', DISALLOWED_EXTENSIONS)
const MONGODB_URL = process.env.MONGODB_URL
debug('MongoDB URL:', MONGODB_URL)
const SESSION_SECRET = process.env.SESSION_SECRET
debug('Session secret:', SESSION_SECRET)
module.exports = {
  NODE_ENV,
  PORT,
  NAME,
  HOST,
  BASE_PATH,
  BASE_DIR,
  DISALLOWED_DIRS,
  DISALLOWED_FILES,
  DISALLOWED_EXTENSIONS,
  MONGODB_URL,
  SESSION_SECRET,
  debug,
}
