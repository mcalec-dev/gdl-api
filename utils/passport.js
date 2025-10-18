const passport = require('passport')
const LocalStrategy = require('passport-local').Strategy
const GitHubStrategy = require('passport-github2').Strategy
const DiscordStrategy = require('passport-discord').Strategy
const bcrypt = require('bcrypt')
const User = require('../models/User')
const { BASE_PATH } = require('../config')
const debug = require('debug')('gdl-api:utils:passport')
require('dotenv').config({ quiet: true })
passport.serializeUser((user, done) => {
  debug('Serializing user:', user.username)
  return done(null, user.id)
})
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id)
    return done(null, user)
  } catch (error) {
    debug('Error deserializing user:', error)
    return done(error)
  }
})
passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const user = await User.findOne({ username })
      const match = await bcrypt.compare(password, user.password)
      if (!user) {
        debug('User not found:', username)
        return done(null, false, { message: 'Incorrect username.' })
      }
      if (!user.password) {
        debug('User has no password set:', username)
        return done(null, false, { message: 'No password set.' })
      }
      if (!match) {
        debug('Incorrect password for user:', username)
        return done(null, false, { message: 'Incorrect password.' })
      }
      debug('User authenticated successfully:', user.username)
      return done(null, user)
    } catch (error) {
      debug('Error in local strategy:', error)
      return done(error)
    }
  })
)
passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: BASE_PATH + '/api/auth/github/callback',
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        const uuid = require('uuid').v4()
        let email = profile.email && profile.emails
        let username = profile.username
        if (profile && profile._json && profile._json.state) {
          const user = await User.findById(profile._json.state)
          if (user) {
            user.oauth = user.oauth || {}
            user.oauth.github = {
              id: profile.id,
              username,
              email,
              avatar: profile._json?.avatar_url,
            }
            if (!user.email) user.email = email
            user.sessions = user.sessions || []
            user.sessions.push({
              uuid,
              created: new Date(),
              expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              ip: req?.ip,
              useragent:
                req?.headers['user-agent'] || req.get('User-Agent') || '',
            })
            await user.save()
            req.session.uuid = uuid
            debug('Linked GitHub to existing user:', user.username)
            return done(null, user)
          }
        }
        let user = await User.findOne({ 'oauth.github.id': profile.id })
        if (!user) {
          user = await User.findOne({ email })
          if (user) {
            user.oauth = user.oauth || {}
            user.oauth.github = {
              id: profile.id,
              username,
              email,
              avatar: profile._json?.avatar_url,
            }
            if (!user.email) user.email = email
            user.sessions = user.sessions || []
            user.sessions.push({
              uuid,
              created: new Date(),
              expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              ip: req?.ip,
              useragent:
                req?.headers['user-agent'] || req.get('User-Agent') || '',
            })
            await user.save()
            req.session.uuid = uuid
            debug('Linked GitHub to existing user by email:', user.username)
          } else {
            user = await User.create({
              username,
              email,
              roles: ['user'],
              sessions: [
                {
                  uuid,
                  created: new Date(),
                  expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                  ip: req?.ip,
                  useragent:
                    req?.headers['user-agent'] || req.get('User-Agent') || '',
                },
              ],
              oauth: {
                github: {
                  id: profile.id,
                  username,
                  email,
                  avatar: profile._json?.avatar_url,
                },
              },
            }).catch((error) => {
              debug('Error creating user in GitHub strategy:', error)
              return done(error)
            })
            req.session.uuid = uuid
          }
        }
        if (!user) {
          debug('No user found or created in GitHub strategy')
          return done(null, false, {
            message: 'Unable to authenticate with GitHub.',
          })
        }
        if (!user.sessions || user.sessions.length === 0) {
          user.sessions = user.sessions || []
          user.sessions.push({
            uuid,
            created: new Date(),
            expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            ip: req?.ip,
            useragent:
              req?.headers['user-agent'] || req.get('User-Agent') || '',
          })
          await user.save()
          req.session.uuid = uuid
        }
        debug('User authenticated successfully:', user.username)
        return done(null, user)
      } catch (error) {
        debug('Error in GitHub strategy:', error)
        return done(error)
      }
    }
  )
)
passport.use(
  new DiscordStrategy(
    {
      clientID: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      callbackURL: BASE_PATH + '/api/auth/discord/callback',
      scope: ['identify', 'email'],
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        const uuid = require('uuid').v4()
        let email = profile.email ? profile.email : profile.emails
        let avatar = `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}`
        if (profile && profile._json && profile._json.state) {
          const user = await User.findById(profile._json.state)
          if (user) {
            user.oauth = user.oauth || {}
            user.oauth.discord = {
              id: profile.id,
              username: profile.username,
              email,
              avatar,
            }
            if (!user.email) user.email = email
            user.sessions = user.sessions || []
            user.sessions.push({
              uuid,
              created: new Date(),
              expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              ip: req?.ip,
              useragent:
                req?.headers['user-agent'] || req.get('User-Agent') || '',
            })
            await user.save()
            req.session.uuid = uuid
            debug('Linked Discord to existing user:', user.username)
            return done(null, user)
          }
        }
        let user = await User.findOne({ 'oauth.discord.id': profile.id })
        if (!user) {
          user = await User.findOne({
            $or: [{ email }, { username: profile.username }],
          })
          if (user) {
            user.oauth = user.oauth || {}
            user.oauth.discord = {
              id: profile.id,
              username: profile.username,
              email,
              avatar,
            }
            if (!user.email) user.email = email
            user.sessions = user.sessions || []
            user.sessions.push({
              uuid,
              created: new Date(),
              expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              ip: req?.ip,
              useragent:
                req?.headers['user-agent'] || req.get('User-Agent') || '',
            })
            await user.save()
            req.session.uuid = uuid
            debug('Linked Discord to existing user', user.username)
          } else {
            user = await User.create({
              username: profile.username,
              email,
              roles: ['user'],
              sessions: [
                {
                  uuid,
                  created: new Date(),
                  expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                  ip: req?.ip,
                  useragent:
                    req?.headers['user-agent'] || req.get('User-Agent') || '',
                },
              ],
              oauth: {
                discord: {
                  id: profile.id,
                  username: profile.username,
                  email,
                  avatar,
                },
              },
            }).catch((error) => {
              debug('Error creating user in Discord strategy:', error)
              return done(error)
            })
            req.session.uuid = uuid
          }
        }
        if (!user) {
          debug('No user found or created in Discord strategy')
          return done(null, false, {
            message: 'Unable to authenticate with Discord.',
          })
        }
        if (user.sessions && user.sessions.length > 0) {
          user.sessions = user.sessions || []
          user.sessions.push({
            uuid,
            created: new Date(),
            expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            ip: req?.ip,
            useragent: req.headers['user-agent'] || req.get('User-Agent') || '',
          })
          await user.save()
          req.session.uuid = uuid
        }
        debug('User authenticated successfully:', user.username)
        return done(null, user)
      } catch (error) {
        debug('Error in Discord strategy:', error)
        return done(error)
      }
    }
  )
)
module.exports = passport
