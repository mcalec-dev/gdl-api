const ms = require('ms')
const dotenv = require('dotenv')
const debug = require('debug')('gdl-api:config')
const https = require('https')
const http = require('http')
dotenv.config({ quiet: true })
function checkHostOnline(host) {
  return new Promise((resolve) => {
    if (!host) return resolve(false)
    const url =
      host.startsWith('http://') || host.startsWith('https://')
        ? host
        : `http://${host}`
    const protocol = url.startsWith('https') ? https : http
    const req = protocol.get(url, (res) => {
      return resolve(res.statusCode >= 200 && res.statusCode < 500)
    })
    req.on('error', () => resolve(false))
    req.setTimeout(3000, () => {
      req.destroy()
      return resolve(false)
    })
  })
}
async function getHost() {
  const host = process.env.HOST
  const altHost = process.env.ALT_HOST
  if (!host) return null
  if (!altHost) return host
  if (!host && !altHost) return null
  if (host === altHost) return host
  const hostOnline = await checkHostOnline(host)
  const altHostOnline = await checkHostOnline(altHost)
  try {
    if (hostOnline) {
      debug('Primary host is online:', host)
      return host
    }
    if (altHostOnline) {
      debug('Alternate host is online:', altHost)
      return altHost
    }
  } catch (error) {
    debug('Both hosts are offline:', error)
    return null
  }
}
function parseBooleanEnv(value) {
  if (value === undefined || value === null) return false
  const v = String(value).trim().toLowerCase()
  if (v === '1' || v === 'true' || v === 'yes' || v === 'y' || v === 'on')
    return true
  else return false
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
const CSRF_SECRET = process.env.CSRF_SECRET
debug('CSRF secret:', CSRF_SECRET)
const COOKIE_MAX_AGE = ms(process.env.COOKIE_MAX_AGE)
debug('Max cookie age (ms):', COOKIE_MAX_AGE)
const MAX_DEPTH = process.env.MAX_DEPTH
debug('Max depth:', MAX_DEPTH)
const RATE_LIMIT_WINDOW = ms(process.env.RATE_LIMIT_WINDOW)
debug('Rate limit window (ms):', RATE_LIMIT_WINDOW)
const RATE_LIMIT_MAX = process.env.RATE_LIMIT_MAX
debug('Rate limit max:', RATE_LIMIT_MAX)
const TROLLING_CHANCE = parseFloat(process.env.TROLLING_CHANCE)
debug('Trolling chance:', TROLLING_CHANCE)
const TROLLING_TERMS = JSON.parse(process.env.TROLLING_TERMS)
debug('Trolling terms:', TROLLING_TERMS)
const BOT_USER_AGENTS = JSON.parse(process.env.BOT_USER_AGENTS)
debug('Bot user agents:', BOT_USER_AGENTS)
const AUTO_SCAN = parseBooleanEnv(process.env.AUTO_SCAN)
debug('Auto scan enabled:', AUTO_SCAN)
const OAUTH_PROVIDERS = JSON.parse(process.env.OAUTH_PROVIDERS)
debug('OAuth Providers:', OAUTH_PROVIDERS)
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
  CSRF_SECRET,
  COOKIE_MAX_AGE,
  MAX_DEPTH,
  RATE_LIMIT_WINDOW,
  RATE_LIMIT_MAX,
  TROLLING_CHANCE,
  TROLLING_TERMS,
  BOT_USER_AGENTS,
  AUTO_SCAN,
  OAUTH_PROVIDERS,
  debug,
}
