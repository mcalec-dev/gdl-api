const ms = require('ms')
const dotenv = require('dotenv')
const debug = require('debug')('gdl-api:config')
const https = require('https')
const http = require('http')
const path = require('path')
const fs = require('fs')
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
function validatePath(baseDirPath) {
  if (!baseDirPath || typeof baseDirPath !== 'string') {
    throw new Error('BASE_DIR environment variable must be set and be a string')
  }
  try {
    const resolvedPath = path.resolve(baseDirPath)
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`BASE_DIR does not exist: ${resolvedPath}`)
    }
    const stats = fs.statSync(resolvedPath)
    if (!stats.isDirectory()) {
      throw new Error(`BASE_DIR is not a directory: ${resolvedPath}`)
    }
    return resolvedPath
  } catch (error) {
    if (error.message.includes('BASE_DIR')) {
      throw error
    }
    throw new Error(`Invalid BASE_DIR configuration: ${error.message}`)
  }
}
const NODE_ENV = process.env.NODE_ENV
const PORT = process.env.PORT
const NAME = process.env.NAME
const HOST = getHost()
const BASE_PATH = process.env.BASE_PATH
const BASE_DIR = validatePath(process.env.BASE_DIR)
const DISALLOWED_DIRS = JSON.parse(process.env.DISALLOWED_DIRS)
const DISALLOWED_FILES = JSON.parse(process.env.DISALLOWED_FILES)
const DISALLOWED_EXTENSIONS = JSON.parse(process.env.DISALLOWED_EXTENSIONS)
const MONGODB_URL = process.env.MONGODB_URL
const SESSION_SECRET = process.env.SESSION_SECRET
const JWT_SECRET = process.env.JWT_SECRET
const COOKIE_MAX_AGE = ms(process.env.COOKIE_MAX_AGE)
const MAX_DEPTH = process.env.MAX_DEPTH
const PAGINATION_LIMIT = process.env.PAGINATION_LIMIT
const RATE_LIMIT_WINDOW = ms(process.env.RATE_LIMIT_WINDOW)
const RATE_LIMIT_MAX = process.env.RATE_LIMIT_MAX
const TROLLING_CHANCE = parseFloat(process.env.TROLLING_CHANCE)
const TROLLING_TERMS = JSON.parse(process.env.TROLLING_TERMS)
const AUTO_SCAN = parseBooleanEnv(process.env.AUTO_SCAN)
const OAUTH_PROVIDERS = JSON.parse(process.env.OAUTH_PROVIDERS)
const FILE_UPLOAD_LIMIT = process.env.FILE_UPLOAD_LIMIT
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
  JWT_SECRET,
  COOKIE_MAX_AGE,
  MAX_DEPTH,
  PAGINATION_LIMIT,
  RATE_LIMIT_WINDOW,
  RATE_LIMIT_MAX,
  TROLLING_CHANCE,
  TROLLING_TERMS,
  AUTO_SCAN,
  OAUTH_PROVIDERS,
  FILE_UPLOAD_LIMIT,
  debug,
}
