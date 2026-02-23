const router = require('express').Router()
const log = require('../../../utils/logHandler')
const { requireRole } = require('../../../utils/authUtils')
const passport = require('../../../utils/passport')
const { BASE_PATH, OAUTH_PROVIDERS } = require('../../../config')
const sendResponse = require('../../../utils/resUtils')
router.get('/', async (req, res) => {
  const baseURL = req.protocol + '://' + req.hostname + BASE_PATH + '/api'
  return res.json({
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
  (req, res, next) => {
    const provider = req.params.provider
    if (!OAUTH_PROVIDERS.includes(provider)) {
      log.debug('Provider mismatch:', provider)
      return sendResponse(res, 400, 'Invalid provider')
    }
    passport.authenticate(provider, async (err, oauthUser) => {
      if (err) {
        log.error('OAuth error:', err)
        return res.redirect('/')
      }
      if (!oauthUser) {
        log.debug('No OAuth user returned')
        return res.redirect('/')
      }
      try {
        if (req.user && oauthUser.id === req.user.id) {
          if (!req.user.oauth) req.user.oauth = {}
          req.user.oauth[provider] = oauthUser.oauth[provider]
          await req.user.save()
          return res.redirect('/dashboard')
        }
        req.login(oauthUser, (loginErr) => {
          if (loginErr) {
            log.error('Error logging in after OAuth:', loginErr)
            return res.redirect('/')
          }
          return res.redirect('/dashboard')
        })
      } catch (error) {
        log.error('Callback processing error:', error)
        return res.redirect('/')
      }
    })(req, res, next)
  }
)
router.get(
  ['/login/:provider', '/login/:provider/'],
  async (req, res, next) => {
    const provider = req.params.provider
    if (!OAUTH_PROVIDERS.includes(provider)) {
      log.debug('Provider mismatch:', provider)
      return sendResponse(res, 400, 'Invalid provider')
    }
    try {
      const options =
        provider === 'github'
          ? { scope: ['user:email'] }
          : { scope: ['identify', 'email'] }
      passport.authenticate(provider, options)(req, res, next)
    } catch (error) {
      log.error('Failed to authenticate OAuth:', error)
      return sendResponse(res, 500, 'Failed to authenticate OAuth')
    }
  }
)
router.get(
  ['/link/:provider', '/link/:provider/'],
  requireRole('user'),
  async (req, res, next) => {
    const provider = req.params.provider
    if (!OAUTH_PROVIDERS.includes(provider)) {
      log.debug('Provider mismatch:', provider)
      return sendResponse(res, 400, 'Invalid provider')
    }
    if (req.user.oauth?.[provider]?.id) {
      log.debug('Provider already linked')
      return sendResponse(res, 400, 'Provider already linked')
    }
    try {
      const options =
        provider === 'github'
          ? { scope: ['user:email'], state: req.user.id }
          : { scope: ['identify', 'email'], state: req.user.id }
      passport.authenticate(provider, options)(req, res, next)
    } catch (error) {
      log.error('Failed to authenticate OAuth:', error)
      return sendResponse(res, 500, 'Failed to authenticate OAuth')
    }
  }
)
router.get(
  ['/unlink/:provider', '/unlink/:provider/'],
  requireRole('user'),
  async (req, res) => {
    const provider = req.params.provider
    if (!OAUTH_PROVIDERS.includes(provider)) {
      log.debug('Provider mismatch:', provider)
      return sendResponse(res, 400, 'Invalid provider')
    }
    try {
      if (!req.user.oauth?.[provider]?.id) {
        log.debug('No provider found')
        return sendResponse(res, 400, 'Provider not linked')
      }
      const hasPassword = !!req.user.password
      const otherOAuthProviders = Object.keys(req.user.oauth || {}).filter(
        (p) => p !== provider && req.user.oauth[p]?.id
      )
      if (!hasPassword && otherOAuthProviders.length === 0) {
        return sendResponse(
          res,
          400,
          'Cannot unlink the only authentication method'
        )
      }
      if (!req.user.oauth) req.user.oauth = {}
      delete req.user.oauth[provider]
      if (Object.keys(req.user.oauth).length === 0) {
        req.user.oauth = undefined
      }
      await req.user.save()
      return sendResponse(res, 200, 'Provider unlinked successfully')
    } catch (error) {
      log.error('Error unlinking provider:', error)
      return sendResponse(res, 500, 'Failed to unlink provider')
    }
  }
)
module.exports = router
