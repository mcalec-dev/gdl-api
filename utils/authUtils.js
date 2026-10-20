const log = require('./logHandler')
const User = require('../models/User')
const { countActiveSessions: countStoreSessions } = require('./sessionStore')

/** @param {import('express').Response} res @param {number} status @param {string} message */
function sendAuthError(res, status, message) {
  return res.status(status).json({
    message,
    status,
  })
}

/** @param {any} user @param {string} role */
function userHasRole(user, role) {
  return Boolean(user && Array.isArray(user.roles) && user.roles.includes(role))
}

/** @param {string} role */
function requireRole(role) {
  if (!role) {
    throw new Error('Role is required for requireRole middleware')
  }
  /** @type {import('express').RequestHandler} */
  return (req, res, next) => {
    const reqAny = /** @type {any} */ (req)
    if (!req.user || !req.isAuthenticated()) {
      log.warn('Unauthorized access attempt')
      return sendAuthError(res, 401, 'Unauthorized')
    }
    if (userHasRole(req.user, role)) {
      log.debug(`${reqAny.user?.username || 'unknown'} has role(s):`, role)
      return next()
    }
    log.warn(
      `${reqAny.user?.username || 'unknown'}, doesn't have role(s):`,
      role
    )
    return sendAuthError(res, 403, 'Forbidden')
  }
}

/** @param {string[]} roles */
function requireAnyRole(roles) {
  const requiredRoles = Array.isArray(roles) ? roles : []
  /** @type {import('express').RequestHandler} */
  return (req, res, next) => {
    const reqAny = /** @type {any} */ (req)
    if (
      req.isAuthenticated() &&
      req.user &&
      Array.isArray(reqAny.user?.roles) &&
      requiredRoles.some((r) => reqAny.user.roles.includes(r))
    ) {
      return next()
    }
    log.warn('User does not have any of the roles:' + requiredRoles.join(','))
    return sendAuthError(res, 403, 'Forbidden')
  }
}

/** @type {import('express').RequestHandler} */
function requireAuth(req, res, next) {
  const reqAny = /** @type {any} */ (req)
  if (!req.isAuthenticated()) {
    log.warn('Unauthorized access attempt: user not authenticated via passport')
    return sendAuthError(res, 401, 'Unauthorized')
  }
  if (!req.user) {
    log.warn('Unauthorized access attempt: no user object in request')
    return sendAuthError(res, 401, 'Unauthorized')
  }
  if (!req.session) {
    log.warn(
      'Unauthorized access attempt: no session found for user:',
      reqAny.user?.username || 'unknown'
    )
    return sendAuthError(res, 401, 'Unauthorized')
  }
  if (
    reqAny.session?.expires &&
    new Date(reqAny.session.expires) < new Date()
  ) {
    log.warn('Session expired for user:', reqAny.user?.username || 'unknown')
    return sendAuthError(res, 401, 'Unauthorized')
  }
  log.debug(
    'User,',
    reqAny.user?.username || 'unknown',
    'authenticated with valid session'
  )
  return next()
}

/**
 * @type {import('express').RequestHandler}
 */
async function enforceActiveSession(req, res, next) {
  if (!req.isAuthenticated?.()) {
    return next()
  }
  const user = /** @type {any} */ (req.user)
  const sessionData = /** @type {any} */ (req.session)
  const userUuid = user?.uuid
  const sessionUuid = sessionData?.uuid
  try {
    let isActive = false
    if (userUuid && sessionUuid) {
      const activeUser = await User.collection.findOne(
        {
          uuid: String(userUuid),
          status: { $nin: ['inactive', 'banned'] },
          sessions: {
            $elemMatch: {
              uuid: String(sessionUuid),
              expires: { $gt: new Date() },
            },
          },
        },
        {
          projection: { _id: 1 },
        }
      )
      isActive = Boolean(activeUser)
    }
    if (isActive) {
      return next()
    }
    const rejectSession = () => {
      res.clearCookie('connect.sid', { path: '/' })
      return res.status(401).json({
        status: 401,
        message: 'Session expired or revoked',
      })
    }
    if (!req.session) {
      return rejectSession()
    }
    return req.session.destroy((error) => {
      if (error) {
        return next(error)
      }
      return rejectSession()
    })
  } catch (error) {
    log.error('Failed to validate active session:', error)
    return next(error)
  }
}

async function countActiveSessions() {
  return countStoreSessions()
}

module.exports = {
  requireRole,
  requireAnyRole,
  requireAuth,
  enforceActiveSession,
  countActiveSessions,
}
