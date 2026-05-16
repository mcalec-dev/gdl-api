const File = require('../../models/File')
const Directory = require('../../models/Directory')
const config = require('../../config')
const MAX_SEARCH_RESULTS =
  typeof config.MAX_SEARCH_RESULTS === 'number'
    ? config.MAX_SEARCH_RESULTS
    : 100
/** @param {any} query @param {typeof File | typeof Directory} Model */
async function findLimited(query, Model) {
  if (!query) return []
  return Model.find(query).limit(MAX_SEARCH_RESULTS).lean()
}
/** @param {string} type @param {any} fileQuery @param {any} dirQuery */
async function fetchResults(type, fileQuery, dirQuery) {
  if (type === 'file' || type === 'uuid' || type === 'hash') {
    return findLimited(fileQuery, File)
  }
  if (type === 'directory') {
    return findLimited(dirQuery, Directory)
  }
  const [filesRes, dirsRes] = await Promise.all([
    findLimited(fileQuery, File),
    findLimited(dirQuery, Directory),
  ])
  return [...filesRes, ...dirsRes]
}
module.exports = {
  findLimited,
  fetchResults,
}
