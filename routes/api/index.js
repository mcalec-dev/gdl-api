const express = require('express');
const router = express.Router();
const pathUtils = require('../../utils/pathUtils');
const filesRouter = require('./files');
const randomRouter = require('./random');
const searchRouter = require('./search');
const statsRouter = require('./stats');
const authRouter = require('./auth');
const { getAPIUrl } = require('../../utils/urlUtils');
const debug = require('debug')('gdl-api:routes');

debug('Initializing API routes');

// Make these utilities available to all routes via req.utils
router.use((req, res, next) => {
  req.utils = {
    ...req.utils, // Preserve any existing utils
    pathUtils     // Add pathUtils as a namespace
  };
  next();
});

// Auth routes
debug('Mounting auth routes');
router.use('/auth', authRouter);

// Mount routes - these will now work correctly
debug('Mounting files routes');
router.use('/files', filesRouter);

debug('Mounting random routes');
router.use('/random', randomRouter);

debug('Mounting search routes');
router.use('/search', searchRouter);

debug('Mounting stats routes');
router.use('/stats', statsRouter);

// API root endpoint
router.get('/', (req, res) => {
  debug('Handling request for API root');
  const baseURL = getAPIUrl(req);
  debug(`Base URL for API: ${baseURL}`);
  res.json({
    auth_url: baseURL + '/auth',
    files_url: baseURL + '/files',
    random_url: baseURL + '/random',
    search_url: baseURL + '/search',
    stats_url: baseURL + '/stats',
  });
});

debug('All routes mounted successfully');

module.exports = router;