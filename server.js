const express = require('express');
const app = express();
const cors = require('cors');
const server = require('http').createServer(app);
const path = require('path');
const fs = require('fs').promises;
const logger = require('morgan');
const session = require('express-session');
const debug = require('debug')('gdl-api:server');
const chalk = require('chalk');
const figlet = require('figlet');
const { NODE_ENV, PORT, HOST, BASE_PATH, GALLERY_DL_DIR, SESSION_SECRET } = require('./config');
const { getUserPermission } = require('./utils/authUtils');
//const { processFiles } = require('./minify');
const SESSION_MAX_AGE = 30 * 60 * 1000;
app.use(cors());
app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: { 
    secure: NODE_ENV === 'production', 
    maxAge: SESSION_MAX_AGE,
    path: '/',
    httpOnly: true
  }
}));
app.use(express.json({ limit: '1mb' }));
app.use(logger('dev'));
app.use((req, res, next) => { res.setHeader('Cache-Control', 'public, max-age=180'); next(); });
app.use(BASE_PATH, express.static(path.join(__dirname, 'public'), {
  etag: true,
  lastModified: true,
  maxAge: '1h',
}));
app.use(`${BASE_PATH}/api`, async (req, res, next) => {
  if ((req.headers['user-agent'] || '').toLowerCase().includes('discordbot')) { 
    return next();
  }
  if (req.path.startsWith('/auth/')) { 
    return next();
  }
  const permission = await getUserPermission(req);
  if (permission && permission !== 'visitor') {
    return next();
  }
  res.setHeader('Cache-Control', 'no-cache, no-store');
  res.setHeader('Content-Type', 'application/json');
  try {
    await require('./utils/authUtils').isAuthenticated(req, res, next);
  } catch {
    return;
  }
});
app.get(`/favicon.ico`, (req, res) => { res.sendFile(path.join(__dirname, 'public', 'favicon.ico')); res.setHeader('Content-Type', 'image/x-icon'); });
app.get('/', (req, res) => { res.redirect(`${BASE_PATH}/`); });
app.get(`${BASE_PATH}/`, (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });
app.get(`${BASE_PATH}/random/`, (req, res) => { res.sendFile(path.join(__dirname, 'public', 'random.html')); });
app.get(`${BASE_PATH}/stats/`, (req, res) => { res.sendFile(path.join(__dirname, 'public', 'stats.html')); });
app.get(`${BASE_PATH}/search/`, (req, res) => { res.sendFile(path.join(__dirname, 'public', 'search.html')); });
app.get(`${BASE_PATH}/files/`, (req, res) => { res.sendFile(path.join(__dirname, 'public', 'files.html')); });
app.get(`${BASE_PATH}/files/*`, (req, res) => { res.sendFile(path.join(__dirname, 'public', 'files.html')); });
app.get(`${BASE_PATH}/login/`, (req, res) => { res.sendFile(path.join(__dirname, 'public', 'login.html')); });
app.use(BASE_PATH, require('./routes'));
app.use((req, res, next) => { 
  next();
});
app.use((req, res) => {
  res.status(404).json({ 
    message: 'Not Found',
    status: 404
  });
});
app.use((err, req, res, next) => {
  debug(err.stack);
  if (res.headersSent) {
    return next(err);
  }
  res.status(err.status || 500).json({
    message: 'Internal Server Error',
    status: err.status || 500
  });
});
process.on('uncaughtException', (error) => { debug('Uncaught Exception:', error); process.exit(1); });
process.on('unhandledRejection', (reason, promise) => { debug('Unhandled Rejection at:', promise, 'reason:', reason); process.exit(1); });
process.on('SIGTERM', () => { server.close(() => { console.log('Process terminated'); }); });
async function verifyConfiguration() {
  try {
    await fs.access(GALLERY_DL_DIR);
  } catch {
    debug(`ERROR: Gallery-DL directory not accessible: ${GALLERY_DL_DIR}`);
    process.exit(1);
  }
}
const displayBanner = () => {
  const banner = figlet.textSync('GDL-API', { font: 'Standard', horizontalLayout: 'full', verticalLayout: 'default' });
  console.log(chalk.cyan(banner));
  console.log(chalk.dim('━'.repeat(60)));
  console.log(`${chalk.gray('⚡ ')} ${chalk.white('Status:')}  ${chalk.green('Online')}`);
  console.log(`${chalk.gray('✨ ')} ${chalk.white('Mode:')}  ${chalk.green(NODE_ENV)}`);
  console.log(`${chalk.gray('🔗 ')} ${chalk.white('URL:')}  ${chalk.green(`https://${HOST}${BASE_PATH}/`)}`);
  console.log(`${chalk.gray('⚙️  ')} ${chalk.white('Port:')}  ${chalk.green(PORT)}`);
  console.log(`${chalk.gray('📂 ')} ${chalk.white('Directory:')}  ${chalk.green(`${GALLERY_DL_DIR}/`)}`);
  console.log(chalk.dim('━'.repeat(60)));
}
async function initializeServer() {
  await verifyConfiguration();
  app.listen(PORT, () => {
    displayBanner();
    debug(`Server is listening on port ${PORT}`);
    debug(`Server is running in ${NODE_ENV} mode`);
    //processFiles();
  });
}
initializeServer().catch(error => {
  debug('Failed to start server:', error);
  process.exit(1);
});
module.exports = app;