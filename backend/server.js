const express = require('express')
const session = require('express-session')
const swaggerJsdoc = require('swagger-jsdoc')
const cors = require('cors')
const lusca = require('lusca')
const { isbot } = require('isbot')
const { processFiles } = require('./minify')
const { setReqVars } = require('./utils/requestUtils')
const app = express()
const sessionStore = require('./utils/sessionStore')
const passport = require('./utils/passport')
const path = require('path')
const chalk = require('chalk')
const server = require('http').createServer(app)
const figlet = require('figlet')
const RateLimit = require('express-rate-limit')
const swaggerUi = require('swagger-ui-express')
const debug = require('debug')('gdl-api:server')
const BodyParser = require('body-parser')
const fs = require('fs').promises
const morganBody = require('morgan-body')
const {
  NODE_ENV,
  PORT,
  NAME,
  HOST,
  BASE_PATH,
  BASE_DIR,
  SESSION_SECRET,
  MONGODB_URL,
  COOKIE_MAX_AGE,
  RATE_LIMIT_WINDOW,
  RATE_LIMIT_MAX,
  TROLLING_CHANCE,
  TROLLING_TERMS,
} = require('./config')
// init swagger docs
async function initSwagger() {
  const swaggerOptions = {
    definition: {
      openapi: '3.0.3',
      servers: [
        {
          url: `https://${await HOST}${BASE_PATH}`,
        },
      ],
      info: {
        title: NAME,
        version: process.env.npm_package_version,
      },
    },
    apis: ['./routes/**/*.js'],
  }
  const swaggerSpec = swaggerJsdoc(swaggerOptions)
  app.use(`${BASE_PATH}/docs`, swaggerUi.serve, swaggerUi.setup(swaggerSpec))
}
if (BASE_PATH) {
  app.get('/', (req, res) => {
    res.redirect(302, `${BASE_PATH}/`)
  })
  app.post('/', (req, res) => {
    res.redirect(307, `${BASE_PATH}/`)
  })
}
// init mongodb and session store
async function initDB() {
  const store = sessionStore()
  try {
    const connection = await require('mongoose').connect(MONGODB_URL)
    debug('MongoDB connected')
    const gridfsUtils = require('./utils/gridfsUtils')
    gridfsUtils.initGridFS()
    if (store) {
      const db = connection.connection.db
      const sessions = db.collection('sessions')
      const cutoffDate = new Date(Date.now() - COOKIE_MAX_AGE)
      const result = await sessions.deleteMany({ expires: { $lt: cutoffDate } })
      debug(
        `Expired sessions cleaned up (${result.deletedCount} removed, cutoff: ${cutoffDate})`
      )
    }
  } catch (error) {
    console.error('Database initialization failed:', error)
  }
}
// common template variables
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
// render the app with ejs
async function renderApp() {
  app.get(`${BASE_PATH}/`, async (req, res) => {
    try {
      var vars = await webVars()
      res.render('index', {
        title: 'Home',
        currentPage: 'home',
        ...vars,
      })
    } catch (error) {
      debug('Error rendering home page:', error)
      res.status(500).send('Error rendering page!')
    }
  })
  app.get(`${BASE_PATH}/random/`, async (req, res) => {
    try {
      const vars = await webVars()
      res.render('random', {
        title: 'Random',
        currentPage: 'random',
        ...vars,
      })
    } catch (error) {
      debug('Error rendering random page:', error)
      res.status(500).send('Error rendering page!')
    }
  })
  app.get(`${BASE_PATH}/stats/`, async (req, res) => {
    try {
      const vars = await webVars()
      res.render('stats', {
        title: 'Stats',
        currentPage: 'stats',
        ...vars,
      })
    } catch (error) {
      debug('Error rendering stats page:', error)
      res.status(500).send('Error rendering page!')
    }
  })
  app.get(`${BASE_PATH}/search/`, async (req, res) => {
    try {
      const vars = await webVars()
      res.render('search', {
        title: 'Search',
        currentPage: 'search',
        ...vars,
      })
    } catch (error) {
      debug('Error rendering search page:', error)
      res.status(500).send('Error rendering page!')
    }
  })
  app.get(`${BASE_PATH}/files/`, async (req, res) => {
    try {
      const vars = await webVars()
      res.render('files', {
        title: 'Files',
        currentPage: 'files',
        ...vars,
      })
    } catch (error) {
      debug('Error rendering files page:', error)
      res.status(500).send('Error rendering page!')
    }
  })
  app.get(`${BASE_PATH}/files/*`, async (req, res) => {
    try {
      const vars = await webVars()
      res.render('files', {
        title: 'Files',
        currentPage: 'files',
        ...vars,
      })
    } catch (error) {
      debug('Error rendering files page:', error)
      res.status(500).send('Error rendering page!')
    }
  })
  app.get(`${BASE_PATH}/login/`, async (req, res) => {
    try {
      var vars = await webVars()
      res.render('login', {
        title: 'Login',
        currentPage: 'login',
        ...vars,
      })
    } catch (error) {
      debug('Error rendering login page:', error)
      res.status(500).send('Error rendering page!')
    }
  })
  app.get(`${BASE_PATH}/register/`, async (req, res) => {
    try {
      var vars = await webVars()
      res.render('register', {
        title: 'Register',
        currentPage: 'register',
        ...vars,
      })
    } catch (error) {
      debug('Error rendering register page:', error)
      res.status(500).send('Error rendering page!')
    }
  })
  app.get(`${BASE_PATH}/download/`, async (req, res) => {
    try {
      var vars = await webVars()
      res.render('download', {
        title: 'Download',
        currentPage: 'download',
        ...vars,
      })
    } catch (error) {
      debug('Error rendering download page:', error)
      res.status(500).send('Error rendering page!')
    }
  })
  app.get(`${BASE_PATH}/dashboard/`, async (req, res) => {
    try {
      var vars = await webVars()
      res.render('dashboard', {
        title: 'Dashboard',
        currentPage: 'dashboard',
        ...vars,
      })
    } catch (error) {
      debug('Error rendering dashboard page:', error)
      res.status(500).send('Error rendering page!')
    }
  })
  app.get(`${BASE_PATH}/admin/`, async (req, res) => {
    try {
      var vars = await webVars()
      res.render('admin', {
        title: 'Admin',
        currentPage: 'admin',
        ...vars,
      })
    } catch (error) {
      debug('Error rendering admin page:', error)
      res.status(500).send('Error rendering page!')
    }
  })
  app.get(`${BASE_PATH}/404/`, async (req, res) => {
    try {
      var vars = await webVars()
      res.render('404', {
        title: 'Not Found',
        currentPage: 'Not Found',
        ...vars,
      })
    } catch (error) {
      debug('Error rendering 404 page:', error)
      res.status(500).send('Error rendering page!')
    }
  })
}
// init the express app
async function initApp() {
  // set request variables
  app.use(setReqVars)
  // use cors headers
  app.use(cors())
  // rate limiting
  app.use(
    RateLimit({
      windowMs: RATE_LIMIT_WINDOW,
      max: RATE_LIMIT_MAX,
    })
  )
  // logging
  morganBody(app, {
    noColors: false,
    prettify: true,
    includeNewLine: true,
    logReqDateTime: true,
    timezone: 'America/New_York',
    dateTimeFormat: 'utc',
    logReqUserAgent: true,
    logRequestBody: true,
    logResponseBody: false,
    logIP: true,
    theme: 'dimmed',
    immediateReqLog: true,
  })
  // trust proxy
  app.set('trust proxy', true)
  // parse cookies
  //app.use(cookieParser())
  // parse body
  app.use(BodyParser.urlencoded({ extended: true }))
  app.use(BodyParser.json())
  // session middleware
  app.use(
    session({
      secret: SESSION_SECRET,
      resave: true,
      saveUninitialized: true,
      rolling: true,
      store: sessionStore(),
      cookie: {
        secure: NODE_ENV === 'production',
        maxAge: COOKIE_MAX_AGE,
        path: '/',
        httpOnly: true,
      },
    })
  )
  // security middleware
  app.use(
    lusca({
      xframe: 'SAMEORIGIN',
      hsts: {
        maxAge: COOKIE_MAX_AGE,
        includeSubDomains: true,
        preload: true,
      },
      nosniff: true,
      referrerPolicy: 'same-origin',
    })
  )
  // jwt middleware
  //app.use(jwtMiddleware)
  // init passport
  app.use(passport.initialize())
  app.use(passport.session())
  // view engine
  app.set('view engine', 'ejs')
  app.set('views', path.join(__dirname, 'views'))
  // body parser
  app.use(
    express.json({
      type: 'application/json',
    })
  )
  // security headers
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'public, max-age=180')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    next()
  })
  // mount static files
  app.use(
    `${BASE_PATH}`,
    express.static(path.join(__dirname, 'public'), {
      etag: true,
      lastModified: true,
      maxAge: '1d',
      redirect: true,
      headers: {
        'Cache-Control': 'public, max-age=180',
      },
    })
  )
  // special static files
  app.get('/robots.txt', (req, res) => {
    res.setHeader('Content-Type', 'text/plain')
    res.sendFile(path.join(__dirname, 'public', 'robots.txt'))
  })
  app.get(`/favicon.ico`, (req, res) => {
    res.setHeader('Content-Type', 'image/x-icon')
    res.sendFile(path.join(__dirname, 'public', 'favicon.ico'))
  })
  // trolling middleware
  app.use((req, res, next) => {
    const ua = req.headers['user-agent'] || req.get('User-Agent')
    const uri = req.path + '?' + new URLSearchParams(req.query).toString()
    const chance = TROLLING_CHANCE
    const terms = TROLLING_TERMS
    const uriRickroll = uri.toLowerCase().includes('rickroll')
    if (Math.random() < chance || uriRickroll) {
      if (isbot(ua)) {
        debug('Bot detected:', ua)
        return res.send('Bot detected!')
      }
      debug('Sending troll to:', req.ip, ua)
      return res.sendFile(
        path.join(__dirname, 'public', 'video', 'rickroll.mp4')
      )
    }
    const containsBlockedTerm = terms.some((term) =>
      uri.toLowerCase().includes(term.toLowerCase())
    )
    if (containsBlockedTerm) {
      debug('Sending troll to:', req.ip, ua)
      return res.sendFile(
        path.join(__dirname, 'public', 'video', 'so-you-found-it.mp4')
      )
    }
    next()
  })
  // bot detection middleware
  app.use((req, res, next) => {
    const ua = req.headers['user-agent'] || req.get('User-Agent')
    if (isbot(ua)) {
      debug('Bot detected:', ua)
      if (res.headersSent) {
        return next()
      }
    }
    next()
  })
}
async function setupRoutes() {
  try {
    app.use(`${BASE_PATH}`, require('./routes'))
    debug('API routes mounted successfully')
  } catch (error) {
    debug('Error mounting API routes:', error)
    throw error
  }
  await renderApp()
  console.log(chalk.green('✓ Frontend routes mounted'))
  app.use(async (req, res) => {
    debug('Not found:', req.path)
    try {
      var vars = await webVars()
      res.status(404).render('404', {
        title: 'Not Found',
        currentPage: 'Not Found',
        ...vars,
      })
    } catch (error) {
      debug('Error rendering 404 page:', error)
      res.status(500).send('Error rendering page!')
    }
  })
  app.use((error, req, res, next) => {
    debug('An error occured:', error.message)
    debug(error.stack)
    if (res.headersSent) {
      return next(error)
    }
    if (error && error.name === 'UnauthorizedError') {
      return res.status(401).json({
        message: 'Invalid or missing authentication token',
        status: '401',
        error: NODE_ENV === 'development' ? error.message : 'Unauthorized',
      })
    }
    res.status(500).json({
      message: 'Interal Server Error',
      status: '500',
      error:
        NODE_ENV === 'development' ? error.message : 'Something went wrong.',
    })
  })
}
// process handlers
process.on('uncaughtException', (error) => {
  debug('Uncaught Exception:', error)
  process.exit(1)
})
process.on('unhandledRejection', (reason, promise) => {
  debug('Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})
// gracefully shutdown
process.on('SIGTERM', () => {
  const store = sessionStore()
  if (store && typeof store.clear === 'function') {
    store
      .clear()
      .then(() => {
        console.log('All sessions cleared.')
        server.close(() => {
          console.log('Process terminated')
        })
      })
      .catch((err) => {
        console.error('Failed to clear sessions:', err)
        server.close(() => {
          console.log('Process terminated')
        })
      })
  } else {
    server.close(() => {
      console.log('Process terminated')
    })
  }
})
// verify the imported config
async function verifyConfig() {
  try {
    await fs.access(BASE_DIR)
    debug('Base directory accessible:', BASE_DIR)
  } catch (error) {
    debug('Base directory inaccessible:', BASE_DIR)
    debug(error.stack)
    process.exit(1)
  }
  try {
    await HOST
    debug('Host available:', HOST)
  } catch (error) {
    debug('Host unavailable', HOST)
    debug(error.stack)
  }
}
// display the startup banner
const displayBanner = async () => {
  const banner = figlet.textSync(NAME, {
    font: 'Standard',
    horizontalLayout: 'full',
    verticalLayout: 'default',
  })
  console.log(chalk.dim('━'.repeat(50)))
  console.log(chalk.cyan(banner))
  console.log(chalk.dim('━'.repeat(50)))
  console.log(chalk.gray('⚡ Status:'), chalk.green('Online'))
  console.log(chalk.gray('✨ Mode:'), chalk.green(NODE_ENV))
  console.log(chalk.gray('🔗 URL:'), chalk.green((await HOST) + BASE_PATH))
  console.log(chalk.gray('⚙️  Port:'), chalk.green(PORT))
  console.log(chalk.gray('📂 Directory:'), chalk.green(BASE_DIR))
  console.log(chalk.dim('━'.repeat(50)))
}
// init the server
async function initServer() {
  try {
    await verifyConfig()
    console.log(chalk.green('✓ Verified config'))
    await initDB()
    console.log(chalk.green('✓ Database initialized'))
    await initApp()
    console.log(chalk.green('✓ Express app initialized'))
    await initSwagger()
    console.log(chalk.green('✓ Swagger docs initialized'))
    await processFiles()
    console.log(chalk.green('✓ Files processed'))
    await setupRoutes()
    console.log(chalk.green('✓ Routes setup complete'))
    app.listen(PORT, () => {
      debug(`Server is listening on port ${PORT}`)
      debug(`Server is running in ${NODE_ENV} mode`)
      displayBanner()
    })
  } catch (error) {
    debug('Failed to start server:', error)
    process.exit(1)
  }
}
initServer()
module.exports = app
