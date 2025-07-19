const passport = require('passport')
const LocalStrategy = require('passport-local').Strategy
const GitHubStrategy = require('passport-github2').Strategy
const DiscordStrategy = require('passport-discord').Strategy
const bcrypt = require('bcrypt')
const User = require('../models/User')
const { BASE_PATH } = require('../config')
const debug = require('debug')('gdl-api:utils:passport')
require('dotenv').config()
passport.serializeUser((user, done) => {
  debug('Serializing user:', user.username)
  done(null, user.id)
})
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id)
    done(null, user)
  } catch (err) {
    debug('Error deserializing user:', err)
    done(err)
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
      debug('User authenticated successfully:', user.username)
      return done(null, user)
    } catch (err) {
      debug('Error in local strategy:', err)
      return done(err)
    }
  })
)
passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: BASE_PATH + '/api/auth/github/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        if (profile && profile._json && profile._json.state) {
          const user = await User.findById(profile._json.state)
          if (user) {
            user.oauth = user.oauth || {}
            user.oauth.github = {
              id: profile.id,
              username: profile.username,
              email: profile.emails[0].value,
              avatar: profile._json.avatar_url,
            }
            await user.save()
            debug('Linked GitHub to existing user:', user.username)
            return done(null, user)
          }
        }
        let user = await User.findOne({ 'oauth.github.id': profile.id })
        if (!user) {
          const email =
            profile.emails && profile.emails[0] && profile.emails[0].value
              ? profile.emails[0].value
              : `${profile.id}@github.no-email.local`
          user = await User.findOne({ email })
          if (user) {
            user.oauth = user.oauth || {}
            user.oauth.github = {
              id: profile.id,
              username: profile.username,
              avatar: profile._json.avatar_url,
            }
            await user.save()
            debug('Linked GitHub to existing user by email:', user.username)
          } else {
            user = await User.create({
              username: profile.username,
              email,
              roles: ['user'],
              oauth: {
                github: {
                  id: profile.id,
                  username: profile.username,
                  avatar: profile._json.avatar_url,
                },
              },
            }).catch((err) => {
              debug('Error creating user in GitHub strategy:', err)
              return done(err)
            })
          }
        }
        if (!user) {
          debug('No user found or created in GitHub strategy')
          return done(null, false, {
            message: 'Unable to authenticate with GitHub.',
          })
        }
        debug('User authenticated successfully:', user.username)
        return done(null, user)
      } catch (err) {
        debug('Error in GitHub strategy:', err)
        return done(err)
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
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        if (profile && profile._json && profile._json.state) {
          const user = await User.findById(profile._json.state)
          if (user) {
            user.oauth = user.oauth || {}
            user.oauth.discord = {
              id: profile.id,
              username: profile.username,
              email: profile.email,
              avatar: profile.avatar,
            }
            await user.save()
            debug('Linked Discord to existing user:', user.username)
            return done(null, user)
          }
        }
        let user = await User.findOne({ 'oauth.discord.id': profile.id })
        if (!user) {
          const email = profile.email
            ? profile.email
            : profile.emails && profile.emails[0] && profile.emails[0].value
              ? profile.emails[0].value
              : `${profile.id}@discord.no-email.local`
          user = await User.findOne({
            $or: [{ email }, { username: profile.username }],
          })
          if (user) {
            user.oauth = user.oauth || {}
            user.oauth.discord = {
              id: profile.id,
              username: profile.username,
              avatar: profile.avatar,
            }
            await user.save()
            debug(
              'Linked Discord to existing user by email/username:',
              user.username
            )
          } else {
            user = await User.create({
              username: profile.username,
              email,
              roles: ['user'],
              oauth: {
                discord: {
                  id: profile.id,
                  username: profile.username,
                  avatar: profile.avatar,
                },
              },
            }).catch((err) => {
              debug('Error creating user in Discord strategy:', err)
              return done(err)
            })
          }
        }
        if (!user) {
          debug('No user found or created in Discord strategy')
          return done(null, false, {
            message: 'Unable to authenticate with Discord.',
          })
        }
        debug('User authenticated successfully:', user.username)
        return done(null, user)
      } catch (err) {
        debug('Error in Discord strategy:', err)
        return done(err)
      }
    }
  )
)
module.exports = passport
