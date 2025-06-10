const path = require('path');
const { BASE_PATH } = require('../config');
const debug = require('debug')('gdl-api:urlUtils');

function normalizeUrl(req, relativePath) {
  const protocol = req.protocol;
  const host = req.get('host');
  const baseUrl = `${protocol}://${host}`;
  const dirPath = path.resolve(relativePath).replace(/\\/g, '/');
  const normalizedPath = dirPath.replace(/F:\/gdl-api\//i, '');
  return {
    path: `${BASE_PATH}/api/files/${normalizedPath.replace(/^F:\/gallery-dl\//i, '')}`,
    url: `${baseUrl}${BASE_PATH}/api/files/${normalizedPath.replace(/^F:\/gallery-dl\//i, '')}`
  };
}
function getAPIUrl(req) {
  const protocol = req.protocol;
  const host = req.get('host');
  const apiURL = `${protocol}://${host}${BASE_PATH}/api`;
  debug('Generated API URL:', apiURL);
  return apiURL;
}
function getHostUrl(req) {
  const protocol = req.protocol;
  const host = req.get('host');
  const hostURL = `${protocol}://${host}${BASE_PATH}`;
  debug('Generated host URL:', hostURL);
  return hostURL;
}
module.exports = { 
  normalizeUrl,
  getAPIUrl,
  getHostUrl,
};