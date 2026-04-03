const ms = require('ms')
const bytes = require('bytes')
const dotenv = require('dotenv')
const https = require('https')
const http = require('http')
const path = require('path')
const fs = require('fs')
dotenv.config({ quiet: true })
/**
 * @typedef {'array' | 'number' | 'boolean' | 'string' | 'object'} ExpectedType
 */
/**
 * @typedef {{
 *   env: string | null,
 *   parse: (value: string | undefined) => unknown,
 *   type: ExpectedType | ExpectedType[],
 *   allowPromise?: boolean
 * }} SchemaEntry
 */
/** @param {string | undefined} host */
function checkHostOnline(host) {
  return new Promise((resolve) => {
    if (!host) return resolve(false)
    const url =
      host.startsWith('http://') || host.startsWith('https://')
        ? host
        : `http://${host}`
    const protocol = url.startsWith('https') ? https : http
    const req = protocol.get(url, (res) => {
      const statusCode = res.statusCode ?? 0
      return resolve(statusCode >= 200 && statusCode < 500)
    })
    req.on('error', () => resolve(false))
    req.setTimeout(3000, () => {
      req.destroy()
      return resolve(false)
    })
  })
}
/** @returns {Promise<string | undefined>} */
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
      console.debug('Primary host is online:', host)
      return host
    }
    if (altHostOnline) {
      console.debug('Alternate host is online:', altHost)
      return altHost
    }
  } catch (error) {
    console.warn('Both hosts are offline:', error)
    return undefined
  }
}
/** @param {unknown} value */
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
/** @param {unknown} value @param {string} envName */
function parseIntegerEnv(value, envName) {
  const parsed = parseInt(String(value), 10)
  if (!Number.isFinite(parsed)) {
    throw new Error(`${envName} must be a valid integer`)
  }
  return parsed
}
/** @param {unknown} value @param {string} envName */
function parseNumberEnv(value, envName) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    throw new Error(`${envName} must be a valid number`)
  }
  return parsed
}
/** @param {unknown} value @param {string} envName */
function parseJsonArrayEnv(value, envName) {
  if (typeof value !== 'string') {
    throw new Error(`${envName} must be a valid JSON array`)
  }
  let parsed
  try {
    parsed = JSON.parse(value)
  } catch {
    throw new Error(`${envName} must be a valid JSON array`)
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`${envName} must be a JSON array`)
  }
  return parsed
}
/** @param {unknown} value @param {string} envName */
function parseMsEnv(value, envName) {
  if (typeof value !== 'string') {
    throw new Error(`${envName} must be a valid duration string`)
  }
  const parsed = ms(/** @type {import('ms').StringValue} */ (value))
  if (!Number.isFinite(parsed)) {
    throw new Error(`${envName} must be a valid duration string`)
  }
  return parsed
}
/** @param {unknown} value */
function parseOptionalTrimmedString(value) {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}
/**
 * @param {string} key
 * @param {unknown} value
 * @param {ExpectedType | ExpectedType[]} expectedTypes
 * @param {boolean} [allowPromise=false]
 */
function validateParsedEnvType(
  key,
  value,
  expectedTypes,
  allowPromise = false
) {
  if (value === undefined || value === null) return
  if (
    allowPromise &&
    typeof value === 'object' &&
    value !== null &&
    'then' in value &&
    typeof value.then === 'function'
  ) {
    return
  }
  const types = Array.isArray(expectedTypes) ? expectedTypes : [expectedTypes]
  const isValid = types.some((expectedType) => {
    switch (expectedType) {
      case 'array':
        return Array.isArray(value)
      case 'number':
        return Number.isFinite(value)
      case 'boolean':
        return typeof value === 'boolean'
      case 'string':
        return typeof value === 'string'
      case 'object':
        return value && typeof value === 'object' && !Array.isArray(value)
      default:
        return false
    }
  })
  if (!isValid) {
    throw new Error(
      `${key} has invalid type after parsing. Expected ${types.join(' or ')}`
    )
  }
}
/** @param {unknown} baseDirPath */
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
    if (error instanceof Error && error.message.includes('BASE_DIR')) {
      throw error
    }
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Invalid BASE_DIR configuration: ${message}`)
  }
}
/** @type {Record<string, SchemaEntry>} */
const schema = {
  NODE_ENV: { env: 'NODE_ENV', parse: (v) => v, type: 'string' },
  PORT: {
    env: 'PORT',
    parse: (v) => parseIntegerEnv(v, 'PORT'),
    type: 'number',
  },
  NAME: { env: 'NAME', parse: (v) => v, type: 'string' },
  HOST: { env: null, parse: getHost, type: 'string', allowPromise: true },
  BASE_PATH: { env: 'BASE_PATH', parse: (v) => v, type: 'string' },
  BASE_DIR: { env: 'BASE_DIR', parse: validatePath, type: 'string' },
  DISALLOWED_DIRS: {
    env: 'DISALLOWED_DIRS',
    parse: (v) => parseJsonArrayEnv(v, 'DISALLOWED_DIRS'),
    type: 'array',
  },
  DISALLOWED_FILES: {
    env: 'DISALLOWED_FILES',
    parse: (v) => parseJsonArrayEnv(v, 'DISALLOWED_FILES'),
    type: 'array',
  },
  DISALLOWED_EXTENSIONS: {
    env: 'DISALLOWED_EXTENSIONS',
    parse: (v) => parseJsonArrayEnv(v, 'DISALLOWED_EXTENSIONS'),
    type: 'array',
  },
  MONGODB_URL: { env: 'MONGODB_URL', parse: (v) => v, type: 'string' },
  REDIS_URL: {
    env: 'REDIS_URL',
    parse: parseOptionalTrimmedString,
    type: 'string',
  },
  REDIS_CACHE_TTL_SECONDS: {
    env: 'REDIS_CACHE_TTL_SECONDS',
    parse: (v) => parseMsEnv(v, 'REDIS_CACHE_TTL_SECONDS'),
    type: 'number',
  },
  REDIS_CACHE_PATCH_FLAG: {
    env: 'REDIS_CACHE_PATCH_FLAG',
    parse: (v) =>
      typeof v === 'string' && v.trim()
        ? v.trim()
        : 'gdl.redis.cache.layer.patched',
    type: 'string',
  },
  SESSION_SECRET: { env: 'SESSION_SECRET', parse: (v) => v, type: 'string' },
  JWT_SECRET: { env: 'JWT_SECRET', parse: (v) => v, type: 'string' },
  COOKIE_MAX_AGE: {
    env: 'COOKIE_MAX_AGE',
    parse: (v) => parseMsEnv(v, 'COOKIE_MAX_AGE'),
    type: 'number',
  },
  MAX_DEPTH: {
    env: 'MAX_DEPTH',
    parse: (v) => parseIntegerEnv(v, 'MAX_DEPTH'),
    type: 'number',
  },
  STAT_DIRECTORY_SIZE: {
    env: 'STAT_DIRECTORY_SIZE',
    parse: parseBooleanEnv,
    type: 'boolean',
  },
  STAT_FILE_SIZE: {
    env: 'STAT_FILE_SIZE',
    parse: parseBooleanEnv,
    type: 'boolean',
  },
  PAGINATION_LIMIT: {
    env: 'PAGINATION_LIMIT',
    parse: (v) => parseIntegerEnv(v, 'PAGINATION_LIMIT'),
    type: 'number',
  },
  RATE_LIMIT_WINDOW: {
    env: 'RATE_LIMIT_WINDOW',
    parse: (v) => parseMsEnv(v, 'RATE_LIMIT_WINDOW'),
    type: 'number',
  },
  RATE_LIMIT_MAX: {
    env: 'RATE_LIMIT_MAX',
    parse: (v) => parseIntegerEnv(v, 'RATE_LIMIT_MAX'),
    type: 'number',
  },
  TROLLING_CHANCE: {
    env: 'TROLLING_CHANCE',
    parse: (v) => parseNumberEnv(v, 'TROLLING_CHANCE'),
    type: 'number',
  },
  TROLLING_TERMS: {
    env: 'TROLLING_TERMS',
    parse: (v) => parseJsonArrayEnv(v, 'TROLLING_TERMS'),
    type: 'array',
  },
  AUTO_SCAN: { env: 'AUTO_SCAN', parse: parseBooleanEnv, type: 'boolean' },
  UPSERT_ON_ACCESS: {
    env: 'UPSERT_ON_ACCESS',
    parse: (v) => v,
    type: 'string',
  },
  OAUTH_PROVIDERS: {
    env: 'OAUTH_PROVIDERS',
    parse: (v) => parseJsonArrayEnv(v, 'OAUTH_PROVIDERS'),
    type: 'array',
  },
  FILE_UPLOAD_LIMIT: {
    env: 'FILE_UPLOAD_LIMIT',
    parse: (v) => (typeof v === 'string' ? bytes(v) : undefined),
    type: 'number',
  },
  HASH_ALGORITHM: { env: 'HASH_ALGORITHM', parse: (v) => v, type: 'string' },
  MAX_PIXELS: {
    env: 'MAX_PIXELS',
    parse: (v) => parseIntegerEnv(v, 'MAX_PIXELS'),
    type: 'number',
  },
  MAX_SCALE: {
    env: 'MAX_SCALE',
    parse: (v) => parseIntegerEnv(v, 'MAX_SCALE'),
    type: 'number',
  },
  MAX_BUFFER_SIZE: {
    env: 'MAX_BUFFER_SIZE',
    parse: (v) => (typeof v === 'string' ? bytes(v) : undefined),
    type: 'number',
  },
  MAX_SEARCH_RESULTS: {
    env: 'MAX_SEARCH_RESULTS',
    parse: (v) => parseIntegerEnv(v, 'MAX_SEARCH_RESULTS'),
    type: 'number',
  },
  SIDECAR_FILE: {
    env: 'SIDECAR_FILE',
    parse: parseBooleanEnv,
    type: 'boolean',
  },
  SIDECAR_FILE_EXTENSION: {
    env: 'SIDECAR_FILE_EXTENSION',
    parse: (v) => {
      const extension =
        typeof v === 'string' && v.trim() ? v.trim().toLowerCase() : '.json'
      return extension.startsWith('.') ? extension : `.${extension}`
    },
    type: 'string',
  },
  LOG_LEVEL: {
    env: 'LOG_LEVEL',
    parse: (v) => {
      const intValue = parseInt(String(v), 10)
      return Number.isFinite(intValue) && String(intValue) === String(v).trim()
        ? intValue
        : v
    },
    type: ['string', 'number'],
  },
}
/** @type {Record<string, unknown>} */
const config = {}
for (const [key, entry] of Object.entries(schema)) {
  const { env, parse, type, allowPromise } = entry
  const value = env ? process.env[env] : undefined
  const parsed = parse(value)
  validateParsedEnvType(key, parsed, type, allowPromise)
  config[key] = parsed
}
const hostValue = config['HOST']
config['HOST'] =
  hostValue instanceof Promise ? hostValue.then((host) => host) : undefined
console.info('Config loaded successfully')
module.exports = config
