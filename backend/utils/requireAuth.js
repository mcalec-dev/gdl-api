const log = require('./logHandler')
/** @typedef {import('express').Request & { auth?: Record<string, any> }} AuthRequest */
/**
 * @param {AuthRequest} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
module.exports = (req, res, next) => {
  if (!req.auth) {
    log.debug('Unauthorized access attempt:', req.ip, req.path)
    return res.status(401).json({
      message: 'Unauthorized',
      status: '401',
    })
  }
  log.debug(
    'Authorized user:',
    req.auth.sub || req.auth.id,
    'accessing',
    req.path
  )
  next()
}
