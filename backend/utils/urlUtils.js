const { BASE_PATH, HOST } = require('../config')
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
async function constructUrl(path) {
  const url = new URL(path, `https://${HOST}`)
  return url.toString()
}
async function constructApiUrl(path) {
  const url = new URL(path, `https://${HOST}${BASE_PATH}/api`)
  return url.toString()
}
async function getApiUrl(req) {
  const host = req.headers.host
  if (host.includes(':')) {
    const hostname = host.split(':')[0]
    const port = host.split(':')[1]
    return `${req.protocol}://${hostname}:${port}${BASE_PATH}/api`
  }
  return `${req.protocol}://${await HOST}${BASE_PATH}/api`
}
async function getHostUrl(req) {
  const host = req.headers.host
  if (host.includes(':')) {
    const hostname = host.split(':')[0]
    const port = host.split(':')[1]
    return `${req.protocol}://${hostname}:${port}${BASE_PATH}`
  }
  return `${req.protocol}://${await HOST}${BASE_PATH}`
}
module.exports = {
  normalizeUrl,
  normalizeUrlPath,
  encodeUrl,
  encodeUrlPath,
  decodeUrl,
  decodeUrlPath,
  constructUrl,
  constructApiUrl,
  getApiUrl,
  getHostUrl,
}
