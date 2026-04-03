const log = require('./logHandler')
/**
 * @param {import('express').Request} req
 */
function requestLogger(req) {
  const ip =
    req.headers['cf-connecting-ip'] ||
    /** @type {string | undefined} */ (req.headers['X-Forwarded-For'])?.split(
      ','
    )[0] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    /** @type {any} */ (req.connection).socket?.remoteAddress ||
    'unknown'
  const url = req.url
  const useragent = req.headers['user-agent'] || req.get('User-Agent') || ''
  log.info('Incoming request', { ip, url, useragent })
}
/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function setReqVars(req, res, next) {
  const reqAny = /** @type {any} */ (req)
  reqAny.ip =
    req.headers['cf-connecting-ip'] ||
    /** @type {string | undefined} */ (req.headers['X-Forwarded-For'])?.split(
      ','
    )[0] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    /** @type {any} */ (req.connection).socket?.remoteAddress ||
    ''
  reqAny.useragent = req.headers['user-agent'] || req.get('User-Agent') || ''
  next()
}
module.exports = {
  requestLogger,
  setReqVars,
}
