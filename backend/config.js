const ms = require('ms')
const bytes = require('bytes')
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
  if (!host) return undefined
  if (!altHost) return host
  if (!host && !altHost) return undefined
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
    return undefined
  }
}
function parseBooleanEnv(value) {
  if (value === undefined || value === null) return false
  const v = String(value).trim().toLowerCase()
  switch (v) {
    case '1':
    case 'true':
    case 'yes':
    case 'y':
    case 'on':
      return true
    case '0':
    case 'false':
    case 'no':
    case 'n':
    case 'off':
      return false
  }
  throw new Error(`Invalid boolean value: ${value}`)
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
const schema = {
  NODE_ENV: { env: 'NODE_ENV', parse: (v) => v },
  PORT: { env: 'PORT', parse: (v) => v },
  NAME: { env: 'NAME', parse: (v) => v },
  HOST: { env: null, parse: getHost },
  BASE_PATH: { env: 'BASE_PATH', parse: (v) => v },
  BASE_DIR: { env: 'BASE_DIR', parse: validatePath },
  DISALLOWED_DIRS: { env: 'DISALLOWED_DIRS', parse: (v) => JSON.parse(v) },
  DISALLOWED_FILES: { env: 'DISALLOWED_FILES', parse: (v) => JSON.parse(v) },
  DISALLOWED_EXTENSIONS: {
    env: 'DISALLOWED_EXTENSIONS',
    parse: (v) => JSON.parse(v),
  },
  MONGODB_URL: { env: 'MONGODB_URL', parse: (v) => v },
  SESSION_SECRET: { env: 'SESSION_SECRET', parse: (v) => v },
  JWT_SECRET: { env: 'JWT_SECRET', parse: (v) => v },
  COOKIE_MAX_AGE: { env: 'COOKIE_MAX_AGE', parse: (v) => ms(v) },
  MAX_DEPTH: { env: 'MAX_DEPTH', parse: (v) => v },
  PAGINATION_LIMIT: { env: 'PAGINATION_LIMIT', parse: (v) => v },
  RATE_LIMIT_WINDOW: { env: 'RATE_LIMIT_WINDOW', parse: (v) => ms(v) },
  RATE_LIMIT_MAX: { env: 'RATE_LIMIT_MAX', parse: (v) => v },
  TROLLING_CHANCE: { env: 'TROLLING_CHANCE', parse: (v) => parseFloat(v) },
  TROLLING_TERMS: { env: 'TROLLING_TERMS', parse: (v) => JSON.parse(v) },
  AUTO_SCAN: { env: 'AUTO_SCAN', parse: parseBooleanEnv },
  UPSERT_ON_ACCESS: { env: 'UPSERT_ON_ACCESS', parse: (v) => v },
  OAUTH_PROVIDERS: { env: 'OAUTH_PROVIDERS', parse: (v) => JSON.parse(v) },
  FILE_UPLOAD_LIMIT: { env: 'FILE_UPLOAD_LIMIT', parse: (v) => bytes(v) },
  HASH_ALGORITHM: { env: 'HASH_ALGORITHM', parse: (v) => v },
  MAX_PIXELS: { env: 'MAX_PIXELS', parse: (v) => parseInt(v, 10) },
  MAX_SCALE: { env: 'MAX_SCALE', parse: (v) => parseInt(v, 10) },
  MAX_BUFFER_SIZE: { env: 'MAX_BUFFER_SIZE', parse: (v) => bytes(v) },
  MAX_SEARCH_RESULTS: {
    env: 'MAX_SEARCH_RESULTS',
    parse: (v) => parseInt(v, 10),
  },
}
const config = {}
for (const [key, { env, parse }] of Object.entries(schema)) {
  const value = env ? process.env[env] : undefined
  config[key] = parse(value)
}
debug('Config loaded successfully')
config.debug = debug
module.exports = config
