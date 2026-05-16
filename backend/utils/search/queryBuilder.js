/** @param {string} str */
function escapeRegexString(str) {
  if (typeof str !== 'string') return ''
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
/** @param {string} q @param {string} type */
function buildQueries(q, type) {
  const escapedQuery = escapeRegexString(q)
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
  return {
    fileQuery,
    dirQuery,
  }
}
module.exports = {
  escapeRegexString,
  buildQueries,
}
