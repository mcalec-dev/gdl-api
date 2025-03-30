const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { RATE_LIMIT } = require('../../config');
const pathUtils = require('../../utils/pathUtils');

// Import routes
const randomRouter = require('./random');
const filesRouter = require('./files');
const statsRouter = require('./stats');
const searchRouter = require('./search');
const cacheRouter = require('./cache');

const apiLimiter = rateLimit({
    windowMs: RATE_LIMIT.windowMs,
    max: RATE_LIMIT.maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    trustProxy: false
});

// Apply rate limiter
router.use(apiLimiter);

// Make these utilities available to all routes via req.utils
router.use((req, res, next) => {
    req.utils = {
        ...req.utils, // Preserve any existing utils
        pathUtils     // Add pathUtils as a namespace
    };
    next();
});

// Mount routes
router.use('/files', filesRouter);
router.use('/search', searchRouter);
router.use('/random', randomRouter);
router.use('/cache', cacheRouter);
router.use('/stats', statsRouter);

// API root endpoint
router.get('/', (req, res) => {
    res.json({
        status: 'API is running',
        endpoints: [
            '/random',
            '/files'
        ]
    });
});

// Export the router
module.exports = router;