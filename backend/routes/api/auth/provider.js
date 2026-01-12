const router = require('express').Router()
const debug = require('debug')('gdl-api:api:auth:provider')
const { requireRole } = require('../../../utils/authUtils')
const passport = require('../../../utils/passport')
const { BASE_PATH, OAUTH_PROVIDERS } = require('../../../config')
/**
 * @swagger
 * /api/auth/provider/:
 *   get:
 *     summary: Get OAuth provider endpoints
 *     description: Get available OAuth provider endpoints for login, link, and unlink operations
 *     responses:
 *       200:
 *         description: OAuth provider URLs
 *
 * /api/auth/provider/login/{provider}:
 *   get:
 *     summary: Initiate OAuth login
 *     description: Start OAuth authentication flow for the specified provider
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *           enum: [github, discord]
 *         description: OAuth provider name
 *     responses:
 *       302:
 *         description: Redirect to provider authentication
 *       400:
 *         description: Invalid provider
 *       500:
 *         description: Authentication error
 *
 * /api/auth/provider/callback/{provider}:
 *   get:
 *     summary: OAuth callback endpoint
 *     description: Handle OAuth provider callback after successful authentication
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *           enum: [github, discord]
 *         description: OAuth provider name
 *       - in: query
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: Authorization code from provider
 *     responses:
 *       302:
 *         description: Redirect to dashboard on success
 *       400:
 *         description: Invalid provider or missing code
 *
 * /api/auth/provider/link/{provider}:
 *   get:
 *     summary: Link OAuth account to existing user
 *     description: Link an OAuth provider account to the currently authenticated user
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *           enum: [github, discord]
 *         description: OAuth provider name
 *     responses:
 *       302:
 *         description: Redirect to provider authentication
 *       400:
 *         description: Invalid provider or provider already linked
 *       401:
 *         description: User not authenticated
 *       500:
 *         description: Link error
 *
 * /api/auth/provider/unlink/{provider}:
 *   get:
 *     summary: Unlink OAuth account from user
 *     description: Remove OAuth provider account from the currently authenticated user
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *           enum: [github, discord]
 *         description: OAuth provider name
 *     responses:
 *       200:
 *         description: Provider unlinked successfully
 *       400:
 *         description: Invalid provider or cannot unlink (no other auth method)
 *       401:
 *         description: User not authenticated
 *       500:
 *         description: Unlink error
 */
router.get(['/', ''], async (req, res) => {
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
      debug('Provider mismatch:', provider)
      return res.status(400).json({ message: 'Invalid Request', status: 400 })
    }
    passport.authenticate(provider, async (err, oauthUser) => {
      if (err) {
        debug('OAuth error:', err)
        return res.redirect('/')
      }
      if (!oauthUser) {
        debug('No OAuth user returned')
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
            debug('Error logging in after OAuth:', loginErr)
            return res.redirect('/')
          }
          return res.redirect('/dashboard')
        })
      } catch (error) {
        debug('Callback processing error:', error)
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
      debug('Provider mismatch:', provider)
      return res.status(400).json({ message: 'Bad Request', status: 400 })
    }
    try {
      const options =
        provider === 'github'
          ? { scope: ['user:email'] }
          : { scope: ['identify', 'email'] }
      passport.authenticate(provider, options)(req, res, next)
    } catch (error) {
      debug('Failed to authenticate OAuth:', error)
      return res.status(500).json({
        message: 'Internal Server Error',
        status: 500,
      })
    }
  }
)
router.get(
  ['/link/:provider', '/link/:provider/'],
  requireRole('user'),
  async (req, res, next) => {
    const provider = req.params.provider
    if (!OAUTH_PROVIDERS.includes(provider)) {
      debug('Provider mismatch:', provider)
      return res.status(400).json({ message: 'Bad Request', status: 400 })
    }
    if (req.user.oauth?.[provider]?.id) {
      debug('Provider already linked')
      return res.status(400).json({
        message: 'Bad Request',
        status: 400,
      })
    }
    try {
      const options =
        provider === 'github'
          ? { scope: ['user:email'], state: req.user.id }
          : { scope: ['identify', 'email'], state: req.user.id }
      passport.authenticate(provider, options)(req, res, next)
    } catch (error) {
      debug('Failed to authenticate OAuth:', error)
      return res.status(500).json({
        message: 'Internal Server Error',
        status: 500,
      })
    }
  }
)
router.get(
  ['/unlink/:provider', '/unlink/:provider/'],
  requireRole('user'),
  async (req, res) => {
    const provider = req.params.provider
    if (!OAUTH_PROVIDERS.includes(provider)) {
      debug('Provider mismatch:', provider)
      return res.status(400).json({
        message: 'Bad Request',
        status: 400,
      })
    }
    try {
      if (!req.user.oauth?.[provider]?.id) {
        debug('No provider found')
        return res.status(400).json({
          message: 'Bad Request',
          status: 400,
        })
      }
      const hasPassword = !!req.user.password
      const otherOAuthProviders = Object.keys(req.user.oauth || {}).filter(
        (p) => p !== provider && req.user.oauth[p]?.id
      )
      if (!hasPassword && otherOAuthProviders.length === 0) {
        return res.status(400).json({
          message: 'Bad Request',
          status: 400,
        })
      }
      if (!req.user.oauth) req.user.oauth = {}
      delete req.user.oauth[provider]
      if (Object.keys(req.user.oauth).length === 0) {
        req.user.oauth = undefined
      }
      await req.user.save()
      return res.json({
        success: true,
        message: 'Provider unlinked successfully',
        status: 200,
      })
    } catch (error) {
      debug('Error unlinking provider:', error)
      return res.status(500).json({
        message: 'Internal Server Error',
        status: 500,
      })
    }
  }
)
module.exports = router
