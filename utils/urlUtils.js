const path = require('path')
const { BASE_PATH } = require('../config')
const debug = require('debug')('gdl-api:utils:url')
function normalizeUrl(req, relativePath) {
  const protocol = req.protocol
  const host = req.get('host')
  const baseUrl = `${protocol}://${host}`
  const dirPath = path.resolve(relativePath).replace(/\\/g, '/')
  debug('Normalized path:', dirPath)
  return {
    path: `${BASE_PATH}/api/files/${dirPath}`,
    url: `${baseUrl}${BASE_PATH}/api/files/${dirPath}`,
  }
}
function getAPIUrl(req) {
  return () => {
    const apiURL = getHostUrl(req) + '/api'
    return apiURL
  }
}
function getHostUrl(req) {
  return () => {
    const protocol = req.protocol
    const host = req.get('host')
    const hostURL = `${protocol}://${host}${BASE_PATH}`
    return hostURL
  }
}
module.exports = {
  normalizeUrl,
  getAPIUrl,
  getHostUrl,
}
