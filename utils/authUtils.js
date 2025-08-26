const mongoose = require('mongoose')
const debug = require('debug')('gdl:utils:auth')
function requireRole(role) {
  return (req, res, next) => {
    if (
      req.isAuthenticated() &&
      req.user &&
      req.user.roles &&
      req.user.roles.includes(role)
    ) {
      debug('User:', req.user.username, 'has role:', role)
      return next()
    }
    debug(
      'User:',
      req.user ? req.user.username : 'unknown',
      'does not have role:',
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
    debug('User does not have any of the roles:' + roles)
    return res.status(403).json({
      message: 'Forbidden',
      status: 403,
    })
  }
}
async function countActiveSessions() {
  return mongoose.connection.collection('sessions').countDocuments({
    expires: { $gt: new Date() },
  })
}
module.exports = { requireRole, requireAnyRole, countActiveSessions }
