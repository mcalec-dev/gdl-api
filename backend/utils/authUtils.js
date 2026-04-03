const { connection } = require('mongoose')
const log = require('./logHandler')
function requireRole(role) {
  if (!role) {
    throw new Error('Role is required for requireRole middleware')
  }
  return (req, res, next) => {
    if (!req.user) {
      log.warn('Unauthorized access attempt')
      return res.status(401).json({
        message: 'Unauthorized',
        status: 401,
      })
    }
    if (
      req.isAuthenticated() &&
      req.user &&
      req.user.roles &&
      req.user.roles.includes(role)
    ) {
      log.debug(`${req.user.username} has role(s):`, role)
      return next()
    }
    log.warn(
      `${req.user ? req.user.username : 'unknown'}, doesn't have role(s):`,
      role
    )
    return res.status(403).json({
      message: 'Forbidden',
      status: 403,
    })
  }
}
function requireAnyRole(roles) {
  return (req, res, next) => {
    if (
      req.isAuthenticated() &&
      (req.user || roles.some((r) => req.user.roles.includes(r)))
    ) {
      return next()
    }
    log.warn('User does not have any of the roles:' + roles)
    return res.status(403).json({
      message: 'Forbidden',
      status: 403,
    })
  }
}
function requireAuth(req, res, next) {
  if (!req.isAuthenticated()) {
    log.warn('Unauthorized access attempt: user not authenticated via passport')
    return res.status(401).json({
      message: 'Unauthorized',
      status: 401,
    })
  }
  if (!req.user) {
    log.warn('Unauthorized access attempt: no user object in request')
    return res.status(401).json({
      message: 'Unauthorized',
      status: 401,
    })
  }
  if (!req.session) {
    log.warn(
      'Unauthorized access attempt: no session found for user:',
      req.user.username
    )
    return res.status(401).json({
      message: 'Unauthorized',
      status: 401,
    })
  }
  if (req.session.expires && new Date(req.session.expires) < new Date()) {
    log.warn('Session expired for user:', req.user.username)
    return res.status(401).json({
      message: 'Unauthorized',
      status: 401,
    })
  }
  log.debug('User,', req.user.username, 'authenticated with valid session')
  return next()
}
async function countActiveSessions() {
  return connection.collection('sessions').countDocuments({
    expires: { $gt: new Date() },
  })
}
module.exports = {
  requireRole,
  requireAnyRole,
  requireAuth,
  countActiveSessions,
}
