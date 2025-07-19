const mongoose = require('mongoose')
const passport = require('./utils/passport')
require('dotenv').config()
const express = require('express')
const app = express()
const cors = require('cors')
const server = require('http').createServer(app)
const path = require('path')
const fs = require('fs').promises
const morgan = require('morgan')
const session = require('express-session')
const debug = require('debug')('gdl-api:server')
const chalk = require('chalk')
const figlet = require('figlet')
const swaggerJsdoc = require('swagger-jsdoc')
const swaggerUi = require('swagger-ui-express')
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
const SESSION_MAX_AGE = 30 * 60 * 1000
const swaggerOptions = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: NAME,
      version: process.env.npm_package_version,
    },
    servers: [{ url: `https://alt-api.mcalec.dev` }],
  },
  apis: ['./routes/**/*.js', './utils/*.js'],
}
const swaggerSpec = swaggerJsdoc(swaggerOptions)
app.use(`${BASE_PATH}/docs`, swaggerUi.serve, swaggerUi.setup(swaggerSpec))
app.use(cors())
app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal'])
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      secure: NODE_ENV === 'production',
      maxAge: SESSION_MAX_AGE,
      path: '/',
      httpOnly: true,
    },
  })
)
app.use(passport.initialize())
app.use(passport.session())
app.use(morgan('dev'))
/*
morgan.token('full-url', (req) => `${req.protocol}://${req.get('host')}${req.originalUrl}`);
morgan.token('client-ip', (req) => req.headers['x-forwarded-for'] || req.socket.remoteAddress);
morgan.token('user-agent', (req) => req.get('user-agent'))
app.use(morgan((tokens, req, res) => {
  return [
    debug(chalk.green(`IP: ${tokens['client-ip'](req, res)}`)),
    debug(`${tokens.method(req, res)} ${tokens['full-url'](req, res)}`),
    debug(chalk.yellow(`Status: ${tokens.status(req, res)}`)),
    debug(chalk.red(`Response Time: ${tokens['response-time'](req, res)} ms`)),
    debug(chalk.gray(`User-Agent: ${tokens['user-agent'](req, res)}`))
  ]
}));
*/
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))
app.use(express.json({ limit: '1mb' }))
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=0')
  next()
})
app.use(
  `${BASE_PATH}/css`,
  express.static(path.join(__dirname, 'public', 'css'), {
    etag: true,
    lastModified: true,
    maxAge: '1h',
  })
)
app.use(
  `${BASE_PATH}/css/min`,
  express.static(path.join(__dirname, 'public', 'css', 'min'), {
    etag: true,
    lastModified: true,
    maxAge: '1h',
  })
)
app.use(
  `${BASE_PATH}/js`,
  express.static(path.join(__dirname, 'public', 'js'), {
    etag: true,
    lastModified: true,
    maxAge: '1h',
  })
)
app.use(
  `${BASE_PATH}/js/min`,
  express.static(path.join(__dirname, 'public', 'js', 'min'), {
    etag: true,
    lastModified: true,
    maxAge: '1h',
  })
)
app.use(
  `${BASE_PATH}/img`,
  express.static(path.join(__dirname, 'public', 'img'), {
    etag: true,
    lastModified: true,
    maxAge: '1h',
  })
)
app.use(
  `${BASE_PATH}/favicon.ico`,
  express.static(path.join(__dirname, 'public', 'favicon.ico'), {
    etag: true,
    lastModified: true,
    maxAge: '1h',
  })
)
app.use(
  `${BASE_PATH}/robots.txt`,
  express.static(path.join(__dirname, 'public', 'robots.txt'), {
    etag: true,
    lastModified: true,
    maxAge: '1h',
  })
)
app.use(
  `${BASE_PATH}/sitemap.xml`,
  express.static(path.join(__dirname, 'public', 'sitemap.xml'), {
    etag: true,
    lastModified: true,
    maxAge: '1h',
  })
)
mongoose
  .connect(MONGODB_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => debug('MongoDB connected'))
  .catch((err) => debug('MongoDB connection error:', err))
app.get('/', (req, res) => {
  res.redirect(`${BASE_PATH}/`)
})
app.get(/^\/(?!gdl\/).*/, (req, res) => {
  res.redirect(`${BASE_PATH}${req.path}`)
})
app.get('/robots.txt', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'robots.txt'))
  res.setHeader('Content-Type', 'text/plain')
})
app.get(`/favicon.ico`, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'favicon.ico'))
  res.setHeader('Content-Type', 'image/x-icon')
})
app.get(`/sitemap.xml`, (req, res) => {
  const sitemap = require('./utils/sitemap')
  res.setHeader('Content-Type', 'application/xml')
  res.send(sitemap.defaultSitemap.toXML())
})
app.get(`${BASE_PATH}/`, (req, res) => {
  res.render('index', {
    title: 'Home',
    currentPage: 'home',
  })
})
app.get(`${BASE_PATH}/random/`, (req, res) => {
  res.render('random', {
    title: 'Random',
    currentPage: 'random',
  })
})
app.get(`${BASE_PATH}/stats/`, (req, res) => {
  res.render('stats', {
    title: 'Stats',
    currentPage: 'stats',
  })
})
app.get(`${BASE_PATH}/search/`, (req, res) => {
  res.render('search', {
    title: 'Search',
    currentPage: 'search',
  })
})
/*
app.get(`${BASE_PATH}/files/`, (req, res) => {
  res.render('files', {
    title: 'Files',
    currentPage: 'files',
  })
})
app.get(`${BASE_PATH}/files/*`, (req, res) => {
  res.render('files', {
    title: 'Files',
    currentPage: 'files',
  })
})
*/
app.get(`${BASE_PATH}/files/`, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'files.html'))
  res.setHeader('Content-Type', 'text/html')
})
app.get(`${BASE_PATH}/files/*`, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'files.html'))
  res.setHeader('Content-Type', 'text/html')
})
app.get(`${BASE_PATH}/login/`, (req, res) => {
  res.render('login', {
    title: 'Login',
    currentPage: 'login',
  })
})
app.get(`${BASE_PATH}/register/`, (req, res) => {
  res.render('register', {
    title: 'Register',
    currentPage: 'register',
  })
})
app.get(`${BASE_PATH}/download/`, (req, res) => {
  res.render('download', {
    title: 'Download',
    currentPage: 'download',
  })
})
app.get(`${BASE_PATH}/navbar/`, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'navbar.html'))
})
app.get(`${BASE_PATH}/dashboard/`, (req, res) => {
  res.render('dashboard', {
    title: 'Dashboard',
    currentPage: 'dashboard',
  })
})
app.use(BASE_PATH, require('./routes'))
app.use((req, res, next) => {
  next()
})
app.use((req, res) => {
  res.status(404).json({
    message: 'Not Found',
    status: 404,
  })
})
app.use((err, req, res, next) => {
  debug(err.stack)
  if (res.headersSent) {
    return next(err)
  }
  res.status(500).json({
    message: 'Internal Server Error',
    status: 500,
  })
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
  server.close(() => {
    console.log('Process terminated')
  })
})
async function verifyConfiguration() {
  try {
    await fs.access(BASE_DIR)
  } catch {
    debug('Directory inaccessible:', BASE_DIR)
    process.exit(1)
  }
}
const displayBanner = async () => {
  const banner = figlet.textSync(process.env.NAME, {
    font: 'Standard',
    horizontalLayout: 'full',
    verticalLayout: 'default',
  })
  console.log(chalk.cyan(banner))
  console.log(chalk.dim('━'.repeat(60)))
  console.log(
    `${chalk.gray('⚡ ')} ${chalk.white('Status:')}  ${chalk.green('Online')}`
  )
  console.log(
    `${chalk.gray('✨ ')} ${chalk.white('Mode:')}  ${chalk.green(NODE_ENV)}`
  )
  console.log(
    `${chalk.gray('🔗 ')} ${chalk.white('URL:')}  ${chalk.green(`${await HOST}${BASE_PATH}/`)}`
  )
  console.log(
    `${chalk.gray('⚙️ ')} ${chalk.white('Port:')}  ${chalk.green(PORT)}`
  )
  console.log(
    `${chalk.gray('📂 ')} ${chalk.white('Directory:')}  ${chalk.green(`${BASE_DIR}/`)}`
  )
  console.log(chalk.dim('━'.repeat(60)))
}
async function initializeServer() {
  await verifyConfiguration()
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
