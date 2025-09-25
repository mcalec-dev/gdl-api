const File = require('../models/File')
const Directory = require('../models/Directory')
const { normalizePath } = require('./pathUtils')
const MAX_SEARCH_RESULTS = 2000
function scoreResult(result, queryStr, type) {
  let score = 0
  const nameLower = (result.name || '').toLowerCase()
  const pathLower = (result.paths?.relative || '').toLowerCase()
  if (nameLower === queryStr) score += 60
  if (nameLower.startsWith(queryStr)) score += 40
  if (nameLower.includes(queryStr)) score += 25
  if (pathLower === queryStr) score += 40
  if (pathLower.startsWith(queryStr)) score += 20
  if (pathLower.includes(queryStr)) score += 10
  if (type === 'file') {
    if (nameLower.length <= 3) score -= 10
  }
  if (type === 'directory') {
    if (nameLower.length <= 3) score -= 5
  }
  score = Math.max(0, Math.min(100, score))
  return score
}
async function searchDatabase({
  q,
  type,
  files,
  directories,
  basePath,
  protocol,
  hostname,
}) {
  const queryStr = q.toLowerCase()
  let dbResults = []
  const fileQuery =
    files === 'false'
      ? null
      : {
          $or: [
            { name: { $regex: q, $options: 'i' } },
            { 'paths.relative': { $regex: q, $options: 'i' } },
            { collection: { $regex: q, $options: 'i' } },
            { author: { $regex: q, $options: 'i' } },
            { tags: { $regex: q, $options: 'i' } },
          ],
        }
  const dirQuery =
    directories === 'false'
      ? null
      : {
          $or: [
            { name: { $regex: q, $options: 'i' } },
            { 'paths.relative': { $regex: q, $options: 'i' } },
            { tags: { $regex: q, $options: 'i' } },
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
      const type = result.collection ? 'file' : 'directory'
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
        type,
        collection,
        author,
        path: normalizedPath,
        url,
        relevancy: scoreResult(result, queryStr, type),
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
