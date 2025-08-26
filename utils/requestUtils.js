function requestLogger(req) {
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.connection.remoteAddress
  const url = req.url
  console.log(ip, url)
}
async function getReqIp(req) {
  const ip = req.connection.remoteAddress
  return ip
}
module.exports = { requestLogger, getReqIp }
