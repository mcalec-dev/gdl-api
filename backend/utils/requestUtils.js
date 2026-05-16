const log = require('./logHandler')
/** @param {import('express').Request} req @param {string} fallback */
function getRequestIp(req, fallback = '') {
  const forwardedFor = req?.headers?.['x-forwarded-for']
  const firstForwarded =
    typeof forwardedFor === 'string' ? forwardedFor.split(',')[0].trim() : ''
  return (
    req?.headers?.['cf-connecting-ip'] ||
    firstForwarded ||
    req?.connection?.remoteAddress ||
    req?.socket?.remoteAddress ||
    /** @type {any} */ (req?.connection)?.socket?.remoteAddress ||
    fallback
  )
}
/**
 * @param {import('express').Request} req
 * @returns {string}
 */
function getRequestUserAgent(req) {
  const useragent = /** @type {any} */ (req).useragent
  if (typeof useragent === 'string') return useragent
  if (useragent && typeof useragent.source === 'string') {
    return useragent.source
  }
  return req?.useragent?.source || ''
}
/**
 * @param {import('express').Request} req
 */
function requestLogger(req) {
  const ip = getRequestIp(req, 'unknown')
  const url = req.url
  const useragent = getRequestUserAgent(req)
  log.info('Incoming request', { ip, url, useragent })
}
/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function setReqVars(req, res, next) {
  const reqAny = /** @type {any} */ (req)
  reqAny.ip = getRequestIp(req)
  reqAny.useragent = getRequestUserAgent(req)
  next()
}
module.exports = {
  getRequestUserAgent,
  requestLogger,
  setReqVars,
}
