const ejwt = require('express-jwt')
const { JWT_SECRET } = require('../config')
const expressjwt = ejwt.expressjwt || ejwt
module.exports = expressjwt({
  secret: JWT_SECRET,
  algorithms: ['HS256'],
  credentialsRequired: false,
  getToken: (req) => {
    if (!req || !req.headers) return null
    if (
      req.headers.authorization &&
      req.headers.authorization.split(' ')[0] === 'Bearer'
    ) {
      return req.headers.authorization.split(' ')[1]
    }
    if (req.cookies && req.cookies.token) return req.cookies.token
    return null
  },
})
