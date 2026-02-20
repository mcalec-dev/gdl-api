const File = require('../models/File')
const Directory = require('../models/Directory')
const { MAX_SEARCH_RESULTS } = require('../config')
const { normalizePath } = require('./pathUtils')
function escapeRegexString(str) {
  if (typeof str !== 'string') return ''
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
function scoreResult(result, queryStr, type, searchType) {
  let score = 0
  const nameLower = (result.name || '').toLowerCase()
  const pathLower = (result.paths?.relative || '').toLowerCase()
  const uuidLower = (result.uuid || '').toLowerCase()
  const hashLower = (result.hash || '').toLowerCase()
  if (searchType === 'uuid') {
    if (uuidLower === queryStr) score += 100
    else if (uuidLower.includes(queryStr)) score += 80
  } else if (searchType === 'hash') {
    if (hashLower === queryStr) score += 100
    else if (hashLower.startsWith(queryStr)) score += 80
    else if (hashLower.includes(queryStr)) score += 60
  } else {
    if (nameLower === queryStr) score += 60
    if (nameLower.startsWith(queryStr)) score += 40
    if (nameLower.includes(queryStr)) score += 25
    if (pathLower === queryStr) score += 40
    if (pathLower.startsWith(queryStr)) score += 20
    if (pathLower.includes(queryStr)) score += 10
    if (searchType === 'all') {
      if (uuidLower === queryStr) score += 50
      if (hashLower.includes(queryStr)) score += 30
    }
  }

  if (type === 'file') {
    if (nameLower.length <= 3) score -= 10
  }
  if (type === 'directory') {
    if (nameLower.length <= 3) score -= 5
  }
  score = Math.max(0, Math.min(100, score))
  return score
}
async function searchDatabase({ q, type, basePath, protocol, hostname }) {
  const queryStr = q.toLowerCase()
  const escapedQuery = escapeRegexString(q)
  let dbResults = []
  const fileQuery =
    type === 'directory'
      ? null
      : type === 'uuid'
        ? { uuid: { $eq: q } }
        : type === 'hash'
          ? { hash: { $regex: escapedQuery, $options: 'i' } }
          : {
              $or: [
                { name: { $regex: escapedQuery, $options: 'i' } },
                { 'paths.relative': { $regex: escapedQuery, $options: 'i' } },
                { collection: { $regex: escapedQuery, $options: 'i' } },
                { author: { $regex: escapedQuery, $options: 'i' } },
                { tags: { $regex: escapedQuery, $options: 'i' } },
                ...(type === 'all'
                  ? [
                      { uuid: { $eq: q } },
                      { hash: { $regex: escapedQuery, $options: 'i' } },
                    ]
                  : []),
              ],
            }
  const dirQuery =
    type === 'uuid' || type === 'hash'
      ? null
      : {
          $or: [
            { name: { $regex: escapedQuery, $options: 'i' } },
            { 'paths.relative': { $regex: escapedQuery, $options: 'i' } },
            { tags: { $regex: escapedQuery, $options: 'i' } },
          ],
        }
  if (type === 'file') {
    dbResults = fileQuery
      ? await File.find(fileQuery).limit(MAX_SEARCH_RESULTS).lean()
      : []
  } else if (type === 'directory') {
    dbResults = dirQuery
      ? await Directory.find(dirQuery).limit(MAX_SEARCH_RESULTS).lean()
      : []
  } else if (type === 'uuid' || type === 'hash') {
    dbResults = fileQuery
      ? await File.find(fileQuery).limit(MAX_SEARCH_RESULTS).lean()
      : []
  } else {
    const filesRes = fileQuery
      ? await File.find(fileQuery).limit(MAX_SEARCH_RESULTS).lean()
      : []
    const dirsRes = dirQuery
      ? await Directory.find(dirQuery).limit(MAX_SEARCH_RESULTS).lean()
      : []
    dbResults = [...filesRes, ...dirsRes]
  }
  const simplifiedResults = dbResults
    .map((result) => {
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
      const fullPath = `${basePath}/api/files/${encodedPath}`.replace(
        /\/+/g,
        '/'
      )
      const url = protocol + '://' + hostname + fullPath
      return {
        name: result.name,
        type: resultType,
        collection,
        author,
        path: normalizedPath,
        url,
        uuid: result.uuid,
        relevancy: scoreResult(result, queryStr, resultType, type),
      }
    })
    .filter((r) => r.relevancy > 0)
    .sort((a, b) => b.relevancy - a.relevancy)
    .slice(0, MAX_SEARCH_RESULTS)
  return simplifiedResults
}
module.exports = {
  searchDatabase,
}
