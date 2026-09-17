const POLICIES = {
  noStore: 'no-store',
  publicStatic: 'public, max-age=3600',
  publicShort: 'public, max-age=120',
  privateShort: 'private, max-age=30, must-revalidate',
  privateVeryShort: 'private, max-age=10, must-revalidate',
  privateMedium: 'private, max-age=300, must-revalidate',
  privateImmutable: 'private, max-age=31536000, immutable',
}

/**
 * @param {keyof typeof POLICIES} policyName
 * @returns {import('express').RequestHandler}
 */
function cacheControl(policyName) {
  const value = POLICIES[policyName]
  if (!value) throw new Error(`Unknown cache policy: ${policyName}`)
  return (req, res, next) => {
    res.set('Cache-Control', value)
    if (policyName !== 'noStore') res.set('Vary', 'Cookie')
    next()
  }
}

module.exports = { cacheControl, POLICIES }
