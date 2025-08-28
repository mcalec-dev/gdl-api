const express = require('express')
const router = express.Router()
const debug = require('debug')('gdl-api:api:auth')
const { getAPIUrl } = require('../../../utils/urlUtils')
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate')
  req.utils = {
    ...req.utils,
  }
  next()
})
try {
  debug('Mounting check route')
  router.use('/check', require('./check'))
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
  const baseURL = getAPIUrl(req)
  res.json({
    urls: {
      login: baseURL + '/auth/login',
      register: baseURL + '/auth/register',
      link: baseURL + '/auth/link/:provider',
      unlink: baseURL + '/auth/unlink/:provider',
      check: baseURL + '/auth/check',
      logout: baseURL + '/auth/logout',
      github: baseURL + '/auth/github',
      discord: baseURL + '/auth/discord',
    },
  })
})
/* to be moved */
const { requireAnyRole } = require('../../../utils/authUtils')
const passport = require('../../../utils/passport')
router.get(
  '/link/:provider',
  requireAnyRole(['user', 'admin']),
  (req, res, next) => {
    const provider = req.params.provider
    if (provider === 'github') {
      passport.authenticate('github', {
        scope: ['user:email'],
        state: req.user.id,
      })(req, res, next)
    } else if (provider === 'discord') {
      passport.authenticate('discord', {
        state: req.user.id,
      })(req, res, next)
    } else {
      res.status(400).json({ message: 'Invalid provider' })
    }
  }
)
router.get(
  '/unlink/:provider',
  requireAnyRole(['user', 'admin']),
  async (req, res) => {
    const provider = req.params.provider
    if (!['github', 'discord'].includes(provider)) {
      debug('Invaild provider')
      return res.status(400).json({
        message: 'Bad Request',
        status: 400,
      })
    }
    try {
      if (!req.user) {
        debug('Not authenticated')
        return res.status(401).json({
          message: 'Unauthorized',
          status: 401,
        })
      }
      if (!req.user.oauth || !req.user.oauth[provider]) {
        return res.status(400).json({
          message: 'Bad Request',
          status: 400,
        })
      }
      req.user.oauth[provider] = undefined
      if (Object.values(req.user.oauth).every((v) => !v)) {
        req.user.oauth = {}
      }
      await req.user.save()
      res.json({
        success: true,
        status: 200,
      })
    } catch (err) {
      debug('Error unlinking provider:', err)
      res.status(500).json({
        message: 'Internal Server Error',
        status: 500,
      })
    }
  }
)
router.get('/link/:provider/callback', (req, res, next) => {
  const provider = req.params.provider
  passport.authenticate(provider, async (err, oauthUser) => {
    if (err || !oauthUser) {
      return res.redirect('/dashboard?link=fail')
    }
    if (
      req.user &&
      oauthUser &&
      oauthUser.oauth &&
      req.user.id !== oauthUser.id
    ) {
      req.user.oauth = { ...req.user.oauth, ...oauthUser.oauth }
      await req.user.save()
      return res.redirect('/dashboard?link=success')
    }
    res.redirect('/dashboard')
  })(req, res, next)
})
router.get(
  '/github',
  passport.authenticate('github', {
    scope: ['user:email'],
    passReqToCallback: true,
  })
)
router.get(
  '/github/callback',
  passport.authenticate('github', {
    failureRedirect: '/login',
  }),
  (req, res) => {
    res.redirect('/')
  }
)
router.get(
  '/discord',
  passport.authenticate('discord', {
    scope: ['identify', 'email'],
    passReqToCallback: true,
  })
)
router.get(
  '/discord/callback',
  passport.authenticate('discord', {
    failureRedirect: '/login',
    passReqToCallback: true,
  }),
  (req, res) => {
    res.redirect('/')
  }
)
module.exports = router
