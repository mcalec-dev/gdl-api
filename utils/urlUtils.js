const { BASE_PATH } = require('../config')
function normalizeUrl(url) {
  return url.replace(/\\/g, '/').replace(/\/+/g, '/').normalize()
}
function normalizeUrlPath(path) {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/').normalize()
}
function encodeUrl(url) {
  return encodeURI(url).replace(/%20/g, '+')
}
function encodeUrlPath(path) {
  return encodeURIComponent(path).replace(/%20/g, '+')
}
function decodeUrl(url) {
  return decodeURI(url.replace(/\+/g, ' '))
}
function decodeUrlPath(path) {
  return decodeURIComponent(path.replace(/\+/g, ' '))
}
function getApiUrl(req) {
  return () => {
    return `${req.protocol}://${req.hostname}${BASE_PATH}/api`
  }
}
function getHostUrl(req) {
  return () => {
    return `${req.protocol}://${req.hostname}${BASE_PATH}`
  }
}
module.exports = {
  normalizeUrl,
  normalizeUrlPath,
  encodeUrl,
  encodeUrlPath,
  decodeUrl,
  decodeUrlPath,
  getApiUrl,
  getHostUrl,
}
