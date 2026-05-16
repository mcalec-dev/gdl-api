const bcrypt = require('bcrypt')
const passport = require('passport')
const uuidv4 = require('uuid').v4
const User = require('../models/User')
const log = require('./logHandler')
const { getRequestUserAgent } = require('./requestUtils')
const config = /** @type {any} */ (require('../config'))
const HOST =
  typeof process.env.HOST === 'string' && process.env.HOST.trim()
    ? process.env.HOST.trim()
    : typeof process.env.ALT_HOST === 'string' && process.env.ALT_HOST.trim()
      ? process.env.ALT_HOST.trim()
      : ''
const BASE_PATH = typeof config.BASE_PATH === 'string' ? config.BASE_PATH : ''
const SESSION_MAX_AGE =
  typeof config.COOKIE_MAX_AGE === 'number'
    ? config.COOKIE_MAX_AGE
    : 30 * 24 * 60 * 60 * 1000
const LocalStrategy = require('passport-local').Strategy
const GitHubStrategy = require('passport-github2').Strategy
const DiscordStrategy = require('passport-discord-auth').Strategy
/** @param {import('express').Request | undefined} req */
function createSessionMetadata(req) {
  const now = new Date()
  return {
    created: now,
    modified: now,
    expires: new Date(now.getTime() + SESSION_MAX_AGE),
    ip: req?.ip ? String(req.ip) : '',
    useragent: req ? getRequestUserAgent(req) : '',
  }
}
/** @param {import('express').Request | undefined} req */
function getOAuthStateUserId(req) {
  if (!req) return undefined
  const state = req.query?.state
  return typeof state === 'string' && state.trim() ? state.trim() : undefined
}
/** @param {any} user @param {(error: any, id?: string) => void} done */
passport.serializeUser((user, done) => {
  log.debug('Serializing user:', /** @type {any} */ (user).username)
  return done(null, String(/** @type {any} */ (user).uuid))
})
/** @param {string} uuid @param {(error: any, user?: any) => void} done */
passport.deserializeUser(async (uuid, done) => {
  try {
    const user = await User.findOne({ uuid })
    if (!user) {
      log.debug('User not found during deserialization:', uuid)
      return done(null, false)
    }
    log.debug('Deserialized user:', user.username)
    return done(null, user)
  } catch (error) {
    log.error('Error deserializing user:', error)
    return done(error)
  }
})
passport.use(
  new LocalStrategy(
    /** @param {string} username @param {string} password @param {(error: any, user?: any, info?: any) => void} done */
    async (username, password, done) => {
      try {
        const user = await User.findOne({ username })
        if (!user) return done(null, false, { message: 'Incorrect username.' })
        if (!user.password)
          return done(null, false, { message: 'No password set.' })
        const match = await bcrypt.compare(password, user.password)
        if (!match) return done(null, false, { message: 'Incorrect password.' })
        log.debug('Local user authenticated successfully:', user.username)
        return done(null, user)
      } catch (error) {
        log.error('Error in local strategy:', error)
        return done(error)
      }
    }
  )
)
if (config.GITHUB_CLIENT_ID && config.GITHUB_CLIENT_SECRET) {
  const callbackURL = `https://${HOST}${BASE_PATH}/api/auth/provider/callback/github`
  passport.use(
    new GitHubStrategy(
      {
        clientID: config.GITHUB_CLIENT_ID,
        clientSecret: config.GITHUB_CLIENT_SECRET,
        callbackURL: callbackURL,
        passReqToCallback: true,
      },
      /**
       * @param {any} req
       * @param {string} accessToken
       * @param {string} refreshToken
       * @param {any} profile
       * @param {(error: any, user?: any, info?: any) => void} done
       */
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          const uuid = uuidv4()
          const session = { uuid, ...createSessionMetadata(req) }
          const email =
            profile.email || (profile.emails && profile.emails[0]?.value)
          const username =
            profile.username || profile.displayName || profile.login
          const stateUserId = getOAuthStateUserId(req)
          if (stateUserId) {
            const linkedUser = await User.findById(stateUserId)
            if (linkedUser) {
              linkedUser.oauth = linkedUser.oauth || {}
              linkedUser.oauth.github = {
                id: profile.id,
                username,
                email,
                avatar: profile._json?.avatar_url,
              }
              if (!linkedUser.email) linkedUser.email = email
              linkedUser.sessions = linkedUser.sessions || []
              linkedUser.sessions.push(session)
              await linkedUser.save()
              if (req?.session) {
                /** @type {any} */ req.session.uuid = uuid
              }
              log.debug('Linked GitHub to existing user:', linkedUser.username)
              return done(null, linkedUser)
            }
          }
          let user = await User.findOne({ 'oauth.github.id': profile.id })
          if (!user && email) user = await User.findOne({ email })
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
            user.sessions.push(session)
            await user.save()
            if (req?.session) {
              /** @type {any} */ req.session.uuid = uuid
            }
            log.debug('GitHub user authenticated successfully:', user.username)
            return done(null, user)
          }
          const userUuid = uuidv4()
          const now = new Date()
          user = await User.create({
            username,
            email,
            uuid: userUuid,
            created: now,
            roles: ['user'],
            sessions: [session],
            oauth: {
              github: {
                id: profile.id,
                username,
                email,
                avatar: profile._json?.avatar_url,
              },
            },
          })
          if (!user) return done(new Error('Failed to create GitHub user'))
          if (req?.session) {
            /** @type {any} */ req.session.uuid = uuid
          }
          log.debug('Created new GitHub user:', user.username)
          return done(null, user)
        } catch (error) {
          log.error('Error in GitHub strategy:', error)
          return done(error)
        }
      }
    )
  )
} else {
  if (!config.GITHUB_CLIENT_ID || !config.GITHUB_CLIENT_SECRET) {
    log.warn(
      'GitHub OAuth disabled: Missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET'
    )
  }
}
if (config.DISCORD_CLIENT_ID && config.DISCORD_CLIENT_SECRET) {
  const callbackURL = `https://${HOST}${BASE_PATH}/api/auth/provider/callback/discord`
  passport.use(
    /** @type {any} */
    (
      new DiscordStrategy(
        {
          clientId: config.DISCORD_CLIENT_ID,
          clientSecret: config.DISCORD_CLIENT_SECRET,
          callbackUrl: callbackURL,
          scope: ['identify', 'email'],
          passReqToCallback: true,
        },
        // @ts-ignore
        async (req, accessToken, refreshToken, profile, done) => {
          try {
            const uuid = uuidv4()
            const session = { uuid, ...createSessionMetadata(req) }
            const email =
              profile.email || (profile.emails && profile.emails[0]?.value)
            const avatar = profile.avatar
              ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}`
              : undefined
            const username = profile.username || profile.displayName
            const stateUserId = getOAuthStateUserId(req)
            if (stateUserId) {
              const linkedUser = await User.findById(stateUserId)
              if (linkedUser) {
                linkedUser.oauth = linkedUser.oauth || {}
                linkedUser.oauth.discord = {
                  id: profile.id,
                  username,
                  email,
                  avatar,
                }
                if (!linkedUser.email) linkedUser.email = email
                linkedUser.sessions = linkedUser.sessions || []
                linkedUser.sessions.push(session)
                await linkedUser.save()
                if (req?.session) {
                  /** @type {any} */ req.session.uuid = uuid
                }
                log.debug(
                  'Linked Discord to existing user:',
                  linkedUser.username
                )
                return done(null, linkedUser)
              }
            }
            let user = await User.findOne({ 'oauth.discord.id': profile.id })
            if (!user && email) user = await User.findOne({ email })
            if (!user && username) user = await User.findOne({ username })
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
              user.sessions.push(session)
              await user.save()
              if (req?.session) {
                /** @type {any} */ req.session.uuid = uuid
              }
              log.debug(
                'Discord user authenticated successfully:',
                user.username
              )
              return done(null, user)
            }
            const userUuid = uuidv4()
            const now = new Date()
            user = await User.create({
              username,
              email,
              uuid: userUuid,
              created: now,
              roles: ['user'],
              sessions: [session],
              oauth: {
                discord: {
                  id: profile.id,
                  username,
                  email,
                  avatar,
                },
              },
            })
            if (!user) return done(new Error('Failed to create Discord user'))
            if (req?.session) {
              /** @type {any} */ req.session.uuid = uuid
            }
            log.debug('Created new Discord user:', user.username)
            return done(null, user)
          } catch (error) {
            log.error('Error in Discord strategy:', error)
            return done(error)
          }
        }
      )
    )
  )
} else {
  if (!config.DISCORD_CLIENT_ID || !config.DISCORD_CLIENT_SECRET) {
    log.warn(
      'Discord OAuth disabled: Missing DISCORD_CLIENT_ID or DISCORD_CLIENT_SECRET'
    )
  }
}
module.exports = passport
