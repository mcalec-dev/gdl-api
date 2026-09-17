/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {unknown} value
 * @returns {boolean}
 */
function checkETag(req, res, value) {
  const etag = `W/"${String(value)}"`
  res.set('ETag', etag)
  if (req.headers['if-none-match'] === etag) {
    res.status(304).end()
    return true
  }
  return false
}

module.exports = { checkETag }
