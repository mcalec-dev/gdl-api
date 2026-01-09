function requestLogger(req) {
  const ip =
    req.headers['X-Forwarded-For']?.split(',')[0] ||
    req.headers['cf-connecting-ip'] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.connection.socket?.remoteAddress ||
    'unknown'
  const url = req.url
  console.log(ip, url)
}
async function getReqIp(req) {
  const ip = req.connection.remoteAddress
  return ip
}
module.exports = { requestLogger, getReqIp }
