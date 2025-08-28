require('dotenv').config({ quiet: true })
const express = require('express')
const figlet = require('figlet')
const swaggerJsdoc = require('swagger-jsdoc')
const session = require('express-session')
const cors = require('cors')
const morgan = require('morgan')
const sessionStore = require('./utils/sessionStore')
const app = express()
const server = require('http').createServer(app)
const path = require('path')
const debug = require('debug')('gdl-api:server')
const chalk = require('chalk')
const swaggerUi = require('swagger-ui-express')
const passport = require('./utils/passport')
const User = require('./models/User')
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
} = require('./config')
const SESSION_COOKIE_MAX_AGE = 30 * 60 * 1000
const swaggerOptions = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: NAME,
      version: process.env.npm_package_version,
    },
    servers: [{ url: HOST }],
  },
  apis: ['./routes/**/*.js', './utils/*.js'],
}
const swaggerSpec = swaggerJsdoc(swaggerOptions)
app.use(`${BASE_PATH}/docs`, swaggerUi.serve, swaggerUi.setup(swaggerSpec))
app.use(cors())
app.set('trust proxy', true)
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    store: sessionStore(),
    cookie: {
      secure: NODE_ENV === 'production',
      maxAge: SESSION_COOKIE_MAX_AGE,
      path: '/',
      httpOnly: true,
    },
  })
)
app.use(passport.initialize())
app.use(passport.session())
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))
app.use(
  express.json({
    limit: '100MB',
    type: 'application/json',
  })
)
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=180')
  next()
})
app.use(morgan('dev'))
// host all files in the public dir
app.use(
  BASE_PATH,
  express.static(path.join(__dirname, 'public'), {
    etag: true,
    lastModified: true,
    maxAge: '1d',
  })
)
if (BASE_PATH) {
  app.get('/', (req, res) => {
    res.redirect(302, `${BASE_PATH}/`)
  })
  app.post('/', (req, res) => {
    res.redirect(307, `${BASE_PATH}/`)
  })
}
app.use((req, res, next) => {
  if (!req.url.startsWith(BASE_PATH)) {
    return res.redirect(302, `${BASE_PATH}${req.url}`)
  }
  next()
})
// initialize database connection and store
async function initDatabase() {
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
app.get('/robots.txt', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'robots.txt'))
  res.setHeader('Content-Type', 'text/plain')
})
app.get(`/favicon.ico`, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'favicon.ico'))
  res.setHeader('Content-Type', 'image/x-icon')
})
async function webVars() {
  return {
    title: NAME,
    description: process.env.npm_package_description || 'description',
    author: process.env.npm_package_author || 'author',
    keywords: process.env.npm_package_keywords || 'keywords',
    url: `${await HOST}`,
    image: '/svg/nodejs.svg',
  }
}
app.get(`${BASE_PATH}/`, async (req, res) => {
  var vars = await webVars()
  res.render('index', {
    title: 'Home',
    currentPage: 'home',
    ...vars,
  })
})
app.get(`${BASE_PATH}/random/`, async (req, res) => {
  const vars = await webVars()
  res.render('random', {
    title: 'Random',
    currentPage: 'random',
    ...vars,
  })
})
app.get(`${BASE_PATH}/stats/`, async (req, res) => {
  const vars = await webVars()
  res.render('stats', {
    title: 'Stats',
    currentPage: 'stats',
    ...vars,
  })
})
app.get(`${BASE_PATH}/search/`, async (req, res) => {
  const vars = await webVars()
  res.render('search', {
    title: 'Search',
    currentPage: 'search',
    ...vars,
  })
})
app.get(`${BASE_PATH}/files/`, async (req, res) => {
  const vars = await webVars()
  res.render('files', {
    title: 'Files',
    currentPage: 'files',
    ...vars,
  })
})
app.get(`${BASE_PATH}/files/*`, async (req, res) => {
  const vars = await webVars()
  res.render('files', {
    title: 'Files',
    currentPage: 'files',
    ...vars,
  })
})
app.get(`${BASE_PATH}/revamp/`, async (req, res) => {
  const vars = await webVars()
  res.render('filesNew', {
    title: 'Files',
    currentPage: 'files',
    ...vars,
  })
})
app.get(`${BASE_PATH}/login/`, async (req, res) => {
  var vars = await webVars()
  res.render('login', {
    title: 'Login',
    currentPage: 'login',
    ...vars,
  })
})
app.get(`${BASE_PATH}/register/`, async (req, res) => {
  var vars = await webVars()
  res.render('register', {
    title: 'Register',
    currentPage: 'register',
    ...vars,
  })
})
app.get(`${BASE_PATH}/download/`, async (req, res) => {
  var vars = await webVars()
  res.render('download', {
    title: 'Download',
    currentPage: 'download',
    ...vars,
  })
})
app.get(`${BASE_PATH}/dashboard/`, async (req, res) => {
  var vars = await webVars()
  res.render('dashboard', {
    title: 'Dashboard',
    currentPage: 'dashboard',
    ...vars,
  })
})
app.get(`${BASE_PATH}/admin/`, async (req, res) => {
  var vars = await webVars()
  res.render('admin', {
    title: 'Admin',
    currentPage: 'admin',
    ...vars,
  })
})
// mount api routes
app.use(BASE_PATH, require('./routes'))
// 404 and error handlers
app.use((req, res, next) => {
  next()
})
app.use((req, res) => {
  res.status(404).json({
    message: 'Not Found',
    status: 404,
  })
})
app.use((req, res, next, error) => {
  debug(error.stack)
  return next(error)
})
process.on('uncaughtException', (error) => {
  debug('Uncaught Exception:', error)
  process.exit(1)
})
process.on('unhandledRejection', (reason, promise) => {
  debug('Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})
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
async function verifyConfiguration() {
  try {
    await fs.access(BASE_DIR)
    await HOST
  } catch {
    debug('Directory inaccessible:', BASE_DIR)
    process.exit(1)
  }
}
const displayBanner = async () => {
  const banner = figlet.textSync(NAME, {
    font: 'Standard',
    horizontalLayout: 'full',
    verticalLayout: 'default',
  })
  console.log(chalk.cyan(banner))
  console.log(chalk.dim('━'.repeat(50)))
  console.log(chalk.gray('⚡ '), chalk.white('Status:'), chalk.green('Online'))
  console.log(chalk.gray('✨ '), chalk.white('Mode:'), chalk.green(NODE_ENV))
  console.log(
    chalk.gray('🔗 '),
    chalk.white('URL:'),
    chalk.green(`${await HOST}${BASE_PATH}/`)
  )
  console.log(chalk.gray('⚙️ '), chalk.white('Port:'), chalk.green(PORT))
  console.log(
    chalk.gray('📂 '),
    chalk.white('Directory:'),
    chalk.green(`${BASE_DIR}/`)
  )
  console.log(chalk.dim('━'.repeat(50)))
}
async function initializeServer() {
  await verifyConfiguration()
  await initDatabase()
  app.listen(PORT, () => {
    debug(`Server is listening on port ${PORT}`)
    debug(`Server is running in ${NODE_ENV} mode`)
  })
  displayBanner()
}
initializeServer().catch((error) => {
  debug('Failed to start server:', error)
  process.exit(1)
})
module.exports = app
