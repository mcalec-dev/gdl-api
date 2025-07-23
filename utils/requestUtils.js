function requestLogger(req) {
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.connection.remoteAddress
  console.log(ip)
}
module.exports = requestLogger
