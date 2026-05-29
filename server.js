const express = require('express')
const session = require('express-session')
const { isbot } = require('isbot')
const { processFiles } = require('./minify')
const { getRequestIp, setReqVars } = require('./utils/requestUtils')
const { initDbCacheLayer } = require('./utils/db/mongooseCacheLayer.js')
const app = express()
const {
  initSessionStore,
  getSessionStoreKind,
  shutdownSessionStore,
} = require('./utils/sessionStore')
const passport = require('./utils/passport')
const path = require('path')
const chalk = require('chalk')
const server = require('http').createServer(app)
const swaggerUi = require('swagger-ui-express')
const helmet = require('helmet').default
const log = require('./utils/logHandler')
const sendResponse = require('./utils/resUtils')
const BodyParser = require('body-parser')
const rateLimit = require('express-rate-limit')
const {
  NODE_ENV,
  PORT,
  NAME,
  HOST,
  BIND,
  BASE_PATH,
  BASE_DIR,
  SESSION_SECRET,
  MONGODB_URL,
  COOKIE_MAX_AGE,
  RATE_LIMIT_WINDOW,
  RATE_LIMIT_MAX,
} = /** @type {any} */ (require('./config'))
async function initSwagger() {
  try {
    const yaml = require('js-yaml')
    const fs = require('fs').promises
    const swaggerPath = path.join(__dirname, 'openapi.yaml')
    const swaggerFile = await fs.readFile(swaggerPath, 'utf8')
    const swaggerSpec = /** @type {import('swagger-ui-express').JsonObject} */ (
      yaml.load(swaggerFile)
    )
    swaggerSpec.servers = [
      {
        url: `https://${await HOST}${BASE_PATH}`,
        description: 'production',
      },
    ]
    swaggerSpec.info.version = process.env.npm_package_version
    app.use(`${BASE_PATH}/docs`, swaggerUi.serve, swaggerUi.setup(swaggerSpec))
  } catch (error) {
    log.error('Error loading Swagger spec:', error)
    throw error
  }
}
if (BASE_PATH) {
  app.get('/', (req, res) => {
    res.redirect(302, `${BASE_PATH}/`)
  })
  app.post('/', (req, res) => {
    res.redirect(307, `${BASE_PATH}/`)
  })
}
async function initDB() {
  initDbCacheLayer()
  await initSessionStore()
  const sessionStoreKind = getSessionStoreKind()
  const cookieMaxAgeMs = COOKIE_MAX_AGE
  try {
    const connection = await require('mongoose').connect(MONGODB_URL)
    log.info('MongoDB connected')
    const gridfsUtils = require('./utils/gridfsUtils')
    gridfsUtils.initGridFS()
    if (sessionStoreKind === 'mongo') {
      const db = connection.connection.db
      if (!db) throw new Error('Database connection unavailable')
      const sessions = db.collection('sessions')
      try {
        await sessions.createIndex({ expires: 1 }, { expireAfterSeconds: 0 })
        log.info('TTL index created on sessions collection')
      } catch (indexError) {
        log.debug(
          'TTL index already exists or creation failed:',
          indexError instanceof Error ? indexError.message : String(indexError)
        )
      }
      const cutoffDate = new Date(Date.now() - cookieMaxAgeMs)
      const result = await sessions.deleteMany({
        $or: [
          { expires: { $lt: cutoffDate } },
          { 'expires.$date': { $lt: cutoffDate } },
        ],
      })
      log.info(`Expired sessions cleaned up (${result.deletedCount} removed)`)
    } else {
      log.info('Redis-backed session store enabled')
    }
    const cutoffDate = new Date(Date.now() - cookieMaxAgeMs)
    const User = require('./models/User')
    const userResult = await User.updateMany(
      {},
      {
        $pull: {
          sessions: {
            expires: { $lt: cutoffDate },
          },
        },
      }
    )
    log.info(
      `User sessions cleaned up (${userResult.modifiedCount} users updated)`
    )
  } catch (error) {
    log.error('Database initialization failed:', error)
  }
}
async function webVars() {
  return {
    title: NAME,
    description: `${process.env.npm_package_description}` || 'description',
    author: process.env.npm_package_author || 'author',
    keywords: process.env.npm_package_keywords || 'keywords',
    url: await HOST,
    image: '/svg/nodejs.svg',
  }
}
async function renderApp() {
  app.get(`${BASE_PATH}/`, async (req, res) => {
    try {
      var vars = await webVars()
      await res.render('index', {
        ...vars,
        title: 'Home',
        currentPage: 'home',
      })
    } catch (error) {
      log.error('Error rendering home page:', error)
      res.status(500).send('Error rendering page!')
    }
  })
  app.get(`${BASE_PATH}/random/`, async (req, res) => {
    try {
      const vars = await webVars()
      await res.render('random', {
        ...vars,
        title: 'Random',
        currentPage: 'random',
      })
    } catch (error) {
      log.error('Error rendering random page:', error)
      res.status(500).send('Error rendering page!')
    }
  })
  app.get(`${BASE_PATH}/stats/`, async (req, res) => {
    try {
      const vars = await webVars()
      await res.render('stats', {
        ...vars,
        title: 'Stats',
        currentPage: 'stats',
      })
    } catch (error) {
      log.error('Error rendering stats page:', error)
      res.status(500).send('Error rendering page!')
    }
  })
  app.get(`${BASE_PATH}/search/`, async (req, res) => {
    try {
      const vars = await webVars()
      await res.render('search', {
        ...vars,
        title: 'Search',
        currentPage: 'search',
      })
    } catch (error) {
      log.error('Error rendering search page:', error)
      res.status(500).send('Error rendering page!')
    }
  })
  app.get(`${BASE_PATH}/files/`, async (req, res) => {
    try {
      const vars = await webVars()
      await res.render('files', {
        ...vars,
        title: 'Files',
        currentPage: 'files',
      })
    } catch (error) {
      log.error('Error rendering files page:', error)
      res.status(500).send('Error rendering page!')
    }
  })
  app.get(`${BASE_PATH}/files/*subdir`, async (req, res) => {
    try {
      const vars = await webVars()
      await res.render('files', {
        ...vars,
        title: 'Files',
        currentPage: 'files',
      })
    } catch (error) {
      log.error('Error rendering files page:', error)
      res.status(500).send('Error rendering page!')
    }
  })
  app.get(`${BASE_PATH}/login/`, async (req, res) => {
    try {
      var vars = await webVars()
      await res.render('login', {
        ...vars,
        title: 'Login',
        currentPage: 'login',
      })
    } catch (error) {
      log.error('Error rendering login page:', error)
      res.status(500).send('Error rendering page!')
    }
  })
  app.get(`${BASE_PATH}/register/`, async (req, res) => {
    try {
      var vars = await webVars()
      await res.render('register', {
        ...vars,
        title: 'Register',
        currentPage: 'register',
      })
    } catch (error) {
      log.error('Error rendering register page:', error)
      res.status(500).send('Error rendering page!')
    }
  })
  app.get(`${BASE_PATH}/download/`, async (req, res) => {
    try {
      var vars = await webVars()
      await res.render('download', {
        ...vars,
        title: 'Download',
        currentPage: 'download',
      })
    } catch (error) {
      log.error('Error rendering download page:', error)
      res.status(500).send('Error rendering page!')
    }
  })
  app.get(`${BASE_PATH}/dashboard/`, async (req, res) => {
    try {
      var vars = await webVars()
      await res.render('dashboard', {
        ...vars,
        title: 'Dashboard',
        currentPage: 'dashboard',
      })
    } catch (error) {
      log.error('Error rendering dashboard page:', error)
      res.status(500).send('Error rendering page!')
    }
  })
  app.get(`${BASE_PATH}/admin/`, async (req, res) => {
    try {
      var vars = await webVars()
      await res.render('admin', {
        ...vars,
        title: 'Admin',
        currentPage: 'admin',
      })
    } catch (error) {
      log.error('Error rendering admin page:', error)
      res.status(500).send('Error rendering page!')
    }
  })
  app.get(`${BASE_PATH}/404/`, async (req, res) => {
    try {
      var vars = await webVars()
      await res.render('404', {
        ...vars,
        title: 'Not Found',
        currentPage: 'Not Found',
      })
    } catch (error) {
      log.error('Error rendering 404 page:', error)
      res.status(500).send('Error rendering page!')
    }
  })
}
async function initApp() {
  app.set('trust proxy', true)
  app.use(setReqVars)
  app.use(require('cors')())
  app.use(BodyParser.urlencoded({ extended: true }))
  app.use(BodyParser.json())
  app.use(
    // @ts-ignore - no type declarations
    rateLimit({
      windowMs: RATE_LIMIT_WINDOW,
      max: RATE_LIMIT_MAX,
      validate: {
        trustProxy: false,
        xForwardedForHeader: false,
      },
    })
  )
  // @ts-ignore - no type declarations
  require('morgan-body')(app, {
    noColors: false,
    prettify: true,
    includeNewLine: true,
    logReqDateTime: true,
    dateTimeFormat: 'utc',
    logReqUserAgent: true,
    logRequestBody: true,
    logResponseBody: false,
    logIP: true,
    theme: 'defaultTheme',
    immediateReqLog: true,
  })
  app.set('trust proxy', true)
  app.use(require('cookie-parser')())
  app.use(require('express-useragent').express())
  app.use(
    session({
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      store: await initSessionStore(),
      cookie: {
        secure: NODE_ENV === 'production',
        maxAge: COOKIE_MAX_AGE,
        path: '/',
        httpOnly: true,
      },
    })
  )
  app.use(
    helmet({
      contentSecurityPolicy: false,
    })
  )
  app.use(
    require('lusca')({
      xframe: 'SAMEORIGIN',
      // https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/nonce
      csp: {
        policy: {},
        reportOnly: true,
      },
      hsts: {
        maxAge: COOKIE_MAX_AGE,
        includeSubDomains: true,
        preload: true,
      },
      nosniff: true,
      referrerPolicy: 'same-origin',
    })
  )
  app.use(passport.initialize())
  app.use(passport.session())
  app.set('view engine', 'ejs')
  app.set('views', path.join(__dirname, 'views'))
  app.use(
    express.json({
      type: 'application/json',
    })
  )
  app.use((req, res, next) => {
    if (
      !req.path.match(
        /\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|mp4|webm)$/i
      )
    ) {
      res.setHeader('Cache-Control', 'no-cache')
    }
    res.setHeader('X-Content-Type-Options', 'nosniff')
    next()
  })
  app.use(
    `${BASE_PATH}`,
    express.static('public', {
      etag: true,
      lastModified: true,
      maxAge: '1y',
      redirect: true,
      dotfiles: 'ignore',
      setHeaders: (res) => {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      },
    })
  )
  app.use(
    // @ts-ignore - no type declarations
    require('serve-favicon')(path.join(__dirname, 'public', 'favicon.ico'))
  )
  app.use((req, res, next) => {
    if (isbot(req.useragent?.source ?? '')) {
      log.debug('Bot/crawler detected:', req.useragent?.source)
      if (res.headersSent) {
        return next()
      }
    }
    next()
  })
}
async function initRoutes() {
  app.use(
    `${BASE_PATH}`,
    require('express-openapi-validator').middleware({
      apiSpec: 'openapi.yaml',
      validateApiSpec: true,
      validateResponses: false,
      validateRequests: true,
      validateSecurity: true,
      ignoreUndocumented: true,
    })
  )
  try {
    app.use(`${BASE_PATH}`, require('./routes'))
    log.info('API routes mounted')
  } catch (error) {
    log.error('Error mounting API routes:', error)
    throw error
  }
  await renderApp()
  log.info('Frontend routes mounted')
  app.use(async (req, res) => {
    log.debug('Page not found:', req.path)
    try {
      var vars = await webVars()
      res.status(404).render('404', {
        ...vars,
        title: 'Not Found',
        currentPage: 'Not Found',
      })
    } catch (error) {
      log.error('Error rendering 404 page:', error)
      res.status(500).send('Error rendering page!')
    }
  })
  app.use(
    /** @type {import('express').ErrorRequestHandler} */ (
      (error, req, res, next) => {
        log.error('An error occured:', error.message)
        log.error(error.stack)
        if (res.headersSent) {
          return next(error)
        }
        if (error && error.name === 'UnauthorizedError') {
          return sendResponse.error(
            res,
            401,
            'Invalid or missing authentication token'
          )
        }
        if (error?.status && error?.message) {
          return sendResponse.error(res, error.status, error.message)
        }
        return sendResponse.error(res, 500, 'Internal Server Error')
      }
    )
  )
}
process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception:', error)
  process.exit(1)
})
process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})
process.on('SIGTERM', async () => {
  try {
    await shutdownSessionStore()
    log.info('Session store shut down')
  } catch (error) {
    log.error('Failed to shut down session store:', error)
  }
  server.close(() => {
    log.info('Process terminated')
  })
})
async function verifyConfig() {
  try {
    await require('fs').promises.access(BASE_DIR)
    log.debug('Base directory accessible:', BASE_DIR)
  } catch (error) {
    log.error('Base directory inaccessible:', BASE_DIR)
    log.error(error instanceof Error ? error.stack : String(error))
    process.exit(1)
  }
  try {
    await HOST
    log.debug('Host available:', HOST)
  } catch (error) {
    log.error('Host unavailable', HOST)
    log.error(error instanceof Error ? error.stack : String(error))
  }
}
const banner = async () => {
  log.info(chalk.dim('━'.repeat(50)))
  log.info(
    '\n' +
      chalk.cyan(
        require('figlet').textSync(NAME, {
          font: 'Standard',
          horizontalLayout: 'full',
          verticalLayout: 'default',
          whitespaceBreak: true,
        })
      )
  )
  log.info(chalk.dim('━'.repeat(50)))
  log.info(chalk.gray('Status:'), chalk.green('Online'))
  log.info(chalk.gray('Mode:'), chalk.green(NODE_ENV))
  log.info(chalk.gray('URL:'), chalk.green((await HOST) + BASE_PATH))
  log.info(chalk.gray('Port:'), chalk.green(PORT))
  log.info(chalk.gray('Directory:'), chalk.green(BASE_DIR))
  log.info(chalk.dim('━'.repeat(50)))
}
async function main() {
  try {
    await verifyConfig()
    await processFiles()
    await initDB()
    await initApp()
    await initSwagger()
    await initRoutes()
    app.listen(PORT, BIND, (error) => {
      if (error) {
        throw error
      }
      log.info(`Server is listening on port ${PORT}`)
      log.info(`Server is running in ${NODE_ENV} mode`)
      banner()
    })
  } catch (error) {
    log.error('Failed to start server:', error)
    process.exit(1)
  }
}
main()
module.exports = app
