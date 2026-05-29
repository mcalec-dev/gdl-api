const config = require('../../config')
const { normalizePath } = require('../pathUtils')
const { buildQueries } = require('./queryBuilder')
const { scoreResult } = require('./scoring')
const { fetchResults } = require('./repository.js')
const MAX_SEARCH_RESULTS =
  typeof config.MAX_SEARCH_RESULTS === 'number'
    ? config.MAX_SEARCH_RESULTS
    : 100
/** @param {{ q: string, type: string, basePath: string, protocol: string, hostname: string }} params */
async function searchDatabase({ q, type, basePath, protocol, hostname }) {
  const queryStr = q.toLowerCase()
  const { fileQuery, dirQuery } = buildQueries(q, type)
  /** @type {any[]} */
  const dbResults = await fetchResults(type, fileQuery, dirQuery)

  /** @type {any[]} */
  const simplifiedResults = []
  for (const result of dbResults) {
    const resultType = result.collection ? 'file' : 'directory'
    const relativePath = result.paths?.relative || ''
    const pathParts = relativePath.split('/')
    const collection = result.collection || pathParts[0] || ''
    const author = result.author || pathParts[1] || ''
    const normalizedPath = normalizePath(relativePath)
    const encodedPath = relativePath
      .split('/')
      .map(encodeURIComponent)
      .join('/')
    const fullPath = `${basePath}/api/files/${encodedPath}`.replace(/\/+/g, '/')
    const url = protocol + '://' + hostname + fullPath
    const relevancy = scoreResult(result, queryStr, resultType, type)
    if (relevancy <= 0) continue
    simplifiedResults.push({
      name: result.name,
      type: resultType,
      collection,
      author,
      path: normalizedPath,
      url,
      uuid: result.uuid,
      relevancy,
    })
  }
  simplifiedResults.sort((a, b) => b.relevancy - a.relevancy)
  if (simplifiedResults.length > MAX_SEARCH_RESULTS) {
    simplifiedResults.length = MAX_SEARCH_RESULTS
  }
  return simplifiedResults
}
module.exports = {
  searchDatabase,
}
