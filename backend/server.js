const express = require('express')
const figlet = require('figlet')
const swaggerJsdoc = require('swagger-jsdoc')
const session = require('express-session')
const cors = require('cors')
const { processFiles } = require('./minify')
const lusca = require('lusca')
const sessionStore = require('./utils/sessionStore')
const app = express()
const server = require('http').createServer(app)
const path = require('path')
const debug = require('debug')('gdl-api:server')
const chalk = require('chalk')
const swaggerUi = require('swagger-ui-express')
const passport = require('./utils/passport')
const User = require('./models/User')
const RateLimit = require('express-rate-limit')
const morganBody = require('morgan-body')
const fs = require('fs').promises
const mongoose = require('mongoose')
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
  BOT_USER_AGENTS,
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
    await mongoose.connect(MONGODB_URL)
    debug('MongoDB connected')
  } catch (error) {
    debug('MongoDB connection error:', error)
  }
  try {
    store.clear()
    debug('All sessions cleared on server start.')
    await User.updateMany({}, { $set: { sessions: [] } })
    debug('All user sessions cleared for all users.')
  } catch (error) {
    debug('Failed to clear sessions on server start:', error)
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
    dateTimeFormat: 'utc',
    logReqUserAgent: true,
    logRequestBody: true,
    logResponseBody: false,
    logIP: true,
    theme: 'dimmed',
    immediateReqLog: true,
  })
  // dont trust proxies
  app.set('trust proxy', true)
  // express sessions
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
  // use crsf
  app.use(
    lusca({
      //csrf: true,
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
    const UserAgent = req.headers['user-agent'] || req.get('User-Agent') || ''
    const isBot = BOT_USER_AGENTS.some((botAgent) =>
      UserAgent.includes(botAgent)
    )
    const chance = TROLLING_CHANCE
    const terms = TROLLING_TERMS
    if (Math.random() < chance) {
      if (isBot) {
        debug('Bot detected:', UserAgent)
        return res.send('Bot detected!')
      }
      debug('Sending troll to:', req.ip, UserAgent)
      return res.sendFile(
        path.join(__dirname, 'public', 'video', 'rickroll.mp4')
      )
    }
    const uri = req.path + '?' + new URLSearchParams(req.query).toString()
    const containsBlockedTerm = terms.some((term) =>
      uri.toLowerCase().includes(term.toLowerCase())
    )
    if (containsBlockedTerm) {
      debug('Sending troll to:', req.ip, UserAgent)
      return res.sendFile(
        path.join(__dirname, 'public', 'video', 'so-you-found-it.mp4')
      )
    }
    next()
  })
  // bot detection middleware
  app.use((req, res, next) => {
    const UserAgent = req.headers['user-agent'] || req.get('User-Agent') || ''
    const isBot = BOT_USER_AGENTS.some((botAgent) =>
      UserAgent.includes(botAgent)
    )
    if (isBot) {
      debug('Bot detected:', UserAgent)
      if (res.headersSent) {
        return next()
      }
    }
    if (isBot) {
      debug('Bot detected:', UserAgent)
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
