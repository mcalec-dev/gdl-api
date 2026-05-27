const log = require('./logHandler')
/** @param {string | undefined | null} ip */
function normalizeIp(ip) {
  if (typeof ip !== 'string') return ''
  const trimmed = ip.trim()
  if (!trimmed) return ''
  return trimmed.replace(/^::ffff:/, '')
}
/** @param {import('express').Request} req */
function getRequestIp(req) {
  const ip = normalizeIp(typeof req?.ip === 'string' ? req.ip : '')
  return ip
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
  const ip = getRequestIp(req)
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
  const ip = getRequestIp(req)
  reqAny.ip = ip
  reqAny.useragent = getRequestUserAgent(req)
  next()
}
module.exports = {
  getRequestIp,
  getRequestUserAgent,
  requestLogger,
  setReqVars,
}
