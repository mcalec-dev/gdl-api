/** @param {any} result @param {string} queryStr @param {string} type @param {string} searchType */
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
  if (type === 'file' && nameLower.length <= 3) score -= 10
  if (type === 'directory' && nameLower.length <= 3) score -= 5
  return Math.max(0, Math.min(100, score))
}
module.exports = {
  scoreResult,
}
