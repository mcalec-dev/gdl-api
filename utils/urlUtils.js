const config = require('../config')
const BASE_PATH = config.BASE_PATH
const HOST = config.HOST
/** @param {unknown} value */
function normalizeSlashes(value) {
  return String(value || '')
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .normalize()
}
function getBasePath() {
  return typeof BASE_PATH === 'string' ? BASE_PATH : ''
}
/** @param {{ headers?: { host?: string }, protocol?: string } | undefined} req */
function getProtocol(req) {
  return typeof req?.protocol === 'string' ? req.protocol : 'https'
}
/** @param {string} value @param {(v: string) => string} encoder */
function encodeWithPlus(value, encoder) {
  return encoder(value).replace(/%20/g, '+')
}
/** @param {string} value @param {(v: string) => string} decoder */
function decodeWithPlus(value, decoder) {
  return decoder(value.replace(/\+/g, ' '))
}
/** @param {{ headers?: { host?: string }, protocol?: string } | undefined} req */
async function resolveHost(req) {
  const host = typeof req?.headers?.host === 'string' ? req.headers.host : ''
  if (host) return host
  return Promise.resolve(HOST)
}
/** @param {{ headers?: { host?: string }, protocol?: string } | undefined} req @param {string} suffix */
async function buildReqUrl(req, suffix = '') {
  const host = await resolveHost(req)
  return `${getProtocol(req)}://${host}${getBasePath()}${suffix}`
}
/** @param {string} url */
function normalizeUrl(url) {
  return normalizeSlashes(url)
}
/** @param {string} path */
function normalizeUrlPath(path) {
  return normalizeSlashes(path)
}
/** @param {string} url */
function encodeUrl(url) {
  return encodeWithPlus(url, encodeURI)
}
/** @param {string} path */
function encodeUrlPath(path) {
  return encodeWithPlus(path, encodeURIComponent)
}
/** @param {string} url */
function decodeUrl(url) {
  return decodeWithPlus(url, decodeURI)
}
/** @param {string} path */
function decodeUrlPath(path) {
  return decodeWithPlus(path, decodeURIComponent)
}
/** @param {string} path */
async function constructUrl(path) {
  const host = await resolveHost(undefined)
  const url = new URL(path, `https://${host}`)
  return url.toString()
}
/** @param {string} path */
async function constructApiUrl(path) {
  const host = await resolveHost(undefined)
  const basePath = getBasePath()
  const url = new URL(path, `https://${host}${basePath}/api`)
  return url.toString()
}
/** @param {{ headers?: { host?: string }, protocol?: string }} req */
async function getApiUrl(req) {
  return buildReqUrl(req, '/api')
}
/** @param {{ headers?: { host?: string }, protocol?: string }} req */
async function getHostUrl(req) {
  return buildReqUrl(req)
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
