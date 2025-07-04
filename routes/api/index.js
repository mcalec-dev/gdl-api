const express = require('express');
const router = express.Router();
const { getAPIUrl } = require('../../utils/urlUtils');
const debug = require('debug')('gdl-api:api:routes');
const pathUtils = require('../../utils/pathUtils');
const authRouter = require('./auth');
const downloadRouter = require('./download');
const filesRouter = require('./files');
const randomRouter = require('./random');
const searchRouter = require('./search');
const statsRouter = require('./stats');
debug('Initializing API routes');

router.use((req, res, next) => {
  req.utils = {
    ...req.utils,
    pathUtils
  };
  next();
});

debug('Mounting auth routes');
router.use('/auth', authRouter);

debug('Mounting files routes');
router.use('/files', filesRouter);

debug('Mounting download routes');
router.use('/download', downloadRouter);

debug('Mounting random routes');
router.use('/random', randomRouter);

debug('Mounting search routes');
router.use('/search', searchRouter);

debug('Mounting stats routes');
router.use('/stats', statsRouter);

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