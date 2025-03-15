const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const GALLERY_DL_DIR = process.env.GALLERY_DL_DIR || '/path/to/your/gallery-dl/downloads';
const EXCLUDED_DIRS = (process.env.EXCLUDED_DIRS || '').split(',').filter(Boolean);
const EXCLUDED_FILES = (process.env.EXCLUDED_FILES || '').split(',').filter(Boolean);
const ALLOWED_EXTENSIONS = (process.env.ALLOWED_EXTENSIONS || '.jpg,.jpeg,.png,.gif,.webp').split(',').filter(Boolean);
const MAX_DEPTH = parseInt(process.env.MAX_DEPTH || '10', 10);
const BASE_PATH = process.env.BASE_PATH || '/gdl';  // Use environment variable with fallback

// Add rate limit configuration
const RATE_LIMIT = {
  windowMs: (process.env.RATE_LIMIT_WINDOW_MINUTES || 15) * 60 * 1000, // Convert minutes to milliseconds
  maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || 100, 10)
};

module.exports = {
  GALLERY_DL_DIR,
  EXCLUDED_DIRS,
  EXCLUDED_FILES,
  ALLOWED_EXTENSIONS,
  MAX_DEPTH,
  BASE_PATH,
  RATE_LIMIT
};