const bcrypt = require('bcrypt')
const passport = require('passport')
const User = require('../models/User')
const debug = require('debug')('gdl-api:utils:passport')
const { BASE_PATH } = require('../config')
const LocalStrategy = require('passport-local').Strategy
const GitHubStrategy = require('passport-github2').Strategy
const DiscordStrategy = require('passport-discord-auth').Strategy
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
      if (!user) {
        debug('User not found:', username)
        return done(null, false, { message: 'Incorrect username.' })
      }
      if (!user.password) {
        debug('User has no password set:', username)
        return done(null, false, { message: 'No password set.' })
      }
      const match = await bcrypt.compare(password, user.password)
      if (!match) {
        debug('Incorrect password for user:', username)
        return done(null, false, { message: 'Incorrect password.' })
      }
      debug('Local user authenticated successfully:', user.username)
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
      callbackURL: `https://${process.env.HOST}${BASE_PATH}/api/auth/provider/callback/github`,
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        const uuid = require('uuid').v4()
        let email =
          profile.email || (profile.emails && profile.emails[0]?.value)
        let username = profile.username || profile.displayName || profile.login
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
            const now = new Date()
            user.sessions.push({
              uuid,
              created: now,
              modified: now,
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
        if (!user && email) {
          user = await User.findOne({ email })
        }
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
          const now = new Date()
          user.sessions.push({
            uuid,
            created: now,
            modified: now,
            expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            ip: req?.ip,
            useragent:
              req?.headers['user-agent'] || req.get('User-Agent') || '',
          })
          await user.save()
          req.session.uuid = uuid
          debug('GitHub user authenticated successfully:', user.username)
          return done(null, user)
        } else {
          const userUuid = require('uuid').v4()
          const now = new Date()
          user = await User.create({
            username,
            email,
            uuid: userUuid,
            created: now,
            roles: ['user'],
            sessions: [
              {
                uuid,
                created: now,
                modified: now,
                expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                ip: req?.ip,
                useragent: req?.useragent,
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
          debug('Created new GitHub user:', user.username)
          return done(null, user)
        }
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
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      callbackUrl: `https://${process.env.HOST}${BASE_PATH}/api/auth/provider/callback/discord`,
      scope: ['identify', 'email'],
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        const uuid = require('uuid').v4()
        let email =
          profile.email || (profile.emails && profile.emails[0]?.value)
        let avatar = profile.avatar
          ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}`
          : undefined
        let username = profile.username || profile.displayName
        if (profile && profile._json && profile._json.state) {
          const user = await User.findById(profile._json.state)
          if (user) {
            user.oauth = user.oauth || {}
            user.oauth.discord = {
              id: profile.id,
              username,
              email,
              avatar,
            }
            if (!user.email) user.email = email
            user.sessions = user.sessions || []
            const now = new Date()
            user.sessions.push({
              uuid,
              created: now,
              modified: now,
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
        if (!user && email) {
          user = await User.findOne({ email })
        }
        if (!user && username) {
          user = await User.findOne({ username })
        }
        if (user) {
          user.oauth = user.oauth || {}
          user.oauth.discord = {
            id: profile.id,
            username,
            email,
            avatar,
          }
          if (!user.email) user.email = email
          user.sessions = user.sessions || []
          const now = new Date()
          user.sessions.push({
            uuid,
            created: now,
            modified: now,
            expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            ip: req?.ip,
            useragent:
              req?.headers['user-agent'] || req.get('User-Agent') || '',
          })
          await user.save()
          req.session.uuid = uuid
          debug('Discord user authenticated successfully:', user.username)
          return done(null, user)
        } else {
          const userUuid = require('uuid').v4()
          const now = new Date()
          user = await User.create({
            username,
            email,
            uuid: userUuid,
            created: now,
            roles: ['user'],
            sessions: [
              {
                uuid,
                created: now,
                modified: now,
                expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                ip: req?.ip,
                useragent:
                  req?.headers['user-agent'] || req.get('User-Agent') || '',
              },
            ],
            oauth: {
              discord: {
                id: profile.id,
                username,
                email,
                avatar,
              },
            },
          }).catch((error) => {
            debug('Error creating user in Discord strategy:', error)
            return done(error)
          })
          req.session.uuid = uuid
          debug('Created new Discord user:', user.username)
          return done(null, user)
        }
      } catch (error) {
        debug('Error in Discord strategy:', error)
        return done(error)
      }
    }
  )
)
module.exports = passport
