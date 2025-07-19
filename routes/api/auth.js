const express = require('express')
const passport = require('../../utils/passport')
const bcrypt = require('bcrypt')
const User = require('../../models/User')
const { requireRole, requireAnyRole } = require('../../utils/authUtils')
const router = express.Router()
const debug = require('debug')('gdl-api:api:auth')
const { BASE_PATH } = require('../../config')
router.get(['/', ''], (req, res) => {
  res.json({
    message: 'Auth API is working',
    urls: {
      login: `${BASE_PATH}/api/auth/login`,
      register: `${BASE_PATH}/api/auth/register`,
      link: `${BASE_PATH}/api/auth/link/:provider`,
      unlink: `${BASE_PATH}/api/auth/unlink/:provider`,
      check: `${BASE_PATH}/api/auth/check`,
      logout: `${BASE_PATH}/api/auth/logout`,
      github: `${BASE_PATH}/api/auth/github`,
      discord: `${BASE_PATH}/api/auth/discord`,
    },
  })
})
router.post('/login', async (req, res) => {
  const { username, email, password } = req.body
  if ((!username && !email) || !password) {
    debug('Username/email or password not provided')
    return res.status(400).json({ message: 'Bad request', status: 400 })
  }
  let user
  if (email) {
    user = await User.findOne({ email })
  } else {
    user = await User.findOne({ username })
  }
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials', status: 401 })
  }
  const match = await bcrypt.compare(password, user.password)
  if (!match) {
    return res.status(401).json({ message: 'Invalid credentials', status: 401 })
  }
  req.login(user, (err) => {
    if (err) {
      debug('Login failed:', err)
      return res
        .status(500)
        .json({ message: 'Internal server error', status: 500 })
    }
    debug('User logged in:', user.username)
    res.json({ success: true, user })
  })
})
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body
  if (!username || !password) {
    debug('Username or password not provided')
    return res.status(400).json({
      message: 'Bad request',
      status: 400,
    })
  }
  const existingUser = await User.findOne({ $or: [{ username }, { email }] })
  if (existingUser) {
    debug('Username or email already exists:', username, email)
    return res.status(409).json({
      message: 'Conflict',
      status: 409,
    })
  }
  const hash = await bcrypt.hash(password, 10)
  const user = await User.create({
    username,
    email,
    password: hash,
    roles: ['user'],
  })
  req.login(user, (err) => {
    if (err) {
      debug('Login after registration failed:', err)
      return res.status(500).json({
        message: 'Internal server error',
        status: 500,
      })
    } else {
      debug('Login after registration succeeded:', user)
      res.json({ success: true, user })
    }
  })
})
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
      passport.authenticate('discord', { state: req.user.id })(req, res, next)
    } else {
      res.status(400).json({ message: 'Invalid provider' })
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
router.post(
  '/unlink/:provider',
  requireAnyRole(['user', 'admin']),
  async (req, res) => {
    const provider = req.params.provider
    if (!['github', 'discord'].includes(provider)) {
      return res.status(400).json({ message: 'Invalid provider' })
    }
    try {
      if (!req.user)
        return res.status(401).json({ message: 'Not authenticated' })
      if (!req.user.oauth || !req.user.oauth[provider]) {
        return res.status(400).json({ message: 'Provider not linked' })
      }
      req.user.oauth[provider] = undefined
      if (Object.values(req.user.oauth).every((v) => !v)) {
        req.user.oauth = {}
      }
      await req.user.save()
      res.json({ success: true })
    } catch (err) {
      debug('Error unlinking provider:', err)
      res.status(500).json({ message: 'Failed to unlink provider' })
    }
  }
)
router.post('/logout', (req, res) => {
  req.logout(() => {
    res.json({ success: true })
  })
})
router.get('/logout', (req, res) => {
  req.logout(() => {
    res.json({ success: true })
  })
})
router.get('/check', (req, res) => {
  res.json({
    authenticated: req.isAuthenticated(),
    user: req.user,
    roles: req.user?.roles,
    oauth: req.user?.oauth,
  })
})
router.get(
  '/github',
  passport.authenticate('github', { scope: ['user:email'] })
)
router.get(
  '/github/callback',
  passport.authenticate('github', { failureRedirect: '/login' }),
  (req, res) => {
    res.redirect('/')
  }
)
router.get('/discord', passport.authenticate('discord'))
router.get(
  '/discord/callback',
  passport.authenticate('discord', { failureRedirect: '/login' }),
  (req, res) => {
    res.redirect('/')
  }
)
router.get('/admin', requireRole('admin'), (req, res, next) => {
  next()
})
router.get('/dashboard', requireAnyRole(['user', 'admin']), (req, res) => {
  res.json({
    message: 'Welcome ' + req.user.username + '!' || 'Welcome to dashboard!',
    username: req.user.username,
    email: req.user.email,
    roles: req.user.roles,
    id: req.user._id,
    uuid: req.user.uuid,
    created: req.user.created,
    oauth: req.user.oauth,
    debug: req.user,
  })
})
module.exports = router
