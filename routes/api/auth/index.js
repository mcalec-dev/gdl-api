const router = require('express').Router()
const debug = require('debug')('gdl-api:api:auth')
const { BASE_PATH } = require('../../../config')
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-cache')
  req.utils = {
    ...req.utils,
  }
  next()
})
try {
  debug('Mounting check route')
  router.use('/check', require('./check'))
  debug('Mounting csrf route')
  router.use('/csrf', require('./csrf'))
  debug('Mounting logout route')
  router.use('/logout', require('./logout'))
  debug('Mounting login route')
  router.use('/login', require('./login'))
  debug('Mounting register route')
  router.use('/register', require('./register'))
} catch (error) {
  debug('Error mounting auth routes:', error)
}
/**
 * @swagger
 * /api/auth/:
 *   get:
 *     summary: Get auth API info
 *     responses:
 *       200:
 *         description: Auth API is working
 */
router.get(['/', ''], async (req, res) => {
  const baseURL = req.protocol + '://' + req.hostname + BASE_PATH + '/api'
  return res.json({
    urls: {
      check: baseURL + '/auth/check',
      login: baseURL + '/auth/login',
      logout: baseURL + '/auth/logout',
      register: baseURL + '/auth/register',
      link: baseURL + '/auth/link/:provider',
      unlink: baseURL + '/auth/unlink/:provider',
      github: baseURL + '/auth/github',
      discord: baseURL + '/auth/discord',
    },
  })
})
/* to be moved */
const { requireRole } = require('../../../utils/authUtils')
const passport = require('../../../utils/passport')
const PROVIDERS = ['github', 'discord']
router.get('/link/:provider', requireRole('user'), async (req, res, next) => {
  const provider = req.params.provider
  if (!PROVIDERS.includes(provider)) {
    debug('Provider mismatch:', provider)
    return res.status(400).json({
      message: 'Bad Request',
      status: 400,
    })
  }
  if (req.user.oauth?.[provider]?.id) {
    debug('No provider found')
    return res.status(400).json({
      message: 'Bad Request',
      status: 400,
    })
  }
  try {
    if (provider === 'github') {
      const options = {
        scope: ['user:email'],
      }
      passport.authenticate(provider, options)(req, res, next)
    }
    if (provider === 'discord') {
      const options = {
        scope: ['identify', 'email'],
      }
      passport.authenticate(provider, options)(req, res, next)
    }
  } catch (error) {
    debug('Failed to authenticate OAuth:', error)
    return res.status(500).json({
      message: 'Internal Server Error',
      status: 500,
    })
  }
})
router.get('/unlink/:provider', requireRole('user'), async (req, res) => {
  const provider = req.params.provider
  if (!PROVIDERS.includes(provider)) {
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
})
router.get('/:provider', async (req, res, next) => {
  const provider = req.params.provider
  if (!PROVIDERS.includes(provider)) {
    debug('Provider mismatch:', provider)
    return res.status(400).json({
      message: 'Bad Request',
      status: 400,
    })
  }
  try {
    if (provider === 'github') {
      const options = {
        scope: ['user:email'],
      }
      passport.authenticate(provider, options)(req, res, next)
    }
    if (provider === 'discord') {
      const options = {
        scope: ['identify', 'email'],
      }
      passport.authenticate(provider, options)(req, res, next)
    }
  } catch (error) {
    debug('Failed to authenticate OAuth:', error)
    return res.status(500).json({
      message: 'Internal Server Error',
      status: 500,
    })
  }
})
router.get(['/callback/:provider', '/:provider/callback'], (req, res, next) => {
  const provider = req.params.provider
  if (!PROVIDERS.includes(provider)) {
    debug('Provider mismatch:', provider)
    return res.status(400).json({
      message: 'Invalid Request',
      status: 400,
    })
  }
  passport.authenticate(provider, async (err, oauthUser) => {
    if (err) {
      console.error('OAuth error:', err)
      return res.redirect('/')
    }
    if (!oauthUser) {
      return res.redirect('/')
    }
    try {
      if (!req.user) {
        return res.redirect('/')
      }
      if (oauthUser.id && oauthUser.id !== req.user.id) {
        return res.redirect('/dashboard')
      }
      if (!req.user.oauth) req.user.oauth = {}
      req.user.oauth[provider] = oauthUser.oauth[provider]
      await req.user.save()
      return res.redirect('/dashboard')
    } catch (error) {
      console.error('Callback processing error:', error)
      return res.redirect('/')
    }
  })(req, res, next)
})
module.exports = router
