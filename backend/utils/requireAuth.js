const log = require('./logHandler')
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
