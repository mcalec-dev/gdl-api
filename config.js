const dotenv = require('dotenv');
const debug = require('debug')('gdl-api:exclusions');

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3030;
const BASE_PATH = process.env.BASE_PATH || '/gdl';
const GALLERY_DL_DIR = process.env.GALLERY_DL_DIR || '/path/to/your/gallery-dl/downloads';

if (!GALLERY_DL_DIR) {
  console.error('ERROR: GALLERY_DL_DIR environment variable is not set');
  process.exit(1);
}

const EXCLUDED_DIRS = (process.env.EXCLUDED_DIRS || '')
  .split(',')
  .map(dir => dir.trim())
  .filter(Boolean);
const EXCLUDED_FILES = (process.env.EXCLUDED_FILES || '').split(',').filter(Boolean);
const ALLOWED_EXTENSIONS = (process.env.ALLOWED_EXTENSIONS || '.jpg,.jpeg,.png,.gif,.webp').split(',').filter(Boolean);
const MAX_DEPTH = parseInt(process.env.MAX_DEPTH || '10', 10);

// Add rate limit configuration
const RATE_LIMIT = {
  windowMs: (process.env.RATE_LIMIT_WINDOW_MINUTES || 15) * 60 * 1000, // Convert minutes to milliseconds
  maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || 100, 10)
};

// Log exclusion patterns on startup
debug('Excluded directories:', EXCLUDED_DIRS);
debug('Excluded files:', EXCLUDED_FILES);

module.exports = {
  PORT,
  BASE_PATH,
  GALLERY_DL_DIR,
  EXCLUDED_DIRS,
  EXCLUDED_FILES,
  ALLOWED_EXTENSIONS,
  MAX_DEPTH,
  RATE_LIMIT,
  debug
};