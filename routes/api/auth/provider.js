const router = require('express').Router()
const log = require('../../../utils/logHandler')
const { requireRole } = require('../../../utils/authUtils')
const passport = require('../../../utils/passport')
const { OAUTH_PROVIDERS } = /** @type {any} */ (require('../../../config'))
const sendResponse = require('../../../utils/resUtils')
const { getHostUrl } = require('../../../utils/urlUtils')
const { cacheControl } = require('../../../utils/cacheControl')

/**
 * @typedef {object} OAuthAccount
 * @property {string} [id]
 * @property {string} [username]
 * @property {string} [email]
 * @property {string} [avatar]
 */

/**
 * @typedef {object} AuthenticatedUser
 * @property {string} id
 * @property {string} username
 * @property {string} [password]
 * @property {Record<string, OAuthAccount | undefined>} [oauth]
 * @property {() => Promise<unknown>} save
 */

/** @param {unknown} provider @returns {provider is string} */
function isAllowedProvider(provider) {
  return typeof provider === 'string' && OAUTH_PROVIDERS.includes(provider)
}

router.get('/', cacheControl('publicStatic'), async (req, res) => {
  const baseURL = (await getHostUrl(req)) + '/api'
  return sendResponse(res, 200).json({
    urls: {
      callback: baseURL + '/auth/provider/callback/:provider',
      login: baseURL + '/auth/provider/login/:provider',
      link: baseURL + '/auth/provider/link/:provider',
      unlink: baseURL + '/auth/provider/unlink/:provider',
    },
  })
})

router.get(
  ['/callback/:provider', '/callback/:provider/'],
  cacheControl('noStore'),
  (req, res, next) => {
    const provider = req.params.provider
    if (!isAllowedProvider(provider)) {
      log.debug('Provider mismatch:', provider)
      return sendResponse.error(res, 400, 'Invalid provider')
    }
    passport.authenticate(
      provider,
      /** @param {unknown} err @param {AuthenticatedUser | false | null} oauthUser */
      async (err, oauthUser) => {
        if (err) {
          log.error('OAuth error:', err)
          return res.redirect(302, '/')
        }
        if (!oauthUser) {
          log.debug('No OAuth user returned')
          return res.redirect(302, '/')
        }
        try {
          const currentUser = /** @type {AuthenticatedUser | undefined} */ (
            /** @type {unknown} */ (req.user)
          )
          if (currentUser && oauthUser.id === currentUser.id) {
            if (!currentUser.oauth) currentUser.oauth = {}
            currentUser.oauth[provider] = oauthUser.oauth?.[provider]
            await currentUser.save()
            return res.redirect(302, '/dashboard')
          }
          req.login(oauthUser, (loginErr) => {
            if (loginErr) {
              log.error('Error logging in after OAuth:', loginErr)
              return res.redirect(302, '/')
            }
            return res.redirect(302, '/dashboard')
          })
        } catch (error) {
          log.error('Callback processing error:', error)
          return res.redirect(302, '/')
        }
      },
    )(req, res, next)
  },
)

router.get(
  ['/login/:provider', '/login/:provider/'],
  cacheControl('noStore'),
  async (req, res, next) => {
    const provider = req.params.provider
    if (!isAllowedProvider(provider)) {
      log.debug('Provider mismatch:', provider)
      return sendResponse.error(res, 400, 'Invalid provider')
    }
    try {
      const options =
        provider === 'github'
          ? { scope: ['user:email'] }
          : { scope: ['identify', 'email'] }
      passport.authenticate(provider, options)(req, res, next)
    } catch (error) {
      log.error('Failed to authenticate OAuth:', error)
      return sendResponse.error(res, 500, 'Failed to authenticate OAuth')
    }
  },
)

router.get(
  ['/link/:provider', '/link/:provider/'],
  cacheControl('noStore'),
  requireRole('user'),
  async (req, res, next) => {
    const provider = req.params.provider
    if (!isAllowedProvider(provider)) {
      log.debug('Provider mismatch:', provider)
      return sendResponse.error(res, 400, 'Invalid provider')
    }
    const currentUser = /** @type {AuthenticatedUser} */ (
      /** @type {unknown} */ (req.user)
    )
    if (currentUser.oauth?.[provider]?.id) {
      log.debug('Provider already linked')
      return sendResponse.error(res, 400, 'Provider already linked')
    }
    try {
      const options =
        provider === 'github'
          ? { scope: ['user:email'], state: currentUser.id }
          : { scope: ['identify', 'email'], state: currentUser.id }
      passport.authenticate(provider, options)(req, res, next)
    } catch (error) {
      log.error('Failed to authenticate OAuth:', error)
      return sendResponse.error(res, 500, 'Failed to authenticate OAuth')
    }
  },
)

router.get(
  ['/unlink/:provider', '/unlink/:provider/'],
  cacheControl('noStore'),
  requireRole('user'),
  async (req, res) => {
    const provider = req.params.provider
    if (!isAllowedProvider(provider)) {
      log.debug('Provider mismatch:', provider)
      return sendResponse.error(res, 400, 'Invalid provider')
    }
    try {
      const currentUser = /** @type {AuthenticatedUser} */ (
        /** @type {unknown} */ (req.user)
      )
      if (!currentUser.oauth?.[provider]?.id) {
        log.debug('No provider found')
        return sendResponse.error(res, 400, 'Provider not linked')
      }
      const hasPassword = !!currentUser.password
      const otherOAuthProviders = Object.keys(currentUser.oauth || {}).filter(
        (p) => p !== provider && currentUser.oauth?.[p]?.id,
      )
      if (!hasPassword && otherOAuthProviders.length === 0) {
        return sendResponse.error(
          res,
          400,
          'Cannot unlink the only authentication method',
        )
      }
      if (!currentUser.oauth) currentUser.oauth = {}
      delete currentUser.oauth[provider]
      if (Object.keys(currentUser.oauth).length === 0) {
        currentUser.oauth = undefined
      }
      await currentUser.save()
      return sendResponse(res, 204)
    } catch (error) {
      log.error('Error unlinking provider:', error)
      return sendResponse.error(res, 500, 'Failed to unlink provider')
    }
  },
)

module.exports = router
