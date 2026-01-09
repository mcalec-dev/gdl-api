const debug = require('debug')('gdl-api:requireAuth')
module.exports = (req, res, next) => {
  if (!req.auth) {
    debug('Unauthorized access attempt:', req.ip, req.path)
    return res.status(401).json({
      message: 'Unauthorized',
      status: '401',
    })
  }
  debug('Authorized user:', req.auth.sub || req.auth.id, 'accessing', req.path)
  next()
}
