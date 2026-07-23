const log = require('../logHandler')
const File = require('../../models/File')
const Directory = require('../../models/Directory')
const config = require('../../config')

/** @param {any} query @param {string} type */
async function findLimited(query, type) {
  if (!query) return []
  if (type !== 'file' && type !== 'directory') {
    log.warn('Invalid type for findLimited: %s', type)
    return []
  }
  if (type === 'file') {
    return File.find(query).limit(config.MAX_SEARCH_RESULTS).lean()
  }
  if (type === 'directory') {
    return Directory.find(query).limit(config.MAX_SEARCH_RESULTS).lean()
  }
  log.warn('Unknown type for findLimited: %s', type)
  return []
}

/** @param {string} type @param {any} fileQuery @param {any} dirQuery */
async function fetchResults(type, fileQuery, dirQuery) {
  if (type === 'file' || type === 'uuid' || type === 'hash') {
    return findLimited(fileQuery, 'file')
  }
  if (type === 'directory') {
    return findLimited(dirQuery, 'directory')
  }
  const [filesRes, dirsRes] = await Promise.all([
    findLimited(fileQuery, 'file'),
    findLimited(dirQuery, 'directory'),
  ])
  return [...filesRes, ...dirsRes]
}

module.exports = {
  findLimited,
  fetchResults,
}
