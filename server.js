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
const {
  NODE_ENV,
  PORT,
  HOST,
  BASE_PATH,
  GALLERY_DL_DIR,
  SESSION_SECRET,
} = require('./config')
const { getUserPermission } = require('./utils/authUtils')
const swaggerJsdoc = require('swagger-jsdoc')
const swaggerUi = require('swagger-ui-express')
const SESSION_MAX_AGE = 30 * 60 * 1000
const swaggerOptions = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'gdl-api',
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
app.use(express.json({ limit: '1mb' }))
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=180')
  next()
})
app.use(
  BASE_PATH,
  express.static(path.join(__dirname, 'public'), {
    etag: true,
    lastModified: true,
    maxAge: '1h',
  })
)
app.use(`${BASE_PATH}/api`, async (req, res, next) => {
  if (req.path.startsWith('/auth/')) {
    return next()
  }
  const permission = await getUserPermission(req)
  if (permission && permission !== 'visitor') {
    return next()
  }
  res.setHeader('Cache-Control', 'no-cache, no-store')
  res.setHeader('Content-Type', 'application/json')
  try {
    await require('./utils/authUtils').isAuthenticated(req, res, next)
  } catch {
    return
  }
})
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
app.get(`${BASE_PATH}/`, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})
app.get(`${BASE_PATH}/random/`, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'random.html'))
})
app.get(`${BASE_PATH}/stats/`, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'stats.html'))
})
app.get(`${BASE_PATH}/search/`, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'search.html'))
})
app.get(`${BASE_PATH}/files/`, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'files.html'))
})
app.get(`${BASE_PATH}/files/*`, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'files.html'))
})
app.get(`${BASE_PATH}/login/`, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'))
})
app.get(`${BASE_PATH}/download/`, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'download.html'))
})
app.get(`${BASE_PATH}/navbar/`, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'navbar.html'))
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
  res.status(err.status || 500).json({
    message: 'Internal Server Error',
    status: err.status || 500,
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
    await fs.access(GALLERY_DL_DIR)
  } catch {
    debug(`ERROR: Gallery-DL directory not accessible: ${GALLERY_DL_DIR}`)
    process.exit(1)
  }
}
const displayBanner = async () => {
  const banner = figlet.textSync('GDL-API', {
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
    `${chalk.gray('📂 ')} ${chalk.white('Directory:')}  ${chalk.green(`${GALLERY_DL_DIR}/`)}`
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
