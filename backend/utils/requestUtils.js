function requestLogger(req) {
  const ip =
    req.headers['cf-connecting-ip'] ||
    req.headers['X-Forwarded-For']?.split(',')[0] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.connection.socket?.remoteAddress ||
    'unknown'
  const url = req.url
  const useragent = req.headers['user-agent'] || req.get('User-Agent') || ''
  console.log(ip, url, useragent)
}
function setReqVars(req, res, next) {
  req.ip =
    req.headers['cf-connecting-ip'] ||
    req.headers['X-Forwarded-For']?.split(',')[0] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.connection.socket?.remoteAddress ||
    'unknown'
  req.useragent = req.headers['user-agent'] || req.get('User-Agent') || ''
  next()
}
module.exports = {
  requestLogger,
  setReqVars,
}
